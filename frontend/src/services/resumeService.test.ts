import { describe, expect, it, vi } from 'vitest';

const upload = vi.fn();
const remove = vi.fn();
const storageFrom = vi.fn((_bucket: string) => ({ upload, remove }));
vi.mock('./supabaseClient', () => ({
  supabase: { storage: { from: (bucket: string) => storageFrom(bucket) } },
}));

const extractResumeText = vi.fn();
vi.mock('../lib/resumeExtraction', () => ({
  extractResumeText: (...args: unknown[]) => extractResumeText(...args),
}));

const upsertUserPreferences = vi.fn();
vi.mock('./userPreferencesService', () => ({
  upsertUserPreferences: (...args: unknown[]) => upsertUserPreferences(...args),
}));

const { uploadResume, deleteResume } = await import('./resumeService');

const file = { name: 'resume.pdf' } as File;

describe('uploadResume', () => {
  it('writes the Storage object and the user_preferences row together, consistently', async () => {
    extractResumeText.mockResolvedValue('extracted resume text');
    upload.mockResolvedValue({ error: null });
    upsertUserPreferences.mockResolvedValue({ user_id: 'u1' });

    await uploadResume('user-123', file);

    expect(storageFrom).toHaveBeenCalledWith('resumes');
    expect(upload).toHaveBeenCalledWith('user-123/resume.pdf', file, { upsert: true });
    expect(upsertUserPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        resume_storage_path: 'user-123/resume.pdf',
        resume_filename: 'resume.pdf',
        resume_text: 'extracted resume text',
      })
    );
  });

  it('does not write user_preferences at all if the Storage upload fails', async () => {
    extractResumeText.mockResolvedValue('text');
    upload.mockResolvedValue({ error: { message: 'storage down' } });

    await expect(uploadResume('user-123', file)).rejects.toThrow();

    expect(upsertUserPreferences).not.toHaveBeenCalled();
  });
});

describe('deleteResume', () => {
  it('clears every resume column, even if removing the Storage object fails', async () => {
    remove.mockRejectedValue(new Error('storage down'));
    upsertUserPreferences.mockResolvedValue({ user_id: 'u1' });

    await deleteResume('user-123/resume.pdf');

    expect(upsertUserPreferences).toHaveBeenCalledWith({
      resume_storage_path: null,
      resume_filename: null,
      resume_text: null,
      resume_uploaded_at: null,
    });
  });
});
