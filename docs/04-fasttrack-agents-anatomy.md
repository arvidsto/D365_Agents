# 04 — Anatomy of the Microsoft FastTrack AI ERP Agents

Source: [microsoft/Dynamics-365-FastTrack-Implementation-Assets › Agents › AI ERP Agents](https://github.com/microsoft/Dynamics-365-FastTrack-Implementation-Assets/tree/master/Agents/AI%20ERP%20Agents).

The goal of this page is to show that the eight templates are **the same handful of building blocks combined differently**. Component IDs (C1…C14) refer to the catalogue in [01 — Reference architecture](01-reference-architecture.md#5-reusable-component-catalogue).

## 1. Summary matrix

| Agent | Type | Trigger | How it reaches D365 | Writes to D365? | Human in the loop | Components |
| --- | --- | --- | --- | --- | --- | --- |
| **Sales Order Agent** | Autonomous, document processing | Email with attachment; Dataverse status change | Fin & Ops connector + virtual tables (`CustomersV3`, `ReleasedProductsV2`) | Yes — creates sales orders | Reviewer fixes data in a model-driven app | C1 C2 C3 C4 C5 C6 C12 C13 |
| **ERP Compliance Advisor** | Conversational, read-only analysis | User chat | 19 Fin & Ops connector *List items* actions over OData (custom `AuditAgent*` entities + standard ones) | No — read-only by design | User is the auditor | C7 + knowledge |
| **Period Close Agent** | Autonomous + conversational orchestration | Task status change in Financial Period Close workspace; user | ERP MCP, ERP Analytics MCP, Dataverse MCP, Work IQ Mail/SharePoint, 6 agent flows | Yes — task status, journals | Governed handoffs and reminders; humans own postings | C2 C6 C8 C10 C11 C12 C13 C14 |
| **Inventory Fulfillment Agent (v2)** | Conversational with actions | User chat | ERP MCP + Inventory Visibility + Product Search | Yes — reservations, sales / transfer orders | User confirms every write | C8 C10 + skills |
| **User Onboarding Agent** | Autonomous provisioning | HR email | Graph API + F&O OData (role assignment) | Yes — users and roles | Teams adaptive card approvals | C1 C3 C6 C10 C13 |
| **Batch Framework Telemetry Agent** | Conversational diagnostics | User chat | Application Insights (KQL) | Optional remediation | User decides | C9 + knowledge |
| **Payment Recon Agent** | Autonomous reconciliation | File / webhook (Adyen) | Azure + Power Platform + F&O export (`.axpp`) | Yes | Exceptions | C2 C4 C6 + Azure |
| **Store Monitoring Agent** | Ops monitoring | Telemetry / alerts | Azure Monitor, event logs (KQL) | No | Ops team | C9 |

## 2. Deep dive: Sales Order Agent (inside the solution file)

We unpacked `SalesOrderProcessingAutomation_1_0_0_6_managed.zip`. This is what a real agent solution contains — use it as the checklist for your own.

| Solution component | Count | Example | Lesson |
| --- | --- | --- | --- |
| **Bot (agent)** | 1 | `aipod_salesOrderAgent` | One agent, prefix = publisher prefix. |
| **Agent instructions** (`gpt.default`) | 1 | "When told to **validate** a sales order … follow these steps in sequence, you will not re-order or skip steps" | Instructions are **short and verb-driven**: each verb maps to one tool. |
| **Actions (tools)** | 5 | `SOAV3-Parsedocument`, `ValidateCustomer`, `ValidateProducts`, `CreateorderinERP`, `Notify` | Each tool is an **agent flow** with one input (record GUID) and a clear `modelDescription`. |
| **External triggers** | 3 | New email (personal), new email (shared), Dataverse row modified | The agent is **woken by events**, not chat. |
| **Cloud flows** | 11 | `LoadSalesOrderData`, `UpdateProcessingStatustoValid`, `Reprocess…` | Deterministic plumbing stays in flows, outside the LLM. |
| **Environment variables** | 7 | `CompanyCode`, `MailboxToMonitor`, `ReviewerEmailAddress`, `ProcessImagesAttachments` | Everything customer-specific is a variable, not hard-coded. |
| **Connection references** | 4 | Fin & Ops, Dataverse, Copilot Studio, Office 365 | Connections are mapped at import → moves between environments. |
| **Dataverse tables + app** | 3 + 1 | Staging Document, Staging SO Header, Staging SO Lines; *Sales Order Agent App* | Status lifecycle `New → Valid → Processed` or `Manual Review` / `Processing Failed`. |
| **Security role** | 1 | *Sales Order Agent Reviewer* | Reviewers get only what they need. |
| **AI Builder prompt** | 1 | "Extract data from document" → JSON | Changing extracted fields = change prompt + column + load flow + validation flow. |

The tool definition is tiny — the intelligence is in the *description*, the reliability is in the *flow*:

```yaml
kind: TaskDialog
inputs:
  - kind: AutomaticTaskInput
    propertyName: text
    description: You will receive as input the Sales Order ID in GUID format...
modelDescription: "This action validates a customer."
action:
  kind: InvokeFlowTaskAction
  flowId: <agent flow id>
```

## 3. Deep dive: what changed in the newer agents

| Theme | Older pattern (Sales Order, Compliance Advisor) | Newer pattern (Period Close, Inventory Fulfillment v2) | Guidance |
| --- | --- | --- | --- |
| **ERP access** | One connector action per entity, each described by hand | **Dynamics 365 ERP MCP server** — tools discovered at runtime, honours user security | Start with MCP for reads and exploratory actions; keep **deterministic agent flows** for writes that need exact control and audit. |
| **Business rules** | In agent instructions (republish to change) | **Business skills** stored as Dataverse records the business owner edits | Separate *policy* (owner edits) from *mechanics* (developer owns). Local safety rules always win. |
| **Harness / model** | Standard Copilot Studio orchestration | **Microsoft Copilot harness** (formerly "GitHub Copilot harness") with skills and selectable models | Check regional availability and billing before choosing. |
| **Proof of action** | Status set by the flow | Status change **verified by a fresh read from D365** | Never trust "the call returned OK"; re-read. |
| **Testing** | Manual testing with a sample PDF | **Evaluation sets** shipped with the solution | Ship tests with the agent. |
| **Packaging** | Managed solution | Unmanaged + checksum + deployment-settings JSON | Use unmanaged for samples you expect customers to adapt; managed for products. |

## 4. Reuse cheat sheet

| If your new agent needs to… | Copy the pattern from |
| --- | --- |
| Process documents that arrive by email | Sales Order Agent |
| Answer questions over ERP data safely (read-only) | ERP Compliance Advisor |
| Orchestrate a multi-step business process with governance | Period Close Agent |
| Help a user find something and act on it in chat | Inventory Fulfillment Agent |
| Provision access with approvals | User Onboarding Agent |
| Diagnose technical / operational issues | Batch Telemetry, Store Monitoring |
| Reconcile external data against ERP | Payment Recon Agent |
| **Review exceptions in D365 and recommend a decision with approval** | **This repo's [Credit Hold Review Agent](../samples/credit-hold-review-agent/README.md)** |
