import { mat4, vec3 } from 'gl-matrix';
import * as UI from '../ui.js';
import * as Viewer from "../viewer.js";
import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import { GfxRenderInstManager } from "../gfx/render/GfxRenderInstManager.js";
import { SceneContext } from '../SceneBase.js';
import { White, colorNewCopy } from '../Color.js';
import { getDebugOverlayCanvas2D, drawWorldSpaceLine, drawWorldSpacePoint } from '../DebugJunk.js';
import { fillSceneParamsDataOnTemplate } from "../gx/gx_render.js";
import { Light, lightSetDistAttn, lightSetSpot } from '../gx/gx_material.js';
import { DataFetcher } from '../DataFetcher.js';
import { GameInfo, SFA_GAME_INFO, DP_GAME_INFO } from './scenes.js';
import { Anim, SFAAnimationController, AnimCollection, AmapCollection, ModanimCollection, applyAnimationToModel } from './animation.js';
import { SFARenderer, SceneRenderContext, SFARenderLists } from './render.js';
import { ModelFetcher, ModelInstance, ModelRenderContext } from './models.js';
import { MaterialFactory } from './materials.js';
import { dataSubarray, readUint16 } from './util.js';
import { TextureFetcher, SFATextureFetcher } from './textures.js';
import { ModelVersion, loadModel } from "./modelloader.js";
import { downloadBufferSlice } from '../DownloadUtils.js';
import ArrayBufferSlice from '../ArrayBufferSlice.js';

class ModelExhibitRenderer extends SFARenderer {
    private turntableEnabled = false;
    private turntableAngle = 0;
    private turntableSpeed = Math.PI / 8;

    private modelInst: ModelInstance | null | undefined = undefined;
    private modelNum = 1;
    private modelSelect: UI.TextEntry;

    private modanim: DataView | null = null;
    private amap: DataView | null = null;
    private generatedAmap: DataView | null = null;
    private anim: Anim | null = null;
    private modelAnimNum = 0;
    private animSelect: UI.TextEntry;

    private displayBones: boolean = false;
    private useGlobalAnimNum: boolean = false;
    private autogenAmap: boolean = false;

    private hasInitializedCamera: boolean = false;
private modelLoadGeneration = 0;
    private dpNormalize = true;
    private dpTargetMaxDim = 1000; 
private dpAnimsEnabled = false;
    private dpNormReady = false;
    private dpNormScale = 1.0;
    private dpNormCenter = vec3.create();
    private dpTmpNegCenter = vec3.create();

    constructor(
        private context: SceneContext,
        animController: SFAAnimationController,
        public override materialFactory: MaterialFactory,
        private texFetcher: TextureFetcher,
        private modelFetcher: ModelFetcher,
        private animColl: AnimCollection,
        private amapColl: AmapCollection,
        private modanimColl: ModanimCollection,
        private gameInfo: GameInfo,
        private modelVersion: ModelVersion
    ) {
        super(context, animController, materialFactory);
        (this.animController.animController as any).playbackEnabled = true;
        (this.animController.animController as any).playbackEnabled = true;
    }

    private dpResetNormalizeState(): void {
        this.dpNormReady = false;
        this.dpNormScale = 1.0;
        vec3.set(this.dpNormCenter, 0, 0, 0);
    }

    private dpComputeNormalizeFromCurrentModel(): boolean {
        if (this.modelVersion !== ModelVersion.DinosaurPlanet || !this.dpNormalize) return false;
        if (!this.modelInst) return false;

        const bbox = (this.modelInst.model as any).bbox;
        if (!bbox) return false;

        const cx = (bbox.minX + bbox.maxX) * 0.5;
        const cy = (bbox.minY + bbox.maxY) * 0.5;
        const cz = (bbox.minZ + bbox.maxZ) * 0.5;
        vec3.set(this.dpNormCenter, cx, cy, cz);

        const dx = (bbox.maxX - bbox.minX);
        const dy = (bbox.maxY - bbox.minY);
        const dz = (bbox.maxZ - bbox.minZ);
        const maxDim = Math.max(dx, dy, dz);

        if (!(maxDim > 0) || !Number.isFinite(maxDim)) return false;

        this.dpNormScale = this.dpTargetMaxDim / maxDim;

        this.dpNormReady = true;
        this.hasInitializedCamera = false;
        return true;
    }

