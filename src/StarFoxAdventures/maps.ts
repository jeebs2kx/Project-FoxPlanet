import * as Viewer from '../viewer.js';
import * as UI from '../ui.js';
import { Sky } from './Sky.js';
import { ObjectManager } from './objects.js';
import { GfxrGraphBuilder, GfxrRenderTargetID, GfxrRenderTargetDescription } from '../gfx/render/GfxRenderGraph.js';
import { getSubdir } from './resource.js';
import { DataFetcher } from '../DataFetcher.js';
import { GfxRenderInstManager } from "../gfx/render/GfxRenderInstManager.js";
import { fillSceneParamsDataOnTemplate } from '../gx/gx_render.js';
import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import { SceneContext } from '../SceneBase.js';
import { mat4, vec3 } from 'gl-matrix';
import { nArray } from '../util.js';
import { White, colorCopy, colorNewFromRGBA } from '../Color.js';
import { ModelVersion, loadModel } from "./modelloader.js";import { SFARenderer, SceneRenderContext, SFARenderLists } from './render.js';
import { BlockFetcher, SFABlockFetcher, SwapcircleBlockFetcher, AncientBlockFetcher, EARLYDFPT, EARLYFEAR, EARLYDUPBLOCKFETCHER, EARLY1BLOCKFETCHER, EARLY2BLOCKFETCHER, EARLY3BLOCKFETCHER, EARLY4BLOCKFETCHER, DPBlockFetcher  } from './blocks.js';
import { SFA_GAME_INFO, SFADEMO_GAME_INFO, DP_GAME_INFO, GameInfo } from './scenes.js';
import { MaterialFactory } from './materials.js';
import { SFAAnimationController } from './animation.js';
import { SFATextureFetcher, FakeTextureFetcher } from './textures.js';
import { Model, ModelRenderContext, ModelInstance } from './models.js';
import { World } from './world.js';
import { EnvfxManager } from './envfx.js';

import { AABB } from '../Geometry.js';
import { LightType, WorldLights } from './WorldLights.js';
import { computeViewMatrix } from '../Camera.js';
import { drawWorldSpacePoint, getDebugOverlayCanvas2D } from '../DebugJunk.js';

// --- Music table ---
const MAP_MUSIC: Record<string, string> = {
    2: 'dragrock.mp3',
    4: 'volcano.mp3',
    7: 'swaphol.mp3',
    8: 'swapholbot.mp3',
    10: 'snowhorn.mp3',
    11: 'kp.mp3',
    12: 'crf.mp3',
    14: 'lightfoot.mp3',
    16: 'dungeon.mp3',
    18: 'mmpass.mp3',
    19: 'darkicemines.mp3',
    21: 'ofp.mp3',
    27: 'darkicemines2.mp3',
    29: 'capeclaw.mp3',
    28: 'bossgaldon.mp3',
    31: 'kraztest.mp3',
    32: 'kraztest.mp3',
    33: 'kraztest.mp3',
    34: 'kraztest.mp3',
    39: 'kraztest.mp3',
    40: 'kraztest.mp3',
    50: 'ofp.mp3',
    51: 'shop.mp3',
    54: 'magcave.mp3',

    'Early_kraz_test': 'oldfear.mp3',

    'ancient_5': 'warlock.mp3',
    [-997]: 'oldfear.mp3',
    [-998]: 'dfpt.mp3',
    [-999]: 'swapcircle.mp3',

    // --- Dinosaur Planet Specific Tracks ---
    'dp_2':  'dp_dragrock.mp3',     
    'dp_3':  'dp_Krazoapalace.mp3',
    'dp_4':  'dp_vfp.mp3',
    'dp_5': 'dp_rolling.mp3',
    'dp_6': 'dp_discovery.mp3',
    'dp_7': 'dp_swaphollow.mp3',
    'dp_8': 'dp_swaphollow.mp3',
    'dp_9': 'dp_gplains.mp3',
    'dp_10': 'dp_snowhorn.mp3',
    'dp_11': 'dp_warlock.mp3',
    'dp_12': 'dp_crfort.mp3',
    'dp_13': 'dp_walled.mp3',
    'dp_14': 'dp_swaphollow.mp3', 
    'dp_15': 'dp_crfort2.mp3', 
    'dp_16': 'dp_crfdungeon.mp3',
    'dp_18': 'dp_mmpass.mp3',
    'dp_19': 'dp_wastes.mp3',
    'dp_20': 'oldfear.mp3',
    'dp_21': 'dp_dfpt.mp3',
    'dp_22': 'oldfear.mp3',
    'dp_23': 'dp_snowhorn.mp3',
    'dp_24': 'dp_icemt.mp3',
    'dp_25': 'dp_icemt.mp3',
    'dp_27': 'dp_dim2.mp3',
    'dp_28': 'dp_dim3.mp3',
    'dp_29': 'dp_cclaw.mp3',
    'dp_30': 'dp_crfort2.mp3',
    'dp_31': 'oldfear.mp3',
    'dp_32': 'oldfear.mp3',
    'dp_33': 'oldfear.mp3',
    'dp_34': 'oldfear.mp3',
    'dp_35': 'dp_dbay.mp3',
    'dp_36': 'dp_walled.mp3',
    'dp_39': 'oldfear.mp3',
    'dp_40': 'oldfear.mp3',
    'dp_41': 'oldfear.mp3',
    'dp_42': 'oldfear.mp3',
    'dp_43': 'dp_crfrace.mp3',
    'dp_48': 'dp_rex.mp3',
    'dp_50': 'dp_dfpt.mp3',
    'dp_51': 'dp_shop.mp3',
    'dp_52': 'dp_dragrock.mp3',


};

if (!(window as any).musicState) {
    (window as any).musicState = {
        muted: false,
        audio: null as HTMLAudioElement | null
    };
}
const DP_ENV_DEFAULT = { timeOfDay: 6, envfxIndex: 95 };
export interface BlockInfo {
    mod: number;
    sub: number;
}

export interface MapInfo {
    mapsBin: DataView;
    locationNum: number;
    infoOffset: number;
    blockTableOffset: number;
    blockCols: number;
    blockRows: number;
    originX: number;
    originZ: number;
}

export function getBlockInfo(mapsBin: DataView, mapInfo: MapInfo, x: number, y: number): BlockInfo | null {
    const blockIndex = y * mapInfo.blockCols + x;
    const blockInfo = mapsBin.getUint32(mapInfo.blockTableOffset + 4 * blockIndex);
    const sub = (blockInfo >>> 17) & 0x3F;
    const mod = (blockInfo >>> 23);
    if (mod == 0xff)
        return null;
    return {mod, sub};
}

function getMapInfo(mapsTab: DataView, mapsBin: DataView, locationNum: number): MapInfo {
    const offs = locationNum * 0x1c;
    const infoOffset = mapsTab.getUint32(offs + 0x0);
    const blockTableOffset = mapsTab.getUint32(offs + 0x4);

    const blockCols = mapsBin.getUint16(infoOffset + 0x0);
    const blockRows = mapsBin.getUint16(infoOffset + 0x2);

    return {
        mapsBin, locationNum, infoOffset, blockTableOffset, blockCols, blockRows,
        originX: mapsBin.getInt16(infoOffset + 0x4),
        originZ: mapsBin.getInt16(infoOffset + 0x6),
    };
}

// Block table is addressed by blockTable[y][x].
function getBlockTable(mapInfo: MapInfo): (BlockInfo | null)[][] {
    const blockTable: (BlockInfo | null)[][] = [];
    for (let y = 0; y < mapInfo.blockRows; y++) {
        const row: (BlockInfo | null)[] = [];
        blockTable.push(row);
        for (let x = 0; x < mapInfo.blockCols; x++) {
            const blockInfo = getBlockInfo(mapInfo.mapsBin, mapInfo, x, y);
            row.push(blockInfo);
        }
    }
    return blockTable;
}

type BlockCell = BlockInfo | null;

async function buildEarly1WalledCityRemap(
  gameInfo: GameInfo,
  dataFetcher: DataFetcher,
  mapNum: number,
  makeLayout: (pick: (x: number, y: number) => BlockCell) => BlockCell[][]
): Promise<MapSceneInfo> {
  const pathBase = gameInfo.pathBase;
  const [tabBuf, binBuf] = await Promise.all([
    dataFetcher.fetchData(`${pathBase}/MAPS.tab`),
    dataFetcher.fetchData(`${pathBase}/MAPS.bin`),
  ]);

  const mapsTab = tabBuf.createDataView();
  const mapsBin = binBuf.createDataView();
  const info    = getMapInfo(mapsTab, mapsBin, mapNum);
  const src     = getBlockTable(info); 

  const pick = (x: number, y: number): BlockCell => (src[y]?.[x] ?? null);

  const layout = makeLayout(pick);
  const rows   = layout.length;
  const cols   = rows ? layout[0].length : 0;

  return {
    getNumCols() { return cols; },
    getNumRows() { return rows; },
    getBlockInfoAt(col: number, row: number) { return layout[row][col]; },
    getOrigin() { return [0, 0]; }, 
  };
}

const M = (mod: number, sub: number): BlockInfo => ({ mod, sub });


interface MapSceneInfo {
    getNumCols(): number;
    getNumRows(): number;
    getBlockInfoAt(col: number, row: number): BlockInfo | null;
    getOrigin(): number[];
}

interface BlockIter {
    x: number;
    z: number;
    block: ModelInstance;
}

const scratchMtx0 = mat4.create();

