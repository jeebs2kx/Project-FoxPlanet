// ===================== DP MINIMAP =====================

interface DPMinimapSection {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    minY: number;
    maxY: number;
    screenOffsetX: number;
    screenOffsetY: number;

    // Support either naming style so the file compiles even if your local data
    // was written with a different property name.
    texTableID?: number;
    texTableId?: number;
    textableID?: number;
}

interface DPMinimapLevel {
    mapID: number;
    tiles: DPMinimapSection[];
}

const dpMMs16 = (v: number): number => (v << 16) >> 16;

function dpMM(
    minX: number, maxX: number,
    minZ: number, maxZ: number,
    minY: number, maxY: number,
    screenOffsetX: number, screenOffsetY: number,
    tex0ID: number,
): DPMinimapSection {
    return {
        minX: dpMMs16(minX),
        maxX: dpMMs16(maxX),
        minZ: dpMMs16(minZ),
        maxZ: dpMMs16(maxZ),
        minY: dpMMs16(minY),
        maxY: dpMMs16(maxY),
        screenOffsetX,
        screenOffsetY,
        texTableID: tex0ID,
    };
}

const DP_MINIMAP_TILES_VFPT: DPMinimapSection[] = [
    dpMM(0xce00,0xd080,0xf300,0xfd80,0x8000,0xfb1e, 0, 0, 912),
    dpMM(0xcb80,0xce00,0xf380,0xfd80,0x8000,0xfb1e, 0, 0, 912),
    dpMM(0xc180,0xcb80,0xf600,0x0000,0x8000,0xfb1e, 0, 0, 913),
    dpMM(0xc680,0xd080,0xf100,0xf600,0x8000,0xfb1e, 0, 0, 914),
    dpMM(0xc900,0xd080,0xf600,0x0000,0xfb1e,0x7fff, 0, 0, 915),
    dpMM(0xc400,0xc900,0xf880,0xfd80,0xfb1e,0x7fff, 0, 0, 916),
    dpMM(0xbf00,0xc400,0xf600,0x0000,0xfb1e,0x7fff, 0, 0, 917),
];

const DP_MINIMAP_TILES_DIM_EXTERIOR: DPMinimapSection[] = [
    dpMM(0xe420,0xe700,0x0c80,0x1180,0x8000,0xfb1e,  0, 0, 922),
    dpMM(0xdf80,0xe240,0x0f00,0x1180,0xfa83,0xfb14,  0, 0, 923),
    dpMM(0xdf80,0xe480,0x0c80,0x1180,0x8000,0xfa88,  0, 0, 924),
    dpMM(0xdf80,0xe3c0,0x0780,0x1400,0x8000,0x7fff,  0, 0, 918),
    dpMM(0xe3c0,0xe700,0x0780,0x1338,0x8000,0x7fff,  0, 0, 918),
    dpMM(0xda80,0xe200,0x1ac0,0x1b80,0x8000,0x7fff,-16, 0, 920),
    dpMM(0xde40,0xe0c0,0x1a40,0x1b80,0x8000,0x7fff,-16, 0, 920),
    dpMM(0xda80,0xdf80,0x1900,0x1b80,0x8000,0x7fff,-16, 0, 920),
    dpMM(0xda80,0xdd00,0x1900,0x1d80,0x8000,0x7fff,-16, 0, 920),
    dpMM(0xda80,0xe200,0x1900,0x1a40,0x8000,0xfb6e,-16, 0, 920),
    dpMM(0xe080,0xe200,0x1900,0x1b00,0x8000,0xfb96,-16, 0, 920),
    dpMM(0xe200,0xe700,0x1b13,0x1e00,0x8000,0x7fff,  0, 0, 921),
    dpMM(0xdf80,0xe980,0x1180,0x1e00,0x8000,0x7fff,  0, 5, 919),
];

const DP_MINIMAP_TILES_DIM_INTERIOR: DPMinimapSection[] = [
    dpMM(0xda80,0xdd40,0x1680,0x1940,0xf736,0x7fff, 0, 0, 926),
    dpMM(0xda80,0xdf80,0x1400,0x1bc0,0xf736,0x7fff,-1, 9, 927),
    dpMM(0xdf80,0xe700,0x1400,0x2080,0xf736,0x7fff, 0, 0, 928),
    dpMM(0xdf08,0xe688,0x1400,0x1b80,0x8000,0xf736, 3, 0, 931),
    dpMM(0xda80,0xe200,0x1180,0x1b80,0x8000,0xf736, 0, 0, 929),
    dpMM(0xe200,0xe980,0x1180,0x1b80,0x8000,0xf736, 0, 0, 930),
];

const DP_MINIMAP_TILES_GALADON: DPMinimapSection[] = [
    dpMM(0xdf80,0xe480,0x1b80,0x2080,0x8000,0x7fff, 0, 0, 925),
];

const DP_MINIMAP_TILES_SW: DPMinimapSection[] = [
    dpMM(0xe200,0xec00,0xfd80,0x0780,0x8000,0x7fff, 0, 0, 932),
    dpMM(0xee80,0xf380,0xfd80,0x0280,0x8000,0x7fff, 0, 0, 934),
    dpMM(0xec00,0xf100,0xfd80,0x0780,0x8000,0x7fff, 0, 0, 933),
    dpMM(0xf380,0xf880,0xfd80,0x0780,0x8000,0x7fff, 0, 0, 935),
    dpMM(0xe700,0xee80,0x0780,0x1180,0x8000,0x7fff, 0, 0, 936),
];

const DP_MINIMAP_TILES_IM_HOT_SPRING_A: DPMinimapSection[] = [
    dpMM(0xf380,0xf880,0xfd80,0x0780,0x8000,0x7fff, 0, 0, 935),
];

const DP_MINIMAP_TILES_IM_HOT_SPRING_B: DPMinimapSection[] = [
    dpMM(0xf380,0xf880,0xfd80,0x0780,0x8000,0x7fff, 0, 0, 935),
];

