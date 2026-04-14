import { readFileSync } from 'fs';
import pdfParse from 'pdf-parse';
import type { ParseResult, Section } from '../types.ts';

// Section heading candidates: lines that look like regulatory titles
const TITLE_LINE_RE =
  /^(?:Article\s+\d+[^\n]*|Annex\s+[IVXLC\d]+[^\n]*|CHAPTER\s+[IVXLC\d]+[^\n]*|\d{1,3}\.\d{0,3}\s+[A-Z][^\n]{3,80})$/m;

/**
 * Splits the full document text into sections based on heading patterns.
 * Falls back to a single section when no headings are found.
 */
function splitIntoSections(text: string, source: string): Section[] {
  const lines = text.split('\n');
  const sections: Section[] = [];
  let currentHeading = 'Preamble';
  let currentLines: string[] = [];

  const flush = (): void => {
    const content = currentLines.join('\n').trim();
    if (content.length > 0) {
      sections.push({
        heading: currentHeading,
        content,
        metadata: { source, type: 'pdf' },
      });
    }
    currentLines = [];
  };

  for (const line of lines) {
    if (TITLE_LINE_RE.test(line.trim()) && line.trim().length > 0) {
      flush();
      currentHeading = line.trim();
    } else {
      currentLines.push(line);
    }
  }

  flush();

  // Fall back: no headings detected → whole text as one section
  if (sections.length === 0 && text.trim().length > 0) {
    sections.push({
      heading: 'Document',
      content: text.trim(),
      metadata: { source, type: 'pdf' },
    });
  }

  return sections;
}

/**
 * Parses a PDF file and returns semantic sections.
 * Page numbers are estimated from form-feed page separators (`\f`) for
 * traceability in chunk metadata.
 */
export async function parse(filePath: string, source: string): Promise<ParseResult> {
  const buffer = readFileSync(filePath);
  const data = await pdfParse(buffer);

  const sections = splitIntoSections(data.text, source);

  // Build a page-break offset table from \f separators inserted by pdf-parse
  const pages = data.text.split('\f');
  let charOffset = 0;
  const pageBreaks: number[] = pages.map((pageText) => {
    const start = charOffset;
    charOffset += pageText.length + 1;
    return start;
  });

  for (const section of sections) {
    const sectionStart = data.text.indexOf(section.content.slice(0, 80));
    if (sectionStart !== -1) {
      let pageIndex = -1;
      for (let p = pageBreaks.length - 1; p >= 0; p--) {
        if ((pageBreaks[p] as number) <= sectionStart) { pageIndex = p; break; }
      }
      section.metadata.page = pageIndex >= 0 ? pageIndex + 1 : 1;
    }
  }

  return { sections };
}
