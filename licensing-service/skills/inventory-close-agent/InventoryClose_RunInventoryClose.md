---
name: InventoryClose_RunInventoryClose
description: Starts the inventory close for the close run's period end date as a batch job, only after the readiness tasks are complete and a cost accountant has approved it through ICA - Request approval. Never reverses, cancels or recalculates. Matches task names containing "run inventory close". ApprovalRequired, Batch.
routing: run inventory close
---

# Run inventory close

Submits one inventory close (settlement and GL update) for the period end date in batch. The batch completion watcher completes the checklist task.

> **Owned by the cost controller.** Edit only *Policy*. Approval and safety rules are enforced by the agent and flows.

## Classification
- `procedureClass`: `task-execution`
- `postingPolicy`: `ApprovalRequired` (updates the general ledger)
- `supportedExecutionModes`: `Batch`
- `defaultExecutionMode`: `Batch` — foreground requests are rejected because the close can run longer than the agent-flow time limit.

## Routing contract
Task **Name** must contain `run inventory close`. Area = Inventory corroborates only. Exclude: recalculation, reverse, cancel, pre-closing.

## Required data source
- **Read only what the procedure needs:** select only the fields named in this skill, filter on the server (company, dates, status), and ask for at most the rows you will report (top 50). Never read full records or whole tables; every extra field is paid for in tokens at every later step.
- Dynamics 365 ERP MCP, **Closing and adjustment** page (Cost management › Inventory accounting › Closing and adjustment, or Inventory management › Periodic tasks › Closing and adjustment in older versions). Use data tools to read existing closings; use form tools only for the steps below.

## Readiness (all must be true, from fresh reads)
1. Tasks with routing phrases `negative inventory`, `inventory journals posted` and `open receipts and shipments` are Complete in this close run.
2. No inventory close or recalculation for this company is currently in status *Running* / *Not ended*.
3. No inventory close already **Ended** for this period end date (prevents a second close).
4. The last closing date is earlier than the period end date.

## Approval
1. Call **ICA - Request approval** with the task, attempt key and a summary: period end date, last closing date, readiness results.
2. Continue only when it returns `Approved` for this exact task and attempt key. `Rejected` → 🛑. `Pending` or timeout → ⚠️ "awaiting approval" (no further action).

## Procedure (form tools, signed-in approver's rights)
1. Open Closing and adjustment → **Close procedure** → **Close**.
2. Set **Inventory close date** = period end date. Set **Run in the background / Batch processing** = Yes with the batch group `{{env:ica_BatchGroup}}`.
3. Submit. Read back the new closing record and the batch job ID.

## Policy — *edit to change the policy*
| Rule | Value |
|---|---|
| Batch group | `{{env:ica_BatchGroup}}` (customer setting) |
| Preferred start window | Outside business hours `{{env:ica_BusinessHours}}` (customer setting, company time); if inside, still allowed after approval but mention it |
| Approver | The close run controller |

## Report
**Columns:** Period end date · Last closing date · Readiness checks · Approver · Batch job ID · Closing voucher (after completion).
**Summary:** `Inventory close for <period end> submitted in batch <job ID>`.

## Business outcome (exactly one)
- **⏳ Submitted** — batch job created and read back; the watcher completes the task.
- **⚠️ Awaiting approval / not ready** — readiness fails or approval pending; hand off to the controller with what is missing.
- **🛑 Not permitted** — approval rejected, a close already exists for the date, or the form step failed.

## Ground rules
- Exactly one close submission per attempt key. If the read-back is uncertain, do **not** resubmit; report "submission uncertain" and stop.
- Never reverse, cancel, recalculate or adjust (on-hand or transactions).
- This skill never changes task status.
