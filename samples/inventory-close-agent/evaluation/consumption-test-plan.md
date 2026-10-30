# Consumption test plan — Inventory Close Agent

Follow [07 — Validating Copilot consumption](../../../docs/07-validating-copilot-consumption.md). This page gives the agent-specific setup, data and pass marks.

## What to expect (calculator estimate, Microsoft Copilot harness)

This agent runs on the Microsoft Copilot harness, which Microsoft bills for model tokens, tools and the harness. The calculator approximates that as 1,500 tokens per agent action (after the trimmed instructions and the tool output rules), so this estimate is **much less certain** than the Credit Hold one.

| Unit | Low | Expected | High |
| --- | --- | --- | --- |
| Credits per close task run | 157 | 254 | 867 |
| Credits per reminder sweep | 50 | 82 | 284 |
| Credits per chat session | 65 | 106 | 362 |

The estimate assumes about 12 agent actions per task: *Start task*, about 7 ERP MCP reads named by the skill, *Finish task*, a notification and the report. Gates, routing, skill loading, the claim, status writes and audit run inside flows (about 90 flow actions).

The harness charges credits while you build and preview too. Build and preview in your development environment; use the validation environment only for the scenario days.

## Setup specific to this agent

- Supply Chain Management sandbox with items on periodic valuation (FIFO or weighted average), open receipts, a negative on-hand item, open production orders and unposted inventory journals in USMF.
- Two close runs, so the chain, approvals and batch hand-over all run: `USMF — Oct 2026` and a second company.
- The cost accountant tester approves *Run inventory close* within minutes. The batch completion watcher is a cloud flow: its Power Automate runs aren't Copilot credits, but note them.
- Turn the daily reminder sweep on only for day 1.

## Test data

Load [`data/sample-close-checklist.csv`](../data/sample-close-checklist.csv) for each close run (8 tasks, 7 agent-enabled). Two runs give 14 agent-enabled tasks for day 3. For day 4, reset the checklist (status back to *Not started*) and run again; reverse the inventory close in the sandbox first if you want task 50 to run again.

## Run log

```csv
date,agent,scenario,items,scheduledRuns,chatSessions,notes
<day1>,Inventory Close Agent,scheduled,0,1,0,Reminder sweep only
<day2>,Inventory Close Agent,chat,0,0,15,AgentCore_1 questions plus status questions
<day3>,Inventory Close Agent,items,14,0,0,Two close runs end to end incl. approval and batch
<day4>,Inventory Close Agent,items,14,0,0,Repeat after reset
```

Count items as terminal rows in `ica_closetaskaudit` (outcome Succeeded, Submitted, Blocked or Skipped) per UTC day.

## Pass marks

- Measured credits per close task at or below **867** (the high case). Above it: shorten local behaviors and skills, reduce tool calls, or test a cheaper model, then measure again.
- Note the share of model-token credits in the breakdown. If it's over half, the quote depends on the model: record which one was used.
- The two item days within 30% of each other.
