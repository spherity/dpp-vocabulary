import { extname } from 'path';
import { parse as parsePdf } from './pdf.ts';
import { parse as parseExcel } from './excel.ts';
import { parse as parseCsv } from './csv.ts';
import { parse as parseJson } from './json.ts';
import type { ParseResult } from '../types.ts';

type Parser = (filePath: string, source: string) => Promise<ParseResult>;

const PARSERS: Record<string, Parser> = {
  '.pdf': parsePdf,
  '.xlsx': parseExcel,
  '.xls': parseExcel,
  '.csv': parseCsv,
  '.json': parseJson,
  '.jsonld': parseJson,
};

export const SUPPORTED_EXTENSIONS = new Set(Object.keys(PARSERS));

/**
 * Routes a file to the appropriate parser based on its extension.
 *
 * @param filePath Absolute path to the file
 * @param source   Relative path used as the source key in metadata
 */
export async function parse(filePath: string, source: string): Promise<ParseResult> {
  const ext = extname(filePath).toLowerCase();
  const parser = PARSERS[ext];

  if (!parser) {
    throw new Error(
      `No parser available for extension "${ext}" (file: ${source}).\n` +
        `Supported types: ${[...SUPPORTED_EXTENSIONS].join(', ')}`,
    );
  }

  return parser(filePath, source);
}
