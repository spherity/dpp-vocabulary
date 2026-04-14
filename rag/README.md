# Battery Pass RAG Pipeline

Retrieval-Augmented Generation ingestion pipeline for the Battery Pass vocabulary. Parses regulatory documents (PDF, Excel, CSV, JSON, JSON-LD) into semantic chunks and upserts them into an [Upstash Vector](https://upstash.com/docs/vector/overall/getstarted) index for use in vocabulary generation and question-answering workflows.

---

## Architecture

```
input directory/
  manifest.json          ← declares which files to ingest + domain metadata
  *.pdf / *.xlsx / ...   ← regulatory documents

         │
         ▼
    manifest.ts           resolves glob patterns → file metadata map
         │
         ▼
    parsers/              routes each file to the right parser
      pdf.ts              extracts sections by heading
      excel.ts            extracts sections by sheet + row groups
      csv.ts              extracts rows as sections
      json.ts             extracts keys/values as sections
         │
         ▼
    chunker.ts            splits sections into overlapping text chunks
                          (max 2000 chars, 200-char overlap)
         │
         ▼
    vector.ts             upserts chunks to Upstash Vector in batches of 100
                          (embeddings generated server-side by the index model)
```

---

## Prerequisites

- Node.js ≥ 18
- pnpm ≥ 10
- An [Upstash Vector](https://console.upstash.com/vector) index configured with a built-in embedding model (e.g. `BAAI/bge-large-en-v1.5`)
- _(Optional)_ WireGuard — only needed if your Upstash index is behind a Fly.io private network

---

## Setup

```bash
cd rag
pnpm install
cp .env.example .env
```

Edit `.env`:

```env
UPSTASH_VECTOR_REST_URL=https://<your-index>.upstash.io
UPSTASH_VECTOR_REST_TOKEN=<your-token>

# Optional: override default input directory (default: ../dbp/v1.3/input)
# INPUT_DIR=../dbp/v1.3/input
```

---

## Input Directory & manifest.json

The pipeline ingests files from an input directory (default: `../dbp/v1.3/input` relative to `rag/`, configurable via `INPUT_DIR` in `.env`).

Every input directory **must** contain a `manifest.json`. It controls which files are ingested and attaches domain metadata to each file:

```json
{
  "**/*.pdf": {
    "documentType": "regulation",
    "jurisdiction": "EU"
  },
  "longlist-*.xlsx": {
    "documentType": "longlist",
    "regulation": "EU 2023/1542",
    "vocabModule": "GeneralProductInformation"
  }
}
```

**Rules:**
- Keys are [minimatch](https://github.com/isaacs/minimatch) glob patterns relative to the input directory
- Values are metadata objects merged onto all matching files
- Multiple patterns can match one file — more specific patterns win on key conflicts
- Files not matched by any pattern are silently skipped
- Reserved auto-detected keys (`source`, `type`, `heading`, `page`, `sheet`, `chunkIndex`) cannot be overridden by the manifest

**Available metadata fields:**

| Field | Description |
|---|---|
| `regulation` | Normative reference (e.g. `"EU 2023/1542"`) |
| `industry` | Industry sector (e.g. `"battery"`) |
| `productGroup` | Product group (e.g. `"EV battery"`) |
| `vocabModule` | Vocabulary module (e.g. `"CarbonFootprint"`) |
| `documentType` | Document type (`"regulation"`, `"longlist"`, `"spec"`, …) |
| `jurisdiction` | Jurisdiction (e.g. `"EU"`, `"DE"`) |
| `version` | Document version string |

---

## Usage

### Ingest

```bash
pnpm ingest                        # uses INPUT_DIR from .env / default
pnpm ingest /path/to/custom/dir    # override input directory at runtime
```

### Query

```bash
pnpm query "<query text>"
pnpm query "<query text>" [topK]
pnpm query "<query text>" [topK] --filter "<filter expression>"
```

**Examples:**

```bash
pnpm query "carbon footprint per functional unit"
pnpm query "recycled content requirements" 10
pnpm query "battery chemistry" 5 --filter "vocabModule = 'MaterialComposition'"
pnpm query "state of health" 3 --filter "regulation = 'EU 2023/1542' AND documentType = 'regulation'"
```

Filter expressions use [Upstash Vector filter syntax](https://upstash.com/docs/vector/features/filtering).

### Reset

```bash
# Delete ALL vectors from the index (full re-ingestion)
pnpm reset

# Delete only vectors matching specific metadata (selective cleanup)
pnpm reset --filter documentType=regulation
pnpm reset --filter documentType=longlist --filter jurisdiction=EU
```

Multiple `--filter` flags are ANDed together. A full reset without filters is irreversible.

---

## WireGuard (Fly.io private network)

If the Upstash index is accessed via a Fly.io private WireGuard network, use the `wg:*` script variants. 

The WireGuard config is expected at `../fly-wireguard.conf` relative to `rag/`. Generate it with:

```bash
pnpm wg:config
```

The following scripts bring the tunnel up before the command and tear it down on exit:

```bash
pnpm wg:ingest                  # tunnel up → ingest → tunnel down
pnpm wg:ingest /path/to/dir     # with custom input directory
pnpm wg:query                   # tunnel up → interactive query → tunnel down
pnpm wg:reset                   # tunnel up → reset → tunnel down
```

---

## Chunking Strategy

Each parsed section is split into overlapping text chunks before upsert:

| Parameter | Value |
|---|---|
| Max chunk size | 2000 characters (~500 tokens) |
| Overlap | 200 characters |
| Chunk ID | SHA-256 of `source::heading::chunkIndex` (deterministic — safe to re-ingest) |

Split boundaries are tried in order: paragraph (`\n\n`) → line (`\n`) → sentence (`. `) → word (` `) → hard cut. Re-ingesting the same content with the same manifest produces identical IDs, so upserts are idempotent.

---

## Supported File Types

| Extension | Parser | Section strategy |
|---|---|---|
| `.pdf` | `pdf.ts` | Heading-delimited sections extracted by page |
| `.xlsx`, `.xls` | `excel.ts` | One section per sheet or row group |
| `.csv` | `csv.ts` | Row-based sections |
| `.json`, `.jsonld` | `json.ts` | Key/value groups as sections |
