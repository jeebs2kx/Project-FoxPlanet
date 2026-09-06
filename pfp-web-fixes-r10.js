(function(){
  'use strict';
  if(window.__PFP_WEB_FIXES_R10)return;
  window.__PFP_WEB_FIXES_R10=true;

  var rendererPatched=false;
  var lastRuntime=null;

  function sleep(ms){return new Promise(function(resolve){window.setTimeout(resolve,ms);});}
  function staticWeb(){return location.protocol==='https:'||(location.protocol==='http:'&&!/^(localhost|127\.0\.0\.1)$/i.test(location.hostname));}
  function cleanPath(p){return String(p||'').replace(/\\/g,'/').replace(/^\/+/, '').replace(/\/+/g,'/');}

  function installLandingCss(){
    if(document.getElementById('pfp-web-r10-layout'))return;
    var s=document.createElement('style');
    s.id='pfp-web-r10-layout';
    s.textContent=`
body[data-landing="1"] #landing-version{transform:translateY(-43px)!important;margin:0 auto -39px!important;}
body[data-landing="1"] #landing-version .landing-patch-card{width:min(528px,calc(100% - 38px))!important;padding:1px 4px 2px!important;margin:0 auto!important;}
body[data-landing="1"] #landing-version .landing-patch-title{font-size:6.5px!important;line-height:.94!important;margin:0 0 1px!important;}
body[data-landing="1"] #landing-version .landing-patch-lines{font-size:5px!important;line-height:.94!important;column-gap:5px!important;}
body[data-landing="1"] #landing-version .landing-patch-col{gap:0!important;margin:0!important;}
body[data-landing="1"] #landing-version .landing-patch-wide{margin-top:0!important;line-height:.94!important;}
body[data-landing="1"] #landing-version .landing-patch-lines *{margin-top:0!important;margin-bottom:0!important;}
`;
    document.head.appendChild(s);
  }

  function mountedHas(path){
    var f=window.main&&window.main.dataFetcher;
    if(!f||!Array.isArray(f.mounts))return false;
    var key=cleanPath(path).toLowerCase();
    for(var i=0;i<f.mounts.length;i++){
      var m=f.mounts[i];if(m&&m.entries instanceof Map&&m.entries.has(key))return true;
    }
    return false;
  }

  function fixGameTextGlyphs(){
    try{
      var gt=window.__pfpSfaGameText,st=gt&&gt.state,data=st&&st.data;
      if(!data||!data.__r9RealFont||data.__r10GlyphMaskFixed||!Array.isArray(data.glyphs))return false;
      // The embedded GameText colour pages still use their alpha as the glyph mask.
      // Treat every page as tintable so F8FF colour commands apply to Final exactly
      // like the already-correct monochrome/green glyphs, instead of drawing baked
      // dark RGB values from some atlas pages.
      for(var i=0;i<data.glyphs.length;i++)if(data.glyphs[i])data.glyphs[i].mono=true;
      data.__r10GlyphMaskFixed=true;
      if(st.tintCache&&st.tintCache.clear)st.tintCache.clear();
      console.info('[FoxPlanet R10] GameText glyph tint masks enabled:',data.glyphs.length);
      return true;
    }catch(e){console.warn('[FoxPlanet R10] GameText glyph fix',e);return false;}
  }

  function worldPosition(inst){
    try{
      if(inst&&typeof inst.getWorldSRT==='function'){
        var m=new Float32Array(16);inst.getWorldSRT(m);
        if(Number.isFinite(m[12])&&Number.isFinite(m[13])&&Number.isFinite(m[14]))return [m[12],m[13],m[14]];
      }
    }catch(_){}
    try{
      var p=inst&&inst.position;
      if(p&&p.length>=3)return [Number(p[0])||0,Number(p[1])||0,Number(p[2])||0];
    }catch(_){}
    return [0,0,0];
  }

  function chosenIndices(inst,seqs){
    var def=inst&&inst.objType,data=def&&def.data,params=inst&&inst.objParams;
    var name=String(def&&def.name||''),lower=name.toLowerCase(),objectClass=Number(def&&def.objClass),defId=Number(def&&def.typeNum);
    var selectedIndex=-1,selectorKind=null,selectedIndices=null;
    try{
      if(/seqpoint/.test(lower)){
        selectorKind='s16@1c';if(params&&params.byteLength>=0x1E){var a=params.getInt16(0x1C,false);if(a>=0&&a<seqs.length)selectedIndex=a;}
      }else if(defId===896||/^wm[_ ]?warppoint$/i.test(name)){
        selectorKind='s16@1c';if(params&&params.byteLength>=0x1E){var b=params.getInt16(0x1C,false);if(b>=0&&b<seqs.length)selectedIndex=b;}
      }else if(/warppoint|restartpoint/.test(lower)){
        selectorKind='s8@1b';if(params&&params.byteLength>0x1B){var c=params.getInt8(0x1B);if(c>=0&&c<seqs.length)selectedIndex=c;}
      }else if(/clubsharpclaw/.test(lower)){
        selectorKind='s8@2e';if(params&&params.byteLength>0x2E){var d=params.getInt8(0x2E);if(d>=0&&d<seqs.length)selectedIndex=d;}
      }else if(objectClass===280||objectClass===281||((/seqobject|sequences/.test(lower))&&objectClass!==282)){
        selectorKind='s8@1e';if(params&&params.byteLength>0x1E){var e=params.getInt8(0x1E);if(e>=0&&e<seqs.length)selectedIndex=e;}
      }
      if(objectClass===282||/immultiseq/.test(lower)){
        selectorKind='s8x4@2c';selectedIndices=[];
        if(params)for(var o=0x2C;o<0x30&&o<params.byteLength;o++){var v=params.getInt8(o);if(v>=0&&v<seqs.length&&selectedIndices.indexOf(v)<0)selectedIndices.push(v);}
      }
    }catch(_){}
    var indices=selectedIndices!==null?selectedIndices:(selectorKind?(selectedIndex>=0?[selectedIndex]:[]):seqs.map(function(_,i){return i;}));
    return {indices:indices,selected:!!selectorKind};
  }

  async function waitForObjects(rt){
    var start=performance.now(),last=-1,stable=performance.now();
    while(rt&&!rt.dead&&performance.now()-start<2200){
      var n=rt.world&&Array.isArray(rt.world.objectInstances)?rt.world.objectInstances.length:0;
      if(n!==last){last=n;stable=performance.now();}
      if(n>0&&performance.now()-stable>=220)break;
      await sleep(60);
    }
  }

  async function buildLocalFinal(rt){
    if(!rt||rt.pathBase!=='StarFoxAdventures')return false;
    await waitForObjects(rt);
    try{if(typeof rt.loadAdditionalTables==='function')await rt.loadAdditionalTables(['root']);}catch(_){}
    var instances=rt.world&&Array.isArray(rt.world.objectInstances)?rt.world.objectInstances:[];
    var bySeq=new Map();

    for(var ii=0;ii<instances.length;ii++){
      var inst=instances[ii];
      try{
        if(!inst||!inst.objType||!inst.objType.data)continue;
        var def=inst.objType,data=def.data;
        if(data.byteLength<0x60)continue;
        var nSeq=data.getUint8(0x5E);
        if(!nSeq||nSeq>=256)continue;
        var seqs=[];
        for(var si=0;si<nSeq;si++){
          var sid=typeof rt.objectSequenceIdAt==='function'?rt.objectSequenceIdAt(inst,si):-1;
          seqs.push(Number.isInteger(sid)&&sid>=0?sid:null);
        }
        if(!seqs.some(function(x){return Number.isInteger(x);}))continue;
        var pick=chosenIndices(inst,seqs);
        var common=inst.commonObjectParams||{};
        var rawType=Number(common.objType),defId=Number(def.typeNum),uid=Number(common.id)||0;
        if(!Number.isFinite(rawType))rawType=defId;
        var pos=worldPosition(inst),name=String(def.name||''),objectClass=Number(def.objClass);
        for(var pi=0;pi<pick.indices.length;pi++){
          var localIndex=pick.indices[pi],sequenceId=seqs[localIndex];
          if(!Number.isInteger(sequenceId))continue;
          var list=bySeq.get(sequenceId);if(!list){list=[];bySeq.set(sequenceId,list);}
          list.push({sequenceId:sequenceId,source:inst,sourceObjType:rawType,sourceDefId:defId,sourceName:name,sourceUid:uid,sourcePos:pos,sourceObjectClass:objectClass,localIndex:localIndex,selected:pick.selected});
        }
      }catch(_){}
    }

    var out=[];
    for(const pair of bySeq){
      var sequenceId=pair[0],owners=pair[1],resource=null;
      try{resource=typeof rt.findResourceDir==='function'?rt.findResourceDir(sequenceId,null,true):null;}catch(_){}
      if(!resource||!resource.cast||!resource.cast.length)continue;
      var selected=owners.filter(function(o){return o.selected;}),chosen=selected.length?selected[0]:null;
      if(!chosen){
        var groups=new Map();
        owners.forEach(function(o){var k=String(o.sourceObjType);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);});
        var ranked=Array.from(groups.values()).sort(function(a,b){return a.length-b.length||String(a[0].sourceName).localeCompare(String(b[0].sourceName))||Number(a[0].sourceUid||0)-Number(b[0].sourceUid||0);});
        if(ranked.length)chosen=ranked[0][0];
      }
      if(!chosen)continue;
      var same=owners.filter(function(o){return o.sourceObjType===chosen.sourceObjType;});
      var exactSelected=selected.find(function(o){return o.sourceObjType===chosen.sourceObjType;})||null;
      var source=exactSelected||chosen,sourceName=String(source.sourceName||'');
      var entry=Object.assign({},source,resource,{
        sequenceId:sequenceId,source:source.source,sourcePlacementCount:same.length,ownerCount:owners.length,
        selected:!!exactSelected,cast:resource.cast,cinematicSignal:true,
        mapSpecificOwner:/seq|shrine|queen|scales|level|landing|camera|boss|control|gate|warp|spirit|door|portal|krystal|drakor|galdon|crf|cloud|cage|prison/i.test(sourceName),
        representative:!exactSelected&&same.length>1
      });
      out.push(entry);
    }
    var unique=new Map();
    out.forEach(function(e){var prev=unique.get(e.sequenceId);if(!prev||(!prev.selected&&e.selected)||((prev.sourcePlacementCount||99)>(e.sourcePlacementCount||99)))unique.set(e.sequenceId,e);});
    rt.entries=Array.from(unique.values()).sort(function(a,b){return a.sequenceId-b.sequenceId;});
    if(typeof rt.refreshList==='function')rt.refreshList();
    if(typeof rt.setStatus==='function')rt.setStatus(rt.entries.length+' local Final SFA map sequence'+(rt.entries.length===1?'':'s')+' found from the loaded map objects.');
    return rt.entries.length>0;
  }

  async function refreshOptionalSequenceTables(rt){
    if(!rt||rt.dead||rt.__pfpR10OptionalRefresh)return;
    if(!mountedHas('sequence-data/late2001/OBJSEQ.tab')&&!mountedHas('sequence-data/midlate2001-swaphol/OBJSEQ.tab'))return;
    rt.__pfpR10OptionalRefresh=true;
    try{
      if(typeof rt.loadTables==='function')await rt.loadTables();
      if(rt.ui&&rt.ui.late2001){rt.ui.late2001.disabled=!rt.late2001Tables;if(rt.late2001Tables)rt.ui.late2001.title='Use the Late 2001 sequence data for the selected sequence ID.';}
      if(rt.ui&&rt.ui.midLate2001){rt.ui.midLate2001.disabled=!rt.midLate2001Tables;if(rt.midLate2001Tables)rt.ui.midLate2001.title='Use the converted Mid-Late 2001 sequence data for the selected sequence ID.';}
      if(typeof rt.refreshList==='function')rt.refreshList();
    }catch(e){console.warn('[FoxPlanet R10] optional sequence bank refresh',e);}
  }

  function patchRuntime(rt){
    if(!rt)return;
    lastRuntime=rt;
    refreshOptionalSequenceTables(rt);
    if(rt.__pfpR10Runtime)return;
    rt.__pfpR10Runtime=true;
    if(rt.pathBase!=='StarFoxAdventures')return;

    var oldBuild=rt.buildEntries;
    if(typeof oldBuild==='function'){
      rt.buildEntries=async function(){
        if(staticWeb()){
          var ok=await buildLocalFinal(this);
          if(ok)return;
          // Keep the original path as a fallback for localhost/desktop-compatible data,
          // but do not wait on a dead GitHub Pages API if local ownership was simply empty.
          this.entries=[];if(typeof this.refreshList==='function')this.refreshList();return;
        }
        return oldBuild.apply(this,arguments);
      };
    }

    (async function recover(){
      for(var attempt=0;attempt<5&&!rt.dead;attempt++){
        try{
          if(rt.dirTables&&rt.dirTables.size){
            var ok=await buildLocalFinal(rt);if(ok)return;
          }
        }catch(e){if(attempt===0)console.warn('[FoxPlanet R10] Final local sequence recovery',e);}
        await sleep(300+attempt*250);
      }
    })();
  }

  function patchRenderer(){
    var C=window.__pfpSfaWorldRendererClassV6;
    if(!C||!C.prototype||rendererPatched)return !!rendererPatched;
    var old=C.prototype.update;if(typeof old!=='function')return false;
    rendererPatched=true;
    C.prototype.update=function(viewerInput){
      var out=old.call(this,viewerInput);
      try{var rt=this.__pfpMapSequenceRuntime;if(rt)patchRuntime(rt);}catch(e){console.warn('[FoxPlanet R10] runtime bridge',e);}
      return out;
    };
    return true;
  }

  function install(){installLandingCss();patchRenderer();fixGameTextGlyphs();if(lastRuntime)refreshOptionalSequenceTables(lastRuntime);}
  install();
  window.addEventListener('load',function(){install();window.setTimeout(install,250);window.setTimeout(install,900);});
  window.addEventListener('hashchange',function(){window.setTimeout(function(){fixGameTextGlyphs();if(lastRuntime)refreshOptionalSequenceTables(lastRuntime);},120);},true);
  window.addEventListener('pfp-local-data-mounted',function(){
    if(lastRuntime)lastRuntime.__pfpR10OptionalRefresh=false;
    window.setTimeout(function(){fixGameTextGlyphs();if(lastRuntime)refreshOptionalSequenceTables(lastRuntime);},80);
  });

  var tries=0;
  (function retry(){
    installLandingCss();var r=patchRenderer();fixGameTextGlyphs();
    if(r||++tries>120)return;
    window.setTimeout(retry,50);
  })();
})();
