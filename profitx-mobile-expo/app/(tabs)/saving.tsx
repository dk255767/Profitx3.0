import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient as _LG } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
  StatusBar,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProfileDrawer from '../../components/ProfileDrawer';
import BottomNavBar from '../../components/BottomNavBar';
import AppHeader from '../../components/AppHeader';
import { apiFetch } from '../../constants/api-client';
import { getUserScopedKey, STORAGE_KEYS } from '../../constants/app-flow';

const LinearGradient = _LG as React.ComponentType<any>;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const YEARS = ['2023', '2024', '2025', '2026'];
const OWNER_NAME = 'Chief';
const SHOP_NAME = 'Your Shop Name';
const COMPLETED_PAYMENTS_KEY = 'completed_payments';

type PaymentRecord = {
  amount: number;
  month: string;
  year: string;
  paidOn: string;
  timestamp: number;
};

type FinanceVendor = {
  id: string;
  name: string;
  loanDate: string;
  loanAmount: number;
  payments: PaymentRecord[];
};

type SavingCardApi = {
  id: string;
  name: string;
  startedOn: string;
  initialAmount: number;
  deposits: PaymentRecord[];
};

const INITIAL_VENDORS: FinanceVendor[] = [];

const toFinanceVendorFromSavingCard = (card: SavingCardApi): FinanceVendor => ({
  id: card.id,
  name: card.name,
  loanDate: card.startedOn,
  loanAmount: card.initialAmount,
  payments: Array.isArray(card.deposits) ? card.deposits : [],
});

const formatCurrency = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

const getVendorTotalPaid = (vendor: FinanceVendor) =>
  vendor.payments.reduce((sum, payment) => sum + payment.amount, 0);

const getVendorTotalSavings = (vendor: FinanceVendor) =>
  vendor.loanAmount + getVendorTotalPaid(vendor);

const parseLoanDateMonthYear = (loanDate: string) => {
  const normalized = loanDate.trim();
  const match = /^([A-Za-z]{3})\s+\d{1,2},\s+(\d{4})$/.exec(normalized);
  if (!match) return null;
  return { monthShort: match[1], year: match[2] };
};

type SavingHistoryRecord = {
  cardId: string;
  cardName: string;
  startedOn: string;
  completedOn: string;
  initialAmount: number;
  payments: PaymentRecord[];
  totalDeposits: number;
  depositCount: number;
  totalSavings: number;
  status: 'completed';
  timestamp: number;
};

