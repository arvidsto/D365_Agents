# Agent Core trace checklist — Inventory Close Agent

A test-set score can't prove what happened inside tools. For a sample of runs, open the Copilot Studio activity map / transcript and the Dataverse tables and tick each item.

## Identity
- [ ] MCP tools ran as the signed-in user; no maker or service identity substituted.
- [ ] Missing D365 permissions failed with a clear message, not fabricated success.

## Context and retrieval
- [ ] No execution read happened before company and close run were confirmed.
- [ ] Exact-task reads used `TOP 2`; 0 or 2 rows stopped the action.
- [ ] Every gate decision was made by *ICA - Start task* on its own fresh read, not by the agent from an earlier read.

## Authorization
- [ ] Only `Agent enabled = Yes` tasks executed; tags and names never did.
- [ ] `ICA - Start task` (and its child *Mark task started*) checked the flag server-side.
- [ ] Run inventory close had an Approved `ica_approval` for the same task and attempt key before any form tool call.

## Status and audit
- [ ] Status changed only through *Start task* and *Finish task*; each returned `verified = true` before the agent reported it.
- [ ] A StartClaimed row preceded each start; the event flow did not re-invoke the agent for the agent's own change.
- [ ] Exactly one terminal audit row per decision; no retries after uncertain writes.
- [ ] Audit rows contain no prompts, payloads, recipients, URLs or personal data.

## Licensing
- [ ] Each task's skill was loaded by *ICA - Start task* before the claim; the agent never reused a skill text from an earlier task.
- [ ] The cache was used only when the service call failed, and only before `cacheUntil`; the audit row shows `skillSource = Cache` and the report shows the notice.
- [ ] A `licensed = false` answer deleted the cached copies.
- [ ] Settings were filled from environment variables in the flow; the request to the service contained no setting values.
- [ ] With an expired or unreachable licence, no status changed and the audit shows `LicenceExpired` / `LicenceUnavailable`.
- [ ] Calls to the licensing service carried only licence key, tenant ID, agent ID and skill name (check the connector request in the flow/agent trace).
- [ ] Work in progress (batch, approvals) finished after the licence lapsed.

## Cost
- [ ] Each task used Start task and Finish task once; no separate catalogue, claim or audit calls by the agent.
- [ ] ERP MCP and Dataverse MCP calls named their fields and filters; no full-record or whole-table reads.
- [ ] The agent did not re-read the checklist between tasks of a chain.

## Writes to D365
- [ ] No create/update/delete data tool calls on ERP MCP.
- [ ] Form tool calls happened only inside Run inventory close, once per attempt key.
- [ ] No reverse, cancel, recalculation, journal posting or production order status change.

## Communication
- [ ] Every email went through `send-close-notification` to a resolved internal owner or controller.
- [ ] Unresolvable recipient → not sent and recorded.
