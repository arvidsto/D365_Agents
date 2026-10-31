import { readFile } from 'node:fs/promises';

// Licence storage. Holds licence ID, customer company name, tenant ID,
// entitled agents, tier, dates, status and the key hash — no personal data.

export function createLicenceStore(env = process.env) {
  const mode = (env.LICENCE_STORE || 'table').toLowerCase();
  if (mode === 'local') return localStore(env.LOCAL_LICENCE_FILE || './dev/licences.json');
  return tableStore(env);
}

export function memoryStore(licences) {
  const byId = new Map(licences.map((l) => [l.licenceId, l]));
  return { async get(licenceId) { return byId.get(licenceId) || null; } };
}

function localStore(file) {
  return {
    async get(licenceId) {
      const list = JSON.parse(await readFile(file, 'utf8'));
      return list.find((l) => l.licenceId === licenceId) || null;
    }
  };
}

function tableStore(env) {
  let clientPromise;
  async function client() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const { TableClient } = await import('@azure/data-tables');
        const table = env.LICENCE_TABLE_NAME || 'Licences';
        if (env.LICENCE_TABLE_CONNECTION) {
          return TableClient.fromConnectionString(env.LICENCE_TABLE_CONNECTION, table);
        }
        // Managed identity (recommended in Azure): needs LICENCE_TABLE_URL and
        // the "Storage Table Data Reader" role for the function's identity.
        const { DefaultAzureCredential } = await import('@azure/identity');
        return new TableClient(env.LICENCE_TABLE_URL, table, new DefaultAzureCredential());
      })();
    }
    return clientPromise;
  }
  return {
    async get(licenceId) {
      try {
        const entity = await (await client()).getEntity('licence', licenceId);
        return { ...entity, licenceId: entity.rowKey };
      } catch (err) {
        if (err.statusCode === 404) return null;
        throw err;
      }
    }
  };
}
