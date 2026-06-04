import { LinearGradient as _LG } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
export const options = {
  headerShown: false,
};
import {
  ImageBackground,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const LinearGradient = _LG as React.ComponentType<any>;

export default function GetStartedScreen() {
  return (
    <ImageBackground
      source={require('../assets/images/getstart.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar hidden />

      <LinearGradient
        colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.55, 1]}
        style={styles.overlay}
      />

      <View style={styles.bottomContent}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Get Started</Text>

          <Pressable
            onPress={() => router.replace('/detail')}
            style={styles.nextButton}
            android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: true }}
          >
            <Text style={styles.nextArrow}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.subtitle}>
          Set up your profile to start tracking your shop finances easily.
        </Text>

        <Text style={styles.version}>ProfitX 3.0</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#020602',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 26,
    paddingBottom: 42,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  nextButton: {
    width: 26,
    height: 26,
    borderRadius: 17,
    backgroundColor: '#ACFE3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextArrow: {
    color: '#153400',
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '900',
    marginTop: -2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: '90%',
    marginBottom: 35,
  },
  version: {
    alignSelf: 'flex-end',
    color: '#ACFE3E',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
