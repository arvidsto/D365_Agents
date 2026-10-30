# Tools — Credit Hold Review Agent

The orchestrator picks tools by **name + description + input descriptions**. Copy these descriptions exactly into Copilot Studio.

## 1. MCP servers

### Dynamics 365 ERP MCP (Finance)

| Setting | Value |
| --- | --- |
| Connection | Service account with role *Credit Hold Agent* for scheduled runs; end-user authentication for chat (create two agents or two connections if your governance requires strict separation) |
| Tools enabled (release 1) | Data tools for **read** only (find / describe / read entities); form tools **off**. Used **in chat only**: the autonomous path reads F&O through flows |
| Output discipline | Ask only for the fields you need (`$select`), filter on the server, at most 20 rows. Never fetch full records |
| Tools enabled (Option B, later) | Add the custom **action tool** that releases one hold with a reason code |
| Entities the agent typically uses | Customers (credit limit, credit limit expiry, payment terms), sales order headers and lines (amount, status), customer transactions / open transactions (overdue, aging, last payment), credit management hold list |

> The ERP MCP server discovers entities at runtime based on version, extensions and the user's security. Confirm the exact entity and field names in your environment in the Copilot Studio test pane ("describe the customer entity") and, if aging is not available, expose a small custom data entity.

### Dataverse MCP Server (CRM context, optional)

| Setting | Value |
| --- | --- |
| Tools enabled | `search`, `read_query`, `fetch` |
| Tools disabled | `create_record`, `update_record`, `delete_record`, `create_table`, `update_table`, `delete_table`, `list_tables`, `describe_table` |
| Tables used | `account` (match on account number = F&O customer account), `opportunity` (open, estimated value), `incident` (open cases; dispute / complaint flag) |

## 2. Agent flows

> **Cost rule:** the agent is only started once a hold is already registered, so it never polls. Every agent action costs credits; every agent flow action costs about 1/40 of one (0.13 credits). Fact gathering and registration therefore run inside flows, not as agent tool calls.

### CHR - Build credit case

| | |
| --- | --- |
| **Description** | Builds the credit case file for ONE review item: gathers the ERP and CRM facts itself (child flow *CHR - Gather credit facts*, only the needed fields), applies the credit policy using an AI prompt, saves the recommendation, and tells you where to route it. Call it once per review. |
| **Inputs** | `reviewId` (GUID of the review item, no "ID:" prefix) |
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

### CHR - Load licensed skill

| | |
| --- | --- |
| **Description** | Returns ONE licensed skill by exact name (for this agent: CHR_CreditPolicy), with the customer's settings filled in. Uses a short-lived cached copy only if the licensing service can't be reached. If licensed is false or state is setting-missing, start no new reviews. |
| **Inputs** | `skillName` (text) — exact skill name, e.g. CHR_CreditPolicy |
| **Outputs** | `licensed`, `found`, `state`, `source` (live/cache), `version`, `notice`, `content`, `missingSettings` |
| **Sends to the licensing service** | Licence key, tenant ID, agent ID, skill name. **No customer data and no setting values** |

The licensing service also offers an MCP endpoint, but this agent uses the flow because only the flow can fall back to the cache during an outage and fill in the customer's settings.

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
| Dataverse — row added on `chr_creditholdreview` (status New) | `Review hold {reviewId}` | Start one review. The row is created by the scheduled flow below |
| Dataverse — row modified on `chr_creditholdreview`, filter `chr_status` = Approved or Rejected | `Continue review {reviewId}` | Continue after the human decision |

**Not an agent trigger:** *CHR - Check for new holds* is a scheduled cloud flow (every 30 minutes in business hours only, set in its recurrence schedule). It reads the hold list, registers new holds and closes verified releases **without starting the agent**, so a check that finds nothing costs only a few flow actions. To react faster, add an F&O alert as business event on the credit hold list that starts the same flow.
