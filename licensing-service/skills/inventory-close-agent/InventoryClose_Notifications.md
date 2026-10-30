---
name: InventoryClose_Notifications
description: Supporting policy for send-close-notification - wording and tone of each email type in the inventory close. Not a task procedure; never matches a task.
---

# Notification wording

> **Owned by the cost controller.** Edit wording freely; recipients and sending rules are fixed by the agent.

## Classification
- `procedureClass`: `supporting-policy`

| Type | Opening sentence | Call to action |
|---|---|---|
| HumanStartHandoff | "<Task> is ready for you in the <Period> inventory close." | "Set it to In progress if you want the agent to run it, or complete it yourself." |
| ManualHandoff | "<Task> is the next manual step in the <Period> inventory close." | "Open the task and complete it." |
| ReviewHandoff | "The agent ran <Task> and found items that need your review." | "Review the table, act in D365, then complete or return the task." |
| BlockedHandoff | "The agent could not complete <Task>." | "See the reason below; fix it and return the task." |
| ApprovalRequested | "The <Period> inventory close is ready to run for <Company>." | "Approve or reject in Teams." |
| DueReminder | "<Task> is due on <Due date>." | "Please complete or update the task." |
| Escalation | "<Task> is <n> days overdue." | "Please help unblock this task." |
| CloseReport | "Inventory close status for <Company>, <Period>." | — |

Tone: plain, short, no blame. Sign off: "— Inventory Close Agent (automated)".
