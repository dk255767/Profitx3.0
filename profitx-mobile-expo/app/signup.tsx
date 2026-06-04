import { Ionicons } from '@expo/vector-icons';
import { LinearGradient as _LG } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { signUp } from './lib/auth';

const LinearGradient = _LG as React.ComponentType<any>;

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    // prevent routing race if needed — keep existing behavior minimal
    return () => {
      mounted = false;
    };
  }, []);

  const isEmailValid = (value: string) => /\S+@\S+\.\S+/.test(value);

  const handleCreateAccount = async () => {
    if (isCreating) return;

    const trimmedEmail = String(email ?? '').trim().toLowerCase();
    const trimmedPassword = String(password ?? '').trim();
    const trimmedConfirm = String(confirmPassword ?? '').trim();

    if (!trimmedEmail || !isEmailValid(trimmedEmail)) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }

    if (!trimmedPassword) {
      Alert.alert('Invalid password', 'Password cannot be empty.');
      return;
    }

    if (trimmedPassword.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    // shopName and ownerName removed from signup flow

    setIsCreating(true);
    try {
      const data = await signUp({ email: trimmedEmail, password: trimmedPassword });

      // After signup, continue the new user flow: Get Started -> Profile Setup -> Home
      router.replace('/get-started');
    } catch (e: any) {
      console.error('Sign up failed', e);
      if ((e as any)?.code === 'RATE_LIMIT') {
        Alert.alert('Too many attempts', 'Too many signup attempts. Please wait a few minutes and try again.');
      } else {
        Alert.alert('Sign up failed', e?.message ?? String(e));
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={styles.form}>
        <Text style={styles.title}>Create your Account</Text>
        <Text style={styles.subtitle}>Sign up with email and a secure password.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#555"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError('');
          }}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Shop name and owner name removed from signup form */}

        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Create password"
            placeholderTextColor="#555"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError('');
            }}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((p) => !p)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color="#555" />
          </TouchableOpacity>
        </View>

        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Confirm password"
            placeholderTextColor="#555"
            value={confirmPassword}
            onChangeText={(v) => {
              setConfirmPassword(v);
              setError('');
            }}
            secureTextEntry={!showConfirmPassword}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPassword((p) => !p)}>
            <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color="#555" />
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleCreateAccount}
          style={[styles.signupBtnWrap, isCreating && styles.signupBtnWrapDisabled]}
          disabled={isCreating}
        >
          <LinearGradient colors={['#3F8105', '#ACFE3E']} start={[0, 0]} end={[1, 0]} style={styles.signupBtn}>
            {isCreating ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.signupText}>Creating...</Text>
              </View>
            ) : (
              <Text style={styles.signupText}>Create Account</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.bottomRow}>
          <Text style={styles.accountText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  form: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 14, marginBottom: 24 },
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
  passwordRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  eyeBtn: { position: 'absolute', right: 16 },
  errorText: { color: '#ff4d4d', fontSize: 13, marginBottom: 12 },
  signupBtnWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 8, marginBottom: 24 },
  signupBtnWrapDisabled: { opacity: 0.9 },
  signupBtn: { paddingVertical: 11, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signupText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  accountText: { color: '#888', fontSize: 14 },
  loginLink: { color: '#ACFE3E', fontSize: 14, fontWeight: '600' },
});
