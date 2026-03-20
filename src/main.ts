/* @preserve The source code to this website is under the MIT license and can be found at https://github.com/magcius/noclip.website */

import { Viewer, SceneGfx, InitErrorCode, initializeViewer, makeErrorUI, resizeCanvas, ViewerUpdateInfo } from './viewer.js';
import * as Scenes_DinosaurPlanet from './StarFoxAdventures/dpscenes.js';
import * as Scenes_StarFoxAdventures from './StarFoxAdventures/scenes.js';
import { UI, Panel } from './ui.js';
import { serializeCamera, deserializeCamera, FPSCameraController } from './Camera.js';
import { assertExists, assert } from './util.js';
import { loadRustLib } from './rustlib.js';
import { DataFetcher } from './DataFetcher.js';
import { atob, btoa } from './Ascii85.js';
import { mat4 } from 'gl-matrix';
import { GlobalSaveManager, SaveStateLocation } from './SaveManager.js';
import { RenderStatistics } from './RenderStatistics.js';
import { Color } from './Color.js';
import { standardFullClearRenderPassDescriptor } from './gfx/helpers/RenderGraphHelpers.js';

import { SceneDesc, SceneGroup, SceneContext, Destroyable } from './SceneBase.js';
import { prepareFrameDebugOverlayCanvas2D } from './DebugJunk.js';
import { downloadBlob } from './DownloadUtils.js';
import { DataShare } from './DataShare.js';
import InputManager from './InputManager.js';
import { WebXRContext } from './WebXR.js';
import { debugJunk } from './DebugJunk.js';

const sceneGroups: (string | SceneGroup)[] = [
    "MAP + MODEL VIEWER FOR SFA AND DP",
    Scenes_DinosaurPlanet.sceneGroup,
    Scenes_StarFoxAdventures.sceneGroup,
];

function convertCanvasToPNG(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve) => canvas.toBlob((b) => resolve(assertExists(b)), 'image/png'));
}

const enum SaveStatesAction { Load, LoadDefault, Save, Delete };

class AnimationLoop implements ViewerUpdateInfo {
    public time: number = 0;
    public webXRContext: WebXRContext | null = null;
    public onupdate: ((updateInfo: ViewerUpdateInfo) => void);
    public useRequestPostAnimationFrame = false;
    private _timeoutCallback = (): void => { this.onupdate(this); };
    public requestPostAnimationFrame = (): void => {
        this.time = window.performance.now();
        if (this.useRequestPostAnimationFrame) setTimeout(this._timeoutCallback, 0);
        else this.onupdate(this);
    };
}

function getSceneDescs(sceneGroup: SceneGroup): SceneDesc[] {
    return sceneGroup.sceneDescs.filter((g) => typeof g !== 'string') as SceneDesc[];
}

/* --- Only SFA visible in the Games panel --- */
function hideAllButGames(groups: (string | SceneGroup)[], allowed: Set<SceneGroup>) {
    for (const g of groups) {
        if (typeof g === 'string') continue;
        g.hidden = !allowed.has(g);
    }
}

function applySFADockSkin() {
  const btns = Array.from(document.querySelectorAll('button, .button, .tool-button')) as HTMLElement[];
  btns.forEach(b => {
    const r = b.getBoundingClientRect();
    if (r.width <= 80 && r.height <= 80 && r.left < 140) {
      b.classList.add('sfa-dock-btn');
    }
  });
}

function observeUiForDockSkin() {
  applySFADockSkin();
  const mo = new MutationObserver(() => applySFADockSkin());
  mo.observe(document.body, { childList: true, subtree: true });
}

type BackgroundMode = 'none' | 'landing' | 'sfa' | 'dp';

function injectBackgroundOnlyCSS() {
  if (document.getElementById('sfa-dp-background-only-style')) return;

  const css = `
html, body {
  min-height: 100%;
}

html[data-bg-mode="landing"], body[data-bg-mode="landing"]{
  background:
    radial-gradient(900px 420px at 10% 8%, rgba(43,43,184,.14), transparent 55%),
    radial-gradient(900px 420px at 90% 6%, rgba(224,181,78,.12), transparent 58%),
    linear-gradient(180deg, rgba(6,10,18,.96), rgba(7,10,18,.98)) !important;
}

html[data-bg-mode="sfa"], body[data-bg-mode="sfa"]{
  background:
    radial-gradient(900px 420px at 10% 8%, rgba(43,43,184,.14), transparent 55%),
    radial-gradient(900px 420px at 90% 6%, rgba(224,181,78,.12), transparent 58%),
    linear-gradient(180deg, rgba(6,10,18,.96), rgba(7,10,18,.98)) !important;
}

html[data-bg-mode="dp"], body[data-bg-mode="dp"]{
  background:
    radial-gradient(900px 420px at 12% 8%, rgba(120,70,24,.22), transparent 55%),
    radial-gradient(900px 420px at 88% 6%, rgba(211,154,58,.12), transparent 58%),
    linear-gradient(180deg, rgba(10,7,5,.96), rgba(8,6,5,.98)) !important;
}

html[data-bg-mode="none"], body[data-bg-mode="none"]{
  background: #000 !important;
}
  `;

  const style = document.createElement('style');
  style.id = 'sfa-dp-background-only-style';
  style.textContent = css;
  document.head.appendChild(style);
}

function setBackgroundMode(mode: BackgroundMode, canvas?: HTMLCanvasElement) {
  document.body.dataset.bgMode = mode;
  document.documentElement.dataset.bgMode = mode;
  if (canvas) canvas.style.display = (mode === 'none') ? '' : 'none';
}

