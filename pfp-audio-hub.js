(() => {
  if (window.__pfpAudioHub) return;

  const ROOT = location.pathname.includes('/Project-FoxPlanet/') ? '/Project-FoxPlanet/' : '/';
  const STATIC_WEB = location.protocol === 'https:' || (location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/i.test(location.hostname));
  const encPath = (s) => String(s || '').split('/').map(encodeURIComponent).join('/');
  const fmt = (sec) => {
    sec = Number.isFinite(sec) && sec > 0 ? sec : 0;
    const s = Math.floor(sec);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function json(url, init) {
    const r = await fetch(url, init);
    let j = null;
    try { j = await r.json(); } catch (_) {}
    if (!r.ok || !j) throw new Error((j && j.message) || ('Request failed (' + r.status + ')'));
    return j;
  }

  function dataFetcher() {
    const live = window.main && window.main.dataFetcher;
    if (live && typeof live.fetchData === 'function') return live;
    return {
      async fetchData(path) {
        const r = await fetch(ROOT + encPath(path), { cache: 'no-store' });
        if (!r.ok) throw new Error('Missing audio data: ' + path);
        const ab = await r.arrayBuffer();
        return {
          createDataView() { return new DataView(ab); },
        };
      },
    };
  }

  function desktopAudioMessage() {
    return 'SFA/Kiosk music needs the desktop version of FoxPlanet for now. Please download FoxPlanet to play these tracks.';
  }

  const ADP_FRAME = 0x20;
  const ADP_RATE = 48000;
  const ADP_FILTERS = [[0, 0], [60, 0], [115, -52], [98, -55]];
  const sign4 = (n) => ((n &= 15), n >= 8 ? n - 16 : n);
  const clamp16 = (v) => v < -32768 ? -32768 : v > 32767 ? 32767 : v;
  function adpNib(nib, head, hist) {
    const pred = (head >>> 4) & 15;
    const range = head & 15;
    const cf = ADP_FILTERS[pred & 3];
    const sh = sign4(nib) << Math.max(0, 12 - range);
    const v = clamp16(sh + ((cf[0] * hist.s1 + cf[1] * hist.s2 + 32) >> 6));
    hist.s2 = hist.s1;
    hist.s1 = v;
    return v;
  }
  function decodeAdpVariant(src, layout) {
    const frames = Math.floor(src.length / ADP_FRAME);
    const pcm = new Int16Array(frames * 28 * 2);
    const lh = { s1: 0, s2: 0 }, rh = { s1: 0, s2: 0 };
    const swapped = layout === 'legacy_swapped' || layout === 'gcadp_swapped';
    let dst = 0;
    const push = (b, hl, hr) => {
      const hi = b >>> 4, lo = b & 15;
      const ln = swapped ? lo : hi, rn = swapped ? hi : lo;
      pcm[dst++] = adpNib(ln, hl, lh);
      pcm[dst++] = adpNib(rn, hr, rh);
    };
    for (let fr = 0; fr < frames; fr++) {
      const base = fr * ADP_FRAME;
      if (layout === 'legacy' || layout === 'legacy_swapped') {
        const h0 = src[base], h1 = src[base + 1], h2 = src[base + 2], h3 = src[base + 3];
        for (let i = 0; i < 14; i++) push(src[base + 4 + i], h0, h1);
        for (let i = 0; i < 14; i++) push(src[base + 18 + i], h2, h3);
      } else {
        const h0 = src[base], h1 = src[base + 1], h2 = src[base + 16], h3 = src[base + 17];
        for (let i = 0; i < 14; i++) push(src[base + 2 + i], h0, h1);
        for (let i = 0; i < 14; i++) push(src[base + 18 + i], h2, h3);
      }
    }
    return pcm;
  }
  function scoreAdp(pcm) {
    let sc = 0, pl = 0, pr = 0;
    for (let i = 0; i + 1 < pcm.length; i += 2) {
      const l = pcm[i], r = pcm[i + 1], al = Math.abs(l), ar = Math.abs(r);
      const dl = Math.abs(l - pl), dr = Math.abs(r - pr);
      if (al >= 32760) sc += 200;
      if (ar >= 32760) sc += 200;
      if (dl > 24576) sc += 40 + ((dl - 24576) >> 8);
      if (dr > 24576) sc += 40 + ((dr - 24576) >> 8);
      if (al > 30000) sc += 4;
      if (ar > 30000) sc += 4;
      pl = l; pr = r;
    }
    return sc;
  }
  function decodeAdp(src) {
    const layouts = ['legacy', 'legacy_swapped', 'gcadp', 'gcadp_swapped'];
    return layouts.map((layout) => {
      const pcm = decodeAdpVariant(src, layout);
      return { pcm, score: scoreAdp(pcm) };
    }).sort((a, b) => a.score - b.score)[0].pcm;
  }
  function pcmWav(pcm, sampleRate, channels) {
    const dataSize = pcm.length * 2;
    const out = new Uint8Array(44 + dataSize);
    const dv = new DataView(out.buffer);
    const asc = (o, s) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
    asc(0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true); asc(8, 'WAVE'); asc(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, channels, true);
    dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * channels * 2, true);
    dv.setUint16(32, channels * 2, true); dv.setUint16(34, 16, true); asc(36, 'data');
    dv.setUint32(40, dataSize, true);
    for (let i = 0, p = 44; i < pcm.length; i++, p += 2) dv.setInt16(p, pcm[i], true);
    return new Blob([out], { type: 'audio/wav' });
  }

  function parseOffsetTable(view, binSize, little) {
    const out = [];
    for (let i = 0, index = 0; i + 4 <= view.byteLength; i += 4, index++) {
      const start = view.getUint32(i, little);
      if (start >= binSize) continue;
      let end = binSize;
      for (let p = i + 4; p + 4 <= view.byteLength; p += 4) {
        const v = view.getUint32(p, little);
        if (v > start && v <= binSize) { end = v; break; }
      }
      if (end > start) out.push({ index, start, end, size: end - start });
    }
    return out.filter((e) => e.size > 0);
  }

  class AudioHub {
    constructor() {
      this.game = 'final';
      this.category = 'music';
      this.items = [];
      this.filtered = [];
      this.caches = { final: {}, kiosk: {}, dp: {} };
      this.urls = new Map();
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.levelGains = new Map();
      this.nativeNow = null;
      this.currentItem = null;
      this.progressRAF = 0;
      this.mapMusicDuck = null;
      this.mapMusicDuckReasons = new Set();
      this.mapDuckTimer = 0;
      this.mediaFades = new WeakMap();
      this.mapMusicNominalVolumes = new WeakMap();
      this.createUI();
      this.bindAudio();
      this.installObserver();
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.overlay.style.display !== 'none') this.close();
      }, true);
    }

    createUI() {
      if (!document.getElementById('pfp-audio-hub-style')) {
        const style = document.createElement('style');
        style.id = 'pfp-audio-hub-style';
        style.textContent = `
#pfp-audio-hub-launch{position:relative;overflow:hidden;display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-height:39px;min-width:235px;padding:2px 14px!important;border:1px solid rgba(229,193,78,.82);border-radius:11px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.08);font-family:monospace!important;letter-spacing:.7px!important;transition:transform .12s ease,filter .12s ease,box-shadow .12s ease;background:radial-gradient(circle at 12% 18%,rgba(62,151,216,.30),transparent 34%),radial-gradient(circle at 88% 78%,rgba(214,153,44,.28),transparent 36%),linear-gradient(135deg,#0a1726 0%,#11283a 48%,#17262b 72%,#241b0e 100%)!important;color:#fff!important}
#pfp-audio-hub-launch:before,#pfp-audio-hub-launch:after{content:"";position:absolute;top:8px;bottom:8px;width:42px;opacity:.72;pointer-events:none}#pfp-audio-hub-launch:before{left:11px;border-left:2px solid rgba(86,184,255,.62);border-top:1px solid rgba(86,184,255,.30);transform:skewX(-18deg)}#pfp-audio-hub-launch:after{right:11px;border-right:2px solid rgba(224,174,57,.66);border-bottom:1px solid rgba(224,174,57,.32);transform:skewX(-18deg)}
#pfp-audio-hub-launch:hover{transform:translateY(-1px);filter:brightness(1.12);box-shadow:0 8px 22px rgba(0,0,0,.48),0 0 14px rgba(99,185,230,.12),0 0 18px rgba(220,167,48,.10)}
#pfp-audio-hub-launch .pfp-audio-main{position:relative;z-index:1;font-size:14px;font-weight:900;letter-spacing:1.5px;text-align:center;text-shadow:0 2px 4px #000}
#pfp-audio-hub-launch .pfp-audio-sub{position:relative;z-index:1;font-size:6.5px;font-weight:700;letter-spacing:1.2px;opacity:.67;text-align:center;white-space:nowrap}
#pfp-audio-hub-overlay{position:fixed;inset:0;z-index:30000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.76);backdrop-filter:blur(5px);font-family:monospace;color:#f7f7f7}
#pfp-audio-hub-panel{width:min(1180px,calc(100vw - 70px));height:min(760px,calc(100vh - 24px));display:grid;grid-template-rows:auto auto auto 1fr auto;border-radius:18px;overflow:hidden;border:1px solid rgba(230,195,81,.58);box-shadow:0 28px 90px rgba(0,0,0,.78);background:linear-gradient(145deg,#07101d,#0b1828 58%,#171007)}
.pfp-ah-header{position:relative;display:grid;grid-template-columns:1fr auto;align-items:center;padding:16px 20px;background:radial-gradient(circle at 12% 25%,rgba(55,135,198,.26),transparent 34%),radial-gradient(circle at 88% 75%,rgba(205,144,37,.22),transparent 34%),linear-gradient(135deg,#091a2d 0%,#102638 48%,#172328 72%,#271c0c 100%);border-bottom:1px solid rgba(225,187,67,.38);box-shadow:inset 0 -1px 0 rgba(255,255,255,.04)}
.pfp-ah-header:after{content:"";position:absolute;left:20px;right:20px;bottom:0;height:1px;background:linear-gradient(90deg,rgba(88,184,255,.5),rgba(226,187,78,.42),transparent)}
.pfp-ah-kicker{font-size:11px;opacity:.78;letter-spacing:2.5px}.pfp-ah-title{font-size:25px;font-weight:900;letter-spacing:1.7px;text-shadow:0 3px 7px rgba(0,0,0,.8)}
.pfp-ah-close{width:38px;height:38px;border:1px solid rgba(255,255,255,.35);border-radius:50%;background:rgba(0,0,0,.36);color:#fff;font-size:22px;cursor:pointer}.pfp-ah-close:hover{background:rgba(255,255,255,.14)}
.pfp-ah-tabs,.pfp-ah-cats{display:flex;gap:8px;padding:11px 16px;background:rgba(0,0,0,.30);border-bottom:1px solid rgba(255,255,255,.08)}
.pfp-ah-tab,.pfp-ah-cat{border:1px solid rgba(255,255,255,.18);border-radius:9px;padding:8px 14px;background:#111b27;color:#ddd;font-family:monospace;font-weight:700;cursor:pointer}.pfp-ah-tab.active,.pfp-ah-cat.active{border-color:var(--ah-accent,#e2bb4e);box-shadow:0 0 0 1px color-mix(in srgb,var(--ah-accent,#e2bb4e) 60%,transparent);color:#fff;background:color-mix(in srgb,var(--ah-accent,#e2bb4e) 19%,#101722)}
.pfp-ah-body{min-height:0;display:grid;grid-template-columns:minmax(0,1.55fr) minmax(330px,.8fr);gap:14px;padding:14px;background:radial-gradient(circle at 15% 0%,rgba(36,84,130,.18),transparent 45%),radial-gradient(circle at 100% 100%,rgba(179,124,30,.16),transparent 42%)}
.pfp-ah-browser,.pfp-ah-now{min-height:0;border:1px solid rgba(255,255,255,.10);border-radius:13px;background:rgba(3,8,14,.72);box-shadow:inset 0 0 25px rgba(0,0,0,.22)}
.pfp-ah-browser{display:grid;grid-template-rows:auto 1fr auto;padding:12px;gap:10px}.pfp-ah-search{width:100%;box-sizing:border-box;background:#0c1521;color:#fff;border:1px solid rgba(255,255,255,.19);border-radius:8px;padding:10px 12px;font:13px monospace;outline:none}.pfp-ah-search:focus{border-color:var(--ah-accent,#e2bb4e)}
.pfp-ah-list{width:100%;height:100%;min-height:0;box-sizing:border-box;background:#070d14;color:#e9e9e9;border:1px solid rgba(255,255,255,.13);border-radius:8px;padding:5px;font:12px monospace;outline:none}.pfp-ah-list option{padding:5px 7px}.pfp-ah-count{font-size:11px;color:#9ca8b6}
.pfp-ah-now{padding:13px;display:flex;flex-direction:column;gap:8px;overflow:auto}.pfp-ah-gamebadge{align-self:flex-start;border:1px solid var(--ah-accent,#e2bb4e);border-radius:999px;padding:5px 9px;font-size:10px;letter-spacing:1px;color:var(--ah-accent,#e2bb4e);background:rgba(0,0,0,.28)}.pfp-ah-nowtitle{font-size:19px;font-weight:900;line-height:1.25;min-height:34px}.pfp-ah-meta{white-space:pre-wrap;font-size:11px;line-height:1.55;color:#aeb8c5;min-height:38px}.pfp-ah-status{font-size:11px;color:#d6bc6d;min-height:18px;white-space:pre-wrap}
.pfp-ah-transport{display:grid;grid-template-columns:1fr 1.25fr 1.25fr 1fr;gap:7px}.pfp-ah-btn{border:1px solid rgba(255,255,255,.22);border-radius:8px;background:#182333;color:#fff;padding:9px 6px;font:700 12px monospace;cursor:pointer}.pfp-ah-btn:hover{border-color:var(--ah-accent,#e2bb4e);background:#223146}.pfp-ah-btn.primary{background:color-mix(in srgb,var(--ah-accent,#e2bb4e) 26%,#17202b);border-color:var(--ah-accent,#e2bb4e)}
.pfp-ah-progress{display:grid;grid-template-columns:40px 1fr 40px;gap:7px;align-items:center;font-size:10px;color:#c5ccd4}.pfp-ah-progress input,.pfp-ah-volume input{width:100%}.pfp-ah-volume{display:grid;grid-template-columns:55px 1fr;gap:8px;align-items:center;font-size:11px}.pfp-ah-options{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px;color:#c9d0d8}.pfp-ah-options label{display:flex;align-items:center;gap:5px}
.pfp-ah-footer{padding:9px 15px;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.38);color:#8e9aa8;font-size:10px;display:flex;justify-content:space-between;gap:10px}
@media(max-width:900px){#pfp-audio-hub-panel{width:calc(100vw - 24px);height:calc(100vh - 24px)}.pfp-ah-body{grid-template-columns:1fr;grid-template-rows:minmax(220px,1fr) auto}.pfp-ah-now{max-height:280px}.pfp-ah-tab,.pfp-ah-cat{padding:6px 8px;font-size:10px}}
@media(max-height:850px){.pfp-ah-header{padding:10px 16px}.pfp-ah-tabs,.pfp-ah-cats{padding:7px 12px}.pfp-ah-body{padding:10px;gap:10px}.pfp-ah-now{padding:10px;gap:6px}.pfp-ah-title{font-size:21px}.pfp-ah-meta{min-height:26px;max-height:50px;overflow:auto}.pfp-ah-btn{padding:7px 5px}}
        `;
        document.head.appendChild(style);
      }

      this.overlay = document.createElement('div');
      this.overlay.id = 'pfp-audio-hub-overlay';
      this.overlay.innerHTML = `
        <div id="pfp-audio-hub-panel">
          <div class="pfp-ah-header">
            <div><div class="pfp-ah-kicker">PROJECT FOXPLANET</div><div class="pfp-ah-title">AUDIO ARCHIVE</div></div>
            <button class="pfp-ah-close" title="Close">×</button>
          </div>
          <div class="pfp-ah-tabs"></div>
          <div class="pfp-ah-cats"></div>
          <div class="pfp-ah-body">
            <div class="pfp-ah-browser">
              <input class="pfp-ah-search" type="search" placeholder="Search this audio collection...">
              <select class="pfp-ah-list" size="20"></select>
              <div class="pfp-ah-count">Ready.</div>
            </div>
            <div class="pfp-ah-now">
              <div class="pfp-ah-gamebadge">FINAL SFA</div>
              <div class="pfp-ah-nowtitle">Choose an audio item</div>
              <div class="pfp-ah-meta">Music, voices and sound effects can be auditioned directly from your imported game data.</div>
              <div class="pfp-ah-status"></div>
              <div class="pfp-ah-transport">
                <button class="pfp-ah-btn prev">◀ Prev</button><button class="pfp-ah-btn primary play">▶ Play</button><button class="pfp-ah-btn stop">■ Stop</button><button class="pfp-ah-btn next">Next ▶</button>
              </div>
              <div class="pfp-ah-progress"><span class="cur">0:00</span><input class="seek" type="range" min="0" max="1" step="any" value="0"><span class="dur">0:00</span></div>
              <div class="pfp-ah-volume"><span>Volume</span><input class="volume" type="range" min="0" max="1" step="0.01" value="0.78"></div>
              <div class="pfp-ah-options"><label><input class="loop" type="checkbox"> Loop</label><label><input class="reverse" type="checkbox"> Reverse</label></div>
            </div>
          </div>
          <div class="pfp-ah-footer"><span>FINAL SFA · KIOSK DEMO · DINOSAUR PLANET</span><span class="pfp-ah-source">Waiting for selection</span></div>
        </div>`;
      document.body.appendChild(this.overlay);

      this.panel = this.overlay.querySelector('#pfp-audio-hub-panel');
      this.gameTabs = this.overlay.querySelector('.pfp-ah-tabs');
      this.cats = this.overlay.querySelector('.pfp-ah-cats');
      this.search = this.overlay.querySelector('.pfp-ah-search');
      this.list = this.overlay.querySelector('.pfp-ah-list');
      this.count = this.overlay.querySelector('.pfp-ah-count');
      this.badge = this.overlay.querySelector('.pfp-ah-gamebadge');
      this.nowTitle = this.overlay.querySelector('.pfp-ah-nowtitle');
      this.meta = this.overlay.querySelector('.pfp-ah-meta');
      this.status = this.overlay.querySelector('.pfp-ah-status');
      this.prevBtn = this.overlay.querySelector('.prev');
      this.playBtn = this.overlay.querySelector('.play');
      this.stopBtn = this.overlay.querySelector('.stop');
      this.nextBtn = this.overlay.querySelector('.next');
      this.seek = this.overlay.querySelector('.seek');
      this.cur = this.overlay.querySelector('.cur');
      this.dur = this.overlay.querySelector('.dur');
      this.volume = this.overlay.querySelector('.volume');
      this.loop = this.overlay.querySelector('.loop');
      this.reverse = this.overlay.querySelector('.reverse');
      this.source = this.overlay.querySelector('.pfp-ah-source');

      this.overlay.querySelector('.pfp-ah-close').onclick = () => this.close();
      this.overlay.addEventListener('mousedown', (e) => { if (e.target === this.overlay) this.close(); });
      for (const ev of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'wheel', 'keydown', 'keyup']) {
        this.panel.addEventListener(ev, (e) => e.stopPropagation());
      }
      this.search.oninput = () => this.applyFilter();
      this.list.onchange = () => this.selectCurrent();
      this.list.ondblclick = () => this.playSelected();
      this.prevBtn.onclick = () => this.step(-1);
      this.nextBtn.onclick = () => this.step(1);
      this.playBtn.onclick = () => this.playSelected();
      this.stopBtn.onclick = () => this.stopAll(true);
      this.volume.oninput = () => this.applyVolume();
      this.loop.onchange = () => this.handleLoopChange();
      this.reverse.onchange = () => this.handleReverseChange();
      this.seek.oninput = () => { this.cur.textContent = fmt(Number(this.seek.value)); };
      this.seek.onchange = () => this.applySeek();

      this.renderGameTabs();
      this.renderCategories();
      this.applyTheme();
    }

    installObserver() {
      const install = () => {
        if (this.launch && document.body.contains(this.launch)) return;
        const candidates = Array.from(document.querySelectorAll('div,span,h1,h2,h3')).filter((e) => (e.textContent || '').trim().toUpperCase() === 'SELECT GAME');
        if (!candidates.length) return;
        const target = candidates.slice().sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0];
        if (!target || target.dataset.pfpAudioHubLaunch === '1') return;
        target.dataset.pfpAudioHubLaunch = '1';
        target.id = 'pfp-audio-hub-launch';
        target.innerHTML = '<span class="pfp-audio-main">♫&nbsp; AUDIO PLAYER</span><span class="pfp-audio-sub">STAR FOX ADVENTURES · DINOSAUR PLANET</span>';
        target.title = 'Open the Project FoxPlanet Audio Archive';
        target.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.open(); };
        this.launch = target;
      };
      new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
      for (const ms of [0, 100, 350, 900, 1800]) setTimeout(install, ms);
    }

    renderGameTabs() {
      const games = [
        ['final', 'STAR FOX ADVENTURES'],
        ['kiosk', 'KIOSK DEMO'],
        ['dp', 'DINOSAUR PLANET'],
      ];
      this.gameTabs.textContent = '';
      for (const [id, label] of games) {
        const b = document.createElement('button');
        b.className = 'pfp-ah-tab' + (this.game === id ? ' active' : '');
        b.textContent = label;
        b.onclick = () => this.setGame(id);
        this.gameTabs.appendChild(b);
      }
    }

    categoriesFor(game) {
      if (game === 'dp') return [['music', 'Music'], ['ambient', 'Ambient'], ['voice', 'Voice'], ['sfx', 'SFX']];
      if (game === 'kiosk') return [['music', 'Music'], ['voice', 'Voice'], ['sfx', 'SFX / Ambient'], ['samples', 'Samples']];
      return [['music', 'Music'], ['voice', 'Voice'], ['sfx', 'SFX / Ambient'], ['samples', 'Samples']];
    }

    renderCategories() {
      const cats = this.categoriesFor(this.game);
      if (!cats.some(([id]) => id === this.category)) this.category = cats[0][0];
      this.cats.textContent = '';
      for (const [id, label] of cats) {
        const b = document.createElement('button');
        b.className = 'pfp-ah-cat' + (this.category === id ? ' active' : '');
        b.textContent = label;
        b.onclick = () => this.setCategory(id);
        this.cats.appendChild(b);
      }
    }

    applyTheme() {
      const themes = {
        final: { accent: '#58b8ff', badge: 'FINAL SFA', bg: 'linear-gradient(145deg,#07121f,#0b1b2d 62%,#09101a)' },
        kiosk: { accent: '#63d9c7', badge: 'KIOSK DEMO', bg: 'linear-gradient(145deg,#071b1c,#0c2426 58%,#17130a)' },
        dp: { accent: '#dda735', badge: 'DINOSAUR PLANET', bg: 'linear-gradient(145deg,#09111f,#101725 56%,#221608)' },
      };
      const t = themes[this.game];
      this.panel.style.setProperty('--ah-accent', t.accent);
      this.panel.style.background = t.bg;
      this.badge.textContent = t.badge;
    }

    async open() {
      this.overlay.style.display = 'flex';
      window.__pfpAudioHubOpen = true;
      this.duckMapMusic();
      this.renderGameTabs();
      this.renderCategories();
      this.applyTheme();
      await this.loadCurrent();
    }

    close() {
      this.stopAll(false);
      this.overlay.style.display = 'none';
      window.__pfpAudioHubOpen = false;
      this.restoreMapMusic();
    }

    fadeMediaVolume(audio, target, ms = 420) {
      if (!audio) return;
      const old = this.mediaFades.get(audio);
      if (old) cancelAnimationFrame(old);
      const from = Number.isFinite(audio.volume) ? audio.volume : 1;
      const to = clamp(Number(target) || 0, 0, 1);
      if (Math.abs(from - to) < 0.002 || ms <= 0) {
        try { audio.volume = to; } catch (_) {}
        return;
      }
      const started = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - started) / ms);
        try { audio.volume = from + (to - from) * t; } catch (_) { return; }
        if (t < 1) this.mediaFades.set(audio, requestAnimationFrame(tick));
        else this.mediaFades.delete(audio);
      };
      this.mediaFades.set(audio, requestAnimationFrame(tick));
    }

    captureMapMusicSources() {
      const duck = this.mapMusicDuck;
      if (!duck) return;
      const addMedia = (audio) => {
        if (!audio || audio === this.audio || duck.media.some((e) => e.audio === audio)) return;
        const currentVolume = Number.isFinite(audio.volume) ? audio.volume : 1;
        let nominalVolume = this.mapMusicNominalVolumes.get(audio);
        try {
          const sfa = window.__pfpSfaAudioState;
          if (sfa && sfa.audio === audio && sfa.vol) {
            const v = Number(sfa.vol.value);
            if (Number.isFinite(v)) nominalVolume = clamp(v, 0, 1);
          }
        } catch (_) {}
        if (!Number.isFinite(nominalVolume)) nominalVolume = currentVolume;
        this.mapMusicNominalVolumes.set(audio, nominalVolume);
        const entry = { audio, volume: nominalVolume, wasPaused: !!audio.paused };
        duck.media.push(entry);
        if (!entry.wasPaused) this.fadeMediaVolume(audio, 0, 380);
      };
      try { addMedia(window.musicState && window.musicState.audio); } catch (_) {}
      try { addMedia(window.__pfpSfaAudioState && window.__pfpSfaAudioState.audio); } catch (_) {}

      const native = [];
      try { native.push(window.__pfpOldSfaDpMusic && window.__pfpOldSfaDpMusic.player); } catch (_) {}
      try {
        const scene = window.main && window.main.viewer && window.main.viewer.scene;
        if (scene) {
          native.push(scene.dpNativeMusic);
          if (scene.world) native.push(scene.world.dpNativeMusic);
          if (scene.renderer) native.push(scene.renderer.dpNativeMusic);
        }
      } catch (_) {}
      for (const player of native) {
        if (!player || typeof player.setVolume !== 'function' || duck.native.some((e) => e.player === player)) continue;
        let volume = 1;
        try { if (typeof player.getVolume === 'function') volume = player.getVolume(); } catch (_) {}
        duck.native.push({ player, volume });
        try { player.setVolume(0); } catch (_) {}
      }

      for (const entry of duck.media) {
        try {
          if (!entry.wasPaused && !entry.audio.paused && entry.audio.volume > 0.015) this.fadeMediaVolume(entry.audio, 0, 180);
        } catch (_) {}
      }
    }

    duckMapMusic(reason = 'audioHub') {
      this.mapMusicDuckReasons.add(String(reason || 'audioHub'));
      if (this.mapMusicDuck) return;
      this.mapMusicDuck = { media: [], native: [] };
      this.captureMapMusicSources();
      clearInterval(this.mapDuckTimer);
      this.mapDuckTimer = window.setInterval(() => this.captureMapMusicSources(), 120);
    }

    restoreMapMusic(reason = 'audioHub') {
      this.mapMusicDuckReasons.delete(String(reason || 'audioHub'));
      if (this.mapMusicDuckReasons.size) return;
      clearInterval(this.mapDuckTimer);
      this.mapDuckTimer = 0;
      const duck = this.mapMusicDuck;
      this.mapMusicDuck = null;
      if (!duck) return;
      for (const entry of duck.media) {
        try {
          if (!entry.wasPaused) {
            if (entry.audio.paused) {
              const p = entry.audio.play();
              if (p && typeof p.then === 'function') p.then(() => this.fadeMediaVolume(entry.audio, entry.volume, 480)).catch(() => {});
              else this.fadeMediaVolume(entry.audio, entry.volume, 480);
            } else {
              this.fadeMediaVolume(entry.audio, entry.volume, 480);
            }
          }
        } catch (_) {}
      }
      for (const entry of duck.native) {
        try { entry.player.setVolume(entry.volume); } catch (_) {}
      }
    }

    setExternalMusicDuck(key, enabled) {
      const reason = 'external:' + String(key || 'unknown');
      if (enabled) this.duckMapMusic(reason);
      else this.restoreMapMusic(reason);
    }

    handleLoopChange() {
      const enabled = !!this.loop.checked;
      if (!this.nativeNow) {
        this.audio.loop = enabled;
        return;
      }
      if (this.nativeNow.type === 'music') {
        try { this.nativeNow.player.setLoop && this.nativeNow.player.setLoop(enabled); } catch (_) {}
        return;
      }
      if (this.nativeNow.type === 'sfx') {
        try {
          if (enabled && this.currentItem) {
            this.nativeNow.player.play(this.currentItem.soundId, true);
          } else if (this.nativeNow.player.currentSource) {
            this.nativeNow.player.currentSource.loop = false;
          }
        } catch (_) {}
      }
    }

    handleReverseChange() {
      if (this.reverse.disabled) return;
      if (this.currentItem && (this.nativeNow || !this.audio.paused)) this.playSelected();
    }

    async setGame(game) {
      if (game === this.game) return;
      this.stopAll(false);
      this.game = game;
      this.category = this.categoriesFor(game)[0][0];
      this.search.value = '';
      this.renderGameTabs();
      this.renderCategories();
      this.applyTheme();
      await this.loadCurrent();
    }

    async setCategory(category) {
      if (category === this.category) return;
      this.stopAll(false);
      this.category = category;
      this.search.value = '';
      this.renderCategories();
      await this.loadCurrent();
    }

    setBusy(text) {
      this.status.textContent = text || '';
      this.count.textContent = text || '';
    }

    activeRmsGainFromPcm16(pcm) {
      if (!pcm || !pcm.length) return 1;
      const stride = Math.max(1, Math.floor(pcm.length / 180000));
      let sum = 0, count = 0, peak = 0;
      for (let i = 0; i < pcm.length; i += stride) {
        const v = pcm[i] / 32768;
        const av = Math.abs(v);
        if (av > peak) peak = av;
        if (av < 0.008) continue;
        sum += v * v;
        count++;
      }
      if (!count) return 1;
      const rms = Math.sqrt(sum / count);
      let g = 0.145 / Math.max(0.025, rms);
      if (peak > 0.001) g = Math.min(g, 0.96 / peak);
      return clamp(g, 0.55, 2.8);
    }

    scaledPcm16(pcm, gain) {
      gain = clamp(Number(gain) || 1, 0.45, 3.0);
      if (Math.abs(gain - 1) < 0.025) return pcm;
      const out = new Int16Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) out[i] = clamp16(Math.round(pcm[i] * gain));
      return out;
    }

    reversePcm16Frames(pcm, channels) {
      channels = Math.max(1, Math.trunc(Number(channels) || 1));
      if (!pcm || pcm.length < channels * 2) return pcm;
      const out = new Int16Array(pcm);
      const frames = Math.floor(out.length / channels);
      for (let a = 0, b = frames - 1; a < b; a++, b--) {
        const ao = a * channels, bo = b * channels;
        for (let c = 0; c < channels; c++) {
          const t = out[ao + c]; out[ao + c] = out[bo + c]; out[bo + c] = t;
        }
      }
      return out;
    }

    async reverseDecodedBlobToWav(blob) {
      if (!this.reverse || !this.reverse.checked) return blob;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return blob;
      let ctx = null;
      try {
        ctx = new Ctx();
        const ab = await blob.arrayBuffer();
        const decoded = await ctx.decodeAudioData(ab.slice(0));
        const channels = Math.max(1, decoded.numberOfChannels || 1);
        const frames = decoded.length;
        const pcm = new Int16Array(frames * channels);
        const src = [];
        for (let c = 0; c < channels; c++) src.push(decoded.getChannelData(c));
        for (let f = 0; f < frames; f++) {
          const rf = frames - 1 - f;
          for (let c = 0; c < channels; c++) pcm[f * channels + c] = clamp16(Math.round(clamp(src[c][rf], -1, 1) * 32767));
        }
        return pcmWav(pcm, decoded.sampleRate, channels);
      } catch (_) {
        return blob;
      } finally {
        if (ctx) try { await ctx.close(); } catch (_) {}
      }
    }

    async normalizePcm16WavBlob(key, blob) {
      try {
        const ab = await blob.arrayBuffer();
        const u8 = new Uint8Array(ab);
        const dv = new DataView(ab);
        if (u8.length < 44 || String.fromCharCode(...u8.subarray(0, 4)) !== 'RIFF' || String.fromCharCode(...u8.subarray(8, 12)) !== 'WAVE') return blob;
        let pos = 12, fmtTag = 0, channels = 1, bits = 0, dataOff = -1, dataLen = 0;
        while (pos + 8 <= u8.length) {
          const id = String.fromCharCode(u8[pos],u8[pos+1],u8[pos+2],u8[pos+3]);
          const len = dv.getUint32(pos + 4, true);
          const body = pos + 8;
          if (body + len > u8.length) break;
          if (id === 'fmt ' && len >= 16) { fmtTag = dv.getUint16(body, true); channels = Math.max(1, dv.getUint16(body + 2, true)); bits = dv.getUint16(body + 14, true); }
          if (id === 'data') { dataOff = body; dataLen = len; break; }
          pos = body + len + (len & 1);
        }
        if (fmtTag !== 1 || bits !== 16 || dataOff < 0 || dataLen < 2) return blob;
        const samples = Math.floor(dataLen / 2);
        const pcm = new Int16Array(samples);
        for (let i = 0; i < samples; i++) pcm[i] = dv.getInt16(dataOff + i * 2, true);
        let gain = this.levelGains.get(key);
        if (gain == null) { gain = this.activeRmsGainFromPcm16(pcm); this.levelGains.set(key, gain); }
        const doReverse = !!(this.reverse && this.reverse.checked);
        if (Math.abs(gain - 1) < 0.025 && !doReverse) return blob;
        const out = new Uint8Array(ab.slice(0));
        if ((dataOff & 1) === 0) {
          const opcm = new Int16Array(out.buffer, dataOff, samples);
          for (let i = 0; i < samples; i++) opcm[i] = clamp16(Math.round(opcm[i] * gain));
          if (doReverse) {
            const frames = Math.floor(samples / channels);
            for (let a = 0, b = frames - 1; a < b; a++, b--) {
              const ao = a * channels, bo = b * channels;
              for (let c = 0; c < channels; c++) { const t = opcm[ao + c]; opcm[ao + c] = opcm[bo + c]; opcm[bo + c] = t; }
            }
          }
        } else {
          const work = new Int16Array(samples);
          for (let i = 0; i < samples; i++) work[i] = clamp16(Math.round(pcm[i] * gain));
          const finalPcm = doReverse ? this.reversePcm16Frames(work, channels) : work;
          const odv = new DataView(out.buffer);
          for (let i = 0; i < samples; i++) odv.setInt16(dataOff + i * 2, finalPcm[i], true);
        }
        return new Blob([out], { type: blob.type || 'audio/wav' });
      } catch (_) {
        return blob;
      }
    }

    mediaScaleFor(item) {
      if (!item) return 1;
      if (item.type === 'mpeg-voice') return 0.72;
      return 1;
    }

    setPlainMediaVolume(item) {
      this.audio.volume = clamp(Number(this.volume.value) * this.mediaScaleFor(item), 0, 1);
    }

    nativeMusicVolume() {
      return clamp(Number(this.volume.value) * 1.65, 0, 2.25);
    }

    sequenceBytes(player, sequenceId) {
      if (!player || !player.audioBin) return null;
      const mc = player.musicSequenceEntries ? player.musicSequenceEntries.length : 0;
      const ambient = sequenceId >= mc;
      const idx = ambient ? sequenceId - mc : sequenceId;
      const entries = ambient ? player.ambientSequenceEntries : player.musicSequenceEntries;
      const e = entries && entries[idx];
      if (!e || e.offset < 0 || e.length < 0 || e.offset + e.length > player.audioBin.length) return null;
      return player.audioBin.subarray(e.offset, e.offset + e.length);
    }

    equalBytes(a, b) {
      if (!a || !b || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    }

    actionSignature(player, sequenceId) {
      if (!player || !Array.isArray(player.actions)) return '';
      return JSON.stringify(player.actions.filter((a) => a.sequenceId === sequenceId).map((a) => [a.playerNo,a.rawSequenceId,a.volume,a.bpm,a.fadeTimeDs,a.mask16,a.mask18,a.mask1A]));
    }

    async kioskDifferentNativeMusic() {
      const kiosk = await this.ensureNativeMusic('kiosk');
      let dp = null;
      try { dp = await this.ensureNativeMusic('dp'); } catch (_) { return []; }
      const mc = kiosk.musicSequenceEntries.length;
      const out = [];
      for (const e of kiosk.getTrackCatalog().filter((x) => x.sequenceId < mc)) {
        const sameSequence = this.equalBytes(this.sequenceBytes(kiosk, e.sequenceId), this.sequenceBytes(dp, e.sequenceId));
        const sameActions = this.actionSignature(kiosk, e.sequenceId) === this.actionSignature(dp, e.sequenceId);
        if (!sameSequence || !sameActions) out.push(e);
      }
      return out;
    }

    async loadGcCore(game) {
      if (STATIC_WEB) throw new Error(desktopAudioMessage());
      const c = this.caches[game];
      if (c.gc) return c.gc;
      const pathBase = game === 'kiosk' ? 'StarFoxAdventuresDemo' : 'StarFoxAdventures';
      const [streams, index] = await Promise.all([
        json(ROOT + 'api/sfa-audio/list-streams?pathBase=' + encodeURIComponent(pathBase)),
        json(ROOT + 'api/sfa-audio/index?pathBase=' + encodeURIComponent(pathBase)),
      ]);
      const seen = new Set();
      const entries = (index.entries || []).filter((e) => {
        const id = String(e && (e.id || e.path) || '');
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return e.playable !== false;
      });
      c.gc = {
        pathBase,
        voices: (streams.entries || []).filter((e) => e && e.path).sort((a, b) => a.path.localeCompare(b.path)),
        music: entries.filter((e) => e.kind === 'music'),
        sfx: entries.filter((e) => e.kind === 'sfx'),
      };
      return c.gc;
    }

    async ensureGcSamples(game) {
      if (STATIC_WEB) throw new Error(desktopAudioMessage());
      const c = this.caches[game];
      if (c.samples) return c.samples;
      const pathBase = game === 'kiosk' ? 'StarFoxAdventuresDemo' : 'StarFoxAdventures';
      const j = await json(ROOT + 'api/sfa-audio/list-samples?pathBase=' + encodeURIComponent(pathBase));
      c.samples = (j.entries || []).filter((e) => e && e.type === 'sample' && e.playable !== false).sort((a, b) => (a.label || '').localeCompare(b.label || '', undefined, { numeric: true, sensitivity: 'base' }));
      return c.samples;
    }

    async ensureNativeMusic(game) {
      const c = this.caches[game];
      if (c.nativeMusic) return c.nativeMusic;
      const Ctor = window.__pfpDPNativeMusicClass;
      if (!Ctor || typeof Ctor.create !== 'function') throw new Error('Native music player is unavailable.');
      const pathBase = game === 'kiosk' ? 'StarFoxAdventuresDemo' : 'dinosaurplanet';
      c.nativeMusic = await Ctor.create(dataFetcher(), pathBase);
      c.nativeMusic.setVolume(this.nativeMusicVolume());
      return c.nativeMusic;
    }

    async ensureNativeSfx(game) {
      const c = this.caches[game];
      if (c.nativeSfx) return c.nativeSfx;
      const Ctor = window.__pfpDPSfxClass;
      if (!Ctor || typeof Ctor.create !== 'function') throw new Error('Native SFX player is unavailable.');
      const pathBase = game === 'kiosk' ? 'StarFoxAdventuresDemo' : 'dinosaurplanet';
      c.nativeSfx = await Ctor.create(dataFetcher(), pathBase);
      c.nativeSfx.setVolume(Number(this.volume.value));
      return c.nativeSfx;
    }

    async ensureMpeg(game) {
      const c = this.caches[game];
      if (c.mpeg) return c.mpeg;
      const pathBase = game === 'kiosk' ? 'StarFoxAdventuresDemo' : 'dinosaurplanet';
      const f = dataFetcher();
      const [tab, bin] = await Promise.all([f.fetchData(pathBase + '/MPEG.tab'), f.fetchData(pathBase + '/MPEG.bin')]);
      const tv = tab.createDataView(), bv = bin.createDataView(), size = bv.byteLength;
      const be = parseOffsetTable(tv, size, false), le = parseOffsetTable(tv, size, true);
      c.mpeg = { pathBase, bin: bv, clips: be.length >= le.length ? be : le };
      return c.mpeg;
    }

    gcItems(gc, kind, game) {
      const arr = kind === 'music' ? gc.music : kind === 'sfx' ? gc.sfx : gc.voices;
      if (kind === 'voice') return arr.map((e, i) => ({
        uid: game + ':voice:' + e.path,
        label: e.path.replace(/\.adp$/i, ''),
        source: game === 'kiosk' ? 'Kiosk voice stream' : 'Final SFA voice stream',
        type: 'gc-voice', pathBase: gc.pathBase, path: e.path,
      }));
      return arr.map((e, i) => ({
        uid: game + ':musyx:' + (e.id || e.path || i),
        label: e.label || e.id || e.path || ('Audio ' + i),
        source: game === 'kiosk' ? 'Kiosk MusyX' : 'Final SFA MusyX',
        type: 'gc-musyx', pathBase: gc.pathBase, entry: e,
      }));
    }

    async itemsForCurrent() {
      if (this.game === 'final') {
        if (this.category === 'samples') {
          const samples = await this.ensureGcSamples('final');
          return samples.map((e) => ({
            uid: 'final:sample:' + e.bankId + ':' + e.sampleId,
            label: e.label || (e.bankName + ' sample ' + e.sampleId),
            source: 'Final SFA sample bank', type: 'gc-sample', game: 'final', pathBase: 'StarFoxAdventures', sample: e,
          }));
        }
        const gc = await this.loadGcCore('final');
        return this.gcItems(gc, this.category, 'final');
      }

      if (this.game === 'kiosk') {
        if (this.category === 'samples') {
          const samples = await this.ensureGcSamples('kiosk');
          return samples.map((e) => ({
            uid: 'kiosk:sample:' + e.bankId + ':' + e.sampleId,
            label: e.label || (e.bankName + ' sample ' + e.sampleId),
            source: 'Kiosk sample bank', type: 'gc-sample', game: 'kiosk', pathBase: 'StarFoxAdventuresDemo', sample: e,
          }));
        }
        const gc = await this.loadGcCore('kiosk');
        if (this.category === 'voice') {
          return this.gcItems(gc, 'voice', 'kiosk');
        }
        if (this.category === 'music') {
          const out = this.gcItems(gc, 'music', 'kiosk');
          try {
            for (const e of await this.kioskDifferentNativeMusic()) out.push({ uid: 'kiosk:nmusic:' + e.sequenceId, label: 'Kiosk DP variant - ' + e.label, source: 'Kiosk DP-era music variant', type: 'native-music', game: 'kiosk', sequenceId: e.sequenceId });
          } catch (_) {}
          return out;
        }
        if (this.category === 'sfx') {
          return this.gcItems(gc, 'sfx', 'kiosk');
        }
      }

      if (this.game === 'dp') {
        if (this.category === 'music' || this.category === 'ambient') {
          const p = await this.ensureNativeMusic('dp');
          const mc = p.musicSequenceEntries.length;
          const mapMixAction = { 55: 237, 63: 13 };
          return p.getTrackCatalog().filter((e) => (this.category === 'music' ? e.sequenceId < mc : e.sequenceId >= mc) && !/^silence(?:\s|$)/i.test(String(e.label || '').trim())).map((e) => ({
            uid: 'dp:music:' + e.sequenceId,
            label: e.label,
            source: this.category === 'music' ? 'Dinosaur Planet music' : 'Dinosaur Planet ambient',
            type: 'native-music', game: 'dp', sequenceId: e.sequenceId, actionId: mapMixAction[e.sequenceId] || 0,
          }));
        }
        if (this.category === 'sfx') {
          const p = await this.ensureNativeSfx('dp');
          return p.getCatalog().map((e) => ({
            uid: 'dp:sfx:' + e.soundId, label: e.label, source: 'Dinosaur Planet SFX', type: 'native-sfx', game: 'dp', soundId: e.soundId, clipId: e.clipId,
          }));
        }
        if (this.category === 'voice') {
          const m = await this.ensureMpeg('dp');
          return m.clips.map((clip) => ({ uid: 'dp:mpeg:' + clip.index, label: 'Voice clip ' + clip.index, source: 'Dinosaur Planet MPEG voice', type: 'mpeg-voice', game: 'dp', clip }));
        }
      }
      return [];
    }

    async loadCurrent() {
      this.setBusy('Loading audio collection...');
      this.items = [];
      this.filtered = [];
      this.list.textContent = '';
      this.nowTitle.textContent = 'Choose an audio item';
      this.meta.textContent = '';
      this.source.textContent = 'Loading';
      try {
        this.items = await this.itemsForCurrent();
        this.items.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
        this.applyFilter();
        this.status.textContent = '';
        this.source.textContent = this.items.length ? 'Ready' : 'No audio found';
      } catch (e) {
        this.items = [];
        this.applyFilter();
        this.status.textContent = e && e.message ? e.message : String(e);
        this.source.textContent = 'Audio unavailable';
      }
    }

    applyFilter() {
      const q = this.search.value.trim().toLowerCase();
      const old = this.list.value;
      this.filtered = this.items.filter((e) => !q || (e.label + ' ' + e.source).toLowerCase().includes(q));
      this.list.textContent = '';
      for (const item of this.filtered) {
        const o = document.createElement('option');
        o.value = item.uid;
        o.textContent = item.label;
        this.list.appendChild(o);
      }
      if (this.filtered.some((e) => e.uid === old)) this.list.value = old;
      else if (this.filtered.length) this.list.selectedIndex = 0;
      this.count.textContent = this.filtered.length + (this.filtered.length === this.items.length ? ' audio item' + (this.filtered.length === 1 ? '' : 's') : ' shown · ' + this.items.length + ' total');
      this.selectCurrent();
    }

    selected() {
      return this.filtered.find((e) => e.uid === this.list.value) || null;
    }

    selectCurrent() {
      const item = this.selected();
      if (!item) {
        this.nowTitle.textContent = 'No audio item selected';
        this.meta.textContent = '';
        return;
      }
      this.nowTitle.textContent = item.label;
      const meta = [item.source];
      if (item.type === 'native-sfx') meta.push('SFX ID: 0x' + item.soundId.toString(16).toUpperCase().padStart(4, '0') + ' · clip ' + item.clipId);
      if (item.type === 'native-music') meta.push('Sequence ID: ' + item.sequenceId);
      if (item.type === 'gc-voice') meta.push(item.path);
      if (item.type === 'gc-sample') meta.push((item.sample.sampleRate || 0) + ' Hz · sample ' + item.sample.sampleId + ' · ' + item.sample.bankId + (item.sample.looped ? ' · looped' : ''));
      if (item.type === 'mpeg-voice') meta.push('Clip ' + item.clip.index + ' · ' + item.clip.size.toLocaleString() + ' bytes');
      this.meta.textContent = meta.join('\n');
      this.source.textContent = item.source;
      this.loop.disabled = false;
      this.loop.title = '';
      const reverseUnsupported = item.type === 'native-music';
      this.reverse.disabled = reverseUnsupported;
      this.reverse.title = reverseUnsupported ? 'Reverse is unavailable for live sequenced DP/Kiosk music.' : 'Play this item backwards';
    }

    async playSelected() {
      const item = this.selected();
      if (!item) return;
      this.stopAll(false);
      this.currentItem = item;
      this.nowTitle.textContent = item.label;
      this.source.textContent = item.source;
      this.status.textContent = 'Preparing audio...';
      try {
        if (item.type === 'gc-musyx') await this.playGcMusyx(item);
        else if (item.type === 'gc-voice') await this.playGcVoice(item);
        else if (item.type === 'gc-sample') await this.playGcSample(item);
        else if (item.type === 'native-music') await this.playNativeMusic(item);
        else if (item.type === 'native-sfx') await this.playNativeSfx(item);
        else if (item.type === 'mpeg-voice') await this.playMpeg(item);
        this.status.textContent = 'Playing';
        this.startProgress();
      } catch (e) {
        this.status.textContent = e && e.message ? e.message : String(e);
      }
    }

    async playGcMusyx(item) {
      if (STATIC_WEB) throw new Error(desktopAudioMessage());
      const e = item.entry;
      const r = await json(ROOT + 'api/sfa-audio/render-one?pathBase=' + encodeURIComponent(item.pathBase) + '&id=' + encodeURIComponent(e.id), { method: 'POST' });
      if (!r.ok || !r.path) throw new Error(r.message || 'Could not prepare this item.');
      const src = ROOT + encPath(item.pathBase) + '/' + encPath(r.path);
      let fr = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try { fr = await fetch(src, { cache: 'no-store' }); } catch (_) { fr = null; }
        if (fr && fr.ok) break;
        await sleep(120 * (attempt + 1));
      }
      if (!fr || !fr.ok) throw new Error('Prepared audio could not be opened.');
      let blob = await fr.blob();
      blob = await this.normalizePcm16WavBlob(item.uid, blob);
      const url = URL.createObjectURL(blob);
      this.replaceTempUrl(url);
      this.audio.src = url;
      if (r.transient) fetch(ROOT + 'api/sfa-audio/delete-rendered?pathBase=' + encodeURIComponent(item.pathBase) + '&path=' + encodeURIComponent(r.path), { method: 'POST' }).catch(() => {});
      this.setPlainMediaVolume(item);
      this.audio.loop = !!this.loop.checked;
      this.audio.currentTime = 0;
      await this.audio.play();
    }

    async playGcVoice(item) {
      const key = 'adp:' + item.pathBase + ':' + item.path + ':rev=' + ((this.reverse && this.reverse.checked) ? '1' : '0');
      let url = this.urls.get(key);
      let norm = this.levelGains.get(key);
      if (!url) {
        const r = await fetch(ROOT + encPath(item.pathBase) + '/streams/' + encPath(item.path), { cache: 'no-store' });
        if (!r.ok) throw new Error('Voice stream is missing.');
        const pcm = decodeAdp(new Uint8Array(await r.arrayBuffer()));
        norm = this.activeRmsGainFromPcm16(pcm);
        this.levelGains.set(key, norm);
        let leveled = this.scaledPcm16(pcm, norm);
        if (this.reverse && this.reverse.checked) leveled = this.reversePcm16Frames(leveled, 2);
        url = URL.createObjectURL(pcmWav(leveled, ADP_RATE, 2));
        this.urls.set(key, url);
      }
      this.audio.src = url;
      this.setPlainMediaVolume(item);
      this.audio.loop = !!this.loop.checked;
      this.audio.currentTime = 0;
      await this.audio.play();
    }

    async playGcSample(item) {
      if (STATIC_WEB) throw new Error(desktopAudioMessage());
      const s = item.sample;
      const src = ROOT + 'api/sfa-audio/sample-wav?pathBase=' + encodeURIComponent(item.pathBase) + '&bank=' + encodeURIComponent(s.bankId) + '&sample=' + encodeURIComponent(s.sampleId);
      const r = await fetch(src, { cache: 'no-store' });
      if (!r.ok) throw new Error((item.game === 'final' ? 'Final SFA' : 'Kiosk') + ' sample could not be opened.');
      let blob = await r.blob();
      blob = await this.normalizePcm16WavBlob(item.uid, blob);
      const url = URL.createObjectURL(blob);
      this.replaceTempUrl(url);
      this.audio.src = url;
      this.setPlainMediaVolume(item);
      this.audio.loop = !!this.loop.checked;
      this.audio.currentTime = 0;
      await this.audio.play();
    }

    async playNativeMusic(item) {
      const p = await this.ensureNativeMusic(item.game);
      p.setVolume(this.nativeMusicVolume());
      if (p.setLoop) p.setLoop(!!this.loop.checked);
      await p.playSequenceId(item.sequenceId, Number(item.actionId) || 0);
      this.nativeNow = { type: 'music', player: p };
    }

    async playNativeSfx(item) {
      const p = await this.ensureNativeSfx(item.game);
      p.setVolume(Number(this.volume.value));
      await p.play(item.soundId, !!this.loop.checked, !!(this.reverse && this.reverse.checked));
      this.nativeNow = { type: 'sfx', player: p };
    }

    async playMpeg(item) {
      const m = await this.ensureMpeg(item.game);
      const clip = item.clip;
      const u = new Uint8Array(m.bin.buffer, m.bin.byteOffset + clip.start, clip.size);
      const copy = new Uint8Array(clip.size); copy.set(u);
      let blob = new Blob([copy], { type: 'audio/mpeg' });
      blob = await this.reverseDecodedBlobToWav(blob);
      const url = URL.createObjectURL(blob);
      this.replaceTempUrl(url);
      this.audio.src = url;
      this.setPlainMediaVolume(item);
      this.audio.loop = !!this.loop.checked;
      this.audio.currentTime = 0;
      await this.audio.play();
    }

    replaceTempUrl(url) {
      if (this.tempUrl) try { URL.revokeObjectURL(this.tempUrl); } catch (_) {}
      this.tempUrl = url;
    }

    stopAll(showStatus) {
      cancelAnimationFrame(this.progressRAF);
      this.progressRAF = 0;
      try { this.audio.pause(); this.audio.currentTime = 0; } catch (_) {}
      for (const game of ['kiosk', 'dp']) {
        const c = this.caches[game];
        try { c.nativeMusic && c.nativeMusic.stop && c.nativeMusic.stop(); } catch (_) {}
        try { c.nativeMusic && c.nativeMusic.setLoop && c.nativeMusic.setLoop(true); } catch (_) {}
        try { c.nativeSfx && c.nativeSfx.stop && c.nativeSfx.stop(); } catch (_) {}
      }
      this.nativeNow = null;
      this.seek.max = '1'; this.seek.value = '0'; this.cur.textContent = '0:00'; this.dur.textContent = '0:00';
      if (showStatus) this.status.textContent = 'Stopped';
    }

    step(dir) {
      if (!this.filtered.length) return;
      let i = this.list.selectedIndex;
      if (i < 0) i = 0;
      i = (i + dir + this.filtered.length) % this.filtered.length;
      this.list.selectedIndex = i;
      this.selectCurrent();
      this.playSelected();
    }

    applyVolume() {
      const v = Number(this.volume.value);
      this.audio.volume = clamp(v * this.mediaScaleFor(this.currentItem), 0, 1);
      for (const game of ['kiosk', 'dp']) {
        const c = this.caches[game];
        try { c.nativeMusic && c.nativeMusic.setVolume && c.nativeMusic.setVolume(this.nativeMusicVolume()); } catch (_) {}
        try { c.nativeSfx && c.nativeSfx.setVolume && c.nativeSfx.setVolume(v); } catch (_) {}
      }
    }

    applySeek() {
      const v = Number(this.seek.value) || 0;
      if (this.nativeNow && this.nativeNow.type === 'music') {
        try { this.nativeNow.player.seek(v); } catch (_) {}
      } else if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
        try { this.audio.currentTime = clamp(v, 0, this.audio.duration); } catch (_) {}
      }
      this.startProgress();
    }

    bindAudio() {
      this.audio.addEventListener('ended', () => {
        if (this.loop.checked && this.currentItem && !this.nativeNow) {
          try { this.audio.currentTime = 0; this.audio.play().catch(() => {}); } catch (_) {}
        } else if (!this.audio.loop) {
          this.status.textContent = 'Finished';
        }
      });
      this.audio.addEventListener('error', () => { if (this.currentItem && !this.nativeNow) this.status.textContent = 'Playback failed'; });
    }

    startProgress() {
      cancelAnimationFrame(this.progressRAF);
      const tick = () => {
        let pos = 0, dur = 0;
        if (this.nativeNow && this.nativeNow.type === 'music') {
          try { pos = this.nativeNow.player.getPositionSeconds(); dur = this.nativeNow.player.getDurationSeconds(); } catch (_) {}
        } else {
          pos = Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0;
          dur = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
        }
        this.seek.max = String(dur > 0 ? dur : 1);
        if (!this.seek.matches(':active')) this.seek.value = String(Math.min(pos, dur > 0 ? dur : 1));
        this.cur.textContent = fmt(pos);
        this.dur.textContent = fmt(dur);
        if (this.overlay.style.display !== 'none' && (this.nativeNow || !this.audio.paused)) this.progressRAF = requestAnimationFrame(tick);
        else this.progressRAF = 0;
      };
      this.progressRAF = requestAnimationFrame(tick);
    }
  }

  window.__pfpAudioHub = new AudioHub();
})();
