export const MID = "cypher-enterprise-ledger";
export const SCHEMA = 3;
export const SEATS = ["treasurer", "quartermaster", "spymaster", "engineer", "envoy"];
export const DEFAULT_STATE = () => ({
  schema: SCHEMA,
  name: "Aether Works & Co.", level: 1, cash: 1000, month: 1,
  staff: [], places: [], history: [], events: [], tasks: [], routes: [], market: {},
  contracts: [], contractLog: [], reputation: 20,
  rivals: [], ops: [], guards: [], heat: 0, spyLog: [],
  pcs: [], week: 1, weekLog: [], momentum: { production: 0, trade: 0 },
  divisions: [], dealLog: [],
  branches: [], branchTithe: 20, dividendRate: 10,
  exec: { treasurer: "", quartermaster: "", spymaster: "", engineer: "", envoy: "" },
  perks: { treasurer: 0, quartermaster: 0, spymaster: 0, engineer: 0, envoy: 0 },
  achievements: {},
  stats: { profitMonths: 0, streak: 0, resolvedInternal: 0, resolvedExternal: 0, nat20: 0, pressure: 0, tradeRuns: 0, tradeProfit: 0, ambushes: 0,
    contractsDone: 0, contractsFailed: 0, contractEarnings: 0, bigContract: 0, opsDone: 0, opsExposed: 0, sabotages: 0, defended: 0,
    acquisitions: 0, mergers: 0, integrated: 0 }
});
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const uid = () => foundry.utils.randomID(8);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function migrateState(s) {
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  s.level = clamp(num(s.level, 1), 1, 10); s.cash = num(s.cash, 0); s.month = Math.max(1, num(s.month, 1));
  s.reputation = clamp(num(s.reputation, 20), 0, 100); s.heat = clamp(num(s.heat, 0), 0, 100);
  s.branchTithe = clamp(num(s.branchTithe, 20), 0, 60); s.dividendRate = clamp(num(s.dividendRate, 10), 1, 100);
  for (const k of ["staff", "places", "history", "events", "tasks", "routes", "contracts", "contractLog", "rivals", "ops", "guards", "spyLog", "divisions", "dealLog", "branches"])
    if (!Array.isArray(s[k])) s[k] = [];
  s.market ??= {}; s.achievements ??= {};
  const ids = new Set(s.staff.map(p => p.id));
  s.staff.forEach(p => { p.happiness = clamp(num(p.happiness, 50), 0, 100); p.wage = num(p.wage, 50); p.spec ??= ""; p.role ??= "Worker"; });
  s.rivals.forEach(r => {
    r.strength = clamp(num(r.strength, 3), 1, 10); r.secrecy = clamp(num(r.secrecy, 3), 1, 10);
    r.aggression = clamp(num(r.aggression, 1), 0, 3); r.intel = clamp(num(r.intel, 0), 0, 100);
    r.premium = num(r.premium, 0); r.courted = num(r.courted, 0); r.wary = num(r.wary, 0); r.stunned = num(r.stunned, 0);
  });
  const rivalIds = new Set(s.rivals.map(r => r.id));
  s.ops = s.ops.filter(o => rivalIds.has(o.rivalId));
  s.ops.forEach(o => { o.crew = (o.crew ?? []).filter(id => ids.has(id)); if (!OP_KINDS[o.kind]) o.kind = "surveil"; });
  s.guards = s.guards.filter(id => ids.has(id));
  if (!Array.isArray(s.pcs)) s.pcs = [];
  if (!Array.isArray(s.weekLog)) s.weekLog = [];
  s.week = Math.max(1, num(s.week, 1));
  s.momentum ??= {}; s.momentum.production = clamp(num(s.momentum.production, 0), 0, 3); s.momentum.trade = clamp(num(s.momentum.trade, 0), 0, 3);
  s.pcs.forEach(p => { if (!PC_ROLES[p.role]) p.role = "agent"; p.adj = clamp(num(p.adj, 0), -2, 2); if (!PC_TASKS[p.task]) p.task = "rest"; });
  s.contracts.forEach(c => { c.crew = (c.crew ?? []).filter(id => ids.has(id)); c.progress = Math.max(0, num(c.progress, 0)); });
  s.routes.forEach(r => { if (r.master && !ids.has(r.master)) r.master = ""; if (!GOODS[r.good]) r.good = "textiles"; if (!MODES[r.mode]) r.mode = "wagon"; });
  s.exec ??= {}; s.perks ??= {};
  for (const k of SEATS) { if (s.exec[k] && !ids.has(s.exec[k])) s.exec[k] = ""; s.exec[k] ??= ""; s.perks[k] = clamp(num(s.perks[k], 0), 0, 3); }
  s.divisions.forEach(d => { if (d.headId && !ids.has(d.headId)) d.headId = ""; d.integration = clamp(num(d.integration, 0), 0, 100); });
  s.branches.forEach(b => {
    b.tier = clamp(Math.round(num(b.tier, 1)), 1, 5); b.staff = clamp(Math.round(num(b.staff, 0)), 0, b.tier * 2);
    b.cash = num(b.cash, 0); b.morale = clamp(num(b.morale, 60), 0, 100); b.growth = Math.max(0, num(b.growth, 0)); b.venture = num(b.venture, 0);
    b.paid = Math.max(0, num(b.paid, 0)); b.tithe = clamp(num(b.tithe, s.branchTithe), 0, 60);
    if (!BRANCH_STANCES[b.stance]) b.stance = "steady"; if (!BRANCH_FOCI[b.focus]) b.focus = "trade";
    if (!Array.isArray(b.history)) b.history = [];
  });
  const routeIds = new Set(s.routes.map(r => r.id)), divIds = new Set(s.divisions.map(d => d.id));
  s.events = s.events.filter(e => (!e.routeId || routeIds.has(e.routeId)) && (!e.rivalId || rivalIds.has(e.rivalId)) && (!e.divisionId || divIds.has(e.divisionId)));
  s.events.forEach(e => { e.level = clamp(num(e.level, 1), 1, 10); });
  s.schema = SCHEMA;
  return s;
}
export const getState = () => migrateState(foundry.utils.mergeObject(DEFAULT_STATE(), game.settings.get(MID, "state") ?? {}, { inplace: false }));
export async function saveState(state) {
  if (!game.user.isGM) return ui.notifications.warn("Only the GM can change the ledger.");
  state.schema = SCHEMA;
  return game.settings.set(MID, "state", state);
}
export const mood = h => h >= 80 ? "😄" : h >= 60 ? "🙂" : h >= 40 ? "😐" : h >= 20 ? "😠" : "💀";
export const avgMorale = s => s.staff.length ? Math.round(s.staff.reduce((n, p) => n + p.happiness, 0) / s.staff.length) : 0;

