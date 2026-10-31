# Tools — Inventory Close Agent

## 1. MCP servers (all run as the **signed-in user**)

| Server | Used by | Keep on | Turn off |
| --- | --- | --- | --- |
| **Dynamics 365 ERP MCP** | All business skills | Data tools (find, describe, read); form tools needed by `RunInventoryClose` (open page, set field, select action) | Data create/update/delete tools. If your governance needs it, run `RunInventoryClose` form steps through a separate, approver-only agent flow instead and keep form tools off |
| **Dataverse MCP Server** | `retrieve-close-checklist`, `produce-close-report` | `read_query`, `search`, `fetch` | `create_record`, `update_record`, `delete_record`, all table tools — **all writes go through agent flows** |
| **Work IQ Mail** | `send-close-notification` only | Send mail | Read/search mailbox tools |

> **Licensed skills** come through *ICA - Start task* (task skills) and *ICA - Load licensed skill* (notifications), not through the licensing service's MCP endpoint, because only the flow can fall back to the cache during an outage and fill in the customer's settings.

> Why are Dataverse writes off on the MCP server? So that every status change and audit row goes through a flow that claims, writes and re-reads. This is the Period Close Agent's "no direct-edit fallback" rule.

## 2. Agent flows (tools)

Only five flows are agent tools. A short tool list keeps every orchestration step smaller, and each task needs just two of them: **Start task** and **Finish task**. Mark started, Mark completed, Record audit and the skill loader are child flows behind them ([flows](../flows/agent-flows.md)).

| Flow | Description for the orchestrator | Inputs | Outputs |
| --- | --- | --- | --- |
| **ICA - Start task** | Prepares ONE checklist task for execution in one call: reads it fresh, applies every gate (locked run, status, blocked, Agent enabled, dependencies, due date for chain runs), routes it to exactly one licensed business skill, loads that skill and claims the task (In progress, verified). If started is false, the task was not started and the audit row is already written: report the outcome and stop. | `taskId` (GUID), `triggerSource` (Chat / HumanStart / CompletionAutostart), `chainRun` (yes/no) | `started`, `outcome`, `resultCode`, `attemptKey`, `company`, `periodEnd`, `taskName`, `owner`, `skillName`, `skillVersion`, `skillSource`, `postingPolicy`, `executionMode`, `notice`, `skillContent`, `message` |
| **ICA - Finish task** | Records the result of ONE started task in one call: Complete (Succeeded), In review (NeedsAttention), batch job ID (Submitted) or no status change (Blocked / Failed), then the terminal audit row. Returns verified only after a fresh read. Call exactly once per started task. | `taskId`, `attemptKey`, `outcome`, `resultCode`, `resultSummary` (≤ 500 chars, no personal data), `batchJobId`, `skillName`, `skillVersion`, `skillSource`, `postingPolicy`, `triggerSource` | `verified`, `statusAfter`, `auditId`, `duplicate` |
| **ICA - Request approval** | Asks the close run controller to approve ONE action (inventory close) in Teams and records the decision for that task and attempt key. Returns Pending if no answer within the wait window. | `taskId`, `attemptKey`, `summary` (text) | `decision` (Approved / Rejected / Pending), `approver`, `approvalId` |
| **ICA - Load licensed skill** | Returns ONE licensed skill by exact name with the customer's settings filled in. Use it only for InventoryClose_Notifications and for a user's question about a procedure; Start task already loads the task's skill. | `skillName` (text) | `licensed`, `found`, `state`, `source` (live/cache), `version`, `notice`, `content`, `missingSettings` |
| **ICA - Wait** | Waits a short number of seconds (max 60) before a re-read, for D365 eventual consistency. | `seconds` | `ok` |

### Tool output discipline

Every token a tool returns is carried into each later step of the same task, so:

- **ERP MCP:** ask only for the fields the skill names (`$select`), filter on the server (company, period end, status), and request at most the rows you'll report (top 50). Never read full records or whole entities.
- **Dataverse MCP:** `read_query` with explicit columns and a filter; never `fetch` a whole table.
- **Flows:** return only the fields above; never the raw D365 payload.

## 3. Event and scheduled flows (not tools; they invoke the agent)

| Flow | Trigger | Invokes the agent with |
| --- | --- | --- |
| **ICA - Run human-started task** | Dataverse: `ica_closetask` modified, status → In progress, `ica_lastchangedbyagent = No`, agent-enabled, no `#autostart` | `HumanStart task <taskId> in close run <runId>` |
| **ICA - Auto-run next on completion** | Dataverse: `ica_closetask` modified, status → Complete | `CompletionAutostart after task <taskId> in close run <runId>` |
| **ICA - Batch completion watcher** | Recurrence every 15 min while any task is In progress with a batch job ID | Doesn't invoke the agent for success: completes the task through the child flows *Mark task completed* and *Record task audit*; invokes the agent only on batch error |
| **ICA - Daily reminder sweep** | Recurrence 08:05 company time on working days | `Reminder sweep for close run <runId>` |

The agent is invoked from flows with the **Agents** connector (preview), as in the Period Close Agent.

## 4. Conversation starters

- "What's still open in the October 2026 inventory close for USMF?"
- "Run the October 2026 inventory close checklist for USMF"
- "Execute task Check negative inventory for USMF October 2026"
- "Show the audit trail for Run inventory close"
- "Send the close status report to the controller"
