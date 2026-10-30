# Dataverse design — Inventory Close Agent

Prefix `ica`. Turn on auditing for all four tables.

## ica_closerun — one per company and period

| Column | Type | Notes |
| --- | --- | --- |
| `ica_name` | Text | e.g. `USMF — Oct 2026` |
| `ica_company` | Text (10) | Legal entity |
| `ica_periodenddate` | Date only | Inventory close date |
| `ica_controller` | Lookup (User) | Approver and report recipient |
| `ica_status` | Choice: Active, Completed, Cancelled | |
| `ica_locked` | Yes/No | Locks all execution |

Alternate key: `ica_company` + `ica_periodenddate`.

## ica_closetask — checklist task

| Column | Type | Notes |
| --- | --- | --- |
| `ica_name` | Text | Exact task name, may include `#autostart` |
| `ica_closerunid` | Lookup → close run | |
| `ica_sequence` | Whole number | 10, 20, 30… |
| `ica_area` | Choice: Inventory, Production, General ledger | Corroborates routing only |
| `ica_owner` | Lookup (User) | Responsible person |
| `ica_duedate` | Date only | |
| `ica_status` | Choice: NotStarted, InProgress, InReview, Returned, Complete | |
| `ica_agentenabled` | Yes/No | **The only authorization.** Editable only by the Close Owner role |
| `ica_blocked`, `ica_blockedreason` | Yes/No, Text | |
| `ica_dependson` | Text | Comma-separated sequence numbers |
| `ica_lastchangedbyagent` | Yes/No | Set by status flows; event flows ignore agent changes |
| `ica_currentattemptkey` | Text | |
| `ica_batchjobid` | Text | Set by RunInventoryClose |
| `ica_resultsummary` | Multiline | ≤ 500 chars, no personal data |
| `ica_startedon`, `ica_completedon` | Date and time | |

Use **column security** on `ica_agentenabled` so only the Close Owner role can change it.

## ica_closetaskaudit — append-only audit

| Column | Type |
| --- | --- |
| `ica_attemptkey` | Text |
| `ica_rowtype` | Choice: Claim, Terminal |
| `ica_resultcode` | Text (StartClaimed, CompleteClaimed, Completed, NegativeOnHandFound, ApprovalRejected, BatchSubmitted, BatchCompleted, …) |
| `ica_outcome` | Choice: Succeeded, Submitted, Blocked, Skipped, Failed |
| `ica_taskid` | Lookup → close task |
| `ica_company`, `ica_closerunname` | Text |
| `ica_statusbefore`, `ica_statusafter` | Text |
| `ica_statusverified` | Yes/No |
| `ica_skillname`, `ica_skillhash`, `ica_postingpolicy` | Text |
| `ica_triggersource` | Choice: Chat, HumanStart, CompletionAutostart, BatchWatcher, ReminderSweep |
| `ica_errorstage`, `ica_errorcode` | Text |
| `ica_recordedon` | Date and time |

Alternate key: `ica_attemptkey` + `ica_rowtype` + `ica_resultcode` (prevents duplicate claims and duplicate terminal rows).

**Never stored:** prompts, raw tool payloads, item lists, amounts per person, email recipients, URLs, tokens, connection IDs.

## ica_approval

| Column | Type |
| --- | --- |
| `ica_taskid` | Lookup |
| `ica_attemptkey` | Text |
| `ica_decision` | Choice: Pending, Approved, Rejected |
| `ica_approver` | Lookup (User) |
| `ica_comment` | Multiline |
| `ica_requestedon`, `ica_decidedon` | Date and time |

## Security roles

| Role | Close run | Close task | Audit | Approval |
| --- | --- | --- | --- | --- |
| **Close Owner** | Create/Read/Write | Create/Read/Write (incl. `ica_agentenabled`) | Read | Read |
| **Close Participant** | Read | Read; Write on status only (to start/complete own tasks) | Read | Read |
| **Close Audit Reviewer** | Read | Read | Read | Read |
| **Agent flow connection** | Read | Read/Write (no Delete) | Create/Read (no Write/Delete) | Create/Read/Write |

## Model-driven app: Inventory Close Compliance Review

- **Close runs** → sub-grid of tasks ordered by sequence, with status, owner, agent enabled.
- **Task audits** → default view newest first; filter Claim vs Terminal.
- **Open approvals** → Pending approvals with Approve / Reject (updates `ica_approval`).
