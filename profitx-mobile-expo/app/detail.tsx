import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient as _LG } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAppRoute, getUserScopedKey, STORAGE_KEYS, getCurrentUserEmail } from '../constants/app-flow';
import { apiFetch } from '../constants/api-client';

const LinearGradient = _LG as React.ComponentType<any>;

export default function DetailScreen() {
  const [ownerName, setOwnerName] = useState('');
  const [shopName, setShopName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const entryTranslateY = useRef(new Animated.Value(32)).current;
  const entryScale = useRef(new Animated.Value(0.985)).current;

  useEffect(() => {
    let mounted = true;

      getAppRoute()
      .then((nextRoute) => {
        if (!mounted) return;
        if (nextRoute === '/detail' || nextRoute === '/get-started') return;
        router.replace(nextRoute);
      })
      .catch(() => {
        if (mounted) router.replace('/login');
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: 520,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
      Animated.spring(entryTranslateY, {
        toValue: 0,
        tension: 52,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.spring(entryScale, {
        toValue: 1,
        tension: 58,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [entryOpacity, entryScale, entryTranslateY]);

  const handleCreate = async () => {
    const trimmedName = ownerName.trim();
    const trimmedShop = shopName.trim();

    if (!trimmedName) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    if (!trimmedShop) {
      Alert.alert('Required', 'Please enter your shop name.');
      return;
    }

    setIsCreating(true);
    try {
      const [ownerNameKey, shopNameKey, profileCreatedKey, isFirstTimeKey] = await Promise.all([
        getUserScopedKey(STORAGE_KEYS.ownerName),
        getUserScopedKey(STORAGE_KEYS.shopName),
        getUserScopedKey(STORAGE_KEYS.profileCreated),
        getUserScopedKey(STORAGE_KEYS.isFirstTime),
      ]);

      await AsyncStorage.multiSet([
        [ownerNameKey, trimmedName],
        [shopNameKey, trimmedShop],
        [profileCreatedKey, 'true'],
        [isFirstTimeKey, 'false'],
      ]);
      // Also persist profile to backend so server-side DB has shop/owner
      try {
        const email = await getCurrentUserEmail();
        if (email) {
          await apiFetch('/auth/profile', {
            method: 'POST',
            body: JSON.stringify({ email, shopName: trimmedShop, ownerName: trimmedName }),
          });
        }
      } catch (e) {
        // ignore; app still works offline
        console.error('Failed to persist profile to backend:', e);
      }
    } catch {
      // Continue even if storage fails
    } finally {
      setIsCreating(false);
    }

    router.replace('/(tabs)');
  };

  return (
    <ImageBackground
      source={require('../assets/images/createbg.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar hidden />
      <View style={styles.overlay} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: entryOpacity,
              transform: [{ translateY: entryTranslateY }, { scale: entryScale }],
            },
          ]}
        >
          <Text style={styles.title}>Create your Profile</Text>

          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="rgba(255,255,255,0.45)"
            value={ownerName}
            onChangeText={setOwnerName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <TextInput
            style={styles.input}
            placeholder="Shop name"
            placeholderTextColor="rgba(255,255,255,0.45)"
            value={shopName}
            onChangeText={setShopName}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          <TouchableOpacity
            style={styles.btnWrap}
            activeOpacity={0.85}
            onPress={handleCreate}
            disabled={isCreating}
          >
            <LinearGradient
              colors={['#3F8105', '#ACFE3E']}
              start={[0, 0]}
              end={[1, 0]}
              style={styles.btn}
            >
              <Image
                source={require('../assets/images/bannerlogo.png')}
                style={styles.btnLogo}
                resizeMode="contain"
              />
              {isCreating ? (
                <>
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.btnText}>Creating...</Text>
                </>
              ) : (
                <Text style={styles.btnText}>Create</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.version}>ProfitX 3.0</Text>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bg: {
    flex: 1,
    backgroundColor: '#060d06',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 15,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  btnWrap: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  btn: {
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnLogo: {
    width: 20,
    height: 20,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  version: {
    position: 'absolute',
    right: 28,
    bottom: 42,
    color: '#ACFE3E',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
