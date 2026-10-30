# Flow specifications — Inventory Close Agent

Agent flows must finish within the Copilot Studio agent-flow time limit (about 100 seconds). Anything longer is handed to batch and finished by the watcher.

Connection references: `ica_Dataverse`, `ica_Agents`, `ica_Teams`, `ica_FinOps` (watcher reads), `ica_Office365` (only if not using Work IQ Mail).

---

## ICA - Mark task started

```text
Trigger: When an agent calls the flow
  inputs: taskId, attemptKey, triggerSource

1. Get row ica_closetask(taskId)  (+ parent ica_closerun)
2. Guards (server-side, never trust the agent):
     run.ica_locked = No
     task.ica_agentenabled = Yes
     task.ica_status in (NotStarted, Returned)
     task.ica_blocked = No
   Any failure → Respond verified=false, message=<gate>
3. List ica_closetaskaudit where ica_taskid = taskId and ica_resultcode = 'StartClaimed'
     and ica_attemptkey = attemptKey
   Exists → Respond alreadyClaimed=true
4. Add row ica_closetaskaudit: StartClaimed, attemptKey, taskId, triggerSource
   (alternate key on ica_attemptkey + ica_resultcode makes a race fail safely → alreadyClaimed=true)
5. Update ica_closetask: ica_status=InProgress, ica_lastchangedbyagent=Yes,
     ica_startedon=utcNow(), ica_currentattemptkey=attemptKey
6. Delay 2 s; Get row again (fresh read)
7. Respond verified = (status == InProgress and currentattemptkey == attemptKey),
     statusBefore, statusAfter
```

## ICA - Mark task completed

```text
Trigger: When an agent calls the flow   inputs: taskId, attemptKey, targetStatus, resultSummary
1. Get row; guard status == InProgress and currentattemptkey == attemptKey
2. Add audit row CompleteClaimed (same alternate-key protection)
3. Update status = targetStatus (Complete | InReview), ica_lastchangedbyagent=Yes,
   ica_resultsummary, ica_completedon (if Complete)
4. Fresh read → Respond verified, statusBefore, statusAfter
```

## ICA - Record task audit

```text
Trigger: When an agent calls the flow  inputs: (see tools.md)
1. List ica_closetaskaudit where ica_attemptkey = attemptKey and ica_rowtype = Terminal
   Exists → Respond duplicate=true, auditId
2. Add row (rowtype = Terminal, all inputs, ica_recordedon = utcNow())
3. Respond duplicate=false, auditId
No update or delete actions exist in this flow.
```

## ICA - Request approval

```text
Trigger: When an agent calls the flow  inputs: taskId, attemptKey, summary
1. Get task + close run; approver = run.ica_controller
2. Find ica_approval where taskId and attemptKey → if decided, Respond that decision
3. Add ica_approval (Pending)
4. Teams: Post adaptive card and wait for a response (timeout = ica_ApprovalWaitMinutes, max 1 day)
   Card: company, period end, last closing date, readiness table, Approve / Reject + comment
5. On response → update ica_approval (Approved/Rejected, approver, comment, decidedon)
   On timeout   → Respond Pending (the approval stays open; the controller can still answer
                  from the review app, which re-triggers via HumanStart)
6. Respond decision, approver, approvalId
```

> If the agent-flow time limit is shorter than your wait, split the flow: post the card from a cloud flow, return `Pending`, and let the controller's response update `ica_approval` and set the task to In progress (HumanStart path).

## ICA - Wait
`Delay` for min(seconds, 60) → Respond ok.

---

## ICA - Run human-started task (event)

```text
Trigger: Dataverse — When a row is modified: ica_closetask, columns: ica_status
Conditions: status == InProgress AND ica_lastchangedbyagent == No
            AND ica_agentenabled == Yes AND name has no standalone #autostart
Action: Agents connector — Execute agent "Inventory Close Agent"
        message: "HumanStart task <taskId> in close run <runId>"
Then: update ica_lastchangedbyagent = No is NOT done here (humans own the next change)
```

## ICA - Auto-run next on completion (event)

```text
Trigger: When a row is modified: ica_closetask, columns: ica_status
Condition: status == Complete
Action: Execute agent: "CompletionAutostart after task <taskId> in close run <runId>"
```

Both event flows ignore changes where nothing relevant changed, and `run-close-chain` re-reads before acting, so a duplicate invocation is harmless.

## ICA - Batch completion watcher (scheduled)

```text
Recurrence: every 15 minutes
1. List ica_closetask where status == InProgress and ica_batchjobid != null
2. For each:
   a. Fin & Ops: read batch job status for ica_batchjobid (and the inventory closing record
      for the run's period end date)
   b. Ended + closing record Ended → ICA - Mark task completed (attemptKey = task.currentattemptkey)
      → ICA - Record task audit (Succeeded, BatchCompleted, triggerSource = BatchWatcher)
   c. Error → Mark task completed with targetStatus = InReview; Record task audit (Failed,
      BatchError); invoke agent "BlockedHandoff for task <taskId>"
   d. Still executing → nothing
```

## ICA - Daily reminder sweep (scheduled)

```text
Recurrence: working days 08:05 company time
For each active, unlocked close run: Execute agent "Reminder sweep for close run <runId>"
(the agent sends DueReminder to owners of tasks due today or tomorrow and Escalation for tasks
 overdue more than ica_EscalationDays)
```
