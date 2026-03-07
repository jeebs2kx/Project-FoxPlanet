import { vec3,mat4 } from 'gl-matrix';
import ArrayBufferSlice from '../ArrayBufferSlice.js';
import { AABB } from '../Geometry.js';
import { GX_Array, GX_VtxAttrFmt, GX_VtxDesc } from '../gx/gx_displaylist.js';
import * as GX from '../gx/gx_enum.js';
import { nArray } from '../util.js';
import {
  parseShader,
  ANCIENT_MAP_SHADER_FIELDS,
  SFA_SHADER_FIELDS,
  BETA_MODEL_SHADER_FIELDS,
  BETA_MAP_SHADER_FIELDS,
  SFADEMO_MAP_SHADER_FIELDS,
  SFADEMO_MODEL_SHADER_FIELDS,
  EARLY2_MAP_SHADER_FIELDS,
  EARLY3_MAP_SHADER_FIELDS,
  VERY_EARLY_2001,
} from './materialloader.js';
import {
  MaterialFactory,
  NormalFlags,
  LightFlags, 
  SFAMaterial,
  Shader,
  ShaderAttrFlags,
  ShaderFlags,
} from './materials.js';
import { Model, ModelShapes } from './models.js';
import { Shape, ShapeGeometry, ShapeMaterial } from './shapes.js';
import { Skeleton } from './skeleton.js';
import { TextureFetcher } from './textures.js';
import {
  dataCopy,
  dataSubarray,
  LowBitReader,
  readUint16,
  readUint32,
  readVec3,
} from './util.js';

export enum ModelVersion {
  AncientMap,
  Beta,
  BetaMap,
  Demo,
  cloudtreasure,
  DemoMap,
  Final,
  FinalMap,
  fear,
  dfpt,
  dup,
  Early1,
  Early2,
  Early3,
  Early4,
  DinosaurPlanet,
}

interface DisplayListInfo {
  offset: number;
  size: number;
  aabb?: AABB;
  specialBitAddress?: number; // Command bit address for fur/grass or water
  sortLayer?: number; // Used in map blocks only
}

function parseDisplayListInfo(data: DataView): DisplayListInfo {
  return {
    offset: data.getUint32(0x0),
    size: data.getUint16(0x4),
    aabb: new AABB(
      data.getInt16(0x6) / 8,
      data.getInt16(0x8) / 8,
      data.getInt16(0xa) / 8,
      data.getInt16(0xc) / 8,
      data.getInt16(0xe) / 8,
      data.getInt16(0x10) / 8,
    ),
    specialBitAddress: data.getUint16(0x14), // Points to fur and water shapes
    sortLayer: data.getUint8(0x18), // Used in map blocks only
  }
}

interface FineSkinningConfig {
  numPieces: number;
  quantizeScale: number;
}

const FineSkinningPiece_SIZE = 0x74;

interface FineSkinningPiece {
  skinDataSrcOffs: number;
  weightsSrc: number;
  bone0: number;
  bone1: number;
  weightsBlockCount: number;
  numVertices: number;
  skinMeOffset: number;
  skinSrcBlockCount: number; // A block is 32 bytes
}

function parseFineSkinningConfig(data: DataView): FineSkinningConfig {
  return {
    numPieces: data.getUint16(0x2),
    quantizeScale: data.getUint8(0x6),
  };
}

function parseFineSkinningPiece(data: DataView): FineSkinningPiece {
  return {
    skinDataSrcOffs: data.getUint32(0x60),
    weightsSrc: data.getUint32(0x64),
    bone0: data.getUint8(0x6c),
    bone1: data.getUint8(0x6d),
    weightsBlockCount: data.getUint8(0x6f),
    numVertices: data.getUint16(0x70),
    skinMeOffset: data.getUint8(0x72),
    skinSrcBlockCount: data.getUint8(0x73),
  };
}

type BuildMaterialFunc = (
  shader: Shader,
  texFetcher: TextureFetcher,
  texIds: number[],
  isMapBlock: boolean,
) => SFAMaterial;

// Generate vertex attribute tables.
// The game initializes the VATs upon startup and uses them unchanged for nearly
// everything.
// The final version of the game has a minor difference in VAT 5 compared to beta
// and older versions.
function generateVat(old: boolean, nbt: boolean): GX_VtxAttrFmt[][] {
  const vat: GX_VtxAttrFmt[][] = nArray(8, () => []);
  for (let i = 0; i <= GX.Attr.MAX; i++) {
    for (let j = 0; j < 8; j++)
      vat[j][i] = { compType: GX.CompType.U8, compShift: 0, compCnt: 0 };
  }

  vat[0][GX.Attr.POS] = { compType: GX.CompType.S16, compShift: 0, compCnt: GX.CompCnt.POS_XYZ };
  vat[0][GX.Attr.CLR0] = { compType: GX.CompType.RGBA8, compShift: 0, compCnt: GX.CompCnt.CLR_RGBA };
  vat[0][GX.Attr.TEX0] = { compType: GX.CompType.S16, compShift: 10, compCnt: GX.CompCnt.TEX_ST };

  vat[1][GX.Attr.POS] = { compType: GX.CompType.S16, compShift: 2, compCnt: GX.CompCnt.POS_XYZ };
  vat[1][GX.Attr.CLR0] = { compType: GX.CompType.RGBA8, compShift: 0, compCnt: GX.CompCnt.CLR_RGBA };
  vat[1][GX.Attr.TEX0] = { compType: GX.CompType.F32, compShift: 0, compCnt: GX.CompCnt.TEX_ST };

  vat[2][GX.Attr.POS] = { compType: GX.CompType.F32, compShift: 0, compCnt: GX.CompCnt.POS_XYZ };
  vat[2][GX.Attr.NRM] = { compType: GX.CompType.F32, compShift: 0, compCnt: GX.CompCnt.NRM_XYZ };
  vat[2][GX.Attr.CLR0] = { compType: GX.CompType.RGBA8, compShift: 0, compCnt: GX.CompCnt.CLR_RGBA };
  vat[2][GX.Attr.TEX0] = { compType: GX.CompType.F32, compShift: 0, compCnt: GX.CompCnt.TEX_ST };
  vat[2][GX.Attr.TEX1] = { compType: GX.CompType.F32, compShift: 0, compCnt: GX.CompCnt.TEX_ST };

  vat[3][GX.Attr.POS] = { compType: GX.CompType.S16, compShift: 8, compCnt: GX.CompCnt.POS_XYZ };
  vat[3][GX.Attr.NRM] = { compType: GX.CompType.S8, compShift: 0, compCnt: nbt ? GX.CompCnt.NRM_NBT : GX.CompCnt.NRM_XYZ };
  vat[3][GX.Attr.CLR0] = { compType: GX.CompType.RGBA4, compShift: 0, compCnt: GX.CompCnt.CLR_RGBA };
  vat[3][GX.Attr.TEX0] = { compType: GX.CompType.S16, compShift: 10, compCnt: GX.CompCnt.TEX_ST };
  vat[3][GX.Attr.TEX1] = { compType: GX.CompType.S16, compShift: 10, compCnt: GX.CompCnt.TEX_ST };
  vat[3][GX.Attr.TEX2] = { compType: GX.CompType.S16, compShift: 10, compCnt: GX.CompCnt.TEX_ST };
  vat[3][GX.Attr.TEX3] = { compType: GX.CompType.S16, compShift: 10, compCnt: GX.CompCnt.TEX_ST };

  vat[4][GX.Attr.POS] = { compType: GX.CompType.F32, compShift: 0, compCnt: GX.CompCnt.POS_XYZ };
  vat[4][GX.Attr.NRM] = { compType: GX.CompType.F32, compShift: 0, compCnt: GX.CompCnt.NRM_XYZ };
  vat[4][GX.Attr.CLR0] = { compType: GX.CompType.RGBA8, compShift: 0, compCnt: GX.CompCnt.CLR_RGBA };
  vat[4][GX.Attr.TEX0] = { compType: GX.CompType.S16, compShift: 7, compCnt: GX.CompCnt.TEX_ST };

  // The final version uses a 1/8 quantization factor; older versions do not use quantization.
  vat[5][GX.Attr.POS] = { compType: GX.CompType.S16, compShift: old ? 0 : 3, compCnt: GX.CompCnt.POS_XYZ };
  vat[5][GX.Attr.NRM] = { compType: GX.CompType.S8, compShift: 0, compCnt: nbt ? GX.CompCnt.NRM_NBT : GX.CompCnt.NRM_XYZ };
  vat[5][GX.Attr.CLR0] = { compType: GX.CompType.RGBA4, compShift: 0, compCnt: GX.CompCnt.CLR_RGBA };
  vat[5][GX.Attr.TEX0] = { compType: GX.CompType.S16, compShift: 8, compCnt: GX.CompCnt.TEX_ST };
  vat[5][GX.Attr.TEX1] = { compType: GX.CompType.S16, compShift: 8, compCnt: GX.CompCnt.TEX_ST };
  vat[5][GX.Attr.TEX2] = { compType: GX.CompType.S16, compShift: 8, compCnt: GX.CompCnt.TEX_ST };
  vat[5][GX.Attr.TEX3] = { compType: GX.CompType.S16, compShift: 8, compCnt: GX.CompCnt.TEX_ST };

  vat[6][GX.Attr.POS] = { compType: GX.CompType.S16, compShift: 8, compCnt: GX.CompCnt.POS_XYZ };
  vat[6][GX.Attr.NRM] = { compType: GX.CompType.S8, compShift: 0, compCnt: nbt ? GX.CompCnt.NRM_NBT : GX.CompCnt.NRM_XYZ };
  vat[6][GX.Attr.CLR0] = { compType: GX.CompType.RGBA4, compShift: 0, compCnt: GX.CompCnt.CLR_RGBA };
  vat[6][GX.Attr.TEX0] = { compType: GX.CompType.S16, compShift: 10, compCnt: GX.CompCnt.TEX_ST };
  vat[6][GX.Attr.TEX1] = { compType: GX.CompType.S16, compShift: 10, compCnt: GX.CompCnt.TEX_ST };
  vat[6][GX.Attr.TEX2] = { compType: GX.CompType.S16, compShift: 10, compCnt: GX.CompCnt.TEX_ST };
  vat[6][GX.Attr.TEX3] = { compType: GX.CompType.S16, compShift: 10, compCnt: GX.CompCnt.TEX_ST };

  vat[7][GX.Attr.POS] = { compType: GX.CompType.S16, compShift: 0, compCnt: GX.CompCnt.POS_XYZ };
  vat[7][GX.Attr.NRM] = { compType: GX.CompType.S8, compShift: 0, compCnt: nbt ? GX.CompCnt.NRM_NBT : GX.CompCnt.NRM_XYZ };
  vat[7][GX.Attr.CLR0] = { compType: GX.CompType.RGBA4, compShift: 0, compCnt: GX.CompCnt.CLR_RGBA };
  vat[7][GX.Attr.TEX0] = { compType: GX.CompType.S16, compShift: 10, compCnt: GX.CompCnt.TEX_ST };
  vat[7][GX.Attr.TEX1] = { compType: GX.CompType.S16, compShift: 10, compCnt: GX.CompCnt.TEX_ST };
  vat[7][GX.Attr.TEX2] = { compType: GX.CompType.S16, compShift: 10, compCnt: GX.CompCnt.TEX_ST };
  vat[7][GX.Attr.TEX3] = { compType: GX.CompType.S16, compShift: 10, compCnt: GX.CompCnt.TEX_ST };

  return vat;
}

const VAT = generateVat(false, false);
const VAT_NBT = generateVat(false, true);
const OLD_VAT = generateVat(true, false);
const OLD_VAT_NBT = generateVat(true, true); // ← add this

