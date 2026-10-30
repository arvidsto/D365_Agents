# Tools — Credit Hold Review Agent

The orchestrator picks tools by **name + description + input descriptions**. Copy these descriptions exactly into Copilot Studio.

## 1. MCP servers

### Dynamics 365 ERP MCP (Finance)

| Setting | Value |
| --- | --- |
| Connection | Service account with role *Credit Hold Agent* for scheduled runs; end-user authentication for chat (create two agents or two connections if your governance requires strict separation) |
| Tools enabled (release 1) | Data tools for **read** only (find / describe / read entities); form tools **off** |
| Tools enabled (Option B, later) | Add the custom **action tool** that releases one hold with a reason code |
| Entities the agent typically uses | Customers (credit limit, credit limit expiry, payment terms), sales order headers and lines (amount, status), customer transactions / open transactions (overdue, aging, last payment), credit management hold list |

> The ERP MCP server discovers entities at runtime based on version, extensions and the user's security. Confirm the exact entity and field names in your environment in the Copilot Studio test pane ("describe the customer entity") and, if aging is not available, expose a small custom data entity.

### Dataverse MCP Server (CRM context, optional)

| Setting | Value |
| --- | --- |
| Tools enabled | `search`, `read_query`, `fetch` |
| Tools disabled | `create_record`, `update_record`, `delete_record`, `create_table`, `update_table`, `delete_table`, `list_tables`, `describe_table` |
| Tables used | `account` (match on account number = F&O customer account), `opportunity` (open, estimated value), `incident` (open cases; dispute / complaint flag) |

### Licensed Skills (your licensing service, MCP)

| Setting | Value |
| --- | --- |
| Connection | Custom connector from [`licensing-service/connector`](../../../licensing-service/connector/apiDefinition.swagger.json), API key = the customer's licence key (stored as secret env variable `chr_LicenceKey`) |
| Server URL | `https://<apim>.azure-api.net/licensing/mcp/credit-hold-review-agent` |
| Tools enabled | `get_skill`, `licence_status` |
| Tools disabled | `list_skills` (this agent uses one known skill) |
| Used for | Loading `CHR_CreditPolicy` at the start of each run. The *Build credit case* flow separately fetches `CHR_CreditRecommendationPrompt` through the REST operation `GetSkill` |
| Sends | Licence key, tenant ID, agent ID, skill name. **No customer data** |

## 2. Agent flows

### CHR - Register hold

| | |
| --- | --- |
| **Description** | Registers ONE sales order credit hold as a review item in Dataverse. Idempotent: if the same company + sales order already has an open review item, returns it with isNew = false. Call this before reviewing any hold. |
| **Inputs** | `salesOrderNumber` (text) — Sales order number exactly as in D365, e.g. 000812. `companyCode` (text) — legal entity, e.g. USMF. `customerAccount` (text) — e.g. US-003. `blockingReason` (text) — reason text from the hold list. `orderAmount` (number) — order total in company currency. |
| **Outputs** | `reviewId` (GUID), `isNew` (yes/no), `status` (text) |

### CHR - Build credit case

| | |
| --- | --- |
| **Description** | Builds the credit case file for ONE review item from the ERP and CRM facts you gathered, applies the credit policy using an AI prompt, saves the recommendation, and tells you where to route it. Pass null for any fact you could not find; never estimate. |
| **Inputs** | `reviewId` (GUID of the review item, no "ID:" prefix). `factsJson` (text) — JSON object with: creditLimit, balance, overdueAmount, oldestOverdueDays, orderAmount, lastPaymentDate, creditLimitExpiryDate, paymentTerms, forcedHold, isIntercompany, currency, crm: {accountOwner, openOpportunityValue, openDisputeCases}. |
| **Outputs** | `recommendation` (Release / KeepOnHold / Review), `reasons` (text), `confidence` (High / Medium / Low), `routeTo` (Approval / ManualReview) |

### CHR - Request approval

| | |
| --- | --- |
| **Description** | Sends the case file and recommendation for ONE review item to the credit manager for approval in Teams (or Outlook) and records their decision. Required before any release or rejection. |
| **Inputs** | `reviewId` (GUID) |
| **Outputs** | `status` (AwaitingApproval) — the decision arrives later and re-triggers the agent through the status change trigger |

### CHR - Apply decision

| | |
| --- | --- |
| **Description** | Applies the recorded human decision for ONE review item. Option A: sets ReleasePending and sends the manager the D365 link; when verifiedReleased = true, closes the item. Option B: calls the D365 release action, then re-reads D365 to verify. Never call this without an Approved or Rejected status. |
| **Inputs** | `reviewId` (GUID), `verifiedReleased` (yes/no, default no) |
| **Outputs** | `status` (ReleasePending / Released / Closed / Failed), `message` (text) |

### CHR - Log & notify

| | |
| --- | --- |
| **Description** | Internal — called by the other flows, not directly by the agent. Writes an audit row and sends notifications. |

## 3. Knowledge

| Source | Purpose |
| --- | --- |
| Credit policy document (SharePoint) | Explains rules in human terms; lets the agent answer "what is our policy for…" |

## 4. Triggers

| Trigger | Payload | Purpose |
| --- | --- | --- |
| Recurrence (every 30 min, business hours) | `Check for new credit holds in company USMF` | Autonomous discovery |
| Dataverse — row modified on `chr_creditholdreview`, filter `chr_status` | `Continue review {reviewId}` | Continue after human decision |
| Optional: F&O alert as business event on the credit hold list | `Check for new credit holds in company {company}` | Near-real-time instead of polling |