// ---- Branch offices ----
export const BRANCH_FOCI = {
  trade: { label: "Trade", icon: "🧭", syn: "+1 to every HQ trade route roll (max +2)" },
  craft: { label: "Craft", icon: "🔧", syn: "+1 to HQ contract crew rolls (max +2)" },
  service: { label: "Service", icon: "🎩", syn: "+5% HQ contract rewards (max +10%)" },
  intel: { label: "Intelligence", icon: "🕵", syn: "+1 HQ defence rating (max +2)" }
};
export const BRANCH_STANCES = {
  grow: { label: "Expand", icon: "🌱", mult: 0.8, morale: 2, growth: 3, desc: "−20% income, morale +2, growth +3 a month." },
  steady: { label: "Steady", icon: "⚖", mult: 1, morale: 0, growth: 1, desc: "Normal income, growth +1 a month." },
  harvest: { label: "Harvest", icon: "💰", mult: 1.25, morale: -5, growth: 0, desc: "+25% income, morale −5, no growth." }
};
export const BRANCH_RATES = { tier: 60, staff: 45, wage: 30, upkeep: 25 };
export const branchFocusChoices = () => Object.fromEntries(Object.entries(BRANCH_FOCI).map(([k, v]) => [k, `${v.icon} ${v.label}`]));
export const HIRE_COST = 100, DIVIDEND_FLOOR = 100;
export const branchTierCap = s => Math.min(5, Math.ceil(s.level / 2) + 1);
export const dividendGold = (amount, s) => Math.floor(amount / Math.max(1, s.dividendRate ?? 10));
export const branchTN = b => Math.min(18, 6 + 2 * b.tier);
export function makeBranch(userId, extra = {}) {
  return { id: uid(), userId, name: "Branch Office", sceneUuid: "", focus: "trade", tier: 1, staff: 0, cash: 200, morale: 60, growth: 0,
    stance: "steady", tithe: 20, venture: 0, paid: 0, history: [], ...extra };
}
export function branchCalc(b, s) {
  const st = BRANCH_STANCES[b.stance] ?? BRANCH_STANCES.steady, low = b.morale < 30 ? 0.7 : 1, R = BRANCH_RATES;
  const base = b.tier * R.tier, crew = Math.round(b.staff * R.staff * low);
  const gross = Math.round((base + crew) * st.mult) + (b.venture || 0);
  const costs = b.staff * R.wage + b.tier * R.upkeep, profit = gross - costs;
  const pct = b.tithe ?? s.branchTithe ?? 20, tithe = Math.max(0, Math.round(profit * pct / 100));
  const need = 4 * b.tier, upCost = 250 * b.tier, cap = branchTierCap(s), atCap = b.tier >= cap;
  return { gross, costs, profit, tithe, keep: profit - tithe, need, upCost, hireCap: b.tier * 2, tierCap: cap, atCap,
    canHire: b.staff < b.tier * 2 && b.cash >= HIRE_COST, canUpgrade: b.tier < 5 && !atCap && b.growth >= need && b.cash >= upCost,
    maxDividend: Math.max(0, Math.floor(b.cash - DIVIDEND_FLOOR)), lowMorale: b.morale < 30 };
}
export function branchOp(s, op, p, userId, isGM) {
  const b = s.branches.find(x => x.id === p.branchId);
  const fail = msg => ({ ok: false, msg });
  if (!b) return fail("That branch no longer exists.");
  if (!isGM && b.userId !== userId) return fail("That is not your branch.");
  if (op === "stance") {
    if (!BRANCH_STANCES[p.stance]) return fail("Unknown stance.");
    b.stance = p.stance;
    return { ok: true, msg: `${b.name} switches to ${BRANCH_STANCES[p.stance].label}.`, branch: b };
  }
  if (op === "hire") {
    if (b.staff >= b.tier * 2) return fail(`${b.name} has no room for more staff at tier ${b.tier}.`);
    if (b.cash < HIRE_COST) return fail(`Hiring costs ${HIRE_COST} from the branch treasury.`);
    b.cash -= HIRE_COST; b.staff += 1;
    return { ok: true, msg: `${b.name} hires local staff (${b.staff}/${b.tier * 2}).`, branch: b };
  }
  if (op === "upgrade") {
    if (b.tier >= 5) return fail(`${b.name} is already at the top tier.`);
    const cap = branchTierCap(s);
    if (b.tier >= cap) return fail(`The company is only rank ${s.level}: branches can reach tier ${cap} until it grows.`);
    const need = 4 * b.tier, cost = 250 * b.tier;
    if (b.growth < need) return fail(`Needs ${need} growth (has ${b.growth}). Use the Expand stance to grow faster.`);
    if (b.cash < cost) return fail(`Upgrading costs ${cost} from the branch treasury.`);
    b.cash -= cost; b.tier += 1; b.growth -= need;
    return { ok: true, msg: `${b.name} grows to tier ${b.tier}!`, branch: b, fx: "achieve" };
  }
  if (op === "dividend") {
    const amt = Math.floor(Number(p.amount) || 0), max = Math.max(0, Math.floor(b.cash - DIVIDEND_FLOOR)), rate = Math.max(1, s.dividendRate ?? 10);
    if (amt <= 0) return fail("Enter an amount above zero.");
    if (amt > max) return fail(`Only ${max} can be drawn; the branch keeps ${DIVIDEND_FLOOR} in reserve.`);
    const gold = Math.floor(amt / rate);
    if (gold < 1) return fail(`At ${rate} ledger coins per gold piece, ${amt} is less than one gold piece.`);
    b.cash -= amt; b.paid += amt;
    return { ok: true, msg: `${b.name} pays its owner a dividend of ${amt} ledger coins (${gold} gold at ${rate}:1).`, branch: b, dividend: amt, gold, fx: "coins" };
  }
  return fail("Unknown command.");
}
export function branchMonth(b, s, nat) {
  const c = branchCalc(b, s), st = BRANCH_STANCES[b.stance] ?? BRANCH_STANCES.steady;
  let luck = 0, note = "";
  if (nat === 1) { luck = -b.tier * 40; note = "a local disaster"; } else if (nat === 20) { luck = b.tier * 60; note = "a windfall"; }
  const profit = c.profit + luck, pct = b.tithe ?? s.branchTithe ?? 20, tithe = Math.max(0, Math.round(profit * pct / 100));
  b.cash = Math.max(-300, b.cash + profit - tithe);
  b.growth += st.growth; b.morale = clamp(b.morale + st.morale + (b.cash <= -300 ? -5 : 0), 0, 100);
  b.history = [...(b.history ?? []), { month: s.month, profit, tithe }].slice(-6);
  b.venture = 0;
  return { profit, tithe, note };
}
const focusCount = (s, f) => Math.min(2, (s.branches ?? []).filter(b => b.focus === f && b.tier >= 2).length);