function setLandingModeUI(isLanding: boolean) {
  document.body.dataset.landing = isLanding ? '1' : '0';
  const mapsPanel = document.querySelector('#Panel') as HTMLElement | null;
  if (mapsPanel) {
    mapsPanel.style.display = isLanding ? 'none' : '';
  }

  if (isLanding) {
    ensureSplashTitle();
  }
}

function ensureSplashTitle() {
  if (document.getElementById('sfa-dp-splash-title')) return;

  const allHeaders = Array.from(document.querySelectorAll('span, div, h1, h2, h3')) as HTMLElement[];
  const selectGameNode = allHeaders.find((el) => (el.textContent || '').trim().toUpperCase() === 'SELECT GAME');
  if (!selectGameNode) return;

  let landingContainer: HTMLElement | null = selectGameNode.parentElement as HTMLElement | null;
  for (let i = 0; i < 4 && landingContainer; i++) {
    if (landingContainer.querySelector('img')) break;
    landingContainer = landingContainer.parentElement as HTMLElement | null;
  }
  if (!landingContainer) return;

  const titleWrap = document.createElement('div');
  titleWrap.id = 'sfa-dp-splash-title';
  titleWrap.innerHTML = `
    <div class="splash-main">Dinosaur Planet &amp; StarFox Adventures</div>
    <div class="splash-sub">Map and Model Viewer</div>
  `;

  landingContainer.insertBefore(titleWrap, landingContainer.firstChild);
}

