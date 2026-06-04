import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ImageBackground,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { getAppRoute } from '../constants/app-flow';

export default function SplashScreen() {
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(50)).current;
  const logoScale    = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Screen fades in
      Animated.timing(screenOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),

      // 2. Logo slides up + fades in + scales to full size
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(logoTranslateY, {
          toValue: 0,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 5,
          tension: 70,
          useNativeDriver: true,
        }),
      ]),

      // 3. Subtle pulse — scale up slightly then back
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.08,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),

      // 4. Hold
      Animated.delay(900),

      // 5. Entire screen fades out
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      try {
        const nextRoute = await getAppRoute();
        router.replace(nextRoute);
      } catch {
        router.replace('/login');
      }
    });
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      <StatusBar hidden />

      <ImageBackground
        source={require('../assets/images/splash (1).png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        <Animated.View
          style={[
            styles.branding,
            {
              opacity: logoOpacity,
              transform: [
                { translateY: logoTranslateY },
                { scale: logoScale },
              ],
            },
          ]}
        >
          <Animated.Image
            source={require('../assets/images/Group 236.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  bg: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  branding: {
    position: 'absolute',
    bottom: 100,
    left: 15,
    right: 15,
    alignItems: 'center',
  },
  logo: {
    width: 220,
    height: 90,
  },
});
