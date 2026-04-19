import * as Viewer from '../viewer.js';
import * as UI from '../ui.js';

import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import { SceneContext } from '../SceneBase.js';
import { DataFetcher } from '../DataFetcher.js';

import { SFAAnimationController } from './animation.js';
import { MaterialFactory } from './materials.js';
import { SFARenderer } from './render.js';
import { GameInfo } from './scenes.js';
import { SFATextureFetcher } from './textures.js';

const LANGUAGE_NAMES = [
  'English',
  'Français',
  'Deutsch',
  'Español',
  'Italiano',
];
const DP_FONT_DINO_SUBTITLE_FONT_1 = 1;
const DP_FONT_DINO_SUBTITLE_FONT_2 = 2;

const DP_SUBTITLE_FONT_ID = DP_FONT_DINO_SUBTITLE_FONT_1;
const DP_GAMETEXT_OVERLAY_ID = 'dp-gametext-overlay';
const DP_GAMETEXT_FLOATING_PANEL_ID = 'dp-gametext-floating-panel';
const DP_FONT_SIZE = 0x8C0;
const DP_FONT_TEXTURE_IDS_OFFS = 0x40;
const DP_FONT_X_OFFS = 0x20;
const DP_FONT_Y_OFFS = 0x22;
const DP_FONT_CHAR_WIDTH_OFFS = 0x24;
const DP_FONT_CHAR_HEIGHT_OFFS = 0x26;

const DP_FONT_GLYPHS_OFFS = 0x1C0;
const DP_FONT_GLYPH_COUNT = 224;
type ParagraphAlign = 'center' | 'left';

interface ParsedTextRun {
  text: string;
  color: string;
  isIcon: boolean;
}

interface ParsedParagraph {
  durationMs: number;
  align: ParagraphAlign;
  verticalCenter: boolean;
  runs: ParsedTextRun[];
}

interface ParsedGameTextEntry {
  id: number;
  offset: number;
  size: number;
  commandCount: number;
  commands: number[];
  strings: string[];
  preview: string;
  paragraphs: ParsedParagraph[];
}

interface DPFontGlyph {
  textureIndex: number;
  kerning: number;
  offsetX: number;
  offsetY: number;
  textureU: number;
  textureV: number;
  width: number;
  height: number;
}

interface DPSubtitleFont {
    name: string;
    x: number;
    y: number;
    charWidth: number;
    charHeight: number;
    textureIds: number[];
    glyphs: DPFontGlyph[];
    lineHeight: number;
    spaceAdvance: number;
    atlasCanvases: Map<number, HTMLCanvasElement>;
}

type CanvasLineItem =
  | { kind: 'glyph'; glyph: DPFontGlyph; texId: number; color: string; advance: number; }
  | { kind: 'space'; advance: number; }
  | { kind: 'icon'; token: string; color: string; advance: number; };

export class DPGameTextRenderer extends SFARenderer {
  private gameInfo!: GameInfo;
  private dataFetcher!: DataFetcher;

  private languageId = 0;
  private entries: ParsedGameTextEntry[] = [];
  private visibleEntries: ParsedGameTextEntry[] = [];
  private currentVisibleIndex = -1;
  private searchText = '';

  private resultsLabel: HTMLElement | null = null;
  private rawPre: HTMLPreElement | null = null;
  private entryIdInput: HTMLInputElement | null = null;
private floatingPanelRoot: HTMLDivElement | null = null;
private floatingEntryIdInput: HTMLInputElement | null = null;
private floatingSearchInput: HTMLInputElement | null = null;
private floatingResultsLabel: HTMLDivElement | null = null;
private floatingPlayPauseButton: HTMLButtonElement | null = null;
private floatingLoopCheckbox: HTMLInputElement | null = null;
private floatingSpeedSelect: HTMLSelectElement | null = null;
  private overlayRoot: HTMLDivElement | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;

  private subtitleFontFetcher: SFATextureFetcher | null = null;
  private subtitleFont: DPSubtitleFont | null = null;
  private subtitleAtlasCanvases = new Map<number, HTMLCanvasElement>();

  private glyphScratchCanvas: HTMLCanvasElement | null = null;
  private glyphScratchCtx: CanvasRenderingContext2D | null = null;

  private isPlaying = true;
  private loopPlayback = true;
  private currentParagraphIndex = 0;
  private paragraphTimeLeftMs = 0;
  private paragraphDurationMs = 0;

  private readonly subtitleScale = 3.0;
private subtitleDurationScale = 2.3;
private readonly subtitleMaxTextWidth = 634;
private uiVisible = true;
public async create(gameInfo: GameInfo, dataFetcher: DataFetcher): Promise<Viewer.SceneGfx> {
  this.gameInfo = gameInfo;
  this.dataFetcher = dataFetcher;

  this.removeStaleDOM();
  this.ensureOverlay();
  this.ensureFloatingPanel();

  await this.loadLanguage(0);

  void this.loadSubtitleFont().then(() => {
    this.updateOverlay();
  }).catch((e) => {
    console.warn('Background subtitle font load failed', e);
  });

  return this;
}

public setUIVisible(visible: boolean): void {
  this.uiVisible = visible;

  if (this.floatingPanelRoot !== null)
    this.floatingPanelRoot.style.display = visible ? 'block' : 'none';

  if (!visible) {
    this.hideOverlay();
    return;
  }

  this.updateOverlay();
}

public tick(viewerInput: Viewer.ViewerRenderInput): void {
  this.update(viewerInput);
}



  public override destroy(device: GfxDevice): void {
    this.subtitleFontFetcher?.destroy(this.materialFactory.device);
    this.subtitleFontFetcher = null;
    this.subtitleAtlasCanvases.clear();

    this.destroyOverlay();
    super.destroy(device);
  }

  protected override update(viewerInput: Viewer.ViewerRenderInput): void {
    super.update(viewerInput);

    if (!this.isPlaying)
      return;

    const entry = this.getCurrentEntry();
    if (entry === null || entry.paragraphs.length === 0)
      return;

    this.paragraphTimeLeftMs -= viewerInput.deltaTime;

    while (this.paragraphTimeLeftMs <= 0) {
      this.currentParagraphIndex++;

      if (this.currentParagraphIndex >= entry.paragraphs.length) {
        if (!this.loopPlayback) {
          this.currentParagraphIndex = entry.paragraphs.length - 1;
          this.paragraphTimeLeftMs = 0;
this.paragraphDurationMs = this.scaleDurationMs(entry.paragraphs[this.currentParagraphIndex].durationMs);
          this.updateOverlay();
          return;
        }

        this.currentParagraphIndex = 0;
      }

      this.startCurrentParagraph(false);
    }

    this.updateOverlayFade();
  }

