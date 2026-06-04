import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  isLoggedIn: 'is_logged_in',
  authToken: 'auth_token',
  authUserEmail: 'auth_user_email',
  isFirstTime: 'is_first_time',
  profileCreated: 'profile_created',
  ownerName: 'owner_name',
  shopName: 'shop_name',
} as const;

export type AppRoute = '/login' | '/getstarted' | '/detail' | '/(tabs)';

export function normalizeUserEmail(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

export function makeUserScopedKey(baseKey: string, userEmail: string | null | undefined): string {
  const normalizedEmail = normalizeUserEmail(userEmail);
  return normalizedEmail ? `${baseKey}:${normalizedEmail}` : baseKey;
}

export async function getCurrentUserEmail(): Promise<string> {
  const email = await AsyncStorage.getItem(STORAGE_KEYS.authUserEmail);
  return normalizeUserEmail(email);
}

export async function getUserScopedKey(baseKey: string): Promise<string> {
  const email = await getCurrentUserEmail();
  return makeUserScopedKey(baseKey, email);
}

type FlowSnapshot = {
  isLoggedIn: string | null;
  authToken: string | null;
  isFirstTime: string | null;
  profileCreated: string | null;
};

export const resolveAppRoute = (snapshot: FlowSnapshot): AppRoute => {
  const isAuthed = snapshot.isLoggedIn === 'true' && Boolean(snapshot.authToken);

  if (!isAuthed) return '/login';
  if (snapshot.profileCreated !== 'true' && snapshot.isFirstTime === 'true') return '/getstarted';
  if (snapshot.profileCreated !== 'true') return '/detail';
  return '/(tabs)';
};

export async function getAppRoute(): Promise<AppRoute> {
  const authEntries = await AsyncStorage.multiGet([
    STORAGE_KEYS.isLoggedIn,
    STORAGE_KEYS.authToken,
    STORAGE_KEYS.authUserEmail,
  ]);

  const authUserEmail = normalizeUserEmail(authEntries[2][1]);
  const scopedIsFirstTimeKey = makeUserScopedKey(STORAGE_KEYS.isFirstTime, authUserEmail);
  const scopedProfileCreatedKey = makeUserScopedKey(STORAGE_KEYS.profileCreated, authUserEmail);

  const [scopedIsFirstTime, scopedProfileCreated] = await Promise.all([
    AsyncStorage.getItem(scopedIsFirstTimeKey),
    AsyncStorage.getItem(scopedProfileCreatedKey),
  ]);

  const snapshot: FlowSnapshot = {
    isLoggedIn: authEntries[0][1],
    authToken: authEntries[1][1],
    isFirstTime: scopedIsFirstTime,
    profileCreated: scopedProfileCreated,
  };

  return resolveAppRoute(snapshot);
}
