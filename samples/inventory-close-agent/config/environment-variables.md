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

### Customer settings used by the licensed skills

These fill the `{{env:…}}` placeholders in the skills inside this tenant, so the values never go to the licensing service.

| Schema name | Type | Example | Used by |
| --- | --- | --- | --- |
| `ica_BatchGroup` | Text | `INVCLOSE` | `InventoryClose_RunInventoryClose` — batch group for the inventory close job |
| `ica_BusinessHours` | Text | `07:00–19:00` | `InventoryClose_RunInventoryClose` — window to avoid when starting the close (company time) |
| `ica_InventoryMainAccounts` | Text | `140100, 140150, 140200` | `InventoryClose_InventoryToGLReconciliation` — inventory main accounts to reconcile |

If a skill uses a setting that is empty or missing, *ICA - Load licensed skill (child)* stops the task with `SettingMissing` instead of running it with a blank value.


| Connection reference | Connector | Used by |
| --- | --- | --- |
| `ica_ERPMCP` | Fin & Ops Apps (Dynamics 365) — ERP MCP | Agent tool (signed-in user) |
| `ica_DataverseMCP` | Microsoft Dataverse — MCP | Agent tool |
| `ica_MailMCP` | Work IQ Mail | Governed sender |
| `ica_Dataverse` | Microsoft Dataverse | All flows |
| `ica_Teams` | Microsoft Teams | ICA - Request approval |
| `ica_FinOps` | Fin & Ops Apps (Dynamics 365) | Batch completion watcher (read only) |
| `ica_Agents` | Agents (preview) | Event and scheduled flows |
| `ica_LicensedSkills` | Licensed Agent Skills (custom connector, REST) | *ICA - Load licensed skill (child)*; API key = `ica_LicenceKey` |
