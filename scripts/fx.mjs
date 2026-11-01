import { MID } from "./data.mjs";
const opt = k => game.settings.get(MID, k);

/* ═══ v1.7 "pure code" FX ═══
   Particle sprites are drawn on an offscreen canvas at runtime (coin / spark),
   and every sound is synthesized with the WebAudio API. The module ships zero
   binary assets; call sites and settings are unchanged. */

// ---- procedural particle textures ----
const _tex = {};
function sprite(kind) {
  if (_tex[kind]) return _tex[kind];
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (kind === "coin") {
    const r = g.createRadialGradient(26, 24, 4, 32, 32, 30);
    r.addColorStop(0, "#ffe9a3"); r.addColorStop(.6, "#e9b94f"); r.addColorStop(1, "#8a5a16");
    g.fillStyle = r; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill();
    g.strokeStyle = "rgba(90,55,10,.9)"; g.lineWidth = 3;
    g.beginPath(); g.arc(32, 32, 21, 0, 7); g.stroke();
    g.fillStyle = "rgba(120,75,15,.85)"; g.font = "700 26px Georgia,serif";
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("¤", 32, 34);
  } else { // spark
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    r.addColorStop(0, "#ffffff"); r.addColorStop(.35, "#bff7ee"); r.addColorStop(1, "rgba(70,215,193,0)");
    g.fillStyle = r; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,.95)";
    g.beginPath();
    g.moveTo(32, 2); g.quadraticCurveTo(35, 29, 62, 32); g.quadraticCurveTo(35, 35, 32, 62);
    g.quadraticCurveTo(29, 35, 2, 32); g.quadraticCurveTo(29, 29, 32, 2); g.fill();
  }
  return (_tex[kind] = PIXI.Texture.from(c));
}

// ---- WebAudio synth ----
let _ac = null;
function ac() {
  if (!_ac) _ac = new (window.AudioContext ?? window.webkitAudioContext)();
  if (_ac.state === "suspended") _ac.resume();
  return _ac;
}
function tone(ctx, { f = 440, t = 0, d = .2, type = "sine", v = .5, slide = 0 }) {
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + d);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(v, t0 + .012);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  o.connect(g).connect(ctx.destination);
  o.start(t0); o.stop(t0 + d + .05);
}

export function playSound(name) {
  if (!opt("sound")) return;
  try {
    const ctx = ac(), vol = Math.max(0, Math.min(1, Number(opt("volume")) ?? .8));
    if (name.startsWith("coin")) {
      tone(ctx, { f: 1318, d: .09, v: .35 * vol });
      tone(ctx, { t: .07, f: 1760, d: .22, v: .35 * vol });
    } else if (name.startsWith("thud")) {
      tone(ctx, { f: 110, d: .28, v: .7 * vol, slide: 45 });
      tone(ctx, { f: 70, d: .32, type: "triangle", v: .45 * vol, slide: 38 });
    } else if (name.startsWith("fanfare")) {
      [[523, 0], [659, .1], [784, .2], [1047, .32]].forEach(([f, t]) => {
        tone(ctx, { f, t, d: .18, type: "triangle", v: .4 * vol });
        tone(ctx, { f: f / 2, t, d: .2, type: "square", v: .1 * vol });
      });
    }
  } catch (e) { console.warn(`${MID} | synth failed`, e); }
}

export async function shake(power = 3) {
  if (!opt("fx") || !canvas?.ready) return;
  try {
    const p = Math.min(10, Math.max(1, Number(power) || 3));
    await new foundry.canvas.animation.CanvasShakeEffect({
      target: canvas.stage, duration: 500 + p * 120, maxDisplacement: 5 + p * 2.5, smoothness: 0.5, returnSpeed: 0.2
    }).play();
  } catch (e) { console.warn(`${MID} | shake failed`, e); }
}

export async function burst(file, { count = 60, screen = false } = {}) {
  if (!opt("fx") || !canvas?.ready) return;
  try {
    const tex = sprite(String(file).includes("coin") ? "coin" : "spark");
    const gen = new foundry.canvas.animation.ParticleGenerator({
      mode: "effect", manual: true, textures: [tex],
      blend: screen ? PIXI.BLEND_MODES.SCREEN : PIXI.BLEND_MODES.NORMAL,
      lifetime: [900, 1700], fade: { in: 0.05, out: 0.4 },
      velocity: { angle: [200, 340], speed: { min: 150, max: 420, curve: [{ time: 0, value: 1 }, { time: 1, value: 0.15 }] } },
      rotation: { speed: [-200, 200] }, alpha: [0.75, 1], scale: [0.35, 0.8]
    });
    gen.start();
    gen.spawnParticles(count, { position: { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y } });
    gen.stop();
    setTimeout(() => { try { gen.stop({ hard: true }); } catch (e) { /* ignore */ } }, 3500);
  } catch (e) { console.warn(`${MID} | particles failed`, e); }
}

export function playFx(f) {
  if (!f?.fx) return;
  if (f.fx === "shake") { shake(f.power); playSound("thud.wav"); }
  else if (f.fx === "coins") { burst("coin.png", { count: 70 }); playSound("coin.wav"); }
  else if (f.fx === "achieve") {
    burst("spark.png", { count: 90, screen: true }); playSound("fanfare.wav");
    if (f.title) ui.notifications.info(`🏆 Achievement unlocked: ${f.title}`);
  }
}
