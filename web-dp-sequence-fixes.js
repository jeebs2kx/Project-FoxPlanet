(function(){
'use strict';

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
  if(!rt||rt.__pfpWebSequenceFixesV2)return;
  rt.__pfpWebSequenceFixesV2=true;
  rt.syncBackfaceCulling=function(){
    this.sequenceCullWanted=!!window.__DP_ENABLE_CULL;
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
    try{hookActor(actor,this);}catch(_){ }
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
