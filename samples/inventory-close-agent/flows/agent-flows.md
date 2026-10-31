# Flow specifications — Inventory Close Agent

Agent flows must finish within the Copilot Studio agent-flow time limit (about 100 seconds). Anything longer is handed to batch and finished by the watcher.

**Cost rule:** every agent tool call is an agent action (5 credits, plus model tokens on the Copilot harness); a flow action costs about 0.13. So the deterministic steps of a task (fresh read, gates, routing, skill load, claim, status write, audit) run inside **two** agent flows, *ICA - Start task* and *ICA - Finish task*, and the agent spends its steps only on the business procedure. The building blocks below them are child flows (**Manually trigger a flow** … **Respond to a PowerApp or flow**).

Connection references: `ica_Dataverse`, `ica_Agents`, `ica_Teams`, `ica_FinOps` (watcher reads), `ica_LicensedSkills` (licensing service connector), `ica_Office365` (only if not using Work IQ Mail).

---

## ICA - Start task (agent tool)

One call replaces the old sequence *fresh read → gates → catalogue → skill → Mark task started*.

```text
Trigger: When an agent calls the flow
  inputs: taskId, triggerSource (Chat | HumanStart | CompletionAutostart), chainRun (yes/no)

1. Get row ica_closetask(taskId) + parent ica_closerun
     $select = name, status, blocked, blockedreason, agentenabled, dependson, duedate,
               owner, currentattemptkey (task); locked, company, periodend (run)
   attemptKey = taskId + '-' + formatDateTime(utcNow(), 'yyyyMMddHHmm')
2. Gates, in this order (first failure → step 7 with outcome Skipped or Blocked):
     run.locked = No                                              else Blocked  RunLocked
     status in (NotStarted, Returned), or InProgress when
       triggerSource = HumanStart                                  else Skipped  PendingHuman
     blocked = No                                                 else Blocked  TaskBlocked
     agentenabled = Yes                                           else Skipped  NotAgentEnabled
     every task in dependson is Complete (one List rows, $select = status)
                                                                  else Skipped  WaitingForDependencies
     chainRun = yes → duedate <= today + ica_LeadDays             else Skipped  NotYetDue
3. Route: Run child ICA - Load licensed skill (child) with skillName = '' (catalogue)
     licensed = false → step 7 Blocked LicenceExpired (state unavailable → LicenceUnavailable)
     candidates = catalogue skills where routing != '' and
                  contains(toLower(task.name), routing)
     0 → step 7 Skipped NoProcedure;  2+ → step 7 Blocked AmbiguousRouting
4. Run child ICA - Load licensed skill (child) with the one skillName
     licensed = false → as in 3;  state = setting-missing → step 7 Blocked SettingMissing
5. Unless the HumanStart task is already InProgress:
     Run child ICA - Mark task started (taskId, attemptKey, triggerSource)
     alreadyClaimed → Respond started = false, outcome = AlreadyClaimed (no audit)
     verified = false → step 7 Failed MarkStarted
6. Respond: started = true, attemptKey, company, periodEnd, taskName, owner,
     skillName, skillVersion, skillSource, notice, postingPolicy, executionMode,
     skillContent
7. (not started) Run child ICA - Record task audit (attemptKey with '-skip-', outcome,
     resultCode, errorStage); Respond started = false, outcome, resultCode, owner,
     message, notice
```

The agent then follows `skillContent` and nothing else: the task row, gates and routing are already settled, so it doesn't read the checklist again.

## ICA - Finish task (agent tool)

One call replaces *Mark task completed → Record task audit*.

```text
Trigger: When an agent calls the flow
  inputs: taskId, attemptKey, outcome (Succeeded | NeedsAttention | Blocked | Submitted | Failed),
          resultCode, resultSummary (<= 500 chars, no personal data), batchJobId,
          skillName, skillVersion, skillSource, postingPolicy, triggerSource

1. outcome = Succeeded       → Run child ICA - Mark task completed (targetStatus = Complete)
   outcome = NeedsAttention  → Run child ICA - Mark task completed (targetStatus = InReview)
   outcome = Submitted       → Update ica_closetask.ica_batchjobid = batchJobId (status stays
                               InProgress; the batch completion watcher finishes it)
   outcome = Blocked/Failed  → no status change
2. Run child ICA - Record task audit with every input plus statusBefore, statusAfter,
   statusVerified from step 1
3. Respond: verified, statusAfter, auditId, duplicate
```

---

## ICA - Mark task started (child)

Called by *Start task*; never by the agent.

