# Agent flows — specification

Agent flows called by the agent start with **When an agent calls the flow** and end with **Respond to the agent**. Child flows (*Register hold*, *Gather credit facts*, *Load licensed skill (child)*, *Log & notify*) start with **Manually trigger a flow**. *Check for new holds* runs on a schedule and never wakes the agent unless there's new work. Use connection references, never personal connections.

Connection references: `chr_Dataverse`, `chr_Office365Outlook`, `chr_Teams`, `chr_FinOps` (reads; the release action only in Option B), `chr_AIPrompt` (AI Builder / prompts), `chr_LicensedSkills` (the [licensing service](../../../licensing-service/README.md) connector).

---

## CHR - Check for new holds (scheduled)

**Purpose:** find new holds and close released ones **without waking the agent**. An idle check costs about 15 flow actions (about 2 credits) instead of an agent run (about 17 credits). The agent only starts when there is a new hold to review.

```text
Trigger: Recurrence, frequency Week, on Mon–Fri, at hours 8–18, at minutes 0 and 30
         (22 runs per working day, none at night or at weekends: set the
         customer's hours in the trigger's schedule and time zone)
         (or, where available, an F&O alert-as-business-event on the credit hold list)

1. Licensed Skills · GetLicenceStatus (agentId = credit-hold-review-agent)
   licensed == false → stop (no registration; the next run retries)
2. For each company in chr_CompanyCodes:
   a. Fin & Ops · List items: credit management hold list entity, open holds only
        $select = SalesOrderNumber, CustomerAccount, BlockingReason, OrderAmount
        $filter = status open; $top = 200
   b. Dataverse · List rows chr_creditholdreview where company = <company>
        and status ne Closed  ($select = salesordernumber, status, id)
   c. New holds = (a) minus (b)  →  Run child flow CHR - Register hold for each
        (each new row starts the agent through its Dataverse trigger)
   d. Released holds = reviews in (b) with status ReleasePending that are no
      longer in (a)  →  Run child flow CHR - Apply decision (verifiedReleased = true)
3. Done. No agent call, no AI tokens.
```

Confirm the hold list entity and field names in your F&O version (Data management → Data entities). If the hold list isn't exposed as an entity, expose it with a small custom entity: this check runs hundreds of times a month, so it must stay cheap.

## CHR - Register hold (child)

**Purpose:** create one work item per hold, safely (idempotent).

```text
Trigger: Manually trigger a flow (child)
  inputs: salesOrderNumber, companyCode, customerAccount, blockingReason, orderAmount

1. Dataverse · List rows  chr_creditholdreview
     filter: chr_salesordernumber eq '{salesOrderNumber}'
             and chr_companycode eq '{companyCode}'
             and chr_status ne 'Closed'
     top: 1
2. Condition: length(rows) > 0
   Yes → Respond: reviewId = rows[0].id, isNew = false
   No  →
     3. Dataverse · Add a row  chr_creditholdreview
          name = '{companyCode}-{salesOrderNumber}', status = New,
          salesordernumber, companycode, customeraccount, blockingreason, orderamount,
          detectedon = utcNow()
     4. Run child flow  CHR - Log & notify  (action = Registered)
     5. Respond: reviewId = new id, isNew = true
```

