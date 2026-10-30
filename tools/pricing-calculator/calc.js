/* Pricing engine for D365 agent subscriptions. Used by index.html and by calc.test.js.
 * Microsoft rates are from the Copilot Studio "Billing rates and management" page
 * (checked October 2026). Verify them before quoting: they change.
 */
(function (root) {
  'use strict';

  var RATES = {
    generativeAnswer: 2,          // credits per generative answer
    agentAction: 5,               // credits per agent action (trigger, tool call, MCP call, topic)
    flowActionsPer100: 13,        // credits per 100 agent flow actions
    promptPer1kTokens: { basic: 0.1, standard: 1.5, premium: 10 },
    reasoningPer1kTokens: 10      // premium meter when a reasoning model orchestrates
  };

  var DEFAULT_TIERS = [
    { name: 'Standard',   priceSgd: 800,  includedItems: 500,   includedEntities: 1,    overagePerItemSgd: 1.0 },
    { name: 'Plus',       priceSgd: 1400, includedItems: 2000,  includedEntities: 3,    overagePerItemSgd: 0.6 },
    { name: 'Enterprise', priceSgd: 2400, includedItems: 10000, includedEntities: null, overagePerItemSgd: 0.3 }
  ];

  var PRESETS = {
    'credit-hold': {
      label: 'Credit Hold Review Agent',
      itemLabel: 'credit holds reviewed',
      itemsPerMonth: 300, legalEntities: 1,
      perItem: { agentActions: 14, generativeAnswers: 1, flowActions: 120, promptKTokens: 3, promptTier: 'standard' },
      model: { type: 'standard', kTokensPerAction: 2 },
      scheduled: { runsPerMonth: 440, agentActionsPerRun: 3, flowActionsPerRun: 15 },
      chat: { sessionsPerMonth: 40, agentActionsPerSession: 4, generativeAnswersPerSession: 3, usersHaveM365Copilot: false },
      value: { minutesSavedPerItem: 10, staffCostPerHourSgd: 55 }
    },
    'inventory-close': {
      label: 'Inventory Close Agent',
      itemLabel: 'close tasks run',
      itemsPerMonth: 16, legalEntities: 2,
      perItem: { agentActions: 20, generativeAnswers: 1, flowActions: 60, promptKTokens: 0, promptTier: 'standard' },
      // Runs on the Microsoft Copilot harness, which bills model tokens, tools and the harness.
      // Approximated as token-based; measure it before quoting.
      model: { type: 'harness', kTokensPerAction: 2 },
      scheduled: { runsPerMonth: 22, agentActionsPerRun: 6, flowActionsPerRun: 10 },
      chat: { sessionsPerMonth: 30, agentActionsPerSession: 5, generativeAnswersPerSession: 3, usersHaveM365Copilot: false },
      value: { minutesSavedPerItem: 120, staffCostPerHourSgd: 70 }
    }
  };

  var DEFAULTS = {
    fxUsdToSgd: 1.30,
    creditPriceUsd: 0.01,
    packCredits: 25000,
    packPriceUsd: 200,
    tiers: DEFAULT_TIERS,
    tierChoice: 'auto',
    extraEntitySgd: 250,
    billing: 'monthly',            // 'monthly' | 'annual'
    annualPrepayDiscountPct: 10,
    setup: { days: 6, dayRateSgd: 1500 },
    vendor: { supportHours: 1.5, monitoringHours: 0.5, maintenanceHours: 1, hourlyCostSgd: 90, azureShareSgd: 15, channelFeePct: 0 },
    customersOnAgent: 5,
    gstPct: 9,
    // Orchestration model. 'standard' = no token charge for orchestration.
    // 'reasoning' and 'harness' add 10 credits per 1K tokens, estimated as tokens per agent action.
    model: { type: 'standard', kTokensPerAction: 2 },
    // How wide the low / high cases are around the expected estimate.
    range: { lowFactor: 0.75, highStepFactor: 2, highTokenFactor: 2, measuredBand: 0.15 },
    // Credits measured in a validation run (0 = not measured yet; use the estimate).
    measured: { creditsPerItem: 0, creditsPerScheduledRun: 0, creditsPerChatSession: 0 }
  };

  var CASES = ['low', 'expected', 'high'];

  function n(x) { var v = Number(x); return Number.isFinite(v) ? v : 0; }

  // Credits for orchestration tokens, charged per agent action when the model is token-billed.
  function tokenCredits(agentActions, model, tokenFactor) {
    if (!model || model.type === 'standard') return 0;
    return n(agentActions) * n(model.kTokensPerAction) * (tokenFactor == null ? 1 : tokenFactor) * RATES.reasoningPer1kTokens;
  }

  // f = { step, token } multipliers for the low / high cases (1 / 1 = expected).
  function creditsPerItem(p, model, f) {
    f = f || { step: 1, token: 1 };
    var tier = RATES.promptPer1kTokens[p.promptTier] != null ? p.promptTier : 'standard';
    var actions = n(p.agentActions) * f.step;
    return actions * RATES.agentAction +
      n(p.generativeAnswers) * f.step * RATES.generativeAnswer +
      n(p.flowActions) * f.step * RATES.flowActionsPer100 / 100 +
      n(p.promptKTokens) * f.token * RATES.promptPer1kTokens[tier] +
      tokenCredits(actions, model, f.token);
  }

  function factorsFor(s, c) {
    var r = s.range;
    if (c === 'low') return { step: n(r.lowFactor), token: n(r.lowFactor), band: 1 - n(r.measuredBand) };
    if (c === 'high') return { step: n(r.highStepFactor), token: n(r.highTokenFactor), band: 1 + n(r.measuredBand) };
    return { step: 1, token: 1, band: 1 };
  }

  function microsoftCredits(s, c) {
    var f = factorsFor(s, c || 'expected'), m = s.measured, model = s.model;
    var measuredItem = n(m.creditsPerItem) > 0;
    var item = measuredItem ? n(m.creditsPerItem) * f.band : creditsPerItem(s.perItem, model, f);
    var items = item * n(s.itemsPerMonth);
    var runActions = n(s.scheduled.agentActionsPerRun) * f.step;
    var perRun = n(m.creditsPerScheduledRun) > 0 ? n(m.creditsPerScheduledRun) * f.band :
      runActions * RATES.agentAction + n(s.scheduled.flowActionsPerRun) * f.step * RATES.flowActionsPer100 / 100 + tokenCredits(runActions, model, f.token);
    var scheduled = n(s.scheduled.runsPerMonth) * perRun;
    // Employee chat by users with a Microsoft 365 Copilot licence is not charged
    // (agent authenticated as that user). Autonomous triggers always are.
    var chatActions = n(s.chat.agentActionsPerSession) * f.step;
    var perChat = n(m.creditsPerChatSession) > 0 ? n(m.creditsPerChatSession) * f.band :
      chatActions * RATES.agentAction + n(s.chat.generativeAnswersPerSession) * f.step * RATES.generativeAnswer + tokenCredits(chatActions, model, f.token);
    var chat = s.chat.usersHaveM365Copilot ? 0 : n(s.chat.sessionsPerMonth) * perChat;
    return {
      perItem: item, items: items, perScheduledRun: perRun, scheduled: scheduled, perChat: perChat, chat: chat,
      total: items + scheduled + chat,
      source: measuredItem ? 'measured' : 'estimated'
    };
  }

  function microsoftCost(totalCredits, s) {
    var price = n(s.creditPriceUsd), packCredits = Math.max(1, n(s.packCredits)), packPrice = n(s.packPriceUsd);
    var payg = totalCredits * price;
    var fullPacks = Math.floor(totalCredits / packCredits);
    var mixed = fullPacks * packPrice + (totalCredits - fullPacks * packCredits) * price;
    var allPacks = Math.ceil(totalCredits / packCredits) * packPrice;
    var options = [
      { plan: 'Pay-as-you-go', usd: payg },
      { plan: fullPacks + ' pack' + (fullPacks === 1 ? '' : 's') + ' + pay-as-you-go', usd: mixed, packs: fullPacks },
      { plan: Math.ceil(totalCredits / packCredits) + ' pack' + (Math.ceil(totalCredits / packCredits) === 1 ? '' : 's') + ' only', usd: allPacks, packs: Math.ceil(totalCredits / packCredits) }
    ].filter(function (o) { return o.packs !== 0 || o.plan === 'Pay-as-you-go'; });
    var best = options.reduce(function (a, b) { return b.usd < a.usd - 1e-9 ? b : a; });
    return { paygUsd: payg, bestPlan: best.plan, bestUsd: best.usd, bestSgd: best.usd * n(s.fxUsdToSgd), options: options };
  }

  function tierPrice(t, items, entities, extraEntitySgd) {
    var overItems = Math.max(0, items - n(t.includedItems));
    var overEntities = t.includedEntities == null ? 0 : Math.max(0, entities - n(t.includedEntities));
    var overage = overItems * n(t.overagePerItemSgd);
    var entityAddOn = overEntities * n(extraEntitySgd);
    return { tier: t.name, base: n(t.priceSgd), overItems: overItems, overage: overage, overEntities: overEntities, entityAddOn: entityAddOn, total: n(t.priceSgd) + overage + entityAddOn };
  }

  function subscription(s) {
    var items = n(s.itemsPerMonth), entities = Math.max(1, n(s.legalEntities));
    var quotes = s.tiers.map(function (t) { return tierPrice(t, items, entities, s.extraEntitySgd); });
    var chosen = s.tierChoice === 'auto'
      ? quotes.reduce(function (a, b) { return b.total < a.total ? b : a; })
      : quotes.filter(function (q) { return q.tier === s.tierChoice; })[0] || quotes[0];
    var discountPct = s.billing === 'annual' ? n(s.annualPrepayDiscountPct) : 0;
    var monthly = chosen.total * (1 - discountPct / 100);
    return { quotes: quotes, chosen: chosen, discountPct: discountPct, monthlySgd: monthly };
  }

  function calculate(input) {
    var s = merge(DEFAULTS, input || {});
    var credits = microsoftCredits(s, 'expected');
    var ms = microsoftCost(credits.total, s);
    var sub = subscription(s);
    var valueForRange = n(s.itemsPerMonth) * n(s.value.minutesSavedPerItem) / 60 * n(s.value.staffCostPerHourSgd);
    var range = {};
    CASES.forEach(function (c) {
      var cr = c === 'expected' ? credits : microsoftCredits(s, c);
      var cost = c === 'expected' ? ms : microsoftCost(cr.total, s);
      var monthly = sub.monthlySgd + cost.bestSgd;
      range[c] = { credits: cr.total, microsoftSgd: cost.bestSgd, plan: cost.bestPlan, customerMonthlySgd: monthly, roiMultiple: monthly ? valueForRange / monthly : 0 };
    });
    var v = s.vendor;
    var hours = n(v.supportHours) + n(v.monitoringHours) + n(v.maintenanceHours);
    var vendorCost = hours * n(v.hourlyCostSgd) + n(v.azureShareSgd) + sub.monthlySgd * n(v.channelFeePct) / 100;
    var margin = sub.monthlySgd - vendorCost;
    var setupFee = n(s.setup.days) * n(s.setup.dayRateSgd);
    var customerMonthly = sub.monthlySgd + ms.bestSgd;
    var valueMonthly = n(s.itemsPerMonth) * n(s.value.minutesSavedPerItem) / 60 * n(s.value.staffCostPerHourSgd);
    var net = valueMonthly - customerMonthly;

    var warnings = [];
    if (credits.scheduled > credits.items && credits.scheduled > 1000) {
      warnings.push('Scheduled runs use more Copilot credits than the actual work. Trigger the agent from a D365 business event or Dataverse change, or run the schedule less often.');
    }
    if (sub.monthlySgd > 0 && margin / sub.monthlySgd < 0.5) {
      warnings.push('Your gross margin is below 50%. Reduce support hours per agent, raise the price, or move the customer to a higher tier.');
    }
    if (customerMonthly > 0 && valueMonthly < customerMonthly) {
      warnings.push('The customer pays more per month than the time it saves them. Check the volume and minutes saved before proposing this agent.');
    }
    if (range.high.roiMultiple < 1 && customerMonthly > 0 && valueMonthly >= customerMonthly) {
      warnings.push('In the high case the customer would pay more than the time saved is worth. Measure consumption before quoting, and consider a standard (non-reasoning) model.');
    }
    if (credits.source === 'estimated' && s.model && s.model.type !== 'standard') {
      warnings.push('This agent is billed for model tokens, which are hard to estimate. Treat the range as wide until you have measured a validation run.');
    }
    if (sub.chosen.overItems > 0) {
      warnings.push(sub.chosen.overItems + ' items above the ' + sub.chosen.tier + ' allowance are charged as overage.');
    }

    return {
      settings: s,
      credits: credits,
      microsoft: ms,
      range: range,
      subscription: sub,
      vendor: { hours: hours, costSgd: vendorCost, marginSgd: margin, marginPct: sub.monthlySgd ? margin / sub.monthlySgd * 100 : 0 },
      customer: {
        monthlySgd: customerMonthly,
        valueMonthlySgd: valueMonthly,
        netMonthlySgd: net,
        roiMultiple: customerMonthly ? valueMonthly / customerMonthly : 0,
        setupFeeSgd: setupFee,
        paybackMonths: net > 0 ? setupFee / net : null,
        yearOneSgd: setupFee + 12 * customerMonthly
      },
      portfolio: {
        arrSgd: sub.monthlySgd * 12 * n(s.customersOnAgent),
        yearOneRevenueSgd: (setupFee + 12 * sub.monthlySgd) * n(s.customersOnAgent),
        yearOneMarginSgd: (12 * margin) * n(s.customersOnAgent)
      },
      warnings: warnings
    };
  }

  function merge(base, over) {
    if (Array.isArray(base)) return Array.isArray(over) ? over : base;
    if (base && typeof base === 'object') {
      var out = {};
      Object.keys(base).forEach(function (k) { out[k] = merge(base[k], over ? over[k] : undefined); });
      if (over && typeof over === 'object') Object.keys(over).forEach(function (k) { if (!(k in out)) out[k] = over[k]; });
      return out;
    }
    return over === undefined ? base : over;
  }

  function fromPreset(key, overrides) {
    var p = PRESETS[key];
    return merge(merge(DEFAULTS, p), overrides || {});
  }

  var api = { CASES: CASES, RATES: RATES, DEFAULTS: DEFAULTS, PRESETS: PRESETS, calculate: calculate, fromPreset: fromPreset, creditsPerItem: creditsPerItem, merge: merge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PricingCalc = api;
})(typeof window !== 'undefined' ? window : this);
