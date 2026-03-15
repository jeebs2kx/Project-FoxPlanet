import { mat4, quat, vec3 } from 'gl-matrix';
import { computeModelMatrixSRT, lerp, lerpAngle } from '../MathHelpers.js';
import AnimationController from '../AnimationController.js';
import { ViewerRenderInput } from '../viewer.js';
import { DataFetcher } from '../DataFetcher.js';
import { nArray } from '../util.js';
import ArrayBufferSlice from '../ArrayBufferSlice.js';
import { GameInfo } from './scenes.js';
import { dataSubarray, interpS16, signExtend, angle16ToRads, HighBitReader, readUint32, readUint16 } from './util.js';
import { ModelInstance } from './models.js';

export class SFAAnimationController {
    public animController: AnimationController = new AnimationController(60);
    public envAnimValue0: number = 0;
    public envAnimValue1: number = 0;
    public enableFineSkinAnims: boolean = true;

    public update(viewerInput: ViewerRenderInput) {
        this.animController.setTimeFromViewerInput(viewerInput);
        this.envAnimValue0 = (0.0084 * this.animController.getTimeInFrames()) % 256;
        this.envAnimValue1 = (0.003 * this.animController.getTimeInFrames()) % 256;
    }
}
async function fetchDataCaseFallback(
    dataFetcher: DataFetcher,
    upperPath: string,
    lowerPath: string,
    allow404: boolean = false,
): Promise<ArrayBufferSlice | null> {
    const upper = await dataFetcher.fetchData(upperPath, { allow404: true }).catch(() => null);
    if (upper && upper.byteLength > 0)
        return upper;

    const lower = await dataFetcher.fetchData(lowerPath, { allow404: true }).catch(() => null);
    if (lower && lower.byteLength > 0)
        return lower;

    if (allow404)
        return null;

    return null;
}
interface AnimCurve {
}

export class AnimCurvFile {
    private animcurvTab: DataView;
    private animcurvBin: DataView;

