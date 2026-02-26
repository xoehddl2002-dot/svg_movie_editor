/**
 * Pure client-side GIF Encoder
 * 
 * Canvas ImageData → Animated GIF (Blob)
 * NeuQuant 기반 색상 양자화 + LZW 압축
 */

// ─── NeuQuant Color Quantizer ───
// Neural-net based color quantization (reduces 24-bit to 256 colors)
class NeuQuant {
    private static readonly ncycles = 100;
    private static readonly netsize = 256;
    private static readonly maxnetpos = 255;
    private static readonly netbiasshift = 4;
    private static readonly intbiasshift = 16;
    private static readonly intbias = 1 << 16;
    private static readonly gammashift = 10;
    private static readonly betashift = 10;
    private static readonly beta = NeuQuant.intbias >> NeuQuant.betashift;
    private static readonly betagamma = NeuQuant.intbias << (NeuQuant.gammashift - NeuQuant.betashift);
    private static readonly initrad = NeuQuant.netsize >> 3;
    private static readonly radiusbiasshift = 6;
    private static readonly radiusbias = 1 << NeuQuant.radiusbiasshift;
    private static readonly initradius = NeuQuant.initrad * NeuQuant.radiusbias;
    private static readonly radiusdec = 30;
    private static readonly alphabiasshift = 10;
    private static readonly initalpha = 1 << NeuQuant.alphabiasshift;
    private static readonly radbiasshift = 8;
    private static readonly radbias = 1 << NeuQuant.radbiasshift;
    private static readonly alpharadbshift = NeuQuant.alphabiasshift + NeuQuant.radbiasshift;
    private static readonly alpharadbias = 1 << NeuQuant.alpharadbshift;
    private static readonly prime1 = 499;
    private static readonly prime2 = 491;
    private static readonly prime3 = 487;
    private static readonly prime4 = 503;
    private static readonly minpicturebytes = 3 * NeuQuant.prime4;

    private network: number[][];
    private netindex: number[];
    private bias: number[];
    private freq: number[];
    private radpower: number[];
    private thepicture: Uint8Array;
    private lengthcount: number;
    private samplefac: number;

    constructor(pixels: Uint8Array, samplefac: number = 10) {
        this.thepicture = pixels;
        this.lengthcount = pixels.length;
        this.samplefac = samplefac;
        this.network = [];
        this.netindex = new Array(256);
        this.bias = new Array(NeuQuant.netsize);
        this.freq = new Array(NeuQuant.netsize);
        this.radpower = new Array(NeuQuant.initrad);

        for (let i = 0; i < NeuQuant.netsize; i++) {
            const v = (i << (NeuQuant.netbiasshift + 8)) / NeuQuant.netsize;
            this.network[i] = [v, v, v];
            this.freq[i] = NeuQuant.intbias / NeuQuant.netsize;
            this.bias[i] = 0;
        }
    }

    private colorMap(): number[] {
        const map: number[] = [];
        const index: number[] = new Array(NeuQuant.netsize);
        for (let i = 0; i < NeuQuant.netsize; i++) index[this.network[i][3] as number] = i;
        for (let i = 0; i < NeuQuant.netsize; i++) {
            const j = index[i];
            map.push(this.network[j][0] >> NeuQuant.netbiasshift);
            map.push(this.network[j][1] >> NeuQuant.netbiasshift);
            map.push(this.network[j][2] >> NeuQuant.netbiasshift);
        }
        return map;
    }

    private inxbuild(): void {
        let previouscol = 0;
        let startpos = 0;
        for (let i = 0; i < NeuQuant.netsize; i++) {
            let smallpos = i;
            let smallval = (this.network[i][1] as number);
            for (let j = i + 1; j < NeuQuant.netsize; j++) {
                if ((this.network[j][1] as number) < smallval) {
                    smallpos = j;
                    smallval = (this.network[j][1] as number);
                }
            }
            if (i !== smallpos) {
                [this.network[i], this.network[smallpos]] = [this.network[smallpos], this.network[i]];
            }
            if (smallval !== previouscol) {
                this.netindex[previouscol] = (startpos + i) >> 1;
                for (let j = previouscol + 1; j < smallval; j++) this.netindex[j] = i;
                previouscol = smallval;
                startpos = i;
            }
            this.network[i][3] = i;
        }
        this.netindex[previouscol] = (startpos + NeuQuant.maxnetpos) >> 1;
        for (let j = previouscol + 1; j < 256; j++) this.netindex[j] = NeuQuant.maxnetpos;
    }

