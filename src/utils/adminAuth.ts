export type AdminRole = 'administrator' | 'sub_admin';

export interface AdminUser {
  email: string;
  passwordHash: string;
  role: AdminRole;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSession {
  username: string;
  role: AdminRole;
  loginAt: string;
  isSuperAdmin?: boolean;
}

const USERS_KEY = 'fieldlab_settings_admin_users';
const SESSION_KEY = 'fieldlab_settings_admin_session';
const SETTINGS_LEFT_AT_KEY = 'fieldlab_settings_left_at';

export const MAX_SUB_ADMINS = 3;
export const SETTINGS_SESSION_GRACE_MS = 5000;

const SUPER_ADMIN_USERNAME = 'admin';
const SUPER_ADMIN_PASSWORD = 'admin';

export function isValidTuniEmail(email: string) {
  return /^[a-zA-Z]+\.[a-zA-Z]+@tuni\.fi$/.test(email.trim());
}

export function isValidPassword(password: string) {
  return password.length >= 5 && password.length <= 8;
}

function simpleFallbackHash(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return `fallback:${hash}`;
}

async function hashPassword(value: string) {
  if (!globalThis.crypto?.subtle) {
    return simpleFallbackHash(value);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function safeUsers(value: unknown): AdminUser[] {
  if (!Array.isArray(value)) return [];

  return value.filter((user): user is AdminUser => {
    if (!user || typeof user !== 'object') return false;

    const item = user as AdminUser;

    return (
      typeof item.email === 'string' &&
      typeof item.passwordHash === 'string' &&
      (item.role === 'administrator' || item.role === 'sub_admin')
    );
  });
}

export function getUsers(): AdminUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];

    return safeUsers(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveUsers(users: AdminUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function isSessionExpiredAfterLeavingSettings() {
  const leftAtRaw = localStorage.getItem(SETTINGS_LEFT_AT_KEY);

  if (!leftAtRaw) return false;

  const leftAt = Number(leftAtRaw);

  if (!Number.isFinite(leftAt)) {
    localStorage.removeItem(SETTINGS_LEFT_AT_KEY);
    return false;
  }

  return Date.now() - leftAt > SETTINGS_SESSION_GRACE_MS;
}

export function markSettingsAccessLeft() {
  localStorage.setItem(SETTINGS_LEFT_AT_KEY, String(Date.now()));
}

export function clearSettingsAccessLeftMarker() {
  localStorage.removeItem(SETTINGS_LEFT_AT_KEY);
}

export function getSession(): AdminSession | null {
  try {
    if (isSessionExpiredAfterLeavingSettings()) {
      logoutAdmin();
      return null;
    }

    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AdminSession;

    if (
      typeof parsed.username !== 'string' ||
      (parsed.role !== 'administrator' && parsed.role !== 'sub_admin')
    ) {
      return null;
    }

    clearSettingsAccessLeftMarker();

    return parsed;
  } catch {
    return null;
  }
}

function saveSession(session: AdminSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  clearSettingsAccessLeftMarker();
}

export function logoutAdmin() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SETTINGS_LEFT_AT_KEY);
}

export async function loginAdmin(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();

  if (
    normalizedUsername === SUPER_ADMIN_USERNAME &&
    password === SUPER_ADMIN_PASSWORD
  ) {
    const session: AdminSession = {
      username: SUPER_ADMIN_USERNAME,
      role: 'administrator',
      loginAt: new Date().toISOString(),
      isSuperAdmin: true,
    };

    saveSession(session);
    return session;
  }

  if (!isValidTuniEmail(normalizedUsername)) {
    throw new Error('Username must be admin or firstname.lastname@tuni.fi.');
  }

  const users = getUsers();
  const passwordHash = await hashPassword(password);

  const user = users.find(
    (item) =>
      item.email === normalizedUsername &&
      item.passwordHash === passwordHash
  );

  if (!user) {
    throw new Error('Invalid username or password.');
  }

  const session: AdminSession = {
    username: user.email,
    role: user.role,
    loginAt: new Date().toISOString(),
  };

  saveSession(session);
  return session;
}

export async function addSubAdmin(email: string, password: string) {
  const users = getUsers();
  const normalizedEmail = email.trim().toLowerCase();

  if (!isValidTuniEmail(normalizedEmail)) {
    throw new Error('Email must be in firstname.lastname@tuni.fi format.');
  }

  if (!isValidPassword(password)) {
    throw new Error('Password must be between 5 and 8 characters.');
  }

  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error('This user already exists.');
  }

  const subAdmins = users.filter((user) => user.role === 'sub_admin');

  if (subAdmins.length >= MAX_SUB_ADMINS) {
    throw new Error(
      'Maximum 3 sub-admin users are allowed. Replace an existing user instead.'
    );
  }

  const now = new Date().toISOString();

  const newUser: AdminUser = {
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    role: 'sub_admin',
    createdAt: now,
    updatedAt: now,
  };

  saveUsers([...users, newUser]);

  return newUser;
}

export async function replaceSubAdmin(
  oldEmail: string,
  newEmail: string,
  newPassword: string
) {
  const users = getUsers();

  const oldNormalizedEmail = oldEmail.trim().toLowerCase();
  const newNormalizedEmail = newEmail.trim().toLowerCase();

  if (!oldNormalizedEmail) {
    throw new Error('Please select which sub-admin should be replaced.');
  }

  if (!isValidTuniEmail(newNormalizedEmail)) {
    throw new Error('New email must be in firstname.lastname@tuni.fi format.');
  }

  if (!isValidPassword(newPassword)) {
    throw new Error('New password must be between 5 and 8 characters.');
  }

  const oldUserExists = users.some(
    (user) =>
      user.email === oldNormalizedEmail && user.role === 'sub_admin'
  );

  if (!oldUserExists) {
    throw new Error('Selected sub-admin user was not found.');
  }

  const newEmailAlreadyUsed = users.some(
    (user) =>
      user.email === newNormalizedEmail &&
      user.email !== oldNormalizedEmail
  );

  if (newEmailAlreadyUsed) {
    throw new Error('New email is already used by another user.');
  }

  const newPasswordHash = await hashPassword(newPassword);
  const now = new Date().toISOString();

  const updatedUsers = users.map((user) => {
    if (user.email !== oldNormalizedEmail) return user;

    return {
      ...user,
      email: newNormalizedEmail,
      passwordHash: newPasswordHash,
      updatedAt: now,
    };
  });

  saveUsers(updatedUsers);

  return updatedUsers.find((user) => user.email === newNormalizedEmail);
}