**Why idempotent?** The check runs every 30 minutes and sees the same hold many times. The key (company + sales order + not closed) prevents duplicates, a must-have from the [checklist](../../../docs/02-solution-approach.md#checklist-is-my-agent-production-ready).

---

## CHR - Gather credit facts (child)

**Purpose:** collect every fact the policy needs in **one** deterministic call, instead of the agent making 8 separate MCP calls (5 credits each). Returns compact JSON in the facts schema.

```text
Trigger: Manually trigger a flow (child)   input: reviewId

1. Dataverse · Get row chr_creditholdreview ($select = company, salesorder, customeraccount, orderamount, blockingreason)
2. Fin & Ops · Get record, customer entity
     $select = CreditLimit, CreditLimitExpiryDate, PaymentTerms, IsIntercompany (confirm field names)
3. Fin & Ops · List items, customer open transactions
     $select = DueDate, AmountOpen, LastPaymentDate; $filter = customer + company + open
   Compose balance, overdueAmount, oldestOverdueDays (today − oldest open due date),
   lastPaymentDate
4. Fin & Ops · Get record, sales order header ($select = forced hold flag)
5. If chr_UseCrmContext = Yes:
     Dataverse · List rows account where accountnumber = customeraccount
       ($select = ownerid; $top = 1)
     Dataverse · List rows opportunity (open, that account; $select = estimatedvalue)
     Dataverse · List rows incident (open, that account, type dispute or complaint; count only)
6. Respond: factsJson = { currency, creditLimit, balance, overdueAmount, oldestOverdueDays,
     orderAmount, lastPaymentDate, creditLimitExpiryDate, paymentTerms, forcedHold,
     isIntercompany, crm: { accountOwner, openOpportunityValue, openDisputeCases } }
     Use null for anything not found. Never estimate.
```

Every read uses `$select` and a filter, so only a few hundred bytes reach the prompt.

---

## CHR - Build credit case

**Purpose:** turn facts into a recommendation using the AI prompt, and route.

```text
Trigger: When an agent calls the flow
  input: reviewId

1. Dataverse · Get a row by ID  chr_creditholdreview (reviewId)
1a. Run child flow CHR - Gather credit facts (reviewId) → factsJson
2. Get environment variables: chr_AlwaysHumanOrderAmount
2a. Run child flow  CHR - Load licensed skill (child)
     skillName = CHR_CreditRecommendationPrompt
     (it calls the licensing service, falls back to the cached copy during an outage,
      and fills the {{env:…}} settings — see below)
2b. Condition: licensed == true and found == true and state != 'setting-missing'
   No →
     Dataverse · Update a row: status = ManualReview,
       reasons = 'Licence ' + state + ': ' + notice   (or 'Setting missing: ' + missingSettings)
     Run child flow CHR - Log & notify (action = LicenceBlocked)
     Respond: recommendation = Review, reasons = that text, confidence = Low, routeTo = ManualReview
     (stop)
2c. instructions = content from 2a (settings already filled in);
    keep source and notice for the decision log
3. Parse JSON  factsJson  (schema = facts schema in prompts/credit-recommendation-prompt.md)
4. Compose  requiredFactsMissing =
     any of creditLimit, balance, oldestOverdueDays, orderAmount is null
5. Run a prompt  "CHR Credit recommendation"
     inputs: instructions (from 2c), factsJson, blockingReason
     output: JSON {recommendation, reasons[], confidence}
6. Compose routeTo =
     if requiredFactsMissing
        or orderAmount > chr_AlwaysHumanOrderAmount
        or facts.isIntercompany
        or confidence == 'Low'
     then 'ManualReview' else 'Approval'
     (deterministic rules decide routing — not the model)
7. Dataverse · Update a row  chr_creditholdreview
     factsjson, recommendation, reasons (joined), confidence,
     status = (routeTo == 'ManualReview' ? ManualReview : CaseReady)
8. If ManualReview → Run child flow CHR - Log & notify (action = ManualReview)
   else           → Run child flow CHR - Log & notify (action = CaseBuilt)
9. Respond: recommendation, reasons, confidence, routeTo
```

> 💡 **Lesson:** the model *recommends*; deterministic flow logic *routes*. Hard limits (amount thresholds, missing data) are never left to the model.

> 🔐 **Licensing:** the prompt's instructions are fetched from the licensing service on every case. If the licence has lapsed, the case goes to manual review with the reason, and nothing about the customer leaves the tenant: the request carries only the licence key, tenant ID, agent ID and skill name. During a short service outage the cached copy is used and the decision log records `source = cache`.

---

## CHR - Load licensed skill (child)

The single place where skills come from. Used by *Build credit case* directly and by the agent through the wrapper below.

```text
Trigger: Manually trigger a flow (child)   input: skillName

1. Get environment variables: chr_TenantId, chr_MaxOverdueDaysForRelease,
   chr_StrategicOpportunityValue, chr_AlwaysHumanOrderAmount
2. Scope "Call service" (action timeout 20 s, retry policy: none)
     Licensed Skills · GetSkill (agentId = credit-hold-review-agent, skillName,
                                 x-tenant-id = chr_TenantId)
3. Switch on the outcome ("Configure run after"):
   a) Succeeded, licensed == true          → upsert chr_skillcache (key = skillName):
        content, version, notice, cacheUntil = body.cacheUntil, fetchedOn = utcNow()
        source = 'live'
   b) Succeeded, licensed == false, or 401 → delete every chr_skillcache row
        Respond: licensed = false, state, notice                         (stop)
   c) 404                                  → Respond: licensed = true, found = false (stop)
   d) Failed, timeout, 429 or 5xx          → read chr_skillcache (key = skillName)
        valid and utcNow() < cacheUntil → source = 'cache',
          notice = 'Licensing service unreachable; using the copy fetched at <fetchedOn>,
                    valid until <cacheUntil>.'
        otherwise → delete the row; Respond: licensed = false, state = 'unavailable'  (stop)
4. Fill customer settings:
     content = replace(replace(replace(content,
       '{{env:chr_MaxOverdueDaysForRelease}}',  chr_MaxOverdueDaysForRelease),
       '{{env:chr_StrategicOpportunityValue}}', chr_StrategicOpportunityValue),
       '{{env:chr_AlwaysHumanOrderAmount}}',    chr_AlwaysHumanOrderAmount)
5. If content contains '{{env:' → Respond: licensed = true, found = true,
     state = 'setting-missing', missingSettings, content = ''           (stop)
6. Respond: licensed = true, found = true, state, source, version, notice, content
```

The cache is used only when the service **can't answer**, never to overrule a "not licensed" answer. `cacheUntil` is set by the service (4 hours by default, never past the grace period).

## CHR - Load licensed skill (agent tool)

```text
Trigger: When an agent calls the flow   input: skillName
1. Run child flow CHR - Load licensed skill (child) with skillName
2. Respond to the agent with all its outputs
```

---

## CHR - Request approval

**Purpose:** human in the loop.

```text
Trigger: When an agent calls the flow   input: reviewId

1. Dataverse · Get a row by ID  chr_creditholdreview
2. Guard: if status != CaseReady → Respond status = current status (no-op)
3. Get env variables: chr_ApprovalMode, chr_CreditManagerEmail, chr_FinOpsBaseUrl
4. Dataverse · Update row → status = AwaitingApproval
5. Switch chr_ApprovalMode
   'TeamsCard' (default):
       Teams · Post adaptive card and wait for a response
         recipient: chr_CreditManagerEmail
         card: dataverse/adaptive-card-approval.json (bind fields)
   'Outlook':
       Request for information (Human review) / Approvals · Start and wait
   'ShadowOnly':
       Post card as information only (no buttons); skip to Respond
6. Dataverse · Update row
     status        = (response.decision == 'approve' ? Approved : Rejected)
     approver      = responder email
     approvercomment, decidedon = utcNow()
7. Run child flow CHR - Log & notify (action = Approved / Rejected)
8. Respond: status = AwaitingApproval
```

The status update in step 6 fires the Dataverse trigger → the agent receives `Continue review {id}` → calls *Apply decision*. This mirrors the Sales Order Agent's status-driven re-trigger.

> Note: "Post adaptive card and wait for a response" keeps the flow running until someone answers. For long waits, set a timeout (e.g. 2 days) and route timed-out items to ManualReview.

---

## CHR - Apply decision

```text
Trigger: When an agent calls the flow (also run as a child by Check for new holds)
  inputs: reviewId, verifiedReleased

1. Dataverse · Get a row by ID
2. Switch status
   Rejected →
       update status = Closed, outcome = KeptOnHold
       Log & notify (action = ClosedKeptOnHold; email sales owner)
   Approved →
       Option A (chr_ReleaseMode = 'Manual'):
           update status = ReleasePending
           Log & notify (action = ReleaseRequested; email manager with deep link
             {chr_FinOpsBaseUrl}/?cmp={company}&mi=<All credit holds menu item>)
       Option B (chr_ReleaseMode = 'Action'):
           Fin & Ops · Execute action  <custom release action>
               (company, salesOrderNumber, releaseReasonCode = chr_ReleaseReasonCode,
                approvedReviewId = reviewId)
           Fin & Ops · Get record (sales order) → verify not on hold
           update status = Released / Failed
           Log & notify
   ReleasePending and verifiedReleased == true (called by Check for new holds) →
       update status = Closed, outcome = Released
       Log & notify (action = ClosedReleased)
   other → no-op
3. Respond: status, message
```

---

## CHR - Log & notify (child flow)

```text
Trigger: Manually trigger a flow (child)  inputs: reviewId, action, details

1. Dataverse · Add a row  chr_creditdecisionlog
     review = reviewId, action, details, actor = (agent | approver email),
     recommendation & confidence snapshot, timestamp = utcNow()
2. Switch action
     ManualReview     → email chr_ReviewerEmail with link to the review app record
     LicenceBlocked   → email chr_ReviewerEmail: "Licence <state>: review this hold manually"
     Approved/Rejected/ClosedReleased/ClosedKeptOnHold
                      → email the CRM account owner (if found) and chr_SalesOpsEmail
3. Respond to a Power App or flow: ok
```
