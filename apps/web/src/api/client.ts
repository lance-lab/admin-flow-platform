import type {
  AuthenticatedUser,
  Locale,
  LoginResponse,
  PlatformModule,
  PlatformRole,
  PlatformUser
} from '../../../../packages/shared-types/src';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const TOKEN_KEY = 'admin-flow-token';

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function login(email: string, password: string, locale: Locale) {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, locale })
  });
}

export async function getCurrentUser() {
  return request<{ user: AuthenticatedUser }>('/api/auth/me');
}

export async function getModules(locale: Locale) {
  return request<{ modules: PlatformModule[] }>(`/api/platform/modules?locale=${locale}`);
}

export async function getPlatformHealth(locale: Locale) {
  return request<{
    services: Array<{
      code: string;
      name: string;
      status: 'ok' | 'error';
      detail: string;
    }>;
  }>(`/api/platform/health?locale=${locale}`);
}

export async function getUsers() {
  return request<{ users: PlatformUser[] }>('/api/platform/users');
}

export async function getRoles() {
  return request<{ roles: PlatformRole[] }>('/api/platform/roles');
}

export async function createUser(input: {
  email: string;
  displayName: string;
  locale: Locale;
  roleCodes: string[];
}) {
  return request<{ user: PlatformUser; setupUrl: string; expiresAt: string }>('/api/platform/users', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function updateUser(
  userId: string,
  input: {
    displayName: string;
    locale: Locale;
    active: boolean;
    roleCodes: string[];
  }
) {
  return request<{ success: true }>(`/api/platform/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

export async function deleteUser(userId: string) {
  return request<{ success: true }>(`/api/platform/users/${userId}`, {
    method: 'DELETE'
  });
}

export async function getPasswordSetup(token: string) {
  return request<{ user: { email: string; displayName: string } }>(`/api/auth/password-setup/${token}`);
}

export async function completePasswordSetup(token: string, password: string) {
  return request<{ success: true }>(`/api/auth/password-setup/${token}`, {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}