    public createPanels(): UI.Panel[] {
        const panel = new UI.Panel();
        panel.setTitle(UI.SAND_CLOCK_ICON, 'Model Viewer');
        panel.elem.style.maxWidth = '300px';
        panel.elem.style.width = '300px';

        this.modelSelect = new UI.TextEntry();
        this.modelSelect.ontext = (s: string) => {
            const newNum = Number.parseInt(s);
            if (!Number.isNaN(newNum)) {
                this.destroyCurrentModelResources(this.context.device);
                this.modelNum = newNum;
                console.log(`Requested model change to: ${this.modelNum}`);
            }
        };

        const modelInputWrap = document.createElement('div');
        modelInputWrap.innerHTML = `<label>Model Number:</label>`;
        modelInputWrap.appendChild(this.modelSelect.elem);
        panel.contents.append(modelInputWrap);

        this.animSelect = new UI.TextEntry();
        this.animSelect.ontext = (s: string) => {
            const newNum = Number.parseInt(s);
            if (!Number.isNaN(newNum)) {
                this.modelAnimNum = newNum;
                this.anim = null;
                this.generatedAmap = null;
            }
        }
        const animInputWrap = document.createElement('div');
        animInputWrap.innerHTML = `<label>Animation Number:</label>`;
        animInputWrap.appendChild(this.animSelect.elem);
        panel.contents.append(animInputWrap);

        const modelButtonContainer = document.createElement('div');
        modelButtonContainer.style.display = 'flex';
        modelButtonContainer.style.gap = '8px';

        const prevModelButton = document.createElement('button');
        prevModelButton.textContent = 'Previous Valid Model';
        prevModelButton.onclick = async () => {
            prevModelButton.disabled = true;
            await this.destroyCurrentModelResources(this.context.device);
            await this.loadPreviousValidModel();
            prevModelButton.disabled = false;
        };

        const nextModelButton = document.createElement('button');
        nextModelButton.textContent = 'Next Valid Model';
        nextModelButton.onclick = async () => {
            nextModelButton.disabled = true;
            await this.destroyCurrentModelResources(this.context.device);
            await this.loadNextValidModel();
            nextModelButton.disabled = false;
        };

        modelButtonContainer.appendChild(prevModelButton);
        modelButtonContainer.appendChild(nextModelButton);
        panel.contents.append(modelButtonContainer);
        
if (this.modelVersion === ModelVersion.DinosaurPlanet) {
    const dpAnimToggle = new UI.Checkbox("Enable DP Animations", this.dpAnimsEnabled);
    dpAnimToggle.onchanged = () => {
        this.dpAnimsEnabled = dpAnimToggle.checked;
        if (!this.dpAnimsEnabled && this.modelInst) {
            this.modelInst.resetPose();
            this.anim = null;
        }
    };
    panel.contents.append(dpAnimToggle.elem);
}
        const spinBtn = document.createElement('button');
        spinBtn.textContent = 'Enable Turntable';
        spinBtn.onclick = () => {
            this.turntableEnabled = !this.turntableEnabled;
            spinBtn.textContent = this.turntableEnabled ? 'Disable Turntable' : 'Enable Turntable';
        };
        panel.contents.append(spinBtn);

        const speedWrap = document.createElement('div');
        const speedInput = document.createElement('input');
        speedInput.type = 'number';
        speedInput.step = '0.1';
        speedInput.value = this.turntableSpeed.toString();
        speedInput.style.width = '100px';
        speedWrap.innerHTML = `<label>Spin Speed (rad/s): </label>`;
        speedWrap.appendChild(speedInput);
        speedInput.onchange = () => {
            const v = Number.parseFloat(speedInput.value);
            if (!Number.isNaN(v)) this.turntableSpeed = v;
        };
        panel.contents.append(speedWrap);

        const animButtonContainer = document.createElement('div');
        animButtonContainer.style.display = 'flex';
        animButtonContainer.style.gap = '8px';

        const prevAnimButton = document.createElement('button');
        prevAnimButton.textContent = 'Previous Animation';
        prevAnimButton.onclick = async () => {
            prevAnimButton.disabled = true;
            await this.loadPreviousValidAnim();
            prevAnimButton.disabled = false;
        };

        const nextAnimButton = document.createElement('button');
        nextAnimButton.textContent = 'Next Animation';
        nextAnimButton.onclick = async () => {
            nextAnimButton.disabled = true;
            await this.loadNextValidAnim();
            nextAnimButton.disabled = false;
        };

        animButtonContainer.appendChild(prevAnimButton);
        animButtonContainer.appendChild(nextAnimButton);
        panel.contents.append(animButtonContainer);

        const bonesSelect = new UI.Checkbox("Display bones", false);
        bonesSelect.onchanged = () => {
            this.displayBones = bonesSelect.checked;
        };
        panel.contents.append(bonesSelect.elem);

        const tPoseCheckbox = new UI.Checkbox("Force T-Pose (Stop Animation)", false);
        tPoseCheckbox.onchanged = () => {
            const viewerAnimController = this.animController.animController as any;
            if (tPoseCheckbox.checked) {
                viewerAnimController.playbackEnabled = false;
                viewerAnimController.currentTimeInFrames = 0;
                if (this.modelInst) this.modelInst.resetPose();
                this.anim = null;
                this.modelAnimNum = 0;
                if (this.animSelect?.elem instanceof HTMLInputElement) {
                    this.animSelect.elem.value = this.modelAnimNum.toString();
                }
            } else {
                viewerAnimController.playbackEnabled = true;
            }
        };
        panel.contents.insertBefore(tPoseCheckbox.elem, bonesSelect.elem);

        const useGlobalAnimSelect = new UI.Checkbox("Use global animation number", false);
        useGlobalAnimSelect.onchanged = () => {
            this.useGlobalAnimNum = useGlobalAnimSelect.checked;
        };
        panel.contents.append(useGlobalAnimSelect.elem);

        const autogenAmapSelect = new UI.Checkbox("Autogenerate AMAP", false);
        autogenAmapSelect.onchanged = () => {
            this.autogenAmap = autogenAmapSelect.checked;
            this.generatedAmap = null;
        };
        panel.contents.append(autogenAmapSelect.elem);

        return [panel];
    }

private async destroyCurrentModelResources(device: GfxDevice) {
    console.log("Resetting current model state...");

    this.modelLoadGeneration++;
    this.modelInst = undefined;
    this.anim = null;
    this.modanim = null;
    this.amap = null;
    this.generatedAmap = null;
    this.hasInitializedCamera = false;

    this.dpResetNormalizeState();
}

