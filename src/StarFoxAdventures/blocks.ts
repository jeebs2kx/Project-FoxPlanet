import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import ArrayBufferSlice from '../ArrayBufferSlice.js';

import { TextureFetcher, FakeTextureFetcher } from './textures.js';
import { getSubdir, loadRes } from './resource.js';
import { GameInfo } from './scenes.js';
import { MaterialFactory } from './materials.js';
import { Model } from './models.js';
import { loadModel, ModelVersion } from './modelloader.js';
import { SFAAnimationController } from './animation.js';
import { DataFetcher } from '../DataFetcher.js';
import { readUint32 } from './util.js';

export abstract class BlockFetcher {
    public abstract fetchBlock(mod: number, sub: number, dataFetcher: DataFetcher): Promise<Model | null>;
}

export class BlockCollection {
    private tab!: DataView;
    private bin!: ArrayBufferSlice;
    private blockModels: (Model | undefined)[] = [];

    private constructor(private materialFactory: MaterialFactory, private texFetcher: TextureFetcher, private modelVersion: ModelVersion, private isCompressed: boolean) {
    }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, tabPath: string, binPath: string, materialFactory: MaterialFactory, texFetcher: TextureFetcher, modelVersion: ModelVersion, isCompressed: boolean = true): Promise<BlockCollection> {
        const self = new BlockCollection(materialFactory, texFetcher, modelVersion, isCompressed);

        const pathBase = gameInfo.pathBase;
        const [tab, bin] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/${tabPath}`, { allow404: true }),
            dataFetcher.fetchData(`${pathBase}/${binPath}`, { allow404: true }),
        ]);
        self.tab = tab.createDataView();
        self.bin = bin;

        return self;
    }

    public getBlockModel(num: number): Model | null {
        if (num >= 1146 && num <= 1182) {
  //  console.warn(`[MOD49] ENTER getBlockModel num=${num}`, {
    //    tabByteLength: this.tab.byteLength,
    //    binByteLength: this.bin.byteLength,
   //     cached: this.blockModels[num] !== undefined,
  //  });
}
        if (this.blockModels[num] === undefined) {
const tabValue = readUint32(this.tab, 0, num);

if (num >= 1146 && num <= 1182) {
   // console.warn(`[MOD49] tab read num=${num}`, {
   //     tabValue: `0x${tabValue.toString(16)}`,
   //     hasFlag: !!(tabValue & 0x10000000),
    //    offset: `0x${(tabValue & 0x0fffffff).toString(16)}`,
    //    modelVersion: ModelVersion[this.modelVersion],
    //    isCompressed: this.isCompressed,
  //  });
}

if (tabValue === 0xffffffff) {
  //  console.warn(`[MOD49] RETURN NULL: tab entry empty num=${num}`);
    return null;
}

const blockOffset = (tabValue & 0x10000000)
    ? (tabValue & 0x0fffffff)
    : tabValue;

if (blockOffset >= this.bin.byteLength) {
  //  console.warn(`[MOD49] RETURN NULL: bad blockOffset num=${num}`, {
    //    tabValue: `0x${tabValue.toString(16)}`,
    //    blockOffset: `0x${blockOffset.toString(16)}`,
    //    binByteLength: this.bin.byteLength,
  //  });
    return null;
}

let blockBin: ArrayBufferSlice;

if (this.isCompressed) {
    blockBin = this.bin.subarray(blockOffset);
} else {
    let blockEnd = this.bin.byteLength;

    for (let i = num + 1; i * 4 < this.tab.byteLength; i++) {
        const nextValue = readUint32(this.tab, 0, i);

        if (nextValue === 0xffffffff)
            break;

const nextOffset = (nextValue & 0x10000000)
    ? (nextValue & 0x0fffffff)
    : nextValue;

        if (nextOffset > blockOffset && nextOffset <= this.bin.byteLength) {
            blockEnd = nextOffset;
            break;
        }
    }

    blockBin = this.bin.subarray(blockOffset, blockEnd - blockOffset);
}

const uncomp = this.isCompressed ? loadRes(blockBin) : blockBin;

if (uncomp === null) {
 //   console.warn(`[MOD49] RETURN NULL: uncomp null num=${num}`);
    return null;
}

if (num >= 1146 && num <= 1182) {
   // console.warn(`[MOD49] ABOUT TO loadModel num=${num}`, {
    //    byteLength: uncomp.byteLength,
     //   modelVersion: ModelVersion[this.modelVersion],
  //  });
}



if (this.modelVersion === ModelVersion.DinosaurPlanet) {
    this.materialFactory.beginDPMapBlockBuild();
    try {
this.blockModels[num] = loadModel(
    uncomp.createDataView(),
    this.texFetcher,
    this.materialFactory,
    this.modelVersion,
    num,
);
    } finally {
        this.materialFactory.endDPMapBlockBuild();
    }
} else {
this.blockModels[num] = loadModel(
    uncomp.createDataView(),
    this.texFetcher,
    this.materialFactory,
    this.modelVersion,
    num,
);
}

const m = this.blockModels[num]!;
const ms = m.sharedModelShapes;

//console.warn(`[MOD49] block=${num} version=${ModelVersion[this.modelVersion]} byteLength=${uncomp.byteLength}`, {
 //   shape0: ms?.shapes[0]?.length ?? 0,
 //   shape1: ms?.shapes[1]?.length ?? 0,
 //   shape2: ms?.shapes[2]?.length ?? 0,
 //   waters: ms?.waters?.length ?? 0,
 //   furs: ms?.furs?.length ?? 0,
 //   wireframes: (ms as any)?.wireframes?.length ?? 0,
//});

        }

        return this.blockModels[num]!;
    }

    public destroy(device: GfxDevice) {
        for (let model of this.blockModels)
            if (model !== undefined)
                model.destroy(device);
    }
}

function getModFileNum(mod: number): number {
    if (mod < 5) { // 
        return mod;
    } else {
        return mod + 1;
    }
}

function dumpMod49OldHeader(num: number, data: DataView): void {
    const b = (offs: number) => data.getUint8(offs);
    const u16 = (offs: number) => data.getUint16(offs, false);

    const stride = u16(0x39);
    const vertexCount = u16(0x3B);
    const polyCount = u16(0x3D);
    const groupCount = u16(0x3F);

    const vertexStart = 0x88;
    const vertexEnd = vertexStart + vertexCount * stride;
    const polyStart = vertexEnd;

    console.warn(`[MOD49 OLD FORMAT] block=${num}`, {
        byteLength: data.byteLength,
        stride,
        vertexCount,
        polyCount,
        groupCount,
        vertexStart: `0x${vertexStart.toString(16)}`,
        vertexEnd: `0x${vertexEnd.toString(16)}`,
        polyStart: `0x${polyStart.toString(16)}`,
        firstBytes: Array.from({ length: 0x20 }, (_, i) => b(i).toString(16).padStart(2, '0')).join(' '),
        nameGuess: String.fromCharCode(
            b(0x58), b(0x59), b(0x5A), b(0x5B),
            b(0x5C), b(0x5D), b(0x5E),
        ),
    });
}

export class SFABlockFetcher implements BlockFetcher {
    private trkblkTab!: DataView;
    private blockColls: (BlockCollection | undefined)[] = [];
    private texFetcher!: TextureFetcher;

    private constructor(private gameInfo: GameInfo, private device: GfxDevice, private materialFactory: MaterialFactory, private animController: SFAAnimationController) {
    }

    private async init(dataFetcher: DataFetcher, texFetcherPromise: Promise<TextureFetcher>) {
        const pathBase = this.gameInfo.pathBase;
        const [trkblk, texFetcher] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/TRKBLK.tab`),
            texFetcherPromise,
        ]);
        this.trkblkTab = trkblk.createDataView();
        this.texFetcher = texFetcher;
    }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, device: GfxDevice, materialFactory: MaterialFactory, animController: SFAAnimationController, texFetcherPromise: Promise<TextureFetcher>) {
        const self = new SFABlockFetcher(gameInfo, device, materialFactory, animController);
        await self.init(dataFetcher, texFetcherPromise);
        return self;
    }

    public async fetchBlock(mod: number, sub: number, dataFetcher: DataFetcher): Promise<Model | null> {
        if (mod < 0 || mod * 2 >= this.trkblkTab.byteLength) {
            return null;
        }

        const blockColl = await this.fetchBlockCollection(mod, dataFetcher);
        const trkblk = this.trkblkTab.getUint16(mod * 2);
        const blockNum = trkblk + sub;
        return blockColl.getBlockModel(blockNum);
    }

    private async fetchBlockCollection(mod: number, dataFetcher: DataFetcher): Promise<BlockCollection> {
        if (this.blockColls[mod] === undefined) {
            const subdir = getSubdir(mod, this.gameInfo);
            const modNum = getModFileNum(mod);
            const tabPath = `${subdir}/mod${modNum}.tab`;
            const binPath = `${subdir}/mod${modNum}.zlb.bin`;
            const [blockColl, _] = await Promise.all([
                BlockCollection.create(this.gameInfo, dataFetcher, tabPath, binPath, this.materialFactory, this.texFetcher, ModelVersion.FinalMap),
                this.texFetcher.loadSubdirs([subdir], dataFetcher),
            ]);
            this.blockColls[mod] = blockColl;
        }

        return this.blockColls[mod]!;
    }

    public destroy(device: GfxDevice) {
        for (let coll of this.blockColls)
            if (coll !== undefined)
                coll.destroy(device);
    }
}

