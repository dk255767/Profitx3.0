import { supabase } from '../../constants/supabase';
import * as ProfileService from './profile';
import { apiFetch } from '../../constants/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../constants/app-flow';

type SignUpArgs = { email: string; password: string; shopName?: string; ownerName?: string };

export async function signUp({ email, password, shopName, ownerName }: SignUpArgs) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error('Email and password are required');
  }

  const resp = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: normalizedEmail, password, shopName: shopName ?? undefined, ownerName: ownerName ?? undefined }),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = data?.message ?? (data?.error ?? resp.statusText) ?? 'Failed to register';
    const err: any = new Error(msg);
    throw err;
  }

  const token = data?.token ?? null;
  const user = data?.user ?? null;
  if (token && user?.email) {
    await AsyncStorage.setItem(STORAGE_KEYS.authToken, String(token));
    await AsyncStorage.setItem(STORAGE_KEYS.authUserEmail, String(user.email));
    await AsyncStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true');
  }

  return data;
}

export async function signIn({ email, password }: { email: string; password: string }) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();

  const resp = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: normalizedEmail, password }),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = data?.message ?? (data?.error ?? resp.statusText) ?? 'Failed to login';
    throw new Error(msg);
  }

  const token = data?.token ?? null;
  const user = data?.user ?? null;
  if (token && user?.email) {
    await AsyncStorage.setItem(STORAGE_KEYS.authToken, String(token));
    await AsyncStorage.setItem(STORAGE_KEYS.authUserEmail, String(user.email));
    await AsyncStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true');
  }

  return data;
}

export async function signOut() {
  // Clear local auth state and Supabase session
  await AsyncStorage.multiRemove([STORAGE_KEYS.authToken, STORAGE_KEYS.authUserEmail, STORAGE_KEYS.isLoggedIn]);
  try {
    const { error } = await supabase.auth.signOut();
    if (error) console.warn('Supabase signOut error', error);
  } catch (e) {
    // ignore
  }
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}
