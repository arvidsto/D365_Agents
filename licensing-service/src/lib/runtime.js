import { createService } from './service.js';
import { createLicenceStore } from './store.js';
import { loadCatalogue } from './skills.js';

// Built once per function host instance and reused across requests.
let servicePromise;

export function getService() {
  if (!servicePromise) {
    servicePromise = (async () =>
      createService({
        store: createLicenceStore(process.env),
        catalogue: await loadCatalogue(),
        settings: process.env
      }))();
  }
  return servicePromise;
}

export function credentialsFrom(request, agentId) {
  return {
    key: request.headers.get('x-licence-key'),
    tenantId: request.headers.get('x-tenant-id'),
    agentId
  };
}
