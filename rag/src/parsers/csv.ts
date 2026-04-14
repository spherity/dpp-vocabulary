import { createReadStream } from 'fs';
import { parse as csvParseStream } from 'csv-parse';
import type { ParseResult } from '../types.ts';

/**
 * Parses a CSV file into a single section whose content is a line-by-line
 * representation of each data row formatted as "col1: val1 | col2: val2".
 *
 * The first row is treated as column headers.
 */
export async function parse(filePath: string, source: string): Promise<ParseResult> {
  const records = await new Promise<string[][]>((resolve, reject) => {
    const rows: string[][] = [];
    createReadStream(filePath)
      .pipe(
        csvParseStream({
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        }),
      )
      .on('data', (row: string[]) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

  if (records.length < 2) return { sections: [] };

  const headers = records[0];
  const dataRows = records.slice(1);

  const lines = dataRows
    .map((row) => {
      const parts = row
        .map((val, i) => {
          const key = headers[i] ?? `Column${i + 1}`;
          return val.trim() !== '' ? `${key}: ${val.trim()}` : null;
        })
        .filter((p): p is string => p !== null);
      return parts.join(' | ');
    })
    .filter((line) => line.length > 0);

  if (lines.length === 0) return { sections: [] };

  const fileName = source.split('/').pop()!.replace(/\.[^.]+$/, '');

  return {
    sections: [
      {
        heading: fileName,
        content: lines.join('\n'),
        metadata: { source, type: 'csv' },
      },
    ],
  };
}
