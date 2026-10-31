---
name: InventoryClose_<YourProcedure>
description: <One paragraph the agent reads first. What the procedure does, the exact task-name phrase it matches, which area corroborates it, what it excludes, and whether it is ReadOnly, DraftOnly, ApprovalRequired or PostAuthorized.>
routing: <exact lowercase task-name phrase, the same as in the Routing contract; omit for supporting skills such as notifications>
---

# <Procedure title>

<One or two sentences: what it does and what the accountant receives.>

> **Owned by the cost controller.** Edit only the sections marked *edit to change the policy*. Safety rules live in the agent and always win.

## Classification
- `procedureClass`: `task-execution`
- `postingPolicy`: `ReadOnly` | `DraftOnly` | `ApprovalRequired` | `PostAuthorized`
- `supportedExecutionModes`: `Foreground` | `Batch`
- `defaultExecutionMode`: `<Foreground or Batch>`

## Routing contract
Task **Name** must contain `<exact phrase>`. **Area = Inventory** corroborates only. Exclude: <task types this skill must never pick up>.

## Required data source
- **Read only what the procedure needs:** select only the fields named in this skill, filter on the server (company, dates, status), and ask for at most the rows you will report (top 50). Never read full records or whole tables; every extra field is paid for in tokens at every later step.
- **Dynamics 365 ERP MCP** (signed-in user). Name the entity or page. Confirm field names from metadata before querying; never guess.
- If the source is unavailable or the read fails, report and stop. Never use cached results.

## Scope
- Company and period end date come from the close run.

## Customer settings
Write any value that differs per customer as `{{env:<prefix>_<Name>}}`, for example `{{env:ica_BatchGroup}}`. The customer's *Load licensed skill* flow fills it from the environment variable with that schema name, so the value never reaches the licensing service. Add the variable to the agent's solution and to its `environment-variables.md`. A placeholder left unfilled stops the task with `SettingMissing`.

## Policy — *edit to change the policy*
| Rule | Value |
|---|---|
| <threshold> | <value> |

## Report
**Columns:** <list>. **Summary:** <one line>.

## Business outcome (exactly one)
- **✅ <Success>** — <condition>.
- **⚠️ <Needs attention>** — <condition; who is contacted>.
- **🛑 <Blocked>** — <condition; nothing changed>.

## Ground rules
- Report only figures from a live read.
- <Hard limits.>
- The agent owns task status and notifications; this skill never changes task status.