    public downloadModel() {
        if (this.modelInst !== null && this.modelInst !== undefined) {
            downloadBufferSlice(
                `model_${this.modelNum}${this.modelInst.model.version === ModelVersion.Beta ? '_beta' : ''}.bin`,
                ArrayBufferSlice.fromView(this.modelInst.model.modelData)
            );
        }
    }

    private getGlobalAnimNum(modelAnimNum: number): number | undefined {
        if (!this.modanim) return undefined;
        if (modelAnimNum * 2 >= this.modanim.byteLength) return undefined;
        return readUint16(this.modanim, 0, modelAnimNum);
    }

    private getAmapForModelAnim(modelAnimNum: number): DataView | null {
        if (this.autogenAmap) {
            if (this.generatedAmap === null) {
                let generatedAmap = [0];
                let curCluster = [0];
                while (curCluster.length > 0) {
                    const prevCluster = curCluster;
                    curCluster = [];

                    if (!this.modelInst || !this.modelInst.model || !this.modelInst.model.joints) return null;

                    for (let i = 0; i < prevCluster.length; i++) {
                        for (let j = 0; j < this.modelInst.model.joints.length; j++) {
                            const joint = this.modelInst.model.joints[j];
                            if (joint.parent === prevCluster[i]) curCluster.push(j);
                        }
                    }
                    for (let i = 0; i < curCluster.length; i++) generatedAmap.push(curCluster[i]);
                }
                this.generatedAmap = new DataView(new Int8Array(generatedAmap).buffer);
            }
            return this.generatedAmap;
        } else {
            if (!this.amap || !this.modelInst || !this.modelInst.model || !this.modelInst.model.joints) return null;
            const stride = (((this.modelInst.model.joints.length + 8) / 8) | 0) * 8;
            if (modelAnimNum * stride >= this.amap.byteLength) return null;
            return dataSubarray(this.amap, modelAnimNum * stride, stride);
        }
    }

    protected override update(viewerInput: Viewer.ViewerRenderInput) {
        super.update(viewerInput);
        this.materialFactory.update(this.animController);

        if (this.turntableEnabled) {
            this.turntableAngle += viewerInput.deltaTime * this.turntableSpeed;
            if (this.turntableAngle > Math.PI * 2) this.turntableAngle -= Math.PI * 2;
        }
    }

