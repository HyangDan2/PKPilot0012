import { INPUT_SIZE, PAD_VALUE, letterboxPlan, type LetterboxPlan } from '../engine/geometry';

export interface CapturedFrame {
  rgba: Uint8ClampedArray;
  plan: LetterboxPlan;
  width: number;
  height: number;
}

/**
 * Reusable 640×640 canvas that lays any frame out the way the model expects:
 * whole frame visible, aspect kept, grey margins on the short sides.
 */
export class FrameCapture {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = INPUT_SIZE;
    this.canvas.height = INPUT_SIZE;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D 캔버스를 만들지 못했습니다.');
    this.ctx = ctx;
  }

  capture(source: CanvasImageSource, srcWidth: number, srcHeight: number): CapturedFrame {
    const plan = letterboxPlan(srcWidth, srcHeight, INPUT_SIZE);
    const grey = `rgb(${PAD_VALUE}, ${PAD_VALUE}, ${PAD_VALUE})`;
    this.ctx.fillStyle = grey;
    this.ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.ctx.drawImage(source, plan.padX, plan.padY, plan.drawWidth, plan.drawHeight);
    const pixels = this.ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    return { rgba: pixels, plan, width: srcWidth, height: srcHeight };
  }
}
