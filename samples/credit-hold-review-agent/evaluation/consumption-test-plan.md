# Consumption test plan — Credit Hold Review Agent

Follow [07 — Validating Copilot consumption](../../../docs/07-validating-copilot-consumption.md). This page gives the agent-specific setup, data and pass marks.

## What to expect (calculator estimate, standard model)

| Unit | Low | Expected | High |
| --- | --- | --- | --- |
| Credits per hold reviewed | 69 | 92 | 184 |
| Credits per scheduled check (every 30 min) | 13 | 17 | 34 |
| Credits per chat session | 20 | 26 | 52 |

The estimate assumes about 14 agent actions per hold (load policy, register, 5 ERP MCP reads, 3 Dataverse MCP reads, build case, request approval, apply decision), 120 agent flow actions and 3K prompt tokens. If you switch the agent to a reasoning model, re-run the calculator with that model first; the range widens a lot.

## Setup specific to this agent

- D365 Finance sandbox with credit management on, blocking rules for overdue amount, credit limit used and order amount, and the USMF demo customers.
- `chr_ApprovalMode = TeamsCard` and a tester acting as credit manager who approves within minutes, so *Apply decision* runs on the same UTC day.
- `chr_UseCrmContext = Yes` if the customer will use CRM context (it adds Dataverse MCP calls).
- Licence issued for the validation tenant with a short term; the licensing service counts as normal flow actions.

## Test data (45 holds)

| Mix | Count | How to create |
| --- | --- | --- |
| Clear release (small overdue, within limit) | 15 | Sales orders for customers with small overdue balances |
| Clear keep on hold (> 60 days overdue or > 150% of limit) | 10 | Customers with old open invoices |
| Review (close to thresholds, open dispute case in CRM) | 10 | Edit balances and add a dispute case |
| Manual review (amount above `chr_AlwaysHumanOrderAmount`, missing data) | 5 | Large orders; a customer with no payment history |
| Forced credit hold | 5 | Force hold on the order |

Day 3 uses 20 of these, day 4 the other 25.

## Run log

```csv
date,agent,scenario,items,scheduledRuns,chatSessions,notes
<day1>,Credit Hold Review Agent,scheduled,0,20,0,Idle: recurrence in business hours only
<day2>,Credit Hold Review Agent,chat,0,0,15,TC09-TC15 chat questions plus 8 'why' questions
<day3>,Credit Hold Review Agent,items,20,20,0,20 holds; approvals within 15 min
<day4>,Credit Hold Review Agent,items,25,20,0,25 holds; includes the messy cases
```

Count items as `chr_creditdecisionlog` rows with action *CaseBuilt* or *ManualReview* per UTC day.

## Pass marks

- Measured credits per hold at or below **184** (the high case). Above it: redesign before quoting.
- Credits per scheduled check at or below **34**. If higher, move to a business-event trigger.
- The two item days within 30% of each other.
- No *Text and generative AI tools (premium)* in the breakdown unless you chose a reasoning model.
