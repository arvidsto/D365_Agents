# Agent flows — specification

All flows live in the solution, start with **When an agent calls the flow** (except *Log & notify*, which is a child flow), and end with **Respond to the agent**. Use connection references, never personal connections.

Connection references: `chr_Dataverse`, `chr_Office365Outlook`, `chr_Teams`, `chr_FinOps` (Option B only), `chr_AIPrompt` (AI Builder / prompts).

---

## CHR - Register hold

**Purpose:** create one work item per hold, safely (idempotent).

```text
Trigger: When an agent calls the flow
  inputs: salesOrderNumber, companyCode, customerAccount, blockingReason, orderAmount

1. Dataverse · List rows  chr_creditholdreview
     filter: chr_salesordernumber eq '{salesOrderNumber}'
             and chr_companycode eq '{companyCode}'
             and chr_status ne 'Closed'
     top: 1
2. Condition: length(rows) > 0
   Yes → Respond: reviewId = rows[0].id, isNew = false, status = rows[0].chr_status
   No  →
     3. Dataverse · Add a row  chr_creditholdreview
          name           = '{companyCode}-{salesOrderNumber}'
          status         = New
          salesordernumber, companycode, customeraccount, blockingreason, orderamount
          detectedon     = utcNow()
     4. Run child flow  CHR - Log & notify  (action = Registered)
     5. Respond: reviewId = new id, isNew = true, status = New
```

**Why idempotent?** The recurrence trigger runs every 30 minutes and will see the same hold many times. The key (company + sales order + not closed) prevents duplicates — a production must-have from the [checklist](../../../docs/02-solution-approach.md#checklist-is-my-agent-production-ready).

---

## CHR - Build credit case

**Purpose:** turn facts into a recommendation using the AI prompt, and route.

```text
Trigger: When an agent calls the flow
  inputs: reviewId, factsJson

1. Dataverse · Get a row by ID  chr_creditholdreview (reviewId)
2. Get environment variables: chr_MaxOverdueDaysForRelease, chr_AlwaysHumanOrderAmount,
   chr_StrategicOpportunityValue
3. Parse JSON  factsJson  (schema = facts schema in prompts/credit-recommendation-prompt.md)
4. Compose  requiredFactsMissing =
     any of creditLimit, balance, oldestOverdueDays, orderAmount is null
5. Run a prompt  "CHR Credit recommendation"
     inputs: factsJson, policy thresholds, blockingReason
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
Trigger: When an agent calls the flow   inputs: reviewId, verifiedReleased

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
   ReleasePending and verifiedReleased == true →
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
     Approved/Rejected/ClosedReleased/ClosedKeptOnHold
                      → email the CRM account owner (if found) and chr_SalesOpsEmail
3. Respond to a Power App or flow: ok
```
