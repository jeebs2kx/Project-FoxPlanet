import { mat4, vec3 } from 'gl-matrix';
import * as UI from '../ui.js';

import { DataFetcher } from '../DataFetcher.js';
import * as Viewer from '../viewer.js';
import { SFABlockFetcher, BlockFetcher, SwapcircleBlockFetcher, AncientBlockFetcher, EARLY1BLOCKFETCHER, EARLY2BLOCKFETCHER, EARLY3BLOCKFETCHER, EARLY4BLOCKFETCHER  } from './blocks.js';
import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import { GfxRenderInstList, GfxRenderInstManager } from "../gfx/render/GfxRenderInstManager.js";
import { GfxrGraphBuilder, GfxrPass, GfxrPassScope, GfxrRenderTargetID } from '../gfx/render/GfxRenderGraph.js';
import { SceneContext } from '../SceneBase.js';
import * as GX_Material from '../gx/gx_material.js';
import { fillSceneParamsDataOnTemplate } from '../gx/gx_render.js';
import { getDebugOverlayCanvas2D, drawWorldSpaceText } from "../DebugJunk.js";
import { White, colorCopy, colorNewFromRGBA } from '../Color.js';
import { SFA_GAME_INFO, GameInfo } from './scenes.js';
import { loadRes, ResourceCollection } from './resource.js';
import { ObjectManager, ObjectInstance, ObjectUpdateContext } from './objects.js';
import { EnvfxManager } from './envfx.js';
import { SFARenderer, SceneRenderContext, SFARenderLists } from './render.js';
import { MapInstance, loadMap } from './maps.js';
import { dataSubarray, mat4SetTranslation, readVec3 } from './util.js';
import { ModelRenderContext } from './models.js';
import { MaterialFactory } from './materials.js';
import { SFAAnimationController } from './animation.js';
import { Sky } from './Sky.js';
import { LightType, WorldLights } from './WorldLights.js';
import { SFATextureFetcher } from './textures.js';
import { SphereMapManager } from './SphereMaps.js';
import { Camera, CameraController, OrbitCameraController, computeViewMatrix } from '../Camera.js';
import { nArray } from '../util.js';
import { computeUnitSphericalCoordinates, transformVec3Mat4w0, transformVec3Mat4w1 } from '../MathHelpers.js';
import { GfxRenderCache } from '../gfx/render/GfxRenderCache.js';
if (!(window as any).musicState) {
    (window as any).musicState = {
        muted: false,
        audio: null as HTMLAudioElement | null
    };
}

const MAP_MUSIC: Record<number, string> = {
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
};


const scratchVec0 = vec3.create();
const scratchMtx0 = mat4.create();
const scratchMtx1 = mat4.create();
const scratchColor0 = colorNewFromRGBA(1, 1, 1, 1);


function formatObjectInspectorHex(value: number, minWidth: number = 4): string {
  return (value >>> 0).toString(16).toUpperCase().padStart(minWidth, '0');
}
function getClipFromWorldMatrix(viewerInput: Viewer.ViewerRenderInput): mat4 | null {
    const cam: any = viewerInput.camera;
    if (cam?.clipFromWorldMatrix)
        return cam.clipFromWorldMatrix as mat4;
    if (cam?.viewProjectionMatrix)
        return cam.viewProjectionMatrix as mat4;
    return null;
}

function projectWorldToCanvas(
    clipFromWorld: mat4,
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
    z: number,
): { x: number; y: number; depth: number } | null {
    const cx = clipFromWorld[0] * x + clipFromWorld[4] * y + clipFromWorld[8]  * z + clipFromWorld[12];
    const cy = clipFromWorld[1] * x + clipFromWorld[5] * y + clipFromWorld[9]  * z + clipFromWorld[13];
    const cz = clipFromWorld[2] * x + clipFromWorld[6] * y + clipFromWorld[10] * z + clipFromWorld[14];
    const cw = clipFromWorld[3] * x + clipFromWorld[7] * y + clipFromWorld[11] * z + clipFromWorld[15];

    if (cw <= 0.0001)
        return null;

    const ndcX = cx / cw;
    const ndcY = cy / cw;
    const ndcZ = cz / cw;

    if (ndcX < -1.2 || ndcX > 1.2 || ndcY < -1.2 || ndcY > 1.2 || ndcZ < -1.2 || ndcZ > 1.2)
        return null;

    return {
        x: (ndcX * 0.5 + 0.5) * canvas.width,
        y: (-ndcY * 0.5 + 0.5) * canvas.height,
        depth: ndcZ,
    };
}

function transformMapPoint(m: mat4, x: number, y: number, z: number): vec3 {
    return vec3.fromValues(
        m[0] * x + m[4] * y + m[8]  * z + m[12],
        m[1] * x + m[5] * y + m[9]  * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
    );
}
function cleanupSFAHitsToggleUI(): void {
    const state = (window as any).__sfaHitsToggle as {
        wrap?: HTMLDivElement;
        cb?: HTMLInputElement;
        handler?: ((e: Event) => void) | null;
    } | undefined;

    if (state?.handler && state?.cb)
        state.cb.removeEventListener('change', state.handler);

    state?.wrap?.remove();
    (window as any).__sfaHitsToggle = undefined;
}

function ensureSFAHitsToggleUI(
    onChange: (enabled: boolean) => void | Promise<void>,
    initial?: boolean
): void {
    type ToggleState = {
        wrap: HTMLDivElement;
        cb: HTMLInputElement;
        handler: ((e: Event) => void) | null;
        last?: boolean;
    };

    let state = (window as any).__sfaHitsToggle as ToggleState | undefined;

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
        label.appendChild(document.createTextNode('HITS'));
        wrap.appendChild(label);
        document.body.appendChild(wrap);

        state = { wrap, cb, handler: null, last: false };
        (window as any).__sfaHitsToggle = state;
    }

    if (state.handler)
        state.cb.removeEventListener('change', state.handler);

    const desired = (typeof initial === 'boolean') ? initial : (state.last ?? false);
    state.cb.checked = desired;

    state.handler = async () => {
        state!.last = state!.cb.checked;
        await onChange(state!.cb.checked);
    };

    state.cb.addEventListener('change', state.handler);
}

