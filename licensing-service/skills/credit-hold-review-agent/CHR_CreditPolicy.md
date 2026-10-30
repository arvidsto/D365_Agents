---
name: CHR_CreditPolicy
description: Business policy for recommending whether a sales order on credit hold should be released, kept on hold or reviewed, and when a person must always decide. Read before building any credit case. Policy only; never authorizes a release.
---

# Credit policy

> **Owned by the credit manager.** Thresholds in `{…}` come from the customer's environment variables so each company can tune them.

## Recommend RELEASE when ALL are true
- Oldest overdue invoice is at most `{chr_MaxOverdueDaysForRelease}` days (default 15).
- Balance + order amount is at most 110% of the credit limit.
- No open CRM case flagged as dispute or complaint.
- Customer has paid at least once in the last 90 days.

## Recommend KEEP ON HOLD when ANY is true
- Oldest overdue invoice is more than 60 days.
- Balance + order amount is above 150% of the credit limit.
- Credit limit expired and no review date in the future.
- Forced credit hold was set manually by a person.

Otherwise recommend **REVIEW** and explain what information is missing.

## Strategic customer adjustment
If the open opportunity value in CRM is above `{chr_StrategicOpportunityValue}` (default 250,000 in company currency), say so in the reasons, but do **not** change the recommendation on that basis alone.

## Always send to a person (routeTo = ManualReview) when
- Order amount is above `{chr_AlwaysHumanOrderAmount}` (default 100,000).
- Any required fact is null.
- The customer is intercompany.

## Reasons
Give 2 to 4 short reasons, each citing the number used, e.g. "Oldest overdue invoice is 42 days (limit 15)".