    private constructor() {
    }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, subdir: string): Promise<AnimCurvFile> {
        const self = new AnimCurvFile();

        const pathBase = gameInfo.pathBase;
        const [animcurvTab, animcurvBin] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/${subdir}/ANIMCURV.tab`),
            dataFetcher.fetchData(`${pathBase}/${subdir}/ANIMCURV.bin`),
        ]);
        self.animcurvTab = animcurvTab.createDataView();
        self.animcurvBin = animcurvBin.createDataView();

        return self;
    }

    public getAnimCurve(num: number): AnimCurve {
        const offs = readUint32(this.animcurvTab, 0, num) & 0x7fffffff;
        const nextOffs = readUint32(this.animcurvTab, 0, num + 1) & 0x7fffffff;
        const byteLength = nextOffs - offs;

        const data = dataSubarray(this.animcurvBin, offs, byteLength);

        return {};
    }
}

interface Axis {
    translation: number;
    rotation: number;
    scale: number;
}

function createAxis(): Axis {
    return { translation: 0, rotation: 0, scale: 1 };
}

const NUM_AXES = 3;
interface Pose {
    axes: Axis[];
}

function createPose(): Pose {
    return { axes: nArray(NUM_AXES, () => createAxis()) };
}

export interface Keyframe {
    poses: Pose[];
}

function createKeyframe(numPoses: number): Keyframe {
    return { poses: nArray(numPoses, () => createPose()) };
}

export interface Anim {
    keyframes: Keyframe[];
    speed: number;
    times: number[];
}

export class AnimFile {
    private tab: DataView;
    private bin: DataView;

    private constructor() {
    }

public static async create(dataFetcher: DataFetcher, path: string, allowMissing: boolean = false): Promise<AnimFile | null> {
    const [tab, bin] = await Promise.all([
        fetchDataCaseFallback(dataFetcher, `${path}.TAB`, `${path}.tab`, allowMissing),
        fetchDataCaseFallback(dataFetcher, `${path}.BIN`, `${path}.bin`, allowMissing),
    ]);

    if (!tab || !bin || tab.byteLength === 0 || bin.byteLength === 0) {
        return null;
    }

    const self = new AnimFile();
    self.tab = tab.createDataView();
    self.bin = bin.createDataView();

    return self;
}

    public hasAnim(num: number): boolean {
        if (num < 0 || (num + 1) * 4 > this.tab.byteLength) {
            return false;
        }
        
        const val = this.tab.getUint32(num * 4);
        const nextVal = this.tab.getUint32((num + 1) * 4);
        
        const isSFA = (val & 0xFF000000) === 0x10000000;
        const offs = isSFA ? (val & 0x0FFFFFFF) : val;
        const nextOffs = isSFA ? (nextVal & 0x0FFFFFFF) : nextVal;
        
        return (nextOffs - offs) > 0;
    }

    public getAnim(num: number): Anim {
        const val = this.tab.getUint32(num * 4);
        const nextVal = this.tab.getUint32((num + 1) * 4);
        
        const isSFA = (val & 0xFF000000) === 0x10000000;
        const offs = isSFA ? (val & 0x0FFFFFFF) : val;
        const nextOffs = isSFA ? (nextVal & 0x0FFFFFFF) : nextVal;
        
        const byteLength = nextOffs - offs;
        const data = dataSubarray(this.bin, offs, byteLength);

        const HEADER_SIZE = 0xa;
        const header = {
            keyframesOffset: data.getUint16(0x2),
            timesOffset: data.getUint16(0x4),
            numBones: data.getUint8(0x6),
            numKeyframes: data.getUint8(0x7),
            keyframeStride: data.getUint8(0x8),
        };

        function loadKeyframe(kfNum: number): Keyframe {
            let cmdOffs = HEADER_SIZE;
            let kfOffs = header.keyframesOffset + kfNum * header.keyframeStride;
            const kfReader = new HighBitReader(data, kfOffs);

            function getNextCmd(): number {
                const result = data.getUint16(cmdOffs);
                cmdOffs += 2;
                return result;
            }

            function loadAxis(): Axis {
                const result: Axis = { translation: 0, rotation: 0, scale: 1 };

                let cmd = getNextCmd();

                result.rotation = interpS16(cmd & 0xfff0);

                const numAngleBits = cmd & 0xf;
                if (numAngleBits !== 0) {
                    const value = kfReader.get(numAngleBits);
                    result.rotation += signExtend(value, 14) * 4;
                }

                result.rotation = angle16ToRads(result.rotation);

                if (cmd & 0x10) {
                    cmd = getNextCmd();

                    let hasScale = !!(cmd & 0x10);
                    let hasTranslation = true;

                    if (hasScale) {
                        result.scale = cmd & 0xffc0;

                        const numScaleBits = cmd & 0xf;
                        if (numScaleBits !== 0) {
                            const value = kfReader.get(numScaleBits);
                            result.scale += signExtend(value, 16) * 2;
                        }

                        result.scale = (result.scale & 0xffff) / 1024;

                        hasTranslation = !!(cmd & 0x20);
                        if (hasTranslation)
                            cmd = getNextCmd();
                    }
                    
                    if (hasTranslation) {
                        result.translation = interpS16(cmd & 0xfff0);

                        const numTransBits = cmd & 0xf;
                        if (numTransBits !== 0)
                            result.translation += kfReader.get(numTransBits);

                        result.translation = interpS16(result.translation) / 512;
                    }
                }

                return result;
            }

            function loadPose(): Pose {
                const result: Pose = { axes: [
                    { translation: 0, rotation: 0, scale: 1 },
                    { translation: 0, rotation: 0, scale: 1 },
                    { translation: 0, rotation: 0, scale: 1 }
                ]};

                for (let i = 0; i < 3; i++)
                    result.axes[i] = loadAxis();

                return result;
            }

            const result: Keyframe = { poses: [] };

            for (let i = 0; i < header.numBones; i++) {
                result.poses[i] = loadPose();
            }

            return result;
        }

        const keyframes: Keyframe[] = [];
        for (let i = 0; i < header.numKeyframes; i++) {
            const keyframe = loadKeyframe(i);
            keyframes.push(keyframe);
        }

        let speed = 1;
        if (header.timesOffset !== 0) {
            let timesOffs = header.timesOffset;

            speed = data.getFloat32(timesOffs);
            timesOffs += 0x4;
            const numTimes = data.getUint16(timesOffs);
            timesOffs += 0x2;
            for (let i = 0; i < numTimes; i++) {
                timesOffs += 0x2;
            }
        }

        return { keyframes, speed, times: [] };
    }
}

export function interpolateAxes(axis0: Axis, axis1: Axis, ratio: number, reuse?: Axis): Axis {
    const result = reuse !== undefined ? reuse : createAxis();

    result.translation = lerp(axis0.translation, axis1.translation, ratio);
    result.rotation = lerpAngle(axis0.rotation, axis1.rotation, ratio); 
    result.scale = lerp(axis0.scale, axis1.scale, ratio);

    return result;
}

export function interpolatePoses(pose0: Pose, pose1: Pose, ratio: number, reuse?: Pose): Pose {
    const result: Pose = reuse !== undefined ? reuse : createPose();

    for (let i = 0; i < NUM_AXES; i++) {
        result.axes[i] = interpolateAxes(pose0.axes[i], pose1.axes[i], ratio, result.axes[i]);
    }

    return result;
}

// Applies rotations in the order: X then Y then Z.
export function getLocalTransformForPose(dst: mat4, pose: Pose) {
    computeModelMatrixSRT(dst,
        pose.axes[0].scale, pose.axes[1].scale, pose.axes[2].scale,
        pose.axes[0].rotation, pose.axes[1].rotation, pose.axes[2].rotation,
        pose.axes[0].translation, pose.axes[1].translation, pose.axes[2].translation);
}

export function interpolateKeyframes(kf0: Keyframe, kf1: Keyframe, ratio: number, reuse?: Keyframe): Keyframe {
    const numPoses = Math.min(kf0.poses.length, kf1.poses.length);
    const result: Keyframe = reuse !== undefined ? reuse : createKeyframe(numPoses);

    for (let i = 0; i < numPoses; i++)
        result.poses[i] = interpolatePoses(kf0.poses[i], kf1.poses[i], ratio, result.poses[i]);

    return result;
}

const scratchMtx = mat4.create();

export function applyPosesToModel(poses: Keyframe, modelInst: ModelInstance, amap: DataView | null) {
    modelInst.resetPose();

    for (let i = 0; i < modelInst.model.joints.length; i++) {
        let poseNum = -1;

        if (amap && i < amap.byteLength) {
            const mapped = amap.getInt8(i);
            if (mapped >= 0 && mapped < poses.poses.length) {
                poseNum = mapped;
            }
        } else if (!amap && i < poses.poses.length) {
            // SFA Fallback
            poseNum = i; 
        }

        if (poseNum >= 0 && poseNum < poses.poses.length) {
            const pose = poses.poses[poseNum];
            getLocalTransformForPose(scratchMtx, pose);
            modelInst.setJointPose(i, scratchMtx);
        }
    }
}

export function applyAnimationToModel(time: number, modelInst: ModelInstance, anim: Anim, animNum: number) {
    if (!anim || !anim.keyframes || anim.keyframes.length === 0 || modelInst.model.joints.length === 0) {
        modelInst.resetPose();
        return;
    }

    const keyframeCount = anim.keyframes.length;
    const amap = modelInst.getAmap(animNum);

    const keyframeTime = (time * keyframeCount) % keyframeCount;

    const kf0Num = Math.floor(keyframeTime);
    let kf1Num = kf0Num + 1;
    if (kf1Num >= keyframeCount)
        kf1Num = 0;

    const keyframe0 = anim.keyframes[kf0Num];
    const keyframe1 = anim.keyframes[kf1Num];
    const ratio = keyframeTime - kf0Num;

    modelInst.poses = interpolateKeyframes(keyframe0, keyframe1, ratio, modelInst.poses);
    applyPosesToModel(modelInst.poses, modelInst, amap);
}


export class AmapCollection {
    public amapTab: DataView;
    public amapBin: DataView;

    private constructor() {
    }

public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher): Promise<AmapCollection> {
    const self = new AmapCollection();

    const pathBase = gameInfo.pathBase;
    const [amapTab, amapBin] = await Promise.all([
        fetchDataCaseFallback(dataFetcher, `${pathBase}/AMAP.TAB`, `${pathBase}/AMAP.tab`),
        fetchDataCaseFallback(dataFetcher, `${pathBase}/AMAP.BIN`, `${pathBase}/AMAP.bin`),
    ]);

    if (!amapTab || !amapBin) {
        throw new Error(`Missing AMAP files for ${pathBase}`);
    }

    self.amapTab = amapTab.createDataView();
    self.amapBin = amapBin.createDataView();

    return self;
}

    public getAmap(modelNum: number): DataView {
        const offs = readUint32(this.amapTab, 0, modelNum);
        const nextOffs = readUint32(this.amapTab, 0, modelNum + 1);
        return dataSubarray(this.amapBin, offs, nextOffs - offs);
    }
}

export class ModanimCollection {
    public modanimTab: DataView;
    public modanimBin: DataView;

    private constructor() {
    }

public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher): Promise<ModanimCollection> {
    const self = new ModanimCollection();

    const pathBase = gameInfo.pathBase;
    const [tab, bin] = await Promise.all([
        fetchDataCaseFallback(dataFetcher, `${pathBase}/MODANIM.TAB`, `${pathBase}/MODANIM.tab`),
        fetchDataCaseFallback(dataFetcher, `${pathBase}/MODANIM.BIN`, `${pathBase}/MODANIM.bin`),
    ]);

    if (!tab || !bin) {
        throw new Error(`Missing MODANIM files for ${pathBase}`);
    }

    self.modanimTab = tab.createDataView();
    self.modanimBin = bin.createDataView();

    return self;
}

    public getModanim(modelNum: number): DataView {
        const offs = readUint16(this.modanimTab, 0, modelNum);
        const nextOffs = readUint16(this.modanimTab, 0, modelNum + 1);
        return dataSubarray(this.modanimBin, offs, nextOffs - offs);
    }
}

export class AnimCollection {
    private animFiles: AnimFile[] = [];
    private preanimFile: AnimFile | null = null; 

    private constructor() {
    }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, subdirs: string[] | string): Promise<AnimCollection> {
        const self = new AnimCollection();
        const pathBase = gameInfo.pathBase;

        // FIX: Request PREANIM but explicitly allow missing 404s
        self.preanimFile = await AnimFile.create(dataFetcher, `${pathBase}/PREANIM`, true);
        if (!self.preanimFile) {
            console.warn(`[AnimCollection] PREANIM not found. Safely skipping.`);
        }

        if (typeof subdirs === 'string') {
            const file = await AnimFile.create(dataFetcher, `${pathBase}/${subdirs}/ANIM`, true);
            if (file) self.animFiles.push(file);
        } else {
            const files = await Promise.all(subdirs.map(subdir =>
                AnimFile.create(dataFetcher, `${pathBase}/${subdir}/ANIM`, true)
            ));
            // Filter out any nulls from missing ANIM files
            self.animFiles = files.filter(f => f !== null) as AnimFile[];
        }

        return self;
    }

    public getAnim(num: number): Anim {
        if (this.preanimFile !== null && this.preanimFile.hasAnim(num)) {
            return this.preanimFile.getAnim(num);
        }

        for (const file of this.animFiles) {
            if (file.hasAnim(num)) {
                return file.getAnim(num);
            }
        }

        return { keyframes: [], speed: 1, times: [] };
    }
}