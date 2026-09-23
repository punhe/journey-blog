import { deflateSync } from 'node:zlib';

/**
 * A 24-bit PNG writer and a few drawing helpers.
 *
 * The seeder needs raster placeholders rather than SVG: Sanity's image
 * pipeline cannot crop or resize an SVG, so the cards and the article header
 * would get the original file at every size.
 */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = -1;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

export type RGB = [number, number, number];

// prettier-ignore
const BAYER_4X4 = [
   0,  8,  2, 10,
  12,  4, 14,  6,
   3, 11,  1,  9,
  15,  7, 13,  5,
];

export class Canvas {
  readonly width: number;
  readonly height: number;
  private readonly pixels: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height * 3);
  }

  set(x: number, y: number, [r, g, b]: RGB): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    this.pixels[i] = r;
    this.pixels[i + 1] = g;
    this.pixels[i + 2] = b;
  }

  get(x: number, y: number): RGB {
    const i = (y * this.width + x) * 3;
    return [this.pixels[i]!, this.pixels[i + 1]!, this.pixels[i + 2]!];
  }

  /** Draws `colour` over the pixel at `alpha` coverage. Used to soften edges. */
  blend(x: number, y: number, colour: RGB, alpha: number): void {
    if (alpha <= 0 || x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    if (alpha >= 1) return this.set(x, y, colour);
    this.set(x, y, mix(this.get(x, y), colour, alpha));
  }

  /** Vertical gradient across the whole canvas. */
  gradient(top: RGB, bottom: RGB): void {
    for (let y = 0; y < this.height; y += 1) {
      const t = y / (this.height - 1);
      const colour = mix(top, bottom, t);
      for (let x = 0; x < this.width; x += 1) this.set(x, y, colour);
    }
  }

  /** Fills everything under a sine ridge, so the shape reads as a hill. */
  ridge(colour: RGB, baseline: number, amplitude: number, periods: number, phase: number): void {
    for (let x = 0; x < this.width; x += 1) {
      const t = (x / this.width) * periods * Math.PI * 2 + phase;
      const top = baseline + Math.sin(t) * amplitude;
      const first = Math.floor(top);
      this.blend(x, first, colour, 1 - (top - first));
      for (let y = first + 1; y < this.height; y += 1) this.set(x, y, colour);
    }
  }

  disc(cx: number, cy: number, radius: number, colour: RGB): void {
    for (let y = Math.floor(cy - radius) - 1; y <= Math.ceil(cy + radius) + 1; y += 1) {
      for (let x = Math.floor(cx - radius) - 1; x <= Math.ceil(cx + radius) + 1; x += 1) {
        const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        this.blend(x, y, colour, Math.min(1, Math.max(0, radius - distance + 0.5)));
      }
    }
  }

  /**
   * Ordered 4x4 dither, so wide gradients do not band into visible steps.
   * A repeating matrix is used rather than random noise: it tiles, so the
   * PNG still compresses to a few kilobytes.
   */
  grain(strength = 3): void {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const i = (y * this.width + x) * 3;
        const noise = (BAYER_4X4[(y % 4) * 4 + (x % 4)]! / 16 - 0.5) * strength;
        this.pixels[i] = clamp(this.pixels[i]! + noise);
        this.pixels[i + 1] = clamp(this.pixels[i + 1]! + noise);
        this.pixels[i + 2] = clamp(this.pixels[i + 2]! + noise);
      }
    }
  }

  toPng(): Buffer {
    const stride = this.width * 3;
    const raw = Buffer.alloc((stride + 1) * this.height);
    for (let y = 0; y < this.height; y += 1) {
      raw[y * (stride + 1)] = 0; // filter: none
      Buffer.from(this.pixels.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // colour type: truecolour
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    clamp(a[0] + (b[0] - a[0]) * t),
    clamp(a[1] + (b[1] - a[1]) * t),
    clamp(a[2] + (b[2] - a[2]) * t),
  ];
}

export function hex(value: string): RGB {
  const n = Number.parseInt(value.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
