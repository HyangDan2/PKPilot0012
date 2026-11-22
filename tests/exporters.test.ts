import { describe, expect, it } from 'vitest';
import { buildDetectionJson, safeBaseName } from '../src/export/exporters';
import type { Detection } from '../src/engine/geometry';

const detections: Detection[] = [
  { classId: 2, score: 0.8534213, box: { x: 1171.4, y: 604.2, width: 108.8, height: 97.6 } },
  { classId: 0, score: 0.644, box: { x: 87, y: 583, width: 31, height: 75 } },
  { classId: 2, score: 0.675, box: { x: 1033, y: 581, width: 148, height: 94 } },
];

describe('buildDetectionJson', () => {
  const json = buildDetectionJson({ name: 'sample-street.jpg', width: 1280, height: 853, confidence: 0.25, iou: 0.45 }, detections);
  const payload = JSON.parse(json);

  it('names the studio and the model', () => {
    expect(payload.app).toBe('ObjectLens');
    expect(payload.model).toContain('yolo11n');
  });

  it('keeps source pixels and class identity per detection', () => {
    expect(payload.detections).toHaveLength(3);
    const first = payload.detections[0];
    expect(first.classId).toBe(2);
    expect(first.className).toBe('car');
    expect(first.classNameKo).toBe('자동차');
    expect(first.box).toEqual({ x: 1171.4, y: 604.2, width: 108.8, height: 97.6 });
    expect(first.score).toBeCloseTo(0.853, 3);
  });

  it('summarises per class, biggest group first', () => {
    expect(payload.summary.total).toBe(3);
    expect(payload.summary.byClass[0]).toMatchObject({ classId: 2, count: 2 });
  });

  it('records the settings that produced the boxes', () => {
    expect(payload.settings).toEqual({ confidence: 0.25, iou: 0.45 });
    expect(payload.source).toEqual({ name: 'sample-street.jpg', width: 1280, height: 853 });
  });

  it('ends with a newline so the file is a clean text file', () => {
    expect(json.endsWith('\n')).toBe(true);
  });
});

describe('safeBaseName', () => {
  it('drops the extension and keeps letters and digits', () => {
    expect(safeBaseName('sample-street.jpg')).toBe('sample-street');
    expect(safeBaseName('도심 거리.png')).toBe('도심-거리');
  });

  it('falls back for a name with nothing usable', () => {
    expect(safeBaseName('...')).toBe('objectlens');
  });
});
