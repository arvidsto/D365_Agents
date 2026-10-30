---
name: establish-close-context
description: Establishes the company (legal entity) and close run before any execution, status change, approval, email or report export. Mandatory, no defaults, no carry-over. Read-only questions with missing context go to retrieve-close-checklist instead.
---

# Establish close context

Run before any side effect. Run again after a conversation reset.

## Required inputs

| Input | Rule |
|---|---|
| Company | Mandatory. No default, no inference, no carry-over from an earlier run. |
| Close run | Either the close run name, or a period (for example "October 2026" or "2026-10") that matches **exactly one** active `ica_closerun` for that company. |

## Procedure

1. If both values were confirmed earlier in **this** conversation, or both are present in the trigger payload, the context is established.
2. If either is missing, ask for both in **one** message. Say that company is mandatory and has no default. Do not offer a placeholder.
3. Bind the current date and time from the trigger payload or the system; say which source you used. If neither is available, say so; later due-date checks then report "due date not evaluated".
4. Resolve the close run with **retrieve-close-checklist** (Path R: run only). Do not query D365 from here.
   - Exactly one match: state the close run name, its period end date, and that it was matched on period, not guessed.
   - Zero or several: list the candidates and ask the user to choose. Do not pick.
5. Check the run's `ica_locked`. If locked, any later execution returns "close run is locked".

## Output

`{ company, closeRunId, closeRunName, periodEndDate, locked, nowSource }`
