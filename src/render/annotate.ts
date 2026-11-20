import type { Detection } from '../engine/geometry';
import { classColor, classNameKo } from '../engine/labels';

/** Source pixels → canvas pixels (the export pass is the identity transform). */
export interface PaintTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface PaintOptions {
  detections: readonly Detection[];
  blurred: readonly Detection[];
  source: CanvasImageSource;
  srcWidth: number;
  srcHeight: number;
  transform: PaintTransform;
  showBoxes: boolean;
  showLabels: boolean;
  mosaic: boolean;
}

const FONT_STACK = '"Inter", "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", system-ui, sans-serif';
const MOSAIC_CANVAS = document.createElement('canvas');

/** Pixelate one box of the *source*, so the pixels under it never reach the screen. */
function paintMosaic(ctx: CanvasRenderingContext2D, options: PaintOptions, detection: Detection): void {
  const { source, transform } = options;
  const box = detection.box;
  const destWidth = Math.max(1, Math.round(box.width * transform.scale));
  const destHeight = Math.max(1, Math.round(box.height * transform.scale));
  const block = Math.max(6, Math.min(22, Math.round(Math.min(destWidth, destHeight) / 9)));
  const smallWidth = Math.max(1, Math.round(destWidth / block));
  const smallHeight = Math.max(1, Math.round(destHeight / block));

  MOSAIC_CANVAS.width = smallWidth;
  MOSAIC_CANVAS.height = smallHeight;
  const small = MOSAIC_CANVAS.getContext('2d');
  if (!small) return;
  small.imageSmoothingEnabled = true;
  small.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, smallWidth, smallHeight);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    MOSAIC_CANVAS,
    0,
    0,
    smallWidth,
    smallHeight,
    transform.offsetX + box.x * transform.scale,
    transform.offsetY + box.y * transform.scale,
    destWidth,
    destHeight,
  );
  ctx.imageSmoothingEnabled = true;
}

/**
 * Boxes, labels and mosaics, in the one order that reads correctly: the hidden
 * pixels first, then the frame around them, then the label above the box.
 */
export function paintDetections(ctx: CanvasRenderingContext2D, options: PaintOptions): void {
  const { transform, detections } = options;

  if (options.mosaic && options.blurred.length > 0) {
    for (const detection of options.blurred) paintMosaic(ctx, options, detection);
  }

  if (!options.showBoxes && !options.showLabels) return;

  const lineWidth = Math.max(1.5, Math.min(3, 1 + 2 / Math.max(0.2, transform.scale)));
  for (const detection of detections) {
    const x = transform.offsetX + detection.box.x * transform.scale;
    const y = transform.offsetY + detection.box.y * transform.scale;
    const width = detection.box.width * transform.scale;
    const height = detection.box.height * transform.scale;
    const color = classColor(detection.classId);

    if (options.showBoxes) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(x + lineWidth / 2, y + lineWidth / 2, Math.max(0, width - lineWidth), Math.max(0, height - lineWidth));
    }

    if (options.showLabels && width > 26 && height > 16) {
      const text = `${classNameKo(detection.classId)} ${Math.round(detection.score * 100)}%`;
      const fontSize = Math.max(11, Math.min(15, Math.round(12 + 2 * Math.min(1, transform.scale)) ));
      ctx.font = `650 ${fontSize}px ${FONT_STACK}`;
      const padding = Math.round(fontSize * 0.42);
      const textWidth = ctx.measureText(text).width;
      const labelWidth = textWidth + padding * 2;
      const labelHeight = fontSize + padding * 1.6;
      let labelY = y - labelHeight - 2;
      if (labelY < transform.offsetY) labelY = y + 2;

      ctx.fillStyle = color;
      ctx.beginPath();
      const radius = Math.min(6, labelHeight / 2);
      ctx.roundRect(x, labelY, labelWidth, labelHeight, radius);
      ctx.fill();

      ctx.fillStyle = 'rgba(12, 10, 18, 0.92)';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + padding, labelY + labelHeight / 2 + 0.5);
    }
  }
}
