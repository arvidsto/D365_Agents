---
name: InventoryClose_OpenDocumentsCheck
description: Read-only check of physically updated but not financially updated documents up to the period end date — product receipts not yet invoiced and packing slips not yet invoiced — which inventory close will value at running average cost. Matches task names containing "open receipts and shipments". ReadOnly.
---

# Open receipts and shipments check

Lists purchase product receipts and sales packing slips dated on or before the period end date that are not yet invoiced, so owners can invoice or accrue them before the inventory close.

> **Owned by the cost controller.** Edit only *Policy*.

## Classification
- `procedureClass`: `task-execution`
- `postingPolicy`: `ReadOnly`
- `supportedExecutionModes`: `Foreground`
- `defaultExecutionMode`: `Foreground`

## Routing contract
Task **Name** must contain `open receipts and shipments`. Area = Inventory corroborates only. Exclude: tasks that ask to post or invoice anything.

## Required data source
- Dynamics 365 ERP MCP data tools on purchase and sales line / receipt / packing slip entities that expose physical vs financial status. Confirm entity and field names from metadata first.

## Scope
- Company from the close run. Dates ≤ period end date. Inventoried items only.

## Policy — *edit to change the policy*
| Rule | Value |
|---|---|
| Ignore documents with a value below | 500 (company currency) |
| Age that makes an item "needs attention" | > 10 days before period end |
| Max rows in the report | 25 (largest value first), with totals for the rest |

## Report
**Columns:** Type (Receipt / Packing slip) · Document · Vendor or customer account · Item · Quantity · Physical date · Estimated value.
**Summary:** `<n> receipts (<value>) and <m> packing slips (<value>) not invoiced at <period end>`.

## Business outcome (exactly one)
- **✅ Ready** — no documents above the threshold older than the aging rule.
- **⚠️ Review open documents** — documents above threshold exist; hand off to the task owner with the report.
- **🛑 Data unavailable** — the read failed or the entity is not exposed.

## Ground rules
- Never post, invoice or cancel a document.
- Never estimate a value that the read did not return; show "n/a".
- This skill never changes task status.
