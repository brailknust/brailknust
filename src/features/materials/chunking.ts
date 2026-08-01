const targetChunkSize = 1600;
const overlapSize = 180;

export function chunkMaterialText(input: string) {
  const text = input.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!text) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + targetChunkSize, text.length);
    if (end < text.length) {
      const boundary = Math.max(
        text.lastIndexOf("\n", end),
        text.lastIndexOf(". ", end),
        text.lastIndexOf(" ", end),
      );
      if (boundary > start + targetChunkSize / 2) end = boundary + 1;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(end - overlapSize, start + 1);
  }

  return chunks;
}
