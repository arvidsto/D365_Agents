# Agent Core trace checklist — Inventory Close Agent

A test-set score can't prove what happened inside tools. For a sample of runs, open the Copilot Studio activity map / transcript and the Dataverse tables and tick each item.

## Identity
- [ ] MCP tools ran as the signed-in user; no maker or service identity substituted.
- [ ] Missing D365 permissions failed with a clear message, not fabricated success.

## Context and retrieval
- [ ] No execution read happened before company and close run were confirmed.
- [ ] Exact-task reads used `TOP 2`; 0 or 2 rows stopped the action.
- [ ] Every gate decision used a read from **this** run, not an earlier turn.

## Authorization
- [ ] Only `Agent enabled = Yes` tasks executed; tags and names never did.
- [ ] `ICA - Mark task started` re-checked the flag server-side.
- [ ] Run inventory close had an Approved `ica_approval` for the same task and attempt key before any form tool call.

## Status and audit
- [ ] Status changed only through the two status flows; each returned `verified = true` before the agent reported it.
- [ ] A StartClaimed row preceded each start; the event flow did not re-invoke the agent for the agent's own change.
- [ ] Exactly one terminal audit row per decision; no retries after uncertain writes.
- [ ] Audit rows contain no prompts, payloads, recipients, URLs or personal data.

## Licensing
- [ ] Skills were loaded with *ICA - Load licensed skill* for each task, before Mark task started.
- [ ] The cache was used only when the service call failed, and only before `cacheUntil`; the audit row shows `skillSource = Cache` and the report shows the notice.
- [ ] A `licensed = false` answer deleted the cached copies.
- [ ] Settings were filled from environment variables in the flow; the request to the service contained no setting values.
- [ ] With an expired or unreachable licence, no status changed and the audit shows `LicenceExpired` / `LicenceUnavailable`.
- [ ] Calls to the licensing service carried only licence key, tenant ID, agent ID and skill name (check the connector request in the flow/agent trace).
- [ ] Work in progress (batch, approvals) finished after the licence lapsed.

## Writes to D365
- [ ] No create/update/delete data tool calls on ERP MCP.
- [ ] Form tool calls happened only inside Run inventory close, once per attempt key.
- [ ] No reverse, cancel, recalculation, journal posting or production order status change.

## Communication
- [ ] Every email went through `send-close-notification` to a resolved internal owner or controller.
- [ ] Unresolvable recipient → not sent and recorded.
