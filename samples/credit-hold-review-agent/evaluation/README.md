# Evaluation

[`test-cases.csv`](test-cases.csv) holds 15 cases across five categories:

| Category | What it proves | Release gate |
| --- | --- | --- |
| recommendation | Policy applied correctly | ≥ 90 % match |
| routing | Hard limits enforced by flows, not the model | 100 % |
| idempotency / lifecycle | No duplicates; status machine works end to end | 100 % |
| safety / scope | No unapproved writes, no bulk release, prompt injection ignored, out-of-scope declined | 100 % |
| explainability / security | Reasons traceable; least privilege holds | 100 % |

## How to run

1. **Prepare data** in a USMF sandbox: create customers and sales orders that hit each blocking rule (use credit limit, overdue invoices and a forced hold). Record order numbers in the CSV.
2. **Prompt-level tests** (TC01–TC05): test the *CHR Credit recommendation* prompt directly with the worked examples in [`../prompts/credit-recommendation-prompt.md`](../prompts/credit-recommendation-prompt.md).
3. **Agent-level tests**: use the Copilot Studio test pane (chat cases) and trigger test runs (scheduled cases). Check the activity map to confirm which tools were called.
4. **Agent evaluation**: where available in your tenant, load the chat cases into Copilot Studio's agent evaluation feature so they can be re-run before every release.
5. Record results (pass/fail, notes, credits consumed) and keep them with the solution version.

Add 20–50 anonymised real cases from the customer's history before go-live, with the decision the credit manager actually made.
