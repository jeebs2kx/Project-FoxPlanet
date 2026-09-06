(function () {
  'use strict';

  var STATIC_WEB = location.protocol === 'https:' || (location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/i.test(location.hostname));
  window.__PFP_WEB_STATIC_ONLY = STATIC_WEB;

  function cleanPath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
  }

  class LocalSlice {
    constructor(buffer, byteOffset, byteLength, name) {
      this.arrayBuffer = buffer;
      this.byteOffset = byteOffset || 0;
      this.byteLength = byteLength === undefined ? buffer.byteLength - this.byteOffset : byteLength;
      this.name = name || '';
    }
    slice(begin, end, copyData) {
      begin = begin || 0;
      var realEnd = end && end !== 0 ? end : this.byteLength;
      if (copyData) {
        var copy = this.arrayBuffer.slice(this.byteOffset + begin, this.byteOffset + realEnd);
        return new LocalSlice(copy, 0, copy.byteLength, this.name);
      }
      return new LocalSlice(this.arrayBuffer, this.byteOffset + begin, realEnd - begin, this.name);
    }
    subarray(begin, byteLength, copyData) {
      begin = begin || 0;
      if (byteLength === undefined) byteLength = this.byteLength - begin;
      if (copyData) {
        var copy = this.arrayBuffer.slice(this.byteOffset + begin, this.byteOffset + begin + byteLength);
        return new LocalSlice(copy, 0, copy.byteLength, this.name);
      }
      return new LocalSlice(this.arrayBuffer, this.byteOffset + begin, byteLength, this.name);
    }
    copyToBuffer(begin, byteLength) {
      begin = begin || 0;
      if (byteLength === undefined) byteLength = this.byteLength - begin;
      return this.arrayBuffer.slice(this.byteOffset + begin, this.byteOffset + begin + byteLength);
    }
    createDataView(offs, length) {
      offs = offs || 0;
      if (length === undefined) length = this.byteLength - offs;
      return new DataView(this.arrayBuffer, this.byteOffset + offs, length);
    }
    createTypedArray(clazz, offs, count, endianness) {
      offs = offs || 0;
      var bytes = clazz.BYTES_PER_ELEMENT || 1;
      if (count === undefined) count = Math.floor((this.byteLength - offs) / bytes);
      var absolute = this.byteOffset + offs;
      var length = count * bytes;
      var needsSwap = bytes > 1 && endianness === 1;
      if (needsSwap) {
        var raw = new Uint8Array(this.arrayBuffer.slice(absolute, absolute + length));
        if (bytes === 2) {
          for (var i = 0; i + 1 < raw.length; i += 2) {
            var a = raw[i]; raw[i] = raw[i + 1]; raw[i + 1] = a;
          }
        } else if (bytes === 4) {
          for (var j = 0; j + 3 < raw.length; j += 4) {
            var a0 = raw[j], a1 = raw[j + 1];
            raw[j] = raw[j + 3]; raw[j + 1] = raw[j + 2]; raw[j + 2] = a1; raw[j + 3] = a0;
          }
        }
        return new clazz(raw.buffer, 0, count);
      }
      if ((absolute % bytes) === 0)
        return new clazz(this.arrayBuffer, absolute, count);
      var copy = this.arrayBuffer.slice(absolute, absolute + length);
      return new clazz(copy, 0, count);
    }
  }

  function makeSlice(buffer, name, opts) {
    opts = opts || {};
    var start = Number(opts.rangeStart || 0);
    var size = opts.rangeSize === undefined ? buffer.byteLength - start : Number(opts.rangeSize);
    if (start < 0) start = 0;
    if (size < 0) size = 0;
    var end = Math.min(buffer.byteLength, start + size);
    return new LocalSlice(buffer, start, Math.max(0, end - start), name);
  }

  class BlobEntry {
    constructor(blob, base, size) {
      this.blob = blob;
      this.base = base || 0;
      this.size = size === undefined ? blob.size - this.base : size;
    }
    async read(path, opts) {
      opts = opts || {};
      var start = Number(opts.rangeStart || 0);
      var size = opts.rangeSize === undefined ? this.size - start : Number(opts.rangeSize);
      if (start < 0 || size < 0 || start > this.size) return null;
      var end = Math.min(this.size, start + size);
      var buffer = await this.blob.slice(this.base + start, this.base + end).arrayBuffer();
      return new LocalSlice(buffer, 0, buffer.byteLength, path);
    }
  }

  class MapMount {
    constructor(label) {
      this.label = label;
      this.entries = new Map();
    }
    add(path, entry) {
      path = cleanPath(path);
      if (!path) return;
      this.entries.set(path.toLowerCase(), entry);
    }
    async fetchData(path, opts) {
      var key = cleanPath(path).toLowerCase();
      var e = this.entries.get(key);
      if (!e) return null;
      return e.read(cleanPath(path), opts || {});
    }
  }

  function getFetcher() {
    return window.main && window.main.dataFetcher;
  }

  function attachMount(mount) {
    var f = getFetcher();
    if (!f || !Array.isArray(f.mounts)) throw new Error('FoxPlanet data loader is not ready yet.');
    f.mounts.unshift(mount);
    window.__PFP_LOCAL_MOUNT_ACTIVE = true;
    try { f.completedCache && f.completedCache.clear(); } catch (_) {}
    return mount;
  }

  function addFolderPath(mount, rel, file) {
    rel = cleanPath(rel);
    if (!rel) return;
    var parts = rel.split('/').filter(Boolean);
    var lower = parts.map(function (p) { return p.toLowerCase(); });
    var aliases = new Set([rel]);

    var gd = lower.lastIndexOf('gamedata');
    if (gd >= 0 && gd + 1 < parts.length) aliases.add(parts.slice(gd + 1).join('/'));

    for (var i = 0; i < parts.length; i++) {
      var p = lower[i];
      if (p === 'starfoxadventures' || p === 'starfoxadventuresdemo' || p === 'dinosaurplanet' || p === 'dinosaurplanet_vanilla' || p === 'sequence-data') {
        aliases.add(parts.slice(i).join('/'));
        break;
      }
    }

    aliases.forEach(function (a) { mount.add(a, new BlobEntry(file)); });
  }

  async function mountFolderFiles(files) {
    if (!files || !files.length) throw new Error('No files selected.');
    var mount = new MapMount('Local GameData');
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      addFolderPath(mount, file.webkitRelativePath || file.name, file);
    }
    attachMount(mount);
    return { files: files.length, label: mount.label };
  }

  function u32be(view, offs) { return view.getUint32(offs, false); }

  function readCString(bytes, start) {
    var end = start;
    while (end < bytes.length && bytes[end] !== 0) end++;
    return new TextDecoder('utf-8').decode(bytes.subarray(start, end));
  }

  function safePart(s) {
    s = String(s || '').replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+$/, '_').trim();
    return s;
  }

  async function makeGameCubeMount(file, prefix) {
    if (file.size < 0x440) throw new Error('That file is too small to be a GameCube ISO/GCM.');
    var header = new DataView(await file.slice(0, 0x440).arrayBuffer());
    var fstOffset = u32be(header, 0x424);
    var fstSize = u32be(header, 0x428);
    if (!fstOffset || !fstSize || fstOffset + fstSize > file.size) throw new Error('Could not find the GameCube file table in this ISO/GCM.');

    var fstBuffer = await file.slice(fstOffset, fstOffset + fstSize).arrayBuffer();
    var fst = new DataView(fstBuffer);
    var bytes = new Uint8Array(fstBuffer);
    var rootType = u32be(fst, 0) >>> 24;
    var entryCount = u32be(fst, 8);
    if (rootType !== 1 || entryCount < 1 || entryCount > 200000) throw new Error('The GameCube file table looks wrong.');
    var strings = entryCount * 0x0C;
    if (strings >= fstBuffer.byteLength) throw new Error('The GameCube filename table looks wrong.');

    var mount = new MapMount(prefix + ' ISO');
    var fileCount = 0;

    function walkDir(dirIndex, parent) {
      var dirEnd = u32be(fst, dirIndex * 0x0C + 8);
      var i = dirIndex + 1;
      while (i < dirEnd && i < entryCount) {
        var o = i * 0x0C;
        var tn = u32be(fst, o);
        var type = tn >>> 24;
        var nameOffs = tn & 0x00FFFFFF;
        var name = safePart(readCString(bytes, strings + nameOffs));
        if (!name) { i++; continue; }
        var rel = parent ? parent + '/' + name : name;
        if (type === 1) {
          var next = u32be(fst, o + 8);
          walkDir(i, rel);
          i = next > i ? next : i + 1;
        } else {
          var off = u32be(fst, o + 4);
          var size = u32be(fst, o + 8);
          if (off + size <= file.size) {
            mount.add(prefix + '/' + rel, new BlobEntry(file, off, size));
            fileCount++;
          }
          i++;
        }
      }
    }

    walkDir(0, '');
    attachMount(mount);
    var gameId = new TextDecoder('ascii').decode(new Uint8Array(await file.slice(0, Math.min(6, file.size)).arrayBuffer()));
    return { files: fileCount, gameId: gameId, label: mount.label };
  }

  class RomReader {
    constructor(file, mode) { this.file = file; this.mode = mode; }
    async read(offset, size) {
      var a = offset & ~3;
      var b = (offset + size + 3) & ~3;
      var raw = new Uint8Array(await this.file.slice(a, b).arrayBuffer());
      if (this.mode === 'v64') {
        for (var i = 0; i + 1 < raw.length; i += 2) { var t = raw[i]; raw[i] = raw[i + 1]; raw[i + 1] = t; }
      } else if (this.mode === 'n64') {
        for (var j = 0; j + 3 < raw.length; j += 4) {
          var a0 = raw[j], a1 = raw[j + 1]; raw[j] = raw[j + 3]; raw[j + 1] = raw[j + 2]; raw[j + 2] = a1; raw[j + 3] = a0;
        }
      }
      var begin = offset - a;
      return raw.slice(begin, begin + size).buffer;
    }
  }

  async function inflateRaw(buffer) {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot unpack the Dinosaur Planet files. Chrome or Edge should work.');
    var stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer();
  }

  var DP_FILES = {
    'ENVFXACT.bin':[0x03B06CF4,98304], 'FONTS.bin':[0x01FE9EFE,13444],
    'AMBIENT.bin':[0x009D65E0,1232408], 'AMBIENT.tab':[0x009D65D0,16],
    'ANIM.bin':[0x0347D752,3395584], 'ANIM.tab':[0x0347B36E,9188],
    'AUDIO.bin':[0x000A4B0C,1156476], 'AUDIO.tab':[0x000A4AA0,108],
    'BLOCKS.bin':[0x02CCBE42,5849138], 'BLOCKS.tab':[0x0325FE74,4416],
    'HITS.bin':[0x03261024,166016], 'HITS.tab':[0x032898A4,4412],
    'MAPS.bin':[0x020E083A,750576], 'MAPS.tab':[0x02197C2A,2752],
    'MAPSETUP.ind':[0x0219932A,200], 'MAPSETUP.tab':[0x021993F2,3372],
    'MODELIND.bin':[0x03477548,2838], 'MODELS.bin':[0x0328B9F8,2014032], 'MODELS.tab':[0x0328A9E0,4120],
    'MPEG.bin':[0x010A4518,14444228], 'MPEG.tab':[0x010A34F0,4136],
    'MUSIC.bin':[0x00B03408,5898472], 'MUSIC.tab':[0x00B033F8,16], 'MUSICACTIONS.bin':[0x01E6ABDC,16384],
    'SAVEGAME.bin':[0x037E562E,6144], 'SAVEGAME.tab':[0x037E6E2E,12],
    'SCREENS.bin':[0x02003074,307232], 'SCREENS.tab':[0x0204E094,16],
    'SFX.bin':[0x001BF098,8484152], 'SFX.tab':[0x001BF088,16],
    'TABLES.bin':[0x02002D24,780], 'TABLES.tab':[0x02003030,68], 'TEXTABLE.bin':[0x02976156,2832],
    'TEX1.bin':[0x0219A11E,8226592], 'TEX1.tab':[0x0297283E,14616],
    'TEX0.bin':[0x02976C66,3490176], 'TEX0.tab':[0x02CCADE6,4188],
    'TRKBLK.bin':[0x03260FB4,112], 'FILE_1A.bin':[0x0204E0A4,8448], 'FILE_1B.tab':[0x020501A4,6],
    'VOXMAP.tab':[0x020501AA,4416], 'VOXMAP.bin':[0x020512EA,585552], 'WARPTAB.bin':[0x020E023A,1536],
    'VOXOBJ.tab':[0x0008D210,8], 'WEAPONDATA.bin':[0x037E0DE6,11832],
    'GAMETEXT.bin':[0x01FED382,0x00010FBE], 'GAMETEXT.tab':[0x01FFE340,0x00004798],
    'OBJECTS.bin':[0x037EEB42,249796], 'OBJINDEX.bin':[0x0382BB06,2934]
  };

  var DP_OBJINDEX_FIX = [[0x0ADE,0x04],[0x0ADF,0xFE],[0x0AE0,0x04],[0x0AE2,0x05],[0x0AE3,0x03],[0x0AF4,0x05],[0x0AF5,0x02],[0x0B04,0x05],[0x0B05,0x01],[0x0B10,0x05],[0x0B11,0x00],[0x0B12,0x04],[0x0B13,0xFD],[0x0B14,0x04],[0x0B15,0xFC],[0x0B50,0x04],[0x0B51,0xFB],[0x0B68,0x04],[0x0B69,0xF5],[0x0B6A,0x04],[0x0B6B,0xF6],[0x0B6C,0x04],[0x0B6D,0xF7],[0x0B6E,0x04],[0x0B6F,0xF8],[0x0B70,0x04],[0x0B71,0xF9],[0x0B72,0x04],[0x0B73,0xFA]];

  class DpRomMount {
    constructor(reader) {
      this.reader = reader;
      this.label = 'Dinosaur Planet ROM';
      this.cache = new Map();
      this.tabCache = new Map();
    }
    async rawFile(name) {
      if (this.cache.has(name)) return this.cache.get(name);
      var info = DP_FILES[name];
      if (!info) return null;
      var buf = await this.reader.read(info[0], info[1]);
      if (name === 'OBJINDEX.bin') {
        var u = new Uint8Array(buf.slice(0));
        DP_OBJINDEX_FIX.forEach(function (p) { if (p[0] < u.length) u[p[0]] = p[1]; });
        buf = u.buffer;
      }
      this.cache.set(name, buf);
      return buf;
    }
    async objectsTab() {
      if (this.cache.has('OBJECTS.tab')) return this.cache.get('OBJECTS.tab');
      var raw = new Uint8Array(await this.reader.read(0x037ED766, 5868));
      var out = new Uint8Array(6104); out.fill(0xFF); out.set(raw);
      this.cache.set('OBJECTS.tab', out.buffer);
      return out.buffer;
    }
    async tab32(name) {
      if (this.tabCache.has(name)) return this.tabCache.get(name);
      var buf = await this.rawFile(name), dv = new DataView(buf), out = [];
      for (var i = 0; i + 4 <= dv.byteLength; i += 4) out.push(dv.getUint32(i, false));
      this.tabCache.set(name, out); return out;
    }
    findNext(entries, i, size) {
      for (var n = i + 1; n < entries.length; n++) if (entries[n] !== 0 && entries[n] !== 0xFFFFFFFF) return entries[n];
      return size;
    }
    async unpackBlock(index) {
      var key = 'b:' + index; if (this.cache.has(key)) return this.cache.get(key);
      var e = await this.tab32('BLOCKS.tab'), start = e[index];
      if (start === undefined || start === 0xFFFFFFFF || (start === 0 && index !== 0)) return null;
      var end = this.findNext(e, index, DP_FILES['BLOCKS.bin'][1]);
      var packed = await this.reader.read(DP_FILES['BLOCKS.bin'][0] + start + 9, Math.max(0, end - start - 9));
      var out = await inflateRaw(packed); this.cache.set(key, out); return out;
    }
    async unpackModel(index) {
      var key = 'm:' + index; if (this.cache.has(key)) return this.cache.get(key);
      var e = await this.tab32('MODELS.tab'), start = e[index];
      if (start === undefined || start === 0 || start === 0xFFFFFFFF) return null;
      var end = this.findNext(e, index, DP_FILES['MODELS.bin'][1]);
      var packed = await this.reader.read(DP_FILES['MODELS.bin'][0] + start + 13, Math.max(0, end - start - 13));
      var out = await inflateRaw(packed); this.cache.set(key, out); return out;
    }
    async texEntries(tabName) {
      var key='te:'+tabName; if (this.tabCache.has(key)) return this.tabCache.get(key);
      var buf=await this.rawFile(tabName), dv=new DataView(buf), out=[];
      for(var i=0;i+4<=dv.byteLength;i+=4){var v=dv.getUint32(i,false); if(v===0xFFFFFFFF) break; out.push({frames:(v>>>24)&255, offset:v&0x00FFFFFF});}
      this.tabCache.set(key,out); return out;
    }
    async unpackTexture(bank, index) {
      var key='t:'+bank+':'+index; if(this.cache.has(key)) return this.cache.get(key);
      var tabName=bank==='tex0'?'TEX0.tab':'TEX1.tab', binName=bank==='tex0'?'TEX0.bin':'TEX1.bin';
      var e=await this.texEntries(tabName); if(index<0||index+1>=e.length) return null;
      var start=e[index].offset, end=e[index+1].offset; if(start>=end||end>DP_FILES[binName][1]) return null;
      if(e[index].frames>1) start += 8*(e[index].frames+1);
      if(start+5>=end) return null;
      var packed=await this.reader.read(DP_FILES[binName][0]+start+5,end-start-5);
      var out=await inflateRaw(packed); this.cache.set(key,out); return out;
    }
    async fetchData(path, opts) {
      var p=cleanPath(path); if(!/^dinosaurplanet\//i.test(p)) return null;
      var name=p.replace(/^dinosaurplanet\//i,''); var buf=null;
      if(name==='OBJECTS.tab') buf=await this.objectsTab();
      else if(name==='CACHEFON.bin'||name==='CACHEFON2.bin'||name==='VOXOBJ.bin'||name==='OBJSEQ.bin'||name==='OBJSEQ.tab'||name==='OBJHITS.bin') buf=new ArrayBuffer(0);
      else if(DP_FILES[name]) buf=await this.rawFile(name);
      else {
        var m=name.match(/^uncompressed_blocks\/(\d+)\.bin$/i); if(m) buf=await this.unpackBlock(Number(m[1]));
        if(!m){m=name.match(/^uncompressed_models\/(\d+)\.bin$/i); if(m) buf=await this.unpackModel(Number(m[1]));}
        if(!m){m=name.match(/^uncompressed_textures\/(tex0|tex)_(\d+)\.bin$/i); if(m) buf=await this.unpackTexture(m[1].toLowerCase(),Number(m[2]));}
      }
      if(buf===null) return null;
      return makeSlice(buf,p,opts||{});
    }
  }

  async function makeDpRomMount(file) {
    if (file.size < 0x03B20000) throw new Error('That ROM is too small for the supported Dinosaur Planet build.');
    var magic = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    var sig = Array.from(magic).map(function (v) { return v.toString(16).padStart(2,'0'); }).join('');
    var mode = sig === '80371240' ? 'z64' : sig === '37804012' ? 'v64' : sig === '40123780' ? 'n64' : null;
    if (!mode) throw new Error('That does not look like an N64 ROM.');
    var mount = new DpRomMount(new RomReader(file, mode));
    attachMount(mount);
    return { label: mount.label, mode: mode.toUpperCase() };
  }

  function filePicker(opts) {
    return new Promise(function (resolve) {
      var input = document.createElement('input');
      input.type = 'file'; input.style.display = 'none';
      if (opts.accept) input.accept = opts.accept;
      if (opts.directory) { input.webkitdirectory = true; input.multiple = true; }
      document.body.appendChild(input);
      input.addEventListener('change', function () { var files = Array.from(input.files || []); input.remove(); resolve(files); }, { once:true });
      input.addEventListener('cancel', function () { input.remove(); resolve([]); }, { once:true });
      input.click();
    });
  }

  function button(text, fn) {
    var b=document.createElement('button'); b.textContent=text; b.type='button';
    b.style.cssText='padding:10px 12px;font:700 12px monospace;cursor:pointer;margin:4px 6px 4px 0;';
    b.onclick=fn; return b;
  }

  function installWebLandingCss() {
    if (document.getElementById('pfp-web-landing-fixes')) return;
    var style = document.createElement('style');
    style.id = 'pfp-web-landing-fixes';
    style.textContent = `
body.pfp-web-landing,
html:has(body.pfp-web-landing) {
  overflow-y: auto !important;
  overflow-x: hidden !important;
  height: auto !important;
  min-height: 100% !important;
}
body.pfp-web-landing .pfp-web-unclip {
  overflow: visible !important;
  max-height: none !important;
}
body.pfp-web-landing .pfp-web-game-landing {
  height: auto !important;
  min-height: 472px !important;
  padding-bottom: 22px !important;
}
body.pfp-web-landing #landing-version {
  margin-bottom: 18px !important;
}
#pfp-web-local-buttons {
  margin: 12px 0 14px !important;
  padding: 10px 10px 8px !important;
  border: 1px solid rgba(224,181,78,.20) !important;
  border-radius: 10px !important;
  background: rgba(0,0,0,.18) !important;
}
#pfp-web-local-buttons:before {
  content: 'WEB DATA';
  display: block;
  margin-bottom: 5px;
  color: #E0B54E;
  font: 800 11px monospace;
  letter-spacing: 1px;
}
#pfp-web-local-buttons button {
  border: 1px solid rgba(255,255,255,.20) !important;
  border-radius: 5px !important;
  background: rgba(255,255,255,.08) !important;
  color: #fff !important;
}
#pfp-web-local-buttons button:hover {
  background: rgba(224,181,78,.16) !important;
  border-color: rgba(224,181,78,.45) !important;
}
.pfp-clean-game-title {
  display: grid;
  place-items: center;
  width: min(86%, 300px);
  min-height: 72px;
  margin: 0 auto;
  padding: 12px 14px;
  box-sizing: border-box;
  border: 1px solid rgba(224,181,78,.22);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(21,43,76,.62), rgba(8,18,34,.45));
  color: #f4f7fb;
  font: 900 25px/1.05 monospace;
  letter-spacing: 1.4px;
  text-align: center;
  text-shadow: 0 2px 8px rgba(0,0,0,.8);
}
.pfp-clean-game-title[data-game='dp'] {
  color: #f0c66b;
  border-color: rgba(224,181,78,.28);
}
`;
    document.head.appendChild(style);
  }

  function unclipLanding() {
    installWebLandingCss();
    var isLanding = document.body && document.body.dataset && document.body.dataset.landing === '1';
    document.body && document.body.classList.toggle('pfp-web-landing', !!isLanding);
    if (!isLanding) return;

    var exact = Array.from(document.querySelectorAll('div,span,h1,h2,h3')).find(function (el) {
      return (el.textContent || '').trim().toUpperCase() === 'SELECT GAME';
    });
    if (exact && exact.parentElement) {
      var gameLanding = exact.parentElement;
      gameLanding.classList.add('pfp-web-game-landing', 'pfp-web-unclip');
      var n = gameLanding.parentElement;
      for (var i = 0; i < 5 && n && n !== document.body; i++, n = n.parentElement)
        n.classList.add('pfp-web-unclip');
    }

    var intro = Array.from(document.querySelectorAll('div')).find(function (el) {
      return (el.textContent || '').trim() === 'Explore released and development material from Star Fox Adventures and Dinosaur Planet';
    });
    if (intro && intro.parentElement) {
      intro.parentElement.classList.add('pfp-web-unclip');
      var p = intro.parentElement.parentElement;
      for (var j = 0; j < 4 && p && p !== document.body; j++, p = p.parentElement)
        p.classList.add('pfp-web-unclip');
    }
  }

  function cleanLandingArt() {
    var pics = {
      '48f1fc0f8c5be9e9c584.png':['STAR FOX ADVENTURES','sfa'],
      'a42fc47a0a079a2980f2.png':['DINOSAUR PLANET','dp']
    };
    document.querySelectorAll('img').forEach(function(img){
      var src=(img.getAttribute('src')||'').split('/').pop(); var info=pics[src]; if(!info||img.dataset.pfpTextLogo) return;
      img.dataset.pfpTextLogo='1'; img.style.display='none';
      var d=document.createElement('div'); d.textContent=info[0]; d.className='pfp-clean-game-title'; d.dataset.game=info[1];
      img.parentElement && img.parentElement.appendChild(d);
    });
  }

  function installUi() {
    unclipLanding();
    cleanLandingArt();
    if (STATIC_WEB) {
      document.querySelectorAll('button').forEach(function (b) {
        if (/^LOAD GAMEDATA FOLDER$/i.test((b.textContent || '').trim())) b.style.display = 'none';
      });
    }
    if (document.getElementById('pfp-web-local-buttons')) return;
    var old = Array.from(document.querySelectorAll('button')).find(function (b) { return /LOAD GAMEDATA FOLDER/i.test(b.textContent || ''); });
    if (!old || !old.parentElement) {
      var cards = Array.from(document.querySelectorAll('div')).filter(function (d) { return /Use your own local FoxPlanet GameData folder/i.test(d.textContent || ''); });
      if (!cards.length) return;
      old = { parentElement: cards[0] };
    }
    var wrap=document.createElement('div'); wrap.id='pfp-web-local-buttons'; wrap.style.cssText='margin-top:8px;max-width:520px;';
    var row=document.createElement('div'); wrap.appendChild(row);
    var status=document.createElement('div'); status.style.cssText='font:11px monospace;color:#aaa;line-height:1.35;margin-top:4px;white-space:pre-wrap;';
    status.textContent='Your files stay on this computer. Nothing gets uploaded.'; wrap.appendChild(status);
    function busy(s){status.textContent=s;}
    function done(s){status.textContent=s+'\nYour files stay on this computer. Nothing gets uploaded.';}
    function fail(e){status.textContent=(e&&e.message?e.message:String(e));}

    row.appendChild(button('LOAD EXISTING GAMEDATA', async function(){try{var fs=await filePicker({directory:true});if(!fs.length)return;busy('Reading GameData...');var r=await mountFolderFiles(fs);done('GameData ready - '+r.files+' files. Open a map to use it. Dont refresh the page or the browser will forget the folder.');}catch(e){fail(e);}}));
    row.appendChild(button('LOAD SFA ISO/GCM', async function(){try{var fs=await filePicker({accept:'.iso,.gcm'});if(!fs.length)return;busy('Reading SFA ISO file table...');var r=await makeGameCubeMount(fs[0],'StarFoxAdventures');done('SFA ISO ready ('+r.gameId.trim()+') - '+r.files+' files. Dont refresh the page while using it.');}catch(e){fail(e);}}));
    row.appendChild(button('LOAD KIOSK ISO/GCM', async function(){try{var fs=await filePicker({accept:'.iso,.gcm'});if(!fs.length)return;busy('Reading Kiosk ISO file table...');var r=await makeGameCubeMount(fs[0],'StarFoxAdventuresDemo');done('Kiosk ISO ready ('+r.gameId.trim()+') - '+r.files+' files. Dont refresh the page while using it. A few desktop-only patcher bits are not used on the website.');}catch(e){fail(e);}}));
    row.appendChild(button('LOAD DINOSAUR PLANET ROM', async function(){try{var fs=await filePicker({accept:'.z64,.n64,.v64'});if(!fs.length)return;busy('Reading Dinosaur Planet ROM...');var r=await makeDpRomMount(fs[0]);done('Dinosaur Planet ROM ready ('+r.mode+'). Files are unpacked only when FoxPlanet asks for them. Dont refresh the page while using it.');}catch(e){fail(e);}}));

    var introNode = Array.from(document.querySelectorAll('div')).find(function (d) {
      return (d.textContent || '').trim() === 'Explore released and development material from Star Fox Adventures and Dinosaur Planet';
    });
    if (introNode && introNode.parentElement) {
      introNode.parentElement.insertBefore(wrap, introNode.nextSibling);
    } else {
      old.parentElement.appendChild(wrap);
    }
    unclipLanding();
  }

  window.__PFP_WEB_LOCAL_DATA = {
    mountFolderFiles: mountFolderFiles,
    mountSfaIso: function (file) { return makeGameCubeMount(file,'StarFoxAdventures'); },
    mountKioskIso: function (file) { return makeGameCubeMount(file,'StarFoxAdventuresDemo'); },
    mountDpRom: makeDpRomMount
  };

  var obs=new MutationObserver(function(){installUi();});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',function(){setTimeout(installUi,50);setTimeout(installUi,500);});
  setInterval(installUi,1500);
})();