    protected override addWorldRenderInsts(device: GfxDevice, renderInstManager: GfxRenderInstManager, renderLists: SFARenderLists, sceneCtx: SceneRenderContext) {
        // --- initial / async load ---
        if (this.modelInst === undefined) {
            try {
                const requestedModelNum = this.modelNum;
                const loadGeneration = this.modelLoadGeneration;

                this.modelAnimNum = 0;
                this.modanim = this.modanimColl.getModanim(requestedModelNum);
                this.amap = this.amapColl.getAmap(requestedModelNum);

                const potentialModelInstance = this.modelFetcher.createModelInstance(requestedModelNum);

                if (potentialModelInstance instanceof Promise) {
                    potentialModelInstance.then(instance => {
                        if (loadGeneration !== this.modelLoadGeneration) return;
                        if (requestedModelNum !== this.modelNum) return;

                        this.modelInst = instance;
                        if (this.modelInst) {
                            (this.modelInst as any).modanim = this.modanim;
                            (this.modelInst as any).amap = this.amap;
                        }

                        this.dpResetNormalizeState();
                        this.dpComputeNormalizeFromCurrentModel();
                        this.hasInitializedCamera = false;
                    }).catch(e => {
                        if (loadGeneration !== this.modelLoadGeneration) return;
                        if (requestedModelNum !== this.modelNum) return;

                        console.error(`Asynchronous model loading failed for ${requestedModelNum}:`, e);
                        this.modelInst = null;
                    });
                    return;
                } else {
                    if (loadGeneration !== this.modelLoadGeneration) return;
                    if (requestedModelNum !== this.modelNum) return;

                    this.modelInst = potentialModelInstance;
                    if (this.modelInst) {
                        (this.modelInst as any).modanim = this.modanim;
                        (this.modelInst as any).amap = this.amap;
                    }

                    this.dpResetNormalizeState();
                    this.dpComputeNormalizeFromCurrentModel();
                    this.hasInitializedCamera = false;
                }
            } catch (e) {
                console.error(`Failed to load model ${this.modelNum} due to synchronous exception:`, e);
                this.modelInst = null;
            }
            return;
        }

        if (this.modelInst === null || this.modelInst === undefined) return;

        if (this.modelVersion === ModelVersion.DinosaurPlanet && this.dpNormalize && !this.dpNormReady) {
            this.dpComputeNormalizeFromCurrentModel();
        }

        if (!this.hasInitializedCamera) {
            const camera = sceneCtx.viewerInput.camera;
            (camera as any).pitch = Math.PI / 8;
            (camera as any).yaw = Math.PI * 0.25;

            if (this.modelVersion === ModelVersion.DinosaurPlanet && this.dpNormalize) {
                (camera as any).target = vec3.fromValues(0, 0, 0);

                const fovFactor = 0.5 * (1 / Math.tan(sceneCtx.viewerInput.camera.fovY / 2));
                const zoomDistance = this.dpTargetMaxDim * fovFactor;
                (camera as any).zoom = zoomDistance * 1.5;
            } else {
                const bbox = (this.modelInst.model as any).bbox;
                if (bbox) {
                    const center = vec3.fromValues(
                        (bbox.minX + bbox.maxX) * 0.5,
                        (bbox.minY + bbox.maxY) * 0.5,
                        (bbox.minZ + bbox.maxZ) * 0.5
                    );
                    const maxDim = Math.max(
                        bbox.maxX - bbox.minX,
                        bbox.maxY - bbox.minY,
                        bbox.maxZ - bbox.minZ
                    );
                    const fovFactor = 0.5 * (1 / Math.tan(sceneCtx.viewerInput.camera.fovY / 2));
                    let zoomDistance = maxDim * fovFactor;
                    if (zoomDistance === 0 || Number.isNaN(zoomDistance)) zoomDistance = 1000;

                    (camera as any).target = center;
                    (camera as any).zoom = zoomDistance * 1.5;
                }
            }

            this.hasInitializedCamera = true;
        }


const animate = (this.animController.animController as any).playbackEnabled;
let canAnimate = animate && !!this.modelInst?.model?.joints && this.modelInst.model.joints.length > 0;

if (this.modelVersion === ModelVersion.DinosaurPlanet && !this.dpAnimsEnabled) {
    canAnimate = false;
}

if (this.modelVersion === ModelVersion.Demo || this.modelVersion === ModelVersion.cloudtreasure) {
    canAnimate = false;
}

if (!canAnimate) {
    if (this.modelInst) this.modelInst.resetPose();
    this.anim = null;
} else {
            if (this.anim === null) {
                try {
                    let globalAnimNum: number | undefined;
                    if (this.useGlobalAnimNum) globalAnimNum = this.modelAnimNum;
                    else globalAnimNum = this.getGlobalAnimNum(this.modelAnimNum);

                    if (globalAnimNum !== undefined) {
                        this.anim = this.animColl.getAnim(globalAnimNum);
                        if (!this.anim?.keyframes?.[0]?.poses) this.anim = null;
                    } else {
                        this.anim = null;
                    }
                } catch (e) {
                    this.anim = null;
                }
            }

            if (this.anim !== null) {
                try {
                    applyAnimationToModel(
                        this.animController.animController.getTimeInSeconds() * 0.60,
                        this.modelInst,
                        this.anim,
                        this.modelAnimNum
                    );
                } catch (e) {
                    this.anim = null;
                    if (this.modelInst) this.modelInst.resetPose();
                }
            }
        }

        const template = renderInstManager.pushTemplateRenderInst();
        fillSceneParamsDataOnTemplate(template, sceneCtx.viewerInput);

        const modelCtx: ModelRenderContext = {
            sceneCtx,
            showDevGeometry: this.displayBones,
            ambienceIdx: 0,
            showMeshes: true,
            outdoorAmbientColor: White,
            setupLights: (lights: Light[], typeMask: number) => {
                const expectedMaxLights = 8;
                for (let i = 0; i < expectedMaxLights; i++) {
                    if (!lights[i]) lights[i] = new Light();
                    const currentLight = lights[i];

                    if (!currentLight.Position) currentLight.Position = vec3.create();
                    if (!currentLight.Direction) currentLight.Direction = vec3.create();

                    currentLight.Color = colorNewCopy(White);
                    vec3.set(currentLight.Position, 0, 0, 0);
                    vec3.set(currentLight.Direction, 0, 0, 0);
                    lightSetDistAttn(currentLight, 0, 0, 0);
                    lightSetSpot(currentLight, 0, 0);
                }

                const ambientLight = lights[0];
                ambientLight.Color.r *= 0.5;
                ambientLight.Color.g *= 0.5;
                ambientLight.Color.b *= 0.5;
                ambientLight.Color.a = 1.0;

                const dirLight = lights[1];
                dirLight.Color.r = 1.0;
                dirLight.Color.g = 1.0;
                dirLight.Color.b = 1.0;
                dirLight.Color.a = 1.0;
                vec3.set(dirLight.Direction, 0.5, -1.0, 0.5);
                vec3.normalize(dirLight.Direction, dirLight.Direction);

                for (let i = 2; i < expectedMaxLights; i++) {
                    lights[i].Color.a = 0.0;
                }
            },
            mapLights: undefined,
            cullByAabb: false,
        };

        const mtx = mat4.create();

        if (this.modelVersion === ModelVersion.DinosaurPlanet && this.dpNormalize) {
            const angle = this.turntableEnabled ? this.turntableAngle : 0.0;

            mat4.fromYRotation(mtx, angle);
            mat4.scale(mtx, mtx, [this.dpNormScale, this.dpNormScale, this.dpNormScale]);

            vec3.set(this.dpTmpNegCenter, -this.dpNormCenter[0], -this.dpNormCenter[1], -this.dpNormCenter[2]);
            mat4.translate(mtx, mtx, this.dpTmpNegCenter);
        } else {
            if (this.turntableEnabled) {
                const bbox = (this.modelInst?.model as any)?.bbox;
                const center = vec3.create();
                if (bbox) {
                    center[0] = (bbox.minX + bbox.maxX) * 0.5;
                    center[1] = (bbox.minY + bbox.maxY) * 0.5;
                    center[2] = (bbox.minZ + bbox.maxZ) * 0.5;
                }

                const toOrigin = mat4.create();
                const backToCenter = mat4.create();
                const rotY = mat4.create();

                const negCenter = vec3.fromValues(-center[0], -center[1], -center[2]);
                mat4.fromTranslation(toOrigin, negCenter);
                mat4.fromTranslation(backToCenter, center);
                mat4.fromYRotation(rotY, this.turntableAngle);

                mat4.mul(mtx, rotY, toOrigin);
                mat4.mul(mtx, backToCenter, mtx);
            }
        }

        if (this.modelInst) {
            this.modelInst.addRenderInsts(device, renderInstManager, modelCtx, renderLists, mtx);
        }

        renderInstManager.popTemplateRenderInst();

        // bones overlay
        if (this.displayBones) {
            if (this.modelInst && this.modelInst.model && this.modelInst.skeletonInst) {
                const ctx = getDebugOverlayCanvas2D();
                for (let i = 1; i < this.modelInst.model.joints.length; i++) {
                    const joint = this.modelInst.model.joints[i];
                    const jointMtx = mat4.clone(this.modelInst.skeletonInst.getJointMatrix(i));
                    mat4.mul(jointMtx, jointMtx, mtx);
                    const jointPt = vec3.create();
                    mat4.getTranslation(jointPt, jointMtx);

                    if (joint.parent != 0xff) {
                        const parentMtx = mat4.clone(this.modelInst.skeletonInst.getJointMatrix(joint.parent));
                        mat4.mul(parentMtx, parentMtx, mtx);
                        const parentPt = vec3.create();
                        mat4.getTranslation(parentPt, parentMtx);
                        drawWorldSpaceLine(ctx, sceneCtx.viewerInput.camera.clipFromWorldMatrix, parentPt, jointPt);
                    } else {
                        drawWorldSpacePoint(ctx, sceneCtx.viewerInput.camera.clipFromWorldMatrix, jointPt);
                    }
                }
            }
        }
    }

