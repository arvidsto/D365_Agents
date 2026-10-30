// Issues a licence and prints the key ONCE. Only the key's hash is stored.
//
//   node tools/issue-licence.mjs --customer "Contoso Pte Ltd" --tenant <entra-tenant-id> \
//     --agents inventory-close-agent,credit-hold-review-agent --tier Standard \
//     --starts 2026-11-01 --expires 2027-10-31 [--grace 7] [--local ./dev/licences.json]
//
// Without --local it writes to Azure Table Storage using LICENCE_TABLE_CONNECTION
// (or LICENCE_TABLE_URL + your Azure sign-in) and LICENCE_TABLE_NAME.
// Store only the customer's company name — no contact persons or emails.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { newLicenceKey } from '../src/lib/keys.js';

const { values: a } = parseArgs({
  options: {
    customer: { type: 'string' },
    tenant: { type: 'string' },
    agents: { type: 'string' },
    tier: { type: 'string', default: 'Standard' },
    starts: { type: 'string' },
    expires: { type: 'string' },
    grace: { type: 'string', default: '7' },
    local: { type: 'string' }
  }
});
for (const required of ['customer', 'agents', 'expires']) {
  if (!a[required]) throw new Error(`--${required} is required`);
}

const { licenceId, key, keyHash } = newLicenceKey();
const licence = {
  licenceId,
  customerName: a.customer,
  tenantId: a.tenant || '',
  agents: a.agents,
  tier: a.tier,
  startsAt: a.starts ? new Date(`${a.starts}T00:00:00+08:00`).toISOString() : new Date().toISOString(),
  // Valid until the end of the expiry day, Singapore time.
  expiresAt: new Date(`${a.expires}T23:59:59+08:00`).toISOString(),
  graceDays: Number(a.grace),
  status: 'active',
  keyHash
};

if (a.local) {
  const file = path.resolve(a.local);
  await mkdir(path.dirname(file), { recursive: true });
  let list = [];
  try { list = JSON.parse(await readFile(file, 'utf8')); } catch { /* new file */ }
  list.push(licence);
  await writeFile(file, JSON.stringify(list, null, 2));
} else {
  const { TableClient } = await import('@azure/data-tables');
  const table = process.env.LICENCE_TABLE_NAME || 'Licences';
  let client;
  if (process.env.LICENCE_TABLE_CONNECTION) {
    client = TableClient.fromConnectionString(process.env.LICENCE_TABLE_CONNECTION, table);
  } else {
    const { DefaultAzureCredential } = await import('@azure/identity');
    client = new TableClient(process.env.LICENCE_TABLE_URL, table, new DefaultAzureCredential());
  }
  const { licenceId: rowKey, ...rest } = licence;
  await client.createEntity({ partitionKey: 'licence', rowKey, ...rest });
}

console.log(`Licence ${licenceId} issued for ${licence.customerName} (${licence.agents}), valid to ${licence.expiresAt}.`);
console.log('Licence key (shown once — send it to the customer admin through a secure channel):');
console.log(key);
