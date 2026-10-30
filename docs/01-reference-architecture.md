# 01 — Reference Architecture for Dynamics 365 Agents

This is the architecture that **every** agent in this repo, and every agent in the Microsoft FastTrack AI ERP templates, fits into. Learn it once and you can explain any agent to a customer with the same picture.

## 1. The simple explanation (for business audiences)

Think of an agent as a **new team member**:

| Team member analogy | Agent building block | Where it lives |
| --- | --- | --- |
| Their **job description** | Agent instructions and skills | Copilot Studio |
| What makes them **start working** (an email arrives, a manager asks, a status changes) | Triggers | Copilot Studio / Power Automate / D365 business events |
| The **systems they log into** | Tools: MCP servers, connectors, agent flows | Power Platform connectors, D365 MCP servers |
| The **rule books** they read | Knowledge | SharePoint, Dataverse, files |
| Their **notebook / work log** | Staging, audit and configuration tables | Dataverse |
| Their **manager's sign-off** | Human in the loop: approvals, review apps | Teams, Outlook, model-driven app |
| Their **permissions** | Identity and security roles | Entra ID, D365 security roles, Dataverse roles |
| Their **performance review** | Analytics, telemetry, evaluation tests | Copilot Studio analytics, Application Insights |

## 2. Layered reference architecture

```mermaid
flowchart TB
    subgraph L1["1 · Channels & triggers — how work arrives"]
        direction LR
        C1["Teams / M365 Copilot chat"]
        C2["Outlook mailbox<br/>(shared or personal)"]
        C3["D365 business events<br/>& data events"]
        C4["Dataverse row change"]
        C5["Schedule (recurrence)"]
        C6["D365 in-app<br/>(Immersive Home, sidecar)"]
    end

    subgraph L2["2 · Agent layer — Copilot Studio"]
        direction LR
        AG["Agent<br/>instructions · orchestration · model"]
        SK["Skills / topics<br/>(business policy)"]
        KN["Knowledge<br/>SharePoint · files · Dataverse"]
        GR["Guardrails<br/>scope · confirmation rules"]
    end

    subgraph L3["3 · Tool layer — how the agent acts"]
        direction LR
        T1["MCP servers<br/>D365 ERP · Business Central · Dataverse · Work IQ"]
        T2["Agent flows<br/>(deterministic steps)"]
        T3["Connectors<br/>Fin & Ops · BC · Dataverse · Office 365 · custom"]
        T4["AI prompts<br/>extraction · classification · drafting"]
        T5["Human review actions<br/>approvals · request for information"]
    end

    subgraph L4["4 · Data & systems of record"]
        direction LR
        D1[("D365 Finance &<br/>Supply Chain")]
        D2[("Business Central")]
        D3[("Dataverse<br/>CE apps: Sales · Service · Field Service")]
        D4[("Agent tables in Dataverse<br/>staging · audit · config")]
        D5["External systems<br/>banks · carriers · portals"]
    end

    subgraph L5["5 · Platform services — cross-cutting"]
        direction LR
        P1["Entra ID & security roles"]
        P2["Data policies (DLP)<br/>Managed Environments"]
        P3["Solutions & pipelines (ALM)<br/>env variables · connection refs"]
        P4["Monitoring<br/>analytics · App Insights · audit"]
        P5["Billing<br/>Copilot credits"]
    end

    L1 --> L2 --> L3 --> L4
    L5 -.governs.-> L2
    L5 -.governs.-> L3
```

### What each layer is responsible for

| Layer | Responsibility | Design rule of thumb |
| --- | --- | --- |
| **1. Channels & triggers** | Start the agent: a person asks, or an event happens. | Autonomous agents need an **event** trigger. Conversational agents need a **channel**. Many good agents have both. |
| **2. Agent** | Decide *what* to do next, in natural language. | Put **business policy** in skills / instructions that a business owner can read. Keep **mechanics** (how to write to ERP) in tools. |
| **3. Tools** | Do the work: read, write, calculate, ask a human. | Use **agent flows** where the steps must always run the same way (posting, status changes). Use **MCP** where the agent should discover and choose. |
| **4. Data** | Systems of record plus the agent's own tables. | The ERP stays the system of record. Dataverse holds the agent's **staging, audit and configuration**, never a second copy of the ledger. |
| **5. Platform** | Security, ALM, monitoring, cost. | Every agent ships as a **solution** with environment variables and connection references, so it can move dev → test → prod. |

## 3. Runtime sequence — the "golden path"

All the FastTrack agents follow this same shape. The Sales Order Agent is shown in brackets as an example.

```mermaid
sequenceDiagram
    autonumber
    participant Src as Trigger source<br/>[mailbox]
    participant Flow as Trigger flow
    participant DV as Dataverse<br/>staging / audit
    participant Agent as Copilot Studio agent
    participant Tools as Tools<br/>(agent flows / MCP)
    participant ERP as Dynamics 365
    participant Human as Reviewer

    Src->>Flow: Event [email with PDF]
    Flow->>DV: Create staging record (status = New)
    Flow->>Agent: Wake agent with record ID
    Agent->>Tools: Extract / gather context [parse document]
    Tools->>ERP: Read master data [customer, products]
    Tools->>DV: Save results, set status
    alt Confident & within policy
        Agent->>Tools: Act [create sales order]
        Tools->>ERP: Write via OData / MCP / action
        Tools->>DV: Status = Processed + audit row
    else Exception or above threshold
        Agent->>Human: Ask for review / approval
        Human-->>DV: Correct data / approve
        DV-->>Agent: Status change re-triggers agent
    end
    Agent->>Human: Notify outcome
```