    public override destroy(device: GfxDevice): void {
        super.destroy(device);
        if (this.materialFactory) this.materialFactory.destroy(device);
    }

private async loadNextValidModel(): Promise<void> {
    const maxTries = 500;
    const startingModel = this.modelNum;
    const loadGeneration = this.modelLoadGeneration;
    let candidate = this.modelNum;

    for (let tries = 1; tries <= maxTries; tries++) {
        if (loadGeneration !== this.modelLoadGeneration) return;

        candidate++;
        if (candidate > 0xFFFF) candidate = 1;
        if (candidate === startingModel) break;

        try {
            const inst = this.modelFetcher.createModelInstance(candidate);
            const resolvedInst = inst instanceof Promise ? await inst : inst;

            if (loadGeneration !== this.modelLoadGeneration) return;

            if (!resolvedInst || !(resolvedInst as any).modelShapes?.shapes?.length) {
                this.modelInst = null;
                continue;
            }

            this.modelNum = candidate;
            this.modelAnimNum = 0;

            this.anim = null;
            this.generatedAmap = null;
            this.modanim = this.modanimColl.getModanim(this.modelNum);
            this.amap = this.amapColl.getAmap(this.modelNum);

            this.modelInst = resolvedInst;
            if (this.modelInst) {
                (this.modelInst as any).modanim = this.modanim;
                if (this.amap) this.modelInst.setAmap(this.amap);
            }

            this.dpResetNormalizeState();
            this.dpComputeNormalizeFromCurrentModel();
            this.hasInitializedCamera = false;

            if (this.modelSelect?.elem instanceof HTMLInputElement)
                this.modelSelect.elem.value = this.modelNum.toString();
            if (this.animSelect?.elem instanceof HTMLInputElement)
                this.animSelect.elem.value = this.modelAnimNum.toString();

            console.log(`Successfully loaded model: ${this.modelNum}`);
            return;
        } catch (e) {
            if (loadGeneration !== this.modelLoadGeneration) return;
            console.warn(`Model ${candidate} threw error during validation:`, e);
            this.modelInst = null;
        }
    }
    console.warn(`No valid models found after ${maxTries} tries.`);
}

private async loadPreviousValidModel(): Promise<void> {
    const maxTries = 500;
    const startingModel = this.modelNum;
    const loadGeneration = this.modelLoadGeneration;
    let candidate = this.modelNum;

    for (let tries = 1; tries <= maxTries; tries++) {
        if (loadGeneration !== this.modelLoadGeneration) return;

        candidate--;
        if (candidate <= 0) candidate = 0xFFFF;
        if (candidate === startingModel) break;

        try {
            const inst = this.modelFetcher.createModelInstance(candidate);
            const resolvedInst = inst instanceof Promise ? await inst : inst;

            if (loadGeneration !== this.modelLoadGeneration) return;

            if (!resolvedInst || !(resolvedInst as any).modelShapes?.shapes?.length) {
                this.modelInst = null;
                continue;
            }

            this.modelNum = candidate;
            this.modelAnimNum = 0;

            this.anim = null;
            this.generatedAmap = null;
            this.modanim = this.modanimColl.getModanim(this.modelNum);
            this.amap = this.amapColl.getAmap(this.modelNum);

            this.modelInst = resolvedInst;
            if (this.modelInst) {
                (this.modelInst as any).modanim = this.modanim;
                if (this.amap) this.modelInst.setAmap(this.amap);
            }

            this.dpResetNormalizeState();
            this.dpComputeNormalizeFromCurrentModel();
            this.hasInitializedCamera = false;

            if (this.modelSelect?.elem instanceof HTMLInputElement)
                this.modelSelect.elem.value = this.modelNum.toString();
            if (this.animSelect?.elem instanceof HTMLInputElement)
                this.animSelect.elem.value = this.modelAnimNum.toString();

            console.log(`Successfully loaded model: ${this.modelNum}`);
            return;
        } catch (e) {
            if (loadGeneration !== this.modelLoadGeneration) return;
            console.warn(`Model ${candidate} threw error during validation:`, e);
        }
    }
    console.warn(`No valid models found after ${maxTries} tries.`);
}

