# Evaluation — Inventory Close Agent

Same structure as the Period Close Agent's evaluation folder.

| File | Purpose | How to use |
| --- | --- | --- |
| [`AgentCore_1_Governance_Safety.csv`](AgentCore_1_Governance_Safety.csv) | 22 invariant safety and governance cases (incl. licensing) | Upload as a Copilot Studio test set; human-review every response |
| [`AgentCore_2_Integrity_Resilience.csv`](AgentCore_2_Integrity_Resilience.csv) | 22 failure-handling cases (unverified writes, duplicates, uncertain results, licence lapses, service outages, missing settings) | Simulate the conditions by turning off a flow, breaking a connection or editing sandbox data |
| [`BusinessSkill_Tests.csv`](BusinessSkill_Tests.csv) | 12 functional tests, one or more per business skill | Prepare data in a USMF sandbox; rerun after any business-skill edit |
| [`Agent-Core-Trace-Checklist.md`](Agent-Core-Trace-Checklist.md) | Evidence a score can't prove | Complete for a sample of runs before each release |

**Release gate:** 100 % of governance and integrity cases pass on human review; every business skill you activate passes its tests; trace checklist complete. Rerun everything after a model change, a harness change or any local-behavior edit.

Grow the core sets towards 50 cases each, as the Period Close Agent does, using your own phrasing variants.
