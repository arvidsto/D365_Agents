# Environment variables & connection references — Inventory Close Agent

| Schema name | Type | Default | Purpose |
| --- | --- | --- | --- |
| `ica_FinOpsBaseUrl` | Text | – | Deep links, e.g. `https://contoso.operations.dynamics.com` |
| `ica_ReviewAppUrl` | Text | – | Link to the Compliance Review app |
| `ica_LeadDays` | Number | `1` | Due gate for chain runs: run tasks due within N days |
| `ica_EscalationDays` | Number | `2` | Overdue days before an escalation email |
| `ica_ApprovalWaitMinutes` | Number | `60` | Wait for the Teams approval before returning Pending |
| `ica_MaxChainTasks` | Number | `10` | Safety limit per invocation |

Business-skill placeholders to replace: `{{BATCH_GROUP}}` (RunInventoryClose), `{{INVENTORY_ACCOUNTS}}` (InventoryToGLReconciliation).

| Connection reference | Connector | Used by |
| --- | --- | --- |
| `ica_ERPMCP` | Fin & Ops Apps (Dynamics 365) — ERP MCP | Agent tool (signed-in user) |
| `ica_DataverseMCP` | Microsoft Dataverse — MCP | Agent tool |
| `ica_MailMCP` | Work IQ Mail | Governed sender |
| `ica_Dataverse` | Microsoft Dataverse | All flows |
| `ica_Teams` | Microsoft Teams | ICA - Request approval |
| `ica_FinOps` | Fin & Ops Apps (Dynamics 365) | Batch completion watcher (read only) |
| `ica_Agents` | Agents (preview) | Event and scheduled flows |
