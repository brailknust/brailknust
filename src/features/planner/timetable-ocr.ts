import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

type TesseractRecognizeResult = {
  data?: {
    text?: string;
  };
};

type TesseractModule = {
  recognize: (
    image: Buffer,
    language?: string,
    options?: {
      cachePath?: string;
      logger?: (message: unknown) => void;
    },
  ) => Promise<TesseractRecognizeResult>;
};

type TesseractImport = Partial<TesseractModule> & {
  default?: Partial<TesseractModule>;
};

const ocrTimeoutMs = 45_000;
const ocrCachePath = join(tmpdir(), "brail-tesseract-cache");

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

export async function extractTextFromImage(image: File) {
  let tesseractModule: TesseractImport;

  try {
    tesseractModule = (await import("tesseract.js")) as TesseractImport;
  } catch (error) {
    throw new Error(
      `Tesseract OCR could not be loaded in this environment: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const recognizer = tesseractModule.recognize ?? tesseractModule.default?.recognize;

  if (!recognizer) {
    throw new Error("Tesseract OCR loaded, but its recognize function was not available.");
  }

  const bytes = Buffer.from(await image.arrayBuffer());
  await mkdir(ocrCachePath, { recursive: true });

  const result = await withTimeout(
    recognizer(bytes, "eng", {
      cachePath: ocrCachePath,
    }),
    ocrTimeoutMs,
  );
  const text = result.data?.text?.trim() ?? "";

  if (!text) {
    throw new Error("No readable text was found in this image. Try a clearer screenshot or add rows manually.");
  }

  return text;
}
