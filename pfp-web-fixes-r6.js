(function(){
  'use strict';
  if(window.__PFP_WEB_FIXES_R6)return;
  window.__PFP_WEB_FIXES_R6=true;

  var rememberedMount=null;
  var rememberedFetcher=null;

  function status(text){var e=document.getElementById('pfp-web-data-status');if(e)e.textContent=text;}

  function installLayout(){
    if(document.getElementById('pfp-web-r6-layout'))return;
    var s=document.createElement('style');
    s.id='pfp-web-r6-layout';
    s.textContent=`
body[data-landing="1"] #landing-version{
  transform:translateY(-58px)!important;
  margin:0 auto -54px!important;
}
body[data-landing="1"] #landing-version .landing-patch-card{
  width:min(480px,calc(100% - 64px))!important;
  padding:2px 6px 3px!important;
  margin:0 auto!important;
}
body[data-landing="1"] #landing-version .landing-patch-title{
  font-size:8px!important;
  line-height:1!important;
  margin-bottom:1px!important;
}
body[data-landing="1"] #landing-version .landing-patch-lines{
  font-size:6.65px!important;
  line-height:1.01!important;
  column-gap:7px!important;
}
body[data-landing="1"] #landing-version .landing-patch-col{gap:0!important;}
body[data-landing="1"] #landing-version .landing-patch-wide{margin-top:0!important;}
body[data-landing="1"] [data-pfp-game-card]{height:122px!important;max-height:122px!important;}
body[data-landing="1"] [data-pfp-game-card] img{max-height:84px!important;width:198px!important;}
`;
    document.head.appendChild(s);
  }

  function compactLanding(){
    if(!document.body||document.body.dataset.landing!=='1')return;
    var nodes=Array.from(document.querySelectorAll('div,span,h1,h2,h3')).filter(function(el){
      return (el.textContent||'').trim().toUpperCase()==='SELECT GAME'&&el.getBoundingClientRect().width>0;
    });
    if(!nodes.length)return;
    nodes.sort(function(a,b){return b.getBoundingClientRect().left-a.getBoundingClientRect().left;});
    var title=nodes[0],box=title.parentElement,grid=title.nextElementSibling;
    if(box){
      box.style.setProperty('height','min(560px, calc(100vh - 210px))','important');
      box.style.setProperty('padding','8px 14px 8px','important');
      box.style.setProperty('gap','6px','important');
      box.style.setProperty('overflow','hidden','important');
    }
    if(grid){
      grid.style.setProperty('gap','6px','important');
      Array.from(grid.children).forEach(function(card){
        card.dataset.pfpGameCard='1';
        card.style.setProperty('height','122px','important');
        var img=card.querySelector('img');
        if(img){
          img.style.setProperty('max-height','84px','important');
          img.style.setProperty('width','198px','important');
        }
      });
    }
  }

  function latestMount(){
    var f=window.main&&window.main.dataFetcher;
    if(!f||!Array.isArray(f.mounts)||!f.mounts.length)return null;
    for(var i=0;i<f.mounts.length;i++){
      var m=f.mounts[i];
      if(m&&(m.entries instanceof Map||/ISO|GameData|Dinosaur Planet/i.test(String(m.label||''))))return m;
    }
    return f.mounts[0]||null;
  }

  function rememberCurrentMount(){
    var f=window.main&&window.main.dataFetcher,m=latestMount();
    if(!f||!m)return;
    rememberedFetcher=f;
    rememberedMount=m;
    window.__PFP_LOCAL_MOUNT_ACTIVE=true;
    window.__PFP_SESSION_MOUNT=rememberedMount;
  }

  function keepMountAlive(){
    if(!rememberedMount)return;
    var f=window.main&&window.main.dataFetcher;
    if(!f||!Array.isArray(f.mounts))return;
    if(f.mounts.indexOf(rememberedMount)<0){
      f.mounts.unshift(rememberedMount);
      try{if(f.completedCache&&typeof f.completedCache.clear==='function')f.completedCache.clear();}catch(_){}
    }
    rememberedFetcher=f;
    window.__PFP_LOCAL_MOUNT_ACTIVE=true;
  }

  function wrapApi(){
    var api=window.__PFP_WEB_LOCAL_DATA;
    if(!api||api.__r6Wrapped)return;
    api.__r6Wrapped=true;
    ['mountFolderFiles','mountSfaIso','mountKioskIso','mountDpRom'].forEach(function(name){
      if(typeof api[name]!=='function')return;
      var old=api[name];
      api[name]=async function(){
        var r=await old.apply(api,arguments);
        rememberCurrentMount();
        return r;
      };
    });
  }

  function oldStyleFolderPicker(){
    return new Promise(function(resolve){
      var input=document.createElement('input');
      input.type='file';
      input.style.display='none';
      input.webkitdirectory=true;
      input.multiple=true;
      document.body.appendChild(input);
      input.addEventListener('change',function(){
        var files=Array.from(input.files||[]);
        input.remove();
        resolve(files);
      },{once:true});
      input.addEventListener('cancel',function(){input.remove();resolve([]);},{once:true});
      input.click();
    });
  }

  function patchFolderButton(){
    var modal=document.getElementById('pfp-web-data-modal');
    if(!modal)return;
    var buttons=Array.from(modal.querySelectorAll('.pfp-web-choice'));
    var b=buttons.find(function(x){return (x.textContent||'').trim().toUpperCase()==='EXISTING GAMEDATA FOLDER';});
    if(!b||b.dataset.r6==='1')return;
    b.dataset.r6='1';
    b.onclick=async function(e){
      if(e){e.preventDefault();e.stopPropagation();}
      try{
        status('Choose your FoxPlanet GameData folder...');
        var files=await oldStyleFolderPicker();
        if(!files.length){status('Nothing loaded yet.');return;}
        status('Reading GameData...');
        var api=window.__PFP_WEB_LOCAL_DATA;
        if(!api||typeof api.mountFolderFiles!=='function')throw new Error('FoxPlanet data loader is not ready yet.');
        var r=await api.mountFolderFiles(files);
        rememberCurrentMount();
        status('GameData ready - '+r.files+' files. It will stay loaded while you move between FoxPlanet maps/screens in this tab.');
      }catch(err){
        status('Could not load it. '+(err&&err.message?err.message:String(err)));
      }
    };
  }

  function install(){
    installLayout();
    compactLanding();
    wrapApi();
    patchFolderButton();
    keepMountAlive();
  }

  var obs=new MutationObserver(install);
  obs.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',function(){setTimeout(install,50);setTimeout(install,500);});
  setInterval(install,120);
})();