const DP_MINIMAP_TILES_CRF: DPMinimapSection[] = [
    dpMM(0xc900,0xd1f4,0x4380,0x4d80,0x07d0,0x7fff, 0, 0, 939),
    dpMM(0xd080,0xd800,0x4380,0x4d80,0x0708,0x7fff, 0, 0, 940),
    dpMM(0xd580,0xdd00,0x4380,0x4d80,0x8000,0x0708, 0, 0, 941),
    dpMM(0xcb80,0xd080,0x4600,0x4d80,0x8000,0x07d0, 0, 0, 937),
    dpMM(0xd080,0xd580,0x4b00,0x5000,0x8000,0x0708, 0, 0, 938),
];

const DP_MINIMAP_TILES_SC: DPMinimapSection[] = [
    dpMM(0xf880,0x0000,0x3c00,0x4880,0x8000,0x7fff, 0, 0, 942),
    dpMM(0x0000,0x0500,0x4380,0x4880,0x8000,0x7fff, 0, 0, 944),
    dpMM(0x0000,0x0500,0x4100,0x4880,0x8000,0x7fff, 0, 0, 943),
];

const DP_MINIMAP_TILES_SH: DPMinimapSection[] = [
    dpMM(0xdd00,0xe480,0xf100,0xf880,0x8000,0x7fff, 0, 0, 945),
    dpMM(0xdd00,0xe480,0xf880,0x0000,0x8000,0x7fff, 0, 0, 947),
    dpMM(0xe480,0xee80,0xfa80,0xfd80,0x8000,0xfd94, 0, 0, 948),
    dpMM(0xe840,0xee80,0xf380,0xfd80,0x8000,0xfd76, 0, 0, 948),
    dpMM(0xe480,0xec00,0xf100,0xfd80,0x8000,0x7fff, 0, 0, 946),
];

const DP_MINIMAP_TILES_SH_WELL: DPMinimapSection[] = [
    dpMM(0xdf80,0xe200,0xf880,0xfb00,0x8000,0x7fff, 0, 0, 949),
    dpMM(0xdf80,0xe480,0xf600,0xfb00,0xfc36,0x7fff, 0, 0, 949),
    dpMM(0xdf80,0xe480,0xf600,0x0000,0x8000,0x7fff, 0, 0, 950),
];

const DP_MINIMAP_TILES_DF: DPMinimapSection[] = [
    dpMM(0xf600,0xf880,0x4100,0x4380,0x00a0,0x7fff, 0, 0, 956),
    dpMM(0xf600,0xf880,0x4100,0x4380,0x8000,0x00a0, 0, 0, 954),
    dpMM(0xee80,0xf600,0x4380,0x4600,0x8000,0x01e0, 0, 0, 952),
    dpMM(0xef27,0xf600,0x4380,0x4600,0x01e0,0x7fff, 0, 0, 952),
    dpMM(0xf100,0xf600,0x4100,0x4380,0x8000,0x7fff, 0, 0, 952),
    dpMM(0xee80,0xf600,0x4600,0x4d80,0x8000,0x7fff, 0, 0, 952),
    dpMM(0xe980,0xf380,0x3e80,0x4600,0x8000,0x7fff, 0, 0, 951),
    dpMM(0xf600,0xf880,0x4600,0x4d80,0x8000,0x7fff, 0, 0, 953),
    dpMM(0xf600,0xf880,0x4380,0x4600,0x8000,0x7fff, 0, 0, 955),
];

const DP_MINIMAP_TILES_CRF_TRACK: DPMinimapSection[] = [
    dpMM(0xc900,0xd080,0x4380,0x5000,0x8000,0x7fff, 0, 0, 957),
    dpMM(0xc180,0xc900,0x4380,0x5000,0x8000,0x7fff, 0, 0, 958),
];

const DP_MINIMAP_TILES_DR_TOP: DPMinimapSection[] = [
    dpMM(0xee80,0xf600,0xdd00,0xe200,0x8000,0x7fff, 0, 0, 959),
    dpMM(0xee80,0xfb00,0xe200,0xe700,0x8000,0x7fff, 0, 0, 960),
    dpMM(0xfb00,0x0500,0xe200,0xe700,0x8000,0x7fff, 0, 0, 961),
    dpMM(0xee80,0xfb00,0xe700,0xf100,0x8000,0x7fff, 0, 0, 962),
    dpMM(0xfb00,0x0500,0xe700,0xee80,0x8000,0x7fff, 0, 0, 963),
];

const DP_MINIMAP_TILES_DR_BOTTOM: DPMinimapSection[] = [
    dpMM(0xf880,0xfd80,0xe480,0xe688,0xf9ca,0x7fff, 0,-3, 966),
    dpMM(0xf600,0xfd80,0xdf80,0xec00,0x8000,0x7fff, 0, 0, 964),
    dpMM(0xfd80,0x0a00,0xe480,0xec00,0x8000,0x7fff, 0, 0, 965),
];

const DP_MINIMAP_TILES_GP: DPMinimapSection[] = [
    dpMM(0xfb00,0x0000,0x3200,0x3700,0x8000,0xfeb6, 0, 0, 970),
    dpMM(0xfb00,0x0000,0x3200,0x3500,0x8000,0x014a, 0, 0, 970),
    dpMM(0xf880,0xfd80,0x2f80,0x3c00,0x8000,0x7fff, 0, 0, 967),
    dpMM(0xfd80,0x0500,0x2f80,0x3c00,0x8000,0x7fff, 0, 0, 968),
    dpMM(0x0280,0x0780,0x2a80,0x3200,0x8000,0x7fff, 0, 0, 969),
];

