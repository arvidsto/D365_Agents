---
name: InventoryClose_InventoryToGLReconciliation
description: Read-only reconciliation of the inventory value at the period end against the balances of the inventory ledger accounts, after the inventory close has ended. Matches task names containing "reconcile inventory value". ReadOnly.
---

# Reconcile inventory value to GL

> **Owned by the cost controller.** Edit only *Policy*.

## Classification
- `procedureClass`: `task-execution`
- `postingPolicy`: `ReadOnly`
- `supportedExecutionModes`: `Foreground`
- `defaultExecutionMode`: `Foreground`

## Routing contract
Task **Name** must contain `reconcile inventory value`. Area = Inventory or General ledger corroborates only. Exclude: tasks asking to post corrections.

## Required data source
- Dynamics 365 ERP MCP: inventory value (inventory value report storage / on-hand value by item group) as of the period end, and trial balance or main account balances for the inventory accounts. Confirm entity names from metadata. If inventory value data is not exposed as an entity, stop with 🛑 and recommend exposing the *Inventory value report storage* or a custom entity.

## Precondition
- The inventory close for this period end date is **Ended** (fresh read). Otherwise ⚠️ "close not finished".

## Policy — *edit to change the policy*
| Rule | Value |
|---|---|
| Inventory main accounts | `{{env:ica_InventoryMainAccounts}}` (customer setting) |
| Tolerance per account | 0.5% or 1,000 (company currency), whichever is greater |

## Report
**Columns:** Main account · GL balance · Inventory value · Difference · Within tolerance.
**Summary:** `Total difference <amount> (<pct>) across <n> accounts`.

## Business outcome (exactly one)
- **✅ Reconciled** — all accounts within tolerance.
- **⚠️ Differences** — hand off to the cost accountant with the table and the suggestion to review *Potential conflicts – inventory and general ledger*.
- **🛑 Data unavailable** — any read failed or precondition can't be read.

## Ground rules
- Never post corrections.
- This skill never changes task status.
