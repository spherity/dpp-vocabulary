import { resolve, join } from 'path';
import { INPUT_DIR } from './config.ts';
import { loadManifest } from './manifest.ts';
import { parse } from './parsers/index.ts';
import { chunkSections } from './chunker.ts';
import { upsertChunks, indexInfo } from './vector.ts';
import type { Chunk } from './types.ts';

// Allow overriding input dir via CLI argument: node src/ingest.ts /path/to/dir
const inputDir = process.argv[2] ? resolve(process.argv[2]) : INPUT_DIR;

async function main(): Promise<void> {
  console.log(`\n=== Battery Pass RAG Ingestion ===`);
  console.log(`Input directory: ${inputDir}`);
  console.log(`Node version  : ${process.version}`);
  console.log(`Timestamp     : ${new Date().toISOString()}\n`);

  // ── 1. Load and resolve manifest ──────────────────────────────────────────
  console.log('Loading manifest.json...');
  let fileMap: Map<string, Record<string, unknown>>;
  try {
    fileMap = loadManifest(inputDir);
  } catch (err) {
    console.error(`\nError: ${(err as Error).message}`);
    process.exit(1);
  }
  console.log(`  → ${fileMap.size} file(s) matched by manifest patterns\n`);

  // ── 2. Parse each file ───────────────────────────────────────────────────
  const stats = {
    files: 0,
    filesErrored: 0,
    sections: 0,
    chunks: 0,
  };
  const allChunks: Chunk[] = [];

  for (const [relativePath, manifestMeta] of fileMap.entries()) {
    const absolutePath = join(inputDir, relativePath);
    console.log(`\nParsing ${relativePath}...`);
    const parseStart = Date.now();

    let sections: Awaited<ReturnType<typeof parse>>['sections'];
    try {
      ({ sections } = await parse(absolutePath, relativePath));
      console.log(`  ✓ Parsed ${sections.length} section(s) in ${Date.now() - parseStart}ms`);
    } catch (err) {
      const error = err as Error;
      console.error(`  ✗ Failed to parse: ${error.message}`);
      if (error.stack) console.error(`  Stack: ${error.stack}`);
      stats.filesErrored++;
      continue;
    }

    // ── 3. Chunk sections ──────────────────────────────────────────────────
    const chunks = chunkSections(sections, manifestMeta);
    console.log(`  ✓ Chunked into ${chunks.length} chunk(s)`);

    stats.files++;
    stats.sections += sections.length;
    stats.chunks += chunks.length;
    allChunks.push(...chunks);
  }

  if (allChunks.length === 0) {
    console.warn('\nNo chunks produced. Nothing to upsert.');
    process.exit(0);
  }

  // ── 4. Upsert to Upstash Vector ───────────────────────────────────────────
  console.log(`\nUpserting ${allChunks.length} chunk(s) to Upstash Vector...`);
  const upsertStart = Date.now();
  let upsertResult: Awaited<ReturnType<typeof upsertChunks>>;
  try {
    upsertResult = await upsertChunks(allChunks);
    console.log(`  ✓ Upsert completed in ${Date.now() - upsertStart}ms`);
  } catch (err) {
    const error = err as Error;
    console.error(`\n✗ Upstash upsert failed: ${error.message}`);
    if (error.cause) console.error(`  Cause : ${String(error.cause)}`);
    if (error.stack) console.error(`  Stack : ${error.stack}`);
    console.error(`\nTroubleshooting:`);
    console.error(`  1. Check UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN in rag/.env`);
    console.error(`  2. Verify the Upstash index exists and the model is configured`);
    console.error(`  3. Check your internet connection / firewall`);
    process.exit(1);
  }

  // ── 5. Summary ────────────────────────────────────────────────────────────
  console.log('\n=== Ingestion Summary ===');
  console.log(`  Files processed : ${stats.files}`);
  if (stats.filesErrored > 0) {
    console.log(`  Files errored   : ${stats.filesErrored}`);
  }
  console.log(`  Sections found  : ${stats.sections}`);
  console.log(`  Chunks created  : ${stats.chunks}`);
  console.log(
    `  Chunks upserted : ${upsertResult.upserted} (${upsertResult.batches} batch(es))`,
  );

  try {
    const info = await indexInfo();
    const count =
      (info['vectorCount'] as number | undefined) ??
      (info['pendingVectorCount'] as number | undefined) ??
      '?';
    console.log(`  Index total     : ${count} vector(s)`);
  } catch {
    // Non-critical
  }

  console.log('\nDone.\n');
}

main();
