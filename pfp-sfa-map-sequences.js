(() => {
  'use strict';
  if (window.__pfpSfaMapSequenceInstallerPublicLate2001) return;

  const FPS = 60;
  const API_ROOT = '/Project-FoxPlanet/';
  const LATE_2001_MAX_SEQUENCE = 0x04B0;
  const SPECIAL_CAMERA = 0xFFFE;
  const SPECIAL_SOURCE = 0xFFFF;
  const PLAYER_SABRE = 0x0000;
  const PLAYER_KRYSTAL = 0x001F;
  const PLAYER_STAFF = 0x0069;
  const BGS_WEAPON = 0x07A5;
  const TRICKY_A = 0x0024;
  const TRICKY_B = 0x0025;
  const CHANNEL = {
    HEAD_Z: 0, HEAD_X: 1, HEAD_Y: 2, OPACITY: 3, ROOT_MOTION_SCALE: 5,
    ROT_Z: 6, ROT_X: 7, ROT_Y: 8, ANIM_TIMER: 9,
    POS_Z: 11, POS_Y: 12, POS_X: 13, FOV: 14,
    EYE_X: 15, EYE_Y: 16, MOUTH_X: 17,
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hex = (v, n = 4) => (Number(v) >>> 0).toString(16).toUpperCase().padStart(n, '0');
  const signed16 = (v) => { v &= 0xFFFF; return (v & 0x8000) ? v - 0x10000 : v; };
  const angleToRadFallback = (v) => signed16(v) * Math.PI / 32768;
  const css = (el, props) => (Object.assign(el.style, props), el);

  function readAscii4(dv, off) {
    if (!dv || off + 4 > dv.byteLength) return '';
    return String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
  }

  async function fetchFirst(fetcher, paths) {
    let last = null;
    for (const p of paths) {
      try {
        const d = await fetcher.fetchData(p, { allow404: true });
        if (d && d.byteLength) return d;
      } catch (e) { last = e; }
    }
    throw last || new Error(`Missing file: ${paths.join(' / ')}`);
  }

  async function fetchBundledView(paths) {
    let last = null;
    for (const p of paths) {
      try {
        const url = new URL(API_ROOT + String(p).replace(/^\/+/, ''), location.origin);
        const r = await fetch(url.toString(), { cache: 'no-store' });
        if (!r.ok) continue;
        const b = await r.arrayBuffer();
        if (b.byteLength) return new DataView(b);
      } catch (e) { last = e; }
    }
    throw last || new Error(`Missing bundled sequence data: ${paths.join(' / ')}`);
  }

  function parseCast(seqTab, seqBin, sequenceId) {
    const p = sequenceId * 2;
    if (!seqTab || p + 4 > seqTab.byteLength) return [];
    const first = seqTab.getUint16(p, false), next = seqTab.getUint16(p + 2, false);
    if (first === 0xFFFF || next === 0xFFFF || next < first) return [];
    const start = first * 8, end = next * 8;
    if (end > seqBin.byteLength) return [];
    const out = [];
    for (let off = start, index = 0; off < end; off += 8, index++) {
      out.push({
        index,
        targetObjId: seqBin.getUint32(off, false),
        flags: seqBin.getUint16(off + 4, false),
        defNo: seqBin.getUint16(off + 6, false),
      });
    }
    return out;
  }

  function curveOffset(word) { return (word >>> 0) & 0x00FFFFFF; }

  function parseCurve(curveId, curveTab, curveBin) {
    const p = curveId * 4;
    if (!curveTab || p + 8 > curveTab.byteLength) return null;
    const raw = curveTab.getUint32(p, false), rawNext = curveTab.getUint32(p + 4, false);
    if (raw === 0xFFFFFFFF || rawNext === 0xFFFFFFFF) return null;
    const off = curveOffset(raw), end = curveOffset(rawNext);
    if (off + 8 > curveBin.byteLength || end <= off || end > curveBin.byteLength) return null;
    const tag = readAscii4(curveBin, off);
    if (tag !== 'SEQA' && tag !== 'SEQB') return null;
    const commandCount = curveBin.getUint16(off + 6, false);
    const cmdStart = off + 8, keyStart = cmdStart + commandCount * 4;
    if (keyStart > end) return null;

    const events = [], conditionBlocks = [];
    let retrigger = -0x32, declaredMax = 0, cursor = 0;
    while (cursor < commandCount) {
      const c = cmdStart + cursor * 4;
      if (c + 4 > end) break;
      const opcode = curveBin.getUint8(c), delta = curveBin.getUint8(c + 1);
      const paramU = curveBin.getUint16(c + 2, false), paramS = curveBin.getInt16(c + 2, false);
      let eventTime = retrigger;
      if (opcode === 0x00) {
        retrigger = paramS;
        eventTime = retrigger;
      } else {
        eventTime = retrigger;
        if (opcode !== 0x0F) retrigger += delta;
      }
      if (opcode === 0xFF && cursor < 2 && paramS > 0) declaredMax = Math.max(declaredMax, paramS);
      events.push({ opcode, delta, param: paramS, paramU, time: Math.max(0, eventTime), index: cursor });
      if (opcode === 0x0F && cursor + 1 < commandCount) {
        const tail = cmdStart + (cursor + 1) * 4;
        retrigger += curveBin.getUint8(tail + 1);
        cursor += 1;
      } else if (opcode === 0x0B && paramU > 0) {
        const blockTime = Math.max(0, eventTime), blockEntries = [];
        for (let j = 1; j <= paramU && cursor + j < commandCount; j++) {
          const sc = cmdStart + (cursor + j) * 4;
          if (sc + 4 > end) break;
          const packed = curveBin.getUint32(sc, false);
          const subOpcode = packed & 0x3F;
          const arg10 = (packed >>> 6) & 0x3FF;
          const top16 = (packed >>> 16) & 0xFFFF;
          blockEntries.push({op:subOpcode, operand:arg10, paramU:top16, paramS:signed16(top16), index:cursor+j});
          events.push({
            opcode: 0x101, conditionOp: subOpcode, conditionSubId: arg10,
            conditionParamU: top16, conditionParamS: signed16(top16),
            time: blockTime, index: cursor + j, embedded: true,
          });
          if (subOpcode === 6) events.push({
            opcode: 0x100, software: arg10 & 0xFF, softwareArg: top16 & 0xFF,
            time: blockTime, index: cursor + j, embedded: true,
          });
        }
        conditionBlocks.push({time:blockTime,index:cursor,entries:blockEntries});
        cursor += paramU;
      } else if (opcode === 0x0D) {
        const sub = (paramU >>> 12) & 0xF;
        if ((sub === 0xB || sub === 0xC) && cursor + 1 < commandCount) {
          const next = cmdStart + (cursor + 1) * 4;
          if (next + 4 <= end) {
            const gameBit = curveBin.getUint16(next + 2, false);
            events.push({ opcode: 0x102, sideKind: 'gamebit', gameBit,
              gameBitValue: sub === 0xB ? 1 : 0, time: Math.max(0, eventTime),
              index: cursor, embedded: true });
          }
        }
        if (sub === 0x8 || sub === 0xE || sub === 0xF) {
          events.push({ opcode: 0x103, sideKind: 'faceState', faceCommand: sub,
            faceValue: paramU & 0x0FFF, time: Math.max(0, eventTime),
            index: cursor, embedded: true });
        }
      }
      cursor++;
    }

    const channels = new Map();
    let maxKey = 0;
    for (let k = keyStart; k + 8 <= end; k += 8) {
      const value = curveBin.getFloat32(k, false);
      if (!Number.isFinite(value)) continue;
      const typeAndScaleU = curveBin.getUint8(k + 4);
      const typeAndScaleS = curveBin.getInt8(k + 4);
      const field = curveBin.getUint8(k + 5) & 0x1F;
      const frame = curveBin.getInt16(k + 6, false);
      if (frame < 0) continue;
      if (!channels.has(field)) channels.set(field, []);
      channels.get(field).push({
        value, frame,
        mode: typeAndScaleU & 3,
        tangentScale: (typeAndScaleS >> 2) / 16,
      });
      maxKey = Math.max(maxKey, frame);
    }
    for (const keys of channels.values()) keys.sort((a, b) => a.frame - b.frame);
    const maxEvent = events.reduce((m, e) => Math.max(m, e.time || 0), 0);
    const scriptMax = declaredMax > 0 ? declaredMax : maxEvent;
    conditionBlocks.sort((a,b)=>a.time-b.time||a.index-b.index);
    return { curveId, tag, events, channels, conditionBlocks, maxFrame: Math.max(1, scriptMax, maxKey) };
  }

  function sample(curve, channel, frame, fallback = 0) {
    if (!curve) return fallback;
    const keys = curve.channels.get(channel);
    if (!keys || !keys.length) return fallback;
    const count = keys.length;
    let index = 0;
    while (index < count && keys[index].frame < frame) index++;
    if (index === count) return keys[count - 1].value;
    if (index === 0) return keys[0].value;
    if (frame === keys[index].frame) {
      let v = keys[index].value;
      if (keys[index].mode > 1 && index < count - 1) v = keys[index + 1].value;
      return v;
    }
    const prevIndex = index - 1, prev = keys[prevIndex], next = keys[index];
    const mode = prev.mode;
    const span = next.frame - prev.frame;
    if (!(span > 0)) return next.value;
    const t = (frame - prev.frame) / span;
    if (mode === 1) return t * (next.value - prev.value) + prev.value;
    if (mode > 1) return next.value;

    let deltaNext = next.value - prev.value;
    let deltaPrev = prevIndex > 0 ? prev.value - keys[prevIndex - 1].value : deltaNext;
    const m0 = (Math.abs(deltaNext) + Math.abs(deltaPrev)) * prev.tangentScale;
    let after = index + 1 < count ? keys[index + 1].value - next.value : deltaNext;
    const m1 = (Math.abs(deltaNext) + Math.abs(after)) * next.tangentScale;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * prev.value + (t3 - 2 * t2 + t) * m0 +
           (-2 * t3 + 3 * t2) * next.value + (t3 - t2) * m1;
  }

  function toggleAt(curve, opcode, frame) {
    if (!curve) return false;
    let on = false;
    for (const e of curve.events) {
      if (e.time > frame) break;
      if (e.opcode === opcode) on = !on;
    }
    return on;
  }

  function latestAnimationEvent(curve, frame) {
    if (!curve) return null;
    let found = null;
    for (const e of curve.events) {
      if (e.time > frame) break;
      if (e.opcode === 0x02) found = e;
    }
    return found;
  }

  function previousAnimationEvent(curve, frame) {
    if (!curve) return null;
    let previous = null, current = null;
    for (const e of curve.events) {
      if (e.time > frame) break;
      if (e.opcode === 0x02) { previous = current; current = e; }
    }
    return previous;
  }

  function moveForAnimationEvent(actor, ev) {
    if (!ev) return null;
    let move = ev.paramU & 0x0FFF;
    if (actor.isPlayer && move < 4) move += 0x531;
    return move;
  }

  function animationForResolved(actor, resolved) {
    try {
      if (!resolved) return null;
      const coll = actor && actor.instance && actor.instance.world && actor.instance.world.resColl && actor.instance.world.resColl.animColl;
      return coll ? coll.getAnim(resolved.animId) : null;
    } catch (_) { return null; }
  }

  function latestSoftwareEvent(curve, command, frame) {
    if (!curve) return null;
    let found = null;
    for (const e of curve.events) {
      if (e.time > frame) break;
      if ((e.opcode === 0x100 && e.software === command) || (e.opcode === 0x05 && (e.paramU & 0xFF) === command)) found = e;
    }
    return found;
  }

  function sequenceHeadJointKey(curve, frame) {
    if (!curve) return 0;
    let enabled = false, slot = 0;
    for (const e of curve.events || []) {
      if (e.time > frame) break;
      let cmd = -1, arg = 0;
      if (e.opcode === 0x100) { cmd = e.software | 0; arg = e.softwareArg | 0; }
      else if (e.opcode === 0x05) { cmd = e.paramU & 0xFF; arg = (e.paramU >>> 8) & 0xFF; }
      if (cmd === 33) { enabled = true; slot = arg & 0x0F; }
      else if (cmd === 34) { enabled = false; slot = 0; }
    }
    if (!enabled) return 0;
    if (slot === 0) slot = 9;
    return slot >= 1 && slot <= 9 ? 0x0A + slot : 0;
  }

  function firstOpcodeTime(curve, opcode, frame = Infinity) {
    if (!curve) return null;
    for (const e of curve.events) if (e.opcode === opcode && e.time <= frame) return e.time;
    return null;
  }

  function cameraResolved(curve, frame) {
    return firstOpcodeTime(curve, 0x03, frame) !== null;
  }

  function cameraRunning(curve, frame) {
    return cameraResolved(curve, frame) && toggleAt(curve, 0x01, frame);
  }

  function letterboxSuppressed(curves, frame, initialSuppressed) {
    let suppressed = !!initialSuppressed;
    const evs = [];
    for (const c of curves) if (c) for (const e of c.events)
      if (((e.opcode === 0x100 && (e.software === 18 || e.software === 19 || e.software === 30)) || (e.opcode === 0x05 && ([18,19,30].includes(e.paramU & 0xFF)))) && e.time <= frame) evs.push(e);
    evs.sort((a,b)=>(a.time-b.time)||(a.index-b.index));
    for (const e of evs) {
      const cmd=e.opcode===0x100?e.software:(e.paramU&0xFF);
      if (cmd === 18) suppressed = !suppressed;
      else if (cmd === 19) suppressed = false;
      else if (cmd === 30) suppressed = true;
    }
    return suppressed;
  }

  function hasCinematicSignal(cast, parsedCurves) {
    if (cast.some(c => c.defNo === SPECIAL_CAMERA)) return true;
    if (cast.length >= 3) return true;
    for (const c of parsedCurves) {
      if (!c) continue;
      for (const e of c.events) {
        if (e.opcode === 0x03 || e.opcode === 0x0C || e.opcode === 0x0E) return true;
        if (e.opcode === 0x0D && ((e.paramU >>> 12) & 0xF) === 9) return true;
      }
    }
    return false;
  }

  function buildModanimBanks(modanim) {
    const bases = new Array(0x3E).fill(0);
    if (!modanim || !modanim.byteLength) return bases;
    let group = 0;
    for (let i = 0; i < (modanim.byteLength / 2 | 0) && group < bases.length - 1; i++) {
      if (modanim.getUint16(i * 2, false) === 0xFFFF) bases[++group] = i + 1;
    }
    return bases;
  }

  function resolveAnim(actor, moveId) {
    const inst = actor.instance, mod = inst && inst.modanim;
    if (!mod || !mod.byteLength) return null;
    moveId &= 0x0FFF;
    const bank = (moveId >>> 8) & 0x0F, index = moveId & 0xFF;
    if (!actor.modanimBanks || !actor.modanimBanks.length || bank >= actor.modanimBanks.length) return null;
    const animNum = actor.modanimBanks[bank] + index, off = animNum * 2;
    if (off + 2 > mod.byteLength) return null;
    const rawAnimId = mod.getUint16(off, false);
    if (rawAnimId === 0xFFFF) return null;
    return { animId: rawAnimId & 0x7FFF, animNum };
  }

  function rootCycleDistance(anim) {
    if (!anim || !anim.keyframes || anim.keyframes.length < 2) return 0;
    let total = 0, prev = null;
    for (const k of anim.keyframes) {
      const root = k && k.poses && k.poses[0];
      if (!root || !root.axes || root.axes.length < 3) continue;
      const p = [Number(root.axes[0].translation) || 0, Number(root.axes[2].translation) || 0];
      if (prev) total += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
    }
    return total;
  }

  function rootMotionProfile(anim, motionScale = 1) {
    const root = anim && anim.rootCurve;
    if (!root || !Array.isArray(root.axes)) return null;
    let axis = null;
    for (let i = 0; i < 3; i++) {
      const a = root.axes[i];
      if (a && a.marker && Array.isArray(a.samples) && a.samples.length > 1) { axis = a; break; }
    }
    if (!axis) return null;
    let scale = Number(root.scale);
    if (!Number.isFinite(scale) || Math.abs(scale) < 1e-12) return null;
    const objectScale = Number(motionScale);
    if (Number.isFinite(objectScale) && Math.abs(objectScale) > 1e-6) scale *= Math.abs(objectScale);
    const samples = axis.samples;
    if (samples[samples.length - 1] < 0) scale = -scale;
    const base = samples[0] * scale;
    const distance = new Array(samples.length);
    distance[0] = 0;
    let farthest = 0;
    for (let i = 1; i < samples.length; i++) {
      const d = samples[i] * scale - base;
      if (d > farthest) farthest = d;
      distance[i] = farthest;
    }
    if (!(farthest > 0.0001)) return null;
    return { distance, total: farthest, segments: distance.length - 1 };
  }

  function advanceRootMotionPhase(anim, startPhase, travel, motionScale) {
    const profile = rootMotionProfile(anim, motionScale);
    if (!profile || !(travel > 0)) return null;
    const n = profile.segments;
    const clampedMove = (((Number(anim.frameControl) || 0) & 0xF0) === 0);
    const phase = clampedMove ? clamp(Number(startPhase) || 0, 0, 1) : (((Number(startPhase) % 1) + 1) % 1);
    const x = phase * n;
    const i = Math.min(n - 1, Math.max(0, Math.floor(x)));
    const frac = x - i;
    const d0 = profile.distance[i], d1 = profile.distance[i + 1];
    let target = d0 + (d1 - d0) * frac + travel;
    if (clampedMove) target = Math.min(profile.total, target);
    else {
      target %= profile.total;
      if (target < 0) target += profile.total;
    }
    let lo = 0, hi = n;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (profile.distance[mid] <= target) lo = mid;
      else hi = mid;
    }
    let outFrac = 0;
    const a = profile.distance[lo], b = profile.distance[Math.min(n, lo + 1)];
    if (b > a + 1e-8) outFrac = clamp((target - a) / (b - a), 0, 1);
    const result = (lo + outFrac) / n;
    return clampedMove ? clamp(result, 0, 1) : result % 1;
  }

  function pathDistance(actor, startFrame, endFrame) {
    if (!(endFrame > startFrame)) return 0;
    if (!actor._pathDistanceCaches) actor._pathDistanceCaches = new Map();
    const base = Math.max(0, Math.floor(startFrame));
    const key = String(base);
    let c = actor._pathDistanceCaches.get(key);
    if (!c) {
      const p0 = actorTransformPosition(actor, base);
      c = { base, points: [p0], distances: [0] };
      actor._pathDistanceCaches.set(key, c);
    }
    const target = Math.max(base, Math.floor(endFrame));
    while (c.base + c.points.length - 1 < target) {
      const f = c.base + c.points.length;
      const p = actorTransformPosition(actor, f), prev = c.points[c.points.length - 1];
      c.points.push(p);
      c.distances.push(c.distances[c.distances.length - 1] + Math.hypot(p[0]-prev[0], p[2]-prev[2]));
    }
    let dist = c.distances[target - c.base] || 0;
    const frac = clamp(endFrame - target, 0, 1);
    if (frac > 0) {
      const p0 = c.points[target - c.base], p1 = actorTransformPosition(actor, target + 1);
      dist += Math.hypot(p1[0]-p0[0], p1[2]-p0[2]) * frac;
    }
    return dist;
  }

  function sequenceMorphStateAt(curve, frame) {
    if(!curve)return null;
    const ch=[null,null,null]; let any=false;
    for(const e of curve.events||[]){
      if(e.time>frame)break;
      if(e.opcode!==0x04)continue;
      const sub=e.paramU&0xFF, channel=sub<0x0F?2:0, prev=ch[channel];
      const a=prev?prev.b:-1,b=sub-1,duration=(e.paramU>>>8)&0xFF;
      ch[channel]={a,b,start:e.time,duration};any=true;
    }
    if(!any)return null;
    const out={channels:{}};
    for(const channel of [0,2]){const q=ch[channel];if(!q)continue;const w=q.duration>0?clamp((frame-q.start)/q.duration,0,1):1;out.channels[channel]={a:q.a,b:q.b,weight:w};}
    return out;
  }

  function conditionLabelTime(curve,label){
    for(const b of (curve&&curve.conditionBlocks)||[])for(const e of b.entries||[])if(e.op===9&&(e.paramU&0xFFFF)===(label&0xFFFF))return b.time;
    return -1;
  }
  function newConditionState(){return {raw:0,frame:0,seqCounter:0,boolFlag:0,condFlag:0,global1:0,global2:0,global3:0,paused:null,skipPauseKey:-1,initialized:false};}
  function evalSequenceCondition(st,code){
    switch(code|0){
      case 0:case 15:return true;
      case 1:return st.seqCounter<=0;case 2:return st.seqCounter>0;
      case 3:return true;case 4:return false; // viewer maps default to the normal daytime presentation
      case 5:return st.boolFlag===0;case 6:return st.boolFlag===1;
      case 7:return st.condFlag===0;case 8:return st.condFlag!==0;
      case 9:return st.global1<=0;case 10:return st.global1>0;
      case 11:return st.global2<=0;case 12:return st.global2>0;
      case 13:return true;case 14:return false; // no gameplay timer is running in the map viewer
      case 16:return st.global3!==0;case 17:return st.global3===0;
      default:return true;
    }
  }
  function runConditionBlock(curve,block,st){
    let jumped=false;
    for(const e of block.entries||[]){
      const op=e.op|0;let operand=e.operand|0,pass=true;
      if(op===2||op===3)pass=true;else if(op!==6&&op!==7&&op!==8&&op!==9)pass=evalSequenceCondition(st,operand);
      if(op===8||op===9||op===6||op===7)continue;
      if(!pass)continue;
      if(op===1){st.frame=e.paramU&0xFFFF;jumped=true;st.paused=null;return 'jump';}
      if(op===10){const t=conditionLabelTime(curve,e.paramU);if(t>=0){st.frame=t;jumped=true;st.paused=null;return 'jump';}continue;}
      if(op===2){const sub=operand;switch(sub){case 1:st.seqCounter=e.paramS;break;case 3:st.global1=e.paramS;break;case 4:st.global2=e.paramS;break;case 5:st.boolFlag=e.paramS;break;case 2:case 0:case 6:break;}continue;}
      if(op===3){if(operand===0)st.seqCounter+=e.paramS;continue;}
      if(op===4){if(st.skipPauseKey===block.index){st.skipPauseKey=-1;continue;}st.frame=block.time;st.paused=block;return 'pause';}
      if(op===5){st.paused=null;return 'continue';}
    }
    return jumped?'jump':'ok';
  }
  function applyAngleModeFrame(curve, frame){
    if(!curve)return frame;
    let loop=null;
    for(const e of curve.events||[]){
      if(e.opcode!==0x09)continue;
      const start=Math.max(0,Number(e.paramU)||0),end=Math.max(start+1,Number(e.time)||0);
      if(frame+1e-6<end)break;
      loop={start,end};
    }
    if(!loop)return frame;
    const span=Math.max(1e-6,loop.end-loop.start);
    return loop.start+(((Number(frame)||0)-loop.end)%span+span)%span;
  }

  function effectiveSequenceFrame(actor, rawFrame){
    const curve=actor&&actor.curve;if(!curve)return rawFrame;
    if(!curve.conditionBlocks||!curve.conditionBlocks.length)return applyAngleModeFrame(curve,rawFrame);
    let st=actor._pfpConditionRuntime;
    const target=Math.max(0,Number(rawFrame)||0),targetInt=Math.floor(target);
    if(!st||targetInt<st.raw){st=newConditionState();actor._pfpConditionRuntime=st;}
    const blocks=curve.conditionBlocks;
    if(!st.initialized){
      st.initialized=true;
      for(const b of blocks){if(b.time>0)break;if(Math.abs(b.time-st.frame)<1e-6){const r=runConditionBlock(curve,b,st);if(r==='pause'||r==='jump')break;}}
    }
    let guard=0;
    while(st.raw<targetInt&&guard++<20000){
      if(st.paused){const b=st.paused;st.paused=null;st.skipPauseKey=b.index;runConditionBlock(curve,b,st);st.raw++;continue;}
      const next=st.frame+1;let block=null;
      for(const b of blocks){if(b.time>st.frame+1e-6&&b.time<=next+1e-6){block=b;break;}}
      if(block){st.frame=block.time;const r=runConditionBlock(curve,block,st);st.raw++;if(r==='pause'||r==='jump')continue;st.frame=next;}
      else{st.frame=next;st.raw++;}
    }
    const frac=target-targetInt;const out=st.paused?st.frame:st.frame+frac;return applyAngleModeFrame(curve,out);
  }

  function buildRomCurveNetwork(world){
    const nodes=new Map(),instances=world&&Array.isArray(world.objectInstances)?world.objectInstances:[];
    for(const inst of instances){
      try{
        const p=inst&&inst.objParams,name=String(inst&&inst.objType&&inst.objType.name||''),cls=Number(inst&&inst.objType&&inst.objType.objClass);
        if(!p||p.byteLength<0x30||(cls!==293&&!/^curve$/i.test(name)&&!name.toLowerCase().includes('romcurve')))continue;
        const id=p.getUint32(0x14,false);if(!Number.isFinite(id))continue;
        const pos=inst.position&&inst.position.length>=3?[Number(inst.position[0]),Number(inst.position[1]),Number(inst.position[2])]:[p.getFloat32(0x08,false),p.getFloat32(0x0C,false),p.getFloat32(0x10,false)];
        const links=[];for(let i=0;i<4;i++)links.push(p.getInt32(0x1C+i*4,false));
        nodes.set(id,{id,x:pos[0],y:pos[1],z:pos[2],action:p.getInt8(0x18),type:p.getInt8(0x19),directionMask:p.getUint8(0x1B),links,yaw:p.getInt8(0x2C),pitch:p.getInt8(0x2D),tangentMag:p.getUint8(0x2E)});
      }catch(_){}
    }
    return nodes;
  }
  function romCurveActivation(actor,frame){let found=null;for(const e of actor&&actor.curve&&actor.curve.events||[]){if(e.time>frame)break;if(e.opcode===0x100&&e.software===2)found=e;}return found;}
  function actorUsesRomCurveAt(actor,frame){return !!romCurveActivation(actor,frame);}
  function hermite4(p,t){const t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*p[0]+(t3-2*t2+t)*p[2]+(-2*t3+3*t2)*p[1]+(t3-t2)*p[3];}
  function hermite4Tangent(p,t){const t2=t*t;return (6*t2-6*t)*p[0]+(3*t2-4*t+1)*p[2]+(-6*t2+6*t)*p[1]+(3*t2-2*t)*p[3];}
  function romNodeAngle(v){return Number(v||0)*Math.PI/128;}
  function romSegment(a,b){
    const sa=2*(a.tangentMag||0),sb=2*(b.tangentMag||0),ay=romNodeAngle(a.yaw),by=romNodeAngle(b.yaw),ap=romNodeAngle(a.pitch),bp=romNodeAngle(b.pitch);
    const x=[a.x,b.x,sa*Math.sin(ay),sb*Math.sin(by)],y=[a.y,b.y,sa*Math.sin(ap),sb*Math.sin(bp)],z=[a.z,b.z,sa*Math.cos(ay),sb*Math.cos(by)],times=[0],pts=[];
    for(let i=0;i<=8;i++){const t=i/8;pts.push([hermite4(x,t),hermite4(y,t),hermite4(z,t)]);if(i){const p=pts[i-1],q=pts[i];times.push(times[i-1]+Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2]));}}
    return {a,b,x,y,z,times,length:times[8]};
  }
  function romNext(nodes,node,forward){if(!node)return null;let mask=1;for(let i=0;i<4;i++,mask<<=1){const id=node.links[i];if(id>-1&&(((node.directionMask&mask)===0)===!!forward)){const n=nodes.get(id);if(n)return n;}}return null;}
  function actorLinearPosition(actor,frame){
    const lx=sample(actor.curve,CHANNEL.POS_X,frame,0),ly=sample(actor.curve,CHANNEL.POS_Y,frame,0),lz=sample(actor.curve,CHANNEL.POS_Z,frame,0),b=actor.basePosition||actor.sourcePos||[0,0,0];
    const h=Number(actor.heading)||0,c=Math.cos(h),sn=Math.sin(h);return [b[0]+c*lx+sn*lz,b[1]+ly,b[2]+c*lz-sn*lx];
  }
  function findActorRomCurveStart(actor,activation){
    const nodes=actor._pfpRomCurveNetwork||(actor._pfpRomCurveNetwork=buildRomCurveNetwork(actor.world||(actor.instance&&actor.instance.world)));if(!nodes.size)return null;
    const key=`${activation.index}:${activation.softwareArg}`;if(actor._pfpRomCurveStart&&actor._pfpRomCurveStart.key===key)return actor._pfpRomCurveStart.node;
    const p=actorLinearPosition(actor,activation.time),action=activation.softwareArg|0;let best=null,bestD=Infinity,bestAction=null,bestActionD=Infinity;
    for(const n of nodes.values()){if(n.type!==0x19&&n.type!==0x15)continue;const d=Math.hypot(n.x-p[0],n.y-p[1],n.z-p[2]);if(d<bestD){bestD=d;best=n;}if(n.action===action&&d<bestActionD){bestActionD=d;bestAction=n;}}
    const node=bestAction||best;actor._pfpRomCurveStart={key,node};return node;
  }
  function evalActorRomCurve(actor,frame){
    const activation=romCurveActivation(actor,frame);if(!activation)return null;const nodes=actor._pfpRomCurveNetwork||(actor._pfpRomCurveNetwork=buildRomCurveNetwork(actor.world||(actor.instance&&actor.instance.world))),start=findActorRomCurveStart(actor,activation);if(!start||!nodes.size)return null;
    const lateral=sample(actor.curve,CHANNEL.POS_X,frame,0),vertical=sample(actor.curve,CHANNEL.POS_Y,frame,0),dist=sample(actor.curve,CHANNEL.POS_Z,frame,0),ground=toggleAt(actor.curve,0x07,frame);
    let a,b,startTime=0,seg=null;
    if(dist>=0){a=start;b=romNext(nodes,a,true);let guard=0;while(b&&guard++<128){seg=romSegment(a,b);const endTime=startTime+seg.length;if(dist<endTime||seg.length<1e-6)break;startTime=endTime;a=b;b=romNext(nodes,a,true);seg=null;}}
    else{b=start;a=romNext(nodes,b,false);let endTime=0,guard=0;while(a&&guard++<128){seg=romSegment(a,b);startTime=endTime-seg.length;if(dist>=startTime||seg.length<1e-6)break;endTime=startTime;b=a;a=romNext(nodes,b,false);seg=null;}}
    if(!seg){const n=dist>=0?a:b||start,ang=romNodeAngle(n.yaw);let x=n.x+lateral*Math.cos(ang),z=n.z+lateral*Math.sin(ang),y=n.y+vertical;if(ground){const deep=!actor.isPlayer&&actor.curve&&actor.curve.channels&&!actor.curve.channels.has(CHANNEL.POS_Y);const gy=sfaGroundYAt(actor.mapInstance,x,y,z,deep?1024:192);if(Number.isFinite(gy))y=gy;}return {position:[x,y,z],heading:ang+Math.PI};}
    const times=seg.times.map(v=>v+startTime);let i=0;while(i<=8&&dist>=times[i])i++;let idx=Math.max(0,Math.min(7,i-1));const den=times[idx+1]-times[idx],u=den>1e-8?clamp((dist-times[idx])/den,0,1):0,t=(idx+u)/8;
    let x=hermite4(seg.x,t),y=hermite4(seg.y,t),z=hermite4(seg.z,t),tx=hermite4Tangent(seg.x,t),tz=hermite4Tangent(seg.z,t),len=Math.hypot(tx,tz),heading=Number(actor.heading)||0;
    if(len>0.1){const sc=lateral/len;heading=Math.atan2(tx,tz)+Math.PI;x+=tz*sc;z-=tx*sc;}if(!ground)y+=vertical;else{const deep=!actor.isPlayer&&actor.curve&&actor.curve.channels&&!actor.curve.channels.has(CHANNEL.POS_Y);const gy=sfaGroundYAt(actor.mapInstance,x,y,z,deep?1024:192);if(Number.isFinite(gy))y=gy;}
    return {position:[x,y,z],heading};
  }

  function sfaGroundYAt(map, x, y, z, maxDrop=192) {
    if(!map||typeof map.getBlockAtPosition!=='function'||!map.info)return null;
    try{
      const origin=map.info.getOrigin?map.info.getOrigin():[0,0];
      const mx=x+640*(Number(origin&&origin[0])||0),mz=z+640*(Number(origin&&origin[1])||0);
      const bx=Math.floor(mx/640),bz=Math.floor(mz/640),block=map.getBlockAtPosition(mx,mz);
      const col=block&&block.model&&block.model._sfaCollision;
      if(!col||!Array.isArray(col.triangles)||!col.triangles.length)return null;
      const qx=mx-bx*640,qz=mz-bz*640,eps=1e-4;
      const MAX_DROP=Math.max(0,Number(maxDrop)||192),MAX_RISE=40,MIN_HORIZONTAL=0.30;
      let below=null,belowD=Infinity,above=null,aboveD=Infinity;
      for(const t of col.triangles){
        const a=t.v0,b=t.v1,c=t.v2;if(!a||!b||!c)continue;
        if(((Number(t.flags)||0)&0x10)!==0||(Number(t.surfaceType)|0)===14)continue;
        const abx=b[0]-a[0],aby=b[1]-a[1],abz=b[2]-a[2],acx=c[0]-a[0],acy=c[1]-a[1],acz=c[2]-a[2];
        const nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx,nlen=Math.hypot(nx,ny,nz);
        if(!(nlen>1e-6)||Math.abs(ny)/nlen<MIN_HORIZONTAL)continue;
        const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
        if(Math.abs(den)<1e-6)continue;
        const u=((b[2]-c[2])*(qx-c[0])+(c[0]-b[0])*(qz-c[2]))/den;
        const v=((c[2]-a[2])*(qx-c[0])+(a[0]-c[0])*(qz-c[2]))/den;
        const w=1-u-v;if(u<-eps||v<-eps||w<-eps)continue;
        const gy=u*a[1]+v*b[1]+w*c[1];if(!Number.isFinite(gy))continue;
        const delta=gy-y;
        if(delta<=8&&delta>=-MAX_DROP){const d=-delta;if(d<belowD){belowD=d;below=gy;}}
        else if(delta>8&&delta<=MAX_RISE&&delta<aboveD){aboveD=delta;above=gy;}
      }
      return below!==null?below:(above!==null?above:null);
    }catch(_){return null;}
  }

  function actorTransformState(actor, frame) {
    const rom=evalActorRomCurve(actor,frame);if(rom)return rom;
    const p=actorLinearPosition(actor,frame),lx=sample(actor.curve,CHANNEL.POS_X,frame,0),ly=sample(actor.curve,CHANNEL.POS_Y,frame,0),lz=sample(actor.curve,CHANNEL.POS_Z,frame,0);
    let [x,y,z]=p;
    if(toggleAt(actor.curve,0x07,frame)&&!actor.sequenceParent){const deep=!actor.isPlayer&&actor.curve&&actor.curve.channels&&!actor.curve.channels.has(CHANNEL.POS_Y);const gy=sfaGroundYAt(actor.mapInstance,x,y,z,deep?1024:192);if(Number.isFinite(gy))y=gy+ly;}
    return {position:[x,y,z],heading:Number(actor.heading)||0};
  }
  function actorTransformPosition(actor, frame) { return actorTransformState(actor,frame).position; }

  function track9Progress(actor, startFrame, endFrame) {
    if (!(endFrame > startFrame)) return 0;
    if (!actor._track9Prefix) actor._track9Prefix = [0];
    const maxInt = Math.max(0, Math.floor(endFrame));
    while (actor._track9Prefix.length <= maxInt + 1) {
      const f = actor._track9Prefix.length - 1;
      const inc = sample(actor.curve, CHANNEL.ANIM_TIMER, f, 0) * 0.0004;
      actor._track9Prefix.push(actor._track9Prefix[actor._track9Prefix.length - 1] + (Number.isFinite(inc) ? inc : 0));
    }
    const integralAt = (x) => {
      x = Math.max(0, x);
      const i = Math.floor(x), frac = x - i;
      while (actor._track9Prefix.length <= i + 1) {
        const f = actor._track9Prefix.length - 1;
        const inc = sample(actor.curve, CHANNEL.ANIM_TIMER, f, 0) * 0.0004;
        actor._track9Prefix.push(actor._track9Prefix[actor._track9Prefix.length - 1] + (Number.isFinite(inc) ? inc : 0));
      }
      const inc = sample(actor.curve, CHANNEL.ANIM_TIMER, i, 0) * 0.0004;
      return actor._track9Prefix[i] + (Number.isFinite(inc) ? inc : 0) * frac;
    };
    return integralAt(endFrame) - integralAt(startFrame);
  }

  function actorRootMotionScale(actor, frame) {
    let base = Number(actor && actor.instance && actor.instance.objType && actor.instance.objType.scale);
    if (!Number.isFinite(base) || Math.abs(base) < 1e-6)
      base = actor && actor.original && Number.isFinite(Number(actor.original.scale)) ? Number(actor.original.scale) : 1;
    if (actor && actor.curve && actor.curve.channels && actor.curve.channels.has(CHANNEL.ROOT_MOTION_SCALE)) {
      const authored = sample(actor.curve, CHANNEL.ROOT_MOTION_SCALE, frame, 1);
      if (Number.isFinite(authored)) return base * authored;
    }
    return base;
  }

  function phaseForActor(actor, ev, frame, anim) {
    if (!ev || !anim) return 0;
    const startPhase = (((ev.paramU >>> 8) & 0xF0) / 256);
    if (frame <= ev.time) return startPhase;
    let phase = startPhase, segStart = Math.max(0, Number(ev.time) || 0);
    let moveMode = toggleAt(actor.curve, 0x01, segStart);
    const hasScaleTrack = !!(actor && actor.curve && actor.curve.channels && actor.curve.channels.has(CHANNEL.ROOT_MOTION_SCALE));
    const advanceRooted = (a,b) => {
      if (!(b > a)) return false;
      let cur=a, used=false;
      while(cur < b - 1e-8){
        const next=Math.min(b,Math.floor(cur+1e-7)+1);
        const travel=pathDistance(actor,cur,next);
        const motionScale=actorRootMotionScale(actor,(cur+next)*0.5);
        const rooted=advanceRootMotionPhase(anim,phase,travel,motionScale);
        if(rooted!==null){phase=rooted;used=true;}
        else{
          const cycle=rootCycleDistance(anim)*Math.abs(Number(motionScale)||1);
          if(Number.isFinite(cycle)&&cycle>0.0001){phase+=travel/cycle;used=true;}
          else return false;
        }
        cur=next;
      }
      return used;
    };
    const advance = (a,b,mode) => {
      if (!(b > a)) return;
      if (mode) {
        if(hasScaleTrack){if(advanceRooted(a,b))return;}
        else{
          const travel = pathDistance(actor,a,b);
          const motionScale = actor && actor.original && Number.isFinite(Number(actor.original.scale)) ? Number(actor.original.scale) : 1;
          const rooted = advanceRootMotionPhase(anim,phase,travel,motionScale);
          if (rooted !== null) { phase = rooted; return; }
          const cycle = rootCycleDistance(anim);
          if (Number.isFinite(cycle) && cycle > 0.0001) { phase += travel / cycle; return; }
        }
      }
      phase += track9Progress(actor,a,b);
    };
    for (const e of actor.curve.events) {
      if (e.opcode !== 0x01 || e.time <= segStart) continue;
      if (e.time > frame) break;
      advance(segStart,e.time,moveMode);
      segStart=e.time;moveMode=!moveMode;
    }
    advance(segStart,frame,moveMode);
    if ((((Number(anim.frameControl) || 0) & 0xF0) === 0)) return clamp(phase, 0, 1);
    phase -= Math.floor(phase);
    return phase < 0 ? phase + 1 : phase;
  }

  function makeObjectParams(defNo, uid, pos) {
    const d = new DataView(new ArrayBuffer(0x80));
    d.setUint16(0, defNo & 0xFFFF, false); d.setUint8(2, 0x20);
    d.setFloat32(8, Number(pos[0]) || 0, false); d.setFloat32(12, Number(pos[1]) || 0, false); d.setFloat32(16, Number(pos[2]) || 0, false);
    d.setUint32(20, uid >>> 0, false);
    return d;
  }

  function cloneSequencePlacementFromResident(world, rawDef, uid, pos) {
    try{
      const want=Number(rawDef)&0xFFFF,target=Array.isArray(pos)?pos:[0,0,0];
      let best=null,bestD=Infinity;
      for(const o of (world&&world.objectInstances)||[]){
        if(!o||o._pfpMapSequenceTemp||!o.objParams||romDefNo(o)!==want)continue;
        const p=worldPosOf(o),d=Math.hypot((p[0]||0)-(target[0]||0),(p[1]||0)-(target[1]||0),(p[2]||0)-(target[2]||0));
        if(d<bestD){bestD=d;best=o;}
      }
      if(!best)return null;
      const src=best.objParams,ab=new ArrayBuffer(Math.max(0x80,src.byteLength));
      new Uint8Array(ab).set(new Uint8Array(src.buffer,src.byteOffset,src.byteLength));
      const d=new DataView(ab);
      d.setUint16(0,want,false);d.setFloat32(8,Number(target[0])||0,false);d.setFloat32(12,Number(target[1])||0,false);d.setFloat32(16,Number(target[2])||0,false);d.setUint32(20,(Number(uid)||0)>>>0,false);
      return d;
    }catch(_){return null;}
  }

  function isCollectibleSequenceType(objType) {
    const n=normalObjectName(objType&&objType.name),c=Number(objType&&objType.objClass);
    return c===237||/spellstone|powercrys|firecryst|goldbar|sunstone|moonstone|guardpass|energygem|pickkryst/.test(n);
  }

  function sequencePlacementParamsForProp(world, rawDef, uid, pos) {
    const fallback=makeObjectParams(rawDef,uid,pos);
    try{
      const ot=world&&world.objectMan&&world.objectMan.getObjectType?world.objectMan.getObjectType(rawDef,false):null;
      if(isCollectibleSequenceType(ot))return cloneSequencePlacementFromResident(world,rawDef,uid,pos)||fallback;
    }catch(_){}
    return fallback;
  }

  function setSequenceModelSlot(inst, slot) {
    if(!inst||typeof inst.setModelNum!=='function')return false;
    const nums=inst.objType&&Array.isArray(inst.objType.modelNums)?inst.objType.modelNums:null;
    slot=Number(slot)|0;if(!nums||slot<0||slot>=nums.length)return false;
    const mf=inst.world&&inst.world.resColl&&inst.world.resColl.modelFetcher,tf=inst.world&&inst.world.resColl&&inst.world.resColl.texFetcher;
    const providers=inst._pfpSequenceModelProviders;
    let oldOrder=null,oldPreferred=null,adjusted=false;
    try{
      const modelId=Number(nums[slot]),plist=providers&&providers[String(modelId)];
      if(mf&&Array.isArray(mf.subdirOrder)&&Array.isArray(plist)){
        const pd=plist.find(d=>mf.files&&mf.files[d]&&typeof mf.files[d].hasModel==='function'&&mf.files[d].hasModel(modelId));
        if(pd){
          oldOrder=mf.subdirOrder.slice();oldPreferred=tf&&Object.prototype.hasOwnProperty.call(tf,'preferredSubdir')?tf.preferredSubdir:null;
          mf.subdirOrder=[pd,...oldOrder.filter(d=>d!==pd)];
          try{if(tf&&typeof tf.setPreferredSubdir==='function')tf.setPreferredSubdir(pd);}catch(_){}
          adjusted=true;
        }
      }
      inst.setModelNum(slot);return !!inst.modelInst;
    }catch(_){return false;}
    finally{
      if(adjusted){try{mf.subdirOrder=oldOrder;}catch(_){}try{if(tf&&typeof tf.setPreferredSubdir==='function')tf.setPreferredSubdir(oldPreferred);}catch(_){}}
    }
  }

  function dataViewFromBase64(text) {
    try {
      const bin = atob(String(text || ''));
      if (!bin.length) return null;
      const ab = new ArrayBuffer(bin.length), u8 = new Uint8Array(ab);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i) & 0xFF;
      return new DataView(ab);
    } catch (_) { return null; }
  }

  function findByUid(world, uid) {
    if (!world || !Array.isArray(world.objectInstances) || !uid) return null;
    const u = uid >>> 0;
    for (const o of world.objectInstances) {
      if (!o || o._pfpMapSequenceTemp) continue;
      try { if ((o.commonObjectParams.id >>> 0) === u) return o; } catch (_) {}
    }
    return null;
  }

  function romDefNo(inst) {
    try { return Number(inst.commonObjectParams.objType) & 0xFFFF; } catch (_) { return -1; }
  }

  function objectDefNo(inst) {
    try {
      const t = inst && typeof inst.getType === 'function' ? inst.getType() : inst && inst.objType;
      return t && Number.isFinite(Number(t.typeNum)) ? (Number(t.typeNum) & 0xFFFF) : -1;
    } catch (_) { return -1; }
  }

  function worldPosOf(inst) {
    if (!inst) return [0, 0, 0];
    try {
      if (typeof inst.getPosition === 'function') {
        const out = [0, 0, 0]; inst.getPosition(out); if (out.every(Number.isFinite)) return out;
      }
    } catch (_) {}
    const p = inst.position || [0, 0, 0];
    return [Number(p[0]) || 0, Number(p[1]) || 0, Number(p[2]) || 0];
  }

  function findNearestResidentRaw(world, rawNo, fromPos, claimed) {
    if (!world || !Array.isArray(world.objectInstances)) return null;
    let best = null, bestD = Infinity; const want = Number(rawNo) & 0xFFFF;
    for (const o of world.objectInstances) {
      if (!o || o._pfpMapSequenceTemp || (claimed && claimed.has(o))) continue;
      if (romDefNo(o) !== want) continue;
      const p = worldPosOf(o), dx = fromPos[0] - p[0], dy = fromPos[1] - p[1], dz = fromPos[2] - p[2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  function findNearestResidentDef(world, defNo, fromPos, claimed) {
    if (!world || !Array.isArray(world.objectInstances)) return null;
    let best = null, bestD = Infinity; const want = Number(defNo) & 0xFFFF;
    for (const o of world.objectInstances) {
      if (!o || o._pfpMapSequenceTemp || (claimed && claimed.has(o))) continue;
      if (objectDefNo(o) !== want) continue;
      const p = worldPosOf(o), dx = fromPos[0] - p[0], dy = fromPos[1] - p[1], dz = fromPos[2] - p[2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  function sourceHeading(inst) {
    const y = Number(inst && inst.yaw);
    return Number.isFinite(y) ? y : 0;
  }

  function sourceLocalPose(inst) {
    const p=(inst&&inst.position)||[0,0,0];
    return {
      position:[Number(p[0])||0,Number(p[1])||0,Number(p[2])||0],
      yaw:sourceHeading(inst),
      parent:(inst&&inst.parent)||null,
    };
  }

  function renderedWorldPose(inst) {
    try {
      if(inst&&typeof inst.getWorldSRT==='function'){
        const m=new Float32Array(16);inst.getWorldSRT(m);
        if([m[12],m[13],m[14],m[8],m[10]].every(Number.isFinite))return {position:[m[12],m[13],m[14]],yaw:Math.atan2(m[8],m[10])};
      }
    }catch(_){}
    return {position:worldPosOf(inst),yaw:sourceHeading(inst)};
  }

  function objectModelFlags(inst) {
    try {
      const d=inst&&inst.objType&&inst.objType.data;
      if(d&&d.byteLength>=0x48)return d.getUint32(0x44,false)>>>0;
    }catch(_){}
    return 0;
  }

  function worldPointFromParent(parent, localPos) {
    const p=localPos||[0,0,0];
    if(!parent)return [p[0],p[1],p[2]];
    try{
      if(typeof parent.getSRTForChildren==='function'){
        const m=parent.getSRTForChildren();
        return [
          m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
          m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
          m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14],
        ];
      }
    }catch(_){}
    return [p[0]+(Number(parent.position&&parent.position[0])||0),p[1]+(Number(parent.position&&parent.position[1])||0),p[2]+(Number(parent.position&&parent.position[2])||0)];
  }


  function mulMat4(out, a, b) {
    const r = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      const b0=b[c*4],b1=b[c*4+1],b2=b[c*4+2],b3=b[c*4+3];
      r[c*4]   = a[0]*b0+a[4]*b1+a[8]*b2+a[12]*b3;
      r[c*4+1] = a[1]*b0+a[5]*b1+a[9]*b2+a[13]*b3;
      r[c*4+2] = a[2]*b0+a[6]*b1+a[10]*b2+a[14]*b3;
      r[c*4+3] = a[3]*b0+a[7]*b1+a[11]*b2+a[15]*b3;
    }
    for(let i=0;i<16;i++)out[i]=r[i];
    return out;
  }

  function copyMat4(out, src) {
    for(let i=0;i<16;i++)out[i]=src[i];
    return out;
  }

  function normalObjectName(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function objectName(inst) {
    try { return String(typeof inst.getName === 'function' ? inst.getName() : (inst.objType && inst.objType.name) || ''); } catch (_) { return ''; }
  }

  function rawDefByObjectNames(world, names, preferred = []) {
    const om = world && world.objectMan; if (!om || typeof om.getObjectType !== 'function') return -1;
    const want = (names || []).map(normalObjectName).filter(Boolean); if (!want.length) return -1;
    if (!world._pfpSequenceRawNameCache) world._pfpSequenceRawNameCache = new Map();
    const cacheKey = want.join('|'); if (world._pfpSequenceRawNameCache.has(cacheKey)) return world._pfpSequenceRawNameCache.get(cacheKey);
    const matches = (ot) => { const n = normalObjectName(ot && ot.name); return !!n && want.some(w => n === w); };
    for (const r0 of preferred || []) {
      const r = Number(r0) & 0xFFFF; try { const ot = om.getObjectType(r, false); if (matches(ot)) { world._pfpSequenceRawNameCache.set(cacheKey, r); return r; } } catch (_) {}
    }
    for (let r = 0; r < 0x1000; r++) {
      try { const ot = om.getObjectType(r, false); if (matches(ot)) { world._pfpSequenceRawNameCache.set(cacheKey, r); return r; } } catch (_) {}
    }
    world._pfpSequenceRawNameCache.set(cacheKey, -1); return -1;
  }

  function isGeneralScalesName(name) {
    const n = normalObjectName(name);
    return n.includes('generalscal') || n.includes('bossgeneral') || n.includes('wmgeneralscale') || n === 'cfgenerals' || n === 'mmshscales';
  }

  function isKnownHeldPropName(name) {
    const n = normalObjectName(name);
    return /^scweapont[1-4]$/.test(n) || /^animscweapon/.test(n) || /^lfweapont[12]$/.test(n) || n === 'bgsweapon' || n === 'sword' || n.includes('telescope') || /spellstone|powercrys|crystal|energygem|key|truthhorn|hornoftruth|tooth|totem/.test(n);
  }

  function isCloudRunnerQueenName(name) {
    const n=normalObjectName(name);
    return n==='ccqueen'||n.includes('cloudrunnerqueen')||n.includes('queencloud');
  }

  function pairIdAt(inst) {
    try { return inst&&inst.objParams&&inst.objParams.byteLength>0x1B?inst.objParams.getUint8(0x1B):-1; } catch (_) { return -1; }
  }

  function isNwIceAnchor(name) { return /^nw_animice[123]$/i.test(String(name||'')); }
  function isNwIceVisible(name) { return /^nw_ice[123]$/i.test(String(name||'')); }

  function fixCollectibleTintMaterials(inst) {
    try {
      if(!inst||!inst.modelInst||typeof inst.modelInst.getMaterials!=='function')return;
      const n=normalObjectName(inst.objType&&inst.objType.name);
      if(!/spellstone|sbspellsto|powercrys|firecryst|guardpass|goldbar|moonstone|sunstone/.test(n))return;
      const p=inst.objParams;if(!p||p.byteLength<0x2B||!p.getUint8(0x27))return;
      for(const mat of inst.modelInst.getMaterials()||[]){
        const sh=mat&&mat.shader;if(!sh)continue;
        const layers=Array.isArray(sh.layers)?sh.layers:[];
        if(layers.some(l=>l&&l.texId!==null&&l.texId!==undefined))continue;
        sh.pfpCollectibleSolidTint=1;
        try{if(typeof mat.rebuild==='function')mat.rebuild();}catch(_){}
      }
    } catch (_) {}
  }

  function playerAttachmentPoint(inst, pointIndex) {
    try {
      const d=inst&&inst.objType&&inst.objType.data;
      const mi=inst&&inst.modelInst;
      if(!d||d.byteLength<0x5A||!mi||!mi.model||!mi.skeletonInst)return null;
      const count=d.getUint8(0x58);
      if(pointIndex<0||pointIndex>=count)return null;
      const base=d.getUint32(0x2C,false)>>>0,off=base+pointIndex*0x18;
      if(!base||off+0x18>d.byteLength)return null;
      const modelSlot=Math.max(0,Number(mi._pfpModelSlot)||0);
      const jointOff=off+0x12+Math.min(5,modelSlot);
      const joint=d.getInt8(jointOff);
      if(joint<0||joint>=mi.model.joints.length)return null;
      return {
        x:d.getFloat32(off,false),y:d.getFloat32(off+4,false),z:d.getFloat32(off+8,false),
        rotX:d.getInt16(off+0x0C,false),rotY:d.getInt16(off+0x0E,false),rotZ:d.getInt16(off+0x10,false),
        joint
      };
    } catch (_) { return null; }
  }

  function buildPlayerAttachmentWorld(out, player, staff, pointIndex) {
    if(!player||!staff||!player.modelInst||!player.modelInst.skeletonInst)return false;
    const ap=playerAttachmentPoint(player,pointIndex);if(!ap)return false;
    try{
      const playerWorld=new Float32Array(16);player.getWorldSRT(playerWorld);
      const joint=player.modelInst.skeletonInst.getJointMatrix(ap.joint);if(!joint)return false;
      const local=new Float32Array(16);
      setRetailCameraWorldMatrix(local,ap.rotX,ap.rotY,ap.rotZ,ap.x,ap.y,ap.z);
      const jointAttach=new Float32Array(16);mulMat4(jointAttach,joint,local);
      mulMat4(out,playerWorld,jointAttach);
      setAttachedBasisScale(out, Number(staff._pfpStaffBaseScale));
      return true;
    }catch(_){return false;}
  }

  function attachmentPointCount(inst) {
    try { const d=inst&&inst.objType&&inst.objType.data; return d&&d.byteLength>0x58?Math.max(0,Number(d.getUint8(0x58))||0):0; } catch (_) { return 0; }
  }

  function attachmentLocalMatrix(out,inst,pointIndex) {
    const ap=playerAttachmentPoint(inst,pointIndex),mi=inst&&inst.modelInst;if(!ap||!mi||!mi.skeletonInst)return false;
    try{const joint=mi.skeletonInst.getJointMatrix(ap.joint);if(!joint)return false;const local=new Float32Array(16);setRetailCameraWorldMatrix(local,ap.rotX,ap.rotY,ap.rotZ,ap.x,ap.y,ap.z);mulMat4(out,joint,local);return true;}catch(_){return false;}
  }

  function childCarryAnchors(inst) {
    const out=[];
    try{
      const count=attachmentPointCount(inst),m=new Float32Array(16);
      for(let i=0;i<count;i++)if(attachmentLocalMatrix(m,inst,i))out.push(new Float32Array(m));
    }catch(_){}
    try{
      const sk=inst&&inst.modelInst&&inst.modelInst.skeletonInst,joints=inst&&inst.modelInst&&inst.modelInst.model&&inst.modelInst.model.joints;
      if(sk&&joints)for(let i=0;i<joints.length;i++){const jm=sk.getJointMatrix(i);if(jm)out.push(new Float32Array(jm));}
    }catch(_){}
    return out;
  }

  function buildCarriedActorWorld(out,owner,child,currentWorld) {
    if(!owner||!child||!owner.modelInst||!child.modelInst)return false;
    const childAnchors=childCarryAnchors(child);if(!childAnchors.length)return false;
    const count=attachmentPointCount(owner);if(count<=0)return false;
    const grip=new Float32Array(16),curAnchor=new Float32Array(16);
    const ownerPoints=hasAttachmentPoint(owner,0)?[0]:Array.from({length:count},(_,i)=>i);
    let bestGrip=null,bestAnchor=null,bestD=Infinity;
    for(const childLocal of childAnchors){
      mulMat4(curAnchor,currentWorld,childLocal);
      for(const i of ownerPoints){
        const old=child._pfpStaffBaseScale;child._pfpStaffBaseScale=Number(child.scale)||1;
        const ok=buildPlayerAttachmentWorld(grip,owner,child,i);
        if(old===undefined)delete child._pfpStaffBaseScale;else child._pfpStaffBaseScale=old;
        if(!ok)continue;
        const d=Math.hypot(grip[12]-curAnchor[12],grip[13]-curAnchor[13],grip[14]-curAnchor[14]);
        if(d<bestD){bestD=d;bestGrip=new Float32Array(grip);bestAnchor=new Float32Array(curAnchor);}
      }
    }
    if(!bestGrip||!bestAnchor||!Number.isFinite(bestD)||bestD>320)return false;
    copyMat4(out,currentWorld);
    out[12]+=bestGrip[12]-bestAnchor[12];
    out[13]+=bestGrip[13]-bestAnchor[13];
    out[14]+=bestGrip[14]-bestAnchor[14];
    return true;
  }

  function refreshSequencePropMaterials(inst) {
    try {
      const shapes=inst&&inst.modelInst&&typeof inst.modelInst.getModelShapes==='function'?inst.modelInst.getModelShapes():null;
      const device=inst&&inst.world&&inst.world.context&&inst.world.context.device;
      if(shapes&&device&&typeof shapes.forceMaterialUpdates==='function')shapes.forceMaterialUpdates(device);
    } catch (_) {}
  }

  function useSequenceMapLighting(inst, source) {
    if(!inst)return;
    try{
      const a=Number(source&&source.ambienceIdx);
      if(Number.isFinite(a)&&a>=0&&a<3)inst.ambienceIdx=a;
    }catch(_){}
    if(inst._pfpSequenceLightPosition||typeof inst.getPosition!=='function'||typeof inst.getWorldSRT!=='function')return;
    const oldGetPosition=inst.getPosition.bind(inst),m=new Float32Array(16);
    inst.getPosition=(out)=>{
      try{inst.getWorldSRT(m);out[0]=m[12];out[1]=m[13];out[2]=m[14];return out;}catch(_){}
      return oldGetPosition(out);
    };
    inst._pfpSequenceLightPosition=true;
  }

  function fixSequenceProbeMaterials(inst, forceProp=false) {
    try {
      if(!inst||!inst.modelInst||typeof inst.modelInst.getMaterials!=='function')return;
      const name=normalObjectName(inst.objType&&inst.objType.name);
      const staffLike=!!inst._pfpMapSequenceStaff||name==='staff'||name==='staffend';
      if(!staffLike)return;
      const changed=[];
      const fullTextureFix=true;
      for(const mat of inst.modelInst.getMaterials()||[]){
        const sh=mat&&mat.shader;if(!sh)continue;
        const layers=Array.isArray(sh.layers)?sh.layers:[];
        const textured=layers.filter(l=>l&&l.texId!==null&&l.texId!==undefined);
        if(!textured.length&&!fullTextureFix)continue;
        if(textured.length&&!fullTextureFix&&(!sh.hasReflectiveProbe||layers.length>2))continue;
        const oldTex=Object.prototype.hasOwnProperty.call(sh,'pfpSequenceStaffTextureOnly')?sh.pfpSequenceStaffTextureOnly:undefined;
        const oldSolid=Object.prototype.hasOwnProperty.call(sh,'pfpSequenceStaffSolidOnly')?sh.pfpSequenceStaffSolidOnly:undefined;
        changed.push({mat,sh,oldTex,oldSolid});
        if(textured.length){sh.pfpSequenceStaffTextureOnly=1;try{delete sh.pfpSequenceStaffSolidOnly;}catch(_){}}
        else{sh.pfpSequenceStaffSolidOnly=1;try{delete sh.pfpSequenceStaffTextureOnly;}catch(_){}}
        try{delete sh.pfpSequenceStaffProbeOnly;}catch(_){}
        try{delete sh.pfpSequenceStaffGemFix;}catch(_){}
        try{if(typeof mat.rebuild==='function')mat.rebuild();}catch(_){}
      }
      if(changed.length)inst._pfpSequenceProbeMaterialRestore=changed;
    } catch (_) {}
  }

  function restoreSequenceProbeMaterials(inst) {
    const changed=inst&&inst._pfpSequenceProbeMaterialRestore;if(!Array.isArray(changed))return;
    for(const r of changed){
      try{
        if(r.oldTex===undefined)delete r.sh.pfpSequenceStaffTextureOnly;else r.sh.pfpSequenceStaffTextureOnly=r.oldTex;
        if(r.oldSolid===undefined)delete r.sh.pfpSequenceStaffSolidOnly;else r.sh.pfpSequenceStaffSolidOnly=r.oldSolid;
        if(typeof r.mat.rebuild==='function')r.mat.rebuild();
      }catch(_){}
    }
    try{delete inst._pfpSequenceProbeMaterialRestore;}catch(_){}
  }

  function hasAttachmentPoint(inst, pointIndex) { return !!playerAttachmentPoint(inst, pointIndex); }

  function attachmentPointOrFallback(inst, preferred) {
    if (hasAttachmentPoint(inst, preferred)) return preferred;
    if (preferred !== 1 && hasAttachmentPoint(inst, 1)) return 1;
    if (hasAttachmentPoint(inst, 0)) return 0;
    return -1;
  }

  function freezeStaffEndpoint(rec) {
    const staff = rec && rec.staff; if (!staff) return;
    const anim = staff._pfpStaffAnim || staff.anim;
    if (!anim || !anim.keyframes || !anim.keyframes.length) return;
    staff.anim = anim;
    if (Number.isFinite(Number(staff._pfpStaffModelAnimNum))) staff.modelAnimNum = staff._pfpStaffModelAnimNum;
    if (rec.mode !== 'hand') { staff.animSpeed = 0; return; }
    const n = anim.keyframes.length;
    const targetTime = n > 1 ? (n - 1) / n : 0;
    let now = 0;
    try { now = Number(staff.world && staff.world.animController && staff.world.animController.animController && staff.world.animController.animController.getTimeInFrames()); } catch (_) {}
    staff.animSpeed = Number.isFinite(now) && Math.abs(now) > 1e-6 ? targetTime / now : 0;
  }

  function latestStaffCommand(curves, frame) {
    let latest=null;
    for(const curve of curves||[]){
      if(!curve)continue;
      for(const e of curve.events||[]){
        if(e.time>frame)break;
        let cmd=-1;
        if(e.opcode===0x100)cmd=e.software;
        else if(e.opcode===0x05)cmd=e.paramU&0xFF;
        if(cmd!==0x18&&cmd!==0x19)continue;
        if(!latest||e.time>latest.time||(e.time===latest.time&&e.index>latest.index))latest={cmd,time:e.time,index:e.index};
      }
    }
    return latest;
  }

  function firstSequenceCallbackFrame(curve, eventId) {
    if (!curve) return null;
    for (const e of curve.events || []) {
      if (e.opcode === 0x101 && e.conditionOp === 2 && e.conditionSubId === 0 && (e.conditionParamU & 0xFFFF) === (eventId & 0xFFFF))
        return Math.max(0, Number(e.time) || 0);
    }
    return null;
  }

  function setAttachedBasisScale(m, scale) {
    const target = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
    for (const base of [0,4,8]) {
      const len = Math.hypot(Number(m[base])||0, Number(m[base+1])||0, Number(m[base+2])||0);
      if (len > 1e-7) {
        const f = target / len;
        m[base] *= f; m[base+1] *= f; m[base+2] *= f;
      }
    }
    return m;
  }

  function hideAttachedBasis(m) {
    for (const i of [0,1,2,4,5,6,8,9,10]) m[i]=0;
    return m;
  }

  function isPlayerCastDef(defNo) {
    const d = Number(defNo) & 0xFFFF;
    return d === PLAYER_SABRE || d === PLAYER_KRYSTAL;
  }

  function entryUsesKrystal(entry, kiosk) {
    if (kiosk || !entry) return false;
    const n = String(entry.sourceName || '').toLowerCase();
    return Number(entry.sourceDefId) === 3 || /^krystal$/.test(n) || /(^|_)krystal($|_)/.test(n);
  }

  function sequencePlayerRaw(defNo, kiosk, entry) {
    const d = Number(defNo) & 0xFFFF;
    if (!isPlayerCastDef(d)) return d;
    return entryUsesKrystal(entry, kiosk) ? PLAYER_KRYSTAL : PLAYER_SABRE;
  }

  function findActivePlayer(world, fromPos, claimed, preferKrystal) {
    const first = preferKrystal ? PLAYER_KRYSTAL : PLAYER_SABRE;
    const second = preferKrystal ? PLAYER_SABRE : PLAYER_KRYSTAL;
    return findNearestResidentRaw(world, first, fromPos, claimed) ||
           findNearestResidentRaw(world, second, fromPos, claimed);
  }

  function forceSequenceVisible(inst) {
    if (!inst || typeof inst.isInLayer !== 'function' || inst._pfpSequenceForceVisible) return;
    const hadOwn = Object.prototype.hasOwnProperty.call(inst, 'isInLayer');
    const original = inst.isInLayer;
    inst._pfpSequenceLayerRestore = { hadOwn, original };
    inst.isInLayer = function(layer) {
      if (this._pfpSequenceTimelineHidden) return false;
      if (this._pfpSequenceForceVisible) return true;
      return original.call(this, layer);
    };
    inst._pfpSequenceForceVisible = true;
  }

  function releaseSequenceVisible(inst) {
    if (!inst) return;
    inst._pfpSequenceForceVisible = false;
    const r = inst._pfpSequenceLayerRestore;
    if (!r) return;
    try {
      if (r.hadOwn) inst.isInLayer = r.original;
      else delete inst.isInLayer;
    } catch (_) {}
    delete inst._pfpSequenceLayerRestore;
    delete inst._pfpSequenceForceVisible;
    delete inst._pfpSequenceTimelineHidden;
  }

  function firstSequenceVisualFrame(curve) {
    if (!curve) return 0;
    let first = Infinity;
    const visualChannels = [
      CHANNEL.OPACITY, CHANNEL.ROT_Z, CHANNEL.ROT_X, CHANNEL.ROT_Y,
      CHANNEL.POS_Z, CHANNEL.POS_Y, CHANNEL.POS_X,
    ];
    for (const ch of visualChannels) {
      const keys = curve.channels && curve.channels.get(ch);
      if (keys && keys.length && Number.isFinite(Number(keys[0].frame)))
        first = Math.min(first, Math.max(0, Number(keys[0].frame)));
    }
    for (const e of curve.events || []) {
      if (e.opcode === 0x02 || e.opcode === 0x04) {
        const t = Math.max(0, Number(e.time) || 0);
        first = Math.min(first, t);
      }
    }
    return Number.isFinite(first) ? first : 0;
  }

  function snapshot(inst) {
    if (!inst || !inst.position) return null;
    return {
      position: [Number(inst.position[0]) || 0, Number(inst.position[1]) || 0, Number(inst.position[2]) || 0],
      yaw: Number(inst.yaw) || 0, pitch: Number(inst.pitch) || 0, roll: Number(inst.roll) || 0,
      scale: Number(inst.scale) || 1, anim: inst.anim, modelAnimNum: inst.modelAnimNum,
      animSpeed: inst.animSpeed, parent: inst.parent || null,
    };
  }

  function restore(inst, s) {
    if (!inst || !s || !inst.position) return;
    delete inst._pfpSequenceAnimState;
    inst.position[0] = s.position[0]; inst.position[1] = s.position[1]; inst.position[2] = s.position[2];
    inst.yaw = s.yaw; inst.pitch = s.pitch; inst.roll = s.roll; inst.scale = s.scale;
    inst.anim = s.anim; inst.modelAnimNum = s.modelAnimNum; inst.animSpeed = s.animSpeed; inst.parent = s.parent;
    inst.srtDirty = true;
  }

  function setRetailCameraWorldMatrix(out, yawUnits, pitchUnits, rollUnits, x, y, z) {
    const a0 = signed16(yawUnits) * Math.PI / 32768;
    const a1 = signed16(pitchUnits) * Math.PI / 32768;
    const a2 = signed16(rollUnits) * Math.PI / 32768;
    const s0 = Math.sin(a0), c0 = Math.cos(a0), s1 = Math.sin(a1), c1 = Math.cos(a1), s2 = Math.sin(a2), c2 = Math.cos(a2);
    out[0] = s2 * (s1 * s0) + c2 * c0; out[1] = s2 * c1; out[2] = s2 * (s1 * c0) - c2 * s0; out[3] = 0;
    out[4] = c2 * (s1 * s0) - s2 * c0; out[5] = c2 * c1; out[6] = c2 * (s1 * c0) + s2 * s0; out[7] = 0;
    out[8] = c1 * s0; out[9] = -s1; out[10] = c1 * c0; out[11] = 0;
    out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  }

  class MapSequenceRuntime {
    constructor(renderer) {
      this.renderer = renderer; this.world = renderer.world; this.fetcher = this.world.context.dataFetcher;
      this.pathBase = this.world.gameInfo.pathBase;
      this.sceneDirs = Array.from(new Set((this.world.subdirs || []).filter(x => typeof x === 'string' && x)));
      this.dirs = this.sceneDirs.slice();
      this.primaryDir = this.sceneDirs[0] || '';
      this.sceneMapNum = (this.world.mapNum !== null && this.world.mapNum !== undefined && Number.isInteger(Number(this.world.mapNum))) ? Number(this.world.mapNum) : null;
      this.kioskOwnershipWatchUntil = 0;
      this.kioskOwnershipCount = -1;
      this.kioskRefreshTimer = null;
      this.midLate2001Applicable = true;
      this.entries = []; this.filtered = []; this.dirTables = new Map();
      this.late2001Tables = null; this.midLate2001Tables = null; this.useLate2001 = false; this.useMidLate2001 = false;
      this.current = null; this.actors = []; this.cameraActor = null; this.frame = 0; this.endFrame = 1;
      this.playing = false; this.loop = true; this.sequenceCamera = true; this.lastClock = performance.now();
      this.loading = false; this.viewerInput = null; this.dead = false; this.gameTextBound = false; this.letterboxActive = false;
      this.savedCamera = null; this.lastSoftwareStreamKey = ''; this.activeVoiceStreamId = null;
      this.sourceTemp = null; this.sourceTempEntry = null; this.autoFocusPending = false; this.sequenceTextBound = false; this.softwareSubtitleActive = false; this.lastSoftwareSubtitleKey = '';
      this.playerStaffs = new Map(); this.sequenceProps = [];
      this.exportTab=null;this.exportPanel=null;this.exportSourcePanel=null;this.exportSourceParent=null;this.exportSourceHost=null;this.exportSourceDisplay='';
      this.bitTable=null;this.objectEventTable=null;this.legacyObjectEventTable=null;this.gameBitCount=0;
      this.sideGameBits=new Map();this.sideTouchedBits=new Set();this.sideControllers=[];this.auxSequences=[];
      this.sideEventCursor=-1;this.sideGeneration=0;this.sideControllerSerial=1;
      this.presentationEvents=[];this.presentationEventCursor=-1;this.presentationGeneration=0;
      this.sequenceSfxAudio=new Set();this.sequenceSfxByOwner=new Map();this.sequenceMusicAudio=null;this.sequenceMusicObjectUrl='';this.audioIndexPromise=null;this.preparedMusic=new Map();this.preparedMusicObjectUrls=new Set();
      this.presentationEffectSnapshot=null;this.presentationEnvfxKey='';this.presentationWeatherKey='';this.presentationFramebufferKey='';this.presentationModelDefaults=new Map();this.presentationModelKeys=new Map();this.presentationCameraShake=null;this.presentationTimer={running:false,countUp:false,value:0,type:0};this.presentationParticleNotice=false;
      this.decisionPoints=[];this.decisionConsumed=new Set();this.pendingDecision=null;this.decisionExtraButtons=[];this.queuedDecisionEvent=null;
      this.presentationObjectGroups=new Map();this.presentationGroupObjectRestore=new Map();
      try{const v=localStorage.getItem('pfp-sfa-map-sequences-collapsed');this.panelCollapsed=v===null?true:v==='1';}catch(_){this.panelCollapsed=true;}
      this.makeUI(); this.init().catch(e => this.fail(e));
    }

    makeUI() {
      const p = css(document.createElement('div'), {
        position: 'fixed', left: '8px', bottom: '8px', zIndex: '10025', width: '410px', maxWidth: 'calc(100vw - 16px)',
        maxHeight: '60vh', overflow: 'hidden', padding: '7px', background: 'rgba(8,10,14,.94)',
        border: '1px solid rgba(110,180,240,.60)', borderRadius: '6px', boxShadow: '0 8px 28px rgba(0,0,0,.55)',
        font: '12px sans-serif', color: '#eee'
      });
      p.id = 'pfp-sfa-map-sequences-panel';
      const header=css(document.createElement('div'),{display:'flex',alignItems:'center',gap:'7px',minHeight:'22px'});
      const title=css(document.createElement('div'),{flex:'1',minWidth:'0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'});
      title.innerHTML = '<b style="font-size:14px;color:#70b9ef">Map Sequences</b> <span style="color:#888">(Final SFA + Kiosk)</span>';
      const compact=css(document.createElement('span'),{font:'11px monospace',color:'#aaa',marginLeft:'4px'});title.appendChild(compact);
      const collapse=document.createElement('button');collapse.type='button';collapse.title='Show/hide sequence controls';
      css(collapse,{width:'25px',height:'22px',padding:'0',background:'#242a31',color:'#eee',border:'1px solid #666',cursor:'pointer',font:'14px sans-serif',lineHeight:'18px'});
      header.append(title,collapse);p.appendChild(header);
      const body=css(document.createElement('div'),{marginTop:'3px'});p.appendChild(body);
      const desc = css(document.createElement('div'), { color:'#aaa', margin:'2px 0 5px', lineHeight:'1.25' });
      desc.textContent = 'Plays the map\'s cinematic OBJSEQ/ANIMCURV sequences inside the normal loaded map.'; body.appendChild(desc);
      const search = document.createElement('input'); search.type='search'; search.placeholder='Filter sequence ID or source object';
      css(search,{width:'100%',boxSizing:'border-box',background:'#20242a',color:'#eee',border:'1px solid #666',padding:'4px',marginBottom:'4px'}); body.appendChild(search);
      const list = document.createElement('select'); list.size=7; css(list,{width:'100%',boxSizing:'border-box',font:'12px monospace',background:'#171a1e',color:'#eee',border:'1px solid #555'}); body.appendChild(list);
      const result = css(document.createElement('div'),{color:'#aaa',margin:'3px 0'});body.appendChild(result);
      const row=css(document.createElement('div'),{display:'flex',gap:'5px',alignItems:'center',flexWrap:'wrap',margin:'4px 0'});body.appendChild(row);
      const mk=(txt)=>{const b=document.createElement('button');b.textContent=txt;css(b,{background:'#242a31',color:'#eee',border:'1px solid #666',padding:'3px 7px',cursor:'pointer'});row.appendChild(b);return b;};
      const play=mk('Play'),restart=mk('Restart'),focus=mk('Focus'),stop=mk('Stop');
      const camLab=document.createElement('label'),cam=document.createElement('input');cam.type='checkbox';cam.checked=true;camLab.append(cam,document.createTextNode(' Sequence Camera'));row.appendChild(camLab);
      const loopLab=document.createElement('label'),loop=document.createElement('input');loop.type='checkbox';loop.checked=true;loopLab.append(loop,document.createTextNode(' Loop'));row.appendChild(loopLab);
      const lateLab=document.createElement('label'),late2001=document.createElement('input');late2001.type='checkbox';late2001.checked=false;late2001.title='Use the Late 2001 sequence data for the selected sequence ID.';lateLab.append(late2001,document.createTextNode(' Late 2001'));row.appendChild(lateLab);
      const midLateLab=document.createElement('label'),midLate2001=document.createElement('input');midLate2001.type='checkbox';midLate2001.checked=false;midLate2001.title='Use the converted Mid-Late 2001 sequence data for the selected sequence ID.';midLateLab.append(midLate2001,document.createTextNode(' Mid-Late 2001'));row.appendChild(midLateLab);
      const time=css(document.createElement('span'),{fontFamily:'monospace',minWidth:'88px'});row.appendChild(time);
      const seek=document.createElement('input');seek.type='range';seek.min='0';seek.max='1';seek.step='1';seek.value='0';css(seek,{width:'100%'});body.appendChild(seek);
      const decisionRow=css(document.createElement('div'),{display:'none',alignItems:'center',gap:'6px',margin:'5px 0 1px',padding:'5px',background:'rgba(85,120,160,.18)',border:'1px solid rgba(110,180,240,.45)',borderRadius:'4px'});
      const decisionText=css(document.createElement('span'),{flex:'1',color:'#cfe9ff'});decisionText.textContent='Sequence choice';
      const decisionA=document.createElement('button');decisionA.type='button';decisionA.textContent='A';decisionA.title='Take the sequence branch registered for the A button';
      const decisionB=document.createElement('button');decisionB.type='button';decisionB.textContent='B';decisionB.title='Take the sequence branch registered for the B button';
      const decisionExtras=css(document.createElement('span'),{display:'contents'});
      for(const b of [decisionA,decisionB])css(b,{minWidth:'38px',background:'#242a31',color:'#eee',border:'1px solid #777',padding:'3px 8px',cursor:'pointer'});
      decisionRow.append(decisionText,decisionA,decisionB,decisionExtras);body.appendChild(decisionRow);
      const status=css(document.createElement('pre'),{display:'none',whiteSpace:'pre-wrap',color:'#aaa',font:'11px monospace',margin:'0',maxHeight:'0',overflow:'hidden'});
      document.body.appendChild(p);
      p.style.display='none';
      const toggleWrap=window.__sfaHitsToggle&&window.__sfaHitsToggle.wrap;
      if(toggleWrap){
        const oldToggle=window.__pfpSfaSequencesToggle;
        if(oldToggle&&oldToggle.label&&oldToggle.label.parentNode)oldToggle.label.remove();
        const seqLabel=document.createElement('label');
        seqLabel.style.cursor='pointer';
        seqLabel.style.marginLeft='8px';
        const seqCb=document.createElement('input');
        seqCb.type='checkbox';
        seqCb.checked=false;
        seqCb.style.marginRight='2px';
        seqLabel.append(seqCb,document.createTextNode('Sequences'));
        toggleWrap.appendChild(seqLabel);
        seqCb.addEventListener('change',()=>{
          if(seqCb.checked)p.style.display='block';
          else{this.stop();p.style.display='none';}
        });
        this.sequenceToggleLabel=seqLabel;
        this.sequenceToggle=seqCb;
        window.__pfpSfaSequencesToggle={label:seqLabel,cb:seqCb};
      }

      const topBar=css(document.createElement('div'),{position:'fixed',left:'0',right:'0',top:'31px',height:'11vh',background:'#000',zIndex:'10005',pointerEvents:'none',display:'none'});
      const bottomBar=css(document.createElement('div'),{position:'fixed',left:'0',right:'0',bottom:'0',height:'11vh',background:'#000',zIndex:'10005',pointerEvents:'none',display:'none'});
      topBar.className='pfp-sfa-seq-letterbox';bottomBar.className='pfp-sfa-seq-letterbox';document.body.append(topBar,bottomBar);
      const fadeOverlay=css(document.createElement('div'),{position:'fixed',left:'0',right:'0',top:'0',bottom:'0',background:'#000',opacity:'0',zIndex:'10003',pointerEvents:'none',display:'none'});
      fadeOverlay.className='pfp-sfa-seq-screen-fade';document.body.appendChild(fadeOverlay);
      this.ui={panel:p,header,body,compact,collapse,search,list,result,play,restart,focus,stop,cam,loop,late2001,midLate2001,time,seek,decisionRow,decisionText,decisionA,decisionB,decisionExtras,status,topBar,bottomBar,fadeOverlay};
      collapse.addEventListener('click',()=>this.setPanelCollapsed(!this.panelCollapsed));
      header.addEventListener('dblclick',()=>this.setPanelCollapsed(!this.panelCollapsed));
      search.addEventListener('input',()=>this.refreshList());
      list.addEventListener('change',()=>{const e=this.filtered[Number(list.value)];if(e)this.load(e).catch(x=>this.fail(x));});
      play.addEventListener('click',()=>{if(!this.current){const e=this.filtered[Number(list.value)];if(e)this.load(e).catch(x=>this.fail(x));return;}this.playing=!this.playing;this.lastClock=performance.now();this.syncGameText(true);this.syncUI(true);});
      restart.addEventListener('click',()=>{if(!this.current)return;this.resetSideRuntime();this.resetPresentationRuntime(0,false);this.resetDecisionRuntime(0);this.frame=0;this.playing=true;this.lastClock=performance.now();this.resetSequenceVoice();this.applyNow();this.syncGameText(true);this.syncUI(true);});
      focus.addEventListener('click',()=>{if(this.current)this.focusSource();}); stop.addEventListener('click',()=>this.stop());
      decisionA.addEventListener('click',()=>this.chooseDecision(0x12));decisionB.addEventListener('click',()=>this.chooseDecision(0x13));
      cam.addEventListener('change',()=>{this.sequenceCamera=cam.checked;if(cam.checked)this.saveCamera();else this.restoreCamera();}); loop.addEventListener('change',()=>{this.loop=loop.checked;});
      late2001.addEventListener('change',()=>{
        if(late2001.checked&&!this.late2001Tables){late2001.checked=false;this.useLate2001=false;this.setStatus('Late 2001 sequence data is unavailable.');return;}
        if(late2001.checked){midLate2001.checked=false;this.useMidLate2001=false;}
        this.useLate2001=late2001.checked;
        if(this.current){
          const e=this.entries.find(x=>x.sequenceId===this.current.sequenceId);
          if(e)this.load(e).catch(x=>this.fail(x));
        }else this.syncUI(true);
      });
      midLate2001.addEventListener('change',()=>{
        if(midLate2001.checked&&!this.midLate2001Tables){midLate2001.checked=false;this.useMidLate2001=false;this.setStatus('Mid-Late 2001 sequence data is unavailable.');return;}
        if(midLate2001.checked){late2001.checked=false;this.useLate2001=false;}
        this.useMidLate2001=midLate2001.checked;
        if(this.current){
          const e=this.entries.find(x=>x.sequenceId===this.current.sequenceId);
          if(e)this.load(e).catch(x=>this.fail(x));
        }else this.syncUI(true);
      });
      seek.addEventListener('input',()=>{if(!this.current)return;this.resetSideRuntime();this.frame=Number(seek.value)||0;this.resetPresentationRuntime(this.frame,true);this.resetDecisionRuntime(this.frame);this.playing=false;this.applyNow();this.syncGameText(true);this.syncUI(true);});
      this.setPanelCollapsed(this.panelCollapsed,false);
    }

    setPanelCollapsed(on,persist=true){
      this.panelCollapsed=!!on;if(!this.ui)return;
      this.ui.body.style.display=this.panelCollapsed?'none':'block';
      this.ui.collapse.textContent=this.panelCollapsed?'▸':'▾';
      this.ui.panel.style.width=this.panelCollapsed?'255px':'410px';
      this.ui.panel.style.maxHeight=this.panelCollapsed?'38px':'60vh';
      this.ui.panel.style.overflow=this.panelCollapsed?'hidden':'auto';
      if(persist){try{localStorage.setItem('pfp-sfa-map-sequences-collapsed',this.panelCollapsed?'1':'0');}catch(_){}}
      this.syncUI(true);
    }

    setStatus(s){if(this.ui)this.ui.status.textContent=s||'';}
    fail(e){const msg=e&&e.message?e.message:String(e);console.error('[Map Sequences]',e);this.setStatus(`ERROR: ${msg}`);}

    mapTitle(){return String(document.title||'').replace(/\s+-\s+Star Fox Adventures.*$/i,'').trim();}

    async init(){
      if(this.pathBase!=='StarFoxAdventures'&&this.pathBase!=='StarFoxAdventuresDemo'){this.ui.panel.style.display='none';return;}
      const kiosk=this.pathBase==='StarFoxAdventuresDemo';
      this.setStatus(`Reading ${kiosk?'Kiosk':'Final SFA'} sequence data for ${this.mapTitle()||this.primaryDir}...`);
      await this.loadTables();
      if(kiosk)await this.waitForKioskObjectPopulation();
      for(const inst of (this.world&&this.world.objectInstances)||[])fixCollectibleTintMaterials(inst);
      if(kiosk)await this.buildEntriesKiosk();else await this.buildEntries();
      if(kiosk){
        this.kioskOwnershipCount=(this.world&&Array.isArray(this.world.objectInstances))?this.world.objectInstances.length:0;
        this.kioskOwnershipWatchUntil=performance.now()+5000;
      }
      this.refreshList();
      this.setStatus(`Map: ${this.mapTitle()||'(unknown)'}\n${this.entries.length} map sequence${this.entries.length===1?'':'s'} resolved from the map's actual ${kiosk?'Kiosk MAPS.bin/.tab object population':'OBJECTS/ROMLIST ownership'}.\nNormal FoxPlanet map rendering remains active.`);
    }

    async waitForKioskObjectPopulation(){
      const start=performance.now();let last=-1,stableSince=performance.now();
      while(!this.dead&&performance.now()-start<2500){
        const n=(this.world&&Array.isArray(this.world.objectInstances))?this.world.objectInstances.length:0;
        if(n!==last){last=n;stableSince=performance.now();}
        if(n>0&&performance.now()-stableSince>=500)break;
        await new Promise(resolve=>setTimeout(resolve,75));
      }
    }

    async loadTables(){
      for(const dir of this.dirs){
        try{
          const[st,sb,o2c,ct,cb]=await Promise.all([
            fetchFirst(this.fetcher,[`${this.pathBase}/${dir}/OBJSEQ.tab`,`${this.pathBase}/${dir}/OBJSEQ.TAB`]),
            fetchFirst(this.fetcher,[`${this.pathBase}/${dir}/OBJSEQ.bin`,`${this.pathBase}/${dir}/OBJSEQ.BIN`]),
            fetchFirst(this.fetcher,[`${this.pathBase}/${dir}/OBJSEQ2C.tab`,`${this.pathBase}/${dir}/OBJSEQ2C.TAB`,`${this.pathBase}/${dir}/OBJSEQ2CURVE.tab`]),
            fetchFirst(this.fetcher,[`${this.pathBase}/${dir}/ANIMCURV.tab`,`${this.pathBase}/${dir}/ANIMCURV.TAB`,`${this.pathBase}/${dir}/ANIMCURVE.tab`]),
            fetchFirst(this.fetcher,[`${this.pathBase}/${dir}/ANIMCURV.bin`,`${this.pathBase}/${dir}/ANIMCURV.BIN`,`${this.pathBase}/${dir}/ANIMCURVE.bin`])
          ]);
          this.dirTables.set(dir,{seqTab:st.createDataView(),seqBin:sb.createDataView(),o2c:o2c.createDataView(),curveTab:ct.createDataView(),curveBin:cb.createDataView()});
        }catch(_){}
      }
      if(!this.dirTables.size)throw new Error('No complete local OBJSEQ / OBJSEQ2C / ANIMCURV sequence bank was found for this loaded map.');
      try{
        const[st,sb,o2c,ct,cb]=await Promise.all([
          fetchBundledView(['sequence-data/late2001/OBJSEQ.tab']),
          fetchBundledView(['sequence-data/late2001/OBJSEQ.bin']),
          fetchBundledView(['sequence-data/late2001/OBJSEQ2C.tab']),
          fetchBundledView(['sequence-data/late2001/ANIMCURV.tab']),
          fetchBundledView(['sequence-data/late2001/ANIMCURV.bin'])
        ]);
        this.late2001Tables={seqTab:st,seqBin:sb,o2c,curveTab:ct,curveBin:cb};
      }catch(_){this.late2001Tables=null;}
      if(this.ui&&this.ui.late2001){
        this.ui.late2001.disabled=!this.late2001Tables;
        if(!this.late2001Tables)this.ui.late2001.title='Late 2001 sequence data is unavailable.';
      }
      try{
        const[st,sb,o2c,ct,cb]=await Promise.all([
          fetchBundledView(['sequence-data/midlate2001-swaphol/OBJSEQ.tab']),
          fetchBundledView(['sequence-data/midlate2001-swaphol/OBJSEQ.bin']),
          fetchBundledView(['sequence-data/midlate2001-swaphol/OBJSEQ2C.tab']),
          fetchBundledView(['sequence-data/midlate2001-swaphol/ANIMCURV.tab']),
          fetchBundledView(['sequence-data/midlate2001-swaphol/ANIMCURV.bin'])
        ]);
        this.midLate2001Tables={seqTab:st,seqBin:sb,o2c,curveTab:ct,curveBin:cb};
      }catch(_){this.midLate2001Tables=null;}
      if(this.ui&&this.ui.midLate2001){
        this.ui.midLate2001.disabled=!this.midLate2001Tables;
        if(!this.midLate2001Tables)this.ui.midLate2001.title='Mid-Late 2001 sequence data is unavailable.';
        else this.ui.midLate2001.title='Use the converted Mid-Late 2001 sequence data for the selected sequence ID.';
      }
      try{
        const side=this.pathBase==='StarFoxAdventuresDemo'?'side-kiosk':'side-final';
        this.bitTable=await fetchBundledView([`sequence-data/${side}/BITTABLE.bin`]);
        this.objectEventTable=await fetchBundledView([`sequence-data/${side}/OBJEVENT.bin`]);
        this.gameBitCount=Math.floor(this.bitTable.byteLength/4);
        if(this.pathBase==='StarFoxAdventuresDemo'){
          try{this.legacyObjectEventTable=await fetchBundledView([`sequence-data/${side}/OBJEVENTS.bin`]);}catch(_){this.legacyObjectEventTable=null;}
        }
      }catch(e){
        this.bitTable=null;this.objectEventTable=null;this.legacyObjectEventTable=null;this.gameBitCount=0;
        console.warn('[Map Sequences] side-event root tables unavailable',e);
      }
    }

    async loadAdditionalTables(extraDirs){
      const dirs=[];
      for(const raw of (extraDirs||[])){
        const dir=String(raw||'').trim();
        if(dir&&!dirs.includes(dir))dirs.push(dir);
      }
      for(const dir of dirs){
        if(this.dirTables.has(dir)){if(!this.dirs.includes(dir))this.dirs.push(dir);continue;}
        try{
          const[st,sb,o2c,ct,cb]=await Promise.all([
            fetchFirst(this.fetcher,[`${this.pathBase}/${dir}/OBJSEQ.tab`,`${this.pathBase}/${dir}/OBJSEQ.TAB`]),
            fetchFirst(this.fetcher,[`${this.pathBase}/${dir}/OBJSEQ.bin`,`${this.pathBase}/${dir}/OBJSEQ.BIN`]),
            fetchFirst(this.fetcher,[`${this.pathBase}/${dir}/OBJSEQ2C.tab`,`${this.pathBase}/${dir}/OBJSEQ2C.TAB`,`${this.pathBase}/${dir}/OBJSEQ2CURVE.tab`]),
            fetchFirst(this.fetcher,[`${this.pathBase}/${dir}/ANIMCURV.tab`,`${this.pathBase}/${dir}/ANIMCURV.TAB`,`${this.pathBase}/${dir}/ANIMCURVE.tab`]),
            fetchFirst(this.fetcher,[`${this.pathBase}/${dir}/ANIMCURV.bin`,`${this.pathBase}/${dir}/ANIMCURV.BIN`,`${this.pathBase}/${dir}/ANIMCURVE.bin`])
          ]);
          this.dirTables.set(dir,{seqTab:st.createDataView(),seqBin:sb.createDataView(),o2c:o2c.createDataView(),curveTab:ct.createDataView(),curveBin:cb.createDataView()});
          if(!this.dirs.includes(dir))this.dirs.push(dir);
        }catch(_){}
      }
      this.midLate2001Applicable=true;
      if(this.ui&&this.ui.midLate2001){
        this.ui.midLate2001.disabled=!this.midLate2001Tables;
        if(this.midLate2001Tables)this.ui.midLate2001.title='Use the converted Mid-Late 2001 sequence data for the selected sequence ID.';
      }
    }

    findResourceDir(sequenceId,preferredDirs=null,allowFallback=true){
      const preferred=[];
      for(const d of (preferredDirs||[])){const v=String(d||'').trim();if(v&&!preferred.includes(v))preferred.push(v);}
      const pool=[];
      if(preferred.length){
        for(const d of preferred)if(this.dirTables.has(d)&&!pool.includes(d))pool.push(d);
        if(allowFallback)for(const d of this.dirs)if(!pool.includes(d))pool.push(d);
      }else for(const d of this.dirs)if(!pool.includes(d))pool.push(d);
      let best=null;
      for(let dirIndex=0;dirIndex<pool.length;dirIndex++){
        const dir=pool[dirIndex],t=this.dirTables.get(dir);if(!t)continue;
        const cast=parseCast(t.seqTab,t.seqBin,sequenceId);if(!cast.length)continue;
        const p=sequenceId*2;if(p+2>t.o2c.byteLength)continue;const base=t.o2c.getUint16(p,false);if(base===0xFFFF)continue;
        let curveEnd=base;
        if(p+4<=t.o2c.byteLength){const n=t.o2c.getUint16(p+2,false);if(n!==0xFFFF&&n>=base)curveEnd=n;}
        const parsed=[];let usable=0;for(let i=0;i<cast.length;i++){const c=parseCurve(base+i,t.curveTab,t.curveBin);parsed.push(c);if(c)usable++;}
        const allParsed=[];for(let curveId=base;curveId<curveEnd;curveId++)allParsed.push(parseCurve(curveId,t.curveTab,t.curveBin));
        if(!usable)continue;
        const complete=usable===cast.length;
        const extraUsable=allParsed.filter(Boolean).length;
        const preferredRank=preferred.indexOf(dir);
        const preferredBonus=preferredRank>=0?(100000000-preferredRank*1000000):0;
        const score=preferredBonus+(complete?1000000:0)+(usable*1000)+Math.min(extraUsable,999)+Math.min(cast.length,999)-(dirIndex/1000);
        const r={dir,baseCurve:base,curveEnd,tables:t,cast,usable,parsed,allParsed,complete,score};
        if(!best||r.score>best.score)best=r;
      }
      return best;
    }

    getLate2001PlaybackEntry(entry){
      const t=this.late2001Tables,sequenceId=Number(entry&&entry.sequenceId);
      if(!t)throw new Error('Late 2001 sequence data is unavailable.');
      if(!Number.isInteger(sequenceId)||sequenceId<0||sequenceId>LATE_2001_MAX_SEQUENCE)throw new Error(`SEQ ${hex(sequenceId,4)} is not available in the Late 2001 sequence set.`);
      const p=sequenceId*2;
      if(p+2>t.o2c.byteLength)throw new Error(`SEQ ${hex(sequenceId,4)} is not available in the Late 2001 sequence set.`);
      const base=t.o2c.getUint16(p,false);
      if(base===0xFFFF)throw new Error(`SEQ ${hex(sequenceId,4)} is not available in the Late 2001 sequence set.`);
      let curveEnd=base;
      if(p+4<=t.o2c.byteLength){
        const n=t.o2c.getUint16(p+2,false);
        if(n!==0xFFFF&&n>=base)curveEnd=n;
      }
      const lateCast=parseCast(t.seqTab,t.seqBin,sequenceId);
      let cast=lateCast;
      let usedCurrentCast=false;
      if(!cast.length){
        const curveCount=Math.max(0,curveEnd-base);
        cast=((entry&&entry.cast)||[]).slice(0,curveCount||undefined);
        usedCurrentCast=true;
      }
      if(!cast.length)throw new Error(`SEQ ${hex(sequenceId,4)} has no playable cast in the Late 2001 sequence set.`);
      const parsed=cast.map((c,i)=>parseCurve(base+i,t.curveTab,t.curveBin));
      if(!parsed.some(Boolean))throw new Error(`SEQ ${hex(sequenceId,4)} has no playable Late 2001 animation curves.`);
      const allParsed=[];for(let curveId=base;curveId<curveEnd;curveId++)allParsed.push(parseCurve(curveId,t.curveTab,t.curveBin));
      return {...entry,tables:t,baseCurve:base,curveEnd,cast,parsed,allParsed,sequenceSet:'Late 2001',usedCurrentCast};
    }

    getMidLate2001PlaybackEntry(entry){
      const t=this.midLate2001Tables,sequenceId=Number(entry&&entry.sequenceId);
      if(!t)throw new Error('Mid-Late 2001 sequence data is unavailable.');
      if(!Number.isInteger(sequenceId)||sequenceId<0||sequenceId*2+4>t.seqTab.byteLength)throw new Error(`SEQ ${hex(sequenceId,4)} is not available in the Mid-Late 2001 sequence set.`);
      const p=sequenceId*2;
      if(p+2>t.o2c.byteLength)throw new Error(`SEQ ${hex(sequenceId,4)} is not available in the Mid-Late 2001 sequence set.`);
      const base=t.o2c.getUint16(p,false);
      if(base===0xFFFF)throw new Error(`SEQ ${hex(sequenceId,4)} is not available in the Mid-Late 2001 sequence set.`);
      let curveEnd=base;
      if(p+4<=t.o2c.byteLength){
        const n=t.o2c.getUint16(p+2,false);
        if(n!==0xFFFF&&n>=base)curveEnd=n;
      }
      const oldCast=parseCast(t.seqTab,t.seqBin,sequenceId);
      let cast=oldCast;
      let usedCurrentCast=false;
      if(!cast.length){
        const curveCount=Math.max(0,curveEnd-base);
        cast=((entry&&entry.cast)||[]).slice(0,curveCount||undefined);
        usedCurrentCast=true;
      }
      if(!cast.length)throw new Error(`SEQ ${hex(sequenceId,4)} has no playable cast in the Mid-Late 2001 sequence set.`);
      const parsed=cast.map((c,i)=>parseCurve(base+i,t.curveTab,t.curveBin));
      if(!parsed.some(Boolean))throw new Error(`SEQ ${hex(sequenceId,4)} has no playable Mid-Late 2001 animation curves.`);
      const allParsed=[];for(let curveId=base;curveId<curveEnd;curveId++)allParsed.push(parseCurve(curveId,t.curveTab,t.curveBin));
      return {...entry,tables:t,baseCurve:base,curveEnd,cast,parsed,allParsed,sequenceSet:'Mid-Late 2001',usedCurrentCast};
    }

    findSource(owner){
      let s=null;if(owner.sourceUid)s=findByUid(this.world,owner.sourceUid);
      if(!s&&Number.isFinite(Number(owner.sourceObjType)))s=findNearestResidentRaw(this.world,Number(owner.sourceObjType),owner.sourcePos||[0,0,0],null);
      if(!s&&Number.isFinite(Number(owner.sourceDefId)))s=findNearestResidentDef(this.world,Number(owner.sourceDefId),owner.sourcePos||[0,0,0],null);
      return s;
    }

    async buildEntriesKiosk(){
      const bySeq=new Map();
      const instances=(this.world&&Array.isArray(this.world.objectInstances))?this.world.objectInstances:[];
      for(const inst of instances){
        try{
          if(!inst||!inst.objType||!inst.objType.data||!inst.commonObjectParams)continue;
          const def=inst.objType, data=def.data, params=inst.objParams;
          if(data.byteLength<0x72)continue;
          const seqRel=data.getUint32(0x1C,false), nSeq=data.getUint16(0x70,false);
          if(!seqRel||seqRel===0xFFFFFFFF||!nSeq||nSeq>=256||seqRel+nSeq*2>data.byteLength)continue;
          const seqs=[];for(let i=0;i<nSeq;i++){const v=data.getInt16(seqRel+i*2,false);seqs.push(v>=0?v:null);}
          const name=String(def.name||''), lower=name.toLowerCase();
          const objectClass=Number(def.objClass), defId=Number(def.typeNum);
          let selectedIndex=-1, selectorKind=null;
          if(/seqpoint/.test(lower)){
            selectorKind='s16@1c';
            if(params&&params.byteLength>=0x1E){const v=params.getInt16(0x1C,false);if(v>=0&&v<seqs.length)selectedIndex=v;}
          }else if(defId===896||/^wm[_ ]?warppoint$/i.test(name)){
            selectorKind='s16@1c';
            if(params&&params.byteLength>=0x1E){const v=params.getInt16(0x1C,false);if(v>=0&&v<seqs.length)selectedIndex=v;}
          }else if(/warppoint|restartpoint/.test(lower)){
            selectorKind='s8@1b';
            if(params&&params.byteLength>0x1B){const v=params.getInt8(0x1B);if(v>=0&&v<seqs.length)selectedIndex=v;}
          }else if(/clubsharpclaw/.test(lower)){
            selectorKind='s8@2e';
            if(params&&params.byteLength>0x2E){const v=params.getInt8(0x2E);if(v>=0&&v<seqs.length)selectedIndex=v;}
          }else if(objectClass===280||objectClass===281||((/seqobject|sequences/.test(lower))&&objectClass!==282)){
            selectorKind='s8@1e';
            if(params&&params.byteLength>0x1E){const v=params.getInt8(0x1E);if(v>=0&&v<seqs.length)selectedIndex=v;}
          }
          let selectedIndices=null;
          if(objectClass===282||/immultiseq/.test(lower)){
            selectorKind='s8x4@2c';selectedIndices=[];
            if(params)for(let o=0x2C;o<0x30&&o<params.byteLength;o++){const v=params.getInt8(o);if(v>=0&&v<seqs.length&&!selectedIndices.includes(v))selectedIndices.push(v);}
          }
          const uid=Number(inst.commonObjectParams.id)||0;
          const rawType=Number(inst.commonObjectParams.objType);
          const sourcePose=renderedWorldPose(inst),pos=sourcePose.position;
          const indices=selectedIndices!==null?selectedIndices:(selectorKind?(selectedIndex>=0?[selectedIndex]:[]):seqs.map((_,i)=>i));
          for(const i of indices){
            const sequenceId=seqs[i];if(!Number.isInteger(sequenceId))continue;
            let list=bySeq.get(sequenceId);if(!list){list=[];bySeq.set(sequenceId,list);}
            list.push({sequenceId,source:inst,sourceObjType:rawType,sourceDefId:defId,sourceName:name,sourceUid:uid,sourcePos:pos,sourceObjectClass:objectClass,localIndex:i,selected:!!selectorKind});
          }
        }catch(_){}
      }
      const out=[];
      const kioskSequenceDirs=(this.sceneMapNum===8||/ThornTail Hollow (Well|Underground)/i.test(this.mapTitle()))?['swapholbot']:[];
      for(const [sequenceId,owners] of bySeq){
        const resource=this.findResourceDir(sequenceId,kioskSequenceDirs,kioskSequenceDirs.length===0);if(!resource)continue;
        const cast=resource.cast;if(!cast||!cast.length)continue;
        const signal=hasCinematicSignal(cast,resource.parsed);
        const selected=owners.filter(o=>o.selected);let chosen=null;
        if(selected.length)chosen=selected[0];
        else{
          const groups=new Map();
          for(const o of owners){const k=String(o.sourceObjType);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);}
          const ranked=[...groups.values()].sort((a,b)=>a.length-b.length||String(a[0].sourceName).localeCompare(String(b[0].sourceName))||Number(a[0].sourceUid||0)-Number(b[0].sourceUid||0));
          if(ranked.length)chosen=ranked[0][0];
        }
        if(!chosen)continue;
        const same=owners.filter(o=>o.sourceObjType===chosen.sourceObjType);
        const exactSelected=selected.find(o=>o.sourceObjType===chosen.sourceObjType)||null;
        const source=exactSelected||chosen;
        const sourceName=String(source.sourceName||'');
        const mapSpecificOwner=/seq|shrine|queen|scales|level|landing|camera|boss|control|gate|warp|spirit|door|portal|krystal|drakor/i.test(sourceName);
        out.push({...source,sequenceId,source:source.source,sourcePlacementCount:same.length,ownerCount:owners.length,selected:!!exactSelected,cast,...resource,cinematicSignal:signal,mapSpecificOwner,representative:!exactSelected&&same.length>1});
      }
      const unique=new Map();for(const e of out){const prev=unique.get(e.sequenceId);if(!prev||(!prev.selected&&e.selected)||((prev.sourcePlacementCount||99)>(e.sourcePlacementCount||99)))unique.set(e.sequenceId,e);}
      this.entries=[...unique.values()].sort((a,b)=>a.sequenceId-b.sequenceId);
    }

    async buildEntries(){
      const u=new URL(API_ROOT+'api/sfa-sequences/map-ownership',location.origin);u.searchParams.set('pathBase',this.pathBase);u.searchParams.set('mapTitle',this.mapTitle());u.searchParams.set('resourceDirs',this.sceneDirs.join(','));
      const mapNum=this.sceneMapNum;if(Number.isInteger(mapNum))u.searchParams.set('mapNum',String(mapNum));
      const r=await fetch(u.toString(),{cache:'no-store'});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.message||'Map sequence ownership could not be resolved.');
      const owners=j.entries||[];

      const ownerDirs=[];
      for(const owner of owners)for(const d of (owner.resourceDirs||[]))if(d&&!ownerDirs.includes(d))ownerDirs.push(d);
      await this.loadAdditionalTables(ownerDirs);

      const providerDirsBySequence=new Map(),needsProvider=new Set();
      const externalProviderMap=/^(?:Boss Drakor|Boss Galdon|Ocean Force Point Temple Interior|CloudRunner Fortress Dungeon)$/i;
      const blockExternalProviderMap=/^ThornTail Hollow Well$/i;
      for(const owner of owners){
        const sequenceId=Number(owner.sequenceId),preferred=(owner.resourceDirs||[]).filter(Boolean),sourceName=String(owner.sourceName||''),mapName=String(owner.mapName||'');
        const localResource=this.findResourceDir(sequenceId,preferred,false);
        const specific=!!owner.selected||externalProviderMap.test(mapName)||/seq|shrine|queen|scales|level|landing|camera|boss|control|gate|warp|spirit|door|portal|krystal|drakor|galdon|crf|cloud|cage|prison/i.test(sourceName);
        if(!localResource&&specific&&!blockExternalProviderMap.test(mapName))needsProvider.add(sequenceId);
      }
      if(needsProvider.size){
        try{
          const cu=new URL(API_ROOT+'api/sfa-sequences/catalog',location.origin);cu.searchParams.set('pathBase',this.pathBase);
          const cr=await fetch(cu.toString(),{cache:'no-store'}),cj=await cr.json();
          if(cr.ok&&cj&&cj.ok){
            const providerDirs=[];
            for(const ce of (cj.entries||[])){
              const sid=Number(ce.sequenceId);if(!needsProvider.has(sid)||!ce.folder)continue;
              if(!providerDirsBySequence.has(sid))providerDirsBySequence.set(sid,[]);
              const list=providerDirsBySequence.get(sid),dir=String(ce.folder);if(!list.includes(dir))list.push(dir);
              if(!providerDirs.includes(dir))providerDirs.push(dir);
            }
            await this.loadAdditionalTables(providerDirs);
          }
        }catch(_){}
      }

      const out=[];
      for(const owner of owners){
        const sequenceId=Number(owner.sequenceId),ownerSequenceDirs=(owner.resourceDirs||[]).filter(Boolean),sourceName=String(owner.sourceName||''),mapName=String(owner.mapName||'');
        const localResource=this.findResourceDir(sequenceId,ownerSequenceDirs,false);
        const providerEligible=!blockExternalProviderMap.test(mapName)&&(!!owner.selected||externalProviderMap.test(mapName)||/seq|shrine|queen|scales|level|landing|camera|boss|control|gate|warp|spirit|door|portal|krystal|drakor|galdon|crf|cloud|cage|prison/i.test(sourceName));
        const providerSequenceDirs=(!localResource&&providerEligible)?(providerDirsBySequence.get(sequenceId)||[]):[];
        const resource=localResource||this.findResourceDir(sequenceId,providerSequenceDirs,false);if(!resource)continue;
        const cast=resource.cast;if(!cast||!cast.length)continue;
        const signal=hasCinematicSignal(cast,resource.parsed);
        const uniqueSource=Number(owner.sourcePlacementCount)===1;
        const mapSpecificOwner=/seq|shrine|queen|scales|level|landing|camera|boss|control|gate|warp|spirit|door|portal|krystal|drakor/i.test(sourceName);
        const source=this.findSource(owner);
        out.push({...owner,ownerSequenceDirs,providerSequenceDirs,sequenceId,source,sourceName:sourceName||((source&&source.objType&&source.objType.name)||'Sequence source'),cast,...resource,cinematicSignal:signal,mapSpecificOwner,representative:!owner.selected&&!uniqueSource});
      }
      const by=new Map();for(const e of out){const prev=by.get(e.sequenceId);if(!prev||(!prev.selected&&e.selected)||((prev.sourcePlacementCount||99)>(e.sourcePlacementCount||99)))by.set(e.sequenceId,e);}
      this.entries=[...by.values()].sort((a,b)=>a.sequenceId-b.sequenceId);
    }

    refreshList(){
      const q=(this.ui.search.value||'').trim().toLowerCase();this.filtered=this.entries.filter(e=>!q||`seq ${hex(e.sequenceId,4)}`.toLowerCase().includes(q)||String(e.sequenceId).includes(q)||String(e.sourceName).toLowerCase().includes(q)||String(e.dir).toLowerCase().includes(q));
      this.ui.list.textContent='';this.filtered.forEach((e,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`SEQ ${hex(e.sequenceId,4)}  ${e.sourceName}  ${e.sourceUid?`UID ${hex(e.sourceUid,5)}`:'map owner'}  [${e.dir}]`;this.ui.list.appendChild(o);});
      this.ui.result.textContent=`${this.filtered.length} shown | ${this.entries.length} map sequences in this map`;if(!this.current)this.ui.list.selectedIndex=-1;
    }

    async ensureSequenceActorBanks(entry){
      const rc=this.world&&this.world.resColl;if(!rc)return;
      const kioskMode=this.pathBase==='StarFoxAdventuresDemo';
      const dirs=[];const add=(d)=>{d=String(d||'').trim();if(d&&!dirs.includes(d))dirs.push(d);};
      add(entry&&entry.dir);add(this.primaryDir);for(const d of(this.dirs||[]))add(d);add('swaphol');

      const initialJobs=[];
      try{if(rc.modelFetcher&&typeof rc.modelFetcher.loadSubdirs==='function')initialJobs.push(rc.modelFetcher.loadSubdirs(dirs,this.fetcher));}catch(_){}
      try{if(rc.texFetcher&&typeof rc.texFetcher.loadSubdirs==='function')initialJobs.push(rc.texFetcher.loadSubdirs(dirs,this.fetcher));}catch(_){}
      if(initialJobs.length)await Promise.allSettled(initialJobs);

      const needed=[];
      const neededTextures=[];
      try{
        for(const c of (entry&&entry.cast)||[]){
          if(c.defNo===SPECIAL_CAMERA||c.defNo===SPECIAL_SOURCE)continue;
          const kiosk=this.pathBase==='StarFoxAdventuresDemo';
          const effectiveRaw=sequencePlayerRaw(c.defNo,kiosk,entry);
          const ot=this.world.objectMan&&this.world.objectMan.getObjectType?this.world.objectMan.getObjectType(effectiveRaw,false):null;
          if(!ot||!Array.isArray(ot.modelNums))continue;
          const modelList=(effectiveRaw===PLAYER_SABRE&&ot.modelNums.length>1)?[ot.modelNums[1]]:
            (effectiveRaw===PLAYER_KRYSTAL&&ot.modelNums.length>2)?[ot.modelNums[2]]:ot.modelNums;
          for(const id0 of modelList){const id=Number(id0);if(Number.isInteger(id)&&id>=0&&!needed.includes(id))needed.push(id);}
        }
        const hasPlayer=(entry&&entry.cast||[]).some(c=>isPlayerCastDef(c.defNo))||
          !!(entry&&entry.source&&isPlayerCastDef(romDefNo(entry.source)));
        if(hasPlayer){
          const st=this.world.objectMan&&this.world.objectMan.getObjectType?this.world.objectMan.getObjectType(PLAYER_STAFF,false):null;
          if(st&&Array.isArray(st.modelNums))for(const id0 of st.modelNums){const id=Number(id0);if(Number.isInteger(id)&&id>=0&&!needed.includes(id))needed.push(id);}
          if(!kiosk){
            const eraw=rawDefByObjectNames(this.world,['staffEnd'],[0x064E,0x0513]);
            if(eraw>=0){const et=this.world.objectMan.getObjectType(eraw,false);if(et&&Array.isArray(et.modelNums))for(const id0 of et.modelNums){const id=Number(id0);if(Number.isInteger(id)&&id>=0&&!needed.includes(id))needed.push(id);}}
          }
        }
        let hasScales=false;
        for(const c of (entry&&entry.cast)||[]){
          if(c.defNo===SPECIAL_CAMERA||c.defNo===SPECIAL_SOURCE)continue;
          try{const raw=sequencePlayerRaw(c.defNo,this.pathBase==='StarFoxAdventuresDemo',entry);const ot=this.world.objectMan.getObjectType(raw,false);if(isGeneralScalesName(ot&&ot.name)){hasScales=true;break;}}catch(_){}
        }
        if(hasScales){
          const wraw=rawDefByObjectNames(this.world,['BGSweapon'],[BGS_WEAPON]);
          if(wraw>=0){const wt=this.world.objectMan.getObjectType(wraw,false);if(wt&&Array.isArray(wt.modelNums))for(const id0 of wt.modelNums){const id=Number(id0);if(Number.isInteger(id)&&id>=0&&!needed.includes(id))needed.push(id);}}
          else if(!needed.includes(0x007D))needed.push(0x007D);
        }
      }catch(_){}
      const missing=[];
      for(const id of needed){
        let have=false;try{have=!!(rc.modelFetcher&&rc.modelFetcher.getModelsFileWithModel&&rc.modelFetcher.getModelsFileWithModel(id));}catch(_){}
        if(!have)missing.push(id);
      }

      const providerDirs=[];
      const providerLookupIds=needed;
      entry._pfpModelProviders={};
      if(providerLookupIds.length){
        try{
          const u=new URL(API_ROOT+'api/sfa-sequences/model-providers',location.origin);
          u.searchParams.set('pathBase',this.pathBase);
          u.searchParams.set('modelIds',providerLookupIds.join(','));
          u.searchParams.set('preferredDirs',dirs.join(','));
          const r=await fetch(u.toString(),{cache:'no-store'}),j=await r.json();
          if(r.ok&&j&&j.ok){
            entry._pfpModelProviders=j.providers||{};
            for(const plist of Object.values(entry._pfpModelProviders)){
              const d=Array.isArray(plist)&&plist.length?plist[0]:'';
              if(d&&!dirs.includes(d)&&!providerDirs.includes(d))providerDirs.push(d);
            }
            for(const d of (j.providerDirs||[]))if(d&&!dirs.includes(d)&&!providerDirs.includes(d))providerDirs.push(d);
          }
        }catch(e){console.warn('[Map Sequences] model provider lookup failed',e);}
      }
      for(const d of providerDirs)add(d);

      if(providerDirs.length){
        const jobs=[];
        try{if(rc.modelFetcher&&typeof rc.modelFetcher.loadSubdirs==='function')jobs.push(rc.modelFetcher.loadSubdirs(providerDirs,this.fetcher));}catch(_){}
        try{if(rc.texFetcher&&typeof rc.texFetcher.loadSubdirs==='function')jobs.push(rc.texFetcher.loadSubdirs(providerDirs,this.fetcher));}catch(_){}
        if(jobs.length)await Promise.allSettled(jobs);
      }

      if(neededTextures.length&&rc.texFetcher&&typeof rc.texFetcher.loadSubdirs==='function'){
        try{
          const u=new URL(API_ROOT+'api/sfa-sequences/texture-providers',location.origin);
          u.searchParams.set('pathBase',this.pathBase);
          u.searchParams.set('textureIds',neededTextures.join(','));
          u.searchParams.set('preferredDirs',dirs.join(','));
          const r=await fetch(u.toString(),{cache:'no-store'}),j=await r.json();
          if(r.ok&&j&&j.ok&&Array.isArray(j.providerDirs)&&j.providerDirs.length)
            await rc.texFetcher.loadSubdirs(j.providerDirs,this.fetcher);
        }catch(e){console.warn('[Map Sequences] texture provider lookup failed',e);}
      }

      try{
        if(rc.animColl&&rc.animColl.constructor&&typeof rc.animColl.constructor.create==='function'){
          if(!rc.animColl._pfpSequenceExtraDirs)rc.animColl._pfpSequenceExtraDirs=new Set();
          const animDirs=[];for(const d of ['swaphol',...providerDirs])if(d&&!animDirs.includes(d))animDirs.push(d);
          for(const d of animDirs){
            if(rc.animColl._pfpSequenceExtraDirs.has(d))continue;
            const extra=await rc.animColl.constructor.create(this.world.gameInfo,this.fetcher,d);
            if(extra&&Array.isArray(extra.animFiles))for(const f of extra.animFiles)if(f)rc.animColl.animFiles.push(f);
            rc.animColl._pfpSequenceExtraDirs.add(d);
          }
        }
      }catch(e){console.warn('[Map Sequences] could not add sequence ANIM bank',e);}
    }


    async spawnSourceFromOwner(entry){
      if(!entry||!entry.sourceEntryBase64)return null;
      const params=dataViewFromBase64(entry.sourceEntryBase64);if(!params)return null;
      const pos=Array.isArray(entry.sourcePos)?entry.sourcePos:[0,0,0];
      const raw=Number(entry.sourceObjType);if(!Number.isFinite(raw))return null;
      let inst=null;
      try{inst=this.world.objectMan.createObjectInstance(raw&0xFFFF,params,pos,false);}catch(_){}
      if(!inst||!inst.position)return null;
      try{inst.internalClass=undefined;}catch(_){}
      inst._pfpMapSequenceTemp=true;inst._pfpMapSequenceTempSource=true;
      forceSequenceVisible(inst);
      useSequenceMapLighting(inst,null);
      fixCollectibleTintMaterials(inst);
      this.world.objectInstances.push(inst);
      this.sourceTemp=inst;this.sourceTempEntry=entry;
      return inst;
    }

    async spawnActor(defNo,uid,pos,entry=null){
      const kiosk=this.pathBase==='StarFoxAdventuresDemo';
      const requestedDefNo=Number(defNo)&0xFFFF;
      const effectiveDefNo=sequencePlayerRaw(requestedDefNo,kiosk,entry);
      let params=makeObjectParams(effectiveDefNo,uid||0,pos);let inst=null;
      let objType=null,seedSlot=0,savedModel0=null;
      const mf=this.world&&this.world.resColl&&this.world.resColl.modelFetcher,tf=this.world&&this.world.resColl&&this.world.resColl.texFetcher;
      let savedProviderOrder=null,savedTexPreferred=null,providerAdjusted=false;
      const restoreSpawnProvider=()=>{if(!providerAdjusted)return;try{if(savedProviderOrder)mf.subdirOrder=savedProviderOrder;}catch(_){}try{if(tf&&typeof tf.setPreferredSubdir==='function')tf.setPreferredSubdir(savedTexPreferred);}catch(_){}providerAdjusted=false;};
      try{
        objType=this.world.objectMan.getObjectType(effectiveDefNo,false);
        if(isCollectibleSequenceType(objType))params=cloneSequencePlacementFromResident(this.world,effectiveDefNo,uid||0,pos)||params;
        const nums=objType&&Array.isArray(objType.modelNums)?objType.modelNums:null;
        if(nums&&nums.length){
          if(effectiveDefNo===PLAYER_SABRE&&nums.length>1)seedSlot=1;
          else if(effectiveDefNo===PLAYER_KRYSTAL&&nums.length>2)seedSlot=2;
          else {
            let slot0Ready=false;try{slot0Ready=!!(this.world.resColl.modelFetcher.getModelsFileWithModel(Number(nums[0])));}catch(_){}
            if(!slot0Ready)for(let i=1;i<nums.length;i++){let ready=false;try{ready=!!this.world.resColl.modelFetcher.getModelsFileWithModel(Number(nums[i]));}catch(_){}if(ready){seedSlot=i;break;}}
          }
          if(entry&&entry._pfpModelProviders&&mf&&Array.isArray(mf.subdirOrder)){
            const selectedModel=Number(nums[Math.max(0,Math.min(seedSlot,nums.length-1))]);
            const plist=entry._pfpModelProviders[String(selectedModel)]||[];
            const pd=plist.find(d=>mf.files&&mf.files[d]&&typeof mf.files[d].hasModel==='function'&&mf.files[d].hasModel(selectedModel));
            if(pd){
              savedProviderOrder=mf.subdirOrder.slice();savedTexPreferred=tf&&Object.prototype.hasOwnProperty.call(tf,'preferredSubdir')?tf.preferredSubdir:null;
              mf.subdirOrder=[pd,...savedProviderOrder.filter(d=>d!==pd)];
              try{if(tf&&typeof tf.setPreferredSubdir==='function')tf.setPreferredSubdir(pd);}catch(_){}
              providerAdjusted=true;
            }
          }
          if(seedSlot>0){savedModel0=nums[0];nums[0]=nums[seedSlot];}
        }
        inst=this.world.objectMan.createObjectInstance(effectiveDefNo,params,pos,false);
      }catch(_){}finally{
        try{if(objType&&savedModel0!==null)objType.modelNums[0]=savedModel0;}catch(_){}
      }
      if(inst&&inst.position){
        try{inst._pfpSequenceModelProviders=entry&&entry._pfpModelProviders||null;}catch(_){}
        try{
          if(effectiveDefNo===PLAYER_SABRE) setSequenceModelSlot(inst,1);
          else if(effectiveDefNo===PLAYER_KRYSTAL) setSequenceModelSlot(inst,2);
          else if(seedSlot>0) setSequenceModelSlot(inst,seedSlot);
        }catch(_){}
        restoreSpawnProvider();

        try{
          if(!kiosk){
            const baseScale=Number(inst.objType&&inst.objType.scale);
            if(Number.isFinite(baseScale)&&baseScale>0)inst.scale=baseScale;
          }
          inst.srtDirty=true;
        }catch(_){}
        inst._pfpMapSequenceTemp=true;
        inst._pfpMapSequenceGenericActor=true;
        try{if(typeof inst.setParent==='function')inst.setParent(null);else inst.parent=null;}catch(_){}
        try{inst.internalClass=undefined;}catch(_){}
        this.world.objectInstances.push(inst);
        return inst;
      }
      restoreSpawnProvider();
      return null;
    }


    async ensurePlayerStaff(actor){
      const player=actor&&actor.instance;
      if(!player||!player.modelInst)return null;
      if(!isPlayerCastDef(romDefNo(player))&&!actor.isPlayer)return null;
      let rec=this.playerStaffs.get(player);
      if(rec){
        if(!rec.actors.includes(actor))rec.actors.push(actor);
        return rec;
      }
      let staff=null;
      const mf=this.world&&this.world.resColl&&this.world.resColl.modelFetcher;
      const tf=this.world&&this.world.resColl&&this.world.resColl.texFetcher;
      const savedOrder=mf&&Array.isArray(mf.subdirOrder)?mf.subdirOrder.slice():null;
      const savedTexPreferred=tf&&Object.prototype.hasOwnProperty.call(tf,'preferredSubdir')?tf.preferredSubdir:null;
      try{
        if(savedOrder&&mf.files&&mf.files.swaphol){
          const st=this.world.objectMan&&this.world.objectMan.getObjectType?this.world.objectMan.getObjectType(PLAYER_STAFF,false):null;
          const modelId=st&&Array.isArray(st.modelNums)&&st.modelNums.length?Number(st.modelNums[0]):-1;
          if(modelId>=0&&typeof mf.files.swaphol.hasModel==='function'&&mf.files.swaphol.hasModel(modelId))mf.subdirOrder=['swaphol',...savedOrder.filter(d=>d!=='swaphol')];
        }
        if(tf&&typeof tf.setPreferredSubdir==='function')tf.setPreferredSubdir('swaphol');
        const params=makeObjectParams(PLAYER_STAFF,0,[0,0,0]);
        staff=this.world.objectMan.createObjectInstance(PLAYER_STAFF,params,[0,0,0],false);
      }catch(_){}finally{
        if(savedOrder)mf.subdirOrder=savedOrder;
        if(tf&&typeof tf.setPreferredSubdir==='function')tf.setPreferredSubdir(savedTexPreferred);
      }
      if(!staff||!staff.modelInst)return null;
      staff._pfpMapSequenceTemp=true;
      staff._pfpMapSequenceStaff=true;
      useSequenceMapLighting(staff,player);
      try{staff.ambienceIdx=Number.isFinite(Number(player.ambienceIdx))?Number(player.ambienceIdx):staff.ambienceIdx;staff.sphereMapIntensity=255;}catch(_){}
      staff._pfpStaffBaseScale=Number(staff.scale)||1;
      staff._pfpStaffAnim=staff.anim||null;staff._pfpStaffModelAnimNum=staff.modelAnimNum;
      if(!staff._pfpStaffAnim&&typeof staff.setModelAnimNum==='function'){
        try{staff.setModelAnimNum(0);staff._pfpStaffAnim=staff.anim||null;staff._pfpStaffModelAnimNum=staff.modelAnimNum;}catch(_){}
      }
      try{delete staff._pfpSequenceAnimState;}catch(_){}
      staff._pfpStaffAttachPoint=2; // OBJECTS path point 2 = staff on back.
      try{staff.internalClass=undefined;}catch(_){}
      try{if(typeof staff.setParent==='function')staff.setParent(null);else staff.parent=null;}catch(_){}
      forceSequenceVisible(staff);
      fixSequenceProbeMaterials(staff,true);
      refreshSequencePropMaterials(staff);
      const matrix=new Float32Array(16);matrix[0]=matrix[5]=matrix[10]=matrix[15]=1;
      rec={player,staff,actors:[actor],matrix,mode:'back'};
      this.playerStaffs.set(player,rec);
      const originalGetWorld=typeof staff.getWorldSRT==='function'?staff.getWorldSRT.bind(staff):null;
      staff.getWorldSRT=(out)=>{
        const point=rec.mode==='hand'?0:2; // path point 0 = left hand, 2 = back.
        if(buildPlayerAttachmentWorld(rec.matrix,player,staff,point))return copyMat4(out,rec.matrix);
        if(originalGetWorld)return originalGetWorld(out);
        return out;
      };
      this.world.objectInstances.push(staff);
      rec.ends=[];
      freezeStaffEndpoint(rec);
      return rec;
    }

    async spawnAttachedProp(owner, rawDef, attachPoint, tag){
      if(!owner||!owner.modelInst||rawDef<0)return null;
      let prop=null;try{const params=sequencePlacementParamsForProp(this.world,rawDef,0,[0,0,0]);prop=this.world.objectMan.createObjectInstance(rawDef,params,[0,0,0],false);}catch(_){}
      if(!prop||!prop.modelInst)return null;
      prop._pfpMapSequenceTemp=true;prop._pfpMapSequenceProp=tag||'held';
      useSequenceMapLighting(prop,owner);
      prop._pfpPropBaseScale=isKnownHeldPropName(prop.objType&&prop.objType.name)?1:(Number(prop.scale)||1);
      try{prop.ambienceIdx=Number.isFinite(Number(owner.ambienceIdx))?Number(owner.ambienceIdx):prop.ambienceIdx;}catch(_){}
      try{prop.internalClass=undefined;}catch(_){}
      try{if(typeof prop.setParent==='function')prop.setParent(null);else prop.parent=null;}catch(_){}
      forceSequenceVisible(prop);
      fixSequenceProbeMaterials(prop,true);
      refreshSequencePropMaterials(prop);
      const point=attachmentPointOrFallback(owner,attachPoint);if(point<0){releaseSequenceVisible(prop);return null;}
      const matrix=new Float32Array(16);matrix[0]=matrix[5]=matrix[10]=matrix[15]=1;
      const originalGetWorld=typeof prop.getWorldSRT==='function'?prop.getWorldSRT.bind(prop):null;
      prop.getWorldSRT=(out)=>{
        const oldScale=prop._pfpStaffBaseScale;prop._pfpStaffBaseScale=prop._pfpPropBaseScale;
        const ok=buildPlayerAttachmentWorld(matrix,owner,prop,point);
        if(oldScale===undefined)delete prop._pfpStaffBaseScale;else prop._pfpStaffBaseScale=oldScale;
        if(ok)return copyMat4(out,matrix);if(originalGetWorld)return originalGetWorld(out);return out;
      };
      this.world.objectInstances.push(prop);
      const rec={owner,prop,point,tag:tag||'held'};this.sequenceProps.push(rec);return rec;
    }

    async spawnOverlayProp(owner, rawDef, tag){
      if(!owner||!owner.modelInst||rawDef<0)return null;
      let prop=null;try{const params=sequencePlacementParamsForProp(this.world,rawDef,0,[0,0,0]);prop=this.world.objectMan.createObjectInstance(rawDef,params,[0,0,0],false);}catch(_){}
      if(!prop||!prop.modelInst)return null;
      prop._pfpMapSequenceTemp=true;prop._pfpMapSequenceProp=tag||'overlay';
      useSequenceMapLighting(prop,owner);
      try{prop.internalClass=undefined;}catch(_){}
      try{if(typeof prop.setParent==='function')prop.setParent(null);else prop.parent=null;}catch(_){}
      forceSequenceVisible(prop);
      fixSequenceProbeMaterials(prop,true);
      refreshSequencePropMaterials(prop);
      const matrix=new Float32Array(16);matrix[0]=matrix[5]=matrix[10]=matrix[15]=1;
      const originalGetWorld=typeof prop.getWorldSRT==='function'?prop.getWorldSRT.bind(prop):null;
      prop.getWorldSRT=(out)=>{try{if(typeof owner.getWorldSRT==='function'){owner.getWorldSRT(matrix);return copyMat4(out,matrix);}}catch(_){}if(originalGetWorld)return originalGetWorld(out);return out;};
      this.world.objectInstances.push(prop);
      const rec={owner,prop,point:-1,tag:tag||'overlay'};this.sequenceProps.push(rec);return rec;
    }

    async ensureStaffEnds(rec){
      return;
    }

    async ensureCharacterEquipment(actors){
      for(const a of actors||[]){
        if(!a||!a.instance||!isCloudRunnerQueenName(objectName(a.instance))||a._pfpCarryAttached)continue;
        const ownerActor=(actors||[]).find(c=>c&&c.instance&&isGeneralScalesName(objectName(c.instance)));if(!ownerActor)continue;
        const child=a.instance,current=new Float32Array(16),matrix=new Float32Array(16),originalGetWorld=typeof child.getWorldSRT==='function'?child.getWorldSRT.bind(child):null;if(!originalGetWorld)continue;
        child.getWorldSRT=(out)=>{originalGetWorld(current);if(buildCarriedActorWorld(matrix,ownerActor.instance,child,current))return copyMat4(out,matrix);return copyMat4(out,current);};
        a._pfpCarryAttached=true;a._pfpHeldOriginalGetWorld=originalGetWorld;a._pfpHeldOwnerActor=ownerActor;
      }

      for(let i=0;i<(actors||[]).length;i++){
        const a=actors[i],name=objectName(a&&a.instance);
        if(!a||!a.instance||!isKnownHeldPropName(name)||a._pfpHeldAttached)continue;
        if(a.hasPositionCurve||a.hasRotationCurve)continue;
        let ownerActor=null;
        for(let j=i-1;j>=0;j--){
          const c=actors[j];
          if(c&&c.instance&&c.instance.modelInst&&c.instance.modelInst.skeletonInst&&!isKnownHeldPropName(objectName(c.instance))){ownerActor=c;break;}
        }
        if(!ownerActor)continue;
        const point=attachmentPointOrFallback(ownerActor.instance,0);if(point<0)continue;
        const prop=a.instance,matrix=new Float32Array(16);matrix[0]=matrix[5]=matrix[10]=matrix[15]=1;
        const originalGetWorld=typeof prop.getWorldSRT==='function'?prop.getWorldSRT.bind(prop):null;
        const baseScale=Number(prop.scale)||1;
        prop.getWorldSRT=(out)=>{
          const old=prop._pfpStaffBaseScale;prop._pfpStaffBaseScale=baseScale;
          const ok=buildPlayerAttachmentWorld(matrix,ownerActor.instance,prop,point);
          if(old===undefined)delete prop._pfpStaffBaseScale;else prop._pfpStaffBaseScale=old;
          if(ok)return copyMat4(out,matrix);if(originalGetWorld)return originalGetWorld(out);return out;
        };
        a._pfpHeldAttached=true;a._pfpHeldOriginalGetWorld=originalGetWorld;a._pfpHeldOwnerActor=ownerActor;
        ownerActor._pfpHasExplicitHeldProp=true;
      }

      const kiosk=this.pathBase==='StarFoxAdventuresDemo';
      const baddieClass=kiosk?204:201;
      const bgsRaw=rawDefByObjectNames(this.world,['BGSweapon'],[BGS_WEAPON]);
      const scRaw=rawDefByObjectNames(this.world,['SCweaponT1'],[0x0033]);
      for(const a of actors||[]){
        if(!a||!a.instance||!a.instance.modelInst||!a.instance.modelInst.skeletonInst||a._pfpHasExplicitHeldProp)continue;
        const equipFrame=firstSequenceCallbackFrame(a.curve,2);
        if(equipFrame===null)continue;
        const cls=Number(a.instance.objType&&a.instance.objType.objClass);
        const general=isGeneralScalesName(objectName(a.instance));
        if(!general&&cls!==baddieClass)continue;
        const raw=general?bgsRaw:scRaw;if(!(raw>=0))continue;
        const tag=general?'BGSweapon:event2':'SCweaponT1:event2';
        if(this.sequenceProps.some(r=>r&&r.owner===a.instance&&r.tag===tag))continue;
        const rec=await this.spawnAttachedProp(a.instance,raw,0,tag);if(!rec)continue;
        rec.equipmentEvent=true;rec.equipFrame=equipFrame;rec.active=this.frame>=equipFrame;
        const attachedGet=rec.prop.getWorldSRT.bind(rec.prop);
        rec.prop.getWorldSRT=(out)=>{
          const r=attachedGet(out);
          if(!rec.active)hideAttachedBasis(out);
          return r;
        };
      }
    }

    syncCharacterEquipment(){
      for(const rec of this.sequenceProps||[]){
        if(!rec||!rec.equipmentEvent)continue;
        rec.active=this.frame>=rec.equipFrame;
      }
    }

    syncPlayerStaffs(){
      for(const rec of this.playerStaffs.values()){
        if(!rec||!rec.staff||!rec.player)continue;
        const curves=(rec.actors||[]).map(a=>a&&a.curve).filter(Boolean);
        const ev=latestStaffCommand(curves,this.frame);
        rec.mode=ev&&ev.cmd===0x18?'hand':'back';
        rec.staff._pfpStaffAttachPoint=rec.mode==='hand'?0:2;
        freezeStaffEndpoint(rec);
      }
    }

    cleanupPlayerStaffs(){
      const device=this.world&&this.world.context&&this.world.context.device;
      for(const rec of this.playerStaffs.values()){
        const staff=rec&&rec.staff;if(!staff)continue;
        restoreSequenceProbeMaterials(staff);
        releaseSequenceVisible(staff);
        const idx=this.world.objectInstances.indexOf(staff);if(idx>=0)this.world.objectInstances.splice(idx,1);
        try{if(typeof staff.destroy==='function')staff.destroy(device);else if(staff.modelInst&&typeof staff.modelInst.destroy==='function')staff.modelInst.destroy(device);}catch(_){}
      }
      this.playerStaffs.clear();
      this.cleanupSequenceProps();
    }

    cleanupSequenceProps(){
      const device=this.world&&this.world.context&&this.world.context.device;
      for(const r of this.sequenceProps||[]){const prop=r&&r.prop;if(!prop)continue;restoreSequenceProbeMaterials(prop);releaseSequenceVisible(prop);const idx=this.world.objectInstances.indexOf(prop);if(idx>=0)this.world.objectInstances.splice(idx,1);try{if(typeof prop.destroy==='function')prop.destroy(device);else if(prop.modelInst&&typeof prop.modelInst.destroy==='function')prop.modelInst.destroy(device);}catch(_){}}
      this.sequenceProps=[];
    }

    cleanupActors(){
      this.cleanupPlayerStaffs();
      const device=this.world&&this.world.context&&this.world.context.device;
      for(const a of this.actors){
        if(!a.instance)continue;
        if(a._pfpHeldOriginalGetWorld){try{a.instance.getWorldSRT=a._pfpHeldOriginalGetWorld;}catch(_){}a._pfpHeldOriginalGetWorld=null;}
        if(a.spawned){
          restoreSequenceProbeMaterials(a.instance);
          releaseSequenceVisible(a.instance);
          const idx=this.world.objectInstances.indexOf(a.instance);if(idx>=0)this.world.objectInstances.splice(idx,1);
          try{if(typeof a.instance.destroy==='function')a.instance.destroy(device);
              else if(a.instance.modelInst&&typeof a.instance.modelInst.destroy==='function')a.instance.modelInst.destroy(device);}catch(_){}
        }else {
          restoreSequenceProbeMaterials(a.instance);
          delete a.instance._pfpSequenceOpacity;delete a.instance._pfpSequenceModelProviders;
          releaseSequenceVisible(a.instance);
          if(a.original)restore(a.instance,a.original);
        }
      }
      this.actors=[];this.cameraActor=null;this.setLetterbox(false);
      if(this.sourceTemp){
        const tmp=this.sourceTemp,idx=this.world.objectInstances.indexOf(tmp);if(idx>=0)this.world.objectInstances.splice(idx,1);
        try{const device=this.world&&this.world.context&&this.world.context.device;if(typeof tmp.destroy==='function')tmp.destroy(device);else if(tmp.modelInst&&typeof tmp.modelInst.destroy==='function')tmp.modelInst.destroy(device);}catch(_){}
        if(this.sourceTempEntry&&this.sourceTempEntry.source===tmp)this.sourceTempEntry.source=null;
        this.sourceTemp=null;this.sourceTempEntry=null;
      }
    }

    validSideGameBit(id){id=Number(id);return Number.isInteger(id)&&id>=0&&(!this.gameBitCount||id<this.gameBitCount);}
    getSideGameBit(id){if(!this.validSideGameBit(id))return 0;return this.sideGameBits.get(id)?1:0;}
    setSideGameBit(id,value){
      id=Number(id);if(!this.validSideGameBit(id))return false;value=value?1:0;
      const old=this.getSideGameBit(id);this.sideGameBits.set(id,value);this.sideTouchedBits.add(id);
      return old!==value;
    }

    objectSequenceIdAt(inst,localIndex){
      localIndex=Number(localIndex);if(!inst||!inst.objType||!inst.objType.data||!Number.isInteger(localIndex)||localIndex<0)return -1;
      try{
        const d=inst.objType.data,kiosk=this.pathBase==='StarFoxAdventuresDemo';
        if(d.byteLength<(kiosk?0x72:0x60))return -1;
        const rel=d.getUint32(0x1C,false);const count=kiosk?d.getUint16(0x70,false):d.getUint8(0x5E);
        if(!rel||rel===0xFFFFFFFF||!count||localIndex>=count||rel+(localIndex+1)*2>d.byteLength)return -1;
        const id=d.getInt16(rel+localIndex*2,false);return id>=0?id:-1;
      }catch(_){return -1;}
    }

    scanSideControllers(){
      const out=[];const instances=(this.world&&Array.isArray(this.world.objectInstances))?this.world.objectInstances:[];
      for(const inst of instances){
        if(!inst||(inst._pfpMapSequenceTemp&&!inst._pfpMapSequenceTempSource)||!inst.objType||!inst.objParams)continue;
        const cls=Number(inst.objType.objClass),p=inst.objParams,kiosk=this.pathBase==='StarFoxAdventuresDemo';let c=null;
        const seqClass=kiosk?280:274,newSeqClass=kiosk?281:275,doorClass=kiosk?278:272;
        try{
          if(cls===seqClass&&p.byteLength>=0x25){
            c={kind:274,source:inst,openBit:p.getInt16(0x18,false),triggerBit:p.getInt16(0x1A,false),flags:p.getUint8(0x1D),sequenceLocal:p.getInt8(0x1E),preemptLocal:p.getInt16(0x20,false),sequenceParam:p.getUint16(0x22,false),warpMapId:p.getUint8(0x24),open:false,triggerState:0,active:false,done:false};
          }else if(cls===newSeqClass&&p.byteLength>=0x24){
            c={kind:275,source:inst,usedBit:p.getInt16(0x18,false),requiredBit:p.getInt16(0x1A,false),flags:p.getUint8(0x1D),sequenceLocal:p.getInt8(0x1E),preemptLocal:p.getInt16(0x20,false),sequenceParam:p.getUint16(0x22,false),active:false,done:false,ranOnce:false};
          }else if(cls===doorClass&&p.byteLength>=0x24){
            c={kind:272,source:inst,closeRequestBit:p.getInt16(0x18,false),closedLatchBit:p.getInt16(0x1A,false),triggerSequenceLocal:p.getInt16(0x1C,false),sequenceLocal:p.getInt8(0x1E),triggerArg:p.getUint8(0x20)&0x7F,closeReadyBit:p.getInt16(0x22,false),active:false,done:false,started:false};
          }
        }catch(_){c=null;}
        if(c){c.id=this.sideControllerSerial++;out.push(c);}
      }
      return out;
    }

    cleanupAuxSequence(aux){
      if(!aux||aux._cleaned)return;aux._cleaned=true;const device=this.world&&this.world.context&&this.world.context.device;
      for(const a of aux.actors||[]){
        if(!a||!a.instance)continue;
        if(a.spawned){const idx=this.world.objectInstances.indexOf(a.instance);if(idx>=0)this.world.objectInstances.splice(idx,1);try{if(typeof a.instance.destroy==='function')a.instance.destroy(device);else if(a.instance.modelInst&&typeof a.instance.modelInst.destroy==='function')a.instance.modelInst.destroy(device);}catch(_){}}
        else{delete a.instance._pfpSequenceOpacity;delete a.instance._pfpSequenceModelProviders;releaseSequenceVisible(a.instance);if(a.original)restore(a.instance,a.original);}
      }
    }

    cleanupSideRuntime(){
      this.sideGeneration++;
      for(const aux of this.auxSequences||[])this.cleanupAuxSequence(aux);
      this.auxSequences=[];this.sideGameBits=new Map();this.sideTouchedBits=new Set();this.sideControllers=[];this.sideEventCursor=-1;
    }

    resetSideRuntime(){
      this.cleanupSideRuntime();
      this.sideControllers=this.scanSideControllers();
      this.sideEventCursor=-1;
      for(const a of this.actors||[])if(a){
        delete a._pfpObjectEventState;delete a._pfpConditionRuntime;delete a._pfpRomCurveStart;delete a._pfpRomCurveNetwork;
        if(a.instance){delete a.instance._pfpSequenceCallbackState;delete a.instance._pfpSequenceOpacity;delete a.instance._pfpSequenceAnimState;const slots=a.instance._pfpSequenceTextureSlots;if(Array.isArray(slots))for(const x of slots){x.textureId=0;x.offsetS=0;x.offsetT=0;}}
      }
      if(this.cameraActor){delete this.cameraActor._pfpConditionRuntime;delete this.cameraActor._pfpRomCurveStart;delete this.cameraActor._pfpRomCurveNetwork;}
      for(const aux of this.auxSequences||[])for(const a of aux.actors||[]){delete a._pfpConditionRuntime;delete a._pfpRomCurveStart;delete a._pfpRomCurveNetwork;}
    }

    moveObjectEvents(inst,move){
      if(!inst||!inst.objType||!inst.objType.data||!this.objectEventTable||!Number.isInteger(move))return [];
      try{
        const d=inst.objType.data;if(d.byteLength<0x24)return[];const rel=d.getUint32(0x20,false);
        if(!rel||rel===0xFFFFFFFF||rel+6>d.byteLength)return[];
        for(let o=rel;o+6<=d.byteLength;o+=6){
          const m=d.getInt16(o,false);if(m===-1)break;
          if(m!==move)continue;
          const off=d.getInt16(o+2,false),bytes=Math.min(0x50,d.getInt16(o+4,false));
          if(off<0||bytes<=0||off+bytes>this.objectEventTable.byteLength)return[];
          const out=[];for(let e=off;e+2<=off+bytes;e+=2){const packed=this.objectEventTable.getUint16(e,false);out.push({frame:packed&0x1FF,id:(packed>>>9)&0x7F});}
          return out;
        }
      }catch(_){ }
      return[];
    }

    sequenceCallbackProfile(owner){
      const n=String(owner&&owner.objType&&owner.objType.name||owner&&owner.getName&&owner.getName()||'').toLowerCase();
      if(n.includes('queenear')||n.includes('queenearth')||n.includes('sh_queen'))return 'queenEarthWalker';
      if(n.includes('cfguardian'))return 'cfGuardian';
      if(n.includes('cfprisongua'))return 'cfPrisonGuard';
      if(n.includes('cfprisonunc'))return 'cfPrisonUncle';
      if(n.includes('imsnowclaw'))return 'imSnowClaw';
      if(n.includes('slidingdoor'))return 'slidingDoor';
      return '';
    }

    callbackState(owner){
      if(!owner)return null;
      if(!owner._pfpSequenceCallbackState)owner._pfpSequenceCallbackState={
        profile:this.sequenceCallbackProfile(owner),eyeAnim:false,targeting:false,
        eyeState:0,eyelidState:0,lastEvent:-1,lastFaceFrame:null,
        blinkState:0,blinkTimer:0,movementTimer:0,movementStep:0,movementTarget:0
      };
      return owner._pfpSequenceCallbackState;
    }

    ensureSequenceTextureSlots(owner){
      if(!owner)return [];
      if(Array.isArray(owner._pfpSequenceTextureSlots))return owner._pfpSequenceTextureSlots;
      const out=[];
      try{
        const ot=owner.objType,d=ot&&ot.data;if(!d||d.byteLength<0x14){owner._pfpSequenceTextureSlots=out;return out;}
        const off=d.getUint32(0x0C,false);
        let count=0;
        if(ot&&ot.useEarlyNameLayout){
          const next=d.getUint32(0x10,false),bytes=next-off;
          if(off>0&&next>off&&(bytes&1)===0&&bytes<=0x100)count=bytes>>>1;
        }else if(d.byteLength>0x59){
          count=d.getUint8(0x59);
        }
        if(off>0&&off!==0xFFFFFFFF&&count>0&&count<0x80&&off+count*2<=d.byteLength){
          for(let i=0;i<count;i++){const p=off+i*2;out.push({tag:d.getUint8(p),materialIndex:d.getUint8(p+1),textureId:0,offsetS:0,offsetT:0});}
        }
      }catch(_){ }
      owner._pfpSequenceTextureSlots=out;
      return out;
    }

    sequenceTextureSlot(owner,tag){
      const slots=this.ensureSequenceTextureSlots(owner);
      for(const s of slots)if(s.tag===tag)return s;
      return null;
    }

    applySequenceTextureTracks(owner,curve,frame){
      if(!owner||!curve)return;
      const st=this.callbackState(owner);
      if(!(st&&st.profile==='queenEarthWalker'&&st.targeting)){
        const tex1=this.sequenceTextureSlot(owner,1),tex0=this.sequenceTextureSlot(owner,0);
        if(tex1||tex0){
          const sx=Math.trunc(10*sample(curve,CHANNEL.EYE_X,frame,0));
          const sy=-Math.trunc(10*sample(curve,CHANNEL.EYE_Y,frame,0));
          if(tex1){tex1.offsetS=sx;tex1.offsetT=sy;}
          if(tex0){tex0.offsetS=-sx;tex0.offsetT=sy;}
        }
        const tex5=this.sequenceTextureSlot(owner,5),tex4=this.sequenceTextureSlot(owner,4);
        if(tex5)tex5.textureId=((st&&Number.isFinite(Number(st.eyeState))?Number(st.eyeState):0)&0xFF)<<8;
        if(tex4)tex4.textureId=((st&&Number.isFinite(Number(st.eyelidState))?Number(st.eyelidState):0)&0xFF)<<8;
      }
    }

    applyCharacterSequenceCallback(actor,frame){
      const owner=actor&&actor.instance;if(!owner)return;
      const st=this.callbackState(owner);if(!st||st.profile!=='queenEarthWalker')return;
      let dt=1;if(Number.isFinite(st.lastFaceFrame)){dt=frame-st.lastFaceFrame;if(dt<0||dt>8){st.blinkState=0;st.blinkTimer=0;st.movementTimer=0;st.movementStep=0;dt=1;}}
      st.lastFaceFrame=frame;dt=Math.max(0,Math.min(4,dt));
      if(!st.targeting)return;
      const tex5=this.sequenceTextureSlot(owner,5),tex4=this.sequenceTextureSlot(owner,4);
      const eye1=this.sequenceTextureSlot(owner,1),eye0=this.sequenceTextureSlot(owner,0);
      if(st.eyeAnim){
        if(tex5||tex4){const cur=tex4?tex4.textureId:(tex5?tex5.textureId:0);const v=Math.min(0x200,Math.trunc(cur+0x30*dt));if(tex5)tex5.textureId=v;if(tex4)tex4.textureId=v;}
        st.blinkState=1;
        return;
      }
      if(tex5||tex4){
        let v=tex4?tex4.textureId:(tex5?tex5.textureId:0),bs=st.blinkState|0;
        switch(bs&0x0F){
          case 0:
            if(st.blinkTimer>0)st.blinkTimer=Math.max(0,st.blinkTimer-dt);
            else if(Math.random()*1001>0x3DE){st.blinkState=1;st.blinkTimer=0;}
            break;
          case 1:
            if(bs&0x80){v-=0x60*dt;if(v<0){v=0;st.blinkState=0;st.blinkTimer=0;}}
            else{v+=0x60*dt;if(v>0x200){v=0x2FF;st.blinkState=-127;st.blinkTimer=0x28;}}
            if(tex5)tex5.textureId=Math.trunc(v);if(tex4)tex4.textureId=Math.trunc(v);
            break;
        }
      }
      if(eye1&&eye0){
        if(st.movementStep===0||((st.movementStep<0)&&(eye1.offsetS+st.movementStep*dt<=st.movementTarget))||((st.movementStep>0)&&(eye1.offsetS+st.movementStep*dt>=st.movementTarget))){
          st.movementTarget=Math.floor(-1000+Math.random()*2001);st.movementStep=st.movementTarget<eye1.offsetS?-0x96:0x96;st.movementTimer=Math.floor(0x1E+Math.random()*(0x64-0x1E+1));
        }
        if(st.movementTimer>0)st.movementTimer=Math.max(0,st.movementTimer-dt);
        else{eye1.offsetS=Math.trunc(eye1.offsetS+st.movementStep*dt);eye1.offsetT=0;eye0.offsetS=eye1.offsetS;eye0.offsetT=0;}
      }
    }

    dispatchCharacterSequenceEvent(owner,eventId){
      this.signalDecisionEvent(eventId);
      const st=this.callbackState(owner);if(!st)return;st.lastEvent=eventId;
      if(st.profile==='queenEarthWalker'){
        if(eventId===0)st.eyeAnim=true;
        else if(eventId===1)st.eyeAnim=false;
        else if(eventId===2)st.targeting=true;
        else if(eventId===3)st.targeting=false;
      }
    }

    dispatchObjectSequenceEvent(owner,eventId){
      if(!owner)return;const ctrl=this.sideControllers.find(c=>c.source===owner);if(!ctrl)return;
      if(ctrl.kind===274){
        if(eventId===1&&(ctrl.flags&0x02)){this.setSideGameBit(ctrl.openBit,1);ctrl.open=true;}
      }else if(ctrl.kind===275){
        if(eventId===0)this.setSideGameBit(ctrl.requiredBit,0);
        else if(eventId===1)this.setSideGameBit(ctrl.usedBit,1);
      }else if(ctrl.kind===272){
        if(eventId===1)this.setSideGameBit(ctrl.closedLatchBit,0);
        else if(eventId===2)this.setSideGameBit(ctrl.closedLatchBit,1);
      }
    }

    processActorObjectEvents(actor,frame){
      if(!actor||!actor.instance||!actor.curve||!this.objectEventTable)return;
      const ev=latestAnimationEvent(actor.curve,frame);if(!ev)return;const move=moveForAnimationEvent(actor,ev);if(!Number.isInteger(move))return;
      const anim=actor._seqAnim||animationForResolved(actor,resolveAnim(actor,move));if(!anim)return;
      let phase=phaseForActor(actor,ev,frame,anim);if(!Number.isFinite(phase))return;phase=clamp(phase,0,1);
      const cur=Math.max(0,Math.min(511,Math.floor(phase*512)));let st=actor._pfpObjectEventState;
      if(!st||st.move!==move||frame<st.seqFrame){actor._pfpObjectEventState={move,phaseFrame:cur,seqFrame:frame};return;}
      const prev=st.phaseFrame,entries=this.moveObjectEvents(actor.instance,move);
      for(const pe of entries){const hit=cur>=prev?(pe.frame>=prev&&pe.frame<cur):(pe.frame>=prev||pe.frame<cur);if(hit){this.dispatchCharacterSequenceEvent(actor.instance,pe.id);this.dispatchObjectSequenceEvent(actor.instance,pe.id);}}
      st.phaseFrame=cur;st.seqFrame=frame;
    }

    processSyntheticSideEvent(e,owner){
      if(!e)return;
      if(e.opcode===0x102&&e.sideKind==='gamebit'){this.setSideGameBit(e.gameBit,e.gameBitValue);return;}
      if(e.opcode===0x103&&e.sideKind==='faceState'){const st=this.callbackState(owner);if(st){if(e.faceCommand===0x8){st.eyeState=e.faceValue;st.eyelidState=e.faceValue;}else if(e.faceCommand===0xE)st.eyeState=e.faceValue;else if(e.faceCommand===0xF)st.eyelidState=e.faceValue;}return;}
      if(e.opcode!==0x101)return;
      if(e.conditionOp===2&&e.conditionSubId===0){const id=e.conditionParamU&0xFFFF;this.dispatchCharacterSequenceEvent(owner,id);this.dispatchObjectSequenceEvent(owner,id);return;}
      if(e.conditionOp===7){this.dispatchRetailMessage(e.conditionSubId&0x3FF,owner,e);return;}
    }

    processCurveSideEvents(curves,owners,fromFrame,toFrame){
      if(!(toFrame>=0))return;const list=[];
      for(const c of curves||[]){if(!c)continue;for(const e of c.events||[]){if(e.time>fromFrame&&e.time<=toFrame&&(e.opcode===0x101||e.opcode===0x102||e.opcode===0x103))list.push({e,owner:owners&&owners.get(c)||null});}}
      list.sort((a,b)=>(a.e.time-b.e.time)||(a.e.index-b.e.index));
      for(const x of list)this.processSyntheticSideEvent(x.e,x.owner);
    }

    async startAuxSequence(ctrl,triggerFrame,reason){
      const generation=this.sideGeneration,source=ctrl&&ctrl.source;if(!source||!source.position)return null;
      const sequenceId=this.objectSequenceIdAt(source,ctrl.sequenceLocal);if(sequenceId<0)return null;
      const preferred=[];if(this.current){for(const d of (this.current.ownerSequenceDirs||[]))if(d&&!preferred.includes(d))preferred.push(d);if(this.current.dir&&!preferred.includes(this.current.dir))preferred.push(this.current.dir);for(const d of (this.current.providerSequenceDirs||[]))if(d&&!preferred.includes(d))preferred.push(d);}const res=this.findResourceDir(sequenceId,preferred,false);if(!res)return null;
      await this.ensureSequenceActorBanks(res);if(generation!==this.sideGeneration)return null;
      const sourcePose=sourceLocalPose(source),sourcePos=sourcePose.position,sourceYaw=sourcePose.yaw,sourceParent=sourcePose.parent;
      const sourceWorldPos=renderedWorldPose(source).position,srcModelFlags=objectModelFlags(source);
      const nestAfterFirst=!!((srcModelFlags&0x40)!==0&&(srcModelFlags&0x8000)===0),actors=[],controlCurves=[],owners=new Map(),claimed=new Set();let maxFrame=1;
      for(const ce of res.cast){
        const curve=parseCurve(res.baseCurve+ce.index,res.tables.curveTab,res.tables.curveBin);if(!curve)continue;maxFrame=Math.max(maxFrame,curve.maxFrame);
        const nested=nestAfterFirst&&ce.index!==0,castBase=nested?[0,0,0]:sourcePos,castParent=nested?source:sourceParent,heading=(ce.flags&0x0004)!==0?0:(nested?0:sourceYaw);
        if(ce.defNo===SPECIAL_CAMERA){owners.set(curve,null);continue;}
        const isSource=ce.defNo===SPECIAL_SOURCE,isPlayer=ce.defNo===PLAYER_SABRE||ce.defNo===PLAYER_KRYSTAL,isTricky=ce.defNo===TRICKY_A||ce.defNo===TRICKY_B,isOverride=isSource||((ce.flags&0x4000)!==0);
        let inst=null,spawned=false,boundExisting=false;
        if(isSource){
          const hasPose=curve.channels.has(CHANNEL.POS_X)||curve.channels.has(CHANNEL.POS_Y)||curve.channels.has(CHANNEL.POS_Z)||curve.channels.has(CHANNEL.ROT_X)||curve.channels.has(CHANNEL.ROT_Y)||curve.channels.has(CHANNEL.ROT_Z)||!!latestAnimationEvent(curve,curve.maxFrame);
          if(hasPose){inst=source;boundExisting=true;}else{controlCurves.push(curve);owners.set(curve,source);continue;}
        }else if(isOverride){
          if(ce.targetObjId)inst=findByUid(this.world,ce.targetObjId);else if(isPlayer)inst=findActivePlayer(this.world,sourceWorldPos,claimed,false);else inst=findNearestResidentRaw(this.world,ce.defNo,sourceWorldPos,claimed);
          if(inst)boundExisting=true;else{inst=await this.spawnActor(ce.defNo,ce.targetObjId||0,castBase,res);if(inst)spawned=true;}
        }else{inst=await this.spawnActor(ce.defNo,0,castBase,res);if(inst)spawned=true;}
        if(generation!==this.sideGeneration){if(inst&&spawned){const idx=this.world.objectInstances.indexOf(inst);if(idx>=0)this.world.objectInstances.splice(idx,1);}return null;}
        if(!inst)continue;try{inst._pfpSequenceModelProviders=entry&&entry._pfpModelProviders||null;}catch(_){}if(boundExisting)claimed.add(inst);const orig=snapshot(inst);if(spawned&&inst!==castParent){try{inst.parent=castParent;inst.srtDirty=true;}catch(_){}}
        if(spawned)useSequenceMapLighting(inst,source);
        fixCollectibleTintMaterials(inst);
        if(inst.modelInst)forceSequenceVisible(inst);
        if(spawned){try{inst.anim=null;}catch(_){}}
        const modanimBanks=buildModanimBanks(inst.modanim),hasPositionCurve=curve.channels.has(CHANNEL.POS_X)||curve.channels.has(CHANNEL.POS_Y)||curve.channels.has(CHANNEL.POS_Z),hasRotationCurve=curve.channels.has(CHANNEL.ROT_X)||curve.channels.has(CHANNEL.ROT_Y)||curve.channels.has(CHANNEL.ROT_Z);
        const copyPosition=!isOverride||((ce.flags&0x0001)===0),copyRotation=!isOverride||((ce.flags&0x0002)===0),visualStartFrame=firstSequenceVisualFrame(curve);
        const a={...ce,curve,instance:inst,spawned,boundExisting,isOverride,original:orig,sourcePos:[...sourcePos],basePosition:[...castBase],heading,sequenceParent:castParent,mapInstance:this.world.mapInstance,world:this.world,isSource,isPlayer,isTricky,modanimBanks,_modanimRef:inst.modanim,copyPosition,copyRotation,hasPositionCurve,hasRotationCurve,visualStartFrame,_overrideParentLinked:false,_lastMove:null,_lastAnimNum:null,_seqAnim:null,_seqAnimEvent:null,_seqModelAnimNum:0,_phaseCaches:new Map(),_pathDistanceCaches:new Map(),_track9Prefix:[0]};
        actors.push(a);owners.set(curve,inst);
      }
      const aux={controller:ctrl,sequenceId,startFrame:triggerFrame,endFrame:Math.max(1,Math.ceil(maxFrame)),actors,controlCurves,curveOwners:owners,allCurves:[...controlCurves,...actors.map(a=>a.curve)].filter(Boolean),eventCursor:-1,done:false,reason};
      if(generation!==this.sideGeneration){this.cleanupAuxSequence(aux);return null;}this.auxSequences.push(aux);return aux;
    }

    queueAuxSequence(ctrl,reason,triggerFrame=this.frame){
      if(!ctrl||ctrl.active||ctrl.sequenceLocal<0)return;const sequenceId=this.objectSequenceIdAt(ctrl.source,ctrl.sequenceLocal);if(sequenceId<0)return;
      ctrl.active=true;const gen=this.sideGeneration;
      this.startAuxSequence(ctrl,triggerFrame,reason).then(aux=>{if(gen!==this.sideGeneration)return;if(!aux)ctrl.active=false;}).catch(e=>{if(gen===this.sideGeneration)ctrl.active=false;console.warn('[Map Sequences] chained sequence failed',e);});
    }

    updateSideControllers(){
      for(const c of this.sideControllers||[]){
        if(c.kind===274){
          if(this.validSideGameBit(c.openBit)&&this.getSideGameBit(c.openBit)){c.open=true;}
          if(c.open){if((c.flags&0x01)&&this.sideTouchedBits.has(c.openBit)&&!this.getSideGameBit(c.openBit))c.open=false;continue;}
          if(!this.validSideGameBit(c.triggerBit)||!this.sideTouchedBits.has(c.triggerBit))continue;
          const v=this.getSideGameBit(c.triggerBit);if(v!==c.triggerState){c.triggerState=v;if(v)this.queueAuxSequence(c,'trigger GameBit');}
        }else if(c.kind===275){
          const relevant=(this.validSideGameBit(c.requiredBit)&&this.sideTouchedBits.has(c.requiredBit))||(this.validSideGameBit(c.usedBit)&&this.sideTouchedBits.has(c.usedBit));
          if(!relevant||c.active)continue;const needOk=c.requiredBit===-1||this.getSideGameBit(c.requiredBit)!==0,usedOk=c.usedBit===-1||this.getSideGameBit(c.usedBit)===0;
          if(needOk&&usedOk){if(c.flags&0x04)this.setSideGameBit(c.requiredBit,0);if(c.flags&0x20)this.setSideGameBit(c.usedBit,1);c.ranOnce=true;this.queueAuxSequence(c,'required/used GameBit');}
        }else if(c.kind===272){
          if(c.active||c.started||c.sequenceLocal<0)continue;
          const relevant=[c.closeRequestBit,c.closedLatchBit,c.closeReadyBit].some(b=>this.validSideGameBit(b)&&this.sideTouchedBits.has(b));
          if(relevant){c.started=true;this.queueAuxSequence(c,'door GameBit');}
        }
      }
      this.sideTouchedBits.clear();
    }

    finishAuxSequence(aux){
      if(!aux||aux.done)return;aux.done=true;const c=aux.controller;if(!c)return;c.active=false;c.done=true;
      if(c.kind===274){
        if(c.flags&0x01){if(!(c.flags&0x04))this.setSideGameBit(c.triggerBit,0);}else{if(c.flags&0x08)this.setSideGameBit(c.openBit,1);c.open=true;}
      }else if(c.kind===275){if(c.flags&0x02)this.setSideGameBit(c.requiredBit,0);if(c.flags&0x10)this.setSideGameBit(c.usedBit,1);}
    }

    processSideRuntime(){
      if(!this.current)return;
      if(this.frame<this.sideEventCursor)this.resetSideRuntime();
      const owners=this.current.curveOwners||new Map();this.processCurveSideEvents(this.current.allCurves,owners,this.sideEventCursor,this.frame);this.sideEventCursor=this.frame;
      this.updateSideControllers();
      for(const aux of this.auxSequences||[]){
        const local=Math.max(0,this.frame-aux.startFrame),to=Math.min(local,aux.endFrame);this.processCurveSideEvents(aux.allCurves,aux.curveOwners,aux.eventCursor,to);aux.eventCursor=to;
        this.updateSideControllers();if(local>=aux.endFrame)this.finishAuxSequence(aux);
      }
      this.updateSideControllers();
    }

    releaseGameText(){try{const gt=window.__pfpSfaGameText;if(gt&&gt.releaseExternalSequence)gt.releaseExternalSequence();}catch(_){}this.gameTextBound=false;this.sequenceTextBound=false;this.softwareSubtitleActive=false;this.lastSoftwareSubtitleKey='';this.activeVoiceStreamId=null;this.lastSoftwareStreamKey='';}
    gameTextDirs(entry=this.current){const out=[],add=(d)=>{d=String(d||'').trim();if(d&&!out.includes(d))out.push(d);};if(entry)add(entry.dir);for(const d of(this.dirs||[]))add(d);return out;}
    async bindGameText(entry){
      this.releaseGameText();const gt=window.__pfpSfaGameText;if(!gt||!entry)return {textBound:false,voiceBound:false};
      const sequenceId=Number(entry.sequenceId),textDirs=this.gameTextDirs(entry);
      try{
        let r=null;
        if(gt.bindExternalSequenceDirect){
          const baseVoiceId=sequenceId&0x3FFF;
          r=await gt.bindExternalSequenceDirect(sequenceId,{pathBase:this.pathBase,language:'English',textId:sequenceId,textMode:'voice',textVoiceId:baseVoiceId,textDirs,voiceId:baseVoiceId,voice:true,voiceFromText:false});
          this.sequenceTextBound=!!(r&&r.textBound);this.gameTextBound=!!(r&&(r.textBound||r.voiceBound));
          this.activeVoiceStreamId=r&&r.voiceBound?baseVoiceId:null;
          if(this.current){this.current.baseVoiceStreamId=baseVoiceId;this.current.gameTextDir=r&&r.textDir||null;this.current.gameTextDirs=textDirs;}
        }else this.gameTextBound=false;
        this.syncGameText(true);return {textBound:this.sequenceTextBound,voiceBound:!!(r&&r.voiceBound),textDir:r&&r.textDir||null,voiceId:r&&r.voiceId};
      }catch(e){console.warn('[Map Sequences] GameText bind',e);return {textBound:false,voiceBound:false};}
    }
    syncGameText(force=false){try{const gt=window.__pfpSfaGameText;if(gt&&gt.setExternalSequenceTransport&&this.current)gt.setExternalSequenceTransport(this.frame/FPS,this.playing,force);}catch(_){} }
    syncStoryboardText(){
      if(!this.current||this.sequenceTextBound||this.softwareSubtitleActive)return;let latest=null;
      for(const c of this.current.allCurves)for(const e of c.events){
        if(e.opcode===0x0E&&e.time<=this.frame&&(!latest||e.time>latest.time||(e.time===latest.time&&e.index>latest.index)))latest=e;
      }
      const key=latest?`${latest.time}:${latest.paramU}`:'';if(key===this.current._storyboardKey)return;this.current._storyboardKey=key;
      try{const gt=window.__pfpSfaGameText;if(!gt)return;if(latest&&gt.setExternalTextId)gt.setExternalTextId(latest.paramU,latest.time/FPS,'English',{textDirs:this.gameTextDirs(this.current)});else if(gt.clearExternalText)gt.clearExternalText();}catch(_){}
    }
    resetSequenceVoice(){try{if(!this.current)return;const gt=window.__pfpSfaGameText;if(gt&&gt.setExternalVoiceStream){const id=Number.isFinite(Number(this.current.baseVoiceStreamId))?Number(this.current.baseVoiceStreamId):(this.current.sequenceId&0x3FFF);gt.setExternalVoiceStream(id,0);this.activeVoiceStreamId=id;this.lastSoftwareStreamKey='';}}catch(_){} }
    syncVoiceLifetime(){
      try{
        if(!this.current||!this.current.voiceExpected)return;
        const gt=window.__pfpSfaGameText,a=gt&&gt.state&&gt.state.voiceAudio;if(!a)return;
        const historical=this.current.sequenceSet==='Late 2001'||this.current.sequenceSet==='Mid-Late 2001';
        const start=Math.max(0,Number(gt.state.voiceStartSeconds)||0),dur=Number(a.duration);
        if(Number.isFinite(dur)&&dur>0){
          if(!historical){
            const voiceEnd=Math.ceil((start+dur+.20)*FPS);
            if(voiceEnd>this.endFrame){this.endFrame=voiceEnd;if(this.ui&&this.ui.seek)this.ui.seek.max=String(this.endFrame);}
          }
          this.current.voiceDurationKnown=true;
        }else if(!historical&&gt.state.voicePath&&!this.current.voiceDurationKnown&&performance.now()<(this.current.voiceMetadataGraceUntil||0)){
          const hold=Math.ceil(this.frame+FPS*.35);if(hold>this.endFrame){this.endFrame=hold;if(this.ui&&this.ui.seek)this.ui.seek.max=String(this.endFrame);}
        }
      }catch(_){}
    }

    saveCamera(){
      const cam=this.viewerInput&&this.viewerInput.camera;if(!cam||this.savedCamera)return;
      this.savedCamera={
        world:new Float32Array(cam.worldMatrix),view:new Float32Array(cam.viewMatrix),
        projection:cam.projectionMatrix?new Float32Array(cam.projectionMatrix):null,
        fovY:Number(cam.fovY),isOrthographic:!!cam.isOrthographic
      };
    }
    restoreCamera(){
      const cam=this.viewerInput&&this.viewerInput.camera,s=this.savedCamera;if(!cam||!s)return;
      try{
        cam.worldMatrix.set(s.world);cam.viewMatrix.set(s.view);
        if(s.projection&&cam.projectionMatrix)cam.projectionMatrix.set(s.projection);
        cam.isOrthographic=s.isOrthographic;if(Number.isFinite(s.fovY))cam.fovY=s.fovY;
        if(typeof cam.worldMatrixUpdated==='function')cam.worldMatrixUpdated();
      }catch(_){}
      this.savedCamera=null;
    }

    audioApiUrl(name,params={}){
      const q=new URLSearchParams();for(const [k,v] of Object.entries(params))q.set(k,String(v));
      return `${API_ROOT}api/sfa-audio/${name}${q.toString()?`?${q.toString()}`:''}`;
    }
    dataAudioUrl(relPath){
      const parts=[String(this.pathBase||''),...String(relPath||'').replace(/\\/g,'/').split('/').filter(Boolean)].map(encodeURIComponent);
      return `${API_ROOT}${parts.join('/')}`;
    }
    stopPresentationAudio(){
      this.presentationGeneration++;
      for(const a of this.sequenceSfxAudio||[]){try{a.pause();a.src='';}catch(_){}}
      this.sequenceSfxAudio.clear();this.sequenceSfxByOwner.clear();
      if(this.sequenceMusicAudio){try{this.sequenceMusicAudio.pause();this.sequenceMusicAudio.src='';}catch(_){}this.sequenceMusicAudio=null;}
      if(this.sequenceMusicObjectUrl){try{URL.revokeObjectURL(this.sequenceMusicObjectUrl);}catch(_){}this.sequenceMusicObjectUrl='';}
      for(const u of this.preparedMusicObjectUrls||[]){try{URL.revokeObjectURL(u);}catch(_){}}this.preparedMusicObjectUrls.clear();
      this.preparedMusic.clear();
    }
    capturePresentationEffectState(){
      if(this.presentationEffectSnapshot)return;
      const r=this.renderer,m=r&&r.envfxMan,fx=r&&r.sfaFramebufferFX;
      this.presentationEffectSnapshot={
        framebufferMode:Number(r&&r.sfaFramebufferMode)||0,framebufferAlpha:fx&&Number.isFinite(Number(fx.alpha))?Number(fx.alpha):0.5,
        atmosphereTextures:m&&m.atmosphere&&Array.isArray(m.atmosphere.textures)?m.atmosphere.textures.slice():null,
        ambientColors:m&&m.atmosphere&&Array.isArray(m.atmosphere.outdoorAmbientColors)?m.atmosphere.outdoorAmbientColors.slice():null,
        skyscapeObjects:m&&m.skyscape&&Array.isArray(m.skyscape.objects)?m.skyscape.objects.slice():null,
        hasLoadedAtmosphereEnvfx:m?!!m.hasLoadedAtmosphereEnvfx:false
      };
    }
    restorePresentationEffectState(){
      const snap=this.presentationEffectSnapshot,r=this.renderer,m=r&&r.envfxMan;
      if(snap){
        try{
          if(m&&m.atmosphere){if(snap.atmosphereTextures)m.atmosphere.textures=snap.atmosphereTextures.slice();if(snap.ambientColors)m.atmosphere.outdoorAmbientColors=snap.ambientColors.slice();m.hasLoadedAtmosphereEnvfx=!!snap.hasLoadedAtmosphereEnvfx;}
          if(m&&m.skyscape&&snap.skyscapeObjects)m.skyscape.objects=snap.skyscapeObjects.slice();
          if(r&&typeof r.rebuildSky==='function'&&r.currentTexFetcher&&r.currentGameInfo)r.rebuildSky(r.currentTexFetcher,r.currentGameInfo);
        }catch(e){console.warn('[Map Sequences] could not restore sequence ENVFX',e);}
        try{
          if(r){r.sfaFramebufferMode=snap.framebufferMode|0;const C=window.__PFPFramebufferFXClass;if(!r.sfaFramebufferFX&&C&&snap.framebufferMode)r.sfaFramebufferFX=new C();if(r.sfaFramebufferFX){r.sfaFramebufferFX.setAlpha(snap.framebufferAlpha);r.sfaFramebufferFX.setMode(snap.framebufferMode|0);}}
        }catch(e){console.warn('[Map Sequences] could not restore framebuffer effect',e);}
      }
      for(const [o,slot] of this.presentationModelDefaults||[]){try{setSequenceModelSlot(o,slot);}catch(_){}}
      this.restoreSequenceObjectGroups();
      this.presentationEffectSnapshot=null;this.presentationEnvfxKey='';this.presentationWeatherKey='';this.presentationFramebufferKey='';this.presentationModelDefaults.clear();this.presentationModelKeys.clear();this.presentationCameraShake=null;this.presentationTimer={running:false,countUp:false,value:0,type:0};
    }
    resetPresentationRuntime(frame=0,silentSeek=false){
      this.stopPresentationAudio();this.restorePresentationEffectState();this.presentationEventCursor=silentSeek?Math.max(0,Number(frame)||0):-1;
      if(this.ui&&this.ui.fadeOverlay){this.ui.fadeOverlay.style.opacity='0';this.ui.fadeOverlay.style.display='none';}
    }
    buildPresentationCatalog(){
      this.presentationEvents=[];this.decisionPoints=[];this.decisionConsumed.clear();this.pendingDecision=null;
      if(!this.current)return;
      const owners=this.current.curveOwners||new Map(), decisions=new Map();
      for(const c of this.current.allCurves||[]){
        if(!c)continue;const owner=owners.get(c)||null;
        for(const e of c.events||[]){
          if(e.opcode===0x06||e.opcode===0x0F||e.opcode===0x0D||e.opcode===0x100||e.opcode===0x05)this.presentationEvents.push({e,curve:c,owner});
        }
      }
      this.presentationEvents.sort((a,b)=>(a.e.time-b.e.time)||(a.e.index-b.e.index));
      this.decisionPoints=[];
      this.syncDecisionUI();
      const musicIds=new Set();for(const x of this.presentationEvents){const e=x.e;if(e.opcode===0x0D&&((e.paramU>>>12)&0xF)===0){const id=(e.paramU&0xFFF)+1;if(id===0xD9||id===0x92)musicIds.add(id);}}
      for(const id of musicIds)this.prepareSequenceMusicTrigger(id).catch(()=>{});
    }
    resetDecisionRuntime(frame=0){
      this.pendingDecision=null;this.queuedDecisionEvent=null;this.decisionConsumed.clear();const f=Math.max(0,Number(frame)||0);
      for(const d of this.decisionPoints||[])if(d.time<f-1e-5)this.decisionConsumed.add(d.key);
      this.syncDecisionUI();
    }
    nextDecisionBetween(fromFrame,toFrame){ return null; }
    syncDecisionUI(){
      if(!this.ui||!this.ui.decisionRow)return;const d=null;this.pendingDecision=null;
      this.ui.decisionRow.style.display='none';
      if(this.ui.decisionExtras)while(this.ui.decisionExtras.firstChild)this.ui.decisionExtras.firstChild.remove();
      this.decisionExtraButtons=[];
      if(!d)return;
      const a=d.options[0x12],b=d.options[0x13];this.ui.decisionA.style.display=a?'inline-block':'none';this.ui.decisionB.style.display=b?'inline-block':'none';
      const labels={0x14:'Event 14',0x15:'Event 15',0x16:'Event 16',0x17:'Event 17',0x18:'Event 18',0x19:'Event 19',0x1A:'Dialogue End'};
      for(const key of Object.keys(d.options||{}).map(Number).sort((x,y)=>x-y)){
        if(key===0x12||key===0x13)continue;
        const btn=document.createElement('button');btn.type='button';btn.textContent=labels[key]||`Event ${hex(key,2)}`;
        btn.title=key===0x1A?'Sequence event 0x1A: continue when dialogue ends':`Take sequence branch for event 0x${hex(key,2)}`;
        css(btn,{minWidth:'58px',background:'#242a31',color:'#eee',border:'1px solid #777',padding:'3px 8px',cursor:'pointer'});
        btn.addEventListener('click',()=>this.chooseDecision(key));if(this.ui.decisionExtras)this.ui.decisionExtras.appendChild(btn);this.decisionExtraButtons.push(btn);
      }
      this.ui.decisionText.textContent=`Sequence decision at frame ${Math.round(d.time)}:`;
    }
    dialogueDecisionReady(){
      try{const gt=window.__pfpSfaGameText,a=gt&&gt.state&&gt.state.voiceAudio;if(a&&Number.isFinite(Number(a.duration))&&Number(a.duration)>0)return !!a.ended;}catch(_){}
      return false;
    }
    tryAutoDecision(){
      const d=this.pendingDecision;if(!d)return false;
      const q=Number(this.queuedDecisionEvent);if(Number.isFinite(q)&&d.options&&d.options[q]){this.queuedDecisionEvent=null;this.chooseDecision(q);return true;}
      if(d.options&&d.options[0x1A]&&this.dialogueDecisionReady()){this.chooseDecision(0x1A);return true;}
      return false;
    }
    signalDecisionEvent(eventId){ return false; }
    chooseDecision(eventCode){ return false; }
    dispatchRetailMessage(index,owner,event){
      const ids=[0x00050001,0x00050002,0x00050003,0x00060001,0x00060002,0x000A0001,0x000A0002,0x000A0003,0x00000008,0x00000009,0x00030002,0x00030003,0x000A0004,0x000A0005,0x000A0006,0x000F000B,0x000F000C,0x000F000D,0x000F000E,0x000F000F,0x000F0010,0x00130001,0x00130002];
      const modes=[0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,1,1,1,1,1,1,0,0];
      index=Number(index)|0;if(index<0||index>=ids.length)return;const messageId=ids[index]>>>0,mode=modes[index]||0,all=(this.world&&Array.isArray(this.world.objectInstances))?this.world.objectInstances:[];
      let targets=[];if(mode===1)targets=all.slice();else if(mode===2&&owner){const p=renderedWorldPose(owner).position;targets=all.filter(x=>{try{const q=renderedWorldPose(x).position;return Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])<600;}catch(_){return false;}});}else if(owner)targets=[owner];
      const detail={index,messageId,mode,owner,targets,sequenceId:this.current&&this.current.sequenceId,frame:this.frame,param:event&&event.conditionParamU};
      for(const t of targets){for(const name of ['onSequenceMessage','onObjectMessage','handleObjectMessage','receiveObjectMessage']){try{if(t&&typeof t[name]==='function'){t[name](messageId,owner,detail);break;}}catch(_){}}}
      try{window.dispatchEvent(new CustomEvent('pfp-sfa-sequence-message',{detail}));}catch(_){}
    }
    async playSequenceSfx(triggerId,owner,timed=false){
      triggerId=Number(triggerId)&0x0FFF;if(!triggerId)return;const generation=this.presentationGeneration;
      const ownerKey=owner||'__global__';if(timed){const old=this.sequenceSfxByOwner.get(ownerKey);if(old){try{old.pause();old.src='';}catch(_){}this.sequenceSfxAudio.delete(old);this.sequenceSfxByOwner.delete(ownerKey);}}
      try{
        const r=await fetch(this.audioApiUrl('sequence-sfx',{pathBase:this.pathBase,trigger:triggerId}),{cache:'no-store'});const j=await r.json();if(generation!==this.presentationGeneration||!this.current||!j.ok)return;
        const a=new Audio(this.audioApiUrl('sample-wav',{pathBase:this.pathBase,bank:j.bankId,sample:j.sampleId,t:Date.now()}));
        const master=window.__pfpSfaAudioState&&window.__pfpSfaAudioState.audio?Number(window.__pfpSfaAudioState.audio.volume):0.7;
        a.volume=clamp((Number.isFinite(master)?master:0.7)*clamp((Number(j.volume)||127)/127,0,1),0,1);a.preload='auto';
        this.sequenceSfxAudio.add(a);this.sequenceSfxByOwner.set(ownerKey,a);a.addEventListener('ended',()=>{this.sequenceSfxAudio.delete(a);if(this.sequenceSfxByOwner.get(ownerKey)===a)this.sequenceSfxByOwner.delete(ownerKey);},{once:true});
        a.play().catch(()=>{this.sequenceSfxAudio.delete(a);});
      }catch(e){console.warn('[Map Sequences] sequence SFX trigger failed',triggerId,e);}
    }
    async ensureSfaAudioIndex(){
      if(this.audioIndexPromise)return this.audioIndexPromise;
      this.audioIndexPromise=fetch(this.audioApiUrl('index',{pathBase:this.pathBase}),{cache:'no-store'}).then(r=>r.json()).catch(e=>({ok:false,entries:[],message:String(e)}));return this.audioIndexPromise;
    }
    async prepareSequenceMusicTrigger(triggerId){
      triggerId=Number(triggerId)|0;if(this.preparedMusic.has(triggerId))return this.preparedMusic.get(triggerId);const generation=this.presentationGeneration;
      const promise=(async()=>{const idx=await this.ensureSfaAudioIndex();if(!idx||!idx.ok||generation!==this.presentationGeneration)return null;const e=(idx.entries||[]).find(x=>x&&x.source==='trigger'&&Number(x.triggerId)===triggerId&&x.playable!==false);if(!e)return null;
        const r=await fetch(this.audioApiUrl('render-one',{pathBase:this.pathBase,id:e.id}),{method:'POST'});const j=await r.json();if(!j.ok||!j.path)return null;
        const src=this.dataAudioUrl(j.path);if(!j.transient)return generation===this.presentationGeneration?{src,objectUrl:'',path:j.path,transient:false}:null;
        let fr=null;for(let n=0;n<5;n++){if(generation!==this.presentationGeneration)return null;try{fr=await fetch(src,{cache:'no-store'});}catch(_){fr=null;}if(fr&&fr.ok)break;await new Promise(res=>setTimeout(res,100*(n+1)));}if(!fr||!fr.ok)return null;
        const blob=await fr.blob(),objectUrl=URL.createObjectURL(blob);fetch(this.audioApiUrl('delete-rendered',{pathBase:this.pathBase,path:j.path}),{method:'POST'}).catch(()=>{});if(generation!==this.presentationGeneration){try{URL.revokeObjectURL(objectUrl);}catch(_){}return null;}this.preparedMusicObjectUrls.add(objectUrl);return {src:objectUrl,objectUrl,path:j.path,transient:true};})();
      this.preparedMusic.set(triggerId,promise);return promise;
    }
    async playSequenceMusicTrigger(triggerId){
      triggerId=Number(triggerId)|0;if(triggerId!==0xD9&&triggerId!==0x92)return;
      const generation=this.presentationGeneration;try{const prepared=await this.prepareSequenceMusicTrigger(triggerId);if(!prepared||generation!==this.presentationGeneration||!this.current)return;
        if(this.sequenceMusicAudio){try{this.sequenceMusicAudio.pause();}catch(_){}this.sequenceMusicAudio=null;}if(this.sequenceMusicObjectUrl&&this.sequenceMusicObjectUrl!==prepared.objectUrl){try{URL.revokeObjectURL(this.sequenceMusicObjectUrl);}catch(_){}}
        this.sequenceMusicObjectUrl=prepared.objectUrl||'';const a=new Audio(prepared.src);const master=window.__pfpSfaAudioState&&window.__pfpSfaAudioState.audio?Number(window.__pfpSfaAudioState.audio.volume):0.7;a.volume=Number.isFinite(master)?master:0.7;a.loop=false;this.sequenceMusicAudio=a;a.play().catch(()=>{});
      }catch(e){console.warn('[Map Sequences] sequence music cue failed',triggerId,e);}
    }
    placementObjectGroup(inst){
      try{const p=inst&&inst.objParams;if(!p||p.byteLength<7)return -1;if((p.getUint8(4)&0x10)===0)return -1;return p.getUint8(6)&0xFF;}catch(_){return -1;}
    }
    wrapSequenceGroupObject(inst){
      if(!inst||this.presentationGroupObjectRestore.has(inst)||typeof inst.isInLayer!=='function')return;
      const hadOwn=Object.prototype.hasOwnProperty.call(inst,'isInLayer'),original=inst.isInLayer;
      this.presentationGroupObjectRestore.set(inst,{hadOwn,original});
      inst.isInLayer=function(layer){if(this._pfpSequenceGroupHidden)return false;return original.call(this,layer);};
    }
    setSequenceObjectGroup(group,visible){
      group=Number(group)&0xFF;visible=!!visible;this.presentationObjectGroups.set(group,visible);
      for(const inst of (this.world&&Array.isArray(this.world.objectInstances)?this.world.objectInstances:[])){
        if(!inst||inst._pfpMapSequenceTemp||this.placementObjectGroup(inst)!==group)continue;
        this.wrapSequenceGroupObject(inst);inst._pfpSequenceGroupHidden=!visible;
      }
      this.dispatchSequenceEffect('pfp-sfa-sequence-object-group',{group,visible});
    }
    restoreSequenceObjectGroups(){
      for(const [inst,r] of this.presentationGroupObjectRestore||[]){if(!inst)continue;try{delete inst._pfpSequenceGroupHidden;if(r.hadOwn)inst.isInLayer=r.original;else delete inst.isInLayer;}catch(_){}}
      if(this.presentationGroupObjectRestore)this.presentationGroupObjectRestore.clear();if(this.presentationObjectGroups)this.presentationObjectGroups.clear();
    }
    syncSequenceObjectGroups(groupLatest){
      const wanted=new Map();for(const [g,ev] of groupLatest||[])wanted.set(Number(g)&0xFF,!!ev.visible);
      const all=new Set([...(this.presentationObjectGroups?this.presentationObjectGroups.keys():[]),...wanted.keys()]);
      for(const g of all){const vis=wanted.has(g)?wanted.get(g):true;if(!this.presentationObjectGroups.has(g)||this.presentationObjectGroups.get(g)!==vis)this.setSequenceObjectGroup(g,vis);}
    }

    softwareEventInfo(e){
      if(!e)return null;if(e.opcode===0x100)return {cmd:e.software|0,arg:e.softwareArg|0};if(e.opcode===0x05)return {cmd:e.paramU&0xFF,arg:(e.paramU>>>8)&0xFF};return null;
    }
    dispatchSequenceEffect(type,detail={}){try{window.dispatchEvent(new CustomEvent(type,{detail:{...detail,sequenceId:this.current&&this.current.sequenceId,frame:this.frame}}));}catch(_){}}
    applySequenceEnvfx(id,owner,kind='envfx'){
      id=Number(id)|0;const key=`${kind}:${id}`;if(key===this.presentationEnvfxKey&&kind==='envfx')return;
      this.capturePresentationEffectState();let handled=false;
      try{const r=this.renderer,m=r&&r.envfxMan;if(m&&typeof m.loadEnvfx==='function'){const ret=m.loadEnvfx(id);handled=ret!==undefined;if(r&&typeof r.rebuildSky==='function'&&r.currentTexFetcher&&r.currentGameInfo)r.rebuildSky(r.currentTexFetcher,r.currentGameInfo);}}catch(e){console.warn('[Map Sequences] ENVFX command failed',id,e);}
      if(kind==='envfx')this.presentationEnvfxKey=key;
      this.dispatchSequenceEffect('pfp-sfa-sequence-envfx',{id,owner,kind,handled});
    }
    dispatchSequenceParticle(id,owner){
      id=Number(id)|0;let handled=false;
      try{const r=this.renderer;if(r&&typeof r.spawnSequenceParticle==='function'){r.spawnSequenceParticle(owner,id);handled=true;}}catch(e){console.warn('[Map Sequences] particle hook failed',id,e);}
      this.dispatchSequenceEffect('pfp-sfa-sequence-particle',{id,owner,handled});
      if(!handled&&!this.presentationParticleNotice){this.presentationParticleNotice=true;console.info('[Map Sequences] PartFX is not available in this build.');}
    }
    startSequenceCameraShake(owner,arg,eventTime){
      let strength=2*((Number(arg)|0)-7)+1;if(strength<=0)return;
      try{const op=renderedWorldPose(owner).position,pl=findActivePlayer(this.world,op,new Set(),false),pp=pl?renderedWorldPose(pl).position:(this.current&&this.current.sourcePos)||op;const d=Math.hypot((pp[0]||0)-(op[0]||0),(pp[2]||0)-(op[2]||0));if(d>=200)return;if(d>50)strength*=1-(d-50)/150;}catch(_){}
      const a=.2*strength;this.presentationCameraShake={startFrame:Number(eventTime)||this.frame,amplitude:a,frequency:a,damping:.2};
    }
    applySequenceCameraShake(viewerInput){
      const sh=this.presentationCameraShake;if(!sh||!viewerInput||!viewerInput.camera||!this.sequenceCamera||!this.cameraActor)return;
      const t=Math.max(0,(this.frame-sh.startFrame)/FPS),off=sh.amplitude*Math.exp(-sh.damping*t)*Math.cos(2*Math.PI*sh.frequency*t);if(Math.abs(off)<.1&&t>0){this.presentationCameraShake=null;return;}
      try{const cam=viewerInput.camera;cam.worldMatrix[13]+=off;if(cam.viewMatrix&&window.glMatrix&&window.glMatrix.mat4)window.glMatrix.mat4.invert(cam.viewMatrix,cam.worldMatrix);else if(typeof cam.worldMatrixUpdated==='function')cam.worldMatrixUpdated();if(typeof cam.worldMatrixUpdated==='function')cam.worldMatrixUpdated();}catch(_){ }
    }
    stopOwnerSequenceSfx(owner){const key=owner||'__global__',a=this.sequenceSfxByOwner.get(key);if(a){try{a.pause();a.src='';}catch(_){}this.sequenceSfxAudio.delete(a);this.sequenceSfxByOwner.delete(key);}}
    processSoftwareEdge(cmd,arg,x){
      switch(cmd|0){
        case 7:/* disabled: sequence camera shake/earthquake was visually unpleasant in the viewer */break;
        case 10:this.presentationTimer={running:true,countUp:false,value:arg|0,type:0x12};break;
        case 11:this.presentationTimer={running:true,countUp:false,value:arg|0,type:0x11};break;
        case 12:this.presentationTimer.countUp=true;break;
        case 13:this.stopOwnerSequenceSfx(x.owner);break;
        case 24:case 25:
          this.dispatchSequenceEffect('pfp-sfa-sequence-staff',{cmd:cmd|0,arg:arg|0,owner:x.owner});break;
        case 27:this.setSequenceObjectGroup(arg,true);break;
        case 28:this.setSequenceObjectGroup(arg,false);break;
        case 29:case 31:case 32:case 35:case 36:case 38:case 39:
          this.dispatchSequenceEffect('pfp-sfa-sequence-software',{cmd:cmd|0,arg:arg|0,owner:x.owner});break;
        case 33:case 34:break;
        case 37:this.presentationTimer.running=false;break;
        case 48:for(const id of [0x134,0x135,0x142])this.applySequenceEnvfx(id,x.owner,'weather-a');break;
        case 49:for(const id of [0x136,0x137,0x143])this.applySequenceEnvfx(id,x.owner,'weather-b');break;
        case 50:for(const id of [0x134,0x135,0x142])this.applySequenceEnvfx(id,x.owner,'weather-clear');break;
      }
    }
    syncPersistentSoftwareEffects(){
      if(!this.current)return;this.capturePresentationEffectState();
      let fb=null,env=null,weather=null;const modelLatest=new Map(),groupLatest=new Map(),groupFirst=new Map();
      for(const x of this.presentationEvents||[]){const e=x.e,sw=this.softwareEventInfo(e);if(!sw||(sw.cmd!==27&&sw.cmd!==28))continue;const g=sw.arg&0xFF;if(!groupFirst.has(g))groupFirst.set(g,{visible:sw.cmd===27,time:Number(e.time)||0,index:e.index});}
      for(const x of this.presentationEvents||[]){const e=x.e,t=Number(e.time)||0;if(t>this.frame+1e-6)break;
        if(e.opcode===0x0D&&((e.paramU>>>12)&0xF)===2)env={id:e.paramU&0x0FFF,owner:x.owner,time:t,index:e.index};
        const sw=this.softwareEventInfo(e);if(!sw)continue;
        if(sw.cmd===46||sw.cmd===47)fb={...sw,time:t,index:e.index};
        if(sw.cmd===23&&x.owner&&!isPlayerCastDef(romDefNo(x.owner)))modelLatest.set(x.owner,{...sw,time:t,index:e.index});
        if(sw.cmd===27||sw.cmd===28)groupLatest.set(sw.arg&0xFF,{visible:sw.cmd===27,time:t,index:e.index});
        if(sw.cmd===48||sw.cmd===49||sw.cmd===50)weather={...sw,owner:x.owner,time:t,index:e.index};
      }
      for(const [g,first] of groupFirst){if(!groupLatest.has(g))groupLatest.set(g,{visible:first.visible?false:true,time:-1,index:-1,initial:true});}
      if(env)this.applySequenceEnvfx(env.id,env.owner);
      this.syncSequenceObjectGroups(groupLatest);
      if(weather){const key=`weather:${weather.cmd}:${weather.time}`;if(this.presentationWeatherKey!==key){this.presentationWeatherKey=key;const ids=weather.cmd===49?[0x136,0x137,0x143]:[0x134,0x135,0x142];for(const id of ids)this.applySequenceEnvfx(id,weather.owner,weather.cmd===50?'weather-clear':(weather.cmd===49?'weather-b':'weather-a'));}}
      const snap=this.presentationEffectSnapshot,r=this.renderer;
      let mode=snap?snap.framebufferMode:0,alpha=snap?snap.framebufferAlpha:.5,key='base';
      if(fb){key=`${fb.cmd}:${fb.arg}:${fb.time}`;if(fb.cmd===46)mode=2;else if(fb.cmd===47)mode=0;}
      if(key!==this.presentationFramebufferKey){this.presentationFramebufferKey=key;try{if(r){r.sfaFramebufferMode=mode|0;const C=window.__PFPFramebufferFXClass;if(!r.sfaFramebufferFX&&C&&(mode||this.presentationEffectSnapshot&&this.presentationEffectSnapshot.framebufferMode))r.sfaFramebufferFX=new C();if(r.sfaFramebufferFX){r.sfaFramebufferFX.setAlpha(alpha);r.sfaFramebufferFX.setMode(mode|0);}}}catch(e){console.warn('[Map Sequences] framebuffer SOFTWARE effect failed',e);}}
      const touched=new Set([...this.presentationModelDefaults.keys(),...modelLatest.keys()]);
      for(const o of touched){if(!o||typeof o.setModelNum!=='function')continue;if(!this.presentationModelDefaults.has(o))this.presentationModelDefaults.set(o,Number.isFinite(Number(o._pfpModelSlot))?Number(o._pfpModelSlot):0);const ev=modelLatest.get(o),slot=ev?(ev.arg|0):this.presentationModelDefaults.get(o),mkey=ev?`${slot}:${ev.time}`:`base:${slot}`;if(this.presentationModelKeys.get(o)===mkey)continue;try{const nums=o.objType&&o.objType.modelNums;if(Array.isArray(nums)&&slot>=0&&slot<nums.length)setSequenceModelSlot(o,slot);this.presentationModelKeys.set(o,mkey);}catch(_){}}
    }
    processPresentationEvent(x){
      const e=x&&x.e;if(!e)return;
      if(e.opcode===0x06){this.playSequenceSfx(e.paramU&0x0FFF,x.owner,false);return;}
      if(e.opcode===0x0F){this.playSequenceSfx(e.paramU&0x0FFF,x.owner,true);return;}
      if(e.opcode===0x0D){const sub=(e.paramU>>>12)&0xF,arg=e.paramU&0x0FFF;if(sub===0){const id=arg+1;if(id===0xD9||id===0x92)this.playSequenceMusicTrigger(id);}else if(sub===2)this.applySequenceEnvfx(arg,x.owner);else if(sub===3)this.dispatchSequenceParticle(arg,x.owner);return;}
      const sw=this.softwareEventInfo(e);if(sw)this.processSoftwareEdge(sw.cmd,sw.arg,x);
    }
    processPresentationRuntime(){
      if(!this.current)return;if(this.frame<this.presentationEventCursor)this.presentationEventCursor=this.frame;
      for(const x of this.presentationEvents||[]){const t=Number(x.e.time)||0;if(t>this.presentationEventCursor&&t<=this.frame+1e-6)this.processPresentationEvent(x);}
      this.presentationEventCursor=this.frame;
    }
    screenFadeOpacityAt(frame){
      frame=Math.max(0,Number(frame)||0);let alpha=0,trans=null;
      const valueAt=(f)=>{if(!trans)return alpha;const q=clamp((f-trans.start)/Math.max(1e-6,trans.duration),0,1);return trans.from+(trans.to-trans.from)*q;};
      for(const x of this.presentationEvents||[]){const e=x.e,t=Number(e.time)||0;if(t>frame)break;let kind='',dur=0,fromOverride=null;
        if(e.opcode===0x0D&&((e.paramU>>>12)&0xF)===9){const arg=e.paramU&0x0FFF,code=arg&0x2F;if(code===6||code===7){kind=code===6?'out':'in';dur=3;}else if(code===8||code===9){kind=code===8?'out':'in';dur=2;}else if(code===0xB||code===0xC){kind=code===0xB?'out':'in';dur=4;if(code===0xC)fromOverride=.2;}}
        else {let sw=-1,arg=0;if(e.opcode===0x100){sw=e.software|0;arg=e.softwareArg|0;}else if(e.opcode===0x05){sw=e.paramU&0xFF;arg=(e.paramU>>>8)&0xFF;}if(sw===14){kind='out';dur=Math.max(1,arg);}else if(sw===15){kind='in';dur=Math.max(1,arg);}}
        if(!kind)continue;alpha=valueAt(t);if(fromOverride!==null)alpha=fromOverride;trans={start:t,duration:dur,from:alpha,to:kind==='out'?1:0};
      }
      if(trans)alpha=valueAt(frame);return clamp(alpha,0,1);
    }
    syncScreenFade(){if(!this.ui||!this.ui.fadeOverlay)return;const a=this.current?this.screenFadeOpacityAt(this.frame):0;this.ui.fadeOverlay.style.opacity=String(a);this.ui.fadeOverlay.style.display=a>0.001?'block':'none';}

    setLetterbox(on){this.letterboxActive=!!on;if(this.ui){this.ui.topBar.style.display=on?'block':'none';this.ui.bottomBar.style.display=on?'block':'none';}}

    stop(){this.playing=false;this.autoFocusPending=false;this.restoreCamera();this.cleanupSideRuntime();this.resetPresentationRuntime(0,true);this.resetDecisionRuntime(0);this.cleanupPairedIce();this.cleanupActors();this.releaseGameText();this.current=null;this.frame=0;this.endFrame=1;this.ui.seek.max='1';this.ui.seek.value='0';this.syncScreenFade();this.syncUI(true);this.setStatus(`Stopped. Normal ${this.mapTitle()||'SFA'} map remains loaded.`);}

    async load(entry){
      if(this.loading||this.dead)return;this.loading=true;this.setStatus(`Loading SEQ ${hex(entry.sequenceId,4)} inside ${this.mapTitle()}...`);
      try{
        this.cleanupSideRuntime();this.resetPresentationRuntime(0,true);this.resetDecisionRuntime(0);this.cleanupActors();this.releaseGameText();
        const playEntry=this.useMidLate2001?this.getMidLate2001PlaybackEntry(entry):(this.useLate2001?this.getLate2001PlaybackEntry(entry):entry);
        let source=entry.source||this.findSource(entry);
        if(!source||!source.position)source=await this.spawnSourceFromOwner(entry);
        if(!source||!source.position)throw new Error('The sequence source object could not be resolved from this map.');
        await this.ensureSequenceActorBanks(playEntry);
        const kiosk=this.pathBase==='StarFoxAdventuresDemo';
        const sourcePose=sourceLocalPose(source),sourcePos=sourcePose.position,sourceYaw=sourcePose.yaw,sourceParent=sourcePose.parent;
        const sourceWorldPos=renderedWorldPose(source).position;
        const srcModelFlags=objectModelFlags(source);
        const nestAfterFirst=!!((srcModelFlags&0x40)!==0&&(srcModelFlags&0x8000)===0);
        const actors=[],controlCurves=[];let sourceControlCurve=null,cameraActor=null,maxFrame=1,drawable=0,bound=0,sequenceActors=0,failed=0;
        const claimed=new Set();
        for(const c of playEntry.cast){
          const curve=parseCurve(playEntry.baseCurve+c.index,playEntry.tables.curveTab,playEntry.tables.curveBin);if(!curve){failed++;continue;}
          maxFrame=Math.max(maxFrame,curve.maxFrame);
          const nested=nestAfterFirst&&c.index!==0;
          const castBase=nested?[0,0,0]:sourcePos;
          const castParent=nested?source:sourceParent;
          const castBaseHeading=nested?0:sourceYaw;
          const heading=(c.flags&0x0004)!==0?0:castBaseHeading;
          if(c.defNo===SPECIAL_CAMERA){
            cameraActor={...c,curve,sourcePos:[...sourcePos],basePosition:[...castBase],heading,sequenceParent:castParent,mapInstance:this.world.mapInstance,world:this.world};
            continue;
          }

          const isSource=c.defNo===SPECIAL_SOURCE;
          const isPlayer=c.defNo===PLAYER_SABRE||c.defNo===PLAYER_KRYSTAL;
          const isTricky=c.defNo===TRICKY_A||c.defNo===TRICKY_B;
          const isOverride=isSource||((c.flags&0x4000)!==0);
          let inst=null,spawned=false,boundExisting=false;

          if(isSource){
            const sourceHasPose=curve.channels.has(CHANNEL.POS_X)||curve.channels.has(CHANNEL.POS_Y)||curve.channels.has(CHANNEL.POS_Z)||
              curve.channels.has(CHANNEL.ROT_X)||curve.channels.has(CHANNEL.ROT_Y)||curve.channels.has(CHANNEL.ROT_Z)||
              !!latestAnimationEvent(curve,curve.maxFrame);
            if(sourceHasPose){inst=source;boundExisting=true;}else{
              controlCurves.push(curve);
              if(isPlayerCastDef(romDefNo(source)))sourceControlCurve=curve;
              continue;
            }
          }else if(isOverride){
            if(c.targetObjId)inst=findByUid(this.world,c.targetObjId);
            else if(isPlayer)inst=findActivePlayer(this.world,sourceWorldPos,claimed,entryUsesKrystal(playEntry,kiosk));
            else inst=findNearestResidentRaw(this.world,c.defNo,sourceWorldPos,claimed);
            if(inst)boundExisting=true;
            if(!inst){
              inst=await this.spawnActor(c.defNo,c.targetObjId||0,castBase,playEntry);
              if(inst){spawned=true;sequenceActors++;}
            }
          }else{
            inst=await this.spawnActor(c.defNo,0,castBase,playEntry);
            if(inst){spawned=true;sequenceActors++;}
          }

          if(!inst){failed++;continue;}
          try{inst._pfpSequenceModelProviders=playEntry&&playEntry._pfpModelProviders||null;}catch(_){}
          if(boundExisting){claimed.add(inst);bound++;}
          const orig=snapshot(inst);
          if(spawned&&inst!==castParent){try{inst.parent=castParent;inst.srtDirty=true;}catch(_){}}
          if(spawned)useSequenceMapLighting(inst,source);
          fixCollectibleTintMaterials(inst);
          if(inst.modelInst)forceSequenceVisible(inst);
          const actorName=(()=>{try{return String(typeof inst.getName==='function'?inst.getName():(inst.objType&&inst.objType.name)||'');}catch(_){return '';}})();
          if(inst.modelInst&&!isSource)drawable++;
          const modanimBanks=buildModanimBanks(inst.modanim);
          const hasPositionCurve=curve.channels.has(CHANNEL.POS_X)||curve.channels.has(CHANNEL.POS_Y)||curve.channels.has(CHANNEL.POS_Z);
          const hasRotationCurve=curve.channels.has(CHANNEL.ROT_X)||curve.channels.has(CHANNEL.ROT_Y)||curve.channels.has(CHANNEL.ROT_Z);
          const copyPosition=!isOverride||((c.flags&0x0001)===0);
          const copyRotation=!isOverride||((c.flags&0x0002)===0);
          const visualStartFrame=firstSequenceVisualFrame(curve);
          actors.push({...c,curve,instance:inst,spawned,boundExisting,isOverride,original:orig,sourcePos:[...sourcePos],basePosition:[...castBase],heading,sequenceParent:castParent,mapInstance:this.world.mapInstance,world:this.world,
            isSource,isPlayer,isTricky,modanimBanks,_modanimRef:inst.modanim,
            copyPosition,copyRotation,hasPositionCurve,hasRotationCurve,visualStartFrame,_overrideParentLinked:false,
            fallbackAnim:(orig&&orig.anim)||inst.anim||null,fallbackModelAnimNum:Number((orig&&orig.modelAnimNum)??inst.modelAnimNum??0)||0,
            _lastMove:null,_lastAnimNum:null,_seqAnim:null,_seqModelAnimNum:0,_phaseCaches:new Map(),_pathDistanceCaches:new Map(),_track9Prefix:[0]});
        }
        for(const a of actors){
          const raw=romDefNo(a.instance);
          if(a.isPlayer||isPlayerCastDef(raw))await this.ensurePlayerStaff(a);
        }
        if(isPlayerCastDef(romDefNo(source))&&!actors.some(a=>a.instance===source))
          await this.ensurePlayerStaff({instance:source,isPlayer:true,curve:sourceControlCurve});
        await this.ensureCharacterEquipment(actors);
        const curveOwners=new Map();for(const c of controlCurves)curveOwners.set(c,source);for(const a of actors)if(a&&a.curve)curveOwners.set(a.curve,a.instance);if(cameraActor&&cameraActor.curve)curveOwners.set(cameraActor.curve,null);
        this.current={...playEntry,sourceInstance:source,sourcePos:sourceWorldPos,sourceLocalPos:[...sourcePos],sourceYaw,sourceParent,initialBarSuppressed:!!(playEntry.cast[0]&&((playEntry.cast[0].flags&0x0010)!==0)),allCurves:[...controlCurves,...actors.map(a=>a.curve),cameraActor&&cameraActor.curve].filter(Boolean),curveOwners,authoredEndFrame:Math.max(1,Math.ceil(maxFrame))};this.actors=actors;this.cameraActor=cameraActor;this.frame=0;this.endFrame=this.current.authoredEndFrame;this.playing=true;this.lastClock=performance.now();this.savedCamera=null;this.saveCamera();this.lastSoftwareStreamKey='';this.autoFocusPending=!cameraActor;this.resetSideRuntime();this.resetPresentationRuntime(0,false);this.buildPresentationCatalog();this.resetDecisionRuntime(0);
        this.ui.seek.max=String(this.endFrame);this.ui.seek.value='0';this.sequenceCamera=this.ui.cam.checked;
        this.applyNow();this.syncUI(true);
        const textState=await this.bindGameText(entry);
        if(this.current){this.current.voiceExpected=!!textState.voiceBound;this.current.voiceDurationKnown=false;this.current.voiceMetadataGraceUntil=performance.now()+3500;}
        this.syncVoiceLifetime();
        const cameraCastCount=playEntry.cast.filter(c=>c.defNo===SPECIAL_CAMERA).length;
        const sequenceSet=playEntry.sequenceSet||'Current';
        this.setStatus(`${this.pathBase==='StarFoxAdventuresDemo'?'KIOSK':'FINAL SFA'} · SEQ ${hex(entry.sequenceId,4)}\nSequence set: ${sequenceSet}${playEntry.usedCurrentCast?' (current cast)':''}\nMap: ${this.mapTitle()}  local sequence bank: ${entry.dir}\nSource: ${entry.sourceName}${entry.sourceUid?`  UID 0x${hex(entry.sourceUid,5)}`:''}\nCast: ${playEntry.cast.length} | drawable ${drawable} | exact UID/resident actors ${bound}${sequenceActors?` | sequence actors ${sequenceActors}`:''}${failed?` | unresolved ${failed}`:''}\nFrames: 0-${this.endFrame}\nCamera: ${cameraActor?'AnimCamera':cameraCastCount?'AnimCamera cast exists but curve did not load':'auto-focus source object'}\nGameText: ${textState.textBound?`timed sequence subtitles${textState.textDir?` [${textState.textDir}]`:''}`:'STORYBOARD dialogue fallback'} | Voice: ${textState.voiceBound?'Streams.bin audio':'no exact stream'}
Side events: ${this.bitTable&&this.objectEventTable?'GameBits + OBJEVENT + chained map sequences':'basic only'}`);
      } finally {this.loading=false;}
    }

    tick(viewerInput){
      if(this.pathBase==='StarFoxAdventuresDemo' && this.kioskOwnershipWatchUntil>performance.now() && !this.current && !this.loading){
        const n=(this.world&&Array.isArray(this.world.objectInstances))?this.world.objectInstances.length:0;
        if(n!==this.kioskOwnershipCount){
          this.kioskOwnershipCount=n;
          if(this.kioskRefreshTimer)clearTimeout(this.kioskRefreshTimer);
          this.kioskRefreshTimer=setTimeout(async()=>{
            this.kioskRefreshTimer=null;
            if(this.dead||this.current||this.loading||performance.now()>this.kioskOwnershipWatchUntil)return;
            try{
              for(const inst of (this.world&&this.world.objectInstances)||[])fixCollectibleTintMaterials(inst);
              await this.buildEntriesKiosk();
              this.kioskOwnershipCount=(this.world&&Array.isArray(this.world.objectInstances))?this.world.objectInstances.length:0;
              this.refreshList();
            }catch(e){console.warn('[Map Sequences] Kiosk startup ownership refresh failed',e);}
          },300);
        }
      }
      if(this.dead)return;this.viewerInput=viewerInput;const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-this.lastClock)/1000));this.lastClock=now;
      if(this.autoFocusPending&&this.current&&this.sequenceCamera&&!this.cameraActor&&viewerInput&&viewerInput.camera){this.saveCamera();this.focusSequenceAction();this.autoFocusPending=false;}
      this.syncVoiceLifetime();
      if(this.playing&&!this.loading&&this.current){this.frame+=dt*FPS;this.syncVoiceLifetime();if(this.frame>this.endFrame){if(this.loop){this.frame%=Math.max(1,this.endFrame);this.resetSideRuntime();this.resetPresentationRuntime(0,false);this.resetDecisionRuntime(0);this.resetSequenceVoice();this.syncGameText(true);}else{this.frame=this.endFrame;this.playing=false;}}}
      this.applyNow();this.syncGameText(false);this.syncUI(false);
    }

    proxyTransform(a,f){
      const ts=actorTransformState(a,f),p=ts.position;
      const curveRotX=signed16(Math.round(sample(a.curve,CHANNEL.ROT_X,f,0)*182.044));
      const curveRotY=signed16(Math.round(sample(a.curve,CHANNEL.ROT_Y,f,0)*182.044));
      const curveRotZ=signed16(Math.round(sample(a.curve,CHANNEL.ROT_Z,f,0)*182.044));
      const headingUnits=signed16(Math.round((Number(ts.heading)||0)*32768/Math.PI));
      const rotXUnits=signed16(curveRotX+headingUnits),rotYUnits=curveRotY,rotZUnits=curveRotZ;
      const api=window.__pfpMapSequenceAPI||{},toRad=api.angleToRad||angleToRadFallback;
      return {position:p,yaw:toRad(rotXUnits),pitch:toRad(rotYUnits),roll:toRad(rotZUnits),rotXUnits,rotYUnits,rotZUnits};
    }

    syncPairedIce(){
      const all=(this.world&&this.world.objectInstances)||[],anchors=new Map();
      for(const o of all){if(!o||o._pfpMapSequenceTemp||!isNwIceAnchor(objectName(o)))continue;const id=pairIdAt(o);if(id>=0)anchors.set(id,o);}
      for(const o of all){
        if(!o||o._pfpMapSequenceTemp||!isNwIceVisible(objectName(o)))continue;
        const a=anchors.get(pairIdAt(o));
        if(!a){
          if(o._pfpNwIceOriginalGetWorld){try{o.getWorldSRT=o._pfpNwIceOriginalGetWorld;}catch(_){}delete o._pfpNwIceOriginalGetWorld;delete o._pfpNwIceAnchor;}
          continue;
        }
        o._pfpNwIceAnchor=a;
        if(!o._pfpNwIceOriginalGetWorld&&typeof o.getWorldSRT==='function'){
          const original=o.getWorldSRT.bind(o),tmp=new Float32Array(16);
          o._pfpNwIceOriginalGetWorld=original;
          o.getWorldSRT=(out)=>{
            const anchor=o._pfpNwIceAnchor;
            if(anchor&&typeof anchor.getWorldSRT==='function'){
              try{anchor.getWorldSRT(tmp);copyMat4(out,tmp);setAttachedBasisScale(out,Number(o.scale)||1);return out;}catch(_){}
            }
            return original(out);
          };
        }
        const op=Number(a._pfpSequenceOpacity);if(Number.isFinite(op))o._pfpSequenceOpacity=op;
      }
    }

    cleanupPairedIce(){
      for(const o of (this.world&&this.world.objectInstances)||[]){
        if(!o||!isNwIceVisible(objectName(o)))continue;
        if(o._pfpNwIceOriginalGetWorld){try{o.getWorldSRT=o._pfpNwIceOriginalGetWorld;}catch(_){}delete o._pfpNwIceOriginalGetWorld;}
        delete o._pfpNwIceAnchor;delete o._pfpSequenceOpacity;
      }
    }


    applyNow(){
      if(!this.current)return;
      this.processPresentationRuntime();this.syncScreenFade();this.syncPersistentSoftwareEffects();
      this.processSideRuntime();
      for(const a of this.actors){try{this.applyActor(a);const ef=Number.isFinite(a._pfpLastEffectiveFrame)?a._pfpLastEffectiveFrame:this.frame;this.processActorObjectEvents(a,ef);this.applyCharacterSequenceCallback(a,ef);}catch(e){if(!a._failed){a._failed=true;console.warn('[Map Sequences] actor failed',e,a);}}}
      this.updateSideControllers();
      for(const aux of this.auxSequences||[]){const lf=Math.min(aux.endFrame,Math.max(0,this.frame-aux.startFrame));for(const a of aux.actors||[]){try{this.applyActor(a,lf);const ef=Number.isFinite(a._pfpLastEffectiveFrame)?a._pfpLastEffectiveFrame:lf;this.processActorObjectEvents(a,ef);this.applyCharacterSequenceCallback(a,ef);}catch(e){if(!a._failed){a._failed=true;console.warn('[Map Sequences] chained actor failed',e,a);}}}}
      this.updateSideControllers();
      this.syncPairedIce();
      this.syncCharacterEquipment();
      this.syncPlayerStaffs();
      const camFrame=this.cameraActor?effectiveSequenceFrame(this.cameraActor,this.frame):this.frame;const camRunningNow=!!(this.sequenceCamera&&this.cameraActor&&cameraRunning(this.cameraActor.curve,camFrame));
      this.setLetterbox(false);
      this.syncSoftwareStream();this.syncStoryboardText();
      if(this.sequenceCamera&&this.viewerInput&&this.cameraActor){
        try{
          if(cameraRunning(this.cameraActor.curve,camFrame)){this.saveCamera();this.applyCamera(this.viewerInput);}
          else this.restoreCamera();
        }catch(e){console.warn('[Map Sequences] camera failed',e);}
      }
    }

    syncSoftwareStream(){
      if(!this.current)return;
      const table={
        0x35F:[0x28E5,0x28E6,0x28E7,0x28E8],0x45A:[0x501C,0x501D,0x501E],
        0x117:[0x51A1,0x51A2,-1],0x0C3:[0x51A4,0x51A5,0x51A7,0x51A8,0x51A9,0x51AA,0x51AB],
        0x122:[0x51AC,0x51AD,0x51AE,0x51AF]
      };
      const subtitleTable={
        0x35F:[0x002A,0x0025,0x0021,0x002B],0x45A:[-1,-1,-1],
        0x117:[-1,-1,0x0525],0x0C3:[0x02E5,0x02E6,0x02E8,0x02EA,0x02EA,0x02E8,0x02E9],
        0x122:[0x02ED,0x02EE,0x02EF,0x02F0]
      };
      let latest=null;for(const c of this.current.allCurves)for(const e0 of c.events){const isEmbedded=e0.opcode===0x100&&e0.software===40,isDirect=e0.opcode===0x05&&((e0.paramU&0xFF)===40);if((isEmbedded||isDirect)&&e0.time<=this.frame&&(!latest||e0.time>latest.time||(e0.time===latest.time&&e0.index>latest.index)))latest=isEmbedded?e0:{...e0,software:40,softwareArg:(e0.paramU>>>8)&0xFF};}
      const baseId=this.current.sequenceId&0x3FFF;
      const baseVoiceId=Number.isFinite(Number(this.current.baseVoiceStreamId))?Number(this.current.baseVoiceStreamId):baseId;
      if(!latest){
        if(this.activeVoiceStreamId!==null&&this.activeVoiceStreamId!==baseVoiceId){try{const gt=window.__pfpSfaGameText;if(gt&&gt.setExternalVoiceStream)gt.setExternalVoiceStream(baseVoiceId,0);}catch(_){}this.activeVoiceStreamId=baseVoiceId;this.lastSoftwareStreamKey='';}
        if(this.softwareSubtitleActive){try{const gt=window.__pfpSfaGameText;if(this.sequenceTextBound&&gt&&gt.setExternalVoiceSubtitle)gt.setExternalVoiceSubtitle(baseVoiceId,0,'English',{textDirs:this.gameTextDirs(this.current),preferSequenceId:this.current.sequenceId});else if(this.sequenceTextBound&&gt&&gt.setExternalSequenceText)gt.setExternalSequenceText(this.current.sequenceId,0,'English',{textDirs:this.gameTextDirs(this.current)});else if(gt&&gt.clearExternalText)gt.clearExternalText();}catch(_){}this.softwareSubtitleActive=false;this.lastSoftwareSubtitleKey='';}
        return;
      }
      const arr=table[baseId];if(!arr)return;const streamId=arr[latest.softwareArg];if(!Number.isFinite(streamId)||streamId<0)return;
      const key=`${latest.time}:${streamId}`;
      if(key!==this.lastSoftwareStreamKey||this.activeVoiceStreamId!==streamId){this.lastSoftwareStreamKey=key;this.activeVoiceStreamId=streamId;if(this.current){this.current.voiceExpected=true;this.current.voiceDurationKnown=false;this.current.voiceMetadataGraceUntil=performance.now()+3500;}try{const gt=window.__pfpSfaGameText;if(gt&&gt.setExternalVoiceStream)gt.setExternalVoiceStream(streamId,latest.time/FPS);}catch(_){}}
      const subs=subtitleTable[baseId],subtitleId=subs&&Number.isFinite(Number(subs[latest.softwareArg]))?Number(subs[latest.softwareArg]):-1;
      const subtitleKey=`${latest.time}:${subtitleId}`;
      if(subtitleKey!==this.lastSoftwareSubtitleKey){try{const gt=window.__pfpSfaGameText;if(subtitleId>=0&&gt&&gt.setExternalTextId)gt.setExternalTextId(subtitleId,latest.time/FPS,'English',{textDirs:this.gameTextDirs(this.current)});else if(gt&&gt.clearExternalText)gt.clearExternalText();}catch(_){}this.lastSoftwareSubtitleKey=subtitleKey;this.softwareSubtitleActive=true;}
    }

    applyActor(a,frameOverride){
      const inst=a.instance,c=a.curve;if(!inst||!c||!inst.position)return false;const rawFrame=frameOverride===undefined?this.frame:frameOverride,f=effectiveSequenceFrame(a,rawFrame);a._pfpLastEffectiveFrame=f;
      const tr=this.proxyTransform(a,f);

      const overrideActive=!a.isOverride||a.isSource||toggleAt(c,0x03,f);
      if(a.isOverride&&!a.isSource&&!overrideActive){
        if(a.boundExisting&&a.original){
          restore(inst,a.original);
          inst._pfpSequenceForceVisible=false;
          inst._pfpSequenceTimelineHidden=false;
          inst._pfpSequenceOpacity=1;
        }else{
          inst._pfpSequenceTimelineHidden=true;
          inst._pfpSequenceOpacity=0;
          inst.scale=0;
          inst.srtDirty=true;
        }
        a._overrideParentLinked=false;
        return true;
      }

      if(a.isOverride&&a.boundExisting&&inst._pfpSequenceLayerRestore)inst._pfpSequenceForceVisible=true;
      if(a.isOverride&&overrideActive&&!a._overrideParentLinked&&a.sequenceParent&&a.sequenceParent!==inst&&!inst.parent){
        try{inst.parent=a.sequenceParent;inst.srtDirty=true;a._overrideParentLinked=true;}catch(_){}
      }

      const start=Number(a.visualStartFrame)||0;
      let timelineVisible=!!(a.isSource||a.isPlayer||start<=4||f+1e-4>=start);
      if(a._pfpHeldOwnerActor){
        const o=a._pfpHeldOwnerActor,of=effectiveSequenceFrame(o,rawFrame),os=Number(o.visualStartFrame)||0;
        const ownerActive=!o.isOverride||o.isSource||toggleAt(o.curve,0x03,of);
        timelineVisible=timelineVisible&&ownerActive&&(o.isSource||o.isPlayer||os<=4||of+1e-4>=os);
      }
      inst._pfpSequenceTimelineHidden=!timelineVisible;

      if(a.copyPosition){inst.position[0]=tr.position[0];inst.position[1]=tr.position[1];inst.position[2]=tr.position[2];}
      if(a.copyRotation){inst.yaw=tr.yaw;inst.pitch=tr.pitch;inst.roll=tr.roll;}

      const baseScale=a.original?a.original.scale:1;
      const opacity=timelineVisible?(c.channels&&c.channels.has(CHANNEL.OPACITY)?sample(c,CHANNEL.OPACITY,f,255):255):0;
      inst._pfpSequenceOpacity=clamp((Number(opacity)||0)/255,0,1);
      if(opacity<=0)inst.scale=0;
      else inst.scale=baseScale;
      inst.srtDirty=true;
      this.applySequenceTextureTracks(inst,c,f);

      const ev=latestAnimationEvent(c,f);
      if(!ev){
        delete inst._pfpSequenceAnimState;
      }
      if(ev&&inst.modelInst){
        const move=moveForAnimationEvent(a,ev);
        if(a._modanimRef!==inst.modanim){a._modanimRef=inst.modanim;a.modanimBanks=buildModanimBanks(inst.modanim);a._lastMove=null;a._lastAnimNum=null;}
        const resolved=resolveAnim(a,move);
        const requestedAnim=animationForResolved(a,resolved);
        const requestedValid=!!(resolved&&requestedAnim&&requestedAnim.keyframes&&requestedAnim.keyframes.length);

        if(requestedValid){
          if(a._lastAnimNum!==resolved.animNum||a._seqAnim!==requestedAnim){
            a._seqAnim=requestedAnim;
            a._seqModelAnimNum=resolved.animNum;
            a._lastAnimNum=resolved.animNum;
            a._seqAnimEvent=ev;
          }
          a._lastMove=move;
        }

        const anim=requestedValid?requestedAnim:a._seqAnim;
        if(anim&&anim.keyframes&&anim.keyframes.length){
          try{
            let phaseEvent=ev;
            if(!requestedValid&&a._seqAnimEvent)phaseEvent=a._seqAnimEvent;
            const phase=phaseForActor(a,phaseEvent,f,anim);
            const head={x:sample(c,CHANNEL.HEAD_X,f,0),y:sample(c,CHANNEL.HEAD_Y,f,0),z:sample(c,CHANNEL.HEAD_Z,f,0)};
            const face={eyeX:sample(c,CHANNEL.EYE_X,f,0),eyeY:sample(c,CHANNEL.EYE_Y,f,0),mouth:sample(c,CHANNEL.MOUTH_X,f,0)};

            let fallbackAnim=a.fallbackAnim||null,fallbackPhase=0,fallbackModelAnimNum=a.fallbackModelAnimNum||0;
            let prevAnim=null,prevPhase=0,prevModelAnimNum=0,blend=1;
            const prevEv=previousAnimationEvent(c,f);
            if(prevEv){
              const prevMove=moveForAnimationEvent(a,prevEv),prevResolved=resolveAnim(a,prevMove),exactPrev=animationForResolved(a,prevResolved);
              if(exactPrev&&exactPrev.keyframes&&exactPrev.keyframes.length){
                fallbackAnim=exactPrev;fallbackPhase=phaseForActor(a,prevEv,f,exactPrev);fallbackModelAnimNum=prevResolved.animNum;
                const blendFrames=(Number(anim.frameControl)||0)&0x0F;
                if(blendFrames>0&&f<ev.time+blendFrames){prevAnim=exactPrev;prevPhase=fallbackPhase;prevModelAnimNum=fallbackModelAnimNum;blend=clamp((f-ev.time)/blendFrames,0,1);}
              }
            }
            const callback=inst._pfpSequenceCallbackState?{...inst._pfpSequenceCallbackState}:null;
            inst._pfpSequenceAnimState={phase,anim,modelAnimNum:a._seqModelAnimNum,prevPhase,prevAnim,prevModelAnimNum,blend,fallbackAnim,fallbackPhase,fallbackModelAnimNum,head,headKey:sequenceHeadJointKey(c,f),face,callback};
          }catch(_){ }
        }
      }
      const morph=sequenceMorphStateAt(c,f);
      if(morph){if(inst._pfpSequenceAnimState)inst._pfpSequenceAnimState.morph=morph;else inst._pfpSequenceAnimState={anim:null,morph};}
      else if(inst._pfpSequenceAnimState)inst._pfpSequenceAnimState.morph=null;
      return true;
    }

    focusSequenceAction(){if(!this.current||!this.viewerInput||!this.viewerInput.camera)return;let p=this.current.sourcePos;let subject=null;const visual=this.actors.find(a=>a&&a.instance&&a.instance.modelInst&&a.instance.position&&!a.isSource);if(visual)subject=visual.instance;else if(this.current.sourceInstance&&this.current.sourceInstance.modelInst)subject=this.current.sourceInstance;else{const any=this.actors.find(a=>a&&a.instance&&a.instance.modelInst&&a.instance.position);subject=any&&any.instance;}if(subject){try{p=renderedWorldPose(subject).position;}catch(_){}}const[cx,cy,cz]=p,dist=420;this.lookAt(this.viewerInput.camera,[cx+dist*.58,cy+135,cz+dist*.82],[cx,cy+48,cz],50);}
    focusSource(){this.focusSequenceAction();}
    lookAt(cam,eye,target,fovDeg){const out=cam.worldMatrix,up=[0,1,0];let zx=eye[0]-target[0],zy=eye[1]-target[1],zz=eye[2]-target[2],zl=Math.hypot(zx,zy,zz)||1;zx/=zl;zy/=zl;zz/=zl;let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx,xl=Math.hypot(xx,xy,xz)||1;xx/=xl;xy/=xl;xz/=xl;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;out[0]=xx;out[1]=xy;out[2]=xz;out[3]=0;out[4]=yx;out[5]=yy;out[6]=yz;out[7]=0;out[8]=zx;out[9]=zy;out[10]=zz;out[11]=0;out[12]=eye[0];out[13]=eye[1];out[14]=eye[2];out[15]=1;const api=window.__pfpMapSequenceAPI||{};if(api.invert)api.invert(cam.viewMatrix,out);cam.isOrthographic=false;if(typeof cam.setPerspective==='function')cam.setPerspective(fovDeg*Math.PI/180,cam.aspect||1,2,500000);if(typeof cam.worldMatrixUpdated==='function')cam.worldMatrixUpdated();}

    applyCamera(viewerInput){
      const a=this.cameraActor,c=a&&a.curve;if(!a||!c)return;const f=effectiveSequenceFrame(a,this.frame);if(!cameraRunning(c,f))return;
      const tr=this.proxyTransform(a,f),wp=worldPointFromParent(a.sequenceParent,tr.position);
      const x=wp[0],y=wp[1],z=wp[2];
      let actorRotX=tr.rotXUnits;const actorRotY=tr.rotYUnits,actorRotZ=tr.rotZUnits;
      if(a.sequenceParent){const py=Number(a.sequenceParent.yaw);if(Number.isFinite(py))actorRotX=signed16(actorRotX+Math.round(py*32768/Math.PI));}

      const cameraYaw=actorRotX;
      const cameraPitch=actorRotY;
      const cameraRoll=signed16(-actorRotZ);
      const cam=viewerInput.camera,api=window.__pfpMapSequenceAPI||{};
      setRetailCameraWorldMatrix(cam.worldMatrix,cameraYaw,cameraPitch,cameraRoll,x,y,z);
      if(api.invert)api.invert(cam.viewMatrix,cam.worldMatrix);cam.isOrthographic=false;
      let fov=sample(c,CHANNEL.FOV,f,60);if(!Number.isFinite(fov))fov=60;if(fov<35)fov=35;else if(fov>120)fov=125;
      if(typeof cam.setPerspective==='function')cam.setPerspective(fov*Math.PI/180,cam.aspect||1,2,500000);if(typeof cam.worldMatrixUpdated==='function')cam.worldMatrixUpdated();
    }

    syncUI(force){if(!this.ui)return;this.ui.play.textContent=this.playing?'Pause':'Play';this.ui.time.textContent=`${Math.floor(this.frame)} / ${Math.floor(this.endFrame)}`;if(this.ui.compact){const setName=this.current&&this.current.sequenceSet&&this.current.sequenceSet!=='Current'?`${this.current.sequenceSet} · `:'';this.ui.compact.textContent=this.current?`· ${setName}SEQ ${hex(this.current.sequenceId,4)} ${Math.floor(this.frame)}/${Math.floor(this.endFrame)}`:(this.entries&&this.entries.length?`· ${this.entries.length}`:'');}if((document.activeElement!==this.ui.seek||force)&&this.current)this.ui.seek.value=String(Math.floor(this.frame));}
    destroy(){if(this.kioskRefreshTimer){clearTimeout(this.kioskRefreshTimer);this.kioskRefreshTimer=null;}if(this.dead)return;this.dead=true;this.autoFocusPending=false;this.restoreCamera();this.cleanupSideRuntime();this.resetPresentationRuntime(0,true);this.cleanupActors();this.releaseGameText();if(this.sequenceToggleLabel&&this.sequenceToggleLabel.parentNode)this.sequenceToggleLabel.remove();if(window.__pfpSfaSequencesToggle&&window.__pfpSfaSequencesToggle.label===this.sequenceToggleLabel)window.__pfpSfaSequencesToggle=null;if(this.ui&&this.ui.panel)this.ui.panel.remove();if(this.ui&&this.ui.topBar)this.ui.topBar.remove();if(this.ui&&this.ui.bottomBar)this.ui.bottomBar.remove();if(this.ui&&this.ui.fadeOverlay)this.ui.fadeOverlay.remove();}
  }

  function install(){
    const C=window.__pfpSfaWorldRendererClassV6;if(!C||!C.prototype||C.prototype.__pfpMapSequencePatchedPublicLate2001)return false;C.prototype.__pfpMapSequencePatchedPublicLate2001=true;const origUpdate=C.prototype.update,origDestroy=C.prototype.destroy;
    C.prototype.update=function(viewerInput){const result=origUpdate.call(this,viewerInput);try{if(this.world&&this.world.gameInfo&&(this.world.gameInfo.pathBase==='StarFoxAdventures'||this.world.gameInfo.pathBase==='StarFoxAdventuresDemo')&&(this.world.mapInstance||(Array.isArray(this.world.objectInstances)&&this.world.objectInstances.length))){if(!this.__pfpMapSequenceRuntime)this.__pfpMapSequenceRuntime=new MapSequenceRuntime(this);this.__pfpMapSequenceRuntime.tick(viewerInput);}}catch(e){console.error('[Map Sequences] update hook',e);}return result;};
    C.prototype.destroy=function(device){try{if(this.__pfpMapSequenceRuntime)this.__pfpMapSequenceRuntime.destroy();}catch(_){}this.__pfpMapSequenceRuntime=null;return origDestroy.call(this,device);};
    console.log('[Map Sequences] runtime installed on the Final/Kiosk SFA map renderer');return true;
  }

  window.__pfpSfaMapSequenceInstallerPublicLate2001={install};if(!install()){let tries=0;const timer=setInterval(()=>{if(install()||++tries>240)clearInterval(timer);},25);}
})();