const DP_MINIMAP_TILES_BWC: DPMinimapSection[] = [
    dpMM(0x0000,0x0500,0x4880,0x4d80,0x000a,0x7fff, 0, 0, 971),
    dpMM(0x0000,0x0280,0x4880,0x4d80,0x8000,0x7fff, 0, 0, 971),
    dpMM(0xfd80,0x0500,0x4880,0x5000,0x8000,0x7fff, 0, 0, 972),
    dpMM(0xec00,0xf380,0x4d80,0x5280,0x8000,0x7fff, 0, 0, 978),
    dpMM(0xec00,0xf880,0x4d80,0x5280,0x8000,0xff9c, 0, 0, 978),
    dpMM(0xf380,0xfd80,0x4880,0x5280,0x8000,0x7fff, 0, 0, 973),
    dpMM(0xfd80,0x0500,0x5000,0x5a00,0x8000,0x7fff, 0, 0, 974),
    dpMM(0xf880,0xfd80,0x5280,0x5780,0x8000,0x7fff, 0, 0, 975),
    dpMM(0xf380,0xfd80,0x5280,0x5500,0x8000,0x008c, 0, 0, 975),
    dpMM(0xf100,0xfd80,0x5500,0x5780,0x8000,0x0000, 0, 0, 975),
    dpMM(0xf100,0xf880,0x5280,0x5a00,0x8000,0x7fff, 0, 0, 976),
    dpMM(0xec00,0xf100,0x5280,0x5780,0x8000,0x7fff, 0, 0, 977),
];

const DP_MINIMAP_TILES_KP: DPMinimapSection[] = [
    dpMM(0x1180,0x1e00,0x5780,0x5f00,0x8000,0x0384, 0, 0, 979),
    dpMM(0x1180,0x1b80,0x5000,0x5780,0x8000,0x0190, 0, 0, 980),
    dpMM(0x1e00,0x2300,0x5000,0x5a00,0x8000,0x0190, 0, 0, 981),
    dpMM(0x1e00,0x2580,0x5000,0x5780,0x8000,0x0190, 0, 0, 981),
    dpMM(0x1180,0x1b80,0x5f00,0x6680,0x8000,0x0190, 0, 0, 982),
    dpMM(0x1e00,0x2580,0x5c80,0x6680,0x8000,0x0190, 0, 0, 983),
    dpMM(0x2300,0x2a80,0x5780,0x5c80,0x8000,0x7fff, 0, 0, 984),
    dpMM(0x0f00,0x1400,0x5780,0x5f00,0x8000,0x7fff, 0, 0, 985),
];

const DP_MINIMAP_TILES_WG: DPMinimapSection[] = [
    dpMM(0xec00,0xf100,0xee80,0xf380,0xfd1c,0x7fff, 0,   0, 986),
    dpMM(0xe980,0xf100,0xee80,0xf380,0xfc7c,0x7fff, 0,   0, 987),
    dpMM(0xe980,0xf100,0xee80,0xf380,0xfbb4,0x7fff, 0,   0, 988),
    dpMM(0xec00,0xf100,0xee80,0xf1c8,0x8000,0xface, 0, -11, 990),
    dpMM(0xec00,0xf100,0xf600,0xf880,0x8000,0xface, 0,   0, 991),
    dpMM(0xe980,0xf100,0xee80,0xf880,0x8000,0x7fff, 0,   0, 989),
];

const DP_MINIMAP_TILES_DFPT_TOP: DPMinimapSection[] = [
    dpMM(0x0280,0x0780,0x2300,0x2a80,0x8000,0x7fff, 0, 0, 992),
];

const DP_MINIMAP_TILES_DFPT_BOTTOM: DPMinimapSection[] = [
    dpMM(0xfb00,0x0a00,0x2080,0x2800,0x8000,0x7fff, 0, 0, 993),
    dpMM(0xfd80,0x0780,0x2800,0x2a80,0x8000,0x7fff, 0, 0, 994),
];

const DP_MINIMAP_TILES_WC: DPMinimapSection[] = [
    dpMM(0xdf9a,0xe1e7,0xe200,0xe480,0xfc3b,0xfd8a, 0, 0, 998),
    dpMM(0xdeed,0xe294,0xe200,0xe480,0xfc3b,0xfcf4, 0, 0, 998),
    dpMM(0xdd00,0xe480,0xe200,0xe480,0xfc3b,0xfc90, 0, 0, 998),
    dpMM(0xdd00,0xdd80,0xe480,0xe594,0xfc3b,0xfd0d, 0, 0, 998),
    dpMM(0xe400,0xe480,0xe0ed,0xe200,0xfc3b,0xfd0d, 0, 0, 998),
    dpMM(0xd800,0xd940,0xdec0,0xe040,0x8000,0xfc72, 0, 0, 995),
    dpMM(0xd580,0xda80,0xdd00,0xe480,0x8000,0xfc04, 0, 0, 995),
    dpMM(0xe840,0xe900,0xe640,0xe7c0,0x8000,0xfc72, 0, 0, 997),
    dpMM(0xe700,0xec00,0xe200,0xe980,0x8000,0xfc04, 0, 0, 997),
    dpMM(0xdd00,0xe480,0xe700,0xf100,0xfc90,0x7fff, 0, 0, 1002),
    dpMM(0xdd00,0xe480,0xdf80,0xe700,0xfc90,0x7fff, 0, 0, 1003),
    dpMM(0xdf80,0xe200,0xdd00,0xdf80,0xfc90,0x7fff, 0, 0, 1003),
    dpMM(0xd580,0xda80,0xdd00,0xe480,0xfc04,0x7fff, 0, 0, 1004),
    dpMM(0xda80,0xdd00,0xe2c0,0xe3c0,0xfc86,0xfd12, 0, 0, 1004),
    dpMM(0xe700,0xec00,0xe200,0xe980,0xfc04,0x7fff, 0, 0, 1005),
    dpMM(0xe480,0xe700,0xe200,0xe480,0xfc04,0x7fff, 0, 0, 1005),
    dpMM(0xdf80,0xe200,0xdf80,0xe480,0x8000,0x7fff, 0, 0, 996),
    dpMM(0xe480,0xe980,0xdd00,0xe980,0x8000,0x7fff, 0, 0, 999),
    dpMM(0xda80,0xe480,0xda80,0xdf80,0x8000,0x7fff, 0, 0, 1000),
    dpMM(0xd800,0xdd00,0xdf80,0xe980,0x8000,0x7fff, 0, 0, 1001),
];