export class World {
    public mapNum: number | null = null;

    public backgroundMusic: HTMLAudioElement | null = null;
    public animController!: SFAAnimationController;
    public envfxMan!: EnvfxManager;
    public blockFetcher!: SFABlockFetcher;
    public mapInstance: MapInstance | null = null;
    public objectMan!: ObjectManager;
    public resColl!: ResourceCollection;
    public objectInstances: ObjectInstance[] = [];
    public worldLights: WorldLights = new WorldLights();
    public renderCache: GfxRenderCache;
private handleMusic() {
    const musicState = (window as any).musicState;

    if (this.mapNum === null)
        return;

    const track = MAP_MUSIC[this.mapNum];

    const FADE_TIME = 1000;

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

    if (track) {
        const newSrc = `data/audio/${track}`;

        if (!musicState.audio || !musicState.audio.src.includes(track)) {

            if (musicState.audio)
                fadeOut(musicState.audio, FADE_TIME);

            const newAudio = new Audio(newSrc);
            newAudio.loop = true;

            musicState.audio = newAudio;

            if (!musicState.muted) {
                newAudio.play().then(() => {
                    fadeIn(newAudio, 0.2, FADE_TIME);
                }).catch(() => {});
            }
        }
    } else {
        if (musicState.audio)
            fadeOut(musicState.audio, FADE_TIME);
    }
}



    private constructor(public context: SceneContext, public gameInfo: GameInfo, public subdirs: string[], private materialFactory: MaterialFactory) {
        this.renderCache = this.materialFactory.cache;
    }

    private async init(dataFetcher: DataFetcher) {
        this.animController = new SFAAnimationController();
        this.envfxMan = await EnvfxManager.create(this, dataFetcher);
        
        const resCollPromise = ResourceCollection.create(this.context.device, this.gameInfo, dataFetcher, this.subdirs, this.materialFactory, this.animController);
        const texFetcherPromise = async () => {
            return (await resCollPromise).texFetcher;
        };

        const [resColl, blockFetcher, objectMan] = await Promise.all([
            resCollPromise,
            SFABlockFetcher.create(this.gameInfo, dataFetcher, this.context.device, this.materialFactory, this.animController, texFetcherPromise()),
ObjectManager.create(
  this,
  dataFetcher,
  false,
  this.gameInfo.pathBase === 'StarFoxAdventuresDemo',
),
        ]);
        this.resColl = resColl;
        this.blockFetcher = blockFetcher;
        this.objectMan = objectMan;
    }

public static async create(
    context: SceneContext,
    gameInfo: GameInfo,
    dataFetcher: DataFetcher,
    subdirs: string[],
    materialFactory: MaterialFactory
): Promise<World> {

    const self = new World(context, gameInfo, subdirs, materialFactory);
    await self.init(dataFetcher);

    return self;
}

    public setMapInstance(mapInstance: MapInstance | null) {
        this.mapInstance = mapInstance;
    }

    public spawnObject(objParams: DataView, parent: ObjectInstance | null = null, mapObjectOrigin: vec3): ObjectInstance | null {
        const typeNum = objParams.getUint16(0x0);
        const pos = readVec3(objParams, 0x8);

        const posInMap = vec3.clone(pos);
        vec3.add(posInMap, posInMap, mapObjectOrigin);

const obj = this.objectMan.createObjectInstance(typeNum, objParams, posInMap);

if (this.gameInfo.pathBase === 'StarFoxAdventuresDemo') {
    const name = obj.getName().toLowerCase();
    if (name.includes('curve')) {
        obj.getType().isDevObject = true;
    }
}

obj.setParent(parent);
this.objectInstances.push(obj);

        try {
            obj.mount();
        } catch (e) {
            console.warn("Mounting object failed with exception:");
            console.error(e);
            this.objectInstances.pop();
            return null;
        }

        return obj;
    }

    public spawnObjectsFromRomlist(romlist: DataView, parent: ObjectInstance | null = null) {
        const mapObjectOrigin = vec3.create();
        if (this.mapInstance !== null)
            vec3.set(mapObjectOrigin, 640 * this.mapInstance.info.getOrigin()[0], 0, 640 * this.mapInstance.info.getOrigin()[1]);

        let offs = 0;
        let i = 0;
        while (offs < romlist.byteLength) {
            const entrySize = 4 * romlist.getUint8(offs + 0x2);
            const objParams = dataSubarray(romlist, offs, entrySize);

            const obj = this.spawnObject(objParams, parent, mapObjectOrigin);
            if (obj !== null)
                console.log(`Object #${i}: ${obj.getName()} (type ${obj.getType().typeNum} romlist-type 0x${obj.commonObjectParams.objType.toString(16)} class ${obj.getType().objClass} id 0x${obj.commonObjectParams.id.toString(16)})`);

            offs += entrySize;
            i++;
        }
    }
    
    public setupLightsForObject(lights: GX_Material.Light[], obj: ObjectInstance | undefined, sceneCtx: SceneRenderContext, typeMask: LightType) {
        const probedLights = obj !== undefined ? this.worldLights.probeLightsOnObject(obj, sceneCtx, typeMask, 8) : this.worldLights.lights;
        let i = 0;

        const worldView = scratchMtx0;
        computeViewMatrix(worldView, sceneCtx.viewerInput.camera);
        const worldViewSR = scratchMtx1;
        mat4.copy(worldViewSR, worldView);
        mat4SetTranslation(worldViewSR, 0, 0, 0);

        for (let light of probedLights) {
            if (light.type & typeMask) {
                lights[i].reset();
                if (light.type === LightType.DIRECTIONAL) {
                    vec3.scale(lights[i].Position, light.direction, -100000.0);
                    transformVec3Mat4w0(lights[i].Position, worldViewSR, lights[i].Position);
                    colorCopy(lights[i].Color, light.color);
                    vec3.set(lights[i].CosAtten, 1.0, 0.0, 0.0);
                    vec3.set(lights[i].DistAtten, 1.0, 0.0, 0.0);
                } else { // LightType.POINT
                    light.getPosition(scratchVec0);
                    transformVec3Mat4w1(lights[i].Position, worldView, scratchVec0);
                    // drawWorldSpacePoint(getDebugOverlayCanvas2D(), sceneCtx.viewerInput.camera.clipFromWorldMatrix, light.position);
                    // TODO: use correct parameters
                    colorCopy(lights[i].Color, light.color);
                    vec3.set(lights[i].CosAtten, 1.0, 0.0, 0.0); // TODO
                    vec3.copy(lights[i].DistAtten, light.distAtten);
                }

                i++;
                if (i >= 8)
                    break;
            }
        }

        for (; i < 8; i++)
            lights[i].reset();
    }

