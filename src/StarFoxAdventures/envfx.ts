import { mat4, vec3 } from 'gl-matrix';
import { DataFetcher } from '../DataFetcher.js';
import { Color, colorNewFromRGBA, colorCopy, colorNewCopy, colorFromRGBA, White, colorScale } from '../Color.js';
import { nArray } from '../util.js';
import { ModelVersion } from './modelloader.js';
import { SFATexture, SFATextureFetcher } from './textures.js';
import { dataSubarray, readUint16 } from './util.js';
import { ObjectInstance } from './objects.js';
import { World } from './world.js';
import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import { createDirectionalLight, Light } from './WorldLights.js';
import { SceneUpdateContext } from './render.js';
import { computeViewMatrix } from '../Camera.js';
import { GfxRenderCache } from '../gfx/render/GfxRenderCache.js';

enum EnvfxType {
    Atmosphere = 5,
    Skyscape = 4,
}

class Atmosphere {
    public textures: (SFATexture | null)[] = nArray(8, () => null);
    public outdoorAmbientColors: Color[] = nArray(8, () => colorNewFromRGBA(1.0, 1.0, 1.0, 1.0));
}

class Skyscape {
    public objects: ObjectInstance[] = [];
    public destroy(device: GfxDevice) {
        for (let obj of this.objects) obj.destroy(device);
    }
}

const scratchMtx0 = mat4.create();
const MIST_TEXTURE_DIM = 64;
const FORCE_KIOSK_TEXTURE_ONLY_SKY = true;
const KIOSK_SKY_TEXTURE_PATHBASE = 'StarFoxAdventures';
const KIOSK_TEXTURE_ONLY_ATMOS_TEXIDS_BY_SUBDIR: Record<string, number[] | null> = {
    swaphol:  [176, 154, 153, 151, 149, 148, 169, 152],
    capeclaw: [157, 181, 183, 180, 184, 182, 182, 182],
    darkicemines: [157, 147, 153, 150, 149, 148,],
    icemountain: [157, 147, 153, 150, 149, 148,],
    lightfoot: [146, 156, 149, 150, 153, 178,],
mmpass: [146, 171, 156, 168, 167, 162, 161],
nwastes: [157, 147, 153, 150, 149, 147,],
volcano: [157, 147, 153, 150, 149, 147,],
warlock: [146,],
wallcity: [176, 154, 153,151,149,148,146],
dfptop: [176, 154, 153,151,149,148,146],
dragrock: [176, 154, 153,151,149,148,146],
crfort: [164,165,166,167,168,169,170,171],
shop: null,

};

const TEXTURE_ONLY_SKY_SUBDIR_ALIASES: Record<string, string> = {

};

export class EnvfxManager {
    public atmosphere = new Atmosphere();
    public skyscape = new Skyscape();
    private timeOfDay = 4;
public ambienceIdx: number = 0;
public enableAmbientLighting = true;
public enableFog = true;
public hasLoadedAtmosphereEnvfx = false;
    
    public skyLight: Light = createDirectionalLight(vec3.fromValues(-1.0, -1.0, -1.0), White);
    public groundLight: Light = createDirectionalLight(vec3.fromValues(1.0, 1.0, 1.0), White);
    private groundLightFactor: number = 1.0;

    private envfxactBin!: DataView;
    private kioskTextureOnlySkyFetcher: SFATextureFetcher | null = null;
    private readonly ENVFX_SIZE = 0x60;

    public mistEnable = true;
    public mistTop = 0.0;
    public mistBottom = 0.0;
    private mistTexture: SFATexture;
    private mistParam?: number;