// ---- Executive perks ----
export const PERK_COSTS = [1, 2, 3];
export const salaryPer = s => 10 + 5 * s.level;
export const DORMANT_BELOW = 30;
export const SEAT_DEFS = {
  treasurer: { title: "Master of Coin", icon: "💰", tag: "Finance", perks: [
    { name: "Tight Ledgers", desc: "Wages −15%." },
    { name: "Investment Portfolio", desc: "+8% on base income and workshop bonuses." },
    { name: "Golden Reserve", desc: "1% monthly interest on the treasury (max 100)." }] },
  quartermaster: { title: "Quartermaster", icon: "🧭", tag: "Trade", perks: [
    { name: "Seasoned Drivers", desc: "+1 to every trade route roll." },
    { name: "Fleet Discount", desc: "Transport fees are waived." },
    { name: "Wider Network", desc: "+1 trade route slot." }] },
  spymaster: { title: "Spymaster", icon: "🕵", tag: "Security", perks: [
    { name: "Informants", desc: "New threats start 1 level lower and cost 20% less income. +1 defence rating." },
    { name: "Counter-Intelligence", desc: "Threat target numbers −3. +2 defence rating." },
    { name: "Shadow Network", desc: "No route ambushes from a natural 1, unresolved threats stop growing, +3 defence rating." }] },
  engineer: { title: "Chief Engineer", icon: "⚙", tag: "Works", perks: [
    { name: "Efficient Layouts", desc: "Workshop bonuses +15%." },
    { name: "Staff Canteen", desc: "+3 crew morale every month." },
    { name: "Master Works", desc: "+2 to contract crew rolls; new contracts get +1 month." }] },
  envoy: { title: "Envoy", icon: "🎩", tag: "Diplomacy", perks: [
    { name: "Golden Tongue", desc: "+2 reputation per delivered contract. +1 to takeover and merger offers." },
    { name: "Premium Clients", desc: "Contract rewards +20%. +2 to takeover and merger offers." },
    { name: "Guild Seat", desc: "+1 active contract slot. +3 to takeover and merger offers." }] }
};
export const execOf = (s, seat) => { const id = s.exec?.[seat]; return id ? (s.staff.find(p => p.id === id) ?? null) : null; };
export const seatActive = (s, seat) => { const e = execOf(s, seat); return !!e && e.happiness >= DORMANT_BELOW; };
export const perkTier = (s, seat) => seatActive(s, seat) ? (s.perks?.[seat] ?? 0) : 0;
export function perkFx(s) {
  const t = seat => perkTier(s, seat);
  return {
    wageMult: t("treasurer") >= 1 ? 0.85 : 1, incomeMult: t("treasurer") >= 2 ? 1.08 : 1, interest: t("treasurer") >= 3 ? 0.01 : 0,
    routeBonus: (t("quartermaster") >= 1 ? 1 : 0) + focusCount(s, "trade"), feeMult: t("quartermaster") >= 2 ? 0 : 1, routeSlots: t("quartermaster") >= 3 ? 1 : 0,
    threatDown: t("spymaster") >= 1 ? 1 : 0, threatDmg: t("spymaster") >= 1 ? 0.8 : 1, threatTN: t("spymaster") >= 2 ? 3 : 0,
    ambushImmune: t("spymaster") >= 3, noEscalate: t("spymaster") >= 3, defence: t("spymaster") + focusCount(s, "intel"),
    placeMult: t("engineer") >= 1 ? 1.15 : 1, moraleFlat: t("engineer") >= 2 ? 3 : 0, crewBonus: (t("engineer") >= 3 ? 2 : 0) + focusCount(s, "craft"), deadlineBonus: t("engineer") >= 3 ? 1 : 0,
    repBonus: t("envoy") >= 1 ? 2 : 0, rewardMult: (t("envoy") >= 2 ? 1.2 : 1) * (1 + 0.05 * focusCount(s, "service")), contractSlots: t("envoy") >= 3 ? 1 : 0, dealBonus: t("envoy"),
    salaries: SEATS.filter(k => execOf(s, k)).length * salaryPer(s)
  };
}
export function perkPoints(s) {
  const earned = 1 + (s.level - 1) + Math.floor(s.stats.contractsDone / 2) + Math.floor(Object.keys(s.achievements ?? {}).length / 3) + Math.floor(s.stats.tradeRuns / 5);
  const spent = SEATS.reduce((n, k) => n + PERK_COSTS.slice(0, s.perks?.[k] ?? 0).reduce((a, b) => a + b, 0), 0);
  return { earned, spent, left: earned - spent };
}
export const threatTN = (e, s) => Math.max(2, e.level * 3 - perkFx(s).threatTN);

export const EVENT_TABLE = [
  { kind: "internal", title: "Boiler breakdown", inc: -12, mor: -2, months: 0, desc: "A key aether boiler fails. Production crawls until it is fixed." },
  { kind: "internal", title: "Crew strike", inc: -15, mor: -6, months: 0, desc: "The crew downs tools and demands better treatment." },
  { kind: "internal", title: "Embezzling clerk", inc: -10, mor: 0, months: 0, desc: "Coins vanish from the ledger. Someone inside is skimming." },
  { kind: "internal", title: "Workshop fire", inc: -18, mor: -3, months: 2, desc: "A spark meets volatile aether. Repairs take time." },
  { kind: "internal", title: "Brilliant invention", inc: 14, mor: 3, months: 3, desc: "An inspired engineer improves the product line.", good: true },
  { kind: "external", title: "Rival guild undercuts you", inc: -14, mor: -1, months: 0, desc: "A competing house slashes prices and poaches clients." },
  { kind: "external", title: "Corporate spy", inc: -10, mor: -2, months: 0, desc: "Someone is copying your blueprints and routes." },
  { kind: "external", title: "Market crash", inc: -20, mor: -2, months: 3, desc: "Demand for your goods collapses across the city." },
  { kind: "external", title: "Inspector's levy", inc: -8, mor: 0, months: 1, desc: "The city inspectors want their cut." },
  { kind: "external", title: "Trade boom", inc: 16, mor: 2, months: 3, desc: "A festival and open ports bring eager buyers.", good: true }
];