    public destroy(device: GfxDevice) {
        // Stop background music when leaving scene
if (this.backgroundMusic) {
    this.backgroundMusic.pause();
    this.backgroundMusic.currentTime = 0;
    this.backgroundMusic = null;
}

        for (let obj of this.objectInstances)
            obj.destroy(device);
        this.envfxMan.destroy(device);
        this.mapInstance?.destroy(device);
        this.resColl.destroy(device);
        this.blockFetcher.destroy(device);
    }
}

class WorldRenderer extends SFARenderer {
    public textureHolder!: UI.TextureListHolder;
    private timeSelect!: UI.Slider;
    private enableAmbient: boolean = true;
    private enableFog: boolean = true;
    private layerSelect!: UI.Slider;
private showObjects: boolean;
private showDevGeometry: boolean = false;
private showDevObjects: boolean = false;
public showHits: boolean = false;
private enableLights: boolean = true;

private showObjectLabels: boolean = false;
private objectInspectorSelect: HTMLSelectElement | null = null;
private objectInspectorPre: HTMLPreElement | null = null;
private objectInspectorSelectedValue: string = '';
private objectInspectorLastObjectCount: number = -1;

private sky: Sky;

private sphereMapMan: SphereMapManager;
    constructor(protected override world: World, materialFactory: MaterialFactory, defaultShowObjects: boolean = true) {
        super(world.context, world.animController, materialFactory);
        this.showObjects = defaultShowObjects;

        if (this.world.resColl.texFetcher instanceof SFATextureFetcher)
            this.textureHolder = this.world.resColl.texFetcher.textureHolder;
        this.sky = new Sky(this.world);
        this.sphereMapMan = new SphereMapManager(this.world, materialFactory);
    }

