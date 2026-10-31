# Licensed Skills Service

A small Azure service that **hands out your agents' business skills only while a customer's licence is valid**. All processing of customer data stays in the customer's own Microsoft tenant. This service never receives business data or personal data, which keeps it outside the scope of PDPA (Singapore's personal data law) as far as the design can achieve. Confirm the legal position for your contracts.

It is the "Option C, minimal" design: the customer gets the agent's plumbing (flows, tables, apps, safety rules), and you keep the rulebook that makes the agent useful.

## 1. What crosses the boundary

```mermaid
flowchart LR
    subgraph CUST["Customer tenant — all data processing"]
        AG["Copilot Studio agent<br/>+ agent flows"]
        D365[("D365 / Dataverse<br/>customer data")]
        AG <--> D365
    end
    subgraph YOU["Your Azure tenant — licence + IP only"]
        APIM["API Management<br/>rate limit · quota per licence"]
        FN["Azure Function<br/>licence check · skill delivery"]
        TBL[("Licence table<br/>no personal data")]
        SK["Skills<br/>(deployed with the function)"]
        APIM --> FN --> TBL
        FN --> SK
    end
    AG -- "licence key, tenant ID, agent ID, skill name" --> APIM
    APIM -- "skill text (watermarked) or licensed=false" --> AG
```

| Sent to this service | Returned | Never sent |
| --- | --- | --- |
| Licence key (header), customer tenant ID (optional header), agent ID, skill name | Skill text with a watermark, licence state and notice, or `licensed: false` | Customer, vendor or employee names, account numbers, amounts, items, emails, user identities, D365 data, conversation text |

**What is stored:** licence ID, the customer's company name, tenant ID, licensed agents, tier, start and expiry dates, grace days, offline hours, status and a SHA-256 hash of the key. No contact persons, no emails.

**Customer-specific values** (batch group, inventory accounts, thresholds) are never sent here either. Skills contain placeholders such as `{{env:ica_BatchGroup}}`, and the customer's *Load licensed skill* flow fills them from its own environment variables after the skill arrives. See [section 4](#4-customer-settings-in-skills).

**What is logged:** one line per request with operation, licence ID, agent, skill and outcome. No headers, bodies, keys, tenant IDs or IP addresses ([`src/lib/log.js`](src/lib/log.js)). API Management strips `x-forwarded-for`; don't turn on body logging there.

## 2. Licence lifecycle

| State | When | Skills served? | What the agent does |
| --- | --- | --- | --- |
| `active` | More than 30 days before expiry | ✅ | Works normally |
| `expiring` | 30 days or less before expiry | ✅ + notice | Shows the renewal notice in reports |
| `grace` | Up to 7 days after expiry (per licence) | ✅ + daily warning | Works, warns every run |
| `expired` | After the grace period | ❌ | Starts no new tasks, records `LicenceExpired`, hands work to people |
| `suspended` | You set `status = suspended` (e.g. unpaid) | ❌ | Same as expired |
| `not-started` | Before the start date | ❌ | Same as expired |
| `tenant-mismatch`, `agent-not-licensed` | Key used in another tenant or for another agent | ❌ | Same as expired |

Work that already started is never interrupted: the samples only fetch skills when a **new** task starts, and work handed to batch or waiting for approval continues.

Invalid or missing keys get HTTP 401 with the same message in every case, so nobody can probe which licence IDs exist. All licence-state problems return HTTP 200 with `licensed: false` and a readable `notice`, so agents and flows can stop cleanly instead of failing on a connector error.

## 3. Offline fallback

If your service is unreachable (outage, network problem, throttling), customers keep working for a limited time with skills they already fetched. **You** control the window, not the customer:

1. Every successful response carries `cacheUntil`: now + the licence's `offlineHours` (default `DEFAULT_OFFLINE_HOURS` = 4, capped at `MAX_OFFLINE_HOURS` = 24), and **never later than the end of the grace period**, so a cached copy can't extend a licence.
2. The customer's *Load licensed skill* flow saves each skill it receives in a locked Dataverse table (`<prefix>_skillcache`), together with `cacheUntil`.
3. When the service **can't be reached** (timeout, connection error, HTTP 429 or 5xx), the flow uses the cached copy if `cacheUntil` hasn't passed, and tells the agent `source = cache` with a notice. After `cacheUntil`, the task stops with `LicenceUnavailable`.
4. When the service **answers** `licensed: false` or 401, that is final: the flow deletes the cached copies at once and the task stops. The cache is only for outages, never for overruling a "no".