    private async loadNextValidAnim(): Promise<void> {
        const maxTries = 500;
        const startingAnimNum = this.modelAnimNum;
        let candidateAnimNum = this.modelAnimNum;

        for (let tries = 1; tries <= maxTries; tries++) {
            candidateAnimNum++;
            if (candidateAnimNum > 1000) candidateAnimNum = 0;
            if (candidateAnimNum === startingAnimNum && tries > 1) break;

            try {
                let globalAnimNumToFetch: number | undefined = candidateAnimNum;
                if (!this.useGlobalAnimNum) globalAnimNumToFetch = this.getGlobalAnimNum(candidateAnimNum);

                if (globalAnimNumToFetch !== undefined) {
                    const potentialAnim = this.animColl.getAnim(globalAnimNumToFetch);
                    if (potentialAnim && potentialAnim.keyframes?.[0]?.poses) {
                        this.modelAnimNum = candidateAnimNum;
                        this.anim = potentialAnim;
                        this.generatedAmap = null;
                        if (this.animSelect?.elem instanceof HTMLInputElement)
                            this.animSelect.elem.value = this.modelAnimNum.toString();
                        return;
                    }
                }
            } catch (e) { }
        }
    }

    private async loadPreviousValidAnim(): Promise<void> {
        const maxTries = 500;
        const startingAnimNum = this.modelAnimNum;
        let candidateAnimNum = this.modelAnimNum;

        for (let tries = 1; tries <= maxTries; tries++) {
            candidateAnimNum--;
            if (candidateAnimNum < 0) candidateAnimNum = 1000;
            if (candidateAnimNum === startingAnimNum && tries > 1) break;

            try {
                let globalAnimNumToFetch: number | undefined = candidateAnimNum;
                if (!this.useGlobalAnimNum) globalAnimNumToFetch = this.getGlobalAnimNum(candidateAnimNum);

                if (globalAnimNumToFetch !== undefined) {
                    const potentialAnim = this.animColl.getAnim(globalAnimNumToFetch);
                    if (potentialAnim && potentialAnim.keyframes?.[0]?.poses) {
                        this.modelAnimNum = candidateAnimNum;
                        this.anim = potentialAnim;
                        this.generatedAmap = null;
                        if (this.animSelect?.elem instanceof HTMLInputElement)
                            this.animSelect.elem.value = this.modelAnimNum.toString();
                        return;
                    }
                }
            } catch (e) { }
        }
    }
}