  private getCurrentEntry(): ParsedGameTextEntry | null {
    if (this.currentVisibleIndex < 0 || this.currentVisibleIndex >= this.visibleEntries.length)
      return null;
    return this.visibleEntries[this.currentVisibleIndex];
  }

private removeStaleDOM(): void {
  document.getElementById(DP_GAMETEXT_OVERLAY_ID)?.remove();
  document.getElementById(DP_GAMETEXT_FLOATING_PANEL_ID)?.remove();
}

private scaleDurationMs(durationMs: number): number {
  return Math.max(1, Math.round(durationMs * this.subtitleDurationScale));
}

  private async loadLanguage(languageId: number): Promise<void> {
    const pathBase = this.gameInfo.pathBase;

    const [tabBuf, binBuf] = await Promise.all([
      this.dataFetcher.fetchData(`${pathBase}/GAMETEXT.tab`),
      this.dataFetcher.fetchData(`${pathBase}/GAMETEXT.bin`),
    ]);

    const tab = tabBuf.createDataView();
    const bin = binBuf.createDataView();

    const languageCount = tab.getUint16(0);
    const gametextCount = tab.getUint16(2);

    if (languageId < 0 || languageId >= languageCount)
      throw new Error(`Invalid GameText language id ${languageId}`);

    const languageTabSize = 4 + gametextCount + (gametextCount * 2) + (gametextCount * 2);
    const languageTabBase = 4 + (languageId * languageTabSize);

    const languageOffset = tab.getUint32(languageTabBase + 0);
    const commandCountBase = languageTabBase + 4;
    const sizeBase = commandCountBase + gametextCount;
    const offsetBase = sizeBase + (gametextCount * 2);

    const entries: ParsedGameTextEntry[] = [];

    for (let i = 0; i < gametextCount; i++) {
      const commandCount = tab.getUint8(commandCountBase + i);
      const size = tab.getUint16(sizeBase + (i * 2));
      const relativeOffset = tab.getUint16(offsetBase + (i * 2)) * 2;
      const absoluteOffset = languageOffset + relativeOffset;

      entries.push(this.parseEntry(bin, i, absoluteOffset, size, commandCount));
    }

    this.languageId = languageId;
    this.entries = entries;
    this.rebuildVisibleEntries();
  }


  
  private parseEntry(
    bin: DataView,
    id: number,
    offset: number,
    size: number,
    commandCount: number,
  ): ParsedGameTextEntry {
    const safeEnd = Math.min(bin.byteLength, offset + size);
    const commands: number[] = [];

    for (let i = 0; i < commandCount; i++) {
      const cmdOffs = offset + (i * 2);
      if (cmdOffs + 2 > safeEnd)
        break;
      commands.push(bin.getInt16(cmdOffs));
    }

    const strings: string[] = [];
    let ptr = offset + (commandCount * 2);

    for (let i = 0; i < commandCount && ptr < safeEnd; i++) {
      const str = this.readCString(bin, ptr, safeEnd);
      strings.push(str.text);
      ptr = str.next;
    }

    while (strings.length < commands.length)
      strings.push('');

    const paragraphs = this.buildParagraphs(commands, strings);
    const preview = this.buildPreview(paragraphs);

    return {
      id,
      offset,
      size,
      commandCount,
      commands,
      strings,
      preview,
      paragraphs,
    };
  }

  private readCString(bin: DataView, start: number, end: number): { text: string; next: number } {
    const bytes: number[] = [];
    let ptr = start;

    while (ptr < end) {
      const b = bin.getUint8(ptr++);
      if (b === 0)
        break;
      bytes.push(b);
    }

    return {
      text: bytes.map((b) => String.fromCharCode(b)).join(''),
      next: ptr,
    };
  }

  private readAsciiZ(dv: DataView, start: number, maxLen: number): string {
    const chars: number[] = [];

    for (let i = 0; i < maxLen; i++) {
      const c = dv.getUint8(start + i);
      if (c === 0)
        break;
      chars.push(c);
    }

    return chars.map((c) => String.fromCharCode(c)).join('');
  }

  private commandToken(cmd: number): string {
    const u = cmd & 0xFFFF;

    switch (u) {
    case 0xFEFE: return '[A]';
    case 0xFEFD: return '[B]';
    case 0xFEFC: return '[C-Left]';
    case 0xFEFB: return '[C-Right]';
    case 0xFEFA: return '[C-Down]';
    case 0xFEF9: return '[Z]';
    case 0xFEF8: return '[Stick]';
    default: return '';
    }
  }

  private formatCommand(cmd: number): string {
    const u = cmd & 0xFFFF;
    return `0x${u.toString(16).toUpperCase().padStart(4, '0')}`;
  }

private subtitleColorFromCommand(cmd: number): string | null {
    if (cmd >= 0 || cmd < -255)
      return null;
    const payload = ((cmd & 0xFF) - 1) & 0xFF;

    const rawR2 = (payload & 0b11000000) >> 6;
    const rawG2 = (payload & 0b00110000) >> 4;
    const rawB2 = (payload & 0b00001100) >> 2;
    const rawA2 = (payload & 0b00000011);

    const r2 = 3 - rawR2;
    const g2 = 3 - rawG2;
    const b2 = 3 - rawB2;

    const rgb2Possibilities = [0, 72, 150, 255];
    const a2Possibilities = [255, 191, 127, 63];

    const r = rgb2Possibilities[r2];
    const g = rgb2Possibilities[g2];
    const b = rgb2Possibilities[b2];
    const a = a2Possibilities[rawA2] / 255.0;

    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  private buildParagraphs(commands: number[], strings: string[]): ParsedParagraph[] {
    const paragraphs: ParsedParagraph[] = [];

    let currentColor = 'rgba(255, 255, 255, 1)';
    let currentAlign: ParagraphAlign = 'center';
    let currentVerticalCenter = false;
    let currentRuns: ParsedTextRun[] = [];
    let currentDurationMs = 2500;

    const resetParagraphLayout = (): void => {
      currentAlign = 'center';
      currentVerticalCenter = false;
    };

    const pushText = (text: string): void => {
      if (text.length === 0)
        return;

      currentRuns.push({
        text,
        color: currentColor,
        isIcon: false,
      });
    };

    const pushIcon = (text: string): void => {
      if (text.length === 0)
        return;

      currentRuns.push({
        text,
        color: currentColor,
        isIcon: true,
      });
    };

    const finalizeParagraph = (): void => {
      if (currentRuns.length === 0)
        return;

      paragraphs.push({
        durationMs: Math.max(1, currentDurationMs),
        align: currentAlign,
        verticalCenter: currentVerticalCenter,
        runs: currentRuns,
      });

      currentRuns = [];
      resetParagraphLayout();
    };

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const text = strings[i] ?? '';

      if (cmd > 0) {
        if (currentRuns.length > 0)
          finalizeParagraph();

        currentDurationMs = cmd;
        resetParagraphLayout();
        pushText(text);
        continue;
      }

      if (cmd === 0) {
        pushText(text);
        pushText('\n');
        continue;
      }

      if (cmd === -256) {
        currentVerticalCenter = true;
        pushText(text);
        continue;
      }

      if (cmd === -257) {
        currentAlign = 'left';
        pushText(text);
        continue;
      }

      const color = this.subtitleColorFromCommand(cmd);
      if (color !== null) {
        currentColor = color;
        pushText(text);
        continue;
      }

      const token = this.commandToken(cmd);
      if (token.length > 0) {
        pushIcon(token);
        pushText(text);
        continue;
      }

      pushText(text);
    }

    if (currentRuns.length > 0)
      finalizeParagraph();

    if (paragraphs.length === 0) {
      const merged = strings.join('');
      if (merged.length > 0) {
        paragraphs.push({
          durationMs: 2500,
          align: 'center',
          verticalCenter: false,
          runs: [{
            text: merged,
            color: 'rgba(255, 255, 255, 1)',
            isIcon: false,
          }],
        });
      }
    }

    return paragraphs;
  }

