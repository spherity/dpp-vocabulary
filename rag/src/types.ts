/** Auto-detected metadata set by parsers. Manifest cannot override these. */
export interface ParserMetadata {
  source: string;
  type: 'pdf' | 'excel' | 'csv' | 'json' | 'json-schema' | 'jsonld';
  page?: number;
  sheet?: string;
}

/** Domain metadata declared in manifest.json. */
export interface ManifestMetadata {
  regulation?: string;
  industry?: string;
  productGroup?: string;
  vocabModule?: string;
  documentType?: string;
  jurisdiction?: string;
  version?: string;
  [key: string]: unknown;
}

/** Full metadata on an upserted chunk (parser + manifest + chunk coords). */
export interface ChunkMetadata extends ParserMetadata, ManifestMetadata {
  heading: string;
  chunkIndex: number;
}

/** A semantic section produced by a parser. */
export interface Section {
  heading: string;
  content: string;
  metadata: ParserMetadata;
}

/** The output shape every parser must return. */
export interface ParseResult {
  sections: Section[];
}

/** A chunk ready to upsert into Upstash Vector. */
export interface Chunk {
  id: string;
  data: string;
  metadata: ChunkMetadata;
}

/** Result returned by upsertChunks. */
export interface UpsertResult {
  upserted: number;
  batches: number;
}
