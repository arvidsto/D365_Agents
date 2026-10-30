# Environment variables & connection references

## Environment variables

| Schema name | Type | Default | Purpose |
| --- | --- | --- | --- |
| `chr_CompanyCodes` | Text | `USMF` | Comma-separated legal entities the scheduled run checks |
| `chr_FinOpsBaseUrl` | Text | – | e.g. `https://contoso.operations.dynamics.com` — used for deep links |
| `chr_CreditManagerEmail` | Text | – | Approver (user or group mailbox / Teams user) |
| `chr_ReviewerEmail` | Text | – | Receives ManualReview items |
| `chr_SalesOpsEmail` | Text | – | Copied on decisions |
| `chr_ApprovalMode` | Text | `TeamsCard` | `TeamsCard` · `Outlook` · `ShadowOnly` |
| `chr_ReleaseMode` | Text | `Manual` | `Manual` (Option A) · `Action` (Option B) |
| `chr_ReleaseReasonCode` | Text | – | Credit management release reason code used by Option B |
| `chr_MaxOverdueDaysForRelease` | Number | `15` | Policy threshold |
| `chr_AlwaysHumanOrderAmount` | Number | `100000` | Orders above this always go to ManualReview |
| `chr_StrategicOpportunityValue` | Number | `250000` | CRM context threshold |
| `chr_UseCrmContext` | Yes/No | `Yes` | Turn Dataverse MCP context on/off |

## Connection references

| Schema name | Connector | Account |
| --- | --- | --- |
| `chr_Dataverse` | Microsoft Dataverse | Service account |
| `chr_Office365Outlook` | Office 365 Outlook | Service mailbox |
| `chr_Teams` | Microsoft Teams | Service account (Flow bot) |
| `chr_FinOps` | Fin & Ops Apps (Dynamics 365) | Service account with *Credit Hold Agent* role — Option B only |
| `chr_ERPMCP` | Dynamics 365 ERP MCP | Service account (scheduled) / end user (chat) |
| `chr_DataverseMCP` | Dataverse MCP Server | Service account (scheduled) / end user (chat) |