  private buildPreview(paragraphs: ParsedParagraph[]): string {
    return paragraphs.map((p) => {
      const text = p.runs.map((r) => r.text).join('');
      return `[${p.durationMs} ms] ${text}`;
    }).join('\n\n');
  }

  private rebuildVisibleEntries(): void {
    const q = this.searchText.trim().toLowerCase();

    if (q.length === 0) {
      this.visibleEntries = this.entries.slice();
    } else {
      this.visibleEntries = this.entries.filter((entry) => {
        if (`${entry.id}` === q)
          return true;

        if (entry.preview.toLowerCase().includes(q))
          return true;

        return entry.strings.some((s) => s.toLowerCase().includes(q));
      });
    }

    this.currentVisibleIndex = this.visibleEntries.length > 0 ? 0 : -1;
    this.resetPlayback();
    this.syncUI();
  }

  private selectVisibleIndex(index: number): void {
    if (this.visibleEntries.length === 0)
      return;

    const clamped = Math.max(0, Math.min(index, this.visibleEntries.length - 1));
    this.currentVisibleIndex = clamped;
    this.resetPlayback();
    this.syncUI();
  }

  private selectEntryById(id: number): void {
    const idx = this.visibleEntries.findIndex((e) => e.id === id);
    if (idx >= 0) {
      this.selectVisibleIndex(idx);
      return;
    }

    const fullIdx = this.entries.findIndex((e) => e.id === id);
    if (fullIdx >= 0) {
      this.searchText = '';
      this.visibleEntries = this.entries.slice();
      this.currentVisibleIndex = fullIdx;
      this.resetPlayback();
      this.syncUI();
    }
  }

  private resetPlayback(): void {
    this.currentParagraphIndex = 0;
    this.paragraphTimeLeftMs = 0;
    this.paragraphDurationMs = 0;

    const entry = this.getCurrentEntry();
    if (entry === null) {
      this.hideOverlay();
      return;
    }

    const hasTiming = entry.commands.some((c) => c > 0);
    this.isPlaying = hasTiming;

    this.startCurrentParagraph(true);
  }

  private startCurrentParagraph(_forceShow: boolean): void {
    const entry = this.getCurrentEntry();
    if (entry === null || entry.paragraphs.length === 0) {
      this.hideOverlay();
      return;
    }

    if (this.currentParagraphIndex < 0 || this.currentParagraphIndex >= entry.paragraphs.length)
      this.currentParagraphIndex = 0;

    const paragraph = entry.paragraphs[this.currentParagraphIndex];
   this.paragraphDurationMs = this.scaleDurationMs(paragraph.durationMs);
this.paragraphTimeLeftMs = this.paragraphDurationMs;
    this.updateOverlay();
  }

private parseDinoSubtitleFont(fontsDv: DataView): Omit<DPSubtitleFont, 'atlasCanvases'> {
  const fontCount = fontsDv.getUint32(0);
  if (DP_SUBTITLE_FONT_ID < 0 || DP_SUBTITLE_FONT_ID >= fontCount)
    throw new Error(`FONTS.bin does not contain subtitle font index ${DP_SUBTITLE_FONT_ID}`);

  const fontBase = 4 + (DP_SUBTITLE_FONT_ID * DP_FONT_SIZE);

  const name = this.readAsciiZ(fontsDv, fontBase + 0x00, 0x20);

  const x = fontsDv.getUint16(fontBase + DP_FONT_X_OFFS);
  const y = fontsDv.getUint16(fontBase + DP_FONT_Y_OFFS);
  const charWidth = fontsDv.getUint16(fontBase + DP_FONT_CHAR_WIDTH_OFFS);
  const charHeight = fontsDv.getUint16(fontBase + DP_FONT_CHAR_HEIGHT_OFFS);

  const textureIds: number[] = [];
  for (let i = 0; i < 64; i++)
    textureIds.push(fontsDv.getInt16(fontBase + DP_FONT_TEXTURE_IDS_OFFS + (i * 2)));

  const glyphs: DPFontGlyph[] = [];

  for (let i = 0; i < DP_FONT_GLYPH_COUNT; i++) {
    const offs = fontBase + DP_FONT_GLYPHS_OFFS + (i * 8);

    const glyph: DPFontGlyph = {
      textureIndex: fontsDv.getUint8(offs + 0),
      kerning: fontsDv.getUint8(offs + 1),
      offsetX: fontsDv.getInt8(offs + 2),
      offsetY: fontsDv.getInt8(offs + 3),
      textureU: fontsDv.getUint8(offs + 4),
      textureV: fontsDv.getUint8(offs + 5),
      width: fontsDv.getUint8(offs + 6),
      height: fontsDv.getUint8(offs + 7),
    };

    glyphs.push(glyph);
  }

  return {
    name,
    x,
    y,
    charWidth,
    charHeight,
    textureIds,
    glyphs,
    lineHeight: y,
    spaceAdvance: charWidth,
  };
}

private getGlyphForCharCode(charCode: number): DPFontGlyph | null {
  if (this.subtitleFont === null)
    return null;

  if (charCode <= 0x20 || charCode >= 0x100)
    return null;

  const glyphIndex = charCode - 0x20;
  const glyph = this.subtitleFont.glyphs[glyphIndex];

  if (glyph === undefined || glyph.textureIndex === 0xFF)
    return null;

  return glyph;
}

private async loadSubtitleFont(): Promise<void> {
  try {
    const fontsBin = await this.dataFetcher.fetchData(`${this.gameInfo.pathBase}/FONTS.bin`);
    const parsedFont = this.parseDinoSubtitleFont(fontsBin.createDataView());

    //console.log(
    //  'DinoSubtitleFont1 parsed',
    //  parsedFont.name,
   //   'textureIds',
   //   parsedFont.textureIds.filter((id) => id >= 0).slice(0, 32),
  //  );

    this.subtitleFontFetcher = await SFATextureFetcher.create(this.gameInfo, this.dataFetcher, false);
    this.subtitleAtlasCanvases.clear();

    const neededTextureIds = new Set<number>();

    // Load every page used by the subtitle font.
    for (const texId of parsedFont.textureIds) {
      if (texId >= 0)
        neededTextureIds.add(texId);
    }

  //  console.log('DinoSubtitleFont1 needed TEX pages', [...neededTextureIds]);

    for (const texId of neededTextureIds) {
      const canvas = await waitForDPFontTextureCanvas(
        this.subtitleFontFetcher,
        this.materialFactory.cache,
        texId,
        4000,
      );

      if (canvas === null) {
      //  console.warn('DinoSubtitleFont1 missing TEX page', texId);
        continue;
      }

      this.subtitleAtlasCanvases.set(texId, canvas);
    }

    this.subtitleFont = {
      ...parsedFont,
      atlasCanvases: this.subtitleAtlasCanvases,
    };

   // console.log(
    //  'DinoSubtitleFont1 ready',
    //  this.subtitleFont.name,
    //  'atlasCount',
   //   this.subtitleAtlasCanvases.size,
   // );

    this.updateOverlay();
  } catch (e) {
   // console.warn('Failed to load DinoSubtitleFont1', e);
    this.subtitleFont = null;
    this.subtitleFontFetcher?.destroy(this.materialFactory.device);
    this.subtitleFontFetcher = null;
    this.subtitleAtlasCanvases.clear();
  }
}

private getGlyphAdvance(glyph: DPFontGlyph): number {
  const font = this.subtitleFont;
  if (font === null)
    return 8;

  if (font.x !== 0)
    return font.x;

  if (glyph.kerning !== 0)
    return glyph.kerning;

  return font.charWidth;
}

