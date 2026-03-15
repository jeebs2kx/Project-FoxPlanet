import * as Viewer from '../viewer.js';

export interface GameInfo {
    pathBase: string;
    subdirs: { [key: number]: string };
}

export const DP_GAME_INFO: GameInfo = {
    pathBase: 'dinosaurplanet',
    subdirs: {},
};



function makeLazyDPMapSceneDesc(mapId: number, id: string, name: string, gameInfo: GameInfo): Viewer.SceneDesc {
    return {
        id,
        name,
        createScene: async (device: any, context: any) => {
            const m = await import('./maps.js');
            const real = new m.DPMapSceneDesc(mapId, id, name, gameInfo);
            return real.createScene(device, context);
        },
    };
}

function makeLazyDPFullWorldSceneDesc(id: string, name: string, gameInfo: GameInfo): Viewer.SceneDesc {
    return {
        id,
        name,
        createScene: async (device: any, context: any) => {
            const m = await import('./maps.js');
            const real = new m.DPFullWorldSceneDesc(id, name, gameInfo);
            return real.createScene(device, context);
        },
    };
}

function makeLazyDPModelExhibitSceneDesc(id: string, name: string, gameInfo: GameInfo): Viewer.SceneDesc {
    return {
        id,
        name,
        createScene: async (device: any, context: any) => {
            const m = await import('./modelexhibit.js');
            const real = new m.DPModelExhibitSceneDesc(id, name, gameInfo);
            return real.createScene(device, context);
        },
    };
}

function makeLazyCombinedOldIceMtSceneDesc(id: string, name: string, gameInfo: GameInfo): Viewer.SceneDesc {
    return {
        id,
        name,
        createScene: async (device: any, context: any) => {
            const m = await import('./maps.js');
            const real = new m.CombinedOldIceMtSceneDesc(id, name, gameInfo);
            return real.createScene(device, context);
        },
    };
}
function makeLazyManualGridSceneDesc(id: string, name: string, gameInfo: GameInfo): Viewer.SceneDesc {
    return {
        id,
        name,
        createScene: async (device: any, context: any) => {
            const m = await import('./maps.js');
            const real = new m.YetiSceneDesc(id, name, gameInfo);
            return real.createScene(device, context);
        },
    };
}

function makeLazyDPSequenceSceneDesc(sequenceId: number, id: string, name: string, gameInfo: GameInfo): Viewer.SceneDesc {
    return {
        id,
        name,
        createScene: async (device: any, context: any) => {
            const seq = await import('./sequences.js'); // Your new file
            const real = new seq.DPSequenceSceneDesc(sequenceId, id, name, gameInfo);
            return real.createScene(device, context);
        },
    };
}


