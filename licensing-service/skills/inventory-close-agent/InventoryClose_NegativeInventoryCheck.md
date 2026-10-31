---
name: InventoryClose_NegativeInventoryCheck
description: Read-only check for items with negative physical or financial on-hand inventory at the period end, which can stop inventory close or distort cost. Matches task names containing "negative inventory". ReadOnly.
routing: negative inventory
---

# Negative inventory check

Finds items whose physical or financial on-hand is negative for the financial inventory dimensions used by costing, so they can be corrected before the close.

> **Owned by the cost controller.** Edit only *Policy*.

## Classification
- `procedureClass`: `task-execution`
- `postingPolicy`: `ReadOnly`
- `supportedExecutionModes`: `Foreground`
- `defaultExecutionMode`: `Foreground`

## Routing contract
Task **Name** must contain `negative inventory`. Area = Inventory corroborates only. Exclude: tasks that ask to adjust or count inventory.

## Required data source
- **Read only what the procedure needs:** select only the fields named in this skill, filter on the server (company, dates, status), and ask for at most the rows you will report (top 50). Never read full records or whole tables; every extra field is paid for in tokens at every later step.
- Dynamics 365 ERP MCP data tools on the on-hand inventory entity (by item and the financial dimensions from the item's storage dimension group, typically site and warehouse). Confirm entity and fields from metadata.

## Scope
- Company from the close run. Items with a periodic valuation model only, when the item model group can be read; otherwise all stocked items and say so.

## Policy — *edit to change the policy*
| Rule | Value |
|---|---|
| Treat as blocking | Any negative **financial** on-hand |
| Treat as needs attention | Negative **physical** on-hand only |
| Max rows in the report | 50 |

## Report
**Columns:** Item · Site · Warehouse · Physical on-hand · Financial on-hand · Item model group.
**Summary:** `<n> items negative (financial: <a>, physical only: <b>)`.

## Business outcome (exactly one)
- **✅ No negative inventory** — none found.
- **⚠️ Physical negatives** — only physical negatives; hand off to the inventory controller.
- **🛑 Financial negatives** — close would be unreliable or fail; hand off and recommend correction (counting, adjustment or movement journal) and a consistency check by a person.

## Ground rules
- Never post a journal, run a consistency check in *Fix* mode, or change item model groups.
- This skill never changes task status.