export const TASKS = {
  marketing: { label: "Marketing Campaign", desc: "Boost this month's income.", needs: null },
  morale: { label: "Rally the Crew", desc: "Raise crew morale.", needs: null },
  repair: { label: "Repair & Maintain", desc: "Fix an internal problem.", needs: "internal" },
  counter: { label: "Counter Rivals & Spies", desc: "Deal with an external danger.", needs: "external" },
  escort: { label: "Escort a Caravan", desc: "Guard a trade route: +3 to its roll this month.", needs: "route" },
  work: { label: "Work a Contract", desc: "Add progress to an active guild contract.", needs: "contract" },
  shadow: { label: "Shadow a Rival", desc: "Gather intel on a rival company (+15).", needs: "rival" },
  foil: { label: "Foil a Rival Plan", desc: "Stop a rival's known plan this month (needs intel 40+).", needs: "rival" },
  court: { label: "Court a Rival's Board", desc: "Win friends: +3 to your next takeover or merger offer.", needs: "rival" },
  integrate: { label: "Integrate a Division", desc: "Blend an acquired company into yours (+20 integration).", needs: "division" },
  venture: { label: "Run a Local Venture", desc: "Gamble on your branch: +50 × tier income this month on success.", needs: "branch" }
};
export const taskTarget = level => Math.min(18, 3 * (Math.ceil(level / 2) + 1));

// ── PC duty: player-character roles & weekly tasks ─────────────────────────
// PCs are linked by drag-drop (Actor uuid). A PC holds a role (gives +1 on matching
// task domains) and is assigned one weekly task. Closing the week rolls d20 +
// role/skill/tuning bonus vs the task TN; effects feed the monthly economy via
// momentum tokens (production/trade) or immediate changes (morale, heat, progress, intel).
export const PC_ROLES = {
  foreman:   { label: "Foreman of Works", icon: "🔧", domains: ["production", "workers"] },
  broker:    { label: "Trade Broker",     icon: "⚖", domains: ["trade"] },
  warden:    { label: "Chief Warden",     icon: "🛡", domains: ["security", "workers"] },
  spymaster: { label: "Spymaster",        icon: "🕵", domains: ["espionage"] },
  envoy:     { label: "Envoy",            icon: "🎩", domains: ["contracts", "trade"] },
  agent:     { label: "Free Agent",       icon: "🎲", domains: [] }
};

export const PC_TASKS = {
  rest:       { label: "Rest / Lay Low",   icon: "🛋", tn: 0,  skills: [],                                                            desc: "No duty this week." },
  production: { label: "Boost Production", icon: "⚙", tn: 12, skills: ["craft", "smith", "machin", "engineer", "build", "repair"],   desc: "+1 production token: +10 income next month." },
  workers:    { label: "Care for the Crew",icon: "🍲", tn: 10, skills: ["heal", "persuad", "cook", "lead", "comfort"],               desc: "Cure an injured worker, else crew morale +4." },
  trade:      { label: "Ride the Trade",   icon: "🚂", tn: 12, skills: ["persuad", "decept", "bargain", "barter", "navigat"],         desc: "+1 trade token: +1 on each route roll next month." },
  security:   { label: "Patrol & Watch",   icon: "🛡", tn: 12, skills: ["percept", "stealth", "combat", "track", "guard"],            desc: "Heat −5." },
  contracts:  { label: "Push Contracts",   icon: "📜", tn: 12, skills: ["persuad", "decept", "negotiat", "intellect"],                desc: "+1 progress on the least-advanced active contract." },
  espionage:  { label: "Dirty Work",       icon: "🕵", tn: 14, skills: ["stealth", "decept", "lockpick", "investigat", "intrud"],     desc: "+5 intel on the most shadowy rival." }
};

export const pcRoleChoices = () => Object.fromEntries(Object.entries(PC_ROLES).map(([k, v]) => [k, `${v.icon} ${v.label}`]));
export const pcTaskChoices = () => Object.fromEntries(Object.entries(PC_TASKS).map(([k, v]) => [k, v.tn ? `${v.icon} ${v.label} (TN ${v.tn})` : `${v.icon} ${v.label}`]));

// Best matching skill level (−1..+2) on the PC's Cypher sheet for this task kind.
export function pcSkillLevel(actor, kind) {
  const names = PC_TASKS[kind]?.skills ?? [];
  if (!actor?.items || !names.length) return 0;
  const MAP = { inability: -1, untrained: 0, trained: 1, specialized: 2 };
  let best = 0;
  for (const it of actor.items) {
    if (it.type !== "skill") continue;
    const n = String(it.name ?? "").toLowerCase();
    if (!names.some(s => n.includes(s))) continue;
    const raw = it.system?.skillLevel ?? it.system?.level ?? 0;
    const lv = typeof raw === "string" ? (MAP[raw.toLowerCase()] ?? 0) : Number(raw) || 0;
    best = Math.max(best, clamp(Math.round(lv), -1, 2));
  }
  return best;
}

// Role match (+1) + sheet skill (−1..+2) + manual tuning (−2..+2).
export function pcTaskBonus(pc, actor, kind) {
  const rb = PC_ROLES[pc.role]?.domains?.includes(kind) ? 1 : 0;
  return rb + pcSkillLevel(actor, kind) + clamp(Number(pc.adj) || 0, -2, 2);
}

// Apply a successful weekly task. mult = 2 on a critical. Returns a log detail string.
export function applyPcTask(s, kind, mult = 1) {
  s.momentum ??= { production: 0, trade: 0 };
  switch (kind) {
    case "production":
      s.momentum.production = clamp(s.momentum.production + mult, 0, 3);
      return `+${mult} production token${mult > 1 ? "s" : ""} (+${10 * mult} income next month)`;
    case "trade":
      s.momentum.trade = clamp(s.momentum.trade + mult, 0, 3);
      return `+${1 * mult} trade token${mult > 1 ? "s" : ""} (+${mult} on each route next month)`;
    case "workers": {
      const hurt = s.staff.find(p => p.injured);
      if (hurt) { hurt.injured = false; hurt.happiness = clamp(hurt.happiness + 6, 0, 100); return `${hurt.name} recovers from injury`; }
      s.staff.forEach(p => p.happiness = clamp(p.happiness + 4 * mult, 0, 100));
      return `crew morale +${4 * mult}`;
    }
    case "security":
      s.heat = clamp(s.heat - 5 * mult, 0, 100);
      return `heat −${5 * mult} (now ${s.heat})`;
    case "contracts": {
      const act = s.contracts.filter(c => c.status === "active");
      if (!act.length) return "no active contracts — goodwill banked";
      act.sort((a, b) => a.progress / a.required - b.progress / b.required);
      const c = act[0];
      c.progress = Math.min(c.required, c.progress + 1 * mult);
      return `📜 ${c.title} +${mult} progress (${c.progress}/${c.required})`;
    }
    case "espionage": {
      if (!s.rivals.length) return "no rivals — the agents idle";
      const r = [...s.rivals].sort((a, b) => a.intel - b.intel)[0];
      r.intel = clamp(r.intel + 5 * mult, 0, 100);
      return `🕵 ${r.name} intel +${5 * mult} (${r.intel}${r.intel >= INTEL_PLAN ? ", plan known" : ""})`;
    }
  }
  return "";
}
export const eventImpact = (e, s = null) => {
  const v = (Number(e.inc) || 0) * (Number(e.level) || 1);
  return s && v < 0 ? Math.round(v * perkFx(s).threatDmg) : v;
};

