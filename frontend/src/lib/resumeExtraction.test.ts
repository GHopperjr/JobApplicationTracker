import { describe, expect, it } from 'vitest';
import { isSupportedResumeFile } from './resumeExtraction';

// The actual PDF/DOCX parsing paths (extractResumeText) aren't unit-tested
// here — pdf.js and mammoth are real external parsers, and this codebase's
// established pattern for that kind of dependency (docs/11's Photon/OSRM)
// is to verify against a real file once, not simulate one in jsdom.
describe('isSupportedResumeFile', () => {
  it('accepts a PDF', () => {
    expect(isSupportedResumeFile({ type: 'application/pdf' } as File)).toBe(true);
  });

  it('accepts a DOCX', () => {
    expect(
      isSupportedResumeFile({
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      } as File)
    ).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isSupportedResumeFile({ type: 'text/plain' } as File)).toBe(false);
    expect(isSupportedResumeFile({ type: 'application/msword' } as File)).toBe(false);
  });
});