const FIELDS: any = {
  [ModelVersion.AncientMap]: {
    isBeta: true,
    isMapBlock: true,
    shaderFields: ANCIENT_MAP_SHADER_FIELDS,
    hasNormals: false,
    hasBones: false,
    texOffset: 0x58,
    posOffset: 0x5c,
    clrOffset: 0x60,
    texcoordOffset: 0x64,
    shaderOffset: 0x68,
    listOffsets: 0x6c,
    listSizes: 0x70,
    posCount: 0x90,
    clrCount: 0x94,
    texcoordCount: 0x98,
    texCount: 0x99,
    shaderCount: 0x9a,
    dlOffsets: 0x6c,
    dlSizes: 0x70,
    dlInfoCount: 0x99,
    numListBits: 6,
    bitsOffsets: [0x7c],
    bitsByteCounts: [0x86],
    oldVat: true,
    hasYTranslate: false,
  },

  [ModelVersion.Beta]: {
    isBeta: true,
    isMapBlock: false,
    shaderFields: BETA_MODEL_SHADER_FIELDS,
    hasNormals: true,
    hasBones: true,
    texOffset: 0x1c,
    posOffset: 0x24,
    nrmOffset: 0x28, // ???
    clrOffset: 0x2c,
    texcoordOffset: 0x30,
    shaderOffset: 0x34,
    jointOffset: 0x38,
    listOffsets: 0x6c,
    listSizes: 0x70,
    posCount: 0x9e,
    nrmCount: 0xa0,
    clrCount: 0xa2,
    texcoordCount: 0xa4,
    texCount: 0xaa,
    jointCount: 0xab,
    posFineSkinningConfig: 0x64,
    posFineSkinningPieces: 0x80,
    posFineSkinningWeights: 0x84,
    // nrmFineSkinningConfig: 0xac, // ???
    weightCount: 0xad,
    shaderCount: 0xae,
    texMtxCount: 0xaf,
    dlOffsets: 0x88,
    dlSizes: 0x8c,
    dlInfoCount: 0xac,
    numListBits: 6,
    bitsOffsets: [0x90],
    bitsByteCounts: [0x94],
    oldVat: true,
    hasYTranslate: false,
  },

  [ModelVersion.BetaMap]: {
    isBeta: true,
    isMapBlock: true,
    shaderFields: BETA_MAP_SHADER_FIELDS,
    hasNormals: false,
    hasBones: false,
    texOffset: 0x58,
    posOffset: 0x5c,
    clrOffset: 0x60,
    texcoordOffset: 0x64,
    shaderOffset: 0x68,
    listOffsets: 0x6c,
    listSizes: 0x70,
    posCount: 0x9e,
    clrCount: 0xa2,
    texcoordCount: 0xa4,
    texCount: 0x98,
    shaderCount: 0x99, // ???
    texMtxCount: 0xaf,
    dlOffsets: 0x6c,
    dlSizes: 0x70,
    dlInfoCount: 0x99, // ???
    numListBits: 6,
    bitsOffsets: [0x7c],
    bitsByteCounts: [0x94], // ???
    oldVat: true,
    hasYTranslate: false,
  },

  [ModelVersion.Demo]: {
    isMapBlock: false,
    texOffset: 0x20,
    texCount: 0xda, //new! (05)
    posOffset: 0x28,
    posCount: 0xcc, //new
    hasNormals: true,
    nrmOffset: 0x2c,
    nrmCount: 0xce, //new
    clrOffset: 0x30,
    clrCount: 0xd0, // new
    texcoordOffset: 0x34,
    texcoordCount: 0xd2, // new (0732)
    hasBones: true,
    jointOffset: 0x3c,
    jointCount: 0xdb, //NEW
    weightOffset: 0x54,
    weightCount: 0xdc, //NEw
    posFineSkinningConfig: 0x88,
    posFineSkinningPieces: 0xa4,
    posFineSkinningWeights: 0xa8,
    nrmFineSkinningConfig: 0xac,
    shaderOffset: 0x38,
    shaderCount: 0xde, // NEW (might be E0)
    shaderFields: SFADEMO_MODEL_SHADER_FIELDS,
    dlInfoOffset: 0xb8,
    dlInfoCount: 0xc9, //NEW
    dlInfoSize: 0x34,
    numListBits: 8,
    bitsOffsets: [0xbc], // Whoa... (might be BC, then below C0)
    bitsByteCounts: [0xc0],
    oldVat: true,
    hasYTranslate: false,
  },

  [ModelVersion.DemoMap]: {
    isMapBlock: true,
    texOffset: 0x54,
    texCount: 0xa0,
    posOffset: 0x58,
    posCount: 0x90,
    hasNormals: false,
    nrmOffset: 0,
    nrmCount: 0,
    clrOffset: 0x5c,
    clrCount: 0x94,
    texcoordOffset: 0x60,
    texcoordCount: 0x96,
    hasBones: false,
    jointOffset: 0,
    jointCount: 0,
    shaderOffset: 0x64,
    shaderCount: 0xa0, // Polygon attributes and material information
    shaderFields: SFADEMO_MAP_SHADER_FIELDS,
    dlInfoOffset: 0x68,
    dlInfoCount: 0x9f,
    dlInfoSize: 0x34,
    // FIXME: Yet another format occurs in sfademo/frontend!
    // numListBits: 6, // 6 is needed for mod12; 8 is needed for early crfort?!
    numListBits: 8, // ??? should be 6 according to decompilation of demo????
    bitsOffsets: [0x74], // Whoa...
    // FIXME: There are three bitstreams, probably for opaque and transparent objects
    bitsByteCounts: [0x84],
    oldVat: true,
    hasYTranslate: false,
  },

  [ModelVersion.Final]: {
    isFinal: true,
    isMapBlock: false,
    texOffset: 0x20,
    texCount: 0xf2,
    posOffset: 0x28,
    posCount: 0xe4,
    hasNormals: true,
    nrmOffset: 0x2c,
    nrmCount: 0xe6,
    clrOffset: 0x30,
    clrCount: 0xe8,
    texcoordOffset: 0x34,
    texcoordCount: 0xea,
    hasBones: true,
    jointOffset: 0x3c,
    jointCount: 0xf3,
    weightOffset: 0x54,
    weightCount: 0xf4,
    posFineSkinningConfig: 0x88,
    posFineSkinningPieces: 0xa4,
    posFineSkinningWeights: 0xa8,
    nrmFineSkinningConfig: 0xac,
    nrmFineSkinningPieces: 0xc8,
    nrmFineSkinningWeights: 0xcc,
    shaderOffset: 0x38,
    shaderCount: 0xf8,
    shaderFields: SFA_SHADER_FIELDS,
    texMtxCount: 0xfa,
    dlInfoOffset: 0xd0,
    dlInfoCount: 0xf5,
    dlInfoSize: 0x1c,
    numListBits: 8,
    bitsOffsets: [0xd4],
    bitsByteCounts: [0xd8],
    oldVat: false,
    hasYTranslate: false,
  },

  [ModelVersion.FinalMap]: {
    isFinal: true,
    isMapBlock: true,
    texOffset: 0x54,
    texCount: 0xa0,
    posOffset: 0x58,
    posCount: 0x90,
    hasNormals: false,
    nrmOffset: 0,
    nrmCount: 0,
    clrOffset: 0x5c,
    clrCount: 0x94,
    texcoordOffset: 0x60,
    texcoordCount: 0x96,
    hasBones: false,
    jointOffset: 0,
    jointCount: 0,
    shaderOffset: 0x64,
    shaderCount: 0xa2,
    shaderFields: SFA_SHADER_FIELDS,
    dlInfoOffset: 0x68,
    dlInfoCount: 0xa1, // TODO
    dlInfoSize: 0x1c,
    numListBits: 8,
    bitsOffsets: [0x78, 0x7c, 0x80],
    bitsByteCounts: [0x84, 0x86, 0x88],
    oldVat: false,
    hasYTranslate: true,
  },

  [ModelVersion.fear]: {
    isBeta: false,
    isMapBlock: true,
    texOffset: 0x58,
    texCount: 0xa4,
    posOffset: 0x5c,
    posCount: 0x8e,
    hasNormals: false,
    nrmOffset: 0,
    nrmCount: 0,
    clrOffset: 0x60,
    clrCount: 0x92,
    texcoordOffset: 0x64,
    texcoordCount: 0x94,
    hasBones: false,
    jointOffset: 0,
    jointCount: 0,
    shaderOffset: 0x68,
    shaderCount: 0xa6,
    shaderFields: VERY_EARLY_2001,
    dlInfoOffset: 0x6c,
    dlInfoCount: 0xa5, // TODO
    dlInfoSize: 0x34,
    numListBits: 6,
    bitsOffsets: [0x78, 0x80, 0x88],
    bitsByteCounts: [0x7c, 0x84, 0x8c],
    oldVat: true,
    hasYTranslate: false,
  },

  [ModelVersion.dfpt]: {
    isBeta: false,
    isMapBlock: true,
    texOffset: 0x54,
    texCount: 0x9e,
    posOffset: 0x58,
    posCount: 0x8e,
    hasNormals: false,
    nrmOffset: 0,
    nrmCount: 0,
    clrOffset: 0x5c,
    clrCount: 0x92,
    texcoordOffset: 0x60,
    texcoordCount: 0x94,
    hasBones: false,
    jointOffset: 0,
    jointCount: 0,
    shaderOffset: 0x64,
    shaderCount: 0xa0,
    shaderFields: VERY_EARLY_2001,
    dlInfoOffset: 0x68,
    dlInfoCount: 0x9f, // TODO
    dlInfoSize: 0x34,
    numListBits: 6,
    bitsOffsets: [0x74, 0x7c, 0x84],
    bitsByteCounts: [0x86, 0x88, 0x8a],
    oldVat: true,
    hasYTranslate: false,
  },

  [ModelVersion.dup]: {
    isBeta: false,
    isMapBlock: true,
    texOffset: 0x54,
    texCount: 0x9e,
    posOffset: 0x58,
    posCount: 0x8e,
    hasNormals: false,
    nrmOffset: 0,
    nrmCount: 0,
    clrOffset: 0x5c,
    clrCount: 0x92,
    texcoordOffset: 0x60,
    texcoordCount: 0x94,
    hasBones: false,
    jointOffset: 0,
    jointCount: 0,
    shaderOffset: 0x64,
    shaderCount: 0xa0,
    shaderFields: SFADEMO_MAP_SHADER_FIELDS,
    dlInfoOffset: 0x68,
    dlInfoCount: 0x9f, // TODO
    dlInfoSize: 0x34,
    numListBits: 8,
    bitsOffsets: [0x74, 0x7c, 0x84],
    bitsByteCounts: [0x86, 0x88, 0x8a],
    oldVat: true,
    hasYTranslate: false,
  },

  [ModelVersion.Early1]: {
    isBeta: false,
    isMapBlock: true,
    texOffset: 0x54,
    texCount: 0x9e,
    posOffset: 0x58,
    posCount: 0x8e,
    hasNormals: false,
    nrmOffset: 0,
    nrmCount: 0,
    clrOffset: 0x5c,
    clrCount: 0x92,
    texcoordOffset: 0x60,
    texcoordCount: 0x94,
    hasBones: false,
    jointOffset: 0,
    jointCount: 0,
    shaderOffset: 0x64,
    shaderCount: 0xa0,
    shaderFields: SFADEMO_MAP_SHADER_FIELDS,
    dlInfoOffset: 0x68,
    dlInfoCount: 0x9f,
    dlInfoSize: 0x34,
    numListBits: 8,
    bitsOffsets: [0x74, 0x7c, 0x84],
    bitsByteCounts: [0x86, 0x88, 0x8a],
    oldVat: true,
    hasYTranslate: false,
  },

  [ModelVersion.Early2]: {
    isfinal: false,
    isMapBlock: true,
    texOffset: 0x54,
    texCount: 0x9e,
    posOffset: 0x58,
    posCount: 0x8e,
    hasNormals: false,
    nrmOffset: 0,
    nrmCount: 0,
    clrOffset: 0x5c,
    clrCount: 0x92,
    texcoordOffset: 0x60,
    texcoordCount: 0x94,
    hasBones: false,
    jointOffset: 0,
    jointCount: 0,
    shaderOffset: 0x64,
    shaderCount: 0xa0,
    shaderFields: EARLY2_MAP_SHADER_FIELDS,
    dlInfoOffset: 0x68,
    dlInfoCount: 0x9f, // TODO
    dlInfoSize: 0x38,
    numListBits: 8,
    bitsOffsets: [0x74, 0x7c, 0x84],
    bitsByteCounts: [0x84, 0x86, 0x88],
    oldVat: true,
    hasYTranslate: false,
  },

  [ModelVersion.Early3]: {
    isFinal: false,
    isMapBlock: true,
    texOffset: 0x54,
    texCount: 0x9e,
    posOffset: 0x58,
    posCount: 0x8e,
    hasNormals: false,
    nrmOffset: 0,
    nrmCount: 0,
    clrOffset: 0x5c,
    clrCount: 0x92,
    texcoordOffset: 0x60,
    texcoordCount: 0x94,
    hasBones: false,
    jointOffset: 0,
    jointCount: 0,
    shaderOffset: 0x64,
    shaderCount: 0xa0,
    shaderFields: EARLY3_MAP_SHADER_FIELDS,
    dlInfoOffset: 0x68,
    dlInfoCount: 0x9f, // TODO
    dlInfoSize: 0x38,
    numListBits: 8,
    bitsOffsets: [0x78, 0x7c, 0x80],
    bitsByteCounts: [0x84, 0x86, 0x88],
    oldVat: true,
    hasYTranslate: false,
  },

  [ModelVersion.Early4]: {
    isFinal: false,
    isMapBlock: true,
    texOffset: 0x54,
    texCount: 0x9e,
    posOffset: 0x58,
    posCount: 0x8e,
    hasNormals: false,
    nrmOffset: 0,
    nrmCount: 0,
    clrOffset: 0x5c,
    clrCount: 0x92,
    texcoordOffset: 0x60,
    texcoordCount: 0x94,
    hasBones: false,
    jointOffset: 0,
    jointCount: 0,
    shaderOffset: 0x64,
    shaderCount: 0xa0,
    shaderFields: SFA_SHADER_FIELDS,
    dlInfoOffset: 0x68,
    dlInfoCount: 0x9f, // TODO
    dlInfoSize: 0x38,
    numListBits: 8,
    bitsOffsets: [0x78, 0x7c, 0x80],
    bitsByteCounts: [0x84, 0x86, 0x88],
    oldVat: true,
    hasYTranslate: false,
  },
};

const enum Opcode {
  SetShader = 1,
  CallDL = 2,
  SetVCD = 3,
  SetMatrices = 4,
  End = 5,
}

function dumpRawBytes(data: DataView, byteCount: number = 256) {
  const bytesPerRow = 16;
  for (let offset = 0; offset < byteCount; offset += bytesPerRow) {
    const rowBytes = [] as string[];
    for (let i = 0; i < bytesPerRow; i++) {
      if (offset + i < data.byteLength) {
        rowBytes.push(data.getUint8(offset + i).toString(16).padStart(2, '0'));
      } else {
        rowBytes.push(' ');
      }
    }
    // console.log(`0x${offset.toString(16).padStart(4, '0')}: ${rowBytes.join(' ')}`);
  }
}