export class SFAModelExhibitSceneDesc implements Viewer.SceneDesc {
    constructor(
        public id: string, 
        public name: string, 
        private modelVersion: ModelVersion, 
        private gameInfo: GameInfo = SFA_GAME_INFO,
        private subdirs?: string[] 
    ) { }

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        const materialFactory = new MaterialFactory(device);
        materialFactory.initialize();

        const animController = new SFAAnimationController();
        const modanimColl = await ModanimCollection.create(this.gameInfo, context.dataFetcher);
        const amapColl = await AmapCollection.create(this.gameInfo, context.dataFetcher);

const isBeta = this.modelVersion === ModelVersion.Beta;
const isCloudTreasure = this.modelVersion === ModelVersion.cloudtreasure;
const isDemo = this.modelVersion === ModelVersion.Demo;

const selectedSubdirs = this.subdirs ?? (isBeta
    ? ['swapcircle']
    : isCloudTreasure
        ? ['cloudtreasure']
        : isDemo
            ? ['Copy of swaphol', 'insidegal', 'linklevel']
            : [
                'animtest', 'arwing', 'arwingcity', 'arwingcloud', 'arwingdarkice', 'arwingdragon', 'arwingtoplanet',
                'bossdrakor', 'bossgaldon', 'bosstrex', 'capeclaw', 'clouddungeon', 'cloudrace', 'crfort',
                'darkicemines', 'darkicemines2', 'dbshrine', 'desert', 'dfptop', 'dfshrine', 'dragrock', 'dragrockbot',
                'ecshrine', 'gamefront', 'gpshrine', 'greatfox', 'icemountain', 'lightfoot',
                'linka', 'linkb', 'linkc', 'linkd', 'linke', 'linkf', 'linkg', 'linkh', 'linki', 'linkj',
                'magiccave', 'mazecave', 'mmpass', 'mmshrine', 'nwastes', 'nwshrine', 'shipbattle', 'shop',
                'swaphol', 'swapholbot', 'volcano', 'wallcity', 'warlock', 'worldmap',
            ]);
        const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, this.modelVersion === ModelVersion.Beta);
        await texFetcher.loadSubdirs(selectedSubdirs, context.dataFetcher);

        const modelFetcher = await ModelFetcher.create(this.gameInfo, Promise.resolve(texFetcher), materialFactory, animController, this.modelVersion);
        await modelFetcher.loadSubdirs(selectedSubdirs, context.dataFetcher);

        const animColl = await AnimCollection.create(this.gameInfo, context.dataFetcher, selectedSubdirs);

        return new ModelExhibitRenderer(context, animController, materialFactory, texFetcher, modelFetcher, animColl, amapColl, modanimColl, this.gameInfo, this.modelVersion);
    }
}

