import { router, Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAppRoute } from '@/constants/app-flow';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    let mounted = true;

    getAppRoute()
      .then((nextRoute) => {
        if (!mounted || nextRoute === '/(tabs)') return;
        router.replace(nextRoute);
      })
      .catch(() => {
        if (mounted) router.replace('/login');
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: { display: 'none' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="data"
        options={{
          title: 'Data',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="wallet-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="saving"
        options={{
          title: 'Saving',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="wallet-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
