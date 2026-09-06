(() => {
  'use strict';
  if (window.__pfpSfaGameText) return;

  const ROOT = location.pathname.includes('/Project-FoxPlanet/') ? '/Project-FoxPlanet/' : '/';
  const STATIC_WEB = location.protocol === 'https:' || (location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/i.test(location.hostname));
  const SOURCE = {
    StarFoxAdventuresDemo: { label: 'Kiosk / Early SFA', accent: '#d9a43b' },
    StarFoxAdventures: { label: 'Final SFA', accent: '#5ba5e8' },
  };
  const LANG_LABEL = { English:'English', French:'Français', German:'Deutsch', Spanish:'Español', Italian:'Italiano' };
  const EARLY_MARKERS = [
    'kiosk:', 'ancient', 'very early 2001', 'early 2001', 'early/mid 2001',
    'mid 2001', 'mid-late 2001', 'mid/later 2001', 'late 2001', 'early 2002'
  ];

  const css = (el, obj) => { Object.assign(el.style, obj); return el; };
  const esc = (s) => String(s == null ? '' : s);
  const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
  const encPath = (s) => String(s || '').split('/').map(encodeURIComponent).join('/');
  const state = {
    pathBase: null, data: null, dataPromise: null, atlas: [], atlasPromise: null,
    toggle: null, panel: null, canvas: null, ctx: null, visible: false,
    language: 'English', mode: 'Sequences', directory: 'All', search: '', items: [], selected: -1,
    timeline: [], elapsed: 0, duration: 1, playing: true, loop: true, lastTs: 0,
    raf: 0, tintCache: new Map(), titleLabel: null, results: null, list: null,
    langSel: null, modeSel: null, dirSel: null, searchInput: null, raw: null,
    playBtn: null, loopCb: null, timeLabel: null, seek: null, sourceToken: 0,
    voiceEnabled: true, voiceCb: null, voiceStatus: null, voiceStreams: [], voicePromise: null,
    voiceAudio: null, voiceUrls: new Map(), voicePath: null, voiceLoadToken: 0, voiceDuckActive: false, voiceStartSeconds: 0, voiceTriggerId: null,
    externalTransport: false, externalOverlay: false, externalSequenceId: null, externalStartSeconds: 0, externalAbsoluteSeconds: 0,
  };

  function classifyTitle() {
    const t = String(document.title || '').toLowerCase();
    if (t.includes('dinosaur planet')) return null;
    const early = EARLY_MARKERS.some((x) => t.includes(x));
    if (early) return 'StarFoxAdventuresDemo';
    if (t.includes('star fox adventures') || t.startsWith('sfa:') || t.includes('final sfa')) return 'StarFoxAdventures';
    return null;
  }

  function uiAllowed() {
    try { return window.main && window.main.ui ? window.main.ui.isVisible !== false : true; }
    catch (_) { return true; }
  }

  function positionToggle() {
    if (!state.toggle) return;
    const keys = ['__sfaHitsToggle','__sfaTextureToggle','__sfaObjectLabelToggle'];
    let right = 2;
    for (const k of keys) {
      const obj = window[k], w = obj && obj.wrap;
      if (!w || w === state.toggle || getComputedStyle(w).display === 'none') continue;
      const r = w.getBoundingClientRect();
      right += Math.max(45, Math.ceil(r.width || w.offsetWidth || 45)) + 5;
    }
    const audio = window.__pfpSfaAudioState && window.__pfpSfaAudioState.wrap;
    if (audio && audio !== state.toggle && getComputedStyle(audio).display !== 'none') {
      const r = audio.getBoundingClientRect(); right += Math.max(45, Math.ceil(r.width || audio.offsetWidth || 45)) + 5;
    }
    state.toggle.style.right = right + 'px';
    state.toggle.style.display = uiAllowed() ? 'flex' : 'none';
  }

  function ensureStyle() {
    if (document.getElementById('pfp-sfa-gametext-style')) return;
    const st = document.createElement('style'); st.id='pfp-sfa-gametext-style';
    st.textContent = `
#pfp-sfa-gametext-panel,#pfp-sfa-gametext-panel *{box-sizing:border-box;color:#eee}
#pfp-sfa-gametext-panel button,#pfp-sfa-gametext-panel select,#pfp-sfa-gametext-panel input{background:#202020;color:#eee;border:1px solid #666;border-radius:2px;font:12px sans-serif}
#pfp-sfa-gametext-panel button{padding:3px 7px;cursor:pointer}#pfp-sfa-gametext-panel button:hover{background:#333}
#pfp-sfa-gametext-panel input[type=range]{accent-color:#78b9ee}.pfp-sfa-gt-row{display:flex;gap:6px;align-items:center;margin:5px 0}
#pfp-sfa-gametext-panel .pfp-sfa-gt-grow{flex:1;min-width:0}#pfp-sfa-gametext-panel option{background:#202020;color:#eee}
`;
    document.head.appendChild(st);
  }

  function ensureToggle() {
    if (state.toggle && document.body.contains(state.toggle)) return;
    const w = css(document.createElement('div'), {
      position:'fixed', top:'2px', zIndex:'10000', padding:'2px 4px', background:'rgba(0,0,0,0.5)',
      color:'#fff', font:'12px sans-serif', borderRadius:'2px', display:'block',
      boxSizing:'border-box', whiteSpace:'nowrap'
    });
    const lab = css(document.createElement('label'), {cursor:'pointer',display:'inline',color:'#fff',font:'12px sans-serif',lineHeight:'normal'});
    const cb = document.createElement('input'); cb.type='checkbox'; cb.style.marginRight='2px'; cb.checked=state.visible;
    lab.append(cb, document.createTextNode('GameText/Subs')); w.appendChild(lab); document.body.appendChild(w);
    cb.addEventListener('change', () => setVisible(cb.checked));
    w._cb = cb; state.toggle=w; window.__sfaGameTextToggle={wrap:w,cb};
    positionToggle();
  }

  function ensureCanvas() {
    if (state.canvas && document.body.contains(state.canvas)) return;
    const c = css(document.createElement('canvas'), {
      position:'fixed', left:'0', top:'0', width:'100vw', height:'100vh', zIndex:'9990', pointerEvents:'none', display:'none'
    });
    c.id='pfp-sfa-gametext-overlay'; c.width=640; c.height=480;
    document.body.appendChild(c); state.canvas=c; state.ctx=c.getContext('2d');
    state.ctx.imageSmoothingEnabled=false;
  }

  function makeRow() { const d=document.createElement('div'); d.className='pfp-sfa-gt-row'; return d; }
  function addLabel(row, text) { const s=document.createElement('span'); s.textContent=text; row.appendChild(s); return s; }

  function ensurePanel() {
    if (state.panel && document.body.contains(state.panel)) return;
    ensureStyle();
    const p = css(document.createElement('div'), {
      position:'fixed', top:'28px', right:'8px', width:'560px', maxWidth:'calc(100vw - 16px)', maxHeight:'72vh', overflow:'auto',
      zIndex:'10001', background:'rgba(8,10,14,.94)', border:'1px solid rgba(255,255,255,.3)', borderRadius:'6px',
      padding:'8px', font:'12px sans-serif', display:'none', boxShadow:'0 7px 24px rgba(0,0,0,.55)'
    });
    p.id='pfp-sfa-gametext-panel';
    const title=css(document.createElement('div'),{fontWeight:'bold',fontSize:'13px',marginBottom:'5px'}); state.titleLabel=title; p.appendChild(title);
    const note=css(document.createElement('div'),{color:'#aaa',marginBottom:'6px',lineHeight:'1.35'});
    note.textContent='Browse the original GameText files or play sequence subtitles on the main screen. Timing and colour commands come from the supplied SFA/Kiosk GameText data.'; p.appendChild(note);

    let r=makeRow(); addLabel(r,'Language'); const lang=document.createElement('select'); lang.className='pfp-sfa-gt-grow'; state.langSel=lang; r.appendChild(lang);
    addLabel(r,'View'); const mode=document.createElement('select'); state.modeSel=mode; for(const x of ['Sequences','GameText']){const o=document.createElement('option');o.value=x;o.textContent=x;mode.appendChild(o);} r.appendChild(mode); p.appendChild(r);
    r=makeRow(); addLabel(r,'Directory'); const dir=document.createElement('select'); dir.className='pfp-sfa-gt-grow'; state.dirSel=dir; r.appendChild(dir); p.appendChild(r);
    r=makeRow(); addLabel(r,'Search'); const search=document.createElement('input'); search.type='search'; search.placeholder='Text, ID, sequence number or directory'; search.className='pfp-sfa-gt-grow'; state.searchInput=search; r.appendChild(search); p.appendChild(r);
    const list=document.createElement('select'); list.size=10; list.style.width='100%'; list.style.fontFamily='monospace'; state.list=list; p.appendChild(list);
    const res=css(document.createElement('div'),{color:'#aaa',margin:'5px 0'}); state.results=res; p.appendChild(res);

    r=makeRow();
    const prev=document.createElement('button');prev.textContent='Prev'; const next=document.createElement('button');next.textContent='Next';
    const play=document.createElement('button');play.textContent='Pause';state.playBtn=play; const restart=document.createElement('button');restart.textContent='Restart';
    const loopLab=css(document.createElement('label'),{display:'inline-flex',alignItems:'center',gap:'3px'}); const loop=document.createElement('input');loop.type='checkbox';loop.checked=true;state.loopCb=loop;loopLab.append(loop,document.createTextNode('Loop'));
    const voiceLab=css(document.createElement('label'),{display:'inline-flex',alignItems:'center',gap:'3px'}); const voice=document.createElement('input');voice.type='checkbox';voice.checked=true;state.voiceCb=voice;voiceLab.append(voice,document.createTextNode('Voice'));
    r.append(prev,next,play,restart,loopLab,voiceLab); p.appendChild(r);
    r=makeRow(); const tl=css(document.createElement('span'),{width:'78px',fontFamily:'monospace'});state.timeLabel=tl; const seek=document.createElement('input');seek.type='range';seek.min='0';seek.max='1';seek.step='0.001';seek.value='0';seek.className='pfp-sfa-gt-grow';state.seek=seek;r.append(tl,seek);p.appendChild(r);
    const voiceStatus=css(document.createElement('div'),{color:'#999',font:'11px sans-serif',margin:'2px 0 4px'});voiceStatus.textContent='Voice: checking for matching stream...';state.voiceStatus=voiceStatus;p.appendChild(voiceStatus);
    const details=document.createElement('details'); details.style.marginTop='5px'; const sum=document.createElement('summary');sum.textContent='Raw commands / strings';details.appendChild(sum); const raw=css(document.createElement('pre'),{whiteSpace:'pre-wrap',font:'11px monospace',color:'#aaa',margin:'6px 0 0'});state.raw=raw;details.appendChild(raw);p.appendChild(details);
    document.body.appendChild(p); state.panel=p;

    lang.addEventListener('change',()=>{state.language=lang.value;rebuildDirectory();rebuildItems();});
    mode.addEventListener('change',()=>{state.mode=mode.value;rebuildDirectory();rebuildItems();});
    dir.addEventListener('change',()=>{state.directory=dir.value;rebuildItems();});
    search.addEventListener('input',()=>{state.search=search.value.trim().toLowerCase();rebuildItems();});
    list.addEventListener('change',()=>selectItem(Number(list.value)));
    prev.addEventListener('click',()=>selectItem(clamp(state.selected-1,0,state.items.length-1)));
    next.addEventListener('click',()=>selectItem(clamp(state.selected+1,0,state.items.length-1)));
    play.addEventListener('click',()=>{state.playing=!state.playing;state.lastTs=performance.now();syncVoiceTransport();syncPlaybackUI();});
    restart.addEventListener('click',()=>{state.elapsed=0;state.playing=true;state.lastTs=performance.now();syncVoiceTransport(true);syncPlaybackUI();drawOverlay();});
    loop.addEventListener('change',()=>{state.loop=loop.checked;});
    voice.addEventListener('change',()=>{state.voiceEnabled=voice.checked;if(!state.voiceEnabled)stopVoice(false);else prepareVoiceForSelected();});
    seek.addEventListener('input',()=>{state.elapsed=Number(seek.value)*state.duration;state.lastTs=performance.now();syncVoiceTransport(true);drawOverlay();syncPlaybackUI();});
  }

  function setVisible(v) {
    state.visible=!!v; ensurePanel(); ensureCanvas();
    if(state.toggle && state.toggle._cb) state.toggle._cb.checked=state.visible;
    state.panel.style.display=state.visible?'block':'none';
    state.canvas.style.display=state.visible?'block':'none';
    if(state.visible){ loadData().then(()=>{populateControls();drawOverlay();}).catch(showError); }
    else { clearCanvas(); stopVoice(false); }
  }

  async function mountedBytes(path) {
    const f=window.main&&window.main.dataFetcher;
    if(!f||typeof f.fetchData!=='function')return null;
    try{
      const d=await f.fetchData(path,{allow404:true});
      if(!d||!d.byteLength)return null;
      return d.createTypedArray(Uint8Array);
    }catch(_){return null;}
  }
  async function mountedJson(path) {
    const b=await mountedBytes(path); if(!b)return null;
    try{return JSON.parse(new TextDecoder('utf-8').decode(b));}catch(_){return null;}
  }
  async function mountedImage(path) {
    const b=await mountedBytes(path); if(!b)return null;
    const url=URL.createObjectURL(new Blob([b],{type:'image/png'}));
    try{return await loadImage(url);}finally{URL.revokeObjectURL(url);}
  }
  async function loadData() {
    if (!state.pathBase) return;
    if (state.data && state.data._pathBase===state.pathBase) return;
    if (state.dataPromise) return state.dataPromise;
    const token=state.sourceToken, pb=state.pathBase;
    state.dataPromise=(async()=>{
      const rel=pb+'/gametext_viewer/gametext.json';
      let d=await mountedJson(rel);
      if(!d&&!STATIC_WEB){
        try{const rr=await fetch(ROOT+rel,{cache:'no-store'});if(rr.ok)d=await rr.json();}catch(_){}
      }
      if(!d)throw new Error(STATIC_WEB?'GameText/Subs needs an existing FoxPlanet GameData folder for now.':'Missing GameText viewer data: '+ROOT+rel);
      d._pathBase=pb;
      const imgs=[];
      for(let i=0;i<d.atlasPages;i++){
        const path=pb+'/gametext_viewer/atlas'+i+'.png';
        let im=await mountedImage(path);
        if(!im&&!STATIC_WEB)im=await loadImage(ROOT+path);
        if(!im)throw new Error('Missing GameText atlas '+i+'.');
        imgs.push(im);
      }
      if(token!==state.sourceToken)return;
      state.data=d;state.atlas=imgs;state.tintCache.clear();
    })();
    try{await state.dataPromise;}finally{state.dataPromise=null;}
  }
  function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Could not load '+src));im.src=src;});}
  function showError(e){console.error('[SFA GameText]',e);ensurePanel();state.panel.style.display='block';state.panel.textContent='GameText/Subs error: '+(e&&e.message?e.message:e);}

  const ADP_FRAME=0x20,ADP_RATE=48000,ADP_FILTERS=[[0,0],[60,0],[115,-52],[98,-55]];
  const sign4=(n)=>((n&=15),n>=8?n-16:n); const clamp16=(v)=>v<-32768?-32768:v>32767?32767:v;
  function adpNib(nib,head,hist){const pred=(head>>>4)&15,range=head&15,cf=ADP_FILTERS[pred&3],sh=sign4(nib)<<Math.max(0,12-range),v=clamp16(sh+((cf[0]*hist.s1+cf[1]*hist.s2+32)>>6));hist.s2=hist.s1;hist.s1=v;return v;}
  function decodeAdpVariant(src,layout){const frames=Math.floor(src.length/ADP_FRAME),pcm=new Int16Array(frames*28*2),lh={s1:0,s2:0},rh={s1:0,s2:0},swapped=layout==='legacy_swapped'||layout==='gcadp_swapped';let dst=0;const push=(b,hl,hr)=>{const hi=b>>>4,lo=b&15,ln=swapped?lo:hi,rn=swapped?hi:lo;pcm[dst++]=adpNib(ln,hl,lh);pcm[dst++]=adpNib(rn,hr,rh);};for(let fr=0;fr<frames;fr++){const base=fr*ADP_FRAME;if(layout==='legacy'||layout==='legacy_swapped'){const h0=src[base],h1=src[base+1],h2=src[base+2],h3=src[base+3];for(let i=0;i<14;i++)push(src[base+4+i],h0,h1);for(let i=0;i<14;i++)push(src[base+18+i],h2,h3);}else{const h0=src[base],h1=src[base+1],h2=src[base+16],h3=src[base+17];for(let i=0;i<14;i++)push(src[base+2+i],h0,h1);for(let i=0;i<14;i++)push(src[base+18+i],h2,h3);}}return pcm;}
  function scoreAdp(pcm){let sc=0,pl=0,pr=0;for(let i=0;i+1<pcm.length;i+=2){const l=pcm[i],r=pcm[i+1],al=Math.abs(l),ar=Math.abs(r),dl=Math.abs(l-pl),dr=Math.abs(r-pr);if(al>=32760)sc+=200;if(ar>=32760)sc+=200;if(dl>24576)sc+=40+((dl-24576)>>8);if(dr>24576)sc+=40+((dr-24576)>>8);if(al>30000)sc+=4;if(ar>30000)sc+=4;pl=l;pr=r;}return sc;}
  function decodeAdp(src){const layouts=['legacy','legacy_swapped','gcadp','gcadp_swapped'];return layouts.map(layout=>{const pcm=decodeAdpVariant(src,layout);return{pcm,score:scoreAdp(pcm)};}).sort((a,b)=>a.score-b.score)[0].pcm;}
  function pcmWav(pcm,sampleRate,channels){const dataSize=pcm.length*2,out=new Uint8Array(44+dataSize),dv=new DataView(out.buffer),asc=(o,t)=>{for(let i=0;i<t.length;i++)out[o+i]=t.charCodeAt(i);};asc(0,'RIFF');dv.setUint32(4,36+dataSize,true);asc(8,'WAVE');asc(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,channels,true);dv.setUint32(24,sampleRate,true);dv.setUint32(28,sampleRate*channels*2,true);dv.setUint16(32,channels*2,true);dv.setUint16(34,16,true);asc(36,'data');dv.setUint32(40,dataSize,true);for(let i=0,p=44;i<pcm.length;i++,p+=2)dv.setInt16(p,pcm[i],true);return new Blob([out],{type:'audio/wav'});}

  async function loadVoiceStreams(){
    if(!state.pathBase||STATIC_WEB)return [];
    if(state.voiceStreams.length)return state.voiceStreams;
    if(state.voicePromise)return state.voicePromise;
    const pb=state.pathBase,token=state.sourceToken;
    state.voicePromise=(async()=>{try{
      const r=await fetch(ROOT+'api/sfa-audio/list-streams?pathBase='+encodeURIComponent(pb),{cache:'no-store'});
      if(!r.ok)return[];
      const j=await r.json();if(token!==state.sourceToken)return[];
      state.voiceStreams=(j.entries||[]).filter(e=>e&&e.path).map(e=>({
        path:e.path,
        streamId:Number.isFinite(Number(e.streamId))?Number(e.streamId):null,
        streamName:e.streamName||null,
      }));
      return state.voiceStreams;
    }catch(_){return[];}finally{state.voicePromise=null;}})();
    return state.voicePromise;
  }
  function sequenceObjectIds(it){const ids=[];if(!it||!it.entry)return ids;for(const ph of it.entry.phrases||[])for(const t of ph||[])if(Array.isArray(t)&&t[0]==='@'&&t[1]==='seqId'&&Number.isFinite(Number(t[2])))ids.push(Number(t[2]));return [...new Set(ids)];}
  function normDir(v){return String(v||'').replace(/\\/g,'/').replace(/^\/+|\/+$/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
  function externalPreferredDirs(options={}){const out=[],add=(v)=>{const n=normDir(v);if(n&&!out.includes(n))out.push(n);};if(Array.isArray(options.textDirs))for(const d of options.textDirs)add(d);add(options.textDir);return out;}
  function chooseExternalItemIndex(predicate,options={}){
    const matches=[];for(let i=0;i<state.items.length;i++){const it=state.items[i];if(predicate(it))matches.push(i);}if(!matches.length)return -1;
    const preferred=externalPreferredDirs(options);
    for(const d of preferred){const exact=matches.filter(i=>normDir(state.items[i]&&state.items[i].file&&state.items[i].file.dir)===d);if(exact.length)return exact[0];}
    return matches.length===1?matches[0]:-1;
  }
  function chooseExternalVoiceSubtitleIndex(streamId,options={}){
    const id=Number(streamId);if(!Number.isFinite(id))return -1;
    const preferredSeq=Number(options.preferSequenceId),preferred=externalPreferredDirs(options);
    const choose=(matches)=>{const pick=(arr)=>{if(!arr.length)return -1;if(Number.isFinite(preferredSeq)){const same=arr.filter(i=>Number(state.items[i]&&state.items[i].file&&state.items[i].file.sequenceId)===preferredSeq);if(same.length===1)return same[0];}return arr.length===1?arr[0]:-1;};for(const d of preferred){const exact=matches.filter(i=>normDir(state.items[i]&&state.items[i].file&&state.items[i].file.dir)===d);const chosen=pick(exact);if(chosen>=0)return chosen;}return pick(matches);};
    const matches=[];for(let i=0;i<state.items.length;i++){const it=state.items[i];if(sequenceObjectIds(it).includes(id))matches.push(i);}let chosen=choose(matches);if(chosen>=0)return chosen;
    if(matches.length===0&&Number.isFinite(preferredSeq)){
      const silent=[];for(let i=0;i<state.items.length;i++){const it=state.items[i];if(Number(it&&it.file&&it.file.sequenceId)===preferredSeq&&sequenceObjectIds(it).length===0)silent.push(i);}chosen=choose(silent);if(chosen>=0)return chosen;
    }
    return -1;
  }
  function voiceCandidatesForId(id){
    const exact=state.voiceStreams.filter(e=>e&&Number(e.streamId)===Number(id)).map(e=>e.path);
    if(exact.length)return [...new Set(exact)];
    const out=[];for(const e of state.voiceStreams){const path=e&&e.path?e.path:e;const base=String(path).split('/').pop().replace(/\.adp$/i,'');const m=base.match(/(\d+)$/);if(m&&Number(m[1])===Number(id))out.push(path);}return [...new Set(out)];
  }
  async function voiceUrl(path){if(state.voiceUrls.has(path))return state.voiceUrls.get(path);const r=await fetch(ROOT+encPath(state.pathBase)+'/streams/'+encPath(path),{cache:'no-store'});if(!r.ok)throw new Error('Voice stream is missing.');const pcm=decodeAdp(new Uint8Array(await r.arrayBuffer())),url=URL.createObjectURL(pcmWav(pcm,ADP_RATE,2));state.voiceUrls.set(path,url);return url;}
  function setVoiceMusicDuck(active){
    active=!!active;
    if(state.voiceDuckActive===active&&active)return;
    state.voiceDuckActive=active;
    try{
      const hub=window.__pfpAudioHub;
      if(hub&&typeof hub.setExternalMusicDuck==='function')hub.setExternalMusicDuck('gametextVoice',active);
      else if(hub){if(active&&typeof hub.duckMapMusic==='function')hub.duckMapMusic('external:gametextVoice');else if(!active&&typeof hub.restoreMapMusic==='function')hub.restoreMapMusic('external:gametextVoice');}
    }catch(_){}
  }
  function stopVoice(reset=true){if(state.voiceAudio){try{state.voiceAudio.pause();if(reset)state.voiceAudio.currentTime=0;}catch(_){}}state.voicePath=null;state.voiceTriggerId=null;setVoiceMusicDuck(false);}
  function syncVoiceTransport(force=false){
    const a=state.voiceAudio;
    if(!a||!state.voicePath||!state.voiceEnabled||(!state.externalTransport&&state.mode!=='Sequences')){
      if(a)try{a.pause();}catch(_){}
      setVoiceMusicDuck(false);return;
    }
    try{
      const clock=state.externalTransport?(state.externalAbsoluteSeconds||0):(state.elapsed||0);
      const target=Math.max(0,clock-(state.voiceStartSeconds||0));
      if(force||!Number.isFinite(a.currentTime)||Math.abs(a.currentTime-target)>.35)a.currentTime=Math.min(target,Number.isFinite(a.duration)&&a.duration>0?Math.max(0,a.duration-.02):target);
      if(state.playing){setVoiceMusicDuck(true);a.play().catch(()=>{setVoiceMusicDuck(false);});}
      else{a.pause();setVoiceMusicDuck(false);}
    }catch(_){setVoiceMusicDuck(false);}
  }
  async function prepareVoiceForItem(it){
    state.voiceStartSeconds=0;const loadToken=++state.voiceLoadToken;stopVoice(true);
    if(state.voiceStatus)state.voiceStatus.textContent='';
    if(!state.voiceEnabled||state.mode!=='Sequences'||!it)return false;
    const ids=sequenceObjectIds(it);if(!ids.length){if(state.voiceStatus)state.voiceStatus.textContent='Voice: this GameText file has no object-sequence voice ID';return false;}
    await loadVoiceStreams();if(loadToken!==state.voiceLoadToken)return false;
    const pairs=[];for(const id of ids)for(const path of voiceCandidatesForId(id))pairs.push({id,path});
    const paths=[...new Set(pairs.map(x=>x.path))];
    if(paths.length!==1){if(state.voiceStatus)state.voiceStatus.textContent=paths.length?'Voice: multiple exact streams for this sequence — subtitle only':'Voice: no matching Streams.bin trigger for this sequence';return false;}
    const path=paths[0],pair=pairs.find(x=>x.path===path)||null;state.voiceTriggerId=pair?Number(pair.id):null;
    if(state.voiceStatus)state.voiceStatus.textContent='Voice: loading '+path.replace(/\.adp$/i,'')+'...';
    try{
      const url=await voiceUrl(path);if(loadToken!==state.voiceLoadToken)return false;
      if(!state.voiceAudio){state.voiceAudio=new Audio();state.voiceAudio.preload='auto';state.voiceAudio.volume=.60;state.voiceAudio.addEventListener('ended',()=>setVoiceMusicDuck(false));state.voiceAudio.addEventListener('error',()=>setVoiceMusicDuck(false));}
      state.voiceAudio.volume=.60;state.voiceAudio.src=url;state.voicePath=path;
      if(state.voiceStatus)state.voiceStatus.textContent='Voice: '+path.replace(/\.adp$/i,'');
      syncVoiceTransport(true);return true;
    }catch(e){state.voiceTriggerId=null;setVoiceMusicDuck(false);if(state.voiceStatus)state.voiceStatus.textContent='Voice: could not load '+path;console.warn('[SFA GameText voice]',e);return false;}
  }
  async function prepareVoiceForStreamId(streamId){
    const id=Number(streamId),loadToken=++state.voiceLoadToken;stopVoice(true);
    if(!Number.isFinite(id)||!state.voiceEnabled)return false;
    await loadVoiceStreams();if(loadToken!==state.voiceLoadToken)return false;
    const matches=voiceCandidatesForId(id);
    if(matches.length!==1){if(state.voiceStatus)state.voiceStatus.textContent=matches.length?'Voice: multiple streams for trigger '+id:'Voice: no Streams.bin trigger '+id;return false;}
    const path=matches[0];
    try{
      const url=await voiceUrl(path);if(loadToken!==state.voiceLoadToken)return false;
      if(!state.voiceAudio){state.voiceAudio=new Audio();state.voiceAudio.preload='auto';state.voiceAudio.volume=.60;state.voiceAudio.addEventListener('ended',()=>setVoiceMusicDuck(false));state.voiceAudio.addEventListener('error',()=>setVoiceMusicDuck(false));}
      state.voiceAudio.volume=.60;state.voiceAudio.src=url;state.voicePath=path;state.voiceTriggerId=id;
      if(state.voiceStatus)state.voiceStatus.textContent='Voice: '+path.replace(/\.adp$/i,'');
      syncVoiceTransport(true);return true;
    }catch(e){setVoiceMusicDuck(false);if(state.voiceStatus)state.voiceStatus.textContent='Voice: could not load '+path;console.warn('[SFA GameText direct sequence voice]',e);return false;}
  }
  function prepareVoiceForSelected(){const it=state.selected>=0&&state.items[state.selected]?state.items[state.selected]:null;return prepareVoiceForItem(it);}

  function populateControls(){
    if(!state.data)return;
    state.titleLabel.textContent=`${SOURCE[state.pathBase].label} — GameText / Subtitles`;
    state.titleLabel.style.color=SOURCE[state.pathBase].accent;
    state.langSel.textContent='';
    for(const l of state.data.languages){const o=document.createElement('option');o.value=l.id;o.textContent=l.label||LANG_LABEL[l.id]||l.id;state.langSel.appendChild(o);}
    if(![...state.langSel.options].some(o=>o.value===state.language))state.language='English';state.langSel.value=state.language;
    state.modeSel.value=state.mode; rebuildDirectory(); rebuildItems();
  }
  function rebuildDirectory(){
    if(!state.data)return; const old=state.directory; state.dirSel.textContent='';
    const vals=state.mode==='Sequences'?['All']:['All',...state.data.dirs];
    for(const x of vals){const o=document.createElement('option');o.value=x;o.textContent=x;state.dirSel.appendChild(o);} state.directory=vals.includes(old)?old:'All';state.dirSel.value=state.directory;state.dirSel.disabled=state.mode==='Sequences';
  }
  function entryPrimary(file){
    if(!file.entries.length)return null;
    if(file.sequenceId!=null){const x=file.entries.find(e=>e.id===file.sequenceId);if(x)return x;}
    return file.entries[0];
  }
  function itemHay(file,entry){return `${file.dir} ${file.path} ${file.sequenceId==null?'':file.sequenceId} ${entry.id} ${entry.preview||''}`.toLowerCase();}
  function rebuildItems(){
    if(!state.data)return;
    const arr=[];
    const seenGameText=new Set();
    for(let fi=0;fi<state.data.files.length;fi++){
      const f=state.data.files[fi]; if(f.language!==state.language)continue;
      if(state.mode==='Sequences'){
        if(f.sequenceId==null)continue; const e=entryPrimary(f); if(!e)continue; if(state.search&&!itemHay(f,e).includes(state.search))continue;
        arr.push({fi,ei:f.entries.indexOf(e),file:f,entry:e,label:`SEQ ${String(f.sequenceId).padStart(5,'0')}  #${e.id}  ${(e.preview||'').replace(/\s+/g,' ').slice(0,90)}`});
      }else{
        if(f.sequenceId!=null)continue;if(state.directory!=='All'&&f.dir!==state.directory)continue;
        for(let ei=0;ei<f.entries.length;ei++){
          const e=f.entries[ei];if(state.search&&!itemHay(f,e).includes(state.search))continue;
          const duplicateKey=String(e.id)+'\u001f'+JSON.stringify(e.phrases);
          if(seenGameText.has(duplicateKey))continue;
          seenGameText.add(duplicateKey);
          arr.push({fi,ei,file:f,entry:e,label:`${f.dir.padEnd(16).slice(0,16)}  #${String(e.id).padStart(5,'0')}  ${(e.preview||'').replace(/\s+/g,' ').slice(0,82)}`});
        }
      }
    }
    state.items=arr; state.list.textContent=''; arr.forEach((it,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=it.label;state.list.appendChild(o);});
    state.results.textContent=`${arr.length} result${arr.length===1?'':'s'} | ${LANG_LABEL[state.language]||state.language}`;
    if(arr.length){selectItem(clamp(state.selected<0?0:state.selected,0,arr.length-1));}else{state.selected=-1;state.timeline=[];state.raw.textContent='';clearCanvas();}
  }

  function commandText(t){
    if(!Array.isArray(t)||t[0]!=='@')return '';
    const n=t[1],p=t.slice(2);
    if(n==='color')return `[Color rgba(${p.map(x=>x&255).join(',')})]`;
    if(n==='seqTime')return `[SeqTime ${p[0]}:${String(p[1]).padStart(2,'0')} + ${p[2]}/60]`;
    if(n==='font')return `[Font ${p[0]}]`;if(n==='scale')return `[Scale ${(p[0]/256).toFixed(3)}]`;
    return `[${n}${p.length?' '+p.join(','):''}]`;
  }
  function tokensPlain(tokens,withCmd=false){let s='';for(const t of tokens){if(typeof t==='string')s+=t;else if(withCmd)s+=commandText(t);}return s;}
  function rawEntry(it){
    const f=it.file,e=it.entry;let s=`File: ${f.path}\nDirectory: ${f.dir}\n${f.sequenceId!=null?'Sequence: '+f.sequenceId+'\n':''}Text ID: ${e.id}\nWindow: ${e.window}  alignH: ${e.alignH}  alignV: ${e.alignV}\nCharset: ${f.charset}\n\n`;
    e.phrases.forEach((ph,i)=>{s+=`[${i}] `;for(const t of ph)s+=typeof t==='string'?t:commandText(t);s+='\n';});return s;
  }

  function selectItem(i){
    if(!state.items.length)return; i=clamp(i,0,state.items.length-1);state.selected=i;state.list.value=String(i);const it=state.items[i];
    state.raw.textContent=rawEntry(it);state.elapsed=0;state.playing=true;state.lastTs=performance.now();state.timeline=buildTimeline(it);state.duration=Math.max(1,(state.timeline.length?state.timeline[state.timeline.length-1].time:0)+3);prepareVoiceForItem(it);syncPlaybackUI();drawOverlay();
  }

  function baseStyle(file){return {font:file.defaultFont||state.data.mainFont,scale:1,color:[255,255,255,255],align:'center'};}
  function rgbaCss(c){return `rgba(${c[0]},${c[1]},${c[2]},${(c[3]/255).toFixed(4)})`;}
  function glyphIndex(file,font,cp){const cs=state.data.charsets[file.charset]||{};let g=cs[font+':'+cp];if(g==null)g=cs[(file.defaultFont||state.data.mainFont)+':'+cp];return g==null?-1:g;}
  function glyphAdvance(file,style,ch){const gi=glyphIndex(file,style.font,ch.codePointAt(0));if(gi<0)return 8*style.scale;const g=state.data.glyphs[gi];return Math.max(0,(g.left+g.w+g.right)*style.scale);}

  function phraseToLines(file,tokens,style,maxW=560){
    let explicit=null; const chars=[]; let sawVisible=false;
    for(const tok of tokens){
      if(typeof tok==='string'){
        for(const ch of tok){if(ch==='\r')continue;if(ch==='\n'){chars.push({newline:true});continue;}const gi=glyphIndex(file,style.font,ch.codePointAt(0));const g=gi>=0?state.data.glyphs[gi]:null;const adv=g?Math.max(0,(g.left+g.w+g.right)*style.scale):8*style.scale;chars.push({ch,gi,font:style.font,scale:style.scale,color:style.color.slice(),adv});if(ch.trim())sawVisible=true;}
      }else if(tok&&tok[0]==='@'){
        const n=tok[1],p=tok.slice(2);
        if(n==='seqTime')explicit=p[0]*60+p[1]+Math.floor(p[2]/60);
        else if(n==='color')style.color=[p[0]&255,p[1]&255,p[2]&255,p[3]&255];
        else if(n==='font')style.font=p[0]; else if(n==='scale')style.scale=(p[0]||256)/256;
        else if(n==='alignLeft')style.align='left';else if(n==='alignRight')style.align='right';else if(n==='alignCenter')style.align='center';else if(n==='alignFull')style.align='center';
      }
    }
    const lines=[];let line=[];let width=0;
    const push=()=>{lines.push({chars:line,width,align:style.align,explicit:null});line=[];width=0;};
    let word=[];let wordW=0;
    const flushWord=()=>{if(!word.length)return;if(width>0&&wordW>maxW-width&&word.some(c=>c.ch&&c.ch.trim()))push();for(const c of word){if(width+c.adv>maxW&&width>0)push();line.push(c);width+=c.adv;}word=[];wordW=0;};
    for(const c of chars){if(c.newline){flushWord();push();continue;}word.push(c);wordW+=c.adv;if(c.ch===' '||c.ch==='\t')flushWord();}flushWord();
    if(line.length||!lines.length)push();lines[0].explicit=explicit;
    return lines;
  }

  function buildTimeline(it){
    const file=it.file,e=it.entry,style=baseStyle(file),lines=[];
    for(const ph of e.phrases){const ls=phraseToLines(file,ph,style,440);lines.push(...ls);}
    if(!lines.length)lines.push({chars:[],width:0,align:'center',explicit:0});
    const known=[];for(let i=0;i<lines.length;i++)if(lines[i].explicit!=null)known.push(i);
    if(lines[0].explicit==null)lines[0].explicit=0;
    for(let a=0;a<lines.length;){
      if(lines[a].explicit==null){a++;continue;}let b=a+1;while(b<lines.length&&lines[b].explicit==null)b++;
      if(b<lines.length){const t0=lines[a].explicit,t1=lines[b].explicit;let total=0;for(let k=a;k<b;k++)total+=Math.max(1,lines[k].chars.filter(c=>c.ch&&c.ch.trim()).length);let accum=Math.max(1,lines[a].chars.filter(c=>c.ch&&c.ch.trim()).length);for(let k=a+1;k<b;k++){lines[k].explicit=t0+(t1-t0)*(accum/total);accum+=Math.max(1,lines[k].chars.filter(c=>c.ch&&c.ch.trim()).length);}}else{for(let k=a+1;k<lines.length;k++)lines[k].explicit=lines[k-1].explicit+2.5;}
      a=b;
    }
    let last=0;return lines.map((ln,i)=>{let t=Number.isFinite(ln.explicit)?ln.explicit:last;if(t<last)t=last;last=t;return {...ln,time:t,index:i};});
  }

  function tintAtlas(page,color){
    const key=page+':'+color.join(',');if(state.tintCache.has(key))return state.tintCache.get(key);const src=state.atlas[page];const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const x=c.getContext('2d');x.drawImage(src,0,0);x.globalCompositeOperation='source-in';x.fillStyle=rgbaCss(color);x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation='source-over';state.tintCache.set(key,c);if(state.tintCache.size>48){const first=state.tintCache.keys().next().value;state.tintCache.delete(first);}return c;
  }
  const SUB_LEFT=138,SUB_RIGHT=612,SUB_SEQ_LEFT=28,SUB_SEQ_RIGHT=612;
  function subtitleRange(){
    const q=window.__pfpSfaSequencesToggle;
    const seq=!!(q&&q.cb&&q.cb.checked);
    return seq?{left:SUB_SEQ_LEFT,right:SUB_SEQ_RIGHT}:{left:SUB_LEFT,right:SUB_RIGHT};
  }
  function subtitleLineX(line){const r=subtitleRange();return line.align==='left'?r.left:line.align==='right'?r.right-line.width:(r.left+r.right-line.width)/2;}
  function subtitleBounds(line,y){
    const r=subtitleRange();let x=subtitleLineX(line),minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const c of line.chars){
      if(c.gi<0){x+=c.adv;continue;}
      const g=state.data.glyphs[c.gi],dx=x+g.left*c.scale,dy=y+g.top*c.scale,dw=g.w*c.scale,dh=g.h*c.scale;
      if(dw>0&&dh>0){minX=Math.min(minX,dx);minY=Math.min(minY,dy);maxX=Math.max(maxX,dx+dw);maxY=Math.max(maxY,dy+dh);}x+=c.adv;
    }
    if(!Number.isFinite(minX))return null;
    return{x0:Math.max(r.left-8,minX-9),y0:minY-6,x1:Math.min(r.right+8,maxX+9),y1:maxY+7};
  }
  function roundedBox(ctx,b,r=5){
    const x=b.x0,y=b.y0,w=b.x1-b.x0,h=b.y1-b.y0,rr=Math.min(r,w/2,h/2);
    ctx.beginPath();ctx.moveTo(x+rr,y);ctx.lineTo(x+w-rr,y);ctx.quadraticCurveTo(x+w,y,x+w,y+rr);ctx.lineTo(x+w,y+h-rr);ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);ctx.lineTo(x+rr,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-rr);ctx.lineTo(x,y+rr);ctx.quadraticCurveTo(x,y,x+rr,y);ctx.closePath();
  }
  function drawChars(line,y){
    const ctx=state.ctx;if(!ctx||!state.data)return;let x=subtitleLineX(line);
    for(const c of line.chars){if(c.gi<0){x+=c.adv;continue;}const g=state.data.glyphs[c.gi];const dx=x+g.left*c.scale,dy=y+g.top*c.scale,dw=g.w*c.scale,dh=g.h*c.scale;if(g.w>0&&g.h>0){if(g.mono){const sh=tintAtlas(g.page,[0,0,0,225]);ctx.drawImage(sh,g.x,g.y,g.w,g.h,dx+1.3,dy+1.3,dw,dh);const ti=tintAtlas(g.page,c.color);ctx.drawImage(ti,g.x,g.y,g.w,g.h,dx,dy,dw,dh);}else{ctx.globalAlpha=(c.color[3]||255)/255;ctx.drawImage(state.atlas[g.page],g.x,g.y,g.w,g.h,dx,dy,dw,dh);ctx.globalAlpha=1;}}x+=c.adv;}
  }
  function clearCanvas(){if(state.ctx)state.ctx.clearRect(0,0,640,480);}
  function currentLine(){if(!state.timeline.length||state.elapsed<state.timeline[0].time)return null;let i=0;for(let k=1;k<state.timeline.length;k++){if(state.elapsed>=state.timeline[k].time)i=k;else break;}return state.timeline[i];}
  function lineHasVisibleText(line){
    return !!(line&&line.chars&&line.chars.some(c=>c&&c.ch&&c.ch.trim().length&&(!c.color||c.color[3]!==0)));
  }
  function drawOverlay(){
    if(!(state.visible||state.externalOverlay)||!state.ctx){clearCanvas();return;}clearCanvas();const ln=currentLine();
    if(!ln||!lineHasVisibleText(ln))return;
    const y=360,b=subtitleBounds(ln,y),ctx=state.ctx;
    if(b){ctx.save();roundedBox(ctx,b,5);ctx.fillStyle='rgba(0,0,0,0.68)';ctx.fill();ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,0.28)';ctx.stroke();ctx.restore();}
    drawChars(ln,y);
  }
  function fmtTime(s){s=Math.max(0,s||0);return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');}
  function syncPlaybackUI(){if(state.playBtn)state.playBtn.textContent=state.playing?'Pause':'Play';if(state.timeLabel)state.timeLabel.textContent=`${fmtTime(state.elapsed)} / ${fmtTime(state.duration)}`;if(state.seek){state.seek.value=String(state.duration?clamp(state.elapsed/state.duration,0,1):0);}if(state.loopCb)state.loopCb.checked=state.loop;if(state.voiceCb)state.voiceCb.checked=state.voiceEnabled;}

  function frame(ts){
    if(!state.lastTs)state.lastTs=ts;const dt=Math.min(.25,(ts-state.lastTs)/1000);state.lastTs=ts;
    if(state.visible&&!state.externalTransport&&state.playing&&state.timeline.length){state.elapsed+=dt;if(state.elapsed>state.duration){if(state.loop){state.elapsed=0;syncVoiceTransport(true);}else{state.elapsed=state.duration;state.playing=false;syncVoiceTransport();}}else if(state.voicePath&&state.voiceAudio&&Math.abs((state.voiceAudio.currentTime||0)-Math.max(0,(state.elapsed||0)-(state.voiceStartSeconds||0)))>.45)syncVoiceTransport(true);drawOverlay();syncPlaybackUI();}
    state.raf=requestAnimationFrame(frame);
  }

  function cleanupSource(){stopVoice(true);state.voiceLoadToken++;state.voiceStreams=[];state.voicePromise=null;for(const u of state.voiceUrls.values())try{URL.revokeObjectURL(u);}catch(_){}state.voiceUrls.clear();state.data=null;state.atlas=[];state.tintCache.clear();state.items=[];state.timeline=[];state.selected=-1;state.elapsed=0;state.sourceToken++;state.dataPromise=null;if(state.raw)state.raw.textContent='';if(state.voiceStatus)state.voiceStatus.textContent='';clearCanvas();}
  function activate(pathBase){
    if(!SOURCE[pathBase])return deactivate();
    if(state.pathBase!==pathBase){state.pathBase=pathBase;cleanupSource();}
    ensureToggle();ensurePanel();ensureCanvas();positionToggle();
    if(state.visible)loadData().then(()=>populateControls()).catch(showError);
  }
  function deactivate(){
    state.pathBase=null;cleanupSource();state.visible=false;
    if(state.panel)state.panel.style.display='none';if(state.canvas)state.canvas.style.display='none';
    if(state.toggle)state.toggle.style.display='none';if(state.toggle&&state.toggle._cb)state.toggle._cb.checked=false;
  }


  async function bindExternalSequenceDirect(sequenceId, options={}){
    const id=Number(sequenceId);if(!Number.isFinite(id))return {textBound:false,voiceBound:false};
    const pb=SOURCE[options.pathBase]?options.pathBase:'StarFoxAdventures';activate(pb);ensureToggle();ensurePanel();ensureCanvas();await loadData();if(!state.data)return {textBound:false,voiceBound:false};
    state.externalTransport=true;state.externalSequenceId=id;state.externalStartSeconds=Math.max(0,Number(options.startSeconds)||0);state.externalAbsoluteSeconds=state.externalStartSeconds;state.voiceStartSeconds=0;
    state.externalOverlay=false;clearCanvas();if(state.canvas)state.canvas.style.display='none';
    let textBound=false,selectedItem=null,textDir=null;const textId=Number(options.textId);const textMode=String(options.textMode||'sequence').toLowerCase();
    if(Number.isFinite(textId)&&textId>=0){
      state.language=options.language||state.language||'English';state.search='';
      let idx=-1;
      if(textMode==='general'){
        state.mode='GameText';state.directory='All';populateControls();
        idx=chooseExternalItemIndex(it=>it&&it.file&&it.file.sequenceId==null&&Number(it.entry&&it.entry.id)===textId,options);
        if(idx<0&&state.language!=='English'){state.language='English';populateControls();idx=chooseExternalItemIndex(it=>it&&it.file&&it.file.sequenceId==null&&Number(it.entry&&it.entry.id)===textId,options);}
      }else if(textMode==='voice'){
        state.mode='Sequences';state.directory='All';populateControls();
        const voiceTextId=Number.isFinite(Number(options.textVoiceId))?Number(options.textVoiceId):textId;
        const voiceOpts={...options,preferSequenceId:textId};
        idx=chooseExternalVoiceSubtitleIndex(voiceTextId,voiceOpts);
        if(idx<0&&state.language!=='English'){state.language='English';populateControls();idx=chooseExternalVoiceSubtitleIndex(voiceTextId,voiceOpts);}
      }else{
        state.mode='Sequences';state.directory='All';populateControls();
        idx=chooseExternalItemIndex(it=>it&&it.file&&Number(it.file.sequenceId)===textId,options);
        if(idx<0&&state.language!=='English'){state.language='English';populateControls();idx=chooseExternalItemIndex(it=>it&&it.file&&Number(it.file.sequenceId)===textId,options);}
      }
      if(idx>=0){const oldVoice=state.voiceEnabled;state.voiceEnabled=false;selectItem(idx);state.voiceEnabled=oldVoice;state.externalOverlay=true;textBound=true;selectedItem=state.items[idx];textDir=selectedItem&&selectedItem.file?selectedItem.file.dir:null;if(state.canvas)state.canvas.style.display='block';}
    }
    if(state.panel&&!state.visible)state.panel.style.display='none';
    let voiceBound=false;
    if(options.voice!==false){
      if(textBound&&selectedItem&&options.voiceFromText!==false)voiceBound=await prepareVoiceForItem(selectedItem);
      if(!voiceBound){const voiceId=Number.isFinite(Number(options.voiceId))?Number(options.voiceId):id;voiceBound=await prepareVoiceForStreamId(voiceId);}
    }
    drawOverlay();syncVoiceTransport(true);syncPlaybackUI();return {textBound,voiceBound,voiceId:state.voiceTriggerId,textId:Number.isFinite(textId)?textId:null,textDir};
  }
  async function bindExternalSequence(sequenceId, options={}){
    const id=Number(sequenceId);
    if(!Number.isFinite(id))return false;
    const pb=SOURCE[options.pathBase]?options.pathBase:'StarFoxAdventures';activate(pb);
    ensureToggle();ensurePanel();ensureCanvas();
    await loadData();
    if(!state.data)return false;
    state.mode='Sequences';state.language=options.language||state.language||'English';state.directory='All';state.search='';
    populateControls();
    let idx=state.items.findIndex((it)=>it&&it.file&&Number(it.file.sequenceId)===id);
    if(idx<0&&state.language!=='English'){
      state.language='English';populateControls();idx=state.items.findIndex((it)=>it&&it.file&&Number(it.file.sequenceId)===id);
    }
    if(idx<0)return false;
    selectItem(idx);
    state.externalTransport=true;state.externalOverlay=true;state.externalSequenceId=id;
    if(state.canvas)state.canvas.style.display='block';
    if(state.panel&&!state.visible)state.panel.style.display='none';
    drawOverlay();syncVoiceTransport(true);syncPlaybackUI();
    return true;
  }
  function setExternalTextId(textId,startSeconds=0,language='English',options={}){
    if(!state.externalTransport||!state.data)return false;
    const id=Number(textId);if(!Number.isFinite(id))return false;
    state.language=language||'English';state.mode='GameText';state.directory='All';state.search='';
    const oldVoice=state.voiceEnabled;state.voiceEnabled=false;populateControls();
    let idx=chooseExternalItemIndex(it=>it&&it.file&&it.file.sequenceId==null&&Number(it.entry&&it.entry.id)===id,options);
    if(idx<0&&state.language!=='English'){state.language='English';populateControls();idx=chooseExternalItemIndex(it=>it&&it.file&&it.file.sequenceId==null&&Number(it.entry&&it.entry.id)===id,options);}
    if(idx>=0){selectItem(idx);state.externalOverlay=true;state.externalStartSeconds=Math.max(0,Number(startSeconds)||0);if(state.canvas)state.canvas.style.display='block';}
    else{state.externalOverlay=false;clearCanvas();if(state.canvas)state.canvas.style.display='none';}
    state.voiceEnabled=oldVoice;syncVoiceTransport(true);return idx>=0;
  }
  function setExternalSequenceText(sequenceId,startSeconds=0,language='English',options={}){
    if(!state.externalTransport||!state.data)return false;
    const id=Number(sequenceId);if(!Number.isFinite(id))return false;
    state.language=language||'English';state.mode='Sequences';state.directory='All';state.search='';
    const oldVoice=state.voiceEnabled;state.voiceEnabled=false;populateControls();
    let idx=chooseExternalItemIndex(it=>it&&it.file&&Number(it.file.sequenceId)===id,options);
    if(idx<0&&state.language!=='English'){state.language='English';populateControls();idx=chooseExternalItemIndex(it=>it&&it.file&&Number(it.file.sequenceId)===id,options);}
    if(idx>=0){selectItem(idx);state.externalOverlay=true;state.externalStartSeconds=Math.max(0,Number(startSeconds)||0);if(state.canvas)state.canvas.style.display='block';}
    else{state.externalOverlay=false;clearCanvas();if(state.canvas)state.canvas.style.display='none';}
    state.voiceEnabled=oldVoice;syncVoiceTransport(true);return idx>=0;
  }
  function setExternalVoiceSubtitle(streamId,startSeconds=0,language='English',options={}){
    if(!state.externalTransport||!state.data)return false;
    const id=Number(streamId);if(!Number.isFinite(id))return false;
    state.language=language||'English';state.mode='Sequences';state.directory='All';state.search='';
    const oldVoice=state.voiceEnabled;state.voiceEnabled=false;populateControls();
    let idx=chooseExternalVoiceSubtitleIndex(id,options);
    if(idx<0&&state.language!=='English'){state.language='English';populateControls();idx=chooseExternalVoiceSubtitleIndex(id,options);}
    if(idx>=0){selectItem(idx);state.externalOverlay=true;state.externalStartSeconds=Math.max(0,Number(startSeconds)||0);if(state.canvas)state.canvas.style.display='block';}
    else{state.externalOverlay=false;clearCanvas();if(state.canvas)state.canvas.style.display='none';}
    state.voiceEnabled=oldVoice;syncVoiceTransport(true);return idx>=0;
  }
  function clearExternalText(){
    if(!state.externalTransport)return;state.externalOverlay=false;state.timeline=[];state.duration=1;state.elapsed=0;state.externalStartSeconds=0;
    clearCanvas();if(state.canvas)state.canvas.style.display='none';
  }
  function setExternalSequenceTransport(seconds,playing,force=false){
    if(!state.externalTransport)return;
    const abs=Math.max(0,Number(seconds)||0);state.externalAbsoluteSeconds=abs;
    const rel=Math.max(0,abs-(Number(state.externalStartSeconds)||0));state.elapsed=clamp(rel,0,Math.max(state.duration||1,rel));
    state.playing=!!playing;state.lastTs=performance.now();
    syncVoiceTransport(!!force);drawOverlay();syncPlaybackUI();
  }
  async function setExternalVoiceStream(streamId, sequenceStartSeconds=0){
    if(!state.externalTransport)return false;
    state.voiceStartSeconds=Math.max(0,Number(sequenceStartSeconds)||0);
    const ok=await prepareVoiceForStreamId(streamId);
    syncVoiceTransport(true);
    return !!ok;
  }
  function releaseExternalSequence(){
    state.externalTransport=false;state.externalOverlay=false;state.externalSequenceId=null;state.externalStartSeconds=0;state.externalAbsoluteSeconds=0;state.voiceStartSeconds=0;state.voiceTriggerId=null;
    if(!state.visible){clearCanvas();if(state.canvas)state.canvas.style.display='none';stopVoice(false);}
  }
  window.__pfpSfaGameText={activate,deactivate,setVisible,bindExternalSequence,bindExternalSequenceDirect,setExternalTextId,setExternalSequenceText,setExternalVoiceSubtitle,clearExternalText,setExternalSequenceTransport,setExternalVoiceStream,releaseExternalSequence,get state(){return state;}};
  state.raf=requestAnimationFrame(frame);
  let last='';
  setInterval(()=>{
    const pb=classifyTitle();const key=pb+'|'+document.title;
    if(key!==last){last=key;if(pb)activate(pb);else deactivate();}
    else if(pb){ensureToggle();positionToggle();}
  },350);
})();