export class MapInstance {
    public setBlockFetcher(blockFetcher: BlockFetcher) {
  this.blockFetcher = blockFetcher;
}
    private matrix: mat4 = mat4.create(); // map-to-world
    private invMatrix: mat4 = mat4.create(); // world-to-map
    private numRows: number;
    private numCols: number;
    private blockInfoTable: (BlockInfo | null)[][] = []; // Addressed by blockInfoTable[z][x]
    private blocks: (ModelInstance | null)[][] = []; // Addressed by blocks[z][x]

    constructor(public info: MapSceneInfo, private blockFetcher: BlockFetcher, public world?: World) {
        this.numRows = info.getNumRows();
        this.numCols = info.getNumCols();

        for (let y = 0; y < this.numRows; y++) {
            const row: (BlockInfo | null)[] = [];
            this.blockInfoTable.push(row);
            for (let x = 0; x < this.numCols; x++) {
                const blockInfo = info.getBlockInfoAt(x, y);
                row.push(blockInfo);
            }
        }
    }
    
    public clearBlocks() {
        this.blocks = [];
    }

    public setMatrix(matrix: mat4) {
        mat4.copy(this.matrix, matrix);
        mat4.invert(this.invMatrix, matrix);
    }

    public getNumDrawSteps(): number {
        return 3;
    }

    public* iterateBlocks(): Generator<BlockIter, void> {
        for (let z = 0; z < this.blocks.length; z++) {
            const row = this.blocks[z];
            for (let x = 0; x < row.length; x++) {
                if (row[x] !== null) {
                    yield { x, z, block: row[x]! };
                }
            }
        }
    }