// ---- Floors ----
export const FLOOR_TYPES = {
  workshop: { label: "Workshop", upkeep: 40, bonus: 80, mor: 0 },
  lab: { label: "Aether Lab", upkeep: 60, bonus: 130, mor: 0 },
  office: { label: "Counting Office", upkeep: 30, bonus: 60, mor: 0 },
  shop: { label: "Shopfront", upkeep: 40, bonus: 100, mor: 0 },
  storage: { label: "Warehouse", upkeep: 20, bonus: 30, mor: 0 },
  quarters: { label: "Crew Quarters", upkeep: 25, bonus: 0, mor: 3 }
};
export const floorTypeChoices = () => Object.fromEntries(Object.entries(FLOOR_TYPES).map(([k, v]) => [k, v.label]));

export function placeTotals(p) {
  const all = p.floors ?? [], act = all.filter(f => f.active);
  return {
    upkeep: (Number(p.upkeep) || 0) + act.reduce((n, f) => n + (Number(f.upkeep) || 0), 0),
    bonus: (Number(p.bonus) || 0) + act.reduce((n, f) => n + (Number(f.bonus) || 0), 0),
    mor: act.reduce((n, f) => n + (FLOOR_TYPES[f.type]?.mor ?? 0), 0),
    floorCount: all.length, active: act.length
  };
}
export function levelsOf(scene) {
  const list = [...(scene?.levels ?? [])].map(l => ({
    id: l.id, name: l.name || "Level",
    order: Number(l.elevation?.bottom ?? l.elevation ?? l.sort ?? l.index ?? 0) || 0
  }));
  return list.sort((a, b) => b.order - a.order);
}
export function makeFloor(type, extra = {}) {
  const t = FLOOR_TYPES[type];
  return { id: uid(), levelId: "", name: "Floor", order: 0, type, upkeep: t.upkeep, bonus: t.bonus, active: true, ...extra };
}
export function syncFloors(place, scene) {
  const lv = levelsOf(scene);
  place.floors ??= [];
  const ids = new Set(lv.map(l => l.id));
  place.floors = place.floors.filter(f => !f.levelId || ids.has(f.levelId));
  lv.forEach((l, i) => {
    const ex = place.floors.find(f => f.levelId === l.id);
    if (ex) { ex.name = l.name; ex.order = l.order; return; }
    const type = lv.length > 1 && i === lv.length - 1 ? "shop" : (lv.length > 1 && i === 0 ? "quarters" : "workshop");
    place.floors.push(makeFloor(type, { levelId: l.id, name: l.name, order: l.order }));
  });
  return lv.length;
}

// ---- Guild contracts ----
export const CONTRACT_TYPES = {
  craft: { label: "Craft", icon: "🔧" }, trade: { label: "Trade", icon: "⚖" }, stealth: { label: "Stealth", icon: "🕶" },
  diplomacy: { label: "Diplomacy", icon: "🤝" }, combat: { label: "Security", icon: "🛡" }
};
export const specChoices = () => ({ "": "— none —", ...Object.fromEntries(Object.entries(CONTRACT_TYPES).map(([k, v]) => [k, `${v.icon} ${v.label}`])) });
export const contractTypeChoices = () => Object.fromEntries(Object.entries(CONTRACT_TYPES).map(([k, v]) => [k, `${v.icon} ${v.label}`]));
export const CLIENTS = ["Baroness Voss", "Guildmaster Pell", "Captain Ashgrove", "Inventor Tilda Brass", "Magistrate Orrin", "Madame Quill", "Lord Harrow", "Archivist Penn", "Foreman Dagg", "The Veiled Patron"];
export const CONTRACT_TEMPLATES = [
  { type: "craft", title: "Bespoke Clockwork Automaton", desc: "A client wants a custom automaton assembled to exacting specifications." },
  { type: "craft", title: "Aether Lamps for the Opera House", desc: "Hundreds of glowing lamps, delivered and fitted before the season opens." },
  { type: "trade", title: "Bulk Supply Contract", desc: "Steady deliveries of goods to a hungry district. Reliability matters most." },
  { type: "trade", title: "Emergency Shipment", desc: "A shortage has the city in a panic. Whoever delivers first wins fortune and favor." },
  { type: "stealth", title: "Retrieve the Stolen Blueprints", desc: "Someone walked off with a client's designs. Get them back quietly." },
  { type: "stealth", title: "Quiet Observation", desc: "Watch a rival house and report. Nobody must know you were there." },
  { type: "diplomacy", title: "Negotiate a Merger", desc: "Two proud houses refuse to talk to each other. You need to be the go-between." },
  { type: "diplomacy", title: "Smooth Over a Scandal", desc: "A client's reputation hangs by a thread. Discretion and charm required." },
  { type: "combat", title: "Guard the Gala", desc: "A glittering event, a long guest list, and one rumoured assassin." },
  { type: "combat", title: "Clear the Foundry Rats", desc: "Something large and mechanical has moved into an abandoned foundry." }
];
export const contractTN = c => Math.min(19, 4 + 2 * clamp(Number(c.level) || 1, 1, 10));
export const contractCap = s => 1 + Math.floor((s.level + 1) / 3) + perkFx(s).contractSlots;
export const crewBonus = (p, c, s = null) => Math.round((p.happiness ?? 50) / 20) + (p.spec && p.spec === c.type ? 2 : 0) + (s ? perkFx(s).crewBonus : 0);
export const repTier = r => r >= 75 ? "Renowned" : r >= 50 ? "Respected" : r >= 25 ? "Known" : "Unknown";
export const offerCount = rep => clamp(1 + Math.floor(rep / 30), 1, 4);
export const contractPenalty = c => Math.round((Number(c.reward) || 0) * 0.4);

