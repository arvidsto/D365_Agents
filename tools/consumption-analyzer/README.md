# Consumption Analyzer

Turns Microsoft's Copilot credit consumption report and your validation run log into measured **credits per item**, **credits per scheduled run** and **credits per chat session** for the [pricing calculator](../pricing-calculator/README.md). The method is in [docs/07-validating-copilot-consumption.md](../../docs/07-validating-copilot-consumption.md).

```bash
node tools/consumption-analyzer/analyze.js --report <ppac-report.csv> --runlog <runlog.csv>
```

Add `--json` to print only the three numbers, or `--agent "Agent name"` if the run log has no agent column.

| File | Purpose |
| --- | --- |
| [`analyze.js`](analyze.js) | The analyzer (Node 18+, no dependencies) |
| [`examples/runlog-template.csv`](examples/runlog-template.csv) | Run log format: one row per UTC day with the scenario and counts |
| [`examples/sample-ppac-report.csv`](examples/sample-ppac-report.csv) | **Made-up** example of the downloaded report, for trying the tool. Not real measurements |
| [`analyze.test.js`](analyze.test.js) | Tests (`node --test tools/consumption-analyzer/analyze.test.js`) |

**How it works**
- Columns are matched by name: a date column, *Agent name*, *Product / AI feature*, *LLM model*, *Billed credits*, *Non-billed credits*. If Microsoft renames them, the error message lists the columns it found.
- Scheduled-only and chat-only days give credits per run and per chat.
- Those are subtracted from item days, so background runs don't inflate the per-item figure.

**What it warns about**
- Days missing from the report (it can lag a day).
- Non-billed credits.
- Token-billed models.
- A premium-token share that dominates the bill.
- Mixed days it can't separate.
