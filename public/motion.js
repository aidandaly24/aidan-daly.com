export const TAU = Math.PI * 2;
export const MODEL_TURN_SECONDS = 12;
export const TEXT_TURN_SECONDS = 26;
export const AUTO_SPEED = TAU / MODEL_TURN_SECONDS;
export const TEXT_AUTO_SPEED = TAU / TEXT_TURN_SECONDS;
export const TEXT_TO_MODEL_RATIO = TEXT_AUTO_SPEED / AUTO_SPEED;
export const wrap = (n, m = TAU) => ((n % m) + m) % m;
export class SpinMotion {
  constructor({ reducedMotion = false, paused = false } = {}) {
    this.angle = 0; this.reducedMotion = reducedMotion; this.paused = paused;
    this.velocity = this.targetVelocity; this.preDragVelocity = this.velocity; this.dragging = false;
  }
  get targetVelocity() { return this.paused || this.reducedMotion ? 0 : AUTO_SPEED; }
  get textAngle() { return -this.angle * TEXT_TO_MODEL_RATIO; }
  beginDrag() { this.preDragVelocity = this.velocity; this.dragging = true; this.velocity = 0; }
  dragTo(angle) { this.angle = angle; }
  release(pointerVelocity = 0) {
    this.dragging = false;
    if (this.reducedMotion || this.paused) { this.velocity = 0; return; }
    const speed = Math.min(Math.abs(pointerVelocity), 5.5);
    this.velocity = speed < .04 ? this.targetVelocity : pointerVelocity > 0 ? Math.min(6.5, Math.max(AUTO_SPEED, this.preDragVelocity) + speed) : -Math.max(.28, speed);
  }
  impulse(direction) {
    this.angle += direction * .09; this.preDragVelocity = this.velocity;
    if (!this.paused && !this.reducedMotion) this.release(direction * Math.max(.9, Math.abs(this.velocity) + .55));
  }
  setPaused(value) { this.paused = value; this.velocity = this.targetVelocity; }
  setReducedMotion(value) { this.reducedMotion = value; this.velocity = this.targetVelocity; }
  reset() { this.angle = 0; this.velocity = this.targetVelocity; this.dragging = false; }
  step(dt) {
    if (this.dragging || dt <= 0) return;
    const target = this.targetVelocity;
    if (this.reducedMotion || this.paused) { this.velocity = 0; return; }
    const tau = 1.65, damping = Math.exp(-dt / tau);
    this.angle += target * dt + (this.velocity - target) * tau * (1 - damping);
    this.velocity = target + (this.velocity - target) * damping;
  }
}

// Preserve direction on a slow drag while reducing the energy of a held release.
export function releaseVelocity({velocity=0, age=0, direction=0, moved=false, cancelled=false}) {
  if (!moved || cancelled) return 0;
  const sign=Math.sign(velocity)||Math.sign(direction);
  return sign*Math.max(.08,Math.abs(velocity)*Math.exp(-Math.max(0,age-80)/250));
}
