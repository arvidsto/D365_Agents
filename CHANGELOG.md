# Change log

What changed in this kit, why, and how to go back. Newest first. Every design change that affects what a customer pays or how an agent behaves gets an entry here, with its trade-offs and the steps to revert it.

| Version | Date | Git tag | In one line |
| --- | --- | --- | --- |
| [2.0 — Lean design](#20--lean-design-2026-10-30) | 2026-10-30 | `design-v2-lean` | Flows do the fetching, the agent does the judgement. Microsoft cost about 40–50% lower |
| [1.x — Flexible design](#1x--flexible-design-up-to-2026-10-30) | up to 2026-10-30 | `design-v1-flexible` | The agent polls, looks up each fact itself and runs every step as a tool call |

---

## 2.0 — Lean design (2026-10-30)

Commit `070862f`, tag `design-v2-lean`.

### What changed

| | Flexible design (1.x) | Lean design (2.0) |
| --- | --- | --- |
| **Credit Hold — finding new holds** | The agent runs every 30 minutes and checks the hold list itself | A scheduled flow checks the hold list. It starts the agent only when there is a new hold |
| **Credit Hold — gathering facts** | The agent makes about 8 separate ERP and Dataverse MCP calls per hold | One flow, *Gather credit facts*, reads the fields the policy needs |
| **Credit Hold — agent steps per hold** | About 14 | About 6 |
| **Inventory Close — running one task** | The agent reads the task, checks the gates, loads the catalogue, picks the skill, loads it, claims the task, completes it and writes the audit row: about 6 tool calls before and after the real work | Two flows: *Start task* (read, gates, routing, skill, claim) and *Finish task* (status, check, audit) |
| **Inventory Close — instructions** | Full explanations in the core instructions and local behaviors | Shorter; the rules the flows enforce aren't repeated |
| **Inventory Close — tool output** | No limit | Only the fields a skill names, filtered on the server, at most 50 rows |
| **Licensing service** | Skill list returns name, version, description | Also returns a `routing` phrase per skill (an extra field, so 1.x agents still work) |

### What it does to the Microsoft bill (calculator estimates)

| | Flexible (1.x) | Lean (2.0) |
| --- | --- | --- |
| Credit Hold, credits per hold | 92 | 58 |
| Credit Hold, credits per idle 30-minute check | 17 | 2 |
| Credit Hold, Microsoft per month (300 holds) | S$405 (range 290–780) | **S$250** (range 190–440) |
| Inventory Close, credits per task | 510 | 254 |
| Inventory Close, Microsoft per month (16 tasks) | S$200 (range 120–580) | **S$118** (range 70–340) |

Your subscription fee and margin don't change. These are estimates until measured with the [consumption validation kit](docs/07-validating-copilot-consumption.md); the Inventory Close figures are the least certain. Both designs are in the [pricing calculator](tools/pricing-calculator/index.html) (**Design: Lean / Flexible**), so you can price either one.

### The trade-off, in plain words

**Lean is cheaper and more predictable. Flexible is quicker to change and can dig deeper on its own.**

| | Lean (2.0) is better at | Flexible (1.x) is better at |
| --- | --- | --- |
| **Running cost** | ✅ 40–50% fewer Copilot credits, and the bill depends less on the AI model | |
| **Predictability** | ✅ Fixed steps, so every item costs about the same and is easier to test | Varies with how many lookups the agent decides to make |
| **Safety** | ✅ Gates, routing and status writes run in flows the agent can't skip | Relies on the agent following its instructions (the status flows still check server-side) |
| **Adapting to odd cases** | Reads only the fields the flow was built for. A new fact means changing a flow | ✅ The agent can decide to look something else up, for example an extra invoice or a customer note |
| **Changing the process** | Gates and routing are in flows: a change needs a solution release | ✅ Many changes are a text edit to instructions or a local behavior |
| **Build effort** | About 1–2 more days per agent: exact F&O entity and field names must be known up front, and there are more flows to build and test | ✅ Fewer flows; the ERP MCP server finds entities at run time |
| **D365 updates** | A renamed field breaks the flow until it's fixed (you see it in the flow run history) | ✅ The MCP server adapts to most changes |
| **Debugging** | Two places to look: the agent's activity map and the flow run history | ✅ Everything in the agent's activity map |
| **Staying close to Microsoft's templates** | Diverges from Microsoft's Period Close Agent (local behaviors are shorter, steps moved to flows) | ✅ Mirrors Microsoft's pattern, so Microsoft's updates are easier to compare and adopt |
| **Time limits** | *Start task* does a lot in one call and must finish within the agent-flow time limit (about 100 seconds), including two licensing service calls | Many short calls |

**When to choose which**

- **Lean:** high volume (hundreds of items a month), customers who watch the Microsoft bill, processes that are stable and well defined. This is the default.
- **Flexible:** a pilot or proof of concept where the process is still changing, low volume where the saving is small (for example under 50 items a month), or a customer who wants the agent to investigate unusual cases by itself.
- **Mix them:** the change is per agent. You can run Credit Hold on Lean and Inventory Close on Flexible.

### How to revert

Each agent's design lives in its own sample folder, so you can revert one agent without touching the other. The licensing service stays on 2.0 in both cases: its extra `routing` field is ignored by 1.x agents.

1. Restore the agent's folder from the 1.x tag (on a new branch):

   ```bash
   git fetch origin --tags
   ```

   ```bash
   git checkout -b revert-credit-hold-flexible
   ```

   ```bash
   git checkout design-v1-flexible -- samples/credit-hold-review-agent
   ```

   For the Inventory Close Agent, use `samples/inventory-close-agent` instead.

2. **Pricing:** in the calculator choose **Design: Flexible**. Put the flexible figures from the table above back into the worked example in [`docs/06-commercial-model.md`](docs/06-commercial-model.md) and the example on the [pricing page](sales/pricing-page/index.html) (Credit Hold: credits 27,000–72,000, S$290–780, total S$1,090–1,580; Inventory Close: credits 9,000–55,000, S$120–580, total S$1,170–1,630). The [customer one-pager](sales/one-pager/index.html) shows both designs, so it needs no change.

3. **In Copilot Studio** (a customer already on 2.0):
   - Credit Hold: add the *Register hold* flow and the ERP / Dataverse MCP read tools back as agent tools, add the 30-minute recurrence trigger to the agent, and turn off the *Check for new holds* flow.
   - Inventory Close: add *Mark task started*, *Mark task completed*, *Record task audit* and *Load licensed skill* back as agent tools (they're child flows in 2.0, so re-create them with the *When an agent calls the flow* trigger), paste the 1.x instructions and local behaviors, and remove *Start task* and *Finish task*.
   - Run the evaluation set and the consumption test plan again before go-live.

4. Commit the change and add an entry at the top of this file saying which agent was reverted and why.

To compare the two designs file by file:

```bash
git diff design-v1-flexible design-v2-lean -- samples/
```

---

## 1.x — Flexible design (up to 2026-10-30)

Tag `design-v1-flexible` (commit `3e76ade`). Earlier commits, in order:

| Commit | Change |
| --- | --- |
| `31ca92d` | Reference architecture, solution playbook and the Credit Hold Review sample |
| `9a97362` | Inventory Close sample based on the Period Close Agent pattern |
| `c9c5f96` | Licensed skills service; both samples load their business skills from it |
| `d57ff53` | Customer-specific skill values moved to environment variables; offline fallback |
| `76238fe` | Commercial model and pricing calculator |
| `c264a4e` | Customer-facing pricing page |
| `e15fc17` | Licensing service hosting cost explained |
| `3e76ade` | Consumption ranges and the validation kit |
