(function(){
'use strict';

const SABRE_SPELLSTONE_ACTOR=0x0392;
const SABRE_VFP_SPELLSTONE=0x03BE;
const SABRE_ACTIVATED_SPELLSTONE_MODEL=0x015C;
const SABRE_ACTIVATED_SPELLSTONE_BASE_TEXTURE=0x0CE1;
const SABRE_ACTIVATED_SPELLSTONE_TEXTURE=0x0CE2;
const SABRE_SPELLSTONE_SLOT_SEQUENCES=new Set([0x023A,0x03DF,0x041C,0x0420]);
const SABRE_SPELLSTONE_FORCE_ACTIVE_SEQUENCES=new Set([0x0221]);

function jawJoint(mi){
  if(!mi||!mi.model||!Array.isArray(mi.model.joints))return -1;
  const map=mi._pfpDPJointKeyMap,slot=Math.max(0,Number(mi._pfpDPModelSlot)||0);
  if(!map||typeof map.get!=='function')return -1;
  const slots=map.get(1);if(!slots||slot>=slots.length)return -1;
  const joint=Number(slots[slot]);
  return Number.isInteger(joint)&&joint>=0&&joint!==255&&joint<mi.model.joints.length?joint:-1;
}

function rotateLocalX(base,rad){
  const out=new Float32Array(base),c=Math.cos(rad),s=Math.sin(rad);
  const a10=base[4],a11=base[5],a12=base[6],a13=base[7];
  const a20=base[8],a21=base[9],a22=base[10],a23=base[11];
  out[4]=a10*c+a20*s;out[5]=a11*c+a21*s;out[6]=a12*c+a22*s;out[7]=a13*c+a23*s;
  out[8]=a20*c-a10*s;out[9]=a21*c-a11*s;out[10]=a22*c-a12*s;out[11]=a23*c-a13*s;
  return out;
}

function hookModel(mi,inst){
  if(!mi||mi.__pfpWebMouthHook)return;
  mi.__pfpWebMouthHook=true;
  const oldSet=mi.setJointPose;
  if(typeof oldSet==='function')mi.setJointPose=function(joint,pose){
    if(this.__pfpWebTrackJaw&&joint===this.__pfpWebJawJoint)this.__pfpWebJawWrites=(this.__pfpWebJawWrites||0)+1;
    return oldSet.call(this,joint,pose);
  };
  const oldDraw=mi.addRenderInsts;
  if(typeof oldDraw==='function')mi.addRenderInsts=function(){
    try{
      const state=inst&&inst._pfpSequenceAnimState,face=state&&state.face;
      const mouth=Number(face&&face.mouth)||0,joint=jawJoint(this);
      if(Math.abs(mouth)>0.0001&&joint>=0){
        const expected=state&&state.anim?2:1;
        if((this.__pfpWebJawWrites||0)<expected){
          const sk=this.skeletonInst,base=sk&&sk.poseMatrices&&sk.poseMatrices[joint];
          if(base&&typeof this.setJointPose==='function')this.setJointPose(joint,rotateLocalX(base,mouth*Math.PI/180));
        }
      }
    }catch(_){ }
    return oldDraw.apply(this,arguments);
  };
}

function hookActor(actor,rt){
  const inst=actor&&actor.inst;if(!inst)return;
  const mi=inst.modelInst;
  if(mi&&!mi._pfpDPJointKeyMap&&typeof rt.attachDPJointMap==='function'){
    try{rt.attachDPJointMap(actor);}catch(_){ }
  }
  if(inst.__pfpWebMouthActorHook){hookModel(inst.modelInst,inst);return;}
  inst.__pfpWebMouthActorHook=true;
  const oldDraw=inst.addRenderInsts;
  if(typeof oldDraw!=='function')return;
  inst.addRenderInsts=function(){
    const current=this.modelInst;
    hookModel(current,this);
    if(current){current.__pfpWebJawJoint=jawJoint(current);current.__pfpWebJawWrites=0;current.__pfpWebTrackJaw=true;}
    try{return oldDraw.apply(this,arguments);}
    finally{if(current)current.__pfpWebTrackJaw=false;}
  };
}

function patchRuntime(rt){
  if(!rt||rt.__pfpWebSequenceFixesV3)return;
  rt.__pfpWebSequenceFixesV3=true;

  if(rt.sequenceCullTarget===undefined)rt.sequenceCullTarget=null;
  if(rt.sequenceCullReloading===undefined)rt.sequenceCullReloading=false;
  if(rt.sequenceCullOwned===undefined)rt.sequenceCullOwned=false;
  if(rt.sequenceCullRestore===undefined)rt.sequenceCullRestore=false;

  rt.setBackfaceCullState=function(on){
    const enabled=!!on;
    window.__DP_ENABLE_CULL=enabled;
    const state=window.__dpCullToggle;
    if(state&&state.cb){state.cb.checked=enabled;state.last=enabled;}
  };

  rt.queueBackfaceCull=function(on){
    const target=!!on;
    this.sequenceCullTarget=target;
    this.setBackfaceCullState(target);
    if(this.sequenceCullReloading)return;
    const renderer=this.renderer;
    if(!renderer||typeof renderer.reloadForTextureToggle!=='function'){this.sequenceCullTarget=null;return;}
    this.sequenceCullReloading=true;
    const run=async()=>{
      try{
        while(this.sequenceCullTarget!==null){
          const next=this.sequenceCullTarget;
          this.sequenceCullTarget=null;
          this.setBackfaceCullState(next);
          try{await renderer.reloadForTextureToggle();}
          catch(e){if(typeof this.diag==='function')this.diag('backface-cull-reload-error',{enabled:next,error:String(e&&e.stack||e)});}
        }
      }finally{
        this.sequenceCullReloading=false;
        if(this.sequenceCullTarget!==null)this.queueBackfaceCull(this.sequenceCullTarget);
      }
    };
    run();
  };

  rt.syncBackfaceCulling=function(force=false){
    const active=!!(this.current&&this.playing&&!this.loading&&!this.dead);
    if(active){
      if(!this.sequenceCullOwned){
        this.sequenceCullRestore=!!window.__DP_ENABLE_CULL;
        this.sequenceCullOwned=true;
      }
      const actual=!!window.__DP_ENABLE_CULL;
      if(!force&&this.sequenceCullWanted&&actual)return;
      this.sequenceCullWanted=true;
      this.queueBackfaceCull(true);
      return;
    }
    if(!this.sequenceCullOwned)return;
    const restore=!!this.sequenceCullRestore;
    this.sequenceCullOwned=false;
    this.sequenceCullWanted=restore;
    this.queueBackfaceCull(restore);
  };

  rt.sequenceIdForActor=function(actor){
    const tracked=actor&&actor.inst&&actor.inst._pfpSequenceTracked;
    if(tracked&&Number.isInteger(Number(tracked.sequenceId)))return Number(tracked.sequenceId);
    return this.current&&Number.isInteger(Number(this.current.sequenceId))?Number(this.current.sequenceId):-1;
  };

  rt.actorScn=function(actor){
    const inst=actor&&actor.inst;
    if(!actor||!actor.cast)return Number(inst&&inst._dpTypeNum)&0xFFFF;
    return actor.cast.objID===0xFFFF?(Number(inst&&inst._dpTypeNum)&0xFFFF):(Number(actor.cast.objID)&0xFFFF);
  };

  const rawModelIndexAt=typeof rt.modelIndexAt==='function'?rt.modelIndexAt.bind(rt):null;
  if(rawModelIndexAt){
    rt.modelIndexAt=function(actor,frame){
      const index=rawModelIndexAt(actor,frame);
      const sequenceId=this.sequenceIdForActor(actor),scn=this.actorScn(actor);
      if(scn===SABRE_SPELLSTONE_ACTOR&&SABRE_SPELLSTONE_FORCE_ACTIVE_SEQUENCES.has(sequenceId))return 1;
      return index;
    };
  }

  rt.applySabreSpellstoneTexture=function(actor,frame){
    const inst=actor&&actor.inst;if(!inst)return;
    const sequenceId=this.sequenceIdForActor(actor),scn=this.actorScn(actor);
    let orange=scn===SABRE_VFP_SPELLSTONE;
    if(scn===SABRE_SPELLSTONE_ACTOR){
      if(SABRE_SPELLSTONE_FORCE_ACTIVE_SEQUENCES.has(sequenceId))orange=true;
      else if(SABRE_SPELLSTONE_SLOT_SEQUENCES.has(sequenceId)){
        const modelId=Number(inst._pfpModelId==null?(inst.modelInst&&inst.modelInst._pfpModelId):inst._pfpModelId);
        const modelIndex=typeof this.modelIndexAt==='function'?this.modelIndexAt(actor,frame):(actor.saved&&actor.saved.modelSlot);
        orange=modelId===SABRE_ACTIVATED_SPELLSTONE_MODEL||modelIndex===1;
      }
    }
    let slots=Array.isArray(inst._pfpSequenceTextureSlots)?inst._pfpSequenceTextureSlots.filter(x=>!x||!x._pfpSabreSpellstone):[];
    if(orange)slots.push({sourceTextureId:SABRE_ACTIVATED_SPELLSTONE_BASE_TEXTURE,textureOverrideId:SABRE_ACTIVATED_SPELLSTONE_TEXTURE,_pfpSabreSpellstone:true});
    if(slots.length)inst._pfpSequenceTextureSlots=slots;else delete inst._pfpSequenceTextureSlots;
  };

  const oldRestore=rt.restoreMapEnvironment;
  if(typeof oldRestore==='function')rt.restoreMapEnvironment=function(clearSnapshot){
    if(this.__pfpWebLoadingSequence&&!clearSnapshot)return;
    return oldRestore.apply(this,arguments);
  };

  const oldLoad=rt.load;
  if(typeof oldLoad==='function')rt.load=async function(){
    this.__pfpWebLoadingSequence=true;
    try{return await oldLoad.apply(this,arguments);}
    finally{this.__pfpWebLoadingSequence=false;}
  };

  const oldApplyActor=rt.applyActor;
  if(typeof oldApplyActor==='function')rt.applyActor=function(actor,frame){
    const result=oldApplyActor.call(this,actor,frame);
    try{this.applySabreSpellstoneTexture(actor,frame);}catch(_){}
    try{hookActor(actor,this);}catch(_){}
    return result;
  };
}

function install(){
  const C=window.__pfpSfaMapRendererClassV6;
  if(!C||!C.prototype)return false;
  if(C.prototype.__pfpWebDPSequenceFixHookV2)return true;
  C.prototype.__pfpWebDPSequenceFixHookV2=true;
  const oldUpdate=C.prototype.update;
  C.prototype.update=function(){
    const result=oldUpdate.apply(this,arguments);
    try{patchRuntime(this.__pfpDPSequenceRuntime);}catch(_){ }
    return result;
  };
  return true;
}

let tries=0;
const timer=setInterval(function(){if(install()||++tries>240)clearInterval(timer);},50);
})();