  private getButtonAdvance(token: string): number {
    const label = token.startsWith('[') && token.endsWith(']') ? token.slice(1, -1) : token;

    if (label === 'Stick')
      return 78;

    if (label.indexOf('C-') === 0)
      return 64;

    return 42;
  }

private getLineItemAdvance(item: CanvasLineItem): number {
  return item.advance;
}

private measureLineItems(items: CanvasLineItem[]): number {
  let width = 0;
  for (const item of items)
    width += this.getLineItemAdvance(item);
  return width;
}

private buildCanvasLineItems(paragraph: ParsedParagraph, font: DPSubtitleFont, scale: number): CanvasLineItem[] {
  const items: CanvasLineItem[] = [];

  for (const run of paragraph.runs) {
    if (run.isIcon) {
      items.push({
        kind: 'icon',
        token: run.text,
        color: run.color,
        advance: this.getButtonAdvance(run.text),
      });
      continue;
    }

    for (let i = 0; i < run.text.length; i++) {
      const ch = run.text.charAt(i);

      if (ch === '\n') {
        items.push({
          kind: 'icon',
          token: '\n',
          color: run.color,
          advance: -1,
        });
        continue;
      }

      if (ch === '\r')
        continue;

      if (ch === '\t') {
        items.push({
          kind: 'space',
          advance: font.charHeight * scale,
        });
        continue;
      }

      if (ch === ' ') {
        items.push({
          kind: 'space',
          advance: font.charWidth * scale,
        });
        continue;
      }

      const charCode = run.text.charCodeAt(i) & 0xFF;
      const glyph = this.getGlyphForCharCode(charCode);

      if (glyph === null) {
        items.push({
          kind: 'space',
          advance: font.charWidth * scale,
        });
        continue;
      }

      const texId = font.textureIds[glyph.textureIndex] ?? -1;
      if (texId < 0 || glyph.width === 0 || glyph.height === 0) {
        items.push({
          kind: 'space',
          advance: font.charWidth * scale,
        });
        continue;
      }

      items.push({
        kind: 'glyph',
        glyph,
        texId,
        color: run.color,
        advance: this.getGlyphAdvance(glyph) * scale,
      });
    }
  }

  return items;
}

private wrapCanvasLineItems(items: CanvasLineItem[], maxWidth: number): CanvasLineItem[][] {
  const lines: CanvasLineItem[][] = [];
  let line: CanvasLineItem[] = [];
  let lineWidth = 0;

  let word: CanvasLineItem[] = [];
  let wordWidth = 0;

  const flushWord = (): void => {
    if (word.length === 0)
      return;
    if (line.length > 0 && lineWidth + wordWidth >= maxWidth) {
      lines.push(line);
      line = [];
      lineWidth = 0;
    }

    line.push(...word);
    lineWidth += wordWidth;

    word = [];
    wordWidth = 0;
  };

  const pushLine = (): void => {
    flushWord();
    lines.push(line);
    line = [];
    lineWidth = 0;
  };

  for (const item of items) {
    if (item.kind === 'icon' && item.token === '\n' && item.advance === -1) {
      pushLine();
      continue;
    }

    if (item.kind === 'space') {
      flushWord();

      // The game suppresses the wrapping-space advance right after a wrap.
      if (line.length > 0) {
        line.push(item);
        lineWidth += item.advance;
      }

      continue;
    }

    word.push(item);
    wordWidth += item.advance;
  }

  flushWord();

  if (line.length > 0 || lines.length === 0)
    lines.push(line);

  return lines;
}

  private fillRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const rr = Math.min(r, Math.floor(Math.min(w, h) / 2));

    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  private drawButtonToken(
    ctx: CanvasRenderingContext2D,
    token: string,
    x: number,
    y: number,
    h: number,
    alpha: number,
  ): void {
    const label = token.startsWith('[') && token.endsWith(']') ? token.slice(1, -1) : token;
    const w = this.getButtonAdvance(token);

    ctx.save();
    ctx.globalAlpha = alpha;

    this.fillRoundRect(ctx, x, y + 6, w, h - 12, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.50)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + (w / 2), y + (h / 2));

    ctx.restore();
  }

