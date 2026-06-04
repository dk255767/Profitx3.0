import { Ionicons } from '@expo/vector-icons';
import { LinearGradient as _LG } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  getAppRoute,
  makeUserScopedKey,
  normalizeUserEmail,
  STORAGE_KEYS,
} from '../constants/app-flow';
import { signIn } from './lib/auth';
import { fetchMyProfile } from '../lib/profile';
import {
    Dimensions,
    Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    ActivityIndicator,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
const LinearGradient = _LG as React.ComponentType<any>;

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    getAppRoute()
      .then((nextRoute) => {
        if (!mounted || nextRoute === '/login') return;
        router.replace(nextRoute as any);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardOpen(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >

      {/* Top spacer pushes form to lower half */}
      <View style={{ height: isKeyboardOpen ? height * 0.08 : height * 0.28 }} />

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.title}>Login to your Account</Text>

        {/* Email */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#555"
          value={email}
          onChangeText={(v) => { setEmail(v); setError(''); }}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Password */}
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Password"
            placeholderTextColor="#555"
            value={password}
            onChangeText={(v) => { setPassword(v); setError(''); }}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color="#555" />
          </TouchableOpacity>
        </View>

        {/* Remember me */}
        <TouchableOpacity
          style={styles.rememberRow}
          onPress={() => setRememberMe(!rememberMe)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
            {rememberMe && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.rememberText}>remember me</Text>
        </TouchableOpacity>

        {/* Error */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Login button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={async () => {
            if (isLogging) return;
            setIsLogging(true);
            try {
              const normalizedInputEmail = email.trim().toLowerCase();
              const result = await signIn({ email: normalizedInputEmail, password });

              const nextEmail = normalizeUserEmail(String(result.user?.email ?? normalizedInputEmail));
              const previousEmail = normalizeUserEmail(await AsyncStorage.getItem(STORAGE_KEYS.authUserEmail));

              const profileCreatedKey = makeUserScopedKey(STORAGE_KEYS.profileCreated, nextEmail);
              const ownerNameKey = makeUserScopedKey(STORAGE_KEYS.ownerName, nextEmail);
              const shopNameKey = makeUserScopedKey(STORAGE_KEYS.shopName, nextEmail);

              if (previousEmail && previousEmail === nextEmail) {
                const legacy = await AsyncStorage.multiGet([
                  STORAGE_KEYS.profileCreated,
                  STORAGE_KEYS.ownerName,
                  STORAGE_KEYS.shopName,
                ]);

                const migrations: [string, string][] = [];
                if (legacy[0][1] != null) migrations.push([profileCreatedKey, String(legacy[0][1])]);
                if (legacy[1][1] != null) migrations.push([ownerNameKey, String(legacy[1][1])]);
                if (legacy[2][1] != null) migrations.push([shopNameKey, String(legacy[2][1])]);

                if (migrations.length > 0) await AsyncStorage.multiSet(migrations);
              }

              // Persist shopName/ownerName returned by backend login if present
              try {
                const backendUser = result.user ?? null;
                if (backendUser?.shopName != null) await AsyncStorage.setItem(shopNameKey, String(backendUser.shopName));
                if (backendUser?.ownerName != null) await AsyncStorage.setItem(ownerNameKey, String(backendUser.ownerName));
                if (backendUser?.shopName != null || backendUser?.ownerName != null) {
                  await AsyncStorage.setItem(profileCreatedKey, 'true');
                } else {
                  // Fallback: try to fetch profile from Supabase if backend didn't return it
                  try {
                    const profile = await fetchMyProfile();
                    if (profile) {
                      if (profile.shop_name != null) await AsyncStorage.setItem(shopNameKey, String(profile.shop_name));
                      if (profile.owner_name != null) await AsyncStorage.setItem(ownerNameKey, String(profile.owner_name));
                      if (profile.shop_name != null || profile.owner_name != null) await AsyncStorage.setItem(profileCreatedKey, 'true');
                    }
                  } catch (e) {
                    console.warn('Failed to load profile after login', e);
                  }
                }
              } catch (e) {
                console.warn('Failed to persist profile after login', e);
              }

              await Promise.all([
                AsyncStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true'),
                AsyncStorage.setItem(STORAGE_KEYS.authToken, String(result.session?.access_token ?? 'supabase-auth')),
                AsyncStorage.setItem(STORAGE_KEYS.authUserEmail, nextEmail),
              ]);

              const nextRoute = await getAppRoute();
              router.replace((nextRoute === '/login' ? '/detail' : nextRoute) as any);
            } catch (e: any) {
              setError(e?.message ?? 'Unable to login right now. Check your network and Supabase config.');
            } finally {
              setIsLogging(false);
            }
          }}
          style={styles.loginBtnWrap}
          disabled={isLogging}
        >
          <LinearGradient
            colors={['#3F8105', '#ACFE3E']}
            start={[0, 0]}
            end={[1, 0]}
            style={styles.loginBtn}
          >
            {isLogging ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.loginText}>Login</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* OR divider */}
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.orLine} />
        </View>

        {/* Google button */}
        <TouchableOpacity style={styles.googleBtn} activeOpacity={0.85}>
          <Image
            source={require('../assets/images/image 200.png')}
            style={styles.googleIcon}
            resizeMode="contain"
          />
          <Text style={styles.googleText}>Continue with google</Text>
        </TouchableOpacity>
      </View>

      </KeyboardAvoidingView>

      {/* Bottom sign up - placed outside KeyboardAvoidingView so it's fixed on screen */}
      <View style={styles.bottomRow} pointerEvents="box-none">
        <Text style={styles.noAccountText}>Dont have an account ? </Text>
        <TouchableOpacity onPress={() => router.push('/signup')}>
          <Text style={styles.signInLink}>sign up</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  keyboardContainer: {
    flex: 1,
  },
  form: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 28,
    letterSpacing: 0.3,
  },

  // Inputs
  input: {
    backgroundColor: '#0e0e0e',
    borderWidth: 1,
    borderColor: '#2c2c2c',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 18,
    color: '#fff',
    fontSize: 15,
    marginBottom: 14,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  eyeBtn: {
    position: 'absolute',
    right: 16,
  },

  // Remember me
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxActive: {
    backgroundColor: '#ACFE3E',
    borderColor: '#ACFE3E',
  },
  checkmark: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  rememberText: {
    color: '#aaa',
    fontSize: 14,
  },

  // Error
  errorText: {
    color: '#ff4d4d',
    fontSize: 13,
    marginBottom: 12,
    marginTop: -8,
  },

  // Login button
  loginBtnWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
  },
  loginBtn: {
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 14,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // OR divider
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a2a2a',
  },
  orText: {
    color: '#555',
    fontSize: 14,
  },

  // Google button
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 10,
    gap: 12,
  },
  googleIcon: {
    width: 22,
    height: 22,
  },
  googleText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
  },

  // Bottom
  bottomRow: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomRowKeyboardOpen: {
    bottom: 10,
  },
  noAccountText: {
    color: '#888',
    fontSize: 14,
  },
  signInLink: {
    color: '#ACFE3E',
    fontSize: 14,
    fontWeight: '600',
  },
});
