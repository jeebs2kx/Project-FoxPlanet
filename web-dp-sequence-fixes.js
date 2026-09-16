(function(){
'use strict';

function patchRuntime(rt){
  if(!rt||rt.__pfpWebSequenceFixes)return;
  rt.__pfpWebSequenceFixes=true;

  // Keep the user's current culling choice online. The sequence player used to
  // reload the whole map when it toggled this, causing a visible flash and
  // replacing actor instances while a new sequence was still binding.
  rt.syncBackfaceCulling=function(){
    this.sequenceCullWanted=!!window.__DP_ENABLE_CULL;
  };

  // Do not restore/rebuild the map environment in the middle of a direct
  // sequence-to-sequence switch. Restore normally when the player is stopped.
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

  // If a model instance was replaced during setup, restore its DP joint-key map
  // before animation is applied so jaw/head tracks still reach the right joints.
  const oldApplyActor=rt.applyActor;
  if(typeof oldApplyActor==='function')rt.applyActor=function(actor,frame){
    try{
      const inst=actor&&actor.inst,mi=inst&&inst.modelInst;
      if(mi&&!mi._pfpDPJointKeyMap&&typeof this.attachDPJointMap==='function')this.attachDPJointMap(actor);
    }catch(_){ }
    return oldApplyActor.call(this,actor,frame);
  };
}

function install(){
  const C=window.__pfpSfaMapRendererClassV6;
  if(!C||!C.prototype)return false;
  if(C.prototype.__pfpWebDPSequenceFixHook)return true;
  C.prototype.__pfpWebDPSequenceFixHook=true;
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
