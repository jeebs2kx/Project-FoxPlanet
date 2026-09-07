(function(){
'use strict';
if(window.__PFP_WEB_DP_AUDIO_R21)return;window.__PFP_WEB_DP_AUDIO_R21=true;

// These are the dense tracks reported as clean in desktop FoxPlanet but expensive
// when the browser creates the entire song's WebAudio graph in one synchronous pass.
// Include all Galadon variants so manual selection and the boss map use the same path.
const HEAVY_SEQUENCES=new Set([58,59,67,68,72]);
const PLAYERS=window.__PFP_DP_AUDIO_PLAYERS_R21||(window.__PFP_DP_AUDIO_PLAYERS_R21=new Set());
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const VIB_RATE=[.05,.05,.06,.06,.06,.07,.07,.08,.08,.09,.1,.11,.13,.14,.17,.2,.25,.33,.5,1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,3.25,3.5,3.75,4,4.25,4.5,4.75,5,5.25,5.5,5.75,6,6.25,6.5,6.75,7,7.25,7.5,7.75,8,8.25,8.5,8.75,9,9.25,9.5,9.75,10,10.25,10.5,10.75,11,11.25,11.5,11.75,12,12.25,12.5,12.75,13,13.25,13.5,13.75,14,14.25,14.5,14.75,15,15.25,15.5,15.75,16,16.25,16.5,16.75,17,17.25,17.5,17.75,18,18.25,18.5,18.75,19,19.25,19.5,19.75,20,20.25,20.5,20.75,21];
const DELAY_US=[0,1e4,2e4,3e4,4e4,5e4,6e4,7e4,8e4,9e4,1e5,11e4,11e4,12e4,13e4,14e4,15e4,16e4,17e4,19e4,2e5,22e4,23e4,25e4,27e4,29e4,31e4,33e4,35e4,38e4,41e4,44e4,47e4,5e5,54e4,58e4,62e4,66e4,71e4,76e4,82e4,88e4,94e4,1e6,1e6,11e5,12e5,13e5,14e5,15e5,16e5,17e5,18e5,2e6,21e5,23e5,24e5,26e5,28e5,3e6,32e5,35e5,37e5,4e6,43e5,46e5,49e5,53e5,57e5,61e5,65e5,7e6,75e5,81e5,86e5,93e5,99e5,1e7,11e6,12e6,13e6,14e6,15e6,16e6,17e6,18e6,19e6,21e6,22e6,24e6,26e6,28e6,3e7,32e6,34e6,37e6,39e6,42e6,45e6,49e6,5e7,55e6,6e7,65e6,7e7,75e6,8e7,85e6,9e7,95e6,1e8,105e6,11e7,115e6,12e7,125e6,13e7,135e6,14e7,145e6,15e7,155e6,16e7,165e6,17e7,175e6,18e7];

function clearChunkState(p){
  if(p.__pfpR21PumpTimer!=null){clearInterval(p.__pfpR21PumpTimer);p.__pfpR21PumpTimer=null;}
  p.__pfpR21PumpBusy=false;p.__pfpR21ChunkState=null;
}
function removeActive(p,node){
  const a=p&&p.activeSources;if(!Array.isArray(a))return;
  const i=a.indexOf(node);if(i>=0)a.splice(i,1);
}
function rawPeak(notes){
  const ev=[];for(const n of notes){ev.push([n.startSeconds,1],[n.endSeconds,-1]);}
  ev.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let cur=0,peak=0;
  for(const x of ev){cur+=x[1];if(cur>peak)peak=cur;}return peak;
}
function prepareRecords(p,action,notes,peak){
  const q=action.actionId===0?(action.playerNo<2?Math.max(24,Math.min(64,peak+8)):Math.max(64,Math.min(128,peak+8))):(action.playerNo<2?8:32);
  const voices=[],out=[];
  for(const note of notes){
    const inst=p.selectInstrument(action,note.program,note.usePercussion);if(!inst)continue;
    const sound=p.selectSound(inst,note.key,note.velocity);if(!sound)continue;
    for(let i=voices.length-1;i>=0;i--)if(voices[i]<=note.startSeconds)voices.splice(i,1);
    const release=(note.customState?note.releaseTimeUs:sound.envelope.releaseTimeUs)/1e6;
    const until=note.endSeconds+Math.min(2,release)+.032;
    if(voices.length>=q)continue;
    voices.push(until);out.push({note,inst,sound});
  }
  return out;
}
async function predecodeRecords(p,ctx,action,records,from,to,initialOffset){
  const uniq=new Map();
  for(const r of records){
    const n=r.note;
    const wanted=(n.startSeconds>=from&&n.startSeconds<to)||(from===initialOffset&&n.startSeconds<initialOffset&&n.endSeconds>initialOffset);
    if(wanted)uniq.set(r.sound.waveTable.offset,r.sound);
  }
  let i=0;
  for(const sound of uniq.values()){
    p.getDecodedBuffer(ctx,action,sound);
    if((++i&3)===0)await new Promise(res=>setTimeout(res,0));
  }
}
function scheduleRecord(p,ctx,action,rec,passStart,offset,duration,master){
  const n=rec.note,inst=rec.inst,sound=rec.sound;
  if(n.endSeconds<=offset||n.startSeconds>=duration)return false;
  const logicalStart=Math.max(n.startSeconds,offset),logicalEnd=Math.min(n.endSeconds,duration);
  if(logicalEnd<=logicalStart)return false;
  const buf=p.getDecodedBuffer(ctx,action,sound),src=ctx.createBufferSource(),env=ctx.createGain(),chan=ctx.createGain(),pan=ctx.createStereoPanner();
  src.buffer=buf;
  const pitch=n.key-sound.keyMap.keyBase+sound.keyMap.detune/100+n.pitchOffsetCents/100;
  src.playbackRate.value=Math.pow(2,pitch/12);src.detune.setValueAtTime(n.pitchBendCents,ctx.currentTime);
  const loop=sound.waveTable.loop;
  if(loop&&loop.count!==0&&loop.end>loop.start&&loop.end<=buf.length){src.loop=true;const rate=p.getBankForAction(action).sampleRate;src.loopStart=loop.start/rate;src.loopEnd=loop.end/rate;}
  const T=passStart+(logicalStart-offset),S=passStart+(logicalEnd-offset),rel=n.customState?n.releaseTimeUs:sound.envelope.releaseTimeUs,C=S+Math.min(2,rel/1e6)+.02;
  const vel=n.velocity/127,svol=sound.sampleVolume/127,k=Math.max(1e-4,vel*svol),av=n.customState?n.attackVolume:sound.envelope.attackVolume,dv=n.customState?n.decayVolume:sound.envelope.decayVolume,E=k*(av/127),B=k*(dv/127),A=Math.min(2,(n.customState?n.attackTimeUs:sound.envelope.attackTimeUs)/1e6),D=Math.min(2,(n.customState?n.decayTimeUs:sound.envelope.decayTimeUs)/1e6);
  env.gain.setValueAtTime(1e-4,T);A>0?env.gain.linearRampToValueAtTime(Math.max(1e-4,E),T+A):env.gain.setValueAtTime(Math.max(1e-4,E),T);
  const P=Math.min(S,T+A+D);P>T+A?env.gain.linearRampToValueAtTime(Math.max(1e-4,B),P):env.gain.setValueAtTime(Math.max(1e-4,B),P);env.gain.setValueAtTime(Math.max(1e-4,B),S);env.gain.linearRampToValueAtTime(1e-4,C);
  chan.gain.setValueAtTime(n.channelVolume/127,T);
  for(const ev of n.volumeEvents||[]){if(ev.seconds<=offset||ev.seconds>=n.endSeconds)continue;const at=passStart+(ev.seconds-offset);if(at>=T&&at<=S)chan.gain.setValueAtTime(ev.value/127,at);}
  const pp=clamp(n.pan-64+sound.samplePan,0,127);pan.pan.setValueAtTime(clamp((pp-64)/64,-1,1),T);
  for(const ev of n.panEvents||[]){if(ev.seconds<=offset||ev.seconds>=n.endSeconds)continue;const at=passStart+(ev.seconds-offset),pv=clamp(ev.value-64+sound.samplePan,0,127);if(at>=T&&at<=S)pan.pan.setValueAtTime(clamp((pv-64)/64,-1,1),at);}
  for(const ev of n.pitchEvents||[]){if(ev.seconds<=offset||ev.seconds>=n.endSeconds)continue;const at=passStart+(ev.seconds-offset);if(at>=T&&at<=S)src.detune.setValueAtTime(ev.cents,at);}
  const vt=127&n.vibType,delay=DELAY_US[clamp(n.vibDelay,0,126)]/1e6;
  if(vt>=2&&vt<=13&&n.vibDepth>0&&T+delay<C){
    const osc=ctx.createOscillator(),vg=ctx.createGain(),depth=Math.pow(1.0309929847717,n.vibDepth),half=(vt===3||vt===4||vt===5||vt===7||vt===9||vt===11||vt===13),amount=half?depth/2:depth;
    osc.type=(vt===8||vt===9||vt===12||vt===13)?'sine':(vt===6||vt===7)?'triangle':(vt===10||vt===11)?'sawtooth':'square';osc.frequency.value=VIB_RATE[clamp(n.vibRate,0,99)];vg.gain.setValueAtTime(0,T);
    const l=T+delay,rise=DELAY_US[clamp(n.oscRiseTime,0,126)]/1e6;if(half)src.detune.setValueAtTime(n.pitchBendCents+depth/2,T);rise>0?(vg.gain.setValueAtTime(0,l),vg.gain.linearRampToValueAtTime(amount,l+rise)):vg.gain.setValueAtTime(amount,l);
    osc.connect(vg);vg.connect(src.detune);osc.start(l);osc.stop(C);p.activeSources.push(osc);osc.onended=()=>{try{osc.disconnect();vg.disconnect();}catch(_){}removeActive(p,osc);};
  }
  src.connect(env);env.connect(chan);chan.connect(pan);pan.connect(master);src.start(T);src.stop(C);p.activeSources.push(src);
  src.onended=()=>{try{src.disconnect();env.disconnect();chan.disconnect();pan.disconnect();}catch(_){}removeActive(p,src);};
  return true;
}
function scheduleHeavy(ctx,action,notes,duration,generation,offset){
  if(generation!==this.generation)return;
  clearChunkState(this);PLAYERS.add(this);
  const o=clamp(offset||0,0,Math.max(0,duration-.01)),peak=action.actionId===0?rawPeak(notes):0,c=action.volume>0?action.volume/127:.65,headroom=action.actionId===0&&peak>32?Math.max(.55,Math.sqrt(32/peak)):1;
  this.baseMasterGain=.165*(.45+.55*c)*headroom;
  const gain=ctx.createGain(),limiter=ctx.createDynamicsCompressor(),muted=!!(window.musicState&&window.musicState.muted);
  limiter.threshold.value=-1;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.08;gain.gain.setValueAtTime(muted?0:this.baseMasterGain*this.volumeScale,ctx.currentTime);gain.connect(limiter);limiter.connect(ctx.destination);this.masterGain=gain;this.outputLimiter=limiter;
  const passStart=ctx.currentTime+.10;this.passStartAt=passStart;this.passOffsetSeconds=o;
  const records=prepareRecords(this,action,notes,peak),scheduled=new Set(),HORIZON=14,STEP=8;
  const scheduleRange=(from,to,first)=>{let count=0;for(let idx=0;idx<records.length;idx++){if(scheduled.has(idx))continue;const n=records[idx].note,wanted=(n.startSeconds>=from&&n.startSeconds<to)||(first&&n.startSeconds<o&&n.endSeconds>o);if(!wanted)continue;scheduled.add(idx);if(scheduleRecord(this,ctx,action,records[idx],passStart,o,duration,gain))count++;}return count;};
  let through=Math.min(duration,o+HORIZON),made=scheduleRange(o,through,true);
  const state=this.__pfpR21ChunkState={records,scheduled,through,offset:o,duration,generation,action,ctx,passStart,gain};
  const pump=async()=>{
    if(this.__pfpR21PumpBusy||generation!==this.generation||this.__pfpR21ChunkState!==state)return;
    const logical=clamp(o+Math.max(0,ctx.currentTime-passStart),o,duration),target=Math.min(duration,logical+HORIZON);
    if(target<=state.through+.25)return;
    const from=state.through,to=Math.min(duration,Math.max(target,from+STEP));this.__pfpR21PumpBusy=true;
    try{await predecodeRecords(this,ctx,action,records,from,to,o);if(generation!==this.generation||this.__pfpR21ChunkState!==state)return;made+=scheduleRange(from,to,false);state.through=to;}catch(e){console.warn('[FoxPlanet R21] DP chunk predecode/schedule',e);}finally{this.__pfpR21PumpBusy=false;}
  };
  this.__pfpR21PumpTimer=setInterval(pump,750);
  if(this.mutePollTimer!=null)clearInterval(this.mutePollTimer);
  this.mutePollTimer=setInterval(()=>{if(generation!==this.generation||this.masterGain!==gain)return;const m=!!(window.musicState&&window.musicState.muted)||!!window.__dpSfxMusicDuck,now=ctx.currentTime;gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(m?0:this.baseMasterGain*this.volumeScale,now,.1);},150);
  if(this.restartTimer!=null)clearTimeout(this.restartTimer);
  const remain=Math.max(1,duration-o+.25);this.restartTimer=setTimeout(()=>{if(generation===this.generation&&this.loopEnabled&&this.currentLogicalTrack!=null){this.stopScheduledAudio();this.schedulePass(ctx,action,notes,duration,generation,0);}},Math.max(1000,Math.floor(1000*remain)));
  console.info('[FoxPlanet R21] streaming dense DP sequence '+action.sequenceId+'; initially scheduled '+made+' notes through '+through.toFixed(1)+'s instead of building the whole song at once.');
}

function stopAll(reason){
  const list=Array.from(PLAYERS);for(const p of list){try{p.stop();}catch(_){}clearChunkState(p);}PLAYERS.clear();
  if(list.length)console.info('[FoxPlanet R21] stopped '+list.length+' old DP music player(s) before '+reason+'.');
}
function patch(){
  const C=window.__pfpDPNativeMusicClass,p=C&&C.prototype;if(!p)return false;if(p.__pfpWebDpAudioR21)return true;p.__pfpWebDpAudioR21=true;
  const oldPre=p.predecodeRequiredSamples,oldFixed=p.schedulePassFixed,oldScheduledStop=p.stopScheduledAudio,oldStop=p.stop,oldSchedule=p.schedulePass;
  p.predecodeRequiredSamples=async function(ctx,action,notes){
    if(!HEAVY_SEQUENCES.has(Number(action&&action.sequenceId)))return oldPre.apply(this,arguments);
    const peak=action.actionId===0?rawPeak(notes):0,records=prepareRecords(this,action,notes,peak),firstEnd=Math.min(this.currentDuration>0?this.currentDuration:1e9,18);
    await predecodeRecords(this,ctx,action,records,0,firstEnd,0);
    console.info('[FoxPlanet R21] predecoded only the opening window for dense DP sequence '+action.sequenceId+'.');
  };
  p.schedulePassFixed=function(ctx,action,notes,duration,generation,offset){if(HEAVY_SEQUENCES.has(Number(action&&action.sequenceId)))return scheduleHeavy.call(this,ctx,action,notes,duration,generation,offset||0);return oldFixed.apply(this,arguments);};
  p.stopScheduledAudio=function(){clearChunkState(this);return oldScheduledStop.apply(this,arguments);};
  p.stop=function(){clearChunkState(this);const r=oldStop.apply(this,arguments);PLAYERS.delete(this);return r;};
  p.schedulePass=function(){PLAYERS.add(this);return oldSchedule.apply(this,arguments);};
  console.info('[FoxPlanet R21] dense DP tracks now use look-ahead streaming; hard transition cleanup armed.');
  return true;
}
function patchSceneLoader(){const app=window.main;if(!app||typeof app._loadSceneDesc!=='function'||app.__pfpDpAudioR21ScenePatch)return false;app.__pfpDpAudioR21ScenePatch=true;const old=app._loadSceneDesc;app._loadSceneDesc=function(){stopAll('scene load');return old.apply(this,arguments);};return true;}

let lastHash=location.hash;
window.addEventListener('hashchange',()=>{if(location.hash!==lastHash){lastHash=location.hash;stopAll('route change');}},true);
window.addEventListener('popstate',()=>stopAll('history change'),true);
window.addEventListener('beforeunload',()=>stopAll('page unload'));
patch();patchSceneLoader();let tries=0;const boot=setInterval(()=>{const a=patch(),b=patchSceneLoader();if((a&&b)||++tries>180)clearInterval(boot);},100);
})();