const sceneDescs: (string | Viewer.SceneDesc)[] = [
    'Dinosaur Planet Map + Model Viewer ',
    makeLazyDPModelExhibitSceneDesc('dp_models', 'DP: Models (in progress)', DP_GAME_INFO),

    'Full World Maps (experimental)',
    makeLazyDPFullWorldSceneDesc('dp_full_world', 'DP: Full World', DP_GAME_INFO),
//'Cutscenes & Sequences',
   //makeLazyDPSequenceSceneDesc(65, 'dp_seq_0', 'DP Sequence: 0 (Test/Intro)', DP_GAME_INFO),
    'Ancient Maps',
    makeLazyCombinedOldIceMtSceneDesc('dp_old_icemt_combo', 'DP: Old Ice Mountain (1, 2 & 3)', DP_GAME_INFO),    
makeLazyManualGridSceneDesc('dp_yeti_mt_multi', 'Yeti Mountain', DP_GAME_INFO), makeLazyDPMapSceneDesc(17, 'dp11_cr_traprooms',      'DP: CloudRunner - TrapRooms', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(36, 'dp24_earthwalker_temple','DP: EarthWalker Temple (Unused)', DP_GAME_INFO),

    'Dinosaur Planet Maps',
    makeLazyDPMapSceneDesc( 2, 'dp02_dragrock_top',      'DP: Dragon Rock - Top', DP_GAME_INFO),
    makeLazyDPMapSceneDesc( 3, 'dp03_krazoa_palace',     'DP: Krazoa Palace', DP_GAME_INFO),
    makeLazyDPMapSceneDesc( 4, 'dp04_volcano_fp',        'DP: Volcano Force Point Temple', DP_GAME_INFO),
    makeLazyDPMapSceneDesc( 5, 'dp05_rolling_demo',      'DP: Rolling Demo', DP_GAME_INFO),
    makeLazyDPMapSceneDesc( 6, 'dp06_discovery_falls',   'DP: Discovery Falls', DP_GAME_INFO),
    makeLazyDPMapSceneDesc( 7, 'dp07_swaphol',           'DP: SwapStone Hollow', DP_GAME_INFO),
    makeLazyDPMapSceneDesc( 8, 'dp08_swaphol2',          'DP: SwapStone Hollow - Bottom', DP_GAME_INFO),
    makeLazyDPMapSceneDesc( 9, 'dp09_golden_plains',     'DP: Golden Plains', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(10, 'dp0a_northern_wastes',   'DP: Snowhorn Wastes', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(11, 'dp0b_warlock_mountain',  'DP: Warlock Mountain', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(12, 'dp0c_crfort',            'DP: CloudRunner Fortress', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(13, 'dp0d_walled_city',       'DP: Walled City', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(14, 'dp0e_swapstone_circle',  'DP: SwapStone Circle', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(15, 'dp0f_cr_treasure',       'DP: CloudRunner - Treasure', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(16, 'dp10_cr_dungeon',        'DP: CloudRunner - Dungeon', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(18, 'dp12_mmpass',            'DP: Moon Mountain Pass', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(19, 'dp13_dim1',              'DP: DarkIce Mines', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(20, 'dp14_krazoa_shrine_tpl', 'DP: Krazoa Shrine (Unused Template)', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(21, 'dp15_dfp_bottom',        'DP: Desert Force Point Bottom', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(22, 'dp16_krazchamber',       'DP: Unused Karazoa Test (Alt Objects)', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(23, 'dp17_newicemount1',      'DP: Ice Mountain 1', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(24, 'dp18_newicemount2',      'DP: Ice Mountain 2', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(25, 'dp19_newicemount3',      'DP: Ice Mountain 3', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(26, 'dp1a_animtest',          'DP: Animtest', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(27, 'dp1b_dim2',              'DP: DarkIce Mines 2- Dungeon', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(28, 'dp1c_boss_galdon_dim3',  'DP: BOSS Galdon', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(29, 'dp1d_capeclaw',          'DP: Cape Claw', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(30, 'dp1e_inside_galleon',    'DP: Inside Galleon', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(31, 'dp1f_dfshrine',          'DP: Test of Combat', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(32, 'dp20_mmshrine',          'DP: Test of Fear', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(33, 'dp21_ecshrine',          'DP: Test of Skill', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(34, 'dp22_gpshrine',          'DP: Test of Knowledge', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(35, 'dp23_diamond_bay',       'DP: Diamond Bay', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(37, 'dp25_willow_grove',      'DP: Willow Grove', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(38, 'dp26_blackwater_canyon', 'DP: BlackWater Canyon', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(39, 'dp27_dbshrine',          'DP: Test of Strength', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(40, 'dp28_nwshrine',          'DP: Test of Sacrifice', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(41, 'dp29_ccshrine',          'DP: Test of Character', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(42, 'dp2a_wgshrine',          'DP: Test of Magic', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(43, 'dp2b_cr_race',           'DP: CloudRunner - Race', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(44, 'dp2c_boss_drakor',       'DP: BOSS Drakor', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(45, 'dp2d_wminsert',          'DP: WMinsert (Unused?)', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(46, 'dp2e_dim_caves',         'DP: DarkIce Mines - Caves', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(47, 'dp2f_dim_lava',          'DP: DarkIce Mines - Lava', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(48, 'dp30_boss_trex',         'DP: BOSS TRex', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(49, 'dp31_mikeslava',         'DP: MikesLava (Test)', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(50, 'dp32_dfp_top',           'DP: Desert Force Point Top', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(51, 'dp33_swap_store',        'DP: Swap Store', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(52, 'dp34_dragrock_bottom',   'DP: Dragon Rock - Bottom', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(53, 'dp35_boss_kamerian',     'DP: BOSS Kamerian Dragon', DP_GAME_INFO),
    makeLazyDPMapSceneDesc(54, 'dp36_magic_cave_small',  'DP: Magic Cave - Small', DP_GAME_INFO),
];

const id = 'dp';
const name = 'Dinosaur Planet';

export const sceneGroup: Viewer.SceneGroup = { id, name, sceneDescs };