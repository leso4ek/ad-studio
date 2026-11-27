// Pip, the channel's original stickman host: a big round head with round glasses, a hair curl and an orange scarf,
// on an ink stick body. Planar FK rig (the figure faces the camera), poses blended by weight, a mouth driven by the
// narration's loudness, blinks, and a head that can look around.
import * as THREE from 'three';
import { INK, toon, flat, outline, stick, clamp, lerp } from './toon.js';

const SKIN = '#FFE1C4', HAIR = '#5A3A26', SCARF = '#F08A2B', CHEEK = '#F6A58E';
// pose = shoulder/elbow angles per arm (0 = hanging down, + = away from the body), hip/knee per leg, head tilt/turn, brows
export const POSES = {
  idle:   { aL: [.22, .12], aR: [.22, .12], lL: [.1, 0], lR: [.1, 0], tilt: 0, turn: 0, brow: 0, lean: 0 },
  point:  { aL: [.25, .1], aR: [1.95, -.12], lL: [.12, 0], lR: [.1, 0], tilt: .05, turn: .25, brow: .2, lean: .04 },
  pointL: { aL: [1.95, -.12], aR: [.25, .1], lL: [.1, 0], lR: [.12, 0], tilt: .05, turn: -.25, brow: .2, lean: -.04 },
  shrug:  { aL: [.95, 1.6], aR: [.95, 1.6], lL: [.1, 0], lR: [.1, 0], tilt: .16, turn: 0, brow: .8, lean: 0 },
  think:  { aL: [.35, .2], aR: [.5, -3.1], lL: [.1, 0], lR: [.12, 0], tilt: -.08, turn: .15, brow: -.4, lean: 0 },
  lookUp: { aL: [.3, .15], aR: [.3, .15], lL: [.12, 0], lR: [.12, 0], tilt: -.42, turn: .2, brow: .6, lean: -.03 },
  shock:  { aL: [1.2, 1.7], aR: [1.2, 1.7], lL: [.22, 0], lR: [.22, 0], tilt: -.1, turn: 0, brow: 1, lean: -.05 },
  cheer:  { aL: [2.6, -.2], aR: [2.6, -.2], lL: [.15, 0], lR: [.15, 0], tilt: -.1, turn: 0, brow: .7, lean: 0 },
  wave:   { aL: [.22, .12], aR: [2.5, -.5], lL: [.1, 0], lR: [.1, 0], tilt: .06, turn: 0, brow: .4, lean: 0 },
  scratch:{ aL: [.3, .15], aR: [2.1, -3.9], lL: [.1, 0], lR: [.1, 0], tilt: .14, turn: -.1, brow: -.2, lean: .02 },
};
function mixPose(a, b, k) {
  const o = {};
  for (const key of Object.keys(a)) o[key] = Array.isArray(a[key]) ? a[key].map((v, i) => lerp(v, b[key][i], k)) : lerp(a[key], b[key], k);
  return o;
}

