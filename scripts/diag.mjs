import { MID, DEFAULT_STATE, migrateState, uid, clamp, makeFloor, makeRoute, makeContract, makeRival, makeDivision, makeBranch, EVENT_TABLE,
  forecast, routeCalc, opCalc, dealCalc, divisionCalc, defenseRating, perkFx, perkPoints, genOffers, syncFloors, updateMarket, branchCalc, branchOp, branchMonth, branchTierCap, SEATS } from "./data.mjs";

export const dbg = (...a) => { try { if (game.settings.get(MID, "debug")) console.log("CEL |", ...a); } catch (e) { /* settings not ready */ } };

// A fully populated fake business used by the self-test. It never touches the saved world state.
export function makeSandbox() {
  const s = foundry.utils.deepClone(DEFAULT_STATE());
  s.level = 4; s.cash = 3000; s.reputation = 55; s.month = 7; s.heat = 30;
  const mk = (name, spec, h) => ({ id: uid(), uuid: "", name, img: "icons/svg/mystery-man.svg", role: "Worker", spec, wage: 50, happiness: h });
  s.staff = [mk("Ada", "stealth", 80), mk("Bram", "craft", 70), mk("Cora", "combat", 60), mk("Dex", "trade", 55), mk("Eli", "diplomacy", 25), mk("Fay", "", 90)];
  SEATS.forEach((k, i) => { s.exec[k] = s.staff[i].id; s.perks[k] = 1 + (i % 3); });
  s.places = [
    { id: uid(), uuid: "", name: "Corner Shop", img: "icons/svg/city.svg", upkeep: 50, bonus: 100, floors: [] },
    { id: uid(), uuid: "", name: "Tower", img: "icons/svg/city.svg", upkeep: 20, bonus: 0, floors: [makeFloor("shop", { name: "Ground", order: 0 }), makeFloor("quarters", { name: "Top", order: 2 })] }
  ];
  s.routes = [makeRoute({ name: "Sky Lane", good: "crystals", mode: "airship", cargo: 300, legs: 2, master: s.staff[5].id }), makeRoute({ name: "Rail Link", good: "ore", mode: "rail" })];
  s.market = { textiles: { pct: 10, last: 3 }, crystals: { pct: -12, last: -4 } };
  const active = makeContract(s, { status: "active", crew: [s.staff[1].id, s.staff[3].id], progress: 1, level: 3 });
  s.contracts = [makeContract(s), active];
  const hostile = makeRival({ name: "Hostile Co", strength: 5, aggression: 2, intel: 60, plan: { kind: "theft", blocked: false } });
  const neutral = makeRival({ name: "Neutral Co", strength: 3, aggression: 0, boss: "Old Boss" });
  s.rivals = [hostile, neutral];
  s.ops = [
    { id: uid(), rivalId: hostile.id, kind: "steal", crew: [s.staff[0].id], active: true },
    { id: uid(), rivalId: hostile.id, kind: "sabotage", crew: [s.staff[0].id], active: true },
    { id: uid(), rivalId: neutral.id, kind: "surveil", crew: [], active: true }
  ];
  s.guards = [s.staff[2].id];
  s.divisions = [makeDivision(makeRival({ name: "Absorbed Ltd", strength: 4 }), "buyout", 3)];
  s.divisions[0].headId = s.staff[1].id;
  s.branches = [
    makeBranch("u1", { name: "Harbour Office", focus: "trade", tier: 3, staff: 2, cash: 900, growth: 12, stance: "grow", paid: 300 }),
    makeBranch("u2", { name: "Foundry Annex", focus: "craft", tier: 2, staff: 1, cash: 150, stance: "harvest", venture: 50 }),
    makeBranch("u3", { name: "Quiet Desk", focus: "intel", tier: 1 })
  ];
  s.events = [{ id: uid(), ...EVENT_TABLE[0], level: 3 }, { id: uid(), ...EVENT_TABLE[5], level: 2 }, { id: uid(), ...EVENT_TABLE[4], level: 2 },
    { id: uid(), title: "Ambush", kind: "external", level: 2, inc: -6, mor: -1, months: 0, routeId: s.routes[0].id, desc: "test" }];
  s.tasks = [{ id: uid(), userId: "u", userName: "Tester", who: "Tester", task: "marketing", label: "Marketing Campaign", total: 15, nat: 12, tn: 9, income: 100, mor: 0, success: true, text: "ok" }];
  s.history = [{ month: 5, income: 500, costs: 400, profit: 100 }, { month: 6, income: 600, costs: 450, profit: 150 }];
  s.contractLog = [{ month: 6, title: "Old job", client: "X", outcome: "done", amount: 200 }];
  s.dealLog = [{ month: 5, text: "Acquired something for 900" }]; s.spyLog = [{ month: 6, text: "A spy thing happened" }];
  s.achievements = { firstProfit: { month: 3 } };
  return migrateState(s);
}

