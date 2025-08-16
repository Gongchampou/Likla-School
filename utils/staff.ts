import { getSupabaseClient } from './supabase';
import { Role, Staff as StaffType } from '../types';

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string; // store Role enum as string
  profile_picture: string | null;
  dob: string | null;
  dob_year: string | null;
  display_id: string | null;
  status: 'Paid' | 'Unpaid' | null;
};

function mapRowToStaff(r: StaffRow): StaffType {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: (r.role as Role) || Role.STAFF,
    profilePicture: r.profile_picture || '',
    dob: r.dob || undefined,
    dobYear: r.dob_year || undefined,
    displayId: r.display_id || undefined,
  } as StaffType;
}

function mapStaffToRow(s: StaffType, status: 'Paid' | 'Unpaid' | undefined): StaffRow {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    profile_picture: s.profilePicture || null,
    dob: s.dob || null,
    dob_year: s.dobYear || null,
    display_id: s.displayId || null,
    status: status || null,
  };
}

export async function listStaff(): Promise<{ staff: StaffType[]; statusMap: Record<string, 'Paid' | 'Unpaid'> }> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('staff').select('*').order('name', { ascending: true });
  if (error) throw error;
  const staff = (data || []).map(mapRowToStaff);
  const statusMap: Record<string, 'Paid' | 'Unpaid'> = {};
  (data || []).forEach((r: any) => { if (r.status) statusMap[r.id] = r.status; });
  return { staff, statusMap };
}

export async function upsertStaff(s: StaffType, status: 'Paid' | 'Unpaid'): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  const row = mapStaffToRow(s, status);
  const { error } = await supabase.from('staff').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteStaff(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('staff').delete().eq('id', id);
  if (error) throw error;
}