export function makePip() {
  const g = new THREE.Group();
  const R = .055; // stick radius
  const parts = { torso: stick(R), neck: stick(R), uL: stick(R), fL: stick(R), uR: stick(R), fR: stick(R), tL: stick(R), sL: stick(R), tR: stick(R), sR: stick(R) };
  for (const s of Object.values(parts)) g.add(s);
  const ball = r => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), flat(INK));
  const joints = { hL: ball(.1), hR: ball(.1), fL: ball(.075), fR: ball(.075), sh: ball(R), hip: ball(R), eL: ball(R), eR: ball(R), kL: ball(R), kR: ball(R) };
  for (const j of Object.values(joints)) g.add(j);
  joints.fL.scale.set(1.6, .8, 1.1); joints.fR.scale.set(1.6, .8, 1.1);

  // the head
  const head = new THREE.Group(); g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.56, 48, 36), toon(SKIN, { emissive: '#8A6A50' })); outline(skull, .045); head.add(skull);
  const lens = x => { const l = new THREE.Mesh(new THREE.TorusGeometry(.17, .035, 10, 40), flat(INK)); l.position.set(x, .06, .5); l.rotation.y = x * .55; head.add(l); return l; };
  lens(-.2); lens(.2);
  const glassFill = x => { const m = new THREE.Mesh(new THREE.CircleGeometry(.16, 32), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: .55 })); m.position.set(x, .06, .505); m.rotation.y = x * .55; head.add(m); };
  glassFill(-.2); glassFill(.2);
  const bridge = stick(.02); bridge.userData.set([-.04, .09, .55], [.04, .09, .55]); head.add(bridge);
  const eye = x => { const e = new THREE.Mesh(new THREE.SphereGeometry(.055, 16, 12), flat(INK)); e.position.set(x, .06, .52); head.add(e); return e; };
  const eyes = [eye(-.2), eye(.2)];
  const brow = x => { const b = stick(.022); head.add(b); return { b, x }; };
  const brows = [brow(-.2), brow(.2)];
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), flat('#6B1E1E')); mouth.position.set(0, -.24, .5); head.add(mouth);
  const mouthLine = stick(.018); head.add(mouthLine);
  const cheek = x => { const c = new THREE.Mesh(new THREE.CircleGeometry(.07, 20), new THREE.MeshBasicMaterial({ color: CHEEK, transparent: true, opacity: .6 })); c.position.set(x, -.14, .52); c.rotation.y = x * 1.2; head.add(c); };
  cheek(-.34); cheek(.34);
  const curl = new THREE.Mesh(new THREE.TorusGeometry(.13, .05, 10, 28, Math.PI * 1.35), toon(HAIR)); outline(curl, .02); curl.position.set(.05, .6, .05); curl.rotation.z = .6; head.add(curl);
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(.57, 40, 20, 0, Math.PI * 2, 0, Math.PI * .28), toon(HAIR)); outline(fringe, .02); fringe.rotation.x = -.35; head.add(fringe);
  // the scarf
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(.17, .075, 12, 28), toon(SCARF)); outline(scarf, .03); scarf.rotation.x = Math.PI / 2; g.add(scarf);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(.13, .34, .05), toon(SCARF)); outline(tail, .03); g.add(tail);

  const pip = { group: g, head };
  /**
   * s = { pose, pose2, mix, talk (0..1), blink (0..1), lookX, lookY, wave (0..1 time), bob }
   */
  pip.update = (s = {}) => {
    const P = mixPose(POSES[s.pose || 'idle'], POSES[s.pose2 || s.pose || 'idle'], clamp(s.mix ?? 0));
    const bob = s.bob ?? 0, lean = P.lean;
    const hip = [lean * 1.2, 1.05 + bob, 0], neck = [hip[0] + Math.sin(lean) * .85, hip[1] + .85, 0];
    parts.torso.userData.set(hip, neck); joints.hip.position.set(...hip); joints.sh.position.set(...neck);
    // two-bone limb hanging from root: angle 0 points straight down, + swings away from the body on its side
    const limb = (root, len1, len2, [a1, a2], side) => {
      const e = [root[0] + Math.sin(a1) * side * len1, root[1] - Math.cos(a1) * len1, 0];
      const h = [e[0] + Math.sin(a1 + a2) * side * len2, e[1] - Math.cos(a1 + a2) * len2, 0];
      return [e, h];
    };
    let aR = P.aR;
    if (s.pose === 'wave' || s.pose2 === 'wave') aR = [aR[0], aR[1] + Math.sin((s.wave || 0) * 9) * .45 * (s.pose2 === 'wave' ? clamp(s.mix ?? 0) : 1)];
    const sh = [neck[0], neck[1] - .08, 0];
    const [eL, hL] = limb(sh, .52, .5, P.aL, -1, true), [eR, hR] = limb(sh, .52, .5, aR, 1, true);
    parts.uL.userData.set(sh, eL); parts.fL.userData.set(eL, hL); parts.uR.userData.set(sh, eR); parts.fR.userData.set(eR, hR);
    joints.eL.position.set(...eL); joints.eR.position.set(...eR); joints.hL.position.set(...hL); joints.hR.position.set(...hR);
    const [kL, fL] = limb(hip, .55, .52, P.lL, -1), [kR, fR] = limb(hip, .55, .52, P.lR, 1);
    parts.tL.userData.set(hip, kL); parts.sL.userData.set(kL, fL); parts.tR.userData.set(hip, kR); parts.sR.userData.set(kR, fR);
    joints.kL.position.set(...kL); joints.kR.position.set(...kR); joints.fL.position.set(fL[0] - .06, fL[1] - .02, .04); joints.fR.position.set(fR[0] + .06, fR[1] - .02, .04);
    parts.neck.userData.set(neck, [neck[0], neck[1] + .2, 0]);
    scarf.position.set(neck[0], neck[1] + .06, 0); tail.position.set(neck[0] + .1, neck[1] - .16, .1); tail.rotation.z = .25;
    head.position.set(neck[0], neck[1] + .62, 0);
    head.rotation.set(P.tilt + (s.lookY || 0), P.turn + (s.lookX || 0), lean * -.6 + (P.tilt > .1 ? .12 : 0));
    // face
    const blink = 1 - clamp(s.blink || 0) * .9;
    eyes.forEach(e => e.scale.set(1, blink, 1));
    brows.forEach(({ b, x }) => { const y = .27 + P.brow * .05, tilt = P.brow < 0 ? -P.brow * .05 * Math.sign(x) : 0; b.userData.set([x - .09, y + tilt, .52], [x + .09, y - tilt, .52]); });
    const talk = clamp(s.talk || 0);
    mouth.scale.set(.11 + talk * .03, .012 + talk * .085, .03); mouth.visible = talk > .06;
    mouthLine.visible = !mouth.visible; mouthLine.userData.set([-.09, -.23 + (P.brow > .7 ? -.01 : .01), .52], [.09, -.23 + (P.brow > .7 ? -.01 : .01), .52]);
  };
  pip.update();
  return pip;
}
