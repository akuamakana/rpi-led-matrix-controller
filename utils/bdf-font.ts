import { CanvasRenderingContext2D } from 'canvas';
import { promises as fs } from 'fs';

interface CharacterGlyph {
  code: number;
  bitmap: number[];
  width: number;
  height: number;
  xOffset: number;
  yOffset: number;
  bytesPerLine: number;
}

export interface DrawOptions {
  scale?: number;
  color?: string;
  backgroundColor?: string;
  spacing?: number; // New option for character spacing
}

export class BDFFont {
  private chars: Map<number, CharacterGlyph>;
  private debug: boolean;
  private fontPath: string;
  private initPromise: Promise<void>;

  constructor(fontPath: string, debug: boolean = false) {
    this.chars = new Map();
    this.debug = debug;
    this.fontPath = fontPath;
    this.initPromise = this.init();
  }

  public async ready(): Promise<void> {
    await this.initPromise;
  }

  private async init(): Promise<void> {
    try {
      if (this.debug) console.log(`Loading font from: ${this.fontPath}`);

      const content = await fs.readFile(this.fontPath, 'utf-8');
      const lines = content.split('\n').map((line) => line.trim());

      let currentChar: CharacterGlyph | null = null;
      let bitmap: number[] = [];
      let inBitmap = false;
      let bytesPerLine = 1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (this.debug && line.startsWith('STARTFONT')) {
          console.log('Font version:', line);
        }

        if (line.startsWith('ENCODING')) {
          if (this.debug) console.log('Processing character:', line);
          currentChar = {
            code: parseInt(line.split(' ')[1]),
            bitmap: [],
            width: 0,
            height: 0,
            xOffset: 0,
            yOffset: 0,
            bytesPerLine: 1,
          };
        }

        if (line.startsWith('BBX')) {
          const [_, width, height, xOffset, yOffset] = line.split(' ');
          if (currentChar) {
            currentChar.width = parseInt(width);
            currentChar.height = parseInt(height);
            currentChar.xOffset = parseInt(xOffset);
            currentChar.yOffset = parseInt(yOffset);

            bytesPerLine = Math.ceil(currentChar.width / 8);
            currentChar.bytesPerLine = bytesPerLine;

            if (this.debug) {
              console.log(`Char dimensions: ${width}x${height}, offset: ${xOffset},${yOffset}`);
              console.log(`Bytes per line: ${bytesPerLine}`);
            }
          }
        }

        if (line.startsWith('BITMAP')) {
          bitmap = [];
          inBitmap = true;
          continue;
        }

        if (inBitmap && line.match(/^[0-9A-Fa-f]+$/)) {
          try {
            let value = parseInt(line, 16);
            if (this.debug) {
              console.log(`Bitmap line: ${line} -> ${value.toString(2).padStart(8, '0')}`);
            }
            bitmap.push(value);
          } catch (e) {
            if (this.debug) {
              console.error(`Failed to parse bitmap line: ${line}`);
            }
          }
        }

        if (line === 'ENDCHAR') {
          inBitmap = false;
          if (currentChar && bitmap.length > 0) {
            currentChar.bitmap = bitmap;
            this.chars.set(currentChar.code, currentChar);
            if (this.debug) {
              console.log(`Stored character ${currentChar.code} with ${bitmap.length} bitmap rows`);
            }
          }
          currentChar = null;
          bitmap = [];
        }
      }
    } catch (error) {
      console.error(`Failed to load BDF font: ${error.message}`);
      throw error;
    }
  }

  public async drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    options: DrawOptions = {}
  ): Promise<number> {
    await this.ready();

    const {
      scale = 1,
      color = 'white',
      backgroundColor = 'black',
      spacing = -1, // Default spacing of 1 pixel
    } = options;

    let currentX = x;
    const originalFillStyle = ctx.fillStyle;

    for (const char of text) {
      const charCode = char.charCodeAt(0);
      const glyph = this.chars.get(charCode);

      if (!glyph) {
        if (this.debug) {
          console.warn(`No glyph found for character: ${char} (${charCode})`);
        }
        // Move forward by a space even if character isn't found
        currentX += 4 * scale + spacing * scale;
        continue;
      }

      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(currentX, y, glyph.width * scale, glyph.height * scale);
      }

      ctx.fillStyle = color;

      // Draw the bitmap
      for (let row = 0; row < glyph.height; row++) {
        const rowBits = glyph.bitmap[row];
        if (rowBits === undefined) continue;

        for (let col = 0; col < glyph.width; col++) {
          const bitPosition = glyph.width - 1 - col;
          const bit = (rowBits >> bitPosition) & 1;

          if (bit === 1) {
            ctx.fillRect(currentX + col * scale, y + row * scale, scale, scale);
          }
        }
      }

      // Move to next character position using custom spacing
      currentX += glyph.width * scale + spacing * scale;
    }

    ctx.fillStyle = originalFillStyle;
    return currentX - x;
  }

  // Helper method to measure text width with custom spacing
  public async measureText(text: string, scale: number = 1, spacing: number = 1): Promise<number> {
    await this.ready();

    let width = 0;

    for (const char of text) {
      const charCode = char.charCodeAt(0);
      const glyph = this.chars.get(charCode);

      if (glyph) {
        width += glyph.width * scale + spacing * scale;
      } else {
        // Default width for unknown characters
        width += 4 * scale + spacing * scale;
      }
    }

    return width;
  }
}

export async function createBDFFont(fontPath: string, debug: boolean = false): Promise<BDFFont> {
  const font = new BDFFont(fontPath, debug);
  await font.ready();
  return font;
}
