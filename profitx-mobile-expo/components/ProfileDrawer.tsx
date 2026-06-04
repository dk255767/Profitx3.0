import React, { useRef, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import { getUserScopedKey, STORAGE_KEYS } from '../constants/app-flow';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Pressable,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  TextInput,
  DeviceEventEmitter,
} from 'react-native';
import { LinearGradient as _LG } from 'expo-linear-gradient';
const LinearGradient = _LG as React.ComponentType<any>;
import { Ionicons } from '@expo/vector-icons';
import { updateMyProfile } from '../lib/profile';
import { apiFetch } from '../constants/api-client';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.9;
const FINANCE_COMPLETED_KEY = 'finance_completed_payments_v1';
const COMPLETED_PAYMENTS_KEY = 'completed_payments';

type CompletedPaymentVendor = {
  id: string;
  name: string;
  loanDate: string;
  loanAmount: number;
  payments: Array<{
    amount: number;
    month: string;
    year: string;
    paidOn: string;
    timestamp: number;
  }>;
};

type SavingHistorySummary = {
  cardId: string;
  cardName: string;
  completedOn: string;
  totalSavings: number;
  status: 'completed';
};

type CompletedPaymentRow = {
  id: string;
  title: string;
  completedOn: string;
  amount: number;
};

const DEFAULT_PROFILE = {
  ownerName: 'Chief',
  shopName: 'Samosa Shop',
};

