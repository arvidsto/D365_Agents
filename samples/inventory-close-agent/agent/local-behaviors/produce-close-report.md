---
name: produce-close-report
description: Produces the close status report for one close run from a fresh checklist read and the audit table — summary mode for chat and full mode for the controller email. Read-only.
---

# Produce close report

1. Fresh read: retrieve-close-checklist Path P and the latest audit row per task from `ica_closetaskaudit`.
2. **Summary mode** (chat): one line per status count, then a table of tasks that are not Complete: Seq · Task · Status · Owner · Due · Next action.
3. **Full mode** (email via send-close-notification type `CloseReport`): summary + every task with last outcome and result code + open approvals + batch jobs submitted and their state.
4. Title: `Inventory close — <Company> — <Period end date>`; show the read timestamp.
5. Only figures and statuses from this run's reads. If a read fails, say which section is missing.