export function makeContract(s, extra = {}) {
  const rep = s.reputation ?? 20, t = pick(CONTRACT_TEMPLATES);
  const level = clamp(Math.round(s.level / 1.5 + rep / 35 + (Math.floor(Math.random() * 3) - 1)), 1, 10);
  return { id: uid(), status: "offered", title: t.title, desc: t.desc, type: t.type, client: pick(CLIENTS), clientUuid: "", clientImg: "",
    level, reward: Math.round((60 + 70 * level) * (0.9 + Math.random() * 0.3)), required: 2 + Math.ceil(level / 2),
    months: 2 + Math.ceil(level / 2) + perkFx(s).deadlineBonus, progress: 0, crew: [], offerMonths: 2, repReward: 3 + level, ...extra };
}
export function genOffers(s) {
  const have = s.contracts.filter(c => c.status === "offered").length, out = [];
  for (let i = have; i < offerCount(s.reputation); i++) { const c = makeContract(s); s.contracts.push(c); out.push(c); }
  return out;
}
export const busyCrew = s => new Set([
  ...s.contracts.filter(c => c.status === "active").flatMap(c => c.crew),
  ...(s.ops ?? []).filter(o => o.active).flatMap(o => o.crew),
  ...(s.guards ?? [])
]);

// ---- Corporate espionage ----
export const OP_KINDS = {
  surveil: { label: "Surveil", icon: "🔭", cost: 25, tnMod: -2, heat: 1, desc: "Intel +20 (natural 20: +40). Intel fades 5 a month without a surveillance operation." },
  steal: { label: "Steal designs", icon: "📐", cost: 50, tnMod: 2, heat: 8, desc: "Sell stolen plans for strength × 20 × (1 + intel/100). Target turns wary: next steal is harder for 2 months." },
  sabotage: { label: "Sabotage", icon: "🧨", cost: 75, tnMod: 4, heat: 10, desc: "Rival strength −1 (natural 20: 2) and it is stunned for 2 months: no attacks, no drag." }
};
export const RIVAL_ACTIONS = {
  theft: { label: "Industrial theft", icon: "🕳" },
  sabotage: { label: "Sabotage", icon: "💣" },
  pricewar: { label: "Price war", icon: "⚔" }
};
export const RIVAL_NAMES = ["Brassguard Syndicate", "Vantablack Foundry", "House Ormolu", "The Cog & Crown", "Gilt & Gear Ltd.", "Sable Aetherworks", "Ironvale Combine", "Pendulum & Sons"];
export const opKindChoices = () => Object.fromEntries(Object.entries(OP_KINDS).map(([k, v]) => [k, `${v.icon} ${v.label} (${v.cost})`]));
export const INTEL_PLAN = 40;
export const GUARD_VALUE = 3;

export function makeRival(extra = {}) {
  return { id: uid(), name: pick(RIVAL_NAMES), boss: "", img: "", uuid: "", strength: 3, secrecy: 3, aggression: 1, intel: 0, plan: null, wary: 0, stunned: 0, premium: 0, courted: 0, ...extra };
}
export const rivalDrag = (r, s) => (r.stunned > 0 || !(r.aggression > 0) ? 0 : Math.max(0, (Number(r.strength) || 0) * 6 - 3 * s.level));

export function defenseRating(s) {
  const guards = (s.guards ?? []).map(id => s.staff.find(p => p.id === id)).filter(Boolean);
  const gv = guards.reduce((n, p) => n + GUARD_VALUE + (p.spec === "stealth" || p.spec === "combat" ? 1 : 0), 0);
  const base = 2 + Math.floor(s.level / 2), perk = perkFx(s).defence;
  return { total: base + gv + perk, base, guards: gv, perk, guardList: guards };
}
export function opCalc(op, s) {
  const rival = (s.rivals ?? []).find(r => r.id === op.rivalId), kind = OP_KINDS[op.kind] ?? OP_KINDS.surveil;
  const crew = (op.crew ?? []).map(id => s.staff.find(p => p.id === id)).filter(Boolean);
  const best = crew.reduce((m, p) => Math.max(m, Math.round(p.happiness / 20) + (p.spec === "stealth" ? 2 : 0)), 0);
  const intelB = rival ? Math.floor(rival.intel / 25) : 0;
  const bonus = crew.length ? best + (crew.length - 1) + intelB : 0;
  const wary = op.kind === "steal" && rival && rival.wary > 0 ? 3 : 0;
  const tn = rival ? clamp(5 + 2 * rival.secrecy + kind.tnMod + wary, 2, 19) : 19;
  let wins = 0;
  for (let nat = 1; nat <= 20; nat++) if (nat === 20 || (nat > 1 && nat + bonus >= tn)) wins++;
  return { rival, kind, crew, bonus, tn, wary: wary > 0, cost: kind.cost, pOk: wins / 20, running: !!op.active && !!rival && crew.length > 0 };
}

// ---- Acquisitions & mergers ----
export const DEAL_KINDS = { buyout: { label: "Takeover", icon: "🏛" }, merger: { label: "Merger", icon: "🤝" } };
export const premiumChoices = () => ({ "0": "No premium", "25": "+25% price (+3 to the roll)", "50": "+50% price (+6 to the roll)" });
export function dealCalc(r, s, kind) {
  const prem = Number(r.premium) || 0, fx = perkFx(s);
  const base = r.strength * 250 * (1 - clamp(r.intel, 0, 100) / 300);
  const price = Math.round(base * (kind === "merger" ? 0.4 : 1) * (1 + prem / 100));
  const fee = Math.round(price * 0.1);
  const bonus = Math.floor(s.reputation / 20) + fx.dealBonus + Math.floor(r.intel / 25) + (r.courted > 0 ? 3 : 0) + Math.floor(prem / 25) * 3 + Math.floor(s.level / 2);
  const tn = clamp(6 + 2 * r.secrecy + 2 * r.aggression + (kind === "buyout" ? 2 : 0), 2, 19);
  let wins = 0;
  for (let nat = 1; nat <= 20; nat++) if (nat === 20 || (nat > 1 && nat + bonus >= tn)) wins++;
  const blocked = kind === "merger" && r.aggression > 1 ? "Too hostile to merge (aggression 2+)" : (s.cash < price ? "Not enough cash" : "");
  return { kind, price, fee, bonus, tn, pOk: wins / 20, blocked };
}
export function makeDivision(r, kind, month) {
  return { id: uid(), name: r.name, img: r.img, uuid: r.uuid, baseStrength: r.strength, kind, integration: 0, headId: "", done: false, since: month };
}
export function divisionCalc(d, s) {
  const f = d.kind === "merger" ? 0.6 : 1;
  const head = s.staff.find(p => p.id === d.headId);
  const income = Math.round(d.baseStrength * 15 * f * (0.5 + d.integration / 200) * (d.integration >= 100 ? 1.25 : 1));
  const upkeep = Math.round(d.baseStrength * 6 * f);
  return { income, upkeep, net: income - upkeep, mor: d.integration < 50 ? -1 : 0, headName: head?.name ?? "", growth: 10 + (head ? 5 : 0), divestValue: Math.round(d.baseStrength * 100 * f) };
}