    public createPanels(): UI.Panel[] {
        const timePanel = new UI.Panel();
        timePanel.setTitle(UI.TIME_OF_DAY_ICON, 'Time');

        this.timeSelect = new UI.Slider();
        this.timeSelect.setLabel('Time');
        this.timeSelect.setRange(0, 7, 1);
        this.timeSelect.setValue(4);
        timePanel.contents.append(this.timeSelect.elem);

        const disableAmbient = new UI.Checkbox("Disable ambient lighting", false);
        disableAmbient.onchanged = () => {
            this.enableAmbient = !disableAmbient.checked;
        };
        timePanel.contents.append(disableAmbient.elem);

        const disableFog = new UI.Checkbox("Disable fog", false);
        disableFog.onchanged = () => {
            this.enableFog = !disableFog.checked;
        };
        timePanel.contents.append(disableFog.elem);

        const layerPanel = new UI.Panel();
        layerPanel.setTitle(UI.LAYER_ICON, 'Layers');

const hideObjects = new UI.Checkbox("Hide objects", !this.showObjects);
        hideObjects.onchanged = () => {
            this.showObjects = !hideObjects.checked;
        };
        layerPanel.contents.append(hideObjects.elem);

        this.layerSelect = new UI.Slider();
        this.layerSelect.setLabel('Layer');
        this.layerSelect.setRange(0, 16, 1);
        this.layerSelect.setValue(1);
        layerPanel.contents.append(this.layerSelect.elem);

        const showDevObjects = new UI.Checkbox("Show developer objects", false);
        showDevObjects.onchanged = () => {
            this.showDevObjects = showDevObjects.checked;
        };
        layerPanel.contents.append(showDevObjects.elem);

        const showDevGeometry = new UI.Checkbox("Show developer map shapes", false);
        showDevGeometry.onchanged = () => {
            this.showDevGeometry = showDevGeometry.checked;
        };
        layerPanel.contents.append(showDevGeometry.elem);

        const disableLights = new UI.Checkbox("Disable lights", false);
        disableLights.onchanged = () => {
            this.enableLights = !disableLights.checked;
        }
        layerPanel.contents.append(disableLights.elem);
        
const showDebugThumbnails = new UI.Checkbox('Show Debug Thumbnails', false);
showDebugThumbnails.onchanged = () => {
    const v = showDebugThumbnails.checked;
    this.renderHelper.debugThumbnails.enabled = v;
};
const objectPanel = new UI.Panel();
objectPanel.setTitle(UI.RENDER_HACKS_ICON, 'Object Inspector');

const objectIntro = document.createElement('div');
objectIntro.style.whiteSpace = 'pre-wrap';
objectIntro.style.marginBottom = '8px';
objectIntro.textContent =
  'SFA object browser for the current world.\n' +
  'Click an object in the list or press "Go To Object" to move the camera to it.';
objectPanel.contents.appendChild(objectIntro);

objectPanel.contents.appendChild(showDebugThumbnails.elem);

const showObjectLabels = new UI.Checkbox('Show object labels', this.showObjectLabels);
showObjectLabels.onchanged = () => {
  this.showObjectLabels = showObjectLabels.checked;
};
layerPanel.contents.appendChild(showObjectLabels.elem);

const objectSelectLabel = document.createElement('div');
objectSelectLabel.textContent = 'Loaded objects';
objectSelectLabel.style.marginTop = '8px';
objectSelectLabel.style.marginBottom = '4px';
objectPanel.contents.appendChild(objectSelectLabel);

const objectSelect = document.createElement('select');
objectSelect.size = 10;
objectSelect.style.width = '100%';
objectSelect.style.boxSizing = 'border-box';
objectSelect.style.marginBottom = '8px';
objectSelect.onchange = () => {
  this.objectInspectorSelectedValue = objectSelect.value;
  this.refreshSelectedObjectInspectorText();

  const selected = this.getSelectedInspectableObject();
  if (selected !== null)
    this.focusCameraOnInspectableObject(selected.obj);
};
objectPanel.contents.appendChild(objectSelect);
this.objectInspectorSelect = objectSelect;

const objectButtonRow = document.createElement('div');
objectButtonRow.style.display = 'flex';
objectButtonRow.style.gap = '8px';
objectButtonRow.style.marginBottom = '8px';

const refreshObjectsBtn = document.createElement('button');
refreshObjectsBtn.textContent = 'Refresh List';
refreshObjectsBtn.onclick = () => {
  this.refreshObjectInspectorList(true);
};
objectButtonRow.appendChild(refreshObjectsBtn);

const focusSelectedBtn = document.createElement('button');
focusSelectedBtn.textContent = 'Go To Object';
focusSelectedBtn.onclick = () => {
  const selected = this.getSelectedInspectableObject();
  if (selected !== null)
    this.focusCameraOnInspectableObject(selected.obj);
};
objectButtonRow.appendChild(focusSelectedBtn);

const clearSelectionBtn = document.createElement('button');
clearSelectionBtn.textContent = 'Clear Selection';
clearSelectionBtn.onclick = () => {
  this.objectInspectorSelectedValue = '';
  if (this.objectInspectorSelect)
    this.objectInspectorSelect.value = '';
  this.refreshSelectedObjectInspectorText();
};
objectButtonRow.appendChild(clearSelectionBtn);

objectPanel.contents.appendChild(objectButtonRow);

const objectInfoPre = document.createElement('pre');
objectInfoPre.style.whiteSpace = 'pre-wrap';
objectInfoPre.style.maxHeight = '360px';
objectInfoPre.style.overflow = 'auto';
objectInfoPre.style.margin = '0';
objectPanel.contents.appendChild(objectInfoPre);
this.objectInspectorPre = objectInfoPre;

this.refreshObjectInspectorList(false);

return [timePanel, layerPanel, objectPanel];
    }

private getInspectableObjects(): Array<{ worldIndex: number; obj: ObjectInstance }> {
  const out: Array<{ worldIndex: number; obj: ObjectInstance }> = [];

  for (let i = 0; i < this.world.objectInstances.length; i++)
    out.push({ worldIndex: i, obj: this.world.objectInstances[i] });

  return out;
}

private buildInspectableObjectLabel(worldIndex: number, obj: ObjectInstance): string {
  const type = obj.getType();
  return `#${worldIndex} ${obj.getName()} [type 0x${formatObjectInspectorHex(type.typeNum)} class ${type.objClass}]`;
}

private refreshObjectInspectorList(preserveSelection: boolean = true): void {
  if (this.objectInspectorSelect === null)
    return;

  const select = this.objectInspectorSelect;
  const previousValue = preserveSelection ? this.objectInspectorSelectedValue : '';
  const entries = this.getInspectableObjects();

  select.innerHTML = '';

  for (const entry of entries) {
    const opt = document.createElement('option');
    opt.value = String(entry.worldIndex);
    opt.textContent = this.buildInspectableObjectLabel(entry.worldIndex, entry.obj);
    select.appendChild(opt);
  }

  if (previousValue !== '' && Array.from(select.options).some((o) => o.value === previousValue)) {
    select.value = previousValue;
    this.objectInspectorSelectedValue = previousValue;
  } else if (select.options.length > 0) {
    select.selectedIndex = 0;
    this.objectInspectorSelectedValue = select.value;
  } else {
    this.objectInspectorSelectedValue = '';
  }

  this.objectInspectorLastObjectCount = this.world.objectInstances.length;
  this.refreshSelectedObjectInspectorText();
}

private getSelectedInspectableObject(): { worldIndex: number; obj: ObjectInstance } | null {
  const rawValue =
    this.objectInspectorSelectedValue !== ''
      ? this.objectInspectorSelectedValue
      : (this.objectInspectorSelect?.value ?? '');

  if (rawValue === '')
    return null;

  const worldIndex = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(worldIndex))
    return null;

  const obj = this.world.objectInstances[worldIndex];
  if (!obj)
    return null;

  return { worldIndex, obj };
}

