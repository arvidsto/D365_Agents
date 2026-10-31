# Dataverse design — <Agent name>

## Work item: <prefix>_<workitem>
| Column | Logical name | Type | Notes |
| --- | --- | --- | --- |
| Status | `<prefix>_status` | Choice | New · ... · ManualReview · Done · Failed |
| Source reference | `<prefix>_sourceref` | Text | Idempotency key |
| Extracted / facts JSON | `<prefix>_factsjson` | Multiline | Evidence |
| Validation message | `<prefix>_validationmessage` | Multiline | |

## Audit: <prefix>_decisionlog
| Column | Type |
| --- | --- |
| Work item | Lookup |
| Action | Choice |
| Actor | Text |
| Details | Multiline |
| Timestamp | Date and time |

## Security roles
| Role | Purpose |
| --- | --- |
| <Reviewer> | Read work items and log; edit reviewer fields |
| <Agent service> | Create/update work items and log; no delete |
