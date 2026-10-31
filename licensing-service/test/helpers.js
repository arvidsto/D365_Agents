import { newLicenceKey } from '../src/lib/keys.js';
import { memoryStore } from '../src/lib/store.js';
import { createService } from '../src/lib/service.js';
import { loadCatalogue } from '../src/lib/skills.js';

export const TENANT = '11111111-2222-3333-4444-555555555555';

export async function setup({ now = '2026-06-01T00:00:00Z', licence = {} } = {}) {
  const { licenceId, key, keyHash } = newLicenceKey();
  const record = {
    licenceId,
    customerName: 'Contoso Pte Ltd',
    tenantId: TENANT,
    agents: 'inventory-close-agent,credit-hold-review-agent',
    tier: 'Standard',
    startsAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-12-31T15:59:59Z',
    graceDays: 7,
    status: 'active',
    keyHash,
    ...licence
  };
  const service = createService({
    store: memoryStore([record]),
    catalogue: await loadCatalogue(),
    clock: () => new Date(now)
  });
  return { service, key, licenceId };
}
