import { extractResumeText } from '../lib/resumeExtraction';
import { toAppError } from './errors';
import { supabase } from './supabaseClient';
import { upsertUserPreferences, type UserPreferences } from './userPreferencesService';

/**
 * Extracts the resume's text, uploads the file to the `resumes` Storage
 * bucket under the user's own folder, and records both on the
 * `user_preferences` row together — `resume_text` and `resume_storage_path`
 * are always set in the same statement, so a resume record with a file but
 * no extracted text (or vice versa) is a state this app never produces
 * (docs/14-ai-match-scoring.md). `userId` comes from the caller
 * (already available via useAuth) rather than a second
 * `supabase.auth.getUser()` round trip here.
 */
export async function uploadResume(userId: string, file: File): Promise<UserPreferences> {
  const text = await extractResumeText(file);
  const path = `${userId}/${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('resumes')
    .upload(path, file, { upsert: true });
  if (uploadError) throw toAppError(uploadError);

  return upsertUserPreferences({
    resume_storage_path: path,
    resume_filename: file.name,
    resume_text: text,
    resume_uploaded_at: new Date().toISOString(),
  });
}

/**
 * Clears the resume record even if removing the underlying Storage object
 * fails — an orphaned file left behind is a minor, recoverable issue, not a
 * reason to block the user from clearing what they see in the app.
 */
export async function deleteResume(storagePath: string): Promise<UserPreferences> {
  try {
    await supabase.storage.from('resumes').remove([storagePath]);
  } catch {
    // Best-effort: the row still gets cleared below either way.
  }

  return upsertUserPreferences({
    resume_storage_path: null,
    resume_filename: null,
    resume_text: null,
    resume_uploaded_at: null,
  });
}
