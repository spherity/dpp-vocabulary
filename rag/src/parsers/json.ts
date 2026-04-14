import { readFileSync } from 'fs';
import type { ParseResult, Section } from '../types.ts';

interface FlatPair {
  path: string;
  value: string;
}

/** Recursively flattens a JSON value into dot-separated key/value pairs. */
function flattenObject(obj: unknown, prefix = ''): FlatPair[] {
  const results: FlatPair[] = [];

  if (obj === null || obj === undefined) return results;

  if (typeof obj !== 'object') {
    results.push({ path: prefix, value: String(obj) });
    return results;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      results.push(...flattenObject(item, prefix ? `${prefix}[${i}]` : `[${i}]`));
    });
    return results;
  }

  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    results.push(...flattenObject(val, newPrefix));
  }

  return results;
}

interface JsonSchemaDef {
  title?: string;
  description?: string;
  type?: string;
  enum?: unknown[];
  pattern?: string;
  properties?: Record<string, JsonSchemaDef>;
  $ref?: string;
}

interface JsonSchema {
  $schema?: string;
  title?: string;
  definitions?: Record<string, JsonSchemaDef>;
  $defs?: Record<string, JsonSchemaDef>;
  properties?: Record<string, JsonSchemaDef>;
}

/** Extracts sections from a JSON Schema. Each definition becomes its own section. */
function parseJsonSchema(schema: JsonSchema, source: string): Section[] {
  const defs: Record<string, JsonSchemaDef> = schema.definitions ?? schema.$defs ?? {};
  const sections: Section[] = [];

  for (const [name, def] of Object.entries(defs)) {
    const lines: string[] = [`Definition: ${name}`];
    if (def.title) lines.push(`Title: ${def.title}`);
    if (def.description) lines.push(`Description: ${def.description}`);
    if (def.type) lines.push(`Type: ${def.type}`);
    if (def.enum) lines.push(`Enum values: ${def.enum.join(', ')}`);
    if (def.pattern) lines.push(`Pattern: ${def.pattern}`);

    if (def.properties) {
      for (const [propName, propDef] of Object.entries(def.properties)) {
        const propParts = [`  Property: ${propName}`];
        if (propDef.type) propParts.push(`type: ${propDef.type}`);
        if (propDef.description) propParts.push(`description: ${propDef.description}`);
        if (propDef.enum) propParts.push(`enum: [${propDef.enum.join(', ')}]`);
        if (propDef.$ref) propParts.push(`$ref: ${propDef.$ref}`);
        lines.push(propParts.join(' | '));
      }
    }

    sections.push({
      heading: name,
      content: lines.join('\n'),
      metadata: { source, type: 'json-schema' },
    });
  }

  // Fallback: top-level schema properties when no definitions
  if (sections.length === 0 && schema.properties) {
    const lines: string[] = [];
    for (const [propName, propDef] of Object.entries(schema.properties)) {
      const parts = [`Property: ${propName}`];
      if (propDef.type) parts.push(`type: ${propDef.type}`);
      if (propDef.description) parts.push(`description: ${propDef.description}`);
      lines.push(parts.join(' | '));
    }
    if (lines.length > 0) {
      const fileName = source.split('/').pop()!.replace(/\.[^.]+$/, '');
      sections.push({
        heading: schema.title ?? fileName,
        content: lines.join('\n'),
        metadata: { source, type: 'json-schema' },
      });
    }
  }

  return sections;
}

type JsonLdItem = Record<string, unknown>;

/** Extracts sections from a JSON-LD document. Each @id entry becomes a section. */
function parseJsonLd(data: unknown, source: string): Section[] {
  const items: JsonLdItem[] = Array.isArray(data)
    ? (data as JsonLdItem[])
    : [data as JsonLdItem];
  const sections: Section[] = [];

  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;

    const heading =
      (item['@id'] as string | undefined) ??
      (item['rdfs:label'] as string | undefined) ??
      (item['schema:name'] as string | undefined) ??
      'Entry';

    const pairs = flattenObject(item);
    const content = pairs
      .filter(({ path }) => !path.startsWith('@context'))
      .map(({ path, value }) => `${path}: ${value}`)
      .join('\n');

    if (content.trim().length > 0) {
      sections.push({ heading, content, metadata: { source, type: 'jsonld' } });
    }
  }

  return sections;
}

/**
 * Parses a JSON, JSON-LD, or JSON Schema file into sections.
 *
 * Detection logic:
 *   1. `$schema` key or `definitions`/`$defs` at top level → JSON Schema
 *   2. `@context` or `@graph` key, or array of objects with `@id` → JSON-LD
 *   3. Otherwise → flatten each top-level key into a section
 */
export async function parse(filePath: string, source: string): Promise<ParseResult> {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${(err as Error).message}`);
  }

  const isObject = typeof data === 'object' && data !== null && !Array.isArray(data);
  const obj = data as Record<string, unknown>;

  const isJsonSchema =
    isObject &&
    (obj['$schema'] !== undefined ||
      obj['definitions'] !== undefined ||
      obj['$defs'] !== undefined);

  const isJsonLd =
    (isObject &&
      (obj['@context'] !== undefined || obj['@graph'] !== undefined)) ||
    (Array.isArray(data) &&
      (data as unknown[]).some(
        (i) => typeof i === 'object' && i !== null && '@id' in (i as object),
      ));

  let sections: Section[];

  if (isJsonSchema) {
    sections = parseJsonSchema(obj as JsonSchema, source);
  } else if (isJsonLd) {
    const items = isObject && obj['@graph'] ? obj['@graph'] : data;
    sections = parseJsonLd(items, source);
  } else {
    // Generic JSON: each top-level key becomes its own section
    sections = [];
    const topLevel: Record<string, unknown> = Array.isArray(data)
      ? { items: data }
      : (data as Record<string, unknown>);

    for (const [key, val] of Object.entries(topLevel)) {
      const pairs = flattenObject(val, key);
      const content = pairs.map(({ path, value }) => `${path}: ${value}`).join('\n');
      if (content.trim().length > 0) {
        sections.push({
          heading: key,
          content,
          metadata: { source, type: 'json' },
        });
      }
    }
  }

  return { sections };
}