export function loadModel(
  data: DataView,
  texFetcher: TextureFetcher,
  materialFactory: MaterialFactory,
  version: ModelVersion,
): Model {
  dumpRawBytes(data, 256);
    if (version === ModelVersion.DinosaurPlanet) {
    return loadDinosaurPlanetModel(data, texFetcher, materialFactory);
  }
// ===== Dinosaur Planet (N64-style) loader =====
// Parses mod22.bin-like chunks: header + Vtx(16B) + tri(8B local 0..31) + batch table (0x18).

function readU32BE(d: DataView, o: number) { return d.getUint32(o, false); }
function readU16BE(d: DataView, o: number) { return d.getUint16(o, false); }
function readS16BE(d: DataView, o: number) { return d.getInt16(o, false); }

function rgba8ToRgba4_u16BE(r: number, g: number, b: number, a: number): number {
  const R = (r >>> 4) & 0xF;
  const G = (g >>> 4) & 0xF;
  const B = (b >>> 4) & 0xF;
  const A = (a >>> 4) & 0xF;
  return (R << 12) | (G << 8) | (B << 4) | A;
}

type DPBatch = {
  flags: number;
  materialId: number;
  vStart: number; vEnd: number;
  tStart: number; tEnd: number;
};

type DPTri = { flip: boolean; i0: number; i1: number; i2: number };



function loadDinosaurPlanetModel(
    data: DataView,
    texFetcher: TextureFetcher,
    materialFactory: MaterialFactory,
): Model {
    const model = new Model(ModelVersion.DinosaurPlanet);

    const ptr00 = data.getUint32(0x00);
    const ptr0C = data.getUint32(0x0C);

    const isCharacter = ptr0C > ptr00;

if (isCharacter) {
  // ==========================================
  // DINOSAUR PLANET CHARACTER PARSER
  // Fixes:
  //  - Safe handling of 0xDE/0xDF (no UI lockups)
  //  - PATCH invalid facebatches (materialID=-1) to last valid material
  //    so their triangles don't get skipped (fixes "missing bits")
  // ==========================================
  model.isMapBlock = false;

const DP_CHAR_DEBUG = true;
const DP_LOG_ALL_FACEBATCH_TEXIDS = true;
const DP_HIDE_TEXIDS_FOR_TEST = new Set<number>([]);
const DP_NO_TINT_TEXIDS = new Set<number>([237, 2576]);
  const DP_CHAR_EXEC_LIMIT = 200000;   // max executed commands total (across sub-DLs)
  const DP_CHAR_STACK_LIMIT = 32;      // max nested calls
  const DP_CHAR_LOG_LIMIT = 250;       // clamp noisy logs

  // N64 geometry mode bit (F3DEX2)
  const G_LIGHTING = 0x00020000;

  const opCounts = new Uint32Array(256);
  let sawAnyVtx = false;

  const matOff  = data.getUint32(0x00, false);
  const vtxOff  = data.getUint32(0x04, false);
  const faceOff = data.getUint32(0x08, false);
  const dlOff   = data.getUint32(0x0C, false);
  const jointOff = data.getUint32(0x20, false);

  const dlLengthRaw = data.getUint16(0x6C, false);
  const maxDlCmdsByFile = Math.max(0, ((data.byteLength - dlOff) / 8) | 0);
  const dlLength = Math.min(dlLengthRaw, maxDlCmdsByFile);

  const jointCount = Math.min(data.getUint8(0x6F), 200);
  const textureCount = Math.min(data.getUint8(0x73), 128);

  const faceBatchCountRaw = (matOff > faceOff) ? (((matOff - faceOff) / 16) | 0) : 0;
  const faceBatchCount = Math.max(0, Math.min(faceBatchCountRaw, 512));

  if (DP_CHAR_DEBUG) {
    console.warn(
      `[DP_CHAR] matOff=0x${matOff.toString(16)} vtxOff=0x${vtxOff.toString(16)} faceOff=0x${faceOff.toString(16)} ` +
      `dlOff=0x${dlOff.toString(16)} jointOff=0x${jointOff.toString(16)} dlLength=${dlLength} joints=${jointCount} ` +
      `texCount=${textureCount} faceBatches=${faceBatchCount}`
    );
  }

  // --- helpers ---
  const rgb565ToRGBA8 = (c: number) => {
    const r5 = (c >>> 11) & 0x1F;
    const g6 = (c >>> 5)  & 0x3F;
    const b5 = (c >>> 0)  & 0x1F;
    const r = ((r5 * 255 + 15) / 31) | 0;
    const g = ((g6 * 255 + 31) / 63) | 0;
    const b = ((b5 * 255 + 15) / 31) | 0;
    return { r, g, b, a: 255 };
  };
  const hex8 = (x: number) => x.toString(16).padStart(2, '0');

  // --- DP lighting helpers (when G_LIGHTING is ON, vtx[12..14] are normals) ---
  const toS8 = (u: number) => (u << 24) >> 24;
  const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

  // simple directional light (good-enough for DP)
  const Lx = 0.25, Ly = 0.85, Lz = 0.45;
  const Llen = Math.hypot(Lx, Ly, Lz) || 1;
  const L0 = Lx / Llen, L1 = Ly / Llen, L2 = Lz / Llen;

  const AMBIENT = 0.35;
  const DIFFUSE = 0.65;

  function shadeRGB(baseR: number, baseG: number, baseB: number, nxU8: number, nyU8: number, nzU8: number) {
    const nx = toS8(nxU8) / 127.0;
    const ny = toS8(nyU8) / 127.0;
    const nz = toS8(nzU8) / 127.0;
    const ndotl = Math.max(0, nx * L0 + ny * L1 + nz * L2);
    const i = AMBIENT + DIFFUSE * ndotl;
    return {
      r: clamp255(baseR * i),
      g: clamp255(baseG * i),
      b: clamp255(baseB * i),
    };
  }

  // --- MATERIAL TABLE (8 bytes each) ---
  type DPMat = {
    texId: number;
    texW: number;
    texH: number;
    tintR: number; tintG: number; tintB: number; tintA: number;
    tintEnabled: boolean;
    raw: string;
  };

  const mats: DPMat[] = [];
  const MAT_STRIDE = 8;

  for (let i = 0; i < textureCount; i++) {
    const o = matOff + i * MAT_STRIDE;
    if (o + MAT_STRIDE > data.byteLength) break;

    const rawTexSigned = data.getInt32(o + 0x00, false);
    const tintEnabled = rawTexSigned < 0;
    const rawTex = tintEnabled ? -rawTexSigned : rawTexSigned;

    const texId = rawTex & 0x7FFF;

    const texW = data.getUint8(o + 0x04) || 32;
    const texH = data.getUint8(o + 0x05) || 32;

    const tint565 = data.getUint16(o + 0x06, false);
    const tint = rgb565ToRGBA8(tint565);

    const rawBytes =
      `${hex8(data.getUint8(o+0))} ${hex8(data.getUint8(o+1))} ${hex8(data.getUint8(o+2))} ${hex8(data.getUint8(o+3))} ` +
      `${hex8(data.getUint8(o+4))} ${hex8(data.getUint8(o+5))} ${hex8(data.getUint8(o+6))} ${hex8(data.getUint8(o+7))}`;

    mats[i] = {
      texId,
      texW, texH,
      tintR: tint.r, tintG: tint.g, tintB: tint.b, tintA: 255,
      tintEnabled,
      raw: rawBytes,
    };

    if (DP_CHAR_DEBUG) {
      console.warn(
        `[DP_CHAR][MAT] matIdx=${i} texId=${texId} tex=${texW}x${texH} tint=(${tint.r},${tint.g},${tint.b},255) raw=[${rawBytes}]`
      );
    }
  }

  // --- SKELETON (optional) ---
  model.joints = [];
  model.skeleton = new Skeleton();
  model.invBindTranslations = nArray(jointCount, () => vec3.create());

  const jointMats: mat4[] = [];
  if (jointCount > 0 && jointOff !== 0 && (jointOff + jointCount * 16) <= data.byteLength) {
    for (let i = 0; i < jointCount; i++) {
      const jo = jointOff + i * 16;
      const p = data.getInt8(jo + 0);

      const lx = data.getFloat32(jo + 4, false);
      const ly = data.getFloat32(jo + 8, false);
      const lz = data.getFloat32(jo + 12, false);

      const m = mat4.create();
      if (p !== -1 && p < i && p < jointMats.length) mat4.translate(m, jointMats[p], [lx, ly, lz]);
      else mat4.fromTranslation(m, [lx, ly, lz]);
      jointMats.push(m);

      model.joints.push({
        parent: p !== -1 ? p : 0xff,
        boneNum: i,
        translation: vec3.fromValues(lx, ly, lz),
        bindTranslation: vec3.create(),
      });

      model.skeleton.addJoint(p !== -1 ? p : undefined, vec3.fromValues(lx, ly, lz));
    }
  } else if (jointCount > 0) {
    for (let i = 0; i < jointCount; i++) {
      jointMats.push(mat4.create());
      model.joints.push({ parent: 0xff, boneNum: i, translation: vec3.create(), bindTranslation: vec3.create() });
      model.skeleton.addJoint(undefined, vec3.create());
    }
  }

  // --- FACEBATCHES (16 bytes each) ---
  interface Facebatch {
    materialID: number;
    texW: number;
    texH: number;
    dlStartCmd: number;
    renderFlags: number;
    tintR: number; tintG: number; tintB: number; tintA: number;
    tintEnabled: boolean;
    _wasInvalidMat?: boolean; // debug
    tris: { i0: number; i1: number; i2: number }[];
  }

  const facebatches: Facebatch[] = [];
  for (let i = 0; i < faceBatchCount; i++) {
    const o = faceOff + i * 16;
    if (o + 16 > data.byteLength) break;

    const matIdx = data.getUint8(o + 0);
    const dlStartCmd = data.getInt16(o + 8, false);
    const renderFlags = data.getUint8(o + 0x0c);

    const m = mats[matIdx];
    const texId = m ? m.texId : -1;

    facebatches.push({
      materialID: texId,
      texW: m ? m.texW : 32,
      texH: m ? m.texH : 32,
      dlStartCmd: Math.max(0, dlStartCmd | 0),
      renderFlags,
      tintR: m ? m.tintR : 255,
      tintG: m ? m.tintG : 255,
      tintB: m ? m.tintB : 255,
      tintA: 255,
      tintEnabled: m ? m.tintEnabled : false,
      _wasInvalidMat: m ? false : true,
      tris: [],
    });
  }

  facebatches.sort((a, b) => a.dlStartCmd - b.dlStartCmd);

  // ------------------------------
  // FIX #1: Patch invalid facebatches (materialID=-1) to last known good
  // This directly prevents "missing bits" caused by skipping fb.materialID<0.
  // ------------------------------
  let patchedFB = 0;
  let lastGood: Facebatch | null = null;

  // Optional fallback if the file starts with invalids
  const fallbackTexId = (mats.length > 0) ? mats[0].texId : 0;
  const fallbackW = (mats.length > 0) ? mats[0].texW : 32;
  const fallbackH = (mats.length > 0) ? mats[0].texH : 32;

  for (const fb of facebatches) {
    if (fb.materialID >= 0) {
      lastGood = fb;
      continue;
    }
    patchedFB++;
    if (lastGood) {
      fb.materialID = lastGood.materialID;
      fb.texW = lastGood.texW;
      fb.texH = lastGood.texH;
      fb.tintR = lastGood.tintR;
      fb.tintG = lastGood.tintG;
      fb.tintB = lastGood.tintB;
      fb.tintEnabled = lastGood.tintEnabled;
    } else {
      fb.materialID = fallbackTexId;
      fb.texW = fallbackW;
      fb.texH = fallbackH;
      fb.tintR = 255;
      fb.tintG = 255;
      fb.tintB = 255;
      fb.tintEnabled = false;
    }
  }

  if (DP_CHAR_DEBUG && patchedFB > 0) {
    console.warn(`[DP_CHAR][FB_PATCH] patched ${patchedFB} invalid facebatches (materialID=-1) to last-good material`);
    // show a few patched entries
    let shown = 0;
    for (let i = 0; i < facebatches.length && shown < 8; i++) {
      const fb = facebatches[i];
      if (fb._wasInvalidMat) {
        console.warn(`  patched fb@cmd=${fb.dlStartCmd} -> texId=${fb.materialID} tex=${fb.texW}x${fb.texH} flags=0x${fb.renderFlags.toString(16)}`);
        shown++;
      }
    }
  }

  if (DP_CHAR_DEBUG) {
    console.warn(`[DP_CHAR] Facebatches (first 10):`);
    for (let i = 0; i < Math.min(10, facebatches.length); i++) {
      const fb = facebatches[i];
      console.warn(
        `  #${i} cmd=${fb.dlStartCmd} texId=${fb.materialID} tex=${fb.texW}x${fb.texH} ` +
        `tint=(${fb.tintR},${fb.tintG},${fb.tintB},255) flags=0x${fb.renderFlags.toString(16)}`
      );
    }
  }

  // --- Build VBO ---
  const outPos: number[] = [];
  const outClr: number[] = [];
  const outTex: number[] = [];
  const outBone: number[] = [];

  const vtxCache = new Int32Array(64).fill(0);
  const vtxValid = new Uint8Array(64);

  function pickSlot(x: number): number {
    const sA = (x >>> 1) & 0x3f;
    const sB = x & 0x3f;
    const aOK = vtxValid[sA] !== 0;
    const bOK = vtxValid[sB] !== 0;
    if (aOK && !bOK) return sA;
    if (bOK && !aOK) return sB;
    return sA;
  }

  const vboMap = new Map<string, number>();

  let fbIndex = -1;
  let currentFb: Facebatch | null = null;

  let primR = 255, primG = 255, primB = 255, primA = 255;
  let envR = 255, envG = 255, envB = 255, envA = 255;

  let geomMode = 0 >>> 0;
  let lightingEnabled = false;

  const segmentBases = new Uint32Array(16);
  segmentBases[0x05] = vtxOff >>> 0;
  segmentBases[0x04] = vtxOff >>> 0;

  let logCount = 0;
  const logOnce = (msg: string) => {
    if (!DP_CHAR_DEBUG) return;
    if (logCount < DP_CHAR_LOG_LIMIT) {
      logCount++;
      console.warn(msg);
      if (logCount === DP_CHAR_LOG_LIMIT)
        console.warn(`[DP_CHAR] (log limit hit: further DP_CHAR logs suppressed)`);
    }
  };

  const VALID_DL_OPS = new Set<number>([
    0x01, 0x05, 0x06, 0xD9, 0xDA, 0xDE, 0xDF, 0xE7, 0xEF, 0xFC, 0xFA, 0xFB,
  ]);

function __dpIsPlausibleDL(off: number): boolean {
  off = off >>> 0;

  // MUST be command-aligned
  if ((off & 7) !== 0) return false;

  // CRITICAL: never treat anything before the main DL blob as a displaylist
  // (prevents 0x80000002 -> 0x2)
  if (off < (dlOff >>> 0)) return false;

  if (off + 8 > (data.byteLength >>> 0)) return false;

  const op = data.getUint16(off);
  return VALID_DL_OPS.has(op);
}

function __dpResolveDLTarget(addr: number): number | null {
  addr = addr >>> 0;

  // --- DP index-form jumps ---
  // Many DP lists use G_DL with w1 = small number meaning "command index into main DL".
  // Also seen as 0x800000NN (KSEG0 + index).
  const isKseg = (addr & 0xFF000000) === 0x80000000;
  const idx = isKseg ? (addr & 0x00FFFFFF) : addr;

  if (idx !== 0 && idx < 0x1000) {
    const tgt = ((dlOff >>> 0) + (idx * 8)) >>> 0;
    if (__dpIsPlausibleDL(tgt)) return tgt;
    // fall through (maybe it's not an index in this file)
  }

  // --- segmented pointer form ---
  const seg = (addr >>> 24) & 0xFF;
  const off24 = addr & 0x00FFFFFF;

  if (seg !== 0) {
    const base = segmentBases[seg] >>> 0;
    if (base !== 0) {
      const tgt = (base + off24) >>> 0;
      if (__dpIsPlausibleDL(tgt)) return tgt;
    }
  }

  // --- absolute pointer form ---
  if (__dpIsPlausibleDL(addr)) return addr;

  return null;
}

  const returnPCStack: number[] = [];
  let dlCalls = 0;
  let dlReturns = 0;
  let dlBadTargets = 0;

  let pc = dlOff >>> 0;
  const mainEndPC = (dlOff + (dlLength * 8)) >>> 0;

  let execCmdIdx = 0;
  let currentMtxIdx = 0;

  let triBadRefs = 0;
  let vtxOob = 0;
  let unknownOps = 0;

  while (execCmdIdx < DP_CHAR_EXEC_LIMIT) {
    if (returnPCStack.length === 0 && pc >= mainEndPC) break;

    if (pc + 8 > (data.byteLength >>> 0)) {
      if (returnPCStack.length > 0) {
        pc = returnPCStack.pop()! >>> 0;
        dlReturns++;
        continue;
      }
      break;
    }

    while (fbIndex + 1 < facebatches.length && execCmdIdx >= facebatches[fbIndex + 1].dlStartCmd) {
      fbIndex++;
      currentFb = facebatches[fbIndex];
      if (DP_CHAR_DEBUG) {
        console.warn(
   //       `[DP_CHAR][FB] fbIndex=${fbIndex} startCmd=${currentFb.dlStartCmd} texId=${currentFb.materialID} ` +
   //       `flags=0x${(currentFb.renderFlags & 0xFF).toString(16)} tintEnabled=${currentFb.tintEnabled ? 1 : 0}` +
   //       `${currentFb._wasInvalidMat ? ' (patched)' : ''}`
        );
      }
    }

    const w0 = data.getUint32(pc + 0, false);
    const w1 = data.getUint32(pc + 4, false);
    const opcode = (w0 >>> 24) & 0xFF;
    opCounts[opcode]++;

    if (!sawAnyVtx && (opcode === 0x05 || opcode === 0x06)) {
      pc = (pc + 8) >>> 0;
      execCmdIdx++;
      continue;
    }

    const nextPC = (pc + 8) >>> 0;
    let jumped = false;

    if (opcode === 0xD9) {
      const clearMask = (w0 & 0x00FFFFFF) >>> 0;
      const setMask = w1 >>> 0;
      geomMode = ((geomMode & (~clearMask >>> 0)) | setMask) >>> 0;
      const newLighting = (geomMode & G_LIGHTING) !== 0;
      if (newLighting !== lightingEnabled && DP_CHAR_DEBUG) {
  //      console.warn(`[DP_CHAR] G_LIGHTING ${newLighting ? 'ON' : 'OFF'} at cmd=${execCmdIdx}`);
      }
      lightingEnabled = newLighting;

    } else if (opcode === 0xFA) {
      primR = (w1 >>> 24) & 0xFF;
      primG = (w1 >>> 16) & 0xFF;
      primB = (w1 >>> 8)  & 0xFF;
      primA = (w1 >>> 0)  & 0xFF;

    } else if (opcode === 0xFB) {
      envR = (w1 >>> 24) & 0xFF;
      envG = (w1 >>> 16) & 0xFF;
      envB = (w1 >>> 8)  & 0xFF;
      envA = (w1 >>> 0)  & 0xFF;

    } else if (opcode === 0xDA) {
      const seg = (w1 >>> 24) & 0xFF;
      if (seg === 0x03) currentMtxIdx = (((w1 & 0x00FFFFFF) / 64) | 0);

    } else if (opcode === 0xDE) {
      // Keep safe: these small addresses are NOT real DL pointers in your files
      const push = (w0 >>> 16) & 0xFF;
      const tgt = __dpResolveDLTarget(w1);
      if (tgt !== null) {
        if (tgt === pc || tgt === nextPC) {
          dlBadTargets++;
   //       logOnce(`[DP_CHAR][DL_SKIP] cmd=${execCmdIdx} push=${push} addr=0x${w1.toString(16)} -> tgt=0x${tgt.toString(16)} (self/next)`);
        } else if (returnPCStack.length >= DP_CHAR_STACK_LIMIT) {
          dlBadTargets++;
   //       logOnce(`[DP_CHAR][DL_SKIP] cmd=${execCmdIdx} push=${push} addr=0x${w1.toString(16)} -> tgt=0x${tgt.toString(16)} (stack limit)`);
        } else {
          if (push !== 0) returnPCStack.push(nextPC);
          dlCalls++;
    //      logOnce(`[DP_CHAR][DL] cmd=${execCmdIdx} push=${push} addr=0x${w1.toString(16)} -> 0x${tgt.toString(16)} depth=${returnPCStack.length}`);
          pc = tgt >>> 0;
          jumped = true;
        }
      } else {
        dlBadTargets++;
   //     logOnce(`[DP_CHAR][DL_SKIP] cmd=${execCmdIdx} push=${push} addr=0x${w1.toString(16)} (unresolved/too-small)`);
      }

    } else if (opcode === 0xDF) {
      if (returnPCStack.length > 0) {
        dlReturns++;
        const ret = returnPCStack.pop()! >>> 0;
  //      logOnce(`[DP_CHAR][RET] cmd=${execCmdIdx} -> 0x${ret.toString(16)} depth=${returnPCStack.length}`);
        pc = ret;
        jumped = true;
      } else {
        // End main list
        if (DP_CHAR_DEBUG && execCmdIdx + 1 < dlLength) {
   //       console.warn(`[DP_CHAR] EndDL at cmd=${execCmdIdx} (dlLength=${dlLength})`);
        }
        break;
      }

    } else if (opcode === 0x01) {
      // G_VTX
      sawAnyVtx = true;

      const num = (w0 >>> 12) & 0xFF;
      const v0_encoded = (w0 >>> 1) & 0x7F;
      const v0 = (v0_encoded - num) & 0x3F;

      const seg = (w1 >>> 24) & 0xFF;
      const off24 = (w1 & 0x00FFFFFF) >>> 0;

      let segBase = segmentBases[seg] >>> 0;
      if (segBase === 0 && seg !== 0x00) {
        segBase = vtxOff >>> 0;
        segmentBases[seg] = segBase;
      }

      const fileByteOff = (segBase + off24) >>> 0;
      if (fileByteOff < (vtxOff >>> 0) || fileByteOff >= (data.byteLength >>> 0)) {
        vtxOob++;
        pc = nextPC;
        execCmdIdx++;
        continue;
      }

      const baseVtxIndex = ((fileByteOff - (vtxOff >>> 0)) / 16) | 0;

      if (DP_CHAR_DEBUG && logCount < DP_CHAR_LOG_LIMIT) {
        console.warn(
     //     `[DP_CHAR][VTX] cmd=${execCmdIdx} num=${num} v0=${v0} seg=0x${seg.toString(16)} off24=0x${off24.toString(16)} ` +
    //     `file=0x${fileByteOff.toString(16)} baseRomIdx=${baseVtxIndex} mtx=${currentMtxIdx} lighting=${lightingEnabled ? 1 : 0}`
        );
      }

      for (let v = 0; v < num; v++) {
        const romIdx = baseVtxIndex + v;
        const cacheIdx = (v0 + v) & 0x3F;

        const fbFlags = currentFb ? (currentFb.renderFlags & 0xFF) : 0;
        const matKey  = currentFb ? (currentFb.materialID | 0) : -1;
        const texWKey = currentFb ? (currentFb.texW | 0) : 0;
        const texHKey = currentFb ? (currentFb.texH | 0) : 0;
        const tintKey = currentFb ? ((currentFb.tintR << 16) | (currentFb.tintG << 8) | currentFb.tintB) : 0;
        const key = `${romIdx}_${currentMtxIdx}_${lightingEnabled ? 1 : 0}_${fbFlags}_${matKey}_${texWKey}_${texHKey}_${tintKey}`;
        let newIdx = vboMap.get(key);

        if (newIdx === undefined) {
          const o = (vtxOff + romIdx * 16) >>> 0;
          if (o + 16 <= (data.byteLength >>> 0)) {
            const vx = data.getInt16(o + 0, false);
            const vy = data.getInt16(o + 2, false);
            const vz = data.getInt16(o + 4, false);

            const s = data.getInt16(o + 8, false);
            const t = data.getInt16(o + 10, false);

            const nxU8 = data.getUint8(o + 12);
            const nyU8 = data.getUint8(o + 13);
            const nzU8 = data.getUint8(o + 14);
            const a    = data.getUint8(o + 15);

let r = nxU8, g = nyU8, b = nzU8;

const noTintForThisTex = !!currentFb && DP_NO_TINT_TEXIDS.has(currentFb.materialID);
const hasTint = !!currentFb && !(currentFb.tintR === 255 && currentFb.tintG === 255 && currentFb.tintB === 255);
const wantsTintBase = !!currentFb && hasTint && currentFb.tintEnabled && !noTintForThisTex;

if (lightingEnabled) {
  const baseR = wantsTintBase ? currentFb!.tintR : 255;
  const baseG = wantsTintBase ? currentFb!.tintG : 255;
  const baseB = wantsTintBase ? currentFb!.tintB : 255;
  const lit = shadeRGB(baseR, baseG, baseB, nxU8, nyU8, nzU8);
  r = lit.r; g = lit.g; b = lit.b;
} else if (wantsTintBase) {
  r = currentFb!.tintR;
  g = currentFb!.tintG;
  b = currentFb!.tintB;
}

            newIdx = (outPos.length / 3) | 0;
            outPos.push(vx, vy, vz);
            outTex.push(s, t);
            outClr.push(r, g, b, a);
            outBone.push(currentMtxIdx);

            vboMap.set(key, newIdx);
            vtxCache[cacheIdx] = newIdx;
            vtxValid[cacheIdx] = 1;
          } else {
            vtxOob++;
            vtxCache[cacheIdx] = 0;
            vtxValid[cacheIdx] = 0;
          }
        } else {
          vtxCache[cacheIdx] = newIdx;
          vtxValid[cacheIdx] = 1;
        }
      }

    } else if (opcode === 0x05 && currentFb) {
      const src = ((w1 & 0x00FFFFFF) !== 0) ? w1 : w0;
      const a = (src >>> 16) & 0xFF;
      const b = (src >>> 8) & 0xFF;
      const c = (src >>> 0) & 0xFF;

      const i0 = vtxCache[pickSlot(a)];
      const i1 = vtxCache[pickSlot(b)];
      const i2 = vtxCache[pickSlot(c)];
      if (i0 < 0 || i1 < 0 || i2 < 0) triBadRefs++;

      currentFb.tris.push({ i0, i1, i2 });

    } else if (opcode === 0x06 && currentFb) {
      const a0 = (w0 >>> 16) & 0xFF;
      const a1 = (w0 >>> 8) & 0xFF;
      const a2 = (w0 >>> 0) & 0xFF;

      const b0 = (w1 >>> 16) & 0xFF;
      const b1 = (w1 >>> 8) & 0xFF;
      const b2 = (w1 >>> 0) & 0xFF;

      const t0 = { i0: vtxCache[pickSlot(a0)], i1: vtxCache[pickSlot(a1)], i2: vtxCache[pickSlot(a2)] };
      const t1 = { i0: vtxCache[pickSlot(b0)], i1: vtxCache[pickSlot(b1)], i2: vtxCache[pickSlot(b2)] };

      if (t0.i0 < 0 || t0.i1 < 0 || t0.i2 < 0) triBadRefs++;
      if (t1.i0 < 0 || t1.i1 < 0 || t1.i2 < 0) triBadRefs++;

      currentFb.tris.push(t0);
      currentFb.tris.push(t1);

    } else {
      unknownOps++;
    //  logOnce(`[DP_CHAR][UNK] cmd=${execCmdIdx} op=0x${opcode.toString(16)} w0=0x${w0.toString(16)} w1=0x${w1.toString(16)}`);
    }

    if (!jumped)
      pc = nextPC;

    execCmdIdx++;
  }

  if (DP_CHAR_DEBUG) {
    const parts: string[] = [];
    for (let i = 0; i < 256; i++) if (opCounts[i]) parts.push(`0x${i.toString(16)}=${opCounts[i]}`);
  //  console.warn(`[DP_CHAR] Opcode counts: ${parts.join(' ')}`);
  //  console.warn(`[DP_CHAR] triBadRefs=${triBadRefs} vtxOob=${vtxOob} unknownOps=${unknownOps}`);
  //  console.warn(`[DP_CHAR] DL calls=${dlCalls} returns=${dlReturns} badTargets=${dlBadTargets} depthLeft=${returnPCStack.length} executed=${execCmdIdx}`);
  }

  // --- Buffers ---
  const finalVerts = (outPos.length / 3) | 0;
  const posAB = new ArrayBuffer(finalVerts * 6);
  const clrAB = new ArrayBuffer(finalVerts * 4);
  const texAB = new ArrayBuffer(finalVerts * 4);
  const posDV = new DataView(posAB);
  const clrDV = new DataView(clrAB);
  const texDV = new DataView(texAB);

  const originalLocalPos = new Int16Array(outPos);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let j = 0; j < finalVerts; j++) {
    const lx = outPos[j * 3 + 0];
    const ly = outPos[j * 3 + 1];
    const lz = outPos[j * 3 + 2];

    let wx = lx, wy = ly, wz = lz;
    if (jointCount > 0) {
      const bindMtx = jointMats[outBone[j] || 0];
      if (bindMtx) {
        wx = bindMtx[0]*lx + bindMtx[4]*ly + bindMtx[8]*lz + bindMtx[12];
        wy = bindMtx[1]*lx + bindMtx[5]*ly + bindMtx[9]*lz + bindMtx[13];
        wz = bindMtx[2]*lx + bindMtx[6]*ly + bindMtx[10]*lz + bindMtx[14];
      }
    }

    minX = Math.min(minX, wx); minY = Math.min(minY, wy); minZ = Math.min(minZ, wz);
    maxX = Math.max(maxX, wx); maxY = Math.max(maxY, wy); maxZ = Math.max(maxZ, wz);

    posDV.setInt16(j * 6 + 0, wx, false);
    posDV.setInt16(j * 6 + 2, wy, false);
    posDV.setInt16(j * 6 + 4, wz, false);

    texDV.setInt16(j * 4 + 0, outTex[j * 2 + 0], false);
    texDV.setInt16(j * 4 + 2, outTex[j * 2 + 1], false);

    clrDV.setUint8(j * 4 + 0, outClr[j * 4 + 0]);
    clrDV.setUint8(j * 4 + 1, outClr[j * 4 + 1]);
    clrDV.setUint8(j * 4 + 2, outClr[j * 4 + 2]);
    clrDV.setUint8(j * 4 + 3, outClr[j * 4 + 3]);
  }

  for (const fb of facebatches) {
    if (fb.tris.length === 0) continue;
    for (const tri of fb.tris) {
      for (const idx of [tri.i0, tri.i1, tri.i2]) {
        const rawS = outTex[idx * 2 + 0];
        const rawT = outTex[idx * 2 + 1];
        texDV.setInt16(idx * 4 + 0, Math.round(rawS * (32.0 / fb.texW)), false);
        texDV.setInt16(idx * 4 + 2, Math.round(rawT * (32.0 / fb.texH)), false);
      }
    }
  }

  (model as any).bbox = new AABB(minX, minY, minZ, maxX, maxY, maxZ);

  // --- GX setup ---
  const vcd: GX_VtxDesc[] = nArray(GX.Attr.MAX + 1, () => ({ type: GX.AttrType.NONE }));
  vcd[GX.Attr.POS].type = GX.AttrType.INDEX16;
  vcd[GX.Attr.CLR0].type = GX.AttrType.INDEX16;
  vcd[GX.Attr.TEX0].type = GX.AttrType.INDEX16;

  const vat: GX_VtxAttrFmt[][] = nArray(8, () =>
    nArray(GX.Attr.MAX + 1, () => ({ compType: GX.CompType.U8, compShift: 0, compCnt: 0 } as GX_VtxAttrFmt))
  );
  vat[0][GX.Attr.POS]  = { compType: GX.CompType.S16,  compShift: 0,  compCnt: GX.CompCnt.POS_XYZ };
  vat[0][GX.Attr.CLR0] = { compType: GX.CompType.RGBA8, compShift: 0,  compCnt: GX.CompCnt.CLR_RGBA };
  vat[0][GX.Attr.TEX0] = { compType: GX.CompType.S16,  compShift: 10, compCnt: GX.CompCnt.TEX_ST };

  const vtxArrays: GX_Array[] = [];
  vtxArrays[GX.Attr.POS]  = { buffer: ArrayBufferSlice.fromView(posDV), offs: 0, stride: 6 };
  vtxArrays[GX.Attr.CLR0] = { buffer: ArrayBufferSlice.fromView(clrDV), offs: 0, stride: 4 };
  vtxArrays[GX.Attr.TEX0] = { buffer: ArrayBufferSlice.fromView(texDV), offs: 0, stride: 4 };

  model.createModelShapes = () => {
    const shapes = new ModelShapes(model, posDV, undefined);
    shapes.shapes[0] = [];
    shapes.shapes[1] = [];
    shapes.shapes[2] = [];

    let usedFb = 0;
    let totalTris = 0;
    let patchedUsed = 0;

for (const fb of facebatches) {
  if (fb.tris.length === 0) continue; // <-- DO NOT skip on materialID anymore

  if (!(model as any).__dpLoggedFaceTexs) (model as any).__dpLoggedFaceTexs = new Set<string>();

  if (DP_LOG_ALL_FACEBATCH_TEXIDS) {
    const logKey = `${fb.materialID}_${fb.texW}_${fb.texH}_${fb.tintR}_${fb.tintG}_${fb.tintB}_${fb.renderFlags}`;
    if (!(model as any).__dpLoggedFaceTexs.has(logKey)) {
      (model as any).__dpLoggedFaceTexs.add(logKey);
      console.warn(
        `[DP FB DEBUG] texId=${fb.materialID} tex=${fb.texW}x${fb.texH} tint=(${fb.tintR},${fb.tintG},${fb.tintB},${fb.tintA}) flags=0x${fb.renderFlags.toString(16)}`
      );
    }
  }

  if (DP_HIDE_TEXIDS_FOR_TEST.has(fb.materialID)) {
    console.warn(`[DP TEST HIDE] skipping texId=${fb.materialID}`);
    continue;
  }

  usedFb++;
  totalTris += fb.tris.length;
  if (fb._wasInvalidMat) patchedUsed++;
      const wantsCutout = (fb.renderFlags & 0x80) !== 0;

      let shaderFlags = 0;
      let targetList = 0;

      if (wantsCutout) {
        shaderFlags |= ShaderFlags.AlphaCompare;
        targetList = 0;
      }

      const shader: Shader = {
        layers: [{
          texId: fb.materialID,
          tevMode: 1,
          enableScroll: 0,
        }],
        attrFlags: (ShaderAttrFlags.CLR | (ShaderAttrFlags as any).TEX0),
        flags: shaderFlags,
        hasHemisphericProbe: false,
        hasReflectiveProbe: false,
        reflectiveProbeMaskTexId: null,
        reflectiveProbeIdx: 0,
        reflectiveAmbFactor: 0.0,
        hasNBTTexture: false,
        nbtTexId: null,
        nbtParams: 0,
        furRegionsTexId: null,
        color: { r: 1, g: 1, b: 1, a: 1 },
        normalFlags: NormalFlags.HasVertexColor | NormalFlags.HasVertexAlpha,
        lightFlags: LightFlags.OverrideLighting,
        texMtxCount: 0,
      };

      const material = materialFactory.buildObjectMaterial(shader, texFetcher, false);

      const vtxCountOut = fb.tris.length * 3;
      const out = new Uint8Array(3 + vtxCountOut * 6);
      let p = 0;
      out[p++] = 0x90;
      out[p++] = (vtxCountOut >>> 8) & 0xff;
      out[p++] = (vtxCountOut >>> 0) & 0xff;

      for (const tri of fb.tris) {
        for (const idx of [tri.i0, tri.i1, tri.i2]) {
          out[p++] = (idx >>> 8) & 0xff; out[p++] = idx & 0xff;
          out[p++] = (idx >>> 8) & 0xff; out[p++] = idx & 0xff;
          out[p++] = (idx >>> 8) & 0xff; out[p++] = idx & 0xff;
        }
      }

      const geom = new ShapeGeometry(vtxArrays, vcd, vat, new DataView(out.buffer), false);
      const pnMatrixMap = nArray(10, () => 0);
      geom.setPnMatrixMap(pnMatrixMap, false, false);

      shapes.shapes[targetList].push(new Shape(geom, new ShapeMaterial(material), false));
    }

    if (DP_CHAR_DEBUG) {
   //   console.warn(`[DP_CHAR] Facebatches used=${usedFb}/${facebatches.length} vertsOut=${finalVerts} trisOut=${totalTris} (patchedUsed=${patchedUsed})`);
    }

    if (jointCount > 0) {
      const origAddRenderInsts = shapes.addRenderInsts.bind(shapes);
      shapes.addRenderInsts = (device, renderInstManager, modelCtx, renderLists, matrix, matrixPalette, overrideSortDepth, overrideSortLayer) => {
        if (matrixPalette && matrixPalette.length > 0) {
          for (let j = 0; j < finalVerts; j++) {
            const lx = originalLocalPos[j * 3 + 0];
            const ly = originalLocalPos[j * 3 + 1];
            const lz = originalLocalPos[j * 3 + 2];
            const boneMtx = matrixPalette[outBone[j] || 0];

            if (boneMtx) {
              const wx = boneMtx[0]*lx + boneMtx[4]*ly + boneMtx[8]*lz + boneMtx[12];
              const wy = boneMtx[1]*lx + boneMtx[5]*ly + boneMtx[9]*lz + boneMtx[13];
              const wz = boneMtx[2]*lx + boneMtx[6]*ly + boneMtx[10]*lz + boneMtx[14];

              posDV.setInt16(j * 6 + 0, wx, false);
              posDV.setInt16(j * 6 + 2, wy, false);
              posDV.setInt16(j * 6 + 4, wz, false);
            }
          }
          shapes.reloadVertices();
        }
        origAddRenderInsts(device, renderInstManager, modelCtx, renderLists, matrix, matrixPalette, overrideSortDepth, overrideSortLayer);
      };
    }

    return shapes;
  };

  model.hasFineSkinning = false;
  model.sharedModelShapes = model.createModelShapes();
  return model;








    } else {
        // ==========================================
        // DINOSAUR PLANET MAP BLOCK PARSER
        // ==========================================
       // ==========================================
// DINOSAUR PLANET MAP BLOCK PARSER  (FIXED)
// - DO NOT use SFA water material
// - DO NOT push into modelShapes.waters (SFA path)
// - MUCH stricter "water" detection
// - Optional UV scroll for water / waterfall-ish translucent
// ==========================================
model.isMapBlock = true;

const matOff = data.getUint32(0x00);
const vtxOff = data.getUint32(0x04);
const triOff = data.getUint32(0x08);
const batOff = data.getUint32(0x0C);
const materialCount = data.getUint8(0x4A);

const batchCount = ((matOff - batOff) / 0x18) | 0;
if (batchCount <= 0) throw new Error(`DP Map: bad batchCount=${batchCount}`);

const totalVerts = ((triOff - vtxOff) / 16) | 0;
const totalTris  = ((batOff - triOff) / 8)  | 0;

const posAB = new ArrayBuffer(totalVerts * 6);
const posDV = new DataView(posAB);
const clrAB = new ArrayBuffer(totalVerts * 4);
const clrDV = new DataView(clrAB);

type DPMapBatch = {
    isOpaque: boolean;
    pixelFormat: number;
    drawMode: number;
    materialId: number;
    blendMaterialId: number;
    vStart: number; vEnd: number;
    tStart: number; tEnd: number;
    texW: number; texH: number;
    blendTexW: number; blendTexH: number;

    // effect-ish
    isWater: boolean;
    scrollPxU: number; // pixels per frame
    scrollPxV: number; // pixels per frame
};

const batches: DPMapBatch[] = [];

for (let i = 0; i < batchCount; i++) {
    const o = batOff + i * 0x18;

    const vStart = data.getUint16(o + 0x04, false);
    const tStart = data.getUint16(o + 0x06, false);

    const nextO = batOff + (i + 1) * 0x18;
    const vEnd = (i + 1 < batchCount) ? data.getUint16(nextO + 0x04, false) : totalVerts;
    const tEnd = (i + 1 < batchCount) ? data.getUint16(nextO + 0x06, false) : totalTris;

    const drawMode = data.getUint8(o + 0x03);
    const matIdx = data.getUint8(o + 0x12);
    const blendMatIdx = data.getUint8(o + 0x15);

    let materialId = -1;
    let blendMaterialId = -1;

    let isOpaque = true;
    let pixelFormat = 0;

    let texW = 32, texH = 32;
    let blendTexW = 32, blendTexH = 32;

    if (matIdx < materialCount) {
        const matStructOff = matOff + (matIdx * 0x0C);
        if (matStructOff + 0x0B < data.byteLength) {
            materialId = data.getUint32(matStructOff + 0x00, false) & 0xFFFF;
            texW = data.getUint8(matStructOff + 0x08) || 32;
            texH = data.getUint8(matStructOff + 0x09) || 32;

            const matFormat = data.getUint8(matStructOff + 0x0A);
            isOpaque = (matFormat & 0x10) !== 0;
            pixelFormat = (matFormat & 0x0F);

            if (materialId < 0 || materialId >= 10000) materialId = -1;
        }
    }

    if (blendMatIdx !== 0x00 && blendMatIdx !== 0xFF && blendMatIdx < materialCount) {
        const blendMatStructOff = matOff + (blendMatIdx * 0x0C);
        if (blendMatStructOff + 0x0B < data.byteLength) {
            blendMaterialId = data.getUint32(blendMatStructOff + 0x00, false) & 0xFFFF;
            blendTexW = data.getUint8(blendMatStructOff + 0x08) || 32;
            blendTexH = data.getUint8(blendMatStructOff + 0x09) || 32;

            if (blendMaterialId < 0 || blendMaterialId >= 10000) blendMaterialId = -1;
        }
    }

    if (vEnd > vStart && tEnd > tStart) {
        batches.push({
            isOpaque, pixelFormat, drawMode,
            materialId, blendMaterialId,
            vStart, vEnd, tStart, tEnd,
            texW, texH, blendTexW, blendTexH,
            isWater: false,
            scrollPxU: 0,
            scrollPxV: 0,
        });
    }
}

let minX = Infinity, minY = Infinity, minZ = Infinity;
let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

for (let i = 0; i < totalVerts; i++) {
    const o = vtxOff + i * 16;
    const px = data.getInt16(o + 0, false);
    const py = data.getInt16(o + 2, false);
    const pz = data.getInt16(o + 4, false);

    minX = Math.min(minX, px); minY = Math.min(minY, py); minZ = Math.min(minZ, pz);
    maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); maxZ = Math.max(maxZ, pz);

    posDV.setInt16(i * 6 + 0, px, false);
    posDV.setInt16(i * 6 + 2, py, false);
    posDV.setInt16(i * 6 + 4, pz, false);

    clrDV.setUint8(i * 4 + 0, data.getUint8(o + 0x0C));
    clrDV.setUint8(i * 4 + 1, data.getUint8(o + 0x0D));
    clrDV.setUint8(i * 4 + 2, data.getUint8(o + 0x0E));
    clrDV.setUint8(i * 4 + 3, data.getUint8(o + 0x0F));
}

(model as any).bbox = new AABB(minX, minY, minZ, maxX, maxY, maxZ);

type DPTri = { flip: boolean; i0: number; i1: number; i2: number };
const tris: DPTri[] = [];
for (let i = 0; i < totalTris; i++) {
    const o = triOff + i * 8;
    const f = data.getUint8(o + 0);
    tris.push({
        flip: !!(f & 0x80),
        i0: data.getUint8(o + 1),
        i1: data.getUint8(o + 2),
        i2: data.getUint8(o + 3),
    });
}

const vcd: GX_VtxDesc[] = nArray(GX.Attr.MAX + 1, () => ({ type: GX.AttrType.NONE }));
vcd[GX.Attr.POS].type = GX.AttrType.INDEX16;
vcd[GX.Attr.CLR0].type = GX.AttrType.INDEX16;
vcd[GX.Attr.TEX0].type = GX.AttrType.INDEX16;
vcd[GX.Attr.TEX1].type = GX.AttrType.INDEX16;

const vat: GX_VtxAttrFmt[][] = nArray(8, () =>
    nArray(GX.Attr.MAX + 1, () => ({ compType: GX.CompType.U8, compShift: 0, compCnt: 0 } as GX_VtxAttrFmt))
);
vat[0][GX.Attr.POS]  = { compType: GX.CompType.S16,  compShift: 0,  compCnt: GX.CompCnt.POS_XYZ };
vat[0][GX.Attr.CLR0] = { compType: GX.CompType.RGBA8, compShift: 0,  compCnt: GX.CompCnt.CLR_RGBA };
vat[0][GX.Attr.TEX0] = { compType: GX.CompType.S16,  compShift: 10, compCnt: GX.CompCnt.TEX_ST };
vat[0][GX.Attr.TEX1] = { compType: GX.CompType.S16,  compShift: 10, compCnt: GX.CompCnt.TEX_ST };

model.createModelShapes = () => {
    const shapes = new ModelShapes(model, new DataView(posAB), undefined);
    shapes.shapes[0] = [];
    shapes.shapes[1] = [];
    shapes.shapes[2] = [];

    // STRICT DP water modes (same ones you were using, but now gated properly)
    const DP_WATER_DRAW_MODES = new Set<number>([0x00, 0x05, 0x14, 0x15, 0x18, 0x19]);
// Scroll only these DP textures (keeps beams/vines from scrolling).
// Put your known water + waterfall texIds here.
const DP_SCROLL_WATER_TEXIDS = new Set<number>([
  3561,3569, 3570,2715, 2514,   3553,3563,   2248,1912,3604,2292, 1682
]);

const DP_SCROLL_WATERFALL_TEXIDS = new Set<number>([
 358,123 ,253,254,368,368,1127, 3560,     3563,3562,1941,2750,2048,270, 
]);

// Optional: log once per texture that *would* have scrolled under the old heuristic
const __dpScrollCandidateLogged = new Set<number>();
  for (const b of batches) {
            const isSoftFormat = (b.pixelFormat !== 1 && b.pixelFormat !== 7 && b.pixelFormat !== 8);
            const isKnownCutoutTex = [119,164,349,351,355,544,356,2087,1101,1028,1122,1125,1050,1049,1051,1066,1075,1423].includes(b.materialId);

            // Cutouts first (never water)
            const wantsCutout = !b.isOpaque && (isKnownCutoutTex || (b.drawMode & 0x80) !== 0);

            // Terrain blend: 2-layer blend, NOT framebuffer transparency
            const wantsTerrainBlend = (b.blendMaterialId !== -1) && ((b.drawMode & 0x40) !== 0);

            // Water blend: has blend tex, soft format, semi-trans bit, and NOT terrain-blend
            const wantsWaterBlend = (b.blendMaterialId !== -1) && isSoftFormat && !wantsTerrainBlend && ((b.drawMode & 0x04) !== 0);

            // Standalone water surface: soft format + known water draw modes
            const wantsWaterSurface = (b.blendMaterialId === -1) && isSoftFormat && DP_WATER_DRAW_MODES.has(b.drawMode);

            b.isWater = !wantsCutout && (wantsWaterBlend || wantsWaterSurface);

            // Only scroll if it's actual water OR texture is in an explicit allow-list.
            const allowScroll =
                b.isWater ||
                DP_SCROLL_WATER_TEXIDS.has(b.materialId) ||
                DP_SCROLL_WATER_TEXIDS.has(b.blendMaterialId) ||
                DP_SCROLL_WATERFALL_TEXIDS.has(b.materialId) ||
                DP_SCROLL_WATERFALL_TEXIDS.has(b.blendMaterialId);

            b.scrollPxU = 0;
            b.scrollPxV = allowScroll ? (b.isWater ? -1 : 2) : 0;

            // Build shader layers
            const layers: any[] = [];
            let attrFlags = ShaderAttrFlags.CLR;

            if (b.materialId !== -1) {
                layers.push({ texId: b.materialId, tevMode: 0, enableScroll: 0 });
                attrFlags |= (ShaderAttrFlags as any).TEX0;
            }
            if (b.blendMaterialId !== -1) {
                layers.push({ texId: b.blendMaterialId, tevMode: wantsTerrainBlend ? 9 : 0, enableScroll: 0 });
                attrFlags |= (ShaderAttrFlags as any).TEX1;
            }

            // Decide pass + flags
            let shaderFlags = 0;
            let targetList = 0;

            const hasSemiTrans = (b.drawMode & 0x04) !== 0;
            const hasTexBlend  = (b.drawMode & 0x40) !== 0;

            const wantsTrueTrans = (!wantsCutout && (!b.isOpaque || hasSemiTrans || hasTexBlend || b.isWater));

            if (wantsTrueTrans) {
                shaderFlags |= 0x40000000; // your transparent bit
                targetList = 1;
            } else if (wantsCutout) {
                shaderFlags |= ShaderFlags.AlphaCompare;
                targetList = 0;
            } else {
                shaderFlags |= 0x10; // your opaque marker
                targetList = 0;
            }

            shaderFlags |= ShaderFlags.Fog;

            // --- THE SURGICAL BLEND FIX ---
            // We set normalFlags to 0 by default, exactly like your original working code did.
            // This guarantees the portals and walls will not vanish.
            let normalFlags = 0 as NormalFlags; 

            let aMin = 255;
            for (let vi = b.vStart; vi < b.vEnd; vi++) {
                const a = clrDV.getUint8(vi * 4 + 3);
                if (a < aMin) aMin = a;
            }
            
            const isDecalBlend = (b.blendMaterialId === -1 && b.drawMode === 0x0b && aMin === 0);

            // We ONLY change the normal flags if it is explicitly a dirt blend.
            // Portals and walls will completely bypass this if statement.
            if (isDecalBlend || hasTexBlend) {
                shaderFlags |= 0x40000000; 
                normalFlags = (NormalFlags.HasVertexColor | NormalFlags.HasVertexAlpha) as NormalFlags;
            }
            // -------------------------------

            // Add scroll slot
            const addScroll = (layer: any, texW: number, texH: number) => {
                if (!layer || (b.scrollPxU === 0 && b.scrollPxV === 0)) return;
                const dxPerFrame = ((b.scrollPxU << 16) / Math.max(1, texW)) | 0;
                const dyPerFrame = ((b.scrollPxV << 16) / Math.max(1, texH)) | 0;
                const slot = (materialFactory as any).addScrollSlot?.(dxPerFrame, dyPerFrame);
                if (slot !== undefined) {
                    layer.enableScroll = 1;
                    layer.scrollSlot = slot;
                }
            };

            if (layers.length > 0) addScroll(layers[0], b.texW, b.texH);
            if (layers.length > 1) addScroll(layers[1], b.blendTexW, b.blendTexH);

            const shader: Shader = {
                layers, flags: shaderFlags, attrFlags,
                hasHemisphericProbe: false, hasReflectiveProbe: false,
                reflectiveProbeMaskTexId: null, reflectiveProbeIdx: 0, reflectiveAmbFactor: 0.0,
                hasNBTTexture: false, nbtTexId: null, nbtParams: 0, furRegionsTexId: null,
                color: { r: 1, g: 1, b: 1, a: 1 }, normalFlags, lightFlags: 0, texMtxCount: 0,
            };

            const material = materialFactory.buildMapMaterial(shader, texFetcher);

            // UV/VBO Builder (Untouched Original)
            const tex0DV = new DataView(new ArrayBuffer(totalVerts * 4));
            const tex1DV = new DataView(new ArrayBuffer(totalVerts * 4));
            for (let ti = b.tStart; ti < b.tEnd; ti++) {
                let { i0, i1, i2 } = tris[ti];
                for (const idx of [b.vStart + i0, b.vStart + i1, b.vStart + i2]) {
                    const vo = vtxOff + idx * 16;
                    const s = data.getInt16(vo + 8, false);
                    const t = data.getInt16(vo + 10, false);
                    tex0DV.setInt16(idx * 4 + 0, Math.round(s * (32.0 / b.texW)), false);
                    tex0DV.setInt16(idx * 4 + 2, Math.round(t * (32.0 / b.texH)), false);
                    tex1DV.setInt16(idx * 4 + 0, Math.round(s * (32.0 / b.blendTexW)), false);
                    tex1DV.setInt16(idx * 4 + 2, Math.round(t * (32.0 / b.blendTexH)), false);
                }
            }

            const batchVtxArrays: GX_Array[] = [];
            batchVtxArrays[GX.Attr.POS]  = { buffer: ArrayBufferSlice.fromView(new DataView(posAB)), offs: 0, stride: 6 };
            batchVtxArrays[GX.Attr.CLR0] = { buffer: ArrayBufferSlice.fromView(new DataView(clrAB)), offs: 0, stride: 4 };
            batchVtxArrays[GX.Attr.TEX0] = { buffer: ArrayBufferSlice.fromView(tex0DV), offs: 0, stride: 4 };
            batchVtxArrays[GX.Attr.TEX1] = { buffer: ArrayBufferSlice.fromView(tex1DV), offs: 0, stride: 4 };

            const vtxCountOut = (b.tEnd - b.tStart) * 3;
            const out = new Uint8Array(3 + vtxCountOut * 8);
            let p = 0;
            out[p++] = 0x90;
            out[p++] = (vtxCountOut >>> 8) & 0xFF;
            out[p++] = (vtxCountOut >>> 0) & 0xFF;
            for (let ti = b.tStart; ti < b.tEnd; ti++) {
                let { flip, i0, i1, i2 } = tris[ti];
                if (flip) { const tmp = i1; i1 = i2; i2 = tmp; }
                for (const idx of [b.vStart + i0, b.vStart + i1, b.vStart + i2]) {
                    out[p++] = (idx >>> 8) & 0xFF; out[p++] = idx & 0xFF;
                    out[p++] = (idx >>> 8) & 0xFF; out[p++] = idx & 0xFF;
                    out[p++] = (idx >>> 8) & 0xFF; out[p++] = idx & 0xFF;
                    out[p++] = (idx >>> 8) & 0xFF; out[p++] = idx & 0xFF;
                }
            }

            const geom = new ShapeGeometry(batchVtxArrays, vcd, vat, new DataView(out.buffer), false);
            geom.setPnMatrixMap(nArray(10, () => 0), false, false);
            shapes.shapes[targetList].push(new Shape(geom, new ShapeMaterial(material), false));
        }

    return shapes;
};

model.sharedModelShapes = model.createModelShapes();
return model;
    }
}
// ===== end DP loader =====

  const model = new Model(version);
  let fields = FIELDS[version];

  const totalMapByteLength = data.buffer.byteLength;
  //console.warn('[DEBUG] totalMapByteLength =', totalMapByteLength);
  if (version === ModelVersion.Early1 && totalMapByteLength === 144448) {
    fields = { ...fields };
    fields.numListBits = 6;
    // console.warn('[PATCH] Detected full cloudtreasure map (144448 bytes) → numListBits = 6');
  }

  function logAllFields(data: DataView, fields: any) {
   // console.log('--- Detailed Dumping model fields ---');
    // Do NOT attempt to read these from the file; they are immediate constants in the table.
    const IMMEDIATE_KEYS = new Set<string>([
      'numListBits','dlInfoSize','isMapBlock','isFinal','isBeta','oldVat',
      'hasNormals','hasBones','hasYTranslate','isfinal','shaderFields'
    ]);

    for (const key in fields) {
      if (IMMEDIATE_KEYS.has(key)) {
      //  console.log(`${key} (immediate): ${fields[key]}`);
        continue;
      }
      const offset = fields[key];
      if (typeof offset === 'number' && offset >= 0 && offset < data.byteLength) {
        try {
          let length: number;
          let val: number;
          if (key === 'jointCount' || key === 'weightCount' || key === 'shaderCount' || key === 'dlInfoCount') {
            length = 1;
            val = data.getUint8(offset);
          } else if (/Count$|Size$/i.test(key)) {
            length = 2;
            val = offset + 1 < data.byteLength ? data.getUint16(offset, false) : 0;
          } else if (/Offset$|posFineSkinning|nrmFineSkinning|shaderOffset|dlInfoOffset|bitsOffsets/i.test(key)) {
            length = 4;
            val = offset + 3 < data.byteLength ? data.getUint32(offset, false) : 0;
          } else {
            length = 1;
            val = data.getUint8(offset);
          }
          const bytes: string[] = [];
          for (let i = 0; i < length; i++) {
            if (offset + i < data.byteLength)
              bytes.push(data.getUint8(offset + i).toString(16).padStart(2, '0'));
            else
              bytes.push('??');
          }
         // console.log(`${key} raw bytes @ 0x${offset.toString(16)}: ${bytes.join(' ')} => ${val}`);
        } catch (e) {
        //  console.warn(`Error reading field ${key} at offset 0x${offset.toString(16)}`, e);
        }
      }
    }
    // console.log('--- End detailed dump ---');
  }

  logAllFields(data, fields);

  // ===== PROBE #1: shader table boundaries & stride =====
  const FILE_LEN = data.byteLength;
  const shaderOff = data.getUint32(fields.shaderOffset);
  const shaderCnt = data.getUint8(fields.shaderCount);
  const dlInfoOff = data.getUint32(fields.dlInfoOffset);
  const bits0Off = (fields.bitsOffsets?.length ?? 0) > 0 ? data.getUint32(fields.bitsOffsets[0]) : 0;
  //.warn(
   // `[PROBE1] shaderOff=0x${shaderOff.toString(16)} shaderCnt=${shaderCnt} dlInfoOff=0x${dlInfoOff.toString(16)} bits0Off=0x${bits0Off.toString(16)} fileLen=0x${FILE_LEN.toString(16)}`