```text
Trigger: Manually trigger a flow
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

## ICA - Mark task completed (child)

Called by *Finish task* and the batch completion watcher.

```text
Trigger: Manually trigger a flow   inputs: taskId, attemptKey, targetStatus, resultSummary
1. Get row; guard status == InProgress and currentattemptkey == attemptKey
2. Add audit row CompleteClaimed (same alternate-key protection)
3. Update status = targetStatus (Complete | InReview), ica_lastchangedbyagent=Yes,
   ica_resultsummary, ica_completedon (if Complete)
4. Fresh read → Respond verified, statusBefore, statusAfter
```

## ICA - Record task audit (child)

Called by *Start task*, *Finish task* and the watcher.

```text
Trigger: Manually trigger a flow  inputs: (see Finish task)
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

## ICA - Load licensed skill (child)

The only way business skills reach the agent: through *Start task*, or the thin agent-tool wrapper below for notifications and policy questions. It talks to your [licensing service](../../../licensing-service/README.md), keeps a short-lived copy for outages, and fills the customer's settings in. Nothing from the customer's data is sent.

```text
Trigger: Manually trigger a flow
  inputs: skillName (text; empty = return the catalogue of skills instead)

1. Get environment variables: ica_TenantId, ica_BatchGroup, ica_BusinessHours,
   ica_InventoryMainAccounts
2. Set cacheKey = (skillName empty ? '__catalogue__' : skillName)

3. Scope "Call service"  (action timeout 20 s, retry policy: none — fail fast)
     skillName empty → Licensed Skills · ListSkills (agentId = inventory-close-agent,
                                                     x-tenant-id = ica_TenantId)
     otherwise       → Licensed Skills · GetSkill  (agentId, skillName, x-tenant-id)

4. Switch on the outcome of "Call service"   (use "Configure run after")
   a) Succeeded and body.licensed == true                         → LIVE
        Dataverse · Upsert ica_skillcache (key = cacheKey):
          ica_content     = skillName empty ? string(body.skills) : body.content
          ica_version     = body.version, ica_notice = body.notice
          ica_cacheuntil  = body.cacheUntil, ica_fetchedon = utcNow()
        content = (as stored), source = 'live', notice = body.notice
   b) Succeeded and body.licensed == false, or status 401          → FINAL NO
        Dataverse · Delete every ica_skillcache row
        Respond: licensed = false, state = body.state (or 'invalid-key'),
                 notice = body.notice, source = 'live'            (stop)
   c) Status 404                                                  → NOT FOUND
        Respond: licensed = true, found = false                   (stop)
   d) Failed, timed out, 429 or 5xx                               → SERVICE UNREACHABLE
        Dataverse · Get ica_skillcache (key = cacheKey)
        If row exists and utcNow() < ica_cacheuntil:
            content = ica_content, source = 'cache',
            notice  = 'Licensing service unreachable; using the copy fetched at ' +
                      ica_fetchedon + ', valid until ' + ica_cacheuntil + '.'
        Else:
            Delete the row if it exists
            Respond: licensed = false, state = 'unavailable',
                     notice = 'Licensing service unreachable and no valid cached copy.'  (stop)

5. Fill customer settings (skills only; the catalogue has no placeholders):
     content = replace(replace(replace(content,
                 '{{env:ica_BatchGroup}}',            ica_BatchGroup),
                 '{{env:ica_BusinessHours}}',         ica_BusinessHours),
                 '{{env:ica_InventoryMainAccounts}}', ica_InventoryMainAccounts)
6. If content contains '{{env:' → Respond: licensed = true, state = 'setting-missing',
     missingSettings = the names still in the text, content = ''      (stop)

7. Respond:
     licensed = true, found = true, state, source ('live' | 'cache'), version,
     notice, content (skill text, or the catalogue JSON when skillName was empty)
```

**Rules that keep it honest**
- The cache is only used when the service **can't answer**. A real "not licensed" from the service deletes the cache immediately.
- `cacheUntil` comes from the service and never goes past the licence's grace period, so the customer can't stretch the window.
- Only this flow's connection can read `ica_skillcache`. No user security role includes it.
- When you add a placeholder to a skill, add the environment variable and one more `replace()` in step 5. Step 6 stops the task until you do.

## ICA - Load licensed skill (agent tool)

```text
Trigger: When an agent calls the flow   input: skillName
1. Run child flow ICA - Load licensed skill (child) with skillName
2. Respond to the agent with all its outputs
```

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
   b. Ended + closing record Ended → child ICA - Mark task completed (attemptKey = task.currentattemptkey)
      → child ICA - Record task audit (Succeeded, BatchCompleted, triggerSource = BatchWatcher)
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
