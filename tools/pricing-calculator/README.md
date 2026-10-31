# Agent Pricing Calculator

Prices one D365 agent for one customer: your subscription by tier, the customer's Microsoft Copilot credits, the value of time saved, payback, and your margin. The commercial model behind it is in [docs/06-commercial-model.md](../../docs/06-commercial-model.md).

| File | Purpose |
| --- | --- |
| [`index.html`](index.html) | The calculator. Open it in a browser; no server or build needed |
| [`calc.js`](calc.js) | The pricing engine (Microsoft rates, tiers, sample agents). Used by the page and the tests |
| [`calc.test.js`](calc.test.js) | Tests for the engine |

```bash
node --test tools/pricing-calculator/calc.test.js
```

- **Views:** *Internal* shows your costs and margin; *Customer* hides them so you can share your screen in a meeting.
- **Copy quote summary** puts customer-facing text on the clipboard for your proposal.
- **Design:** *Lean* (default) prices the current sample designs, where flows do the fetching. *Flexible* prices the previous designs, where the agent polls and looks up each fact itself. See the [change log](../../CHANGELOG.md) for the trade-off.
- **Ranges:** Microsoft usage is shown as low / expected / high. The high case assumes twice the steps and, for reasoning models or the Microsoft Copilot harness, twice the tokens per step. Choose the model under **AI model & measured usage**.
- **Measured values:** after a [consumption validation](../../docs/07-validating-copilot-consumption.md), enter credits per item, per scheduled run and per chat (the [analyzer](../consumption-analyzer/README.md) prints them). They replace the estimate and the range narrows to ±15%.
- **Inputs** are saved in your browser only.
- **To change defaults** (rates, tiers, sample agents), edit `DEFAULTS`, `DEFAULT_TIERS` or `PRESETS` in `calc.js` and run the tests.

Microsoft rates were checked in October 2026; check the [billing rates page](https://learn.microsoft.com/microsoft-copilot-studio/requirements-messages-management) before quoting.
