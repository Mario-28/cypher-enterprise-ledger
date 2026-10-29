import { MID, SCHEMA, DEFAULT_STATE, migrateState, getState, saveState, clamp, uid, pick, mood, avgMorale, forecast, EVENT_TABLE, eventImpact, TASKS, taskTarget,
  ACHIEVEMENTS, unlockAchievements, FLOOR_TYPES, floorTypeChoices, placeTotals, makeFloor, syncFloors, levelsOf,
  GOODS, MODES, goodChoices, modeChoices, makeRoute, routeCalc, updateMarket, routeCap, cargoCap,
  CONTRACT_TYPES, specChoices, contractTypeChoices, makeContract, genOffers, contractTN, contractCap, crewBonus, repTier, offerCount,
  contractPenalty, busyCrew,
  SEATS, SEAT_DEFS, PERK_COSTS, salaryPer, DORMANT_BELOW, execOf, seatActive, perkTier, perkFx, perkPoints, threatTN,
  OP_KINDS, RIVAL_ACTIONS, opKindChoices, INTEL_PLAN, GUARD_VALUE, makeRival, rivalDrag, defenseRating, opCalc,
  DEAL_KINDS, premiumChoices, dealCalc, makeDivision, divisionCalc,
  BRANCH_FOCI, BRANCH_STANCES, BRANCH_RATES, branchFocusChoices, HIRE_COST, DIVIDEND_FLOOR, branchTN, branchTierCap, dividendGold, makeBranch, branchCalc, branchOp, branchMonth } from "./data.mjs";
