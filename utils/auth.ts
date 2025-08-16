import { AnyUser } from '../types';
import { loadUsers, saveUsers } from './users';

// Simple SHA-256 hashing using Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Default bootstrap passwords for initial demo use (can be changed by Admins later)
const DEFAULT_BOOTSTRAP: Record<string, string> = {
  'super@likla.edu': 'super@123',
  'admin@likla.edu': 'admin@123',
};

export async function authenticate(email: string, password: string): Promise<AnyUser | null> {
  const users = await loadUsers();
  const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) return null;
  const user = users[idx] as any;

  // If passwordHash set, verify
  if (user.passwordHash) {
    const hpw = await hashPassword(password);
    if (hpw === user.passwordHash) {
      return stripSensitive(user);
    }
    return null;
  }

  // Bootstrap path: allow default known passwords for seeded users, then persist hash
  const defaultPw = DEFAULT_BOOTSTRAP[email.toLowerCase()];
  if (defaultPw && password === defaultPw) {
    user.passwordHash = await hashPassword(password);
    users[idx] = user;
    await saveUsers(users);
    return stripSensitive(user);
  }

  return null;
}

export function stripSensitive<T extends AnyUser>(user: T): T {
  const clone: any = { ...user };
  // Do not expose hashes in runtime state
  delete clone.passwordHash;
  delete clone.password; // just in case
  return clone;
}

export async function setUserPassword(userId: string, newPassword: string): Promise<void> {
  const users = await loadUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return;
  const u: any = { ...users[idx] };
  u.passwordHash = await hashPassword(newPassword);
  users[idx] = u;
  await saveUsers(users);
}