private parseRGBAColor(color: string): { r: number; g: number; b: number; a: number } {
  const m = color.match(/rgba?\s*\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/);

  if (m === null) {
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  return {
    r: Math.max(0, Math.min(255, Number(m[1]))),
    g: Math.max(0, Math.min(255, Number(m[2]))),
    b: Math.max(0, Math.min(255, Number(m[3]))),
    a: m[4] !== undefined ? Math.max(0, Math.min(1, Number(m[4]))) : 1,
  };
}

private drawTintedGlyph(
  texId: number,
  glyph: DPFontGlyph,
  color: string,
  dx: number,
  dy: number,
  scale: number,
  alpha: number,
): void {
  if (this.overlayCtx === null || this.glyphScratchCanvas === null || this.glyphScratchCtx === null)
    return;

  const atlas = this.subtitleAtlasCanvases.get(texId);
  if (atlas === undefined)
    return;

  const sw = glyph.width;
  const sh = glyph.height;
  if (sw <= 0 || sh <= 0)
    return;

  const scratch = this.glyphScratchCanvas;
  const sctx = this.glyphScratchCtx;

  scratch.width = sw;
  scratch.height = sh;

  sctx.clearRect(0, 0, sw, sh);
  sctx.globalCompositeOperation = 'source-over';
  sctx.drawImage(
    atlas,
    glyph.textureU,
    glyph.textureV,
    sw,
    sh,
    0,
    0,
    sw,
    sh,
  );

  const env = this.parseRGBAColor(color);
  const envA = env.a;

  const imageData = sctx.getImageData(0, 0, sw, sh);
  const data = imageData.data;

  for (let p = 0; p < data.length; p += 4) {
    const texR = data[p + 0];
    const texG = data[p + 1];
    const texB = data[p + 2];
    const texA = data[p + 3];

    if (texA === 0)
      continue;

    data[p + 0] = Math.round(texR + ((env.r - texR) * envA));
    data[p + 1] = Math.round(texG + ((env.g - texG) * envA));
    data[p + 2] = Math.round(texB + ((env.b - texB) * envA));
    data[p + 3] = texA;
  }

  sctx.putImageData(imageData, 0, 0);

  this.overlayCtx.save();
  this.overlayCtx.globalAlpha = alpha;
  this.overlayCtx.imageSmoothingEnabled = false;

  this.overlayCtx.drawImage(
    scratch,
    0,
    0,
    sw,
    sh,
    dx,
    dy,
    sw * scale,
    sh * scale,
  );

  this.overlayCtx.restore();
}

  private getCurrentOverlayAlpha(): number {
    if (this.paragraphDurationMs <= 0)
      return 1;

    const fadeWindowMs = Math.min(250, this.paragraphDurationMs * 0.25);
    if (this.paragraphTimeLeftMs > fadeWindowMs)
      return 1;

    return Math.max(0, this.paragraphTimeLeftMs / fadeWindowMs);
  }






private ensureOverlay(): void {
  if (this.overlayRoot !== null)
    return;

  this.overlayRoot = document.createElement('div');
  this.overlayRoot.id = DP_GAMETEXT_OVERLAY_ID;
  this.overlayRoot.style.position = 'fixed';
  this.overlayRoot.style.left = '50%';
  this.overlayRoot.style.bottom = '18px';
  this.overlayRoot.style.transform = 'translateX(-50%)';
  this.overlayRoot.style.width = '72vw';
  this.overlayRoot.style.maxWidth = '1100px';
  this.overlayRoot.style.pointerEvents = 'none';
  this.overlayRoot.style.zIndex = '10';
  this.overlayRoot.style.display = 'none';

  this.overlayCanvas = document.createElement('canvas');
  this.overlayCanvas.width = 1100;
  this.overlayCanvas.height = 240;
  this.overlayCanvas.style.display = 'block';
  this.overlayCanvas.style.width = '100%';
  this.overlayCanvas.style.height = '240px';

  this.overlayCtx = this.overlayCanvas.getContext('2d');
  if (this.overlayCtx !== null)
    this.overlayCtx.imageSmoothingEnabled = false;

  this.glyphScratchCanvas = document.createElement('canvas');
  this.glyphScratchCanvas.width = 64;
  this.glyphScratchCanvas.height = 64;
  this.glyphScratchCtx = this.glyphScratchCanvas.getContext('2d');

  this.overlayRoot.appendChild(this.overlayCanvas);
  document.body.appendChild(this.overlayRoot);
}

private ensureFloatingPanel(): void {
  if (this.floatingPanelRoot !== null)
    return;

  const root = document.createElement('div');
  this.floatingPanelRoot = root;
root.id = DP_GAMETEXT_FLOATING_PANEL_ID;
root.style.position = 'fixed';
root.style.top = '72px';
root.style.right = '10px';
root.style.width = '280px';
root.style.zIndex = '11';
root.style.pointerEvents = 'auto';
root.style.padding = '8px';
root.style.borderRadius = '10px';
root.style.background = 'rgba(0, 0, 0, 0.72)';
root.style.border = '1px solid rgba(255, 255, 255, 0.18)';
root.style.color = 'white';
root.style.font = '12px sans-serif';
root.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.45)';

  const title = document.createElement('div');
  title.textContent = 'DP GameText';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '6px';
  root.appendChild(title);

  const languageRow = document.createElement('div');
  languageRow.style.display = 'flex';
languageRow.style.gap = '4px';
languageRow.style.marginBottom = '5px';

  const languageSelect = document.createElement('select');
  languageSelect.style.flex = '1';

  for (let i = 0; i < LANGUAGE_NAMES.length; i++) {
    const option = document.createElement('option');
    option.value = `${i}`;
    option.textContent = LANGUAGE_NAMES[i];
    languageSelect.appendChild(option);
  }

  languageSelect.value = `${this.languageId}`;
  languageSelect.onchange = async () => {
    await this.loadLanguage(Number(languageSelect.value));
  };

  languageRow.appendChild(languageSelect);
  root.appendChild(languageRow);

  const searchInput = document.createElement('input');
  this.floatingSearchInput = searchInput;
  searchInput.placeholder = 'Search text or entry id';
  searchInput.style.width = '100%';
  searchInput.style.boxSizing = 'border-box';
  searchInput.style.marginBottom = '5px';
  searchInput.oninput = () => {
    this.searchText = searchInput.value;
    this.rebuildVisibleEntries();
  };
  root.appendChild(searchInput);

  const navRow = document.createElement('div');
  navRow.style.display = 'flex';
navRow.style.gap = '4px';
navRow.style.marginBottom = '5px';

  const prevButton = document.createElement('button');
  prevButton.textContent = 'Prev';
  prevButton.onclick = () => this.selectVisibleIndex(this.currentVisibleIndex - 1);
  navRow.appendChild(prevButton);

  const nextButton = document.createElement('button');
  nextButton.textContent = 'Next';
  nextButton.onclick = () => this.selectVisibleIndex(this.currentVisibleIndex + 1);
  navRow.appendChild(nextButton);

  const entryInput = document.createElement('input');
  this.floatingEntryIdInput = entryInput;
  entryInput.type = 'number';
  entryInput.min = '0';
  entryInput.style.width = '64px';
  navRow.appendChild(entryInput);

  const goButton = document.createElement('button');
  goButton.textContent = 'Go';
  goButton.onclick = () => {
    const id = Number(entryInput.value);
    if (!Number.isNaN(id))
      this.selectEntryById(id);
  };
  navRow.appendChild(goButton);

  root.appendChild(navRow);

  const playbackRow = document.createElement('div');
  playbackRow.style.display = 'flex';
playbackRow.style.gap = '4px';
  playbackRow.style.alignItems = 'center';
  playbackRow.style.marginBottom = '5px';

  const playPauseButton = document.createElement('button');
  this.floatingPlayPauseButton = playPauseButton;
  playPauseButton.textContent = 'Pause';
  playPauseButton.onclick = () => {
    this.isPlaying = !this.isPlaying;
    playPauseButton.textContent = this.isPlaying ? 'Pause' : 'Play';
    this.updateOverlay();
  };
  playbackRow.appendChild(playPauseButton);

  const restartButton = document.createElement('button');
  restartButton.textContent = 'Restart';
  restartButton.onclick = () => {
    this.resetPlayback();
    this.syncUI();
  };
  playbackRow.appendChild(restartButton);

  const loopLabel = document.createElement('label');
  loopLabel.style.display = 'inline-flex';
  loopLabel.style.alignItems = 'center';
  loopLabel.style.gap = '4px';

  const loopCheckbox = document.createElement('input');
  this.floatingLoopCheckbox = loopCheckbox;
  loopCheckbox.type = 'checkbox';
  loopCheckbox.checked = this.loopPlayback;
  loopCheckbox.onchange = () => {
    this.loopPlayback = loopCheckbox.checked;
  };

  loopLabel.appendChild(loopCheckbox);
  loopLabel.appendChild(document.createTextNode('Loop'));
  playbackRow.appendChild(loopLabel);

  root.appendChild(playbackRow);

  const speedRow = document.createElement('div');
  speedRow.style.display = 'flex';
  speedRow.style.gap = '4px';

  speedRow.style.alignItems = 'center';
  speedRow.style.marginBottom = '5px';

  const speedLabel = document.createElement('span');
  speedLabel.textContent = 'Speed:';
  speedRow.appendChild(speedLabel);

  const speedSelect = document.createElement('select');
  this.floatingSpeedSelect = speedSelect;

const speedOptions: Array<[string, number]> = [
  ['Fast', 1.0],
  ['Medium', 1.6],
  ['Slow', 2.0],
  ['Normal / Game-like', 2.3],
];

  for (const [label, value] of speedOptions) {
    const option = document.createElement('option');
    option.value = `${value}`;
    option.textContent = label;
    speedSelect.appendChild(option);
  }

  speedSelect.value = `${this.subtitleDurationScale}`;
  speedSelect.onchange = () => {
    this.subtitleDurationScale = Number(speedSelect.value);
    this.startCurrentParagraph(true);
    this.updateOverlay();
  };

  speedRow.appendChild(speedSelect);
  root.appendChild(speedRow);

  const resultLabel = document.createElement('div');
  this.floatingResultsLabel = resultLabel;
  resultLabel.style.color = '#ddd';
  resultLabel.style.fontSize = '11px';
  resultLabel.style.whiteSpace = 'normal';
  root.appendChild(resultLabel);

document.body.appendChild(root);
this.syncUI();
}


