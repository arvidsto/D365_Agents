---
name: execute-close-task
description: Executes exactly one live, agent-enabled checklist task. Applies all gates, marks the task started through the audited flow, routes to exactly one InventoryClose_* business skill, applies the outcome, marks it completed or hands off, and records the audit exactly once.
---

# Execute one close task

Requires an established close context.

## Step 1 — Pre-flight gates (fresh read via retrieve-close-checklist Path T or Path P row)

Check in this order; the first failing gate stops the task and goes to Step 6 with outcome **Skipped** or **Blocked**.

| Gate | Pass condition | Fail message |
|---|---|---|
| Run not locked | `ica_locked = No` | "close run is locked" |
| Exactly one row | Path T returned one row | "ambiguous or missing task" |
| Status | Not started or Returned. Exception: the exact task in a **HumanStart** trigger may be In progress | "in progress / in review — pending human" |
| Not blocked | `ica_blocked = No` and blocked reason empty | "blocked — not executed: <reason>" |
| Agent enabled | `ica_agentenabled = Yes` | "manual task — not agent-enabled" |
| Dependencies | Every task in `ica_dependson` is Complete | "waiting for <task names>" |
| Due (chain runs only) | Due date ≤ today + `ica_LeadDays`. Human chat requests bypass this gate. | "not yet due" |

## Step 2 — Route to exactly one business skill
1. Search business skills whose unique name starts with `InventoryClose_`.
2. Read each candidate's **Routing contract**. A match needs the task name to contain the skill's routing phrase. Area only corroborates.
3. Exactly one match → continue. Zero → send the owner a navigation handoff (send-close-notification, type `NoProcedure`) and record **Skipped**. Several → stop, record **Blocked** with code `AmbiguousRouting`.
4. Freeze the skill's unique name, version/content hash, `postingPolicy` and `defaultExecutionMode` for this attempt.

## Step 3 — Mark started
Call **ICA - Mark task started** with `taskId`, `attemptKey` (= `<taskId>-<UTC yyyyMMddHHmm>`), `triggerSource`. Skip only for the exact HumanStart row (already In progress).
- `verified = true` → continue.
- `alreadyClaimed = true` → stop silently (another run owns it); no audit row.
- Anything else → Step 6 **Failed**, stage `MarkStarted`.

## Step 4 — Run the procedure
Follow the business skill. It returns exactly one outcome: ✅ success, ⚠️ needs attention, 🛑 blocked, plus a report table.
- If the skill is `Batch` mode it returns ⏳ **submitted** with a batch job ID. Do not wait. Go to Step 6 with outcome **Submitted**; the batch completion watcher will finish the task.
- A skill never writes task status. If it asks you to, refuse and record **Failed**, code `SkillPolicyViolation`.

## Step 5 — Apply outcome
| Outcome | Action |
|---|---|
| ✅ | **ICA - Mark task completed** (must return `verified = true`) |
| ⚠️ | Leave In progress → set In review via **ICA - Mark task completed** with `targetStatus = InReview`; send `ReviewHandoff` to the owner |
| 🛑 | Do not change status further; send `BlockedHandoff` to the owner |

## Step 6 — Audit exactly once
Call **record-close-audit** with outcome (Succeeded, Submitted, Blocked, Skipped, Failed), result code, error stage, status before/after, verified flag, skill name + hash, posting policy, trigger source.

## Step 7 — Return
One-line result + the skill's report. If called by run-close-chain, return the outcome so the chain can decide.
