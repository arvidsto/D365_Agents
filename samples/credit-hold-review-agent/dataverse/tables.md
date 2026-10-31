# Dataverse design

Publisher prefix: `chr`. All components belong to the solution **Credit Hold Review Agent**.

## Table: Credit Hold Review (`chr_creditholdreview`) — the work item

| Column | Logical name | Type | Notes |
| --- | --- | --- | --- |
| Name | `chr_name` | Text (primary) | `{company}-{salesOrder}` |
| Status | `chr_status` | Choice *CHR Review Status* | Drives the lifecycle and the re-trigger |
| Company code | `chr_companycode` | Text (10) | e.g. USMF |
| Sales order number | `chr_salesordernumber` | Text (20) | Alternate key with company code (+ status ≠ Closed enforced in flow) |
| Customer account | `chr_customeraccount` | Text (20) | |
| Blocking reason | `chr_blockingreason` | Text (200) | From the hold list |
| Order amount | `chr_orderamount` | Currency | |
| Facts (JSON) | `chr_factsjson` | Multiline text (max) | Exactly what the agent saw — evidence for audit |
| Recommendation | `chr_recommendation` | Choice: Release / KeepOnHold / Review | |
| Reasons | `chr_reasons` | Multiline text | |
| Confidence | `chr_confidence` | Choice: High / Medium / Low | |
| Approver | `chr_approver` | Text (email) | |
| Approver comment | `chr_approvercomment` | Multiline text | |
| Decided on | `chr_decidedon` | Date and time | |
| Outcome | `chr_outcome` | Choice: Released / KeptOnHold / Cancelled | |
| Detected on | `chr_detectedon` | Date and time | For cycle-time KPI |

### Choice: CHR Review Status (`chr_reviewstatus`)

`New` · `CaseReady` · `ManualReview` · `AwaitingApproval` · `Approved` · `Rejected` · `ReleasePending` · `Released` · `Closed` · `Failed`

See the state diagram in the [sample README](../README.md#status-lifecycle-of-a-review-item).

## Table: Credit Decision Log (`chr_creditdecisionlog`) — the audit trail

| Column | Logical name | Type |
| --- | --- | --- |
| Name | `chr_name` | Autonumber `CDL-{SEQNUM:6}` |
| Review | `chr_reviewid` | Lookup → Credit Hold Review |
| Action | `chr_action` | Choice: Registered, CaseBuilt, ManualReview, LicenceBlocked, Approved, Rejected, ReleaseRequested, Released, ClosedReleased, ClosedKeptOnHold, Failed |
| Actor | `chr_actor` | Text — `agent` or the person's email |
| Details | `chr_details` | Multiline text (includes skill version and source `live` / `cache` for CaseBuilt rows) |
| Recommendation snapshot | `chr_recommendationsnapshot` | Text |
| Timestamp | `chr_timestamp` | Date and time |

Turn on **auditing** for both tables. Make the log append-only via security (reviewers: read only; only the service account can create).

## Table: Skill cache (`chr_skillcache`) — short-lived copies of licensed skills

Used only by *CHR - Load licensed skill (child)* when the licensing service can't be reached.

| Column | Logical name | Type |
| --- | --- | --- |
| Skill name | `chr_name` | Text (alternate key) |
| Content | `chr_content` | Multiline text (max), as received, before settings are filled in |
| Version | `chr_version` | Text |
| Notice | `chr_notice` | Text |
| Cache until | `chr_cacheuntil` | Date and time (set by the service; never past the licence grace end) |
| Fetched on | `chr_fetchedon` | Date and time |

No user role gets any access; only the flow's service account can create, read, update and delete it. Leave `chr_content` out of auditing and exclude the table from search and the Dataverse MCP server. Rows are deleted when the service says the licence isn't valid or the copy is past `chr_cacheuntil`. A System Administrator can still read it; the contract and the watermark in each skill cover that.

## Security role: Credit Hold Reviewer

| Table | Create | Read | Write | Delete |
| --- | --- | --- | --- | --- |
| Credit Hold Review | – | Org | Org (only reviewer fields via form) | – |
| Credit Decision Log | – | Org | – | – |

Service account role **Credit Hold Agent Service**: Create/Read/Write on both tables, no Delete.

## Model-driven app: Credit Hold Review

| View | Filter | Purpose |
| --- | --- | --- |
| Needs my attention | Status in (ManualReview, AwaitingApproval) | Reviewer's work queue |
| Release pending | Status = ReleasePending | Option A follow-up |
| Decided this month | Decided on this month | Management review |
| All reviews | – | Search |

Form: header with status, recommendation and confidence; tab *Case file* (facts JSON rendered via a formatted text column or PCF); tab *Decision log* (sub-grid).

Dashboard / Power BI KPIs: holds per day, % approved as recommended, median time to decision, top blocking reasons.
