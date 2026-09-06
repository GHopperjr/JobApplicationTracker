// Both parsers are dynamically imported, only when the Settings page's
// uploader is actually used — pdf.js alone is a meaningfully sized library
// that exactly one page needs, and vite build already warns about the main
// bundle's size (docs/14-ai-match-scoring.md). Extraction happens once, at
// upload; the result is what's stored, and nothing re-parses the file later.

const SUPPORTED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);

export function isSupportedResumeFile(file: File): boolean {
  return SUPPORTED_TYPES.has(file.type);
}

async function extractFromPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Must be set in this same module, not a separate one — pdf.js checks
  // this at parse time, and setting it elsewhere risks a module-execution-
  // order race where the default (unset) value wins (verified against
  // pdf.js's own integration reports at implementation time). The `?url`
  // form lets Vite resolve and bundle the worker script as a real asset
  // rather than needing it inlined or fetched from a CDN.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pageTexts.push(pageText);
  }
  return pageTexts.join('\n').trim();
}

async function extractFromDocx(file: File): Promise<string> {
  const { extractRawText } = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await extractRawText({ arrayBuffer });
  return result.value.trim();
}

/**
 * Extracts plain text from an uploaded resume — PDF or DOCX, the only two
 * types `isSupportedResumeFile` accepts. Throws if the file type isn't one
 * of those two; the caller (resumeService) is expected to have already
 * checked with `isSupportedResumeFile` before ever calling this.
 */
export async function extractResumeText(file: File): Promise<string> {
  if (file.type === 'application/pdf') return extractFromPdf(file);
  return extractFromDocx(file);
}
