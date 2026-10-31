---
name: InventoryClose_PeriodHoldRequest
description: Draft-only handoff asking the general ledger accountant to put the Inventory module on hold for the closed period in the fiscal calendar, after the close and reconciliation are complete. Never changes period access itself. Matches task names containing "inventory module period hold". DraftOnly.
routing: inventory module period hold
---

# Request inventory module period hold

> **Owned by the cost controller.** Edit only *Policy*.

## Classification
- `procedureClass`: `task-execution`
- `postingPolicy`: `DraftOnly`
- `supportedExecutionModes`: `Foreground`
- `defaultExecutionMode`: `Foreground`

## Routing contract
Task **Name** must contain `inventory module period hold`. Area = Inventory or General ledger corroborates only.

## Required data source
- **Read only what the procedure needs:** select only the fields named in this skill, filter on the server (company, dates, status), and ask for at most the rows you will report (top 50). Never read full records or whole tables; every extra field is paid for in tokens at every later step.
- Fresh checklist read (tasks `run inventory close` and `reconcile inventory value` Complete).
- Dynamics 365 ERP MCP read of the ledger fiscal period and module access for the period (read only).

## Policy — *edit to change the policy*
| Rule | Value |
|---|---|
| Requested access level | On hold for module Inventory |
| Recipient | The task owner (GL accountant) |

## Report
**Columns:** Fiscal period · Current Inventory module access · Requested access.

## Business outcome (exactly one)
- **⚠️ Handoff sent** — the normal outcome: the owner changes module access in D365 and completes the task.
- **✅ Already on hold** — module access already On hold or Closed for the period.
- **🛑 Not ready** — close or reconciliation not Complete.

## Ground rules
- Never change period or module access.
- This skill never changes task status.
