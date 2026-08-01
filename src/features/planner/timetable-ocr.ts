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

  return text;
}
