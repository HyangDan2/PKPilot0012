import { describe, expect, it } from 'vitest';
import { COCO_CLASSES, COCO_COUNT, classColor, classHue, cocoClass, classNameKo } from '../src/engine/labels';

describe('COCO 80', () => {
  it('has exactly 80 entries with 0..79 as ids', () => {
    expect(COCO_COUNT).toBe(80);
    expect(COCO_CLASSES.map((entry) => entry.id)).toEqual(Array.from({ length: 80 }, (_, index) => index));
  });

  it('starts with person and ends with toothbrush, as the model head expects', () => {
    expect(COCO_CLASSES[0].en).toBe('person');
    expect(COCO_CLASSES[16].en).toBe('dog');
    expect(COCO_CLASSES[79].en).toBe('toothbrush');
  });

  it('carries a Korean label for every class', () => {
    for (const entry of COCO_CLASSES) {
      expect(entry.ko.length).toBeGreaterThan(0);
    }
    expect(classNameKo(2)).toBe('자동차');
    expect(classNameKo(0)).toBe('사람');
  });

  it('falls back for an unknown id instead of returning undefined', () => {
    expect(cocoClass(200).ko).toBe('클래스 200');
  });

  it('gives each class a stable colour', () => {
    expect(classHue(2)).toBe(classHue(2));
    expect(classColor(2)).toContain('hsla');
    expect(new Set(COCO_CLASSES.map((entry) => classHue(entry.id))).size).toBeGreaterThan(60);
  });
});
