import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './api';

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const [token, authUserEmail] = await Promise.all([
    AsyncStorage.getItem('auth_token'),
    AsyncStorage.getItem('auth_user_email'),
  ]);
  const hasJsonBody = typeof init?.body === 'string';

  const headers: Record<string, string> = {
    ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (authUserEmail) {
    headers['X-Auth-User-Email'] = authUserEmail;
  }

  // Debug logging: record which base URL and headers are sent from the client.
  try {
    const headerKeys = Object.keys(headers || {});
    // Do not log sensitive header values. Log presence/keys only.
    // This will appear in device JS logs and help confirm the target URL.
    // eslint-disable-next-line no-console
    console.log('apiFetch ->', { url: `${API_BASE_URL}${path}`, hasToken: !!token, authUserEmail, headerKeys });
  } catch (e) {
    // ignore logging errors
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
}
