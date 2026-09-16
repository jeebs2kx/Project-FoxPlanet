(function(){
'use strict';

function patchRuntime(rt){
  if(!rt||rt.__pfpWebSequenceFixes)return;
  rt.__pfpWebSequenceFixes=true;

  // Keep the user's current culling choice online. The desktop sequence player
  // can safely rebuild its scene for this; doing that in the browser flashes the
  // temporary/default map state between sequences.
  rt.syncBackfaceCulling=function(){
    this.sequenceCullWanted=!!window.__DP_ENABLE_CULL;
  };

  // Preserve the current map environment while one sequence is being replaced
  // by another. A normal Stop still restores it exactly as before.
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
