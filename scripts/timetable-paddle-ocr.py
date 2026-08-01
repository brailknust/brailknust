"""Run PaddleOCR for one timetable image and emit spatially ordered text as JSON."""

import argparse
import json
import os


def lines_from_items(items):
    rows = []

    for box, text, confidence in items:
        ys = [float(point[1]) for point in box]
        xs = [float(point[0]) for point in box]
        center_y = sum(ys) / len(ys)
        height = max(ys) - min(ys)
        target = next(
            (
                row
                for row in rows
                if abs(row["y"] - center_y)
                <= max(8, min(row["height"], height) * 0.55)
            ),
            None,
        )
        item = {"x": min(xs), "text": text, "confidence": float(confidence)}

        if target:
            target["items"].append(item)
            target["y"] = (target["y"] + center_y) / 2
            target["height"] = max(target["height"], height)
        else:
            rows.append({"y": center_y, "height": height, "items": [item]})

    rows.sort(key=lambda row: row["y"])
    return "\n".join(
        " | ".join(
            item["text"] for item in sorted(row["items"], key=lambda item: item["x"])
        )
        for row in rows
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("image")
    parser.add_argument(
        "--model-tier",
        choices=("tiny", "small", "medium"),
        default=os.environ.get("TIMETABLE_OCR_MODEL", "tiny"),
    )
    args = parser.parse_args()

    os.environ.setdefault("PADDLE_PDX_MODEL_SOURCE", "BOS")
    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

    from paddleocr import PaddleOCR

    reader = PaddleOCR(
        enable_mkldnn=False,
        text_detection_model_name=f"PP-OCRv6_{args.model_tier}_det",
        text_recognition_model_name=f"PP-OCRv6_{args.model_tier}_rec",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    predictions = list(reader.predict(args.image))

    if not predictions:
        raise RuntimeError("PaddleOCR did not return a prediction.")

    payload = predictions[0].json
    if isinstance(payload, str):
        payload = json.loads(payload)
    payload = payload.get("res", payload)
    boxes = payload.get("rec_polys") or payload.get("dt_polys") or []
    texts = payload.get("rec_texts") or []
    scores = payload.get("rec_scores") or [0] * len(texts)
    items = [
        (box, text, score)
        for box, text, score in zip(boxes, texts, scores)
        if str(text).strip()
    ]
    raw_text = lines_from_items(items).strip()

    if not raw_text:
        raise RuntimeError("PaddleOCR found no readable timetable text.")

    print(
        "OCR_RESULT="
        + json.dumps(
            {
                "text": raw_text,
                "model": f"PP-OCRv6_{args.model_tier}",
                "detections": len(items),
                "averageConfidence": (
                    sum(item[2] for item in items) / len(items) if items else 0
                ),
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
