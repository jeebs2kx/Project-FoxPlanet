export type Mod49DbayGroupMaterial = {
    texId: number;
    texW?: number;
    texH?: number;
    blendTexId?: number;
    blendTexW?: number;
    blendTexH?: number;
    cutout?: boolean;
    translucent?: boolean;
    water?: boolean;
    lightbeam?: boolean;
    alpha?: number;
    dpBlock?: number;
    dpBatch?: number;
};

export const MOD49_DBAY_GROUP_MATERIALS = new Map<string, Mod49DbayGroupMaterial>([
    ['1146:2', {texId:1888, texW:64, cutout:true, dpBlock:974, dpBatch:28}], // cutout
    ['1146:6', {texId:1889, texW:64, cutout:true, dpBlock:974, dpBatch:23}], // cutout
    ['1146:15', {texId:1896, texW:64, cutout:true, dpBlock:974, dpBatch:12}], // cutout
    ['1146:16', {texId:1897, texW:64, cutout:true, dpBlock:974, dpBatch:11}], // cutout
    ['1146:20', {texId:1888, texW:64, cutout:true, dpBlock:974, dpBatch:29}], // cutout
    ['1146:29', {texId:1888, texW:64, cutout:true, dpBlock:974, dpBatch:29}], // cutout
    ['1146:31', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:974, dpBatch:-1}], // water
    ['1146:32', {texId:368, translucent:true, water:true, alpha:0.58, dpBlock:974, dpBatch:-1}], // water
    ['1146:38', {texId:1855, texW:64, texH:64, translucent:true, alpha:0.72, dpBlock:974, dpBatch:41}], // trans
    ['1146:41', {texId:1905, texH:64, translucent:true, alpha:0.72, dpBlock:974, dpBatch:1}], // trans
    ['1146:42', {texId:1906, texH:64, translucent:true, alpha:0.72, dpBlock:974, dpBatch:0}], // trans
    ['1147:4', {texId:1888, texW:64, cutout:true, dpBlock:975, dpBatch:10}], // cutout
    ['1147:8', {texId:1889, texW:64, cutout:true, dpBlock:975, dpBatch:5}], // cutout
    ['1147:17', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:975, dpBatch:17}], // water
    ['1147:18', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:975, dpBatch:18}], // water
    ['1147:19', {texId:368, translucent:true, water:true, alpha:0.58, dpBlock:975, dpBatch:-1}], // water
    ['1148:16', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:976, dpBatch:-1}], // water
    ['1148:17', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:976, dpBatch:15}], // water
    ['1148:18', {texId:1903, texW:64, texH:64, translucent:true, alpha:0.72, dpBlock:976, dpBatch:16}], // trans
    ['1148:19', {texId:1911, translucent:true, alpha:0.72, dpBlock:976, dpBatch:-1}], // trans
    ['1149:1', {texId:1888, texW:64, cutout:true, dpBlock:977, dpBatch:7}], // cutout
    ['1149:5', {texId:1889, texW:64, cutout:true, dpBlock:977, dpBatch:3}], // cutout
    ['1149:11', {texId:1903, texW:64, texH:64, translucent:true, alpha:0.72, dpBlock:977, dpBatch:13}], // trans
    ['1149:13', {texId:1911, translucent:true, alpha:0.72, dpBlock:977, dpBatch:-1}], // trans
    ['1149:14', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:977, dpBatch:11}], // water
    ['1149:15', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:977, dpBatch:12}], // water
    ['1150:4', {texId:1896, texW:64, cutout:true, dpBlock:978, dpBatch:24}], // cutout
    ['1150:5', {texId:1897, texW:64, cutout:true, dpBlock:978, dpBatch:23}], // cutout
    ['1150:7', {texId:1889, texW:64, cutout:true, dpBlock:978, dpBatch:20}], // cutout
    ['1150:13', {texId:1896, texW:64, cutout:true, dpBlock:978, dpBatch:24}], // cutout
    ['1150:14', {texId:1897, texW:64, cutout:true, dpBlock:978, dpBatch:23}], // cutout
    ['1150:31', {texId:1907, texH:64, translucent:true, alpha:0.72, dpBlock:978, dpBatch:43}], // trans
    ['1150:32', {texId:1908, texH:64, translucent:true, alpha:0.72, dpBlock:978, dpBatch:42}], // trans
    ['1150:40', {texId:1896, texW:64, cutout:true, dpBlock:978, dpBatch:25}], // cutout
    ['1150:42', {texId:1896, texW:64, cutout:true, dpBlock:978, dpBatch:25}], // cutout
    ['1150:46', {texId:1907, texH:64, translucent:true, alpha:0.72, dpBlock:978, dpBatch:41}], // trans
    ['1150:47', {texId:1908, texH:64, translucent:true, alpha:0.72, dpBlock:978, dpBatch:40}], // trans
    ['1150:50', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:978, dpBatch:38}], // water
    ['1150:51', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:978, dpBatch:39}], // water
    ['1150:62', {texId:16, texW:16, texH:16, translucent:true, alpha:0.72, dpBlock:978, dpBatch:37}], // trans
    ['1151:5', {texId:1896, texW:64, cutout:true, dpBlock:979, dpBatch:14}], // cutout
    ['1151:6', {texId:1897, texW:64, cutout:true, dpBlock:979, dpBatch:13}], // cutout
    ['1151:7', {texId:1888, texW:64, cutout:true, dpBlock:979, dpBatch:12}], // cutout
    ['1151:11', {texId:1889, texW:64, cutout:true, dpBlock:979, dpBatch:8}], // cutout
    ['1151:29', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:979, dpBatch:23}], // water
    ['1151:30', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:979, dpBatch:24}], // water
    ['1151:31', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:979, dpBatch:25}], // water
    ['1152:3', {texId:1896, cutout:true, translucent:true, dpBlock:980, dpBatch:-1}], // cutout, trans
    ['1152:7', {texId:1896, cutout:true, translucent:true, dpBlock:980, dpBatch:-1}], // cutout, trans
    ['1152:8', {texId:1887, translucent:true, alpha:0.72, dpBlock:980, dpBatch:-1}], // trans
    ['1152:21', {texId:1896, texW:64, cutout:true, dpBlock:980, dpBatch:0}], // cutout
    ['1152:24', {texId:1898, translucent:true, alpha:0.72, dpBlock:980, dpBatch:-1}], // trans
    ['1152:27', {texId:1857, translucent:true, alpha:0.72, dpBlock:980, dpBatch:-1}], // trans
    ['1152:30', {texId:1857, translucent:true, alpha:0.72, dpBlock:980, dpBatch:-1}], // trans
    ['1152:32', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:980, dpBatch:24}], // water
    ['1152:33', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:980, dpBatch:-1}], // water
    ['1152:34', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:980, dpBatch:25}], // water
    ['1153:28', {texId:1888, cutout:true, translucent:true, dpBlock:981, dpBatch:-1}], // cutout, trans
    ['1153:29', {texId:1841, translucent:true, alpha:0.72, dpBlock:981, dpBatch:-1}], // trans
    ['1153:30', {texId:1841, translucent:true, alpha:0.72, dpBlock:981, dpBatch:-1}], // trans
    ['1153:31', {texId:1888, cutout:true, translucent:true, dpBlock:981, dpBatch:-1}], // cutout, trans
    ['1153:32', {texId:1841, translucent:true, alpha:0.72, dpBlock:981, dpBatch:-1}], // trans
    ['1153:38', {texId:1898, translucent:true, alpha:0.72, dpBlock:981, dpBatch:-1}], // trans
    ['1153:41', {texId:1898, translucent:true, alpha:0.72, dpBlock:981, dpBatch:-1}], // trans
    ['1153:48', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:981, dpBatch:17}], // water
    ['1153:49', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:981, dpBatch:17}], // water
    ['1153:50', {texId:1876, texW:64, cutout:true, dpBlock:981, dpBatch:2}], // cutout
    ['1153:51', {texId:1877, texW:64, cutout:true, dpBlock:981, dpBatch:1}], // cutout
    ['1153:52', {texId:1907, translucent:true, alpha:0.72, dpBlock:981, dpBatch:-1}], // trans
    ['1153:53', {texId:1908, translucent:true, alpha:0.72, dpBlock:981, dpBatch:-1}], // trans
    ['1154:7', {texId:1889, texW:64, cutout:true, dpBlock:982, dpBatch:4}], // cutout
    ['1154:17', {texId:1889, texW:64, cutout:true, dpBlock:982, dpBatch:4}], // cutout
    ['1154:25', {texId:1881, texH:64, translucent:true, alpha:0.72, dpBlock:982, dpBatch:0}], // trans
    ['1154:27', {texId:16, texW:16, texH:16, translucent:true, alpha:0.72, dpBlock:982, dpBatch:10}], // trans
    ['1155:6', {texId:1898, translucent:true, alpha:0.72, dpBlock:983, dpBatch:-1}], // trans
    ['1155:7', {texId:1885, translucent:true, alpha:0.72, dpBlock:983, dpBatch:-1}], // trans
    ['1155:8', {texId:1885, translucent:true, alpha:0.72, dpBlock:983, dpBatch:-1}], // trans
    ['1155:10', {texId:1888, texW:64, cutout:true, dpBlock:983, dpBatch:5}], // cutout
    ['1155:14', {texId:1889, texW:64, cutout:true, dpBlock:983, dpBatch:1}], // cutout
    ['1155:19', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:983, dpBatch:10}], // water
    ['1155:20', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:983, dpBatch:11}], // water
    ['1156:5', {texId:1909, translucent:true, alpha:0.72, dpBlock:984, dpBatch:-1}], // trans
    ['1156:11', {texId:1889, cutout:true, translucent:true, dpBlock:984, dpBatch:-1}], // cutout, trans
    ['1156:12', {texId:1909, translucent:true, alpha:0.72, dpBlock:984, dpBatch:-1}], // trans
    ['1156:13', {texId:1909, translucent:true, alpha:0.72, dpBlock:984, dpBatch:-1}], // trans
    ['1156:15', {texId:1897, cutout:true, translucent:true, dpBlock:984, dpBatch:-1}], // cutout, trans
    ['1156:16', {texId:1909, translucent:true, alpha:0.72, dpBlock:984, dpBatch:-1}], // trans
    ['1156:17', {texId:1909, translucent:true, alpha:0.72, dpBlock:984, dpBatch:-1}], // trans
    ['1156:18', {texId:1909, translucent:true, alpha:0.72, dpBlock:984, dpBatch:-1}], // trans
    ['1156:23', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:984, dpBatch:15}], // water
    ['1156:24', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:984, dpBatch:16}], // water
    ['1158:0', {texId:1888, texW:64, cutout:true, dpBlock:986, dpBatch:16}], // cutout
    ['1158:2', {texId:1889, texW:64, cutout:true, dpBlock:986, dpBatch:14}], // cutout
    ['1158:9', {texId:1896, texW:64, cutout:true, dpBlock:986, dpBatch:7}], // cutout
    ['1158:10', {texId:1897, texW:64, cutout:true, dpBlock:986, dpBatch:6}], // cutout
    ['1158:18', {texId:1896, texW:64, cutout:true, dpBlock:986, dpBatch:7}], // cutout
    ['1158:19', {texId:1897, texW:64, cutout:true, dpBlock:986, dpBatch:6}], // cutout
    ['1159:0', {texId:1888, texW:64, cutout:true, dpBlock:987, dpBatch:13}], // cutout
    ['1159:2', {texId:1889, texW:64, cutout:true, dpBlock:987, dpBatch:11}], // cutout
    ['1159:4', {texId:1888, texW:64, cutout:true, dpBlock:987, dpBatch:13}], // cutout
    ['1159:8', {texId:1889, texW:64, cutout:true, dpBlock:987, dpBatch:11}], // cutout
    ['1159:13', {texId:1898, translucent:true, alpha:0.72, dpBlock:987, dpBatch:-1}], // trans
    ['1159:14', {texId:1886, translucent:true, alpha:0.72, dpBlock:987, dpBatch:-1}], // trans
    ['1159:15', {texId:1886, translucent:true, alpha:0.72, dpBlock:987, dpBatch:-1}], // trans
    ['1159:24', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:987, dpBatch:17}], // water
    ['1159:25', {texId:1907, texH:64, translucent:true, alpha:0.72, dpBlock:987, dpBatch:16}], // trans
    ['1159:26', {texId:1908, texH:64, translucent:true, alpha:0.72, dpBlock:987, dpBatch:15}], // trans
    ['1159:27', {texId:253, translucent:true, water:true, alpha:0.58, dpBlock:987, dpBatch:14}], // water
    ['1159:28', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:987, dpBatch:19}], // water
    ['1159:29', {texId:368, translucent:true, water:true, alpha:0.58, dpBlock:987, dpBatch:18}], // water
    ['1160:5', {texId:1888, texW:64, cutout:true, dpBlock:988, dpBatch:3}], // cutout
    ['1160:9', {texId:1888, cutout:true, translucent:true, dpBlock:988, dpBatch:-1}], // cutout, trans
    ['1160:10', {texId:1885, translucent:true, alpha:0.72, dpBlock:988, dpBatch:-1}], // trans
    ['1160:14', {texId:1864, translucent:true, alpha:0.72, dpBlock:988, dpBatch:-1}], // trans
    ['1160:15', {texId:1885, translucent:true, alpha:0.72, dpBlock:988, dpBatch:-1}], // trans
    ['1160:16', {texId:1885, translucent:true, alpha:0.72, dpBlock:988, dpBatch:-1}], // trans
    ['1160:25', {texId:1911, translucent:true, alpha:0.72, dpBlock:988, dpBatch:-1}], // trans
    ['1160:26', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:988, dpBatch:17}], // water
    ['1160:27', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:988, dpBatch:18}], // water
    ['1161:4', {texId:257, texW:64, translucent:true, alpha:0.72, dpBlock:989, dpBatch:19}], // trans
    ['1161:11', {texId:257, texW:64, translucent:true, alpha:0.72, dpBlock:989, dpBatch:19}], // trans
    ['1161:12', {texId:257, texW:64, translucent:true, alpha:0.72, dpBlock:989, dpBatch:20}], // trans
    ['1161:18', {texId:2074, texH:64, translucent:true, alpha:0.72, dpBlock:989, dpBatch:1}], // trans
    ['1161:19', {texId:2074, texH:64, translucent:true, alpha:0.72, dpBlock:989, dpBatch:1}], // trans
    ['1161:20', {texId:2074, texH:64, translucent:true, alpha:0.72, dpBlock:989, dpBatch:1}], // trans
    ['1161:21', {texId:2074, texH:64, translucent:true, alpha:0.72, dpBlock:989, dpBatch:1}], // trans
    ['1161:22', {texId:2074, texH:64, translucent:true, alpha:0.72, dpBlock:989, dpBatch:1}], // trans
    ['1161:23', {texId:3569, texW:64, texH:64, blendTexId:3570, blendTexW:64, blendTexH:64, translucent:true, water:true, alpha:0.58, dpBlock:989, dpBatch:8}], // water, blend 3570
    ['1161:24', {texId:3569, texW:64, texH:64, blendTexId:3570, blendTexW:64, blendTexH:64, translucent:true, water:true, alpha:0.58, dpBlock:989, dpBatch:8}], // water, blend 3570
    ['1161:25', {texId:253, translucent:true, water:true, alpha:0.58, dpBlock:989, dpBatch:7}], // water
    ['1161:26', {texId:254, translucent:true, water:true, alpha:0.58, dpBlock:989, dpBatch:9}], // water
    ['1161:27', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:989, dpBatch:21}], // water
    ['1161:28', {texId:2292, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:989, dpBatch:23}], // water
    ['1161:29', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:989, dpBatch:21}], // water
    ['1161:30', {texId:2292, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:989, dpBatch:23}], // water
    ['1161:31', {texId:2292, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:989, dpBatch:23}], // water
    ['1161:33', {texId:253, translucent:true, water:true, alpha:0.58, dpBlock:989, dpBatch:6}], // water
    ['1162:0', {texId:1899, translucent:true, alpha:0.72, dpBlock:990, dpBatch:14}], // trans
    ['1162:12', {texId:3604, translucent:true, water:true, alpha:0.58, dpBlock:990, dpBatch:19}], // water
    ['1162:13', {texId:3604, translucent:true, water:true, alpha:0.58, dpBlock:990, dpBatch:19}], // water
    ['1162:21', {texId:1912, translucent:true, water:true, alpha:0.58, dpBlock:990, dpBatch:13}], // water
    ['1162:22', {texId:3604, translucent:true, water:true, alpha:0.58, dpBlock:990, dpBatch:15}], // water
    ['1163:11', {texId:1888, texW:64, cutout:true, dpBlock:991, dpBatch:13}], // cutout
    ['1163:15', {texId:1889, texW:64, cutout:true, dpBlock:991, dpBatch:8}], // cutout
    ['1163:25', {texId:1889, texW:64, cutout:true, dpBlock:991, dpBatch:8}], // cutout
    ['1163:39', {texId:1876, texW:64, cutout:true, dpBlock:991, dpBatch:2}], // cutout
    ['1163:40', {texId:1877, texW:64, cutout:true, dpBlock:991, dpBatch:1}], // cutout
    ['1163:45', {texId:1912, translucent:true, water:true, alpha:0.58, dpBlock:991, dpBatch:32}], // water
    ['1163:46', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:991, dpBatch:30}], // water
    ['1163:47', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:991, dpBatch:31}], // water
    ['1163:48', {texId:1912, translucent:true, water:true, alpha:0.58, dpBlock:991, dpBatch:34}], // water
    ['1163:49', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:991, dpBatch:28}], // water
    ['1163:50', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:991, dpBatch:29}], // water
    ['1163:51', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:991, dpBatch:29}], // water
    ['1164:13', {texId:1888, texW:64, cutout:true, dpBlock:992, dpBatch:8}], // cutout
    ['1164:16', {texId:1889, texW:64, cutout:true, dpBlock:992, dpBatch:4}], // cutout
    ['1164:31', {texId:1888, texW:64, cutout:true, dpBlock:992, dpBatch:8}], // cutout
    ['1164:35', {texId:1889, texW:64, cutout:true, dpBlock:992, dpBatch:4}], // cutout
    ['1164:39', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:992, dpBatch:26}], // water
    ['1164:40', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:992, dpBatch:27}], // water
    ['1164:41', {texId:2292, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:992, dpBatch:28}], // water
    ['1165:7', {texId:1888, texW:64, cutout:true, dpBlock:993, dpBatch:8}], // cutout
    ['1165:11', {texId:1889, texW:64, cutout:true, dpBlock:993, dpBatch:4}], // cutout
    ['1165:17', {texId:1888, texW:64, cutout:true, dpBlock:993, dpBatch:8}], // cutout
    ['1165:20', {texId:1889, texW:64, cutout:true, dpBlock:993, dpBatch:4}], // cutout
    ['1165:29', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:993, dpBatch:23}], // water
    ['1165:30', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:993, dpBatch:23}], // water
    ['1165:31', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:993, dpBatch:19}], // water
    ['1165:32', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:993, dpBatch:20}], // water
    ['1165:33', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:993, dpBatch:19}], // water
    ['1165:34', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:993, dpBatch:19}], // water
    ['1165:35', {texId:2292, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:993, dpBatch:25}], // water
    ['1166:2', {texId:1888, texW:64, cutout:true, dpBlock:994, dpBatch:17}], // cutout
    ['1166:4', {texId:1889, texW:64, cutout:true, dpBlock:994, dpBatch:15}], // cutout
    ['1166:6', {texId:1888, texW:64, cutout:true, dpBlock:994, dpBatch:17}], // cutout
    ['1166:7', {texId:1889, texW:64, cutout:true, dpBlock:994, dpBatch:15}], // cutout
    ['1166:8', {texId:1888, texW:64, cutout:true, dpBlock:994, dpBatch:17}], // cutout
    ['1166:11', {texId:1889, texW:64, cutout:true, dpBlock:994, dpBatch:15}], // cutout
    ['1166:17', {texId:2074, texH:64, translucent:true, alpha:0.72, dpBlock:994, dpBatch:4}], // trans
    ['1166:27', {texId:1888, texW:64, cutout:true, dpBlock:994, dpBatch:17}], // cutout
    ['1166:31', {texId:1889, texW:64, cutout:true, dpBlock:994, dpBatch:15}], // cutout
    ['1166:35', {texId:368, translucent:true, water:true, alpha:0.58, dpBlock:994, dpBatch:26}], // water
    ['1166:36', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:994, dpBatch:25}], // water
    ['1166:37', {texId:253, translucent:true, water:true, alpha:0.58, dpBlock:994, dpBatch:24}], // water
    ['1166:38', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:994, dpBatch:27}], // water
    ['1166:39', {texId:2292, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:994, dpBatch:29}], // water
    ['1166:40', {texId:2292, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:994, dpBatch:29}], // water
    ['1166:41', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:994, dpBatch:27}], // water
    ['1167:2', {texId:1889, texW:64, cutout:true, dpBlock:995, dpBatch:21}], // cutout
    ['1167:9', {texId:257, texW:64, translucent:true, alpha:0.72, dpBlock:995, dpBatch:8}], // trans
    ['1167:10', {texId:1888, texW:64, cutout:true, dpBlock:995, dpBatch:7}], // cutout
    ['1167:17', {texId:257, texW:64, translucent:true, alpha:0.72, dpBlock:995, dpBatch:8}], // trans
    ['1167:33', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:995, dpBatch:31}], // water
    ['1167:34', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:995, dpBatch:32}], // water
    ['1167:35', {texId:1682, texW:64, texH:64, translucent:true, water:true, alpha:0.58, dpBlock:995, dpBatch:32}], // water
    ['1168:24', {texId:3549, translucent:true, lightbeam:true, alpha:0.45, dpBlock:996, dpBatch:3}], // lightbeam
    ['1168:39', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:996, dpBatch:33}], // water
    ['1168:40', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:996, dpBatch:10}], // water
    ['1168:41', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:996, dpBatch:11}], // water
    ['1168:42', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:996, dpBatch:32}], // water
    ['1168:43', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:996, dpBatch:12}], // water
    ['1168:44', {texId:2665, translucent:true, alpha:0.72, dpBlock:996, dpBatch:44}], // trans
    ['1168:45', {texId:2665, translucent:true, alpha:0.72, dpBlock:996, dpBatch:44}], // trans
    ['1168:46', {texId:2665, translucent:true, alpha:0.72, dpBlock:996, dpBatch:44}], // trans
    ['1174:7', {texId:1896, texW:64, cutout:true, dpBlock:1002, dpBatch:1}], // cutout
    ['1174:8', {texId:1897, texW:64, cutout:true, dpBlock:1002, dpBatch:0}], // cutout
    ['1174:9', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:1002, dpBatch:9}], // water
    ['1174:10', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1002, dpBatch:-1}], // water
    ['1174:12', {texId:1911, translucent:true, alpha:0.72, dpBlock:1002, dpBatch:-1}], // trans
    ['1175:7', {texId:3549, translucent:true, lightbeam:true, alpha:0.45, dpBlock:1003, dpBatch:4}], // lightbeam
    ['1175:14', {texId:3550, texW:64, texH:64, translucent:true, lightbeam:true, alpha:0.45, dpBlock:1003, dpBatch:15}], // lightbeam
    ['1175:15', {texId:3551, texW:64, texH:64, translucent:true, lightbeam:true, alpha:0.45, dpBlock:1003, dpBatch:14}], // lightbeam
    ['1175:37', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:1003, dpBatch:33}], // water
    ['1175:38', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:1003, dpBatch:-1}], // water
    ['1176:17', {texId:3563, translucent:true, water:true, alpha:0.58, dpBlock:1004, dpBatch:15}], // water
    ['1176:18', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1004, dpBatch:14}], // water
    ['1176:19', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1004, dpBatch:16}], // water
    ['1176:20', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1004, dpBatch:16}], // water
    ['1177:1', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1005, dpBatch:1}], // water
    ['1177:2', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1005, dpBatch:2}], // water
    ['1177:3', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1005, dpBatch:2}], // water
    ['1178:7', {texId:1896, texW:64, cutout:true, dpBlock:1006, dpBatch:1}], // cutout
    ['1178:8', {texId:1897, texW:64, cutout:true, dpBlock:1006, dpBatch:0}], // cutout
    ['1178:9', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1006, dpBatch:9}], // water
    ['1178:10', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1006, dpBatch:10}], // water
    ['1178:11', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1006, dpBatch:10}], // water
    ['1179:1', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1007, dpBatch:1}], // water
    ['1179:2', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1007, dpBatch:2}], // water
    ['1179:3', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1007, dpBatch:2}], // water
    ['1180:1', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1008, dpBatch:1}], // water
    ['1180:2', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1008, dpBatch:2}], // water
    ['1180:3', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1008, dpBatch:2}], // water
    ['1181:4', {texId:3553, translucent:true, water:true, alpha:0.58, dpBlock:1009, dpBatch:4}], // water
]);