import { createHash } from 'crypto';
import { MAX_CHUNK_SIZE, CHUNK_OVERLAP } from './config.ts';
import type { Section, Chunk, ChunkMetadata, ManifestMetadata } from './types.ts';

/**
 * Generates a deterministic chunk ID from its content coordinates.
 * Using a hash guarantees idempotent re-ingestion (same content → same ID).
 */
function chunkId(source: string, heading: string, chunkIndex: number): string {
  return createHash('sha256')
    .update(`${source}::${heading}::${chunkIndex}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Splits a long text into overlapping sub-chunks.
 *
 * Strategy:
 *   1. Split on double newlines (paragraph boundaries first)
 *   2. Fall back to single newlines
 *   3. Fall back to sentence boundaries (". ")
 *   4. Hard-cut at MAX_CHUNK_SIZE as a last resort
 *
 * Each chunk includes a leading overlap from the end of the previous chunk to
 * prevent information loss at boundaries.
 */
function splitText(text: string): string[] {
  if (text.length <= MAX_CHUNK_SIZE) return [text];

  const separators = ['\n\n', '\n', '. ', ' '];
  let segments: string[] = [text];

  for (const sep of separators) {
    const split = segments.flatMap((seg) => {
      if (seg.length <= MAX_CHUNK_SIZE) return [seg];
      return seg
        .split(sep)
        .map((s, i, arr) => (i < arr.length - 1 && sep !== ' ' ? s + sep : s));
    });
    segments = split;
    if (segments.every((s) => s.length <= MAX_CHUNK_SIZE)) break;
  }

  // Merge short adjacent segments and apply overlap
  const chunks: string[] = [];
  let current = '';

  for (const seg of segments) {
    if ((current + seg).length <= MAX_CHUNK_SIZE) {
      current += seg;
    } else {
      if (current.trim().length > 0) chunks.push(current.trim());
      const overlap =
        current.length > CHUNK_OVERLAP ? current.slice(-CHUNK_OVERLAP) : current;
      current = overlap + seg;
    }
  }

  if (current.trim().length > 0) chunks.push(current.trim());

  // Hard-cut any remaining oversized chunks
  return chunks.flatMap((chunk) => {
    if (chunk.length <= MAX_CHUNK_SIZE) return [chunk];
    const hardChunks: string[] = [];
    for (let i = 0; i < chunk.length; i += MAX_CHUNK_SIZE - CHUNK_OVERLAP) {
      hardChunks.push(chunk.slice(i, i + MAX_CHUNK_SIZE));
    }
    return hardChunks;
  });
}

/**
 * Converts an array of sections (from any parser) into chunks ready for
 * upsert to Upstash Vector.
 *
 * Each chunk carries:
 * - `id`       — deterministic SHA-256-based ID (idempotent re-ingestion)
 * - `data`     — raw text string (Upstash will embed it server-side)
 * - `metadata` — merged parser metadata + manifest domain metadata + chunk coords
 */
export function chunkSections(
  sections: Section[],
  manifestMeta: ManifestMetadata = {},
): Chunk[] {
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const { heading, content, metadata: parserMeta } = section;

    if (!content || content.trim().length === 0) continue;

    const textChunks = splitText(content.trim());

    textChunks.forEach((text, chunkIndex) => {
      chunks.push({
        id: chunkId(parserMeta.source, heading, chunkIndex),
        data: text,
        metadata: {
          // Manifest domain metadata first (lower priority)
          ...manifestMeta,
          // Parser auto-detected fields (always override manifest)
          ...parserMeta,
          // Chunk-level fields
          heading,
          chunkIndex,
        } as ChunkMetadata,
      });
    });
  }

  return chunks;
}
