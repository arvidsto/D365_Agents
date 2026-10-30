# Environment variables & connection references

## Environment variables

| Schema name | Type | Default | Purpose |
| --- | --- | --- | --- |
| `chr_CompanyCodes` | Text | `USMF` | Comma-separated legal entities the scheduled check reads |
| `chr_FinOpsBaseUrl` | Text | – | e.g. `https://contoso.operations.dynamics.com` — used for deep links |
| `chr_CreditManagerEmail` | Text | – | Approver (user or group mailbox / Teams user) |
| `chr_ReviewerEmail` | Text | – | Receives ManualReview items |
| `chr_SalesOpsEmail` | Text | – | Copied on decisions |
| `chr_ApprovalMode` | Text | `TeamsCard` | `TeamsCard` · `Outlook` · `ShadowOnly` |
| `chr_ReleaseMode` | Text | `Manual` | `Manual` (Option A) · `Action` (Option B) |
| `chr_ReleaseReasonCode` | Text | – | Credit management release reason code used by Option B |
| `chr_MaxOverdueDaysForRelease` | Number | `15` | Policy threshold. Fills `{{env:chr_MaxOverdueDaysForRelease}}` in the licensed skills |
| `chr_AlwaysHumanOrderAmount` | Number | `100000` | Orders above this always go to ManualReview. Fills `{{env:chr_AlwaysHumanOrderAmount}}` |
| `chr_StrategicOpportunityValue` | Number | `250000` | CRM context threshold. Fills `{{env:chr_StrategicOpportunityValue}}` |
| `chr_UseCrmContext` | Yes/No | `Yes` | Turn Dataverse MCP context on/off |
| `chr_LicenceKey` | **Secret** (Azure Key Vault) | – | Licence key issued by you; used by the Licensed Skills connection |
| `chr_TenantId` | Text | – | Customer's Microsoft Entra tenant ID; sent so the licence can only be used in this tenant |

The three thresholds are customer settings: the licensed skills contain `{{env:…}}` placeholders that *CHR - Load licensed skill* fills from these variables inside this tenant, so the values never reach the licensing service. If one is empty, new reviews stop with `setting-missing`.

## Connection references

| Schema name | Connector | Account |
| --- | --- | --- |
| `chr_Dataverse` | Microsoft Dataverse | Service account |
| `chr_Office365Outlook` | Office 365 Outlook | Service mailbox |
| `chr_Teams` | Microsoft Teams | Service account (Flow bot) |
| `chr_FinOps` | Fin & Ops Apps (Dynamics 365) | Service account with *Credit Hold Agent* role. Reads in *Check for new holds* and *Gather credit facts*; the release action only in Option B |
| `chr_ERPMCP` | Dynamics 365 ERP MCP | End user (chat only; the autonomous path reads F&O through flows) |
| `chr_DataverseMCP` | Dataverse MCP Server | End user (chat only) |
| `chr_LicensedSkills` | Licensed Agent Skills (custom connector, REST) | *CHR - Load licensed skill (child)*; API key = `chr_LicenceKey` |