export class EARLYFEAR implements BlockFetcher {
    public trkblkTab!: DataView;
    public blockColls: (BlockCollection | undefined)[] = [];
    public texFetcher!: TextureFetcher;

    private constructor(private gameInfo: GameInfo, private device: GfxDevice, private materialFactory: MaterialFactory, private animController: SFAAnimationController) {
    }

    public async init(dataFetcher: DataFetcher, texFetcherPromise: Promise<TextureFetcher>) {
        const pathBase = this.gameInfo.pathBase;
        const [trkblk, texFetcher] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/TRKBLK.tab`),
            texFetcherPromise,
        ]);
        this.trkblkTab = trkblk.createDataView();
        this.texFetcher = texFetcher;
    }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, device: GfxDevice, materialFactory: MaterialFactory, animController: SFAAnimationController, texFetcherPromise: Promise<TextureFetcher>) {
        const self = new EARLYFEAR(gameInfo, device, materialFactory, animController);
        await self.init(dataFetcher, texFetcherPromise);
        return self;
    }

    public async fetchBlock(mod: number, sub: number, dataFetcher: DataFetcher): Promise<Model | null> {
        if (mod < 0 || mod * 2 >= this.trkblkTab.byteLength) {
            return null;
        }

        const blockColl = await this.fetchBlockCollection(mod, dataFetcher);
        const trkblk = this.trkblkTab.getUint16(mod * 2);
        const blockNum = trkblk + sub;
        return blockColl.getBlockModel(blockNum);
    }

    public async fetchBlockCollection(mod: number, dataFetcher: DataFetcher): Promise<BlockCollection> {
        if (this.blockColls[mod] === undefined) {
            const subdir = getSubdir(mod, this.gameInfo);
            const modNum = getModFileNum(mod);
            const tabPath = `${subdir}/fear_mod${modNum}.tab`;
            const binPath = `${subdir}/fear_mod${modNum}.bin`;
            const [blockColl, _] = await Promise.all([
                BlockCollection.create(this.gameInfo, dataFetcher, tabPath, binPath, this.materialFactory, this.texFetcher, ModelVersion.fear),
                this.texFetcher.loadSubdirs([subdir], dataFetcher),
            ]);
            this.blockColls[mod] = blockColl;
        }

        return this.blockColls[mod]!;
    }

    public destroy(device: GfxDevice) {
        for (let coll of this.blockColls)
            if (coll !== undefined)
                coll.destroy(device);
    }
}

export class EARLYDFPT implements BlockFetcher {
    public trkblkTab!: DataView;
    public blockColls: (BlockCollection | undefined)[] = [];
    public texFetcher!: TextureFetcher;

    private constructor(private gameInfo: GameInfo, private device: GfxDevice, private materialFactory: MaterialFactory, private animController: SFAAnimationController) {
    }

    public async init(dataFetcher: DataFetcher, texFetcherPromise: Promise<TextureFetcher>) {
        const pathBase = this.gameInfo.pathBase;
        const [trkblk, texFetcher] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/TRKBLK.tab`),
            texFetcherPromise,
        ]);
        this.trkblkTab = trkblk.createDataView();
        this.texFetcher = texFetcher;
    }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, device: GfxDevice, materialFactory: MaterialFactory, animController: SFAAnimationController, texFetcherPromise: Promise<TextureFetcher>) {
        const self = new EARLYDFPT(gameInfo, device, materialFactory, animController);
        await self.init(dataFetcher, texFetcherPromise);
        return self;
    }

    public async fetchBlock(mod: number, sub: number, dataFetcher: DataFetcher): Promise<Model | null> {
        if (mod < 0 || mod * 2 >= this.trkblkTab.byteLength) {
            return null;
        }

        const blockColl = await this.fetchBlockCollection(mod, dataFetcher);
        const trkblk = this.trkblkTab.getUint16(mod * 2);
        const blockNum = trkblk + sub;
        return blockColl.getBlockModel(blockNum);
    }

    public async fetchBlockCollection(mod: number, dataFetcher: DataFetcher): Promise<BlockCollection> {
        if (this.blockColls[mod] === undefined) {
            const subdir = getSubdir(mod, this.gameInfo);
            const modNum = getModFileNum(mod);
            const tabPath = `${subdir}/dfpt_mod${modNum}.tab`;
            const binPath = `${subdir}/dfpt_mod${modNum}.bin`;
            const [blockColl, _] = await Promise.all([
                BlockCollection.create(this.gameInfo, dataFetcher, tabPath, binPath, this.materialFactory, this.texFetcher, ModelVersion.dfpt),
                this.texFetcher.loadSubdirs([subdir], dataFetcher),
            ]);
            this.blockColls[mod] = blockColl;
        }

        return this.blockColls[mod]!;
    }

    public destroy(device: GfxDevice) {
        for (let coll of this.blockColls)
            if (coll !== undefined)
                coll.destroy(device);
    }
}

