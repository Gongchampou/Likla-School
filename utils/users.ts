import { AnyUser, Role, Class, Assignment } from '../types';
import { getSupabaseClient } from './supabase';

export const USERS_STORAGE_KEY = 'users';
export const USERS_BIN_STORAGE_KEY = 'users_bin';

export type DeletedUserSnapshot = {
  user: AnyUser;
  affectedClasses: Class[];
  affectedAssignments: Assignment[];
  deletedAt: string; // ISO string
};

export const DEFAULT_USERS: AnyUser[] = [
  { id: 'user-super-admin', name: 'Super Admin', email: 'super@likla.edu', role: Role.SUPER_ADMIN, profilePicture: 'https://i.pravatar.cc/150?u=super@likla.edu' },
  { id: 'user-admin', name: 'Admin User', email: 'admin@likla.edu', role: Role.ADMIN, profilePicture: 'https://i.pravatar.cc/150?u=admin@likla.edu' },
  { id: 'teacher-1', name: 'John Doe', email: 'john.d@likla.edu', role: Role.TEACHER, whatsapp: '1234567890', salary: 50000, attendance: {}, profilePicture: 'https://i.pravatar.cc/150?u=john.d@likla.edu' },
  { id: 'teacher-2', name: 'Jane Smith', email: 'jane.s@likla.edu', role: Role.TEACHER, whatsapp: '0987654321', salary: 52000, attendance: {}, profilePicture: 'https://i.pravatar.cc/150?u=jane.s@likla.edu' },
  { id: 'student-1', name: 'Alice Johnson', email: 'alice.j@likla.edu', role: Role.STUDENT, classId: 'class-10a', attendance: {}, fees: [], discount: 0, profilePicture: 'https://i.pravatar.cc/150?u=alice.j@likla.edu' },
  { id: 'student-2', name: 'Bob Williams', email: 'bob.w@likla.edu', role: Role.STUDENT, classId: 'class-10b', attendance: {}, fees: [], discount: 10, profilePicture: 'https://i.pravatar.cc/150?u=bob.w@likla.edu' },
  { id: 'student-3', name: 'Charlie Brown', email: 'charlie.b@likla.edu', role: Role.STUDENT, classId: 'class-9a', attendance: {}, fees: [], discount: 0, profilePicture: 'https://i.pravatar.cc/150?u=charlie.b@likla.edu' },
  { id: 'staff-1', name: 'Eve Davis', email: 'eve.d@likla.edu', role: Role.STAFF, profilePicture: 'https://i.pravatar.cc/150?u=eve.d@likla.edu' },
  { id: 'librarian-1', name: 'Frank White', email: 'frank.w@likla.edu', role: Role.LIBRARIAN, profilePicture: 'https://i.pravatar.cc/150?u=frank.w@likla.edu' },
  { id: 'parent-1', name: 'Grace Green', email: 'grace.g@likla.edu', role: Role.PARENT, profilePicture: 'https://i.pravatar.cc/150?u=grace.g@likla.edu' },
];

export async function loadUsers(): Promise<AnyUser[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    // Fallback to defaults if Supabase not configured
    return DEFAULT_USERS;
  }
  const { data, error } = await supabase.from('users').select('*').order('id');
  if (error) {
    console.error('loadUsers error:', error);
    // Return demo users so the app remains usable
    return DEFAULT_USERS;
  }
  if (!data || data.length === 0) {
    // Seed defaults to Supabase when possible, but always return defaults immediately
    const seed = DEFAULT_USERS.map(u => ({ ...u }));
    try {
      const { error: upErr } = await supabase.from('users').upsert(seed, { onConflict: 'id' });
      if (upErr) console.error('seed users error:', upErr);
    } catch (e) {
      console.warn('Seeding users failed (continuing with defaults):', e);
    }
    return seed as AnyUser[];
  }
  return data as unknown as AnyUser[];
}

export async function saveUsers(users: AnyUser[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return; // no-op if not configured
  // Upsert all provided users
  const { error: upErr } = await supabase.from('users').upsert(users as any[], { onConflict: 'id' });
  if (upErr) throw upErr;
  // Delete any users not present in the provided list (to mirror prior full-replace behavior)
  const { data: existing, error: selErr } = await supabase.from('users').select('id');
  if (selErr) throw selErr;
  const keep = new Set(users.map(u => u.id));
  const toDelete = (existing || []).map(r => (r as any).id).filter((id: string) => !keep.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from('users').delete().in('id', toDelete);
    if (delErr) throw delErr;
  }
}

export async function loadDeletedUsers(): Promise<DeletedUserSnapshot[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from('users_bin').select('*').order('deleted_at', { ascending: false });
  if (error) {
    console.error('loadDeletedUsers error:', error);
    return [];
  }
  return (data || []).map(row => ({
    user: (row as any).user as AnyUser,
    affectedClasses: (row as any).affected_classes as Class[] || [],
    affectedAssignments: (row as any).affected_assignments as Assignment[] || [],
    deletedAt: (row as any).deleted_at as string,
  }));
}

export async function saveDeletedUsers(users: DeletedUserSnapshot[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  // Replace table contents to mirror previous full-replace localStorage behavior
  const { error: delAllErr } = await supabase.from('users_bin').delete().neq('id', ''); // delete all rows
  if (delAllErr && delAllErr.code !== 'PGRST116') {
    // PGRST116 can occur for empty table; ignore
    console.warn('users_bin delete-all warning:', delAllErr.message);
  }
  const rows = users.map(s => ({
    user: s.user as any,
    affected_classes: s.affectedClasses as any,
    affected_assignments: s.affectedAssignments as any,
    deleted_at: s.deletedAt,
  }));
  if (rows.length > 0) {
    const { error: upErr } = await supabase.from('users_bin').upsert(rows);
    if (upErr) throw upErr;
  }
}
