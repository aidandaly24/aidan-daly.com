import { routeDepths } from './terrain-depth.mjs';

export const clamp = t => Math.max(0, Math.min(1, t));
export const smooth = t => t*t*(3-2*t);
export const ramp = (t, from, to) => smooth(clamp((t-from)/(to-from)));
export const window = (t, inStart, inEnd, outStart, outEnd) =>
  ramp(t,inStart,inEnd)*(1-ramp(t,outStart,outEnd));
export const turnDelta = (from,to) => Math.atan2(Math.sin(to-from),Math.cos(to-from));

const stairs = new Set(['s1','s2','s3']);
export function terrain(from,to) {
  if ([from,to].includes('ladder0') && [from,to].includes('ladder1')) return 'ladder';
  return stairs.has(from) || stairs.has(to) ? 'stair' : 'deck';
}

export function segment(from,to,start,end,previous,next,carrying,layout=0) {
  const projected = Math.hypot(end[0]-start[0],end[1]-start[1]);
  const depths = routeDepths(layout);
  const distance = Math.hypot(projected, depths[to]-depths[from]);
  const surface = terrain(from,to);
  const speed = surface === 'ladder' ? 49 : surface === 'stair' ? 58 : carrying ? 86 : 98;
  return {from,to,start,end,d:distance,projected,surface,elapsed:0,T:Math.max(.31,distance/speed),
    entry: previous === surface ? .92 : .28, exit: next === surface ? .92 : .28};
}

export function progress(g,t) {
  // Cubic Hermite with nonzero slopes at through junctions.
  return smooth(t)+g.entry*t*(1-t)**2-g.exit*t*t*(1-t);
}

export function updateFeet(a,g,u,dt) {
  const terminal = !g || (u === 1 && !a.route.length);
  const surface = g?.surface ?? 'deck';
  const worldStride = surface === 'deck' ? 30 : surface === 'stair' ? 24 : 24;
  const stride = worldStride * (g ? g.projected/g.d : 1);
  const duration = surface === 'deck' ? .31 : surface === 'stair' ? .34 : .39;
  a.footPitch = [0,0];
  const stance = i => [a.p[0]+(i ? 8 : -8),a.p[1],0];
  const error = i => Math.hypot(a.feet[i][0]-stance(i)[0],a.feet[i][1]-stance(i)[1]);
  if (!a.swing) {
    if (terminal && error(a.leg) <= 1) a.leg = 1-a.leg;
    const i = a.leg;
    if (error(i) > (terminal ? 1 : stride*.78)) {
      const target = stance(i);
      if (!terminal) {
        const lead = Math.min(1, u+duration/g.T*.86);
        let f = progress(g,lead);
        if (surface === 'ladder') {
          // Six registered intervals along the inclined ladder. Plant on a
          // rung while the next hand/foot pair moves.
          f = Math.round(f*6)/6;
        }
        target[0] = g.start[0]+(g.end[0]-g.start[0])*f+(i ? 8 : -8);
        target[1] = g.start[1]+(g.end[1]-g.start[1])*f;
      }
      a.swing = {i,s:[...a.feet[i]],tar:target,t:0,T:duration,surface};
      a.leg = 1-i;
    }
  }
  a.support = 0;
  a.gait = 0;
  if (!a.swing) return;
  const s = a.swing;
  s.t += dt;
  const t = clamp(s.t/s.T);
  const f = smooth(t);
  const lift = s.surface === 'ladder' ? 10 : s.surface === 'stair' ? 15 : 11;
  a.feet[s.i] = [
    s.s[0]+(s.tar[0]-s.s[0])*f,
    s.s[1]+(s.tar[1]-s.s[1])*f,
    lift*Math.sin(Math.PI*t)**2,
  ];
  a.support = (s.i ? -1 : 1)*Math.sin(Math.PI*t);
  a.gait = Math.sin(Math.PI*t)**2;
  if (s.surface === 'deck') {
    a.footPitch[s.i] = .27*window(t,0,.18,.33,.56)-.22*window(t,.48,.76,.84,1);
    a.footPitch[1-s.i] = .16*window(t,.52,.88,.9,1);
  }
  if (t === 1) {
    a.feet[s.i] = s.tar;
    a.swing = null;
  }
}
