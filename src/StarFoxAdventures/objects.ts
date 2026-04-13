import { mat4, vec3, quat } from 'gl-matrix';
import { DataFetcher } from '../DataFetcher.js';
import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import { GfxRenderInstManager } from "../gfx/render/GfxRenderInstManager.js";
import * as GX_Material from '../gx/gx_material.js';
import { colorNewFromRGBA } from '../Color.js';
import { computeViewMatrix } from '../Camera.js';
import { ViewerRenderInput } from '../viewer.js';
import { SFA_CLASSES } from './Objects/Classes.js';
import { SFAClass } from './Objects/SFAClass.js';
import { ModelInstance } from './models.js';
import { dataSubarray, readVec3, mat4FromSRT, readUint32, readUint16 } from './util.js';
import { Anim, Keyframe, applyAnimationToModel } from './animation.js';
import { World } from './world.js';
import { SceneRenderContext, SFARenderLists } from './render.js';
import { getMatrixTranslation } from '../MathHelpers.js';
import { LightType } from './WorldLights.js';

const scratchColor0 = colorNewFromRGBA(1, 1, 1, 1);
const scratchVec0 = vec3.create();
const scratchVec1 = vec3.create();
const scratchMtx0 = mat4.create();
const scratchMtx1 = mat4.create();
const __dp_paramNeed = new Map<string, number>();  
const __dp_oobWarned = new Set<string>();         
let __dp_padLogCount = 0;
const __dp_PAD_LOG_LIMIT = 50;                    
let __dp_oobLogCount = 0;
const __dp_OOB_LOG_LIMIT = 50;                    

function __dpAlign4(n: number): number { return (n + 3) & ~3; }

