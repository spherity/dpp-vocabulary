import { resetIndex, deleteByFilter, indexInfo } from './vector.ts';
import type { ChunkMetadata } from './types.ts';

// Parse all --filter key=value pairs from argv (ANDed together)
// Example: --filter documentType=regulation --filter jurisdiction=EU
const filters: Partial<ChunkMetadata> = {};
for (let i = 2; i < process.argv.length - 1; i++) {
  if (process.argv[i] === '--filter') {
    const pair = process.argv[i + 1];
    const eq = pair.indexOf('=');
    if (eq > 0) {
      const key = pair.slice(0, eq).trim() as keyof ChunkMetadata;
      const value = pair.slice(eq + 1).trim();
      (filters as Record<string, string>)[key] = value;
    }
  }
}
const hasFilter = Object.keys(filters).length > 0;

async function getCount(): Promise<string | number> {
  try {
    const info = await indexInfo();
    return (
      (info['vectorCount'] as number | undefined) ??
      (info['pendingVectorCount'] as number | undefined) ??
      '?'
    );
  } catch {
    return '?';
  }
}

async function main(): Promise<void> {
  if (hasFilter) {
    console.log(`\n=== Upstash Vector — Delete by Metadata ===\n`);
    console.log('Filters:', filters);
  } else {
    console.log('\n=== Upstash Vector — Reset Index ===\n');
  }

  console.log(`Vector count before: ${await getCount()}`);

  try {
    if (hasFilter) {
      console.log('\nScanning index and deleting matching vectors...');
      const deleted = await deleteByFilter(filters);
      console.log(`\n✓ Deleted ${deleted} vector(s) matching filter.`);
    } else {
      await resetIndex();
      console.log('\n✓ Index reset — all vectors deleted.');
    }
  } catch (err) {
    const error = err as Error;
    console.error(`\n✗ Failed: ${error.message}`);
    if (error.cause) console.error(`  Cause: ${String(error.cause)}`);
    process.exit(1);
  }

  console.log(`Vector count after:  ${await getCount()}`);
  console.log('\nDone.\n');
}

main();