    public getBlockAtPosition(x: number, z: number): ModelInstance | null {
        const bx = Math.floor(x / 640);
        const bz = Math.floor(z / 640);
        const block = this.blocks[bz][bx];
        if (block === undefined) {
            return null;
        }
        return block;
    }

public addRenderInsts(
  device: GfxDevice,
  renderInstManager: GfxRenderInstManager,
  renderLists: SFARenderLists,
  modelCtx: ModelRenderContext,
  lodStride: number = 1,

) {
  const prevCull = modelCtx.cullByAabb;

  // Only force-disable if the caller hasn't decided.
  if (prevCull === undefined)
    modelCtx.cullByAabb = false;

for (let b of this.iterateBlocks()) {
  // Cheap LOD: far maps render every Nth block.
  if (lodStride > 1) {
    if ((b.x % lodStride) !== 0 || (b.z % lodStride) !== 0)
      continue;
  }

  mat4.fromTranslation(scratchMtx0, [640 * b.x, 0, 640 * b.z]);
  mat4.mul(scratchMtx0, this.matrix, scratchMtx0);
  b.block.addRenderInsts(device, renderInstManager, modelCtx, renderLists, scratchMtx0);
}

  modelCtx.cullByAabb = prevCull;
}


public async reloadBlocks(dataFetcher: DataFetcher) {
    this.clearBlocks();

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; 
        padding: 15px 25px; background: rgba(0, 40, 80, 0.9); 
        color: #00d0ff; font-family: 'Segoe UI', Tahoma, sans-serif; 
        border: 2px solid #00d0ff; border-radius: 5px; 
        z-index: 10000; box-shadow: 0 0 15px rgba(0, 200, 255, 0.5);
        font-weight: bold; text-transform: uppercase; letter-spacing: 1px;
    `;
    overlay.innerText = 'Initializing...';
    document.body.appendChild(overlay);

    let total = 0;
    let completed = 0;

    for (let z = 0; z < this.numRows; z++) {
        this.blocks[z] = new Array(this.numCols).fill(null);
        for (let x = 0; x < this.numCols; x++) {
            if (this.blockInfoTable[z][x])
                total++;
        }
    }

    const tasks: Promise<void>[] = [];

    for (let z = 0; z < this.numRows; z++) {
        for (let x = 0; x < this.numCols; x++) {
            const blockInfo = this.blockInfoTable[z][x];
            if (!blockInfo) continue;

            const task = this.blockFetcher.fetchBlock(blockInfo.mod, blockInfo.sub, dataFetcher)
.then(model => {
    this.blocks[z][x] = model ? new ModelInstance(model) : null;
    completed++;
    overlay.innerText =
        `Synchronizing Map Data: ${Math.round((completed / total) * 100)}%`;
})
.catch(() => {
    this.blocks[z][x] = null;
    completed++;
    overlay.innerText =
        `Synchronizing Map Data: ${Math.round((completed / total) * 100)}%`;
});

            tasks.push(task);
        }
    }

    await Promise.all(tasks);

    document.body.removeChild(overlay);
}

    public destroy(device: GfxDevice) {
        for (let row of this.blocks) {
            for (let model of row)
                model?.destroy(device);
        }
    }
}

export async function loadMap(gameInfo: GameInfo, dataFetcher: DataFetcher, mapNum: number): Promise<MapSceneInfo> {
    const pathBase = gameInfo.pathBase;
    const [mapsTab, mapsBin] = await Promise.all([
        dataFetcher.fetchData(`${pathBase}/MAPS.tab`),
        dataFetcher.fetchData(`${pathBase}/MAPS.bin`),
    ]);

    const mapInfo = getMapInfo(mapsTab.createDataView(), mapsBin.createDataView(), mapNum);
    const blockTable = getBlockTable(mapInfo);
    return {
        getNumCols() { return mapInfo.blockCols; },
        getNumRows() { return mapInfo.blockRows; },
        getBlockInfoAt(col: number, row: number): BlockInfo | null {
            return blockTable[row][col];
        },
        getOrigin(): number[] {
            return [mapInfo.originX, mapInfo.originZ];
        }
    };
}
function resolveMusicKey(mapNum: string | number): string {
    const key = String(mapNum);
if (key.startsWith('early1_') || key.startsWith('dup_')) {
        const num = Number(key.split('_')[1]);
        if ([31,32,33,34,39,40].includes(num))
            return 'Early_kraz_test';

        return String(num);
    }

    return key;
}

class MapSceneRenderer extends SFARenderer {
    public mapNum: string | number = -1;
public textureHolder: UI.TextureListHolder = { viewerTextures: [], onnewtextures: null };
    private blockFetcherFactory?: () => Promise<BlockFetcher>;
    private map: MapInstance;
    private dataFetcher!: DataFetcher;
    // --- needed so slider handlers can rebuild sky immediately ---
private currentGameInfo!: GameInfo;
private currentTexFetcher: any;
private pendingSkyRebuild = false;
// -----------------------------------------------------------
private rebuildSky(texFetcher: any, gameInfo: GameInfo): void {
    if (!this.envfxMan) return;

    if (this.sky) {
        this.sky.destroy(this.context.device);
        this.sky = null;
    }

    const fakeWorldForSky = {
        renderCache: (this.materialFactory as any).cache ?? (this.materialFactory as any).getCache?.(),
        gameInfo,
        envfxMan: this.envfxMan,
        worldLights: this.worldLights,
        resColl: { texFetcher },
        objectMan: { createObjectInstance: () => ({ destroy: () => {} }) },
    } as any;

    this.sky = new Sky(fakeWorldForSky);
}
    // --- NEW ENVFX INTEGRATION ---
    public envfxMan: EnvfxManager | null = null;
    public worldLights: WorldLights = new WorldLights();
    private timeSelect?: UI.Slider;
    private envSelect?: UI.Slider;
    private sky: Sky | null = null;
    private playMusic(mapNum: number) {
        const musicState = (window as any).musicState;
        if (musicState.audio) {
            musicState.audio.pause();
            musicState.audio.currentTime = 0;
            musicState.audio = null;
        }
        const resolvedKey = resolveMusicKey(mapNum);
        const track = MAP_MUSIC[resolvedKey];

        const FADE_TIME = 1000;
        const TARGET_VOLUME = 0.2;

        function fadeOut(audio: HTMLAudioElement, duration: number) {
            const step = 50;
            const delta = audio.volume / (duration / step);

            const interval = setInterval(() => {
                audio.volume = Math.max(0, audio.volume - delta);
                if (audio.volume <= 0) {
                    clearInterval(interval);
                    audio.pause();
                    audio.currentTime = 0;
                }
            }, step);
        }

        function fadeIn(audio: HTMLAudioElement, targetVolume: number, duration: number) {
            audio.volume = 0;
            const step = 50;
            const delta = targetVolume / (duration / step);

            const interval = setInterval(() => {
                audio.volume = Math.min(targetVolume, audio.volume + delta);
                if (audio.volume >= targetVolume)
                    clearInterval(interval);
            }, step);
        }

        if (!track) {
            if (musicState.audio)
                fadeOut(musicState.audio, FADE_TIME);
            return;
        }

        const newSrc = `data/audio/${track}`;

        if (!musicState.audio || !musicState.audio.src.includes(track)) {

            if (musicState.audio)
                fadeOut(musicState.audio, FADE_TIME);

            const newAudio = new Audio(newSrc);
            newAudio.loop = true;
            musicState.audio = newAudio;

            if (!musicState.muted) {
                newAudio.play().then(() => {
                    fadeIn(newAudio, TARGET_VOLUME, FADE_TIME);
                }).catch(() => {});
            }
        }
    }

    public setBlockFetcherFactory(factory: () => Promise<BlockFetcher>) {
        this.blockFetcherFactory = factory;
    }

    constructor(public context: SceneContext, animController: SFAAnimationController, materialFactory: MaterialFactory) {
        super(context, animController, materialFactory);
    }

    public async reloadForTextureToggle(): Promise<void> {
        if (!this.dataFetcher) return;
        if (this.blockFetcherFactory) {
            const fresh = await this.blockFetcherFactory();
            this.map.setBlockFetcher(fresh);
        }
        await this.map.reloadBlocks(this.dataFetcher);
    }

public async create(info: MapSceneInfo, gameInfo: GameInfo, dataFetcher: DataFetcher, blockFetcher: BlockFetcher): Promise<Viewer.SceneGfx> {
    this.dataFetcher = dataFetcher; 
    this.map = new MapInstance(info, blockFetcher);
    await this.map.reloadBlocks(dataFetcher);

    const texFetcher = (blockFetcher as any).texFetcher;
    this.currentGameInfo = gameInfo;
this.currentTexFetcher = texFetcher;
    if (texFetcher?.textureHolder)
        this.textureHolder = texFetcher.textureHolder;

    // --- CREATE SKY (works for DP via envfxMan injection) ---
    if (this.envfxMan && !this.sky) {
        const fakeWorldForSky = {
            renderCache: (this.materialFactory as any).cache ?? (this.materialFactory as any).getCache?.(),
            gameInfo,
            envfxMan: this.envfxMan,
            worldLights: this.worldLights,
            resColl: { texFetcher },
            objectMan: { createObjectInstance: () => ({ destroy: () => {} }) },
        } as any;

        this.sky = new Sky(fakeWorldForSky);
    }
if (this.envfxMan) {
    this.envfxMan.setTimeOfDay(DP_ENV_DEFAULT.timeOfDay);

    // loadEnvfx is async-ish in practice; await if it returns a Promise
    const r = (this.envfxMan as any).loadEnvfx(DP_ENV_DEFAULT.envfxIndex);
    if (r && typeof r.then === 'function') await r;

this.rebuildSky(this.currentTexFetcher, this.currentGameInfo);
}    if ((this as any).mapNum !== undefined)
        this.playMusic((this as any).mapNum as number);

    return this;
}



public createPanels(): UI.Panel[] {
    const panels: UI.Panel[] = [];



    if (this.envfxMan) {
        const envPanel = new UI.Panel();
        envPanel.setTitle(UI.TIME_OF_DAY_ICON, 'Environment');

this.timeSelect = new UI.Slider();
this.timeSelect.setLabel('Time of Day');
this.timeSelect.setRange(0, 7, 1);
this.timeSelect.setValue(DP_ENV_DEFAULT.timeOfDay);
this.timeSelect.onvalue = async (val) => {
  if (!this.envfxMan) return;
  this.envfxMan.setTimeOfDay(val);
  this.rebuildSky(this.currentTexFetcher, this.currentGameInfo);
};
envPanel.contents.append(this.timeSelect.elem);

this.envSelect = new UI.Slider();
this.envSelect.setLabel('EnvFx Index');
this.envSelect.setRange(0, 100, 1);
this.envSelect.setValue(DP_ENV_DEFAULT.envfxIndex);
this.envSelect.onvalue = async (val) => {
  if (!this.envfxMan) return;
  try {
    const r = (this.envfxMan as any).loadEnvfx(val);
    if (r && typeof r.then === 'function') await r;
  } catch (e) {
    console.warn(`EnvFx load failed for index ${val}`, e);
  }
  // ALWAYS rebuild sky even if envfx objects fail
  this.rebuildSky(this.currentTexFetcher, this.currentGameInfo);
};
envPanel.contents.append(this.envSelect.elem);

        panels.push(envPanel);
    }

    return panels;
}

    public setMatrix(matrix: mat4) {
        this.map.setMatrix(matrix);
    }

    protected override update(viewerInput: Viewer.ViewerRenderInput) {
        super.update(viewerInput);
        this.materialFactory.update(this.animController);

        if (this.envfxMan) {
            this.envfxMan.update(this.context.device, { viewerInput });
        }
    }
protected override addSkyRenderInsts(
    device: GfxDevice,
    renderInstManager: GfxRenderInstManager,
    renderLists: SFARenderLists,
    sceneCtx: SceneRenderContext
) {
    if (this.sky)
        this.sky.addSkyRenderInsts(device, renderInstManager, renderLists, sceneCtx);
}

protected override addSkyRenderPasses(
    device: GfxDevice,
    builder: GfxrGraphBuilder,
    renderInstManager: GfxRenderInstManager,
    renderLists: SFARenderLists,
    mainColorTargetID: GfxrRenderTargetID,
    sceneCtx: SceneRenderContext
) {
    if (this.sky)
        this.sky.addSkyRenderPasses(
            device,
            this.renderHelper,
            builder,
            renderInstManager,
            renderLists,
            mainColorTargetID,
            this.mainDepthDesc,
            sceneCtx
        );
}
    protected override addWorldRenderInsts(device: GfxDevice, renderInstManager: GfxRenderInstManager, renderLists: SFARenderLists, sceneCtx: SceneRenderContext) {
        const template = renderInstManager.pushTemplateRenderInst();
        fillSceneParamsDataOnTemplate(template, sceneCtx.viewerInput);

        const scratchColor0 = colorNewFromRGBA(1, 1, 1, 1);
        if (this.envfxMan) {
            this.envfxMan.getAmbientColor(scratchColor0, 0);
        } else {
            colorCopy(scratchColor0, White);
        }

        const modelCtx: ModelRenderContext = {
            sceneCtx,
            showDevGeometry: false,
            ambienceIdx: 0,
            showMeshes: true,
            outdoorAmbientColor: scratchColor0,
            setupLights: () => {},
        };

        this.map.addRenderInsts(device, renderInstManager, renderLists, modelCtx);

        renderInstManager.popTemplateRenderInst();
    }

public override destroy(device: GfxDevice) {
    super.destroy(device);
    if (this.sky) { this.sky.destroy(device); this.sky = null; }
    if (this.envfxMan) this.envfxMan.destroy(device);
    this.map.destroy(device);
}
}

function ensureTextureToggleUI(
  onChange: (enabled: boolean) => void | Promise<void>,
  initial?: boolean
): void {
  type ToggleState = {
    wrap: HTMLDivElement;
    cb: HTMLInputElement;
    handler: ((e: Event) => void) | null;
    last?: boolean;
  };

  let state = (window as any).__sfaTextureToggle as ToggleState | undefined;

  if (!state) {
    const wrap = document.createElement('div');
    wrap.style.position = 'fixed';
    wrap.style.top = '2px';
    wrap.style.right = '2px';
    wrap.style.zIndex = '10000';
    wrap.style.padding = '2px 4px';
    wrap.style.background = 'rgba(0,0,0,0.5)';
    wrap.style.color = '#fff';
    wrap.style.font = '12px sans-serif';
    wrap.style.borderRadius = '2px';

    const label = document.createElement('label');
    label.style.cursor = 'pointer';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.marginRight = '2px';

    label.appendChild(cb);
    label.appendChild(document.createTextNode('Textures'));
    wrap.appendChild(label);
    document.body.appendChild(wrap);

    state = { wrap, cb, handler: null, last: true };
    (window as any).__sfaTextureToggle = state;
  }

  if (state.handler) state.cb.removeEventListener('change', state.handler);

  const desired = (typeof initial === 'boolean') ? initial : (state.last ?? true);
  state.cb.checked = desired;

  state.handler = async () => {
    try {
      state!.last = state!.cb.checked;
      await onChange(state!.cb.checked);
    } catch (e) {
      console.error('Texture toggle handler error:', e);
    }
  };
  state.cb.addEventListener('change', state.handler);
}


export class SFAMapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
    }

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
      const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

        console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);
        const mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);

        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = this.mapNum;
        const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
        
        const blockFetcher = await SFABlockFetcher.create(this.gameInfo,context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher));
        await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
    
}


export class SwapcircleSceneDesc implements Viewer.SceneDesc {
  constructor(
    public mapNum: number,
    public id: string,
    public name: string,
    private gameInfo: GameInfo = SFADEMO_GAME_INFO
  ) {}

  public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
    const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

    console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

    const animController = new SFAAnimationController();
    const materialFactory = new MaterialFactory(device);

    const COLS = 4;
    const ROWS = 3;

    const allowedSubs = [19, 7, 8, 20, 0, 12, 13, 0, 0, 17, 18, 0];
    

    const mapSceneInfo: MapSceneInfo = {
      getNumCols() { return COLS; },
      getNumRows() { return ROWS; },
getBlockInfoAt(col: number, row: number): BlockInfo | null {
  const idx = (row * COLS + col) % allowedSubs.length;
  const sub = allowedSubs[idx];

  if (sub === 0)
    return null;

  return { mod: 22, sub };
},
      getOrigin(): number[] { return [0, 0]; },
    };

    const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
    mapRenderer.mapNum = -999; 
    const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, true);
    await texFetcher.loadSubdirs(['swapcircle'], context.dataFetcher);

    const blockFetcher = await SwapcircleBlockFetcher.create(
      this.gameInfo, context.dataFetcher, materialFactory, texFetcher
    );
    await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

    return mapRenderer;
  }
}

const ANCIENT_TEXTURE_FOLDERS: Record<string, string[]> = {
  "0": ["willow"],
  "2": ["icemountain"],
"3": ["swaphol", "gpshrine",],
  "5": ["warlock", "shop"],
  "6": ["shop"],
  "7": ["crfort", "swaphol", "gpshrine"],
  "8": ["icemountain"],
  "9": ["capeclaw"],
  "10": ["icemountain"],
  "11": ["icemountain"],
  "4": ["nwastes"],
  "14": ["cloudrace"],
  
};

export class AncientMapSceneDesc implements Viewer.SceneDesc {
    constructor(public id: string, public name: string, private gameInfo: GameInfo, private mapKey: any) {
    }
    
    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
      const musicState = (window as any).musicState;
console.log("Ancient mapKey:", this.mapKey);

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

        console.log(`Creating scene for ${this.name} ...`);

        const pathBase = this.gameInfo.pathBase;
        const dataFetcher = context.dataFetcher;
        const mapsJsonBuffer = await dataFetcher.fetchData(`${pathBase}/AncientMaps.json`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);

        const mapsJsonString = new TextDecoder('utf-8').decode(mapsJsonBuffer.arrayBuffer as ArrayBuffer);
        const mapsJson = JSON.parse(mapsJsonString);
        const map = mapsJson[this.mapKey];

        const numRows = map.blocks.length;
        const numCols = map.blocks[0].length;
        const blockTable: (BlockInfo | null)[][] = nArray(numRows, () => nArray(numCols, () => null));

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                const b = map.blocks[row][col];
                if (b == null) {
                    blockTable[row][col] = null;
                } else {
                    const newValue = b.split('.', 2);
                    const newMod = Number.parseInt(newValue[0]);
                    const newSub = Number.parseInt(newValue[1]);
                    blockTable[row][col] = {mod: newMod, sub: newSub};
                }
            }
        }

        const mapSceneInfo: MapSceneInfo = {
            getNumCols() { return numCols; },
            getNumRows() { return numRows; },
            getBlockInfoAt(col: number, row: number): BlockInfo | null {
                return blockTable[row][col];
            },
            getOrigin(): number[] {
                return [0, 0];
            }
        };

const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
mapRenderer.mapNum = `ancient_${this.mapKey}`;


const texFetcher = await SFATextureFetcher.create(this.gameInfo, dataFetcher, false);
texFetcher.setModelVersion(ModelVersion.AncientMap);

const folders = ANCIENT_TEXTURE_FOLDERS[String(this.mapKey)] ?? [];
if (Number(this.mapKey) !== 0) {
    await texFetcher.loadSubdirs(folders, dataFetcher);
}
if (Number(this.mapKey) === 5) {
 texFetcher.setPngOverride(4100, 'textures/ribbon.png');
texFetcher.setPngOverride(618, 'textures/walls.png');
texFetcher.setPngOverride(617, 'textures/floor1.png');
texFetcher.setPngOverride(616, 'textures/pillar.png');
texFetcher.setPngOverride(615, 'textures/transwall.png');
texFetcher.setPngOverride(614, 'textures/support.png');
texFetcher.setPngOverride(613, 'textures/chain.png');
texFetcher.setPngOverride(612, 'textures/head.png');
texFetcher.setPngOverride(611, 'textures/krazfloor.png');
texFetcher.setPngOverride(610, 'textures/decor1.png');
texFetcher.setPngOverride(609, 'textures/floor2.png');
texFetcher.setPngOverride(608, 'textures/ceiling1.png');
texFetcher.setPngOverride(607, 'textures/walls2.png');
texFetcher.setPngOverride(606, 'textures/pillar2.png');
texFetcher.setPngOverride(605, 'textures/wood.png');
texFetcher.setPngOverride(604, 'textures/button.png');
texFetcher.setPngOverride(603, 'textures/sash.png');
texFetcher.setPngOverride(602, 'textures/floor3.png');
texFetcher.setPngOverride(601, 'textures/vines.png');
texFetcher.setPngOverride(600, 'textures/walls3.png');
texFetcher.setPngOverride(599, 'textures/block.png');
texFetcher.setPngOverride(598, 'textures/innerdoor.png');
texFetcher.setPngOverride(597, 'textures/stained.png');
texFetcher.setPngOverride(596, 'textures/spire.png');
texFetcher.setPngOverride(595, 'textures/crates.png');
texFetcher.setPngOverride(591, 'textures/sabrestart.png');
texFetcher.setPngOverride(590, 'textures/walls4.png');
texFetcher.setPngOverride(589, 'textures/floor4.png');
texFetcher.setPngOverride(588, 'textures/floor5.png');
texFetcher.setPngOverride(587, 'textures/walls5.png');
texFetcher.setPngOverride(586, 'textures/kraz.png');
texFetcher.setPngOverride(585, 'textures/black.png');
texFetcher.setPngOverride(584, 'textures/transring.png');
texFetcher.setPngOverride(583, 'textures/spire2.png');
texFetcher.setPngOverride(582, 'textures/kraz2.png');
texFetcher.setPngOverride(581, 'textures/kraz3.png');
texFetcher.setPngOverride(580, 'textures/port.png');
texFetcher.setPngOverride(579, 'textures/floor6.png');
}
if (Number(this.mapKey) === 6) {
texFetcher.setPngOverride(3001, 'textures/shoppurple.png'); 
texFetcher.setPngOverride(3002, 'textures/shopwood.png'); 
texFetcher.setPngOverride(3003, 'textures/shoppurple2.png'); 
texFetcher.setPngOverride(3004, 'textures/shoppurple3.png'); 
texFetcher.setPngOverride(3005, 'textures/shoppurple4.png'); 
texFetcher.setPngOverride(3006, 'textures/shoppurple5.png'); 
}

if (Number(this.mapKey) === 0) {
texFetcher.setPngOverride(2037, 'textures/wgfloor1.png');
texFetcher.setPngOverride(2036, 'textures/wgfloor2.png');
texFetcher.setPngOverride(2035, 'textures/wgfloor3.png');
texFetcher.setPngOverride(2034, 'textures/wgwall1.png');
texFetcher.setPngOverride(2033, 'textures/wgwall2.png');
texFetcher.setPngOverride(2032, 'textures/wgwall3.png');
texFetcher.setPngOverride(2031, 'textures/wgwall4.png');
texFetcher.setPngOverride(2030, 'textures/wgfloor4.png');
texFetcher.setPngOverride(2029, 'textures/wgwall5.png');
texFetcher.setPngOverride(2028, 'textures/wgfloor5.png');
texFetcher.setPngOverride(2027, 'textures/wgdirt.png');
texFetcher.setPngOverride(2026, 'textures/wgfloor6.png');
texFetcher.setPngOverride(2025, 'textures/wgwall6.png');
texFetcher.setPngOverride(2024, 'textures/wgwall7.png');
texFetcher.setPngOverride(2023, 'textures/wgwall8.png');
texFetcher.setPngOverride(2022, 'textures/wgwall9.png');
texFetcher.setPngOverride(2021, 'textures/wgrock.png');
texFetcher.setPngOverride(2020, 'textures/wgwall10.png');
texFetcher.setPngOverride(2019, 'textures/wgwall11.png');
texFetcher.setPngOverride(2018, 'textures/wgfloor7.png');
texFetcher.setPngOverride(2017, 'textures/wgwall12.png');
texFetcher.setPngOverride(2016, 'textures/wgwall13.png');
texFetcher.setPngOverride(2015, 'textures/wgvines.png');
texFetcher.setPngOverride(2014, 'textures/wgwall14.png');
texFetcher.setPngOverride(2013, 'textures/wgwall15.png');
texFetcher.setPngOverride(2012, 'textures/wgwall16.png');
texFetcher.setPngOverride(2011, 'textures/wgwall17.png');
texFetcher.setPngOverride(2010, 'textures/wgwall18.png');
texFetcher.setPngOverride(2009, 'textures/wgwall19.png');
texFetcher.setPngOverride(2008, 'textures/wgwall20.png');
texFetcher.setPngOverride(2007, 'textures/wgwall21.png');
texFetcher.setPngOverride(2006, 'textures/wgwall22.png');
texFetcher.setPngOverride(2005, 'textures/wgwall23.png');
texFetcher.setPngOverride(2004, 'textures/wgrim.png');
texFetcher.setPngOverride(2003, 'textures/wghead.png');
texFetcher.setPngOverride(2002, 'textures/wghead2.png');
texFetcher.setPngOverride(2001, 'textures/wghead3.png');
texFetcher.setPngOverride(2000, 'textures/wghead4.png');
}
await texFetcher.preloadPngOverrides((materialFactory as any).cache ?? (materialFactory as any).getCache?.(), dataFetcher);

const blockFetcher = await AncientBlockFetcher.create(
  this.gameInfo, dataFetcher, materialFactory, Promise.resolve(texFetcher)
);
mapRenderer.setBlockFetcherFactory(() => AncientBlockFetcher.create(
  this.gameInfo, dataFetcher, materialFactory, Promise.resolve(texFetcher)
));


await mapRenderer.create(mapSceneInfo, this.gameInfo, dataFetcher, blockFetcher);
ensureTextureToggleUI(async (enabled: boolean) => {
  texFetcher.setTexturesEnabled(enabled);
  (materialFactory as any).texturesEnabled = enabled;
  await mapRenderer.reloadForTextureToggle();
}, texFetcher.getTexturesEnabled?.() ?? true);

        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}

export class EarlyfearMapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
    }

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
      const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

        console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);
        const mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);

        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = -997;

        const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
  texFetcher.setModelVersion(ModelVersion.fear);
await texFetcher.loadSubdirs([ 'mmshrine'],  context.dataFetcher);
        const blockFetcher = await EARLYFEAR.create(this.gameInfo,context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher));
        await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}

export class EarlyDFPMapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
    }

public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
  const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

  console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

  const animController = new SFAAnimationController();
  const materialFactory = new MaterialFactory(device);
  const mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);
  const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
mapRenderer.mapNum = -998;
  const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
  texFetcher.setModelVersion(ModelVersion.dfpt);
await texFetcher.loadSubdirs([''], context.dataFetcher);

  texFetcher.setPngOverride(4000, 'textures/dfprim.png');
  texFetcher.setPngOverride(4001, 'textures/dfpwall.png');
  texFetcher.setPngOverride(4002, 'textures/dfpwall2.png');
  texFetcher.setPngOverride(4003, 'textures/dfpfloor.png');
  texFetcher.setPngOverride(4004, 'textures/dfpwall3.png');
  texFetcher.setPngOverride(4005, 'textures/dfpdecor.png');
  texFetcher.setPngOverride(4006, 'textures/dfpwall4.png');
  texFetcher.setPngOverride(4007, 'textures/dfppillar.png');
  texFetcher.setPngOverride(4008, 'textures/dfpkraz.png');
  texFetcher.setPngOverride(4009, 'textures/dfpkraz2.png');
  texFetcher.setPngOverride(4010, 'textures/dfppost.png');
  texFetcher.setPngOverride(4011, 'textures/dfpstatue.png');
  texFetcher.setPngOverride(4012, 'textures/dfpstatue2.png');
  texFetcher.setPngOverride(4013, 'textures/dfpbuttons.png');
     await texFetcher.preloadPngOverrides(
      (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
      context.dataFetcher
    );

  const blockFetcher = await EARLYDFPT.create(
    this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
  );

  await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

  const matrix = mat4.create();
  mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
  mapRenderer.setMatrix(matrix);

  return mapRenderer;
}
    
}

export class EarlydupMapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
    }

public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
  const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

  console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

  const animController = new SFAAnimationController();
  const materialFactory = new MaterialFactory(device);

  const REMAP_FEAR_SHRINE = 32;   
  const REMAP_KNOWLEDGE    = 34; 
  const REMAP_STRENGTH    = 39;   

  let mapSceneInfo: MapSceneInfo;

  switch (this.mapNum) {
    case REMAP_FEAR_SHRINE: {
      mapSceneInfo = {
        getNumCols() { return 2; },
        getNumRows() { return 4; },
        getBlockInfoAt(col, row) {
          const L: (BlockCell)[][] = [
            [ M(40,0), M(40,1) ],
            [ M(40,2), M(40,3) ],
            [ M(40,4), M(40,5) ],
            [ M(40,6), M(40,7) ],
          ];
          return L[row][col];
        },
        getOrigin() { return [0, 0]; },
      };
      break;
    }

    case REMAP_KNOWLEDGE: {
      mapSceneInfo = {
        getNumCols() { return 2; },
        getNumRows() { return 4; },
        getBlockInfoAt(col, row) {
          const L: (BlockCell)[][] = [
            [ M(42,0), M(42,1) ],
            [ M(42,2), M(42,3) ],
            [ M(42,4), M(42,5) ],
            [ M(42,6), M(42,7) ],
          ];
          return L[row][col];
        },
        getOrigin() { return [0, 0]; },
      };
      break;
    }
    case REMAP_STRENGTH: {
      mapSceneInfo = {
        getNumCols() { return 2; },
        getNumRows() { return 4; },
        getBlockInfoAt(col, row) {
          const L: (BlockCell)[][] = [
            [ M(43,0), M(43,1) ],
            [ M(43,2), M(43,3) ],
            [ M(43,4), M(43,5) ],
            [ M(43,6), M(43,7) ],
          ];
          return L[row][col];
        },
        getOrigin() { return [0, 0]; },
      };
      break;
    }

    default:
      mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);
      break;
  }

    const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
    
mapRenderer.mapNum = `dup_${this.mapNum}`;

    const texFetcher  = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);

    texFetcher.setModelVersion(ModelVersion.dup);
    texFetcher.setCurrentModelID(this.mapNum);  
// Get first real block mod from layout
let firstMod: number | null = null;

for (let row = 0; row < mapSceneInfo.getNumRows(); row++) {
  for (let col = 0; col < mapSceneInfo.getNumCols(); col++) {
    const b = mapSceneInfo.getBlockInfoAt(col, row);
    if (b) {
      firstMod = b.mod;
      break;
    }
  }
  if (firstMod !== null) break;
}
if (firstMod !== null) {
    const subdir = getSubdir(firstMod, this.gameInfo);
    if (this.mapNum === 32 || subdir === 'mmshrine') {
              await texFetcher.loadSubdirs([subdir], context.dataFetcher);
    } else {
        await texFetcher.loadSubdirs([subdir, 'Copy of swaphol'], context.dataFetcher);
    }
    if (subdir === 'gpshrine') {
        await texFetcher.loadSubdirs(['dragrock'], context.dataFetcher);
    } else if (subdir === 'mmshrine') {
        await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);
    }
} else {
    await texFetcher.loadSubdirs(['Copy of swaphol'], context.dataFetcher);
}

     await texFetcher.preloadPngOverrides(
      (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
      context.dataFetcher
    );
  const blockFetcher = await EARLYDUPBLOCKFETCHER.create(
    this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
  );
  mapRenderer.setBlockFetcherFactory(() =>
    EARLYDUPBLOCKFETCHER.create(
      this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
    )
  );

  await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

  ensureTextureToggleUI(async (enabled: boolean) => {
    texFetcher.setTexturesEnabled(enabled);
    (materialFactory as any).texturesEnabled = enabled;
    await mapRenderer.reloadForTextureToggle();
  }, texFetcher.getTexturesEnabled?.() ?? true);

  const matrix = mat4.create();
  mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
  mapRenderer.setMatrix(matrix);

  return mapRenderer;
}
}


export class Early1MapSceneDesc implements Viewer.SceneDesc {
  constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {}

  public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
    const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

    console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

    const animController  = new SFAAnimationController();
    const materialFactory = new MaterialFactory(device);

    const REMAP_WALLED_CITY = 13;
    const REMAP_COMBAT      = 31;
    const REMAP_SAMPLE      = 29; 

    let mapSceneInfo: MapSceneInfo;

    switch (this.mapNum) {
      case REMAP_WALLED_CITY: {
        mapSceneInfo = {
          getNumCols() { return 9; },
          getNumRows() { return 9; },
          getBlockInfoAt(col, row) {
            const L: (BlockCell)[][] = [
              [ M(20,1),  M(20,4),  null,     null,     M(20,19), null,     null,     null,     null ],
              [ M(20,0),  M(20,3),  null,     M(20,12), M(20,18), M(20,25), null,     null,     null ],
              [ M(20,32), M(20,2),  M(20,5),  M(20,11), M(20,17), M(20,24), M(20,26), M(20,29), M(20,33) ],
              [ null,     null,     null,     M(20,10), M(20,16), M(20,23), null,     M(20,28), M(20,31) ],
              [ null,     null,     null,     M(20,9),  M(20,15), M(20,22), null,     M(20,27), M(20,30) ],
              [ null,     null,     null,     M(20,8),  M(20,14), M(20,21), null,     null,     null ],
              [ null,     null,     null,     M(20,7),  M(20,13), M(20,20), null,     null,     null ],
              [ null,     null,     null,     M(20,6),  null,     null,     null,     null,     null ],
              [ null,     null,     null,     null,     null,     null,     null,     null,     null ],
            ];
            return L[row][col];
          },
          getOrigin() { return [0, 0]; },
        };
        break;
      }

    case REMAP_COMBAT: {
      mapSceneInfo = {
        getNumCols() { return 2; },
        getNumRows() { return 4; },
        getBlockInfoAt(col, row) {
          const L: (BlockCell)[][] = [
            [ M(39,0), M(39,1) ],
            [ M(39,2), M(39,3) ],
            [ M(39,4), M(39,5) ],
            [ M(39,6), M(39,7) ],
          ];
          return L[row][col];
        },
        getOrigin() { return [0, 0]; },
      };
      break;
      }

      default: {
        mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);
        break;
      }
    }

    const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
mapRenderer.mapNum = `early1_${this.mapNum}`;

    const texFetcher  = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);

    texFetcher.setModelVersion(ModelVersion.Early1);
    texFetcher.setCurrentModelID(this.mapNum);  
let firstMod: number | null = null;

for (let row = 0; row < mapSceneInfo.getNumRows(); row++) {
  for (let col = 0; col < mapSceneInfo.getNumCols(); col++) {
    const b = mapSceneInfo.getBlockInfoAt(col, row);
    if (b) {
      firstMod = b.mod;
      break;
    }
  }

if (firstMod !== null) {
    const subdir = getSubdir(firstMod, this.gameInfo);
    
    if (this.mapNum === 15) {
        await texFetcher.loadSubdirs([subdir, 'cloudtreasure'], context.dataFetcher);
    } else {
        await texFetcher.loadSubdirs([subdir], context.dataFetcher);
    }

    if (subdir === 'clouddungeon' || subdir === 'cloudrace') {
        await texFetcher.loadSubdirs(['crfort'], context.dataFetcher);
    } else if (subdir === 'icemountain') {
        await texFetcher.loadSubdirs(['nwastes'], context.dataFetcher);
    } else if (subdir === 'desert') {
        await texFetcher.loadSubdirs(['dfptop', 'volcano'], context.dataFetcher);
    } else if (subdir === 'crfort') {
        await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);
    } else if (subdir === 'linkb' || subdir === 'linkf') {
        await texFetcher.loadSubdirs(['volcano'], context.dataFetcher);
    } else if (subdir === 'shipbattle') {
        await texFetcher.loadSubdirs([''], context.dataFetcher);
    } else if (subdir === 'linkc') {
        await texFetcher.loadSubdirs(['nwastes'], context.dataFetcher);
    } else if (subdir === 'mmpass') {
        await texFetcher.loadSubdirs(['shop', 'warlock'], context.dataFetcher);
    } else if (subdir === 'swaphol') {
        await texFetcher.loadSubdirs(['Copy of swaphol', 'nwastes', 'mmpass'], context.dataFetcher);
    } else if (subdir === 'swapholbot' || subdir === 'shop') {
        await texFetcher.loadSubdirs(['Copy of swaphol', 'swaphol', 'ecshrine'], context.dataFetcher);
    } else if (subdir === 'wallcity') {
        await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);
    } else if (subdir === 'darkicemines') {
        await texFetcher.loadSubdirs(['shop', 'nwastes'], context.dataFetcher);
    } else if (subdir === 'bossgaldon') {
        await texFetcher.loadSubdirs(['dragrock'], context.dataFetcher);
    } else if (subdir === 'nwastes') {
        await texFetcher.loadSubdirs(['icemountain'], context.dataFetcher);
    }
}
const SWAPHOL_EARLY1_MAPNUM = 7;
const SWAPHOLBOT_EARLY1_MAPNUM = 8;
const KRAZOA_PALACE_EARLY1_MAPNUM = 11;
const CLOUD_RACE_EARLY1_MAPNUM = 43;      
const CLOUD_TREASURE_EARLY1_MAPNUM = 15;
const CLOUD_DUNGEON_EARLY1_MAPNUM = 16;   
const CAPE_CLAW_EARLY1_MAPNUM = 29;
const LINK_LEVEL_EARLY1_MAPNUM = 64;
const DRAGON_ROCK_BOTTOM_EARLY1_MAPNUM = 52; 

if (this.mapNum === DRAGON_ROCK_BOTTOM_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['dragrockbot'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([DRAGON_ROCK_BOTTOM_EARLY1_MAPNUM]);
}

if (this.mapNum === SWAPHOL_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['swaphol'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([SWAPHOL_EARLY1_MAPNUM]);
}

if (this.mapNum === SWAPHOLBOT_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['swapholbot'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([SWAPHOLBOT_EARLY1_MAPNUM]);
}

if (this.mapNum === KRAZOA_PALACE_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['warlock'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([KRAZOA_PALACE_EARLY1_MAPNUM]);
}

if (this.mapNum === CLOUD_RACE_EARLY1_MAPNUM || this.mapNum === CLOUD_DUNGEON_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['crfort'], context.dataFetcher); 
    texFetcher.preferCopyOfSwapholForModelIDs([this.mapNum as number]);
}

if (this.mapNum === CLOUD_TREASURE_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['cloudtreasure'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([CLOUD_TREASURE_EARLY1_MAPNUM]);
}

if (this.mapNum === CAPE_CLAW_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['capeclaw'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([CAPE_CLAW_EARLY1_MAPNUM]);
}

if (this.mapNum === LINK_LEVEL_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['linklevel'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([LINK_LEVEL_EARLY1_MAPNUM]);
}
}
    texFetcher.setPngOverride(3000, 'textures/wcblue.png');
    texFetcher.setPngOverride(3500, 'textures/wcfloor.png');
        texFetcher.setPngOverride(3501, 'textures/wcredrims.png');
           texFetcher.setPngOverride(3611, 'textures/wcrims.png');
           texFetcher.setPngOverride(3612, 'textures/DIMladder.png');
           texFetcher.setPngOverride(3613, 'textures/DIMwall.png');
texFetcher.setPngOverride(3614, 'textures/MMSHfloor.png');

     await texFetcher.preloadPngOverrides(
      (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
      context.dataFetcher
    );

    const blockFetcher = await EARLY1BLOCKFETCHER.create(
      this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
    );
mapRenderer.setBlockFetcherFactory(() => EARLY1BLOCKFETCHER.create(
  this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
));

    await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

ensureTextureToggleUI(async (enabled: boolean) => {
  texFetcher.setTexturesEnabled(enabled);
  (materialFactory as any).texturesEnabled = enabled; 
  await mapRenderer.reloadForTextureToggle();
}, texFetcher.getTexturesEnabled?.() ?? true);

    const matrix = mat4.create();
    mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
    mapRenderer.setMatrix(matrix);

    return mapRenderer;
  }
}



export class Early2MapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
    }

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
      const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

        console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);
    const earyl2DRB =  52;

    let mapSceneInfo: MapSceneInfo;
    if (this.mapNum === earyl2DRB) {

       mapSceneInfo = {
         getNumCols() { return 5; },
         getNumRows() { return 5; },
         getBlockInfoAt(col, row) {
           const L: (BlockCell)[][] = [
             [ null, M(10,0), M(10,1), null ],
             [  M(10,14), M(10,2), M(10,3), M(10,15), ],
              [  M(10,4), M(10,5), M(10,6), M(10,12), ],
               [  M(10,10), M(10,7), M(10,8), M(10,13), ],
               [  null, M(10,9), M(10,11),null ],
           ];
           return L[row][col];
         },
         getOrigin() { return [0, 0]; },
       };

    } else {
      mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);
    }
        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = this.mapNum;

        const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
       texFetcher.setModelVersion(ModelVersion.Early2);
let firstMod: number | null = null;

for (let row = 0; row < mapSceneInfo.getNumRows(); row++) {
  for (let col = 0; col < mapSceneInfo.getNumCols(); col++) {
    const b = mapSceneInfo.getBlockInfoAt(col, row);
    if (b) {
      firstMod = b.mod;
      break;
    }
  }
  if (firstMod !== null) break;
}

if (firstMod !== null) {
  const subdir = getSubdir(firstMod, this.gameInfo);
  await texFetcher.loadSubdirs([subdir], context.dataFetcher);

  if (subdir === 'clouddungeon') {
    await texFetcher.loadSubdirs(['crfort'], context.dataFetcher);
    }
  if (subdir === 'crfort') {
    await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);

  }
}    
        const blockFetcher = await EARLY2BLOCKFETCHER.create(this.gameInfo,context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher));
        await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}
export class Early3MapSceneDesc implements Viewer.SceneDesc {
  constructor(
    public mapNum: number,
    public id: string,
    public name: string,
    private gameInfo: GameInfo = SFA_GAME_INFO
  ) {}

  public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
    const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

    console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

    const animController = new SFAAnimationController();
    const materialFactory = new MaterialFactory(device);

    const REMAP_LINK_C     = 67; 

    let mapSceneInfo: MapSceneInfo;

    switch (this.mapNum) {
      case REMAP_LINK_C: {
        mapSceneInfo = {
          getNumCols() { return 1; },
          getNumRows() { return 3; },
          getBlockInfoAt(col, row) {
            const L: (BlockCell)[][] = [
              [ M(65,0), ],
              [ M(65,1), ],
              [ M(65,2), ],
            ];
            return L[row][col];
          },
          getOrigin() { return [0, 0]; },
        };
        break;
      }
      default: {
        mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);
        break;
      }
    }

    const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
mapRenderer.mapNum = this.mapNum;

    const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
    texFetcher.setModelVersion(ModelVersion.Early3);
    await texFetcher.loadSubdirs([''], context.dataFetcher);

    texFetcher.setPngOverride(3600, 'textures/dim2wall.png');
    texFetcher.setPngOverride(3500, 'textures/wcfloor.png');
    
     await texFetcher.preloadPngOverrides(
      (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
      context.dataFetcher
    );

    const blockFetcher = await EARLY3BLOCKFETCHER.create(
      this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
    );

    mapRenderer.setBlockFetcherFactory(() =>
      EARLY3BLOCKFETCHER.create(
        this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
      )
    );

    await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

    ensureTextureToggleUI(async (enabled: boolean) => {
      texFetcher.setTexturesEnabled(enabled);
      (materialFactory as any).texturesEnabled = enabled;
      await mapRenderer.reloadForTextureToggle();
    }, texFetcher.getTexturesEnabled?.() ?? true);

    const matrix = mat4.create();
    mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
    mapRenderer.setMatrix(matrix);

    return mapRenderer;
  }
}

export class Early4MapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
    }

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
      const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

        console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);
        const mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);

        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = this.mapNum;

                const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
    texFetcher.setModelVersion(ModelVersion.Early4);
    await texFetcher.loadSubdirs([''], context.dataFetcher);
texFetcher.setCurrentModelID(this.mapNum);

    texFetcher.setPngOverride(3610, 'textures/wcbluehead.png');
   texFetcher.setPngOverride(3611, 'textures/wcrims.png');
   texFetcher.setPngOverride(3612, 'textures/wcmoon1.png');
   texFetcher.setPngOverride(3613, 'textures/wcmoon2.png');
    texFetcher.setPngOverride(3614, 'textures/wcmoon3.png');

     await texFetcher.preloadPngOverrides(
      (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
      context.dataFetcher
    );

        const blockFetcher = await EARLY4BLOCKFETCHER.create(this.gameInfo,context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher));
        await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

       const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}


export class DPMapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo?: GameInfo) {}

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        const gInfo = this.gameInfo ?? DP_GAME_INFO;
        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);
        const mapSceneInfo = await loadMap(gInfo, context.dataFetcher, this.mapNum);
        
        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);  
        (mapRenderer as any).mapNum = `dp_${this.mapNum}`;      
        const texFetcher = await SFATextureFetcher.create(gInfo, context.dataFetcher, false);
        texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);

        // === THE PHOTO FRAME INTERCEPTOR & BLUE FRINGE FIX ===
        if (!texFetcher.textureHolder) {
            texFetcher.textureHolder = { viewerTextures: [], onnewtextures: null };
        }
        
        let pointSampler: any = null; 

        const origGetTexture = (texFetcher as any).getTexture.bind(texFetcher);
        (texFetcher as any).getTexture = function(cache: any, id: number, useTex1: boolean) {
            const res = origGetTexture(cache, id, useTex1);
            if (res && res.viewerTexture) {
                const vt = res.viewerTexture;
                if (!this.textureHolder.viewerTextures.includes(vt)) {
                    this.textureHolder.viewerTextures.push(vt);
                    if (this.textureHolder.onnewtextures) {
                        this.textureHolder.onnewtextures();
                    }
                }

                const cutoutTextures = [ 0 ];
                if (cutoutTextures.includes(id)) {
                    if (!pointSampler) {
                        pointSampler = cache.device.createSampler({
                            wrapS: 1, wrapT: 1,
                            minFilter: 0, magFilter: 0, mipFilter: 0,
                            minLOD: 0, maxLOD: 100,
                        });
                    }
                    res.gfxSampler = pointSampler; 
                }
            }
            return res;
        };

        const ZERO_ENVFX_MAPS = [2, 3, 11, 15, 16,21,27,28,30,31,32,33,34,39,40,41,42,48,50,51,52,53,54];
        const isZeroEnvMap = ZERO_ENVFX_MAPS.includes(this.mapNum as number);
        const startingEnvFx = isZeroEnvMap ? 0 : DP_ENV_DEFAULT.envfxIndex;

        const fakeWorld: any = {
            renderCache: (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
            gameInfo: gInfo,
            worldLights: mapRenderer.worldLights,
            resColl: { texFetcher: texFetcher },
            objectMan: { createObjectInstance: () => ({ destroy: () => {}, addRenderInsts: () => {} }) }
        };

        try {
            mapRenderer.envfxMan = await EnvfxManager.create(fakeWorld as World, context.dataFetcher);
            fakeWorld.envfxMan = mapRenderer.envfxMan; 
            mapRenderer.envfxMan.loadEnvfx(startingEnvFx); 
        } catch (e) {
            console.warn("Failed to load ENVFXACT.bin for DP Map", e);
        }
        
        (texFetcher as any).dataFetcherRef = context.dataFetcher;
        const blockFetcher = await DPBlockFetcher.create(
            gInfo, context.dataFetcher, materialFactory, Promise.resolve(texFetcher)
        );

        if (texFetcher.textureHolder)
            mapRenderer.textureHolder = texFetcher.textureHolder;

        // --- NEW: Texture Toggle UI Integration ---
        ensureTextureToggleUI(async (enabled: boolean) => {
            texFetcher.setTexturesEnabled(enabled);
            (materialFactory as any).texturesEnabled = enabled;
            await mapRenderer.reloadForTextureToggle();
        }, texFetcher.getTexturesEnabled?.() ?? true);

        await mapRenderer.create(mapSceneInfo, gInfo, context.dataFetcher, blockFetcher);
        
        setTimeout(async () => {
            const mr = mapRenderer as any;
            if (mr.envSelect) {
                const sequence = isZeroEnvMap ? [0] : [95, 96, 97, 98, 99, 100];
                for (const val of sequence) {
                    mr.envSelect.setValue(val);
                    if (mr.envSelect.onvalue) {
                        await mr.envSelect.onvalue(val);
                    }
                    await new Promise(resolve => setTimeout(resolve, 16)); 
                }
            }
        }, 10);

        return mapRenderer;
    }
}


type DPGlobalMapEntry = {
    CoordX: number;
    CoordZ: number;
    Unk0: number;
    MapIndex: number;
    Unk1: number;
    Unk2: number;
};

type DPPlacedMap = {
    key: number;           
    mapIndex: number;
    gx: number;            
    gz: number;
    wx: number;            
    wz: number;           
};

class DPFullWorldRenderer extends SFARenderer {
    private placed: DPPlacedMap[] = [];
    private loaded = new Map<number, MapInstance>();
    private loading = new Map<number, Promise<void>>();
    private placedByKey = new Map<number, DPPlacedMap>();
    private camGX = 0;
    private camGZ = 0;

    // --- NEW ENVFX INTEGRATION ---
    public envfxMan: EnvfxManager | null = null;
    public worldLights: WorldLights = new WorldLights();
    // -----------------------------

    constructor(
        private device: GfxDevice,
        context: SceneContext,
        animController: SFAAnimationController,
        materialFactory: MaterialFactory,
        private gameInfo: GameInfo,
        private dataFetcher: DataFetcher,
        private blockFetcher: BlockFetcher,
        placed: DPPlacedMap[],
    ) {
        super(context, animController, materialFactory);
        this.placed = placed;
        for (const p of placed) this.placedByKey.set(p.key, p);
    }

    private static readonly STEP = 640 ; 

    private ensureLoaded(p: DPPlacedMap): Promise<void> {
        if (this.loaded.has(p.key))
            return Promise.resolve();

        const existing = this.loading.get(p.key);
        if (existing)
            return existing;

        const prom = (async () => {
            try {
                const info = await loadMap(this.gameInfo, this.dataFetcher, p.mapIndex);
                const inst = new MapInstance(info, this.blockFetcher);

                const [ox, oz] = info.getOrigin();     
                const anchorX = p.wx - ox * 640;
                const anchorZ = p.wz - oz * 640;

                const m = mat4.create();
                mat4.fromTranslation(m, [anchorX, 0, anchorZ]);
                inst.setMatrix(m);

                await inst.reloadBlocks(this.dataFetcher);
                this.loaded.set(p.key, inst);
            } catch (e) {
                console.warn(`DPFullWorld: failed to load map ${p.mapIndex} @ (${p.gx},${p.gz})`, e);
            } finally {
                this.loading.delete(p.key);
            }
        })();

        this.loading.set(p.key, prom);
        return prom;
    }

    public async loadAllMaps(concurrency: number = 12): Promise<void> {
        const queue = this.placed.slice();
        let idx = 0;

        const worker = async () => {
            while (true) {
                const i = idx++;
                if (i >= queue.length) return;
                await this.ensureLoaded(queue[i]);
            }
        };

        const workers: Promise<void>[] = [];
        for (let i = 0; i < concurrency; i++)
            workers.push(worker());

        await Promise.all(workers);
    }

    private unload(key: number): void {
        const inst = this.loaded.get(key);
        if (inst) {
            inst.destroy(this.device);
            this.loaded.delete(key);
        }
    }

    protected override update(viewerInput: Viewer.ViewerRenderInput) {
        super.update(viewerInput);

        const camWorld = viewerInput.camera.worldMatrix;
        const camX = camWorld[12];
        const camZ = camWorld[14];

        const step = DPFullWorldRenderer['STEP'] ?? (640 * 16);
        this.camGX = Math.round(camX / step);
        this.camGZ = Math.round(camZ / step);

        if (this.envfxMan) {
            this.envfxMan.update(this.device, { viewerInput });
        }
    }

    protected override addWorldRenderInsts(
        device: GfxDevice,
        renderInstManager: GfxRenderInstManager,
        renderLists: SFARenderLists,
        sceneCtx: SceneRenderContext
    ) {
        const template = renderInstManager.pushTemplateRenderInst();
        fillSceneParamsDataOnTemplate(template, sceneCtx.viewerInput);

        const scratchColor0 = colorNewFromRGBA(1, 1, 1, 1);
        if (this.envfxMan) {
            this.envfxMan.getAmbientColor(scratchColor0, 0);
        } else {
            colorCopy(scratchColor0, White);
        }

        const modelCtx: ModelRenderContext = {
            sceneCtx,
            showDevGeometry: false,
            ambienceIdx: 0,
            showMeshes: true,
            outdoorAmbientColor: scratchColor0,
            setupLights: () => {},
            cullByAabb: false,
        };

        for (const [key, inst] of this.loaded) {
            const p = this.placedByKey.get(key);
            if (!p) continue;

            const dx = Math.abs(p.gx - this.camGX);
            const dz = Math.abs(p.gz - this.camGZ);
            const d = Math.max(dx, dz);

            const stride =
                (d <= 2)  ? 1 :   
                (d <= 8)  ? 1 :  
                (d <= 20) ? 1 :  
                          1;    

            inst.addRenderInsts(device, renderInstManager, renderLists, modelCtx, stride);
        }

        renderInstManager.popTemplateRenderInst();
    }

    public override destroy(device: GfxDevice): void {
        for (const inst of this.loaded.values())
            inst.destroy(device);
        this.loaded.clear();
        if (this.envfxMan) this.envfxMan.destroy(device);
        super.destroy(device);
    }
}

export class DPFullWorldSceneDesc implements Viewer.SceneDesc {
    constructor(public id: string, public name: string, private gameInfo: GameInfo = DP_GAME_INFO) {}

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        const gInfo = this.gameInfo;
        const dataFetcher = context.dataFetcher;

        const buf = await dataFetcher.fetchData(`${gInfo.pathBase}/globalmap.json`);
        const txt = new TextDecoder('utf-8').decode(buf.arrayBuffer as ArrayBuffer);
        const entries: DPGlobalMapEntry[] = JSON.parse(txt);

        const step = DPFullWorldRenderer['STEP'] ?? (640 * 16);

        const valid = entries.filter((e) => e.MapIndex !== -1);

        let minX = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxZ = -Infinity;

        for (const e of valid) {
          minX = Math.min(minX, e.CoordX);
          maxX = Math.max(maxX, e.CoordX);
          minZ = Math.min(minZ, e.CoordZ);
          maxZ = Math.max(maxZ, e.CoordZ);
        }

        console.log('DP globalmap bounds:', { minX, maxX, minZ, maxZ, count: valid.length });

        const placed: DPPlacedMap[] = valid.map((e) => {
          const gx = e.CoordX - minX;
          const gz = e.CoordZ - minZ;

          return {
            key: (e.MapIndex << 16) ^ ((gx & 0xff) << 8) ^ (gz & 0xff), 
            mapIndex: e.MapIndex,
            gx, gz,
            wx: gx * step,
            wz: gz * step,
          };
        });

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);
const texFetcher = await SFATextureFetcher.create(gInfo, dataFetcher, false);
texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);

        const blockFetcher = await DPBlockFetcher.create(
            gInfo, dataFetcher, materialFactory, Promise.resolve(texFetcher)
        );

        const renderer = new DPFullWorldRenderer(device, context, animController, materialFactory, gInfo, dataFetcher, blockFetcher, placed);

        const fakeWorld = {
            renderCache: (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
            gameInfo: gInfo,
            worldLights: renderer.worldLights,
            resColl: { texFetcher: texFetcher },
            objectMan: { createObjectInstance: () => ({ destroy: () => {} }) }
        } as unknown as World;

        try {
            renderer.envfxMan = await EnvfxManager.create(fakeWorld, dataFetcher);
            renderer.envfxMan.loadEnvfx(0); 
        } catch (e) {
            console.warn("Failed to load ENVFXACT.bin for DP Full World", e);
        }

        await renderer.loadAllMaps(8); 
        return renderer;
    }
}
export class CombinedOldIceMtSceneDesc implements Viewer.SceneDesc {
    constructor(
        public id: string, 
        public name: string, 
        private gameInfo: GameInfo = DP_GAME_INFO
    ) {}

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        const musicState = (window as any).musicState;
        if (musicState.audio) {
            musicState.audio.pause();
            musicState.audio.currentTime = 0;
            musicState.audio = null;
        }

        console.log(`Creating scene for ${this.name} using combined bins with Sky/EnvFx...`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);

        const map23 = await loadMap(this.gameInfo, context.dataFetcher, 23); 
        const map24 = await loadMap(this.gameInfo, context.dataFetcher, 24); 
        const map25 = await loadMap(this.gameInfo, context.dataFetcher, 25); 

        const c1 = map23.getNumCols(), r1 = map23.getNumRows();
        const c2 = map24.getNumCols(), r2 = map24.getNumRows();
        const c3 = map25.getNumCols(), r3 = map25.getNumRows();

        const fetchSafe = async (name: string) => {
            try { 
                return await context.dataFetcher.fetchData(`${this.gameInfo.pathBase}/${name}`); 
            } catch { 
                console.warn(`Could not load ${name}. Rendering blank space.`);
                return { createDataView: () => new DataView(new ArrayBuffer(0)) }; 
            }
        };

        const bin1 = (await fetchSafe('0162 00A2 OldIceMt1 - block_ids.bin')).createDataView();
        const bin2 = (await fetchSafe('0169 00A9 OldIceMt2 - block_ids.bin')).createDataView();
        const bin3 = (await fetchSafe('0176 00B0 OldIceMt3 - block_ids.bin')).createDataView();

        const GAP = 2;
        const start1 = 0;
        const start2 = c1 + GAP;
        const start3 = start2 + c2 + GAP;
        
        const totalCols = start3 + c3;
        const totalRows = Math.max(r1, r2, r3); 

        const mapSceneInfo: MapSceneInfo = {
            getNumCols: () => totalCols,
            getNumRows: () => totalRows,
            getBlockInfoAt: (col: number, row: number): BlockInfo | null => {
                let offset = -1;
                let view: DataView | null = null;

                if (col >= start1 && col < start1 + c1 && row < r1) {
                    offset = (row * c1 + (col - start1)) * 4;
                    view = bin1;
                } else if (col >= start2 && col < start2 + c2 && row < r2) {
                    offset = (row * c2 + (col - start2)) * 4;
                    view = bin2;
                } else if (col >= start3 && col < start3 + c3 && row < r3) {
                    offset = (row * c3 + (col - start3)) * 4;
                    view = bin3;
                }

                if (!view || offset < 0 || offset >= view.byteLength) return null;

                const blockInfo = view.getUint32(offset);
                const sub = (blockInfo >>> 17) & 0x3F;
                const mod = (blockInfo >>> 23);

                if (mod === 0xff) return null;
                return { mod, sub };
            },
            getOrigin: () => [0, 0]
        };

        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = 'oldicemt_combined'; 

        const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
        texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);

        // --- FAKE WORLD INJECTION FOR ENVFX ---
        const fakeWorld: any = {
            renderCache: (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
            gameInfo: this.gameInfo,
            worldLights: mapRenderer.worldLights,
            resColl: { texFetcher: texFetcher },
            objectMan: { createObjectInstance: () => ({ destroy: () => {}, addRenderInsts: () => {} }) }
        };

        try {
            mapRenderer.envfxMan = await EnvfxManager.create(fakeWorld as World, context.dataFetcher);
            fakeWorld.envfxMan = mapRenderer.envfxMan; 
            // 95 is the Dinosaur Planet default index
            mapRenderer.envfxMan.loadEnvfx(95); 
        } catch (e) {
            console.warn("Failed to load ENVFXACT.bin for Combined Map", e);
        }
        // --------------------------------------

        const blockFetcher = await DPBlockFetcher.create(
            this.gameInfo, context.dataFetcher, materialFactory, Promise.resolve(texFetcher)
        );

        await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

        setTimeout(async () => {
            const mr = mapRenderer as any;
            if (mr.envSelect) {
                const sequence = [95, 96, 97, 98, 99, 100];
                for (const val of sequence) {
                    mr.envSelect.setValue(val);
                    if (mr.envSelect.onvalue) {
                        await mr.envSelect.onvalue(val);
                    }
                    await new Promise(resolve => setTimeout(resolve, 16)); 
                }
            }
        }, 10);

        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}

export class YetiSceneDesc implements Viewer.SceneDesc {
    constructor(
        public id: string, 
        public name: string, 
        private gameInfo: GameInfo = DP_GAME_INFO
    ) {}

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        const musicState = (window as any).musicState;
        if (musicState.audio) { musicState.audio.pause(); musicState.audio.currentTime = 0; musicState.audio = null; }

        console.log(`Creating manual grid scene for ${this.name}...`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);

        const B = (absoluteId: number): BlockInfo => {
            return {
                mod: Math.floor(absoluteId / 64), 
                sub: absoluteId % 64              
            };
        };

        const LAYOUT: (BlockInfo | null)[][] = [
     [B(0x01e2),B(0x01e3),null,null,null,null,null,null,null,null,],        
    [null,B(0x01e4),null,null,null,null,null,null,null,null,],         
   [null,B(0x01e5),B(0x01e6), B(0x01e7),B(0x01e8),null,null,null,null,null,],          
  [null,null,B(0x01e9), B(0x01ea),B(0x01eb),null,null,null,null,null,],           
 [null,null,null, null,B(0x01ec),B(0x01ed),B(0x01ee),null,B(0x01Ef),null,],
 [ null,null,null, null,null,null,B(0x01F0),B(0x01F1), B(0x01F2),null,],
 [ null,null,null, null,B(0x01F3),B(0x01F4),B(0x01F5),B(0x01F6), B(0x01F7),null,],
 [null,null,null, null,B(0x01F9),B(0x01Fa), B(0x01Fb), B(0x01Fc), ], 
 [null,null,null, null,null,B(0x01Fd), B(0x01Fe),],
        ];
        // ==========================================

        const numRows = LAYOUT.length;
        const numCols = LAYOUT[0].length;

        const mapSceneInfo: MapSceneInfo = {
            getNumCols: () => numCols,
            getNumRows: () => numRows,
            getBlockInfoAt: (col: number, row: number): BlockInfo | null => {
                if (row >= numRows || col >= numCols) return null;
                return LAYOUT[row][col] || null;
            },
            getOrigin: () => [0, 0]
        };

        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = this.id; 

        const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
        texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);


        const fakeWorld: any = {
            renderCache: (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
            gameInfo: this.gameInfo,
            worldLights: mapRenderer.worldLights,
            resColl: { texFetcher: texFetcher },
            objectMan: { createObjectInstance: () => ({ destroy: () => {}, addRenderInsts: () => {} }) }
        };

        try {
            mapRenderer.envfxMan = await EnvfxManager.create(fakeWorld as World, context.dataFetcher);
            fakeWorld.envfxMan = mapRenderer.envfxMan; 
            mapRenderer.envfxMan.loadEnvfx(95); 
        } catch (e) { console.warn("Failed to load ENVFXACT.bin", e); }
        // --------------------------------------

        const blockFetcher = await DPBlockFetcher.create(this.gameInfo, context.dataFetcher, materialFactory, Promise.resolve(texFetcher));
        await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

        setTimeout(async () => {
            const mr = mapRenderer as any;
            if (mr.envSelect) {
                for (const val of [95, 96, 97, 98, 99, 100]) {
                    mr.envSelect.setValue(val);
                    if (mr.envSelect.onvalue) await mr.envSelect.onvalue(val);
                    await new Promise(resolve => setTimeout(resolve, 16)); 
                }
            }
        }, 10);

        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}
