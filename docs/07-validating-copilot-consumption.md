# 07 — Validating Copilot Consumption Before You Quote

The pricing calculator estimates Copilot credits from the number of steps an agent takes. The rates are Microsoft's published ones, but the number of steps, and especially the number of tokens a reasoning model or the Microsoft Copilot harness reads, can only be known by running the agent. This kit turns a few days of controlled test runs into three measured numbers that replace the estimate:

| Measured number | Used for |
| --- | --- |
| Credits per work item | The work the customer pays for (holds reviewed, close tasks run) |
| Credits per scheduled run | Background checks that run whether or not there is work |
| Credits per chat session | People asking the agent questions |

**Rule:** don't give a customer a firm Microsoft cost until you have measured it. Until then, quote the calculator's low–high range.

## 1. What Microsoft lets you measure

| Source | What it shows | Limits |
| --- | --- | --- |
| Copilot Studio → agent → **Monitor** → *See billing* | Billed credits over time, split by activity | Billed credits only; updates a few hours after the run |
| Power Platform admin center → **Licensing → Copilot Studio → Environments →** *environment* → **Copilot credit consumption details → Download** | Detailed report: date, agent name, product / AI feature, channel, LLM model, tool used, billed and non-billed credits | **Daily only**: no per-conversation or per-message figures, no token counts |
| Power Platform admin center → **Licensing → Copilot Studio → Summary → Download report** | Reports by environment, agent or user | Same daily granularity |
| Azure Cost Management | Pay-as-you-go charges on the billing plan's Azure subscription | Money, not credits; finalised monthly |

Two consequences shape the method:

1. **Daily granularity** → run one kind of work per day (items, or scheduled runs only, or chat only), and keep a run log of what happened each day.
2. **Test-pane runs aren't charged like real runs** (agent flow actions started from the test chat aren't billed) → validate with the **published agent and its real triggers**, never the test pane.

Microsoft Copilot harness agents (the Inventory Close Agent) also consume credits while you build and preview them, so keep building in your development environment and use the validation environment only for the scenario runs.

## 2. Set up the validation environment

| # | Step | Why |
| --- | --- | --- |
| 1 | Create a **separate Power Platform environment** (sandbox) linked to a D365 sandbox with realistic data | Nothing else in it consumes credits, so every credit belongs to this agent |
| 2 | Link it to its **own pay-as-you-go billing plan** (Azure subscription or resource group you can read) | Clean cost line in Azure Cost Management |
| 3 | Set a **monthly credit limit** on the agent (*Licensing → Copilot Studio → Manage agents*, with *Stop usage*) at about 3× the calculator's high case for the test volume | A loop or runaway trigger can't run up a bill |
| 4 | Import the agent's solution as a **managed** solution, the same build the customer will get | Measures what you will ship |
| 5 | Use the **same AI model and harness** as production; note them in the run log | The model is the biggest driver of cost |
| 6 | Publish the agent and connect its **real triggers and channel** (recurrence, Dataverse trigger, Teams) | Test-pane runs aren't billed like real ones |
| 7 | Use a tester **without a Microsoft 365 Copilot licence** for chat | Licensed users' chat isn't charged and would hide the cost |
| 8 | Prepare **test data**: 40–50 work items that look like the customer's mix (easy, typical, messy) | Measures realistic, not best-case, behaviour |

## 3. Run the scenarios: one kind of work per UTC day

The report is daily in UTC (Singapore is UTC+8, so a UTC day runs 08:00–08:00 Singapore time). Plan the days so each one isolates one kind of work.

| Day | Scenario | What to do | Run log row |
| --- | --- | --- | --- |
| 1 | **Scheduled only** | Leave the agent on with its schedule and no new work | `scenario=scheduled`, `scheduledRuns` = runs that day |
| 2 | **Chat only** | Turn the schedule off; run 15–20 chat questions from the evaluation set | `scenario=chat`, `chatSessions` |
| 3 | **Items** | Schedule back on; create 20–25 work items in D365 and let the agent process them end to end, including approvals | `scenario=items`, `items`, `scheduledRuns` |
| 4 | **Items again** | Another 20–25 items, a different mix | as day 3 |
| 5 (optional) | **Model comparison** | Repeat day 3 with a standard model if you used a reasoning model, or the other way round | `notes` = model used |

Background work on item days is fine: the analyzer subtracts the cost of scheduled runs and chats measured on days 1 and 2.

Count items from the agent's own audit table, not from memory:
- **Credit Hold:** `chr_creditdecisionlog` rows with action *CaseBuilt* or *ManualReview* for that day.
- **Inventory Close:** `ica_closetaskaudit` terminal rows for that day.

## 4. Analyze

1. Wait 24–48 hours after the last day, then download the **detailed report** for the validation environment covering all the days.
2. Fill in the run log ([template](../tools/consumption-analyzer/examples/runlog-template.csv)).
3. Run the analyzer:

   ```bash
   node tools/consumption-analyzer/analyze.js --report <downloaded-report.csv> --runlog <runlog.csv>
   ```

4. It prints the credits per day, where the credits went (agent actions, flow actions, generative answers, premium tokens), the models seen, and the three measured numbers with their spread.
5. Enter the three numbers in the [pricing calculator](../tools/pricing-calculator/README.md) under **AI model & measured usage**. The range narrows to ±15% and the quote summary says the Microsoft usage was measured.

## 5. Decide

| Result | What to do |
| --- | --- |
| Measured per item is **at or below the expected** estimate | Quote with the measured figure |
| **Between expected and high** | Quote with the measured figure; check the feature breakdown for easy savings (below) |
| **Above the high case** | Don't quote yet. Find what's driving it in the breakdown, change the design, and measure again |
| Item days differ by more than 30% | Run another item day; the agent behaves inconsistently on some inputs. Check those cases in the transcripts |
| Premium tokens are more than half the credits | The model choice dominates the price. Test a standard model on day 5 |

### Where savings usually come from

| Driver in the breakdown | Fix |
| --- | --- |
| **Agent action** high on scheduled days | Trigger from a D365 business event or Dataverse change instead of polling; or poll only in business hours |
| **Agent action** high per item | Fewer, more capable tools: one agent flow that does several reads instead of many MCP calls; turn off MCP tools the agent doesn't need |
| **Text and generative AI tools (premium)** | Use a standard model where deep reasoning isn't needed; shorten instructions and skills; return only needed fields from tools (`$select`) |
| **Generative answer** high in chat | Shorter answers; classic answers for common questions |
| **Agent flow actions** | Rarely large; combine loops and avoid per-row actions in big lists |

## 6. Repeat when things change

Measure again after: a model or harness change, a new skill version that changes the procedure, a new tool, or a big change in the customer's data volume. Agents in production: compare the monthly agent report from the Power Platform admin center with the measured figures, and re-quote at renewal if they differ by more than 20%.

## 7. Per-agent test plans

- [Credit Hold Review Agent — consumption test plan](../samples/credit-hold-review-agent/evaluation/consumption-test-plan.md)
- [Inventory Close Agent — consumption test plan](../samples/inventory-close-agent/evaluation/consumption-test-plan.md)