```mermaid
flowchart TD
    A["Load licensed skill<br/>(customer flow)"] --> B{"Service answered?"}
    B -->|"licensed: true"| C["Save to cache with cacheUntil<br/>source = live"]
    B -->|"licensed: false / 401"| D["Delete cached copies<br/>stop: LicenceExpired"]
    B -->|"timeout · 429 · 5xx"| E{"Cached copy and<br/>now &lt; cacheUntil?"}
    E -->|Yes| F["Use cached copy<br/>source = cache + notice"]
    E -->|No| G["Delete stale copy<br/>stop: LicenceUnavailable"]
    C --> H["Fill {{env:…}} from<br/>environment variables"]
    F --> H
    H --> I{"Any placeholder left?"}
    I -->|Yes| J["stop: SettingMissing"]
    I -->|No| K["Return skill to the agent"]
```

**Trade-off:** while cached, a copy of the skill sits in the customer's Dataverse for up to `offlineHours`. Keep the window short, give the cache table no user access (only the flow's connection can read it), and rely on the watermark. Set `offlineHours` to 0 for a customer if you prefer no offline use.

## 4. Customer settings in skills

Write any value that differs per customer as `{{env:<schema name>}}`:

| Skill | Placeholders |
| --- | --- |
| `InventoryClose_RunInventoryClose` | `ica_BatchGroup`, `ica_BusinessHours` |
| `InventoryClose_InventoryToGLReconciliation` | `ica_InventoryMainAccounts` |
| `CHR_CreditPolicy` | `chr_MaxOverdueDaysForRelease`, `chr_StrategicOpportunityValue`, `chr_AlwaysHumanOrderAmount` |
| `CHR_CreditRecommendationPrompt` | `chr_MaxOverdueDaysForRelease`, `chr_StrategicOpportunityValue` |

The service returns the list in `settings` with every skill, `npm run validate-skills` prints it and rejects any other `{{…}}` form, and the customer flow refuses to return a skill with a placeholder left unfilled (`SettingMissing`). One skill version then serves every customer.

## 5. API

