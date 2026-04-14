import { Index } from '@upstash/vector';
import type { RangeResult } from '@upstash/vector';
import {
  UPSTASH_VECTOR_REST_URL,
  UPSTASH_VECTOR_REST_TOKEN,
  UPSERT_BATCH_SIZE,
} from './config.ts';
import type { Chunk, ChunkMetadata, UpsertResult } from './types.ts';

function createIndex(): Index<ChunkMetadata> {
  if (!UPSTASH_VECTOR_REST_URL || !UPSTASH_VECTOR_REST_TOKEN) {
    throw new Error(
      'Missing Upstash Vector credentials.\n' +
        'Set UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN in rag/.env',
    );
  }

  return Index.fromEnv();
}

// Lazy singleton — instantiated on first use
let _index: Index<ChunkMetadata> | null = null;

function getIndex(): Index<ChunkMetadata> {
  if (!_index) _index = createIndex();
  return _index;
}

/**
 * Upserts an array of chunks to the Upstash Vector index in batches.
 * Each chunk uses the `data` field (raw text) so Upstash generates the
 * embedding server-side using the index's configured built-in model.
 */
export async function upsertChunks(chunks: Chunk[]): Promise<UpsertResult> {
  const index = getIndex();
  const totalBatches = Math.ceil(chunks.length / UPSERT_BATCH_SIZE);
  let upserted = 0;
  let batches = 0;

  for (let i = 0; i < chunks.length; i += UPSERT_BATCH_SIZE) {
    const batch = chunks.slice(i, i + UPSERT_BATCH_SIZE);
    batches++;
    process.stdout.write(`  [vector] Upserting batch ${batches}/${totalBatches} (${batch.length} chunks) ... `);

    try {
      await index.upsert(
        batch.map(({ id, data, metadata }) => ({ id, data, metadata })),
      );
      process.stdout.write('OK\n');
    } catch (err) {
      const error = err as Error;
      process.stdout.write('FAILED\n');
      console.error(`  [vector] Batch ${batches}/${totalBatches} failed: ${error.message}`);
      if (error.cause) console.error(`  [vector] Cause: ${String(error.cause)}`);
      if (error.stack) console.error(`  [vector] Stack: ${error.stack}`);
      throw error;
    }

    upserted += batch.length;
  }

  return { upserted, batches };
}

/**
 * Queries the Upstash Vector index using raw text (embedded server-side).
 *
 * @param text    Natural language query
 * @param topK    Number of results to return (default: 5)
 * @param filter  Optional Upstash metadata filter expression,
 *                e.g. `"regulation = 'EU 2023/1542' AND documentType = 'regulation'"`
 */
export async function query(
  text: string,
  topK = 5,
  filter?: string,
): Promise<Array<{ id: string | number; score: number; metadata?: ChunkMetadata }>> {
  const index = getIndex();

  return index.query({
    data: text,
    topK,
    includeMetadata: true,
    ...(filter ? { filter } : {}),
  });
}

/** Returns info/stats for the index (vector count, dimension, etc.). */
export async function indexInfo(): Promise<Record<string, unknown>> {
  return getIndex().info() as Promise<Record<string, unknown>>;
}

/**
 * Deletes ALL vectors from the index (all namespaces).
 * This is irreversible — use only before a full re-ingestion.
 */
export async function resetIndex(): Promise<void> {
  await getIndex().reset({ all: true });
}

/**
 * Deletes all vectors whose metadata matches ALL of the given key=value pairs.
 * Performs a paginated range-scan of the full index, filters client-side,
 * then deletes matching IDs in batches.
 *
 * @param filters  Plain key=value pairs to match against chunk metadata.
 *                 All pairs must match (AND semantics).
 *                 Example: `{ documentType: 'regulation', jurisdiction: 'EU' }`
 * @returns Number of vectors deleted.
 */
export async function deleteByFilter(
  filters: Partial<ChunkMetadata>,
): Promise<number> {
  const index = getIndex();
  const ids: Array<string | number> = [];
  let cursor = '';
  let hasMore = true;

  while (hasMore) {
    const page: RangeResult<ChunkMetadata> = await index.range({
      cursor,
      limit: 1000,
      includeMetadata: true,
      includeVectors: false,
    });
    for (const vec of page.vectors) {
      const meta = vec.metadata;
      if (!meta) continue;
      const matches = Object.entries(filters).every(
        ([k, v]) => meta[k as keyof ChunkMetadata] === v,
      );
      if (matches) ids.push(vec.id);
    }
    cursor = page.nextCursor;
    hasMore = cursor !== '0' && cursor !== '';
  }

  if (ids.length === 0) return 0;

  for (let i = 0; i < ids.length; i += UPSERT_BATCH_SIZE) {
    await index.delete(ids.slice(i, i + UPSERT_BATCH_SIZE) as string[]);
  }

  return ids.length;
}