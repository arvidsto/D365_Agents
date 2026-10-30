# Tools — Inventory Close Agent

## 1. MCP servers (all run as the **signed-in user**)

| Server | Used by | Keep on | Turn off |
| --- | --- | --- | --- |
| **Dynamics 365 ERP MCP** | All business skills | Data tools (find, describe, read); form tools needed by `RunInventoryClose` (open page, set field, select action) | Data create/update/delete tools. If your governance needs it, run `RunInventoryClose` form steps through a separate, approver-only agent flow instead and keep form tools off |
| **Dataverse MCP Server** | `retrieve-close-checklist`, `produce-close-report`, business-skill discovery | `read_query`, `search`, `fetch` | `create_record`, `update_record`, `delete_record`, all table tools — **all writes go through agent flows** |
| **Work IQ Mail** | `send-close-notification` only | Send mail | Read/search mailbox tools |

> Why are Dataverse writes off on the MCP server? So that every status change and audit row goes through a flow that claims, writes and re-reads. This is the Period Close Agent's "no direct-edit fallback" rule.

## 2. Agent flows (tools)

| Flow | Description for the orchestrator | Inputs | Outputs |
| --- | --- | --- | --- |
| **ICA - Mark task started** | Moves ONE checklist task to In progress after re-checking Agent enabled and status server-side. Writes a StartClaimed audit row first. Returns verified only after a fresh read. | `taskId` (GUID), `attemptKey` (text), `triggerSource` (text) | `verified` (bool), `alreadyClaimed` (bool), `statusBefore`, `statusAfter`, `message` |
| **ICA - Mark task completed** | Moves ONE In-progress task to Complete (default) or In review. Writes a CompleteClaimed row first. Returns verified only after a fresh read. | `taskId`, `attemptKey`, `targetStatus` (Complete / InReview), `resultSummary` (text, ≤ 500 chars, no personal data) | `verified`, `statusBefore`, `statusAfter`, `message` |
| **ICA - Record task audit** | Writes ONE terminal audit row with a deterministic attempt key. Idempotent: returns duplicate = true if the key exists. | `attemptKey`, `taskId`, `outcome`, `resultCode`, `errorStage`, `errorCode`, `statusBefore`, `statusAfter`, `statusVerified`, `skillName`, `skillHash`, `postingPolicy`, `triggerSource` | `auditId`, `duplicate` |
| **ICA - Request approval** | Asks the close run controller to approve ONE action (inventory close) in Teams and records the decision for that task and attempt key. Returns Pending if no answer within the wait window. | `taskId`, `attemptKey`, `summary` (text) | `decision` (Approved / Rejected / Pending), `approver`, `approvalId` |
| **ICA - Wait** | Waits a short number of seconds (max 60) before a re-read, for D365 eventual consistency. | `seconds` | `ok` |

## 3. Event and scheduled flows (not tools; they invoke the agent)

| Flow | Trigger | Invokes the agent with |
| --- | --- | --- |
| **ICA - Run human-started task** | Dataverse: `ica_closetask` modified, status → In progress, `ica_lastchangedbyagent = No`, agent-enabled, no `#autostart` | `HumanStart task <taskId> in close run <runId>` |
| **ICA - Auto-run next on completion** | Dataverse: `ica_closetask` modified, status → Complete | `CompletionAutostart after task <taskId> in close run <runId>` |
| **ICA - Batch completion watcher** | Recurrence every 15 min while any task is In progress with a batch job ID | Doesn't invoke the agent for success: completes the task through *Mark task completed* and records audit; invokes the agent only on batch error |
| **ICA - Daily reminder sweep** | Recurrence 08:05 company time on working days | `Reminder sweep for close run <runId>` |

The agent is invoked from flows with the **Agents** connector (preview), as in the Period Close Agent.

## 4. Conversation starters

- "What's still open in the October 2026 inventory close for USMF?"
- "Run the October 2026 inventory close checklist for USMF"
- "Execute task Check negative inventory for USMF October 2026"
- "Show the audit trail for Run inventory close"
- "Send the close status report to the controller"
