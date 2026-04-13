import * as Viewer from '../viewer.js';
import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import { SceneContext } from '../SceneBase.js';
import { SFAAnimationController, AmapCollection, ModanimCollection, AnimFile, AnimCollection, applyAnimationToModel } from './animation.js';
import { MaterialFactory } from './materials.js';
import { SFARenderer, SceneRenderContext, SFARenderLists } from './render.js';
import { GameInfo } from './scenes.js';
import { GfxRenderInstManager } from "../gfx/render/GfxRenderInstManager.js";
import { fillSceneParamsDataOnTemplate } from '../gx/gx_render.js';
import { White } from '../Color.js';
import * as UI from '../ui.js';
import { DataFetcher } from '../DataFetcher.js';
import { ModelInstance, ModelRenderContext } from './models.js';
import { mat4, vec3 } from 'gl-matrix';
import { SFATextureFetcher } from './textures.js';
import { loadModel, ModelVersion } from './modelloader.js';
import { computeModelMatrixSRT } from '../MathHelpers.js';

const BIN_TO_RAD = Math.PI / 32768.0;
const EV_PLAY_ANIM = 0x02;
const EV_SETOBJ = 0x03; 
const EV_TIMING_SYNC = 0x00; 
const EV_SUBEVENT = 0x0B; 

interface Keyframe {
    time: number;
    value: number;
    interp: number;
}

interface SequenceActorModel {
    inst: ModelInstance;
    modelNum: number;
    modanim: DataView | null;
    modAnimBankBases: number[];
}

interface Actor {
    insts: SequenceActorModel[];
    matrix: mat4;
    curve: { channels: Map<number, Keyframe[]>, animEvents: any[] };
    objScale: number;
    isCamera: boolean;
}

function dpExtractModelNums(objBin: DataView, startOffs: number, defSize: number): number[] {
    if (defSize < 0x58) return [];
    const count = objBin.getUint8(startOffs + 0x54); 
    const listOffs = objBin.getUint32(startOffs + 0x08); 
    if (listOffs === 0xFFFFFFFF || listOffs >= defSize) return [];
    const out: number[] = [];
    const base = startOffs + listOffs;
    for (let i = 0; i < count; i++) {
        const v = objBin.getUint32(base + i * 4);
        if (v < 0x4000) out.push(v | 0);
    }
    return out;
}

function dpExtractObjectScale(objBin: DataView, startOffs: number, defSize: number): number {
    if (defSize < 0x08)
        return 1.0;

    const scale = objBin.getFloat32(startOffs + 0x04);
    if (!Number.isFinite(scale) || scale <= 0.0 || scale > 10.0)
        return 1.0;

    return scale;
}

function buildModanimBankBases(modanim: DataView | null): number[] {
    const bases: number[] = [0];

    if (modanim === null || modanim.byteLength === 0)
        return bases;

    const count = (modanim.byteLength / 2) | 0;
    for (let i = 0; i < count; i++) {
        if (modanim.getUint16(i * 2) === 0xFFFF)
            bases.push(i + 1);
    }

    return bases;
}

function resolveSequenceAnimRef(model: SequenceActorModel, activeParam: number): { animId: number, animNum: number } | null {
    if (model.modanim === null || model.modanim.byteLength === 0)
        return null;

    const targetBank = (activeParam >> 8) & 0x0F;
    const targetIndex = activeParam & 0xFF;

    if (targetBank < 0 || targetBank >= model.modAnimBankBases.length)
        return null;

    const animNum = model.modAnimBankBases[targetBank] + targetIndex;
    const animOffs = animNum * 2;

    if (animOffs + 2 > model.modanim.byteLength)
        return null;

    const animId = model.modanim.getUint16(animOffs) & 0x7FFF;
    if (animId <= 0)
        return null;

    return { animId, animNum };
}

