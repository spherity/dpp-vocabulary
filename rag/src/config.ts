import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from the rag/ project root
try {
  const { config } = await import('dotenv');
  config({ path: resolve(__dirname, '..', '.env') });
} catch {
  // dotenv is optional at import time; env vars may be set externally
}

export const UPSTASH_VECTOR_REST_URL: string | undefined =
  process.env['UPSTASH_VECTOR_REST_URL'];

export const UPSTASH_VECTOR_REST_TOKEN: string | undefined =
  process.env['UPSTASH_VECTOR_REST_TOKEN'];

export const INPUT_DIR: string = process.env['INPUT_DIR']
  ? resolve(process.env['INPUT_DIR'])
  : resolve(__dirname, 'resources');

/** Max characters per chunk (~500 tokens, fits BAAI/bge-large-en-v1.5 512-token limit). */
export const MAX_CHUNK_SIZE = 2000;

/** Characters of overlap between adjacent chunks. */
export const CHUNK_OVERLAP = 200;

export const UPSERT_BATCH_SIZE = 100;

/** Reserved metadata keys set by parsers — manifest cannot override them. */
export const RESERVED_METADATA_KEYS = new Set<string>([
  'source',
  'type',
  'heading',
  'page',
  'sheet',
  'chunkIndex',
]);