function __dpPadParams(dv: DataView, want: number, tag: string): DataView {
    if (dv.byteLength >= want) return dv;
    const wantA = __dpAlign4(want);

    const buf = new ArrayBuffer(wantA);
    new Uint8Array(buf).set(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
    const out = new DataView(buf);

   // const k = `${tag}|PAD|0x${dv.byteLength.toString(16)}->0x${wantA.toString(16)}`;
 //   if (!__dp_oobWarned.has(k) && __dp_padLogCount < __dp_PAD_LOG_LIMIT) {
  //      __dp_oobWarned.add(k);
  //      __dp_padLogCount++;
  //      console.warn(`[DP_OBJ_PAD] ${tag} 0x${dv.byteLength.toString(16)} -> 0x${wantA.toString(16)}`);
  //      if (__dp_padLogCount === __dp_PAD_LOG_LIMIT)
  //          console.warn(`[DP_OBJ_PAD] (pad log limit hit: further PAD logs suppressed)`);
  //  }

    return out;
}

function __dpNormalizeObjParams(typeNum: number, classNum: number, objParams: DataView): DataView {
    const tag = `type=${typeNum} class=${classNum}`;
    let want = 0x40; 

    const learned = __dp_paramNeed.get(tag) ?? 0;
    if (learned > want) want = learned;
    const padded = __dpPadParams(objParams, want, tag);
        return padded; 
}

function padObjectParams(dv: DataView, tag: string): DataView {
    const want = Math.max(
        CommonObjectParams_SIZE,
        (((dv.byteLength + 3) & ~3) + 4) >>> 0
    );

    if (dv.byteLength >= want)
        return dv;

    const src = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    const dst = new Uint8Array(want);
    dst.set(src);

const k = `${tag}|${dv.byteLength.toString(16)}->${want.toString(16)}`;
if (!__dp_oobWarned.has(k)) { 
    __dp_oobWarned.add(k);
    console.warn(`[DP_OBJ_PAD] ${tag} 0x${dv.byteLength.toString(16)} -> 0x${want.toString(16)}`);
}    return new DataView(dst.buffer);
}

export interface ObjectUpdateContext {
    viewerInput: ViewerRenderInput;
}

export const CommonObjectParams_SIZE = 0x18;
interface CommonObjectParams {
    objType: number;
    ambienceValue: number;
    layerValues: number[/* 2 */];
    position: vec3;
    id: number;
}

function parseCommonObjectParams(objParams: DataView): CommonObjectParams {
    return {
        objType: objParams.getUint16(0x0),
        ambienceValue: (objParams.getUint8(0x5) >>> 3) & 0x3,
        layerValues: [
            objParams.getUint8(0x3),
            objParams.getUint8(0x5),
        ],
        position: readVec3(objParams, 0x8),
        id: objParams.getUint32(0x14),
    };
}

export class ObjectType {
    public name: string;
    public scale: number = 1.0;
    public objClass: number;
    public modelNums: number[] = [];
    public isDevObject: boolean = false;
    public adjustCullRadius: number = 0;
    public ambienceNum: number = 0;

constructor(public typeNum: number, private data: DataView, private useEarlyNameLayout: boolean) {
            this.scale = this.data.getFloat32(0x4);
        if (!Number.isFinite(this.scale) || this.scale <= 0 || this.scale > 10.0)
    this.scale = 1.0;
        this.objClass = this.data.getInt16(0x50);

        this.name = '';
       let offs = this.useEarlyNameLayout ? 0x58 : 0x91;
        let c;
        while ((c = this.data.getUint8(offs)) != 0) {
            this.name += String.fromCharCode(c);
            offs++;
        }

        // console.log(`object ${this.name} scale ${this.scale}`);

        const numModels = data.getUint8(0x55);
        const modelListOffs = data.getUint32(0x8);
        for (let i = 0; i < numModels; i++) {
            const modelNum = readUint32(data, modelListOffs, i);
            this.modelNums.push(modelNum);
        }

        const flags = data.getUint32(0x44);
        this.isDevObject = !!(flags & 1);
        if (this.objClass === 293) {
            // XXX: Object type "curve" is not marked as a dev object, but it should be treated as one.
            this.isDevObject = true;
        }
        this.adjustCullRadius = data.getUint8(0x73);

        this.ambienceNum = data.getUint8(0x8e);
    }
}

export interface ObjectRenderContext {
    sceneCtx: SceneRenderContext;
    showDevGeometry: boolean;
    setupLights: (lights: GX_Material.Light[], typeMask: LightType) => void;
}

export interface Light {
    position: vec3;
}

const OBJECT_RENDER_LAYER = 31; // FIXME: For some spawn flags, 7 is used.

export class ObjectInstance {
    public modelInst: ModelInstance | null = null;
    public parent: ObjectInstance | null = null;
    public commonObjectParams: CommonObjectParams;
    public position: vec3 = vec3.create();
    public yaw: number = 0;
    public pitch: number = 0;
    public roll: number = 0;
    public scale: number = 1.0;
    private srtMatrix: mat4 = mat4.create();
    private srtMatrixChild: mat4 = mat4.create();
    private srtDirty: boolean = true;
    public cullRadius: number = 10;
    private modelAnimNum: number | null = null;
    private anim: Anim | null = null;
    private modanim!: DataView;
    private ambienceIdx: number = 0;
    public animSpeed: number = 0.01;
    public internalClass?: SFAClass;

constructor(public world: World, public objType: ObjectType, public objParams: DataView, public posInMap: vec3) {
    this.scale = objType.scale;
    const objClass = this.objType.objClass;
    const typeNum = this.objType.typeNum;

    if (this.world.gameInfo.pathBase === 'StarFoxAdventuresDemo') {
        if (typeNum === 0x0593) // SnowTree4
            this.scale = 3.0;
         else if (typeNum === 0x05AB) 
        this.scale = 0.2;
             else if (typeNum === 0x03A4) 
        this.scale = 0.1;
                 else if (typeNum === 0x05AD) 
        this.scale = 0.1;
                     else if (typeNum === 0x01E2) 
        this.scale = 0.1;
                         else if (typeNum === 0x01E1) 
        this.scale = 3.0;
                             else if (typeNum === 0x0098) 
        this.scale = 3.0;
                                 else if (typeNum === 0x057E) 
        this.scale = 4.0;
                                     else if (typeNum === 0x058C) 
        this.scale = 1.0;
                                         else if (typeNum === 0x0587) 
        this.scale = 1.0;
                                             else if (typeNum === 0x0594) 
        this.scale = 3.0;

    }
    this.objParams = __dpNormalizeObjParams(typeNum, objClass, objParams);

    this.commonObjectParams = parseCommonObjectParams(this.objParams);

    if (this.commonObjectParams.ambienceValue !== 0)
        this.ambienceIdx = this.commonObjectParams.ambienceValue - 1;
    else
        this.ambienceIdx = objType.ambienceNum;

    if (this.ambienceIdx < 0 || this.ambienceIdx >= 3)
        this.ambienceIdx = 0;

    vec3.copy(this.position, this.commonObjectParams.position);

    this.setModelNum(0);

    const dpNoClasses = (this.world as any).dpNoSfaClasses === true;

    if (!dpNoClasses) {
        if (objClass in SFA_CLASSES) {
            try {
                // IMPORTANT: pass normalized params
                this.internalClass = new SFA_CLASSES[objClass](this, this.objParams);
            } catch (e) {
                console.warn(`[OBJ_CLASS_FAIL] type=${typeNum} class=${objClass} name="${this.objType.name}"`);
                console.error(e);
                this.internalClass = undefined;
            }
        }
    }

}

public mount() {
    if ((this.world as any).dpNoSfaClasses === true) return;
    if (this.internalClass !== undefined)
        this.internalClass.mount(this, this.world);
}

public unmount() {
    if ((this.world as any).dpNoSfaClasses === true) return;
    if (this.internalClass !== undefined)
        this.internalClass.unmount(this, this.world);
}

    public setParent(parent: ObjectInstance | null) {
        this.parent = parent;
        if (parent !== null)
            console.log(`attaching this object (${this.objType.name}) to parent ${parent?.objType.name}`);
    }

    private updateSRT(): mat4 {
        if (this.srtDirty) {
            mat4FromSRT(this.srtMatrix, this.scale, this.scale, this.scale,
                this.yaw, this.pitch, this.roll,
                this.position[0], this.position[1], this.position[2]);
            mat4FromSRT(this.srtMatrixChild, 1, 1, 1,
                this.yaw, this.pitch, this.roll,
                this.position[0], this.position[1], this.position[2]);
            this.srtDirty = false;
        }

        return this.srtMatrix;
    }

    public getLocalSRT(): mat4 {
        this.updateSRT();
        return this.srtMatrix;
    }

    public getSRTForChildren(): mat4 {
        this.updateSRT();
        return this.srtMatrixChild;
    }

    public getWorldSRT(out: mat4) {
        const localSrt = this.getLocalSRT();
        if (this.parent !== null)
            mat4.mul(out, this.parent.getSRTForChildren(), localSrt);
        else
            mat4.copy(out, localSrt);
    }

    public getType(): ObjectType {
        return this.objType;
    }

    public getClass(): number {
        return this.objType.objClass;
    }

    public getName(): string {
        return this.objType.name;
    }

    public getPosition(dst: vec3) {
        if (this.parent !== null) {
            this.parent.getPosition(dst);
            vec3.add(dst, dst, this.position);
        } else {
            vec3.copy(dst, this.position);
        }
    }

    public setPosition(pos: vec3) {
        vec3.copy(this.position, pos);
        this.srtDirty = true;
    }

 public setModelNum(num: number) {
        try {
            const modelNum = this.objType.modelNums[num];
                        if (modelNum === undefined) {
                this.modelInst = null;
                return;
            }
            const modelInst = this.world.resColl.modelFetcher.createModelInstance(modelNum);
            this.modelInst = modelInst;
            const amap = this.world.resColl.amapColl ? this.world.resColl.amapColl.getAmap(modelNum) : null;
            this.modanim = this.world.resColl.modanimColl ? this.world.resColl.modanimColl.getModanim(modelNum) : new DataView(new ArrayBuffer(0));
            
            if (amap && typeof modelInst.setAmap === 'function') {
                modelInst.setAmap(amap);
            }

            this.cullRadius = 10;
            if (this.modelInst.model.cullRadius > this.cullRadius)
                this.cullRadius = this.modelInst.model.cullRadius;
            if (this.objType.adjustCullRadius !== 0)
                this.cullRadius *= 10 * this.objType.adjustCullRadius / 255;

            if (this.world.resColl.animColl && this.modanim && this.modanim.byteLength > 0 && amap && amap.byteLength > 0)
                this.setModelAnimNum(0);
        } catch (e) {
          //  console.warn(`Failed to load model index ${num} for object ${this.objType.name} due to exception:`, e);
            this.modelInst = null;
        }
    }

    public setModelAnimNum(num: number) {
        this.modelAnimNum = num;
        const modanim = readUint16(this.modanim, 0, num);
        this.setAnim(this.world.resColl.animColl.getAnim(modanim));
    }

    public setAnim(anim: Anim | null) {
        this.anim = anim;
    }

    public isInLayer(layer: number): boolean {
        if (layer === 0)
            return true;
        else if (layer < 9)
            return ((this.commonObjectParams.layerValues[0] >>> (layer - 1)) & 1) === 0;
        else
            return ((this.commonObjectParams.layerValues[1] >>> (16 - layer)) & 1) === 0;
    }
    private curKeyframe: Keyframe | undefined = undefined;

public update(updateCtx: ObjectUpdateContext) {
    if ((this.world as any).dpNoSfaClasses === true) return;
    if (this.internalClass !== undefined)
        this.internalClass.update(this, updateCtx);
}

    private isFrustumCulled(viewerInput: ViewerRenderInput): boolean {
        const worldMtx = scratchMtx0;
        this.getWorldSRT(worldMtx);
        const worldPos = scratchVec0;
        getMatrixTranslation(worldPos, worldMtx);
        return !viewerInput.camera.frustum.containsSphere(worldPos, this.cullRadius * this.scale);
    }

    public addRenderInsts(device: GfxDevice, renderInstManager: GfxRenderInstManager, renderLists: SFARenderLists | null, objectCtx: ObjectRenderContext) {
        if (this.modelInst !== null && this.modelInst !== undefined && !this.isFrustumCulled(objectCtx.sceneCtx.viewerInput)) {
            // Update animation
            if (this.anim !== null && (!this.modelInst.model.hasFineSkinning || this.world.animController.enableFineSkinAnims)) {
                applyAnimationToModel(this.world.animController.animController.getTimeInFrames() * this.animSpeed, this.modelInst, this.anim, this.modelAnimNum!);
            }

            const worldMtx = scratchMtx0;
            this.getWorldSRT(worldMtx);
            const viewMtx = scratchMtx1;
            computeViewMatrix(viewMtx, objectCtx.sceneCtx.viewerInput.camera);
            const worldPos = scratchVec0;
            getMatrixTranslation(worldPos, worldMtx);
            const viewPos = scratchVec1;
            vec3.transformMat4(viewPos, worldPos, viewMtx);
            this.world.envfxMan.getAmbientColor(scratchColor0, this.ambienceIdx);
            
            // const debugCtx = getDebugOverlayCanvas2D();
            // drawWorldSpacePoint(debugCtx, objectCtx.sceneCtx.viewerInput.camera.clipFromWorldMatrix, worldPos);
            // drawWorldSpaceText(debugCtx, objectCtx.sceneCtx.viewerInput.camera.clipFromWorldMatrix, worldPos, this.objType.name + " (" + -viewPos[2] + ")");
            this.modelInst.addRenderInsts(device, renderInstManager, {
                ...objectCtx,
                showMeshes: true,
                ambienceIdx: this.ambienceIdx,
                outdoorAmbientColor: scratchColor0,
                object: this,
            }, renderLists, worldMtx, -viewPos[2], OBJECT_RENDER_LAYER);
        }
    }

    public destroy(device: GfxDevice) {
        this.modelInst?.destroy(device);
        this.modelInst = null;
    }
}

export class ObjectManager {
    private objectsTab!: DataView;
    private objectsBin!: DataView;
    private objindexBin!: DataView | null;
private objectTypes: ObjectType[] = [];

private constructor(
  private world: World,
  private useEarlyObjects: boolean,
  private useEarlyNameLayout: boolean,
) {

}

    private async init(dataFetcher: DataFetcher) {
        const pathBase = this.world.gameInfo.pathBase;
        const [objectsTab, objectsBin, objindexBin] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/OBJECTS.tab`),
            dataFetcher.fetchData(`${pathBase}/OBJECTS.bin`),
            !this.useEarlyObjects ? dataFetcher.fetchData(`${pathBase}/OBJINDEX.bin`) : null,
        ]);
        this.objectsTab = objectsTab.createDataView();
        this.objectsBin = objectsBin.createDataView();
        this.objindexBin = !this.useEarlyObjects ? objindexBin!.createDataView() : null;
    }

public static async create(
  world: World,
  dataFetcher: DataFetcher,
  useEarlyObjects: boolean,
  useEarlyNameLayout: boolean = useEarlyObjects,
): Promise<ObjectManager> {

  const self = new ObjectManager(world, useEarlyObjects, useEarlyNameLayout);

  await self.init(dataFetcher);

  return self;

}

public getObjectType(typeNum: number, skipObjindex: boolean = false): ObjectType {
        if (this.objindexBin && !skipObjindex) {
            typeNum = readUint16(this.objindexBin, 0, typeNum);
        }

        if (this.objectTypes[typeNum] === undefined) {
            const offs = readUint32(this.objectsTab, 0, typeNum);
const objType = new ObjectType(typeNum, dataSubarray(this.objectsBin, offs), this.useEarlyNameLayout);
            this.objectTypes[typeNum] = objType;
        }

        return this.objectTypes[typeNum];
    }

public createObjectInstance(typeNum: number, objParams: DataView, posInMap: vec3, skipObjindex: boolean = false) {
    const objType = this.getObjectType(typeNum, skipObjindex);

    try {
        const objInst = new ObjectInstance(this.world, objType, objParams, posInMap);
        return objInst;
    } catch (e) {
      //  console.warn(`[OBJ_SPAWN_FAIL] type=${typeNum} class=${objType.objClass} name="${objType.name}" paramsLen=0x${objParams.byteLength.toString(16)}`);
        console.error(e);
        const dummy: any = {
            world: this.world,
            objType,
            objParams,
            posInMap,
            modelInst: null,
            internalClass: undefined,
            mount() {},
            unmount() {},
            update() {},
            addRenderInsts() {},
            destroy() {},
            getType() { return objType; },
            getClass() { return objType.objClass; },
            getName() { return objType.name; },
        };
        return dummy as ObjectInstance;
    }
}
}