async function decompressDPModel(modelId: number, tabView: DataView, binArray: Uint8Array): Promise<DataView | null> {
    const offset = tabView.getUint32(modelId * 4);
    if (offset === 0xFFFFFFFF || offset === 0) return null;
    let nextOffset = binArray.length;
    for (let j = modelId + 1; j < tabView.byteLength / 4; j++) {
        const candidate = tabView.getUint32(j * 4);
        if (candidate !== 0xFFFFFFFF && candidate !== 0) { nextOffset = candidate; break; }
    }
    const compressedChunk = binArray.subarray(offset + 13, nextOffset);
    let end = compressedChunk.length;
    while (end > 0 && compressedChunk[end - 1] === 0) end--;
    const safeChunk = new Uint8Array(compressedChunk.subarray(0, end));
    try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(safeChunk as any).catch(()=>{}); writer.close().catch(()=>{});
        const reader = ds.readable.getReader();
        const chunks: Uint8Array[] = [];
        let totalLength = 0;
        try { while (true) { const { value, done } = await reader.read(); if (done) break; if (value) { chunks.push(value); totalLength += value.length; } } } catch (e) {}
        if (totalLength === 0) return null;
        const out = new Uint8Array(totalLength);
        let ptr = 0; for (const c of chunks) { out.set(c, ptr); ptr += c.length; }
        return new DataView(out.buffer);
    } catch (e) { return null; }
}

export class SequenceRenderer extends SFARenderer {
    private actors: Actor[] = [];
    private currentTime: number = 0;
    private animColl: AnimCollection | null = null;
private currentSequenceId = 0;
private isPlaying = true;
private sequenceEndFrame = 1;
private timeSlider: HTMLInputElement | null = null;
private timeLabel: HTMLElement | null = null;
private actorStatsLabel: HTMLElement | null = null;
    public async create(sequenceId: number, gameInfo: GameInfo, dataFetcher: DataFetcher): Promise<Viewer.SceneGfx> {
        const pathBase = gameInfo.pathBase;
        this.currentSequenceId = sequenceId;
this.currentTime = 0;
        const texFetcher = await SFATextureFetcher.create(gameInfo, dataFetcher, false);
        texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);

        const [amapColl, modanimColl, tabBuf, binBuf, o2cBuf, cTabBuf, cBinBuf, modTabBuf, modBinBuf, objIdxBuf, objTabBuf, objBinBuf] = await Promise.all([
            AmapCollection.create(gameInfo, dataFetcher),
            ModanimCollection.create(gameInfo, dataFetcher),
            dataFetcher.fetchData(`${pathBase}/OBJSEQ.tab`),
            dataFetcher.fetchData(`${pathBase}/OBJSEQ.bin`),
            dataFetcher.fetchData(`${pathBase}/OBJSEQ2CURVE.tab`),
            dataFetcher.fetchData(`${pathBase}/ANIMCURVES.tab`),
            dataFetcher.fetchData(`${pathBase}/ANIMCURVES.bin`),
            dataFetcher.fetchData(`${pathBase}/MODELS.tab`),
            dataFetcher.fetchData(`${pathBase}/MODELS.bin`),
            dataFetcher.fetchData(`${pathBase}/OBJINDEX.bin`),
            dataFetcher.fetchData(`${pathBase}/OBJECTS.tab`),
            dataFetcher.fetchData(`${pathBase}/OBJECTS.bin`),
        ]);

        try { this.animColl = await AnimCollection.create(gameInfo, dataFetcher, ['']); } catch (e) {}

        const seqTab = tabBuf.createDataView();
        const seqBin = binBuf.createDataView();
        const startOffs = seqTab.getUint16(sequenceId * 2) * 8;
        const endOffs = seqTab.getUint16((sequenceId + 1) * 2) * 8;
        