    private learn(): void {
        const lengthcount = this.lengthcount;
        const alphadec = 30 + ((this.samplefac - 1) / 3);
        const samplepixels = lengthcount / (3 * this.samplefac);
        let delta = Math.max(1, ~~(samplepixels / NeuQuant.ncycles));
        let alpha = NeuQuant.initalpha;
        let radius = NeuQuant.initradius;
        let rad = radius >> NeuQuant.radiusbiasshift;
        if (rad <= 1) rad = 0;
        for (let i = 0; i < rad; i++) {
            this.radpower[i] = alpha * (((rad * rad - i * i) * NeuQuant.radbias) / (rad * rad));
        }

        let step: number;
        if (lengthcount < NeuQuant.minpicturebytes) {
            this.samplefac = 1;
            step = 3;
        } else if (lengthcount % NeuQuant.prime1 !== 0) {
            step = 3 * NeuQuant.prime1;
        } else if (lengthcount % NeuQuant.prime2 !== 0) {
            step = 3 * NeuQuant.prime2;
        } else if (lengthcount % NeuQuant.prime3 !== 0) {
            step = 3 * NeuQuant.prime3;
        } else {
            step = 3 * NeuQuant.prime4;
        }

        let pix = 0;
        for (let i = 0; i < samplepixels;) {
            const b = (this.thepicture[pix] & 0xff) << NeuQuant.netbiasshift;
            const g = (this.thepicture[pix + 1] & 0xff) << NeuQuant.netbiasshift;
            const r = (this.thepicture[pix + 2] & 0xff) << NeuQuant.netbiasshift;
            let j = this.contest(b, g, r);
            this.altersingle(alpha, j, b, g, r);
            if (rad !== 0) this.alterneigh(rad, j, b, g, r);
            pix += step;
            if (pix >= lengthcount) pix -= lengthcount;
            i++;
            if (delta === 0) delta = 1;
            if (i % delta === 0) {
                alpha -= alpha / alphadec;
                radius -= radius / NeuQuant.radiusdec;
                rad = radius >> NeuQuant.radiusbiasshift;
                if (rad <= 1) rad = 0;
                for (let k = 0; k < rad; k++) {
                    this.radpower[k] = alpha * (((rad * rad - k * k) * NeuQuant.radbias) / (rad * rad));
                }
            }
        }
    }

    private altersingle(alpha: number, i: number, b: number, g: number, r: number): void {
        this.network[i][0] -= (alpha * (this.network[i][0] - b)) / NeuQuant.initalpha;
        this.network[i][1] -= (alpha * (this.network[i][1] - g)) / NeuQuant.initalpha;
        this.network[i][2] -= (alpha * (this.network[i][2] - r)) / NeuQuant.initalpha;
    }

    private alterneigh(rad: number, i: number, b: number, g: number, r: number): void {
        let lo = Math.max(i - rad, -1);
        let hi = Math.min(i + rad, NeuQuant.netsize);
        let j = i + 1;
        let k = i - 1;
        let m = 1;
        while (j < hi || k > lo) {
            const a = this.radpower[m++];
            if (j < hi) {
                const p = this.network[j++];
                p[0] -= (a * (p[0] - b)) / NeuQuant.alpharadbias;
                p[1] -= (a * (p[1] - g)) / NeuQuant.alpharadbias;
                p[2] -= (a * (p[2] - r)) / NeuQuant.alpharadbias;
            }
            if (k > lo) {
                const p = this.network[k--];
                p[0] -= (a * (p[0] - b)) / NeuQuant.alpharadbias;
                p[1] -= (a * (p[1] - g)) / NeuQuant.alpharadbias;
                p[2] -= (a * (p[2] - r)) / NeuQuant.alpharadbias;
            }
        }
    }