const MENU_ITEMS = [
  { key: 'home',     label: 'Home',     image: require('../assets/images/home.png'),  icon: null },
  { key: 'data',     label: 'Data',     image: require('../assets/images/note.png'),  icon: null },
  { key: 'finance',  label: 'Finance',  image: require('../assets/images/money.png'), icon: null },
  { key: 'saving',   label: 'Saving',   image: require('../assets/images/saveicon.png'), icon: null },
  { key: 'completed', label: 'Completed Payment', image: null, icon: 'checkmark-done-outline' },
  { key: 'edit', label: 'Edit Profile', image: null, icon: 'create-outline' },
  { key: 'savingHistory', label: 'Saving History', image: null, icon: 'time-outline' },
  { key: 'logout',   label: 'Logout',   image: null, icon: 'log-out-outline'  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ProfileDrawer({ visible, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [activeMenu, setActiveMenu] = useState<string>('home');
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [completedPayments, setCompletedPayments] = useState<CompletedPaymentRow[]>([]);
  const [savingOpen, setSavingOpen] = useState(false);
  const [savingPayments, setSavingPayments] = useState<CompletedPaymentRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editShopName, setEditShopName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');

  const formatCurrency = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

  const toCompletedPaymentRow = (item: unknown): CompletedPaymentRow | null => {
    if (!item || typeof item !== 'object') return null;
    const row = item as Partial<CompletedPaymentVendor & SavingHistorySummary>;

    // New saving summary format.
    if (
      typeof row.cardId === 'string'
      && typeof row.cardName === 'string'
      && typeof row.completedOn === 'string'
      && typeof row.totalSavings === 'number'
    ) {
      return {
        id: row.cardId,
        title: row.cardName,
        completedOn: row.completedOn,
        amount: row.totalSavings,
      };
    }

    // Legacy finance vendor format.
    if (
      typeof row.id === 'string'
      && typeof row.name === 'string'
      && typeof row.loanAmount === 'number'
    ) {
      const payments = Array.isArray(row.payments) ? row.payments : [];
      const validPayments = payments
        .filter((p) => {
          if (!p || typeof p !== 'object') return false;
          const payment = p as Partial<{ paidOn: string; timestamp: number }>;
          return typeof payment.paidOn === 'string' && typeof payment.timestamp === 'number';
        })
        .map((p) => p as { paidOn: string; timestamp: number });
      const latestPayment = validPayments.sort((a, b) => b.timestamp - a.timestamp)[0];

      return {
        id: row.id,
        title: row.name,
        completedOn: latestPayment?.paidOn ?? '--',
        amount: row.loanAmount,
      };
    }

    return null;
  };

  const normalizeCompletedPayments = (value: unknown): CompletedPaymentRow[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map(toCompletedPaymentRow)
      .filter((row): row is CompletedPaymentRow => row !== null);
  };

  const loadSavingHistory = async () => {
    try {
      const savingKey = await getUserScopedKey(COMPLETED_PAYMENTS_KEY);
      const raw = await AsyncStorage.getItem(savingKey);
      if (!raw) {
        setSavingPayments([]);
        return;
      }
      const parsed = JSON.parse(raw);
      const normalized = normalizeCompletedPayments(parsed);
      setSavingPayments(normalized);
    } catch {
      setSavingPayments([]);
    }
  };

  const parseFinanceCompleted = (value: unknown): CompletedPaymentRow[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item): CompletedPaymentRow | null => {
        if (!item || typeof item !== 'object') return null;
        const v = item as Partial<CompletedPaymentVendor>;
        if (typeof v.id !== 'string' || typeof v.loanAmount !== 'number') return null;

        const payments = Array.isArray(v.payments) ? v.payments : [];
        const validPayments = payments
          .filter(p => p && typeof p === 'object')
          .map(p => p as Partial<{ paidOn: string; timestamp: number }>);
        const latest = validPayments.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))[0];

        return {
          id: String(v.id),
          title: String(v.name ?? ''),
          completedOn: latest?.paidOn ?? '--',
          amount: Number(v.loanAmount ?? 0),
        };
      })
      .filter((r): r is CompletedPaymentRow => r !== null);
  };

  const handleSaveProfile = async () => {
    const trimmedOwnerName = editOwnerName.trim();
    const trimmedShopName = editShopName.trim();

    if (!trimmedOwnerName) {
      Alert.alert('Required', 'Please enter owner name.');
      return;
    }
    if (!trimmedShopName) {
      Alert.alert('Required', 'Please enter shop name.');
      return;
    }

    try {
      const [ownerNameKey, shopNameKey] = await Promise.all([
        getUserScopedKey(STORAGE_KEYS.ownerName),
        getUserScopedKey(STORAGE_KEYS.shopName),
      ]);

      await AsyncStorage.multiSet([
        [ownerNameKey, trimmedOwnerName],
        [shopNameKey, trimmedShopName],
      ]);

      // Try updating remote profile via Supabase and backend API.
      // Failure here should not block local update.
      try {
        // Update Supabase profile if authenticated (best-effort)
        try {
          await updateMyProfile({ shop_name: trimmedShopName, owner_name: trimmedOwnerName });
        } catch (e) {
          console.warn('Supabase profile update failed', e);
        }

        // Also call backend endpoint to persist profile by email when available
        if (loginEmail && loginEmail.trim()) {
          try {
            await apiFetch('/auth/profile', {
              method: 'POST',
              body: JSON.stringify({ email: loginEmail.trim().toLowerCase(), shopName: trimmedShopName, ownerName: trimmedOwnerName }),
            });
          } catch (e) {
            console.warn('Backend profile update failed', e);
          }
        }
      } catch (e) {
        console.warn('Remote profile update failed', e);
      }

      setProfile({ ownerName: trimmedOwnerName, shopName: trimmedShopName });
      setEditOpen(false);
      onClose();
    } catch (err) {
      console.warn('Failed to save profile locally', err);
      Alert.alert('Error', 'Unable to update profile now. Please try again.');
    }
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 240, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    let listener: any;
    const loadDrawerData = async () => {
      try {
        const [ownerNameKey, shopNameKey, financeCompletedKey] = await Promise.all([
          getUserScopedKey(STORAGE_KEYS.ownerName),
          getUserScopedKey(STORAGE_KEYS.shopName),
          getUserScopedKey(FINANCE_COMPLETED_KEY),
        ]);

        const [ownerName, shopName, financeRaw, authUserEmail] = await AsyncStorage.multiGet([
          ownerNameKey,
          shopNameKey,
          financeCompletedKey,
          STORAGE_KEYS.authUserEmail,
        ]);

        const legacyProfile = await AsyncStorage.multiGet([
          STORAGE_KEYS.ownerName,
          STORAGE_KEYS.shopName,
        ]);

        const rawFinance = financeRaw[1];
        let parsedCompleted: CompletedPaymentRow[] = [];
        if (rawFinance) {
          try {
            const parsed = JSON.parse(rawFinance);
            parsedCompleted = parseFinanceCompleted(parsed);
          } catch {}
        }

        setProfile({
          ownerName: ownerName[1]?.trim() || legacyProfile[0][1]?.trim() || DEFAULT_PROFILE.ownerName,
          shopName: shopName[1]?.trim() || legacyProfile[1][1]?.trim() || DEFAULT_PROFILE.shopName,
        });
        setLoginEmail(authUserEmail[1]?.trim() || '');
        setCompletedPayments(parsedCompleted);
      } catch {
        setProfile(DEFAULT_PROFILE);
        setLoginEmail('');
        setCompletedPayments([]);
      }
    };

    if (visible) {
      loadDrawerData();
      listener = DeviceEventEmitter.addListener('financeHistoryUpdated', () => {
        loadDrawerData();
      });
    }

    return () => {
      if (listener && typeof listener.remove === 'function') listener.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (pathname.includes('/saving')) {
      setActiveMenu('saving');
      return;
    }
    if (pathname.includes('/finance')) {
      setActiveMenu('finance');
      return;
    }
    if (pathname.includes('/data')) {
      setActiveMenu('data');
      return;
    }
    if (pathname.includes('/(tabs)') || pathname === '/' || pathname.endsWith('/tabs')) {
      setActiveMenu('home');
    }
  }, [pathname]);

  const handleMenuPress = (key: string) => {
    setActiveMenu(key);

    if (key === 'completed') {
      setCompletedOpen(true);
      return;
    }

    if (key === 'savingHistory') {
      setSavingOpen(true);
      loadSavingHistory();
      return;
    }

    if (key === 'edit') {
      setEditOwnerName(profile.ownerName);
      setEditShopName(profile.shopName);
      setEditOpen(true);
      return;
    }

    if (key === 'home') {
      router.push('/(tabs)');
      onClose();
      return;
    }

    if (key === 'data') {
      router.push('/(tabs)/data');
      onClose();
      return;
    }

    if (key === 'finance') {
      router.push('/(tabs)/finance');
      onClose();
      return;
    }

    if (key === 'saving') {
      router.push('/(tabs)/saving');
      onClose();
      return;
    }

    if (key === 'logout') {
      AsyncStorage.multiRemove([
        STORAGE_KEYS.isLoggedIn,
        STORAGE_KEYS.authToken,
        STORAGE_KEYS.authUserEmail,
      ])
        .catch(() => {})
        .finally(() => {
          router.replace('/login');
          onClose();
        });
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} pointerEvents="box-none">
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
        <LinearGradient
          colors={['#050505', '#0a0a0a']}
          start={[0, 0]}
          end={[0, 1]}
          style={styles.inner}
        >
          {/* Header row: avatar + text | close arrow */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              {/* Glow ring behind avatar */}
              <View style={styles.avatarGlow}>
                <LinearGradient
                  colors={['#438607', '#A9FA3C']}
                  start={[0, 0]}
                  end={[1, 1]}
                  style={styles.avatarCircle}
                >
                  <Text style={styles.avatarLetter}>{profile.ownerName.charAt(0).toUpperCase()}</Text>
                </LinearGradient>
              </View>
              <View style={styles.headerText}>
                <Text style={styles.name}>{profile.ownerName}</Text>
                <Text style={styles.shop}>{profile.shopName}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="return-up-back-outline" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Menu items */}
          <View style={styles.menu}>
            {MENU_ITEMS.map(item => {
              const isActive = activeMenu === item.key;
              const itemColor = isActive ? '#ACFE3E' : (item.key === 'logout' ? '#ff6b6b' : '#ffffff');
              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.menuItem}
                  activeOpacity={0.7}
                  onPress={() => handleMenuPress(item.key)}
                >
                  <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
                    {item.image
                      ? <Image source={item.image} style={[styles.menuIcon, { tintColor: itemColor }]} />
                      : <Ionicons name={item.icon as any} size={20} color={itemColor} />
                    }
                  </View>
                  <Text style={[styles.menuLabel, { color: itemColor }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Profitx 3.0</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      <Modal
        transparent
        visible={completedOpen}
        animationType="fade"
        onRequestClose={() => setCompletedOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCompletedOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Ionicons name="checkmark-done-outline" size={18} color="#ACFE3E" />
              <Text style={styles.modalTitle}>Completed Payment</Text>
            </View>

            {completedPayments.length === 0 ? (
              <Text style={styles.modalEmpty}>No completed payments yet.</Text>
            ) : (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {completedPayments.map((vendor, index) => {
                  return (
                    <View key={`drawer-completed-${vendor.id}-${vendor.completedOn}-${index}`} style={styles.completedRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.completedName} numberOfLines={1}>{vendor.title}</Text>
                        <Text style={styles.completedMeta}>Settled on: {vendor.completedOn}</Text>
                      </View>
                      <Text style={styles.completedAmount}>{formatCurrency(vendor.amount)}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCompletedOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={savingOpen}
        animationType="fade"
        onRequestClose={() => setSavingOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSavingOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Ionicons name="time-outline" size={18} color="#ACFE3E" />
              <Text style={styles.modalTitle}>Saving History</Text>
            </View>

            {savingPayments.length === 0 ? (
              <Text style={styles.modalEmpty}>No saved records yet.</Text>
            ) : (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {savingPayments.map((row, idx) => (
                  <View key={`saving-${row.id}-${idx}`} style={styles.completedRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.completedName} numberOfLines={1}>{row.title}</Text>
                      <Text style={styles.completedMeta}>Completed on: {row.completedOn}</Text>
                    </View>
                    <Text style={styles.completedAmount}>{formatCurrency(row.amount)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSavingOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={editOpen}
        animationType="fade"
        onRequestClose={() => setEditOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Ionicons name="create-outline" size={18} color="#ACFE3E" />
              <Text style={styles.modalTitle}>Edit Profile</Text>
            </View>

            {loginEmail ? (
              <Text style={styles.editAccountText}>
                Logged in as {loginEmail.split('@')[0]} ({loginEmail})
              </Text>
            ) : null}

            <Text style={styles.inputLabel}>Owner Name</Text>
            <TextInput
              value={editOwnerName}
              onChangeText={setEditOwnerName}
              placeholder="Enter owner name"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.editInput}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={styles.inputLabel}>Shop Name</Text>
            <TextInput
              value={editShopName}
              onChangeText={setEditShopName}
              placeholder="Enter shop name"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.editInput}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSaveProfile}
            />

            <View style={styles.editActionsRow}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditOpen(false)}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editSaveBtn} onPress={handleSaveProfile}>
                <Text style={styles.editSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: DRAWER_WIDTH, zIndex: 100,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    borderRightWidth: 1,
    borderColor: '#7CFF00',
  },
  inner: {
    flex: 1, paddingTop: 54, paddingHorizontal: 20, paddingBottom: 30,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    flex: 1,
  },
  avatarGlow: {
    borderRadius: 36,
    shadowColor: '#7CFF00',
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  avatarCircle: {
    marginHorizontal:10,
    width: 42, height: 42, borderRadius: 31,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: {
    color: '#000000', fontSize: 26, fontWeight: '500',
    letterSpacing: -0.5,
  },
  headerText: {
    flex: 1,
  },
  closeBtn: {
    marginTop: 4,
    width: 30, height: 20, borderRadius: 4,
     backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  name: {
    color: '#ffffff', fontSize: 16, fontWeight: '700',
    letterSpacing: -0.2,
  },
  shop: {
    color: '#ACFE3E', fontSize: 13, marginTop: 3,
    fontWeight: '500', letterSpacing: 0.1,
  },
  divider: {
    height: 1, backgroundColor: 'rgba(124,255,0,0.2)', marginBottom: 20,
  },
  menu: {
    flex: 1, gap: 0,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  iconBoxActive: {
    backgroundColor: 'rgba(172,254,62,0.12)',
  },
  menuIcon: {
    width: 20, height: 20, resizeMode: 'contain',
  },
  menuLabel: {
    color: '#ffffff', fontSize: 15, fontWeight: '400',
  },
  logout: {
    color: '#ff6b6b',
  },
  footer: {
    alignItems: 'flex-end', paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  footerText: {
    color: '#ffffff', fontSize: 11, fontWeight: '600', letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 14,
    backgroundColor: '#0B0D0F',
    borderWidth: 1,
    borderColor: 'rgba(172,254,62,0.25)',
    padding: 14,
    maxHeight: '72%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalEmpty: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    marginVertical: 8,
  },
  modalList: {
    marginBottom: 12,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  completedName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  completedMeta: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  completedAmount: {
    color: '#ACFE3E',
    fontSize: 13,
    fontWeight: '700',
  },
  modalCloseBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(172,254,62,0.18)',
  },
  modalCloseText: {
    color: '#E7FFD0',
    fontSize: 13,
    fontWeight: '600',
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  editAccountText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginBottom: 12,
  },
  editInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 12,
  },
  editActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 2,
  },
  editCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  editCancelText: {
    color: '#D8DFE6',
    fontSize: 13,
    fontWeight: '600',
  },
  editSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(172,254,62,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(172,254,62,0.35)',
  },
  editSaveText: {
    color: '#E7FFD0',
    fontSize: 13,
    fontWeight: '700',
  },
});
