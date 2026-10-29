import { MID } from "./data.mjs";
const asset = f => `modules/${MID}/assets/${f}`;
const opt = k => game.settings.get(MID, k);

async function preload(path) {
  try { await (foundry.canvas.loadTexture?.(path) ?? PIXI.Assets.load(path)); } catch (e) { /* ignore */ }
}

export function playSound(name) {
  if (!opt("sound")) return;
  try { foundry.audio.AudioHelper.play({ src: asset(name), volume: opt("volume"), autoplay: true, loop: false }, false); }
  catch (e) { console.warn(`${MID} | sound failed`, e); }
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
    const tex = asset(file);
    await preload(tex);
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
