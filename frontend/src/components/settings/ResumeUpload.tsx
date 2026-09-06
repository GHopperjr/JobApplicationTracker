import { useRef } from 'react';
import { useResume } from '../../hooks/useResume';
import { useToast } from '../../hooks/useToast';
import { isSupportedResumeFile } from '../../lib/resumeExtraction';
import { formatDateTime } from '../../lib/format';
import { Button } from '../ui/Button';

/**
 * Upload / replace the one stored resume (docs/14-ai-match-scoring.md).
 * The privacy notice is stated plainly here, at the point of upload, not
 * buried in a separate policy page — verified live against Gemini's
 * current free-tier terms before writing this copy (docs/09-operations.md,
 * docs/14).
 */
export function ResumeUpload() {
  const { filename, uploadedAt, hasResume, isLoading, upload, isUploading, remove, isRemoving } =
    useResume();
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // lets picking the same file again re-trigger onChange
    if (!file) return;

    if (!isSupportedResumeFile(file)) {
      show('Only PDF and DOCX resumes are supported.', 'error');
      return;
    }

    try {
      await upload(file);
      show('Resume uploaded.');
    } catch {
      show("Couldn't upload your resume. Please try again.", 'error');
    }
  };

  const handleRemove = async () => {
    try {
      await remove();
      show('Resume removed.');
    } catch {
      show("Couldn't remove your resume. Please try again.", 'error');
    }
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900">Resume</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Used to calculate a match score against a job description on an application. Your resume's
        text is sent to Google's Gemini API to calculate match scores. Google's free tier may use
        this content to improve their AI models and may have it reviewed by a human.
      </p>

      {!isLoading && hasResume && (
        <p className="mt-3 text-sm text-slate-700">
          <span className="font-medium">{filename}</span>
          {uploadedAt && <span className="text-slate-500"> — uploaded {formatDateTime(uploadedAt)}</span>}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />
        <Button
          variant="secondary"
          disabled={isLoading || isUploading}
          isLoading={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {hasResume ? 'Replace resume' : 'Upload resume'}
        </Button>
        {hasResume && (
          <Button variant="ghost" disabled={isRemoving} isLoading={isRemoving} onClick={handleRemove}>
            Remove
          </Button>
        )}
      </div>
    </section>
  );
}