export default function SavingScreen() {
  const historyHydratedRef = useRef(false);
  const [vendors, setVendors] = useState<FinanceVendor[]>(INITIAL_VENDORS);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [filterOpen, setFilterOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [shopName, setShopName] = useState(SHOP_NAME);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [paymentVendorId, setPaymentVendorId] = useState<string | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorLoanInput, setNewVendorLoanInput] = useState('');
  const [isAddingSavingCard, setIsAddingSavingCard] = useState(false);
  const [historyVendors, setHistoryVendors] = useState<SavingHistoryRecord[]>([]);
  const [historyStorageKey, setHistoryStorageKey] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryCardId, setSelectedHistoryCardId] = useState<string | null>(null);
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const loadShopName = React.useCallback(async () => {
    try {
      const shopNameKey = await getUserScopedKey(STORAGE_KEYS.shopName);
      const savedShopName = await AsyncStorage.getItem(shopNameKey);
      const nextShopName = savedShopName?.trim();
      if (nextShopName) {
        setShopName(nextShopName);
        return;
      }

      try {
        const resp = await apiFetch('/auth/me');
        if (resp.ok) {
          const body = await resp.json();
          const serverShop = String(body?.shopName ?? '').trim();
          const owner = String(body?.ownerName ?? '').trim();
          if (serverShop) {
            const ownerKey = await getUserScopedKey(STORAGE_KEYS.ownerName);
            await AsyncStorage.multiSet([[shopNameKey, serverShop], [ownerKey, owner]]);
            setShopName(serverShop);
            return;
          }
        }
      } catch {}

      setShopName(SHOP_NAME);
    } catch {
      setShopName(SHOP_NAME);
    }
  }, []);

  useEffect(() => {
    loadShopName();
  }, [loadShopName]);

  useEffect(() => {
    if (!drawerOpen) {
      loadShopName();
    }
  }, [drawerOpen, loadShopName]);

  useFocusEffect(
    React.useCallback(() => {
      loadShopName();
    }, [loadShopName]),
  );

  useEffect(() => {
    let mounted = true;
    getUserScopedKey(COMPLETED_PAYMENTS_KEY)
      .then((storageKey) => {
        if (!mounted) return;
        setHistoryStorageKey(storageKey);
      })
      .catch(() => {
        if (!mounted) return;
        setHistoryStorageKey(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const fetchSavingCards = React.useCallback(() => {
    let mounted = true;
    apiFetch('/saving/cards')
      .then(async (response) => {
        if (!mounted || !response.ok) return;
        const payload = await response.json();
        if (!Array.isArray(payload)) return;

        const nextVendors = payload
          .filter((item): item is SavingCardApi => {
            if (!item || typeof item !== 'object') return false;
            const card = item as Partial<SavingCardApi>;
            return (
              typeof card.id === 'string'
              && typeof card.name === 'string'
              && typeof card.startedOn === 'string'
              && typeof card.initialAmount === 'number'
              && Array.isArray(card.deposits)
            );
          })
          .map(toFinanceVendorFromSavingCard);

        setVendors(nextVendors);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => fetchSavingCards(), [fetchSavingCards]);

  useFocusEffect(
    React.useCallback(() => {
      const cleanup = fetchSavingCards();
      return cleanup;
    }, [fetchSavingCards]),
  );

  useEffect(() => {
    if (!historyStorageKey) {
      historyHydratedRef.current = true;
      return;
    }

    let mounted = true;
    AsyncStorage.getItem(historyStorageKey)
      .then((raw) => {
        if (!mounted || !raw) return;

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;

        const normalized: SavingHistoryRecord[] = parsed
          .map((item): SavingHistoryRecord | null => {
            if (!item || typeof item !== 'object') return null;

            if ('cardId' in item && 'cardName' in item && 'completedOn' in item) {
              const typed = item as Partial<SavingHistoryRecord>;
              const normalizedPayments = Array.isArray(typed.payments)
                ? typed.payments.filter((payment): payment is PaymentRecord => {
                    if (!payment || typeof payment !== 'object') return false;
                    const record = payment as Partial<PaymentRecord>;
                    return (
                      typeof record.amount === 'number'
                      && typeof record.month === 'string'
                      && typeof record.year === 'string'
                      && typeof record.paidOn === 'string'
                      && typeof record.timestamp === 'number'
                    );
                  })
                : [];

              return {
                cardId: String(typed.cardId ?? ''),
                cardName: String(typed.cardName ?? 'Unknown'),
                startedOn: String(typed.startedOn ?? '--'),
                completedOn: String(typed.completedOn ?? '--'),
                initialAmount: Number(typed.initialAmount ?? 0),
                payments: normalizedPayments,
                totalDeposits: Number(typed.totalDeposits ?? 0),
                depositCount: Number(typed.depositCount ?? normalizedPayments.length),
                totalSavings: Number(typed.totalSavings ?? 0),
                status: 'completed',
                timestamp: Number(typed.timestamp ?? Date.now()),
              };
            }

            if ('id' in item && 'name' in item && 'loanDate' in item && Array.isArray((item as { payments?: unknown[] }).payments)) {
              const legacy = item as FinanceVendor;
              const totalDeposits = getVendorTotalPaid(legacy);
              return {
                cardId: legacy.id,
                cardName: legacy.name,
                startedOn: legacy.loanDate,
                completedOn: createDateLabel(),
                initialAmount: legacy.loanAmount,
                payments: legacy.payments,
                totalDeposits,
                depositCount: legacy.payments.length,
                totalSavings: legacy.loanAmount + totalDeposits,
                status: 'completed',
                timestamp: Date.now(),
              };
            }

            return null;
          })
          .filter((record): record is SavingHistoryRecord => Boolean(record));

        setHistoryVendors(normalized.sort((a, b) => b.timestamp - a.timestamp));
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          historyHydratedRef.current = true;
        }
      });

    return () => {
      mounted = false;
    };
  }, [historyStorageKey]);

  useEffect(() => {
    if (!historyHydratedRef.current || !historyStorageKey) return;
    AsyncStorage.setItem(historyStorageKey, JSON.stringify(historyVendors))
      .then(() => {
        try { DeviceEventEmitter.emit('savingHistoryUpdated'); } catch {}
      })
      .catch(() => {});
  }, [historyVendors, historyStorageKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick(Date.now());
    }, 60 * 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  const activePaymentVendor = useMemo(
    () => vendors.find(vendor => vendor.id === paymentVendorId) ?? null,
    [paymentVendorId, vendors],
  );

  const selectedVendor = useMemo(
    () => vendors.find(vendor => vendor.id === selectedVendorId) ?? null,
    [selectedVendorId, vendors],
  );

  const selectedHistoryCard = useMemo(
    () => historyVendors.find(record => record.cardId === selectedHistoryCardId) ?? null,
    [historyVendors, selectedHistoryCardId],
  );

  const currentMonth = useMemo(() => MONTHS[new Date(clockTick).getMonth()], [clockTick]);
  const currentYear = useMemo(() => String(new Date(clockTick).getFullYear()), [clockTick]);
  const activeMonth = selectedMonth ?? currentMonth;
  const activeYear = selectedYear ?? currentYear;

  const monthlyPaidAmount = useMemo(
    () => {
      const activeMonthShort = activeMonth.slice(0, 3);

      return vendors.reduce((sum, vendor) => {
        const monthlyPaid = vendor.payments
          .filter(payment => payment.month === activeMonth && payment.year === activeYear)
          .reduce((acc, payment) => acc + payment.amount, 0);

        const loanDateInfo = parseLoanDateMonthYear(vendor.loanDate);
        const initialAmountForCreatedMonth = loanDateInfo
          && loanDateInfo.monthShort === activeMonthShort
          && loanDateInfo.year === activeYear
          ? vendor.loanAmount
          : 0;

        return sum + monthlyPaid + initialAmountForCreatedMonth;
      }, 0);
    },
    [activeMonth, activeYear, vendors],
  );

  const totalSavingsAmount = useMemo(
    () => vendors
      .filter(v => !historyVendors.some(h => h.cardId === v.id))
      .reduce((sum, vendor) => sum + getVendorTotalSavings(vendor), 0),
    [vendors, historyVendors],
  );

  const paidAmountLabel = useMemo(
    () => `This Month Saved: ${formatCurrency(monthlyPaidAmount)}`,
    [monthlyPaidAmount],
  );

  const createDateLabel = () => {
    const today = new Date();
    const shortMonth = MONTHS[today.getMonth()].slice(0, 3);
    return `${shortMonth} ${today.getDate()}`;
  };

  const createLoanDateLabel = () => {
    const today = new Date();
    const shortMonth = MONTHS[today.getMonth()].slice(0, 3);
    return `${shortMonth} ${today.getDate()}, ${today.getFullYear()}`;
  };

  const handlePayVendor = async () => {
    if (!activePaymentVendor) return;
    const enteredAmount = Number(paymentAmountInput);

    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid saving amount.');
      return;
    }

    let createdDeposit: PaymentRecord;
    try {
      const response = await apiFetch(`/saving/cards/${activePaymentVendor.id}/deposits`, {
        method: 'POST',
        body: JSON.stringify({
          amount: enteredAmount,
          month: activeMonth,
          year: activeYear,
          paidOn: createDateLabel(),
        }),
      });

      if (!response.ok) {
        Alert.alert('Save failed', 'Unable to save deposit to server.');
        return;
      }

      const payload = await response.json();
      createdDeposit = {
        amount: Number(payload?.amount ?? enteredAmount),
        month: String(payload?.month ?? activeMonth),
        year: String(payload?.year ?? activeYear),
        paidOn: String(payload?.paidOn ?? createDateLabel()),
        timestamp: Number(payload?.timestamp ?? Date.now()),
      };
    } catch {
      Alert.alert('Save failed', 'Unable to reach server.');
      return;
    }

    const updatedVendor: FinanceVendor = {
      ...activePaymentVendor,
      payments: [...activePaymentVendor.payments, createdDeposit],
    };

    setVendors(prev => prev.map(v => v.id === activePaymentVendor.id ? updatedVendor : v));

    setPaymentAmountInput('');
    setPaymentVendorId(null);
  };

  const handleAddVendor = async () => {
    if (isAddingSavingCard) return;

    const vendorName = newVendorName.trim();
    const loanAmount = Number(newVendorLoanInput);

    if (!vendorName) {
      Alert.alert('Fund organizer required', 'Enter a fund organizer name.');
      return;
    }
    if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
      Alert.alert('Invalid initial amount', 'Enter a valid initial amount.');
      return;
    }

    setIsAddingSavingCard(true);

    try {
      const response = await apiFetch('/saving/cards', {
        method: 'POST',
        body: JSON.stringify({
          name: vendorName,
          startedOn: createLoanDateLabel(),
          initialAmount: loanAmount,
        }),
      });

      if (!response.ok) {
        let detail = `Status ${response.status}`;
        try {
          const payload = await response.json();
          const message = typeof payload?.message === 'string' ? payload.message : null;
          const backendDetail = typeof payload?.detail === 'string' ? payload.detail : null;
          detail = [message, backendDetail].filter(Boolean).join('\n') || detail;
        } catch {
          // Ignore invalid/non-JSON response body.
        }

        if (response.status === 401) {
          Alert.alert('Add failed', `Session expired. Please login again.\n${detail}`);
          return;
        }

        Alert.alert('Add failed', `Unable to create card on server.\n${detail}`);
        return;
      }

      const payload = await response.json();
      if (!payload || typeof payload !== 'object') {
        Alert.alert('Add failed', 'Server returned invalid card data.');
        return;
      }

      const card = payload as SavingCardApi;
      if (
        typeof card.id !== 'string'
        || typeof card.name !== 'string'
        || typeof card.startedOn !== 'string'
        || typeof card.initialAmount !== 'number'
        || !Array.isArray(card.deposits)
      ) {
        Alert.alert('Add failed', 'Server returned invalid card data.');
        return;
      }

      setVendors(prev => [toFinanceVendorFromSavingCard(card), ...prev]);
    } catch {
      Alert.alert('Add failed', 'Unable to reach server.');
      return;
    } finally {
      setIsAddingSavingCard(false);
    }

    setNewVendorName('');
    setNewVendorLoanInput('');
    setAddVendorOpen(false);
  };

  const handleDeleteVendor = (vendorId: string) => {
    Alert.alert(
      'Remove Fund Organizer',
      'Are you sure you want to remove this fund organizer and all savings records?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setVendors(prev => prev.filter(v => v.id !== vendorId));
            setHistoryVendors(prev => prev.filter(v => v.cardId !== vendorId));
            setSelectedVendorId(null);
          },
        },
      ],
    );
  };

  const handleDeletePaymentHistory = (vendorId: string, payment: PaymentRecord) => {
    Alert.alert(
      'Delete Saving Entry',
      'Do you want to delete this savings history entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setVendors(prev => prev.map(vendor => {
              if (vendor.id !== vendorId) return vendor;

              return {
                ...vendor,
                payments: vendor.payments.filter(item => !(
                  item.timestamp === payment.timestamp
                  && item.amount === payment.amount
                  && item.month === payment.month
                  && item.year === payment.year
                  && item.paidOn === payment.paidOn
                )),
              };
            }));
          },
        },
      ],
    );
  };

  const handleCompleteVendor = (vendorId: string) => {
    const vendorToComplete = vendors.find(v => v.id === vendorId);
    if (!vendorToComplete) {
      setSelectedVendorId(null);
      return;
    }

    const totalDeposits = getVendorTotalPaid(vendorToComplete);
    const completedRecord: SavingHistoryRecord = {
      cardId: vendorToComplete.id,
      cardName: vendorToComplete.name,
      startedOn: vendorToComplete.loanDate,
      completedOn: createDateLabel(),
      initialAmount: vendorToComplete.loanAmount,
      payments: [...vendorToComplete.payments],
      totalDeposits,
      depositCount: vendorToComplete.payments.length,
      totalSavings: vendorToComplete.loanAmount + totalDeposits,
      status: 'completed',
      timestamp: Date.now(),
    };

    setVendors(prev => prev.filter(v => v.id !== vendorId));
    setHistoryVendors(prev => {
      const withoutExisting = prev.filter(v => v.cardId !== vendorId);
      return [completedRecord, ...withoutExisting];
    });
    setSelectedVendorId(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={['#374553', '#151A20', '#080A0D']}
        locations={[0, 0.34, 1]}
        start={[0, 0]}
        end={[0, 1]}
        style={styles.bgGradient}
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <AppHeader
          greeting={greeting}
          ownerName={OWNER_NAME}
          shopName={shopName}
          onOpenProfile={() => setDrawerOpen(true)}
        />

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <Image
              source={require('../../assets/images/dashboardbanner.png')}
              style={styles.summaryBannerImage}
              resizeMode="cover"
            />
            <View style={styles.summaryBannerOverlay} />

            <View style={styles.summaryTopRow}>
              <View style={styles.bannerFilters}>
                <Text style={styles.filterInlineLabel}>Month:</Text>
                <TouchableOpacity style={styles.filterMiniBox} onPress={() => setFilterOpen(true)}>
                  <Text style={styles.filterMiniValue}>{activeMonth.slice(0, 3)}</Text>
                </TouchableOpacity>
                <Text style={styles.filterInlineLabel}>Year:</Text>
                <TouchableOpacity style={[styles.filterMiniBox, styles.filterMiniBoxYear]} onPress={() => setFilterOpen(true)}>
                  <Text style={styles.filterMiniValue}>{activeYear}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => setFilterOpen(true)}
                >
                  <LinearGradient
                    colors={['#3F8105', '#ACFE3E']}
                    start={[0, 0]}
                    end={[1, 0]}
                    style={styles.filterBtn}
                  >
                    <Ionicons name="filter" size={10} color="#F4F8EF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.summaryTitleWrap}>
              <Text style={styles.summaryTitle} numberOfLines={1}>Saving overall Dashboard</Text>
              <Text style={styles.summaryPaid} numberOfLines={1}>{paidAmountLabel}</Text>
            </View>

            <View style={styles.summaryBottomRow}>
              <View style={styles.remainingCard}>
                <Text style={styles.remainingLabel}>Active Savings</Text>
                <Text style={styles.remainingAmount}>{formatCurrency(totalSavingsAmount)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.vendorHeaderRow}>
            <Text style={styles.vendorSectionTitle}>Fund Organizers</Text>
            <View style={styles.vendorHeaderActions}>
              <TouchableOpacity
                style={styles.newVendorBtn}
                activeOpacity={0.86}
                onPress={() => setAddVendorOpen(true)}
              >
                <Text style={styles.newVendorText}>Add Fund Organizer +</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.historyIconBtn}
                activeOpacity={0.8}
                onPress={() => setHistoryOpen(true)}
              >
                <Ionicons name="time-outline" size={14} color="#ACFE3E" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.vendorListWrap}>
            {vendors
              .filter(v => !historyVendors.some(h => h.cardId === v.id))
              .map((vendor, index) => {
              const latestPayment = [...vendor.payments]
                .sort((a, b) => b.timestamp - a.timestamp)[0];
              const latestSavingAmount = latestPayment?.amount ?? vendor.loanAmount;
              const totalSavedAmount = getVendorTotalSavings(vendor);

              return (
                <TouchableOpacity
                  key={`saving-vendor-${vendor.id}-${index}`}
                  style={styles.vendorCard}
                  activeOpacity={0.9}
                  onPress={() => setSelectedVendorId(vendor.id)}
                >
                  <View style={styles.vendorAvatar}>
                    <Text style={styles.vendorAvatarText}>{vendor.name.charAt(0)}</Text>
                  </View>

                  <View style={styles.vendorMeta}>
                    <View style={styles.vendorRow}>
                      <Text style={styles.vendorName} numberOfLines={1}>{vendor.name}</Text>
                      <Text style={styles.vendorAmount}>{formatCurrency(latestSavingAmount)}</Text>
                    </View>
                    <View style={styles.vendorRow}>
                      <Text style={styles.vendorLastPaid}>
                        Last Saved: {latestPayment ? latestPayment.paidOn : '--'}
                      </Text>
                      <View style={styles.vendorPendingRow}>
                        <Text style={styles.vendorPending}>Your Savings {formatCurrency(totalSavedAmount)}</Text>
                        <TouchableOpacity
                          style={styles.payButton}
                          onPress={() => {
                            setPaymentVendorId(vendor.id);
                            setPaymentAmountInput('');
                          }}
                          activeOpacity={0.86}
                        >
                          <Text style={styles.payButtonText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </LinearGradient>

      <Modal
        transparent
        visible={Boolean(selectedVendor)}
        animationType="fade"
        onRequestClose={() => setSelectedVendorId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedVendorId(null)}>
          <Pressable style={styles.filterModal} onPress={() => {}}>
            <Text style={styles.filterTitle}>Saving Details</Text>

            <Text style={styles.detailName}>{selectedVendor?.name}</Text>
            <Text style={styles.detailMeta}>Started On: {selectedVendor?.loanDate}</Text>
            <Text style={styles.detailMeta}>Initial Amount: {selectedVendor ? formatCurrency(selectedVendor.loanAmount) : '--'}</Text>
            <Text style={styles.detailMeta}>Your Savings: {selectedVendor ? formatCurrency(getVendorTotalSavings(selectedVendor)) : '--'}</Text>

            <Text style={styles.historyTitle}>Savings History</Text>
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {selectedVendor ? (
                <>
                  <View style={styles.historyRow}>
                    <Text style={styles.historyDate}>Initial Amount ({selectedVendor.loanDate})</Text>
                    <Text style={styles.historyAmount}>{formatCurrency(selectedVendor.loanAmount)}</Text>
                  </View>

                  {[...selectedVendor.payments]
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((payment, index) => (
                      <View key={`${payment.timestamp}-${index}`} style={styles.historyRow}>
                        <Text style={styles.historyDate}>{payment.paidOn} ({payment.month} {payment.year})</Text>
                        <View style={styles.historyActions}>
                          <Text style={styles.historyAmount}>{formatCurrency(payment.amount)}</Text>
                          <TouchableOpacity
                            style={styles.historyDeleteBtn}
                            onPress={() => selectedVendor && handleDeletePaymentHistory(selectedVendor.id, payment)}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="trash-outline" size={13} color="#FF7B7B" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                </>
              ) : (
                <Text style={styles.historyEmpty}>No savings records yet.</Text>
              )}
            </ScrollView>

            <View style={styles.detailFooter}>
              <TouchableOpacity
                style={styles.completeVendorBtn}
                onPress={() => selectedVendor && handleCompleteVendor(selectedVendor.id)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle-outline" size={14} color="#A9FF4A" />
                <Text style={styles.completeVendorBtnText}>Complete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteVendorBtn} onPress={() => selectedVendor && handleDeleteVendor(selectedVendor.id)} activeOpacity={0.8}>
                <Ionicons name="trash-outline" size={14} color="#FF7B7B" />
                <Text style={styles.deleteVendorBtnText}>Delete Saving</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={() => setSelectedVendorId(null)}>
                <Text style={styles.applyBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={Boolean(activePaymentVendor)}
        animationType="fade"
        onRequestClose={() => setPaymentVendorId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPaymentVendorId(null)}>
          <Pressable style={styles.filterModal} onPress={() => {}}>
            <Text style={styles.filterTitle}>Update Savings</Text>
            <Text style={styles.paymentContext}>{activePaymentVendor?.name}</Text>
            <Text style={styles.paymentSubtext}>Save for {activeMonth} {activeYear}</Text>

            <TextInput
              value={paymentAmountInput}
              onChangeText={setPaymentAmountInput}
              keyboardType="numeric"
              placeholder="Enter saving amount"
              placeholderTextColor="#6f7984"
              style={styles.amountInput}
            />

            <View style={styles.paymentActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setPaymentVendorId(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyBtn}
                onPress={handlePayVendor}
                activeOpacity={0.88}
              >
                <Text style={styles.applyBtnText}>Save Amount</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={filterOpen}
        animationType="fade"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setFilterOpen(false)}>
          <Pressable style={styles.filterModal} onPress={() => {}}>
            <Text style={styles.filterTitle}>Filter Saving Data</Text>

            <Text style={styles.filterGroupLabel}>Month</Text>
            <View style={styles.chipsWrap}>
              {MONTHS.map((month) => {
                const isActive = activeMonth === month;
                return (
                  <TouchableOpacity
                    key={month}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => setSelectedMonth(month)}
                    activeOpacity={0.86}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{month}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.filterGroupLabel}>Year</Text>
            <View style={styles.yearRow}>
              {YEARS.map((year) => {
                const isActive = activeYear === year;
                return (
                  <TouchableOpacity
                    key={year}
                    style={[styles.yearPill, isActive && styles.yearPillActive]}
                    onPress={() => setSelectedYear(year)}
                    activeOpacity={0.86}
                  >
                    <Text style={[styles.yearPillText, isActive && styles.yearPillTextActive]}>{year}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.applyBtn}
              activeOpacity={0.88}
              onPress={() => setFilterOpen(false)}
            >
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={addVendorOpen}
        animationType="fade"
        onRequestClose={() => {
          if (!isAddingSavingCard) setAddVendorOpen(false);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (!isAddingSavingCard) setAddVendorOpen(false);
          }}
        >
          <Pressable style={styles.filterModal} onPress={() => {}}>
            <Text style={styles.filterTitle}>Add Fund Organizer</Text>

            <TextInput
              value={newVendorName}
              onChangeText={setNewVendorName}
              placeholder="Fund Organizer"
              placeholderTextColor="#6f7984"
              style={styles.amountInput}
            />

            <TextInput
              value={newVendorLoanInput}
              onChangeText={setNewVendorLoanInput}
              keyboardType="numeric"
              placeholder="Initial Amount"
              placeholderTextColor="#6f7984"
              style={styles.amountInput}
            />

            <View style={styles.paymentActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAddVendorOpen(false)}
                disabled={isAddingSavingCard}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyBtn}
                onPress={handleAddVendor}
                activeOpacity={0.88}
                disabled={isAddingSavingCard}
              >
                {isAddingSavingCard ? (
                  <View style={styles.actionLoadingRow}>
                    <ActivityIndicator size="small" color="#0B1204" />
                    <Text style={styles.applyBtnText}>Adding...</Text>
                  </View>
                ) : (
                  <Text style={styles.applyBtnText}>Add Saving</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={historyOpen}
        animationType="fade"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setHistoryOpen(false)}>
          <Pressable style={styles.filterModal} onPress={() => {}}>
            <View style={styles.historyModalHeader}>
              <Ionicons name="time-outline" size={18} color="#ACFE3E" style={{ marginRight: 8 }} />
              <Text style={styles.historyHeaderTitle}>Saving History</Text>
            </View>

            {historyVendors.length === 0 ? (
              <Text style={styles.historyEmpty}>No completed savings yet.</Text>
            ) : (
              <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                {historyVendors.map((record) => (
                  <TouchableOpacity
                    key={`${record.cardId}-${record.timestamp}`}
                    style={styles.completedVendorCard}
                    activeOpacity={0.86}
                    onPress={() => setSelectedHistoryCardId(record.cardId)}
                  >
                    <View style={styles.completedVendorRow}>
                      <View style={styles.vendorAvatar}>
                        <Text style={styles.vendorAvatarText}>{record.cardName.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.vendorName}>{record.cardName}</Text>
                        <Text style={styles.vendorLastPaid}>
                          Started: {record.startedOn}
                        </Text>
                        <Text style={styles.vendorLastPaid}>
                          Completed: {record.completedOn} | Deposits: {record.depositCount}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.completedAmountText}>{formatCurrency(record.totalSavings)}</Text>
                        <View style={styles.completedBadge}>
                          <Text style={styles.completedBadgeText}>Completed</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.applyBtn} onPress={() => setHistoryOpen(false)}>
              <Text style={styles.applyBtnText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={Boolean(selectedHistoryCard)}
        animationType="fade"
        onRequestClose={() => setSelectedHistoryCardId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedHistoryCardId(null)}>
          <Pressable style={styles.filterModal} onPress={() => {}}>
            <Text style={styles.filterTitle}>Completed Saving Details</Text>

            <Text style={styles.detailName}>{selectedHistoryCard?.cardName}</Text>
            <Text style={styles.detailMeta}>Card ID: {selectedHistoryCard?.cardId}</Text>
            <Text style={styles.detailMeta}>Started On: {selectedHistoryCard?.startedOn}</Text>
            <Text style={styles.detailMeta}>Completed On: {selectedHistoryCard?.completedOn}</Text>
            <Text style={styles.detailMeta}>Initial Amount: {selectedHistoryCard ? formatCurrency(selectedHistoryCard.initialAmount) : '--'}</Text>
            <Text style={styles.detailMeta}>Total Deposits: {selectedHistoryCard ? formatCurrency(selectedHistoryCard.totalDeposits) : '--'}</Text>
           <Text style={[styles.detailMeta, { color: '#34C759' }]}>
  Total Savings: {selectedHistoryCard ? formatCurrency(selectedHistoryCard.totalSavings) : '--'}
</Text>
            <Text style={styles.historyTitle}>All Saving Entries</Text>
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {selectedHistoryCard && selectedHistoryCard.payments.length > 0 ? (
                [...selectedHistoryCard.payments]
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((payment, index) => (
                    <View key={`${payment.timestamp}-${index}`} style={styles.historyRow}>
                      <Text style={styles.historyDate}>{payment.paidOn} ({payment.month} {payment.year})</Text>
                      <Text style={styles.historyAmount}>{formatCurrency(payment.amount)}</Text>
                    </View>
                  ))
              ) : (
                <Text style={styles.historyEmpty}>No additional saving entries.</Text>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.applyBtn} onPress={() => setSelectedHistoryCardId(null)}>
              <Text style={styles.applyBtnText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ProfileDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#07090B',
  },
  bgGradient: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 132,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 44 : 10,
    paddingBottom: 10,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
    marginTop: 6,
  },
  headerGreeting: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubText: {
    color: '#ACFE3E',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 0,
  },
  profileBtn: {
    padding: 4,
    marginTop: 8,
  },
  profileImg: {
    width: 26,
    height: 26,
    borderRadius: 4,
  },

  summaryCard: {
    height: 200,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    marginTop:8,
    backgroundColor: '#020405',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: 'hidden',
  },
  summaryBannerImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 15,
    left: 0,
  },
  summaryBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,4,5,0.42)',
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  summaryTitleWrap: {
    width: '100%',
    marginTop: 4,
  },
  summaryTitle: {
    color: '#F3F5F7',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 15,
    letterSpacing: 0.1,
  },
  summaryPaid: {
    marginTop: 4,
    color: '#A9FF4A',
    fontSize: 13,
    fontWeight: '500',
  },
  bannerFilters: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterInlineLabel: {
    color: '#E6EAEE',
    fontSize: 8,
    marginRight: 4,
  },
  filterMiniBox: {
    minWidth: 26,
    height: 14,
    borderRadius: 10,
    backgroundColor: '#E8EAEC',
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    paddingHorizontal: 2,
  },
  filterMiniBoxYear: {
    minWidth: 30,
  },
  filterMiniValue: {
    color: '#333',
    fontSize: 8,
    fontWeight: '400',
  },
  filterBtn: {
    width: 14,
    height: 14,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMutedLabel: {
    color: '#A7ADB4',
    fontSize: 12,
    fontWeight: '500',
  },
  cardTopAmount: {
    marginTop: 4,
    color: '#F8FBFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardPeriod: {
    color: '#B3FF53',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(172,254,62,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(172,254,62,0.26)',
  },

  graphWrap: {
    height: 72,
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 2,
    paddingVertical: 2,
    opacity: 0.32,
  },
  summaryBottomRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  remainingCard: {
    minWidth: 166,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'flex-end',
  },
  remainingLabel: {
    color: '#95E84B',
    fontSize: 11,
    fontWeight: '500',
  },
  remainingAmount: {
    marginTop: 0,
    marginBottom: 10,
    color: '#F3F6FA',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  vendorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  vendorSectionTitle: {
    color: '#EFF3F7',
    fontSize: 19,
    fontWeight: '700',
  },
  vendorHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(172,254,62,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(172,254,62,0.35)',
  },
  newVendorBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#8DE22A',
    shadowColor: '#8DE22A',
    shadowOpacity: 0.35,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  newVendorText: {
    color: '#0B1205',
    fontSize: 10,
    fontWeight: '700',
  },
  historyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  completedVendorCard: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 10,
  },
  completedVendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completedAmountText: {
    color: '#ACFE3E',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  completedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(172,254,62,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(172,254,62,0.35)',
  },
  completedBadgeText: {
    color: '#ACFE3E',
    fontSize: 10,
    fontWeight: '700',
  },

  vendorListWrap: {
    gap: 6,
  },
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(1,3,5,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 7,
  },
  vendorAvatar: {
    marginTop: 4,
    width: 31,
    height: 31,
    borderRadius: 15.5,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(172,254,62,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(172,254,62,0.36)',
  },
  vendorAvatarText: {
    color: '#BCFF69',
    fontWeight: '700',
    fontSize: 14,
  },
  vendorMeta: {
    flex: 1,
  },
  vendorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  vendorName: {
    color: '#ACFE3E',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  vendorLastPaid: {
    color: '#929AA3',
    fontSize: 11,
    flex: 1,
  },
  vendorPendingRow: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  vendorAmount: {
    color: '#ACFE3E',
    fontSize: 15,
    fontWeight: '700',
  },
  vendorPending: {
    color: '#8D949C',
    fontSize: 11,
  },
  payButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(172,254,62,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(172,254,62,0.4)',
  },
  payButtonText: {
    color: '#D9FF9E',
    fontSize: 10,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.56)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  filterModal: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#12171D',
    borderWidth: 1,
    borderColor: 'rgba(172,254,62,0.25)',
  },
  filterTitle: {
    color: '#F4F7FB',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  historyHeaderTitle: {
    color: '#F4F7FB',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  detailName: {
    color: '#F4F7FB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  detailMeta: {
    color: '#C9D0D8',
    fontSize: 13,
    marginBottom: 4,
  },
  historyTitle: {
    color: '#DFFFAB',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 8,
  },
  historyList: {
    maxHeight: 210,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 8,
  },
  historyDate: {
    color: '#AFB6BE',
    fontSize: 12,
    flex: 1,
    paddingRight: 10,
  },
  historyAmount: {
    color: '#B6FF4E',
    fontSize: 12,
    fontWeight: '700',
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyDeleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 123, 123, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 123, 123, 0.28)',
  },
  historyEmpty: {
    color: '#8D949C',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  paymentContext: {
    color: '#F4F7FB',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  paymentSubtext: {
    color: '#9AA2AA',
    fontSize: 12,
    marginBottom: 10,
  },
  amountInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    color: '#F4F7FB',
    marginBottom: 10,
  },
  paymentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cancelBtnText: {
    color: '#D7DDE4',
    fontSize: 13,
    fontWeight: '600',
  },
  filterGroupLabel: {
    color: '#C7CDD4',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 2,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: {
    borderColor: 'rgba(172,254,62,0.8)',
    backgroundColor: 'rgba(172,254,62,0.16)',
  },
  chipText: {
    color: '#A9B0B8',
    fontSize: 12,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#D4FF9A',
  },
  yearRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  yearPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  yearPillActive: {
    borderColor: 'rgba(172,254,62,0.8)',
    backgroundColor: 'rgba(172,254,62,0.18)',
  },
  yearPillText: {
    color: '#A9B0B8',
    fontSize: 12,
    fontWeight: '600',
  },
  yearPillTextActive: {
    color: '#D4FF9A',
  },
  detailFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  completeVendorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(169,255,74,0.35)',
    backgroundColor: 'rgba(169,255,74,0.1)',
  },
  completeVendorBtnText: {
    color: '#A9FF4A',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteVendorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,123,123,0.35)',
    backgroundColor: 'rgba(255,123,123,0.1)',
  },
  deleteVendorBtnText: {
    color: '#FF7B7B',
    fontSize: 13,
    fontWeight: '600',
  },
  applyBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 11,
    marginBottom: 1,
    backgroundColor: '#ACFE3E',
  },
  applyBtnText: {
    color: '#0B1204',
    fontSize: 13,
    fontWeight: '700',
  },
  actionLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
