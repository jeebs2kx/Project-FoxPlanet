(function(){
  'use strict';
  if(window.__PFP_WEB_FIXES_R9)return;
  window.__PFP_WEB_FIXES_R9=true;

  var fontBusy=false;
  var rendererPatched=false;
  var gameTextPatched=false;

  function sleep(ms){return new Promise(function(resolve){window.setTimeout(resolve,ms);});}
  function cleanPath(p){return String(p||'').replace(/\\/g,'/').replace(/^\/+/, '').replace(/\/+/g,'/');}

  function installLandingCss(){
    if(document.getElementById('pfp-web-r9-layout'))return;
    var s=document.createElement('style');
    s.id='pfp-web-r9-layout';
    s.textContent=`
body[data-landing="1"] #landing-version{transform:translateY(-66px)!important;margin:0 auto -62px!important;}
body[data-landing="1"] #landing-version .landing-patch-card{width:min(478px,calc(100% - 66px))!important;padding:2px 6px 3px!important;margin:0 auto!important;}
body[data-landing="1"] #landing-version .landing-patch-title{font-size:8px!important;line-height:1!important;margin-bottom:1px!important;}
body[data-landing="1"] #landing-version .landing-patch-lines{font-size:6.65px!important;line-height:1.01!important;column-gap:7px!important;}
body[data-landing="1"] #landing-version .landing-patch-col{gap:0!important;}
body[data-landing="1"] #landing-version .landing-patch-wide{margin-top:0!important;}
`;
    document.head.appendChild(s);
  }

  function cardForLogo(img){
    var e=img,best=null;
    for(var i=0;i<7&&e;i++,e=e.parentElement){
      var r=e.getBoundingClientRect();
      if(r.width>350&&r.width<850&&r.height>90&&r.height<310)best=e;
    }
    return best;
  }

  function compactLanding(){
    if(!document.body||document.body.dataset.landing!=='1')return;
    var names=['48f1fc0f8c5be9e9c584.png','a42fc47a0a079a2980f2.png'],cards=[];
    document.querySelectorAll('img').forEach(function(img){
      var n=(img.getAttribute('src')||'').split('/').pop().split('?')[0];
      if(names.indexOf(n)<0)return;
      var c=cardForLogo(img);if(c&&cards.indexOf(c)<0)cards.push(c);
      img.style.setProperty('max-height','82px','important');
      img.style.setProperty('max-width','245px','important');
      img.style.setProperty('object-fit','contain','important');
    });
    cards.forEach(function(card){
      card.dataset.pfpR9GameCard='1';
      card.style.setProperty('height','112px','important');
      card.style.setProperty('min-height','112px','important');
      card.style.setProperty('max-height','112px','important');
      card.style.setProperty('padding','4px 8px','important');
      card.style.setProperty('box-sizing','border-box','important');
    });
    if(cards.length){
      var grid=cards[0].parentElement;
      if(grid){grid.style.setProperty('gap','7px','important');grid.style.setProperty('row-gap','7px','important');}
      var panel=grid&&grid.parentElement;
      if(panel){panel.style.setProperty('height','min(520px, calc(100vh - 226px))','important');panel.style.setProperty('min-height','0','important');panel.style.setProperty('overflow','hidden','important');}
    }
  }

  function ensureSessionMount(){
    try{
      var f=window.main&&window.main.dataFetcher,m=window.__PFP_SESSION_MOUNT;
      if(!f||!m||!Array.isArray(f.mounts))return false;
      if(f.mounts.indexOf(m)<0){
        f.mounts.unshift(m);
        try{if(f.completedCache&&typeof f.completedCache.clear==='function')f.completedCache.clear();}catch(_){}
      }
      window.__PFP_LOCAL_MOUNT_ACTIVE=true;
      return true;
    }catch(_){return false;}
  }

  function mountedPaths(prefix){
    prefix=cleanPath(prefix).toLowerCase();
    var f=window.main&&window.main.dataFetcher,out=[];
    if(!f||!Array.isArray(f.mounts))return out;
    var seen=new Set();
    f.mounts.forEach(function(m){
      if(!m||!(m.entries instanceof Map))return;
      m.entries.forEach(function(_,k){k=cleanPath(k).toLowerCase();if(k.indexOf(prefix)===0&&!seen.has(k)){seen.add(k);out.push(k);}});
    });
    return out;
  }

  function hasRawGameText(pb){
    return mountedPaths(String(pb||'').toLowerCase()+'/gametext/').some(function(p){return /\.bin$/i.test(p);});
  }

  async function mountedBytes(path){
    ensureSessionMount();
    var f=window.main&&window.main.dataFetcher;if(!f||typeof f.fetchData!=='function')return null;
    try{
      var d=await f.fetchData(path,{allow404:true});
      if(!d||!d.byteLength)return null;
      return d.createTypedArray(Uint8Array);
    }catch(_){return null;}
  }

  function texFmtInfo(fmt){
    if(fmt===0)return {bw:8,bh:8,bytes:32};
    if(fmt===1||fmt===2)return {bw:8,bh:4,bytes:32};
    if(fmt===3||fmt===4||fmt===5)return {bw:4,bh:4,bytes:32};
    if(fmt===6)return {bw:4,bh:4,bytes:64};
    return null;
  }
  function texSize(fmt,w,h){var i=texFmtInfo(fmt);return i?Math.ceil(w/i.bw)*Math.ceil(h/i.bh)*i.bytes:0;}
  function expand5(v){return (v<<3)|(v>>2);}function expand6(v){return (v<<2)|(v>>4);}function expand4(v){return (v<<4)|v;}function expand3(v){return (v<<5)|(v<<2)|(v>>1);}

  function decodeTexture(bytes,off,w,h,fmt){
    var info=texFmtInfo(fmt);if(!info)return null;
    var c=document.createElement('canvas');c.width=w;c.height=h;
    var ctx=c.getContext('2d'),im=ctx.createImageData(w,h),dst=im.data,p=off;
    function px(x,y,r,g,b,a){if(x<0||y<0||x>=w||y>=h)return;var q=(y*w+x)*4;dst[q]=r;dst[q+1]=g;dst[q+2]=b;dst[q+3]=a;}
    for(var by=0;by<h;by+=info.bh){for(var bx=0;bx<w;bx+=info.bw){
      var x,y,v;
      if(fmt===0){
        for(y=0;y<8;y++)for(x=0;x<8;x+=2){v=bytes[p++]||0;var a=(v>>>4)*17,b=(v&15)*17;px(bx+x,by+y,255,255,255,a);px(bx+x+1,by+y,255,255,255,b);}
      }else if(fmt===1){
        for(y=0;y<4;y++)for(x=0;x<8;x++){v=bytes[p++]||0;px(bx+x,by+y,255,255,255,v);}
      }else if(fmt===2){
        for(y=0;y<4;y++)for(x=0;x<8;x++){v=bytes[p++]||0;var al=(v>>>4)*17,it=(v&15)*17;px(bx+x,by+y,it,it,it,al);}
      }else if(fmt===3){
        for(y=0;y<4;y++)for(x=0;x<4;x++){var al8=bytes[p++]||0,it8=bytes[p++]||0;px(bx+x,by+y,it8,it8,it8,al8);}
      }else if(fmt===4){
        for(y=0;y<4;y++)for(x=0;x<4;x++){v=((bytes[p++]||0)<<8)|(bytes[p++]||0);px(bx+x,by+y,expand5((v>>>11)&31),expand6((v>>>5)&63),expand5(v&31),255);}
      }else if(fmt===5){
        for(y=0;y<4;y++)for(x=0;x<4;x++){v=((bytes[p++]||0)<<8)|(bytes[p++]||0);if(v&0x8000)px(bx+x,by+y,expand5((v>>>10)&31),expand5((v>>>5)&31),expand5(v&31),255);else px(bx+x,by+y,expand4((v>>>8)&15),expand4((v>>>4)&15),expand4(v&15),expand3((v>>>12)&7));}
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
    off+=strDataLen;if(off+4>bytes.length)return null;
    var unk=dv.getUint32(off,false);off+=4;if(off+unk>bytes.length)return null;off+=unk;
    var textures=[];
    while(off+8<=bytes.length&&textures.length<32){
      var rawFmt=dv.getUint16(off,false),pixFmt=dv.getUint16(off+2,false),w=dv.getUint16(off+4,false),h=dv.getUint16(off+6,false);off+=8;
      if(!w||!h)break;if(w>2048||h>2048)return null;
      var fmt=rawFmt===2?0:(rawFmt===1?5:rawFmt),size=texSize(fmt,w,h);
      if(!size||off+size>bytes.length)return null;
      var canvas=decodeTexture(bytes,off,w,h,fmt);if(!canvas)return null;
      textures.push({canvas:canvas,mono:(fmt===0||fmt===1||fmt===2||fmt===3),pixFmt:pixFmt});off+=size;
    }
    if(!textures.length)return null;
    var mainFont=4,best=-1;Object.keys(fontCounts).forEach(function(k){if(fontCounts[k]>best){best=fontCounts[k];mainFont=Number(k);}});
    return {chars:chars,textures:textures,mainFont:mainFont};
  }

  async function upgradeGameTextFont(){
    if(fontBusy)return false;
    var gt=window.__pfpSfaGameText,st=gt&&gt.state,data=st&&st.data;
    if(!gt||!st||!data||!data.__browserRaw||data.__r9RealFont||!st.pathBase)return false;
    fontBusy=true;
    try{
      var files=(data.files||[]).slice();
      files.sort(function(a,b){
        var ae=/^english$/i.test(String(a.language||''))?0:1,be=/^english$/i.test(String(b.language||''))?0:1;
        if(ae!==be)return ae-be;
        return (a.sequenceId==null?0:1)-(b.sequenceId==null?0:1);
      });
      var parsed=null;
      for(var i=0;i<Math.min(files.length,24);i++){
        var raw=await mountedBytes(st.pathBase+'/gametext/'+files[i].path);if(!raw)continue;
        parsed=parseEmbeddedFont(raw);if(parsed&&parsed.chars.length>20)break;parsed=null;
      }
      if(!parsed)return false;
      var pages=parsed.textures.map(function(t){return t.canvas;}),glyphs=[],charset={};
      parsed.chars.forEach(function(ch){
        if(ch.tex>=parsed.textures.length)return;
        var t=parsed.textures[ch.tex],idx=glyphs.length;
        glyphs.push({code:ch.code,font:ch.font,left:ch.left,right:ch.right,top:ch.top,bottom:ch.bottom,w:ch.w,h:ch.h,mono:t.mono,page:ch.tex,x:ch.x,y:ch.y});
        charset[ch.font+':'+ch.code]=idx;
      });
      if(!glyphs.length)return false;
      data.glyphs=glyphs;data.charsets=[charset];data.atlasPages=pages.length;data.mainFont=parsed.mainFont;data.__r9RealFont=true;
      (data.files||[]).forEach(function(f){if(!/japanese/i.test(String(f.language||''))){f.charset=0;f.defaultFont=parsed.mainFont;}});
      st.atlas=pages;if(st.tintCache&&st.tintCache.clear)st.tintCache.clear();
      console.info('[FoxPlanet R9] embedded GameText font ready:',st.pathBase,glyphs.length,'glyphs');
      return true;
    }catch(e){console.warn('[FoxPlanet R9] embedded GameText font',e);return false;}
    finally{fontBusy=false;}
  }

  function resetDestroyedGameTextPanel(st){
    try{
      if(st.panel&&/^GameText\/Subs error:/i.test(String(st.panel.textContent||'').trim())){
        st.panel.remove();st.panel=null;
      }
    }catch(_){}
  }

  function dispatchRawGameTextRequest(){
    try{window.dispatchEvent(new CustomEvent('pfp-local-data-mounted',{detail:{kind:'r9-gametext-request'}}));}catch(_){}
  }

  async function openRawGameText(gt,oldSetVisible){
    var st=gt.state,pb=st.pathBase;
    if(!pb||!hasRawGameText(pb))return oldSetVisible.call(gt,true);
    if(st.__pfpR9Opening)return st.__pfpR9Opening;
    st.visible=true;
    try{if(st.toggle&&st.toggle._cb)st.toggle._cb.checked=true;}catch(_){}
    st.__pfpR9Opening=(async function(){
      dispatchRawGameTextRequest();
      for(var i=0;i<120;i++){
        if(st.data&&st.data._pathBase===pb)break;
        if(st.pathBase!==pb)return false;
        if(i===20||i===60)dispatchRawGameTextRequest();
        await sleep(50);
      }
      if(st.data&&st.data._pathBase===pb){
        await upgradeGameTextFont();
        resetDestroyedGameTextPanel(st);
        oldSetVisible.call(gt,true);
        return true;
      }
      oldSetVisible.call(gt,true);
      return false;
    })();
    try{return await st.__pfpR9Opening;}finally{st.__pfpR9Opening=null;}
  }

  function patchGameText(){
    var gt=window.__pfpSfaGameText;if(!gt||!gt.state)return false;
    if(gameTextPatched)return true;
    gameTextPatched=true;
    var oldSetVisible=gt.setVisible;
    if(typeof oldSetVisible==='function'){
      gt.setVisible=function(v){
        if(!v)return oldSetVisible.call(gt,false);
        var st=gt.state;
        if(st&&st.pathBase&&hasRawGameText(st.pathBase)&&(!st.data||st.data.__browserRaw))return openRawGameText(gt,oldSetVisible);
        return oldSetVisible.call(gt,true);
      };
    }
    ['bindExternalSequence','bindExternalSequenceDirect'].forEach(function(name){
      if(typeof gt[name]!=='function')return;
      var old=gt[name];
      gt[name]=async function(){var r=await old.apply(gt,arguments);await upgradeGameTextFont();return r;};
    });

    document.addEventListener('change',function(e){
      try{
        var st=gt.state,cb=st&&st.toggle&&st.toggle._cb;
        if(e.target!==cb||!cb.checked||!st.pathBase||!hasRawGameText(st.pathBase))return;
        e.preventDefault();e.stopImmediatePropagation();gt.setVisible(true);
      }catch(_){}
    },true);
    return true;
  }

  function patchFinalRuntime(rt){
    if(!rt||rt.__pfpR9Runtime)return;
    rt.__pfpR9Runtime=true;
    if(rt.pathBase!=='StarFoxAdventures')return;
    if(typeof rt.buildEntries==='function'&&typeof rt.buildEntriesKiosk==='function'){
      var oldBuild=rt.buildEntries;
      rt.buildEntries=async function(){
        try{return await oldBuild.apply(this,arguments);}
        catch(e){
          console.warn('[FoxPlanet R9] Final sequence ownership API unavailable; using local Final objects.',e);
          return this.buildEntriesKiosk();
        }
      };
    }
    var attempt=0;
    async function recover(){
      if(!rt||rt.dead||rt.pathBase!=='StarFoxAdventures')return;
      attempt++;
      try{
        if((!rt.dirTables||!rt.dirTables.size)&&typeof rt.loadTables==='function')await rt.loadTables();
        if((!rt.entries||!rt.entries.length)&&rt.dirTables&&rt.dirTables.size&&typeof rt.buildEntriesKiosk==='function'){
          await rt.buildEntriesKiosk();
          if(typeof rt.refreshList==='function')rt.refreshList();
          if(rt.entries&&rt.entries.length&&typeof rt.setStatus==='function')rt.setStatus(rt.entries.length+' local Final SFA sequence'+(rt.entries.length===1?'':'s')+' found.');
        }
      }catch(e){if(attempt===1)console.warn('[FoxPlanet R9] Final local sequence recovery',e);}
      if((!rt.entries||!rt.entries.length)&&attempt<4)window.setTimeout(recover,500*attempt);
    }
    window.setTimeout(recover,350);
  }

  function patchRenderer(){
    var C=window.__pfpSfaWorldRendererClassV6;
    if(!C||!C.prototype||rendererPatched)return !!rendererPatched;
    var old=C.prototype.update;if(typeof old!=='function')return false;
    rendererPatched=true;
    C.prototype.update=function(viewerInput){
      var mainFetcher=window.main&&window.main.dataFetcher;
      try{
        ensureSessionMount();
        mainFetcher=window.main&&window.main.dataFetcher;
        if(mainFetcher&&window.__PFP_LOCAL_MOUNT_ACTIVE&&this.world&&this.world.context&&this.world.context.dataFetcher!==mainFetcher)this.world.context.dataFetcher=mainFetcher;
      }catch(_){}
      var out=old.call(this,viewerInput);
      try{
        var rt=this.__pfpMapSequenceRuntime;
        if(rt){
          if(mainFetcher&&window.__PFP_LOCAL_MOUNT_ACTIVE&&rt.fetcher!==mainFetcher)rt.fetcher=mainFetcher;
          patchFinalRuntime(rt);
        }
      }catch(e){console.warn('[FoxPlanet R9] SFA runtime bridge',e);}
      return out;
    };
    return true;
  }

  function onMapChange(){
    ensureSessionMount();
    window.setTimeout(ensureSessionMount,40);
    window.setTimeout(ensureSessionMount,180);
    window.setTimeout(function(){patchGameText();patchRenderer();upgradeGameTextFont();},300);
  }

  function installOnce(){installLandingCss();compactLanding();patchGameText();patchRenderer();ensureSessionMount();upgradeGameTextFont();}
  installOnce();
  window.addEventListener('load',function(){installOnce();window.setTimeout(installOnce,250);window.setTimeout(installOnce,900);});
  window.addEventListener('hashchange',onMapChange,true);
  window.addEventListener('popstate',onMapChange,true);
  window.addEventListener('pfp-local-data-mounted',function(){window.setTimeout(function(){ensureSessionMount();patchGameText();patchRenderer();},40);});

  var tries=0;
  (function retry(){
    installLandingCss();compactLanding();
    var a=patchGameText(),b=patchRenderer();
    if((a&&b)||++tries>120)return;
    window.setTimeout(retry,50);
  })();
})();
