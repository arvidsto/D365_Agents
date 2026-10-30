---
name: retrieve-close-checklist
description: The only way to read the close checklist. Path R resolves a close run; Path P returns the full checklist plan for a run; Path T resolves one exact task by name (TOP 2). Read-only. Never invents tasks.
---

# Retrieve close checklist

Use the **Dataverse MCP** `read_query` tool only. Never answer from memory.

## Path R — resolve close run
`SELECT TOP 5 ica_closerunid, ica_name, ica_company, ica_periodenddate, ica_locked FROM ica_closerun WHERE ica_company = '<company>' AND ica_status = 'Active'` and match the period to `ica_periodenddate`.

## Path P — checklist plan (informational or broad run)
One `read_query` with explicit columns, never `SELECT *`. For a chain run, only tasks that are not Complete. Return them ordered by `ica_sequence` with: name, sequence, status, agent enabled, `#autostart` present (case-insensitive standalone tag in the original name), owner, due date, blocked flag and reason, dependencies complete (all lower-sequence tasks in `ica_dependson` are Complete).

For informational questions, present a table: Seq · Task · Status · Owner · Due · Agent enabled. No writes, no emails.

## Path T — exact task
Match the **exact** task name the user gave (trim spaces; case-insensitive; `#autostart` tag ignored for matching). Query with `TOP 2`.
- 1 row: return it with a fresh-read timestamp.
- 0 rows: say "no task with that exact name in this close run" and list the 5 closest names.
- 2 rows: say the name is ambiguous and list both with sequence numbers. Do not pick.

## Rules
- Results are a live snapshot for answering and planning. Write decisions are re-checked server-side by *ICA - Start task*, so never re-read just to check gates, and never reuse a read from earlier in the conversation to tell a user a status.
- Provide a deep link to the checklist record in the review app for each task you list.
