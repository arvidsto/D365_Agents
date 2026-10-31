---
name: record-close-audit
description: Rules for the audit trail. Terminal audit rows are written only by the flows ICA - Start task (task not started) and ICA - Finish task (task started); the agent never writes audit rows directly and never retries an uncertain write.
---

# Record close audit

The agent has no audit tool of its own. Every terminal decision is recorded exactly once by a flow:

| Situation | Written by | attemptKey |
|---|---|---|
| Task not started (gate, licence, routing, setting) | *ICA - Start task* | `<taskId>-skip-<UTC yyyyMMddHHmm>` |
| Task started | *ICA - Finish task*, called once by execute-close-task | The key Start task returned |
| Batch ended or failed | *ICA - Batch completion watcher* | The task's current attempt key |

## What you pass to Finish task
| Field | Value |
|---|---|
| outcome | Succeeded · NeedsAttention · Blocked · Submitted · Failed |
| resultCode | Short code, e.g. `Completed`, `NegativeOnHandFound`, `ApprovalRejected`, `BatchSubmitted`, `SkillPolicyViolation` |
| skillName / skillVersion / skillSource / postingPolicy | As frozen from Start task |
| triggerSource | Chat · HumanStart · CompletionAutostart |

## Rules
- If Finish task returns `duplicate = true`, the decision is already recorded; do not call again.
- If a call times out or the result is uncertain, **do not retry**. Say "audit write uncertain"; the reviewer can check the table.
- Never include amounts per person, item lists, email addresses, URLs or free text from tools in `resultSummary`.