export class EARLYDUPBLOCKFETCHER implements BlockFetcher {
    public trkblkTab!: DataView;
    public blockColls: (BlockCollection | undefined)[] = [];
    public texFetcher!: TextureFetcher;

    private constructor(private gameInfo: GameInfo, private device: GfxDevice, private materialFactory: MaterialFactory, private animController: SFAAnimationController) {
    }

    public async init(dataFetcher: DataFetcher, texFetcherPromise: Promise<TextureFetcher>) {
        const pathBase = this.gameInfo.pathBase;
        const [trkblk, texFetcher] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/TRKBLK.tab`),
            texFetcherPromise,
        ]);
        this.trkblkTab = trkblk.createDataView();
        this.texFetcher = texFetcher;
    }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, device: GfxDevice, materialFactory: MaterialFactory, animController: SFAAnimationController, texFetcherPromise: Promise<TextureFetcher>) {
        const self = new EARLYDUPBLOCKFETCHER(gameInfo, device, materialFactory, animController);
        await self.init(dataFetcher, texFetcherPromise);
        return self;
    }

    public async fetchBlock(mod: number, sub: number, dataFetcher: DataFetcher): Promise<Model | null> {
        if (mod < 0 || mod * 2 >= this.trkblkTab.byteLength) {
            return null;
        }

        const blockColl = await this.fetchBlockCollection(mod, dataFetcher);
        const trkblk = this.trkblkTab.getUint16(mod * 2);
        const blockNum = trkblk + sub;
        return blockColl.getBlockModel(blockNum);
    }

    public async fetchBlockCollection(mod: number, dataFetcher: DataFetcher): Promise<BlockCollection> {
        if (this.blockColls[mod] === undefined) {
            const subdir = getSubdir(mod, this.gameInfo);
            const modNum = getModFileNum(mod);
            const tabPath = `${subdir}/dup_mod${modNum}.tab`;
            const binPath = `${subdir}/dup_mod${modNum}.bin`;
            const [blockColl, _] = await Promise.all([
                BlockCollection.create(this.gameInfo, dataFetcher, tabPath, binPath, this.materialFactory, this.texFetcher, ModelVersion.dup),
                this.texFetcher.loadSubdirs([subdir], dataFetcher),
            ]);
            this.blockColls[mod] = blockColl;
        }

        return this.blockColls[mod]!;
    }

    public destroy(device: GfxDevice) {
        for (let coll of this.blockColls)
            if (coll !== undefined)
                coll.destroy(device);
    }
}

export class EARLY1BLOCKFETCHER implements BlockFetcher {
    public trkblkTab!: DataView;
    public blockColls: (BlockCollection | undefined)[] = [];
    public texFetcher!: TextureFetcher;

    private constructor(private gameInfo: GameInfo, private device: GfxDevice, private materialFactory: MaterialFactory, private animController: SFAAnimationController) {
    }

    public async init(dataFetcher: DataFetcher, texFetcherPromise: Promise<TextureFetcher>) {
        const pathBase = this.gameInfo.pathBase;
        const [trkblk, texFetcher] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/TRKBLK.tab`), 
            texFetcherPromise,
        ]);
        this.trkblkTab = trkblk.createDataView();
        this.texFetcher = texFetcher;
    }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, device: GfxDevice, materialFactory: MaterialFactory, animController: SFAAnimationController, texFetcherPromise: Promise<TextureFetcher>) {
        const self = new EARLY1BLOCKFETCHER(gameInfo, device, materialFactory, animController);
        await self.init(dataFetcher, texFetcherPromise);
        return self;
    }

