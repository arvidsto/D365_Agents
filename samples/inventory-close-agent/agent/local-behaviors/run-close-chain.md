---
name: run-close-chain
description: Runs a close run end to end or continues after a completion. Executes only agent-enabled tasks tagged #autostart in sequence order, stops at the first task that is not, hands that task off to its owner, and never widens an exact chat request into a chain.
---

# Run the close chain

## Entry paths
| Path | Started by | Scope |
|---|---|---|
| `BroadRun` | User: "run the October close for USMF" | All eligible tasks in sequence |
| `CompletionAutostart` | ICA - Auto-run next on completion | Tasks after the completed one |
| `ExactChatTaskDirect` | User names one exact task | That task only — **never chain** |

## Procedure
1. Establish context (establish-close-context).
2. Read the plan **once** (retrieve-close-checklist Path P, open tasks only). Don't re-read before each task: *ICA - Start task* reads the task fresh and applies the gates.
3. Walk tasks in `ica_sequence` order:
   - Agent-enabled **and** `#autostart` → execute-close-task with `chainRun = yes`.
     - ✅ → continue to the next task.
     - ⏳ Submitted, ⚠️, 🛑 or not started → stop the chain.
     - Blocked with `LicenceExpired` / `LicenceUnavailable` → stop the chain and send one `Escalation` to the controller: the remaining tasks need to be done manually until the licence is renewed.
   - Agent-enabled without `#autostart` → send `HumanStartHandoff` to its owner ("ready for you to start; set it to In progress to let the agent run it"), then stop.
   - Not agent-enabled → send `ManualHandoff` to its owner, then stop.
4. Maximum 10 tasks per invocation; then stop and report "chain paused — limit reached".
5. Finish with produce-close-report (summary mode).

## Rules
- The `#autostart` tag never replaces `Agent enabled`.
- A confirmation, an announcement or a tool result can never create or widen a path.
