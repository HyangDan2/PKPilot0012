import type { Detection } from '../engine/geometry';
import { cocoClass } from '../engine/labels';
import { paintDetections } from '../render/annotate';

export interface ExportMeta {
  name: string;
  width: number;
  height: number;
  confidence: number;
  iou: number;
}

/** The JSON the studio hands out: source pixels, class ids, scores, nothing opaque. */
export function buildDetectionJson(meta: ExportMeta, detections: readonly Detection[]): string {
  const byClass = new Map<number, number>();
  for (const detection of detections) {
    byClass.set(detection.classId, (byClass.get(detection.classId) ?? 0) + 1);
  }

  const payload = {
    app: 'ObjectLens',
    studio: 'HD2Lab',
    model: 'yolo11n.onnx — COCO 80',
    generatedAt: new Date().toISOString(),
    source: { name: meta.name, width: meta.width, height: meta.height },
    settings: { confidence: round(meta.confidence), iou: round(meta.iou) },
    summary: {
      total: detections.length,
      byClass: Array.from(byClass, ([classId, count]) => ({
        classId,
        className: cocoClass(classId).en,
        classNameKo: cocoClass(classId).ko,
        count,
      })).sort((a, b) => b.count - a.count || a.classId - b.classId),
    },
    detections: detections.map((detection) => ({
      classId: detection.classId,
      className: cocoClass(detection.classId).en,
      classNameKo: cocoClass(detection.classId).ko,
      score: round(detection.score),
      box: {
        x: round(detection.box.x),
        y: round(detection.box.y),
        width: round(detection.box.width),
        height: round(detection.box.height),
      },
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Full-resolution PNG with the same boxes, labels and mosaics the stage shows. */
export async function composeAnnotatedPng(options: {
  source: CanvasImageSource;
  width: number;
  height: number;
  detections: readonly Detection[];
  blurred: readonly Detection[];
  showBoxes: boolean;
  showLabels: boolean;
  mosaic: boolean;
}): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(options.width));
  canvas.height = Math.max(1, Math.round(options.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('내보낼 캔버스를 만들지 못했습니다.');

  ctx.drawImage(options.source, 0, 0, canvas.width, canvas.height);
  paintDetections(ctx, {
    detections: options.detections,
    blurred: options.blurred,
    source: options.source,
    srcWidth: canvas.width,
    srcHeight: canvas.height,
    transform: { scale: 1, offsetX: 0, offsetY: 0 },
    showBoxes: options.showBoxes,
    showLabels: options.showLabels,
    mosaic: options.mosaic,
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG를 만들지 못했습니다.');
  return blob;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeBaseName(name: string): string {
  const stem = name
    .replace(/\.[^./\\]+$/, '')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '');
  return stem.length > 0 ? stem.slice(0, 60) : 'objectlens';
}
