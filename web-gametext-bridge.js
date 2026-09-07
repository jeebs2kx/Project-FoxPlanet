(function(){
  'use strict';
  if (window.__PFP_WEB_FIXES_R5) return;
  window.__PFP_WEB_FIXES_R5 = true;

  var DB_NAME = 'project-foxplanet-local-files';
  var DB_STORE = 'handles';
  var FOLDER_KEY = 'gamedata-folder';
  var restoring = false;
  var rawBuilds = Object.create(null);

  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function cleanPath(path){ return String(path || '').replace(/\\/g,'/').replace(/^\/+/, '').replace(/\/+/g,'/'); }

  function installLayoutFix(){
    if (document.getElementById('pfp-web-r5-layout')) return;
    var s = document.createElement('style');
    s.id = 'pfp-web-r5-layout';
    s.textContent = `
body[data-landing="1"] #landing-version {
  transform:translateY(-38px) !important;
  margin:0 auto -36px !important;
}
body[data-landing="1"] #landing-version .landing-patch-card {
  width:min(500px,calc(100% - 54px)) !important;
  margin:0 auto 0 !important;
  padding:3px 7px 4px !important;
}
body[data-landing="1"] #landing-version .landing-patch-title {
  font-size:8.5px !important;
  line-height:1 !important;
  margin-bottom:1px !important;
}
body[data-landing="1"] #landing-version .landing-patch-lines {
  font-size:7px !important;
  line-height:1.03 !important;
  column-gap:8px !important;
}
body[data-landing="1"] #landing-version .landing-patch-col { gap:0 !important; }
body[data-landing="1"] #landing-version .landing-patch-wide { margin-top:0 !important; }
body[data-landing="1"] [data-pfp-game-card],
body[data-landing="1"] .landing-game-card { max-height:132px !important; }
`;
    document.head.appendChild(s);
  }

  function compactGamePicker(){
    if (!document.body || document.body.dataset.landing !== '1') return;
    var nodes = Array.from(document.querySelectorAll('div,span,h1,h2,h3')).filter(function(el){
      return (el.textContent || '').trim().toUpperCase() === 'SELECT GAME' && el.getBoundingClientRect().width > 0;
    });
    if (!nodes.length) return;
    nodes.sort(function(a,b){ return b.getBoundingClientRect().left - a.getBoundingClientRect().left; });
    var title = nodes[0], landing = title.parentElement, grid = title.nextElementSibling;
    if (landing){
      landing.style.height = 'min(592px, calc(100vh - 198px))';
      landing.style.padding = '10px 16px 9px';
      landing.style.gap = '7px';
      landing.style.overflow = 'hidden';
    }
    if (grid){
      grid.style.gap = '7px';
      Array.from(grid.children).forEach(function(card){
        card.dataset.pfpGameCard = '1';
        card.style.height = '132px';
        var img = card.querySelector('img');
        if (img){ img.style.maxHeight = '94px'; img.style.width = '210px'; }
      });
    }
  }

  function latestMapMount(){
    var f = window.main && window.main.dataFetcher;
    if (!f || !Array.isArray(f.mounts)) return null;
    for (var i=0;i<f.mounts.length;i++) if (f.mounts[i] && f.mounts[i].entries instanceof Map) return f.mounts[i];
    return null;
  }

  function addAlias(mount, path, entry){
    try {
      if (mount && typeof mount.add === 'function') mount.add(path, entry);
      else if (mount && mount.entries instanceof Map) mount.entries.set(cleanPath(path).toLowerCase(), entry);
    } catch(_) {}
  }

  function fixMountAliases(mount, prefixHint){
    if (!mount || !(mount.entries instanceof Map)) return 0;
    var before = mount.entries.size;
    var rows = Array.from(mount.entries.entries());
    rows.forEach(function(pair){
      var key = cleanPath(pair[0]).toLowerCase(), entry = pair[1], m;
      m = key.match(/^(starfoxadventuresdemo|starfoxadventures)\/files\/(.+)$/i);
      if (m) addAlias(mount, m[1] + '/' + m[2], entry);
      if (prefixHint && key.indexOf('files/') === 0)
        addAlias(mount, prefixHint + '/' + key.slice(6), entry);
      m = key.match(/(?:^|\/)gamedata\/(starfoxadventuresdemo|starfoxadventures|dinosaurplanet)\/(.+)$/i);
      if (m) addAlias(mount, m[1] + '/' + m[2], entry);
    });
    try {
      var f = window.main && window.main.dataFetcher;
      if (f && f.completedCache && typeof f.completedCache.clear === 'function') f.completedCache.clear();
    } catch(_) {}
    return mount.entries.size - before;
  }

  function dispatchMounted(kind){
    try { window.dispatchEvent(new CustomEvent('pfp-local-data-mounted',{detail:{kind:kind||'data'}})); } catch(_) {}
  }

  function wrapLocalApi(){
    var api = window.__PFP_WEB_LOCAL_DATA;
    if (!api || api.__r5Wrapped) return false;
    api.__r5Wrapped = true;
    if (typeof api.mountFolderFiles === 'function'){
      var oldFolder = api.mountFolderFiles;
      api.mountFolderFiles = async function(files){
        var r = await oldFolder(files);
        fixMountAliases(latestMapMount(), null);
        dispatchMounted('folder');
        return r;
      };
    }
    if (typeof api.mountSfaIso === 'function'){
      var oldSfa = api.mountSfaIso;
      api.mountSfaIso = async function(file){
        var r = await oldSfa(file);
        fixMountAliases(latestMapMount(), 'StarFoxAdventures');
        dispatchMounted('sfa');
        return r;
      };
    }
    if (typeof api.mountKioskIso === 'function'){
      var oldKiosk = api.mountKioskIso;
      api.mountKioskIso = async function(file){
        var r = await oldKiosk(file);
        fixMountAliases(latestMapMount(), 'StarFoxAdventuresDemo');
        dispatchMounted('kiosk');
        return r;
      };
    }
    if (typeof api.mountDpRom === 'function'){
      var oldDp = api.mountDpRom;
      api.mountDpRom = async function(file){
        var r = await oldDp(file); dispatchMounted('dp'); return r;
      };
    }
    return true;
  }

  function openDb(){
    return new Promise(function(resolve,reject){
      if (!window.indexedDB) return resolve(null);
      var q=indexedDB.open(DB_NAME,1);
      q.onupgradeneeded=function(){ if(!q.result.objectStoreNames.contains(DB_STORE)) q.result.createObjectStore(DB_STORE); };
      q.onsuccess=function(){ resolve(q.result); };
      q.onerror=function(){ reject(q.error); };
    });
  }
  async function dbGet(key){
    var db=await openDb(); if(!db)return null;
    return new Promise(function(resolve){
      var tx=db.transaction(DB_STORE,'readonly'), q=tx.objectStore(DB_STORE).get(key);
      q.onsuccess=function(){resolve(q.result||null);}; q.onerror=function(){resolve(null);};
    });
  }
  async function dbPut(key,value){
    var db=await openDb(); if(!db)return;
    return new Promise(function(resolve,reject){
      var tx=db.transaction(DB_STORE,'readwrite'); tx.objectStore(DB_STORE).put(value,key);
      tx.oncomplete=function(){resolve();}; tx.onerror=function(){reject(tx.error);};
    });
  }

  async function filesFromDirectory(handle){
    var out=[];
    async function walk(dir, rel){
      for await (var pair of dir.entries()){
        var name=pair[0], child=pair[1], path=rel ? rel+'/'+name : name;
        if (child.kind === 'directory') await walk(child,path);
        else if (child.kind === 'file'){
          var file=await child.getFile();
          try { Object.defineProperty(file,'webkitRelativePath',{value:handle.name+'/'+path,configurable:true}); }
          catch(_) { try { file.__pfpRelativePath=handle.name+'/'+path; } catch(__){} }
          out.push(file);
        }
      }
    }
    await walk(handle,'');
    return out;
  }

  function modalStatus(text){
    var e=document.getElementById('pfp-web-data-status'); if(e)e.textContent=text;
  }

  async function mountDirectoryHandle(handle, fromRestore){
    if (!handle) return false;
    var perm='granted';
    if (typeof handle.queryPermission === 'function') perm=await handle.queryPermission({mode:'read'});
    if (perm!=='granted') return false;
    modalStatus(fromRestore?'Restoring saved GameData folder...':'Reading GameData...');
    var files=await filesFromDirectory(handle);
    if (!files.length) throw new Error('No files were found in that folder.');
    var api=window.__PFP_WEB_LOCAL_DATA;
    if(!api||typeof api.mountFolderFiles!=='function')throw new Error('FoxPlanet data loader is not ready yet.');
    var r=await api.mountFolderFiles(files);
    window.__PFP_SAVED_FOLDER_ACTIVE=true;
    modalStatus((fromRestore?'Saved GameData restored':'GameData ready')+' - '+r.files+' files. FoxPlanet will keep this folder for later visits on this browser.');
    return true;
  }

  async function choosePersistentFolder(){
    var saved=await dbGet(FOLDER_KEY);
    if(saved && typeof saved.requestPermission==='function'){
      var qp=await saved.queryPermission({mode:'read'});
      if(qp==='prompt') qp=await saved.requestPermission({mode:'read'});
      if(qp==='granted'){
        await mountDirectoryHandle(saved,false); return;
      }
    }
    if (typeof window.showDirectoryPicker === 'function'){
      var h=await window.showDirectoryPicker({id:'project-foxplanet-gamedata',mode:'read'});
      await dbPut(FOLDER_KEY,h);
      await mountDirectoryHandle(h,false);
      return;
    }
    var input=document.createElement('input'); input.type='file'; input.webkitdirectory=true; input.multiple=true; input.style.display='none';
    document.body.appendChild(input);
    var files=await new Promise(function(resolve){
      input.onchange=function(){resolve(Array.from(input.files||[]));input.remove();}; input.click();
    });
    if(files.length){
      var api=window.__PFP_WEB_LOCAL_DATA, r=await api.mountFolderFiles(files);
      modalStatus('GameData ready - '+r.files+' files. This browser does not support persistent folder access, so only a full reload will require choosing it again.');
    }
  }

  async function pickFile(accept){
    var input=document.createElement('input'); input.type='file'; input.accept=accept||''; input.style.display='none'; document.body.appendChild(input);
    return new Promise(function(resolve){
      input.onchange=function(){var f=input.files&&input.files[0];input.remove();resolve(f||null);};
      input.click();
    });
  }

  function patchDataModal(){
    var modal=document.getElementById('pfp-web-data-modal');
    if(!modal||modal.dataset.r5==='1')return;
    modal.dataset.r5='1';
    if(window.__PFP_SAVED_FOLDER_ACTIVE)modalStatus('Saved GameData is already restored and ready.');
    var buttons=Array.from(modal.querySelectorAll('.pfp-web-choice'));
    buttons.forEach(function(b){
      var t=(b.textContent||'').trim().toUpperCase();
      if(t==='EXISTING GAMEDATA FOLDER'){
        b.onclick=async function(e){
          if(e){e.preventDefault();e.stopPropagation();}
          try{await choosePersistentFolder();}catch(err){if(err&&err.name==='AbortError')return;modalStatus('Could not load it. '+(err&&err.message?err.message:err));}
        };
      } else if(t==='STAR FOX ADVENTURES ISO / GCM'){
        b.onclick=async function(e){
          if(e){e.preventDefault();e.stopPropagation();}
          try{var f=await pickFile('.iso,.gcm');if(!f)return;modalStatus('Reading the SFA ISO file table...');var r=await window.__PFP_WEB_LOCAL_DATA.mountSfaIso(f);modalStatus('SFA ready ('+String(r.gameId||'').trim()+') - '+r.files+' files. Sequence paths are ready too.');}
          catch(err){modalStatus('Could not load it. '+(err&&err.message?err.message:err));}
        };
      } else if(t==='KIOSK DEMO ISO / GCM'){
        b.onclick=async function(e){
          if(e){e.preventDefault();e.stopPropagation();}
          try{var f=await pickFile('.iso,.gcm');if(!f)return;modalStatus('Reading the Kiosk ISO file table...');var r=await window.__PFP_WEB_LOCAL_DATA.mountKioskIso(f);modalStatus('Kiosk ready ('+String(r.gameId||'').trim()+') - '+r.files+' files. Sequence paths are ready too.');}
          catch(err){modalStatus('Could not load it. '+(err&&err.message?err.message:err));}
        };
      }
    });
  }

  async function restoreSavedFolder(){
    if(restoring||window.__PFP_LOCAL_MOUNT_ACTIVE)return;
    restoring=true;
    try{
      var h=await dbGet(FOLDER_KEY); if(!h)return;
      var p=typeof h.queryPermission==='function'?await h.queryPermission({mode:'read'}):'prompt';
      if(p==='granted') await mountDirectoryHandle(h,true);
      else modalStatus('Your previous GameData folder is remembered. Click EXISTING GAMEDATA FOLDER once to reconnect it.');
    }catch(e){console.warn('[FoxPlanet web] saved folder restore',e);}
    finally{restoring=false;}
  }

  async function fetchMounted(path){
    var f=window.main&&window.main.dataFetcher;if(!f||typeof f.fetchData!=='function')return null;
    try{var d=await f.fetchData(path,{allow404:true});if(!d||!d.byteLength)return null;return d.createTypedArray(Uint8Array);}catch(_){return null;}
  }
  function mountedPaths(prefix){
    prefix=cleanPath(prefix).toLowerCase();var out=new Set(),f=window.main&&window.main.dataFetcher;
    if(!f||!Array.isArray(f.mounts))return [];
    f.mounts.forEach(function(m){if(m&&m.entries instanceof Map)m.entries.forEach(function(_,k){k=cleanPath(k).toLowerCase();if(k.indexOf(prefix)===0)out.add(k);});});
    return Array.from(out);
  }

  var CTRL_LEN={
    0xF8F2:2,0xF8F3:0,0xF8F4:1,0xF8F5:1,0xF8F6:1,0xF8F7:1,0xF8F8:0,0xF8F9:0,
    0xF8FA:0,0xF8FB:0,0xF8FC:0,0xF8FD:0,0xF8FE:0,0xF8FF:4,0xE000:1,0xE018:3,0xE020:1
  };
  function readU16(bytes,o){return ((bytes[o]||0)<<8)|(bytes[o+1]||0);}
  function readTokens(bytes,start){
    var out=[],text='',o=start,guard=0;
    function flush(){if(text){out.push(text);text='';}}
    function cmd(name,args){flush();out.push(['@',name].concat(args||[]));}
    while(o<bytes.length&&guard++<65536){
      var b=bytes[o++];if(b===0)break;
      var code=b;if(b>=0x80){if(o>=bytes.length)break;code=(b<<8)|bytes[o++];}
      if(code===0xEE80){
        if(o>=bytes.length)break;var c=bytes[o++];
        if(c===0x80&&o+1<bytes.length){var sid=readU16(bytes,o);o+=2;cmd('seqId',[sid]);}
        else if(c===0x98&&o+5<bytes.length){var a=readU16(bytes,o),d=readU16(bytes,o+2),e=readU16(bytes,o+4);o+=6;cmd('seqTime',[a,d,e]);}
        continue;
      }
      if(code===0xEFA3){
        if(o>=bytes.length)break;var r=bytes[o++];
        if(r===0xB4&&o+1<bytes.length){var sc=readU16(bytes,o);o+=2;cmd('scale',[sc]);}
        else if(r===0xB7&&o+1<bytes.length){var fn=readU16(bytes,o);o+=2;cmd('font',[fn]);}
        else if(r===0xB8)cmd('alignLeft');
        else if(r===0xB9)cmd('alignRight');
        else if(r===0xBA)cmd('alignCenter');
        else if(r===0xBB)cmd('alignFull');
        else if(r===0xBF&&o+7<bytes.length){var col=[];for(var ci=0;ci<8;ci++)col.push(bytes[o++]);cmd('color',col);}
        continue;
      }
      if(Object.prototype.hasOwnProperty.call(CTRL_LEN,code)){
        var n=CTRL_LEN[code],args=[];for(var j=0;j<n&&o+1<bytes.length;j++){args.push(readU16(bytes,o));o+=2;}
        cmd('ctrl'+code.toString(16).toUpperCase(),args);continue;
      }
      try{text+=String.fromCodePoint(code);}catch(_){text+='?';}
    }
    flush();return out;
  }
  function plainTokens(toks){return toks.map(function(t){return typeof t==='string'?t:'';}).join('').replace(/\s+/g,' ').trim();}

  function parseGameText(bytes,path,pb){
    if(!bytes||bytes.byteLength<16)return null;
    var dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),off=0;
    var numChars=dv.getUint32(off,false);off+=4;
    if(numChars>10000||off+numChars*16>dv.byteLength)return null;
    var fontCounts={};
    for(var i=0;i<numChars;i++){
      var fo=off+i*16+14;if(fo<dv.byteLength){var fn=dv.getUint8(fo);fontCounts[fn]=(fontCounts[fn]||0)+1;}
    }
    off+=numChars*16;if(off+4>dv.byteLength)return null;
    var numTexts=dv.getUint16(off,false),strDataLen=dv.getUint16(off+2,false);off+=4;
    if(numTexts>10000||off+numTexts*12>dv.byteLength)return null;
    var recs=[];
    for(i=0;i<numTexts;i++){
      var ro=off+i*12;
      recs.push({id:dv.getUint16(ro,false),numPhrases:dv.getUint16(ro+2,false),window:dv.getInt8(ro+4),alignH:dv.getInt8(ro+5),alignV:dv.getInt8(ro+6),languageNo:dv.getInt8(ro+7),phraseIndex:dv.getUint32(ro+8,false)});
    }
    off+=numTexts*12;if(off+4>dv.byteLength)return null;
    var numStrings=dv.getUint32(off,false);off+=4;
    if(numStrings>100000||off+numStrings*4>dv.byteLength)return null;
    var offsets=new Array(numStrings);for(i=0;i<numStrings;i++)offsets[i]=dv.getUint32(off+i*4,false);off+=numStrings*4;
    var strStart=off;
    var prefix=pb.toLowerCase()+'/gametext/';
    var rel=path.toLowerCase().indexOf(prefix)===0?path.slice(prefix.length):path;
    var parts=rel.split('/'),base=parts.pop()||'',dir=parts.join('/')||'Root',seq=null,lang=base.replace(/\.bin$/i,'');
    var sm=base.match(/^(\d+)_([^/]+)\.bin$/i);if(sm){seq=Number(sm[1]);lang=sm[2];dir='Sequences';}
    lang=String(lang||'English').toLowerCase();lang=lang.charAt(0).toUpperCase()+lang.slice(1);
    var bestFont=4,best=-1;Object.keys(fontCounts).forEach(function(k){if(fontCounts[k]>best){best=fontCounts[k];bestFont=Number(k);}});if(!bestFont)bestFont=4;
    var entries=[];
    recs.forEach(function(r){
      var phrases=[];
      for(var p=0;p<r.numPhrases;p++){
        var si=r.phraseIndex+p;if(si<0||si>=offsets.length)continue;
        var so=strStart+offsets[si];if(so<strStart||so>=bytes.length)continue;
        phrases.push(readTokens(bytes,so));
      }
      entries.push({id:r.id,window:r.window,alignH:r.alignH,alignV:r.alignV,phrases:phrases,preview:phrases.map(plainTokens).filter(Boolean).join(' / ')});
    });
    return {path:rel,dir:dir,language:lang,sequenceId:seq,charset:0,defaultFont:bestFont,entries:entries};
  }

  function makeBrowserAtlas(files){
    var cps=new Set();files.forEach(function(f){f.entries.forEach(function(e){e.phrases.forEach(function(ph){ph.forEach(function(t){if(typeof t==='string')for(var ch of t)cps.add(ch.codePointAt(0));});});});});
    for(var cp=32;cp<127;cp++)cps.add(cp);
    var list=Array.from(cps).filter(function(x){return Number.isFinite(x)&&x>=32;}).sort(function(a,b){return a-b;});
    var cellW=22,cellH=26,cols=32,rows=Math.max(1,Math.ceil(list.length/cols)),canvas=document.createElement('canvas');canvas.width=cols*cellW;canvas.height=rows*cellH;
    var ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.font='18px Arial, sans-serif';ctx.textBaseline='alphabetic';ctx.fillStyle='#fff';
    var glyphs=[],charset={};
    list.forEach(function(cp,idx){
      var col=idx%cols,row=Math.floor(idx/cols),x=col*cellW,y=row*cellH,ch;try{ch=String.fromCodePoint(cp);}catch(_){ch='?';}
      var w=Math.max(4,Math.min(cellW-2,Math.ceil(ctx.measureText(ch).width)+2));ctx.fillText(ch,x+1,y+19);
      var gi=glyphs.length;glyphs.push({page:0,x:x,y:y,w:w,h:cellH,left:0,right:1,top:-19,mono:true});
      for(var font=0;font<32;font++)charset[font+':'+cp]=gi;
    });
    return {atlas:[canvas],glyphs:glyphs,charsets:[charset]};
  }

  async function mapLimit(items,limit,fn){
    var out=new Array(items.length),next=0;
    async function worker(){while(true){var i=next++;if(i>=items.length)return;try{out[i]=await fn(items[i],i);}catch(_){out[i]=null;}}}
    var ws=[];for(var k=0;k<Math.min(limit,items.length);k++)ws.push(worker());await Promise.all(ws);return out;
  }

  async function buildRawData(pb){
    var prefix=pb.toLowerCase()+'/gametext/';
    var paths=mountedPaths(prefix).filter(function(p){return /\.bin$/i.test(p)&&p.indexOf('/gametext/')>=0;});
    if(!paths.length)return null;
    var parsed=await mapLimit(paths,6,async function(path){var b=await fetchMounted(path);return b?parseGameText(b,path,pb):null;});
    var files=parsed.filter(function(x){return x&&x.entries&&x.entries.length;});if(!files.length)return null;
    files.sort(function(a,b){return a.path.localeCompare(b.path,undefined,{numeric:true});});
    var langs=Array.from(new Set(files.map(function(f){return f.language;})));
    var preferred=['English','French','German','Spanish','Italian'];langs.sort(function(a,b){var ai=preferred.indexOf(a),bi=preferred.indexOf(b);if(ai<0)ai=99;if(bi<0)bi=99;return ai-bi||a.localeCompare(b);});
    var dirs=Array.from(new Set(files.filter(function(f){return f.sequenceId==null;}).map(function(f){return f.dir;}))).sort();
    var font=makeBrowserAtlas(files);
    return {_pathBase:pb,source:pb,mainFont:4,languages:langs.map(function(l){return{id:l,label:l};}),dirs:dirs,files:files,atlasPages:1,glyphs:font.glyphs,charsets:font.charsets,__browserRaw:true,__atlas:font.atlas};
  }

  async function ensureRawGameText(pb){
    var gt=window.__pfpSfaGameText;if(!gt||!gt.state||!pb)return false;var st=gt.state;
    if(st.data&&st.data._pathBase===pb)return true;
    if(mountedPaths(pb.toLowerCase()+'/gametext_viewer/').some(function(p){return /gametext\.json$/i.test(p);}))return false;
    if(!mountedPaths(pb.toLowerCase()+'/gametext/').some(function(p){return /\.bin$/i.test(p);}))return false;
    if(rawBuilds[pb]){await rawBuilds[pb];return !!(st.data&&st.data._pathBase===pb);}
    var promise=(async function(){
      try{
        var data=await buildRawData(pb);if(!data)return false;
        if(gt.state.pathBase!==pb)return false;
        if(gt.state.data&&gt.state.data._pathBase===pb&&!gt.state.data.__browserRaw)return true;
        gt.state.data=data;gt.state.atlas=data.__atlas||[];gt.state.tintCache&&gt.state.tintCache.clear();
        gt.state.dataPromise=null;
        console.info('[FoxPlanet web] Raw GameText ready:',pb,data.files.length,'files');
        return true;
      }catch(e){console.warn('[FoxPlanet web] raw GameText fallback',e);return false;}
    })();
    rawBuilds[pb]=promise;
    if(!st.dataPromise)st.dataPromise=promise;
    try{return await promise;}finally{if(rawBuilds[pb]===promise)delete rawBuilds[pb];if(st.dataPromise===promise)st.dataPromise=null;}
  }

  function wrapGameTextApi(){
    var gt=window.__pfpSfaGameText;if(!gt||gt.__r5Wrapped)return false;gt.__r5Wrapped=true;
    ['bindExternalSequence','bindExternalSequenceDirect'].forEach(function(name){
      if(typeof gt[name]!=='function')return;var old=gt[name];gt[name]=async function(){
        var args=Array.from(arguments),opts=args[1]||{},pb=opts.pathBase||gt.state.pathBase||'StarFoxAdventures';
        if(typeof gt.activate==='function')gt.activate(pb);
        await ensureRawGameText(pb);return old.apply(gt,args);
      };
    });
    return true;
  }

  async function rawGameTextTick(){
    var gt=window.__pfpSfaGameText;if(!gt||!gt.state)return;var pb=gt.state.pathBase;
    if(!pb||gt.state.data||gt.state.dataPromise)return;
    ensureRawGameText(pb).catch(function(){});
  }

  async function boot(){
    installLayoutFix();
    for(var i=0;i<80&&!wrapLocalApi();i++)await sleep(50);
    wrapGameTextApi();
    patchDataModal(); compactGamePicker();
    for(i=0;i<100;i++){if(window.main&&window.main.dataFetcher)break;await sleep(50);}
    restoreSavedFolder();
  }
  boot();
  window.addEventListener('pfp-local-data-mounted',function(){setTimeout(rawGameTextTick,30);});
  var obs=new MutationObserver(function(){installLayoutFix();compactGamePicker();patchDataModal();wrapLocalApi();wrapGameTextApi();});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(function(){compactGamePicker();patchDataModal();wrapLocalApi();wrapGameTextApi();rawGameTextTick();},120);
})();