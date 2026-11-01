import { MID } from "./data.mjs";
const opt = k => game.settings.get(MID, k);
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const textures = {};
function sprite(kind) {
  if (textures[kind]) return textures[kind];
  const c=document.createElement("canvas");c.width=c.height=64;const g=c.getContext("2d");
  const r=g.createRadialGradient(32,32,1,32,32,30);
  r.addColorStop(0,"#ffffff");r.addColorStop(.2,kind==="coin"?"#73f0d3":"#bca4ff");r.addColorStop(1,"rgba(94,210,213,0)");
  g.fillStyle=r;g.fillRect(0,0,64,64);g.strokeStyle=kind==="coin"?"#6ee7cf":"#b8a1ff";g.lineWidth=2;
  g.beginPath();g.moveTo(32,13);g.lineTo(45,32);g.lineTo(32,51);g.lineTo(19,32);g.closePath();g.stroke();
  return (textures[kind]=PIXI.Texture.from(c));
}
let audio=null;
export function playSound(name) {
  if (!opt("sound")) return;
  try {
    audio ??= new (window.AudioContext ?? window.webkitAudioContext)();
    if(audio.state==="suspended")audio.resume().catch(()=>{});
    const raw=Number(opt("volume")), volume=Number.isFinite(raw)?Math.min(1,Math.max(0,raw)):.5;
    const notes=name.startsWith("coin")?[[660,0],[990,.07]]:name.startsWith("fanfare")?[[523,0],[659,.1],[784,.2],[1047,.3]]:[[220,0],[165,.06]];
    for(const [f,t] of notes){
      const o=audio.createOscillator(),g=audio.createGain(),now=audio.currentTime+t;
      o.type="sine";o.frequency.setValueAtTime(f,now);g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(.12*volume,now+.012);g.gain.exponentialRampToValueAtTime(.0001,now+.22);
      o.connect(g).connect(audio.destination);o.start(now);o.stop(now+.24);
    }
  }catch(e){console.warn(`${MID} | synth failed`,e);}
}

export async function shake(power = 3) {
  if (!opt("fx") || reduced() || !canvas?.ready) return;
  try {
    const p = Math.min(10, Math.max(1, Number(power) || 3));
    await new foundry.canvas.animation.CanvasShakeEffect({
      target: canvas.stage, duration: 500 + p * 120, maxDisplacement: 5 + p * 2.5, smoothness: 0.5, returnSpeed: 0.2
    }).play();
  } catch (e) { console.warn(`${MID} | shake failed`, e); }
}

export async function burst(file, { count = 60, screen = false } = {}) {
  if (!opt("fx") || reduced() || !canvas?.ready) return;
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
  else if (f.fx === "coins") { burst("coin.png", { count: 24 }); playSound("coin.wav"); }
  else if (f.fx === "achieve") {
    burst("spark.png", { count: 36, screen: true }); playSound("fanfare.wav");
    if (f.title) ui.notifications.info(`🏆 Achievement unlocked: ${f.title}`);
  }
}
