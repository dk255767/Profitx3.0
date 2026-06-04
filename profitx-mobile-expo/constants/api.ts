import { Platform } from 'react-native';
import Constants from 'expo-constants';

const getExpoHost = (): string | null => {
  const c = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    expoGoConfig?: { debuggerHost?: string };
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
    manifest?: { debuggerHost?: string };
  };

  const hostUri = c.expoConfig?.hostUri
    ?? c.expoGoConfig?.debuggerHost
    ?? c.manifest2?.extra?.expoClient?.hostUri
    ?? c.manifest?.debuggerHost
    ?? null;

  if (!hostUri) return null;
  const host = hostUri.split(':')[0]?.trim();
  return host || null;
};

const expoHost = getExpoHost();
const lanApiBase = expoHost ? `http://${expoHost}:4000/api` : null;

const baseByPlatform = Platform.select({
  android: lanApiBase ?? 'http://10.0.2.2:4000/api',
  ios: lanApiBase ?? 'http://localhost:4000/api',
  default: lanApiBase ?? 'http://localhost:4000/api',
});

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? baseByPlatform ?? 'http://localhost:4000/api';
