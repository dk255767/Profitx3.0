import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient as ExpoLG } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
const ExpoLinearGradient = ExpoLG as React.ComponentType<any>;

const AnimatedPath = Animated.createAnimatedComponent(Path);

const { width: W } = Dimensions.get('window');

const BAR_H     = 68;
const BUBBLE    = 58;
const FLOAT_H   = BUBBLE / 2 + 14;   // space above bar for the bubble
const TOTAL_H   = FLOAT_H + BAR_H;

// Notch geometry
const NR        = 50;   // half-width of the notch valley
const DEPTH     = 40;   // how deep the valley dips (SVG bar-local y)
const TANGENT   = 10;   // bezier lead-in on each side

const SLOT_W    = W / 4;
const centerOf  = (i: number) => SLOT_W * i + SLOT_W / 2;

const NAV_ITEMS = [
  { key: 'data',    label: 'Data',    image: require('../assets/images/note.png') },
  { key: 'home',    label: 'Home',    image: require('../assets/images/home.png') },
  { key: 'finance', label: 'Finance', image: require('../assets/images/money.png') },
  { key: 'saving',  label: 'Saving',  image: require('../assets/images/saveicon.png') },
];

const ROUTE_BY_KEY: Record<string, '/(tabs)' | '/(tabs)/data' | '/(tabs)/finance' | '/(tabs)/saving'> = {
  data: '/(tabs)/data',
  home: '/(tabs)',
  finance: '/(tabs)/finance',
  saving: '/(tabs)/saving',
};

const NAV_SPRING = { mass: 1, damping: 18, stiffness: 160 } as const;

const keyFromPathname = (pathname: string) => {
  if (pathname.includes('/saving')) return 'saving';
  if (pathname.includes('/finance')) return 'finance';
  if (pathname.includes('/data')) return 'data';
  return 'home';
};

interface Props {
  onTabChange?: (tab: string) => void;
}

export default function BottomNavBar({ onTabChange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState('home');

  // Shared values for notch center and bubble center
  const cx       = useSharedValue(centerOf(1));
  const bubbleCX = useSharedValue(centerOf(1));

  useEffect(() => {
    const currentKey = keyFromPathname(pathname);
    setActive(currentKey);

    const idx = NAV_ITEMS.findIndex(i => i.key === currentKey);
    if (idx >= 0) {
      const target = centerOf(idx);
      cx.value = withSpring(target, NAV_SPRING);
      bubbleCX.value = withSpring(target, NAV_SPRING);
    }
  }, [pathname]);

  // Animated SVG path — builds cubic-bezier valley notch at cx.value
  const animatedPathProps = useAnimatedProps(() => {
    'worklet';
    const c  = cx.value;
    const lT = c - NR - TANGENT;   // left tangent start
    const rT = c + NR + TANGENT;   // right tangent end
    const d  = DEPTH;

    const path =
      `M 0 0 ` +
      `L ${lT} 0 ` +
      `C ${c - NR} 0 ${c - NR / 2} ${d} ${c} ${d} ` +
      `C ${c + NR / 2} ${d} ${c + NR} 0 ${rT} 0 ` +
      `L ${W} 0 ` +
      `L ${W} ${BAR_H} ` +
      `L 0 ${BAR_H} ` +
      `Z`;

    return { d: path };
  });

  // Bubble translateX
  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bubbleCX.value - BUBBLE / 2 }],
  }));

  const handlePress = (key: string) => {
    const idx = NAV_ITEMS.findIndex(i => i.key === key);
    setActive(key);
    onTabChange?.(key);
    const target = centerOf(idx);
    cx.value       = withSpring(target, NAV_SPRING);
    bubbleCX.value = withSpring(target, NAV_SPRING);

    const route = ROUTE_BY_KEY[key];
    if (route && keyFromPathname(pathname) !== key) {
      router.push(route);
    }
  };

  const activeItem = NAV_ITEMS.find(i => i.key === active)!;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">

      {/* ── SVG green bar with animated bezier notch ── */}
      <View style={styles.svgWrap} pointerEvents="none">
        <Svg width={W} height={BAR_H}>
          <Defs>
            <SvgGrad id="barGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0"   stopColor="#468908" />
              <Stop offset="1"   stopColor="#A3F439" />
            </SvgGrad>
          </Defs>
          <AnimatedPath animatedProps={animatedPathProps} fill="url(#barGrad)" />
        </Svg>
      </View>

      {/* ── Floating bubble ── */}
      <Animated.View style={[styles.bubble, bubbleStyle]} pointerEvents="none">
        {/* Mid glow ring */}
        <View style={styles.glowMid} />
        {/* Inner shadow ring + gradient button */}
        <View style={styles.glowRing}>
          <ExpoLinearGradient
            colors={['#488B0A', '#A9FA3C']}
            start={[0, 0]} end={[1, 1]}
            style={styles.bubbleGrad}
          >
            <Image source={activeItem.image} style={styles.bubbleIcon} resizeMode="contain" />
          </ExpoLinearGradient>
        </View>
      </Animated.View>

      {/* ── Tab touch row ── */}
      <View style={styles.row}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.tab}
              activeOpacity={0.75}
              onPress={() => handlePress(item.key)}
            >
              <View style={styles.iconArea}>
                {!isActive && (
                  <Image source={item.image} style={styles.inactiveIcon} resizeMode="contain" />
                )}
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: TOTAL_H,
  },

  svgWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BAR_H,
  },

  // Floating bubble
  bubble: {
    position: 'absolute',
    top: 0,
    width: BUBBLE,
    height: BUBBLE,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  glowMid: {
    position: 'absolute',
    width: BUBBLE + 18,
    height: BUBBLE + 18,
    borderRadius: (BUBBLE + 18) / 2,
    backgroundColor: 'rgba(169, 250, 60, 0.2)',
    shadowColor: '#A9FA3C',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  glowRing: {
    position: 'absolute',
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    shadowColor: '#A9FA3C',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  bubbleGrad: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(165, 246, 60, 0.3)',
  },
  bubbleIcon: {
    width: 26,
    height: 26,
    tintColor: '#000000',
  },

  // Tab row
  row: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BAR_H,
    flexDirection: 'row',
    zIndex: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  iconArea: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  inactiveIcon: {
    width: 22,
    height: 22,
    tintColor: '#0a2200',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0a2200',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: '#000000',
    fontWeight: '700',
  },
});
