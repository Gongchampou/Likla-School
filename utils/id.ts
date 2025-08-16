// Shared display ID generator utilities
// Produces a 10-character uppercase alphanumeric string (no ambiguous chars)

import { AnyUser, Role } from '../types';

const PAD = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // avoid I, O, 0, 1

function toBase36Upper(n: number) {
  return Math.abs(n >>> 0).toString(36).toUpperCase();
}

function djb2_xor(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash | 0;
}

function mul31(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h | 0;
}

export function generateDisplayId(seed?: string): string {
  let acc = '';
  if (seed && seed.length) {
    const h1 = djb2_xor(seed);
    const h2 = mul31(seed);
    acc = toBase36Upper(h1) + toBase36Upper(h2);
  } else {
    const randSeed = `${Date.now()}|${Math.random()}|${Math.random()}`;
    const h1 = djb2_xor(randSeed);
    const h2 = mul31(randSeed);
    acc = toBase36Upper(h1) + toBase36Upper(h2);
  }
  const alnum = acc.replace(/[^A-Z0-9]/g, '');
  return (alnum + PAD).slice(0, 10);
}

export function stableDisplayIdForUser(user: AnyUser): string {
  const base = `${user.role}|${user.id}|${user.email}`;
  return generateDisplayId(base);
}

// Map Role to 2-letter code
const ROLE_CODE: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'SA',
  [Role.ADMIN]: 'AD',
  [Role.TEACHER]: 'TE',
  [Role.STUDENT]: 'ST',
  [Role.STAFF]: 'SF',
  [Role.LIBRARIAN]: 'LI',
  [Role.PARENT]: 'PA',
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || 'X';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : 'X';
  return (first + last).toUpperCase();
}

function firstTwoFromSchool(schoolName: string): string {
  const cleaned = (schoolName || '').replace(/[^A-Za-z]/g, '');
  const two = (cleaned.slice(0, 2) || 'XX').toUpperCase();
  return two.padEnd(2, 'X');
}

export function formatDisplayId(params: {
  user: AnyUser;
  schoolName: string;
  dobYear?: string | number; // YYYY or number, optional fallback
}): string {
  const { user, schoolName, dobYear } = params;
  const role = ROLE_CODE[user.role] || 'XX';
  const init = initialsFromName(user.name);
  const sch = firstTwoFromSchool(schoolName);
  let year = String(dobYear ?? '').replace(/[^0-9]/g, '');
  if (year.length !== 4) year = '0000';
  return `${role}${init}${sch}${year}`;
}