        const curveBaseIdx = o2cBuf.createDataView().getUint16(sequenceId * 2);
        const cTabView = cTabBuf.createDataView();
        const cBinView = cBinBuf.createDataView();
        const modTab = modTabBuf.createDataView();
        const modBin = new Uint8Array(modBinBuf.arrayBuffer);
        const objIdx = objIdxBuf.createDataView();
        const objTab = objTabBuf.createDataView();
        const objBin = objBinBuf.createDataView();

        let actorIdx = 0;
        for (let offset = startOffs; offset < endOffs; offset += 8) {
            const scnId = seqBin.getUint16(offset + 0x6);
            const actorCurve = { channels: new Map<number, Keyframe[]>, animEvents: [] as any[] };
            const cTabOffs = (curveBaseIdx + actorIdx) * 8;
            
if (cTabOffs + 8 <= cTabView.byteLength) {
                const cSize = cTabView.getUint16(cTabOffs + 0x0);
                const cEvCount = cTabView.getUint16(cTabOffs + 0x2);
                const cBinOffs = cTabView.getUint32(cTabOffs + 0x4);

let runningTime = 0;

for (let e = 0; e < cEvCount; e++) {
    const evOffs = cBinOffs + (e * 4);
    const type = cBinView.getUint8(evOffs + 0x0);
    const delay = cBinView.getUint8(evOffs + 0x1);
    const params = cBinView.getUint16(evOffs + 0x2);

    if (type === 0x00) {
        runningTime = params;
    }

    actorCurve.animEvents.push({ type, time: runningTime, params });

    if (type !== 0x00) {
        runningTime += delay;
    }

    if (type === 0x0B) {
        e++;
    }
}

const kfStart = cBinOffs + (cEvCount * 4);
for (let k = kfStart; k < cBinOffs + cSize; k += 8) {
    const chan = cBinView.getUint8(k + 0x5) & 0x1F;
    const keyTime = cBinView.getInt16(k + 0x6);

    if (!actorCurve.channels.has(chan))
        actorCurve.channels.set(chan, []);

    actorCurve.channels.get(chan)!.push({
        time: keyTime,
        value: cBinView.getFloat32(k + 0x0),
        interp: cBinView.getUint8(k + 0x4) & 0x03,
    });
}

for (const keys of actorCurve.channels.values()) {
    keys.sort((a, b) => a.time - b.time);
}
            
            }

           const actorObj: Actor = {
    insts: [],
    matrix: mat4.create(),
    curve: actorCurve,
    objScale: 1.0,
    isCamera: (scnId === 0xFFFE),
};

if (!actorObj.isCamera && scnId !== 0xFFFF) {
    try {
        const romId = objIdx.getUint16(scnId * 2);
        const oOffs = objTab.getUint32(romId * 4);
        const nextO = (romId + 1 < objTab.byteLength / 4) ? objTab.getUint32((romId + 1) * 4) : objBin.byteLength;
        const defSize = nextO - oOffs;

        actorObj.objScale = dpExtractObjectScale(objBin, oOffs, defSize);

        const models = dpExtractModelNums(objBin, oOffs, defSize);
        for (const mId of models) {
            const mData = await decompressDPModel(mId, modTab, modBin);
            if (!mData)
                continue;

            const inst = new ModelInstance(loadModel(mData, texFetcher, this.materialFactory, ModelVersion.DinosaurPlanet));

            const amap = amapColl.getAmap(mId);
            if (amap)
                inst.setAmap(amap);

            const modanim = modanimColl.getModanim(mId);

            actorObj.insts.push({
                inst,
                modelNum: mId,
                modanim,
                modAnimBankBases: buildModanimBankBases(modanim),
            });
        }
    } catch (e) {}
}


            this.actors.push(actorObj);
            actorIdx++;
        }
let maxFrame = 0;
for (const actor of this.actors) {
  for (const ev of actor.curve.animEvents)
    maxFrame = Math.max(maxFrame, ev.time);

  for (const keys of actor.curve.channels.values()) {
    if (keys.length > 0)
      maxFrame = Math.max(maxFrame, keys[keys.length - 1].time);
  }
}

this.sequenceEndFrame = Math.max(1, Math.ceil(maxFrame) + 1);
this.syncSequenceUI();