Base URL: `https://<apim-name>.azure-api.net/licensing`. Header `x-licence-key` is required; `x-tenant-id` is optional and checked when sent.

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/v1/agents/{agentId}/licence` | `{ licensed, state, tier, expiresOn, daysLeft, notice, cacheUntil }` |
| GET | `/v1/agents/{agentId}/skills` | `{ licensed, state, notice, cacheUntil, skills: [{ name, version, description, settings }] }`. Descriptions only, never the skill bodies |
| GET | `/v1/agents/{agentId}/skills/{skillName}` | `{ licensed, state, notice, skill, version, settings, cacheUntil, content }` |
| POST | `/mcp/{agentId}` | MCP server (Streamable HTTP, stateless) with tools `licence_status`, `list_skills`, `get_skill`. Simple, but it has **no offline fallback and no placeholder filling**, so the samples use the *Load licensed skill* flow instead. Use MCP only for skills without `{{env:…}}` where you accept no offline use |

The Power Platform custom connector definition is [`connector/apiDefinition.swagger.json`](connector/apiDefinition.swagger.json). It contains both the REST operations (for agent flows) and the MCP operation (`x-ms-agentic-protocol: mcp-streamable-1.0`, for the agent's Tools).

## 6. Folder contents

| Path | Contains |
| --- | --- |
| [`skills/`](skills/) | The licensed content: `manifest.json` plus one Markdown file per skill and agent. **This is your IP.** It is deployed with the function and never shipped to customers |
| [`src/lib/licence.js`](src/lib/licence.js) | Licence rules (states, warning, grace) |
| [`src/lib/service.js`](src/lib/service.js) | Authorization and the three operations, shared by REST and MCP |
| [`src/lib/mcp.js`](src/lib/mcp.js) | Minimal MCP JSON-RPC handler |
| [`src/lib/keys.js`](src/lib/keys.js) | Key format `lic-<id>.<secret>`, hashing, constant-time compare |
| [`src/lib/skills.js`](src/lib/skills.js) | Catalogue loading and watermarking |
| [`src/lib/store.js`](src/lib/store.js) | Licence storage: Azure Table (managed identity) or a local JSON file for development |
| [`src/functions/`](src/functions/) | Azure Functions HTTP triggers |
| [`tools/issue-licence.mjs`](tools/issue-licence.mjs) | Issues a licence and prints the key once |
| [`tools/validate-skills.mjs`](tools/validate-skills.mjs) | Checks the manifest before deployment |
| [`infra/deploy.sh`](infra/deploy.sh) · [`infra/apim-policy.xml`](infra/apim-policy.xml) | Azure CLI deployment (Southeast Asia) and the API Management policy |
| [`test/`](test/) | 32 unit tests (`npm test`) |

## 7. Run locally

```bash
cd licensing-service
npm install
npm test
```

```bash
cp local.settings.example.json local.settings.json
node tools/issue-licence.mjs --customer "Contoso Pte Ltd" --agents credit-hold-review-agent,inventory-close-agent --expires 2027-10-31 --local ./dev/licences.json
```

```bash
func start
```

```bash
curl -H "x-licence-key: <key printed above>" http://localhost:7071/api/v1/agents/credit-hold-review-agent/licence
```

## 8. Deploy to Azure

1. Review and run [`infra/deploy.sh`](infra/deploy.sh). It creates the storage, licence table, Function App on Flex Consumption with a managed identity (Table Data Reader only), and API Management (Consumption).
2. Apply [`infra/apim-policy.xml`](infra/apim-policy.xml) to the `licensing` API.
3. Issue a licence for each customer:

   ```bash
   LICENCE_TABLE_URL=https://<storage>.table.core.windows.net node tools/issue-licence.mjs --customer "Contoso Pte Ltd" --tenant <customer-entra-tenant-id> --agents inventory-close-agent --tier Standard --starts 2026-11-01 --expires 2027-10-31 --offline-hours 4
   ```

4. Send the printed key to the customer's admin through a secure channel. They store it in the agent's **secret** environment variable (backed by Azure Key Vault).

Deployment hasn't been tested against a live Azure subscription from this repo; review each command first.

## 9. Connect an agent (customer side)

1. **Custom connector:** import [`connector/apiDefinition.swagger.json`](connector/apiDefinition.swagger.json) in Power Apps (set `host` to your API Management name), and add it to the agent's solution. Authentication: API key, header `x-licence-key`.
2. **Load licensed skill flow:** build the flow described in each sample (it calls `ListSkills` / `GetSkill`, caches, falls back and fills settings), plus the locked `<prefix>_skillcache` table. Add the flow to the agent as a tool.
3. **Environment variables:** create one for every placeholder the agent's skills use (see [section 4](#4-customer-settings-in-skills)), plus the licence key (secret) and tenant ID.
4. Add the **Licensed Skills** connector to the customer's data policy (DLP) in the same group as Dataverse.

The sample agents show exactly where: [Credit Hold Review Agent](../samples/credit-hold-review-agent/README.md#licensing) and [Inventory Close Agent](../samples/inventory-close-agent/README.md#licensing).

## 10. Operating it

| Task | How |
| --- | --- |
| Renew | Update `expiresAt` on the licence row. The key stays the same |
| Suspend (e.g. unpaid) | Set `status` to `suspended`; set it back to `active` to resume |
| Rotate a key | Issue a new licence, send the new key, then suspend the old one |
| Release a new skill version | Edit the Markdown, bump `version` in `manifest.json`, run `npm run validate-skills` and `npm test`, redeploy. Every customer gets it on the next task. If you add a new `{{env:…}}` placeholder, ship the matching environment variable in the agent's solution first |
| Change a customer's offline window | Set `offlineHours` on their licence row (0 = none, capped at `MAX_OFFLINE_HOURS`) |
| Trace a leaked copy | Search for the watermark line `licensed-content licence=lic-…` |
| Usage per customer | API Management analytics by licence ID (calls per month) for tier limits and overage |

## 11. Limits

- **Transcripts:** skill text appears in conversation transcripts while the agent runs, so an admin could collect it. Watermarks, frequent versions and your contract cover that. No technical design fully prevents it.
- **Availability:** customers ride through outages shorter than their offline window using cached skills; longer outages stop new tasks. Monitor the service and keep your SLA consistent with the window you give.
- **Cost:** each fetched skill is one extra agent tool call in the customer's Copilot credits.
- **Not legal advice:** confirm with counsel that the data boundary meets your PDPA and contract obligations.
