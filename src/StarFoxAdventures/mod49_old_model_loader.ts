import ArrayBufferSlice from '../ArrayBufferSlice.js';
import { GX_Array, GX_VtxAttrFmt, GX_VtxDesc } from '../gx/gx_displaylist.js';
import * as GX from '../gx/gx_enum.js';
import { colorNewFromRGBA } from '../Color.js';
import { nArray } from '../util.js';

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
import { TextureFetcher } from './textures.js';

import {
  MOD49_DBAY_GROUP_MATERIALS,
  type Mod49DbayGroupMaterial,
} from './mod49_dbay_group_materials.js';

export function loadMod49OldModel(
  data: DataView,
  texFetcher: TextureFetcher,
  materialFactory: MaterialFactory,
  version: number,
  blockNum: number = -1,
): Model {
   // console.warn(`[MOD49 OLD RENDER ENTER] byteLength=${data.byteLength}`);

    const u24 = (offs: number): number => {
        return (data.getUint8(offs + 0) << 16) |
               (data.getUint8(offs + 1) << 8) |
               (data.getUint8(offs + 2) << 0);
    };

    const hexBytes = (off: number, len: number): string => {
        const out: string[] = [];
        for (let i = 0; i < len && off + i < data.byteLength; i++)
            out.push(data.getUint8(off + i).toString(16).padStart(2, '0'));
        return out.join(' ');
    };

    const getDebugNumber = (name: string, fallback: number): number => {
        let raw: any = undefined;

        try {
            raw = (window as any)[name];
        } catch {
        }

        if (raw === undefined || raw === null || raw === '') {
            try {
                raw = localStorage.getItem(name);
            } catch {
            }
        }

        if (raw === undefined || raw === null || raw === '')
            return fallback;

        const n = typeof raw === 'number' ? raw : Number(raw);
        return Number.isFinite(n) ? n : fallback;
    };

    const model = new Model(version);
    model.modelData = data;
    model.isMapBlock = true;
    model.cullRadius = 100000;

    const vtxSection = u24(0x0E);
    const triSection = u24(0x12);
    const groupSection = u24(0x16);

    const headerStride = data.getUint16(0x39, false);
    const vertexCount = data.getUint16(0x3B, false);
    const triCount = data.getUint16(0x3D, false);
    const groupCount = data.getUint16(0x3F, false);

    const vertexRecordSize = 0x10;

    const vtxStart = vtxSection + 9;
    const triStart = triSection + 9;
    const groupStart = groupSection + 9;

    const GROUP_TEX_FIELD = getDebugNumber('__MOD49_GROUP_TEX_FIELD', 0x00) | 0;
    const FORCE_TEX_ID = getDebugNumber('__MOD49_TEX_ID', NaN);
    const DBAY_TEX_IDS_FALLBACK = [
        16, 127, 252, 253, 254, 255, 256, 257, 258, 259, 273, 368,
        1053, 1057, 1058, 1059, 1062, 1226, 1247, 1260, 1274, 1682,
        1839, 1840, 1841, 1842, 1843, 1844, 1845, 1846, 1847, 1848,
        1854, 1855, 1857, 1858, 1859, 1860, 1861, 1862, 1863, 1864,
        1865, 1866, 1867, 1876, 1877, 1881, 1882, 1883, 1884, 1885,
        1886, 1887, 1888, 1889, 1890, 1891, 1892, 1893, 1894, 1895,
        1896, 1897, 1898, 1899, 1900, 1902, 1903, 1904, 1905, 1906,
        1907, 1908, 1909, 1910, 1911, 1912, 2074, 2078, 2292, 2477,
        2498, 2499, 2500, 2501, 2665, 2716, 3052, 3461, 3549, 3550,
        3551, 3553, 3563, 3569, 3570, 3604,
    ];

    const getDbayTextureIds = (): number[] => {
        const candidates: any[] = [];

        try {
            candidates.push((window as any).__MOD49_DP_TEX_IDS);
            candidates.push((window as any).__MOD49_DBAY_TEX_IDS);
            candidates.push((window as any).__DP_DBAY_TEX_IDS);
        } catch {
        }

        for (const c of candidates) {
            if (!Array.isArray(c))
                continue;

            const ids = [...new Set(
                c.map((v) => Number(v) | 0)
                    .filter((v) => v > 0 && v < 4096)
            )].sort((a, b) => a - b);

            if (ids.length > 0)
                return ids;
        }

        return DBAY_TEX_IDS_FALLBACK;
    };

    const DBAY_TEX_IDS = getDbayTextureIds();
const hex2 = (v: number) => v.toString(16).padStart(2, '0');
const hex4 = (v: number) => v.toString(16).padStart(4, '0');

const readNumberMapFromLocalStorage = (name: string): Map<number, number> => {
    const out = new Map<number, number>();

    try {
        const txt = localStorage.getItem(name);
        if (!txt)
            return out;

        const obj = JSON.parse(txt);
        for (const [k, v] of Object.entries(obj)) {
            const kk = Number(k);
            const vv = Number(v);
            if (Number.isFinite(kk) && Number.isFinite(vv))
                out.set(kk | 0, vv | 0);
        }
    } catch (e) {
        console.warn(`[MOD49 MAP] failed reading ${name}`, e);
    }

    return out;
};

const readStringMapFromLocalStorage = (name: string): Map<string, number> => {
    const out = new Map<string, number>();

    try {
        const txt = localStorage.getItem(name);
        if (!txt)
            return out;

        const obj = JSON.parse(txt);
        for (const [k, v] of Object.entries(obj)) {
            const vv = Number(v);
            if (Number.isFinite(vv))
                out.set(String(k), vv | 0);
        }
    } catch (e) {
        console.warn(`[MOD49 MAP] failed reading ${name}`, e);
    }

    return out;
};

const saveNumberMapToLocalStorage = (name: string, map: Map<number, number>) => {
    const obj: Record<string, number> = {};
    for (const [k, v] of map)
        obj[String(k)] = v;
    localStorage.setItem(name, JSON.stringify(obj, null, 2));
};

const saveStringMapToLocalStorage = (name: string, map: Map<string, number>) => {
    const obj: Record<string, number> = {};
    for (const [k, v] of map)
        obj[k] = v;
    localStorage.setItem(name, JSON.stringify(obj, null, 2));
};

const MOD49_SLOT_TO_DP_TEX = (() => {
    const m = new Map<number, number>([

    ]);

    for (const [k, v] of readNumberMapFromLocalStorage('__MOD49_SLOT_TO_DP_TEX'))
        m.set(k, v);

    return m;
})();

const MOD49_BLOCKGROUP_TO_DP_TEX = (() => {
    const m = new Map<string, number>([

    ]);

    for (const [k, v] of readStringMapFromLocalStorage('__MOD49_BLOCKGROUP_TO_DP_TEX'))
        m.set(k, v);

    return m;
})();

const MOD49_FULLKEY_TO_DP_TEX = (() => {
    const m = new Map<string, number>([
        ['1000_080a_02', 1911],

        ['0000_080a_03', 1892],
        ['0000_080a_04', 1892],
        ['0000_080a_05', 1893],
        ['0000_080a_06', 1893],
        ['0000_080a_07', 1895],
        ['0000_080a_08', 1895],

        ['0800_080a_09', 1896],
        ['0800_080a_0a', 1897],

        ['0800_280f_01', 3553],
        ['0800_2c0f_00', 3553],
        ['0810_2c0f_01', 3553],
    ]);

    for (const [k, v] of readStringMapFromLocalStorage('__MOD49_FULLKEY_TO_DP_TEX'))
        m.set(k, v);

    return m;
})();

const MOD49_RAWKEY_TO_DP_TEX = (() => {
    const m = new Map<string, number>([

    ]);

    for (const [k, v] of readStringMapFromLocalStorage('__MOD49_RAWKEY_TO_DP_TEX'))
        m.set(k, v);

    return m;
})();

const UNKNOWN_MOD49_TEX = getDebugNumber('__MOD49_UNKNOWN_TEX', 1898);
const MOD49_SHOW_UNMAPPED_AS_SOLID = false;
const ONLY_BLOCK = NaN;
const ONLY_GROUP = NaN;
const ONLY_SLOT = NaN;
const MOD49_HARDCODED_GROUP_TO_DP_TEX = new Map<string, number>([
   ['1146:0', 1911], // DP 974 batch 31 tex 1911, OVERLAP_PARTIAL, raw 1000_080a_05, tris 6
    ['1146:1', 1890], // DP 974 batch 30 tex 1890, OVERLAP_EXACT, raw 0000_080a_07, tris 4
    ['1146:2', 1888], // DP 974 batch 28 tex 1888, OVERLAP_EXACT, raw 0800_080a_08, tris 2
    ['1146:3', 1886], // DP 974 batch 26 tex 1886, OVERLAP_EXACT, raw 0000_080a_09, tris 2
    ['1146:4', 1884], // DP 974 batch 25 tex 1884, OVERLAP_EXACT, raw 0000_080a_0a, tris 6
    ['1146:5', 1882], // DP 974 batch 24 tex 1882, OVERLAP_EXACT, raw 0000_080a_0b, tris 4
    ['1146:6', 1889], // DP 974 batch 23 tex 1889, OVERLAP_EXACT, raw 0800_080a_0c, tris 2
    ['1146:7', 1887], // DP 974 batch 22 tex 1887, OVERLAP_EXACT, raw 0000_080a_0d, tris 2
    ['1146:8', 1885], // DP 974 batch 20 tex 1885, OVERLAP_EXACT, raw 0000_080a_0e, tris 3
    ['1146:9', 1883], // DP 974 batch 18 tex 1883, OVERLAP_EXACT, raw 0000_080a_0f, tris 2
    ['1146:10', 1891], // DP 974 batch 17 tex 1891, OVERLAP_EXACT, raw 0000_080a_10, tris 2
    ['1146:11', 1892], // DP 974 batch 16 tex 1892, OVERLAP_EXACT, raw 0000_080a_11, tris 4
    ['1146:12', 1893], // DP 974 batch 15 tex 1893, OVERLAP_EXACT, raw 0000_080a_12, tris 2
    ['1146:13', 1894], // DP 974 batch 14 tex 1894, OVERLAP_EXACT, raw 0000_080a_13, tris 2
    ['1146:14', 1895], // DP 974 batch 13 tex 1895, OVERLAP_EXACT, raw 0000_080a_14, tris 2
    ['1146:15', 1896], // DP 974 batch 12 tex 1896, OVERLAP_EXACT, raw 0800_080a_15, tris 4
    ['1146:16', 1897], // DP 974 batch 11 tex 1897, OVERLAP_EXACT, raw 0800_080a_16, tris 4
    ['1146:17', 1865], // DP 974 batch 9 tex 1865, OVERLAP_EXACT, raw 1000_080a_17, tris 6
    ['1146:18', 1866], // DP 974 batch 6 tex 1866, OVERLAP_EXACT, raw 1000_080a_18, tris 1
    ['1146:19', 1911], // DP 974 batch 32 tex 1911, OVERLAP_EXACT, raw 1000_0a03_05, tris 10
    ['1146:20', 1888], // DP 974 batch 29 tex 1888, OVERLAP_EXACT, raw 0800_0a03_08, tris 2
    ['1146:21', 1886], // DP 974 batch 27 tex 1886, OVERLAP_EXACT, raw 0000_0a03_09, tris 2
    ['1146:22', 1885], // DP 974 batch 21 tex 1885, OVERLAP_EXACT, raw 0000_0a03_0e, tris 2
    ['1146:23', 1883], // DP 974 batch 19 tex 1883, OVERLAP_EXACT, raw 0000_0a03_0f, tris 2
    ['1146:24', 1865], // DP 974 batch 10 tex 1865, OVERLAP_EXACT, raw 1000_0a03_17, tris 2
    ['1146:25', 1911], // DP 974 batch 32 tex 1911, OVERLAP_EXACT, raw 1010_0e0b_00, tris 10
    ['1146:26', 1883], // DP 974 batch 19 tex 1883, OVERLAP_EXACT, raw 0010_0e0b_10, tris 2
    ['1146:27', 1885], // DP 974 batch 21 tex 1885, OVERLAP_EXACT, raw 0010_0e0b_12, tris 2
    ['1146:28', 1886], // DP 974 batch 27 tex 1886, OVERLAP_EXACT, raw 0010_0e0b_13, tris 2
    ['1146:29', 1888], // DP 974 batch 29 tex 1888, OVERLAP_EXACT, raw 0810_0e0b_15, tris 2
    ['1146:30', 1865], // DP 974 batch 10 tex 1865, OVERLAP_EXACT, raw 1010_0e0b_18, tris 2
    ['1146:31', 3563], // DP 974 batch  tex , INFER_GLOBAL_FULLKEY, raw 0800_2c0f_01, tris 7
    ['1146:32', 368], // DP 974 batch  tex , INFER_GLOBAL_FULLKEY, raw 0810_0c0f_02, tris 15
    ['1146:33', 273], // DP 974 batch 4 tex 273, OVERLAP_EXACT, raw 0080_080a_04, tris 8
    ['1146:34', 1866], // DP 974 batch 7 tex 1866, OVERLAP_EXACT, raw 1080_080a_18, tris 2
    ['1146:35', 273], // DP 974 batch 5 tex 273, OVERLAP_EXACT, raw 0000_080a_04, tris 22
    ['1146:36', 1866], // DP 974 batch 8 tex 1866, OVERLAP_EXACT, raw 1000_080a_18, tris 4
    ['1146:37', 1911], // DP 974 batch 31 tex 1911, OVERLAP_PARTIAL, raw 0810_080a_06, tris 4
    ['1146:38', 1855], // DP 974 batch 41 tex 1855, OVERLAP_EXACT, raw 0810_080a_03, tris 4
    ['1146:39', 1862], // DP 974 batch 3 tex 1862, OVERLAP_EXACT, raw 9000_080a_19, tris 2
    ['1146:40', 1863], // DP 974 batch 2 tex 1863, OVERLAP_EXACT, raw 9000_080a_1a, tris 1
    ['1146:41', 1905], // DP 974 batch 1 tex 1905, OVERLAP_EXACT, raw 8800_080a_1b, tris 4
    ['1146:42', 1906], // DP 974 batch 0 tex 1906, OVERLAP_EXACT, raw 8800_080a_1c, tris 4
    ['1147:0', 1898], // DP 975 batch 15 tex 1898, OVERLAP_EXACT, raw 1000_080a_00, tris 1
    ['1147:1', 1911], // DP 975 batch 11 tex 1911, OVERLAP_EXACT, raw 1000_080a_03, tris 1
    ['1147:2', 1911], // DP 975 batch 12 tex 1911, OVERLAP_EXACT, raw 1400_080a_03, tris 21
    ['1147:3', 1911], // DP 975 batch 13 tex 1911, OVERLAP_EXACT, raw 1200_080a_03, tris 18
    ['1147:4', 1888], // DP 975 batch 10 tex 1888, OVERLAP_EXACT, raw 0800_080a_04, tris 6
    ['1147:5', 1886], // DP 975 batch 9 tex 1886, OVERLAP_EXACT, raw 0000_080a_05, tris 6
    ['1147:6', 1884], // DP 975 batch 8 tex 1884, OVERLAP_EXACT, raw 0000_080a_06, tris 6
    ['1147:7', 1882], // DP 975 batch 6 tex 1882, OVERLAP_EXACT, raw 0000_080a_07, tris 7
    ['1147:8', 1889], // DP 975 batch 5 tex 1889, OVERLAP_EXACT, raw 0800_080a_08, tris 6
    ['1147:9', 1887], // DP 975 batch 4 tex 1887, OVERLAP_EXACT, raw 0000_080a_09, tris 6
    ['1147:10', 1885], // DP 975 batch 3 tex 1885, OVERLAP_EXACT, raw 0000_080a_0a, tris 7
    ['1147:11', 1883], // DP 975 batch 2 tex 1883, OVERLAP_EXACT, raw 0000_080a_0b, tris 8
    ['1147:12', 1865], // DP 975 batch 0 tex 1865, OVERLAP_EXACT, raw 1000_080a_0c, tris 6
    ['1147:13', 1911], // DP 975 batch 14 tex 1911, OVERLAP_EXACT, raw 1000_0a03_03, tris 15
    ['1147:14', 1882], // DP 975 batch 7 tex 1882, OVERLAP_EXACT, raw 0000_0a03_07, tris 1
    ['1147:15', 1865], // DP 975 batch 1 tex 1865, OVERLAP_EXACT, raw 1000_0a03_0c, tris 2
    ['1147:16', 1898], // DP 975 batch 16 tex 1898, OVERLAP_EXACT, raw 1010_0e0b_00, tris 18
    ['1147:17', 3563], // DP 975 batch 17 tex 3563, OVERLAP_EXACT, raw 0800_280f_01, tris 2
    ['1147:18', 3563], // DP 975 batch 18 tex 3563, OVERLAP_PARTIAL, raw 0800_2c0f_01, tris 9
    ['1147:19', 368], // DP 975 batch  tex , INFER_GLOBAL_FULLKEY, raw 0810_0c0f_02, tris 4
    ['1148:0', 1911], // DP 976 batch 11 tex 1911, OVERLAP_EXACT, raw 1000_080a_02, tris 22
    ['1148:1', 1842], // DP 976 batch 10 tex 1842, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 4
    ['1148:2', 1886], // DP 976 batch 9 tex 1886, OVERLAP_EXACT, raw 0000_080a_04, tris 6
    ['1148:3', 1884], // DP 976 batch 7 tex 1884, OVERLAP_EXACT, raw 0000_080a_05, tris 6
    ['1148:4', 1882], // DP 976 batch 5 tex 1882, OVERLAP_EXACT, raw 0000_080a_06, tris 4
    ['1148:5', 1887], // DP 976 batch 4 tex 1887, OVERLAP_EXACT, raw 0000_080a_07, tris 8
    ['1148:6', 1885], // DP 976 batch 2 tex 1885, OVERLAP_EXACT, raw 0000_080a_08, tris 3
    ['1148:7', 1883], // DP 976 batch 0 tex 1883, OVERLAP_EXACT, raw 0000_080a_09, tris 2
    ['1148:8', 1842], // DP 976 batch 10 tex 1842, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 4
    ['1148:9', 1842], // DP 976 batch 10 tex 1842, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 5
    ['1148:10', 1911], // DP 976 batch 12 tex 1911, OVERLAP_PARTIAL, raw 1000_0a03_02, tris 7
    ['1148:11', 1911], // DP 976 batch 12 tex 1911, OVERLAP_PARTIAL, raw 1010_0e0b_00, tris 7
    ['1148:12', 1884], // DP 976 batch 8 tex 1884, OVERLAP_EXACT, raw 0000_080a_05, tris 2
    ['1148:13', 1882], // DP 976 batch 6 tex 1882, OVERLAP_EXACT, raw 0000_080a_06, tris 4
    ['1148:14', 1885], // DP 976 batch 3 tex 1885, OVERLAP_EXACT, raw 0000_080a_08, tris 4
    ['1148:15', 1883], // DP 976 batch 1 tex 1883, OVERLAP_EXACT, raw 0000_080a_09, tris 4
    ['1148:16', 3563], // DP 976 batch  tex , INFER_GLOBAL_FULLKEY, raw 0800_280f_01, tris 11
    ['1148:17', 3563], // DP 976 batch 15 tex 3563, OVERLAP_PARTIAL, raw 0800_2c0f_01, tris 15
    ['1148:18', 1903], // corrected from generated 1911; OVERLAP_EXACT candidate DP 976 batch 16 raw 0810_080a_03 tris 2
    ['1148:19', 1911], // DP 976 batch  tex , INFER_BLOCK_RAWKEY, raw 1000_080a_00, tris 4
    ['1149:0', 1911], // DP 977 batch 8 tex 1911, OVERLAP_EXACT, raw 1000_080a_02, tris 9
    ['1149:1', 1888], // DP 977 batch 7 tex 1888, OVERLAP_EXACT, raw 0800_080a_05, tris 4
    ['1149:2', 1886], // DP 977 batch 6 tex 1886, OVERLAP_EXACT, raw 0000_080a_06, tris 4
    ['1149:3', 1884], // DP 977 batch 5 tex 1884, OVERLAP_EXACT, raw 0000_080a_07, tris 4
    ['1149:4', 1882], // DP 977 batch 4 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_08, tris 5
    ['1149:5', 1889], // DP 977 batch 3 tex 1889, OVERLAP_EXACT, raw 0800_080a_09, tris 2
    ['1149:6', 1887], // DP 977 batch 2 tex 1887, OVERLAP_EXACT, raw 0000_080a_0a, tris 2
    ['1149:7', 1885], // DP 977 batch 1 tex 1885, OVERLAP_EXACT, raw 0000_080a_0b, tris 2
    ['1149:8', 1883], // DP 977 batch 0 tex 1883, OVERLAP_EXACT, raw 0000_080a_0c, tris 2
    ['1149:9', 1911], // DP 977 batch 9 tex 1911, OVERLAP_PARTIAL, raw 1000_0a03_02, tris 5
    ['1149:10', 1911], // DP 977 batch 9 tex 1911, OVERLAP_PARTIAL, raw 1010_0e0b_00, tris 5
    ['1149:11', 1903], // corrected from generated 1911; OVERLAP_EXACT candidate DP 977 batch 13 raw 0810_080a_03 tris 2
    ['1149:12', 1911], // DP 977 batch 8 tex 1911, OVERLAP_PARTIAL, raw 0810_080a_04, tris 4
    ['1149:13', 1911], // DP 977 batch  tex , INFER_BLOCK_RAWKEY, raw 1000_080a_00, tris 1
    ['1149:14', 3563], // DP 977 batch 11 tex 3563, OVERLAP_EXACT, raw 0800_280f_01, tris 5
    ['1149:15', 3563], // DP 977 batch 12 tex 3563, OVERLAP_PARTIAL, raw 0800_2c0f_01, tris 8
    ['1150:0', 1892], // DP 978 batch 30 tex 1892, OVERLAP_PARTIAL, raw 0000_080a_16, tris 2
    ['1150:1', 1893], // DP 978 batch 29 tex 1893, OVERLAP_PARTIAL, raw 0000_080a_17, tris 2
    ['1150:2', 1894], // DP 978 batch 27 tex 1894, OVERLAP_PARTIAL, raw 0000_080a_18, tris 2
    ['1150:3', 1895], // DP 978 batch 26 tex 1895, OVERLAP_PARTIAL, raw 0000_080a_19, tris 2
    ['1150:4', 1896], // DP 978 batch 24 tex 1896, OVERLAP_PARTIAL, raw 0800_080a_1a, tris 2
    ['1150:5', 1897], // DP 978 batch 23 tex 1897, OVERLAP_PARTIAL, raw 0800_080a_1b, tris 2
    ['1150:6', 1857], // DP 978 batch 21 tex 1857, OVERLAP_EXACT, raw 1000_080a_06, tris 8
    ['1150:7', 1889], // DP 978 batch 20 tex 1889, OVERLAP_EXACT, raw 0800_080a_0f, tris 2
    ['1150:8', 1887], // DP 978 batch 19 tex 1887, OVERLAP_EXACT, raw 0000_080a_10, tris 3
    ['1150:9', 1892], // DP 978 batch 30 tex 1892, OVERLAP_PARTIAL, raw 0000_080a_16, tris 4
    ['1150:10', 1893], // DP 978 batch 29 tex 1893, OVERLAP_PARTIAL, raw 0000_080a_17, tris 6
    ['1150:11', 1894], // DP 978 batch 27 tex 1894, OVERLAP_PARTIAL, raw 0000_080a_18, tris 4
    ['1150:12', 1895], // DP 978 batch 26 tex 1895, OVERLAP_PARTIAL, raw 0000_080a_19, tris 6
    ['1150:13', 1896], // DP 978 batch 24 tex 1896, OVERLAP_PARTIAL, raw 0800_080a_1a, tris 4
    ['1150:14', 1897], // DP 978 batch 23 tex 1897, OVERLAP_PARTIAL, raw 0800_080a_1b, tris 6
    ['1150:15', 1057], // DP 978 batch 17 tex 1057, OVERLAP_EXACT, raw 1000_080a_00, tris 4
    ['1150:16', 1854], // DP 978 batch 14 tex 1854, OVERLAP_PARTIAL, raw 1000_080a_05, tris 2
    ['1150:17', 1898], // DP 978 batch 13 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_01, tris 11
    ['1150:18', 1898], // DP 978 batch 13 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_01, tris 1
    ['1150:19', 1845], // DP 978 batch 12 tex 1845, OVERLAP_EXACT, raw 0000_080a_08, tris 7
    ['1150:20', 1843], // DP 978 batch 11 tex 1843, OVERLAP_EXACT, raw 0000_080a_09, tris 8
    ['1150:21', 1841], // DP 978 batch 10 tex 1841, OVERLAP_EXACT, raw 0000_080a_0a, tris 9
    ['1150:22', 1846], // DP 978 batch 9 tex 1846, OVERLAP_EXACT, raw 0000_080a_13, tris 7
    ['1150:23', 1844], // DP 978 batch 8 tex 1844, OVERLAP_EXACT, raw 0000_080a_14, tris 7
    ['1150:24', 1842], // DP 978 batch 7 tex 1842, OVERLAP_EXACT, raw 0000_080a_15, tris 10
    ['1150:25', 1898], // DP 978 batch 13 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_01, tris 5
    ['1150:26', 1884], // DP 978 batch 45 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 21
    ['1150:27', 1884], // DP 978 batch 45 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 3
    ['1150:28', 1882], // DP 978 batch 6 tex 1882, OVERLAP_EXACT, raw 0000_080a_0e, tris 8
    ['1150:29', 1885], // DP 978 batch 5 tex 1885, OVERLAP_EXACT, raw 0000_080a_11, tris 11
    ['1150:30', 1883], // DP 978 batch 4 tex 1883, OVERLAP_EXACT, raw 0000_080a_12, tris 8
    ['1150:31', 1907], // DP 978 batch 43 tex 1907, OVERLAP_EXACT, raw 0800_880a_21, tris 2
    ['1150:32', 1908], // DP 978 batch 42 tex 1908, OVERLAP_EXACT, raw 0800_880a_22, tris 4
    ['1150:33', 273], // DP 978 batch 3 tex 273, OVERLAP_EXACT, raw 0000_080a_03, tris 25
    ['1150:34', 1866], // DP 978 batch 2 tex 1866, OVERLAP_EXACT, raw 1000_080a_1c, tris 4
    ['1150:35', 1057], // DP 978 batch 18 tex 1057, OVERLAP_EXACT, raw 1000_0a03_00, tris 1
    ['1150:36', 1854], // DP 978 batch 15 tex 1854, OVERLAP_EXACT, raw 1000_0a03_05, tris 4
    ['1150:37', 1857], // DP 978 batch 22 tex 1857, OVERLAP_EXACT, raw 1000_0a03_06, tris 22
    ['1150:38', 1892], // DP 978 batch 31 tex 1892, OVERLAP_EXACT, raw 0000_0a03_16, tris 2
    ['1150:39', 1894], // DP 978 batch 28 tex 1894, OVERLAP_EXACT, raw 0000_0a03_18, tris 2
    ['1150:40', 1896], // DP 978 batch 25 tex 1896, OVERLAP_EXACT, raw 0800_0a03_1a, tris 2
    ['1150:41', 1898], // DP 978 batch 36 tex 1898, OVERLAP_EXACT, raw 1010_0e0b_01, tris 3
    ['1150:42', 1896], // DP 978 batch 25 tex 1896, OVERLAP_EXACT, raw 0810_0e0b_0b, tris 2
    ['1150:43', 1886], // DP 978 batch 34 tex 1886, OVERLAP_EXACT, raw 0010_0e0b_0c, tris 4
    ['1150:44', 1866], // corrected from generated 1854; OVERLAP_EXACT candidate DP 978 batch 33 raw 1010_0e0b_1c tris 2
    ['1150:45', 1857], // DP 978 batch 22 tex 1857, OVERLAP_EXACT, raw 1010_0e0b_1d, tris 22
    ['1150:46', 1907], // DP 978 batch 41 tex 1907, OVERLAP_EXACT, raw 0800_880a_21, tris 2
    ['1150:47', 1908], // DP 978 batch 40 tex 1908, OVERLAP_EXACT, raw 0800_880a_22, tris 2
    ['1150:48', 252], // DP 978 batch 44 tex 252, OVERLAP_PARTIAL, raw 0000_080a_07, tris 20
    ['1150:49', 252], // DP 978 batch 44 tex 252, OVERLAP_PARTIAL, raw 0000_080a_07, tris 2
    ['1150:50', 3563], // DP 978 batch 38 tex 3563, OVERLAP_EXACT, raw 0800_280f_02, tris 8
    ['1150:51', 3563], // DP 978 batch 39 tex 3563, OVERLAP_EXACT, raw 0800_2c0f_02, tris 19
    ['1150:52', 1854], // DP 978 batch 14 tex 1854, OVERLAP_PARTIAL, raw 1000_080a_05, tris 2
    ['1150:53', 2078], // DP 978 batch 1 tex 2078, OVERLAP_PARTIAL, raw 1000_080a_1e, tris 6
    ['1150:54', 1859], // DP 978 batch 0 tex 1859, OVERLAP_PARTIAL, raw 0000_080a_1f, tris 6
    ['1150:55', 1860], // DP 978 batch 47 tex 1860, OVERLAP_PARTIAL, raw 0000_080a_20, tris 43
    ['1150:56', 1860], // DP 978 batch 48 tex 1860, OVERLAP_PARTIAL, raw 0000_080a_20, tris 25
    ['1150:57', 1854], // DP 978 batch 16 tex 1854, OVERLAP_EXACT, raw 1000_080a_05, tris 2
    ['1150:58', 2078], // DP 978 batch 1 tex 2078, OVERLAP_PARTIAL, raw 1000_080a_1e, tris 6
    ['1150:59', 1859], // DP 978 batch 0 tex 1859, OVERLAP_PARTIAL, raw 0000_080a_1f, tris 6
    ['1150:60', 1860], // DP 978 batch 49 tex 1860, OVERLAP_PARTIAL, raw 0000_080a_20, tris 43
    ['1150:61', 1860], // DP 978 batch 50 tex 1860, OVERLAP_PARTIAL, raw 0000_080a_20, tris 25
    ['1150:62', 16], // DP 978 batch 37 tex 16, OVERLAP_EXACT, raw 0020_080a_04, tris 10
    ['1151:0', 1882], // DP 979 batch 19 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_06, tris 2
    ['1151:1', 1892], // DP 979 batch 18 tex 1892, OVERLAP_EXACT, raw 0000_080a_0b, tris 7
    ['1151:2', 1893], // DP 979 batch 17 tex 1893, OVERLAP_EXACT, raw 0000_080a_0c, tris 6
    ['1151:3', 1894], // DP 979 batch 16 tex 1894, OVERLAP_EXACT, raw 0000_080a_0d, tris 6
    ['1151:4', 1895], // DP 979 batch 15 tex 1895, OVERLAP_EXACT, raw 0000_080a_0e, tris 6
    ['1151:5', 1896], // DP 979 batch 14 tex 1896, OVERLAP_EXACT, raw 0800_080a_0f, tris 6
    ['1151:6', 1897], // DP 979 batch 13 tex 1897, OVERLAP_EXACT, raw 0800_080a_10, tris 6
    ['1151:7', 1888], // DP 979 batch 12 tex 1888, OVERLAP_EXACT, raw 0800_080a_03, tris 2
    ['1151:8', 1886], // DP 979 batch 11 tex 1886, OVERLAP_EXACT, raw 0000_080a_04, tris 2
    ['1151:9', 1884], // DP 979 batch 9 tex 1884, OVERLAP_EXACT, raw 0000_080a_05, tris 7
    ['1151:10', 1882], // DP 979 batch 19 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_06, tris 4
    ['1151:11', 1889], // DP 979 batch 8 tex 1889, OVERLAP_EXACT, raw 0800_080a_07, tris 2
    ['1151:12', 1887], // DP 979 batch 7 tex 1887, OVERLAP_EXACT, raw 0000_080a_08, tris 2
    ['1151:13', 1885], // DP 979 batch 5 tex 1885, OVERLAP_EXACT, raw 0000_080a_09, tris 3
    ['1151:14', 1883], // DP 979 batch 3 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 2
    ['1151:15', 1898], // DP 979 batch 27 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 14
    ['1151:16', 1857], // DP 979 batch 0 tex 1857, OVERLAP_PARTIAL, raw 1000_080a_02, tris 13
    ['1151:17', 1898], // DP 979 batch 26 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 37
    ['1151:18', 1882], // DP 979 batch 19 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_06, tris 9
    ['1151:19', 1883], // DP 979 batch 3 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 8
    ['1151:20', 1857], // DP 979 batch 0 tex 1857, OVERLAP_PARTIAL, raw 1000_080a_02, tris 8
    ['1151:21', 1898], // DP 979 batch 2 tex 1898, OVERLAP_EXACT, raw 1000_0a03_00, tris 9
    ['1151:22', 1857], // DP 979 batch 1 tex 1857, OVERLAP_EXACT, raw 1000_0a03_02, tris 4
    ['1151:23', 1884], // DP 979 batch 10 tex 1884, OVERLAP_EXACT, raw 0000_0a03_05, tris 9
    ['1151:24', 1882], // DP 979 batch 20 tex 1882, OVERLAP_EXACT, raw 0000_0a03_06, tris 2
    ['1151:25', 1885], // DP 979 batch 6 tex 1885, OVERLAP_EXACT, raw 0000_0a03_09, tris 8
    ['1151:26', 1883], // DP 979 batch 4 tex 1883, OVERLAP_EXACT, raw 0000_0a03_0a, tris 3
    ['1151:27', 1857], // DP 979 batch 22 tex 1857, OVERLAP_EXACT, raw 1010_0e0b_02, tris 25
    ['1151:28', 1904], // DP 979 batch 21 tex 1904, OVERLAP_EXACT, raw 1010_0e0b_11, tris 10
    ['1151:29', 3563], // DP 979 batch 23 tex 3563, OVERLAP_EXACT, raw 0800_280f_01, tris 12
    ['1151:30', 3563], // DP 979 batch 24 tex 3563, OVERLAP_EXACT, raw 0800_2c0f_01, tris 30
    ['1151:31', 3563], // DP 979 batch 25 tex 3563, OVERLAP_SECONDARY, raw 0810_2c0f_01, tris 6
    ['1152:0', 1898], // DP 980 batch 18 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 11
    ['1152:1', 1857], // DP 980 batch 17 tex 1857, OVERLAP_EXACT, raw 1000_080a_05, tris 2
    ['1152:2', 1909], // DP 980 batch 16 tex 1909, OVERLAP_PARTIAL, raw 0000_080a_06, tris 2
    ['1152:3', 1896], // DP 980 batch  tex , INFER_BLOCK_RAWKEY, raw 0800_080a_08, tris 2
    ['1152:4', 1886], // DP 980 batch 14 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_09, tris 2
    ['1152:5', 1884], // DP 980 batch 13 tex 1884, OVERLAP_EXACT, raw 0000_080a_0a, tris 2
    ['1152:6', 1882], // DP 980 batch 12 tex 1882, OVERLAP_EXACT, raw 0000_080a_0b, tris 2
    ['1152:7', 1896], // DP 980 batch  tex , INFER_BLOCK_RAWKEY, raw 0800_080a_0c, tris 2
    ['1152:8', 1887], // DP 980 batch  tex , INFER_BLOCK_FULLKEY, raw 0000_080a_0d, tris 2
    ['1152:9', 1885], // DP 980 batch 9 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0e, tris 2
    ['1152:10', 1883], // DP 980 batch 8 tex 1883, OVERLAP_EXACT, raw 0000_080a_0f, tris 2
    ['1152:11', 1858], // DP 980 batch 7 tex 1858, OVERLAP_EXACT, raw 1000_080a_02, tris 11
    ['1152:12', 1909], // DP 980 batch 27 tex 1909, OVERLAP_PARTIAL, raw 0000_080a_06, tris 20
    ['1152:13', 1910], // DP 980 batch 5 tex 1910, OVERLAP_PARTIAL, raw 0000_080a_07, tris 21
    ['1152:14', 1910], // DP 980 batch 5 tex 1910, OVERLAP_PARTIAL, raw 0000_080a_07, tris 1
    ['1152:15', 1898], // DP 980 batch 19 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 25
    ['1152:16', 1911], // DP 980 batch 3 tex 1911, OVERLAP_EXACT, raw 1000_080a_04, tris 3
    ['1152:17', 1887], // DP 980 batch 10 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 2
    ['1152:18', 1885], // DP 980 batch 9 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0e, tris 3
    ['1152:19', 1892], // DP 980 batch 2 tex 1892, OVERLAP_EXACT, raw 0000_080a_11, tris 3
    ['1152:20', 1894], // DP 980 batch 1 tex 1894, OVERLAP_EXACT, raw 0000_080a_12, tris 2
    ['1152:21', 1896], // DP 980 batch 0 tex 1896, OVERLAP_EXACT, raw 0800_080a_13, tris 2
    ['1152:22', 1898], // DP 980 batch 18 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 14
    ['1152:23', 1898], // DP 980 batch 20 tex 1898, OVERLAP_PARTIAL, raw 1000_0a03_00, tris 10
    ['1152:24', 1898], // DP 980 batch  tex , INFER_BLOCK_RAWKEY, raw 1000_0a03_04, tris 6
    ['1152:25', 1909], // DP 980 batch 16 tex 1909, OVERLAP_EXACT, raw 0000_0a03_06, tris 4
    ['1152:26', 1910], // DP 980 batch 6 tex 1910, OVERLAP_EXACT, raw 0000_0a03_07, tris 1
    ['1152:27', 1898], // DP 980 batch  tex , INFER_BLOCK_RAWKEY, raw 1010_0e0b_00, tris 6
    ['1152:28', 1898], // DP 980 batch 22 tex 1857, OVERLAP_EXACT, raw 1010_0e0b_05, tris 5
    ['1152:29', 1909], // DP 980 batch 16 tex 1909, OVERLAP_PARTIAL, raw 0010_0e0b_10, tris 2
    ['1152:30', 1898], // DP 980 batch  tex , INFER_BLOCK_RAWKEY, raw 1010_0e0b_14, tris 8
    ['1152:31', 1910], // DP 980 batch 5 tex 1910, OVERLAP_PARTIAL, raw 1010_080a_03, tris 2
    ['1152:32', 3563], // DP 980 batch 24 tex 3563, OVERLAP_PARTIAL, raw 0800_280f_01, tris 6
    ['1152:33', 3563], // DP 980 batch  tex , INFER_BLOCK_FULLKEY, raw 0800_280f_01, tris 1
    ['1152:34', 3563], // DP 980 batch 25 tex 3563, OVERLAP_PARTIAL, raw 0800_2c0f_01, tris 19
    ['1153:0', 1898], // DP 981 batch 25 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 26
    ['1153:1', 1898], // DP 981 batch 23 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 23
    ['1153:2', 1898], // DP 981 batch 28 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 22
    ['1153:3', 1898], // DP 981 batch 25 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 30
    ['1153:4', 1841], // DP 981 batch 18 tex 1841, OVERLAP_PARTIAL, raw 0000_080a_06, tris 10
    ['1153:5', 1842], // DP 981 batch 20 tex 1842, OVERLAP_PARTIAL, raw 0000_080a_10, tris 8
    ['1153:6', 1891], // DP 981 batch 16 tex 1891, OVERLAP_EXACT, raw 0000_080a_11, tris 16
    ['1153:7', 1845], // DP 981 batch 10 tex 1845, OVERLAP_PARTIAL, raw 0000_080a_04, tris 6
    ['1153:8', 1843], // DP 981 batch 14 tex 1843, OVERLAP_PARTIAL, raw 0000_080a_05, tris 16
    ['1153:9', 1841], // DP 981 batch 19 tex 1841, OVERLAP_PARTIAL, raw 0000_080a_06, tris 13
    ['1153:10', 1883], // DP 981 batch 13 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 1
    ['1153:11', 1846], // DP 981 batch 9 tex 1846, OVERLAP_PARTIAL, raw 0000_080a_0e, tris 6
    ['1153:12', 1844], // DP 981 batch 11 tex 1844, OVERLAP_PARTIAL, raw 0000_080a_0f, tris 15
    ['1153:13', 1842], // DP 981 batch 20 tex 1842, OVERLAP_PARTIAL, raw 0000_080a_10, tris 14
    ['1153:14', 1854], // DP 981 batch 29 tex 1854, OVERLAP_PARTIAL, raw 1000_080a_02, tris 4
    ['1153:15', 1843], // DP 981 batch 14 tex 1843, OVERLAP_PARTIAL, raw 0000_080a_05, tris 6
    ['1153:16', 1841], // DP 981 batch 19 tex 1841, OVERLAP_PARTIAL, raw 0000_080a_06, tris 5
    ['1153:17', 1844], // DP 981 batch 11 tex 1844, OVERLAP_PARTIAL, raw 0000_080a_0f, tris 6
    ['1153:18', 1842], // DP 981 batch 21 tex 1842, OVERLAP_PARTIAL, raw 0000_080a_10, tris 5
    ['1153:19', 1854], // DP 981 batch 29 tex 1854, OVERLAP_PARTIAL, raw 1000_080a_02, tris 25
    ['1153:20', 1854], // DP 981 batch 30 tex 1854, OVERLAP_PARTIAL, raw 1000_080a_02, tris 11
    ['1153:21', 1845], // DP 981 batch 10 tex 1845, OVERLAP_PARTIAL, raw 0000_080a_04, tris 4
    ['1153:22', 1843], // DP 981 batch 15 tex 1843, OVERLAP_PARTIAL, raw 0000_080a_05, tris 8
    ['1153:23', 1841], // DP 981 batch 19 tex 1841, OVERLAP_PARTIAL, raw 0000_080a_06, tris 7
    ['1153:24', 1846], // DP 981 batch 9 tex 1846, OVERLAP_PARTIAL, raw 0000_080a_0e, tris 4
    ['1153:25', 1844], // DP 981 batch 12 tex 1844, OVERLAP_PARTIAL, raw 0000_080a_0f, tris 8
    ['1153:26', 1842], // DP 981 batch 21 tex 1842, OVERLAP_PARTIAL, raw 0000_080a_10, tris 9
    ['1153:27', 1898], // DP 981 batch 23 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 6
    ['1153:28', 1888], // DP 981 batch  tex , INFER_GLOBAL_FULLKEY, raw 0800_080a_07, tris 4
    ['1153:29', 1886], // DP 981 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_08, tris 4
    ['1153:30', 1884], // DP 981 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_09, tris 6
    ['1153:31', 1888], // DP 981 batch  tex , INFER_GLOBAL_FULLKEY, raw 0800_080a_0a, tris 6
    ['1153:32', 1884], // DP 981 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_0b, tris 6
    ['1153:33', 1885], // DP 981 batch 3 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0c, tris 8
    ['1153:34', 1883], // DP 981 batch 13 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 4
    ['1153:35', 1898], // DP 981 batch 26 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 42
    ['1153:36', 1898], // DP 981 batch 24 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 42
    ['1153:37', 1898], // DP 981 batch 23 tex 1898, OVERLAP_PARTIAL, raw 1000_0a03_00, tris 13
    ['1153:38', 1898], // DP 981 batch  tex , INFER_BLOCK_RAWKEY, raw 1000_0a03_03, tris 1
    ['1153:39', 1844], // DP 981 batch 12 tex 1844, OVERLAP_PARTIAL, raw 0000_0a03_0f, tris 1
    ['1153:40', 1842], // DP 981 batch 21 tex 1842, OVERLAP_PARTIAL, raw 0000_0a03_10, tris 2
    ['1153:41', 1898], // DP 981 batch  tex , INFER_BLOCK_RAWKEY, raw 1010_0e0b_00, tris 1
    ['1153:42', 1844], // DP 981 batch 12 tex 1844, OVERLAP_PARTIAL, raw 0010_0e0b_0c, tris 1
    ['1153:43', 1842], // DP 981 batch 21 tex 1842, OVERLAP_PARTIAL, raw 0010_0e0b_0d, tris 2
    ['1153:44', 1898], // DP 981 batch 23 tex 1898, OVERLAP_PARTIAL, raw 1010_0e0b_12, tris 13
    ['1153:45', 1898], // DP 981 batch 31 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 42
    ['1153:46', 1898], // DP 981 batch 32 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 42
    ['1153:47', 1898], // DP 981 batch 33 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 42
    ['1153:48', 3563], // DP 981 batch 17 tex 3563, OVERLAP_PARTIAL, raw 0800_280f_01, tris 39
    ['1153:49', 3563], // DP 981 batch 17 tex 3563, OVERLAP_PARTIAL, raw 0800_280f_01, tris 6
    ['1153:50', 1876], // DP 981 batch 2 tex 1876, OVERLAP_EXACT, raw 8800_080a_13, tris 2
    ['1153:51', 1877], // DP 981 batch 1 tex 1877, OVERLAP_EXACT, raw 8800_080a_14, tris 2
    ['1153:52', 1907], // DP 981 batch  tex , INFER_GLOBAL_FULLKEY, raw 0800_880a_15, tris 16
    ['1153:53', 1908], // DP 981 batch  tex , INFER_GLOBAL_FULLKEY, raw 0800_880a_16, tris 12
    ['1154:0', 1899], // DP 982 batch 9 tex 1899, OVERLAP_EXACT, raw 1800_880a_0b, tris 4
    ['1154:1', 1891], // DP 982 batch 8 tex 1891, OVERLAP_PARTIAL, raw 0000_080a_08, tris 6
    ['1154:2', 1893], // DP 982 batch 13 tex 1893, OVERLAP_PARTIAL, raw 0000_080a_09, tris 12
    ['1154:3', 1895], // DP 982 batch 7 tex 1895, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 6
    ['1154:4', 1886], // DP 982 batch 11 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_01, tris 12
    ['1154:5', 1884], // DP 982 batch 6 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_02, tris 6
    ['1154:6', 1882], // DP 982 batch 5 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_03, tris 7
    ['1154:7', 1889], // DP 982 batch 4 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_04, tris 1
    ['1154:8', 1887], // DP 982 batch 15 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_05, tris 15
    ['1154:9', 1885], // DP 982 batch 3 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_06, tris 8
    ['1154:10', 1883], // DP 982 batch 17 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_07, tris 9
    ['1154:11', 1891], // DP 982 batch 8 tex 1891, OVERLAP_PARTIAL, raw 0000_080a_08, tris 6
    ['1154:12', 1893], // DP 982 batch 13 tex 1893, OVERLAP_PARTIAL, raw 0000_080a_09, tris 12
    ['1154:13', 1895], // DP 982 batch 7 tex 1895, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 6
    ['1154:14', 1886], // DP 982 batch 12 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_01, tris 12
    ['1154:15', 1884], // DP 982 batch 6 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_02, tris 6
    ['1154:16', 1882], // DP 982 batch 5 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_03, tris 7
    ['1154:17', 1889], // DP 982 batch 4 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_04, tris 1
    ['1154:18', 1887], // DP 982 batch 16 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_05, tris 15
    ['1154:19', 1885], // DP 982 batch 3 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_06, tris 8
    ['1154:20', 1883], // DP 982 batch 17 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_07, tris 9
    ['1154:21', 1866], // DP 982 batch 2 tex 1866, OVERLAP_EXACT, raw 1000_080a_0c, tris 4
    ['1154:22', 1867], // DP 982 batch 1 tex 1867, OVERLAP_EXACT, raw 1000_880a_0d, tris 10
    ['1154:23', 1886], // DP 982 batch 12 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_01, tris 6
    ['1154:24', 1887], // DP 982 batch 16 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_05, tris 6
    ['1154:25', 1881], // DP 982 batch 0 tex 1881, OVERLAP_EXACT, raw 0800_080a_0e, tris 2
    ['1154:26', 1886], // DP 982 batch 11 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_01, tris 5
    ['1154:27', 16], // DP 982 batch 10 tex 16, OVERLAP_EXACT, raw 0020_080a_00, tris 12
    ['1155:0', 1885], // DP 983 batch 9 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0b, tris 16
    ['1155:1', 1883], // DP 983 batch 8 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_0c, tris 8
    ['1155:2', 1839], // DP 983 batch 7 tex 1839, OVERLAP_EXACT, raw 0000_080a_0d, tris 12
    ['1155:3', 1840], // DP 983 batch 6 tex 1840, OVERLAP_EXACT, raw 0000_080a_0e, tris 16
    ['1155:4', 1898], // DP 983 batch 13 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 39
    ['1155:5', 1898], // DP 983 batch 13 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 19
    ['1155:6', 3052], // DP 983 batch  tex , INFER_BLOCK_RAWKEY, raw 1000_080a_02, tris 9
    ['1155:7', 3052], // DP 983 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_03, tris 16
    ['1155:8', 3052], // DP 983 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_03, tris 11
    ['1155:9', 1898], // DP 983 batch 14 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 8
    ['1155:10', 1888], // DP 983 batch 5 tex 1888, OVERLAP_EXACT, raw 0800_080a_05, tris 4
    ['1155:11', 1886], // DP 983 batch 4 tex 1886, OVERLAP_EXACT, raw 0000_080a_06, tris 4
    ['1155:12', 1884], // DP 983 batch 3 tex 1884, OVERLAP_EXACT, raw 0000_080a_07, tris 4
    ['1155:13', 1882], // DP 983 batch 2 tex 1882, OVERLAP_EXACT, raw 0000_080a_08, tris 4
    ['1155:14', 1889], // DP 983 batch 1 tex 1889, OVERLAP_EXACT, raw 0800_080a_09, tris 4
    ['1155:15', 1887], // DP 983 batch 0 tex 1887, OVERLAP_EXACT, raw 0000_080a_0a, tris 4
    ['1155:16', 1885], // DP 983 batch 9 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0b, tris 4
    ['1155:17', 1883], // DP 983 batch 8 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_0c, tris 4
    ['1155:18', 1898], // DP 983 batch 13 tex 1898, OVERLAP_PARTIAL, raw 0810_080a_04, tris 11
    ['1155:19', 3563], // DP 983 batch 10 tex 3563, OVERLAP_EXACT, raw 0800_280f_01, tris 10
    ['1155:20', 3563], // DP 983 batch 11 tex 3563, OVERLAP_EXACT, raw 0800_2c0f_01, tris 16
    ['1156:0', 1898], // DP 984 batch 18 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 4
    ['1156:1', 1898], // DP 984 batch 18 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 36
    ['1156:2', 1858], // DP 984 batch 12 tex 1858, OVERLAP_PARTIAL, raw 1000_080a_02, tris 2
    ['1156:3', 1909], // DP 984 batch 11 tex 1909, OVERLAP_PARTIAL, raw 0000_080a_05, tris 8
    ['1156:4', 1910], // DP 984 batch 10 tex 1910, OVERLAP_PARTIAL, raw 0000_080a_06, tris 5
    ['1156:5', 1909], // DP 984 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_07, tris 2
    ['1156:6', 1839], // DP 984 batch 9 tex 1839, OVERLAP_EXACT, raw 0000_080a_12, tris 26
    ['1156:7', 1840], // DP 984 batch 8 tex 1840, OVERLAP_EXACT, raw 0000_080a_13, tris 34
    ['1156:8', 1858], // DP 984 batch 12 tex 1858, OVERLAP_PARTIAL, raw 1000_080a_02, tris 4
    ['1156:9', 1909], // DP 984 batch 11 tex 1909, OVERLAP_PARTIAL, raw 0000_080a_05, tris 3
    ['1156:10', 1910], // DP 984 batch 10 tex 1910, OVERLAP_PARTIAL, raw 0000_080a_06, tris 2
    ['1156:11', 1889], // DP 984 batch  tex , INFER_GLOBAL_FULLKEY, raw 0800_080a_09, tris 4
    ['1156:12', 1886], // DP 984 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_0a, tris 4
    ['1156:13', 1885], // DP 984 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_0b, tris 4
    ['1156:14', 1882], // DP 984 batch 4 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_0c, tris 5
    ['1156:15', 1897], // DP 984 batch  tex , INFER_GLOBAL_FULLKEY, raw 0800_080a_0d, tris 2
    ['1156:16', 1885], // DP 984 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_0e, tris 2
    ['1156:17', 1886], // DP 984 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_0f, tris 2
    ['1156:18', 1882], // DP 984 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_10, tris 3
    ['1156:19', 1898], // DP 984 batch 13 tex 1898, OVERLAP_EXACT, raw 1000_0a03_00, tris 1
    ['1156:20', 1898], // DP 984 batch 13 tex 1898, OVERLAP_EXACT, raw 1010_0e0b_11, tris 1
    ['1156:21', 1903], // DP 984 batch 18 tex 1898, OVERLAP_PARTIAL, raw 0810_080a_04, tris 2
    ['1156:22', 1898], // DP 984 batch 18 tex 1898, OVERLAP_PARTIAL, raw 0810_080a_08, tris 13
    ['1156:23', 3563], // DP 984 batch 15 tex 3563, OVERLAP_EXACT, raw 0800_280f_01, tris 11
    ['1156:24', 3563], // DP 984 batch 16 tex 3563, OVERLAP_EXACT, raw 0800_2c0f_01, tris 16
    ['1156:25', 252], // DP 984 batch 17 tex 252, OVERLAP_PARTIAL, raw 0000_080a_03, tris 20
    ['1156:26', 252], // DP 984 batch 17 tex 252, OVERLAP_PARTIAL, raw 0000_080a_03, tris 2
    ['1157:0', 2665], // DP 985 batch 5, SPATIAL_BBOX, raw 0000_080b_0d, tris 2
    ['1157:1', 1847], // DP 985 batch 6, SPATIAL_BBOX, raw 0000_080a_07, tris 22
    ['1157:2', 1847], // DP 985 batch 6, SPATIAL_BBOX, raw 0000_080a_07, tris 24
    ['1157:3', 1847], // DP 985 batch 6, SPATIAL_BBOX, raw 0000_080a_07, tris 11
    ['1157:4', 1848], // DP 985 batch 5, SPATIAL_BBOX, raw 0000_080a_08, tris 16
    ['1157:5', 1854], // DP 985 batch 4, OVERLAP_PARTIAL, raw 1000_080a_03, tris 4
    ['1157:6', 1843], // DP 985 batch 3, OVERLAP_PARTIAL, raw 0000_080a_05, tris 4
    ['1157:7', 1841], // DP 985 batch 2, OVERLAP_PARTIAL, raw 0000_080a_06, tris 3
    ['1157:8', 1843], // DP 985 batch 3, SPATIAL_BBOX, raw 0000_080a_0b, tris 2
    ['1157:9', 1842], // DP 985 batch 0, SPATIAL_BBOX, raw 0000_080a_0c, tris 3
    ['1157:10', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 1000_080a_09, tris 20
    ['1157:11', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 1000_080a_03, tris 12
    ['1157:12', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 0000_080a_07, tris 22
    ['1157:13', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 0000_080a_07, tris 14
    ['1157:14', 1847], // DP 985 batch 6, SPATIAL_BBOX, raw 1000_080a_00, tris 13
    ['1157:15', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 1000_080a_01, tris 8
    ['1157:16', 1847], // DP 985 batch 6, SPATIAL_BBOX, raw 0000_080a_08, tris 10
    ['1157:17', 1847], // DP 985 batch 6, SPATIAL_BBOX, raw 0000_080a_0c, tris 20
    ['1157:18', 1847], // DP 985 batch 6, SPATIAL_BBOX, raw 0000_080a_0c, tris 22
    ['1157:19', 1847], // DP 985 batch 6, SPATIAL_BBOX, raw 0000_080a_0c, tris 10
    ['1157:20', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 0000_080a_0f, tris 10
    ['1157:21', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 0000_080a_10, tris 10
    ['1157:22', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 0000_080a_11, tris 10
    ['1157:23', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 0000_080a_12, tris 10
    ['1157:24', 1844], // DP 985 batch 1, SPATIAL_BBOX, raw 1010_080a_02, tris 2
    ['1157:25', 1847], // DP 985 batch 6, SPATIAL_BBOX, raw 1000_0a03_01, tris 7
    ['1157:26', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 1000_0a03_03, tris 25
    ['1157:27', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 1000_0a03_03, tris 10
    ['1157:28', 1847], // DP 985 batch 7, SPATIAL_BBOX, raw 0000_0a03_05, tris 2
    ['1157:29', 1841], // DP 985 batch 2, SPATIAL_BBOX, raw 0000_0a03_06, tris 3
    ['1157:30', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 1000_0a03_09, tris 30
    ['1157:31', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 1000_0a03_09, tris 14
    ['1157:32', 1847], // DP 985 batch 7, SPATIAL_BBOX, raw 0000_0a03_0b, tris 4
    ['1157:33', 1842], // DP 985 batch 0, SPATIAL_BBOX, raw 0000_0a03_0c, tris 3
    ['1157:34', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 1010_0e0b_01, tris 17
    ['1157:35', 1847], // DP 985 batch 7, SPATIAL_BBOX, raw 1010_0e0b_02, tris 2
    ['1157:36', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 1010_0e0b_03, tris 27
    ['1157:37', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 1010_0e0b_03, tris 8
    ['1157:38', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 1010_0e0b_04, tris 16
    ['1157:39', 1847], // DP 985 batch 7, SPATIAL_BBOX, raw 0010_0e0b_07, tris 12
    ['1157:40', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 0010_0e0b_0f, tris 4
    ['1157:41', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 0010_0e0b_10, tris 4
    ['1157:42', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 0010_0e0b_11, tris 4
    ['1157:43', 1854], // DP 985 batch 4, SPATIAL_BBOX, raw 0010_0e0b_12, tris 4
    ['1157:44', 1848], // DP 985 batch 5, SPATIAL_BBOX, raw 0800_880a_0e, tris 8
    ['1157:45', 2665], // DP 985 batch 6, SPATIAL_BBOX, raw 8800_880a_0a, tris 22
    ['1157:46', 2665], // DP 985 batch 7, SPATIAL_BBOX, raw 8800_880a_0a, tris 20
    ['1158:0', 1888], // DP 986 batch 16 tex 1888, OVERLAP_EXACT, raw 0800_080a_04, tris 6
    ['1158:1', 1886], // DP 986 batch 15 tex 1886, OVERLAP_EXACT, raw 0000_080a_05, tris 6
    ['1158:2', 1889], // DP 986 batch 14 tex 1889, OVERLAP_EXACT, raw 0800_080a_06, tris 6
    ['1158:3', 1887], // DP 986 batch 13 tex 1887, OVERLAP_EXACT, raw 0000_080a_07, tris 6
    ['1158:4', 1890], // DP 986 batch 12 tex 1890, OVERLAP_PARTIAL, raw 0000_080a_03, tris 1
    ['1158:5', 1892], // DP 986 batch 11 tex 1892, OVERLAP_PARTIAL, raw 0000_080a_08, tris 7
    ['1158:6', 1893], // DP 986 batch 10 tex 1893, OVERLAP_PARTIAL, raw 0000_080a_09, tris 7
    ['1158:7', 1894], // DP 986 batch 9 tex 1894, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 6
    ['1158:8', 1895], // DP 986 batch 8 tex 1895, OVERLAP_PARTIAL, raw 0000_080a_0b, tris 8
    ['1158:9', 1896], // DP 986 batch 7 tex 1896, OVERLAP_PARTIAL, raw 0800_080a_0c, tris 6
    ['1158:10', 1897], // DP 986 batch 6 tex 1897, OVERLAP_PARTIAL, raw 0800_080a_0d, tris 6
    ['1158:11', 1857], // DP 986 batch 4 tex 1857, OVERLAP_EXACT, raw 1000_080a_00, tris 24
    ['1158:12', 1865], // DP 986 batch 2 tex 1865, OVERLAP_EXACT, raw 1000_080a_0e, tris 13
    ['1158:13', 1890], // DP 986 batch 12 tex 1890, OVERLAP_PARTIAL, raw 0000_080a_03, tris 1
    ['1158:14', 1892], // DP 986 batch 11 tex 1892, OVERLAP_PARTIAL, raw 0000_080a_08, tris 8
    ['1158:15', 1893], // DP 986 batch 10 tex 1893, OVERLAP_PARTIAL, raw 0000_080a_09, tris 9
    ['1158:16', 1894], // DP 986 batch 9 tex 1894, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 8
    ['1158:17', 1895], // DP 986 batch 8 tex 1895, OVERLAP_PARTIAL, raw 0000_080a_0b, tris 8
    ['1158:18', 1896], // DP 986 batch 7 tex 1896, OVERLAP_PARTIAL, raw 0800_080a_0c, tris 8
    ['1158:19', 1897], // DP 986 batch 6 tex 1897, OVERLAP_PARTIAL, raw 0800_080a_0d, tris 8
    ['1158:20', 1857], // DP 986 batch 5 tex 1857, OVERLAP_EXACT, raw 1000_0a03_00, tris 27
    ['1158:21', 1226], // DP 986 batch 0 tex 1226, OVERLAP_EXACT, raw 0000_0a03_01, tris 18
    ['1158:22', 1865], // DP 986 batch 3 tex 1865, OVERLAP_EXACT, raw 1000_0a03_0e, tris 2
    ['1158:23', 1857], // DP 986 batch 21 tex 1857, OVERLAP_EXACT, raw 1010_0e0b_00, tris 8
    ['1158:24', 1893], // corrected from generated 1226; OVERLAP_EXACT candidate DP 986 batch 20 raw 0010_0e0b_09 tris 8
    ['1158:25', 1895], // corrected from generated 1226; OVERLAP_EXACT candidate DP 986 batch 19 raw 0010_0e0b_0b tris 4
    ['1158:26', 1865], // corrected from generated 1857; OVERLAP_EXACT candidate DP 986 batch 18 raw 1010_0e0b_0e tris 22
    ['1158:27', 1866], // corrected from generated 1857; OVERLAP_EXACT candidate DP 986 batch 17 raw 1010_0e0b_0f tris 5
    ['1158:28', 1226], // DP 986 batch 1 tex 1226, OVERLAP_EXACT, raw 0000_080a_01, tris 10
    ['1158:29', 1857], // DP 986 batch 4 tex 1857, OVERLAP_PARTIAL, raw 0810_080a_02, tris 4
    ['1159:0', 1888], // DP 987 batch 13 tex 1888, OVERLAP_PARTIAL, raw 0800_080a_08, tris 4
    ['1159:1', 1886], // DP 987 batch 12 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_09, tris 4
    ['1159:2', 1889], // DP 987 batch 11 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_0c, tris 4
    ['1159:3', 1887], // DP 987 batch 10 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 4
    ['1159:4', 1888], // DP 987 batch 13 tex 1888, OVERLAP_PARTIAL, raw 0800_080a_08, tris 4
    ['1159:5', 1886], // DP 987 batch 12 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_09, tris 4
    ['1159:6', 1884], // DP 987 batch 9 tex 1884, OVERLAP_EXACT, raw 0000_080a_0a, tris 10
    ['1159:7', 1882], // DP 987 batch 8 tex 1882, OVERLAP_EXACT, raw 0000_080a_0b, tris 10
    ['1159:8', 1889], // DP 987 batch 11 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_0c, tris 4
    ['1159:9', 1887], // DP 987 batch 10 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 7
    ['1159:10', 1885], // DP 987 batch 7 tex 1885, OVERLAP_EXACT, raw 0000_080a_0e, tris 7
    ['1159:11', 1883], // DP 987 batch 6 tex 1883, OVERLAP_EXACT, raw 0000_080a_0f, tris 6
    ['1159:12', 1898], // DP 987 batch 20 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 31
    ['1159:13', 3052], // DP 987 batch  tex , INFER_BLOCK_RAWKEY, raw 1000_080a_04, tris 12
    ['1159:14', 3052], // DP 987 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_06, tris 16
    ['1159:15', 3052], // DP 987 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_06, tris 9
    ['1159:16', 1839], // DP 987 batch 5 tex 1839, OVERLAP_EXACT, raw 0000_080a_13, tris 28
    ['1159:17', 1840], // DP 987 batch 4 tex 1840, OVERLAP_EXACT, raw 0000_080a_14, tris 36
    ['1159:18', 1898], // DP 987 batch 20 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 1
    ['1159:19', 1845], // DP 987 batch 3 tex 1845, OVERLAP_EXACT, raw 0000_080a_05, tris 1
    ['1159:20', 1846], // DP 987 batch 2 tex 1846, OVERLAP_EXACT, raw 0000_080a_10, tris 2
    ['1159:21', 1844], // DP 987 batch 1 tex 1844, OVERLAP_EXACT, raw 0000_080a_11, tris 2
    ['1159:22', 1842], // DP 987 batch 0 tex 1842, OVERLAP_EXACT, raw 0000_080a_12, tris 2
    ['1159:23', 1898], // DP 987 batch 20 tex 1898, OVERLAP_PARTIAL, raw 0810_080a_07, tris 7
    ['1159:24', 3563], // DP 987 batch 17 tex 3563, OVERLAP_EXACT, raw 0800_280f_03, tris 27
    ['1159:25', 1907], // DP 987 batch 16 tex 1907, OVERLAP_EXACT, raw 0800_880a_15, tris 4
    ['1159:26', 1908], // DP 987 batch 15 tex 1908, OVERLAP_EXACT, raw 0800_880a_16, tris 4
    ['1159:27', 253], // DP 987 batch 14 tex 253, OVERLAP_EXACT, raw 8800_280e_01, tris 6
    ['1159:28', 3563], // DP 987 batch 19 tex 3563, OVERLAP_EXACT, raw 0800_2c0f_03, tris 18
    ['1159:29', 368], // DP 987 batch 18 tex 368, OVERLAP_SECONDARY, raw 0810_0c0f_02, tris 12
    ['1160:0', 1864], // DP 988 batch 12 tex 1864, OVERLAP_EXACT, raw 1000_080a_0e, tris 8
    ['1160:1', 1884], // DP 988 batch 11 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_08, tris 6
    ['1160:2', 1882], // DP 988 batch 10 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_09, tris 6
    ['1160:3', 1885], // DP 988 batch 7 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0c, tris 6
    ['1160:4', 1883], // DP 988 batch 4 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 6
    ['1160:5', 1888], // DP 988 batch 3 tex 1888, OVERLAP_PARTIAL, raw 0800_080a_06, tris 4
    ['1160:6', 1886], // DP 988 batch 2 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_07, tris 4
    ['1160:7', 1884], // DP 988 batch 11 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_08, tris 5
    ['1160:8', 1882], // DP 988 batch 10 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_09, tris 3
    ['1160:9', 1888], // DP 988 batch  tex , INFER_BLOCK_RAWKEY, raw 0800_080a_0a, tris 4
    ['1160:10', 1885], // DP 988 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_0b, tris 4
    ['1160:11', 1885], // DP 988 batch 7 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0c, tris 4
    ['1160:12', 1883], // DP 988 batch 4 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 4
    ['1160:13', 1898], // DP 988 batch 19 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 20
    ['1160:14', 3052], // DP 988 batch  tex , INFER_BLOCK_RAWKEY, raw 1000_080a_02, tris 8
    ['1160:15', 3052], // DP 988 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_04, tris 13
    ['1160:16', 3052], // DP 988 batch  tex , INFER_BLOCK_RAWKEY, raw 0000_080a_04, tris 13
    ['1160:17', 1885], // DP 988 batch 8 tex 1885, OVERLAP_EXACT, raw 0000_0a03_0c, tris 1
    ['1160:18', 1883], // DP 988 batch 5 tex 1883, OVERLAP_EXACT, raw 0000_0a03_0d, tris 2
    ['1160:19', 1864], // DP 988 batch 13 tex 1864, OVERLAP_EXACT, raw 1000_0a03_0e, tris 3
    ['1160:20', 1898], // DP 988 batch 13 tex 1864, OVERLAP_PARTIAL, raw 1010_0e0b_00, tris 1
    ['1160:21', 1857], // DP 988 batch 13 tex 1864, OVERLAP_PARTIAL, raw 1010_0e0b_03, tris 2
    ['1160:22', 1899], // DP 988 batch 14 tex 1899, OVERLAP_EXACT, raw 1810_8e0b_0f, tris 3
    ['1160:23', 1885], // DP 988 batch 9 tex 1885, OVERLAP_EXACT, raw 0000_080a_0c, tris 2
    ['1160:24', 1883], // DP 988 batch 6 tex 1883, OVERLAP_EXACT, raw 0000_080a_0d, tris 2
    ['1160:25', 3052], // DP 988 batch  tex , INFER_GLOBAL_RAWKEY, raw 0810_080a_05, tris 5
    ['1160:26', 3563], // DP 988 batch 17 tex 3563, OVERLAP_EXACT, raw 0800_280f_01, tris 10
    ['1160:27', 3563], // DP 988 batch 18 tex 3563, OVERLAP_EXACT, raw 0800_2c0f_01, tris 14
    ['1161:0', 1057], // DP 989 batch 5 tex 1057, OVERLAP_PARTIAL, raw 1000_080a_01, tris 5
    ['1161:1', 1059], // DP 989 batch 11 tex 1059, OVERLAP_PARTIAL, raw 0000_080a_07, tris 5
    ['1161:2', 259], // DP 989 batch 14 tex 259, OVERLAP_PARTIAL, raw 0000_080a_08, tris 4
    ['1161:3', 258], // DP 989 batch 16 tex 258, OVERLAP_PARTIAL, raw 0000_080a_09, tris 10
    ['1161:4', 257], // DP 989 batch 19 tex 257, OVERLAP_PARTIAL, raw 0800_080a_0c, tris 4
    ['1161:5', 1053], // DP 989 batch 4 tex 1053, OVERLAP_EXACT, raw 1000_080a_0f, tris 1
    ['1161:6', 259], // DP 989 batch 14 tex 259, OVERLAP_PARTIAL, raw 0000_080a_08, tris 19
    ['1161:7', 259], // DP 989 batch 15 tex 259, OVERLAP_PARTIAL, raw 0000_080a_08, tris 6
    ['1161:8', 258], // DP 989 batch 16 tex 258, OVERLAP_PARTIAL, raw 0000_080a_09, tris 17
    ['1161:9', 258], // DP 989 batch 17 tex 258, OVERLAP_PARTIAL, raw 0000_080a_09, tris 16
    ['1161:10', 258], // DP 989 batch 18 tex 258, OVERLAP_PARTIAL, raw 0000_080a_09, tris 4
    ['1161:11', 257], // DP 989 batch 19 tex 257, OVERLAP_PARTIAL, raw 0800_080a_0c, tris 16
    ['1161:12', 257], // DP 989 batch 20 tex 257, OVERLAP_PARTIAL, raw 0800_080a_0c, tris 2
    ['1161:13', 1058], // DP 989 batch 3 tex 1058, OVERLAP_EXACT, raw 0000_080a_06, tris 2
    ['1161:14', 1059], // DP 989 batch 12 tex 1059, OVERLAP_PARTIAL, raw 0000_080a_07, tris 24
    ['1161:15', 1059], // DP 989 batch 12 tex 1059, OVERLAP_PARTIAL, raw 0000_080a_07, tris 21
    ['1161:16', 256], // DP 989 batch 2 tex 256, OVERLAP_EXACT, raw 1000_080a_0b, tris 14
    ['1161:17', 1057], // DP 989 batch 5 tex 1057, OVERLAP_PARTIAL, raw 1000_080a_01, tris 9
    ['1161:18', 2074], // DP 989 batch 1 tex 2074, OVERLAP_PARTIAL, raw 8800_080a_03, tris 4
    ['1161:19', 2074], // DP 989 batch 1 tex 2074, OVERLAP_PARTIAL, raw 8800_080a_03, tris 4
    ['1161:20', 2074], // DP 989 batch 1 tex 2074, OVERLAP_PARTIAL, raw 8800_080a_03, tris 4
    ['1161:21', 2074], // DP 989 batch 1 tex 2074, OVERLAP_PARTIAL, raw 8800_080a_03, tris 4
    ['1161:22', 2074], // DP 989 batch 1 tex 2074, OVERLAP_PARTIAL, raw 8800_080a_03, tris 4
    ['1161:23', 3569], // DP 989 batch 8 tex 3569, OVERLAP_EXACT, raw 0800_2c0f_0d, tris 2
    ['1161:24', 3569], // corrected from generated 3570; OVERLAP_BLENDTEX candidate DP 989 batch 8 raw 0810_2c0f_04 tris 2
    ['1161:25', 253], // DP 989 batch 7 tex 253, OVERLAP_EXACT, raw 8800_280e_04, tris 2
    ['1161:26', 254], // DP 989 batch 9 tex 254, OVERLAP_EXACT, raw 8800_080a_0a, tris 4
    ['1161:27', 1682], // DP 989 batch 21 tex 1682, OVERLAP_PARTIAL, raw 2800_280e_00, tris 14
    ['1161:28', 2292], // DP 989 batch 23 tex 2292, OVERLAP_PARTIAL, raw 2800_2c0f_00, tris 39
    ['1161:29', 1682], // DP 989 batch 21 tex 1682, OVERLAP_PARTIAL, raw 2800_2c0f_00, tris 2
    ['1161:30', 2292], // DP 989 batch 23 tex 2292, OVERLAP_SECONDARY, raw 2010_0c0f_02, tris 39
    ['1161:31', 2292], // DP 989 batch 23 tex 2292, OVERLAP_SECONDARY, raw 2010_0c0f_02, tris 2
    ['1161:32', 1904], // DP 989 batch 0 tex 1904, OVERLAP_EXACT, raw 1020_080a_0e, tris 2
    ['1161:33', 253], // DP 989 batch 6 tex 253, OVERLAP_EXACT, raw 0800_280e_04, tris 2
    ['1162:0', 1899], // DP 990 batch 14 tex 1899, OVERLAP_EXACT, raw 1800_8c0f_0b, tris 5
    ['1162:1', 1898], // DP 990 batch 12 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 1
    ['1162:2', 1841], // DP 990 batch 10 tex 1841, OVERLAP_EXACT, raw 0000_080a_07, tris 14
    ['1162:3', 1842], // DP 990 batch 7 tex 1842, OVERLAP_EXACT, raw 0000_080a_0a, tris 15
    ['1162:4', 1842], // DP 990 batch 8 tex 1842, OVERLAP_EXACT, raw 0000_080a_0a, tris 5
    ['1162:5', 1854], // DP 990 batch 16 tex 1854, OVERLAP_EXACT, raw 1000_0a03_00, tris 4
    ['1162:6', 1845], // DP 990 batch 0 tex 1845, OVERLAP_EXACT, raw 0000_0a03_05, tris 7
    ['1162:7', 1843], // DP 990 batch 2 tex 1843, OVERLAP_EXACT, raw 0000_0a03_06, tris 12
    ['1162:8', 1841], // DP 990 batch 11 tex 1841, OVERLAP_EXACT, raw 0000_0a03_07, tris 1
    ['1162:9', 1846], // DP 990 batch 3 tex 1846, OVERLAP_EXACT, raw 0000_0a03_08, tris 2
    ['1162:10', 1844], // DP 990 batch 5 tex 1844, OVERLAP_EXACT, raw 0000_0a03_09, tris 11
    ['1162:11', 1842], // DP 990 batch 9 tex 1842, OVERLAP_EXACT, raw 0000_0a03_0a, tris 3
    ['1162:12', 3604], // DP 990 batch 19 tex 3604, OVERLAP_PARTIAL, raw 0810_0e0b_02, tris 25
    ['1162:13', 3604], // DP 990 batch 19 tex 3604, OVERLAP_PARTIAL, raw 0810_0e0b_02, tris 11
    ['1162:14', 1854], // DP 990 batch 16 tex 1854, OVERLAP_EXACT, raw 1010_0e0b_03, tris 4
    ['1162:15', 1845], // DP 990 batch 1 tex 1845, OVERLAP_EXACT, raw 0000_080a_05, tris 8
    ['1162:16', 1846], // DP 990 batch 4 tex 1846, OVERLAP_EXACT, raw 0000_080a_08, tris 9
    ['1162:17', 1844], // DP 990 batch 6 tex 1844, OVERLAP_EXACT, raw 0000_080a_09, tris 1
    ['1162:18', 1898], // DP 990 batch 12 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_00, tris 14
    ['1162:19', 252], // DP 990 batch 17 tex 252, OVERLAP_PARTIAL, raw 0000_080a_04, tris 20
    ['1162:20', 252], // DP 990 batch 17 tex 252, OVERLAP_PARTIAL, raw 0000_080a_04, tris 2
    ['1162:21', 1912], // DP 990 batch 13 tex 1912, OVERLAP_EXACT, raw 0800_280f_01, tris 13
    ['1162:22', 3604], // DP 990 batch 15 tex 3604, OVERLAP_EXACT, raw 0810_080a_02, tris 18
    ['1163:0', 1898], // DP 991 batch 25 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_02, tris 12
    ['1163:1', 1845], // DP 991 batch 24 tex 1845, OVERLAP_EXACT, raw 0000_080a_05, tris 11
    ['1163:2', 1846], // DP 991 batch 23 tex 1846, OVERLAP_EXACT, raw 0000_080a_10, tris 9
    ['1163:3', 1843], // DP 991 batch 20 tex 1843, OVERLAP_PARTIAL, raw 0000_080a_06, tris 6
    ['1163:4', 1841], // DP 991 batch 18 tex 1841, OVERLAP_PARTIAL, raw 0000_080a_07, tris 6
    ['1163:5', 1844], // DP 991 batch 16 tex 1844, OVERLAP_PARTIAL, raw 0000_080a_11, tris 6
    ['1163:6', 1842], // DP 991 batch 14 tex 1842, OVERLAP_PARTIAL, raw 0000_080a_12, tris 6
    ['1163:7', 1843], // DP 991 batch 20 tex 1843, OVERLAP_PARTIAL, raw 0000_080a_06, tris 4
    ['1163:8', 1841], // DP 991 batch 18 tex 1841, OVERLAP_PARTIAL, raw 0000_080a_07, tris 4
    ['1163:9', 1844], // DP 991 batch 16 tex 1844, OVERLAP_PARTIAL, raw 0000_080a_11, tris 4
    ['1163:10', 1842], // DP 991 batch 14 tex 1842, OVERLAP_PARTIAL, raw 0000_080a_12, tris 4
    ['1163:11', 1888], // DP 991 batch 13 tex 1888, OVERLAP_EXACT, raw 0800_080a_08, tris 4
    ['1163:12', 1886], // DP 991 batch 11 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_09, tris 4
    ['1163:13', 1884], // DP 991 batch 10 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 2
    ['1163:14', 1882], // DP 991 batch 9 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_0b, tris 2
    ['1163:15', 1889], // DP 991 batch 8 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_0c, tris 6
    ['1163:16', 1887], // DP 991 batch 6 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 6
    ['1163:17', 1885], // DP 991 batch 5 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0e, tris 6
    ['1163:18', 1883], // DP 991 batch 4 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_0f, tris 4
    ['1163:19', 1884], // DP 991 batch 10 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 7
    ['1163:20', 1882], // DP 991 batch 9 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_0b, tris 4
    ['1163:21', 1885], // DP 991 batch 5 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0e, tris 6
    ['1163:22', 1883], // DP 991 batch 4 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_0f, tris 4
    ['1163:23', 1886], // DP 991 batch 11 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_09, tris 2
    ['1163:24', 1884], // DP 991 batch 10 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 1
    ['1163:25', 1889], // DP 991 batch 8 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_0c, tris 2
    ['1163:26', 1887], // DP 991 batch 6 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 2
    ['1163:27', 1898], // DP 991 batch 25 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_02, tris 8
    ['1163:28', 1894], // DP 991 batch 3 tex 1894, OVERLAP_EXACT, raw 0000_080a_13, tris 2
    ['1163:29', 1843], // DP 991 batch 21 tex 1843, OVERLAP_EXACT, raw 0040_080a_06, tris 2
    ['1163:30', 1841], // DP 991 batch 19 tex 1841, OVERLAP_EXACT, raw 0040_080a_07, tris 2
    ['1163:31', 1844], // DP 991 batch 17 tex 1844, OVERLAP_EXACT, raw 0040_080a_11, tris 2
    ['1163:32', 1842], // DP 991 batch 15 tex 1842, OVERLAP_EXACT, raw 0040_080a_12, tris 2
    ['1163:33', 1886], // DP 991 batch 11 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_09, tris 9
    ['1163:34', 1887], // DP 991 batch 6 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 3
    ['1163:35', 1843], // DP 991 batch 22 tex 1843, OVERLAP_EXACT, raw 0000_080a_06, tris 1
    ['1163:36', 1884], // DP 991 batch 10 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 4
    ['1163:37', 1882], // DP 991 batch 9 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_0b, tris 2
    ['1163:38', 1885], // DP 991 batch 5 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0e, tris 2
    ['1163:39', 1876], // DP 991 batch 2 tex 1876, OVERLAP_EXACT, raw 8800_080a_15, tris 2
    ['1163:40', 1877], // DP 991 batch 1 tex 1877, OVERLAP_EXACT, raw 8800_080a_16, tris 2
    ['1163:41', 1886], // DP 991 batch 12 tex 1886, OVERLAP_EXACT, raw 0000_0a03_09, tris 4
    ['1163:42', 1887], // DP 991 batch 7 tex 1887, OVERLAP_EXACT, raw 0000_0a03_0d, tris 2
    ['1163:43', 1886], // DP 991 batch 12 tex 1886, OVERLAP_EXACT, raw 0010_0e0b_06, tris 4
    ['1163:44', 1887], // DP 991 batch 7 tex 1887, OVERLAP_EXACT, raw 0010_0e0b_11, tris 2
    ['1163:45', 1912], // DP 991 batch 32 tex 1912, OVERLAP_EXACT, raw 0800_280f_03, tris 3
    ['1163:46', 3563], // DP 991 batch 30 tex 3563, OVERLAP_EXACT, raw 0800_280f_04, tris 2
    ['1163:47', 3563], // DP 991 batch 31 tex 3563, OVERLAP_EXACT, raw 0800_2c0f_04, tris 4
    ['1163:48', 1912], // DP 991 batch 34 tex 1912, OVERLAP_SECONDARY, raw 0810_2c0f_03, tris 2
    ['1163:49', 1682], // DP 991 batch 28 tex 1682, OVERLAP_EXACT, raw 2800_280e_00, tris 21
    ['1163:50', 1682], // DP 991 batch 29 tex 1682, OVERLAP_EXACT, raw 2800_2c0f_00, tris 31
    ['1163:51', 1682], // corrected from generated 2292; OVERLAP_EXACT candidate DP 991 batch 29 raw 2010_0c0f_01 tris 31
    ['1163:52', 1904], // DP 991 batch 0 tex 1904, OVERLAP_EXACT, raw 1020_080a_14, tris 2
    ['1164:0', 1062], // DP 992 batch 21 tex 1062, OVERLAP_PARTIAL, raw 0000_080a_04, tris 5
    ['1164:1', 1884], // DP 992 batch 18 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_09, tris 15
    ['1164:2', 1882], // DP 992 batch 17 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 6
    ['1164:3', 1885], // DP 992 batch 15 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 8
    ['1164:4', 1857], // DP 992 batch 13 tex 1857, OVERLAP_EXACT, raw 1000_080a_05, tris 27
    ['1164:5', 1882], // DP 992 batch 17 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 2
    ['1164:6', 1883], // DP 992 batch 12 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_0e, tris 2
    ['1164:7', 1062], // DP 992 batch 21 tex 1062, OVERLAP_PARTIAL, raw 0000_080a_04, tris 4
    ['1164:8', 1882], // DP 992 batch 17 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 2
    ['1164:9', 1883], // DP 992 batch 12 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_0e, tris 2
    ['1164:10', 1898], // DP 992 batch 11 tex 1898, OVERLAP_EXACT, raw 1000_080a_03, tris 10
    ['1164:11', 1894], // DP 992 batch 10 tex 1894, OVERLAP_EXACT, raw 0000_080a_10, tris 4
    ['1164:12', 1895], // DP 992 batch 9 tex 1895, OVERLAP_EXACT, raw 0000_080a_11, tris 4
    ['1164:13', 1888], // DP 992 batch 8 tex 1888, OVERLAP_PARTIAL, raw 0800_080a_07, tris 2
    ['1164:14', 1886], // DP 992 batch 5 tex 1886, OVERLAP_EXACT, raw 0000_080a_08, tris 2
    ['1164:15', 1884], // DP 992 batch 18 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_09, tris 3
    ['1164:16', 1889], // DP 992 batch 4 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_0b, tris 4
    ['1164:17', 1887], // DP 992 batch 1 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_0c, tris 4
    ['1164:18', 1885], // DP 992 batch 15 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 6
    ['1164:19', 1884], // DP 992 batch 18 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_09, tris 4
    ['1164:20', 1887], // DP 992 batch 1 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_0c, tris 3
    ['1164:21', 1885], // DP 992 batch 16 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 4
    ['1164:22', 1884], // DP 992 batch 19 tex 1884, OVERLAP_EXACT, raw 0000_080a_09, tris 3
    ['1164:23', 1885], // DP 992 batch 16 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 2
    ['1164:24', 1857], // DP 992 batch 14 tex 1857, OVERLAP_EXACT, raw 1000_0a03_05, tris 20
    ['1164:25', 1886], // DP 992 batch 6 tex 1886, OVERLAP_EXACT, raw 0000_0a03_08, tris 6
    ['1164:26', 1887], // DP 992 batch 2 tex 1887, OVERLAP_EXACT, raw 0000_0a03_0c, tris 8
    ['1164:27', 1057], // corrected from generated 1857; OVERLAP_EXACT candidate DP 992 batch 25 raw 1010_0e0b_01 tris 14
    ['1164:28', 1886], // DP 992 batch 6 tex 1886, OVERLAP_EXACT, raw 0010_0e0b_06, tris 6
    ['1164:29', 1887], // DP 992 batch 2 tex 1887, OVERLAP_EXACT, raw 0010_0e0b_0f, tris 8
    ['1164:30', 1904], // corrected from generated 1857; OVERLAP_EXACT candidate DP 992 batch 22 raw 1010_0e0b_12 tris 6
    ['1164:31', 1888], // DP 992 batch 8 tex 1888, OVERLAP_PARTIAL, raw 0800_080a_07, tris 4
    ['1164:32', 1886], // DP 992 batch 7 tex 1886, OVERLAP_EXACT, raw 0000_080a_08, tris 4
    ['1164:33', 1884], // DP 992 batch 20 tex 1884, OVERLAP_EXACT, raw 0000_080a_09, tris 4
    ['1164:34', 1882], // DP 992 batch 17 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_0a, tris 3
    ['1164:35', 1889], // DP 992 batch 4 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_0b, tris 4
    ['1164:36', 1887], // DP 992 batch 3 tex 1887, OVERLAP_EXACT, raw 0000_080a_0c, tris 4
    ['1164:37', 1885], // DP 992 batch 15 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 5
    ['1164:38', 1883], // DP 992 batch 12 tex 1883, OVERLAP_PARTIAL, raw 0000_080a_0e, tris 2
    ['1164:39', 1682], // DP 992 batch 26 tex 1682, OVERLAP_EXACT, raw 2800_280e_00, tris 22
    ['1164:40', 1682], // DP 992 batch 27 tex 1682, OVERLAP_EXACT, raw 2800_2c0f_00, tris 31
    ['1164:41', 2292], // DP 992 batch 28 tex 2292, OVERLAP_SECONDARY, raw 2010_0c0f_02, tris 32
    ['1164:42', 1904], // DP 992 batch 0 tex 1904, OVERLAP_EXACT, raw 1020_080a_12, tris 2
    ['1165:0', 1862], // DP 993 batch 14 tex 1862, OVERLAP_PARTIAL, raw 1000_080a_10, tris 12
    ['1165:1', 1898], // DP 993 batch 13 tex 1898, OVERLAP_EXACT, raw 1000_080a_03, tris 12
    ['1165:2', 1857], // DP 993 batch 11 tex 1857, OVERLAP_PARTIAL, raw 1000_080a_05, tris 8
    ['1165:3', 1862], // DP 993 batch 14 tex 1862, OVERLAP_PARTIAL, raw 1000_080a_10, tris 8
    ['1165:4', 1863], // DP 993 batch 9 tex 1863, OVERLAP_EXACT, raw 1000_080a_11, tris 8
    ['1165:5', 1857], // DP 993 batch 11 tex 1857, OVERLAP_PARTIAL, raw 1000_080a_05, tris 13
    ['1165:6', 1062], // DP 993 batch 21 tex 1062, OVERLAP_PARTIAL, raw 0000_080a_04, tris 13
    ['1165:7', 1888], // DP 993 batch 8 tex 1888, OVERLAP_PARTIAL, raw 0800_080a_06, tris 6
    ['1165:8', 1886], // DP 993 batch 7 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_07, tris 6
    ['1165:9', 1884], // DP 993 batch 6 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_08, tris 6
    ['1165:10', 1882], // DP 993 batch 5 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_09, tris 4
    ['1165:11', 1889], // DP 993 batch 4 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_0a, tris 4
    ['1165:12', 1887], // DP 993 batch 3 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_0b, tris 4
    ['1165:13', 1885], // DP 993 batch 2 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0c, tris 4
    ['1165:14', 1062], // DP 993 batch 21 tex 1062, OVERLAP_PARTIAL, raw 0000_080a_04, tris 7
    ['1165:15', 1882], // DP 993 batch 5 tex 1882, OVERLAP_PARTIAL, raw 0000_080a_09, tris 2
    ['1165:16', 1883], // DP 993 batch 1 tex 1883, OVERLAP_EXACT, raw 0000_080a_0d, tris 2
    ['1165:17', 1888], // DP 993 batch 8 tex 1888, OVERLAP_PARTIAL, raw 0800_080a_06, tris 4
    ['1165:18', 1886], // DP 993 batch 7 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_07, tris 4
    ['1165:19', 1884], // DP 993 batch 6 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_08, tris 4
    ['1165:20', 1889], // DP 993 batch 4 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_0a, tris 4
    ['1165:21', 1887], // DP 993 batch 3 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_0b, tris 4
    ['1165:22', 1885], // DP 993 batch 2 tex 1885, OVERLAP_PARTIAL, raw 0000_080a_0c, tris 4
    ['1165:23', 1857], // DP 993 batch 12 tex 1857, OVERLAP_EXACT, raw 1000_0a03_05, tris 16
    ['1165:24', 1862], // DP 993 batch 15 tex 1862, OVERLAP_EXACT, raw 1000_0a03_10, tris 8
    ['1165:25', 1863], // DP 993 batch 10 tex 1863, OVERLAP_EXACT, raw 1000_0a03_11, tris 4
    ['1165:26', 1057], // corrected from generated 1857; OVERLAP_EXACT candidate DP 993 batch 18 raw 1010_0e0b_01 tris 6
    ['1165:27', 1857], // DP 993 batch 17 tex 1857, OVERLAP_EXACT, raw 1010_0e0b_05, tris 12
    ['1165:28', 1865], // corrected from generated 1857; OVERLAP_EXACT candidate DP 993 batch 16 raw 1010_0e0b_0e tris 10
    ['1165:29', 1682], // DP 993 batch 23 tex 1682, OVERLAP_PARTIAL, raw 2800_280e_00, tris 15
    ['1165:30', 1682], // DP 993 batch 23 tex 1682, OVERLAP_PARTIAL, raw 2800_280e_00, tris 11
    ['1165:31', 1682], // DP 993 batch 19 tex 1682, OVERLAP_EXACT, raw 2800_2c0f_00, tris 41
    ['1165:32', 1682], // DP 993 batch 20 tex 1682, OVERLAP_EXACT, raw 2800_2c0f_00, tris 21
    ['1165:33', 1682], // DP 993 batch 19 tex 1682, OVERLAP_SECONDARY, raw 2010_0c0f_02, tris 29
    ['1165:34', 1682], // DP 993 batch 19 tex 1682, OVERLAP_SECONDARY, raw 2010_0c0f_02, tris 31
    ['1165:35', 2292], // DP 993 batch 25 tex 2292, OVERLAP_SECONDARY, raw 2010_0c0f_02, tris 3
    ['1165:36', 1904], // DP 993 batch 0 tex 1904, OVERLAP_EXACT, raw 1020_080a_0f, tris 2
    ['1166:0', 1857], // DP 994 batch 20 tex 1857, OVERLAP_EXACT, raw 1000_080a_09, tris 2
    ['1166:1', 1863], // DP 994 batch 18 tex 1863, OVERLAP_PARTIAL, raw 1000_080a_14, tris 15
    ['1166:2', 1888], // DP 994 batch 17 tex 1888, OVERLAP_PARTIAL, raw 0800_080a_0a, tris 4
    ['1166:3', 1886], // DP 994 batch 16 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_0b, tris 4
    ['1166:4', 1889], // DP 994 batch 15 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_0e, tris 4
    ['1166:5', 1887], // DP 994 batch 12 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_0f, tris 4
    ['1166:6', 1888], // DP 994 batch 17 tex 1888, OVERLAP_PARTIAL, raw 0800_080a_0a, tris 2
    ['1166:7', 1889], // DP 994 batch 15 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_0e, tris 4
    ['1166:8', 1888], // DP 994 batch 17 tex 1888, OVERLAP_PARTIAL, raw 0800_080a_0a, tris 4
    ['1166:9', 1886], // DP 994 batch 16 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_0b, tris 4
    ['1166:10', 1884], // DP 994 batch 11 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_0c, tris 4
    ['1166:11', 1889], // DP 994 batch 15 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_0e, tris 4
    ['1166:12', 1887], // DP 994 batch 12 tex 1887, OVERLAP_PARTIAL, raw 0000_080a_0f, tris 2
    ['1166:13', 1885], // DP 994 batch 8 tex 1885, OVERLAP_EXACT, raw 0000_080a_10, tris 2
    ['1166:14', 1865], // DP 994 batch 6 tex 1865, OVERLAP_EXACT, raw 1000_080a_12, tris 5
    ['1166:15', 1898], // DP 994 batch 5 tex 1898, OVERLAP_EXACT, raw 1000_080a_03, tris 9
    ['1166:16', 1863], // DP 994 batch 18 tex 1863, OVERLAP_PARTIAL, raw 1000_080a_14, tris 8
    ['1166:17', 2074], // DP 994 batch 4 tex 2074, OVERLAP_EXACT, raw 8800_080a_02, tris 4
    ['1166:18', 1062], // DP 994 batch 3 tex 1062, OVERLAP_PARTIAL, raw 0000_080a_06, tris 16
    ['1166:19', 1887], // DP 994 batch 13 tex 1887, OVERLAP_EXACT, raw 0000_0a03_0f, tris 2
    ['1166:20', 1885], // DP 994 batch 9 tex 1885, OVERLAP_EXACT, raw 0000_0a03_10, tris 2
    ['1166:21', 1865], // DP 994 batch 7 tex 1865, OVERLAP_EXACT, raw 1000_0a03_12, tris 5
    ['1166:22', 1863], // DP 994 batch 19 tex 1863, OVERLAP_EXACT, raw 1000_0a03_14, tris 8
    ['1166:23', 1887], // DP 994 batch 13 tex 1887, OVERLAP_EXACT, raw 0010_0e0b_07, tris 2
    ['1166:24', 1885], // DP 994 batch 9 tex 1885, OVERLAP_EXACT, raw 0010_0e0b_08, tris 2
    ['1166:25', 1857], // DP 994 batch 21 tex 1857, OVERLAP_EXACT, raw 1010_0e0b_09, tris 13
    ['1166:26', 1062], // DP 994 batch 3 tex 1062, OVERLAP_PARTIAL, raw 0000_080a_06, tris 2
    ['1166:27', 1888], // DP 994 batch 17 tex 1888, OVERLAP_PARTIAL, raw 0800_080a_0a, tris 2
    ['1166:28', 1886], // DP 994 batch 16 tex 1886, OVERLAP_PARTIAL, raw 0000_080a_0b, tris 2
    ['1166:29', 1884], // DP 994 batch 11 tex 1884, OVERLAP_PARTIAL, raw 0000_080a_0c, tris 2
    ['1166:30', 1882], // DP 994 batch 2 tex 1882, OVERLAP_EXACT, raw 0000_080a_0d, tris 2
    ['1166:31', 1889], // DP 994 batch 15 tex 1889, OVERLAP_PARTIAL, raw 0800_080a_0e, tris 4
    ['1166:32', 1887], // DP 994 batch 14 tex 1887, OVERLAP_EXACT, raw 0000_080a_0f, tris 4
    ['1166:33', 1885], // DP 994 batch 10 tex 1885, OVERLAP_EXACT, raw 0000_080a_10, tris 4
    ['1166:34', 1883], // DP 994 batch 1 tex 1883, OVERLAP_EXACT, raw 0000_080a_11, tris 4
    ['1166:35', 368], // DP 994 batch 26 tex 368, OVERLAP_SECONDARY, raw 0810_0c0f_05, tris 4
    ['1166:36', 1682], // DP 994 batch 25 tex 1682, OVERLAP_EXACT, raw 2800_280e_00, tris 15
    ['1166:37', 253], // DP 994 batch 24 tex 253, OVERLAP_EXACT, raw 2800_280e_04, tris 12
    ['1166:38', 1682], // DP 994 batch 27 tex 1682, OVERLAP_PARTIAL, raw 2800_2c0f_00, tris 39
    ['1166:39', 2292], // DP 994 batch 29 tex 2292, OVERLAP_PARTIAL, raw 2800_2c0f_00, tris 21
    ['1166:40', 2292], // DP 994 batch 29 tex 2292, OVERLAP_SECONDARY, raw 2010_0c0f_01, tris 36
    ['1166:41', 1682], // DP 994 batch 27 tex 1682, OVERLAP_SECONDARY, raw 2010_0c0f_01, tris 24
    ['1166:42', 1904], // DP 994 batch 0 tex 1904, OVERLAP_EXACT, raw 1020_080a_13, tris 2
    ['1167:0', 1857], // DP 995 batch 25 tex 1857, OVERLAP_EXACT, raw 1000_080a_09, tris 2
    ['1167:1', 1862], // DP 995 batch 22 tex 1862, OVERLAP_EXACT, raw 1000_080a_11, tris 6
    ['1167:2', 1889], // DP 995 batch 21 tex 1889, OVERLAP_EXACT, raw 0800_080a_0d, tris 2
    ['1167:3', 1887], // DP 995 batch 20 tex 1887, OVERLAP_EXACT, raw 0000_080a_0e, tris 2
    ['1167:4', 1057], // DP 995 batch 19 tex 1057, OVERLAP_EXACT, raw 1000_080a_01, tris 8
    ['1167:5', 256], // DP 995 batch 16 tex 256, OVERLAP_EXACT, raw 1000_080a_07, tris 2
    ['1167:6', 259], // DP 995 batch 14 tex 259, OVERLAP_PARTIAL, raw 0000_080a_05, tris 6
    ['1167:7', 258], // DP 995 batch 9 tex 258, OVERLAP_EXACT, raw 0000_080a_06, tris 18
    ['1167:8', 258], // DP 995 batch 10 tex 258, OVERLAP_EXACT, raw 0000_080a_06, tris 1
    ['1167:9', 257], // DP 995 batch 8 tex 257, OVERLAP_PARTIAL, raw 0800_080a_08, tris 8
    ['1167:10', 1888], // DP 995 batch 7 tex 1888, OVERLAP_EXACT, raw 0800_080a_0a, tris 2
    ['1167:11', 1886], // DP 995 batch 6 tex 1886, OVERLAP_EXACT, raw 0000_080a_0b, tris 2
    ['1167:12', 1884], // DP 995 batch 5 tex 1884, OVERLAP_EXACT, raw 0000_080a_0c, tris 1
    ['1167:13', 1059], // DP 995 batch 4 tex 1059, OVERLAP_PARTIAL, raw 0000_080a_03, tris 1
    ['1167:14', 1062], // DP 995 batch 3 tex 1062, OVERLAP_EXACT, raw 0000_080a_04, tris 2
    ['1167:15', 259], // DP 995 batch 14 tex 259, OVERLAP_PARTIAL, raw 0000_080a_05, tris 6
    ['1167:16', 258], // DP 995 batch 11 tex 258, OVERLAP_EXACT, raw 0000_080a_06, tris 9
    ['1167:17', 257], // DP 995 batch 8 tex 257, OVERLAP_PARTIAL, raw 0800_080a_08, tris 6
    ['1167:18', 1059], // DP 995 batch 4 tex 1059, OVERLAP_PARTIAL, raw 0000_080a_03, tris 7
    ['1167:19', 259], // DP 995 batch 15 tex 259, OVERLAP_EXACT, raw 0000_0a03_05, tris 2
    ['1167:20', 258], // DP 995 batch 12 tex 258, OVERLAP_EXACT, raw 0000_0a03_06, tris 2
    ['1167:21', 256], // DP 995 batch 17 tex 256, OVERLAP_EXACT, raw 1000_0a03_07, tris 5
    ['1167:22', 1857], // DP 995 batch 26 tex 1857, OVERLAP_EXACT, raw 1000_0a03_09, tris 3
    ['1167:23', 1862], // DP 995 batch 23 tex 1862, OVERLAP_EXACT, raw 1000_0a03_11, tris 8
    ['1167:24', 1863], // DP 995 batch 0 tex 1863, OVERLAP_EXACT, raw 1000_0a03_12, tris 4
    ['1167:25', 1857], // DP 995 batch 26 tex 1857, OVERLAP_EXACT, raw 1010_0e0b_07, tris 3
    ['1167:26', 1857], // DP 995 batch 29 tex 1857, OVERLAP_EXACT, raw 1010_0e0b_09, tris 17
    ['1167:27', 259], // DP 995 batch 15 tex 259, OVERLAP_EXACT, raw 0010_0e0b_0e, tris 2
    ['1167:28', 258], // DP 995 batch 12 tex 258, OVERLAP_EXACT, raw 0010_0e0b_0f, tris 2
    ['1167:29', 1862], // DP 995 batch 24 tex 1862, OVERLAP_EXACT, raw 1000_080a_11, tris 8
    ['1167:30', 1863], // DP 995 batch 1 tex 1863, OVERLAP_EXACT, raw 1000_080a_12, tris 8
    ['1167:31', 258], // DP 995 batch 13 tex 258, OVERLAP_EXACT, raw 0000_080a_06, tris 8
    ['1167:32', 256], // DP 995 batch 18 tex 256, OVERLAP_EXACT, raw 1000_080a_07, tris 3
    ['1167:33', 1682], // DP 995 batch 31 tex 1682, OVERLAP_EXACT, raw 2800_280e_00, tris 18
    ['1167:34', 1682], // DP 995 batch 32 tex 1682, OVERLAP_EXACT, raw 2800_2c0f_00, tris 32
    ['1167:35', 1682], // corrected from generated 2292; OVERLAP_EXACT candidate DP 995 batch 32 raw 2010_0c0f_02 tris 32
    ['1167:36', 1904], // DP 995 batch 2 tex 1904, OVERLAP_EXACT, raw 1020_080a_10, tris 2
    ['1168:0', 1900], // DP 996 batch 23 tex 1900, OVERLAP_EXACT, raw 1000_080a_05, tris 24
    ['1168:1', 1898], // DP 996 batch 26 tex 1898, OVERLAP_EXACT, raw 1000_0a03_01, tris 32
    ['1168:2', 1898], // DP 996 batch 27 tex 1898, OVERLAP_EXACT, raw 1000_0a03_01, tris 14
    ['1168:3', 1057], // DP 996 batch 28 tex 1057, OVERLAP_EXACT, raw 1010_0e0b_00, tris 18
    ['1168:4', 1854], // DP 996 batch 25 tex 1854, OVERLAP_EXACT, raw 1010_0e0b_03, tris 28
    ['1168:5', 1898], // DP 996 batch 29 tex 1898, OVERLAP_EXACT, raw 1040_080a_01, tris 15
    ['1168:6', 1900], // DP 996 batch 24 tex 1900, OVERLAP_EXACT, raw 1040_080a_05, tris 24
    ['1168:7', 1891], // DP 996 batch 13 tex 1891, OVERLAP_EXACT, raw 0040_080a_0d, tris 20
    ['1168:8', 1891], // DP 996 batch 14 tex 1891, OVERLAP_EXACT, raw 0040_080a_0d, tris 16
    ['1168:9', 1898], // DP 996 batch 15 tex 1898, OVERLAP_EXACT, raw 1040_080a_01, tris 4
    ['1168:10', 1891], // DP 996 batch 16 tex 1891, OVERLAP_EXACT, raw 0040_080a_0d, tris 3
    ['1168:11', 1898], // DP 996 batch 17 tex 1898, OVERLAP_EXACT, raw 1040_080a_01, tris 4
    ['1168:12', 1891], // DP 996 batch 18 tex 1891, OVERLAP_EXACT, raw 0040_080a_0d, tris 3
    ['1168:13', 1898], // DP 996 batch 19 tex 1898, OVERLAP_EXACT, raw 1040_080a_01, tris 4
    ['1168:14', 1891], // DP 996 batch 20 tex 1891, OVERLAP_EXACT, raw 0040_080a_0d, tris 3
    ['1168:15', 1057], // DP 996 batch 9 tex 1057, OVERLAP_EXACT, raw 1000_080a_00, tris 11
    ['1168:16', 1890], // DP 996 batch 35 tex 1890, OVERLAP_PARTIAL, raw 0000_080a_09, tris 25
    ['1168:17', 1890], // DP 996 batch 34 tex 1890, OVERLAP_PARTIAL, raw 0000_080a_09, tris 12
    ['1168:18', 1891], // DP 996 batch 36 tex 1891, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 25
    ['1168:19', 1891], // DP 996 batch 36 tex 1891, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 12
    ['1168:20', 1891], // DP 996 batch 38 tex 1891, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 20
    ['1168:21', 1891], // DP 996 batch 38 tex 1891, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 17
    ['1168:22', 1845], // DP 996 batch 5 tex 1845, OVERLAP_EXACT, raw 0000_080a_06, tris 12
    ['1168:23', 1846], // DP 996 batch 4 tex 1846, OVERLAP_EXACT, raw 0000_080a_0a, tris 14
    ['1168:24', 3549], // DP 996 batch 3 tex 3549, OVERLAP_EXACT, raw 0000_080b_0e, tris 3
    ['1168:25', 1898], // DP 996 batch 42 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_01, tris 1
    ['1168:26', 1843], // DP 996 batch 21 tex 1843, OVERLAP_EXACT, raw 0000_080a_07, tris 12
    ['1168:27', 1841], // DP 996 batch 30 tex 1841, OVERLAP_EXACT, raw 0000_080a_08, tris 12
    ['1168:28', 1844], // DP 996 batch 22 tex 1844, OVERLAP_EXACT, raw 0000_080a_0b, tris 10
    ['1168:29', 1842], // DP 996 batch 31 tex 1842, OVERLAP_EXACT, raw 0000_080a_0c, tris 10
    ['1168:30', 1898], // DP 996 batch 42 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_01, tris 19
    ['1168:31', 1898], // DP 996 batch 43 tex 1898, OVERLAP_PARTIAL, raw 1000_080a_01, tris 16
    ['1168:32', 1891], // DP 996 batch 39 tex 1891, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 2
    ['1168:33', 1898], // DP 996 batch 0 tex 1898, OVERLAP_EXACT, raw 1000_080a_01, tris 4
    ['1168:34', 1891], // DP 996 batch 7 tex 1891, OVERLAP_EXACT, raw 0000_080a_0d, tris 3
    ['1168:35', 1898], // DP 996 batch 1 tex 1898, OVERLAP_EXACT, raw 1000_080a_01, tris 4
    ['1168:36', 1891], // DP 996 batch 8 tex 1891, OVERLAP_EXACT, raw 0000_080a_0d, tris 3
    ['1168:37', 1898], // DP 996 batch 2 tex 1898, OVERLAP_EXACT, raw 1000_080a_01, tris 4
    ['1168:38', 1890], // DP 996 batch 6 tex 1890, OVERLAP_EXACT, raw 0000_080a_09, tris 3
    ['1168:39', 3563], // DP 996 batch 33 tex 3563, OVERLAP_EXACT, raw 0800_280f_02, tris 7
    ['1168:40', 3563], // DP 996 batch 10 tex 3563, OVERLAP_EXACT, raw 0800_280f_02, tris 7
    ['1168:41', 3563], // DP 996 batch 11 tex 3563, OVERLAP_EXACT, raw 0800_280f_02, tris 7
    ['1168:42', 3563], // DP 996 batch 32 tex 3563, OVERLAP_EXACT, raw 0800_280f_02, tris 14
    ['1168:43', 3563], // DP 996 batch 12 tex 3563, OVERLAP_EXACT, raw 0800_280f_02, tris 6
    ['1168:44', 2665], // DP 996 batch 44 tex 2665, OVERLAP_PARTIAL, raw 0800_880a_04, tris 9
    ['1168:45', 2665], // DP 996 batch 44 tex 2665, OVERLAP_PARTIAL, raw 0800_880a_04, tris 12
    ['1168:46', 2665], // DP 996 batch 44 tex 2665, OVERLAP_PARTIAL, raw 0800_880a_04, tris 6
    ['1168:47', 1891], // DP 996 batch 40 tex 1891, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 23
    ['1168:48', 1891], // DP 996 batch 40 tex 1891, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 16
    ['1168:49', 1891], // DP 996 batch 40 tex 1891, OVERLAP_PARTIAL, raw 0000_080a_0d, tris 3
    ['1169:0', 1857], // DP 997 batch 0 tex 1857, OVERLAP_EXACT, raw 1000_080a_00, tris 1
    ['1170:0', 1857], // DP 998 batch 0 tex 1857, OVERLAP_EXACT, raw 1000_080a_00, tris 1
    ['1171:0', 1857], // DP 999 batch 0 tex 1857, OVERLAP_EXACT, raw 1000_080a_00, tris 1
    ['1172:0', 1857], // DP 1000 batch 0 tex 1857, OVERLAP_EXACT, raw 1000_080a_00, tris 1
    ['1173:0', 1857], // DP 1001 batch 0 tex 1857, OVERLAP_EXACT, raw 1000_080a_00, tris 1
    ['1174:0', 1911], // DP 1002 batch 8 tex 1911, OVERLAP_PARTIAL, raw 1000_080a_01, tris 9
    ['1174:1', 1890], // DP 1002 batch 7 tex 1890, OVERLAP_EXACT, raw 0000_080a_04, tris 2
    ['1174:2', 1891], // DP 1002 batch 6 tex 1891, OVERLAP_EXACT, raw 0000_080a_05, tris 4
    ['1174:3', 1892], // DP 1002 batch 5 tex 1892, OVERLAP_EXACT, raw 0000_080a_06, tris 2
    ['1174:4', 1893], // DP 1002 batch 4 tex 1893, OVERLAP_EXACT, raw 0000_080a_07, tris 4
    ['1174:5', 1894], // DP 1002 batch 3 tex 1894, OVERLAP_EXACT, raw 0000_080a_08, tris 2
    ['1174:6', 1895], // DP 1002 batch 2 tex 1895, OVERLAP_EXACT, raw 0000_080a_09, tris 4
    ['1174:7', 1896], // DP 1002 batch 1 tex 1896, OVERLAP_EXACT, raw 0800_080a_0a, tris 2
    ['1174:8', 1897], // DP 1002 batch 0 tex 1897, OVERLAP_EXACT, raw 0800_080a_0b, tris 4
    ['1174:9', 3563], // DP 1002 batch 9 tex 3563, OVERLAP_EXACT, raw 0800_280f_00, tris 6
    ['1174:10', 3553], // DP 1002 batch  tex , INFER_GLOBAL_FULLKEY, raw 0800_2c0f_00, tris 6
    ['1174:11', 1911], // DP 1002 batch 8 tex 1911, OVERLAP_PARTIAL, raw 0810_080a_02, tris 2
    ['1174:12', 1911], // DP 1002 batch  tex , INFER_BLOCK_RAWKEY, raw 0810_080a_03, tris 1
    ['1175:0', 1911], // DP 1003 batch 28 tex 1911, OVERLAP_EXACT, raw 1400_080a_04, tris 16
    ['1175:1', 2716], // DP 1003 batch 24 tex 2716, OVERLAP_EXACT, raw 0400_080a_09, tris 2
    ['1175:2', 1274], // DP 1003 batch 21 tex 1274, OVERLAP_EXACT, raw 0200_080a_05, tris 16
    ['1175:3', 1274], // DP 1003 batch 22 tex 1274, OVERLAP_EXACT, raw 0200_080a_05, tris 8
    ['1175:4', 1260], // DP 1003 batch 20 tex 1260, OVERLAP_EXACT, raw 0200_080a_08, tris 18
    ['1175:5', 1247], // DP 1003 batch 19 tex 1247, OVERLAP_EXACT, raw 0200_080a_07, tris 14
    ['1175:6', 1861], // DP 1003 batch 18 tex 1861, OVERLAP_EXACT, raw 0200_080a_02, tris 8
    ['1175:7', 3549], // DP 1003 batch 4 tex 3549, OVERLAP_EXACT, raw 0000_080b_0a, tris 8
    ['1175:8', 2477], // DP 1003 batch 16 tex 2477, OVERLAP_EXACT, raw 0000_080a_0b, tris 16
    ['1175:9', 2477], // DP 1003 batch 17 tex 2477, OVERLAP_EXACT, raw 0000_080a_0b, tris 16
    ['1175:10', 2498], // DP 1003 batch 3 tex 2498, OVERLAP_EXACT, raw 0000_080a_0c, tris 12
    ['1175:11', 2500], // DP 1003 batch 2 tex 2500, OVERLAP_EXACT, raw 0000_080a_0d, tris 4
    ['1175:12', 2501], // DP 1003 batch 1 tex 2501, OVERLAP_EXACT, raw 0000_080a_0e, tris 8
    ['1175:13', 2499], // DP 1003 batch 0 tex 2499, OVERLAP_EXACT, raw 0000_080a_0f, tris 8
    ['1175:14', 3550], // DP 1003 batch 15 tex 3550, OVERLAP_EXACT, raw 0000_080a_10, tris 4
    ['1175:15', 3551], // DP 1003 batch 14 tex 3551, OVERLAP_EXACT, raw 0000_080a_11, tris 4
    ['1175:16', 2078], // DP 1003 batch 9 tex 2078, OVERLAP_EXACT, raw 1000_080a_12, tris 18
    ['1175:17', 2078], // DP 1003 batch 12 tex 2078, OVERLAP_PARTIAL, raw 1000_080a_12, tris 19
    ['1175:18', 2078], // DP 1003 batch 13 tex 2078, OVERLAP_PARTIAL, raw 1000_080a_12, tris 16
    ['1175:19', 2078], // DP 1003 batch 10 tex 2078, OVERLAP_PARTIAL, raw 1000_080a_12, tris 9
    ['1175:20', 2716], // DP 1003 batch 25 tex 2716, OVERLAP_EXACT, raw 0000_080a_09, tris 16
    ['1175:21', 2078], // DP 1003 batch 10 tex 2078, OVERLAP_PARTIAL, raw 1000_080a_12, tris 16
    ['1175:22', 1898], // DP 1003 batch 8 tex 1898, OVERLAP_EXACT, raw 1200_080a_00, tris 2
    ['1175:23', 1854], // DP 1003 batch 7 tex 1854, OVERLAP_EXACT, raw 1200_080a_03, tris 4
    ['1175:24', 1902], // DP 1003 batch 5 tex 1902, OVERLAP_EXACT, raw 1200_080a_06, tris 16
    ['1175:25', 1902], // DP 1003 batch 6 tex 1902, OVERLAP_EXACT, raw 1200_080a_06, tris 16
    ['1175:26', 2716], // DP 1003 batch 26 tex 2716, OVERLAP_EXACT, raw 0200_080a_09, tris 2
    ['1175:27', 1911], // DP 1003 batch 35 tex 1911, OVERLAP_PARTIAL, raw 1200_080a_04, tris 26
    ['1175:28', 1911], // DP 1003 batch 37 tex 1911, OVERLAP_PARTIAL, raw 1200_080a_04, tris 32
    ['1175:29', 1911], // DP 1003 batch 36 tex 1911, OVERLAP_PARTIAL, raw 1200_080a_04, tris 27
    ['1175:30', 1911], // DP 1003 batch 36 tex 1911, OVERLAP_PARTIAL, raw 1200_080a_04, tris 4
    ['1175:31', 1911], // DP 1003 batch 29 tex 1911, OVERLAP_EXACT, raw 1200_0a03_04, tris 16
    ['1175:32', 1274], // DP 1003 batch 23 tex 1274, OVERLAP_EXACT, raw 0200_0a03_05, tris 10
    ['1175:33', 2716], // DP 1003 batch 27 tex 2716, OVERLAP_EXACT, raw 0200_0a03_09, tris 5
    ['1175:34', 1898], // DP 1003 batch 31 tex 1898, OVERLAP_PARTIAL, raw 1210_0e0b_00, tris 20
    ['1175:35', 1274], // DP 1003 batch 23 tex 1274, OVERLAP_PARTIAL, raw 1210_0e0b_00, tris 8
    ['1175:36', 1911], // corrected from generated 2716; OVERLAP_EXACT candidate DP 1003 batch 30 raw 1210_0e0b_04 tris 3
    ['1175:37', 3563], // DP 1003 batch 33 tex 3563, OVERLAP_EXACT, raw 0800_280f_01, tris 15
    ['1175:38', 3563], // DP 1003 batch  tex , INFER_GLOBAL_FULLKEY, raw 0800_2c0f_01, tris 16
    ['1176:0', 1911], // DP 1004 batch 18 tex 1911, OVERLAP_EXACT, raw 1000_080a_02, tris 16
    ['1176:1', 1841], // DP 1004 batch 10 tex 1841, OVERLAP_PARTIAL, raw 0000_080a_03, tris 5
    ['1176:2', 1890], // DP 1004 batch 9 tex 1890, OVERLAP_EXACT, raw 0000_080a_04, tris 2
    ['1176:3', 1885], // DP 1004 batch 7 tex 1885, OVERLAP_EXACT, raw 0000_080a_05, tris 1
    ['1176:4', 1842], // DP 1004 batch 6 tex 1842, OVERLAP_PARTIAL, raw 0000_080a_07, tris 3
    ['1176:5', 1892], // DP 1004 batch 5 tex 1892, OVERLAP_EXACT, raw 0000_080a_09, tris 2
    ['1176:6', 1894], // DP 1004 batch 4 tex 1894, OVERLAP_EXACT, raw 0000_080a_0b, tris 2
    ['1176:7', 1895], // DP 1004 batch 3 tex 1895, OVERLAP_EXACT, raw 0000_080a_0c, tris 1
    ['1176:8', 1841], // DP 1004 batch 10 tex 1841, OVERLAP_PARTIAL, raw 0000_080a_03, tris 4
    ['1176:9', 1842], // DP 1004 batch 6 tex 1842, OVERLAP_PARTIAL, raw 0000_080a_07, tris 6
    ['1176:10', 1885], // DP 1004 batch 8 tex 1885, OVERLAP_EXACT, raw 0000_0a03_05, tris 2
    ['1176:11', 1883], // DP 1004 batch 0 tex 1883, OVERLAP_EXACT, raw 0000_0a03_06, tris 2
    ['1176:12', 1891], // DP 1004 batch 1 tex 1891, OVERLAP_EXACT, raw 0000_0a03_08, tris 2
    ['1176:13', 1893], // DP 1004 batch 2 tex 1893, OVERLAP_EXACT, raw 0000_0a03_0a, tris 3
    ['1176:14', 1893], // DP 1004 batch 2 tex 1893, OVERLAP_EXACT, raw 0010_0e0b_05, tris 3
    ['1176:15', 1891], // DP 1004 batch 1 tex 1891, OVERLAP_EXACT, raw 0010_0e0b_06, tris 2
    ['1176:16', 1842], // DP 1004 batch 11 tex 1842, OVERLAP_EXACT, raw 0010_0e0b_07, tris 4
    ['1176:17', 3563], // corrected from generated 3553; SPATIAL_BBOX candidate DP 1004 batch 15 raw 0800_280f_00 tris 9
    ['1176:18', 3553], // DP 1004 batch 14 tex 3553, OVERLAP_EXACT, raw 0800_280f_01, tris 1
    ['1176:19', 3553], // DP 1004 batch 16 tex 3553, OVERLAP_PARTIAL, raw 0800_2c0f_00, tris 3
    ['1176:20', 3553], // corrected from generated 3563; OVERLAP_EXACT candidate DP 1004 batch 16 raw 0810_2c0f_01 tris 2
    ['1177:0', 1911], // DP 1005 batch 0 tex 1911, OVERLAP_EXACT, raw 1000_080a_02, tris 5
    ['1177:1', 3553], // DP 1005 batch 1 tex 3553, OVERLAP_EXACT, raw 0800_280f_01, tris 2
    ['1177:2', 3553], // DP 1005 batch 2 tex 3553, OVERLAP_EXACT, raw 0800_2c0f_00, tris 3
    ['1177:3', 3553], // corrected from generated 3563; OVERLAP_EXACT candidate DP 1005 batch 2 raw 0810_2c0f_01 tris 3
    ['1178:0', 1911], // DP 1006 batch 8 tex 1911, OVERLAP_EXACT, raw 1000_080a_02, tris 2
    ['1178:1', 1890], // DP 1006 batch 7 tex 1890, OVERLAP_EXACT, raw 0000_080a_03, tris 2
    ['1178:2', 1891], // DP 1006 batch 6 tex 1891, OVERLAP_EXACT, raw 0000_080a_04, tris 2
    ['1178:3', 1892], // DP 1006 batch 5 tex 1892, OVERLAP_EXACT, raw 0000_080a_05, tris 2
    ['1178:4', 1893], // DP 1006 batch 4 tex 1893, OVERLAP_EXACT, raw 0000_080a_06, tris 2
    ['1178:5', 1894], // DP 1006 batch 3 tex 1894, OVERLAP_EXACT, raw 0000_080a_07, tris 2
    ['1178:6', 1895], // DP 1006 batch 2 tex 1895, OVERLAP_EXACT, raw 0000_080a_08, tris 2
    ['1178:7', 1896], // DP 1006 batch 1 tex 1896, OVERLAP_EXACT, raw 0800_080a_09, tris 2
    ['1178:8', 1897], // DP 1006 batch 0 tex 1897, OVERLAP_EXACT, raw 0800_080a_0a, tris 2
    ['1178:9', 3553], // DP 1006 batch 9 tex 3553, OVERLAP_EXACT, raw 0800_280f_01, tris 3
    ['1178:10', 3553], // DP 1006 batch 10 tex 3553, OVERLAP_EXACT, raw 0800_2c0f_00, tris 4
    ['1178:11', 3553], // corrected from generated 3563; OVERLAP_EXACT candidate DP 1006 batch 10 raw 0810_2c0f_01 tris 4
    ['1179:0', 1911], // DP 1007 batch 0 tex 1911, OVERLAP_EXACT, raw 1000_080a_02, tris 2
    ['1179:1', 3553], // DP 1007 batch 1 tex 3553, OVERLAP_EXACT, raw 0800_280f_01, tris 2
    ['1179:2', 3553], // DP 1007 batch 2 tex 3553, OVERLAP_EXACT, raw 0800_2c0f_00, tris 2
    ['1179:3', 3553], // corrected from generated 3563; OVERLAP_EXACT candidate DP 1007 batch 2 raw 0810_2c0f_01 tris 2
    ['1180:0', 1911], // DP 1008 batch 0 tex 1911, OVERLAP_EXACT, raw 1000_080a_02, tris 4
    ['1180:1', 3553], // DP 1008 batch 1 tex 3553, OVERLAP_EXACT, raw 0800_280f_01, tris 4
    ['1180:2', 3553], // DP 1008 batch 2 tex 3553, OVERLAP_EXACT, raw 0800_2c0f_00, tris 2
    ['1180:3', 3553], // corrected from generated 3563; OVERLAP_EXACT candidate DP 1008 batch 2 raw 0810_2c0f_01 tris 2
    ['1181:0', 1845], // DP 1009 batch 3 tex 1845, OVERLAP_EXACT, raw 0000_080a_01, tris 2
    ['1181:1', 1843], // DP 1009 batch 2 tex 1843, OVERLAP_EXACT, raw 0000_080a_02, tris 4
    ['1181:2', 1846], // DP 1009 batch 1 tex 1846, OVERLAP_EXACT, raw 0000_080a_03, tris 2
    ['1181:3', 1844], // DP 1009 batch 0 tex 1844, OVERLAP_EXACT, raw 0000_080a_04, tris 4
    ['1181:4', 3553], // DP 1009 batch 4 tex 3553, OVERLAP_EXACT, raw 0800_280f_00, tris 2
]);

const MOD49_TO_DP_BLOCK = new Map<number, number>([
    [1146, 974],
    [1147, 975],
    [1148, 976],
    [1149, 977],
    [1150, 978],
    [1151, 979],
    [1152, 980],
    [1153, 981],
    [1154, 982],
    [1155, 983],
    [1156, 984],
    [1157, 985],
    [1158, 986],
    [1159, 987],
    [1160, 988],
    [1161, 989],
    [1162, 990],
    [1163, 991],
    [1164, 992],
    [1165, 993],
    [1166, 994],
    [1167, 995],
    [1168, 996],
    [1169, 997],
    [1170, 998],
    [1171, 999],
    [1172, 1000],
    [1173, 1001],
    [1174, 1002],
    [1175, 1003],
    [1176, 1004],
    [1177, 1005],
    [1178, 1006],
    [1179, 1007],
    [1180, 1008],
    [1181, 1009],
]);

const MOD49_UV_MUL_BY_TEX = new Map<number, number>([
    [3553, 8],
    [3563, 8],
    [3569, 8],
    [3570, 8],
    [1891, 8],
    [1893, 8],
    [1895, 8],
    [1896, 8],
    [1897, 8],
]);

const getMod49UVMul = (texId: number): number => {
    return getDebugNumber(
        `__MOD49_UV_MUL_${texId}`,
        MOD49_UV_MUL_BY_TEX.get(texId) ?? 8,
    );
};


const MOD49_UV_SCALE_BY_TEX = new Map<number, number>([
    [3553, 64],
    [1858, 256],
    [1098, 256],
  
]);

const getMod49UVScale = (texId: number): number => {
    return getDebugNumber(
        `__MOD49_UV_SCALE_${texId}`,
        MOD49_UV_SCALE_BY_TEX.get(texId) ?? 512,
    );
};

const MOD49_CUTOUT_TEXIDS = new Set<number>([
    738, 739, 732, 733, 2678, 905,
    3, 6, 31, 61, 119, 164, 289,
    349, 351, 354, 355, 356, 544,
    2087, 3195, 1101, 1028, 1122, 1125,
    1050, 1049, 1051, 1066, 1075, 1423,
    1888, 1889, 1896, 1897, 1877,1876,1855,1905,1906,1903,1907,1908,1859,1860,1881,257,2074,
]);

const MOD49_SCROLL_WATER_TEXIDS = new Set<number>([
    3561, 3569, 3570, 2715, 2514, 862,
    3553, 3563, 2248, 1912, 3604, 2292, 1682,
]);

const MOD49_SCROLL_WATERFALL_TEXIDS = new Set<number>([
    358, 123, 253, 254, 368, 1127, 3560, 510,
    3563, 3562, 1941, 2750, 2048, 270, 1231, 1232,
]);

const mod49IsScrollingWater = (texId: number): boolean => {
    return MOD49_SCROLL_WATER_TEXIDS.has(texId) ||
           MOD49_SCROLL_WATERFALL_TEXIDS.has(texId);
};

const MOD49_FORCE_TRANSLUCENT_TEXIDS = new Set<number>([
    1682, 2292,
    253, 254, 368,
    3553, 3563, 3569, 3570,
    1912, 3604, 2665
]);

const MOD49_LIGHTBEAM_TEXIDS = new Set<number>([
    3553, 3563, 3569, 3570, 1912, 3604, 2665
]);

const mod49TargetListForTexId = (texId: number): number => {
    if (mod49IsScrollingWater(texId))
        return 1;

    if (MOD49_FORCE_TRANSLUCENT_TEXIDS.has(texId))
        return 1;

    return 0;
};

const mod49TargetListForBucket = (bucket: Bucket): number => {
    const behavior = bucket.materialBehavior;
const texId = bucket.dpTexId;
const blendTexId = behavior?.blendTexId;

    if (
        behavior?.translucent ||
        behavior?.water ||
        behavior?.lightbeam ||
        blendTexId !== undefined ||
        mod49IsScrollingWater(texId) ||
        (blendTexId !== undefined && mod49IsScrollingWater(blendTexId))
    ) {
        return 1;
    }

    return 0;
};

const mod49AddScrollFixed = (layer: any, duFixed: number, dvFixed: number) => {
    if (!layer || (duFixed === 0 && dvFixed === 0))
        return;

    const slot = (materialFactory as any).addScrollSlot?.(duFixed | 0, dvFixed | 0);
    if (slot !== undefined) {
        layer.enableScroll = 1;
        layer.scrollSlot = slot;
    }
};

const mod49AddHeuristicScroll = (
    layer: any,
    uPx: number,
    vPx: number,
    texW: number = 32,
    texH: number = 32,
) => {
    mod49AddScrollFixed(
        layer,
        ((uPx << 16) / Math.max(1, texW)) | 0,
        ((vPx << 16) / Math.max(1, texH)) | 0,
    );
};

const mod49ApplyLayerScroll = (layer: any, texId: number) => {
    if (MOD49_SCROLL_WATER_TEXIDS.has(texId)) {
        mod49AddHeuristicScroll(layer, 0, -1);
    } else if (MOD49_SCROLL_WATERFALL_TEXIDS.has(texId)) {
        mod49AddHeuristicScroll(layer, 0, 2);
    }
};

try {
      (window as any).__mod49SetSlot = (slot: any, dpTexId: any) => {
        const s = Number(slot) | 0;
        const t = Number(dpTexId) | 0;

        const m = readNumberMapFromLocalStorage('__MOD49_SLOT_TO_DP_TEX');
        m.set(s, t);
        saveNumberMapToLocalStorage('__MOD49_SLOT_TO_DP_TEX', m);

       // console.warn(`[MOD49 SLOT MAP SAVED] slot ${s} -> DP tex ${t}`);
        location.reload();
    };

    (window as any).__mod49OnlySlot = (slot: any) => {
        localStorage.setItem('__MOD49_ONLY_SLOT', String(Number(slot) | 0));
        localStorage.removeItem('__MOD49_ONLY_BLOCK');
        localStorage.removeItem('__MOD49_ONLY_GROUP');
        localStorage.removeItem('__MOD49_TEX_ID');
        location.reload();
    };

    (window as any).__mod49ClearMaps = () => {
        localStorage.removeItem('__MOD49_SLOT_TO_DP_TEX');
        localStorage.removeItem('__MOD49_BLOCKGROUP_TO_DP_TEX');
localStorage.removeItem('__MOD49_FULLKEY_TO_DP_TEX');
localStorage.removeItem('__MOD49_RAWKEY_TO_DP_TEX');
localStorage.removeItem('__MOD49_TEX_ID');
        location.reload();
    };
    (window as any).__mod49SetGroup = (block: any, group: any, dpTexId: any) => {
        const b = Number(block) | 0;
        const g = Number(group) | 0;
        const t = Number(dpTexId) | 0;

        const key = `${b}:${g}`;

        const m = readStringMapFromLocalStorage('__MOD49_BLOCKGROUP_TO_DP_TEX');
        m.set(key, t);
        saveStringMapToLocalStorage('__MOD49_BLOCKGROUP_TO_DP_TEX', m);

       // console.warn(`[MOD49 MAP SAVED] block/group ${key} -> DP tex ${t}`);
        location.reload();
    };

    (window as any).__mod49OnlyGroup = (block: any, group: any) => {
        localStorage.setItem('__MOD49_ONLY_BLOCK', String(Number(block) | 0));
        localStorage.setItem('__MOD49_ONLY_GROUP', String(Number(group) | 0));
        localStorage.removeItem('__MOD49_ONLY_SLOT');
        localStorage.removeItem('__MOD49_TEX_ID');
        location.reload();
    };

    (window as any).__mod49SetMat = (fullKey: any, dpTexId: any) => {
        const k = String(fullKey);
        const t = Number(dpTexId) | 0;

        const m = readStringMapFromLocalStorage('__MOD49_FULLKEY_TO_DP_TEX');
        m.set(k, t);
        saveStringMapToLocalStorage('__MOD49_FULLKEY_TO_DP_TEX', m);

      //  console.warn(`[MOD49 FULLKEY MAP SAVED] ${k} -> DP tex ${t}`);
        location.reload();
    };

    (window as any).__mod49ClearOnly = () => {
        localStorage.removeItem('__MOD49_ONLY_BLOCK');
        localStorage.removeItem('__MOD49_ONLY_GROUP');
        localStorage.removeItem('__MOD49_ONLY_SLOT');
        localStorage.removeItem('__MOD49_TEX_ID');
        location.reload();
    };
} catch {
}


const readMod49Material = (rec: number, groupIndex: number = -1) => {
  
    const raw0 = data.getUint16(rec + 0x00, false);
    const raw2 = data.getUint16(rec + 0x02, false);
    const raw12 = data.getUint16(rec + 0x12, false);

    const matKey = ((raw0 << 16) | raw2) >>> 0;

    const materialSlot = (raw12 >>> 8) & 0xff;
    const materialRawKey = `${hex4(raw0)}_${hex4(raw2)}`;
    const materialFullKey = `${materialRawKey}_${hex2(materialSlot)}`;

const blockGroupKey = `${blockNum}:${groupIndex}`;
const groupMaterialBehavior = MOD49_DBAY_GROUP_MATERIALS.get(blockGroupKey);
const forcedTex =
    Number.isFinite(FORCE_TEX_ID) ? (FORCE_TEX_ID | 0) : undefined;

const cleanTex = (v: number | undefined): number | undefined => {
    if (v === undefined)
        return undefined;
    if (v <= 0)
        return undefined;
    return v;
};

const manualBlockGroupTex = cleanTex(
    MOD49_BLOCKGROUP_TO_DP_TEX.get(blockGroupKey),
);

const hardcodedBlockGroupTex = cleanTex(
    MOD49_HARDCODED_GROUP_TO_DP_TEX.get(blockGroupKey),
);

const behaviorTex = cleanTex(groupMaterialBehavior?.texId);

const MOD49_USE_FULLKEY_FALLBACK = false;
const MOD49_USE_SLOT_FALLBACK = false;
const MOD49_USE_AUTOLEARN = false;

const fullKeyTex = MOD49_USE_FULLKEY_FALLBACK
    ? MOD49_FULLKEY_TO_DP_TEX.get(materialFullKey)
    : undefined;

const slotTex = MOD49_USE_SLOT_FALLBACK
    ? MOD49_SLOT_TO_DP_TEX.get(materialSlot)
    : undefined;

const autoLearnTex =
    manualBlockGroupTex !== undefined ? manualBlockGroupTex :
    hardcodedBlockGroupTex !== undefined ? hardcodedBlockGroupTex :
    undefined;

if (MOD49_USE_AUTOLEARN && forcedTex === undefined && autoLearnTex !== undefined) {
    if (!MOD49_FULLKEY_TO_DP_TEX.has(materialFullKey)) {
        MOD49_FULLKEY_TO_DP_TEX.set(materialFullKey, autoLearnTex);
        saveStringMapToLocalStorage('__MOD49_FULLKEY_TO_DP_TEX', MOD49_FULLKEY_TO_DP_TEX);
    }

    console.warn(
       // `[MOD49 AUTOLEARN] ${blockGroupKey} raw=${materialRawKey} full=${materialFullKey} -> tex ${autoLearnTex}`,
    );
}

const dpTexId =
    forcedTex !== undefined ? forcedTex :
    manualBlockGroupTex !== undefined ? manualBlockGroupTex :
    hardcodedBlockGroupTex !== undefined ? hardcodedBlockGroupTex :
    fullKeyTex !== undefined ? fullKeyTex :
    slotTex !== undefined ? slotTex :
    UNKNOWN_MOD49_TEX;

const mapSource =
    forcedTex !== undefined ? 'FORCED' :
    manualBlockGroupTex !== undefined ? 'MANUAL_BLOCK_GROUP' :
    hardcodedBlockGroupTex !== undefined ? 'HARDCODED_BLOCK_GROUP' :
    fullKeyTex !== undefined ? 'FULL_KEY' :
    slotTex !== undefined ? 'SLOT' :
    'UNKNOWN';


const finalMaterialBehavior =
    groupMaterialBehavior !== undefined
        ? { ...groupMaterialBehavior, texId: dpTexId }
        : undefined;
return {
    raw0,
    raw2,
    raw12,
    matKey,
    materialSlot,
    materialFullKey,
    blockGroupKey,
    dpTexId,
    mapSource,
materialBehavior: finalMaterialBehavior,
};
};

const readGroupTexId = (rec: number, groupIndex: number): number => {
    return readMod49Material(rec, groupIndex).dpTexId;
};



    for (let i = 0; i < Math.min(groupCount, 32); i++) {
        const rec = groupStart + i * 0x18;
        if (rec + 0x18 > data.byteLength)
            break;

    }

    for (let i = 0; i < Math.min(triCount, 64); i++) {
        const rec = triStart + i * 8;
        if (rec + 8 > data.byteLength)
            break;

    }

    for (let i = 0; i < Math.min(vertexCount, 32); i++) {
        const rec = vtxStart + i * vertexRecordSize;
        if (rec + vertexRecordSize > data.byteLength)
            break;


    }

type Mod49Group = {
    index: number;
    vtxBase: number;
    triBase: number;

    raw0: number;
    raw2: number;
    raw12: number;
    matKey: number;

    materialSlot: number;
    materialFullKey: string;
    mapSource: string;

    dpTexId: number;
    materialBehavior?: Mod49DbayGroupMaterial;
};

const groups: Mod49Group[] = [];

for (let i = 0; i < groupCount; i++) {
    const rec = groupStart + i * 0x18;

    if (rec + 0x18 > data.byteLength)
        break;

    const vtxBase = data.getUint16(rec + 0x04, false);
    const triBase = data.getUint16(rec + 0x06, false);

    const mat = readMod49Material(rec, i);

    if (vtxBase <= vertexCount && triBase <= triCount) {
groups.push({
    index: i,
    vtxBase,
    triBase,

    raw0: mat.raw0,
    raw2: mat.raw2,
    raw12: mat.raw12,
    matKey: mat.matKey,

    materialSlot: mat.materialSlot,
    materialFullKey: mat.materialFullKey,
    mapSource: mat.mapSource,

        dpTexId: mat.dpTexId,
    materialBehavior: mat.materialBehavior,
});
    }
}

    groups.sort((a, b) => a.triBase - b.triBase);
const groupDebug = groups.map((g, n) => ({
    block: blockNum,
    group: g.index,
    rawKey: `${hex4(g.raw0)}_${hex4(g.raw2)}`,
    fullKey: g.materialFullKey,
    slot: g.materialSlot,
    tex: g.dpTexId,
    source: g.mapSource,
    vtxBase: g.vtxBase,
    triBase: g.triBase,
    triEnd: n + 1 < groups.length ? groups[n + 1].triBase : triCount,
    triCount: (n + 1 < groups.length ? groups[n + 1].triBase : triCount) - g.triBase,
}));

try {
    const w = window as any;
    if (!w.__MOD49_SEEN_BLOCKS)
        w.__MOD49_SEEN_BLOCKS = new Map<number, any>();

    w.__MOD49_SEEN_BLOCKS.set(blockNum, {
        blockNum,
        groupCount,
        vertexCount,
        triCount,
        groups: groupDebug,
    });
} catch {
}

//console.warn(`[MOD49 GROUPS block=${blockNum} count=${groupCount}]`, groupDebug);
    const outVertexCount = triCount * 3;

    const posDV = new DataView(new ArrayBuffer(outVertexCount * 6));
    const clrDV = new DataView(new ArrayBuffer(outVertexCount * 4));
    const texDV = new DataView(new ArrayBuffer(outVertexCount * 4));
    const tex1DV = new DataView(new ArrayBuffer(outVertexCount * 4));

type Bucket = {
    raw0: number;
    raw2: number;
    raw12: number;
    matKey: number;

    materialSlot: number;
    materialFullKey: string;
    mapSource: string;

    dpTexId: number;
    materialBehavior?: Mod49DbayGroupMaterial;

    bytes: number[];
    vtxCount: number;
    triCount: number;
    groupIndices: Set<number>;
};

const mod49BucketLooksTranslucent = (bucket: Bucket): boolean => {
    if (mod49IsScrollingWater(bucket.dpTexId))
        return true;

    if (MOD49_FORCE_TRANSLUCENT_TEXIDS.has(bucket.dpTexId))
        return true;

    // MOD49 / DP blend-water material families.
    if ((bucket.raw0 & 0x2000) !== 0)
        return true;

    if (
        bucket.raw2 === 0x280e ||
        bucket.raw2 === 0x280f ||
        bucket.raw2 === 0x2c0f ||
        bucket.raw2 === 0x0c0f ||
        bucket.raw2 === 0x8c0f ||
        bucket.raw2 === 0x8e0b
    )
        return true;

    return false;
};

const mod49AlphaForBucket = (bucket: Bucket): number => {
    if (!mod49BucketLooksTranslucent(bucket))
        return 255;

    if (MOD49_LIGHTBEAM_TEXIDS.has(bucket.dpTexId))
        return 72;

    return 128;
};

const buckets = new Map<number, Bucket>();

const getBucket = (group: Mod49Group | undefined): Bucket => {
    const key = group ? group.index : -1;

    let b = buckets.get(key);

    if (!b) {
        b = {
            raw0: group?.raw0 ?? 0,
            raw2: group?.raw2 ?? 0,
            raw12: group?.raw12 ?? 0,
matKey: group?.matKey ?? 0,

materialSlot: group?.materialSlot ?? -1,
materialFullKey: group?.materialFullKey ?? 'none',
mapSource: group?.mapSource ?? 'none',

dpTexId: group?.dpTexId ?? DBAY_TEX_IDS[0],
materialBehavior: group?.materialBehavior,
            bytes: [0x90, 0x00, 0x00],
            vtxCount: 0,
            triCount: 0,
            groupIndices: new Set<number>(),
        };

        buckets.set(key, b);
    }

    return b;
};

    let outIdx = 0;
    let goodTris = 0;
    let groupIdx = 0;

    for (let i = 0; i < triCount; i++) {
        const rec = triStart + i * 8;

        if (rec + 8 > data.byteLength)
            break;

        while (
            groupIdx + 1 < groups.length &&
            i >= groups[groupIdx + 1].triBase
        ) {
            groupIdx++;
        }

const group = groups[groupIdx];
const vtxBase = group !== undefined ? group.vtxBase : 0;

if (Number.isFinite(ONLY_BLOCK) && blockNum !== (ONLY_BLOCK | 0))
    continue;

if (Number.isFinite(ONLY_GROUP) && ((group?.index ?? -1) !== (ONLY_GROUP | 0)))
    continue;

if (Number.isFinite(ONLY_SLOT) && ((group?.materialSlot ?? -1) !== (ONLY_SLOT | 0)))
    continue;

const bucket = getBucket(group);
if (group)
    bucket.groupIndices.add(group.index);

        const ia = vtxBase + data.getUint8(rec + 1);
        const ib = vtxBase + data.getUint8(rec + 2);
        const ic = vtxBase + data.getUint8(rec + 3);

        if (ia >= vertexCount || ib >= vertexCount || ic >= vertexCount)
            continue;

        const idxs = [ia, ib, ic];

        for (let k = 0; k < 3; k++) {
            const src = vtxStart + idxs[k] * vertexRecordSize;

            const x = data.getInt16(src + 0, false);
            const y = data.getInt16(src + 2, false);
            const z = data.getInt16(src + 4, false);

            posDV.setInt16(outIdx * 6 + 0, x, false);
            posDV.setInt16(outIdx * 6 + 2, y, false);
            posDV.setInt16(outIdx * 6 + 4, z, false);

const forcedAlpha = mod49AlphaForBucket(bucket);

clrDV.setUint8(outIdx * 4 + 0, data.getUint8(src + 0x0C));
clrDV.setUint8(outIdx * 4 + 1, data.getUint8(src + 0x0D));
clrDV.setUint8(outIdx * 4 + 2, data.getUint8(src + 0x0E));
clrDV.setUint8(outIdx * 4 + 3, forcedAlpha);
         
const useVertexUV = true;

if (useVertexUV) {
    const rawS = data.getInt16(src + 0x08, false);
    const rawT = data.getInt16(src + 0x0A, false);

const uvMul = getMod49UVMul(bucket.dpTexId);
const blendTexForUV = bucket.materialBehavior?.blendTexId ?? bucket.dpTexId;
const uvMul1 = getMod49UVMul(blendTexForUV);

texDV.setInt16(
    outIdx * 4 + 0,
    Math.round(rawS * uvMul),
    false,
);

texDV.setInt16(
    outIdx * 4 + 2,
    Math.round(rawT * uvMul),
    false,
);

tex1DV.setInt16(
    outIdx * 4 + 0,
    Math.round(rawS * uvMul1),
    false,
);

tex1DV.setInt16(
    outIdx * 4 + 2,
    Math.round(rawT * uvMul1),
    false,
);
} else {
const uvScale = getMod49UVScale(bucket.dpTexId);
const blendTexForUV = bucket.materialBehavior?.blendTexId ?? bucket.dpTexId;
const uvScale1 = getMod49UVScale(blendTexForUV);

texDV.setInt16(outIdx * 4 + 0, Math.round((x * 1024) / uvScale), false);
texDV.setInt16(outIdx * 4 + 2, Math.round((z * 1024) / uvScale), false);

tex1DV.setInt16(outIdx * 4 + 0, Math.round((x * 1024) / uvScale1), false);
tex1DV.setInt16(outIdx * 4 + 2, Math.round((z * 1024) / uvScale1), false);
}

bucket.bytes.push((outIdx >>> 8) & 0xFF, outIdx & 0xFF); // POS
bucket.bytes.push((outIdx >>> 8) & 0xFF, outIdx & 0xFF); // CLR0
bucket.bytes.push((outIdx >>> 8) & 0xFF, outIdx & 0xFF); // TEX0
bucket.bytes.push((outIdx >>> 8) & 0xFF, outIdx & 0xFF); // TEX1

            bucket.vtxCount++;
            outIdx++;
        }

        bucket.triCount++;
        goodTris++;
    }

    for (const bucket of buckets.values()) {
        bucket.bytes[1] = (bucket.vtxCount >>> 8) & 0xFF;
        bucket.bytes[2] = bucket.vtxCount & 0xFF;
    }



(model as any).debugMaterialInfo = [...buckets.values()].map((b, index) => ({
    index,

    texId: b.dpTexId,
    texIds: [b.dpTexId],

    mod49MatKey: `0x${b.matKey.toString(16).padStart(8, '0')}`,
    raw0: `0x${b.raw0.toString(16).padStart(4, '0')}`,
    raw2: `0x${b.raw2.toString(16).padStart(4, '0')}`,
    raw12: `0x${b.raw12.toString(16).padStart(4, '0')}`,

    triCount: b.triCount,
    vtxCount: b.vtxCount,
    groups: [...b.groupIndices],
}));

const makeMaterial = (bucket: Bucket): SFAMaterial => {
const behavior = bucket.materialBehavior;
const primaryTexId = bucket.dpTexId;
const blendTexId = behavior?.blendTexId;

    const showAsSolid =
        bucket.mapSource === 'UNKNOWN' &&
        MOD49_SHOW_UNMAPPED_AS_SOLID &&
        behavior === undefined;

    if (showAsSolid) {
        const seed = ((bucket.materialSlot + 1) * 1103515245 + bucket.matKey) >>> 0;

        const r = 0.35 + (((seed >>> 16) & 0xff) / 255) * 0.65;
        const g = 0.35 + (((seed >>>  8) & 0xff) / 255) * 0.65;
        const b = 0.35 + (((seed >>>  0) & 0xff) / 255) * 0.65;

        const shader: Shader = {
            layers: [],
            flags: ShaderFlags.Fog,
            attrFlags: 0 as any,
            forceOpaqueNoAlphaTest: true,
            hasHemisphericProbe: false,
            hasReflectiveProbe: false,
            reflectiveProbeMaskTexId: null,
            reflectiveProbeIdx: 0,
            reflectiveAmbFactor: 0,
            hasNBTTexture: false,
            nbtTexId: null,
            nbtParams: 0,
            furRegionsTexId: null,
            color: colorNewFromRGBA(r, g, b, 1),
            normalFlags: 0 as any,
            lightFlags: LightFlags.OverrideLighting,
            texMtxCount: 0,
        };

        return materialFactory.buildMapMaterial(shader, texFetcher);
    }

    const isCutout =
        !!behavior?.cutout ||
        MOD49_CUTOUT_TEXIDS.has(primaryTexId);

    const isWater =
        !!behavior?.water ||
        mod49IsScrollingWater(primaryTexId) ||
        (blendTexId !== undefined && mod49IsScrollingWater(blendTexId));

const isTranslucent =
    !!behavior?.translucent ||
    !!behavior?.lightbeam ||
    isWater ||
    blendTexId !== undefined ||
    mod49BucketLooksTranslucent(bucket);

    const layers: any[] = [];

    const layer0: any = {
        texId: primaryTexId,
        tevMode: 0,
        enableScroll: 0,
    };
    mod49ApplyLayerScroll(layer0, primaryTexId);
    layers.push(layer0);

    if (blendTexId !== undefined) {
        const layer1: any = {
            texId: blendTexId,
            tevMode: 0,
            enableScroll: 0,
        };
        mod49ApplyLayerScroll(layer1, blendTexId);
        layers.push(layer1);
    }

    let shaderFlags = ShaderFlags.Fog;

    if (isCutout)
        shaderFlags |= ShaderFlags.AlphaCompare;

    if (isTranslucent)
        shaderFlags |= 0x40000000;

    const attrFlags =
        ShaderAttrFlags.CLR |
        (ShaderAttrFlags as any).TEX0 |
        (blendTexId !== undefined ? (ShaderAttrFlags as any).TEX1 : 0);

    const alpha =
        behavior?.alpha ??
        (behavior?.lightbeam ? 0.45 :
         isWater ? 0.58 :
         isTranslucent ? 0.72 :
         1.0);

    const shader: Shader = {
        layers,
        flags: shaderFlags,
        attrFlags,
        forceOpaqueNoAlphaTest: !isCutout && !isTranslucent,
        hasHemisphericProbe: false,
        hasReflectiveProbe: false,
        reflectiveProbeMaskTexId: null,
        reflectiveProbeIdx: 0,
        reflectiveAmbFactor: 0,
        hasNBTTexture: false,
        nbtTexId: null,
        nbtParams: 0,
        furRegionsTexId: null,
        color: colorNewFromRGBA(1, 1, 1, alpha),
        normalFlags: NormalFlags.HasVertexColor | (isTranslucent || isCutout ? NormalFlags.HasVertexAlpha : 0),
        lightFlags: LightFlags.OverrideLighting,
        texMtxCount: 0,
    };

    return materialFactory.buildMapMaterial(shader, texFetcher);
};

const vcd: GX_VtxDesc[] = nArray(GX.Attr.MAX + 1, () => ({ type: GX.AttrType.NONE }));
vcd[GX.Attr.POS]  = { type: GX.AttrType.INDEX16 };
vcd[GX.Attr.CLR0] = { type: GX.AttrType.INDEX16 };
vcd[GX.Attr.TEX0] = { type: GX.AttrType.INDEX16 };
vcd[GX.Attr.TEX1] = { type: GX.AttrType.INDEX16 };
const vat = makeMod49Vat();
    const vtxArrays: GX_Array[] = [];
    vtxArrays[GX.Attr.POS] = {
        buffer: ArrayBufferSlice.fromView(posDV),
        offs: 0,
        stride: 6,
    };
vtxArrays[GX.Attr.CLR0] = {
    buffer: ArrayBufferSlice.fromView(clrDV),
    offs: 0,
    stride: 4,
};

vtxArrays[GX.Attr.TEX0] = {
    buffer: ArrayBufferSlice.fromView(texDV),
    offs: 0,
    stride: 4,
};
vtxArrays[GX.Attr.TEX1] = {
    buffer: ArrayBufferSlice.fromView(tex1DV),
    offs: 0,
    stride: 4,
};
model.originalPosBuffer = posDV;

    model.createModelShapes = () => {
        const modelShapes = new ModelShapes(model, posDV);
        modelShapes.shapes[0] = [];
        modelShapes.shapes[1] = [];
        modelShapes.shapes[2] = [];

        for (const bucket of buckets.values()) {
            if (bucket.vtxCount <= 0)
                continue;

            const usedDL = new DataView(Uint8Array.from(bucket.bytes).buffer);
            const geom = new ShapeGeometry(vtxArrays, vcd, vat, usedDL, false);
            geom.setPnMatrixMap(nArray(10, () => 0), false, false);

            const material = makeMaterial(bucket);

            const targetList = mod49TargetListForBucket(bucket);

            modelShapes.shapes[targetList].push(
                new Shape(geom, new ShapeMaterial(material), false),
            );
        }

        return modelShapes;
    };

    model.sharedModelShapes = model.createModelShapes();

    return model;
}


function makeMod49Vat(): GX_VtxAttrFmt[][] {
  const vat: GX_VtxAttrFmt[][] = nArray(8, () =>
    nArray(GX.Attr.MAX + 1, () => ({
      compType: GX.CompType.U8,
      compShift: 0,
      compCnt: 0,
    } as GX_VtxAttrFmt)),
  );

  vat[0][GX.Attr.POS] = {
    compType: GX.CompType.S16,
    compShift: 0,
    compCnt: GX.CompCnt.POS_XYZ,
  };

  vat[0][GX.Attr.CLR0] = {
    compType: GX.CompType.RGBA8,
    compShift: 0,
    compCnt: GX.CompCnt.CLR_RGBA,
  };

  vat[0][GX.Attr.TEX0] = {
    compType: GX.CompType.S16,
    compShift: 10,
    compCnt: GX.CompCnt.TEX_ST,
  };

  vat[0][GX.Attr.TEX1] = {
    compType: GX.CompType.S16,
    compShift: 10,
    compCnt: GX.CompCnt.TEX_ST,
  };

  return vat;
}