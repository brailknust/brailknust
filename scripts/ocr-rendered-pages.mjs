import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createWorker } from "tesseract.js";

function argumentsFromCommand() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const outputIndex = args.indexOf("--output");
  const maxPagesIndex = args.indexOf("--max-pages");
  if (inputIndex < 0 || !args[inputIndex + 1]) throw new Error("Pass --input with a rendered page directory.");
  if (outputIndex < 0 || !args[outputIndex + 1]) throw new Error("Pass --output with the OCR text path.");
  return {
    input: path.resolve(args[inputIndex + 1]),
    output: path.resolve(args[outputIndex + 1]),
    maxPages: maxPagesIndex >= 0 ? Number(args[maxPagesIndex + 1]) : Number.POSITIVE_INFINITY,
  };
}

function pageNumber(fileName) {
  return Number(fileName.match(/(\d+)/)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

const options = argumentsFromCommand();
const pageFiles = (await readdir(options.input))
  .filter((fileName) => /\.(png|jpe?g|webp)$/i.test(fileName))
  .sort((left, right) => pageNumber(left) - pageNumber(right))
  .slice(0, options.maxPages);

if (!pageFiles.length) throw new Error("No rendered page images were found.");

const worker = await createWorker("eng");
await worker.setParameters({
  tessedit_pageseg_mode: "6",
  preserve_interword_spaces: "1",
});
const output = [];
let readablePages = 0;

try {
  for (let index = 0; index < pageFiles.length; index += 1) {
    const fileName = pageFiles[index];
    const result = await worker.recognize(await readFile(path.join(options.input, fileName)));
    const text = result.data.text.trim();
    if (text.length >= 40) readablePages += 1;
    output.push(`\n\n--- PAGE ${pageNumber(fileName)} ---\n\n${text}`);
    console.log(`OCR ${index + 1}/${pageFiles.length}: ${fileName} (${text.length} characters)`);
  }
} finally {
  await worker.terminate();
}

const combined = output.join("").trim();
await writeFile(options.output, combined, "utf8");
console.log(JSON.stringify({
  pagesProcessed: pageFiles.length,
  readablePages,
  extractedCharacters: combined.length,
  output: options.output,
}, null, 2));