    private contest(b: number, g: number, r: number): number {
        let bestd = ~(1 << 31);
        let bestbiasd = bestd;
        let bestpos = -1;
        let bestbiaspos = bestpos;

        for (let i = 0; i < NeuQuant.netsize; i++) {
            const n = this.network[i];
            let dist = Math.abs(n[0] - b) + Math.abs(n[1] - g) + Math.abs(n[2] - r);
            if (dist < bestd) { bestd = dist; bestpos = i; }
            const biasdist = dist - ((this.bias[i]) >> (NeuQuant.intbiasshift - NeuQuant.netbiasshift));
            if (biasdist < bestbiasd) { bestbiasd = biasdist; bestbiaspos = i; }
            const betafreq = (this.freq[i] >> NeuQuant.betashift);
            this.freq[i] -= betafreq;
            this.bias[i] += (betafreq << NeuQuant.gammashift);
        }
        this.freq[bestpos] += NeuQuant.beta;
        this.bias[bestpos] -= NeuQuant.betagamma;
        return bestbiaspos;
    }

    buildColormap(): number[] {
        this.learn();
        this.inxbuild();
        return this.colorMap();
    }

    lookupRGB(b: number, g: number, r: number): number {
        let bestd = 1000;
        let best = -1;
        let i = this.netindex[g];
        let j = i - 1;
        while (i < NeuQuant.netsize || j >= 0) {
            if (i < NeuQuant.netsize) {
                const p = this.network[i];
                let dist = (p[1] as number) - g;
                if (dist >= bestd) i = NeuQuant.netsize;
                else {
                    i++;
                    if (dist < 0) dist = -dist;
                    let a = (p[0] as number) - b;
                    if (a < 0) a = -a;
                    dist += a;
                    if (dist < bestd) {
                        a = (p[2] as number) - r;
                        if (a < 0) a = -a;
                        dist += a;
                        if (dist < bestd) { bestd = dist; best = (p[3] as number); }
                    }
                }
            }
            if (j >= 0) {
                const p = this.network[j];
                let dist = g - (p[1] as number);
                if (dist >= bestd) j = -1;
                else {
                    j--;
                    if (dist < 0) dist = -dist;
                    let a = (p[0] as number) - b;
                    if (a < 0) a = -a;
                    dist += a;
                    if (dist < bestd) {
                        a = (p[2] as number) - r;
                        if (a < 0) a = -a;
                        dist += a;
                        if (dist < bestd) { bestd = dist; best = (p[3] as number); }
                    }
                }
            }
        }
        return best;
    }
}

// ─── LZW Encoder ───
class LZWEncoder {
    private static readonly EOF = -1;
    private remaining = 0;
    private curPixel = 0;
    private imgW: number;
    private imgH: number;
    private pixels: Uint8Array;
    private initCodeSize: number;

    // GIF block output
    private accum = new Uint8Array(256);
    private acount = 0;
    private output: number[] = [];

    // LZW compression state
    private static readonly BITS = 12;
    private static readonly HSIZE = 5003;
    private nBits = 0;
    private maxbits = LZWEncoder.BITS;
    private maxcode = 0;
    private maxmaxcode = 1 << LZWEncoder.BITS;
    private htab = new Int32Array(LZWEncoder.HSIZE);
    private codetab = new Int32Array(LZWEncoder.HSIZE);
    private freeEnt = 0;
    private clearFlg = false;
    private gInitBits = 0;
    private ClearCode = 0;
    private EOFCode = 0;
    private curAccum = 0;
    private curBits = 0;
    private masks = [
        0x0000, 0x0001, 0x0003, 0x0007, 0x000F, 0x001F, 0x003F, 0x007F,
        0x00FF, 0x01FF, 0x03FF, 0x07FF, 0x0FFF, 0x1FFF, 0x3FFF, 0x7FFF, 0xFFFF
    ];

    constructor(width: number, height: number, pixels: Uint8Array, colorDepth: number) {
        this.imgW = width;
        this.imgH = height;
        this.pixels = pixels;
        this.initCodeSize = Math.max(2, colorDepth);
    }