**Why a staging table + status column?** It makes the agent **restartable** (a status change re-triggers the next step), **observable** (a model-driven app shows every item), and **auditable** (every decision is a row). This is the single most reusable idea in the FastTrack samples.

## 4. How each Dynamics 365 application plugs in

```mermaid
flowchart LR
    AG["Copilot Studio agent"]

    subgraph FO["D365 Finance & Supply Chain (F&O)"]
        FO1["Dynamics 365 ERP MCP<br/>data · form · action tools"]
        FO2["Fin & Ops connector<br/>OData entities · actions"]
        FO3["Virtual tables in Dataverse<br/>(mserp_*)"]
        FO4["Business events / data events"]
        FO5["Custom X++ services /<br/>AI tool actions"]
    end

    subgraph BC["Business Central"]
        BC1["Business Central MCP server<br/>API pages · queries"]
        BC2["Business Central connector"]
        BC3["AL custom APIs / codeunits"]
        BC4["BC webhooks / business events"]
    end

    subgraph CE["CE apps on Dataverse<br/>Sales · Customer Service · Field Service"]
        CE1["Dataverse MCP server"]
        CE2["Dataverse connector"]
        CE3["Dataverse triggers<br/>row added / modified"]
        CE4["Custom APIs / plug-ins"]
    end

    AG --> FO1 & FO2 & FO3
    AG --> BC1 & BC2
    AG --> CE1 & CE2
    FO4 -. trigger .-> AG
    BC4 -. trigger .-> AG
    CE3 -. trigger .-> AG
    FO5 -. exposed as .-> FO1
    BC3 -. exposed as .-> BC1
    CE4 -. exposed as .-> CE1
```

| Application | Read data | Write / run business logic | Trigger the agent | Notes |
| --- | --- | --- | --- | --- |
| **Finance & Supply Chain** | ERP MCP data tools; Fin & Ops connector (OData); virtual tables | ERP MCP data / form / action tools; connector *Create / Execute action*; custom X++ service | Business events (Fin & Ops connector or Dataverse *When an action is performed*); data events on virtual tables; schedule | Requires Power Platform integration for virtual tables, business events in Dataverse and the MCP server. Security = the user's / connection's F&O roles. |
| **Business Central** | BC MCP server (read-only by default); BC connector | BC MCP with configured create/modify/action permissions; AL custom APIs | BC connector triggers / webhooks; schedule | MCP configuration controls which API pages and actions are exposed. |
| **Sales / Customer Service / Field Service** | Dataverse MCP; Dataverse connector; Dataverse knowledge | Dataverse MCP `create_record` / `update_record`; Dataverse connector; Custom APIs | Dataverse *row added / modified / deleted*; *When an action is performed* | Native — the data already lives in Dataverse. Many first-party agents exist here; check before building. |
| **Any Power Platform solution** | Dataverse tables, SharePoint, any connector | Agent flows, connectors, custom connectors | Any Power Automate trigger | Same pattern; D365 is just one system behind the tools. |

See [03 — Integration patterns](03-integration-patterns.md) for the decision tree on choosing between these.

## 5. Reusable component catalogue

These are the "Lego bricks". Each FastTrack agent and the sample in this repo is a combination of them.

| # | Component | Pattern it solves | Used by (FastTrack) |
| --- | --- | --- | --- |
| C1 | **Mailbox trigger flow** → staging record | Unstructured requests arrive by email | Sales Order, User Onboarding |
| C2 | **Event trigger** (business event / Dataverse row change) | React to something that happened in D365 | Period Close, Sales Order (status change) |
| C3 | **AI prompt for document extraction** → JSON | Turn a PDF / email into structured data | Sales Order |
| C4 | **Staging tables with status lifecycle** | Restartable, observable processing | Sales Order |
| C5 | **Validation agent flows** (match to master data) | Make sure data is real before writing | Sales Order |
| C6 | **Write agent flow** (create / update in ERP) | Deterministic, audited writes | Sales Order, Period Close |
| C7 | **Read-only OData tool set** | Q&A and analysis over ERP data | ERP Compliance Advisor |
| C8 | **ERP MCP server** | Broad, discoverable read/write with user security | Inventory Fulfillment v2, Period Close |
| C9 | **Telemetry query tool** (KQL on App Insights) | Operations / diagnostics agents | Batch Telemetry, Store Monitoring |
| C10 | **Human approval** (Teams adaptive card / Outlook / RFI) | Stop before risky actions | User Onboarding, Period Close |
| C11 | **Business skills as Dataverse records** | Business owner changes policy without republishing | Period Close |
| C12 | **Audit table + model-driven review app** | Compliance evidence of every agent action | Period Close, Sales Order |
| C13 | **Notification flow** (email / Teams) | Tell people what happened | Sales Order, Period Close |
| C14 | **Evaluation test sets** | Prove the agent behaves before release | Period Close |
