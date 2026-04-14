import { query, indexInfo } from './vector.ts';
import type { ChunkMetadata } from './types.ts';

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help') {
  console.log(`
Usage:
  node src/query.ts "<query text>" [topK] [--filter "<filter expression>"]

Arguments:
  <query text>   Required. Natural language search query.
  [topK]         Optional. Number of results to return (default: 5).
  --filter       Optional. Upstash metadata filter expression.
                 e.g. "regulation = 'EU 2023/1542' AND documentType = 'regulation'"

Examples:
  pnpm query "carbon footprint per functional unit"
  pnpm query "recycled content requirements" 10
  pnpm query "battery chemistry" 5 --filter "vocabModule = 'MaterialComposition'"
`);
  process.exit(0);
}

const queryText = args[0];
let topK = 5;
let filter: string | undefined;

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--filter' && args[i + 1]) {
    filter = args[++i];
  } else if (!isNaN(parseInt(args[i], 10))) {
    topK = parseInt(args[i], 10);
  }
}

async function main(): Promise<void> {
  console.log(`\nQuery: "${queryText}"`);
  if (filter) console.log(`Filter: ${filter}`);
  console.log(`Top-K : ${topK}\n`);

  let results: Awaited<ReturnType<typeof query>>;
  try {
    results = await query(queryText, topK, filter);
  } catch (err) {
    process.exit(1);
  }

  if (results.length === 0) {
    console.log('No results found.');
    process.exit(0);
  }

  console.log(`=== ${results.length} Result(s) ===\n`);

  results.forEach((result, i) => {
    const meta = result.metadata as ChunkMetadata | undefined;
    console.log(`[${i + 1}] Score: ${result.score?.toFixed(4) ?? 'n/a'}`);
    console.log(`    Source  : ${meta?.source ?? 'unknown'}`);
    console.log(`    Heading : ${meta?.heading ?? 'unknown'}`);
    if (meta?.page) console.log(`    Page    : ${meta.page}`);
    if (meta?.sheet) console.log(`    Sheet   : ${meta.sheet}`);
    if (meta?.regulation) console.log(`    Regulation: ${meta.regulation}`);
    if (meta?.vocabModule) console.log(`    Module  : ${meta.vocabModule}`);
    if (meta?.documentType) console.log(`    DocType : ${meta.documentType}`);
    console.log(`    Chunk   : ${meta?.chunkIndex ?? 0}`);
    console.log();
  });
}

main();