const DP_MINIMAP_TILES_DB: DPMinimapSection[] = [
    dpMM(0xd080,0xd2e0,0xf100,0xf380,0x8000,0xfa4c, 0, 0, 1038),
    dpMM(0xd080,0xd300,0xf380,0xf880,0x8000,0x7fff, 0, 0, 1038),
    dpMM(0xd800,0xdf80,0xf600,0xfd80,0x8000,0x7fff, 0, 0, 1035),
    dpMM(0xd080,0xd800,0xf600,0xfd80,0x8000,0x7fff, 0, 0, 1036),
    dpMM(0xd080,0xda80,0xec00,0xf600,0x8000,0x7fff, 0, 0, 1037),
];

const DP_MINIMAP_TILES_CC: DPMinimapSection[] = [
    dpMM(0x0a00,0x0c80,0x4100,0x4380,0x8000,0xff60, 0, 0, 1008),
    dpMM(0x1400,0x1680,0x4100,0x4600,0x8000,0xff88, 0, 0, 1009),
    dpMM(0x0f00,0x1400,0x4380,0x4600,0x8000,0xffb0, 0, 0, 1010),
    dpMM(0x0d00,0x0f00,0x46c0,0x4880,0x8000,0xff88, 0, 0, 1011),
    dpMM(0x0c80,0x0f00,0x4880,0x4b00,0xff38,0x7fff, 0, 0, 1011),
    dpMM(0x0a00,0x0f00,0x4100,0x4380,0x8000,0x7fff, 0, 0, 1006),
    dpMM(0x0a00,0x0f00,0x3c00,0x4100,0x8000,0x7fff, 0, 0, 1006),
    dpMM(0x0f00,0x1900,0x3c00,0x4380,0x8000,0xff6a, 0, 0, 1007),
    dpMM(0x0c80,0x1900,0x3c00,0x4100,0x8000,0x7fff, 0, 0, 1012),
    dpMM(0x0780,0x0a00,0x3e80,0x4100,0x8000,0x7fff, 0, 0, 1013),
    dpMM(0x0500,0x0c80,0x4100,0x4d80,0x8000,0x7fff, 0, 0, 1014),
    dpMM(0x0c80,0x1400,0x4100,0x4d80,0x8000,0x7fff, 0, 0, 1015),
    dpMM(0x1400,0x1900,0x4100,0x4d80,0x8000,0x7fff, 0, 0, 1016),
];

const DP_MINIMAP_TILES_MMP: DPMinimapSection[] = [
    dpMM(0xe700,0xee80,0x4880,0x4b00,0x8000,0x7fff, 0, 0, 1039),
    dpMM(0xdd00,0xe700,0x4600,0x4b00,0x8000,0x7fff, 0, 0, 1040),
    dpMM(0xdd00,0xe700,0x3c00,0x4600,0x8000,0x7fff, 0, 0, 1041),
    dpMM(0xe200,0xe480,0x3700,0x3c00,0x8000,0x7fff, 0, 0, 1042),
];

const DP_MINIMAP_TILES_IM: DPMinimapSection[] = [
    dpMM(0x0000,0x0280,0x0780,0x0a00,0x8000,0x193c, 0, 0, 1018),
    dpMM(0xfb00,0x0500,0x0500,0x0f00,0x8000,0x7fff, 0, 0, 1017),
    dpMM(0x0500,0x0780,0x0c80,0x1900,0x8000,0x7fff, 0, 0, 1019),
    dpMM(0x0280,0x0500,0x0f00,0x1900,0x8000,0x7fff, 0, 0, 1020),
    dpMM(0x0280,0x0500,0x1680,0x1900,0x8000,0x7fff, 0, 0, 1021),
    dpMM(0xf600,0x0280,0x0f00,0x1680,0x8000,0x7fff, 0, 0, 1022),
    dpMM(0xf380,0xf880,0x0f00,0x1680,0x8000,0x7fff, 0, 0, 1023),
    dpMM(0xf600,0xfd80,0x0780,0x1180,0x8000,0x7fff, 0, 0, 1024),
    dpMM(0xf600,0xfd80,0x0c80,0x1180,0x8000,0x7fff, 0, 0, 1025),
];

const DP_MINIMAP_TILES_WM: DPMinimapSection[] = [
    dpMM(0x3200,0x3700,0x0280,0x0940,0x01ae,0x0316, 0, 0, 1032),
    dpMM(0x3200,0x3480,0x0940,0x0a00,0x01ae,0x0316, 0, 0, 1032),
    dpMM(0x3480,0x3700,0x0280,0x0340,0x02bc,0x0316, 0, 0, 1032),
    dpMM(0x3200,0x3700,0xfd80,0x0500,0x02ee,0x7fff, 0, 0, 1033),
    dpMM(0x3200,0x3700,0x0500,0x0c80,0x0226,0x7fff, 0, 0, 1034),
    dpMM(0x3480,0x3700,0xfd80,0x0280,0x0172,0x7fff, 0, 0, 1031),
    dpMM(0x3200,0x3e80,0x0280,0x0a00,0x8000,0x7fff, 0, 0, 1028),
    dpMM(0x3200,0x3980,0xfd80,0x0500,0x8000,0x7fff, 0, 0, 1026),
    dpMM(0x2a80,0x3200,0x0000,0x0780,0x8000,0x7fff, 0, 0, 1027),
    dpMM(0x2800,0x3200,0x0780,0x1180,0x8000,0x7fff, 0, 0, 1029),
    dpMM(0x3200,0x3e80,0x0a00,0x1180,0x8000,0x7fff, 0, 0, 1030),
];

