import { app } from '@azure/functions';
import { getService, credentialsFrom } from '../lib/runtime.js';
import { safeLog } from '../lib/log.js';

// REST API used by the Power Platform custom connector and by agent flows.
//   GET /api/v1/agents/{agentId}/licence
//   GET /api/v1/agents/{agentId}/skills
//   GET /api/v1/agents/{agentId}/skills/{skillName}
// Headers: x-licence-key (required), x-tenant-id (optional, checked when sent)

function respond(context, outcome) {
  safeLog(context, outcome.audit);
  return {
    status: outcome.status,
    jsonBody: outcome.body,
    headers: { 'Cache-Control': 'no-store' }
  };
}

app.http('licenceStatus', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'v1/agents/{agentId}/licence',
  handler: async (request, context) => {
    const service = await getService();
    return respond(context, await service.licenceStatus(credentialsFrom(request, request.params.agentId)));
  }
});

app.http('listSkills', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'v1/agents/{agentId}/skills',
  handler: async (request, context) => {
    const service = await getService();
    return respond(context, await service.listSkills(credentialsFrom(request, request.params.agentId)));
  }
});

app.http('getSkill', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'v1/agents/{agentId}/skills/{skillName}',
  handler: async (request, context) => {
    const service = await getService();
    const req = { ...credentialsFrom(request, request.params.agentId), skillName: request.params.skillName };
    return respond(context, await service.getSkill(req));
  }
});