private buildObjectInspectorText(worldIndex: number, obj: ObjectInstance): string {
  const type = obj.getType();
  const common = obj.commonObjectParams;
  const worldPos = vec3.create();
  obj.getPosition(worldPos);

  const internalClassName =
    obj.internalClass !== undefined ? obj.internalClass.constructor.name : '(none)';

  let renderPath = 'plain current-model';
  if (obj.internalClass !== undefined)
    renderPath = `class-backed (${internalClassName})`;
  if (obj.modelInst === null)
    renderPath = obj.internalClass !== undefined
      ? `class-backed (${internalClassName}), no current model`
      : 'no current model';

  const modelList =
    type.modelNums.length > 0
      ? type.modelNums.map((n) => `0x${formatObjectInspectorHex(n, 4)}`).join(', ')
      : '(none)';

  const activeModelAnim = (obj as any).modelAnimNum as number | null | undefined;
  const hasLoadedAnim = ((obj as any).anim ?? null) !== null;
  const resolvedAmbienceIdx = (obj as any).ambienceIdx as number | undefined;

  const parentChain: string[] = [];
  let parent = obj.parent;
  while (parent !== null) {
    const parentIndex = this.world.objectInstances.indexOf(parent);
    parentChain.push(
      parentIndex >= 0 ? `#${parentIndex} ${parent.getName()}` : parent.getName()
    );
    parent = parent.parent;
  }

  const directChildren: string[] = [];
  for (let i = 0; i < this.world.objectInstances.length; i++) {
    const candidate = this.world.objectInstances[i];
    if (candidate.parent === obj)
      directChildren.push(`#${i} ${candidate.getName()}`);
  }

  const lines: string[] = [];
  lines.push(`selected index: #${worldIndex}`);
  lines.push(`name: ${obj.getName()}`);
  lines.push(`map: ${this.world.mapNum ?? '(none)'}`);
  lines.push(`typeNum: 0x${formatObjectInspectorHex(type.typeNum)}`);
  lines.push(`romlist type: 0x${formatObjectInspectorHex(common.objType)}`);
  lines.push(`class: ${type.objClass}`);
  lines.push(`object id: 0x${formatObjectInspectorHex(common.id, 8)}`);
  lines.push(`render path: ${renderPath}`);
  lines.push(`internal class: ${internalClassName}`);
  lines.push(`model list: ${modelList}`);
  lines.push(`model instance: ${obj.modelInst !== null ? 'yes' : 'no'}`);
  lines.push(`joint count: ${obj.modelInst !== null ? obj.modelInst.model.joints.length : 0}`);
  lines.push(`active model anim index: ${activeModelAnim ?? '(none)'}`);
  lines.push(`animation loaded: ${hasLoadedAnim ? 'yes' : 'no'}`);
  lines.push(`anim speed: ${obj.animSpeed}`);
  lines.push(`scale: ${obj.scale.toFixed(3)}`);
  lines.push(`cull radius: ${obj.cullRadius.toFixed(3)}`);
  lines.push(`dev object: ${type.isDevObject ? 'yes' : 'no'}`);
  lines.push(`object ambience: ${type.ambienceNum}`);
  lines.push(`resolved ambience idx: ${resolvedAmbienceIdx ?? 0}`);
  lines.push(`common ambience value: ${common.ambienceValue}`);
  lines.push(`layer bits: 0x${formatObjectInspectorHex(common.layerValues[0], 2)} 0x${formatObjectInspectorHex(common.layerValues[1], 2)}`);
  lines.push(`visible in current layer ${this.layerSelect.getValue()}: ${obj.isInLayer(this.layerSelect.getValue()) ? 'yes' : 'no'}`);
  lines.push(`position (local): ${obj.position[0].toFixed(2)}, ${obj.position[1].toFixed(2)}, ${obj.position[2].toFixed(2)}`);
  lines.push(`position (world): ${worldPos[0].toFixed(2)}, ${worldPos[1].toFixed(2)}, ${worldPos[2].toFixed(2)}`);
  lines.push(`rotation (yaw, pitch, roll): ${obj.yaw.toFixed(3)}, ${obj.pitch.toFixed(3)}, ${obj.roll.toFixed(3)}`);
  lines.push('');
  lines.push('parent chain:');
  if (parentChain.length === 0)
    lines.push('  (none)');
  else
    for (const entry of parentChain)
      lines.push(`  ${entry}`);

  lines.push('');
  lines.push('direct children:');
  if (directChildren.length === 0)
    lines.push('  (none)');
  else
    for (const entry of directChildren)
      lines.push(`  ${entry}`);

  return lines.join('\n');
}

private refreshSelectedObjectInspectorText(): void {
  if (this.objectInspectorPre === null)
    return;

  const selected = this.getSelectedInspectableObject();
  if (selected === null) {
    this.objectInspectorPre.textContent =
      'No object selected.\n' +
      'Use the list above to inspect a loaded SFA world object.';
    return;
  }

  this.objectInspectorSelectedValue = String(selected.worldIndex);
  this.objectInspectorPre.textContent =
    this.buildObjectInspectorText(selected.worldIndex, selected.obj);
}

private focusCameraOnInspectableObject(obj: ObjectInstance): void {
    const viewer = (window as any).viewer as {
        camera?: Camera;
        cameraController?: any;
        oncamerachanged?: (force: boolean) => void;
    } | undefined;

    const camera = viewer?.camera;
    if (!viewer || !camera)
        return;

    const objWorldPos = vec3.create();
    obj.getPosition(objWorldPos);

    const currentEye = vec3.fromValues(
        camera.worldMatrix[12],
        camera.worldMatrix[13],
        camera.worldMatrix[14],
    );

    const objectRadius = Math.max(1.0, obj.cullRadius * Math.max(obj.scale, 1.0));
    const desiredDistance = Math.max(30.0, Math.min(120.0, objectRadius * 1.4));
    const desiredHeight = Math.max(12.0, Math.min(36.0, objectRadius * 0.35));

    // Keep the current horizontal viewing side, but stop the camera from going top-down.
    const flatDir = vec3.fromValues(
        currentEye[0] - objWorldPos[0],
        0.0,
        currentEye[2] - objWorldPos[2],
    );

    if (!Number.isFinite(flatDir[0]) || !Number.isFinite(flatDir[2]) || vec3.length(flatDir) < 0.001) {
        vec3.set(flatDir, 1.0, 0.0, 1.0);
    }

    vec3.normalize(flatDir, flatDir);

    const eyeOffset = vec3.fromValues(
        flatDir[0] * desiredDistance,
        desiredHeight,
        flatDir[2] * desiredDistance,
    );

    const newEye = vec3.create();
    vec3.add(newEye, objWorldPos, eyeOffset);

    const controller = viewer.cameraController as any;
    if (controller && controller.translation && controller.translation.length >= 3) {
        controller.translation[0] = objWorldPos[0];
        controller.translation[1] = objWorldPos[1];
        controller.translation[2] = objWorldPos[2];

        const dir = vec3.create();
        vec3.normalize(dir, eyeOffset);

        const azimuth = Math.atan2(dir[2], dir[0]);
        const polar = Math.acos(Math.max(-0.999, Math.min(0.999, dir[1])));
        const zoom = -vec3.length(eyeOffset);

        if ('x' in controller) controller.x = azimuth;
        if ('y' in controller) controller.y = polar;
        if ('z' in controller) controller.z = zoom;
        if ('zTarget' in controller) controller.zTarget = zoom;

        if ('xVel' in controller) controller.xVel = 0;
        if ('yVel' in controller) controller.yVel = 0;
        if ('txVel' in controller) controller.txVel = 0;
        if ('tyVel' in controller) controller.tyVel = 0;
        if ('orbitXVel' in controller) controller.orbitXVel = 0;
        if ('forceUpdate' in controller) controller.forceUpdate = true;
    }

    mat4.targetTo(
        camera.worldMatrix,
        newEye,
        objWorldPos,
        vec3.fromValues(0, 1, 0),
    );
    mat4.invert(camera.viewMatrix, camera.worldMatrix);
    camera.worldMatrixUpdated();
    viewer.oncamerachanged?.(true);
}

    public setEnvfx(envfxactNum: number) {
        this.world.envfxMan.loadEnvfx(envfxactNum);
    }