const DP_MINIMAP_LEVELS: DPMinimapLevel[] = [
    { mapID: 4,  tiles: DP_MINIMAP_TILES_VFPT },
    { mapID: 19, tiles: DP_MINIMAP_TILES_DIM_EXTERIOR },
    { mapID: 46, tiles: DP_MINIMAP_TILES_DIM_EXTERIOR },
    { mapID: 27, tiles: DP_MINIMAP_TILES_DIM_INTERIOR },
    { mapID: 28, tiles: DP_MINIMAP_TILES_GALADON },
    { mapID: 10, tiles: DP_MINIMAP_TILES_SW },
    { mapID: 25, tiles: DP_MINIMAP_TILES_IM_HOT_SPRING_A },
    { mapID: -1, tiles: DP_MINIMAP_TILES_IM_HOT_SPRING_B }, // unused duplicate in decomp
    { mapID: 12, tiles: DP_MINIMAP_TILES_CRF },
    { mapID: 16, tiles: DP_MINIMAP_TILES_CRF },
    { mapID: 15, tiles: DP_MINIMAP_TILES_CRF },
    { mapID: 14, tiles: DP_MINIMAP_TILES_SC },
    { mapID: 7,  tiles: DP_MINIMAP_TILES_SH },
    { mapID: 8,  tiles: DP_MINIMAP_TILES_SH_WELL },
    { mapID: 6,  tiles: DP_MINIMAP_TILES_DF },
    { mapID: 43, tiles: DP_MINIMAP_TILES_CRF_TRACK },
    { mapID: 2,  tiles: DP_MINIMAP_TILES_DR_TOP },
    { mapID: 52, tiles: DP_MINIMAP_TILES_DR_BOTTOM },
    { mapID: 9,  tiles: DP_MINIMAP_TILES_GP },
    { mapID: 38, tiles: DP_MINIMAP_TILES_BWC },
    { mapID: 3,  tiles: DP_MINIMAP_TILES_KP },
    { mapID: 37, tiles: DP_MINIMAP_TILES_WG },
    { mapID: 50, tiles: DP_MINIMAP_TILES_DFPT_TOP },
    { mapID: 21, tiles: DP_MINIMAP_TILES_DFPT_BOTTOM },
    { mapID: 13, tiles: DP_MINIMAP_TILES_WC },
    { mapID: 35, tiles: DP_MINIMAP_TILES_DB },
    { mapID: 29, tiles: DP_MINIMAP_TILES_CC },
    { mapID: 18, tiles: DP_MINIMAP_TILES_MMP },
    { mapID: 11, tiles: DP_MINIMAP_TILES_WM },
    { mapID: 23, tiles: DP_MINIMAP_TILES_IM },
];

function getDPMinimapLevel(mapID: number): DPMinimapLevel | null {
    for (const level of DP_MINIMAP_LEVELS) {
        if (level.mapID === mapID)
            return level;
    }
    return null;
}
function dpMinimapS16(v: number): number {
    return (v << 16) >> 16;
}
function dpGameS16(v: number): number {
    return ((v | 0) << 16) >> 16;
}
function dpClamp01(v: number): number {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}

function dpGetMinimapTexTableID(tile: DPMinimapSection): number {
    const t = tile as any;
    return (t.texTableID ?? t.texTableId ?? t.textableID ?? 0) | 0;
}
const dpMinimapIconCropCache = new WeakMap<any, { sx: number; sy: number; sw: number; sh: number }>();

