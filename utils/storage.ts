import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getSupabaseClient, getSupabaseBucket } from './supabase';

/**
 * Upload a user's avatar to Firebase Storage.
 * Path: avatars/<userId>/<timestamp>-<filename>
 */
export async function uploadUserAvatar(file: File, userId: string): Promise<{ url: string; path: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const path = `avatars/${userId}/${Date.now()}-${safeName}`;
  const provider = getStorageProvider();
  if (provider === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase not configured');
    const bucket = getSupabaseBucket();
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }
  // Firebase fallback
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type || 'application/octet-stream' });
  const url = await getDownloadURL(storageRef);
  return { url, path };
}

/**
 * Delete a file in Firebase Storage by its storage path (not URL).
 */
export async function deleteByPath(path: string): Promise<void> {
  if (!path) return;
  const provider = getStorageProvider();
  if (provider === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const bucket = getSupabaseBucket();
    await supabase.storage.from(bucket).remove([path]);
    return;
  }
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}

/**
 * Generic upload helper for any category (e.g., 'assignments', 'books').
 * Path: <category>/<ownerId>/<timestamp>-<filename>
 */
export async function uploadFile(category: string, ownerId: string, file: File): Promise<{ url: string; path: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const path = `${category}/${ownerId || 'unknown'}/${Date.now()}-${safeName}`;
  const provider = getStorageProvider();
  if (provider === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase not configured');
    const bucket = getSupabaseBucket();
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type || 'application/octet-stream' });
  const url = await getDownloadURL(storageRef);
  return { url, path };
}

/**
 * Convenience: upload assignment attachment.
 */
export function uploadAssignmentAttachment(file: File, ownerId: string) {
  return uploadFile('assignments', ownerId, file);
}

/** Book uploads */
export function uploadBookCover(file: File, ownerId: string) {
  return uploadFile('books/covers', ownerId, file);
}

export function uploadBookFile(file: File, ownerId: string) {
  return uploadFile('books/files', ownerId, file);
}

// Helpers
function getStorageProvider(): 'firebase' | 'supabase' {
  try {
    const raw = localStorage.getItem('schoolSettings');
    if (!raw) return 'firebase';
    const s = JSON.parse(raw);
    return s?.storageProvider === 'supabase' ? 'supabase' : 'firebase';
  } catch {
    return 'firebase';
  }
}