public async fetchBlock(mod: number, sub: number, dataFetcher: DataFetcher): Promise<Model | null> {
    if (mod === 49) {
      //  console.warn(`[MOD49] fetchBlock mod=${mod} sub=${sub}`);

        const blockColl = await this.fetchBlockCollection(mod, dataFetcher);
        const blockNum = 1146 + sub;

       // console.warn(`[MOD49] using blockNum=${blockNum}`);

        return blockColl.getBlockModel(blockNum);
    }

    if (mod < 0 || mod * 2 >= this.trkblkTab.byteLength) {
        return null;
    }

    const blockColl = await this.fetchBlockCollection(mod, dataFetcher);
    const blockNum = this.trkblkTab.getUint16(mod * 2) + sub;

    return blockColl.getBlockModel(blockNum);
}

    public async fetchBlockCollection(mod: number, dataFetcher: DataFetcher): Promise<BlockCollection> {
if (mod === 49) {
    if (this.blockColls[mod] === undefined) {
        const subdir = 'dbay';
        const MOD49_MODEL_VERSION = ModelVersion.Mod49Old;

        const blockColl = await BlockCollection.create(
            this.gameInfo,
            dataFetcher,
            `${subdir}/mod49.tab`,
            `${subdir}/mod49.bin`,
            this.materialFactory,
            this.texFetcher,
            MOD49_MODEL_VERSION,
            false,
        );

        await this.texFetcher.loadSubdirs([subdir], dataFetcher);
        this.blockColls[mod] = blockColl;
    }

    return this.blockColls[mod]!;
}
        if (this.blockColls[mod] === undefined) {
            const subdir = getSubdir(mod, this.gameInfo);
            const modNum = getModFileNum(mod);
            const tabPath = `${subdir}/root_mod${modNum}.tab`;
            const binPath = `${subdir}/root_mod${modNum}.bin`;
const blockColl = await BlockCollection.create(
    this.gameInfo,
    dataFetcher,
    tabPath,
    binPath,
    this.materialFactory,
    this.texFetcher,
    ModelVersion.Early1
);
            this.blockColls[mod] = blockColl;
        }

        return this.blockColls[mod]!;
    }

    public destroy(device: GfxDevice) {
        for (let coll of this.blockColls)
            if (coll !== undefined)
                coll.destroy(device);
    }
}

