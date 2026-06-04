import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { fetchMyProfile, updateMyProfile } from '../lib/profile';
import { signOut } from './lib/auth';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await fetchMyProfile();
        if (!mounted) return;
        setProfile(p);
        setShopName(p?.shop_name ?? '');
        setOwnerName(p?.owner_name ?? '');
      } catch (e) {
        console.warn('Failed to load profile', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateMyProfile({ shop_name: shopName.trim(), owner_name: ownerName.trim() });
      setProfile(updated);
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (e: any) {
      console.error('Failed to save profile', e);
      Alert.alert('Error', e?.message ?? 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn('Sign out failed', e);
    }
    router.replace('/login');
  };

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator style={{ marginTop: 40 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.shop}>{profile?.shop_name ?? 'No shop name'}</Text>
        <Text style={styles.owner}>{profile?.owner_name ?? 'No owner name'}</Text>
        <Text style={styles.email}>{profile?.email ?? ''}</Text>
      </View>

      <View style={styles.form}>
        <TextInput style={styles.input} value={shopName} onChangeText={setShopName} placeholder="Shop name" placeholderTextColor="#666" />
        <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} placeholder="Owner name" placeholderTextColor="#666" />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save profile'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 24 },
  shop: { color: '#fff', fontSize: 22, fontWeight: '700' },
  owner: { color: '#aaa', marginTop: 8 },
  email: { color: '#666', marginTop: 6 },
  form: { padding: 24 },
  input: { backgroundColor: '#111', color: '#fff', padding: 12, borderRadius: 10, marginBottom: 12 },
  saveBtn: { backgroundColor: '#3F8105', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  saveText: { color: '#fff', fontWeight: '700' },
  logoutBtn: { alignItems: 'center' },
  logoutText: { color: '#ff6b6b' },
});