//  );

  // Candidate: shader table is contiguous up to the start of dlInfo.
  let shaderSpan = (dlInfoOff > shaderOff && shaderCnt) ? (dlInfoOff - shaderOff) : 0;
  let shaderStride = shaderCnt ? Math.floor(shaderSpan / shaderCnt) : 0;
  let shaderRema = shaderCnt ? (shaderSpan % shaderCnt) : 0;
 // console.warn(`[PROBE1] shaderStrideCandidate=${shaderStride} (0x${shaderStride.toString(16)}) remainder=${shaderRema}`);

  // Quick peek at first two shader entries using that stride (just dump first 16 bytes of each).
  for (let i = 0; i < Math.min(shaderCnt, 2); i++) {
    const base = shaderOff + i * shaderStride;
    const row: string[] = [];
    for (let b = 0; b < 16 && base + b < FILE_LEN; b++) {
      row.push(data.getUint8(base + b).toString(16).padStart(2, '0'));
    }
   // console.warn(`[PROBE1] shader[${i}] @0x${base.toString(16)}: ${row.join(' ')}`);
  }

  // ===== PROBE #2: try dlInfo sizes and score plausibility =====
  const dlCnt = data.getUint8(fields.dlInfoCount);
  const dlBase = dlInfoOff;
  // Known strides used across SFA builds to test:
  const dlStrideCandidates = [0x1C, 0x20, 0x24, 0x28, 0x30, 0x34, 0x38, 0x3C, 0x40];

  function readDl(off: number, stride: number) {
    // Current Demo guess: offset @ +0x00 (u32 BE), size @ +0x04 (u16 BE).
    const o = data.getUint32(off, false);
    const s = data.getUint16(off + 0x04, false);
    return { o, s };
  }

  for (const stride of dlStrideCandidates) {
    if (!dlBase || dlBase + stride * dlCnt > FILE_LEN) {
    //  console.warn(`[PROBE2] dlInfoStride=0x${stride.toString(16)} -> table OOB (base too large or count*stride too big)`);
      continue;
    }
    let ok = 0, bad = 0;
    const samples: string[] = [];
    const sampleN = Math.min(3, dlCnt);
    for (let i = 0; i < dlCnt; i++) {
      const e = readDl(dlBase + i * stride, stride);
      const sane = e.o > 0 && e.s > 0 && (e.o + e.s) <= FILE_LEN;
      if (i < sampleN) samples.push(`#${i}:off=0x${e.o.toString(16)},size=0x${e.s.toString(16)}`);
      sane ? ok++ : bad++;
    }
   // console.warn(
   //   `[PROBE2] dlInfoStride=0x${stride.toString(16)} score ok=${ok}/${dlCnt} bad=${bad} samples=[${samples.join(' | ')}]`
   // );
  }

  // ===== PROBE #3: hex peek of dlInfo head =====
  if (dlBase && dlBase < FILE_LEN) {
    const dumpLen = Math.min(0x80, FILE_LEN - dlBase);
    let line = '';
    for (let i = 0; i < dumpLen; i++) {
      const b = data.getUint8(dlBase + i).toString(16).padStart(2,'0');
      line += b + (i % 16 === 15 ? ` @+0x${(i-15).toString(16)}\n` : ' ');
    }
   // console.warn(`[PROBE3] dlInfo head @0x${dlBase.toString(16)} (first ${dumpLen} bytes)\n${line}`);
  }

  const normalFlags = fields.hasNormals ? data.getUint8(0x24) : 0;
  model.isMapBlock = !!fields.isMapBlock;

  // Read raw bytes of posCount field (2 bytes)
  const posOffset = data.getUint32(fields.posOffset);
  const posCount = data.getUint16(fields.posCount);
