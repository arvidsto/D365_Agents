# Agent Design Canvas

Fill one canvas per agent idea in a workshop with the **process owner**, a **user who does the work today**, and an **architect**. If you can't fill a box, the idea isn't ready to build yet.

**Agent name:** ______________________  **Owner (business):** ______________  **Date:** ________

| # | Box | Guiding questions | Answer |
| --- | --- | --- | --- |
| 1 | **Problem & value** | What's slow, error-prone or costly today? Volume per day/month? Minutes per item? | |
| 2 | **Users & roles** | Who triggers, who approves, who is informed? | |
| 3 | **Build, extend or buy** | Is there a first-party D365 agent or FastTrack template that covers ≥ 80%? | |
| 4 | **Trigger(s)** | Email · business event · Dataverse change · schedule · chat · other? | |
| 5 | **Agent type** | Conversational · autonomous · hybrid | |
| 6 | **Steps (happy path)** | 3–7 steps the agent performs, as verbs ("register", "validate", "recommend", "create", "notify") | |
| 7 | **Data needed (read)** | Which D365 app, entity / table / API page, fields? Exposed already? | |
| 8 | **Actions (write)** | What does it change, where? Autonomy level per action (L0–L4) | |
| 9 | **Decision policy** | Written rules + thresholds. Who owns them? Where stored (skill, env variable, knowledge)? | |
| 10 | **Human in the loop** | Which steps need approval? Channel (Teams, Outlook, review app)? Timeout? | |
| 11 | **Exceptions** | Top 5 failure reasons and what should happen for each | |
| 12 | **Integration pattern** | MCP · connector · virtual table · custom API · business event (see doc 03) | |
| 13 | **Agent's own data** | Work item table + status values; audit table; config | |
| 14 | **Identity & security** | Runs as user or service account? D365 role? Dataverse role? DLP policy? | |
| 15 | **Knowledge** | Policies, SOPs, manuals to ground answers | |
| 16 | **Success KPIs** | Baseline → target (cycle time, % automated, accuracy, credits/item) | |
| 17 | **Evaluation set** | 20–50 real cases with expected outcome — who provides them? | |
| 18 | **Cost estimate** | Items/month × estimated credits/item | |
| 19 | **Risks & responsible AI** | What's the worst wrong action? How is it prevented and detected? | |
| 20 | **Rollout** | Shadow mode → L1 → L2… ; pilot users; go-live date | |

## Quick scoring (prioritise your backlog)

| Criterion | 1 (low) – 5 (high) |
| --- | --- |
| Business value (volume × time × error cost) | |
| Data readiness (APIs/entities exist, clean master data) | |
| Policy clarity (rules written down) | |
| Risk (5 = low risk) | |
| Reusability (components reusable for other agents) | |
| **Total (max 25)** | |

Start with ideas scoring **≥ 18**.

## Worked example

See the [Credit Hold Review Agent](../samples/credit-hold-review-agent/README.md) — every canvas box maps to a section of its README.