    private constructor(private world: World) {
        this.mistTexture = SFATexture.create(this.world.renderCache, MIST_TEXTURE_DIM, MIST_TEXTURE_DIM);
    }

public static async create(world: World, dataFetcher: DataFetcher): Promise<EnvfxManager> {
    const self = new EnvfxManager(world);

const pathBase = world.gameInfo.pathBase;
const isDP = pathBase.toLowerCase().includes('dp');

const envName = isDP ? 'ENVACT.bin' : 'ENVFXACT.bin';
self.envfxactBin = (await dataFetcher.fetchData(`${pathBase}/${envName}`)).createDataView();

if (!isDP && FORCE_KIOSK_TEXTURE_ONLY_SKY) {
    const skyGameInfo = { ...world.gameInfo, pathBase: KIOSK_SKY_TEXTURE_PATHBASE };
    self.kioskTextureOnlySkyFetcher = await SFATextureFetcher.create(skyGameInfo, dataFetcher, false);
}

    return self;
}

    public update(device: GfxDevice, sceneCtx: SceneUpdateContext) {
        this.updateAmbience();
        this.updateMistTexture(device, 0);
    }

    public getMistTexture(): SFATexture { return this.mistTexture; }

    private updateAmbience() {
        this.getAmbientColor(this.skyLight.color, this.ambienceIdx);
        if (this.enableAmbientLighting) {
            colorScale(this.groundLight.color, this.skyLight.color, this.groundLightFactor);
            this.groundLight.color.a = 1.0;
        } else colorCopy(this.groundLight.color, this.skyLight.color);

        this.world.worldLights.addLight(this.skyLight);
        this.world.worldLights.addLight(this.groundLight);
    }

    public setTimeOfDay(time: number) { this.timeOfDay = time; this.updateAmbience(); }
    public setAmbience(idx: number) { this.ambienceIdx = idx; this.updateAmbience(); }

    private updateMistTexture(device: GfxDevice, param: number) {
        if (!this.enableFog || !this.mistEnable || this.mistParam === param) return;
        const pixels = new Uint8Array(4 * MIST_TEXTURE_DIM * MIST_TEXTURE_DIM);
        for (let y = 0; y < MIST_TEXTURE_DIM; y++) {
            const lineFactor = Math.min((y + param) * 255, 0x3fc0);
            for (let x = 0; x < MIST_TEXTURE_DIM; x++) {
                let I = (lineFactor * x) >> 12;
                const idx = 4 * (y * MIST_TEXTURE_DIM + x);
                pixels[idx] = pixels[idx+1] = pixels[idx+2] = pixels[idx+3] = I;
            }
        }
        device.uploadTextureData(this.mistTexture.gfxTexture, 0, [pixels]);
    }

    public getAmbientColor(out: Color, ambienceIdx: number) {
        if (!this.enableAmbientLighting) colorCopy(out, White);
        else if (ambienceIdx === 0) colorCopy(out, this.atmosphere.outdoorAmbientColors[this.timeOfDay]);
        else colorCopy(out, White);
    }