private destroyOverlay(): void {
  this.overlayRoot?.remove();
  this.floatingPanelRoot?.remove();

  document.getElementById(DP_GAMETEXT_OVERLAY_ID)?.remove();
  document.getElementById(DP_GAMETEXT_FLOATING_PANEL_ID)?.remove();

  this.overlayRoot = null;
  this.overlayCanvas = null;
  this.overlayCtx = null;
  this.glyphScratchCanvas = null;
  this.glyphScratchCtx = null;

  this.floatingPanelRoot = null;
  this.floatingEntryIdInput = null;
  this.floatingSearchInput = null;
  this.floatingResultsLabel = null;
  this.floatingPlayPauseButton = null;
  this.floatingLoopCheckbox = null;
  this.floatingSpeedSelect = null;
}

  private hideOverlay(): void {
    if (this.overlayRoot !== null)
      this.overlayRoot.style.display = 'none';

    if (this.overlayCtx !== null && this.overlayCanvas !== null)
      this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
  }

  private drawParagraphToCanvas(paragraph: ParsedParagraph, alpha: number): void {
    if (this.overlayCanvas === null || this.overlayCtx === null) {
      return;
    }

    const ctx = this.overlayCtx;
    const canvas = this.overlayCanvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

if (this.subtitleFont === null || this.subtitleAtlasCanvases.size === 0) {
  type FallbackRun = { text: string; color: string; isIcon: boolean; };
  const lines: FallbackRun[][] = [[]];
  let currentLine = lines[0];

  for (const run of paragraph.runs) {
    if (run.isIcon) {
      currentLine.push({ text: run.text, color: run.color, isIcon: true });
      continue;
    }

    const parts = run.text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].length > 0)
        currentLine.push({ text: parts[i], color: run.color, isIcon: false });

      if (i !== parts.length - 1) {
        currentLine = [];
        lines.push(currentLine);
      }
    }
  }

  ctx.save();
  ctx.font = 'bold 34px serif';
  ctx.textBaseline = 'top';

  const lineHeight = 38;
  const lineWidths = lines.map((line) => {
    let w = 0;
    for (const run of line) {
      if (run.isIcon)
        w += this.getButtonAdvance(run.text);
      else
        w += ctx.measureText(run.text).width;
    }
    return w;
  });

  const maxLineWidth = Math.max(1, ...lineWidths);
  const boxPadX = 28;
  const boxPadY = 18;
  const boxWidth = Math.min(canvas.width - 32, Math.ceil(maxLineWidth) + (boxPadX * 2));
  const boxHeight = Math.max(90, (lines.length * lineHeight) + (boxPadY * 2));
  const boxX = paragraph.align === 'center' ? Math.floor((canvas.width - boxWidth) / 2) : 20;
  const boxY = paragraph.verticalCenter
    ? Math.floor((canvas.height - boxHeight) / 2)
    : canvas.height - boxHeight - 16;

  ctx.globalAlpha = alpha;
  this.fillRoundRect(ctx, boxX, boxY, boxWidth, boxHeight, 18);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  ctx.fill();

  let y = boxY + boxPadY;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    let x = paragraph.align === 'center'
      ? Math.floor((canvas.width - lineWidths[lineIndex]) / 2)
      : boxX + boxPadX;

    for (const run of line) {
      if (run.isIcon) {
        this.drawButtonToken(ctx, run.text, x, y, lineHeight, alpha);
        x += this.getButtonAdvance(run.text);
      } else {
        ctx.fillStyle = run.color;
        ctx.fillText(run.text, x, y);
        x += ctx.measureText(run.text).width;
      }
    }

    y += lineHeight;
  }

  ctx.restore();
  return;
}

    const font = this.subtitleFont;
    const scale = this.subtitleScale;

    const boxPadX = 36;
    const boxPadY = 20;


    const maxTextWidth = Math.min(
  this.subtitleMaxTextWidth,
  canvas.width - 96 - (boxPadX * 2),
);

    const flatItems = this.buildCanvasLineItems(paragraph, font, scale);
    const lines = this.wrapCanvasLineItems(flatItems, maxTextWidth);

    const lineWidths = lines.map((line) => this.measureLineItems(line));
    const maxLineWidth = Math.max(1, ...lineWidths);
    const lineHeight = Math.ceil(font.y * scale);
    const blockHeight = lines.length * lineHeight;

    const boxWidth = Math.min(canvas.width - 32, maxLineWidth + (boxPadX * 2));
    const boxHeight = blockHeight + (boxPadY * 2);
    const boxX = paragraph.align === 'center' ? Math.floor((canvas.width - boxWidth) / 2) : 20;
    const boxY = paragraph.verticalCenter
      ? Math.floor((canvas.height - boxHeight) / 2)
      : canvas.height - boxHeight - 16;

    ctx.save();
    ctx.globalAlpha = alpha;
    this.fillRoundRect(ctx, boxX, boxY, boxWidth, boxHeight, 18);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.fill();
    ctx.restore();

    let y = boxY + boxPadY;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineWidth = lineWidths[lineIndex];

      let x = paragraph.align === 'center'
        ? Math.floor((canvas.width - lineWidth) / 2)
        : boxX + boxPadX;

      for (const item of line) {
        if (item.kind === 'space') {
          x += item.advance;
          continue;
        }

        if (item.kind === 'icon') {
          if (item.token !== '\n')
            this.drawButtonToken(ctx, item.token, x, y, lineHeight, alpha);

          x += Math.max(0, item.advance);
          continue;
        }

        this.drawTintedGlyph(
          item.texId,
          item.glyph,
          item.color,
          Math.floor(x + (item.glyph.offsetX * scale)),
          Math.floor(y + (item.glyph.offsetY * scale)),
          scale,
          alpha,
        );

        x += item.advance;
      }

      y += lineHeight;
    }
  }

  private updateOverlay(): void {
    if (!this.uiVisible) {
      this.hideOverlay();
      return;
    }

    if (this.overlayRoot === null || this.overlayCanvas === null || this.overlayCtx === null)
      return;

    const entry = this.getCurrentEntry();
    if (entry === null || entry.paragraphs.length === 0) {
      this.hideOverlay();
      return;
    }

    const paragraph = entry.paragraphs[this.currentParagraphIndex];
    this.overlayRoot.style.display = 'block';

    if (paragraph.verticalCenter) {
      this.overlayRoot.style.top = '50%';
      this.overlayRoot.style.bottom = 'auto';
      this.overlayRoot.style.transform = 'translate(-50%, -50%)';
    } else {
      this.overlayRoot.style.top = 'auto';
      this.overlayRoot.style.bottom = '18px';
      this.overlayRoot.style.transform = 'translateX(-50%)';
    }

    this.drawParagraphToCanvas(paragraph, this.getCurrentOverlayAlpha());
  }

  private updateOverlayFade(): void {
    this.updateOverlay();
  }

  private syncUI(): void {
    const current = this.getCurrentEntry();

    if (this.entryIdInput !== null && current !== null)
      this.entryIdInput.value = `${current.id}`;

    if (this.resultsLabel !== null) {
      if (current === null) {
        this.resultsLabel.textContent = `0 matches | ${LANGUAGE_NAMES[this.languageId]}`;
      } else {
        this.resultsLabel.textContent =
          `${this.currentVisibleIndex + 1} / ${this.visibleEntries.length} matches | ` +
          `Entry ${current.id} | ${LANGUAGE_NAMES[this.languageId]} | ` +
          `${current.paragraphs.length} paragraph(s) | ` +
          `${current.commands.some((c) => c > 0) ? 'timed subtitle' : 'static text'}`;
      }
    }

if (this.floatingEntryIdInput !== null && current !== null)
  this.floatingEntryIdInput.value = `${current.id}`;

if (this.floatingSearchInput !== null && this.floatingSearchInput.value !== this.searchText)
  this.floatingSearchInput.value = this.searchText;

if (this.floatingPlayPauseButton !== null)
  this.floatingPlayPauseButton.textContent = this.isPlaying ? 'Pause' : 'Play';

if (this.floatingLoopCheckbox !== null)
  this.floatingLoopCheckbox.checked = this.loopPlayback;

if (this.floatingSpeedSelect !== null)
  this.floatingSpeedSelect.value = `${this.subtitleDurationScale}`;

if (this.floatingResultsLabel !== null) {
  if (current === null) {
    this.floatingResultsLabel.textContent = `0 matches | ${LANGUAGE_NAMES[this.languageId]}`;
  } else {
    this.floatingResultsLabel.textContent =
      `${this.currentVisibleIndex + 1} / ${this.visibleEntries.length} | ` +
      `Entry ${current.id} | ${current.paragraphs.length} paragraph(s)`;
  }
}

    if (this.rawPre !== null) {
      if (current === null) {
        this.rawPre.textContent = '';
      } else {
        const rawStrings = current.strings
          .map((s, i) => `[${i}] ${s}`)
          .join('\n');

        this.rawPre.textContent =
          `Commands (${current.commandCount}): ${current.commands.map((c) => this.formatCommand(c)).join(', ')}\n\n` +
          `Offset: 0x${current.offset.toString(16)}\n` +
          `Size: ${current.size} bytes\n\n` +
          rawStrings;
      }
    }

    this.updateOverlay();
  }

  public createPanels(): UI.Panel[] {
    const browserPanel = new UI.Panel();
    browserPanel.setTitle(UI.SAND_CLOCK_ICON, 'DP GameText Browser');
    browserPanel.elem.style.maxWidth = '420px';
    browserPanel.elem.style.width = '420px';

    const help = document.createElement('div');
    help.style.whiteSpace = 'pre-wrap';
    help.style.marginBottom = '8px';
    help.textContent =
      'Main-screen subtitle playback.\n' +
      'Browse an entry, then it plays on the screen using paragraph timing, colour commands, line breaks, alignment, and button-icon inserts.';
    browserPanel.contents.appendChild(help);

    const languageRow = document.createElement('div');
    languageRow.style.display = 'flex';
    languageRow.style.gap = '8px';
    languageRow.style.alignItems = 'center';
    languageRow.style.marginBottom = '8px';

    const languageLabel = document.createElement('span');
    languageLabel.textContent = 'Language:';
    languageRow.appendChild(languageLabel);

    const languageSelect = document.createElement('select');
    for (let i = 0; i < LANGUAGE_NAMES.length; i++) {
      const option = document.createElement('option');
      option.value = `${i}`;
      option.textContent = LANGUAGE_NAMES[i];
      languageSelect.appendChild(option);
    }

    languageSelect.value = `${this.languageId}`;
    languageSelect.onchange = async () => {
      await this.loadLanguage(Number(languageSelect.value));
    };
    languageRow.appendChild(languageSelect);

    browserPanel.contents.appendChild(languageRow);

    const searchEntry = new UI.TextEntry();
    searchEntry.setPlaceholder('Search text or entry id');
    searchEntry.ontext = (s: string) => {
      this.searchText = s;
      this.rebuildVisibleEntries();
    };
    browserPanel.contents.appendChild(searchEntry.elem);

    const navRow = document.createElement('div');
    navRow.style.display = 'flex';
    navRow.style.gap = '8px';
    navRow.style.marginTop = '8px';
    navRow.style.marginBottom = '8px';

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Prev';
    prevButton.onclick = () => this.selectVisibleIndex(this.currentVisibleIndex - 1);
    navRow.appendChild(prevButton);

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.onclick = () => this.selectVisibleIndex(this.currentVisibleIndex + 1);
    navRow.appendChild(nextButton);

    this.entryIdInput = document.createElement('input');
    this.entryIdInput.type = 'number';
    this.entryIdInput.min = '0';
    this.entryIdInput.style.width = '90px';
    navRow.appendChild(this.entryIdInput);

    const goButton = document.createElement('button');
    goButton.textContent = 'Go';
    goButton.onclick = () => {
      const id = Number(this.entryIdInput!.value);
      if (!Number.isNaN(id))
        this.selectEntryById(id);
    };
    navRow.appendChild(goButton);

    browserPanel.contents.appendChild(navRow);

    const playbackRow = document.createElement('div');
    playbackRow.style.display = 'flex';
    playbackRow.style.gap = '8px';
    playbackRow.style.alignItems = 'center';
    playbackRow.style.marginBottom = '8px';

    const playPauseButton = document.createElement('button');
    playPauseButton.textContent = 'Pause';
    playPauseButton.onclick = () => {
      this.isPlaying = !this.isPlaying;
      playPauseButton.textContent = this.isPlaying ? 'Pause' : 'Play';
      this.updateOverlay();
    };
    playbackRow.appendChild(playPauseButton);

    const restartButton = document.createElement('button');
    restartButton.textContent = 'Restart';
    restartButton.onclick = () => {
      this.resetPlayback();
      this.syncUI();
    };
    playbackRow.appendChild(restartButton);

    const loopLabel = document.createElement('label');
    loopLabel.style.display = 'inline-flex';
    loopLabel.style.alignItems = 'center';
    loopLabel.style.gap = '6px';

    const loopCheckbox = document.createElement('input');
    loopCheckbox.type = 'checkbox';
    loopCheckbox.checked = this.loopPlayback;
    loopCheckbox.onchange = () => {
      this.loopPlayback = loopCheckbox.checked;
    };
    loopLabel.appendChild(loopCheckbox);

    const loopText = document.createElement('span');
    loopText.textContent = 'Loop';
    loopLabel.appendChild(loopText);

    playbackRow.appendChild(loopLabel);
    browserPanel.contents.appendChild(playbackRow);

    this.resultsLabel = document.createElement('div');
    this.resultsLabel.style.color = '#aaa';
    this.resultsLabel.style.marginBottom = '8px';
    browserPanel.contents.appendChild(this.resultsLabel);

    const details = document.createElement('details');
    details.style.marginTop = '8px';

    const summary = document.createElement('summary');
    summary.textContent = 'Raw commands / strings';
    details.appendChild(summary);

    this.rawPre = document.createElement('pre');
    this.rawPre.style.whiteSpace = 'pre-wrap';
    this.rawPre.style.margin = '8px 0 0 0';
    this.rawPre.style.font = '14px monospace';
    this.rawPre.style.color = '#aaa';
    details.appendChild(this.rawPre);

    browserPanel.contents.appendChild(details);

    this.syncUI();
    return [browserPanel];
  }
}