import { dbg, runSelfTest, reportHtml } from "./diag.mjs";
const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class LedgerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;
  tab = "overview";
  _animTab = null;

  static DEFAULT_OPTIONS = {
    id: "cel-ledger", classes: ["cel-app"], tag: "div",
    window: { title: "CEL.Title", icon: "fa-solid fa-gears", resizable: true },
    position: { width: 1200, height: 860 },
    actions: {
      celShowTab: LedgerApp.onShowTab, celCloseMonth: LedgerApp.onCloseMonth,
      celRemove: LedgerApp.onRemove, celOpenScene: LedgerApp.onOpenScene,
      celRollEvent: LedgerApp.onRollEvent, celCustomEvent: LedgerApp.onCustomEvent,
      celResolveEvent: LedgerApp.onResolveEvent, celDoTask: LedgerApp.onDoTask,
      celAddFloor: LedgerApp.onAddFloor, celSyncFloors: LedgerApp.onSyncFloors,
      celRemoveFloor: LedgerApp.onRemoveFloor, celVisitFloor: LedgerApp.onVisitFloor,
      celAddRoute: LedgerApp.onAddRoute,
      celAcceptContract: LedgerApp.onAcceptContract, celUnassign: LedgerApp.onUnassign,
      celRollOffer: LedgerApp.onRollOffer, celCustomContract: LedgerApp.onCustomContract,
      celBuyPerk: LedgerApp.onBuyPerk, celRespec: LedgerApp.onRespec,
      celAddRival: LedgerApp.onAddRival, celAddOp: LedgerApp.onAddOp, celOpUnassign: LedgerApp.onOpUnassign, celUnguard: LedgerApp.onUnguard,
      celDeal: LedgerApp.onDeal, celDivest: LedgerApp.onDivest,
      celSelfTest: LedgerApp.onSelfTest, celExport: LedgerApp.onExport, celImport: LedgerApp.onImport, celReset: LedgerApp.onReset,
      celAddBranch: LedgerApp.onAddBranch, celBranchStance: LedgerApp.onBranchStance, celBranchHire: LedgerApp.onBranchHire,
      celBranchUpgrade: LedgerApp.onBranchUpgrade, celBranchDividend: LedgerApp.onBranchDividend
    }
  };
  static PARTS = { main: { template: `modules/${MID}/templates/ledger.hbs` } };

  static open() { LedgerApp.instance ??= new LedgerApp(); LedgerApp.instance.render({ force: true }); }
  static toggle() { const a = LedgerApp.instance; if (a?.rendered) a.close(); else LedgerApp.open(); }

  async _prepareContext() {
    return LedgerApp.buildContext(getState(), this.tab, { isGM: game.user.isGM, userId: game.user.id });
  }

  // Four dial gauges for the Counting House. Every value is clamped so a needle can never leave the dial.
  static makeGauges(f, avg) {
    const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0), arcLen = Math.PI * 40;
    const income = num(f.income), costs = num(f.costs), profit = num(f.profit), morale = clamp(num(avg), 0, 100);
    const scale = Math.max(500, Math.ceil(Math.max(Math.abs(income), Math.abs(costs)) * 1.25 / 100) * 100);
    const M = Math.max(200, Math.ceil(Math.abs(profit) * 1.5 / 100) * 100);
    const mk = (key, label, value, frac, cls, sub) => {
      const p = clamp(Number.isFinite(frac) ? frac : 0, 0, 1);
      return { key, label, value: Math.round(value), cls, sub, pct: Math.round(p * 100), angle: Math.round(-90 + p * 180), arc: +(p * arcLen).toFixed(1) };
    };
    return [
      mk("income", "INCOME", income, income / scale, "ok", `scale ${scale}`),
      mk("costs", "COSTS", costs, costs / scale, "bad", `scale ${scale}`),
      mk("profit", "PROFIT", profit, (profit + M) / (2 * M), profit >= 0 ? "ok" : "bad", profit >= 0 ? "in the black" : "in the red"),
      mk("morale", "MORALE", morale, morale / 100, morale >= 60 ? "ok" : (morale >= 35 ? "warn" : "bad"), "crew average")
    ];
  }

  // Pure function of the state, so the self-test can render every tab without touching the world.
  static buildContext(s, tab, { isGM, userId }) {
    const f = forecast(s), fx = perkFx(s), pp = perkPoints(s);
    const staff = s.staff.map(p => ({ ...p, mood: mood(p.happiness) }));
    const avg = avgMorale(s);
    let banner = "";
    try { banner = game.settings.get(MID, "banner") || ""; } catch (e) { /* not registered yet */ }
    const events = s.events.map(e => {
      const impact = eventImpact(e, s);
      return { ...e, impact, internal: e.kind === "internal", target: threatTN(e, s),
        threat: impact < 0 || e.mor < 0,
        pips: Array.from({ length: 10 }, (_, i) => ({ on: i < e.level })),
        duration: e.months > 0 ? `${e.months} month(s) left` : "Until resolved" };
    });
    const places = s.places.map(p => {
      const floors = [...(p.floors ?? [])].sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
        .map((fl, i, arr) => ({ ...fl, linked: !!fl.levelId, no: arr.length - i, morText: FLOOR_TYPES[fl.type]?.mor ? `+${FLOOR_TYPES[fl.type].mor} morale` : "" }));
      return { ...p, floors, hasFloors: floors.length > 0, totals: placeTotals(p) };
    });
    const routes = s.routes.map(r => {
      const c = routeCalc(r, s);
      return { ...r, ...c, icon: MODES[r.mode]?.icon ?? "🚜", oddsPct: Math.round(c.pSucc * 100),
        status: c.blocked ? "BLOCKED BY AMBUSH" : (c.running ? "RUNNING" : "PAUSED"),
        stateCls: c.blocked ? "blocked" : (c.running ? "run" : "idle"), netPos: c.expectedNet >= 0 };
    });
    const market = Object.entries(GOODS).map(([k, g]) => {
      const m = s.market?.[k] ?? { pct: 0, last: 0 };
      return { key: k, label: g.label, pct: m.pct, arrow: m.last > 0 ? "▲" : (m.last < 0 ? "▼" : "▬"),
        cls: m.pct > 0 ? "up" : (m.pct < 0 ? "down" : "flat"), risk: g.risk };
    });
    const busy = busyCrew(s);
    const contracts = s.contracts.map(c => {
      const t = CONTRACT_TYPES[c.type] ?? CONTRACT_TYPES.craft;
      const crewList = c.crew.map(id => s.staff.find(p => p.id === id)).filter(Boolean)
        .map(p => ({ id: p.id, name: p.name, img: p.img, bonus: crewBonus(p, c, s), spec: !!p.spec && p.spec === c.type }));
      const free = s.staff.filter(p => !busy.has(p.id) && !c.crew.includes(p.id));
      return { ...c, typeLabel: t.label, typeIcon: t.icon, tn: contractTN(c), penalty: contractPenalty(c),
        isActive: c.status === "active", isOffered: c.status === "offered",
        pips: Array.from({ length: c.required }, (_, i) => ({ on: i < c.progress })),
        crewList, canAssign: c.status === "active" && c.crew.length < 3 && free.length > 0,
        assignChoices: Object.fromEntries([["", "＋ assign crew…"], ...free.map(p => [p.id, p.name])]),
        done: c.progress >= c.required };
    });
    const trophies = ACHIEVEMENTS.map(a => ({ id: a.id, icon: a.icon, title: a.title, desc: a.desc,
      got: !!s.achievements[a.id], month: s.achievements[a.id]?.month }));
    const active = contracts.filter(c => c.isActive);
    const takenBy = id => SEATS.find(k => s.exec[k] === id);
    const seats = SEATS.map(k => {
      const d = SEAT_DEFS[k], e = execOf(s, k), owned = s.perks[k] ?? 0, on = seatActive(s, k);
      return {
        key: k, title: d.title, icon: d.icon, tag: d.tag, vacant: !e, dormant: !!e && !on, owned,
        exec: e ? { name: e.name, img: e.img, happiness: e.happiness, mood: mood(e.happiness) } : null,
        current: s.exec[k] || "",
        assignChoices: Object.fromEntries([["", "— vacant —"], ...s.staff.filter(p => !takenBy(p.id) || takenBy(p.id) === k).map(p => [p.id, p.name])]),
        tiers: d.perks.map((p, i) => ({ tier: i + 1, name: p.name, desc: p.desc, cost: PERK_COSTS[i],
          isOwned: i < owned, buyable: i === owned && pp.left >= PERK_COSTS[i], poor: i === owned && pp.left < PERK_COSTS[i],
          locked: i > owned, live: i < owned && on }))
      };
    });
    const bonuses = SEATS.flatMap(k => SEAT_DEFS[k].perks.slice(0, perkTier(s, k)).map(p => `${SEAT_DEFS[k].icon} ${p.name}: ${p.desc}`));

    const def = defenseRating(s), freeCrew = s.staff.filter(p => !busy.has(p.id));
    const rivals = s.rivals.map(r => {
      const known = r.intel >= INTEL_PLAN;
      const ops = s.ops.filter(o => o.rivalId === r.id).map(o => {
        const c = opCalc(o, s);
        return { id: o.id, kind: o.kind, active: o.active, icon: c.kind.icon, desc: c.kind.desc, cost: c.cost, tn: c.tn, bonus: c.bonus,
          wary: c.wary, oddsPct: Math.round(c.pOk * 100), running: c.running, noCrew: c.crew.length === 0,
          crewList: c.crew.map(p => ({ id: p.id, name: p.name })),
          canAssign: c.crew.length < 2 && freeCrew.length > 0,
          assignChoices: Object.fromEntries([["", "＋ assign agent…"], ...freeCrew.map(p => [p.id, p.name])]) };
      });
      const planKind = r.plan ? RIVAL_ACTIONS[r.plan.kind] : null;
      return { ...r, ops, known, drag: rivalDrag(r, s),
        strengthPips: Array.from({ length: 10 }, (_, i) => ({ on: i < r.strength })),
        flames: Array.from({ length: 3 }, (_, i) => ({ on: i < r.aggression })),
        planText: r.stunned > 0 ? "Reeling from sabotage — it cannot act." : (!r.plan ? "Quiet — no move expected." : (known ? `${planKind?.icon ?? ""} ${planKind?.label ?? r.plan.kind}${r.plan.blocked ? " — FOILED" : ""}` : "Something is brewing… (intel 40 needed)")),
        planHot: !!r.plan && !r.stunned, planFoiled: !!r.plan?.blocked };
    });
    const heatCls = s.heat >= 70 ? "hot" : (s.heat >= 40 ? "warm" : "cool");

    const mk = c => ({ ...c, oddsPct: Math.round(c.pOk * 100) });
    const deals = s.rivals.map(r => ({ id: r.id, name: r.name, img: r.img, boss: r.boss, strength: r.strength, secrecy: r.secrecy, aggression: r.aggression,
      intel: r.intel, premium: String(r.premium ?? 0), courted: r.courted ?? 0, drag: rivalDrag(r, s),
      buyout: mk(dealCalc(r, s, "buyout")), merger: mk(dealCalc(r, s, "merger")) }));
    const divisions = s.divisions.map(d => {
      const c = divisionCalc(d, s);
      return { ...d, ...c, kindLabel: d.kind === "merger" ? "MERGED PARTNER" : "ACQUIRED", netPos: c.net >= 0,
        headChoices: Object.fromEntries([["", "— no head —"], ...s.staff.map(p => [p.id, p.name])]) };
    });
    const branches = s.branches.map(b => {
      const c = branchCalc(b, s), owner = game.users?.get?.(b.userId), last = b.history.at(-1), focus = BRANCH_FOCI[b.focus];
      return { ...b, ...c, ownerName: owner?.name ?? "(unknown player)", ownerImg: owner?.avatar ?? "",
        mine: b.userId === userId, canAct: isGM || b.userId === userId, cashNeg: b.cash < 0, tithe_pct: b.tithe ?? s.branchTithe ?? 20,
        goldMax: dividendGold(c.maxDividend, s),
        focusLabel: focus.label, focusIcon: focus.icon, focusSyn: focus.syn, tn: branchTN(b),
        tierPips: Array.from({ length: 5 }, (_, i) => ({ on: i < b.tier })),
        growthPct: Math.min(100, Math.round(b.growth / c.need * 100)), lastProfit: last?.profit ?? null, lastTithe: last?.tithe ?? null,
        stances: Object.entries(BRANCH_STANCES).map(([k, v]) => ({ key: k, label: v.label, icon: v.icon, desc: v.desc, on: b.stance === k })) };
    });
    return {
      isGM, state: s, f, staff, places, events, avg, avgMood: mood(avg), banner, gauges: LedgerApp.makeGauges(f, avg),
      version: game.modules?.get(MID)?.version ?? "", schema: s.schema,
      floorTypes: floorTypeChoices(), goodChoices: goodChoices(), modeChoices: modeChoices(), specChoices: specChoices(),
      opKindChoices: opKindChoices(), premiumChoices: premiumChoices(), branchFocusChoices: branchFocusChoices(),
      crewChoices: Object.fromEntries([["", "— none —"], ...s.staff.map(p => [p.id, p.name])]),
      routes, market, runningRoutes: routes.filter(r => r.running).length, routeCap: routeCap(s), cargoCap: cargoCap(s),
      contracts, activeContracts: active, offers: contracts.filter(c => c.isOffered), contractLog: [...s.contractLog].reverse(),
      activeCount: active.length, contractCap: contractCap(s), reputation: s.reputation, repTier: repTier(s.reputation),
      offerPerMonth: offerCount(s.reputation),
      seats, pp, bonuses, salary: salaryPer(s), dormantBelow: DORMANT_BELOW, execSalaries: fx.salaries,
      rivals, def, heat: s.heat, heatCls, intelPlan: INTEL_PLAN, guardValue: GUARD_VALUE, spyLog: [...s.spyLog].reverse(),
      guardList: def.guardList.map(p => ({ id: p.id, name: p.name, bonus: GUARD_VALUE + (p.spec === "stealth" || p.spec === "combat" ? 1 : 0) })),
      canGuard: s.guards.length < 3 && freeCrew.length > 0,
      guardChoices: Object.fromEntries([["", "＋ add guard…"], ...freeCrew.map(p => [p.id, p.name])]),
      deals, divisions, dealLog: [...s.dealLog].reverse(),
      branches, hireCost: HIRE_COST, dividendFloor: DIVIDEND_FLOOR, myBranchCount: branches.filter(b => b.mine).length,
      tierCap: branchTierCap(s), dividendRate: s.dividendRate, rates: BRANCH_RATES,
      synergies: Object.values(BRANCH_FOCI).map(v => `${v.icon} ${v.label}: ${v.syn}`),
      threats: events.filter(e => e.threat).length,
      tabs: { overview: tab === "overview", staff: tab === "staff", places: tab === "places",
        events: tab === "events", tasks: tab === "tasks", trophies: tab === "trophies", routes: tab === "routes",
        contracts: tab === "contracts", execs: tab === "execs", spies: tab === "spies", deals: tab === "deals", branches: tab === "branches" },
      graph: LedgerApp.makeGraph(s.history), history: [...s.history].reverse().slice(0, 12),
      tasks: s.tasks, tn: taskTarget(s.level), canAct: !s.tasks.some(t => t.userId === userId),
      taskDefs: Object.entries(TASKS).map(([key, v]) => ({ key, label: v.label, desc: v.desc, needs: v.needs })),
      targetThreats: events.filter(e => e.threat).map(e => ({ id: e.id, label: `[${e.internal ? "INT" : "EXT"}] ${e.title} (L${e.level}, TN ${e.target})` })),
      targetRoutes: routes.map(r => ({ id: r.id, label: `[ROUTE] ${r.name} (TN ${r.tn})` })),
      targetContracts: active.map(c => ({ id: c.id, label: `[CONTRACT] ${c.title} (TN ${c.tn}, ${c.progress}/${c.required})` })),
      targetRivals: s.rivals.map(r => ({ id: r.id, label: `[RIVAL] ${r.name} (intel ${r.intel}${r.plan && r.intel >= INTEL_PLAN ? ", plan known" : ""})` })),
      targetDivisions: s.divisions.map(d => ({ id: d.id, label: `[DIVISION] ${d.name} (${d.integration}% integrated)` })),
      targetBranches: branches.filter(b => b.canAct).map(b => ({ id: b.id, label: `[BRANCH] ${b.name} (tier ${b.tier}, TN ${b.tn})` })),
      trophies, trophyCount: trophies.filter(t => t.got).length, trophyTotal: trophies.length
    };
  }

  static makeGraph(hist) {
    const h = hist.slice(-12);
    if (h.length < 2) return null;
    const W = 600, H = 150, P = 12, vals = h.map(x => x.profit);
    const min = Math.min(0, ...vals), max = Math.max(1, ...vals), span = max - min || 1;
    const pts = h.map((x, i) => [P + i * (W - 2 * P) / (h.length - 1), H - P - (x.profit - min) / span * (H - 2 * P)]);
    const zero = H - P - (0 - min) / span * (H - 2 * P);
    return { W, H, zero, line: pts.map(p => p.join(",")).join(" "), pts: pts.map(([x, y]) => ({ x, y })) };
  }

  _onRender() {
    const el = this.element;
    el.querySelectorAll("[data-edit]").forEach(i => i.addEventListener("change", ev => this.onEdit(ev)));
    el.querySelectorAll(".cel-drop").forEach(z => {
      z.addEventListener("dragover", ev => { ev.preventDefault(); z.classList.add("hot"); });
      z.addEventListener("dragleave", () => z.classList.remove("hot"));
      z.addEventListener("drop", ev => { z.classList.remove("hot"); this.onDrop(ev, z.dataset.kind, z.dataset.target, z.dataset.id); });
    });
    if (this._animTab !== this.tab) {
      this._animTab = this.tab;
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        el.querySelectorAll("[data-count]").forEach(n => {
          const to = Number(n.dataset.count) || 0, t0 = performance.now();
          const step = t => {
            const k = Math.min(1, (t - t0) / 900);
            n.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
            if (k < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      }
    }
  }

  static async commit(s) {
    const fresh = unlockAchievements(s);
    await saveState(s);
    for (const a of fresh) {
      await ChatMessage.create({
        content: `<div class="cel-chat win"><h3>🏆 Achievement: ${a.title}</h3><p>${a.icon} ${a.desc}</p><p class="muted">Reward: 1 XP (GM may award).</p></div>`,
        flags: { [MID]: { fx: "achieve", title: a.title } }
      });
    }
  }

  async onEdit(ev) {
    if (!game.user.isGM) return;
    const i = ev.currentTarget, { edit, id, field } = i.dataset, s = getState();
    if (edit === "assign") {
      const c = s.contracts.find(x => x.id === id);
      if (c && i.value && c.crew.length < 3 && !busyCrew(s).has(i.value) && c.status === "active") c.crew.push(i.value);
      return LedgerApp.commit(s);
    }
    if (edit === "opcrew") {
      const o = s.ops.find(x => x.id === id);
      if (o && i.value && o.crew.length < 2 && !busyCrew(s).has(i.value)) o.crew.push(i.value);
      return LedgerApp.commit(s);
    }
    if (edit === "guard") {
      if (i.value && s.guards.length < 3 && !busyCrew(s).has(i.value)) s.guards.push(i.value);
      return LedgerApp.commit(s);
    }
    if (edit === "exec") {
      for (const k of SEATS) if (i.value && s.exec[k] === i.value) s.exec[k] = "";
      s.exec[field] = i.value;
      return LedgerApp.commit(s);
    }
    if (edit === "divhead") {
      const d = s.divisions.find(x => x.id === id);
      if (d) d.headId = i.value;
      return LedgerApp.commit(s);
    }
    let v = i.type === "number" ? Number(i.value) || 0 : (i.type === "checkbox" ? i.checked : i.value);
    if (field === "happiness") v = clamp(v, 0, 100);
    if (field === "level") v = clamp(v, 1, 10);
    if (edit === "routes") {
      if (field === "legs") v = clamp(v, 1, 5);
      if (field === "riskMod") v = clamp(v, -3, 3);
      if (field === "cargo") {
        const cap = cargoCap(s);
        if (v > cap) ui.notifications.info(`Cargo is capped at ${cap} per route at rank ${s.level}.`);
        v = clamp(v, 0, cap);
      }
    }
    if (edit === "rivals") {
      if (field === "strength" || field === "secrecy") v = clamp(v, 1, 10);
      if (field === "aggression") v = clamp(v, 0, 3);
      if (field === "intel") v = clamp(v, 0, 100);
      if (field === "premium") v = Number(v) || 0;
    }
    if (edit === "branches") {
      if (field === "tier") v = clamp(Math.round(v), 1, 5);
      if (field === "staff") v = Math.max(0, Math.round(v));
      if (field === "tithe") v = clamp(v, 0, 60);
      if (field === "morale") v = clamp(v, 0, 100);
    }
    if (edit === "business" && field === "branchTithe") v = clamp(v, 0, 60);
    if (edit === "business" && field === "dividendRate") v = clamp(Math.round(v) || 10, 1, 100);
    if (edit === "contracts") {
      if (field === "required" || field === "months") v = Math.max(1, v);
      if (field === "reward") v = Math.max(0, v);
    }
    if (edit === "business") s[field] = v;
    else if (edit === "floor") {
      const place = s.places.find(p => p.id === i.dataset.place), fl = place?.floors?.find(f => f.id === id);
      if (!fl) return;
      fl[field] = v;
      if (field === "type" && FLOOR_TYPES[v]) { fl.upkeep = FLOOR_TYPES[v].upkeep; fl.bonus = FLOOR_TYPES[v].bonus; }
    } else { const row = s[edit].find(r => r.id === id); if (row) row[field] = v; }
    await LedgerApp.commit(s);
  }

  async onDrop(ev, kind, target, targetId) {
    ev.preventDefault();
    if (!game.user.isGM) return;
    let data; try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
    if (data.type !== kind) return ui.notifications.warn(game.i18n.localize("CEL.BadDrop"));
    const doc = await fromUuid(data.uuid); if (!doc) return;
    const s = getState();
    if (kind === "Scene" && target === "branch") {
      const b = s.branches.find(x => x.id === targetId);
      if (!b) return;
      b.sceneUuid = doc.uuid;
      if (b.name === "Branch Office") b.name = doc.name;
      return LedgerApp.commit(s);
    }
    if (kind === "Actor" && target === "contract") {
      const c = makeContract(s, { client: doc.name, clientUuid: doc.uuid, clientImg: doc.img });
      s.contracts.push(c);
      await LedgerApp.commit(s);
      return LedgerApp.postOffer(s, c);
    }
    if (kind === "Actor" && target === "rival") {
      s.rivals.push(makeRival({ boss: doc.name, img: doc.img, uuid: doc.uuid }));
      return LedgerApp.commit(s);
    }
    if (kind === "Actor") s.staff.push({ id: uid(), uuid: doc.uuid, name: doc.name, img: doc.img, role: "Worker", spec: "", wage: 50, happiness: 70 });
    else if (target === "route") {
      if (s.routes.length >= routeCap(s)) return ui.notifications.warn(`Rank ${s.level} supports ${routeCap(s)} trade routes. Raise the rank or close a route.`);
      s.routes.push(makeRoute({ name: `Route to ${doc.name}`, to: doc.name, sceneUuid: doc.uuid }));
    } else {
      const place = { id: uid(), uuid: doc.uuid, name: doc.name, img: doc.thumb || doc.background?.src || "icons/svg/city.svg", upkeep: 50, bonus: 100, floors: [] };
      const n = levelsOf(doc).length;
      if (n >= 2) {
        syncFloors(place, doc);
        place.upkeep = 20; place.bonus = 0;
        ui.notifications.info(`${doc.name}: ${n} Scene Levels imported as floors.`);
      }
      s.places.push(place);
    }
    await LedgerApp.commit(s);
  }

  static onShowTab(event, target) { this.tab = target.dataset.tab; this.render(); }

  static async onRemove(event, target) {
    if (!game.user.isGM) return;
    const s = getState(), list = target.dataset.list, id = target.dataset.id;
    s[list] = s[list].filter(r => r.id !== id);
    if (list === "routes") s.events = s.events.filter(e => e.routeId !== id);
    if (list === "rivals") { s.ops = s.ops.filter(o => o.rivalId !== id); s.events = s.events.filter(e => e.rivalId !== id); }
    if (list === "staff") {
      for (const k of SEATS) if (s.exec[k] === id) s.exec[k] = "";
      s.contracts.forEach(c => { c.crew = c.crew.filter(x => x !== id); });
      s.ops.forEach(o => { o.crew = o.crew.filter(x => x !== id); });
      s.divisions.forEach(d => { if (d.headId === id) d.headId = ""; });
      s.guards = s.guards.filter(x => x !== id);
      s.routes.forEach(r => { if (r.master === id) r.master = ""; });
    }
    await LedgerApp.commit(s);
  }

  static async onOpenScene(event, target) {
    if (!game.user.isGM) return;
    const sc = await fromUuid(target.dataset.uuid);
    if (sc) sc.view(); else ui.notifications.warn("Scene no longer exists.");
  }

  // ---- Branch offices ----
  static async onAddBranch() {
    if (!game.user.isGM) return;
    const users = game.users.map(u => `<option value="${u.id}">${u.name}${u.isGM ? " (GM)" : ""}</option>`).join("");
    const foci = Object.entries(BRANCH_FOCI).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label} — ${v.syn}</option>`).join("");
    const r = await DialogV2.input({
      window: { title: "Open a branch office" },
      content: `<div class="form-group"><label>Owner</label><select name="user">${users}</select></div>
        <div class="form-group"><label>Name</label><input name="name" value="Branch Office"></div>
        <div class="form-group"><label>Focus</label><select name="focus">${foci}</select></div>`,
      ok: { label: "Open branch" }
    });
    if (!r?.user) return;
    const s = getState();
    s.branches.push(makeBranch(r.user, { name: r.name || "Branch Office", focus: r.focus, tithe: s.branchTithe }));
    await LedgerApp.commit(s);
    await ChatMessage.create({ content: `<div class="cel-chat win"><h3>🏢 New branch: ${r.name || "Branch Office"}</h3><p>${game.users.get(r.user)?.name ?? "A player"} opens a ${BRANCH_FOCI[r.focus]?.label ?? ""} branch of ${s.name}.</p></div>`, flags: { [MID]: { fx: "coins" } } });
  }

  static async applyBranchOp(d) {
    const s = getState(), user = game.users.get(d.userId);
    if (!user) return;
    const r = branchOp(s, d.op, d, d.userId, user.isGM);
    if (!r.ok) {
      return ChatMessage.create({ content: `<div class="cel-chat loss"><h3>🏢 Branch command refused</h3><p>${r.msg}</p></div>`, whisper: [d.userId] });
    }
    await LedgerApp.commit(s);
    const extra = r.dividend ? `<p class="muted">GM: award <b>${r.gold} gold</b> to ${user.character?.name ?? user.name} (${r.dividend} ledger coins at ${s.dividendRate}:1).</p>` : "";
    await ChatMessage.create({ content: `<div class="cel-chat win"><h3>🏢 ${r.branch.name}</h3><p>${r.msg}</p>${extra}</div>`, flags: r.fx ? { [MID]: { fx: r.fx } } : {} });
  }

  static async branchAction(op, payload) {
    if (game.user.isGM) return LedgerApp.applyBranchOp({ type: "branch", op, userId: game.user.id, ...payload });
    if (!game.users.activeGM) return ui.notifications.warn("A GM must be online to process branch commands.");
    game.socket.emit(`module.${MID}`, { type: "branch", op, userId: game.user.id, ...payload });
    ui.notifications.info("Request sent to the GM.");
  }

  static onBranchStance(event, target) { return LedgerApp.branchAction("stance", { branchId: target.dataset.id, stance: target.dataset.stance }); }
  static onBranchHire(event, target) { return LedgerApp.branchAction("hire", { branchId: target.dataset.id }); }
  static onBranchUpgrade(event, target) { return LedgerApp.branchAction("upgrade", { branchId: target.dataset.id }); }
  static async onBranchDividend(event, target) {
    const s = getState(), b = s.branches.find(x => x.id === target.dataset.id);
    if (!b) return;
    const max = branchCalc(b, s).maxDividend, rate = s.dividendRate;
    if (max <= 0) return ui.notifications.warn(`The branch must keep ${DIVIDEND_FLOOR} in reserve.`);
    if (dividendGold(max, s) < 1) return ui.notifications.warn(`At ${rate} ledger coins per gold piece, the branch cannot yet pay a whole gold piece.`);
    const r = await DialogV2.input({
      window: { title: `Owner's dividend — ${b.name}` },
      content: `<p>The branch keeps ${DIVIDEND_FLOOR} in reserve. You can draw up to <b>${max}</b> ledger coins, which the GM converts at <b>${rate} to 1</b> into gold for your character (up to <b>${dividendGold(max, s)} gold</b>).</p>
        <div class="form-group"><label>Ledger coins</label><input type="number" name="amount" value="${Math.min(max, rate * 20)}" min="${rate}" max="${max}" step="${rate}"></div>`,
      ok: { label: "Draw" }
    });
    if (!r) return;
    return LedgerApp.branchAction("dividend", { branchId: b.id, amount: Number(r.amount) || 0 });
  }

  static async resolveBranches(s) {
    const out = { income: 0, lines: [] };
    for (const b of s.branches) {
      const nat = (await new Roll("1d20").evaluate()).total;
      const r = branchMonth(b, s, nat);
      out.income += r.tithe;
      out.lines.push(`🏢 ${b.name}: profit ${r.profit}, tithe ${r.tithe} to HQ${r.note ? ` — ${r.note}` : ""}${b.cash <= -300 ? " ⚠ deep in debt" : ""}`);
    }
    return out;
  }

  // ---- Tools: self-test, backup, restore, reset ----
  static async onSelfTest() {
    if (!game.user.isGM) return ui.notifications.warn("Only the GM can run the self-test.");
    ui.notifications.info("Aether Ledger self-test running…");
    let rep;
    try { rep = await runSelfTest(LedgerApp); }
    catch (e) { console.error(`${MID} | self-test crashed`, e); return ui.notifications.error(`Self-test crashed: ${e.message}`); }
    await DialogV2.prompt({
      window: { title: `Aether Ledger self-test (v${game.modules.get(MID)?.version ?? "?"})` },
      position: { width: 700 }, content: reportHtml(rep), ok: { label: "Close" }
    });
  }

  static async onExport() {
    if (!game.user.isGM) return;
    const s = getState();
    const payload = { module: MID, version: game.modules.get(MID)?.version, exportedAt: new Date().toISOString(), state: s };
    const text = JSON.stringify(payload, null, 2), name = `aether-ledger-month-${s.month}.json`;
    const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
    if (save) { save(text, "application/json", name); ui.notifications.info(`Backup saved as ${name}`); }
    else await DialogV2.prompt({ window: { title: "Backup" }, content: `<textarea readonly rows="14" style="width:100%">${text.replace(/</g, "&lt;")}</textarea>`, ok: { label: "Close" } });
  }

  static async onImport() {
    if (!game.user.isGM) return;
    const raw = await DialogV2.prompt({
      window: { title: "Restore backup" },
      content: `<p>Paste the contents of a backup file. <b>This replaces the current ledger.</b></p><textarea name="json" rows="12" style="width:100%"></textarea>`,
      ok: { label: "Restore", callback: (event, button) => button.form.elements.json.value }
    });
    if (!raw) return;
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { return ui.notifications.error("That is not valid JSON."); }
    const st = obj?.state ?? obj;
    if (!st || typeof st !== "object" || !Array.isArray(st.staff) || typeof st.name !== "string") return ui.notifications.error("That does not look like an Aether Ledger backup.");
    const ok = await DialogV2.confirm({ window: { title: "Replace the ledger?" }, content: `<p>Replace the current ledger with <b>${st.name}</b> (month ${st.month ?? "?"})?</p>` });
    if (!ok) return;
    await saveState(migrateState(foundry.utils.mergeObject(DEFAULT_STATE(), st, { inplace: false })));
    ui.notifications.info("Backup restored.");
  }

  static async onReset() {
    if (!game.user.isGM) return;
    const ok = await DialogV2.confirm({ window: { title: "Reset the business?" }, content: `<p><b>This erases everything</b>: crew, workshops, routes, contracts, rivals, divisions, branches, perks and trophies. Export a backup first if you might want it back.</p>` });
    if (!ok) return;
    await saveState(DEFAULT_STATE());
    ui.notifications.info("The ledger has been reset.");
  }

  // ---- Acquisitions & mergers ----
  static async onDeal(event, target) {
    if (!game.user.isGM) return;
    const s = getState(), kind = target.dataset.kind, r = s.rivals.find(x => x.id === target.dataset.rival);
    if (!r || !DEAL_KINDS[kind]) return;
    const c = dealCalc(r, s, kind);
    if (c.blocked) return ui.notifications.warn(c.blocked);
    const label = DEAL_KINDS[kind].label.toLowerCase();
    const ok = await DialogV2.confirm({
      window: { title: `${DEAL_KINDS[kind].label}: ${r.name}` },
      content: `<p>Offer a ${label} for <b>${c.price}</b>? Odds <b>${Math.round(c.pOk * 100)}%</b> (d20 + ${c.bonus} vs ${c.tn}).</p>
        <p>The legal fee of <b>${c.fee}</b> is lost even if they refuse. A natural 20 knocks 20% off; a natural 1 offends them and costs 5 reputation.</p>`
    });
    if (!ok) return;
    const nat = (await new Roll("1d20").evaluate()).total, total = nat + c.bonus;
    const win = nat === 20 || (nat > 1 && total >= c.tn);
    if (!win) {
      s.cash -= c.fee; r.courted = 0;
      let extra = "";
      if (nat === 1) { r.aggression = Math.min(3, r.aggression + 1); s.reputation = clamp(s.reputation - 5, 0, 100); extra = ` The offer insults them: ${r.name} grows hostile and your reputation falls by 5.`; }
      s.dealLog.push({ month: s.month, text: `${label} of ${r.name} refused (−${c.fee} fee)` });
      s.dealLog = s.dealLog.slice(-8);
      await LedgerApp.commit(s);
      return ChatMessage.create({
        content: `<div class="cel-chat loss"><h3>🏛 ${DEAL_KINDS[kind].label} refused</h3><p>${r.name} turns down your ${label}. Rolled <b>${total}</b> vs <b>${c.tn}</b>. Legal fee lost: ${c.fee}.${extra}</p></div>`,
        flags: { [MID]: { fx: "shake", power: 3 } }
      });
    }
    const price = nat === 20 ? Math.round(c.price * 0.8) : c.price;
    s.cash -= price;
    const div = makeDivision(r, kind === "merger" ? "merger" : "buyout", s.month);
    if (r.boss) {
      let head = s.staff.find(p => p.uuid && p.uuid === r.uuid);
      if (!head) { head = { id: uid(), uuid: r.uuid, name: r.boss, img: r.img || "icons/svg/mystery-man.svg", role: "Division Head", spec: "", wage: 80, happiness: 55 }; s.staff.push(head); }
      div.headId = head.id;
    }
    s.divisions.push(div);
    s.stats[kind === "merger" ? "mergers" : "acquisitions"] += 1;
    if (kind === "merger") s.reputation = clamp(s.reputation + 3, 0, 100);
    s.rivals = s.rivals.filter(x => x.id !== r.id);
    s.ops = s.ops.filter(o => o.rivalId !== r.id);
    s.events = s.events.filter(e => e.rivalId !== r.id);
    s.dealLog.push({ month: s.month, text: `${kind === "merger" ? "Merged with" : "Acquired"} ${r.name} for ${price}` });
    s.dealLog = s.dealLog.slice(-8);
    await LedgerApp.commit(s);
    await ChatMessage.create({
      content: `<div class="cel-chat win"><h3>🏛 ${kind === "merger" ? "Merger complete" : "Takeover complete"}: ${r.name}</h3>
        <p>Rolled <b>${total}</b> vs <b>${c.tn}</b>${nat === 20 ? " — a natural 20 wins a 20% discount" : ""}. Price paid: <b>${price}</b>.</p>
        <p>${r.name} is now a division of ${s.name}. Integrate it to unlock its full income.</p></div>`,
      flags: { [MID]: { fx: "coins" } }
    });
  }

  static async onDivest(event, target) {
    if (!game.user.isGM) return;
    const s = getState(), d = s.divisions.find(x => x.id === target.dataset.id);
    if (!d) return;
    const c = divisionCalc(d, s);
    const ok = await DialogV2.confirm({ window: { title: `Divest ${d.name}` }, content: `<p>Sell off ${d.name} for <b>${c.divestValue}</b>? This cannot be undone.</p>` });
    if (!ok) return;
    s.cash += c.divestValue;
    s.divisions = s.divisions.filter(x => x.id !== d.id);
    s.events = s.events.filter(e => e.divisionId !== d.id);
    s.dealLog.push({ month: s.month, text: `Sold ${d.name} for ${c.divestValue}` });
    s.dealLog = s.dealLog.slice(-8);
    await LedgerApp.commit(s);
  }

  // ---- Corporate espionage ----
  static async onAddRival() {
    if (!game.user.isGM) return;
    const s = getState();
    s.rivals.push(makeRival());
    await LedgerApp.commit(s);
  }

  static async onAddOp(event, target) {
    if (!game.user.isGM) return;
    const s = getState();
    s.ops.push({ id: uid(), rivalId: target.dataset.rival, kind: "surveil", crew: [], active: true });
    await LedgerApp.commit(s);
  }

  static async onOpUnassign(event, target) {
    if (!game.user.isGM) return;
    const s = getState(), o = s.ops.find(x => x.id === target.dataset.id);
    if (!o) return;
    o.crew = o.crew.filter(id => id !== target.dataset.crew);
    await LedgerApp.commit(s);
  }

  static async onUnguard(event, target) {
    if (!game.user.isGM) return;
    const s = getState();
    s.guards = s.guards.filter(id => id !== target.dataset.crew);
    await LedgerApp.commit(s);
  }

  static async resolveIntrigue(s) {
    const out = { income: 0, costs: 0, mor: 0, lines: [], events: [] };
    const log = t => { out.lines.push(t); s.spyLog.push({ month: s.month, text: t.replace(/<[^>]+>/g, "") }); };
    const surveyed = new Set();
    for (const op of s.ops) {
      const c = opCalc(op, s);
      if (!c.running) continue;
      const r = c.rival;
      out.costs += c.cost;
      if (op.kind === "surveil") surveyed.add(r.id);
      const nat = (await new Roll("1d20").evaluate()).total, total = nat + c.bonus;
      const tag = `${c.kind.icon} ${c.kind.label} vs ${r.name}`;
      if (nat === 1) {
        s.heat = clamp(s.heat + 25, 0, 100); s.reputation = clamp(s.reputation - 3, 0, 100);
        r.aggression = Math.min(3, r.aggression + 1); r.wary = 3; s.stats.opsExposed += 1;
        c.crew.forEach(p => { p.happiness = clamp(p.happiness - 5, 0, 100); });
        log(`${tag}: d20 ${nat} — <b>EXPOSED!</b> Heat +25, reputation −3, ${r.name} grows hostile and wary.`);
      } else if (nat === 20 || total >= c.tn) {
        const big = nat === 20;
        s.stats.opsDone += 1;
        s.heat = clamp(s.heat + c.kind.heat, 0, 100);
        if (op.kind === "surveil") { const g = big ? 40 : 20; r.intel = clamp(r.intel + g, 0, 100); log(`${tag}: d20 ${nat} (${total} vs ${c.tn}) — <b>SUCCESS</b>, intel +${g}.`); }
        else if (op.kind === "steal") {
          const gain = Math.round(r.strength * 20 * (1 + r.intel / 100) * (big ? 1.5 : 1));
          out.income += gain; r.wary = 3;
          log(`${tag}: d20 ${nat} (${total} vs ${c.tn}) — <b>SUCCESS</b>, stolen designs sold for +${gain}. ${r.name} turns wary.`);
        } else {
          const cut = big ? 2 : 1; r.strength = Math.max(1, r.strength - cut); r.stunned = 2; r.plan = null; s.stats.sabotages += 1;
          log(`${tag}: d20 ${nat} (${total} vs ${c.tn}) — <b>SUCCESS</b>, ${r.name} loses ${cut} strength and is stunned for 2 months.`);
        }
      } else {
        if (total <= c.tn - 6) s.heat = clamp(s.heat + 8, 0, 100);
        log(`${tag}: d20 ${nat} (${total} vs ${c.tn}) — <b>FAILED</b>, nothing gained.`);
      }
    }
    for (const r of s.rivals) {
      if (!surveyed.has(r.id) && r.intel > 0) r.intel = Math.max(0, r.intel - 5);
      if (r.aggression >= 2 && Math.random() < 0.15) r.aggression -= 1;
      if (r.courted > 0) r.courted -= 1;
    }
    const D = defenseRating(s).total;
    for (const r of s.rivals) {
      const plan = r.plan;
      if (r.stunned > 0) { if (plan) log(`${r.name} is reeling from sabotage and cannot act.`); r.plan = null; continue; }
      if (!plan) continue;
      const act = RIVAL_ACTIONS[plan.kind] ?? RIVAL_ACTIONS.theft;
      if (plan.blocked) { s.stats.defended += 1; log(`${act.icon} ${r.name}'s ${act.label.toLowerCase()} was <b>FOILED</b> in advance.`); r.plan = null; continue; }
      const informed = r.intel >= INTEL_PLAN ? 2 : 0;
      const nat = (await new Roll("1d20").evaluate()).total, total = nat + r.strength - Math.min(3, Math.floor(r.intel / 25)), need = 12 + D + informed;
      const hit = nat === 20 || (nat !== 1 && total >= need);
      if (!hit) { s.stats.defended += 1; r.intel = clamp(r.intel + 10, 0, 100); log(`${act.icon} ${r.name} tried ${act.label.toLowerCase()} (${total} vs ${need}) — <b>REPELLED</b>, intel +10.`); }
      else if (plan.kind === "theft") { const loss = r.strength * 40; out.costs += loss; log(`${act.icon} ${r.name} struck: industrial theft costs <b>${loss}</b>.`); }
      else if (plan.kind === "sabotage") {
        out.events.push({ id: uid(), title: `Sabotage by ${r.name}`, kind: "internal", level: Math.max(1, Math.ceil(r.strength / 2) - perkFx(s).threatDown), inc: -12, mor: -2, months: 0, rivalId: r.id, desc: `Agents of ${r.name} wrecked equipment. Find and repair the damage.` });
        log(`${act.icon} ${r.name} struck: <b>sabotage</b> in the workshops.`);
      } else {
        out.events.push({ id: uid(), title: `Price war with ${r.name}`, kind: "external", level: Math.max(1, Math.ceil(r.strength / 2) - perkFx(s).threatDown), inc: -14, mor: -1, months: 0, rivalId: r.id, desc: `${r.name} slashes prices to bleed your customers.` });
        log(`${act.icon} ${r.name} struck: a <b>price war</b> begins.`);
      }
    }
    for (const r of s.rivals) {
      r.stunned = Math.max(0, (r.stunned ?? 0) - 1); r.wary = Math.max(0, (r.wary ?? 0) - 1);
      r.plan = (!r.stunned && r.aggression > 0 && Math.random() < 0.35 + 0.2 * r.aggression) ? { kind: pick(Object.keys(RIVAL_ACTIONS)), blocked: false } : null;
    }
    if (s.heat >= 70) {
      const fine = 50 + 10 * s.level;
      out.costs += fine; s.reputation = clamp(s.reputation - 5, 0, 100); s.heat = 40; out.mor -= 2;
      log(`⚖ The city watch fines you <b>${fine}</b> over suspected espionage. Reputation −5.`);
    } else s.heat = clamp(s.heat - 10, 0, 100);
    s.spyLog = s.spyLog.slice(-10);
    return out;
  }

  // ---- Executive perks ----
  static async onBuyPerk(event, target) {
    if (!game.user.isGM) return;
    const s = getState(), seat = target.dataset.seat, tier = Number(target.dataset.tier);
    if (tier !== (s.perks[seat] ?? 0) + 1) return;
    const cost = PERK_COSTS[tier - 1];
    if (perkPoints(s).left < cost) return ui.notifications.warn(`You need ${cost} perk point(s).`);
    s.perks[seat] = tier;
    const perk = SEAT_DEFS[seat].perks[tier - 1];
    await LedgerApp.commit(s);
    await ChatMessage.create({
      content: `<div class="cel-chat win"><h3>🎩 Executive perk: ${perk.name}</h3><p>${SEAT_DEFS[seat].icon} ${SEAT_DEFS[seat].title} — ${perk.desc}</p></div>`,
      flags: { [MID]: { fx: "coins" } }
    });
  }

  static async onRespec(event, target) {
    if (!game.user.isGM) return;
    const s = getState();
    s.perks[target.dataset.seat] = 0;
    await LedgerApp.commit(s);
  }

  // ---- Guild contracts ----
  static async postOffer(s, c) {
    await ChatMessage.create({ content: `<div class="cel-chat win"><h3>📜 New contract offer</h3>
      <p><b>${c.title}</b> from ${c.client}</p><p>${c.desc}</p>
      <p>Level ${c.level} (TN ${contractTN(c)}) · ${c.required} progress in ${c.months} months · reward <b>${c.reward}</b></p></div>` });
  }

  static async onAcceptContract(event, target) {
    if (!game.user.isGM) return;
    const s = getState(), c = s.contracts.find(x => x.id === target.dataset.id);
    if (!c) return;
    if (s.contracts.filter(x => x.status === "active").length >= contractCap(s))
      return ui.notifications.warn(`Rank ${s.level} supports ${contractCap(s)} active contract(s). Finish one first.`);
    c.status = "active"; c.offerMonths = 0;
    await LedgerApp.commit(s);
  }

  static async onUnassign(event, target) {
    if (!game.user.isGM) return;
    const s = getState(), c = s.contracts.find(x => x.id === target.dataset.id);
    if (!c) return;
    c.crew = c.crew.filter(id => id !== target.dataset.crew);
    await LedgerApp.commit(s);
  }

  static async onRollOffer() {
    if (!game.user.isGM) return;
    const s = getState(), c = makeContract(s);
    s.contracts.push(c);
    await LedgerApp.commit(s);
    await LedgerApp.postOffer(s, c);
  }

  static async onCustomContract() {
    if (!game.user.isGM) return;
    const r = await DialogV2.input({
      window: { title: "Custom Contract" },
      content: `<div class="form-group"><label>Title</label><input name="title" value="Special Commission"></div>
        <div class="form-group"><label>Client</label><input name="client" value="Anonymous Patron"></div>
        <div class="form-group"><label>Type</label><select name="type">${Object.entries(contractTypeChoices()).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
        <div class="form-group"><label>Level (1-10)</label><input type="number" name="level" value="3"></div>
        <div class="form-group"><label>Reward</label><input type="number" name="reward" value="300"></div>
        <div class="form-group"><label>Progress needed</label><input type="number" name="required" value="4"></div>
        <div class="form-group"><label>Deadline (months)</label><input type="number" name="months" value="4"></div>
        <div class="form-group"><label>Description</label><input name="desc" value=""></div>`,
      ok: { label: "Add offer" }
    });
    if (!r) return;
    const s = getState(), level = clamp(Number(r.level) || 1, 1, 10);
    const c = makeContract(s, { title: r.title || "Contract", client: r.client || "Client", type: r.type, level,
      reward: Math.max(0, Number(r.reward) || 0), required: Math.max(1, Number(r.required) || 1), months: Math.max(1, Number(r.months) || 1),
      desc: r.desc, repReward: 3 + level });
    s.contracts.push(c);
    await LedgerApp.commit(s);
    await LedgerApp.postOffer(s, c);
  }

  static async resolveContracts(s) {
    const fx = perkFx(s);
    const out = { income: 0, costs: 0, mor: 0, rolls: [], done: [], failed: [] };
    for (const c of s.contracts.filter(x => x.status === "active")) {
      const tn = contractTN(c);
      for (const id of c.crew) {
        const p = s.staff.find(x => x.id === id);
        if (!p) continue;
        const nat = (await new Roll("1d20").evaluate()).total, total = nat + crewBonus(p, c, s);
        const d = nat === 20 ? 2 : (nat === 1 ? -1 : (total >= tn ? 1 : 0));
        c.progress = Math.max(0, c.progress + d);
        out.rolls.push({ title: c.title, who: p.name, nat, total, tn, d });
      }
      if (c.progress >= c.required) {
        const pay = Math.round(c.reward * fx.rewardMult), rep = c.repReward + fx.repBonus;
        out.done.push({ ...c, pay, rep }); out.income += pay; out.mor += 2;
        s.reputation = clamp(s.reputation + rep, 0, 100);
        s.stats.contractsDone += 1; s.stats.contractEarnings += pay;
        if (c.level >= 7) s.stats.bigContract += 1;
        s.contractLog.push({ month: s.month, title: c.title, client: c.client, outcome: "done", amount: pay });
      } else {
        c.months -= 1;
        if (c.months <= 0) {
          const pen = contractPenalty(c);
          out.failed.push(c); out.costs += pen; out.mor -= 3;
          s.reputation = clamp(s.reputation - 8, 0, 100);
          s.stats.contractsFailed += 1;
          s.contractLog.push({ month: s.month, title: c.title, client: c.client, outcome: "failed", amount: -pen });
        }
      }
    }
    const gone = new Set([...out.done, ...out.failed].map(c => c.id));
    s.contracts = s.contracts.filter(c => !gone.has(c.id));
    s.contractLog = s.contractLog.slice(-8);
    return out;
  }

  // ---- Trade routes ----
  static async onAddRoute() {
    if (!game.user.isGM) return;
    const s = getState();
    if (s.routes.length >= routeCap(s)) return ui.notifications.warn(`Rank ${s.level} supports ${routeCap(s)} trade routes. Raise the rank or close a route.`);
    s.routes.push(makeRoute({ name: `Route ${s.routes.length + 1}` }));
    await LedgerApp.commit(s);
  }

  static async resolveRoutes(s) {
    const fx = perkFx(s);
    const results = [], ambushes = [];
    for (const r of s.routes) {
      const c = routeCalc(r, s);
      if (!c.running) continue;
      const roll = await new Roll("1d20").evaluate();
      const nat = roll.total, total = nat + c.bonus;
      let outcome, revenue;
      if (nat === 1 && fx.ambushImmune) {
        outcome = "setback"; revenue = c.salvage;
      } else if (nat === 1) {
        outcome = "disaster"; revenue = 0; s.stats.ambushes += 1;
        ambushes.push({ id: uid(), title: `Ambush on ${r.name}`, kind: "external", level: Math.max(1, Math.ceil(c.risk / 2) - fx.threatDown), inc: -6, mor: -1, months: 0,
          routeId: r.id, desc: `Raiders strike the ${r.name} route. It stays closed until they are dealt with.` });
      } else if (nat === 20 || total >= c.tn) {
        outcome = "success"; revenue = Math.round(c.revenue * (nat === 20 ? 1.5 : 1)); s.stats.tradeRuns += 1;
      } else { outcome = "setback"; revenue = c.salvage; }
      const net = revenue - c.spend;
      if (outcome === "success") s.stats.tradeProfit += Math.max(0, net);
      results.push({ routeId: r.id, name: r.name, icon: MODES[r.mode]?.icon ?? "🚜", nat, total, tn: c.tn, revenue, spend: c.spend, net, outcome });
    }
    return { results, ambushes };
  }

  // ---- Floors ----
  static async onAddFloor(event, target) {
    if (!game.user.isGM) return;
    const s = getState(), place = s.places.find(p => p.id === target.dataset.id);
    if (!place) return;
    place.floors ??= [];
    const top = Math.max(0, ...place.floors.map(f => f.order ?? 0));
    place.floors.push(makeFloor("workshop", { name: `Floor ${place.floors.length + 1}`, order: top + 1 }));
    if (place.floors.length === 1) { place.upkeep = Math.min(place.upkeep, 20); place.bonus = 0; }
    await LedgerApp.commit(s);
  }

  static async onSyncFloors(event, target) {
    if (!game.user.isGM) return;
    const s = getState(), place = s.places.find(p => p.id === target.dataset.id);
    if (!place) return;
    const scene = await fromUuid(place.uuid);
    if (!scene) return ui.notifications.warn("Scene no longer exists.");
    const n = syncFloors(place, scene);
    if (!n) ui.notifications.warn(`${scene.name} has no Scene Levels. Add levels in Scene Configuration, or add floors manually.`);
    await LedgerApp.commit(s);
  }

  static async onRemoveFloor(event, target) {
    if (!game.user.isGM) return;
    const s = getState(), place = s.places.find(p => p.id === target.dataset.place);
    if (!place) return;
    place.floors = (place.floors ?? []).filter(f => f.id !== target.dataset.id);
    await LedgerApp.commit(s);
  }

  static async onVisitFloor(event, target) {
    if (!game.user.isGM) return;
    const scene = await fromUuid(target.dataset.uuid);
    if (!scene) return ui.notifications.warn("Scene no longer exists.");
    const level = target.dataset.level;
    try { await scene.view(level ? { level } : {}); }
    catch (e) {
      console.warn(`${MID} | view with level failed`, e);
      await scene.view();
      ui.notifications.warn("Opened the scene; switch level manually with the level controls.");
    }
  }

  // ---- Events ----
  static async postEvent(s, e) {
    const bad = e.inc < 0 || e.mor < 0, imp = eventImpact(e, s);
    const dir = !bad ? "OPPORTUNITY" : (e.kind === "internal" ? "INTERNAL TROUBLE" : "EXTERNAL DANGER");
    await ChatMessage.create({
      content: `<div class="cel-chat ${bad ? "loss" : "win"}">
      <h3>⚙ ${s.name}: ${dir}</h3><p><b>${e.title}</b> (level ${e.level}, target ${threatTN(e, s)})</p>
      <p>${e.desc ?? ""}</p><p>Income ${imp >= 0 ? "+" : ""}${imp} per month · Morale ${e.mor >= 0 ? "+" : ""}${e.mor}</p></div>`,
      flags: { [MID]: bad ? { fx: "shake", power: e.level } : { fx: "coins" } }
    });
  }

  static async onRollEvent(event, target) {
    if (!game.user.isGM) return;
    const s = getState(), kind = target.dataset.kind, fx = perkFx(s);
    const pool = EVENT_TABLE.filter(e => kind === "any" || e.kind === kind);
    const pickE = pick(pool);
    let level = clamp(s.level + Math.floor(Math.random() * 3) - 1, 1, 10);
    if (pickE.inc < 0 || pickE.mor < 0) level = Math.max(1, level - fx.threatDown);
    const e = { id: uid(), ...pickE, level };
    s.events.push(e);
    await LedgerApp.commit(s);
    await LedgerApp.postEvent(s, e);
  }

  static async onCustomEvent() {
    if (!game.user.isGM) return;
    const r = await DialogV2.input({
      window: { title: "Custom Event or Threat" },
      content: `<div class="form-group"><label>Title</label><input name="title" value="Mysterious trouble"></div>
        <div class="form-group"><label>Origin</label><select name="kind"><option value="internal">Internal</option><option value="external">External</option></select></div>
        <div class="form-group"><label>Level (1-10)</label><input type="number" name="level" value="3"></div>
        <div class="form-group"><label>Income per level (negative = harm)</label><input type="number" name="inc" value="-10"></div>
        <div class="form-group"><label>Morale per month</label><input type="number" name="mor" value="-2"></div>
        <div class="form-group"><label>Months (0 = until resolved)</label><input type="number" name="months" value="0"></div>
        <div class="form-group"><label>Description</label><input name="desc" value=""></div>`,
      ok: { label: "Add" }
    });
    if (!r) return;
    const s = getState();
    const e = { id: uid(), title: r.title || "Event", kind: r.kind, level: clamp(Number(r.level) || 1, 1, 10),
      inc: Number(r.inc) || 0, mor: Number(r.mor) || 0, months: Math.max(0, Number(r.months) || 0), desc: r.desc };
    s.events.push(e);
    await LedgerApp.commit(s);
    await LedgerApp.postEvent(s, e);
  }

  static async onResolveEvent(event, target) {
    if (!game.user.isGM) return;
    const s = getState(), e = s.events.find(x => x.id === target.dataset.id);
    if (!e) return;
    const tn = threatTN(e, s);
    const r = await DialogV2.input({
      window: { title: `Resolve: ${e.title}` },
      content: `<p>Target number <b>${tn}</b> (level ${e.level}). Cypher assets/skills lower difficulty; add +3 per step.</p>
        <div class="form-group"><label>Bonus</label><input type="number" name="bonus" value="0"></div>`,
      ok: { label: "Roll d20" }
    });
    if (!r) return;
    const roll = await new Roll(`1d20 + ${Number(r.bonus) || 0}`).evaluate();
    const nat = roll.dice[0].results[0].result;
    const ok = roll.total >= tn || nat === 20;
    await roll.toMessage({
      flavor: `<b>${s.name}</b>: resolving ${e.title} (target ${tn}) — ${ok ? "SUCCESS" : "FAILED"}`,
      flags: { [MID]: ok ? { fx: "coins" } : {} }
    });
    if (ok) {
      s.events = s.events.filter(x => x.id !== e.id);
      s.stats[e.kind === "internal" ? "resolvedInternal" : "resolvedExternal"] += 1;
      if (nat === 20) s.stats.nat20 += 1;
      await LedgerApp.commit(s);
    }
  }

  // ---- Player tasks ----
  static rivalTN(task, r) {
    if (task === "foil") return Math.min(19, 6 + r.strength);
    if (task === "court") return clamp(6 + 2 * r.secrecy, 2, 19);
    return clamp(2 + 2 * r.secrecy, 2, 19);
  }
  static divisionTN(s) { return Math.min(18, 7 + 2 * s.divisions.length); }

  static async onDoTask() {
    const el = LedgerApp.instance.element, s = getState();
    const task = el.querySelector("[name=task]")?.value, tid = el.querySelector("[name=target]")?.value;
    const steps = clamp(Number(el.querySelector("[name=steps]")?.value) || 0, 0, 3);
    const def = TASKS[task];
    if (!def) return;
    if (s.tasks.some(t => t.userId === game.user.id)) return ui.notifications.warn("You already acted this month.");
    if (!game.users.activeGM) return ui.notifications.warn("A GM must be online to process tasks.");
    let tn = taskTarget(s.level);
    if (def.needs === "route") {
      const r = s.routes.find(x => x.id === tid);
      if (!r) return ui.notifications.warn("Pick a trade route as the target.");
      tn = routeCalc(r, s).tn;
    } else if (def.needs === "contract") {
      const c = s.contracts.find(x => x.id === tid && x.status === "active");
      if (!c) return ui.notifications.warn("Pick an active contract as the target.");
      tn = contractTN(c);
    } else if (def.needs === "rival") {
      const r = s.rivals.find(x => x.id === tid);
      if (!r) return ui.notifications.warn("Pick a rival company as the target.");
      tn = LedgerApp.rivalTN(task, r);
    } else if (def.needs === "division") {
      const d = s.divisions.find(x => x.id === tid);
      if (!d) return ui.notifications.warn("Pick a division as the target.");
      tn = LedgerApp.divisionTN(s);
    } else if (def.needs === "branch") {
      const b = s.branches.find(x => x.id === tid);
      if (!b) return ui.notifications.warn("Pick one of your branches as the target.");
      if (!game.user.isGM && b.userId !== game.user.id) return ui.notifications.warn("That is not your branch.");
      tn = branchTN(b);
    } else if (def.needs) {
      const e = s.events.find(x => x.id === tid && x.kind === def.needs);
      if (!e) return ui.notifications.warn(`Pick an ${def.needs} threat as the target.`);
      tn = threatTN(e, s);
    }
    const roll = await new Roll(`1d20 + ${steps * 3}`).evaluate();
    const nat = roll.dice[0].results[0].result;
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker(),
      flavor: `<b>${s.name}</b>: ${def.label} (target ${tn}${steps ? `, ${steps} asset/skill step(s)` : ""})`
    });
    const payload = { userId: game.user.id, task, targetId: tid, total: roll.total, nat };
    if (game.user.isGM) await LedgerApp.applyTask(payload);
    else game.socket.emit(`module.${MID}`, payload);
  }

  static async applyTask(d) {
    const s = getState(), user = game.users.get(d.userId), def = TASKS[d.task];
    if (!user || !def || s.tasks.some(t => t.userId === d.userId)) return;
    const total = Number(d.total) || 0, nat = Number(d.nat) || 0;
    const rec = { id: uid(), userId: d.userId, userName: user.name, who: user.character?.name ?? user.name,
      task: d.task, label: def.label, total, nat, tn: 0, income: 0, mor: 0, success: false, text: "" };
    const lvl = s.level;
    if (nat === 20) s.stats.nat20 += 1;
    if (def.needs === "route") {
      const r = s.routes.find(x => x.id === d.targetId);
      if (!r) rec.text = "That route no longer exists.";
      else {
        rec.tn = routeCalc(r, s).tn;
        rec.success = total >= rec.tn || nat === 20;
        if (rec.success) { r.escort = (Number(r.escort) || 0) + 3; rec.text = `${r.name} is guarded: +3 to its roll this month.`; }
        else rec.text = `The escort of ${r.name} goes poorly.`;
      }
    } else if (def.needs === "contract") {
      const c = s.contracts.find(x => x.id === d.targetId && x.status === "active");
      if (!c) rec.text = "That contract is no longer active.";
      else {
        rec.tn = contractTN(c);
        rec.success = total >= rec.tn || nat === 20;
        if (rec.success) {
          c.progress += nat === 20 ? 2 : 1;
          rec.text = `${c.title}: progress ${Math.min(c.progress, c.required)}/${c.required}${c.progress >= c.required ? " — ready for delivery at month end!" : ""}`;
        } else rec.text = `No headway on ${c.title} (needed ${rec.tn}).`;
      }
    } else if (def.needs === "rival") {
      const r = s.rivals.find(x => x.id === d.targetId);
      if (!r) rec.text = "That rival no longer exists.";
      else {
        rec.tn = LedgerApp.rivalTN(d.task, r);
        rec.success = total >= rec.tn || nat === 20;
        if (d.task === "shadow") {
          if (rec.success) { const g = nat === 20 ? 30 : 15; r.intel = clamp(r.intel + g, 0, 100); rec.text = `${r.name}: intel +${g} (now ${r.intel}).`; }
          else rec.text = `Your agent loses ${r.name}'s trail.`;
        } else if (d.task === "court") {
          if (rec.success) { r.courted = 2; rec.text = `${r.name}'s board warms to you: +3 to your next offer.`; }
          else rec.text = `${r.name}'s board is unmoved.`;
        } else if (!(r.plan && r.intel >= INTEL_PLAN)) {
          rec.success = false; rec.text = `No known plan to foil at ${r.name} (intel ${INTEL_PLAN}+ and a plan are required).`;
        } else if (rec.success) { r.plan.blocked = true; rec.text = `${r.name}'s plan is foiled before it starts.`; }
        else rec.text = `You fail to disrupt ${r.name}'s plan.`;
      }
    } else if (def.needs === "division") {
      const dv = s.divisions.find(x => x.id === d.targetId);
      if (!dv) rec.text = "That division no longer exists.";
      else {
        rec.tn = LedgerApp.divisionTN(s);
        rec.success = total >= rec.tn || nat === 20;
        if (rec.success) { const g = nat === 20 ? 40 : 20; dv.integration = Math.min(100, dv.integration + g); rec.text = `${dv.name}: integration +${g}% (now ${dv.integration}%).`; }
        else rec.text = `Integration of ${dv.name} stalls.`;
      }
    } else if (def.needs === "branch") {
      const b = s.branches.find(x => x.id === d.targetId);
      if (!b) rec.text = "That branch no longer exists.";
      else if (!user.isGM && b.userId !== d.userId) rec.text = "That is not your branch.";
      else {
        rec.tn = branchTN(b);
        rec.success = total >= rec.tn || nat === 20;
        if (rec.success) { const g = b.tier * 50 * (nat === 20 ? 2 : 1); b.venture += g; rec.text = `${b.name}: the venture pays off, +${g} income this month.`; }
        else { const l = b.tier * 10 * (nat === 1 ? 3 : 1); b.venture -= l; rec.text = `${b.name}: the venture sours, −${l} income this month.`; }
      }
    } else if (def.needs) {
      const e = s.events.find(x => x.id === d.targetId && x.kind === def.needs);
      if (!e) { rec.text = "The target problem no longer exists."; }
      else {
        rec.tn = threatTN(e, s);
        rec.success = total >= rec.tn || nat === 20;
        if (rec.success) {
          s.events = s.events.filter(x => x.id !== e.id);
          s.stats[e.kind === "internal" ? "resolvedInternal" : "resolvedExternal"] += 1;
          rec.text = `${e.title} resolved!`;
        } else rec.text = `${e.title} resists (needed ${rec.tn}).`;
      }
    } else {
      rec.tn = taskTarget(lvl);
      rec.success = total >= rec.tn || nat === 20;
      if (d.task === "marketing") {
        if (rec.success) { rec.income = lvl * 25 * (nat === 20 ? 2 : 1); rec.text = `Campaign lands: +${rec.income} income.`; }
        else rec.text = "The campaign fizzles.";
      } else if (d.task === "morale") {
        if (rec.success) { rec.mor = nat === 20 ? 10 : 5; rec.text = `Crew cheers: +${rec.mor} morale.`; }
        else rec.text = "The speech falls flat.";
      }
    }
    if (nat === 1) { rec.income -= lvl * 5; rec.text += ` Complication! ${-lvl * 5} income.`; }
    s.tasks.push(rec);
    const fx = nat === 1 ? { fx: "shake", power: 3 } : (rec.success ? { fx: "coins" } : {});
    await LedgerApp.commit(s);
    await ChatMessage.create({
      content: `<div class="cel-chat ${rec.success ? "win" : "loss"}">
      <h3>⚙ ${rec.who}: ${rec.label}</h3><p>Rolled <b>${total}</b> vs <b>${rec.tn}</b> — ${rec.success ? "SUCCESS" : "FAILED"}</p><p>${rec.text}</p></div>`,
      flags: { [MID]: fx }
    });
  }

  static async onCloseMonth() {
    if (!game.user.isGM) return;
    const s = getState(), fx0 = forecast(s), pf = perkFx(s);
    const ok = await DialogV2.confirm({
      window: { title: "Close the Month" },
      content: `<p>Close month ${s.month}? Expected profit: <b>${fx0.profit}</b> (events ${fx0.evInc >= 0 ? "+" : ""}${fx0.evInc}, tasks ${fx0.taskInc >= 0 ? "+" : ""}${fx0.taskInc}, routes ${fx0.routeNet >= 0 ? "+" : ""}${fx0.routeNet} expected, divisions ${fx0.divNet >= 0 ? "+" : ""}${fx0.divNet}, branch tithes +${fx0.branchInc}, rival drag −${fx0.drag}, spy ops −${fx0.spyCost}).<br>Trade routes, contract crews, spy operations, branches and rival attacks will be rolled now; contracts pay only on completion.</p>`
    });
    if (!ok) return;
    try {
      dbg("close month: start", { month: s.month, cash: s.cash });
      const { results, ambushes } = await LedgerApp.resolveRoutes(s);
      dbg("routes", results);
      const con = await LedgerApp.resolveContracts(s);
      dbg("contracts", con);
      const spy = await LedgerApp.resolveIntrigue(s);
      dbg("intrigue", spy);
      const br = await LedgerApp.resolveBranches(s);
      dbg("branches", br);
      const f = forecast(s, results, con, spy, br);
      dbg("forecast", f);
      const delta = (f.profit >= 0 ? 5 : -8) + f.evMor + f.taskMor + f.placeMor + con.mor + f.perkMor + spy.mor + f.divMor;
      const active = s.events.map(e => e.title), doneTasks = s.tasks.length;
      const activeThreats = s.events.filter(e => eventImpact(e) < 0 || e.mor < 0).length;
      s.staff.forEach(p => p.happiness = clamp(p.happiness + delta, 0, 100));
      s.cash += f.profit;
      s.history.push({ month: s.month, income: f.income, costs: f.costs, profit: f.profit });
      if (f.profit > 0) { s.stats.profitMonths += 1; s.stats.streak += 1; if (activeThreats >= 3) s.stats.pressure += 1; }
      else s.stats.streak = 0;
      const escalated = [];
      s.events = s.events.filter(e => {
        if (e.months > 0) { e.months -= 1; return e.months > 0; }
        if ((e.inc < 0 || e.mor < 0) && e.level < 10 && !pf.noEscalate) { e.level += 1; escalated.push(e.title); }
        return true;
      });
      const divLines = [], divEvents = [];
      for (const d of s.divisions) {
        const c = divisionCalc(d, s);
        d.integration = Math.min(100, d.integration + c.growth);
        if (d.integration >= 100 && !d.done) { d.done = true; s.stats.integrated += 1; divLines.push(`🧩 ${d.name} is fully integrated: +25% income from now on.`); }
        else if (d.integration < 50 && !s.events.some(e => e.divisionId === d.id) && Math.random() < 0.15) {
          divEvents.push({ id: uid(), title: `Culture clash at ${d.name}`, kind: "internal", level: 2, inc: -8, mor: -1, months: 0, divisionId: d.id, desc: `Staff of ${d.name} resist the new ways of working.` });
          divLines.push(`⚠ Culture clash at ${d.name}.`);
        }
      }
      if (s.divisions.length >= 2 && !s.events.some(e => e.title === "Antitrust inquiry") && Math.random() < 0.08 * s.divisions.length) {
        divEvents.push({ id: uid(), title: "Antitrust inquiry", kind: "external", level: 3, inc: -10, mor: 0, months: 0, desc: "Regulators wonder how many companies one house should own." });
        divLines.push("⚠ Regulators open an antitrust inquiry.");
      }
      dbg("divisions", divLines);
      s.events.push(...ambushes, ...spy.events, ...divEvents);
      s.routes.forEach(r => { r.escort = 0; });
      updateMarket(s);
      s.contracts.forEach(c => { if (c.status === "offered") c.offerMonths -= 1; });
      s.contracts = s.contracts.filter(c => c.status !== "offered" || c.offerMonths > 0);
      const newOffers = genOffers(s);
      s.tasks = [];
      const month = s.month;
      s.month += 1;
      dbg("saving state", { month: s.month, cash: s.cash });
      await LedgerApp.commit(s);
      const avg = avgMorale(s);
      const win = f.profit >= 0;
      const routeLines = results.map(r => `<li>${r.icon} ${r.name}: d20 ${r.nat} (${r.total} vs ${r.tn}) — <b>${r.outcome.toUpperCase()}</b> ${r.net >= 0 ? "+" : ""}${r.net}</li>`).join("");
      const conLines = [
        ...con.done.map(c => `<li>📜 ${c.title}: <b>DELIVERED</b> +${c.pay}, reputation +${c.rep}</li>`),
        ...con.failed.map(c => `<li>📜 ${c.title}: <b>MISSED THE DEADLINE</b> −${contractPenalty(c)}, reputation −8</li>`)
      ].join("");
      const brLines = br.lines.map(l => `<li>${l}</li>`).join("");
      const spyLines = spy.lines.map(l => `<li>${l}</li>`).join("");
      const dLines = divLines.map(l => `<li>${l}</li>`).join("");
      const shakeIt = ambushes.length || con.failed.length || spy.events.length || spy.lines.some(l => l.includes("EXPOSED"));
      await ChatMessage.create({
        content: `<div class="cel-chat ${win ? "win" : "loss"}">
          <h3>⚙ ${s.name} — Month ${month} Report</h3>
          <p>Income <b>${f.income}</b> (events ${f.evInc >= 0 ? "+" : ""}${f.evInc}, tasks ${f.taskInc >= 0 ? "+" : ""}${f.taskInc}, routes ${f.routeNet >= 0 ? "+" : ""}${f.routeNet}, contracts ${f.conNet >= 0 ? "+" : ""}${f.conNet}, divisions ${f.divNet >= 0 ? "+" : ""}${f.divNet}, branch tithes +${f.branchInc}, rival drag −${f.drag}) · Costs <b>${f.costs}</b></p>
          ${f.interest || f.salaries ? `<p>🎩 Executives: interest +${f.interest}, salaries −${f.salaries}</p>` : ""}
          <p class="stamp">${win ? "PROFIT" : "LOSS"} ${f.profit}</p>
          <p>Treasury: <b>${s.cash}</b> · Crew morale ${mood(avg)} ${avg}% (${delta > 0 ? "+" : ""}${delta}${f.placeMor ? `, quarters +${f.placeMor}` : ""}) · Tasks done: ${doneTasks} · Reputation ${s.reputation} (${repTier(s.reputation)})</p></div>`,
        flags: { [MID]: shakeIt ? { fx: "shake", power: Math.max(4, ...ambushes.map(a => a.level), ...spy.events.map(e => e.level)) } : (f.profit > 0 || con.done.length ? { fx: "coins" } : (f.profit < 0 ? { fx: "shake", power: 5 } : {})) }
      });
      if (routeLines || conLines || brLines || newOffers.length || active.length || ambushes.length || escalated.length) {
        await ChatMessage.create({ content: `<div class="cel-chat ${win ? "win" : "loss"}"><h3>🚂 Operations — Month ${month}</h3>
          ${routeLines ? `<ul class="routes">${routeLines}</ul>` : ""}
          ${conLines ? `<ul class="routes">${conLines}</ul>` : ""}
          ${brLines ? `<p>Branch offices:</p><ul class="routes">${brLines}</ul>` : ""}
          ${newOffers.length ? `<p>📜 New offers: ${newOffers.map(c => c.title).join(", ")}</p>` : ""}
          ${active.length ? `<p>Active: ${active.join(", ")}</p>` : ""}
          ${ambushes.length ? `<p class="warn">⚠ Ambush: ${ambushes.map(a => a.title).join(", ")}</p>` : ""}
          ${escalated.length ? `<p class="warn">⚠ Worsening: ${escalated.join(", ")}</p>` : ""}</div>` });
      }
      if (spyLines || dLines) {
        await ChatMessage.create({ content: `<div class="cel-chat ${win ? "win" : "loss"}"><h3>🕵 Intrigue &amp; Divisions — Month ${month}</h3>
          ${spyLines ? `<p>Heat ${s.heat}:</p><ul class="routes">${spyLines}</ul>` : ""}
          ${dLines ? `<ul class="routes">${dLines}</ul>` : ""}</div>` });
      }
      dbg("close month: done");
    } catch (e) {
      console.error(`${MID} | month close failed`, e);
      ui.notifications.error(`Month close failed: ${e.message}. Check the console (F12). If it failed before saving, nothing changed.`);
    }
  }
}
