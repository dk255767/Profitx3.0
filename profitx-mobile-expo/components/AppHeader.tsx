import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';

type Props = {
  greeting: string;
  ownerName: string;
  shopName: string;
  onOpenProfile: () => void;
};

export default function AppHeader({ greeting, ownerName, shopName, onOpenProfile }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTextWrap}>
        <Text style={styles.headerGreeting} numberOfLines={1}>{`${greeting}, ${ownerName}`}</Text>
        <Text style={styles.headerSubText}>{shopName}</Text>
      </View>
      <TouchableOpacity style={styles.profileBtn} onPress={onOpenProfile}>
        <Image source={require('../assets/images/cornerlogo.png')} style={styles.profileImg} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 44 : 10,
    paddingBottom: 10,
  },
  headerTextWrap: { flex: 1, paddingRight: 12, marginTop: 6 },
  headerGreeting: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  headerSubText: { color: '#ACFE3E', fontSize: 12, fontWeight: '500', marginTop: 0 },
  profileBtn: { padding: 4, marginTop: 8 },
  profileImg: { width: 26, height: 26, borderRadius: 4 },
});
