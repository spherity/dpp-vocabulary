import ExcelJS from 'exceljs';
import type { ParseResult, Section } from '../types.ts';

/**
 * Safely extracts a string value from an ExcelJS cell.
 * Handles plain values, formula results, rich text, hyperlinks, and dates.
 * Returns an empty string for null/undefined/unparseable values.
 */
function safeCellText(cell: ExcelJS.Cell): string {
  // cell.text is the safest getter — ExcelJS resolves formulas/rich text
  if (cell.text != null && String(cell.text).trim() !== '') {
    return String(cell.text).trim();
  }

  const v = cell.value;
  if (v === null || v === undefined) return '';

  // Rich text object: { richText: Array<{ text: string }> }
  if (typeof v === 'object' && 'richText' in v && Array.isArray((v as { richText: unknown[] }).richText)) {
    return (v as { richText: Array<{ text?: string }> }).richText
      .map((r) => r.text ?? '')
      .join('')
      .trim();
  }

  // Hyperlink object: { text: string, hyperlink: string }
  if (typeof v === 'object' && 'text' in v && typeof (v as { text: unknown }).text === 'string') {
    return ((v as { text: string }).text).trim();
  }

  // Formula result object: { formula: string, result: unknown }
  if (typeof v === 'object' && 'result' in v) {
    const result = (v as { result: unknown }).result;
    if (result === null || result === undefined) return '';
    return String(result).trim();
  }

  // Date
  if (v instanceof Date) {
    return v.toISOString().trim();
  }

  try {
    return String(v).trim();
  } catch {
    return '';
  }
}

/**
 * Converts a single worksheet row to a readable text string.
 * Skips empty cells; joins non-null values with " | ".
 */
function rowToText(row: ExcelJS.Row): string {
  const values: string[] = [];
  row.eachCell({ includeEmpty: false }, (cell) => {
    const v = safeCellText(cell);
    if (v !== '') values.push(v);
  });
  return values.join(' | ');
}

/**
 * Parses an Excel workbook (.xlsx / .xls) into sections.
 *
 * Strategy (aligned with SKILL.md Excel parsing rules):
 * - Each worksheet becomes a top-level section (heading = sheet name)
 * - The first non-empty row is treated as column headers
 * - Subsequent rows are each converted to a text line:
 *     "<col1>: <val1> | <col2>: <val2> | ..."
 * - Merged cells spanning row 1 are treated as category group headings,
 *   turning Excel categories/sub-categories into separate sections
 *   (per sources/dbp/instructions.md: "categories and sub-categories
 *    must be used as classes")
 */
export async function parse(filePath: string, source: string): Promise<ParseResult> {
  console.log(`  [excel] Loading workbook: ${source}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheetCount = workbook.worksheets.length;
  console.log(`  [excel] Found ${sheetCount} sheet(s): ${workbook.worksheets.map((ws) => ws.name).join(', ')}`);

  const sections: Section[] = [];

  workbook.eachSheet((worksheet) => {
    const sheetName = worksheet.name;
    console.log(`  [excel] Processing sheet: "${sheetName}"`);
    const rows: ExcelJS.Row[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      rows.push(row);
    });

    if (rows.length === 0) return;

    // Detect merged cells spanning row 1 — these represent category groups
    const categoryMap: Record<number, string> = {};
    (worksheet.model?.merges ?? []).forEach((mergeRange) => {
      const match = mergeRange.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (match && match[2] === '1' && match[4] === '1') {
        const startCol = worksheet.getColumn(match[1]).number;
        const endCol = worksheet.getColumn(match[3]).number;
        const label = worksheet.getCell(`${match[1]}1`).text?.trim();
        if (label) {
          for (let c = startCol; c <= endCol; c++) {
            categoryMap[c] = label;
          }
        }
      }
    });

    const hasCategoryRow = Object.keys(categoryMap).length > 0;
    const headerRowIndex = hasCategoryRow ? 1 : 0;
    const headerRow = rows[headerRowIndex];
    const headers: string[] = [];

    if (headerRow) {
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber] = cell.text?.trim() || `Column${colNumber}`;
      });
    }

    const categoryGroups: Record<string, string[]> = {};
    const dataStartIndex = headerRowIndex + 1;

    for (let i = dataStartIndex; i < rows.length; i++) {
      const row = rows[i];
      const lineParts: string[] = [];

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const header = headers[colNumber] ?? `Column${colNumber}`;
        let value: string;
        try {
          value = safeCellText(cell);
        } catch (err) {
          console.warn(`  [excel] Warning: could not read cell at sheet="${sheetName}" row=${i + 1} col=${colNumber}: ${(err as Error).message}`);
          value = '';
        }
        if (value !== '') {
          lineParts.push(`${header}: ${value}`);
        }
      });

      if (lineParts.length === 0) continue;
      const lineText = lineParts.join(' | ');

      let category = sheetName;
      if (hasCategoryRow) {
        row.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
          if (categoryMap[colNumber]) {
            category = `${sheetName} — ${categoryMap[colNumber]}`;
          }
        });
      }

      if (!categoryGroups[category]) categoryGroups[category] = [];
      categoryGroups[category].push(lineText);
    }

    console.log(`  [excel] Sheet "${sheetName}": ${Object.keys(categoryGroups).length} group(s), ${rows.length - dataStartIndex} data row(s)`);

    // Fallback: no grouping possible — put everything under the sheet name
    if (Object.keys(categoryGroups).length === 0 && rows.length > dataStartIndex) {
      const allLines: string[] = [];
      for (let i = dataStartIndex; i < rows.length; i++) {
        const text = rowToText(rows[i]);
        if (text) allLines.push(text);
      }
      if (allLines.length > 0) {
        sections.push({
          heading: sheetName,
          content: allLines.join('\n'),
          metadata: { source, type: 'excel', sheet: sheetName },
        });
      }
      return;
    }

    for (const [category, lines] of Object.entries(categoryGroups)) {
      sections.push({
        heading: category,
        content: lines.join('\n'),
        metadata: { source, type: 'excel', sheet: sheetName },
      });
    }
  });

  return { sections };
}