function dpGetOpaqueImageBounds(surface: any): { sx: number; sy: number; sw: number; sh: number } {
    const cached = dpMinimapIconCropCache.get(surface);
    if (cached)
        return cached;

    const w = (surface?.width ?? 0) | 0;
    const h = (surface?.height ?? 0) | 0;

    if (w <= 0 || h <= 0) {
        const fallback = { sx: 0, sy: 0, sw: 1, sh: 1 };
        dpMinimapIconCropCache.set(surface, fallback);
        return fallback;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(surface, 0, 0);

    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const a = data[i + 3];
            if (a > 8) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    let result: { sx: number; sy: number; sw: number; sh: number };

    if (maxX < minX || maxY < minY) {
        result = { sx: 0, sy: 0, sw: w, sh: h };
    } else {
        result = {
            sx: minX,
            sy: minY,
            sw: Math.max(1, maxX - minX + 1),
            sh: Math.max(1, maxY - minY + 1),
        };
    }

    dpMinimapIconCropCache.set(surface, result);
    return result;
}

function dpFindActiveMinimapTileAtPos(
    level: DPMinimapLevel,
    playerX: number,
    playerY: number,
    playerZ: number,
    ignoreY: boolean = false,
): DPMinimapSection | null {
    for (const tile of level.tiles) {
        const minX = dpMinimapS16(tile.minX);
        const maxX = dpMinimapS16(tile.maxX);
        const minZ = dpMinimapS16(tile.minZ);
        const maxZ = dpMinimapS16(tile.maxZ);
        const minY = dpMinimapS16(tile.minY);
        const maxY = dpMinimapS16(tile.maxY);

        const insideXZ =
            playerX >= minX && playerX < maxX &&
            playerZ >= minZ && playerZ < maxZ;

        if (!insideXZ)
            continue;

        if (ignoreY)
            return tile;

        const insideY = playerY >= minY && playerY < maxY;
        if (insideY)
            return tile;
    }

    return null;
}
function dpResolveActiveMinimapTile(
    level: DPMinimapLevel,
    playerLocalX: number,
    playerLocalY: number,
    playerLocalZ: number,
    numCols: number,
    numRows: number,
): {
    tile: DPMinimapSection;
    playerX: number;
    playerY: number;
    playerZ: number;
    mode: string;
    ignoreY: boolean;
    globalMinX: number;
    globalMaxX: number;
    globalMinZ: number;
    globalMaxZ: number;
} | null {
    let globalMinX = Infinity;
    let globalMaxX = -Infinity;
    let globalMinZ = Infinity;
    let globalMaxZ = -Infinity;

    for (const tile of level.tiles) {
        const minX = dpMinimapS16(tile.minX);
        const maxX = dpMinimapS16(tile.maxX);
        const minZ = dpMinimapS16(tile.minZ);
        const maxZ = dpMinimapS16(tile.maxZ);

        if (minX < globalMinX) globalMinX = minX;
        if (maxX > globalMaxX) globalMaxX = maxX;
        if (minZ < globalMinZ) globalMinZ = minZ;
        if (maxZ > globalMaxZ) globalMaxZ = maxZ;
    }

    if (!Number.isFinite(globalMinX) || !Number.isFinite(globalMaxX) || !Number.isFinite(globalMinZ) || !Number.isFinite(globalMaxZ))
        return null;

    const mapWorldW = Math.max(1, numCols * 640);
    const mapWorldD = Math.max(1, numRows * 640);

    const spanX = Math.max(1, globalMaxX - globalMinX);
    const spanZ = Math.max(1, globalMaxZ - globalMinZ);

    const playerY = dpGameS16(playerLocalY);

    const candidates = [
        {
            mode: 'minAnchored',
            x: dpGameS16(globalMinX + playerLocalX),
            z: dpGameS16(globalMinZ + playerLocalZ),
        },
        {
            mode: 'maxAnchored',
            x: dpGameS16(globalMaxX - (mapWorldW - playerLocalX)),
            z: dpGameS16(globalMaxZ - (mapWorldD - playerLocalZ)),
        },
        {
            mode: 'normalized',
            x: dpGameS16(globalMinX + dpClamp01(playerLocalX / mapWorldW) * spanX),
            z: dpGameS16(globalMinZ + dpClamp01(playerLocalZ / mapWorldD) * spanZ),
        },
    ];

    // First pass: exact XYZ
    for (const c of candidates) {
        const tile = dpFindActiveMinimapTileAtPos(level, c.x, playerY, c.z, false);
        if (tile) {
            return {
                tile,
                playerX: c.x,
                playerY,
                playerZ: c.z,
                mode: c.mode,
                ignoreY: false,
                globalMinX,
                globalMaxX,
                globalMinZ,
                globalMaxZ,
            };
        }
    }

    // Second pass: exact XZ, ignore Y (camera can sit above the player)
    for (const c of candidates) {
        const tile = dpFindActiveMinimapTileAtPos(level, c.x, playerY, c.z, true);
        if (tile) {
            return {
                tile,
                playerX: c.x,
                playerY,
                playerZ: c.z,
                mode: c.mode,
                ignoreY: true,
                globalMinX,
                globalMaxX,
                globalMinZ,
                globalMaxZ,
            };
        }
    }

    return null;
}

const DP_MINIMAP_PLAYER_ICON_TEXTABLE = 0x467; // Blue diamond
const DP_MINIMAP_PLAYER_ICON_PNG_URL = '/data/dinosaurplanet/textures/TEX0_1044_00354120_0.png';

let dpPlayerMarkerPng: HTMLImageElement | null = null;
let dpPlayerMarkerPngReady = false;
let dpPlayerMarkerPngFailed = false;

function dpGetPlayerMarkerPng(): HTMLImageElement | null {
    if (dpPlayerMarkerPngReady && dpPlayerMarkerPng)
        return dpPlayerMarkerPng;

    if (dpPlayerMarkerPngFailed)
        return null;

    if (!dpPlayerMarkerPng) {
        dpPlayerMarkerPng = new Image();
        dpPlayerMarkerPng.onload = () => {
            dpPlayerMarkerPngReady = true;
        };
        dpPlayerMarkerPng.onerror = () => {
            dpPlayerMarkerPngFailed = true;
            console.warn('[DP MINIMAP] failed to load marker png:', DP_MINIMAP_PLAYER_ICON_PNG_URL);
        };
        dpPlayerMarkerPng.src = DP_MINIMAP_PLAYER_ICON_PNG_URL;
    }

    return dpPlayerMarkerPngReady ? dpPlayerMarkerPng : null;
}
type DPMinimapManualFix = {
    mode?: 'rawLocal' | 'minAnchored' | 'maxAnchored' | 'normalized';
    offsetX?: number;
    offsetZ?: number;
    forceTex0ID?: number;
    sticky?: boolean;
};

const DP_MINIMAP_MANUAL_FIXES: Record<number, DPMinimapManualFix> = {
    3: { mode: 'maxAnchored', offsetX: 640, offsetZ: 0, sticky: true },
    10: { mode: 'minAnchored', offsetX: -40, offsetZ: -640, sticky: true },
    11: { mode: 'minAnchored', offsetX: -640, offsetZ: -1890, sticky: true },
    12: { mode: 'maxAnchored', offsetX: -0, offsetZ: -0, sticky: true },
    14: { mode: 'minAnchored', offsetX: -640, offsetZ: -0, sticky: true },
    16: { mode: 'maxAnchored', offsetX: -1900, offsetZ: -0, sticky: true },
    18: { mode: 'minAnchored', offsetX: -1240, offsetZ: -0, sticky: true },
    21: { mode: 'minAnchored', offsetX: 640, offsetZ: -0, sticky: true },
    23: { mode: 'maxAnchored', offsetX: 0, offsetZ: -1280, sticky: true },
    25: { mode: 'minAnchored', offsetX: 0, offsetZ: 640, sticky: true },
    29: { mode: 'minAnchored', offsetX: 0, offsetZ: -1280, sticky: true },
    35: { mode: 'minAnchored', offsetX: 0, offsetZ: -640, sticky: true },
    43: { mode: 'minAnchored', offsetX: 0, offsetZ: -640, sticky: true },
    52: { mode: 'minAnchored', offsetX: 0, offsetZ: -640, sticky: true },
};

function dpPointInTileXZ(tile: DPMinimapSection, x: number, z: number, pad: number = 0): boolean {
    const minX = dpMinimapS16(tile.minX) - pad;
    const maxX = dpMinimapS16(tile.maxX) + pad;
    const minZ = dpMinimapS16(tile.minZ) - pad;
    const maxZ = dpMinimapS16(tile.maxZ) + pad;

    return x >= minX && x < maxX && z >= minZ && z < maxZ;
}

function dpFindTileByTex0(level: DPMinimapLevel, tex0ID: number): DPMinimapSection | null {
    for (const tile of level.tiles) {
        if (dpGetMinimapTexTableID(tile) === tex0ID)
            return tile;
    }
    return null;
}

function dpTransformMinimapPoint(
    mode: 'rawLocal' | 'minAnchored' | 'maxAnchored' | 'normalized',
    playerLocalX: number,
    playerLocalY: number,
    playerLocalZ: number,
    numCols: number,
    numRows: number,
    globalMinX: number,
    globalMaxX: number,
    globalMinZ: number,
    globalMaxZ: number,
): { x: number; y: number; z: number } {
    const mapWorldW = Math.max(1, numCols * 640);
    const mapWorldD = Math.max(1, numRows * 640);

    const spanX = Math.max(1, globalMaxX - globalMinX);
    const spanZ = Math.max(1, globalMaxZ - globalMinZ);

    const y = dpGameS16(playerLocalY);

    if (mode === 'rawLocal') {
        return {
            x: dpGameS16(playerLocalX),
            y,
            z: dpGameS16(playerLocalZ),
        };
    } else if (mode === 'maxAnchored') {
        return {
            x: dpGameS16(globalMaxX - (mapWorldW - playerLocalX)),
            y,
            z: dpGameS16(globalMaxZ - (mapWorldD - playerLocalZ)),
        };
    } else if (mode === 'normalized') {
        return {
            x: dpGameS16(globalMinX + dpClamp01(playerLocalX / mapWorldW) * spanX),
            y,
            z: dpGameS16(globalMinZ + dpClamp01(playerLocalZ / mapWorldD) * spanZ),
        };
    } else {
        return {
            x: dpGameS16(globalMinX + playerLocalX),
            y,
            z: dpGameS16(globalMinZ + playerLocalZ),
        };
    }
}
type DPMinimapDrawArgs = {
    ctx: CanvasRenderingContext2D;
    mapID: number;
    cameraWorldMatrix: ArrayLike<number>;
    worldToMapPoint: (x: number, y: number, z: number) => ArrayLike<number>;
    origin: [number, number];
    numCols: number;
    numRows: number;
    texFetcher: any;
    cache: any;
};

export function drawDPMinimap(args: DPMinimapDrawArgs): void {
    const level = getDPMinimapLevel(args.mapID);
    if (!level || level.tiles.length === 0)
        return;

    const texFetcher = args.texFetcher;
    if (!texFetcher || typeof texFetcher.getTextureByTextable !== 'function')
        return;

const camWorld = args.cameraWorldMatrix;
const localPos = args.worldToMapPoint(camWorld[12], camWorld[13], camWorld[14]);

const playerLocalX = localPos[0];
const playerLocalY = localPos[1];
const playerLocalZ = localPos[2];

const resolved = dpResolveActiveMinimapTile(
    level,
    playerLocalX,
    playerLocalY,
    playerLocalZ,
    args.numCols,
    args.numRows,
);

if (!resolved) {
  //  console.warn('[DP MINIMAP] no active tile', {
    //    mapID: args.mapID,
    //    playerLocalX, playerLocalY, playerLocalZ,
     //   numCols: args.numCols,
    //    numRows: args.numRows,
    //    tiles: level.tiles.length,
   // });
    return;
}

let activeTile = resolved.tile;
let playerX = resolved.playerX;
let playerY = resolved.playerY;
let playerZ = resolved.playerZ;

const fix = DP_MINIMAP_MANUAL_FIXES[args.mapID];

if (fix?.mode) {
    const p = dpTransformMinimapPoint(
        fix.mode,
        playerLocalX,
        playerLocalY,
        playerLocalZ,
        args.numCols,
        args.numRows,
        resolved.globalMinX,
        resolved.globalMaxX,
        resolved.globalMinZ,
        resolved.globalMaxZ,
    );

    playerX = p.x + (fix.offsetX ?? 0);
    playerY = p.y;
    playerZ = p.z + (fix.offsetZ ?? 0);

    const repicked =
        dpFindActiveMinimapTileAtPos(level, playerX, playerY, playerZ, false) ??
        dpFindActiveMinimapTileAtPos(level, playerX, playerY, playerZ, true);

    if (repicked)
        activeTile = repicked;
}

if (fix?.forceTex0ID !== undefined) {
    const forcedTile = dpFindTileByTex0(level, fix.forceTex0ID);
    if (forcedTile)
        activeTile = forcedTile;
}

if (fix?.sticky) {
    const stickyRoot = ((window as any).__dpMinimapSticky ??= {});
    const prevTile = stickyRoot[args.mapID] as DPMinimapSection | undefined;

    if (prevTile && dpPointInTileXZ(prevTile, playerX, playerZ, 128)) {
        activeTile = prevTile;
    } else {
        stickyRoot[args.mapID] = activeTile;
    }
}

//console.warn('[DP MINIMAP PICK]', {
 //   mapID: args.mapID,
 //   mode: fix?.mode ?? resolved.mode,
 //   ignoreY: resolved.ignoreY,
 //   playerX,
 //   playerY,
//    playerZ,
//});

    const activeTex0ID = dpGetMinimapTexTableID(activeTile);

const tex: any =
    (typeof texFetcher.getDPTextureByTex0ID === 'function')
        ? texFetcher.getDPTextureByTex0ID(args.cache, activeTex0ID)
        : (
            (typeof texFetcher.getTextureByTextable === 'function')
                ? texFetcher.getTextureByTextable(args.cache, activeTex0ID)
                : null
        );

// DP texture loads are async; during the first few frames the placeholder may exist
// but have no viewer surface yet. Don't spam warnings for that.
if (!tex)
    return;

if (!tex.viewerTexture || !tex.viewerTexture.surfaces || tex.viewerTexture.surfaces.length === 0)
    return;

const surface = tex.viewerTexture.surfaces[0] as any;
    const texW = (surface.width ?? 0) | 0;
    const texH = (surface.height ?? 0) | 0;
    const minimapScale = 3.5;
    if (texW <= 0 || texH <= 0)
        return;

    let levelMinX =  Infinity;
    let levelMaxX = -Infinity;
    let levelMinZ =  Infinity;
    let levelMaxZ = -Infinity;

    for (const tile of level.tiles) {
        if (dpGetMinimapTexTableID(tile) !== activeTex0ID)
            continue;

        const minX = dpMinimapS16(tile.minX);
        const maxX = dpMinimapS16(tile.maxX);
        const minZ = dpMinimapS16(tile.minZ);
        const maxZ = dpMinimapS16(tile.maxZ);

        if (minX < levelMinX) levelMinX = minX;
        if (maxX > levelMaxX) levelMaxX = maxX;
        if (minZ < levelMinZ) levelMinZ = minZ;
        if (maxZ > levelMaxZ) levelMaxZ = maxZ;
    }

    if (!Number.isFinite(levelMinX) || !Number.isFinite(levelMaxX) || !Number.isFinite(levelMinZ) || !Number.isFinite(levelMaxZ))
        return;

    const spanX = levelMaxX - levelMinX;
    const spanZ = levelMaxZ - levelMinZ;
    if (spanX <= 0 || spanZ <= 0)
        return;

    // Match SFA minimap math.
    let gridX = Math.floor((spanX * 8) / 640);
    if (gridX > 24)
        gridX = 24;

    let gridZ = Math.floor((spanZ * 8) / 640);
    if (gridZ > 24)
        gridZ = (gridZ * 2) - 24;

    // Original SFA anchor was (50, 200) on a 320x240 screen.
    // Scaled version:
    const anchorX = 50 * minimapScale;
    const anchorY = args.ctx.canvas.height - (40 * minimapScale);

    const drawW = texW * minimapScale;
    const drawH = texH * minimapScale;

    // IMPORTANT: screenOffset affects the tile art, not the marker.
    const drawX = anchorX + (activeTile.screenOffsetX * minimapScale) - (gridX * minimapScale);
    const drawY = anchorY + (activeTile.screenOffsetY * minimapScale) - (gridZ * minimapScale);

    args.ctx.save();

  //  args.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
   // args.ctx.fillRect(drawX - 2, drawY - 2, drawW + 4, drawH + 4);

    args.ctx.drawImage(surface, drawX, drawY, drawW, drawH);

const pixelsPerWorld = 0.025 * minimapScale;

// Visible on-screen size for the player icon.
const iconSize = 6 * minimapScale;
const iconHalf = iconSize * 0.5;

// First compute the raw marker position.
const rawMarkerX =
    anchorX
    - (gridX * minimapScale)
    - ((playerX - levelMaxX) * pixelsPerWorld);

const rawMarkerY =
    anchorY
    - (gridZ * minimapScale)
    - ((playerZ - levelMaxZ) * pixelsPerWorld);

// Clamp marker so it can never leave the minimap texture area.
const markerClampPad = iconHalf + 1;

const markerMinX = drawX + markerClampPad;
const markerMaxX = drawX + drawW - markerClampPad;
const markerMinY = drawY + markerClampPad;
const markerMaxY = drawY + drawH - markerClampPad;

const markerX = Math.max(markerMinX, Math.min(rawMarkerX, markerMaxX));
const markerY = Math.max(markerMinY, Math.min(rawMarkerY, markerMaxY));
const playerIconPng = dpGetPlayerMarkerPng();
const playerIcon =
    playerIconPng ? null :
    ((typeof texFetcher.getDPTextureByTextableID === 'function')
        ? texFetcher.getDPTextureByTextableID(args.cache, DP_MINIMAP_PLAYER_ICON_TEXTABLE)
        : texFetcher.getTextureByTextable(args.cache, DP_MINIMAP_PLAYER_ICON_TEXTABLE));

const playerIconSurface = playerIconPng ?? playerIcon?.viewerTexture?.surfaces?.[0] ?? null;

// Visible on-screen size you want for the diamond itself.

const iconDrawX = markerX - (iconSize * 0.5);
const iconDrawY = markerY - (iconSize * 0.5);

if (playerIconSurface) {
    const crop = dpGetOpaqueImageBounds(playerIconSurface);

    args.ctx.save();
    args.ctx.imageSmoothingEnabled = false;
    args.ctx.drawImage(
        playerIconSurface,
        crop.sx, crop.sy, crop.sw, crop.sh,
        iconDrawX, iconDrawY, iconSize, iconSize,
    );
    args.ctx.restore();
} else {
    // fallback if the icon texture is missing
    args.ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    args.ctx.fillStyle = 'rgba(80, 180, 255, 0.95)';
    args.ctx.lineWidth = 1.0;

    const markerSize = 4 * minimapScale;

    args.ctx.beginPath();
    args.ctx.moveTo(markerX,              markerY - markerSize);
    args.ctx.lineTo(markerX + markerSize, markerY);
    args.ctx.lineTo(markerX,              markerY + markerSize);
    args.ctx.lineTo(markerX - markerSize, markerY);
    args.ctx.closePath();
    args.ctx.fill();
    args.ctx.stroke();
}

    args.ctx.restore();
}