# AI, diagnostic, OCR, and material evaluation

BRAIL keeps deterministic, no-provider-cost regression sets in `evaluations/` and generated evidence in `evaluation-reports/`. These checks protect policy and parsing behavior; they do not substitute for controlled live-model evaluation or real timetable images.

## Repeatable checks

```text
npm run evaluate:ai
npm run evaluate:ocr
npm run verify:materials:provenance
```

The AI/diagnostic set covers the seven launch courses with imported material. It verifies that subject-matter prompts require grounding, grounded answers cite only available references, missing material produces an explicit refusal, and diagnostic prompts remain self-contained. The current offline set passes 7/7 cases.

The timetable set covers inline 12-hour and 24-hour rows, table blocks, a fragmented OCR day label, and duplicate lines. The current parser matches 6/6 expected rows across 5/5 cases. Real KNUST timetable screenshots are still required for the image-to-text launch check.

The provenance report counts published shared materials by recorded permission basis. Existing records were safely backfilled as `UNKNOWN`; this means review is pending, not that distribution permission exists. New shared uploads require an explicit basis and reference, and open-licence or public-domain uploads also require a source URL.

## Remaining evidence requiring external input

- Run the course cases against the configured live model under a controlled quota and review factual quality, citation correctness, and diagnostic answer validity.
- Supply representative real KNUST timetable images for end-to-end OCR accuracy measurement.
- Supply or confirm rights evidence for each existing shared platform material.
