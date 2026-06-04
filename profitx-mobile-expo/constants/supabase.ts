import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// `expo-constants` types changed in newer Expo/TS versions and may not expose
// `extra` on every manifest type. Cast to `any` when accessing runtime extras
// to avoid type errors while keeping runtime behavior.
const C = Constants as any;
const extra = (C.expoConfig?.extra as any) ?? (C.manifest?.extra as any) ?? {};
const supabaseUrl = envUrl ?? extra.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? extra.SUPABASE_URL;
const supabaseAnonKey = envKey ?? extra.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseKey ?? extra.SUPABASE_KEY ?? extra.anonKey;

let _supabase: any;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment or app.json extra.');

  // Provide a minimal stub so the app can handle missing config at runtime
  // without crashing during module evaluation (e.g., during expo-router static analysis).
  _supabase = {
    auth: {
      signUp: async () => ({ data: null, error: { message: 'Missing Supabase configuration' } }),
      signInWithPassword: async () => ({ data: null, error: { message: 'Missing Supabase configuration' } }),
      signOut: async () => ({ error: { message: 'Missing Supabase configuration' } }),
      getUser: async () => ({ data: null, error: { message: 'Missing Supabase configuration' } }),
    },
  };
} else {
  // Avoid importing AsyncStorage at module load time which can break when Node (no `window`) runs
  // (expo CLI route analysis / server-side operations). Require it lazily only when running
  // in a React Native environment where `window` is available.
  let storageImpl: any = undefined;
  try {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      storageImpl = require('@react-native-async-storage/async-storage').default;
    }
  } catch {
    storageImpl = undefined;
  }

  const clientOptions: any = {};
  if (storageImpl) {
    clientOptions.auth = {
      storage: storageImpl,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    };
  } else {
    clientOptions.auth = {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    };
  }

  _supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions);
}

export const supabase = _supabase;
