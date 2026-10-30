---
name: execute-close-task
description: Executes exactly one live, agent-enabled checklist task in three tool calls around the business procedure - ICA - Start task (fresh read, gates, routing, skill, claim), the procedure from the returned skill, and ICA - Finish task (status and audit).
---

# Execute one close task

Requires an established close context and the exact task ID (from retrieve-close-checklist Path T, the trigger payload, or run-close-chain).

## Step 1 — Start
Call **ICA - Start task** with `taskId`, `triggerSource` and `chainRun`.
The flow does every gate, the routing and the claim server-side, in this order: locked run, status, blocked, Agent enabled, dependencies, due date (chain runs only), licence, routing to exactly one skill, settings, claim. Never repeat these checks with your own reads.

| Result | Do |
|---|---|
| `started = true` | Continue. Freeze `attemptKey`, `skillName`, `skillVersion`, `skillSource`, `postingPolicy`. Keep `notice` for the report; when `skillSource = cache`, always show it |
| `started = false`, `outcome = AlreadyClaimed` | Stop silently (another run owns it) |
| `started = false`, `resultCode = NoProcedure` or `NotAgentEnabled` | Send the owner a `ManualHandoff` (send-close-notification) and stop |
| `started = false`, `resultCode = LicenceExpired`, `LicenceUnavailable` or `SettingMissing` | Send `BlockedHandoff` to the owner (for SettingMissing: "ask your administrator to set …") and say "Licence <state>: <notice>" or name the setting |
| `started = false`, anything else | Report the `message` in one line and stop. The audit row is already written |

## Step 2 — Run the procedure
Follow `skillContent` for this task only. It returns exactly one outcome: ✅ success, ⚠️ needs attention, 🛑 blocked, plus a report table.
- Follow the skill's **Required data source** and the [tool output discipline](../tools.md#tool-output-discipline): only the fields it names, filtered on the server, top 50.
- `Batch` mode returns ⏳ **submitted** with a batch job ID. Do not wait; the batch completion watcher finishes the task.
- A skill never writes task status. If it asks you to, refuse and finish with **Failed**, code `SkillPolicyViolation`.

## Step 3 — Finish (exactly once)
Call **ICA - Finish task** with the frozen values and:

| Skill outcome | `outcome` | Then |
|---|---|---|
| ✅ | Succeeded | — |
| ⚠️ | NeedsAttention | Send `ReviewHandoff` to the owner |
| 🛑 | Blocked | Send `BlockedHandoff` to the owner |
| ⏳ | Submitted (with `batchJobId`) | — |
| Tool or skill failure | Failed (`resultCode` = error stage) | — |

`verified` must be true for a ✅ to be reported as complete. If the call times out, do **not** retry; say "finish write uncertain".

## Step 4 — Return
One line + the skill's report table. If called by run-close-chain, return the outcome so the chain can decide.