private drawHitOverlay(viewerInput: Viewer.ViewerRenderInput): void {
    const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
    if (!ctx)
        return;

    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!this.showHits)
        return;

    const map = this.world.mapInstance;
    if (!map || !map.hitLines || map.hitLines.length === 0)
        return;

    const clipFromWorld = getClipFromWorldMatrix(viewerInput);
    if (!clipFromWorld)
        return;

    const mapMtx = map.getMapMatrix();

    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,255,0.95)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (const l of map.hitLines) {
        const a = transformMapPoint(mapMtx, l.x0, l.y0, l.z0);
        const b = transformMapPoint(mapMtx, l.x1, l.y1, l.z1);

        const p0 = projectWorldToCanvas(clipFromWorld, canvas, a[0], a[1], a[2]);
        const p1 = projectWorldToCanvas(clipFromWorld, canvas, b[0], b[1], b[2]);

        if (!p0 || !p1)
            continue;

        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
    }

    ctx.stroke();
    ctx.restore();
}
    // XXX: for testing
    public enableFineAnims(enable: boolean = true) {
        this.animController.enableFineSkinAnims = enable;
    }

    // XXX: for testing
    public loadTexture(id: number, useTex1: boolean = false) {
        const texture = this.world.resColl.texFetcher.getTexture(this.world.renderCache, id, useTex1);
        if (texture !== null && texture.viewerTexture !== undefined)
            console.log(`Loaded texture "${texture.viewerTexture.name}"`);
        else
            console.log(`Failed to load texture`);
    }

    protected override update(viewerInput: Viewer.ViewerRenderInput) {
        super.update(viewerInput);

        this.materialFactory.update(this.animController);

        this.world.envfxMan.setTimeOfDay(this.timeSelect.getValue()|0);
        this.world.envfxMan.enableAmbientLighting = this.enableAmbient;
        this.world.envfxMan.enableFog = this.enableFog;
        this.world.envfxMan.update(this.world.context.device, { viewerInput });
        
        const updateCtx: ObjectUpdateContext = {
            viewerInput,
        };

for (let i = 0; i < this.world.objectInstances.length; i++) {

const obj = this.world.objectInstances[i];

obj.update(updateCtx);

}

this.drawHitOverlay(viewerInput);

if (this.objectInspectorPre !== null) {
  if (this.objectInspectorLastObjectCount !== this.world.objectInstances.length)
    this.refreshObjectInspectorList(true);
  else
    this.refreshSelectedObjectInspectorText();
}
    }
    
    protected override addSkyRenderInsts(device: GfxDevice, renderInstManager: GfxRenderInstManager, renderLists: SFARenderLists, sceneCtx: SceneRenderContext) {
        this.sky.addSkyRenderInsts(device, renderInstManager, renderLists, sceneCtx);
    }

    protected override addSkyRenderPasses(device: GfxDevice, builder: GfxrGraphBuilder, renderInstManager: GfxRenderInstManager, renderLists: SFARenderLists, mainColorTargetID: GfxrRenderTargetID, sceneCtx: SceneRenderContext) {
        this.sky.addSkyRenderPasses(device, this.renderHelper, builder, renderInstManager, renderLists, mainColorTargetID, this.mainDepthDesc, sceneCtx);
    }

    public setupLightsForObject(lights: GX_Material.Light[], obj: ObjectInstance, sceneCtx: SceneRenderContext, typeMask: LightType) {
        if (this.enableLights) {
            this.world.setupLightsForObject(lights, obj, sceneCtx, typeMask);
        } else {
            for (let i = 0; i < 8; i++)
                lights[i].reset();
        }
    }

    protected override addWorldRenderInsts(device: GfxDevice, renderInstManager: GfxRenderInstManager, renderLists: SFARenderLists, sceneCtx: SceneRenderContext) {
        const template = renderInstManager.pushTemplateRenderInst();
        fillSceneParamsDataOnTemplate(template, sceneCtx.viewerInput);

        this.world.envfxMan.getAmbientColor(scratchColor0, 0); // Always use ambience #0 when rendering map (FIXME: really?)
        const modelCtx: ModelRenderContext = {
            sceneCtx,
            showDevGeometry: this.showDevGeometry,
            showMeshes: true,
            ambienceIdx: 0,
            outdoorAmbientColor: scratchColor0,
            setupLights: undefined!,
        };

        const lights = nArray(8, () => new GX_Material.Light());

        if (this.showObjects) {
            for (let i = 0; i < this.world.objectInstances.length; i++) {
                const obj = this.world.objectInstances[i];
    
                if (obj.getType().isDevObject && !this.showDevObjects)
                    continue;
    
                if (obj.isInLayer(this.layerSelect.getValue())) {
                    modelCtx.setupLights = (lights: GX_Material.Light[], typeMask: LightType) => {
                        this.setupLightsForObject(lights, obj, sceneCtx, typeMask);
                    };

                    obj.addRenderInsts(device, renderInstManager, renderLists, modelCtx);

const drawLabels = this.showObjectLabels;
                    if (drawLabels) {
                        obj.getPosition(scratchVec0);
drawWorldSpaceText(
    getDebugOverlayCanvas2D(),
    sceneCtx.viewerInput.camera.clipFromWorldMatrix,
    scratchVec0,
    obj.getName(),
    0,
    White,
    {
        outline: 2,
        font: '18px monospace',
    },
);
                    }
                }
            }
        }

        modelCtx.setupLights = () => {};
        if (this.world.mapInstance !== null)
            this.world.mapInstance.addRenderInsts(device, renderInstManager, renderLists, modelCtx);

        renderInstManager.popTemplateRenderInst();
    }

    protected override addWorldRenderPassesInner(device: GfxDevice, builder: GfxrGraphBuilder, renderInstManager: GfxRenderInstManager, sceneCtx: SceneRenderContext) {
        this.sphereMapMan.renderMaps(device, builder, this.renderHelper, renderInstManager, sceneCtx);
    }

    protected override attachResolveTexturesForWorldOpaques(builder: GfxrGraphBuilder, pass: GfxrPass) {
        this.sphereMapMan.attachResolveTextures(builder, pass);
    }

    protected override resolveLateSamplerBindingsForWorldOpaques(renderList: GfxRenderInstList, scope: GfxrPassScope) {
        this.sphereMapMan.resolveLateSamplerBindings(renderList, scope, this.renderHelper.renderCache);
    }

