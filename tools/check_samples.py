#!/usr/bin/env python3
"""Sanity harness: run yolo11n.onnx over the bundled samples with the same
letterbox / NMS math the web app uses, so a sample is only shipped if real
objects actually come out of it.

    python3 tools/check_samples.py public/samples/*.jpg
"""
from __future__ import annotations

import sys

import numpy as np
from PIL import Image
import onnxruntime as ort

MODEL = "public/models/yolo11n.onnx"
SIZE = 640

CLASSES = None


def letterbox(img: Image.Image, size: int = SIZE):
    w, h = img.size
    scale = min(size / w, size / h)
    nw, nh = round(w * scale), round(h * scale)
    resized = img.resize((nw, nh), Image.BILINEAR)
    canvas = Image.new("RGB", (size, size), (114, 114, 114))
    px, py = (size - nw) // 2, (size - nh) // 2
    canvas.paste(resized, (px, py))
    return canvas, scale, px, py


def nms(boxes, scores, iou_thr):
    order = np.argsort(scores)[::-1]
    keep = []
    while order.size:
        i = order[0]
        keep.append(i)
        if order.size == 1:
            break
        rest = order[1:]
        xx1 = np.maximum(boxes[i, 0], boxes[rest, 0])
        yy1 = np.maximum(boxes[i, 1], boxes[rest, 1])
        xx2 = np.minimum(boxes[i, 2], boxes[rest, 2])
        yy2 = np.minimum(boxes[i, 3], boxes[rest, 3])
        inter = np.clip(xx2 - xx1, 0, None) * np.clip(yy2 - yy1, 0, None)
        a = (boxes[i, 2] - boxes[i, 0]) * (boxes[i, 3] - boxes[i, 1])
        b = (boxes[rest, 2] - boxes[rest, 0]) * (boxes[rest, 3] - boxes[rest, 1])
        iou = inter / np.maximum(a + b - inter, 1e-9)
        order = rest[iou <= iou_thr]
    return keep


def detect(sess, path, conf=0.25, iou=0.45):
    img = Image.open(path).convert("RGB")
    padded, scale, px, py = letterbox(img)
    arr = np.asarray(padded, dtype=np.float32) / 255.0
    x = np.transpose(arr, (2, 0, 1))[None]
    out = sess.run(None, {"images": x})[0][0]  # (84, 8400)
    boxes_raw = out[:4].T  # cx, cy, w, h
    cls_scores = out[4:].T  # 80 x N
    best_cls = cls_scores.argmax(axis=1)
    best_score = cls_scores.max(axis=1)
    mask = best_score >= conf
    boxes_raw, best_cls, best_score = boxes_raw[mask], best_cls[mask], best_score[mask]
    xy = np.stack([
        boxes_raw[:, 0] - boxes_raw[:, 2] / 2,
        boxes_raw[:, 1] - boxes_raw[:, 3] / 2,
        boxes_raw[:, 0] + boxes_raw[:, 2] / 2,
        boxes_raw[:, 1] + boxes_raw[:, 3] / 2,
    ], axis=1)
    kept = nms(xy, best_score, iou)
    res = []
    for i in kept:
        x1, y1, x2, y2 = xy[i]
        res.append((
            int(best_cls[i]), float(best_score[i]),
            (x1 - px) / scale, (y1 - py) / scale, (x2 - px) / scale, (y2 - py) / scale,
        ))
    return img.size, res


def main() -> int:
    sess = ort.InferenceSession(MODEL, providers=["CPUExecutionProvider"])
    ok = True
    for path in sys.argv[1:]:
        size, res = detect(sess, path)
        print(f"\n{path}  {size[0]}x{size[1]}  detections={len(res)}")
        for cid, score, x1, y1, x2, y2 in res[:8]:
            print(f"   class {cid:2d} {score:.3f}  [{x1:.0f},{y1:.0f},{x2:.0f},{y2:.0f}]")
        if not res:
            ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