// ---- Trade routes ----
export const GOODS = {
  textiles: { label: "Aether-woven Textiles", margin: 0.28, risk: 1 },
  ore: { label: "Brass & Ore", margin: 0.34, risk: 2 },
  spirits: { label: "Spirits & Spices", margin: 0.42, risk: 2 },
  machinery: { label: "Clockwork Machinery", margin: 0.52, risk: 3 },
  crystals: { label: "Aether Crystals", margin: 0.70, risk: 4 },
  relics: { label: "Contraband Relics", margin: 0.90, risk: 6 }
};
export const MODES = {
  wagon: { label: "Steam Wagon", icon: "🚜", risk: 1, margin: 1.0, fee: 0.05 },
  rail: { label: "Aether Rail", icon: "🚂", risk: -1, margin: 0.95, fee: 0.10 },
  airship: { label: "Airship", icon: "🎈", risk: 0, margin: 1.3, fee: 0.15 }
};
export const goodChoices = () => Object.fromEntries(Object.entries(GOODS).map(([k, v]) => [k, v.label]));
export const modeChoices = () => Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, `${v.icon} ${v.label}`]));
export const routeCap = s => 1 + Math.ceil(s.level / 2) + perkFx(s).routeSlots;
export const cargoCap = s => 100 * (s.level + 1);

export function makeRoute(extra = {}) {
  return { id: uid(), name: "New Route", from: "Home", to: "Far Port", sceneUuid: "", good: "textiles", mode: "wagon",
    legs: 1, cargo: 100, master: "", riskMod: 0, active: true, escort: 0, ...extra };
}

export function routeCalc(r, s) {
  const fx = perkFx(s);
  const g = GOODS[r.good] ?? GOODS.textiles, m = MODES[r.mode] ?? MODES.wagon;
  const legs = clamp(Number(r.legs) || 1, 1, 5), cargo = clamp(Number(r.cargo) || 0, 0, cargoCap(s));
  const risk = clamp(g.risk + (legs - 1) + m.risk + (Number(r.riskMod) || 0), 1, 10);
  const tn = Math.min(18, 3 + Math.round(1.5 * risk));
  const master = s.staff.find(p => p.id === r.master);
  const masterBusy = !!master && busyCrew(s).has(master.id);
  const bonus = Math.min(9, (master && !masterBusy ? Math.round(master.happiness / 20) : 0) + (Number(r.escort) || 0) + fx.routeBonus);
  const marketPct = s.market?.[r.good]?.pct ?? 0;
  const margin = g.margin * m.margin * (1 + 0.25 * (legs - 1)) + (marketPct / 100) * 0.5;
  const spend = Math.round(cargo * (1 + m.fee * fx.feeMult));
  const revenue = Math.round(cargo * (1 + margin));
  const salvage = Math.round(cargo * 0.6);
  let sum = 0, wins = 0;
  for (let nat = 1; nat <= 20; nat++) {
    const win = nat === 20 || (nat > 1 && nat + bonus >= tn);
    if (win) wins++;
    sum += nat === 1 ? (fx.ambushImmune ? salvage : 0) : (nat === 20 ? revenue * 1.5 : (win ? revenue : salvage));
  }
  const expRev = Math.round(sum / 20);
  const blocked = (s.events ?? []).some(e => e.routeId === r.id);
  return { risk, tn, bonus, cargo, spend, revenue, salvage, pSucc: wins / 20, expRev, expectedNet: expRev - spend,
    blocked, running: !!r.active && !blocked, masterName: master?.name ?? "", masterBusy };
}
export function updateMarket(s) {
  s.market ??= {};
  for (const k of Object.keys(GOODS)) {
    const cur = s.market[k]?.pct ?? 0;
    const next = clamp(Math.round(cur * 0.8 + Math.floor(Math.random() * 21) - 10), -30, 30);
    s.market[k] = { pct: next, last: next - cur };
  }
}