export class EARLY2BLOCKFETCHER implements BlockFetcher {
    private trkblkTab!: DataView;
    private blockColls: (BlockCollection | undefined)[] = [];
    private texFetcher!: TextureFetcher;

    private constructor(private gameInfo: GameInfo, private device: GfxDevice, private materialFactory: MaterialFactory, private animController: SFAAnimationController) {
    }

    private async init(dataFetcher: DataFetcher, texFetcherPromise: Promise<TextureFetcher>) {
        const pathBase = this.gameInfo.pathBase;
        const [trkblk, texFetcher] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/TRKBLK.tab`),
            texFetcherPromise,
        ]);
        this.trkblkTab = trkblk.createDataView();
        this.texFetcher = texFetcher;
    }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, device: GfxDevice, materialFactory: MaterialFactory, animController: SFAAnimationController, texFetcherPromise: Promise<TextureFetcher>) {
        const self = new EARLY2BLOCKFETCHER(gameInfo, device, materialFactory, animController);
        await self.init(dataFetcher, texFetcherPromise);
        return self;
    }

    public async fetchBlock(mod: number, sub: number, dataFetcher: DataFetcher): Promise<Model | null> {
        if (mod < 0 || mod * 2 >= this.trkblkTab.byteLength) {
            return null;
        }

        const blockColl = await this.fetchBlockCollection(mod, dataFetcher);
        const trkblk = this.trkblkTab.getUint16(mod * 2);
        const blockNum = trkblk + sub;
        return blockColl.getBlockModel(blockNum);
    }

    private async fetchBlockCollection(mod: number, dataFetcher: DataFetcher): Promise<BlockCollection> {
        if (this.blockColls[mod] === undefined) {
            const subdir = getSubdir(mod, this.gameInfo);
            const modNum = getModFileNum(mod);
            const tabPath = `${subdir}/dir_mod${modNum}.tab`;
            const binPath = `${subdir}/dir_mod${modNum}.bin`;
            const [blockColl, _] = await Promise.all([
                BlockCollection.create(this.gameInfo, dataFetcher, tabPath, binPath, this.materialFactory, this.texFetcher, ModelVersion.Early2),
                this.texFetcher.loadSubdirs([subdir], dataFetcher),
            ]);
            this.blockColls[mod] = blockColl;
        }

        return this.blockColls[mod]!;
    }

    public destroy(device: GfxDevice) {
        for (let coll of this.blockColls)
            if (coll !== undefined)
                coll.destroy(device);
    }
}
export class EARLY3BLOCKFETCHER implements BlockFetcher {
    private trkblkTab!: DataView;
    private blockColls: (BlockCollection | undefined)[] = [];
    private texFetcher!: TextureFetcher;

    private constructor(private gameInfo: GameInfo, private device: GfxDevice, private materialFactory: MaterialFactory, private animController: SFAAnimationController) {
    }

    private async init(dataFetcher: DataFetcher, texFetcherPromise: Promise<TextureFetcher>) {
        const pathBase = this.gameInfo.pathBase;
        const [trkblk, texFetcher] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/TRKBLK.tab`),
            texFetcherPromise,
        ]);
        this.trkblkTab = trkblk.createDataView();
        this.texFetcher = texFetcher;
    }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, device: GfxDevice, materialFactory: MaterialFactory, animController: SFAAnimationController, texFetcherPromise: Promise<TextureFetcher>) {
        const self = new EARLY3BLOCKFETCHER(gameInfo, device, materialFactory, animController);
        await self.init(dataFetcher, texFetcherPromise);
        return self;
    }

    public async fetchBlock(mod: number, sub: number, dataFetcher: DataFetcher): Promise<Model | null> {
        if (mod < 0 || mod * 2 >= this.trkblkTab.byteLength) {
            return null;
        }

        const blockColl = await this.fetchBlockCollection(mod, dataFetcher);
        const trkblk = this.trkblkTab.getUint16(mod * 2);
        const blockNum = trkblk + sub;
        return blockColl.getBlockModel(blockNum);
    }

    private async fetchBlockCollection(mod: number, dataFetcher: DataFetcher): Promise<BlockCollection> {
        if (this.blockColls[mod] === undefined) {
            const subdir = getSubdir(mod, this.gameInfo);
            const modNum = getModFileNum(mod);
            const tabPath = `${subdir}/1_mod${modNum}.tab`;
            const binPath = `${subdir}/1_mod${modNum}.bin`;
            const [blockColl, _] = await Promise.all([
                BlockCollection.create(this.gameInfo, dataFetcher, tabPath, binPath, this.materialFactory, this.texFetcher, ModelVersion.Early3),
                this.texFetcher.loadSubdirs([subdir], dataFetcher),
            ]);
            this.blockColls[mod] = blockColl;
        }

        return this.blockColls[mod]!;
    }

    public destroy(device: GfxDevice) {
        for (let coll of this.blockColls)
            if (coll !== undefined)
                coll.destroy(device);
    }
}