        return this;
    }
private syncSequenceUI(): void {
  const frame = Math.floor(this.currentTime);

  if (this.timeLabel !== null) {
    this.timeLabel.textContent =
      `Sequence ${this.currentSequenceId} | Frame ${frame} / ${this.sequenceEndFrame}`;
  }

  if (this.timeSlider !== null) {
    this.timeSlider.max = `${this.sequenceEndFrame}`;
    if (document.activeElement !== this.timeSlider)
      this.timeSlider.value = `${Math.min(frame, this.sequenceEndFrame)}`;
  }

  if (this.actorStatsLabel !== null) {
const modelActorCount = this.actors.filter((a) => a.insts.length > 0).length;
    const cameraActorCount = this.actors.filter((a) => a.isCamera).length;
    this.actorStatsLabel.textContent =
      `${this.actors.length} actors (${modelActorCount} model, ${cameraActorCount} camera)`;
  }
}

public createPanels(): UI.Panel[] {
  const panel = new UI.Panel();
  panel.setTitle(UI.SAND_CLOCK_ICON, 'Sequence Player');
  panel.elem.style.maxWidth = '360px';
  panel.elem.style.width = '360px';

  const help = document.createElement('div');
  help.style.whiteSpace = 'pre-wrap';
  help.style.marginBottom = '8px';
  help.textContent =
    'Existing DP sequence renderer with playback controls.\n' +
    'Pause, restart, or scrub through the loaded sequence.';
  panel.contents.appendChild(help);

  const buttonRow = document.createElement('div');
  buttonRow.style.display = 'flex';
  buttonRow.style.gap = '8px';
  buttonRow.style.marginBottom = '8px';

  const playPauseButton = document.createElement('button');
  playPauseButton.textContent = 'Pause';
  playPauseButton.onclick = () => {
    this.isPlaying = !this.isPlaying;
    playPauseButton.textContent = this.isPlaying ? 'Pause' : 'Play';
  };
  buttonRow.appendChild(playPauseButton);

  const restartButton = document.createElement('button');
  restartButton.textContent = 'Restart';
  restartButton.onclick = () => {
    this.currentTime = 0;
    this.syncSequenceUI();
  };
  buttonRow.appendChild(restartButton);

  panel.contents.appendChild(buttonRow);

  this.timeLabel = document.createElement('div');
  this.timeLabel.style.marginBottom = '8px';
  panel.contents.appendChild(this.timeLabel);

  this.timeSlider = document.createElement('input');
  this.timeSlider.type = 'range';
  this.timeSlider.min = '0';
  this.timeSlider.max = `${this.sequenceEndFrame}`;
  this.timeSlider.step = '1';
  this.timeSlider.style.width = '100%';
  this.timeSlider.oninput = () => {
    this.currentTime = Number(this.timeSlider!.value);
    this.isPlaying = false;
    playPauseButton.textContent = 'Play';
    this.syncSequenceUI();
  };
  panel.contents.appendChild(this.timeSlider);

  this.actorStatsLabel = document.createElement('div');
  this.actorStatsLabel.style.marginTop = '8px';
  this.actorStatsLabel.style.color = '#aaa';
  panel.contents.appendChild(this.actorStatsLabel);

  this.syncSequenceUI();
  return [panel];
}
    protected override update(viewerInput: Viewer.ViewerRenderInput) {
        super.update(viewerInput);
if (this.isPlaying) {
  const loopAt = Math.max(1, this.sequenceEndFrame);
  this.currentTime = (this.currentTime + (viewerInput.deltaTime / 1000) * 60) % loopAt;
}

this.syncSequenceUI();
        for (const actor of this.actors) {
    const x = this.sample(actor.curve, 13, this.currentTime);
    const y = this.sample(actor.curve, 12, this.currentTime);
    const z = this.sample(actor.curve, 11, this.currentTime);

    const rx = this.sample(actor.curve, 8, this.currentTime) * BIN_TO_RAD;
    const ry = this.sample(actor.curve, 7, this.currentTime) * BIN_TO_RAD;
    const rz = this.sample(actor.curve, 6, this.currentTime) * BIN_TO_RAD;

    if (actor.insts.length > 0) {
        let s = this.sample(actor.curve, 5, this.currentTime);
        if (s <= 0.0)
            s = 1.0;

        s *= actor.objScale;

        computeModelMatrixSRT(actor.matrix, s, s, s, rx, ry, rz, x, y, z);

        let activeParam = -1;
        let startTime = 0;

        for (const ev of actor.curve.animEvents) {
            if (ev.type === EV_PLAY_ANIM && ev.time <= this.currentTime) {
                activeParam = ev.params;
                startTime = ev.time;
            }
        }

        if (activeParam !== -1 && this.animColl) {
            for (const model of actor.insts) {
                const animRef = resolveSequenceAnimRef(model, activeParam);
                if (animRef === null)
                    continue;

                try {
                    const anim = this.animColl.getAnim(animRef.animId);
                    if (anim && anim.keyframes && anim.keyframes.length > 0) {
const elapsed = Math.max(0, this.currentTime - startTime);
const animSpeed = (Number.isFinite(anim.speed) && anim.speed > 0.0) ? anim.speed : 1.0;
const animTime = (elapsed * animSpeed) / Math.max(1, anim.keyframes.length);
applyAnimationToModel(animTime, model.inst, anim, animRef.animNum);
                    }
                } catch (e) {}
            }
        } else {
            for (const model of actor.insts)
                model.inst.resetPose();
        }
    }
}
}
private sample(curve: any, chan: number, time: number): number {
        const keys: Keyframe[] = curve.channels.get(chan);
        if (!keys || keys.length === 0) return (chan === 5) ? 1.0 : 0.0;
        if (time <= keys[0].time) return keys[0].value;
        if (time >= keys[keys.length - 1].time) return keys[keys.length - 1].value;
        for (let i = 0; i < keys.length - 1; i++) {
            const k0 = keys[i], k1 = keys[i + 1];
            if (time >= k0.time && time <= k1.time) {
                const t = (time - k0.time) / (k1.time - k0.time);
                if (k0.interp === 2) return k1.value;
                if (k0.interp === 0) return k0.value + (t * t * (3 - 2 * t)) * (k1.value - k0.value); 
                return k0.value + t * (k1.value - k0.value); 
            }
        }
        return 0;
    }

    protected override addWorldRenderInsts(device: GfxDevice, renderInstManager: GfxRenderInstManager, renderLists: SFARenderLists, sceneCtx: SceneRenderContext) {
        const template = renderInstManager.pushTemplateRenderInst();
        fillSceneParamsDataOnTemplate(template, sceneCtx.viewerInput);
        const modelCtx: ModelRenderContext = { sceneCtx, showDevGeometry: false, ambienceIdx: 0, showMeshes: true, outdoorAmbientColor: White, setupLights: () => {}, cullByAabb: false };
for (const actor of this.actors) {
    for (const model of actor.insts)
        model.inst.addRenderInsts(device, renderInstManager, modelCtx, renderLists, actor.matrix);
}        renderInstManager.popTemplateRenderInst();
    }
}

export class DPSequenceSceneDesc implements Viewer.SceneDesc {
    constructor(public sequenceId: number, public id: string, public name: string, private gameInfo: GameInfo) {}
    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        const renderer = new SequenceRenderer(context, new SFAAnimationController(), new MaterialFactory(device));
        await renderer.create(this.sequenceId, this.gameInfo, context.dataFetcher);
        return renderer;
    }
}