//  console.log(`Loading ${posCount} positions from 0x${posOffset.toString(16)}`);
  model.originalPosBuffer = dataSubarray(data, posOffset);

  if (fields.hasNormals) {
    const nrmOffset = data.getUint32(fields.nrmOffset);
    const nrmCount = data.getUint16(fields.nrmCount);
   // console.log(`Loading ${nrmCount} normals from 0x${nrmOffset.toString(16)}`);
    model.originalNrmBuffer = dataSubarray(data, nrmOffset, nrmCount * ((normalFlags & NormalFlags.NBT) ? 9 : 3));
  }

  // --- Guard: some demo objects advertise fewer normals than are indexed ---
  // If normals are present but the buffer is smaller than a 1:1 map with POS,
  // pad by repeating the last normal so indices don’t run OOB in the VTX loader.
  if (fields.hasNormals && model.originalNrmBuffer.byteLength > 0) {
    const nrmStride = (normalFlags & NormalFlags.NBT) ? 9 : 3;
    const needed = (data.getUint16(fields.posCount) >>> 0) * nrmStride;
    if (model.originalNrmBuffer.byteLength < needed) {
      const src = new Uint8Array(model.originalNrmBuffer.buffer, model.originalNrmBuffer.byteOffset, model.originalNrmBuffer.byteLength);
      const dst = new Uint8Array(needed);
      dst.set(src);
      const tailStart = Math.max(0, src.byteLength - nrmStride);
      for (let off = src.byteLength; off < needed; off += nrmStride) {
        for (let j = 0; j < nrmStride; j++) dst[off + j] = src[tailStart + j] ?? 0;
      }
      model.originalNrmBuffer = new DataView(dst.buffer);
     // console.warn(`[NRM_PAD] grew normals ${src.byteLength} -> ${needed} (stride=${nrmStride})`);
    }
  }

  if (fields.posFineSkinningConfig !== undefined) {
    const posFineSkinningConfig = parseFineSkinningConfig(dataSubarray(data, fields.posFineSkinningConfig));
    if (posFineSkinningConfig.numPieces !== 0) {
      model.hasFineSkinning = true;
      model.fineSkinPositionQuantizeScale = posFineSkinningConfig.quantizeScale;

      const weightsOffs = data.getUint32(fields.posFineSkinningWeights);
      const posFineSkinningWeights = dataSubarray(data, weightsOffs);
      const piecesOffs = data.getUint32(fields.posFineSkinningPieces);

      for (let i = 0; i < posFineSkinningConfig.numPieces; i++) {
        const piece = parseFineSkinningPiece(dataSubarray(data, piecesOffs + i * FineSkinningPiece_SIZE, FineSkinningPiece_SIZE));
        model.posFineSkins.push({
          vertexCount: piece.numVertices,
          bufferOffset: piece.skinDataSrcOffs + piece.skinMeOffset,
          bone0: piece.bone0,
          bone1: piece.bone1,
          weights: dataSubarray(posFineSkinningWeights, piece.weightsSrc, piece.weightsBlockCount * 32),
        });
      }
    }

    const nrmFineSkinningConfig = parseFineSkinningConfig(dataSubarray(data, fields.nrmFineSkinningConfig));
    if (
      nrmFineSkinningConfig.numPieces !== 0 &&
      fields.nrmFineSkinningPieces !== undefined &&
      fields.nrmFineSkinningWeights !== undefined
    ) {
      model.hasFineSkinning = true;
      model.fineSkinNormalQuantizeScale = nrmFineSkinningConfig.quantizeScale;
      model.fineSkinNBTNormals = !!(normalFlags & NormalFlags.NBT);
      if (model.fineSkinNBTNormals)
       console.warn('Fine-skinned NBT normals detected; not implemented yet');

      const weightsOffs = data.getUint32(fields.nrmFineSkinningWeights);
      const piecesOffs = data.getUint32(fields.nrmFineSkinningPieces);

      // Bounds guards — some Demo files advertise pieces but tables are missing.
      const weightsInBounds = weightsOffs > 0 && weightsOffs < data.byteLength;
      const piecesInBounds = piecesOffs > 0 && (piecesOffs + nrmFineSkinningConfig.numPieces * FineSkinningPiece_SIZE) <= data.byteLength;

      if (weightsInBounds && piecesInBounds) {
        const nrmFineSkinningWeights = dataSubarray(data, weightsOffs);
        for (let i = 0; i < nrmFineSkinningConfig.numPieces; i++) {
          const piece = parseFineSkinningPiece(dataSubarray(data, piecesOffs + i * FineSkinningPiece_SIZE, FineSkinningPiece_SIZE));
          model.nrmFineSkins.push({
            vertexCount: piece.numVertices,
            bufferOffset: piece.skinDataSrcOffs + piece.skinMeOffset,
            bone0: piece.bone0,
            bone1: piece.bone1,
            weights: dataSubarray(nrmFineSkinningWeights, piece.weightsSrc, piece.weightsBlockCount * 32),
          });
        }
      } else {
     //   console.log('Skipping normals fine skinning: weights or pieces table out-of-bounds/missing (Demo).');
      }
    } else if (nrmFineSkinningConfig.numPieces !== 0) {
    //  console.log('Skipping normals fine skinning: Demo fields missing pieces/weights offsets.');
    }

    model.hasBetaFineSkinning = model.hasFineSkinning && version === ModelVersion.Beta;
  }

  // Pick base VAT and deep-clone so tweaks don’t leak across models
  const baseVat = (normalFlags & NormalFlags.NBT)
    ? (fields.oldVat ? OLD_VAT_NBT : VAT_NBT)
    : (fields.oldVat ? OLD_VAT : VAT);

  const vat: GX_VtxAttrFmt[][] = baseVat.map(row => row.map(fmt => ({
    compType: fmt.compType,
    compShift: fmt.compShift,
    compCnt: fmt.compCnt,
  })));

  // Old (Demo/Beta) **object** models that use NBT need POS 1/8 quantization to avoid “exploded” geometry.
  if (fields.oldVat && !fields.isMapBlock && (normalFlags & NormalFlags.NBT)) {
    for (const r of [5, 6, 7])
      vat[r][GX.Attr.POS].compShift = 3;
  }
 // console.warn(
  //  `[VAT_PICK] oldVat=${!!fields.oldVat} nrmNBT=${!!(normalFlags & NormalFlags.NBT)} -> vatRow5: POS.shift=${vat[5][GX.Attr.POS].compShift} NRM.compType=${vat[5][GX.Attr.NRM].compType}`
  //);

  // Early3/Early4 maps: Their vertex color is 16-bit RGBA4. Ensure VAT expects RGBA4 on all streams.
  const isEarly34Map = !!fields.isMapBlock && (version === ModelVersion.Early3 || version === ModelVersion.Early4);
  if (isEarly34Map) {
    for (let i = 0; i < 8; i++) {
      vat[i][GX.Attr.CLR0].compType = GX.CompType.RGBA4;
      vat[i][GX.Attr.CLR0].compCnt = GX.CompCnt.CLR_RGBA;
      (vat[i][GX.Attr.CLR0] as any).compShift = 0;
    }
  }

  // @0x8: data size
  // @0xc: 4x3 matrix (placeholder; always zeroed in files)
  // @0x8e: y translation (up/down)
  const texOffset = data.getUint32(fields.texOffset);
  const texCount = data.getUint8(fields.texCount);
  //console.log(`Loading ${texCount} texture infos from 0x${texOffset.toString(16)}`);
  const texIds: number[] = [];
  for (let i = 0; i < texCount; i++) {
    const texIdFromFile = readUint32(data, texOffset, i);
    texIds.push(texIdFromFile);
  }
  //console.log(`texids: ${texIds}`);

  // Declare color offset and count first
  const clrOffset = data.getUint32(fields.clrOffset);
  const clrCount = data.getUint16(fields.clrCount);
  //console.log(`Loading ${clrCount} colors from 0x${clrOffset.toString(16)}`);
  let clrBuffer: Uint8Array;
  if (version === ModelVersion.AncientMap) {
    clrBuffer = ArrayBufferSlice.fromView(dataSubarray(data, clrOffset)).createTypedArray(Uint8Array);
  } else {
    const bytesAvail = Math.max(0, data.byteLength - clrOffset);
    const safeClrCount = Math.min(clrCount, bytesAvail >>> 1);
    clrBuffer = ArrayBufferSlice.fromView(dataSubarray(data, clrOffset, safeClrCount * 2)).createTypedArray(Uint8Array);
  }

  let clrBufferForArrays = clrBuffer;
  if (isEarly34Map) {
    const palBytes = clrBuffer;
    const palCount = palBytes.byteLength >>> 1;
    const dst = new Uint8Array(0x10000 * 2);
    const mask = (palCount <= 0x0100) ? 0x00FF : (palCount <= 0x1000) ? 0x0FFF : -1 as number;
    for (let idx = 0; idx < 0x10000; idx++) {
      let i = idx & 0x7FFF;
      if (mask !== -1) {
        i &= mask;
      } else if (palCount) {
        i %= palCount;
      }
      const s = i << 1;
      const d = idx << 1;
      dst[d] = palBytes[s];
      dst[d + 1] = palBytes[s + 1];
    }
    clrBufferForArrays = dst;
  }


