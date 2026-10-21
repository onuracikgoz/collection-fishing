// The reel mini game model (docs/protokol.md, Mini oyun modeli), step by step,
// only for drawing and hand play in the dashboard. The server replays the inputs
// and decides the result; if this drifts from server/src/rules/reel.ts the
// dashboard's hand play will disagree with the server, which is itself a useful test.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

export const FIELD = 1000;
export const STEP_MS = 20;

export class ReelGame {
  constructor(seed, p) {
    this.p = p;
    this.rng = mulberry32(seed);
    this.bar = Math.floor((FIELD - p.barSize) / 2);
    this.vel = 0;
    this.fish = FIELD / 2;
    this.target = this.fish;
    this.retargetLeft = 0;
    this.progress = 300;
    this.k = 0;
    this.result = null; // 'caught' | 'escaped'
  }

  step(pressed) {
    if (this.result) return;
    const p = this.p;
    this.k++;
    this.vel += pressed ? p.lift : -p.gravity;
    if (this.vel > p.maxVel) this.vel = p.maxVel;
    if (this.vel < -p.maxVel) this.vel = -p.maxVel;
    this.bar += this.vel;
    if (this.bar < 0) {
      this.bar = 0;
      this.vel = 0;
    }
    if (this.bar > FIELD - p.barSize) {
      this.bar = FIELD - p.barSize;
      this.vel = 0;
    }
    if (this.retargetLeft === 0) {
      this.target = this.rng() % (FIELD + 1);
      this.retargetLeft = p.retargetSteps;
    } else this.retargetLeft--;
    if (this.fish < this.target) this.fish = Math.min(this.target, this.fish + p.fishSpeed);
    else this.fish = Math.max(this.target, this.fish - p.fishSpeed);
    if (this.fish >= this.bar && this.fish <= this.bar + p.barSize) this.progress += p.gain;
    else this.progress -= p.loss;
    if (this.progress >= FIELD) this.result = 'caught';
    else if (this.progress <= 0) this.result = 'escaped';
    else if (this.k >= p.maxSteps) this.result = 'escaped';
  }
}

/** Replays a full input list; returns every frame for drawing. */
export function replay(seed, p, inputs) {
  const g = new ReelGame(seed, p);
  const frames = [];
  let pressed = false;
  let next = 0;
  while (!g.result) {
    const now = (g.k + 1) * STEP_MS;
    while (next < inputs.length && inputs[next] <= now) {
      pressed = !pressed;
      next++;
    }
    g.step(pressed);
    frames.push({ bar: g.bar, fish: g.fish, progress: g.progress, pressed });
  }
  return { frames, result: g.result, steps: g.k };
}

/** Draws one frame: the field bottom to top, bar, fish and progress. */
export function drawReel(canvas, p, f) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#123';
  g.fillRect(0, 0, W - 24, H);
  const y = (v) => H - (v / FIELD) * H;
  g.fillStyle = f.pressed ? '#7bed9f' : '#2ed573';
  g.fillRect(6, y(f.bar + p.barSize), W - 36, (p.barSize / FIELD) * H);
  g.fillStyle = '#ffa502';
  g.beginPath();
  g.arc((W - 24) / 2, y(f.fish), 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#333';
  g.fillRect(W - 18, 0, 14, H);
  g.fillStyle = '#eccc68';
  g.fillRect(W - 18, y(f.progress), 14, H - y(f.progress));
}