export async function runSelfTest(App) {
  const results = [];
  const step = async (group, name, fn) => {
    const t0 = performance.now();
    try {
      const note = await fn();
      const warn = typeof note === "string" && note.startsWith("WARN:");
      results.push({ group, name, status: warn ? "warn" : "ok", note: warn ? note.slice(5).trim() : (note ?? ""), ms: Math.round(performance.now() - t0) });
    } catch (e) {
      console.error(`${MID} self-test | ${group}: ${name}`, e);
      results.push({ group, name, status: "fail", note: e?.message ?? String(e), ms: Math.round(performance.now() - t0) });
    }
  };
  const need = (label, v) => { if (!v) throw new Error(`${label} is missing`); };
  const sb = makeSandbox();

  // ---- Foundry API ----
  await step("Foundry API", "Application classes", () => { need("ApplicationV2", foundry.applications.api.ApplicationV2); need("HandlebarsApplicationMixin", foundry.applications.api.HandlebarsApplicationMixin); need("DialogV2", foundry.applications.api.DialogV2); return `Foundry ${game.version}`; });
  await step("Foundry API", "Canvas effects", () => { need("CanvasShakeEffect", foundry.canvas?.animation?.CanvasShakeEffect); need("ParticleGenerator", foundry.canvas?.animation?.ParticleGenerator); need("PIXI.BLEND_MODES", PIXI?.BLEND_MODES); });
  await step("Foundry API", "Audio", () => { need("AudioHelper", foundry.audio?.AudioHelper); });
  await step("Foundry API", "Handlebars helpers", () => {
    for (const h of ["selectOptions", "checked", "gte"]) need(`Handlebars helper ${h}`, Handlebars.helpers[h]);
  });
  await step("Foundry API", "renderTemplate", () => { need("renderTemplate", foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate); });
  await step("Foundry API", "Socket and GM", () => { need("game.socket", game.socket); return game.users.activeGM ? `Active GM: ${game.users.activeGM.name}` : "WARN: no active GM is online (player tasks and branch commands will be refused)"; });
  await step("Foundry API", "Scene Levels", () => {
    const sc = game.scenes?.contents?.[0];
    if (!sc) return "WARN: no scenes to inspect";
    return "levels" in sc ? `Scene "${sc.name}" exposes levels (${[...(sc.levels ?? [])].length})` : "WARN: Scene has no 'levels' property; floor import will not work";
  });

  // ---- Assets ----
  await step("Assets", "code-only build", () =>
    "v1.7: UI + FX ship zero binary assets — textures are CSS gradients, crest/gears are inline SVG, particle sprites are canvas-drawn, audio is WebAudio-synthesized");
  await step("Assets", "stylesheet loaded", () => {
    const ok = [...document.styleSheets].some(ss => { try { return ss.href?.includes(MID); } catch (e) { return false; } });
    return ok ? "" : "WARN: the module stylesheet was not found on the page";
  });

  // ---- Rules engine (pure calculations on the sandbox) ----
  await step("Rules", "perkFx / perkPoints", () => { const fx = perkFx(sb), pp = perkPoints(sb); if (!Number.isFinite(pp.left)) throw new Error("bad perk points"); return `${pp.earned} points earned, salaries ${fx.salaries}`; });
  await step("Rules", "forecast", () => { const f = forecast(sb); for (const [k, v] of Object.entries(f)) if (!Number.isFinite(v)) throw new Error(`${k} is ${v}`); return `profit ${f.profit}`; });
  await step("Rules", "routeCalc x2", () => sb.routes.map(r => { const c = routeCalc(r, sb); if (!Number.isFinite(c.expectedNet)) throw new Error("NaN"); return c.expectedNet; }).join(", "));
  await step("Rules", "opCalc x3", () => sb.ops.map(o => { const c = opCalc(o, sb); if (!(c.pOk >= 0)) throw new Error("bad odds"); return Math.round(c.pOk * 100) + "%"; }).join(", "));
  await step("Rules", "dealCalc / divisionCalc", () => { const a = dealCalc(sb.rivals[0], sb, "buyout"), b = dealCalc(sb.rivals[1], sb, "merger"), d = divisionCalc(sb.divisions[0], sb); return `buyout ${a.price}@${Math.round(a.pOk * 100)}%, merger ${b.price}, division net ${d.net}`; });
  await step("Rules", "defenseRating", () => `total ${defenseRating(sb).total}`);
  await step("Rules", "contracts and offers", () => { const c = foundry.utils.deepClone(sb); c.contracts = []; return `${genOffers(c).length} offer(s) generated`; });
  await step("Rules", "market", () => { const c = foundry.utils.deepClone(sb); updateMarket(c); return Object.keys(c.market).length + " goods"; });
  await step("Rules", "syncFloors (fake scene)", () => {
    const place = { floors: [] };
    const n = syncFloors(place, { levels: [{ id: "a", name: "Cellar", elevation: { bottom: -1 } }, { id: "b", name: "Ground", elevation: { bottom: 0 } }, { id: "c", name: "Attic", elevation: { bottom: 2 } }] });
    if (n !== 3 || place.floors.length !== 3) throw new Error(`expected 3 floors, got ${place.floors.length}`);
    return place.floors.map(f => f.type).join(" / ");
  });
  await step("Rules", "branchCalc x3", () => sb.branches.map(b => { const c = branchCalc(b, sb); if (!Number.isFinite(c.profit)) throw new Error("NaN"); return `${b.name}: profit ${c.profit}, tithe ${c.tithe}`; }).join("; "));
  await step("Rules", "branch tier cap follows company rank", () => {
    const caps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(l => branchTierCap({ level: l }));
    const want = [2, 2, 3, 3, 4, 4, 5, 5, 5, 5];
    if (caps.join() !== want.join()) throw new Error(`caps were ${caps.join()} , expected ${want.join()}`);
    return caps.join(" ");
  });
  await step("Rules", "branch commands", () => {
    const c = foundry.utils.deepClone(sb); c.level = 6;
    const mine = c.branches[0], other = c.branches[1];
    const t = (op, p, user, gm, expect) => { const r = branchOp(c, op, { branchId: mine.id, ...p }, user, gm); if (r.ok !== expect) throw new Error(`${op} ${expect ? "should succeed" : "should be refused"}: ${r.msg}`); return r; };
    t("stance", { stance: "harvest" }, "u1", false, true);
    t("stance", { stance: "bogus" }, "u1", false, false);
    t("stance", { stance: "grow" }, "u2", false, false);
    t("hire", {}, "u1", false, true);
    t("dividend", { amount: 99999 }, "u1", false, false);
    t("dividend", { amount: 5 }, "u1", false, false);
    const d = t("dividend", { amount: 50 }, "u1", false, true);
    if (d.gold !== 5) throw new Error(`expected 5 gold, got ${d.gold}`);
    t("upgrade", {}, "u1", false, true);
    const r = branchOp(c, "dividend", { branchId: other.id, amount: 100 }, "gm", true);
    if (r.ok) throw new Error("dividend above the reserve floor should be refused");
    const low = foundry.utils.deepClone(sb);
    const blocked = branchOp(low, "upgrade", { branchId: low.branches[0].id }, "u1", false);
    if (blocked.ok) throw new Error("upgrade past the company-rank cap should be refused");
    return `tier ${mine.tier}, cash ${mine.cash}; cap message: ${blocked.msg}`;
  });

  // ---- Month close engines on a disposable copy ----
  const mc = foundry.utils.deepClone(sb);
  await step("Month close", "resolveRoutes", async () => { const r = await App.resolveRoutes(mc); mc._r = r.results; return `${r.results.length} run, ${r.ambushes.length} ambush`; });
  await step("Month close", "resolveContracts", async () => { const c = await App.resolveContracts(mc); mc._c = c; return `${c.done.length} delivered, ${c.failed.length} failed`; });
  await step("Month close", "resolveIntrigue", async () => { const i = await App.resolveIntrigue(mc); mc._i = i; return `${i.lines.length} log line(s), ${i.events.length} new threat(s)`; });
  await step("Month close", "resolveBranches", async () => { const b = await App.resolveBranches(mc); mc._b = b; return `${b.lines.length} branch line(s), tithe ${b.income}`; });
  await step("Month close", "forecast with results", () => { const f = forecast(mc, mc._r, mc._c, mc._i, mc._b); if (!Number.isFinite(f.profit)) throw new Error("profit is not a number"); return `profit ${f.profit}`; });
  await step("Month close", "branchMonth edge cases", () => {
    const b = makeBranch("u1", { tier: 5, staff: 10, cash: -300, stance: "harvest", morale: 2 });
    for (const nat of [1, 20, 10]) { const r = branchMonth(b, sb, nat); if (!Number.isFinite(r.profit) || b.cash < -300) throw new Error(`bad result for nat ${nat}`); }
    return `cash ${b.cash}, morale ${b.morale}`;
  });

  // ---- Dial gauges ----
  await step("Interface", "dial gauges", () => {
    const rich = App.makeGauges(forecast(sb), 80), poor = App.makeGauges({ income: 0, costs: 900, profit: -900 }, 0), edge = App.makeGauges({ income: NaN, costs: 1e9, profit: 1e9 }, 140);
    for (const g of [...rich, ...poor, ...edge]) {
      if (![g.angle, g.arc, g.pct].every(Number.isFinite)) throw new Error(`gauge ${g.key} has a non-numeric value`);
      if (g.angle < -90 || g.angle > 90) throw new Error(`gauge ${g.key} needle out of range (${g.angle})`);
    }
    return `angles ${rich.map(g => g.angle).join(", ")}`;
  });

  // ---- Migration ----
  await step("Data", "migrateState repairs bad data", () => {
    const bad = foundry.utils.mergeObject(DEFAULT_STATE(), { level: "x", dividendRate: "zzz", staff: [{ id: "a", happiness: "zz" }], contracts: [{ crew: ["ghost"] }], events: [{ routeId: "missing", level: 99 }], rivals: [{ id: "r" }], ops: [{ rivalId: "nope", crew: [] }], guards: ["ghost"], branches: [{ id: "b", tier: 99, staff: 99, stance: "zzz", focus: "qqq", tithe: "x" }] }, { inplace: false });
    const m = migrateState(bad);
    const br = m.branches[0];
    if (m.level !== 1 || m.dividendRate !== 10 || m.staff[0].happiness !== 50 || m.contracts[0].crew.length || m.events.length || m.ops.length || m.guards.length) throw new Error("migration did not repair the damaged state");
    if (br.tier !== 5 || br.staff !== 10 || br.stance !== "steady" || br.focus !== "trade" || br.tithe !== 20) throw new Error("migration did not repair the damaged branch");
  });
  await step("Data", "Saved world state loads", () => { const raw = game.settings.get(MID, "state"); const n = JSON.stringify(raw ?? {}).length; return `${(n / 1024).toFixed(1)} KB saved`; });

  // ---- Templates ----
  const render = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  const path = `modules/${MID}/templates/ledger.hbs`;
  const tabs = ["overview", "tasks", "staff", "execs", "places", "routes", "contracts", "spies", "deals", "branches", "events", "trophies"];
  const fresh = migrateState(foundry.utils.deepClone(DEFAULT_STATE()));
  for (const [label, state, isGM, userId] of [["full, GM", sb, true, "tester"], ["full, owner", sb, false, "u1"], ["full, other player", sb, false, "u9"], ["empty, GM", fresh, true, "tester"]]) {
    for (const tab of tabs) {
      await step("Templates", `${tab} (${label})`, async () => {
        const html = await render(path, App.buildContext(state, tab, { isGM, userId }));
        if (!html || html.length < 300) throw new Error("rendered almost nothing");
        const text = html.replace(/<[^>]+>/g, " ");
        const bad = text.match(/undefined|NaN|\[object Object\]/g);
        return bad ? `WARN: found ${bad.length} suspicious text value(s): ${[...new Set(bad)].join(", ")}` : `${Math.round(html.length / 1024)} KB`;
      });
    }
  }

  // ---- Actions and icons ----
  await step("Actions", "action names", async () => {
    const mine = Object.keys(App.DEFAULT_OPTIONS.actions), builtin = Object.keys(foundry.applications.api.ApplicationV2.DEFAULT_OPTIONS.actions ?? {});
    const clash = mine.filter(a => builtin.includes(a));
    if (clash.length) throw new Error(`clash with built-in actions: ${clash.join(", ")}`);
    const txt = await (await fetch(path)).text();
    const used = [...new Set([...txt.matchAll(/data-action="(\w+)"/g)].map(m => m[1]))];
    const missing = used.filter(a => !mine.includes(a));
    if (missing.length) throw new Error(`template uses actions with no handler: ${missing.join(", ")}`);
    return `${used.length} actions wired`;
  });
  await step("Interface", "icon sprite", async () => {
    const txt = await (await fetch(path)).text();
    const defined = new Set([...txt.matchAll(/<symbol id="(i-[\w-]+)"/g)].map(m => m[1]));
    const used = [...new Set([...txt.matchAll(/<use href="#(i-[\w-]+)"/g)].map(m => m[1]))];
    const missing = used.filter(i => !defined.has(i));
    if (missing.length) throw new Error(`icons used but not defined: ${missing.join(", ")}`);
    return `${used.length} icons in use`;
  });

  const bad = results.filter(r => r.status === "fail"), warn = results.filter(r => r.status === "warn");
  console.table(results.map(r => ({ group: r.group, test: r.name, status: r.status, note: r.note })));
  return { results, ok: results.length - bad.length - warn.length, warn: warn.length, fail: bad.length };
}

export function reportHtml(rep) {
  const icon = { ok: "✅", warn: "⚠️", fail: "❌" };
  const rows = rep.results.filter(r => r.status !== "ok" || r.group !== "Templates").map(r =>
    `<tr class="${r.status}"><td>${icon[r.status]}</td><td>${r.group}</td><td>${r.name}</td><td>${(r.note ?? "").toString().replace(/</g, "&lt;")}</td></tr>`).join("");
  const tpl = rep.results.filter(r => r.group === "Templates");
  const tplOk = tpl.filter(r => r.status === "ok").length;
  return `<div class="cel-selftest"><p><b>${rep.ok} passed, ${rep.warn} warning(s), ${rep.fail} failure(s).</b>
    ${rep.fail ? "Copy the lines marked ❌ (and anything red in the F12 console) when you report a bug." : "Everything checked out."}</p>
    <p class="muted">Templates: ${tplOk} of ${tpl.length} rendered cleanly (only problems are listed). No saved data was changed.</p>
    <div style="max-height:52vh;overflow:auto"><table class="cel-table left"><thead><tr><th></th><th>Area</th><th>Test</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