export const ACHIEVEMENTS = [
  { id: "firstProfit", icon: "💰", title: "First Profit", desc: "Close a month with a profit.", test: s => s.stats.profitMonths >= 1 },
  { id: "streak3", icon: "📈", title: "Hot Streak", desc: "Three profitable months in a row.", test: s => s.stats.streak >= 3 },
  { id: "fullCrew", icon: "👥", title: "Full Crew", desc: "Employ 5 or more crew members.", test: s => s.staff.length >= 5 },
  { id: "happy", icon: "😄", title: "Happy Hands", desc: "Average morale 90%+ with at least 3 crew.", test: s => s.staff.length >= 3 && avgMorale(s) >= 90 },
  { id: "fixer", icon: "🔧", title: "Master Fixer", desc: "Resolve an internal problem.", test: s => s.stats.resolvedInternal >= 1 },
  { id: "rival", icon: "🕵", title: "Rival Breaker", desc: "Defeat an external danger.", test: s => s.stats.resolvedExternal >= 1 },
  { id: "lucky", icon: "🎲", title: "Lucky Break", desc: "Roll a natural 20 on a task.", test: s => s.stats.nat20 >= 1 },
  { id: "rich", icon: "🏦", title: "Fat Treasury", desc: "Hold 5000 in the treasury.", test: s => s.cash >= 5000 },
  { id: "rank5", icon: "⭐", title: "Rising Power", desc: "Reach rank 5.", test: s => s.level >= 5 },
  { id: "empire", icon: "🏭", title: "Industrial Empire", desc: "Own 3 or more workshops.", test: s => s.places.length >= 3 },
  { id: "pressure", icon: "🌪", title: "Under Pressure", desc: "Close a profitable month with 3+ active threats.", test: s => s.stats.pressure >= 1 },
  { id: "tower", icon: "🏙", title: "Aether Tower", desc: "Run a building with 3 or more active floors.", test: s => s.places.some(p => placeTotals(p).active >= 3) },
  { id: "caravan", icon: "🚂", title: "Caravan Master", desc: "Complete your first successful trade run.", test: s => s.stats.tradeRuns >= 1 },
  { id: "merchant", icon: "💎", title: "Merchant Prince", desc: "Earn 1000 total profit from trade runs.", test: s => s.stats.tradeProfit >= 1000 },
  { id: "network", icon: "🗺", title: "Trade Network", desc: "Run 3 trade routes at once.", test: s => s.routes.filter(r => r.active).length >= 3 },
  { id: "contractor", icon: "📜", title: "Contractor", desc: "Complete your first guild contract.", test: s => s.stats.contractsDone >= 1 },
  { id: "trusted", icon: "🤝", title: "Trusted Name", desc: "Reach 75 reputation.", test: s => s.reputation >= 75 },
  { id: "clean", icon: "✅", title: "Perfect Record", desc: "Complete 5 contracts without ever failing one.", test: s => s.stats.contractsDone >= 5 && s.stats.contractsFailed === 0 },
  { id: "bigClient", icon: "👑", title: "Big Client", desc: "Complete a level 7+ contract.", test: s => s.stats.bigContract >= 1 },
  { id: "board", icon: "🎩", title: "Board of Directors", desc: "Fill all five executive seats.", test: s => SEATS.every(k => execOf(s, k)) },
  { id: "mastermind", icon: "🧠", title: "Mastermind", desc: "Buy a tier 3 perk.", test: s => Object.values(s.perks ?? {}).some(v => v >= 3) },
  { id: "dagger", icon: "🗡", title: "Cloak & Dagger", desc: "Complete a successful spy operation.", test: s => s.stats.opsDone >= 1 },
  { id: "know", icon: "👁", title: "Know Thy Enemy", desc: "Reach intel 100 on a rival.", test: s => s.rivals.some(r => r.intel >= 100) },
  { id: "saboteur", icon: "🧨", title: "Saboteur", desc: "Succeed at 3 sabotage operations.", test: s => s.stats.sabotages >= 3 },
  { id: "curtain", icon: "🛡", title: "Iron Curtain", desc: "Repel or foil 3 rival attacks.", test: s => s.stats.defended >= 3 },
  { id: "takeover", icon: "🏛", title: "Hostile Takeover", desc: "Acquire a rival company.", test: s => s.stats.acquisitions >= 1 },
  { id: "merged", icon: "🤝", title: "Friendly Merger", desc: "Complete a merger.", test: s => s.stats.mergers >= 1 },
  { id: "conglom", icon: "🏰", title: "Conglomerate", desc: "Own 3 divisions at once.", test: s => s.divisions.length >= 3 },
  { id: "integrated", icon: "🧩", title: "Fully Integrated", desc: "Bring a division to 100% integration.", test: s => s.stats.integrated >= 1 },
  { id: "branch1", icon: "🏢", title: "Branch Office", desc: "Open the first branch office.", test: s => s.branches.length >= 1 },
  { id: "franchise", icon: "🏬", title: "Franchise", desc: "Run 3 branch offices at once.", test: s => s.branches.length >= 3 },
  { id: "tier5", icon: "🌆", title: "Regional Powerhouse", desc: "Grow a branch to tier 5.", test: s => s.branches.some(b => b.tier >= 5) },
  { id: "dividend", icon: "💵", title: "Fat Dividend", desc: "Pay branch owners 1000 ledger coins in dividends in total.", test: s => s.branches.reduce((n, b) => n + (b.paid || 0), 0) >= 1000 }
];
export function unlockAchievements(s) {
  s.achievements ??= {};
  const out = [];
  for (const a of ACHIEVEMENTS) if (!s.achievements[a.id] && a.test(s)) { s.achievements[a.id] = { month: s.month }; out.push(a); }
  return out;
}

export function forecast(s, routeRes = null, conRes = null, spyRes = null, brRes = null) {
  const fx = perkFx(s);
  const base = Math.round(s.level * 100 * fx.incomeMult);
  const pt = s.places.map(placeTotals);
  const bonus = Math.round(pt.reduce((n, p) => n + p.bonus, 0) * fx.placeMult * fx.incomeMult);
  const upkeep = pt.reduce((n, p) => n + p.upkeep, 0);
  const placeMor = pt.reduce((n, p) => n + p.mor, 0);
  const evInc = (s.events ?? []).reduce((n, e) => n + eventImpact(e, s), 0);
  const taskInc = (s.tasks ?? []).reduce((n, t) => n + (Number(t.income) || 0), 0);
  const taskMor = (s.tasks ?? []).reduce((n, t) => n + (Number(t.mor) || 0), 0);
  const wages = Math.round(s.staff.reduce((n, p) => n + (Number(p.wage) || 0), 0) * fx.wageMult);
  const evMor = (s.events ?? []).reduce((n, e) => n + (Number(e.mor) || 0), 0);
  let routeRev = 0, routeSpend = 0;
  if (routeRes) for (const r of routeRes) { routeRev += r.revenue; routeSpend += r.spend; }
  else for (const r of s.routes ?? []) { const c = routeCalc(r, s); if (c.running) { routeRev += c.expRev; routeSpend += c.spend; } }
  const conInc = conRes?.income ?? 0, conCost = conRes?.costs ?? 0;
  const drag = (s.rivals ?? []).reduce((n, r) => n + rivalDrag(r, s), 0);
  const spyInc = spyRes ? spyRes.income : 0;
  const spyCost = spyRes ? spyRes.costs : (s.ops ?? []).reduce((n, o) => { const c = opCalc(o, s); return n + (c.running ? c.cost : 0); }, 0);
  const dv = (s.divisions ?? []).map(d => divisionCalc(d, s));
  const divInc = dv.reduce((n, d) => n + d.income, 0), divCost = dv.reduce((n, d) => n + d.upkeep, 0), divMor = dv.reduce((n, d) => n + d.mor, 0);
  const branchInc = brRes ? brRes.income : (s.branches ?? []).reduce((n, b) => n + branchCalc(b, s).tithe, 0);
  const interest = fx.interest ? Math.min(100, Math.round(Math.max(0, s.cash) * fx.interest)) : 0;
  const momInc = (s.momentum?.production ?? 0) * 10;
  const income = base + bonus + momInc + evInc + taskInc + routeRev + conInc + interest + spyInc + divInc + branchInc - drag;
  const costs = wages + upkeep + routeSpend + conCost + fx.salaries + spyCost + divCost;
  return { income, costs, profit: income - costs, momInc, evInc, evMor, taskInc, taskMor, placeMor, routeRev, routeSpend, routeNet: routeRev - routeSpend,
    conInc, conCost, conNet: conInc - conCost, interest, salaries: fx.salaries, perkMor: fx.moraleFlat, drag, spyInc, spyCost, spyNet: spyInc - spyCost,
    divInc, divCost, divNet: divInc - divCost, divMor, branchInc };
}
