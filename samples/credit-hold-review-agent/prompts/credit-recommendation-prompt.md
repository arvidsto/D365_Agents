# AI prompt — "CHR Credit recommendation"

Create in **Copilot Studio → Tools → New → Prompt** (or AI Builder prompt). Output format: **JSON**. Temperature: low. Model: the default GPT model available in your region.

> 🔐 **Licensed content.** The instruction text of this prompt is your IP. It is **not** stored in the customer's tenant. It lives in the licensing service as [`CHR_CreditRecommendationPrompt`](../../../licensing-service/skills/credit-hold-review-agent/CHR_CreditRecommendationPrompt.md), and the *CHR - Build credit case* flow fetches it on every case and passes it in as the `instructions` input. The prompt inside Copilot Studio is only a thin template.

## Inputs

| Name | Type | Example |
| --- | --- | --- |
| `instructions` | Text | Skill content from the licensing service, with `{{env:chr_MaxOverdueDaysForRelease}}` and `{{env:chr_StrategicOpportunityValue}}` already filled in by *CHR - Load licensed skill* |
| `factsJson` | Text | see facts schema below |
| `blockingReason` | Text | `Overdue amount` |

## Prompt template (the only text stored in the customer's tenant)

```text
{instructions}

BLOCKING REASON: {blockingReason}
FACTS: {factsJson}
```

If `instructions` is empty, the flow never calls the prompt (it routes to manual review first), so the template can't run without a licence.

## Facts schema (also used in *Parse JSON*)

```json
{
  "type": "object",
  "properties": {
    "currency":              { "type": ["string", "null"] },
    "creditLimit":           { "type": ["number", "null"] },
    "balance":               { "type": ["number", "null"] },
    "overdueAmount":         { "type": ["number", "null"] },
    "oldestOverdueDays":     { "type": ["integer", "null"] },
    "orderAmount":           { "type": ["number", "null"] },
    "lastPaymentDate":       { "type": ["string", "null"], "format": "date" },
    "creditLimitExpiryDate": { "type": ["string", "null"], "format": "date" },
    "paymentTerms":          { "type": ["string", "null"] },
    "forcedHold":            { "type": ["boolean", "null"] },
    "isIntercompany":        { "type": ["boolean", "null"] },
    "crm": {
      "type": ["object", "null"],
      "properties": {
        "accountOwner":         { "type": ["string", "null"] },
        "openOpportunityValue": { "type": ["number", "null"] },
        "openDisputeCases":     { "type": ["integer", "null"] }
      }
    }
  }
}
```

## Worked examples (use as prompt test cases)

| Facts (short) | Expected |
| --- | --- |
| limit 50,000; balance 30,000; order 12,000; oldest overdue 8 days; paid 20 days ago; no disputes | **Release**, High — "Balance + order 42,000 is 84% of limit"; "Oldest overdue 8 days (≤ 15)" |
| limit 50,000; balance 61,000; order 20,000; oldest overdue 75 days | **KeepOnHold**, High — "Oldest overdue 75 days (> 60)"; "Exposure 162% of limit (> 150%)" |
| limit 50,000; balance 40,000; order 14,000; oldest overdue 14 days; 1 dispute case | **Review**, Medium — "Open dispute case"; "Oldest overdue 14 days, close to the 15-day limit" |
| oldestOverdueDays null | **Review**, Low — "oldestOverdueDays is missing" |