let usingDummyClr = false;

if (fields.isMapBlock && clrBufferForArrays.byteLength === 0) {
  const dst = new Uint8Array(0x10000 * 2);
  dst.fill(0xFF);
  clrBufferForArrays = dst;
  usingDummyClr = true;
}


  const hasColorTable = clrBufferForArrays.byteLength > 0;

  const texcoordOffset = data.getUint32(fields.texcoordOffset);
  const texcoordCount = data.getUint16(fields.texcoordCount);
//  console.log(`Loading ${texcoordCount} texcoords from 0x${texcoordOffset.toString(16)}`);
const texcoordBuffer = dataSubarray(data, texcoordOffset);

  let hasSkinning = false;
  let jointCount = 0;
  if (fields.hasBones) {
    const jointOffset = data.getUint32(fields.jointOffset);
    jointCount = data.getUint8(fields.jointCount);
   // console.log(`Loading ${jointCount} joints from offset 0x${jointOffset.toString(16)}`);
    hasSkinning = jointCount > 0; // ← IMPORTANT: don’t enable skinning with 0 joints.

    model.joints = [];
    if (jointCount > 0) {
      let offs = jointOffset;
      for (let i = 0; i < jointCount; i++) {
        model.joints.push({
          parent: data.getUint8(offs),
          boneNum: data.getUint8(offs + 0x1) & 0x7f,
          translation: readVec3(data, offs + 0x4),
          bindTranslation: readVec3(data, offs + 0x10),
        });
        offs += 0x1c;
      }

      if (fields.weightOffset !== undefined) {
        const weightOffset = data.getUint32(fields.weightOffset);
        const weightCount = data.getUint8(fields.weightCount);
        // Guard: many demo objects have weightCount set but the table is not present (offset 0).
        // Also guard bounds to avoid reading random memory when values are junk.
        const bytesNeeded = weightCount * 4; // each weight record is 4 bytes
        const inBounds = (weightOffset > 0) && (weightOffset + bytesNeeded) <= data.byteLength;
        if (weightCount > 0 && inBounds) {
         // console.log(`Loading ${weightCount} weights from offset 0x${weightOffset.toString(16)}`);
          model.coarseBlends = [];
          let offs = weightOffset;
          for (let i = 0; i < weightCount; i++) {
            const split = data.getUint8(offs + 0x2);
            const influence0 = 0.25 * split;
            model.coarseBlends.push({
              joint0: data.getUint8(offs),
              joint1: data.getUint8(offs + 0x1),
              influence0,
              influence1: 1 - influence0,
            });
            offs += 0x4;
          }
        } else {
         // console.log(`Skipping weights: count=${weightCount}, offset=0x${weightOffset.toString(16)} (not present / OOB)`);
        }
      }

      model.skeleton = new Skeleton();
      model.invBindTranslations = nArray(model.joints.length, () => vec3.create());
      for (let i = 0; i < model.joints.length; i++) {
        const joint = model.joints[i];
        if (joint.boneNum !== i) throw Error("wtf? joint's bone number doesn't match its index!");
        model.skeleton.addJoint(joint.parent != 0xff ? joint.parent : undefined, joint.translation);
        vec3.negate(model.invBindTranslations[i], joint.bindTranslation);
      }
    }
  }

  if (!fields.isMapBlock && fields.isFinal) {
    model.cullRadius = data.getUint16(0xe0);
    model.lightFlags = data.getUint16(0xe2);
  }

  let texMtxCount = 0;
  // Only formats that actually have this header field should read it.
  // Demo/Beta don't define texMtxCount, and reading at undefined => 0x00
  // would corrupt the VCD by adding tons of TEXMTXIDX DIRECT attrs.
  if (fields.hasBones && fields.texMtxCount !== undefined)
    texMtxCount = data.getUint8(fields.texMtxCount);
  //console.warn(`[TEXMTX] texMtxCount=${texMtxCount}`);

  // Debug dump bytes in a range (adjust range as needed)
  for (let off = 0x00; off < 0x150; off++) {
   // console.log(`0x${off.toString(16)}: 0x${data.getUint8(off).toString(16)}`);
  }

  const shaderOffset = data.getUint32(fields.shaderOffset);
  const shaderCount = data.getUint8(fields.shaderCount);
  //console.log(`Loading ${shaderCount} shaders from offset 0x${shaderOffset.toString(16)}`);

  const shaders: Shader[] = [];
  let offs = shaderOffset;
  for (let i = 0; i < shaderCount; i++) {
    const shaderBin = dataSubarray(data, offs, fields.shaderFields.size);
    shaders.push(
      parseShader(
        shaderBin,
        fields.shaderFields,
        texIds,
        normalFlags,
        model.lightFlags,
        texMtxCount,
      ),
    );
    offs += fields.shaderFields.size;
  }

  model.materials = [];

  const dlInfos: DisplayListInfo[] = [];
  const dlInfoCount = data.getUint8(fields.dlInfoCount);
