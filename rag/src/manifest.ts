import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, relative, join } from 'path';
import { minimatch } from 'minimatch';
import { RESERVED_METADATA_KEYS } from './config.ts';
import type { ManifestMetadata } from './types.ts';

/** Raw shape of manifest.json — glob pattern → metadata object. */
type RawManifest = Record<string, ManifestMetadata>;

/**
 * Walks a directory recursively and returns all file paths as relative paths
 * (relative to the given root), using forward slashes for cross-platform
 * glob matching.
 */
function walkDir(root: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const stat = statSync(abs);
      if (stat.isDirectory()) {
        walk(abs);
      } else {
        results.push(relative(root, abs).replaceAll('\\', '/'));
      }
    }
  }

  walk(root);
  return results;
}

/**
 * Computes a specificity score for a glob pattern.
 * More literal (non-glob) path segments = higher score.
 */
function specificity(pattern: string): number {
  const segments = pattern.split('/');
  let score = 0;
  for (const seg of segments) {
    if (!seg.includes('*') && !seg.includes('?') && !seg.includes('{')) {
      score += 2; // literal segment
    } else if (seg === '*' || seg === '**') {
      score += 0; // pure wildcard
    } else {
      score += 1; // partial wildcard (e.g. "din-*.pdf")
    }
  }
  return score;
}

/**
 * Strips reserved auto-detected keys from a metadata object so the manifest
 * cannot accidentally override parser-generated fields.
 */
function stripReserved(meta: ManifestMetadata): ManifestMetadata {
  const cleaned: ManifestMetadata = {};
  for (const [k, v] of Object.entries(meta)) {
    if (!RESERVED_METADATA_KEYS.has(k)) {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

/**
 * Loads and resolves manifest.json from the given input directory.
 *
 * The manifest is the single source of truth for ingestion:
 * - Keys are minimatch-compatible glob patterns (relative to `inputDir`)
 * - Values are metadata objects applied to all matching files
 * - Multiple patterns can match one file; metadata is merged in order of
 *   ascending specificity (most specific pattern wins on conflict)
 * - Files that match no pattern are not ingested
 * - Reserved auto-detected keys are stripped from manifest values
 *
 * @returns Map of `relativePath → merged ManifestMetadata`
 */
export function loadManifest(inputDir: string): Map<string, ManifestMetadata> {
  const manifestPath = resolve(inputDir, 'manifest.json');

  let rawManifest: RawManifest;
  try {
    rawManifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as RawManifest;
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') {
      throw new Error(
        `manifest.json not found in ${inputDir}\n` +
          `A manifest.json is required. It declares which files to ingest and their metadata.\n` +
          `See rag/.env.example for guidance.`,
      );
    }
    throw new Error(`Failed to parse manifest.json: ${nodeErr.message}`);
  }

  if (typeof rawManifest !== 'object' || Array.isArray(rawManifest)) {
    throw new Error('manifest.json must be a JSON object with glob patterns as keys.');
  }

  // Walk the input directory to discover all files
  const allFiles = walkDir(inputDir).filter((f) => f !== 'manifest.json');

  // Sort patterns by specificity ascending — more-specific patterns applied last,
  // winning on metadata key conflicts
  const patterns = Object.entries(rawManifest).sort(
    ([a], [b]) => specificity(a) - specificity(b),
  );

  const result = new Map<string, ManifestMetadata>();

  for (const filePath of allFiles) {
    let mergedMeta: ManifestMetadata = {};
    let matched = false;

    for (const [pattern, meta] of patterns) {
      if (minimatch(filePath, pattern, { matchBase: false, dot: true })) {
        matched = true;
        mergedMeta = { ...mergedMeta, ...stripReserved(meta) };
      }
    }

    if (matched) {
      result.set(filePath, mergedMeta);
    }
  }

  if (result.size === 0) {
    console.warn(
      `Warning: manifest.json matched 0 files in ${inputDir}.\n` +
        `Check that pattern keys are correct and files exist.`,
    );
  }

  return result;
}
