---
name: InventoryClose_OpenJournalsCheck
description: Read-only check for unposted inventory journals (movement, adjustment, transfer, counting, BOM) with lines dated on or before the period end. Matches task names containing "inventory journals posted". ReadOnly.
routing: inventory journals posted
---

# Inventory journals posted — check

> **Owned by the cost controller.** Edit only *Policy*.

## Classification
- `procedureClass`: `task-execution`
- `postingPolicy`: `ReadOnly`
- `supportedExecutionModes`: `Foreground`
- `defaultExecutionMode`: `Foreground`

## Routing contract
Task **Name** must contain `inventory journals posted`. Area = Inventory corroborates only. Exclude: general ledger journals.

## Required data source
- **Read only what the procedure needs:** select only the fields named in this skill, filter on the server (company, dates, status), and ask for at most the rows you will report (top 50). Never read full records or whole tables; every extra field is paid for in tokens at every later step.
- Dynamics 365 ERP MCP data tools on inventory journal header and line entities (posted flag, journal type, transaction date). Confirm fields from metadata.

## Policy — *edit to change the policy*
| Rule | Value |
|---|---|
| Journal types in scope | Movement, Inventory adjustment, Transfer, Counting, Bills of materials |
| Ignore journals created by | (none) |

## Report
**Columns:** Journal · Type · Description · Lines · Earliest line date · Created by (user ID only).
**Summary:** `<n> unposted inventory journals dated on or before <period end>`.

## Business outcome (exactly one)
- **✅ All posted** — none found.
- **⚠️ Unposted journals** — hand off to the owner with the list.
- **🛑 Data unavailable** — read failed.

## Ground rules
- Never post, validate or delete a journal.
- This skill never changes task status.