    encode(): Uint8Array {
        this.output = [];
        this.output.push(this.initCodeSize);
        this.remaining = this.imgW * this.imgH;
        this.curPixel = 0;
        this.compress(this.initCodeSize + 1);
        this.output.push(0); // block terminator
        return new Uint8Array(this.output);
    }

    private nextPixel(): number {
        if (this.remaining === 0) return LZWEncoder.EOF;
        --this.remaining;
        return this.pixels[this.curPixel++] & 0xff;
    }

    private charOut(c: number): void {
        this.accum[this.acount++] = c;
        if (this.acount >= 254) this.flushChar();
    }

    private flushChar(): void {
        if (this.acount > 0) {
            this.output.push(this.acount);
            for (let i = 0; i < this.acount; i++) this.output.push(this.accum[i]);
            this.acount = 0;
        }
    }

    private outputCode(code: number): void {
        this.curAccum &= this.masks[this.curBits];
        this.curAccum = this.curBits > 0 ? this.curAccum | (code << this.curBits) : code;
        this.curBits += this.nBits;
        while (this.curBits >= 8) {
            this.charOut(this.curAccum & 0xff);
            this.curAccum >>= 8;
            this.curBits -= 8;
        }
        if (this.freeEnt > this.maxcode || this.clearFlg) {
            if (this.clearFlg) {
                this.maxcode = (1 << (this.nBits = this.gInitBits)) - 1;
                this.clearFlg = false;
            } else {
                ++this.nBits;
                this.maxcode = this.nBits === this.maxbits ? this.maxmaxcode : (1 << this.nBits) - 1;
            }
        }
        if (code === this.EOFCode) {
            while (this.curBits > 0) {
                this.charOut(this.curAccum & 0xff);
                this.curAccum >>= 8;
                this.curBits -= 8;
            }
            this.flushChar();
        }
    }

    private clHash(hsize: number): void {
        for (let i = 0; i < hsize; ++i) this.htab[i] = -1;
    }

    private compress(init_bits: number): void {
        this.gInitBits = init_bits;
        this.clearFlg = false;
        this.nBits = this.gInitBits;
        this.maxcode = (1 << this.nBits) - 1;
        this.ClearCode = 1 << (init_bits - 1);
        this.EOFCode = this.ClearCode + 1;
        this.freeEnt = this.ClearCode + 2;
        this.acount = 0;

        let ent = this.nextPixel();
        let hshift = 0;
        for (let fcode = LZWEncoder.HSIZE; fcode < 65536; fcode *= 2) ++hshift;
        hshift = 8 - hshift;
        const hsize_reg = LZWEncoder.HSIZE;
        this.clHash(hsize_reg);
        this.outputCode(this.ClearCode);

        let c: number;
        outer_loop: while ((c = this.nextPixel()) !== LZWEncoder.EOF) {
            const fcode = (c << this.maxbits) + ent;
            let i = (c << hshift) ^ ent;
            if (this.htab[i] === fcode) {
                ent = this.codetab[i];
                continue;
            } else if (this.htab[i] >= 0) {
                let disp = hsize_reg - i;
                if (i === 0) disp = 1;
                do {
                    if ((i -= disp) < 0) i += hsize_reg;
                    if (this.htab[i] === fcode) {
                        ent = this.codetab[i];
                        continue outer_loop;
                    }
                } while (this.htab[i] >= 0);
            }
            this.outputCode(ent);
            ent = c;
            if (this.freeEnt < this.maxmaxcode) {
                this.codetab[i] = this.freeEnt++;
                this.htab[i] = fcode;
            } else {
                this.clHash(hsize_reg);
                this.freeEnt = this.ClearCode + 2;
                this.clearFlg = true;
                this.outputCode(this.ClearCode);
            }
        }
        this.outputCode(ent);
        this.outputCode(this.EOFCode);
    }
}

// ─── GIF Encoder (Main) ───
export interface GifEncoderOptions {
    width: number;
    height: number;
    delay: number; // ms between frames
    quality?: number; // 1-30, lower is better quality but slower (default: 10)
    repeat?: number; // 0 = loop forever, -1 = no loop
}

export class GifEncoder {
    private width: number;
    private height: number;
    private delay: number;
    private quality: number;
    private repeat: number;
    private frames: ImageData[] = [];
    private output: number[] = [];

