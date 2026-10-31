---
name: InventoryClose_ProductionOrderReview
description: Draft-only review of production orders that are reported as finished but not ended, or started long ago, so that work in progress and variances are settled before the close. Recommends which orders to end; never ends them. Matches task names containing "production orders to end". DraftOnly.
routing: production orders to end
---

# Production orders to end — review

> **Owned by the cost controller.** Edit only *Policy*.

## Classification
- `procedureClass`: `task-execution`
- `postingPolicy`: `DraftOnly`
- `supportedExecutionModes`: `Foreground`
- `defaultExecutionMode`: `Foreground`

## Routing contract
Task **Name** must contain `production orders to end`. Area = Inventory or Production corroborates only. Exclude: tasks that ask to end, cost or delete orders.

## Required data source
- **Read only what the procedure needs:** select only the fields named in this skill, filter on the server (company, dates, status), and ask for at most the rows you will report (top 50). Never read full records or whole tables; every extra field is paid for in tokens at every later step.
- Dynamics 365 ERP MCP data tools on the production order header entity (status, scheduled and finished dates, remaining quantity). Confirm fields from metadata.

## Policy — *edit to change the policy*
| Rule | Value |
|---|---|
| Recommend end when status | Reported as finished, with finished date ≤ period end |
| Flag as stale when status | Started, with start date > 60 days before period end |
| Exclude orders with remaining quantity | > 0 (for the "recommend end" list) |

## Report
**Columns:** Production order · Item · Status · Finished date · Remaining quantity · Recommendation (End / Investigate).
**Summary:** `<n> orders recommended to end, <m> stale orders to investigate`.

## Business outcome (exactly one)
- **✅ Nothing to end** — no orders match.
- **⚠️ Orders to end** — hand off to the production controller with the list and the D365 link; they end the orders.
- **🛑 Data unavailable** — read failed.

## Ground rules
- Never end, cost, change status or delete a production order.
- This skill never changes task status.
