import "server-only";

import { prisma } from "@/server/db";

const stopWords = new Set([
  "about", "after", "again", "also", "and", "are", "can", "could", "does",
  "explain", "for", "from", "have", "how", "into", "more", "please", "that",
  "the", "their", "then", "this", "what", "when", "where", "which", "with",
  "would", "you",
]);

function searchTerms(message: string) {
  return [...new Set(
    message
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g)
      ?.filter((term) => !stopWords.has(term)) ?? [],
  )].slice(0, 8);
}

export async function retrieveCourseMaterialContext(
  userId: string,
  semesterId: string,
  enrollmentId: string,
  message: string,
) {
  const terms = searchTerms(message);
  if (!terms.length) return { passages: [], sources: [] };

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, userId, semesterId },
    select: { courseId: true },
  });
  if (!enrollment) return { passages: [], sources: [] };

  const [privateChunks, platformChunks] = await Promise.all([
    prisma.materialChunk.findMany({
      where: {
        material: {
          enrollmentId,
          status: "READY",
        },
        OR: terms.map((term) => ({
          content: { contains: term, mode: "insensitive" as const },
        })),
      },
      select: {
        id: true,
        chunkIndex: true,
        content: true,
        pageLabel: true,
        topic: { select: { title: true } },
        material: {
          select: { id: true, title: true, type: true, sourceUrl: true },
        },
      },
      take: 30,
    }),
    prisma.platformMaterialChunk.findMany({
      where: {
        material: {
          courseId: enrollment.courseId,
          status: "PUBLISHED",
        },
        OR: terms.map((term) => ({
          content: { contains: term, mode: "insensitive" as const },
        })),
      },
      select: {
        id: true,
        chunkIndex: true,
        content: true,
        topic: { select: { title: true } },
        material: {
          select: { id: true, title: true, type: true, sourceUrl: true },
        },
      },
      take: 30,
    }),
  ]);

  const candidates = [
    ...platformChunks.map((chunk) => ({
      ...chunk,
      pageLabel: null as string | null,
      sourceType: "PLATFORM" as const,
    })),
    ...privateChunks.map((chunk) => ({
      ...chunk,
      sourceType: "PRIVATE" as const,
    })),
  ];

  const ranked = candidates
    .map((chunk) => {
      const content = chunk.content.toLowerCase();
      const lexicalScore = terms.reduce(
        (total, term) => total + (content.includes(term) ? 1 : 0),
        0,
      );
      return {
        ...chunk,
        score: lexicalScore + (chunk.sourceType === "PLATFORM" ? 0.35 : 0),
      };
    })
    .sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex)
    .slice(0, 5);

  return {
    passages: ranked.map((chunk, index) => ({
      reference: `S${index + 1}`,
      materialTitle: chunk.material.title,
      sourceType: chunk.sourceType,
      topic: chunk.topic?.title ?? null,
      pageLabel: chunk.pageLabel,
      content: chunk.content,
    })),
    sources: ranked.map((chunk, index) => ({
      reference: `S${index + 1}`,
      materialId: chunk.material.id,
      materialTitle: chunk.material.title,
      materialType: chunk.material.type,
      sourceType: chunk.sourceType,
      topic: chunk.topic?.title ?? null,
      pageLabel: chunk.pageLabel,
      sourceUrl: chunk.material.sourceUrl,
      chunkId: chunk.id,
    })),
  };
}