public override destroy(device: GfxDevice) {

 cleanupSFAHitsToggleUI();

 this.objectInspectorSelect = null;
 this.objectInspectorPre = null;
 this.objectInspectorSelectedValue = '';
 this.objectInspectorLastObjectCount = -1;

 super.destroy(device);

 this.world.destroy(device);

 this.sky.destroy(device);

 this.sphereMapMan.destroy(device);

}
}

export class SFAWorldSceneDesc implements Viewer.SceneDesc {
    public id: string;
    private subdirs: string[];

    constructor(public id_: string | string[], subdir_: string | string[], private mapNum: number | null, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
        if (Array.isArray(id_))
            this.id = id_[0];
        else
            this.id = id_;

        if (Array.isArray(subdir_))
            this.subdirs = subdir_;
        else
            this.subdirs = [subdir_];
    }

public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
    cleanupSFAHitsToggleUI();
    console.log(`Creating scene for world ${this.name} (ID ${this.id}) ...`);
        const pathBase = this.gameInfo.pathBase;
        const dataFetcher = context.dataFetcher;
        const materialFactory = new MaterialFactory(device);

        const finalSubdirs = [...this.subdirs];
        const checkAndAdd = (subdir: string) => {
            if (!finalSubdirs.includes(subdir)) finalSubdirs.push(subdir);
        };

        for (const subdir of this.subdirs) {
            if (subdir === 'clouddungeon') {
                checkAndAdd('crfort');
            } else if (subdir === 'desert') {
                checkAndAdd('dfptop');
                checkAndAdd('volcano');
            } else if (subdir === 'linkb' || subdir === 'linkf') {
                checkAndAdd('volcano');
            } else if (subdir === 'shipbattle') {
                checkAndAdd('swaphol');
            } else if (subdir === 'swapholbot' || subdir === 'shop') {
                checkAndAdd('swaphol');
            }
        }

        const world = await World.create(context, this.gameInfo, dataFetcher, finalSubdirs, materialFactory);

        let mapInstance: MapInstance | null = null;
        if (this.mapNum !== null) {
            const mapSceneInfo = await loadMap(this.gameInfo, dataFetcher, this.mapNum);
            
            // FIX: Argument order (mapSceneInfo, blockFetcher, options, world)
            mapInstance = new MapInstance(mapSceneInfo, world.blockFetcher, undefined, world);
            await mapInstance.reloadBlocks(dataFetcher);
            const objectOrigin = vec3.fromValues(640 * mapSceneInfo.getOrigin()[0], 0, 640 * mapSceneInfo.getOrigin()[1]);
            const mapMatrix = mat4.create();
            const mapTrans = vec3.clone(objectOrigin);
            vec3.negate(mapTrans, mapTrans);
            mat4.fromTranslation(mapMatrix, mapTrans);
            mapInstance.setMatrix(mapMatrix);

            world.setMapInstance(mapInstance);
            world.mapNum = this.mapNum;
            
            // Fix: Triggers music and internal state logic
            (world as any).handleMusic();
        }

        const romlistNames: string[] = Array.isArray(this.id_) ? this.id_ : [this.id_];
        let parentObj: ObjectInstance | null = null;
        for (let name of romlistNames) {
            console.log(`Loading romlist ${name}.romlist.zlb...`);

            const [romlistFile] = await Promise.all([
                dataFetcher.fetchData(`${pathBase}/${name}.romlist.zlb`),
            ]);
            const romlist = loadRes(romlistFile).createDataView();
    
            world.spawnObjectsFromRomlist(romlist, parentObj);

            if (name === 'frontend') {
                parentObj = world.objectInstances[2];
                console.log(`parentObj is ${parentObj.objType.name}`);
            }
        }
        
        (window.main as any).lookupObject = (objType: number, skipObjindex: boolean = false) => {
            const obj = world.objectMan.getObjectType(objType, skipObjindex);
         //   console.log(`Object ${objType}: ${obj.name} (type ${obj.typeNum} class ${obj.objClass})`);
        };

        (window.main as any).showAllTextures = (useTex1: boolean = false) => {
            const texFetcher = world.resColl.texFetcher as SFATextureFetcher;
            const { attempted, shown } = texFetcher.loadAllFromTables(materialFactory.cache, useTex1);
          //  console.log(`[ShowAllTextures] Bank=${useTex1 ? 'TEX1' : 'TEX0/TEXPRE'} attempted=${attempted} registered=${shown}`);
        };

const defaultShowObjects = true;
const renderer = new WorldRenderer(world, materialFactory, defaultShowObjects);

renderer.showHits = false;
ensureSFAHitsToggleUI(async (enabled: boolean) => {
    renderer.showHits = enabled;
}, false);

return renderer;
    }
}
export class SFAMapSceneDesc implements Viewer.SceneDesc {
    public id: string;
    private subdirs: string[];

    constructor(public id_: string | string[], subdir_: string | string[], private mapNum: number | null, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
        if (Array.isArray(id_))
            this.id = id_[0];
        else
            this.id = id_;

        if (Array.isArray(subdir_))
            this.subdirs = subdir_;
        else
            this.subdirs = [subdir_];
    }

public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
    cleanupSFAHitsToggleUI();
    console.log(`Creating scene for world ${this.name} (ID ${this.id}) ...`);
        const pathBase = this.gameInfo.pathBase;
        const dataFetcher = context.dataFetcher;
        const materialFactory = new MaterialFactory(device);

        // --- NEW: Kiosk/Demo Texture Dependency Logic ---
        const finalSubdirs = [...this.subdirs];
        const checkAndAdd = (subdir: string) => {
            if (!finalSubdirs.includes(subdir)) finalSubdirs.push(subdir);
        };