export class DPGameTextSceneDesc implements Viewer.SceneDesc {
  constructor(
    public id: string,
    public name: string,
    private gameInfo: GameInfo,
  ) {}

  public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
    const renderer = new DPGameTextRenderer(
      context,
      new SFAAnimationController(),
      new MaterialFactory(device),
    );

    await renderer.create(this.gameInfo, context.dataFetcher);
    return renderer;
  }
}
function getDPDecodedTexture(
    textureFetcher: SFATextureFetcher,
    texId: number,
): { width: number; height: number; pixels: Uint8Array } | null {
    const fetcherAny = textureFetcher as any;

    const dpDecoded:
        | Map<number, { width: number; height: number; pixels: Uint8Array }>
        | undefined = fetcherAny.dpDecoded;

    const hit = dpDecoded?.get(texId);
    if (hit === undefined)
        return null;

    return hit;
}

function decodedTextureToCanvas(decoded: { width: number; height: number; pixels: Uint8Array }): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = decoded.width;
    canvas.height = decoded.height;

    const ctx = canvas.getContext('2d');
    if (ctx === null)
        throw new Error('Could not create DP subtitle font texture canvas context');

    const imageData = ctx.createImageData(decoded.width, decoded.height);
    imageData.data.set(new Uint8ClampedArray(decoded.pixels));
    ctx.putImageData(imageData, 0, 0);

    return canvas;
}

async function waitForDPFontTextureCanvas(
    textureFetcher: SFATextureFetcher,
    materialCache: any,
    texId: number,
    timeoutMs: number = 4000,
): Promise<HTMLCanvasElement | null> {
    const fetcherAny = textureFetcher as any;

    if (typeof fetcherAny.getDPTex0BinTextureArray === 'function')
        void fetcherAny.getDPTex0BinTextureArray(materialCache, texId);

    const startTime = performance.now();

    for (;;) {
        const decoded = getDPDecodedTexture(textureFetcher, texId);
        if (decoded !== null)
            return decodedTextureToCanvas(decoded);

        if (typeof fetcherAny.getDPTex0BinTextureArray === 'function')
            void fetcherAny.getDPTex0BinTextureArray(materialCache, texId);

        if ((performance.now() - startTime) >= timeoutMs)
            return null;

        await new Promise<void>((resolve) => window.setTimeout(resolve, 16));
    }
}