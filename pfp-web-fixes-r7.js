(function(){
  'use strict';
  if(window.__PFP_WEB_FIXES_R7)return;
  window.__PFP_WEB_FIXES_R7=true;

  var CACHE_DB='project-foxplanet-gamedata-cache-r7';
  var CACHE_VER=1;
  var CACHE_FILES='files';
  var CACHE_META='meta';
  var CACHE_MARK='gamedata';
  var entryIndex=new Map();
  var patchedProtos=new WeakSet();
  var fontUpgrading=false;
  var restoredOnce=false;

  function cleanPath(p){return String(p||'').replace(/\\/g,'/').replace(/^\/+/, '').replace(/\/+/g,'/');}
  function lowerPath(p){return cleanPath(p).toLowerCase();}
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  function status(text){var e=document.getElementById('pfp-web-data-status');if(e)e.textContent=text;}

  function installLandingCss(){
    if(document.getElementById('pfp-web-r7-layout'))return;
    var s=document.createElement('style');
    s.id='pfp-web-r7-layout';
    s.textContent=`
body[data-landing="1"] #landing-version{
  transform:translateY(-66px)!important;
  margin:0 auto -62px!important;
}
body[data-landing="1"] #landing-version .landing-patch-card{
  width:min(478px,calc(100% - 66px))!important;
  padding:2px 6px 3px!important;
  margin:0 auto!important;
}
body[data-landing="1"] #landing-version .landing-patch-title{font-size:8px!important;line-height:1!important;margin-bottom:1px!important;}
body[data-landing="1"] #landing-version .landing-patch-lines{font-size:6.65px!important;line-height:1.01!important;column-gap:7px!important;}
body[data-landing="1"] #landing-version .landing-patch-col{gap:0!important;}
body[data-landing="1"] #landing-version .landing-patch-wide{margin-top:0!important;}
`;
    document.head.appendChild(s);
  }

  function cardForLogo(img){
    if(!img)return null;
    var e=img,best=null;
    for(var i=0;i<7&&e;i++,e=e.parentElement){
      var r=e.getBoundingClientRect();
      if(r.width>350&&r.width<850&&r.height>100&&r.height<300)best=e;
    }
    return best;
  }

  function compactLanding(){
    if(!document.body||document.body.dataset.landing!=='1')return;
    var names=['48f1fc0f8c5be9e9c584.png','a42fc47a0a079a2980f2.png'];
    var cards=[];
    document.querySelectorAll('img').forEach(function(img){
      var n=(img.getAttribute('src')||'').split('/').pop().split('?')[0];
      if(names.indexOf(n)<0)return;
      var c=cardForLogo(img);
      if(c&&cards.indexOf(c)<0)cards.push(c);
      img.style.setProperty('max-height','82px','important');
      img.style.setProperty('max-width','245px','important');
      img.style.setProperty('object-fit','contain','important');
    });
    cards.forEach(function(card){
      card.dataset.pfpR7GameCard='1';
      card.style.setProperty('height','112px','important');
      card.style.setProperty('min-height','112px','important');
      card.style.setProperty('max-height','112px','important');
      card.style.setProperty('padding','4px 8px','important');
      card.style.setProperty('box-sizing','border-box','important');
    });
    if(cards.length){
      var grid=cards[0].parentElement;
      if(grid){
        grid.style.setProperty('gap','7px','important');
        grid.style.setProperty('row-gap','7px','important');
      }
      var panel=grid&&grid.parentElement;
      if(panel){
        panel.style.setProperty('height','min(520px, calc(100vh - 226px))','important');
        panel.style.setProperty('min-height','0','important');
        panel.style.setProperty('overflow','hidden','important');
      }
    }
  }

  function addEntryAlias(key,entry){
    key=lowerPath(key);if(!key||!entry)return;
    entryIndex.set(key,entry);
    var m=key.match(/(?:^|\/)gamedata\/(starfoxadventuresdemo|starfoxadventures|dinosaurplanet|dinosaurplanet_vanilla)\/(.+)$/i);
    if(m)entryIndex.set((m[1]+'/'+m[2]).toLowerCase(),entry);
    m=key.match(/^(starfoxadventuresdemo|starfoxadventures)\/files\/(.+)$/i);
    if(m)entryIndex.set((m[1]+'/'+m[2]).toLowerCase(),entry);
  }

  function captureEntries(){
    var f=window.main&&window.main.dataFetcher;
    if(!f||!Array.isArray(f.mounts))return 0;
    var before=entryIndex.size;
    f.mounts.forEach(function(m){
      if(!m||!(m.entries instanceof Map))return;
      m.entries.forEach(function(entry,key){addEntryAlias(key,entry);});
    });
    window.__PFP_R7_LOCAL_ENTRY_INDEX=entryIndex;
    return entryIndex.size-before;
  }

  async function readEntry(entry,path,opts){
    if(!entry)return null;
    if(typeof entry.read==='function')return entry.read(cleanPath(path),opts||{});
    if(entry.blob instanceof Blob){
      var start=Number((opts&&opts.rangeStart)||0);
      var size=(opts&&opts.rangeSize)===undefined?entry.blob.size-start:Number(opts.rangeSize);
      var b=await entry.blob.slice(start,start+Math.max(0,size)).arrayBuffer();
      return {arrayBuffer:b,byteOffset:0,byteLength:b.byteLength,
        createDataView:function(o,l){o=o||0;if(l===undefined)l=b.byteLength-o;return new DataView(b,o,l);},
        createTypedArray:function(C,o,c){o=o||0;if(c===undefined)c=Math.floor((b.byteLength-o)/(C.BYTES_PER_ELEMENT||1));return new C(b,o,c);},
        copyToBuffer:function(o,l){o=o||0;if(l===undefined)l=b.byteLength-o;return b.slice(o,o+l);}};
    }
    return null;
  }

  function patchFetcher(fetcher){
    if(!fetcher||typeof fetcher.fetchData!=='function')return;
    var proto=Object.getPrototypeOf(fetcher);
    if(proto&&typeof proto.fetchData==='function'&&!patchedProtos.has(proto)){
      var orig=proto.fetchData;
      proto.fetchData=async function(path,opts){
        var entry=entryIndex.get(lowerPath(path));
        if(entry){
          try{var d=await readEntry(entry,path,opts);if(d)return d;}catch(_){}
        }
        return orig.call(this,path,opts);
      };
      patchedProtos.add(proto);
      proto.__pfpR7LocalBridge=true;
    }
  }

  function sequenceBankCount(){
    var dirs=new Map();
    entryIndex.forEach(function(_,key){
      var m=key.match(/^(starfoxadventuresdemo|starfoxadventures)\/([^/]+)\/(.+)$/i);if(!m)return;
      var k=(m[1]+'/'+m[2]).toLowerCase(),file=m[3].toLowerCase();
      if(!dirs.has(k))dirs.set(k,new Set());dirs.get(k).add(file);
    });
    var n=0;
    dirs.forEach(function(s){
      var ok=s.has('objseq.tab')&&s.has('objseq.bin')&&
        (s.has('objseq2c.tab')||s.has('objseq2curve.tab'))&&
        (s.has('animcurv.tab')||s.has('animcurve.tab'))&&
        (s.has('animcurv.bin')||s.has('animcurve.bin'));
      if(ok)n++;
    });
    return n;
  }

  function wrapMountApi(){
    var api=window.__PFP_WEB_LOCAL_DATA;if(!api||api.__r7Wrapped)return;
    api.__r7Wrapped=true;
    ['mountFolderFiles','mountSfaIso','mountKioskIso','mountDpRom'].forEach(function(name){
      if(typeof api[name]!=='function')return;
      var old=api[name];
      api[name]=async function(){
        var r=await old.apply(api,arguments);
        captureEntries();
        patchFetcher(window.main&&window.main.dataFetcher);
        window.__PFP_LOCAL_MOUNT_ACTIVE=true;
        try{window.dispatchEvent(new CustomEvent('pfp-r7-data-ready'));}catch(_){}
        return r;
      };
    });
  }

  function openCacheDb(){
    return new Promise(function(resolve,reject){
      if(!window.indexedDB)return resolve(null);
      var q=indexedDB.open(CACHE_DB,CACHE_VER);
      q.onupgradeneeded=function(){
        var db=q.result;
        if(!db.objectStoreNames.contains(CACHE_FILES))db.createObjectStore(CACHE_FILES,{keyPath:'path'});
        if(!db.objectStoreNames.contains(CACHE_META))db.createObjectStore(CACHE_META,{keyPath:'key'});
      };
      q.onsuccess=function(){resolve(q.result);};q.onerror=function(){reject(q.error);};
    });
  }
  function idbReq(q){return new Promise(function(resolve,reject){q.onsuccess=function(){resolve(q.result);};q.onerror=function(){reject(q.error);};});}
  async function metaGet(key){var db=await openCacheDb();if(!db)return null;var tx=db.transaction(CACHE_META,'readonly');return idbReq(tx.objectStore(CACHE_META).get(key));}
  async function metaPut(rec){var db=await openCacheDb();if(!db)return;return new Promise(function(resolve,reject){var tx=db.transaction(CACHE_META,'readwrite');tx.objectStore(CACHE_META).put(rec);tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error);};});}
  async function cacheClear(){
    var db=await openCacheDb();if(!db)return;
    return new Promise(function(resolve,reject){var tx=db.transaction([CACHE_FILES,CACHE_META],'readwrite');tx.objectStore(CACHE_FILES).clear();tx.objectStore(CACHE_META).clear();tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error);};});
  }

  async function cacheFiles(files){
    if(!files||!files.length||!window.indexedDB)return false;
    var total=files.reduce(function(n,f){return n+(Number(f.size)||0);},0);
    try{
      if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist();
      if(navigator.storage&&navigator.storage.estimate){
        var est=await navigator.storage.estimate();
        var free=(Number(est.quota)||0)-(Number(est.usage)||0);
        if(est.quota&&free<total*1.08){
          status('GameData is loaded for this session, but Chrome does not have enough site storage to remember all '+files.length+' files for the next launch.');
          return false;
        }
      }
    }catch(_){}
    await cacheClear();
    await metaPut({key:CACHE_MARK,complete:false,count:files.length,totalBytes:total,created:Date.now()});
    var db=await openCacheDb();if(!db)return false;
    var step=120;
    for(var i=0;i<files.length;i+=step){
      var end=Math.min(files.length,i+step);
      await new Promise(function(resolve,reject){
        var tx=db.transaction(CACHE_FILES,'readwrite'),store=tx.objectStore(CACHE_FILES);
        for(var j=i;j<end;j++){
          var f=files[j],path=f.webkitRelativePath||f.__pfpRelativePath||f.name;
          store.put({path:path,file:f,name:f.name,type:f.type||'',lastModified:f.lastModified||0,size:f.size||0});
        }
        tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error);};
      });
      if(i%1200===0)status('GameData loaded. Saving a local browser copy for next launch... '+Math.min(end,files.length)+' / '+files.length);
      await sleep(0);
    }
    await metaPut({key:CACHE_MARK,complete:true,count:files.length,totalBytes:total,created:Date.now()});
    status('GameData ready - '+files.length+' files. Saved locally in Chrome, so FoxPlanet can load it automatically next time.');
    return true;
  }

  async function cachedRecords(){
    var m=await metaGet(CACHE_MARK);if(!m||!m.complete||!m.count)return null;
    var db=await openCacheDb();if(!db)return null;
    var tx=db.transaction(CACHE_FILES,'readonly'),rows=await idbReq(tx.objectStore(CACHE_FILES).getAll());
    if(!rows||rows.length!==m.count)return null;
    return rows;
  }

  function restoreRelativePath(file,path){
    try{Object.defineProperty(file,'webkitRelativePath',{value:path,configurable:true});return file;}catch(_){}
    try{
      var f=new File([file],file.name||path.split('/').pop(),{type:file.type||'',lastModified:file.lastModified||Date.now()});
      Object.defineProperty(f,'webkitRelativePath',{value:path,configurable:true});return f;
    }catch(_){file.__pfpRelativePath=path;return file;}
  }

  async function restoreCachedGameData(){
    if(restoredOnce||window.__PFP_LOCAL_MOUNT_ACTIVE)return false;
    restoredOnce=true;
    try{
      var rows=await cachedRecords();if(!rows)return false;
      for(var tries=0;tries<120;tries++){
        if(window.__PFP_WEB_LOCAL_DATA&&typeof window.__PFP_WEB_LOCAL_DATA.mountFolderFiles==='function'&&window.main&&window.main.dataFetcher)break;
        await sleep(50);
      }
      if(!window.__PFP_WEB_LOCAL_DATA||!window.main||!window.main.dataFetcher)return false;
      status('Restoring saved GameData from Chrome...');
      var files=rows.map(function(r){return restoreRelativePath(r.file,r.path);});
      var r=await window.__PFP_WEB_LOCAL_DATA.mountFolderFiles(files);
      captureEntries();patchFetcher(window.main.dataFetcher);
      window.__PFP_LOCAL_MOUNT_ACTIVE=true;
      window.__PFP_R7_CACHE_RESTORED=true;
      status('GameData restored automatically - '+r.files+' files.');
      return true;
    }catch(e){console.warn('[FoxPlanet R7] cached GameData restore failed',e);return false;}
  }

  function folderPicker(){
    return new Promise(function(resolve){
      var input=document.createElement('input');input.type='file';input.style.display='none';input.webkitdirectory=true;input.multiple=true;document.body.appendChild(input);
      input.addEventListener('change',function(){var a=Array.from(input.files||[]);input.remove();resolve(a);},{once:true});
      input.addEventListener('cancel',function(){input.remove();resolve([]);},{once:true});input.click();
    });
  }

  function patchFolderButton(){
    var modal=document.getElementById('pfp-web-data-modal');if(!modal)return;
    var b=Array.from(modal.querySelectorAll('.pfp-web-choice')).find(function(x){return (x.textContent||'').trim().toUpperCase()==='EXISTING GAMEDATA FOLDER';});
    if(!b||b.dataset.r7==='1')return;
    b.dataset.r7='1';
    b.onclick=async function(e){
      if(e){e.preventDefault();e.stopPropagation();}
      try{
        status('Choose your FoxPlanet GameData folder...');
        var files=await folderPicker();if(!files.length){status('Nothing loaded yet.');return;}
        status('Reading GameData...');
        var api=window.__PFP_WEB_LOCAL_DATA;if(!api||typeof api.mountFolderFiles!=='function')throw new Error('FoxPlanet data loader is not ready yet.');
        var r=await api.mountFolderFiles(files);captureEntries();patchFetcher(window.main&&window.main.dataFetcher);
        var banks=sequenceBankCount();
        status('GameData ready - '+r.files+' files'+(banks?' ('+banks+' sequence data folders found).':'')+' Saving it locally so Chrome can restore it next launch...');
        cacheFiles(files).catch(function(err){console.warn('[FoxPlanet R7] cache save failed',err);status('GameData is loaded, but Chrome could not save the local restart cache: '+(err&&err.message?err.message:err));});
      }catch(err){status('Could not load it. '+(err&&err.message?err.message:String(err)));}
    };
  }

  async function mountedBytes(path){
    var f=window.main&&window.main.dataFetcher;if(!f)return null;
    patchFetcher(f);
    try{var d=await f.fetchData(path,{allow404:true});if(!d||!d.byteLength)return null;return d.createTypedArray(Uint8Array);}catch(_){return null;}
  }

  function texFmtInfo(fmt,w,h){
    if(fmt===0)return {bw:8,bh:8,bytes:32};
    if(fmt===1||fmt===2)return {bw:8,bh:4,bytes:32};
    if(fmt===3||fmt===4||fmt===5)return {bw:4,bh:4,bytes:32};
    if(fmt===6)return {bw:4,bh:4,bytes:64};
    return null;
  }
  function texSize(fmt,w,h){var i=texFmtInfo(fmt,w,h);if(!i)return 0;return Math.ceil(w/i.bw)*Math.ceil(h/i.bh)*i.bytes;}
  function expand5(v){return (v<<3)|(v>>2);}function expand6(v){return (v<<2)|(v>>4);}function expand4(v){return (v<<4)|v;}function expand3(v){return (v<<5)|(v<<2)|(v>>1);}

  function decodeTexture(bytes,off,w,h,fmt){
    var info=texFmtInfo(fmt,w,h);if(!info)return null;
    var c=document.createElement('canvas');c.width=w;c.height=h;var ctx=c.getContext('2d'),im=ctx.createImageData(w,h),dst=im.data,p=off;
    function px(x,y,r,g,b,a){if(x<0||y<0||x>=w||y>=h)return;var q=(y*w+x)*4;dst[q]=r;dst[q+1]=g;dst[q+2]=b;dst[q+3]=a;}
    for(var by=0;by<h;by+=info.bh){for(var bx=0;bx<w;bx+=info.bw){
      if(fmt===0){
        for(var y=0;y<8;y++)for(var x=0;x<8;x+=2){var v=bytes[p++]||0,a=(v>>>4)*17,b=(v&15)*17;px(bx+x,by+y,255,255,255,a);px(bx+x+1,by+y,255,255,255,b);}
      }else if(fmt===1){
        for(y=0;y<4;y++)for(x=0;x<8;x++){v=bytes[p++]||0;px(bx+x,by+y,255,255,255,v);}
      }else if(fmt===2){
        for(y=0;y<4;y++)for(x=0;x<8;x++){v=bytes[p++]||0;var al=(v>>>4)*17,it=(v&15)*17;px(bx+x,by+y,it,it,it,al);}
      }else if(fmt===3){
        for(y=0;y<4;y++)for(x=0;x<4;x++){var al8=bytes[p++]||0,it8=bytes[p++]||0;px(bx+x,by+y,it8,it8,it8,al8);}
      }else if(fmt===4){
        for(y=0;y<4;y++)for(x=0;x<4;x++){v=((bytes[p++]||0)<<8)|(bytes[p++]||0);px(bx+x,by+y,expand5((v>>>11)&31),expand6((v>>>5)&63),expand5(v&31),255);}
      }else if(fmt===5){
        for(y=0;y<4;y++)for(x=0;x<4;x++){
          v=((bytes[p++]||0)<<8)|(bytes[p++]||0);
          if(v&0x8000)px(bx+x,by+y,expand5((v>>>10)&31),expand5((v>>>5)&31),expand5(v&31),255);
          else px(bx+x,by+y,expand4((v>>>8)&15),expand4((v>>>4)&15),expand4(v&15),expand3((v>>>12)&7));
        }
      }else if(fmt===6){
        var base=p;
        for(y=0;y<4;y++)for(x=0;x<4;x++){var k=y*4+x,aa=bytes[base+k*2]||0,rr=bytes[base+k*2+1]||0,gg=bytes[base+32+k*2]||0,bb=bytes[base+32+k*2+1]||0;px(bx+x,by+y,rr,gg,bb,aa);}p+=64;
      }
    }}
    ctx.putImageData(im,0,0);return c;
  }

  function parseEmbeddedFont(bytes){
    if(!bytes||bytes.length<32)return null;
    var dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),off=0,numChars=dv.getUint32(0,false);off=4;
    if(!numChars||numChars>10000||off+numChars*16>bytes.length)return null;
    var chars=[],fontCounts={};
    for(var i=0;i<numChars;i++){
      var o=off+i*16,ch={code:dv.getUint32(o,false),x:dv.getUint16(o+4,false),y:dv.getUint16(o+6,false),left:dv.getInt8(o+8),right:dv.getInt8(o+9),top:dv.getInt8(o+10),bottom:dv.getInt8(o+11),w:dv.getUint8(o+12),h:dv.getUint8(o+13),font:dv.getUint8(o+14),tex:dv.getUint8(o+15)};
      chars.push(ch);fontCounts[ch.font]=(fontCounts[ch.font]||0)+1;
    }
    off+=numChars*16;if(off+4>bytes.length)return null;
    var numTexts=dv.getUint16(off,false),strDataLen=dv.getUint16(off+2,false);off+=4;
    if(numTexts>10000||off+numTexts*12+4>bytes.length)return null;off+=numTexts*12;
    var numStrings=dv.getUint32(off,false);off+=4;
    if(numStrings>100000||off+numStrings*4>bytes.length)return null;off+=numStrings*4;
    var strStart=off;off=strStart+strDataLen;if(off+4>bytes.length)return null;
    var unk=dv.getUint32(off,false);off+=4;if(unk<0||off+unk>bytes.length)return null;off+=unk;
    var textures=[];
    while(off+8<=bytes.length&&textures.length<32){
      var rawFmt=dv.getUint16(off,false),pixFmt=dv.getUint16(off+2,false),w=dv.getUint16(off+4,false),h=dv.getUint16(off+6,false);off+=8;
      if(!w||!h)break;if(w>2048||h>2048)return null;
      var fmt=rawFmt===2?0:(rawFmt===1?5:rawFmt),size=texSize(fmt,w,h);
      if(!size||off+size>bytes.length)return null;
      var canvas=decodeTexture(bytes,off,w,h,fmt);if(!canvas)return null;
      textures.push({canvas:canvas,fmt:fmt,pixFmt:pixFmt,w:w,h:h,mono:(fmt===0||fmt===1||fmt===2||fmt===3)});off+=size;
    }
    if(!textures.length)return null;
    var mainFont=4,best=-1;Object.keys(fontCounts).forEach(function(k){if(fontCounts[k]>best){best=fontCounts[k];mainFont=Number(k);}});
    return {chars:chars,textures:textures,mainFont:mainFont};
  }

  async function upgradeRawFont(){
    if(fontUpgrading)return;
    var gt=window.__pfpSfaGameText;if(!gt||!gt.state||!gt.state.data||!gt.state.data.__browserRaw)return;
    var st=gt.state,data=st.data,pb=st.pathBase;if(!pb||data.__r7RealFont)return;
    fontUpgrading=true;
    try{
      var languages=(data.languages||[]).map(function(l){return l.id||l.label||l;});
      var allGlyphs=[],allCharsets=[],allPages=[],charsetByLang={};
      for(var li=0;li<languages.length;li++){
        var lang=languages[li];
        var candidates=(data.files||[]).filter(function(f){return f.language===lang;}).sort(function(a,b){return (a.sequenceId!=null)-(b.sequenceId!=null);});
        var parsed=null,source=null;
        for(var ci=0;ci<Math.min(candidates.length,16);ci++){
          source=candidates[ci];var raw=await mountedBytes(pb+'/gametext/'+source.path);if(!raw)continue;
          parsed=parseEmbeddedFont(raw);if(parsed&&parsed.chars.length>20)break;parsed=null;
        }
        if(!parsed)continue;
        var pageBase=allPages.length,charset={};
        parsed.textures.forEach(function(t){allPages.push(t.canvas);});
        parsed.chars.forEach(function(ch){
          if(ch.tex>=parsed.textures.length)return;
          var t=parsed.textures[ch.tex],gi=allGlyphs.length;
          allGlyphs.push({code:ch.code,font:ch.font,left:ch.left,right:ch.right,top:ch.top,bottom:ch.bottom,w:ch.w,h:ch.h,mono:t.mono,page:pageBase+ch.tex,x:ch.x,y:ch.y});
          charset[ch.font+':'+ch.code]=gi;
        });
        if(Object.keys(charset).length){allCharsets.push(charset);charsetByLang[lang]=allCharsets.length-1;if(li===0)data.mainFont=parsed.mainFont;}
      }
      if(!allGlyphs.length||!allPages.length)return;
      (data.files||[]).forEach(function(f){if(charsetByLang[f.language]!=null){f.charset=charsetByLang[f.language];var cs=allCharsets[f.charset],counts={};Object.keys(cs).forEach(function(k){var font=Number(k.split(':')[0]);counts[font]=(counts[font]||0)+1;});var mf=data.mainFont,b=-1;Object.keys(counts).forEach(function(k){if(counts[k]>b){b=counts[k];mf=Number(k);}});f.defaultFont=mf;}});
      data.glyphs=allGlyphs;data.charsets=allCharsets;data.atlasPages=allPages.length;data.__r7RealFont=true;
      st.atlas=allPages;if(st.tintCache&&st.tintCache.clear)st.tintCache.clear();
      if(st.visible&&typeof gt.setVisible==='function'){
        gt.setVisible(false);setTimeout(function(){try{gt.setVisible(true);}catch(_){}},0);
      }
      console.info('[FoxPlanet R7] GameText now uses embedded game font textures:',pb,allGlyphs.length,'glyphs');
    }catch(e){console.warn('[FoxPlanet R7] embedded GameText font upgrade failed',e);}
    finally{fontUpgrading=false;}
  }

  function install(){
    installLandingCss();compactLanding();wrapMountApi();patchFolderButton();
    captureEntries();patchFetcher(window.main&&window.main.dataFetcher);upgradeRawFont();
  }

  var obs=new MutationObserver(install);obs.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pfp-r7-data-ready',function(){setTimeout(function(){captureEntries();upgradeRawFont();},30);});
  window.addEventListener('load',function(){setTimeout(install,40);setTimeout(restoreCachedGameData,250);setTimeout(install,700);});
  setInterval(install,150);
})();