        for (const subdir of this.subdirs) {
            if (subdir === 'clouddungeon') {
                checkAndAdd('crfort');
            } else if (subdir === 'desert') {
                checkAndAdd('dfptop');
                checkAndAdd('volcano');
            } else if (subdir === 'linkb' || subdir === 'linkf') {
                checkAndAdd('volcano');
            } else if (subdir === 'shipbattle') {
                checkAndAdd('swaphol');
            } else if (subdir === 'swapholbot' || subdir === 'shop') {
                checkAndAdd('swaphol');
            }
        }

        // Initialize the world with the expanded dependency list
        const world = await World.create(context, this.gameInfo, dataFetcher, finalSubdirs, materialFactory);

        let mapInstance: MapInstance | null = null;
        if (this.mapNum !== null) {
            const mapSceneInfo = await loadMap(this.gameInfo, dataFetcher, this.mapNum);
            
            // FIX: MapInstance now takes undefined as 3rd arg and world as 4th arg
            mapInstance = new MapInstance(mapSceneInfo, world.blockFetcher, undefined, world);
            await mapInstance.reloadBlocks(dataFetcher);

            // Translate map for SFA world coordinates
            const objectOrigin = vec3.fromValues(640 * mapSceneInfo.getOrigin()[0], 0, 640 * mapSceneInfo.getOrigin()[1]);
            const mapMatrix = mat4.create();
            const mapTrans = vec3.clone(objectOrigin);
            vec3.negate(mapTrans, mapTrans);
            mat4.fromTranslation(mapMatrix, mapTrans);
            mapInstance.setMatrix(mapMatrix);

            world.setMapInstance(mapInstance);
            world.mapNum = this.mapNum;
            
            // Fix: Handle music/scene state for Kiosk maps
            (world as any).handleMusic();
        }

        const romlistNames: string[] = Array.isArray(this.id_) ? this.id_ : [this.id_];
        let parentObj: ObjectInstance | null = null;
        for (let name of romlistNames) {
            console.log(`Loading romlist ${name}.romlist.zlb...`);

            const [romlistFile] = await Promise.all([
                dataFetcher.fetchData(`${pathBase}/${name}.romlist.zlb`),
            ]);
            const romlist = loadRes(romlistFile).createDataView();
    
            world.spawnObjectsFromRomlist(romlist, parentObj);

            if (name === 'frontend') {
                parentObj = world.objectInstances[2];
            }
        }
        
        (window.main as any).lookupObject = (objType: number, skipObjindex: boolean = false) => {
            const obj = world.objectMan.getObjectType(objType, skipObjindex);
          //  console.log(`Object ${objType}: ${obj.name} (type ${obj.typeNum} class ${obj.objClass})`);
        };

        (window.main as any).showAllTextures = (useTex1: boolean = false) => {
            const texFetcher = world.resColl.texFetcher as SFATextureFetcher;
            const { attempted, shown } = texFetcher.loadAllFromTables(materialFactory.cache, useTex1);
           // console.log(`[ShowAllTextures] Bank=${useTex1 ? 'TEX1' : 'TEX0/TEXPRE'} attempted=${attempted} registered=${shown}`);
        };

const renderer = new WorldRenderer(world, materialFactory);

renderer.showHits = false;
ensureSFAHitsToggleUI(async (enabled: boolean) => {
    renderer.showHits = enabled;
}, false);

return renderer;
    }
}
export class SFAFullFinalWorldSceneDesc implements Viewer.SceneDesc {
    public id: string = "fullglobalworld";

    constructor(public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {}

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {

        const dataFetcher = context.dataFetcher;
        const materialFactory = new MaterialFactory(device);

  
        const world = await World.create(
            context,
            this.gameInfo,
            dataFetcher,
             ["swaphol"],  
            materialFactory
        );

        // Read GLOBALMA.bin
        const globalMapFile = await dataFetcher.fetchData(`${this.gameInfo.pathBase}/globalma.bin`);
        const dv = globalMapFile.createDataView();

        const mapInstances: MapInstance[] = [];

        let offset = 0;

        while (offset + 12 <= dv.byteLength) {

            const x = dv.getInt16(offset + 0);
            const y = dv.getInt16(offset + 2);
            const layer = dv.getInt16(offset + 4);
            const mapId = dv.getInt16(offset + 6);
      
            offset += 12;

            if (mapId < 0)
                break;
const subdir = this.gameInfo.subdirs[mapId];

const ARWING_IDS = new Set([
    3,   // arwing
 
    57,
    58,
    59,
    60,
    61,
    62,
]);

if (ARWING_IDS.has(mapId))
    continue;


            const mapSceneInfo = await loadMap(this.gameInfo, dataFetcher, mapId);
const mapInstance = new MapInstance(mapSceneInfo, world.blockFetcher, undefined, world);            await mapInstance.reloadBlocks(dataFetcher);

            const mapMatrix = mat4.create();
const origin = mapSceneInfo.getOrigin();

mat4.fromTranslation(
    mapMatrix,
    vec3.fromValues(
        (x - origin[0]) * 640,
        0,
        (y - origin[1]) * 640
    )
);
            mapInstance.setMatrix(mapMatrix);
            mapInstances.push(mapInstance);
        }

      
        class GlobalWorldRenderer extends WorldRenderer {

            protected override addWorldRenderInsts(
                device: GfxDevice,
                renderInstManager: GfxRenderInstManager,
                renderLists: SFARenderLists,
                sceneCtx: SceneRenderContext
            ) {
                const template = renderInstManager.pushTemplateRenderInst();
                fillSceneParamsDataOnTemplate(template, sceneCtx.viewerInput);

                const modelCtx: ModelRenderContext = {
                    sceneCtx,
                    showDevGeometry: false,
                    showMeshes: true,
                    ambienceIdx: 0,
                    outdoorAmbientColor: scratchColor0,
                    setupLights: () => {},
                };

                for (const map of mapInstances)
                    map.addRenderInsts(device, renderInstManager, renderLists, modelCtx);

                renderInstManager.popTemplateRenderInst();
            }
        }

        return new GlobalWorldRenderer(world, materialFactory);
    }
}