    public getFogColor(dst: Color, ambienceIdx: number) { this.getAmbientColor(dst, ambienceIdx); }
    public getAtmosphereTexture(): SFATexture | null { return this.atmosphere.textures[this.timeOfDay]; }

private getKioskTextureOnlyAtmosTexIds(): number[] | null {
    const primarySubdir = this.world.subdirs[0] ?? '';
    const profileSubdir = TEXTURE_ONLY_SKY_SUBDIR_ALIASES[primarySubdir] ?? primarySubdir;
    return KIOSK_TEXTURE_ONLY_ATMOS_TEXIDS_BY_SUBDIR[profileSubdir] ?? null;
}

public shouldForceTextureOnlySky(): boolean {
    if (!FORCE_KIOSK_TEXTURE_ONLY_SKY)
        return false;

    if (this.kioskTextureOnlySkyFetcher === null)
        return false;

    return this.getKioskTextureOnlyAtmosTexIds() !== null;
}

public forceKioskTextureOnlySky(): void {
    if (this.world.gameInfo.pathBase !== 'StarFoxAdventuresDemo')
        return;

    if (!FORCE_KIOSK_TEXTURE_ONLY_SKY)
        return;

    if (this.kioskTextureOnlySkyFetcher === null)
        return;

    this.skyscape.objects = [];

    const texIds = this.getKioskTextureOnlyAtmosTexIds();

    // Unlisted map or explicit indoor map like shop => no sky.
    if (texIds === null) {
        this.atmosphere.textures = nArray(8, () => null);
        return;
    }

    this.atmosphere.textures = nArray(8, () => null);

    for (let i = 0; i < Math.min(8, texIds.length); i++) {
        this.atmosphere.textures[i] =
            this.kioskTextureOnlySkyFetcher.getDirectTextureByID(this.world.renderCache, texIds[i], false);
    }
}
    public loadEnvfx(index: number) {
        const byteOffs = index * this.ENVFX_SIZE;
        if (byteOffs + this.ENVFX_SIZE > this.envfxactBin.byteLength) return;

        const data = dataSubarray(this.envfxactBin, byteOffs, this.ENVFX_SIZE);
        const fields = { index, type: data.getUint8(0x5c) };

if (fields.type === EnvfxType.Atmosphere) {
    this.hasLoadedAtmosphereEnvfx = true;
    const isDP = this.world.gameInfo.pathBase.toLowerCase().includes('dp');
    if (isDP) {
        const texFetcher: any = this.world.resColl.texFetcher;
        if (typeof texFetcher.setModelVersion === 'function')
            texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);
    }

    const BASE = isDP ? 0 : 0xc38;

            const texIds: number[] = [];
            for (let i = 0; i < 4; i++) texIds.push(readUint16(data, 0x2e, i));
            for (let i = 0; i < 4; i++) texIds.push(readUint16(data, 0x3e, i));

            this.atmosphere.textures = [];
            for (let i = 0; i < 8; i++) {
                this.atmosphere.textures[i] = this.world.resColl.texFetcher.getTexture(this.world.renderCache, BASE + texIds[i], false);
            }

            for (let i = 0; i < 4; i++) {
                const c = colorNewFromRGBA(data.getUint8(0xc + i) / 255, data.getUint8(0x14 + i) / 255, data.getUint8(0x1c + i) / 255, 1.0);
                if (i === 0) { this.atmosphere.outdoorAmbientColors[0] = this.atmosphere.outdoorAmbientColors[7] = c; }
                else if (i === 1) { this.atmosphere.outdoorAmbientColors[1] = this.atmosphere.outdoorAmbientColors[2] = c; }
                else if (i === 2) { this.atmosphere.outdoorAmbientColors[3] = this.atmosphere.outdoorAmbientColors[4] = c; }
                else if (i === 3) { this.atmosphere.outdoorAmbientColors[5] = this.atmosphere.outdoorAmbientColors[6] = c; }
            }
        } else if (fields.type === EnvfxType.Skyscape) {
            this.skyscape.objects = [];

            const SKY_RING_TYPES = [0, 769, 616, 1377];
            const MOUNTAIN_TYPES = [0, 239, 0, 0, 0];
            const SKYSCAPE_TYPES = [0, 1017, 1018, 1389, 0];

            const skyscapeType = data.getUint8(0x5d);
            const skyRingType = data.getUint8(0x5b);
            const mountainType = data.getUint8(0x5a);

            const safeSpawn = (typeId: number) => {
                if (!typeId) return;
                try {
                    const obj = this.world.objectMan.createObjectInstance(
                        typeId,
                        new DataView(new ArrayBuffer(0x80)),
                        vec3.create(),
                        /*skipObjindex=*/true
                    );
                    if (obj) {
                        obj.cullRadius = 999999;
                        obj.scale = 1.0;

                        this.skyscape.objects.push(obj);
                    }
                } catch (e) {
                }
            };

            safeSpawn(SKYSCAPE_TYPES[skyscapeType] || 0);
            safeSpawn(SKY_RING_TYPES[skyRingType] || 0);
            safeSpawn(MOUNTAIN_TYPES[mountainType] || 0);
        }

        if (this.world.gameInfo.pathBase === 'StarFoxAdventuresDemo' && FORCE_KIOSK_TEXTURE_ONLY_SKY)
            this.forceKioskTextureOnlySky();

        return fields;
    }

public destroy(device: GfxDevice) {
    this.skyscape.destroy(device);
    this.kioskTextureOnlySkyFetcher?.destroy(device);
}}