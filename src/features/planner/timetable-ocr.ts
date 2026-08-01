import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

type TesseractRecognizeResult = {
  data?: {
    text?: string;
  };
};

type TesseractModule = {
  recognize: (
    image: Buffer,
    language?: string,
    options?: { logger?: (message: unknown) => void },
  ) => Promise<TesseractRecognizeResult>;
};

type TesseractImport = Partial<TesseractModule> & {
  default?: Partial<TesseractModule>;
};

const ocrTimeoutMs = 45_000;
const paddleOcrTimeoutMs = 180_000;
const execFileAsync = promisify(execFile);

export type TimetableOcrResult = {
  text: string;
  mode: "paddle-ocr" | "tesseract-ocr";
  model?: string;
  detections?: number;
  averageConfidence?: number;
};

type PaddleModelTier = "tiny" | "small" | "medium";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("OCR timed out. Try a smaller, clearer screenshot or add classes manually."));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

async function extractTextWithTesseract(image: File): Promise<TimetableOcrResult> {
  let tesseractModule: TesseractImport;

  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<TesseractImport>;
    tesseractModule = await dynamicImport("tesseract.js");
  } catch {
    throw new Error("Tesseract OCR is not installed. Run npm install tesseract.js, then try again.");
  }

  const recognizer = tesseractModule.recognize ?? tesseractModule.default?.recognize;

  if (!recognizer) {
    throw new Error("Tesseract OCR loaded, but its recognize function was not available.");
  }

  const bytes = Buffer.from(await image.arrayBuffer());
  const result = await withTimeout(recognizer(bytes, "eng"), ocrTimeoutMs);
  const text = result.data?.text?.trim() ?? "";

  if (!text) {
    throw new Error("No readable text was found in this image. Try a clearer screenshot or add rows manually.");
  }

  return { text, mode: "tesseract-ocr" };
}

async function extractTextWithPaddle(
  image: File,
  modelTier: PaddleModelTier,
): Promise<TimetableOcrResult> {
  const python = process.env.TIMETABLE_OCR_PYTHON?.trim();

  if (!python) {
    throw new Error("TIMETABLE_OCR_PYTHON is not configured.");
  }

  const directory = await mkdtemp(path.join(tmpdir(), "brailknust-ocr-"));
  const extension = image.type === "image/png" ? ".png" : ".jpg";
  const imagePath = path.join(directory, `timetable${extension}`);

  try {
    await writeFile(imagePath, Buffer.from(await image.arrayBuffer()));
    const { stdout } = await execFileAsync(
      python,
      [
        path.join(process.cwd(), "scripts", "timetable-paddle-ocr.py"),
        imagePath,
        "--model-tier",
        modelTier,
      ],
      {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: paddleOcrTimeoutMs,
        windowsHide: true,
      },
    );
    const resultLine = stdout
      .split(/\r?\n/)
      .findLast((line) => line.startsWith("OCR_RESULT="));

    if (!resultLine) {
      throw new Error("PaddleOCR completed without returning a readable result.");
    }

    const result = JSON.parse(resultLine.slice("OCR_RESULT=".length)) as {
      text?: string;
      model?: string;
      detections?: number;
      averageConfidence?: number;
    };
    const text = result.text?.trim() ?? "";

    if (!text) {
      throw new Error("PaddleOCR found no readable timetable text.");
    }

    return {
      text,
      mode: "paddle-ocr",
      model: result.model,
      detections: result.detections,
      averageConfidence: result.averageConfidence,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function extractTimetableFromImage(
  image: File,
  options?: { modelTier?: PaddleModelTier },
): Promise<TimetableOcrResult> {
  if (process.env.TIMETABLE_OCR_ENGINE?.toLowerCase() === "paddle") {
    try {
      const configuredTier = process.env.TIMETABLE_OCR_MODEL?.trim();
      const modelTier =
        options?.modelTier ??
        (configuredTier === "small" || configuredTier === "medium" ? configuredTier : "tiny");
      return await extractTextWithPaddle(image, modelTier);
    } catch (error) {
      if (process.env.TIMETABLE_OCR_STRICT === "true") throw error;
      console.warn("PaddleOCR failed; falling back to Tesseract.", error);
    }
  }

  return extractTextWithTesseract(image);
}

export async function extractTextFromImage(image: File) {
  return (await extractTimetableFromImage(image)).text;
}