    constructor(options: GifEncoderOptions) {
        this.width = options.width;
        this.height = options.height;
        this.delay = options.delay;
        this.quality = Math.max(1, Math.min(30, options.quality || 10));
        this.repeat = options.repeat ?? 0;
    }

    addFrame(imageData: ImageData): void {
        this.frames.push(imageData);
    }

    encode(onProgress?: (progress: number) => void): Blob {
        this.output = [];
        this.writeHeader();
        this.writeLogicalScreenDescriptor();
        this.writeNetscapeExt();

        for (let i = 0; i < this.frames.length; i++) {
            this.writeGraphicCtrlExt();
            this.writeImageDesc();
            this.writePixels(this.frames[i]);
            onProgress?.(Math.round(((i + 1) / this.frames.length) * 100));
        }

        this.output.push(0x3b); // GIF trailer
        return new Blob([new Uint8Array(this.output)], { type: 'image/gif' });
    }

    private writeHeader(): void {
        this.writeStr('GIF89a');
    }

    private writeLogicalScreenDescriptor(): void {
        this.writeShort(this.width);
        this.writeShort(this.height);
        this.output.push(
            0xf0 | 7, // GCT flag, color resolution (8 bits), GCT size = 256
            0,        // background color index
            0         // pixel aspect ratio
        );
        // Write placeholder Global Color Table (will rely on local tables)
        for (let i = 0; i < 256; i++) {
            this.output.push(0, 0, 0);
        }
    }

    private writeNetscapeExt(): void {
        this.output.push(0x21, 0xff, 0x0b);
        this.writeStr('NETSCAPE2.0');
        this.output.push(0x03, 0x01);
        this.writeShort(this.repeat);
        this.output.push(0x00);
    }

    private writeGraphicCtrlExt(): void {
        this.output.push(0x21, 0xf9, 0x04);
        this.output.push(0x00); // no transparency, no disposal
        this.writeShort(Math.round(this.delay / 10)); // delay in 1/100th sec
        this.output.push(0x00); // transparent color index
        this.output.push(0x00); // block terminator
    }

    private writeImageDesc(): void {
        this.output.push(0x2c);
        this.writeShort(0); // left
        this.writeShort(0); // top
        this.writeShort(this.width);
        this.writeShort(this.height);
        this.output.push(0x87); // local color table, 256 colors
    }

    private writePixels(imageData: ImageData): void {
        const w = this.width;
        const h = this.height;
        const data = imageData.data;

        // Extract RGB pixels (skip alpha)
        const rgbPixels = new Uint8Array(w * h * 3);
        for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
            rgbPixels[j] = data[i];     // R
            rgbPixels[j + 1] = data[i + 1]; // G
            rgbPixels[j + 2] = data[i + 2]; // B
        }

        // Quantize colors to 256
        const nq = new NeuQuant(rgbPixels, this.quality);
        const colorMap = nq.buildColormap();

        // Write local color table
        for (let i = 0; i < colorMap.length; i++) {
            this.output.push(colorMap[i]);
        }
        // Pad to 256 colors if needed
        for (let i = colorMap.length; i < 768; i++) {
            this.output.push(0);
        }

        // Map pixels to palette indices
        const indexedPixels = new Uint8Array(w * h);
        let k = 0;
        for (let i = 0; i < rgbPixels.length; i += 3) {
            indexedPixels[k++] = nq.lookupRGB(
                rgbPixels[i] & 0xff,
                rgbPixels[i + 1] & 0xff,
                rgbPixels[i + 2] & 0xff
            );
        }

        // LZW encode
        const encoder = new LZWEncoder(w, h, indexedPixels, 8);
        const encoded = encoder.encode();
        for (let i = 0; i < encoded.length; i++) {
            this.output.push(encoded[i]);
        }
    }

    private writeShort(val: number): void {
        this.output.push(val & 0xff);
        this.output.push((val >> 8) & 0xff);
    }

    private writeStr(s: string): void {
        for (let i = 0; i < s.length; i++) {
            this.output.push(s.charCodeAt(i));
        }
    }
}