function ensureLandingVersion() {
  const allNodes = Array.from(document.querySelectorAll('span, div, h1, h2, h3')) as HTMLElement[];
  const selectGameNodes = allNodes.filter((el) => (el.textContent || '').trim().toUpperCase() === 'SELECT GAME');
  if (!selectGameNodes.length) return;

  // Pick the right-side "SELECT GAME", not the left maps entry.
  const selectGameNode = selectGameNodes.sort(
    (a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left
  )[0];

  let container: HTMLElement | null = selectGameNode.parentElement as HTMLElement | null;
  for (let i = 0; i < 6 && container; i++) {
    if (container.querySelectorAll('img').length >= 2) break;
    container = container.parentElement as HTMLElement | null;
  }
  if (!container) return;

  container.style.position = 'relative';

  let version = document.getElementById('landing-version') as HTMLElement | null;
  if (!version) {
    version = document.createElement('div');
    version.id = 'landing-version';
    version.textContent = 'Version 0.8.7';
    container.appendChild(version);
  } else if (version.parentElement !== container) {
    container.appendChild(version);
  }
}

function injectSFASkin() {
  const css = `
:root{
  --sfa-gold:#E0B54E;
  --sfa-navy:#0B1124;
  --sfa-border: rgba(43,43,184,.26);
  --sfa-accent: var(--sfa-gold);
  --sfa-accent-8: rgba(224,181,78,.10);
  --sfa-white:#eef6ff;
  --radius:16px;
  --radius-sm:12px;
}

body[data-landing="1"] #Panel{
  display:none !important;
}

body[data-landing="1"] #SceneSelect,
body[data-landing="1"] [class*="scene-select"],
body[data-landing="1"] [class*="SceneSelect"]{
  margin-inline:auto !important;
}

#sfa-dp-splash-title{
  text-align:center;
  margin: 6px 0 18px 0;
  padding: 8px 10px 2px 10px;
  pointer-events:none;
}

#sfa-dp-splash-title .splash-main{
  color:#F0C75A;
  font-weight:900;
  letter-spacing:1.2px;
  text-transform:uppercase;
  font-size: 1.35rem;
  line-height:1.15;
  text-shadow:
    0 1px 0 #1a1258,
    0 2px 8px rgba(0,0,0,.45);
}

#sfa-dp-splash-title .splash-sub{
  margin-top:6px;
  color:#dfeaff;
  font-weight:800;
  letter-spacing:1px;
  text-transform:uppercase;
  font-size:.95rem;
  line-height:1.1;
  opacity:.95;
  text-shadow: 0 1px 6px rgba(0,0,0,.45);
}

#landing-version{
  position:absolute;
  left:0;
  right:0;
  bottom:22px;
  color:rgba(255,255,255,.72);
  font-size:12px;
  font-weight:600;
  letter-spacing:.5px;
  text-align:center;
  text-shadow:0 1px 4px rgba(0,0,0,.55);
  pointer-events:none;
  z-index:20;
}

/* Original theme CSS kept unchanged below */
body[data-game-theme="dp"]{
  --sfa-gold: #a8a8a8;
  --sfa-purple: #8f8f8f;
  --sfa-navy: #120C08;
  --sfa-border: rgba(207, 207, 207, 0.3);
  --sfa-accent: #858585;
  --sfa-accent-8: rgba(211,154,58,.12);
  --sfa-white: #F4E9D8;
}

body[data-game-theme="dp"]{
  background:
    radial-gradient(900px 420px at 12% 8%, rgba(120,70,24,.18), transparent 55%),
    radial-gradient(900px 420px at 88% 6%, rgba(211,154,58,.10), transparent 58%),
    #080605 !important;
}

body[data-game-theme="dp"] #Panel .sfa-card{
  background: rgba(20,12,8,.92) !important;
  box-shadow: inset 0 0 1px rgba(255,220,180,.04);
}

body[data-game-theme="dp"] .sfa-list{
  background: linear-gradient(180deg, rgba(22,14,9,.95), rgba(12,8,6,.95)) !important;
  border: 1px solid rgba(170,110,48,.32) !important;
  box-shadow: 0 16px 38px rgba(0,0,0,.65), inset 0 0 1px rgba(255,220,180,.04);
}

body[data-game-theme="dp"] .sfa-list .selector:hover{
  background: rgba(211,154,58,.12) !important;
}

body[data-game-theme="dp"] .sfa-list span.text{
  color: #F7EAD8 !important;
  text-shadow: 0 2px 3px rgba(0,0,0,.65);
}

body[data-game-theme="dp"] .sfa-list span.header{
  color: #E6C89A !important;
  border-bottom: 1px solid rgba(170,110,48,.24) !important;
}

body[data-game-theme="dp"] .sfa-title{
  background: linear-gradient(180deg, #D39A3A, #A66A27) !important;
  color: #1A0D05 !important;
  box-shadow: inset 0 1px 0 rgba(255,230,180,.10);
}

body[data-game-theme="dp"] .sfa-dock-btn,
body[data-game-theme="dp"] #LeftBar button,
body[data-game-theme="dp"] #Toolbox button,
body[data-game-theme="dp"] #Tools button,
body[data-game-theme="dp"] #Dock button,
body[data-game-theme="dp"] #LeftBar .button,
body[data-game-theme="dp"] #Toolbox .button,
body[data-game-theme="dp"] #Tools .button,
body[data-game-theme="dp"] #Dock .button{
  background: linear-gradient(180deg,#2A1A12,#140D09) !important;
  border: 1px solid rgba(170,110,48,.30) !important;
  box-shadow: 0 14px 28px rgba(0,0,0,.55), inset 0 0 1px rgba(255,220,180,.03) !important;
}

body[data-game-theme="dp"] .sfa-dock-btn::after,
body[data-game-theme="dp"] #LeftBar button::after,
body[data-game-theme="dp"] #Toolbox button::after,
body[data-game-theme="dp"] #Tools button::after,
body[data-game-theme="dp"] #Dock button::after,
body[data-game-theme="dp"] #LeftBar .button::after,
body[data-game-theme="dp"] #Toolbox .button::after,
body[data-game-theme="dp"] #Tools .button::after,
body[data-game-theme="dp"] #Dock .button::after{
  box-shadow: inset 0 0 0 2px rgba(120,70,24,.24) !important;
}

body[data-game-theme="dp"] .sfa-dock-btn::before,
body[data-game-theme="dp"] #LeftBar button::before,
body[data-game-theme="dp"] #Toolbox button::before,
body[data-game-theme="dp"] #Tools button::before,
body[data-game-theme="dp"] #Dock button::before,
body[data-game-theme="dp"] #LeftBar .button::before,
body[data-game-theme="dp"] #Toolbox .button::before,
body[data-game-theme="dp"] #Tools .button::before,
body[data-game-theme="dp"] #Dock .button::before{
  background: radial-gradient(28px 28px at -6px 50%, rgba(211,154,58,.32), transparent 60%) !important;
}

body[data-game-theme="sfa"]{
  background:
    radial-gradient(900px 420px at 10% 8%, rgba(43,43,184,.10), transparent 55%),
    radial-gradient(900px 420px at 90% 6%, rgba(224,181,78,.08), transparent 58%),
    var(--sfa-navy);
}

body[data-game-theme="sfa"] .sfa-shell{
  border-radius:var(--radius) !important;
  overflow:hidden !important;
  background-clip:padding-box !important;
  isolation:isolate;
  -webkit-mask-image:-webkit-radial-gradient(white,black);
  box-shadow:0 18px 48px rgba(0,0,0,.6), inset 0 0 1px rgba(255,255,255,.04);
}

body[data-game-theme="sfa"] .sfa-shell > :first-child{
  border-top-left-radius:var(--radius) !important;
  border-top-right-radius:var(--radius) !important;
}
body[data-game-theme="sfa"] .sfa-shell > :last-child{
  border-bottom-left-radius:var(--radius) !important;
  border-bottom-right-radius:var(--radius) !important;
}

body[data-game-theme="sfa"] .sfa-title{
  background:linear-gradient(180deg,var(--sfa-accent),#caa341) !important;
  color:#1A1258 !important;
  text-transform:uppercase;
  letter-spacing:.8px;
  border:0 !important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
}

body[data-game-theme="sfa"] #Panel .sfa-card{
  background:rgba(9,22,36,.90);
  box-shadow:inset 0 0 1px rgba(255,255,255,.03);
  border:0 !important;
  backdrop-filter:blur(6px);
}

body[data-game-theme="sfa"] .sfa-search{
  border-radius:12px !important;
  background:linear-gradient(180deg,rgba(8,16,30,.96),rgba(6,12,22,.96));
  border:1px solid var(--sfa-border);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.02);
  color: var(--sfa-white);
}

body[data-game-theme="sfa"] .sfa-rand{
  border-radius:12px !important;
  background:linear-gradient(180deg,#0b182c,#081421);
  border:1px solid var(--sfa-border);
}

body[data-game-theme="sfa"] .sfa-list{
  background:linear-gradient(180deg,rgba(10,20,34,.94),rgba(7,14,26,.94));
  border:1px solid var(--sfa-border);
  border-radius:var(--radius) !important;
  overflow:hidden !important;
  box-shadow:0 16px 38px rgba(0,0,0,.6), inset 0 0 1px rgba(255,255,255,.03);
}

body[data-game-theme="sfa"] .sfa-list .selector:hover{
  background:var(--sfa-accent-8);
}

body[data-game-theme="sfa"] .sfa-list span.text{
  color:#eaf7ff;
  text-shadow:0 2px 3px rgba(0,0,0,.6);
  font-weight:800;
  letter-spacing:.8px;
}

body[data-game-theme="sfa"] .sfa-list span.header{
  color:#cfdbff;
  text-transform:uppercase;
  letter-spacing:.9px;
  padding:8px;
  border-bottom:1px solid rgba(43,43,184,.20);
}

body[data-game-theme="sfa"] .sfa-right-menu span.header{
  color: var(--sfa-gold);
  font-weight: 900;
  letter-spacing: 1px;
  text-transform: uppercase;
  -webkit-text-stroke: 2.2px var(--sfa-purple);
  paint-order: stroke fill;
  text-shadow:
    0 1px 0 var(--sfa-purple),  0 -1px 0 var(--sfa-purple),
    1px 0 0 var(--sfa-purple),  -1px 0 0 var(--sfa-purple),
    1px 1px 0 var(--sfa-purple), -1px 1px 0 var(--sfa-purple),
    1px -1px 0 var(--sfa-purple), -1px -1px 0 var(--sfa-purple),
    0 0 6px rgba(43,43,184,.25);
}

body[data-game-theme="sfa"] .sfa-dock-btn,
body[data-game-theme="sfa"] #LeftBar button,
body[data-game-theme="sfa"] #Toolbox button,
body[data-game-theme="sfa"] #Tools button,
body[data-game-theme="sfa"] #Dock button,
body[data-game-theme="sfa"] #LeftBar .button,
body[data-game-theme="sfa"] #Toolbox .button,
body[data-game-theme="sfa"] #Tools .button,
body[data-game-theme="sfa"] #Dock .button{
  position: relative;
  border-radius: 12px !important;
  overflow: hidden !important;
  background: linear-gradient(180deg,#112540,#0b182c) !important;
  border: 1px solid var(--sfa-border) !important;
  box-shadow: 0 14px 28px rgba(0,0,0,.55), inset 0 0 1px rgba(255,255,255,.03) !important;
  outline: none !important;
  display: grid;
  place-items: center;
}

body[data-game-theme="sfa"] .sfa-dock-btn > *,
body[data-game-theme="sfa"] #LeftBar button > *,
body[data-game-theme="sfa"] #Toolbox button > *,
body[data-game-theme="sfa"] #Tools button > *,
body[data-game-theme="sfa"] #Dock button > *,
body[data-game-theme="sfa"] #LeftBar .button > *,
body[data-game-theme="sfa"] #Toolbox .button > *,
body[data-game-theme="sfa"] #Tools .button > *,
body[data-game-theme="sfa"] #Dock .button > *{
  background: transparent !important;
  background-image: none !important;
  border: 0 !important;
  box-shadow: none !important;
}

body[data-game-theme="sfa"] .sfa-dock-btn::after,
body[data-game-theme="sfa"] #LeftBar button::after,
body[data-game-theme="sfa"] #Toolbox button::after,
body[data-game-theme="sfa"] #Tools button::after,
body[data-game-theme="sfa"] #Dock button::after,
body[data-game-theme="sfa"] #LeftBar .button::after,
body[data-game-theme="sfa"] #Toolbox .button::after,
body[data-game-theme="sfa"] #Tools .button::after,
body[data-game-theme="sfa"] #Dock .button::after{
  content:"";
  position:absolute;
  inset:0;
  border-radius:inherit;
  pointer-events:none;
  box-shadow: inset 0 0 0 2px rgba(43,43,184,.20);
}

body[data-game-theme="sfa"] .sfa-dock-btn::before,
body[data-game-theme="sfa"] #LeftBar button::before,
body[data-game-theme="sfa"] #Toolbox button::before,
body[data-game-theme="sfa"] #Tools button::before,
body[data-game-theme="sfa"] #Dock button::before,
body[data-game-theme="sfa"] #LeftBar .button::before,
body[data-game-theme="sfa"] #Toolbox .button::before,
body[data-game-theme="sfa"] #Tools .button::before,
body[data-game-theme="sfa"] #Dock .button::before{
  content:"";
  position:absolute;
  inset:0;
  border-radius:inherit;
  pointer-events:none;
  background: radial-gradient(28px 28px at -6px 50%, rgba(224,181,78,.38), transparent 60%);
}

body[data-game-theme="sfa"] .sfa-dock-btn:focus,
body[data-game-theme="sfa"] .sfa-dock-btn[aria-pressed="true"],
body[data-game-theme="sfa"] #LeftBar button:focus,
body[data-game-theme="sfa"] #Toolbox button:focus,
body[data-game-theme="sfa"] #Tools button:focus,
body[data-game-theme="sfa"] #Dock button:focus,
body[data-game-theme="sfa"] #LeftBar .button[aria-pressed="true"],
body[data-game-theme="sfa"] #Toolbox .button[aria-pressed="true"],
body[data-game-theme="sfa"] #Tools .button[aria-pressed="true"],
body[data-game-theme="sfa"] #Dock .button[aria-pressed="true"]{
  box-shadow: 0 16px 32px rgba(0,0,0,.6), inset 0 0 0 2px rgba(224,181,78,.55) !important;
}

body[data-game-theme="sfa"] .sfa-right-menu .selector .text,
body[data-game-theme="sfa"] .sfa-right-menu span.text{
  font-size: 0.90em !important;
  line-height: 1.25em;
}
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

/* ========================================================================= */

class Main {
    public toplevel: HTMLElement;
    public canvas: HTMLCanvasElement;
    public viewer: Viewer;
    public groups: (string | SceneGroup)[];  public ui: UI;
    public saveManager = GlobalSaveManager;

    private droppedFileGroup: SceneGroup;
    private currentSceneGroup: SceneGroup | null = null;
    private currentSceneDesc: SceneDesc | null = null;

    private loadingSceneDesc: SceneDesc | null = null;
    private destroyablePool: Destroyable[] = [];
    private dataShare = new DataShare();
    private dataFetcher: DataFetcher;
    private lastUpdatedURLTimeSeconds: number = -1;

    private postAnimFrameCanvas = new AnimationLoop();
    private postAnimFrameWebXR = new AnimationLoop();
    private webXRContext: WebXRContext;

    public sceneTimeScale = 1.0;
    public isEmbedMode = false;
    private isFrameStep = false;
    private pixelSize = 1;

    // expose debug helpers
    private debugJunk = debugJunk;

    constructor() { this.init(); }

public setActiveGame(game: 'sfa' | 'dp'): void {
    setLandingModeUI(false);
    setBackgroundMode(game, this.canvas);
    this.ui.applyGameTheme(game);
    document.body.dataset.gameTheme = game;

    const gameToGroups: Record<'sfa' | 'dp', SceneGroup[]> = {
      sfa: [Scenes_StarFoxAdventures.sceneGroup],
      dp:  [Scenes_DinosaurPlanet.sceneGroup],
    };

    const allowed = new Set(gameToGroups[game]);
    hideAllButGames(this.groups, allowed);

    (this.ui.sceneSelect as any).setForceVisible(false);

this._loadSceneGroups();

const firstGroup = gameToGroups[game][0];
(this.ui.sceneSelect as any).selectSceneGroup(firstGroup);

this.ui.sceneSelect.showGameLanding(false);
this.ui.sceneSelect.setExpanded(true);
}

public showGamePicker(): void {
    setLandingModeUI(true);
    setBackgroundMode('landing', this.canvas);

    this.ui.sceneSelect.showGameLanding(true);
    hideAllButGames(this.groups, new Set());
    this._loadSceneGroups();
    this.ui.sceneSelect.setExpanded(true);
    requestAnimationFrame(() => ensureLandingVersion());
}

    public async init() {
        this.isEmbedMode = window.location.pathname === '/embed.html';

        this.toplevel = document.createElement('div');
        document.body.appendChild(this.toplevel);

        injectSFASkin();
        injectBackgroundOnlyCSS();
        document.body.dataset.gameTheme = 'sfa';
        document.body.dataset.bgMode = 'landing';
        document.documentElement.dataset.bgMode = 'landing';
        this.canvas = document.createElement('canvas');
        this.canvas.style.imageRendering = 'pixelated';
        this.canvas.style.outline = 'none';
        this.toplevel.appendChild(this.canvas);
        window.onresize = this._onResize.bind(this);
        this._onResize();

        await loadRustLib();

        const errorCode = await initializeViewer(this, this.canvas);
        if (errorCode !== InitErrorCode.SUCCESS) {
            this.toplevel.appendChild(makeErrorUI(errorCode));
            return;
        }

        setBackgroundMode('landing', this.canvas);

        this.webXRContext = new WebXRContext(this.viewer.gfxSwapChain);
        this.webXRContext.onframe = this.postAnimFrameWebXR.requestPostAnimationFrame;

        this.postAnimFrameCanvas.onupdate = this._onPostAnimFrameUpdate;
        this.postAnimFrameWebXR.webXRContext = this.webXRContext;
        this.postAnimFrameWebXR.useRequestPostAnimationFrame = false;
        this.postAnimFrameWebXR.onupdate = this._onPostAnimFrameUpdate;

        this.toplevel.ondragover = (e) => {
            if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
            this.ui.dragHighlight.style.display = 'block';
            e.preventDefault();
        };
        this.toplevel.ondragleave = (e) => { this.ui.dragHighlight.style.display = 'none'; e.preventDefault(); };

        this.viewer.onstatistics = (s: RenderStatistics) => { this.ui.statisticsPanel.addRenderStatistics(s); };
        this.viewer.oncamerachanged = (force: boolean) => { this._saveState(force); };
        this.viewer.inputManager.ondraggingmodechanged = () => { this.ui.setDraggingMode(this.viewer.inputManager.getDraggingMode()); };

        this._makeUI();

        this.dataFetcher = new DataFetcher(this.ui.sceneSelect);
        await this.dataFetcher.init();

        this.groups = sceneGroups;
hideAllButGames(this.groups, new Set());
this._loadSceneGroups();
this.ui.sceneSelect.showGameLanding(true);

        this.droppedFileGroup = { id: "drops", name: "Dropped Files", sceneDescs: [], hidden: true };
        this.groups.push('Other', this.droppedFileGroup);

        this._loadSceneGroups();
this.ui.sceneSelect.showGameLanding(true);
requestAnimationFrame(() => ensureLandingVersion());

        const maps = (this.ui.sceneSelect as any);
(maps.elem as HTMLElement).classList.add('sfa-shell');
maps.headerContainer?.classList?.add('sfa-title');
maps.contents?.classList?.add('sfa-card');
(maps.sceneGroupList.elem as HTMLElement).classList.add('sfa-list');
(maps.sceneDescList.elem as HTMLElement).classList.add('sfa-list','sfa-right-menu');

        const starIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" height="20" fill="white"><path d="M48 6l8 20 22 2-17 14 6 21-19-12-19 12 6-21-17-14 22-2 8-20z"/></svg>`;
        (this.ui.sceneSelect as any).setTitle(starIcon, 'MAPS');

        window.onhashchange = this._onHashChange.bind(this);
        if (this.currentSceneDesc === null) this._onHashChange();

        if (this.currentSceneDesc === null) {
            const currentDescId = this.saveManager.getCurrentSceneDescId();
            if (currentDescId !== null) {
                const key = this.saveManager.getSaveStateSlotKey(currentDescId, 0);
                const sceneState = this.saveManager.loadState(key);
                this._loadSceneDescById(currentDescId, sceneState);
            }
        }

        if (this.currentSceneDesc === null) this.ui.sceneSelect.setExpanded(true);

        this._onRequestAnimationFrameCanvas();
    }

    private _onHashChange(): void {
        const hash = window.location.hash;
        if (hash.startsWith('#')) this._loadState(decodeURIComponent(hash.slice(1)));
    }

    private _exportSaveData() {
        const saveData = this.saveManager.export();
        const date = new Date();
        downloadBlob(`noclip_export_${date.toISOString()}.nclsp`, new Blob([saveData]));
    }

    private pickSaveStatesAction(inputManager: InputManager): SaveStatesAction {
        if (inputManager.isKeyDown('ShiftLeft')) return SaveStatesAction.Save;
        else if (inputManager.isKeyDown('AltLeft')) return SaveStatesAction.Delete;
        else return SaveStatesAction.Load;
    }

    private checkKeyShortcuts() {
        const inputManager = this.viewer.inputManager;
        if (inputManager.isKeyDownEventTriggered('KeyZ')) this._toggleUI();
        if (inputManager.isKeyDownEventTriggered('KeyT')) this.ui.sceneSelect.expandAndFocus();
        for (let i = 1; i <= 9; i++) {
            if (inputManager.isKeyDownEventTriggered('Digit'+i)) {
                if (this.currentSceneDesc) {
                    const key = this._getSaveStateSlotKey(i);
                    const action = this.pickSaveStatesAction(inputManager);
                    this.doSaveStatesAction(action, key);
                }
            }
        }
        if (inputManager.isKeyDownEventTriggered('Numpad3')) this._exportSaveData();
        if (inputManager.isKeyDownEventTriggered('Period')) this.ui.togglePlayPause();
        if (inputManager.isKeyDown('Comma')) { this.ui.togglePlayPause(false); this.isFrameStep = true; }
        if (inputManager.isKeyDownEventTriggered('F9')) this._loadSceneDesc(this.currentSceneGroup!, this.currentSceneDesc!, this._getSceneSaveState(), true);
    }

    private async _onWebXRStateRequested(state: boolean) {
        if (!this.webXRContext) return;
        if (state) {
            try {
                await this.webXRContext.start();
                if (!this.webXRContext.xrSession) return;
                mat4.getTranslation(this.viewer.xrCameraController.offset, this.viewer.camera.worldMatrix);
                this.webXRContext.xrSession.addEventListener('end', () => { this.ui.toggleWebXRCheckbox(false); });
            } catch(e) {
                console.error("Failed to start XR");
                this.ui.toggleWebXRCheckbox(false);
            }
        } else {
            this.webXRContext.end();
        }
    }

    private _onPostAnimFrameUpdate = (updateInfo: ViewerUpdateInfo): void => {
        this.checkKeyShortcuts();
        prepareFrameDebugOverlayCanvas2D();

        const shouldTakeScreenshot = this.viewer.inputManager.isKeyDownEventTriggered('Numpad7') || this.viewer.inputManager.isKeyDownEventTriggered('BracketRight');

        let sceneTimeScale = this.sceneTimeScale;
        if (!this.ui.isPlaying) {
            if (this.isFrameStep) { sceneTimeScale /= 4.0; this.isFrameStep = false; }
            else sceneTimeScale = 0.0;
        }

        if (!this.viewer.externalControl) {
            this.viewer.sceneTimeScale = sceneTimeScale;
            this.viewer.update(updateInfo);
        }

        if (shouldTakeScreenshot) this._takeScreenshot();
        this.ui.update();
    };

    private _onRequestAnimationFrameCanvas = (): void => {
        if (this.webXRContext.xrSession !== null) {
        } else {
            this.postAnimFrameCanvas.requestPostAnimationFrame();
        }
        window.requestAnimationFrame(this._onRequestAnimationFrameCanvas);
    };

    private _onResize() {
        resizeCanvas(this.canvas, window.innerWidth, window.innerHeight, window.devicePixelRatio / this.pixelSize);
    }

    private _saveStateTmp = new Uint8Array(512);
    private _saveStateView = new DataView(this._saveStateTmp.buffer);
    private _getSceneSaveState() {
        let byteOffs = 0;
        const optionsBits = 0;
        this._saveStateView.setUint8(byteOffs, optionsBits);
        byteOffs++;
        byteOffs += serializeCamera(this._saveStateView, byteOffs, this.viewer.camera);
        if (this.viewer.scene !== null && this.viewer.scene.serializeSaveState)
            byteOffs = this.viewer.scene.serializeSaveState(this._saveStateTmp.buffer as ArrayBuffer, byteOffs);
        const s = btoa(this._saveStateTmp, byteOffs);
        return `ShareData=${s}`;
    }

    private _loadSceneSaveStateVersion2(state: string): boolean {
        const byteLength = atob(this._saveStateTmp, 0, state);
        let byteOffs = 0;
        this.viewer.sceneTime = this._saveStateView.getFloat32(byteOffs + 0x00, true);
        byteOffs += 0x04;
        byteOffs += deserializeCamera(this.viewer.camera, this._saveStateView, byteOffs);
        if (this.viewer.scene !== null && this.viewer.scene.deserializeSaveState)
            byteOffs = this.viewer.scene.deserializeSaveState(this._saveStateTmp.buffer as ArrayBuffer, byteOffs, byteLength);
        if (this.viewer.cameraController !== null) this.viewer.cameraController.cameraUpdateForced();
        return true;
    }

    private _loadSceneSaveStateVersion3(state: string): boolean {
        const byteLength = atob(this._saveStateTmp, 0, state);
        let byteOffs = 0;
        const optionsBits = this._saveStateView.getUint8(byteOffs + 0x00); assert(optionsBits === 0); byteOffs++;
        byteOffs += deserializeCamera(this.viewer.camera, this._saveStateView, byteOffs);
        if (this.viewer.scene !== null && this.viewer.scene.deserializeSaveState)
            byteOffs = this.viewer.scene.deserializeSaveState(this._saveStateTmp.buffer as ArrayBuffer, byteOffs, byteLength);
        if (this.viewer.cameraController !== null) this.viewer.cameraController.cameraUpdateForced();
        return true;
    }

    private _tryLoadSceneSaveState(state: string): boolean {
        if (state.startsWith('ZNCA8') && state.endsWith('=')) return this._loadSceneSaveStateVersion2(state.slice(5, -1));
        if (state.startsWith('A')) return this._loadSceneSaveStateVersion3(state.slice(1));
        if (state.startsWith('ShareData=')) return this._loadSceneSaveStateVersion3(state.slice(10));
        return false;
    }

    private _loadSceneSaveState(state: string | null): boolean {
        if (state === '' || state === null) return false;
        if (this._tryLoadSceneSaveState(state)) { this._saveStateAndUpdateURL(); return true; }
        else return false;
    }

    private _loadSceneDescById(id: string, sceneState: string | null): void {
        const [groupId, ...sceneRest] = id.split('/');
        let sceneId = decodeURIComponent(sceneRest.join('/'));
        const group = this.groups.find((g) => typeof g !== 'string' && g.id === groupId) as SceneGroup;
        if (!group) return;
        if (group.sceneIdMap !== undefined && group.sceneIdMap.has(sceneId)) sceneId = group.sceneIdMap.get(sceneId)!;
        const desc = getSceneDescs(group).find((d) => d.id === sceneId);
        if (!desc) return;
        this._loadSceneDesc(group, desc, sceneState);
    }

    private _loadState(state: string) {
        let sceneDescId: string = '', sceneSaveState: string = '';
        const firstSemicolon = state.indexOf(';');
        if (firstSemicolon >= 0) { sceneDescId = state.slice(0, firstSemicolon); sceneSaveState = state.slice(firstSemicolon + 1); }
        else { sceneDescId = state; }
        return this._loadSceneDescById(sceneDescId, sceneSaveState);
    }

    private _getCurrentSceneDescId() {
        if (this.currentSceneGroup === null || this.currentSceneDesc === null) return null;
        const groupId = this.currentSceneGroup.id;
        const sceneId = this.currentSceneDesc.id;
        return `${groupId}/${sceneId}`;
    }

    private _saveState(forceUpdateURL: boolean = false) {
        if (this.currentSceneGroup === null || this.currentSceneDesc === null) return;
        const sceneStateStr = this._getSceneSaveState();
        const currentDescId = this._getCurrentSceneDescId()!;
        const key = this.saveManager.getSaveStateSlotKey(currentDescId, 0);
        this.saveManager.saveTemporaryState(key, sceneStateStr);

        const saveState = `${currentDescId};${sceneStateStr}`;
        this.ui.setSaveState(saveState);

        let shouldUpdateURL = forceUpdateURL;
        if (!shouldUpdateURL) {
            const timeSeconds = window.performance.now() / 1000;
            const secondsElapsedSinceLastUpdatedURL = timeSeconds - this.lastUpdatedURLTimeSeconds;
            if (secondsElapsedSinceLastUpdatedURL >= 2) shouldUpdateURL = true;
        }

        if (shouldUpdateURL) {
            window.history.replaceState('', document.title, `#${saveState}`);
            const timeSeconds = window.performance.now() / 1000;
            this.lastUpdatedURLTimeSeconds = timeSeconds;
        }
    }

    private _saveStateAndUpdateURL(): void { this._saveState(true); }
    private _getSaveStateSlotKey(slotIndex: number): string {
        return this.saveManager.getSaveStateSlotKey(assertExists(this._getCurrentSceneDescId()), slotIndex);
    }

    private _onSceneChanged(scene: SceneGfx, sceneStateStr: string | null): void {
        scene.onstatechanged = () => { this._saveStateAndUpdateURL(); };
        let scenePanels: Panel[] = [];
        if (scene.createPanels) scenePanels = scene.createPanels();
        this.ui.setScenePanels(scenePanels);
        this.ui.togglePlayPause(true);

        const sceneDescId = this._getCurrentSceneDescId()!;
        this.saveManager.setCurrentSceneDescId(sceneDescId);
        this._saveStateAndUpdateURL();

        if (scene.createCameraController !== undefined) this.viewer.setCameraController(scene.createCameraController());
        if (this.viewer.cameraController === null) this.viewer.setCameraController(new FPSCameraController());

        if (!this._loadSceneSaveState(sceneStateStr)) {
            const camera = this.viewer.camera;
            const key = this.saveManager.getSaveStateSlotKey(sceneDescId, 1);
            const didLoadCameraState = this._loadSceneSaveState(this.saveManager.loadState(key));
            if (!didLoadCameraState) {
                if (scene.getDefaultWorldMatrix !== undefined) scene.getDefaultWorldMatrix(camera.worldMatrix);
                else mat4.identity(camera.worldMatrix);
            }
            mat4.getTranslation(this.viewer.xrCameraController.offset, camera.worldMatrix);
        }

        this.ui.sceneChanged();
    }

    private _onSceneDescSelected(sceneGroup: SceneGroup, sceneDesc: SceneDesc) {
        this._loadSceneDesc(sceneGroup, sceneDesc);
    }

    private doSaveStatesAction(action: SaveStatesAction, key: string): void {
        if (action === SaveStatesAction.Save) this.saveManager.saveState(key, this._getSceneSaveState());
        else if (action === SaveStatesAction.Delete) this.saveManager.deleteState(key);
        else if (action === SaveStatesAction.Load) this.saveManager.loadState(key) && this._loadSceneSaveState(this.saveManager.loadState(key));
        else if (action === SaveStatesAction.LoadDefault) this._loadSceneSaveState(this.saveManager.loadStateFromLocation(key, SaveStateLocation.Defaults));
    }

    private loadSceneDelta = 1;

    private _loadSceneDesc(sceneGroup: SceneGroup, sceneDesc: SceneDesc, sceneStateStr: string | null = null, force: boolean = false): void {
        if (this.currentSceneDesc === sceneDesc && !force) { this._loadSceneSaveState(sceneStateStr); return; }

        setBackgroundMode('none', this.canvas);

        const device = this.viewer.gfxDevice;

        if (this.dataFetcher !== null) this.dataFetcher.abort();
        this.ui.destroyScene();
        if (this.viewer.scene && !this.destroyablePool.includes(this.viewer.scene)) this.destroyablePool.push(this.viewer.scene);
        this.viewer.setScene(null);
        for (let i = 0; i < this.destroyablePool.length; i++) this.destroyablePool[i].destroy(device);
        this.destroyablePool.length = 0;

        if (sceneGroup.hidden) sceneGroup.hidden = false;

        this.currentSceneGroup = sceneGroup;
        this.currentSceneDesc = sceneDesc;
        this.ui.sceneSelect.setCurrentDesc(this.currentSceneGroup, this.currentSceneDesc);

        this.ui.sceneSelect.setProgress(0);

        const dataShare = this.dataShare;
        const dataFetcher = this.dataFetcher;
        dataFetcher.reset();
        const uiContainer: HTMLElement = document.createElement('div');
        this.ui.sceneUIContainer.appendChild(uiContainer);
        const destroyablePool: Destroyable[] = this.destroyablePool;
        const inputManager = this.viewer.inputManager;
        inputManager.reset();
        const viewerInput = this.viewer.viewerRenderInput;
        const context: SceneContext = { device, dataFetcher, dataShare, uiContainer, destroyablePool, inputManager, viewerInput };

        this.dataShare.pruneOldObjects(device, this.loadSceneDelta);
        if (this.loadSceneDelta === 0) this.viewer.gfxDevice.checkForLeaks();
        this.dataShare.loadNewScene();

        this.loadingSceneDesc = sceneDesc;
        const promise = sceneDesc.createScene(device, context);
        if (promise === null) { console.error(`Cannot load ${sceneDesc.id}. Probably an unsupported file extension.`); throw "whoops"; }

        promise.then((scene: SceneGfx) => {
            if (this.loadingSceneDesc === sceneDesc) {
                dataFetcher.setProgress();
                this.loadingSceneDesc = null;
                this.viewer.setScene(scene);
                this._onSceneChanged(scene, sceneStateStr);
            }
        });

        document.title = `${sceneDesc.name} - ${sceneGroup.name} - noclip`;
    }

    private _loadSceneGroups() { this.ui.sceneSelect.setSceneGroups(this.groups); }

    private _makeUI() {
        this.ui = new UI(this.viewer);
        this.ui.setEmbedMode(this.isEmbedMode);
        this.toplevel.appendChild(this.ui.elem);
        this.ui.sceneSelect.onscenedescselected = this._onSceneDescSelected.bind(this);
        this.ui.xrSettings.onWebXRStateRequested = this._onWebXRStateRequested.bind(this);
        this.webXRContext.onsupportedchanged = () => { this._syncWebXRSettingsVisible(); };
        this._syncWebXRSettingsVisible();
    }

    private _syncWebXRSettingsVisible(): void { this.ui.xrSettings.setVisible(this.webXRContext.isSupported); }
    private _toggleUI(visible?: boolean) { this.ui.toggleUI(visible); }
    private _getSceneDownloadPrefix() {
        const groupId = this.currentSceneGroup!.id;
        const sceneId = this.currentSceneDesc!.id;
        const date = new Date();
        return `${groupId}_${sceneId}_${date.toISOString()}`;
    }

    private _takeScreenshot(opaque: boolean = true) {
        const canvas = this.viewer.takeScreenshotToCanvas(opaque);
        const filename = `${this._getSceneDownloadPrefix()}.png`;
        convertCanvasToPNG(canvas).then((blob) => downloadBlob(filename, blob));
    }

    public getStandardClearColor(): Color { return standardFullClearRenderPassDescriptor.clearColor as Color; }
    public get scene() { return this.viewer.scene; }
}

declare global { interface Window { main: Main; debug: any; debugObj: any; gl: any; } }
window.main = new Main();
window.debug = false;