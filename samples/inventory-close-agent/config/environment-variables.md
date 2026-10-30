# Environment variables & connection references — Inventory Close Agent

| Schema name | Type | Default | Purpose |
| --- | --- | --- | --- |
| `ica_FinOpsBaseUrl` | Text | – | Deep links, e.g. `https://contoso.operations.dynamics.com` |
| `ica_ReviewAppUrl` | Text | – | Link to the Compliance Review app |
| `ica_LeadDays` | Number | `1` | Due gate for chain runs: run tasks due within N days |
| `ica_EscalationDays` | Number | `2` | Overdue days before an escalation email |
| `ica_ApprovalWaitMinutes` | Number | `60` | Wait for the Teams approval before returning Pending |
| `ica_MaxChainTasks` | Number | `10` | Safety limit per invocation |
| `ica_LicenceKey` | **Secret** (Azure Key Vault) | – | Licence key you issue; used by the Licensed Skills connection |
| `ica_TenantId` | Text | – | Customer's Microsoft Entra tenant ID, sent so the licence only works in this tenant |

Business-skill placeholders `{{BATCH_GROUP}}` (RunInventoryClose) and `{{INVENTORY_ACCOUNTS}}` (InventoryToGLReconciliation) are set per customer in the licensing service. For per-customer values, either keep one skill version per customer or move the values to environment variables and have the skill tell the agent to read them.

| Connection reference | Connector | Used by |
| --- | --- | --- |
| `ica_ERPMCP` | Fin & Ops Apps (Dynamics 365) — ERP MCP | Agent tool (signed-in user) |
| `ica_DataverseMCP` | Microsoft Dataverse — MCP | Agent tool |
| `ica_MailMCP` | Work IQ Mail | Governed sender |
| `ica_Dataverse` | Microsoft Dataverse | All flows |
| `ica_Teams` | Microsoft Teams | ICA - Request approval |
| `ica_FinOps` | Fin & Ops Apps (Dynamics 365) | Batch completion watcher (read only) |
| `ica_Agents` | Agents (preview) | Event and scheduled flows |
| `ica_LicensedSkills` | Licensed Agent Skills (custom connector, MCP) | Agent tool; API key = `ica_LicenceKey` |