export class EARLY4BLOCKFETCHER implements BlockFetcher {
    private trkblkTab!: DataView;
    private blockColls: (BlockCollection | undefined)[] = [];
    private texFetcher!: TextureFetcher;

    private constructor(private gameInfo: GameInfo, private device: GfxDevice, private materialFactory: MaterialFactory, private animController: SFAAnimationController) {
    }

    private async init(dataFetcher: DataFetcher, texFetcherPromise: Promise<TextureFetcher>) {
        const pathBase = this.gameInfo.pathBase;
        const [trkblk, texFetcher] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/TRKBLK.tab`),
            texFetcherPromise,
        ]);
        this.trkblkTab = trkblk.createDataView();
        this.texFetcher = texFetcher;
    }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, device: GfxDevice, materialFactory: MaterialFactory, animController: SFAAnimationController, texFetcherPromise: Promise<TextureFetcher>) {
        const self = new EARLY4BLOCKFETCHER(gameInfo, device, materialFactory, animController);
        await self.init(dataFetcher, texFetcherPromise);
        return self;
    }

    public async fetchBlock(mod: number, sub: number, dataFetcher: DataFetcher): Promise<Model | null> {
        if (mod < 0 || mod * 2 >= this.trkblkTab.byteLength) {
            return null;
        }

        const blockColl = await this.fetchBlockCollection(mod, dataFetcher);
        const trkblk = this.trkblkTab.getUint16(mod * 2);
        const blockNum = trkblk + sub;
        return blockColl.getBlockModel(blockNum);
    }

    private async fetchBlockCollection(mod: number, dataFetcher: DataFetcher): Promise<BlockCollection> {
        if (this.blockColls[mod] === undefined) {
            const subdir = getSubdir(mod, this.gameInfo);
            const modNum = getModFileNum(mod);
            const tabPath = `${subdir}/lzo_mod${modNum}.tab`;
            const binPath = `${subdir}/lzo_mod${modNum}.bin`;
            const [blockColl, _] = await Promise.all([
                BlockCollection.create(this.gameInfo, dataFetcher, tabPath, binPath, this.materialFactory, this.texFetcher, ModelVersion.Early4),
                this.texFetcher.loadSubdirs([subdir], dataFetcher),
            ]);
            this.blockColls[mod] = blockColl;
        }

        return this.blockColls[mod]!;
    }

    public destroy(device: GfxDevice) {
        for (let coll of this.blockColls)
            if (coll !== undefined)
                coll.destroy(device);
    }
}

export class SwapcircleBlockFetcher implements BlockFetcher {
    private blockColl!: BlockCollection;

    private constructor(private gameInfo: GameInfo, private materialFactory: MaterialFactory, private texFetcher: TextureFetcher) {
    }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, materialFactory: MaterialFactory, texFetcher: TextureFetcher) {
        const self = new SwapcircleBlockFetcher(gameInfo, materialFactory, texFetcher);

        const subdir = `swapcircle`;
        const tabPath = `${subdir}/mod22.tab`;
        const binPath = `${subdir}/mod22.bin`;
        self.blockColl = await BlockCollection.create(self.gameInfo, dataFetcher, tabPath, binPath, self.materialFactory, self.texFetcher, ModelVersion.BetaMap);

        return self;
    }

    public async fetchBlock(mod: number, sub: number, dataFetcher: DataFetcher): Promise<Model | null> {
        console.log(`fetching swapcircle block ${mod}.${sub}`);
        return this.blockColl.getBlockModel(0x21c + sub);
    }

    public destroy(device: GfxDevice) {
        this.blockColl.destroy(device);
    }
}

// Maps mod numbers to block numbers. Values are hand-crafted. 
const ANCIENT_TRKBLK: {[key: number]: number} = {
    1: 0x16, // mod1.0..12
    2: 0x23, // mod2.0..21
    3: 0x39, // mod3.0..29
    4: 0x57, // mod4.0..54
    5: 0x0, // mod5.0..21
    6: 0x8e, // mod6.0..21
    7: 0xa4, // mod7.0..21
    8: 0xba, // mod8.0..21
    9: 0xd0, // mod9.0..21
    10: 0xe6, // mod10.0..21
    11: 0xfc, // mod11.0..22
    12: 0x113, // mod12.0..21
    13: 0x129, // mod13.0..25
    14: 0x143, // mod14.0..21
    15: 0x159, // mod15.0..38
    16: 0x180, // mod16.0..63
    17: 0x1c0, // mod17.0..4
    18: 0x1c5, // mod18.0..21
    19: 0x1db, // mod19.0..34
    20: 0x1fe, // mod20.0..21
    21: 0x214, // mod21.0..21
    22: 0x22a, // mod22.0..21
    23: 0x240, // mod23.0..21
    24: 0x256, // mod24.0..21
    25: 0x26c, // mod25.0..21
    26: 0x282, // mod26.0..21
    27: 0x298, // mod27.0..43
    28: 0x2c4, // mod28.0..21
    29: 0x2da, // mod29.0..21
    30: 0x2f0, // mod30.0..21
    31: 0x306, // mod31.0..13
    32: 0x314, // mod32.0..16
    33: 0x325, // mod33.0..15
    34: 0x335, // mod34.0..21
    35: 0x34b, // mod35.0..23
    36: 0x363, // mod36.0..4
    37: 0x368, // mod37.0..21
    38: 0x37e, // mod38.0..21
    39: 0x394, // mod39.0..21
    40: 0x3aa, // mod40.0..21
    41: 0x3c0, // mod41.0..21
    42: 0x3d6, // mod42.0..21
    43: 0x3ec, // mod43.0..21
    44: 0x402, // mod44.0..21
    45: 0x418, // mod45.0..21
    46: 0x42e, // mod46.0
    47: 0x42f, // mod47.0..21
    48: 0x445, // mod48.0..21
    49: 0x45b, // mod49.0..21
    50: 0x471, // mod50.0..21
    51: 0x487, // mod51.0..23
    52: 0x49f, // mod52.0..21
    53: 0x4b5, // mod53.0..21
    54: 0x4cb, // mod54.0..15
    55: 0x4db, // mod55.0..21
};

export class DPBlockFetcher implements BlockFetcher {
    private trkblkTab!: DataView;
    private texFetcher: TextureFetcher;
    private pathBase: string;
    private hitsTab: DataView | null = null;
    private hitsBin: DataView | null = null;

    private constructor(private materialFactory: MaterialFactory, texFetcher: TextureFetcher, pathBase: string) {
        this.texFetcher = texFetcher;
        this.pathBase = pathBase;
    }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, materialFactory: MaterialFactory, texFetcherPromise: Promise<TextureFetcher>): Promise<DPBlockFetcher> {
        const texFetcher = await texFetcherPromise;
        const pathBase = gameInfo.pathBase; 

        const [trkblk, hitsTab, hitsBin] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/TRKBLK.bin`),
            dataFetcher.fetchData(`${pathBase}/HITS.tab`, { allow404: true }),
            dataFetcher.fetchData(`${pathBase}/HITS.bin`, { allow404: true }),
        ]);

        const self = new DPBlockFetcher(materialFactory, texFetcher, pathBase);
        self.trkblkTab = trkblk.createDataView();
        self.hitsTab = hitsTab.createDataView();
        self.hitsBin = hitsBin.createDataView();
        return self;
    }

    private parseOneHitLine(absOffs: number): any | null {
        if (!this.hitsBin)
            return null;

        const dv = this.hitsBin;
        if (absOffs < 0 || absOffs + 0x14 > dv.byteLength)
            return null;

        return null;
    }

    private getHitsForBlock(blockNum: number): any[] {
        if (!this.hitsTab || !this.hitsBin)
            return [];

        const entryOff = blockNum * 4;
        if (entryOff + 4 > this.hitsTab.byteLength)
            return [];

        const start = this.hitsTab.getUint32(entryOff, false);
        if (start === 0xFFFFFFFF || start >= this.hitsBin.byteLength)
            return [];

        let end = this.hitsBin.byteLength;
        for (let i = blockNum + 1; (i * 4 + 4) <= this.hitsTab.byteLength; i++) {
            const next = this.hitsTab.getUint32(i * 4, false);
            if (next !== 0xFFFFFFFF && next > start && next <= this.hitsBin.byteLength) {
                end = next;
                break;
            }
        }

        const out: any[] = [];
        for (let offs = start; offs + 0x14 <= end; offs += 0x14) {
            const line = this.parseOneHitLine(offs);
            if (line)
                out.push(line);
        }

        return out;
    }

    public async fetchBlock(mod: number, sub: number, dataFetcher: DataFetcher): Promise<Model | null> {
        if (mod * 2 >= this.trkblkTab.byteLength) return null;
        const blockBase = this.trkblkTab.getUint16(mod * 2, false);
        const blockNum = blockBase + sub;

        const url = `${this.pathBase}/uncompressed_blocks/${blockNum}.bin`;
        
        try {
            const buffer = await dataFetcher.fetchData(url);
this.materialFactory.beginDPMapBlockBuild();
try {
    return loadModel(buffer.createDataView(), this.texFetcher, this.materialFactory, ModelVersion.DinosaurPlanet);
} finally {
    this.materialFactory.endDPMapBlockBuild();
}
        } catch (e) {
            return null;
        }
    }
}

