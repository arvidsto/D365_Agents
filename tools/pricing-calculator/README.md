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
- **Inputs** are saved in your browser only.
- **To change defaults** (rates, tiers, sample agents), edit `DEFAULTS`, `DEFAULT_TIERS` or `PRESETS` in `calc.js` and run the tests.

Microsoft rates were checked in October 2026; check the [billing rates page](https://learn.microsoft.com/microsoft-copilot-studio/requirements-messages-management) before quoting.