export class DPModelFetcher {
    public constructor(
        private gameInfo: GameInfo,
        private dataFetcher: DataFetcher,
        private texFetcher: TextureFetcher,
        private materialFactory: MaterialFactory
    ) { }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, texFetcher: TextureFetcher, materialFactory: MaterialFactory): Promise<DPModelFetcher> {
        return new DPModelFetcher(gameInfo, dataFetcher, texFetcher, materialFactory);
    }

    public async createModelInstance(modelNum: number): Promise<ModelInstance | null> {
        const url = `${this.gameInfo.pathBase}/uncompressed_models/${modelNum}.bin`;

        try {
            const buffer = await this.dataFetcher.fetchData(url, { allow404: true });
            if (buffer.byteLength === 0) return null;

            const dv = buffer.createDataView();
            const model = loadModel(dv, this.texFetcher, this.materialFactory, ModelVersion.DinosaurPlanet);
            return new ModelInstance(model);
        } catch (e: any) {
            console.error(`[DPModelFetcher] Failed to parse model ${modelNum}:`, e);
            return null;
        }
    }
}

export class DPModelExhibitSceneDesc implements Viewer.SceneDesc {
    constructor(public id: string, public name: string, private gameInfo: GameInfo = DP_GAME_INFO) { }

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        const materialFactory = new MaterialFactory(device);
        materialFactory.initialize();

        const animController = new SFAAnimationController();

        const modanimColl = await ModanimCollection.create(this.gameInfo, context.dataFetcher);
        const amapColl = await AmapCollection.create(this.gameInfo, context.dataFetcher);
        const animColl = await AnimCollection.create(this.gameInfo, context.dataFetcher, ['']);

        const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, true);
        await texFetcher.loadSubdirs([''], context.dataFetcher);
        texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);

        const modelFetcher = await DPModelFetcher.create(this.gameInfo, context.dataFetcher, texFetcher, materialFactory);

        return new ModelExhibitRenderer(
            context,
            animController,
            materialFactory,
            texFetcher,
            modelFetcher as any,
            animColl,
            amapColl,
            modanimColl,
            this.gameInfo,
            ModelVersion.DinosaurPlanet
        );
    }
}