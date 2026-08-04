import "server-only";

import type { OfficeParserAST, OfficeParserConfig, SupportedFileType } from "officeparser";

import { extractTextFromImage } from "@/features/planner/timetable-ocr";

const officeTypes = new Map<string, SupportedFileType>([
  ["pdf", "pdf"],
  ["docx", "docx"],
  ["pptx", "pptx"],
]);

type OfficeParserModule = typeof import("officeparser");

async function parseOfficeDocument(
  bytes: Buffer,
  config: OfficeParserConfig,
): Promise<OfficeParserAST> {
  const importedParser = await import("officeparser") as OfficeParserModule & {
    default?: {
      parseOffice?: (file: Buffer, options: OfficeParserConfig) => Promise<OfficeParserAST>;
    };
  };
  const parse =
    importedParser.parseOffice
    ?? importedParser.OfficeParser?.parseOffice
    ?? importedParser.default?.parseOffice;

  if (typeof parse !== "function") {
    throw new Error("The document parser could not be initialized.");
  }

  return parse(bytes, config);
}

export const acceptedMaterialExtensions = ["pdf", "docx", "pptx", "txt", "md", "png", "jpg", "jpeg", "webp"];

export function materialFileExtension(fileName: string) {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

const materialMimeTypes: Record<string, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  txt: ["text/plain"],
  md: ["text/markdown", "text/plain"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
};

export async function hasValidMaterialFileType(file: File) {
  const extension = materialFileExtension(file.name);
  if (!materialMimeTypes[extension]?.includes(file.type.toLowerCase())) return false;

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (["txt", "md"].includes(extension)) return !header.includes(0);
  if (extension === "pdf") return String.fromCharCode(...header.slice(0, 5)) === "%PDF-";
  if (["docx", "pptx"].includes(extension)) return header[0] === 0x50 && header[1] === 0x4b;
  if (extension === "png") return header[0] === 0x89 && String.fromCharCode(...header.slice(1, 4)) === "PNG";
  if (["jpg", "jpeg"].includes(extension)) return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (extension === "webp") {
    return String.fromCharCode(...header.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...header.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function extractCourseMaterialText(file: File) {
  const extension = materialFileExtension(file.name);
  if (!acceptedMaterialExtensions.includes(extension)) {
    throw new Error("Unsupported file type. Upload PDF, DOCX, PPTX, TXT, MD, PNG, JPG, or WEBP.");
  }

  if (["txt", "md"].includes(extension)) {
    return (await file.text()).trim();
  }

  if (["png", "jpg", "jpeg", "webp"].includes(extension)) {
    return (await extractTextFromImage(file)).trim();
  }

  const fileType = officeTypes.get(extension);
  if (!fileType) throw new Error("This document type cannot be extracted.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const ast = await parseOfficeDocument(bytes, {
    fileType,
    includeRawContent: false,
    extractAttachments: false,
    ocr: false,
  });
  return ast.toText().trim();
}
