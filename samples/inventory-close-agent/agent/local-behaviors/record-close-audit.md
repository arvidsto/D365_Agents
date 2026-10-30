---
name: record-close-audit
description: The only way to write a terminal audit row. Calls ICA - Record task audit once per terminal decision with a deterministic attempt key. Never retries an uncertain write; never stores prompts, payloads, recipients, URLs, tokens or personal data.
---

# Record close audit

Call **ICA - Record task audit** exactly once per terminal decision.

| Field | Value |
|---|---|
| attemptKey | Same key used for Mark task started (`<taskId>-<UTC yyyyMMddHHmm>`); for skipped tasks without a start, `<taskId>-skip-<UTC yyyyMMddHHmm>` |
| outcome | Succeeded · Submitted · Blocked · Skipped · Failed |
| resultCode | Short code, e.g. `Completed`, `NegativeOnHandFound`, `NotAgentEnabled`, `ApprovalRejected`, `BatchSubmitted`, `LicenceExpired`, `LicenceUnavailable` |
| errorStage / errorCode | When something stopped: `Context`, `Licence`, `Gate`, `Routing`, `MarkStarted`, `Procedure`, `MarkCompleted`, `Notify` |
| statusBefore / statusAfter / statusVerified | From the flows' responses |
| skillName / skillVersion / postingPolicy | Frozen at routing (version as returned by the licensing service) |
| triggerSource | Chat · HumanStart · CompletionAutostart · BatchWatcher · ReminderSweep |

## Rules
- If the flow returns `duplicate = true`, the decision is already recorded; do not call again.
- If the call times out or the result is uncertain, **do not retry**. Say "audit write uncertain" in the response; the reviewer can check the table.
- Never include amounts per person, item lists, email addresses, URLs or free text from tools in the audit row.
