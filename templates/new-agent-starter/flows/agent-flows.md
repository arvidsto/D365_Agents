# Agent flows — <Agent name>

## <PREFIX> - <Flow name>
```text
Trigger: When an agent calls the flow   inputs: <workItemId>, ...
1. Get work item; guard on status (idempotency)
2. <Read / validate / write steps>
3. Update work item status
4. Log & notify (child flow)
5. Respond to the agent: <outputs>
```
