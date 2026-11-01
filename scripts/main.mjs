import { LedgerApp } from "./app.mjs";
import { MID, DEFAULT_STATE } from "./data.mjs";
import { playFx } from "./fx.mjs";

Hooks.once("init", () => {
  if (!Handlebars.helpers.gte) Handlebars.registerHelper("gte", (a, b) => Number(a) >= Number(b));
  game.settings.register(MID, "state", {
    scope: "world", config: false, type: Object, default: DEFAULT_STATE(),
    onChange: () => LedgerApp.instance?.render()
  });
  game.settings.register(MID, "banner", {
    name: "CEL.SetBanner", hint: "CEL.SetBannerHint", scope: "world", config: true, type: String, default: "", filePicker: "image",
    onChange: () => LedgerApp.instance?.render()
  });
  game.settings.register(MID, "theme", {
    name: "CEL.SetTheme", hint: "CEL.SetThemeHint", scope: "world", config: true, type: String, default: "walnut",
    choices: { walnut: "CEL.ThemeWalnut", verdigris: "CEL.ThemeVerdigris", noir: "CEL.ThemeNoir" },
    onChange: () => LedgerApp.instance?.render()
  });
  game.settings.register(MID, "tpl", {
    name: "CEL.SetTpl", hint: "CEL.SetTplHint", scope: "world", config: true, type: String, default: "",
    onChange: () => LedgerApp.instance?.render()
  });
  game.settings.register(MID, "fx", { name: "CEL.SetFx", hint: "CEL.SetFxHint", scope: "client", config: true, type: Boolean, default: true });
  game.settings.register(MID, "sound", { name: "CEL.SetSound", hint: "CEL.SetSoundHint", scope: "client", config: true, type: Boolean, default: true });
  game.settings.register(MID, "volume", {
    name: "CEL.SetVolume", scope: "client", config: true, type: new foundry.data.fields.NumberField({ min: 0, max: 1, step: 0.05, initial: 0.5 }), default: 0.5
  });
  game.settings.register(MID, "debug", { name: "CEL.SetDebug", hint: "CEL.SetDebugHint", scope: "client", config: true, type: Boolean, default: false });
  game.keybindings.register(MID, "open", {
    name: "CEL.Open", editable: [{ key: "KeyL", modifiers: ["Alt"] }],
    onDown: () => { LedgerApp.toggle(); return true; }
  });
  const mod = game.modules.get(MID);
  if (mod) mod.api = { open: () => LedgerApp.open(), toggle: () => LedgerApp.toggle(), selfTest: () => LedgerApp.onSelfTest() };
});

Hooks.once("ready", () => {
  // Players send their requests to the active GM client, which validates and applies them.
  game.socket.on(`module.${MID}`, data => {
    if (!(game.user.isGM && game.user === game.users.activeGM)) return;
    if (data?.type === "branch") LedgerApp.applyBranchOp(data);
    else LedgerApp.applyTask(data);
  });
});

Hooks.on("createChatMessage", msg => playFx(msg.flags?.[MID]));

Hooks.on("getSceneControlButtons", controls => {
  // Official v14 shape: Record keyed by control name; token group is "tokens" (plural),
  // tools object-keyed. Older builds: array of groups / singular "token".
  const tool = { name: "celLedger", title: "CEL.Open", icon: "fa-solid fa-gears",
    order: 99, button: true, visible: true, onClick: () => LedgerApp.toggle(), onChange: () => LedgerApp.toggle() };
  const add = g => {
    if (!g) return false;
    if (Array.isArray(g.tools)) g.tools.push(tool);
    else (g.tools ??= {})[tool.name] = tool;
    return true;
  };
  if (add(controls?.tokens ?? controls?.token)) return;
  const list = Array.isArray(controls) ? controls
    : controls instanceof Map ? [...controls.values()]
    : Object.values(controls ?? {});
  add(list.find(g => g?.name === "tokens" || g?.name === "token") ?? list[0]);
});