//  console.log(`Loading ${dlInfoCount} display lists...`);

  if (fields.isBeta) {
    for (let i = 0; i < dlInfoCount; i++) {
      const dlOffsetsOffs = data.getUint32(fields.dlOffsets);
      const dlSizesOffs = data.getUint32(fields.dlSizes);
      dlInfos.push({
        offset: readUint32(data, dlOffsetsOffs, i),
        size: readUint16(data, dlSizesOffs, i),
      });
    }
  } else {
    const dlInfoOffset = data.getUint32(fields.dlInfoOffset);
    if (dlInfoOffset === 0 || dlInfoOffset >= data.byteLength) {
     // console.warn(`DL info table missing or OOB: offset=0x${dlInfoOffset.toString(16)} (Demo/object)`);
    } else {
      const fileLen = data.byteLength >>> 0;
      const stride = fields.dlInfoSize >>> 0;
      const bytesAvail = fileLen - dlInfoOffset;
      const maxBySize = Math.floor(bytesAvail / stride);
      const effSlots = Math.max(0, Math.min(dlInfoCount, maxBySize));

      // IMPORTANT: preserve indices — pre-size the array to dlInfoCount.
      // Fill with empty sentinels first.
      for (let i = 0; i < dlInfoCount; i++)
        dlInfos[i] = { offset: 0, size: 0 } as DisplayListInfo;

      let consecutiveInvalid = 0;
      const INVALID_RUN_STOP = 8; // table tail padding heuristic

      for (let i = 0; i < effSlots; i++) {
        const rowOff = dlInfoOffset + i * stride;
        if ((rowOff + stride) > fileLen) {
          consecutiveInvalid++;
          continue;
        }
        const rowDV = dataSubarray(data, rowOff, stride);
        const info = parseDisplayListInfo(rowDV);
        const ok = info.offset > 0 && info.size > 0 && (info.offset + info.size) <= fileLen;
        if (ok) {
          dlInfos[i] = info;
          consecutiveInvalid = 0;
        } else {
          // keep the empty sentinel in place
          consecutiveInvalid++;
        }
        // If we’ve walked into a big padded tail, stop early.
        if (consecutiveInvalid >= INVALID_RUN_STOP) {
          // leave remaining slots as empty sentinels
          break;
        }
      }
    }
  }

  // --- DL table sanity ---
  for (let i = 0; i < dlInfos.length; i++) {
    const { offset, size } = dlInfos[i];
    if (offset === 0 || size === 0) {
     // console.warn(`[DL_SANITY] #${i} empty offset/size (offset=0x${offset.toString(16)}, size=0x${size.toString(16)})`);
    }
    if (offset < 0 || offset + size > data.byteLength) {
     // console.error(`[DL_OOB] #${i} offset=0x${offset.toString(16)} size=0x${size.toString(16)} > fileLen=0x${data.byteLength.toString(16)}`);
    }
  }
 // console.warn(`[DL_SUMMARY] count=${dlInfos.length} dlInfoSize(field)=${fields.dlInfoSize}`);

  const bitsOffsets: number[] = [];
  const bitsByteCounts: number[] = [];
  for (let i = 0; i < fields.bitsOffsets.length; i++) {
    bitsOffsets.push(data.getUint32(fields.bitsOffsets[i]));
    bitsByteCounts.push(data.getUint16(fields.bitsByteCounts[i]));
  }

  if (fields.hasYTranslate)
    model.modelTranslate[1] = data.getInt16(0x8e);

  const pnMatrixMap: number[] = nArray(10, () => 0);

  const getVtxArrays = (posBuffer: DataView, nrmBuffer?: DataView) => {
    const vtxArrays: GX_Array[] = [] as any;
    vtxArrays[GX.Attr.POS] = { buffer: ArrayBufferSlice.fromView(posBuffer), offs: 0, stride: 6 };
    if (fields.hasNormals)
      vtxArrays[GX.Attr.NRM] = { buffer: ArrayBufferSlice.fromView(nrmBuffer!), offs: 0, stride: (normalFlags & NormalFlags.NBT) ? 9 : 3 };
    vtxArrays[GX.Attr.CLR0] = { buffer: ArrayBufferSlice.fromView(clrBufferForArrays), offs: 0, stride: 2 };
    for (let t = 0; t < 8; t++)
      vtxArrays[GX.Attr.TEX0 + t] = { buffer: ArrayBufferSlice.fromView(texcoordBuffer), offs: 0, stride: 4 };
    return vtxArrays;
  };

  const readVertexDesc = (bits: LowBitReader, shader: Shader): GX_VtxDesc[] => {
    //console.log('Setting descriptor');
    const vcd: GX_VtxDesc[] = [] as any;
    for (let i = 0; i <= GX.Attr.MAX; i++) vcd[i] = { type: GX.AttrType.NONE };

      if (fields.hasBones && jointCount >= 2) {
      vcd[GX.Attr.PNMTXIDX].type = GX.AttrType.DIRECT;
      let texmtxNum = 0;
      if (shader.hasHemisphericProbe || shader.hasReflectiveProbe) {
        if (shader.hasNBTTexture) {
          // Binormal matrix index
          vcd[GX.Attr.TEX0MTXIDX + texmtxNum].type = GX.AttrType.DIRECT;
          texmtxNum++;
          // Tangent matrix index
          vcd[GX.Attr.TEX0MTXIDX + texmtxNum].type = GX.AttrType.DIRECT;
          texmtxNum++;
        }
        // Normal matrix index
        vcd[GX.Attr.TEX0MTXIDX + texmtxNum].type = GX.AttrType.DIRECT;
        texmtxNum++;
      }

      // Object-space texture matrices packed from the end (7..0)
      texmtxNum = 7;
      for (let i = 0; i < texMtxCount; i++) {
        vcd[GX.Attr.TEX0MTXIDX + texmtxNum].type = GX.AttrType.DIRECT;
        texmtxNum--;
      }
    }

    // POS
    vcd[GX.Attr.POS].type = bits.get(1) ? GX.AttrType.INDEX16 : GX.AttrType.INDEX8;

    // NRM
    if (fields.hasNormals && (shader.attrFlags & ShaderAttrFlags.NRM))
      vcd[GX.Attr.NRM].type = bits.get(1) ? GX.AttrType.INDEX16 : GX.AttrType.INDEX8;
    else
      vcd[GX.Attr.NRM].type = GX.AttrType.NONE;

    // Colors:
    // Early/Demo map bitstreams still encode the CLR0 size bit even when the shader doesn't use color.
    // If we skip it, the stream desyncs. Consume it whenever a palette is present on maps.
    const mapHasPalette = hasColorTable && !!fields.isMapBlock;
    const wantClr0 = mapHasPalette || !!(shader.attrFlags & ShaderAttrFlags.CLR);
    if (wantClr0) {
      if (isEarly34Map) {
        // Early3/4 maps force CLR as INDEX16 but still encode one size bit — consume it to keep alignment.
       bits.get(1);
        vcd[GX.Attr.CLR0].type = GX.AttrType.INDEX16;
      } else {
        vcd[GX.Attr.CLR0].type = bits.get(1) ? GX.AttrType.INDEX16 : GX.AttrType.INDEX8;
      }
    } else {
      vcd[GX.Attr.CLR0].type = GX.AttrType.NONE;
    }

    // TEX coords (one size bit applies to all present layers)
    if (shader.layers.length > 0) {
      const texCoordDesc = bits.get(1);
      for (let t = 0; t < 8; t++) {
        if (t < shader.layers.length)
          vcd[GX.Attr.TEX0 + t].type = texCoordDesc ? GX.AttrType.INDEX16 : GX.AttrType.INDEX8;
        else
          vcd[GX.Attr.TEX0 + t].type = GX.AttrType.NONE;
      }
    } else {
      for (let t = 0; t < 8; t++)
        vcd[GX.Attr.TEX0 + t].type = GX.AttrType.NONE;
    }

    // DEMO/BETA quirk: command reader aligns to next byte after the VCD group.
    if (fields.oldVat) {
      const misalign = (bits.bitIndex & 7);
      if (misalign) bits.drop(8 - misalign);
    }

    return vcd;
  };

  const runSpecialBitstream = (
    bitsOffset: number,
    bitAddress: number,
    buildSpecialMaterial: BuildMaterialFunc,
    posBuffer: DataView,
    nrmBuffer?: DataView,
  ): Shape => {
   // console.log(`running special bitstream at offset 0x${bitsOffset.toString(16)} bit-address 0x${bitAddress.toString(16)}`);
    const bits = new LowBitReader(data, bitsOffset);
    bits.seekBit(bitAddress);

    bits.drop(4);
    const shaderNum = bits.get(6);
    const shader = shaders[shaderNum];
    const material = buildSpecialMaterial(shader, texFetcher, texIds, fields.isMapBlock);

    bits.drop(4);
    const vcd = readVertexDesc(bits, shader);

    bits.drop(4);
    const num = bits.get(4);
    for (let i = 0; i < num; i++)
      bits.drop(8);

    bits.drop(4);
    const listNum = bits.get(fields.numListBits);
    const dlInfo = dlInfos[listNum];

   // console.log(`Calling special bitstream DL #${listNum} at offset 0x${dlInfo.offset.toString(16)}, size 0x${dlInfo.size.toString(16)}`);

    const displayList = dataSubarray(data, dlInfo.offset, dlInfo.size);
    const vtxArrays = getVtxArrays(posBuffer, nrmBuffer);
    const newGeom = new ShapeGeometry(vtxArrays, vcd, vat, displayList, model.hasFineSkinning);
    newGeom.setPnMatrixMap(pnMatrixMap, hasSkinning, model.hasFineSkinning);

    if (dlInfo.aabb !== undefined)
      newGeom.setBoundingBox(dlInfo.aabb);
    if (dlInfo.sortLayer !== undefined)
      newGeom.setSortLayer(dlInfo.sortLayer);

    return new Shape(newGeom, new ShapeMaterial(material), false);
  };

  const runSpecialBitstreamMulti = (
    bitsOffset: number,
    bitAddress: number,
    buildSpecialMaterial: BuildMaterialFunc,
    posBuffer: DataView,
    nrmBuffer: DataView | undefined,
    fallbackVcd: GX_VtxDesc[],
    shouldKeepShader: (shader: Shader) => boolean,
  ): Shape[] => {
    const out: Shape[] = [];
    const bits = new LowBitReader(data, bitsOffset);
    bits.seekBit(bitAddress);

    let locShader = shaders[0];
    let locMaterial = buildSpecialMaterial(locShader, texFetcher, texIds, fields.isMapBlock);
    let locVcd: GX_VtxDesc[] = fallbackVcd.slice();
    let done = false;

    while (!done) {
      const op = bits.get(4);
      switch (op) {
        case Opcode.SetShader: {
          const shaderNum = bits.get(6);
          locShader = shaders[shaderNum];
          locMaterial = buildSpecialMaterial(locShader, texFetcher, texIds, fields.isMapBlock);
          break;
        }
        case Opcode.SetVCD: {
          locVcd = readVertexDesc(bits, locShader);
          break;
        }
        case Opcode.SetMatrices: {
          const numBones = bits.get(4);
          for (let i = 0; i < numBones; i++)
            bits.get(8);
          break;
        }
        case Opcode.CallDL: {
          const listNum = bits.get(fields.numListBits);
          if (listNum >= dlInfos.length) break;
          if (!shouldKeepShader(locShader)) break;

          const dlInfo = dlInfos[listNum];
          const displayList = dataSubarray(data, dlInfo.offset, dlInfo.size);
          const vtxArrays = getVtxArrays(posBuffer, nrmBuffer);

          const geom = new ShapeGeometry(vtxArrays, locVcd, vat, displayList, model.hasFineSkinning);
          geom.setPnMatrixMap(pnMatrixMap, hasSkinning, model.hasFineSkinning);
          if (dlInfo.aabb !== undefined) geom.setBoundingBox(dlInfo.aabb);
          if (dlInfo.sortLayer !== undefined) geom.setSortLayer(dlInfo.sortLayer);

          out.push(new Shape(geom, new ShapeMaterial(locMaterial), false));
          break;
        }
        case Opcode.End:
          done = true;
          break;
        default:
          done = true;
          break;
      }
    }
    return out;
  };

  // === VCD/DL STRIDE FORCE (robust) ===
  function isLikelyGXOpcode(b: number): boolean {
    // BP write (0x61), small CP/XF-ish (0x08/0x10/0x20/0x40), and GX draws 0x80..0x9F
    return b === 0x61 || b === 0x08 || b === 0x10 || b === 0x20 || b === 0x40 || (b >= 0x80 && b <= 0x9f);
  }

  function vcdClone(vcd: GX_VtxDesc[]): GX_VtxDesc[] {
    return vcd.map(x => ({ type: x?.type ?? GX.AttrType.NONE }));
  }

  function vcdIndexBytes(vcd: GX_VtxDesc[]): number {
    const b = (a: number) =>
      vcd[a]?.type === GX.AttrType.INDEX16 ? 2 :
      vcd[a]?.type === GX.AttrType.INDEX8  ? 1 : 0;

    return b(GX.Attr.POS) + b(GX.Attr.NRM) + b(GX.Attr.CLR0) + b(GX.Attr.TEX0) + b(GX.Attr.TEX1) + b(GX.Attr.TEX2) + b(GX.Attr.TEX3);
  }

  function vcdDirectBytes(vcd: GX_VtxDesc[]): number {
    let d = 0;
    if (vcd[GX.Attr.PNMTXIDX]?.type === GX.AttrType.DIRECT) d++;
    for (let i = 0; i < 8; i++)
      if (vcd[GX.Attr.TEX0MTXIDX + i]?.type === GX.AttrType.DIRECT) d++;
    return d;
  }

  function guessTargetStride(data: DataView, dlOff: number, dlSize: number): number | null {
    if (dlSize < 4) return null;
    const prim = data.getUint8(dlOff);
    if (!(prim >= 0x80 && prim <= 0x9f)) return null; // must start with a GX draw

    const count = data.getUint16(dlOff + 1, false /* BE */);
    if (count === 0 || count > 0x4000) return null;

    const endMax = dlOff + dlSize;
    const samePrim: number[] = [];
    const draw: number[] = [];
    const other: number[] = [];

    for (let s = 2; s <= 24; s++) {
      const pos = dlOff + 3 + count * s;
      if (pos >= endMax) break;
      const b = data.getUint8(pos);
      if (b === prim) samePrim.push(s);
      else if (b >= 0x80 && b <= 0x9f) draw.push(s);
      else if (b === 0x61 || b === 0x08 || b === 0x10 || b === 0x20 || b === 0x40) other.push(s);
    }

    if (samePrim.length) return samePrim[0];
    if (draw.length)     return draw[0];
    if (other.length)    return other[0];
    return null;
  }

  function scanStrideCandidates(data: DataView, dlOff: number, dlSize: number): number[] {
    if (dlSize < 4) return [];
    const prim = data.getUint8(dlOff);
    if (!(prim >= 0x80 && prim <= 0x9f)) return [];

    const count = data.getUint16(dlOff + 1, false /* BE */);
    if (count === 0 || count > 0x4000) return [];

    const endMax = dlOff + dlSize;
    const samePrim: number[] = [];
    const draw: number[] = [];
    const other: number[] = [];

    for (let s = 2; s <= 24; s++) {
      const pos = dlOff + 3 + count * s;
      if (pos >= endMax) break;
      const b = data.getUint8(pos);
      if (b === prim) samePrim.push(s);
      else if (b >= 0x80 && b <= 0x9f) draw.push(s);
      else if (b === 0x61 || b === 0x08 || b === 0x10 || b === 0x20 || b === 0x40) other.push(s);
    }
    return [...samePrim, ...draw, ...other];
  }

  function forceVCDStrideTo(vcdIn: GX_VtxDesc[], targetStride: number): GX_VtxDesc[] {
    const v = vcdClone(vcdIn);
    let cur = vcdIndexBytes(v) + vcdDirectBytes(v);
    if (cur === targetStride) return v;

    if (cur < targetStride) {
      let need = targetStride - cur;

      // Ensure PNMTXIDX is DIRECT first (adds 1)
      if (need > 0 && v[GX.Attr.PNMTXIDX]?.type !== GX.AttrType.DIRECT) {
        v[GX.Attr.PNMTXIDX] = { type: GX.AttrType.DIRECT };
        need--;
      }
      // Then enable TEXnMTXIDX as DIRECT until we hit the target
      for (let i = 0; i < 8 && need > 0; i++) {
        const a = GX.Attr.TEX0MTXIDX + i;
        if ((v[a]?.type ?? GX.AttrType.NONE) !== GX.AttrType.DIRECT) {
          v[a] = { type: GX.AttrType.DIRECT };
          need--;
        }
      }
      return v;
    } else {
      let over = cur - targetStride;

      // Drop TEXnMTXIDX first
      for (let i = 7; i >= 0 && over > 0; i--) {
        const a = GX.Attr.TEX0MTXIDX + i;
        if (v[a]?.type === GX.AttrType.DIRECT) {
          v[a] = { type: GX.AttrType.NONE };
          over--;
        }
      }
      // Then drop PNMTXIDX if needed
      if (over > 0 && v[GX.Attr.PNMTXIDX]?.type === GX.AttrType.DIRECT) {
        v[GX.Attr.PNMTXIDX] = { type: GX.AttrType.NONE };
        over--;
      }
      return v;
    }
  }

  function tuneVCDForDL(
    data: DataView,
    dlOff: number,
    dlSize: number,
    baseVcd: GX_VtxDesc[],
    fields: any,
    shader: Shader
  ): GX_VtxDesc[] {
    if (!fields.oldVat || dlSize < 4) return baseVcd;

    const target = guessTargetStride(data, dlOff, dlSize);
    if (target == null) return baseVcd;

    const curStride = vcdIndexBytes(baseVcd) + vcdDirectBytes(baseVcd);
    if (curStride === target) return baseVcd;

    const forced = forceVCDStrideTo(baseVcd, target);
    const newStride = vcdIndexBytes(forced) + vcdDirectBytes(forced);
    if (newStride === target) {
     // console.warn(
      //  `[VCD_FORCE] @0x${dlOff.toString(16)} stride ${curStride} -> ${newStride} ` +
      //  `(PN=${forced[GX.Attr.PNMTXIDX]?.type === GX.AttrType.DIRECT ? 1 : 0}, ` +
      //  `TEXMTX=${(() => { let n=0; for(let i=0;i<8;i++) if (forced[GX.Attr.TEX0MTXIDX+i]?.type===GX.AttrType.DIRECT) n++; return n; })()})`
    //  );
      return forced;
    }
    return baseVcd;
  }
  // === END VCD/DL STRIDE FORCE ===

  const runBitstream = (
    modelShapes: ModelShapes,
    bitsOffset: number,
    drawStep: number,
    posBuffer: DataView,
    nrmBuffer?: DataView,
  ) => {
   // console.log(`running bitstream at offset 0x${bitsOffset.toString(16)}`);
   // console.warn(`[RUN_BITS] drawStep=${drawStep} offset=0x${bitsOffset.toString(16)}`);

    modelShapes.shapes[drawStep] = [];
    const shapes = modelShapes.shapes[drawStep];
    if (bitsOffset === 0) return;

    let curShader = shaders[0];
    let curMaterial: SFAMaterial | undefined = undefined;

    function dlHasAlphaCompare(dl: DataView): boolean {
      const bytes = new Uint8Array(dl.buffer, dl.byteOffset, dl.byteLength);
      for (let i = 0; i + 4 < bytes.length; i++) {
        // GX BP write opcode=0x61; next byte is BP register (Alpha Compare is 0xF3).
        if (bytes[i] === 0x61 && bytes[i + 1] === 0xF3) return true;
      }
      return false;
    }

    const setShader = (num: number) => {
      curShader = shaders[num];
      if (model.materials[num] === undefined) {
        if (fields.isMapBlock)
if (usingDummyClr) {
  const cloned = {
    ...curShader,
    attrFlags: curShader.attrFlags & ~ShaderAttrFlags.CLR,
  };
  model.materials[num] = materialFactory.buildMapMaterial(cloned, texFetcher);
} else {
  model.materials[num] = materialFactory.buildMapMaterial(curShader, texFetcher);
}
        else
          model.materials[num] = materialFactory.buildObjectMaterial(curShader, texFetcher, hasSkinning);
      }
      curMaterial = model.materials[num];
    };
    setShader(0);

    const bits = new LowBitReader(data, bitsOffset);
    let vcd: GX_VtxDesc[] = [];
    let done = false;

    while (!done) {
      const opcode = bits.get(4);
      switch (opcode) {
        case Opcode.SetShader: {
          const shaderNum = bits.get(6);
        //  console.log(`Setting shader #${shaderNum}`);
          setShader(shaderNum);
          break;
        }

        case Opcode.CallDL: {
          const listNum = bits.get(fields.numListBits);
         // console.warn(`[CALL_DL] list=${listNum}/${dlInfos.length} step=${drawStep} numListBits(field)=${fields.numListBits}`);
          if (listNum >= dlInfos.length) {
           // console.warn(`Can't draw display list #${listNum} (out of range)`);
            continue;
          }
          const dlInfo = dlInfos[listNum];
          if (!dlInfo || dlInfo.offset === 0 || dlInfo.size === 0 || (dlInfo.offset + dlInfo.size) > data.byteLength) {
          //  console.warn(`[DL_SKIP] list=${listNum} invalid dlInfo (offs=0x${dlInfo?.offset?.toString(16) ?? '??'} size=0x${dlInfo?.size?.toString(16) ?? '??'})`);
            break;
          }

          const displayList = dataSubarray(data, dlInfo.offset, dlInfo.size);
        //  console.warn(`[DL] #${listNum} offs=0x${dlInfo.offset.toString(16)} size=0x${dlInfo.size.toString(16)}`);

          // --- DL sniff logs (first 10 DLs only) ---
          if (listNum < 10) {
            try {
              const base = dlInfo.offset >>> 0;
              const prim = data.getUint8(base);
              const cnt = data.getUint16(base + 1, false /* BE */);
              if (prim >= 0x80 && prim <= 0x9f && cnt > 0) {
                const candidates: string[] = [];
                for (const s of [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]) {
                  const p2 = base + 3 + cnt * s;
                  if (p2 < data.byteLength) {
                    const b = data.getUint8(p2);
                    if (isLikelyGXOpcode(b)) candidates.push(`s=${s}->0x${b.toString(16)} @+0x${(p2-base).toString(16)}`);
                  }
                }
             //   console.warn(`[DL_STRIDE_GUESS] list=${listNum} prim=0x${prim.toString(16)} count=${cnt} candidates=[${candidates.join(', ')}]`);
              } else {
             //   console.warn(`[DL_STRIDE_GUESS] list=${listNum} prim=0x${prim.toString(16)} (not GX draw)`);
              }
            } catch (e) {
            //  console.warn(`[DL_STRIDE_GUESS] list=${listNum} error: ${e instanceof Error ? e.message : String(e)}`);
            }

            // Dump first 16 bytes
            {
              const base = dlInfo.offset >>> 0;
              const lim = Math.min(base + 16, data.byteLength);
              let s = '';
              for (let p = base; p < lim; p++) s += data.getUint8(p).toString(16).padStart(2, '0') + ' ';
            //  console.warn(`[DL_BYTES] list=${listNum} @0x${base.toString(16)} : ${s.trim()}`);
            }

            // Find first plausible GX opcode within +0x40
            {
              const base = dlInfo.offset >>> 0;
              const maxFwd = Math.min(0x40, Math.max(0, data.byteLength - base));
              let firstGX = -1;
              for (let d = 0; d < maxFwd; d++) {
                const b = data.getUint8(base + d);
                if (isLikelyGXOpcode(b)) { firstGX = base + d; break; }
              }
             // console.warn(`[DL_SNIFF] list=${listNum} firstGX=${firstGX >= 0 ? '0x' + firstGX.toString(16) : 'none'} delta=${firstGX >= 0 ? '0x' + (firstGX - base).toString(16) : 'n/a'}`);
              if (firstGX >= 0) {
                const lim2 = Math.min(firstGX + 16, data.byteLength);
                let s2 = '';
                for (let p = firstGX; p < lim2; p++) s2 += data.getUint8(p).toString(16).padStart(2, '0') + ' ';
              //  console.warn(`[DL_BYTES+] list=${listNum} @0x${firstGX.toString(16)} : ${s2.trim()}`);
              }
            }
          }
          // --- end DL sniff logs ---

          if ((displayList.byteLength | 0) === 0) {
          //  console.warn('[GEOM] Empty display list -> nothing to render');
          }

          // Early1/Early3: detect BP alpha-compare and OR it into the shader if necessary.
          if ((fields.shaderFields as any).isEarly1 || (fields.shaderFields as any).isEarly3) {
            if (!(curShader.flags & ShaderFlags.AlphaCompare) && dlHasAlphaCompare(displayList)) {
              curShader.flags |= ShaderFlags.AlphaCompare;
            }
          }

          const hasSpecial = dlInfo.specialBitAddress !== undefined && dlInfo.specialBitAddress !== 0;
          const shaderSaysWater = !!(curShader.flags & ShaderFlags.Water);
          const shaderSaysLava  = !!(curShader.flags & ShaderFlags.Lava);

          const isEarly1 = (version === ModelVersion.Early1) || !!fields.shaderFields?.isEarly1;
          const isEarly3 = (version === ModelVersion.Early3) || !!fields.shaderFields?.isEarly3;
          const isold    = (version === ModelVersion.Early1) || !!fields.shaderFields?.isold;

          let waterStreamIndex = -1;
          if (isEarly1 && bitsOffsets.length > 0) {
            waterStreamIndex = (bitsOffsets.length >= 3 && bitsOffsets[2] !== 0) ? 2 : (bitsOffsets.length - 1);
          } else if (isEarly3 && bitsOffsets.length > 0) {
            waterStreamIndex = bitsOffsets.length - 1;
          } else if (isold && bitsOffsets.length > 0) {
            waterStreamIndex = (bitsOffsets.length >= 3 && bitsOffsets[2] !== 0) ? 2 : (bitsOffsets.length - 1);
          }
          const isDedicatedWaterPass = !!fields.isMapBlock && waterStreamIndex >= 0 && drawStep === waterStreamIndex;

          const tryPushWaterFromSpecial = (): boolean => {
            if (!hasSpecial) return false;
            const ws = runSpecialBitstreamMulti(
              bitsOffset,
              dlInfo.specialBitAddress!,
              materialFactory.buildWaterMaterial.bind(materialFactory),
              posBuffer,
              nrmBuffer,
              vcd,
              (s) => !!(s.flags & ShaderFlags.Water) && !(s.flags & ShaderFlags.Lava)
            );
            if (ws.length > 0) {
              for (const s of ws) modelShapes.waters.push(s);
              return true;
            }
            return false;
          };

          // Sanity: warn if VCD asks for buffers that don't exist
          if (vcd[GX.Attr.CLR0]?.type !== GX.AttrType.NONE && clrCount === 0)
          //  console.error('[ATTR] CLR0 requested but clrCount==0');
          if (vcd[GX.Attr.NRM]?.type !== GX.AttrType.NONE && !fields.hasNormals)
            console.error('[ATTR] NRM requested but hasNormals==false');

          // ---- WATER path ----
          if (!shaderSaysLava && (shaderSaysWater || isDedicatedWaterPass)) {
            if (tryPushWaterFromSpecial()) break;

            const vtxArrays = getVtxArrays(posBuffer, nrmBuffer);
            const waterMat = materialFactory.buildWaterMaterial(curShader);
const tunedVcd = tuneVCDForDL(data, dlInfo.offset, dlInfo.size, vcd, fields, curShader);

            const geom = new ShapeGeometry(vtxArrays, tunedVcd, vat, displayList, model.hasFineSkinning);
            geom.setPnMatrixMap(pnMatrixMap, hasSkinning, model.hasFineSkinning);
            if (dlInfo.aabb !== undefined) geom.setBoundingBox(dlInfo.aabb);
            if (dlInfo.sortLayer !== undefined) geom.setSortLayer(dlInfo.sortLayer);

            const shape = new Shape(geom, new ShapeMaterial(waterMat), false);
            modelShapes.waters.push(shape);
            break;
          }

          // ---- Normal geometry path ----
          const vtxArrays = getVtxArrays(posBuffer, nrmBuffer);

          // Early-3: DL enables alpha-compare? clone material once.
          let materialForDL = curMaterial!;
          if ((fields.shaderFields as any).isEarly3 &&
              !(curShader.flags & ShaderFlags.AlphaCompare) &&
              dlHasAlphaCompare(displayList)) {
            const cloned: Shader = { ...curShader, flags: curShader.flags | ShaderFlags.AlphaCompare };
            materialForDL = fields.isMapBlock
              ? materialFactory.buildMapMaterial(cloned, texFetcher)
              : materialFactory.buildObjectMaterial(cloned, texFetcher, fields.hasBones && jointCount >= 2);
          }

const tunedVcd = tuneVCDForDL(data, dlInfo.offset, dlInfo.size, vcd, fields, curShader);

          // Guard tiny DLs (cnt*s beyond size)
          {
            try {
              const base = dlInfo.offset >>> 0;
              const prim = data.getUint8(base);
              const cnt = data.getUint16(base + 1, false);
              if (prim >= 0x80 && prim <= 0x9f && cnt > 0) {
                const b = (a: number) => tunedVcd[a]?.type === GX.AttrType.INDEX16 ? 2
                                    : tunedVcd[a]?.type === GX.AttrType.INDEX8  ? 1 : 0;
                let direct = 0;
                if (tunedVcd[GX.Attr.PNMTXIDX]?.type === GX.AttrType.DIRECT) direct++;
                for (let i = 0; i < 8; i++)
                  if (tunedVcd[GX.Attr.TEX0MTXIDX + i]?.type === GX.AttrType.DIRECT) direct++;

                const idxBytes = b(GX.Attr.POS) + b(GX.Attr.NRM) + b(GX.Attr.CLR0) + b(GX.Attr.TEX0) +
                                 b(GX.Attr.TEX1) + b(GX.Attr.TEX2) + b(GX.Attr.TEX3);
                const needed = 3 + cnt * (idxBytes + direct);
                if (needed > dlInfo.size) {
              //    console.warn(`[DL_TINY_SKIP] list=${listNum} cnt=${cnt} need=${needed} > size=${dlInfo.size}`);
                  break; // skip this DL only
                }
              }
            } catch { /* ignore sniff errors */ }
          }

          const attrTypeToStr = (t: GX.AttrType) =>
            t === GX.AttrType.NONE ? 'NONE' :
            t === GX.AttrType.DIRECT ? 'DIRECT' :
            t === GX.AttrType.INDEX8 ? 'INDEX8' :
            t === GX.AttrType.INDEX16 ? 'INDEX16' : `UNK(${t})`;

          const logGeomFail = (e: unknown, tag: string) => {
            const v = (a: GX.Attr) => tunedVcd[a]?.type ?? GX.AttrType.NONE;
            const typeStr = (t: GX.AttrType) =>
              t === GX.AttrType.NONE ? 'NONE' :
              t === GX.AttrType.DIRECT ? 'DIRECT' :
              t === GX.AttrType.INDEX8 ? 'INDEX8' :
              t === GX.AttrType.INDEX16 ? 'INDEX16' : `${t}`;

            const posStride = 6, nrmStride = (normalFlags & NormalFlags.NBT) ? 9 : 3, texStride = 4;
            const msg = (e as Error)?.message ?? String(e);

           // console.warn(
           //   `[GEOM_FAIL:${tag}] list=${listNum}/${dlInfos.length} step=${drawStep} ` +
           //   `offs=0x${dlInfo.offset.toString(16)} size=0x${dlInfo.size.toString(16)} ` +
           //   `VCD{POS=${typeStr(v(GX.Attr.POS))} NRM=${typeStr(v(GX.Attr.NRM))} CLR=${typeStr(v(GX.Attr.CLR0))} ` +
           //   `T0=${typeStr(v(GX.Attr.TEX0))} T1=${typeStr(v(GX.Attr.TEX1))} T2=${typeStr(v(GX.Attr.TEX2))} T3=${typeStr(v(GX.Attr.TEX3))} ` +
           //   `PN=${typeStr(v(GX.Attr.PNMTXIDX))} TMX#=${(() => { let n=0; for(let i=0;i<8;i++) if (tunedVcd[GX.Attr.TEX0MTXIDX+i]?.type===GX.AttrType.DIRECT) n++; return n; })()}} ` +
           //   `VAT5{POS.shift=${vat[5][GX.Attr.POS].compShift} NRM.compType=${vat[5][GX.Attr.NRM].compType}} ` +
           //   `POS{offs=0 len=${posBuffer.byteLength} stride=${posStride}} ` +
           //   `NRM{offs=0 len=${nrmBuffer?.byteLength ?? 0} stride=${nrmStride}} ` +
           //   `CLR{offs=0 len=${clrBufferForArrays.byteLength} stride=2} ` +
           //   `T0{offs=0 len=${texcoordBuffer.byteLength} stride=${texStride}} ` +
           //   `msg=${msg}`
           // );
          };

          try {
            const geom = new ShapeGeometry(vtxArrays, tunedVcd, vat, displayList, model.hasFineSkinning);
            geom.setPnMatrixMap(pnMatrixMap, hasSkinning, model.hasFineSkinning);
            if (dlInfo.aabb !== undefined) geom.setBoundingBox(dlInfo.aabb);
            if (dlInfo.sortLayer !== undefined) geom.setSortLayer(dlInfo.sortLayer);

            const shape = new Shape(
              geom,
              new ShapeMaterial(materialForDL),
              !!(curShader.flags & ShaderFlags.DevGeometry)
            );
            shapes.push(shape);
          } catch (err) {
            logGeomFail(err, 'PRIMARY');

            // Retry Z: alternative vertex strides for THIS DL only.
            {
              const altSeq = scanStrideCandidates(data, dlInfo.offset, dlInfo.size);
              let recovered = false;
              for (const s of altSeq) {
                const vcdAlt = forceVCDStrideTo(vcd, s);
                const curIdx = vcdIndexBytes(vcdAlt) + vcdDirectBytes(vcdAlt);
                if (curIdx !== s) continue;

                try {
                  const geomAlt = new ShapeGeometry(vtxArrays, vcdAlt, vat, displayList, model.hasFineSkinning);
                  geomAlt.setPnMatrixMap(pnMatrixMap, hasSkinning, model.hasFineSkinning);
                  if (dlInfo.aabb !== undefined) geomAlt.setBoundingBox(dlInfo.aabb);
                  if (dlInfo.sortLayer !== undefined) geomAlt.setSortLayer(dlInfo.sortLayer);

                  const shapeAlt = new Shape(
                    geomAlt,
                    new ShapeMaterial(materialForDL),
                    !!(curShader.flags & ShaderFlags.DevGeometry)
                  );
                  shapes.push(shapeAlt);
                 // console.warn(`[GEOM_RETRY_OK] list=${listNum} via alt stride=${s}`);
                  recovered = true;
                  break;
                } catch (errAlt) {
                  logGeomFail(errAlt, `RETRY+ALTSTRIDE(${s})`);
                }
              }
              if (recovered) break;
            }

            // Retry A: skip 0x20 preamble seen in some demo DLs
            if (dlInfo.size > 0x20) {
              try {
                const displayList2 = dataSubarray(data, dlInfo.offset + 0x20, dlInfo.size - 0x20);
                const geom2 = new ShapeGeometry(vtxArrays, tunedVcd, vat, displayList2, model.hasFineSkinning);
                geom2.setPnMatrixMap(pnMatrixMap, hasSkinning, model.hasFineSkinning);
                if (dlInfo.aabb !== undefined) geom2.setBoundingBox(dlInfo.aabb);
                if (dlInfo.sortLayer !== undefined) geom2.setSortLayer(dlInfo.sortLayer);

                const shape2 = new Shape(
                  geom2,
                  new ShapeMaterial(materialForDL),
                  !!(curShader.flags & ShaderFlags.DevGeometry)
                );
                shapes.push(shape2);
               // console.warn(`[GEOM_RETRY_OK] list=${listNum} (skipped 0x20-byte DL header)`);
                break;
              } catch (err2) {
                logGeomFail(err2, 'RETRY+SKIP20');
              }
            }

            // Retry B: drop PNMTXIDX as last resort
            if (tunedVcd[GX.Attr.PNMTXIDX]?.type === GX.AttrType.DIRECT) {
              const vcdRetry = tunedVcd.slice();
              vcdRetry[GX.Attr.PNMTXIDX] = { type: GX.AttrType.NONE };
              try {
                const geom = new ShapeGeometry(vtxArrays, vcdRetry, vat, displayList, model.hasFineSkinning);
                geom.setPnMatrixMap(pnMatrixMap, /*hasSkinning*/ false, model.hasFineSkinning);
                if (dlInfo.aabb !== undefined) geom.setBoundingBox(dlInfo.aabb);
                if (dlInfo.sortLayer !== undefined) geom.setSortLayer(dlInfo.sortLayer);

                const shape = new Shape(
                  geom,
                  new ShapeMaterial(materialForDL),
                  !!(curShader.flags & ShaderFlags.DevGeometry)
                );
                shapes.push(shape);
              //  console.warn(`[GEOM_RETRY_OK] list=${listNum} (PNMTXIDX disabled)`);
                break;
              } catch (err3) {
                logGeomFail(err3, 'RETRY');
              }

              // Retry C: PNMTXIDX disabled + skip 0x20
              if (dlInfo.size > 0x20) {
                try {
                  const displayList3 = dataSubarray(data, dlInfo.offset + 0x20, dlInfo.size - 0x20);
                  const geom3 = new ShapeGeometry(vtxArrays, vcdRetry, vat, displayList3, model.hasFineSkinning);
                  geom3.setPnMatrixMap(pnMatrixMap, /*hasSkinning*/ false, model.hasFineSkinning);
                  if (dlInfo.aabb !== undefined) geom3.setBoundingBox(dlInfo.aabb);
                  if (dlInfo.sortLayer !== undefined) geom3.setSortLayer(dlInfo.sortLayer);

                  const shape3 = new Shape(
                    geom3,
                    new ShapeMaterial(materialForDL),
                    !!(curShader.flags & ShaderFlags.DevGeometry)
                  );
                  shapes.push(shape3);
                 // console.warn(`[GEOM_RETRY_OK] list=${listNum} (PNMTXIDX disabled + skip 0x20)`);
                  break;
                } catch (err4) {
                  logGeomFail(err4, 'RETRY+PNOFF+SKIP20');
                }
              }
            }
          }

          // ---- FUR path ----
          if (drawStep === 0 &&
              (curShader.flags & (ShaderFlags.ShortFur | ShaderFlags.MediumFur | ShaderFlags.LongFur)) &&
              (dlInfo.specialBitAddress !== undefined && dlInfo.specialBitAddress !== 0)) {
            const furShapes = runSpecialBitstreamMulti(
              bitsOffset,
              dlInfo.specialBitAddress!,
              materialFactory.buildFurMaterial.bind(materialFactory),
              posBuffer,
              nrmBuffer,
              vcd,
              (s) => !!(s.flags & (ShaderFlags.ShortFur | ShaderFlags.MediumFur | ShaderFlags.LongFur))
            );
            const firstFur = furShapes[0];
            if (firstFur) {
              const layers = (curShader.flags & ShaderFlags.LongFur) ? 16
                           : (curShader.flags & ShaderFlags.MediumFur) ? 8 : 4;
              modelShapes.furs.push({ shape: firstFur, numLayers: layers });
            }
          }

          break;
        }

        case Opcode.SetVCD: {
          vcd = readVertexDesc(bits, curShader);

          const attrTypeToStr = (t: GX.AttrType) =>
            t === GX.AttrType.NONE ? 'NONE' :
            t === GX.AttrType.DIRECT ? 'DIRECT' :
            t === GX.AttrType.INDEX8 ? 'INDEX8' :
            t === GX.AttrType.INDEX16 ? 'INDEX16' : `UNK(${t})`;

          const show = (a: number) => attrTypeToStr(vcd[a]?.type ?? GX.AttrType.NONE);
        //  console.warn(
         //   `[VCD] POS=${show(GX.Attr.POS)} NRM=${show(GX.Attr.NRM)} CLR=${show(GX.Attr.CLR0)} ` +
        //    `T0=${show(GX.Attr.TEX0)} T1=${show(GX.Attr.TEX1)} T2=${show(GX.Attr.TEX2)} T3=${show(GX.Attr.TEX3)}`
       //   );

          const b = (a: number) =>
            vcd[a]?.type === GX.AttrType.INDEX16 ? 2 :
            vcd[a]?.type === GX.AttrType.INDEX8  ? 1 : 0;
          const idxBytesExpected =
            b(GX.Attr.POS) + b(GX.Attr.NRM) + b(GX.Attr.CLR0) + b(GX.Attr.TEX0) + b(GX.Attr.TEX1) + b(GX.Attr.TEX2) + b(GX.Attr.TEX3);
        //  console.warn(`[VCD_EXPECT] idxBytesPerVertex=${idxBytesExpected}`);

          let directBytes = 0;
          if (vcd[GX.Attr.PNMTXIDX]?.type === GX.AttrType.DIRECT) directBytes += 1;
          for (let i = 0; i < 8; i++) {
            if (vcd[GX.Attr.TEX0MTXIDX + i]?.type === GX.AttrType.DIRECT) directBytes += 1;
          }
        //  console.warn(`[VCD_DIRECT] directBytesPerVertex=${directBytes}`);
          break;
        }

        case Opcode.SetMatrices: {
          // Ignored for maps; relevant only for objects
          const numBones = bits.get(4);
          if (numBones > 10) throw Error('Too many PN matrices');
          for (let i = 0; i < numBones; i++)
            pnMatrixMap[i] = bits.get(8);
          break;
        }

        case Opcode.End:
          done = true;
          break;

        default:
        //  console.warn(`Skipping unknown model bits opcode ${opcode}`);
          break;
      }
    }
  };

  model.createModelShapes = () => {
    let instancePosBuffer: DataView;
    let instanceNrmBuffer: DataView | undefined;

    if (model.hasFineSkinning) {
      instancePosBuffer = dataCopy(model.originalPosBuffer);
      instanceNrmBuffer = dataCopy(model.originalNrmBuffer);
    } else {
      instancePosBuffer = model.originalPosBuffer;
      instanceNrmBuffer = model.originalNrmBuffer;
    }

    const modelShapes = new ModelShapes(model, instancePosBuffer, instanceNrmBuffer);

    for (let i = 0; i < bitsOffsets.length; i++) {
      try {
        runBitstream(modelShapes, bitsOffsets[i], i, modelShapes.posBuffer, modelShapes.nrmBuffer);
      } catch (err) {
      //  console.error(
       //   `[RUN_BITS_CRASH] step=${i} bitsOffs=0x${bitsOffsets[i].toString(16)} ` +
       //   `posLen=${modelShapes.posBuffer.byteLength} nrmLen=${modelShapes.nrmBuffer?.byteLength ?? 0} ` +
      //    `msg=${(err as Error)?.message}`
      //  );
        console.error(err);
        
      }
    }

    return modelShapes;
  };

  if (!model.hasFineSkinning)
    model.sharedModelShapes = model.createModelShapes();

  if (model.sharedModelShapes) {
    const countStep = (arr?: Shape[]) => (arr ? arr.length : 0);
//   console.warn(
      `[RESULT] opaque0=${countStep(model.sharedModelShapes.shapes[0])} ` +
     `pass1=${countStep(model.sharedModelShapes.shapes[1])} ` +
      `pass2=${countStep(model.sharedModelShapes.shapes[2])} ` +
      `waters=${model.sharedModelShapes.waters.length} ` +
      `furs=${model.sharedModelShapes.furs.length}`
 //   );
  }

  return model; 
}