export class AncientBlockFetcher implements BlockFetcher {
    blocksTab!: DataView;
    blocksBin!: ArrayBufferSlice;
    texFetcher: TextureFetcher;

    private constructor(
        private materialFactory: MaterialFactory,
        texFetcher: TextureFetcher
    ) {
        this.texFetcher = texFetcher;
    }

    public static async create(
        gameInfo: GameInfo,
        dataFetcher: DataFetcher,
        materialFactory: MaterialFactory,
        texFetcherPromise: Promise<TextureFetcher>
    ): Promise<AncientBlockFetcher> {
        const texFetcher = await texFetcherPromise;

        const pathBase = gameInfo.pathBase;
        const [tab, bin] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/BLOCKS.tab`),
            dataFetcher.fetchData(`${pathBase}/BLOCKS.bin`),
        ]);

        const self = new AncientBlockFetcher(materialFactory, texFetcher);
        self.blocksTab = tab.createDataView();
        self.blocksBin = bin;
        return self;
    }

    public async fetchBlock(mod: number, sub: number): Promise<Model | null> {
        const base = ANCIENT_TRKBLK[mod];
        if (base === undefined) return null;

        const num = base + sub;
        if (num < 0 || num * 4 >= this.blocksTab.byteLength)
            return null;

        const blockOffset = readUint32(this.blocksTab, 0, num);
        const blockData = this.blocksBin.slice(blockOffset).createDataView();

        return loadModel(blockData, this.texFetcher, this.materialFactory, ModelVersion.AncientMap);
    }
}

