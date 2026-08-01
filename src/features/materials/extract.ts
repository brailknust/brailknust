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
