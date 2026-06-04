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
} from 'react-native';
import { DeviceEventEmitter } from 'react-native';
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
const FINANCE_COMPLETED_PAYMENTS_KEY = 'finance_completed_payments_v1';

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

const isPaymentRecord = (value: unknown): value is PaymentRecord => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<PaymentRecord>;
  return (
    typeof item.amount === 'number'
    && typeof item.month === 'string'
    && typeof item.year === 'string'
    && typeof item.paidOn === 'string'
    && typeof item.timestamp === 'number'
  );
};

const toFinanceVendor = (value: unknown): FinanceVendor | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<FinanceVendor>;
  if (
    typeof item.id !== 'string'
    || typeof item.name !== 'string'
    || typeof item.loanDate !== 'string'
    || typeof item.loanAmount !== 'number'
    || !Array.isArray(item.payments)
  ) {
    return null;
  }

  const normalizedPayments = item.payments.filter(isPaymentRecord);
  return {
    id: item.id,
    name: item.name,
    loanDate: item.loanDate,
    loanAmount: item.loanAmount,
    payments: normalizedPayments,
  };
};

const normalizeHistoryVendors = (value: unknown): FinanceVendor[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(toFinanceVendor)
    .filter((vendor): vendor is FinanceVendor => vendor !== null);
};

const INITIAL_VENDORS: FinanceVendor[] = [];

const formatCurrency = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

const getVendorTotalPaid = (vendor: FinanceVendor) =>
  vendor.payments.reduce((sum, payment) => sum + payment.amount, 0);

const getVendorRemaining = (vendor: FinanceVendor) =>
  Math.max(vendor.loanAmount - getVendorTotalPaid(vendor), 0);

const getVendorCompletedOn = (vendor: FinanceVendor) => {
  const latestPayment = [...vendor.payments].sort((a, b) => b.timestamp - a.timestamp)[0];
  return latestPayment?.paidOn ?? '--';
};

export default function FinanceScreen() {
  const historyHydratedRef = useRef(false);
  const [vendors, setVendors] = useState<FinanceVendor[]>(INITIAL_VENDORS);
  const [selectedMonth, setSelectedMonth] = useState('March');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [filterOpen, setFilterOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [shopName, setShopName] = useState(SHOP_NAME);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [paymentVendorId, setPaymentVendorId] = useState<string | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorLoanInput, setNewVendorLoanInput] = useState('');
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [historyVendors, setHistoryVendors] = useState<FinanceVendor[]>([]);
  const [historyStorageKey, setHistoryStorageKey] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
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
    getUserScopedKey(FINANCE_COMPLETED_PAYMENTS_KEY)
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

  const fetchVendors = React.useCallback(() => {
    let mounted = true;
    apiFetch('/finance/vendors')
      .then(async (response) => {
        if (!mounted || !response.ok) return;
        const payload = await response.json();
        if (!Array.isArray(payload)) return;
        setVendors(normalizeHistoryVendors(payload));
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => fetchVendors(), [fetchVendors]);

  useFocusEffect(
    React.useCallback(() => {
      const cleanup = fetchVendors();
      return cleanup;
    }, [fetchVendors]),
  );

  useEffect(() => {
    if (!historyStorageKey) {
      historyHydratedRef.current = true;
      return;
    }

    let mounted = true;
    AsyncStorage.getItem(historyStorageKey)
      .then((rawFinanceHistory) => {
        if (!mounted) return;

        if (rawFinanceHistory) {
          const parsed = JSON.parse(rawFinanceHistory);
          setHistoryVendors(normalizeHistoryVendors(parsed));
        }
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
        try {
          DeviceEventEmitter.emit('financeHistoryUpdated');
        } catch {}
      })
      .catch(() => {});
  }, [historyVendors, historyStorageKey]);

  const activePaymentVendor = useMemo(
    () => vendors.find(vendor => vendor.id === paymentVendorId) ?? null,
    [paymentVendorId, vendors],
  );

  const selectedVendor = useMemo(
    () => [...vendors, ...historyVendors].find(vendor => vendor.id === selectedVendorId) ?? null,
    [selectedVendorId, vendors, historyVendors],
  );

  const selectedVendorIsCompleted = useMemo(
    () => historyVendors.some(vendor => vendor.id === selectedVendorId),
    [historyVendors, selectedVendorId],
  );

  const monthlyPaidAmount = useMemo(
    () => vendors.reduce((sum, vendor) => {
      const monthlyPaid = vendor.payments
        .filter(payment => payment.month === selectedMonth && payment.year === selectedYear)
        .reduce((acc, payment) => acc + payment.amount, 0);
      return sum + monthlyPaid;
    }, 0),
    [selectedMonth, selectedYear, vendors],
  );

  const remainingAmount = useMemo(
    () => vendors.reduce((sum, vendor) => sum + getVendorRemaining(vendor), 0),
    [vendors],
  );

  const paidAmountLabel = useMemo(
    () => `This Month Paid: ${formatCurrency(monthlyPaidAmount)}`,
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
      Alert.alert('Invalid amount', 'Enter a valid payment amount.');
      return;
    }

    const vendorRemaining = getVendorRemaining(activePaymentVendor);
    if (vendorRemaining <= 0) {
      Alert.alert('Already settled', 'This vendor has no remaining amount.');
      return;
    }

    const appliedAmount = Math.min(enteredAmount, vendorRemaining);
    let createdPayment: PaymentRecord;
    try {
      const response = await apiFetch(`/finance/vendors/${activePaymentVendor.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: appliedAmount,
          month: selectedMonth,
          year: selectedYear,
          paidOn: createDateLabel(),
        }),
      });

      if (!response.ok) {
        Alert.alert('Payment failed', 'Unable to save payment to server.');
        return;
      }

      const payload = await response.json();
      createdPayment = {
        amount: Number(payload?.amount ?? appliedAmount),
        month: String(payload?.month ?? selectedMonth),
        year: String(payload?.year ?? selectedYear),
        paidOn: String(payload?.paidOn ?? createDateLabel()),
        timestamp: Number(payload?.timestamp ?? Date.now()),
      };
    } catch {
      Alert.alert('Payment failed', 'Unable to reach server.');
      return;
    }

    const updatedVendor: FinanceVendor = {
      ...activePaymentVendor,
      payments: [...activePaymentVendor.payments, createdPayment],
    };

    const newRemaining = getVendorRemaining(updatedVendor);

    if (newRemaining === 0) {
      setVendors(prev => prev.filter(v => v.id !== activePaymentVendor.id));
      setHistoryVendors(prev => [updatedVendor, ...prev]);
    } else {
      setVendors(prev => prev.map(v => v.id === activePaymentVendor.id ? updatedVendor : v));
    }

    setPaymentAmountInput('');
    setPaymentVendorId(null);
  };

  const handleAddVendor = async () => {
    if (isAddingVendor) return;

    const vendorName = newVendorName.trim();
    const loanAmount = Number(newVendorLoanInput);

    if (!vendorName) {
      Alert.alert('Vendor name required', 'Enter a vendor name.');
      return;
    }
    if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
      Alert.alert('Invalid loan amount', 'Enter a valid loan amount.');
      return;
    }

    setIsAddingVendor(true);

    try {
      const response = await apiFetch('/finance/vendors', {
        method: 'POST',
        body: JSON.stringify({
          name: vendorName,
          loanDate: createLoanDateLabel(),
          loanAmount,
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

        Alert.alert('Add failed', `Unable to create vendor on server.\n${detail}`);
        return;
      }

      const payload = await response.json();
      const createdVendor = toFinanceVendor(payload);
      if (!createdVendor) {
        Alert.alert('Add failed', 'Server returned invalid vendor data.');
        return;
      }

      setVendors(prev => [createdVendor, ...prev]);
    } catch {
      Alert.alert('Add failed', 'Unable to reach server.');
      return;
    } finally {
      setIsAddingVendor(false);
    }

    setNewVendorName('');
    setNewVendorLoanInput('');
    setAddVendorOpen(false);
  };

  const handleDeleteVendor = (vendorId: string) => {
    Alert.alert(
      'Delete Vendor',
      'Are you sure you want to delete this vendor and all their payment records?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setVendors(prev => prev.filter(v => v.id !== vendorId));
            setHistoryVendors(prev => prev.filter(v => v.id !== vendorId));
            setSelectedVendorId(null);
          },
        },
      ],
    );
  };

  const handleDeletePaymentHistory = (vendorId: string, payment: PaymentRecord) => {
    Alert.alert(
      'Delete Transaction',
      'Do you want to delete this payment history entry?',
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

    setVendors(prev => prev.filter(v => v.id !== vendorId));
    setHistoryVendors(prev => {
      const withoutExisting = prev.filter(v => v.id !== vendorId);
      return [vendorToComplete, ...withoutExisting];
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
                  <Text style={styles.filterMiniValue}>{selectedMonth.slice(0, 3)}</Text>
                </TouchableOpacity>
                <Text style={styles.filterInlineLabel}>Year:</Text>
                <TouchableOpacity style={[styles.filterMiniBox, styles.filterMiniBoxYear]} onPress={() => setFilterOpen(true)}>
                  <Text style={styles.filterMiniValue}>{selectedYear}</Text>
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
              <Text style={styles.summaryTitle} numberOfLines={1}>Finance overall Dashboard</Text>
              <Text style={styles.summaryPaid} numberOfLines={1}>{paidAmountLabel}</Text>
            </View>

            <View style={styles.summaryBottomRow}>
              <View style={styles.remainingCard}>
                <Text style={styles.remainingLabel}>Remaining Amount</Text>
                <Text style={styles.remainingAmount}>{formatCurrency(remainingAmount)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.vendorHeaderRow}>
            <Text style={styles.vendorSectionTitle}>Finance Vendor</Text>
            <View style={styles.vendorHeaderActions}>
              <TouchableOpacity
                style={styles.newVendorBtn}
                activeOpacity={0.86}
                onPress={() => setAddVendorOpen(true)}
              >
                <Text style={styles.newVendorText}>New Vendor +</Text>
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
            {vendors.filter(v => getVendorRemaining(v) > 0).map((vendor, index) => {
              const paidInSelectedPeriod = vendor.payments
                .filter(payment => payment.month === selectedMonth && payment.year === selectedYear)
                .reduce((sum, payment) => sum + payment.amount, 0);

              const latestPayment = vendor.payments
                .filter(payment => payment.month === selectedMonth && payment.year === selectedYear)
                .sort((a, b) => b.timestamp - a.timestamp)[0];

              return (
                <TouchableOpacity
                  key={`finance-vendor-${vendor.id}-${index}`}
                  style={styles.vendorCard}
                  activeOpacity={0.9}
                  onPress={() => setSelectedVendorId(vendor.id)}
                >
                  <View style={styles.vendorAvatar}>
                    <Text style={styles.vendorAvatarText}>{(vendor.name || '?').charAt(0)}</Text>
                  </View>

                  <View style={styles.vendorMeta}>
                    <View style={styles.vendorRow}>
                      <Text style={styles.vendorName} numberOfLines={1}>{vendor.name}</Text>
                      <Text style={styles.vendorAmount}>{formatCurrency(paidInSelectedPeriod)}</Text>
                    </View>
                    <View style={styles.vendorRow}>
                      <Text style={styles.vendorLastPaid}>
                        Last Paid: {latestPayment ? latestPayment.paidOn : '--'}
                      </Text>
                      <View style={styles.vendorPendingRow}>
                        <Text style={styles.vendorPending}>Pending {formatCurrency(getVendorRemaining(vendor))}</Text>
                        <TouchableOpacity
                          style={styles.payButton}
                          onPress={() => {
                            setPaymentVendorId(vendor.id);
                            setPaymentAmountInput('');
                          }}
                          activeOpacity={0.86}
                        >
                          <Text style={styles.payButtonText}>Update</Text>
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
            <Text style={styles.filterTitle}>Vendor Details</Text>

            <Text style={styles.detailName}>{selectedVendor?.name}</Text>
            <Text style={styles.detailMeta}>Initial Date: {selectedVendor?.loanDate}</Text>
            <Text style={styles.detailMeta}>Total Amount: {selectedVendor ? formatCurrency(selectedVendor.loanAmount) : '--'}</Text>
            {selectedVendorIsCompleted ? (
              <Text style={styles.detailMeta}>Complete Date: {selectedVendor ? getVendorCompletedOn(selectedVendor) : '--'}</Text>
            ) : null}
            <Text style={styles.detailMeta}>Total Paid: {selectedVendor ? formatCurrency(getVendorTotalPaid(selectedVendor)) : '--'}</Text>
            <Text style={styles.detailMeta}>Remaining: {selectedVendor ? formatCurrency(getVendorRemaining(selectedVendor)) : '--'}</Text>

            <Text style={styles.historyTitle}>Saving History</Text>
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {selectedVendor && selectedVendor.payments.length > 0 ? (
                [...selectedVendor.payments]
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((payment, index) => (
                    <View key={`${payment.timestamp}-${index}`} style={styles.historyRow}>
                      <Text style={styles.historyDate}>{payment.paidOn} ({payment.month} {payment.year})</Text>
                      <View style={styles.historyActions}>
                        <Text style={styles.historyAmount}>{formatCurrency(payment.amount)}</Text>
                        {!selectedVendorIsCompleted ? (
                          <TouchableOpacity
                            style={styles.historyDeleteBtn}
                            onPress={() => selectedVendor && handleDeletePaymentHistory(selectedVendor.id, payment)}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="trash-outline" size={13} color="#FF7B7B" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ))
              ) : (
                <Text style={styles.historyEmpty}>No payments recorded yet.</Text>
              )}
            </ScrollView>

            <View style={styles.detailFooter}>
              <View style={styles.detailFooterLeft}>
                {!selectedVendorIsCompleted ? (
                  <TouchableOpacity style={styles.completeBtn} onPress={() => selectedVendor && handleCompleteVendor(selectedVendor.id)} activeOpacity={0.8}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#0B1204" />
                    <Text style={styles.completeBtnText}>Complete</Text>
                  </TouchableOpacity>
                ) : null}
                {!selectedVendorIsCompleted ? (
                  <TouchableOpacity style={styles.deleteVendorBtn} onPress={() => selectedVendor && handleDeleteVendor(selectedVendor.id)} activeOpacity={0.8}>
                    <Ionicons name="trash-outline" size={14} color="#FF7B7B" />
                    <Text style={styles.deleteVendorBtnText}>Delete Vendor</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
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
            <Text style={styles.filterTitle}>Update Vendor Payment</Text>
            <Text style={styles.paymentContext}>{activePaymentVendor?.name}</Text>
            <Text style={styles.paymentSubtext}>Pay for {selectedMonth} {selectedYear}</Text>

            <TextInput
              value={paymentAmountInput}
              onChangeText={setPaymentAmountInput}
              keyboardType="numeric"
              placeholder="Enter payment amount"
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
                <Text style={styles.applyBtnText}>Save Payment</Text>
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
            <Text style={styles.filterTitle}>Filter Finance Data</Text>

            <Text style={styles.filterGroupLabel}>Month</Text>
            <View style={styles.chipsWrap}>
              {MONTHS.map((month) => {
                const isActive = selectedMonth === month;
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
                const isActive = selectedYear === year;
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
          if (!isAddingVendor) setAddVendorOpen(false);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (!isAddingVendor) setAddVendorOpen(false);
          }}
        >
          <Pressable style={styles.filterModal} onPress={() => {}}>
            <Text style={styles.filterTitle}>Add New Vendor</Text>

            <TextInput
              value={newVendorName}
              onChangeText={setNewVendorName}
              placeholder="Vendor Name"
              placeholderTextColor="#6f7984"
              style={styles.amountInput}
            />

            <TextInput
              value={newVendorLoanInput}
              onChangeText={setNewVendorLoanInput}
              keyboardType="numeric"
              placeholder="Loan Amount"
              placeholderTextColor="#6f7984"
              style={styles.amountInput}
            />

            <View style={styles.paymentActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAddVendorOpen(false)}
                disabled={isAddingVendor}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyBtn}
                onPress={handleAddVendor}
                activeOpacity={0.88}
                disabled={isAddingVendor}
              >
                {isAddingVendor ? (
                  <View style={styles.actionLoadingRow}>
                    <ActivityIndicator size="small" color="#0B1204" />
                    <Text style={styles.applyBtnText}>Adding...</Text>
                  </View>
                ) : (
                  <Text style={styles.applyBtnText}>Add Vendor</Text>
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
              <Ionicons name="time-outline" size={18} color="#ACFE3E" style={{ marginRight: 4,  position: 'relative', top: -5 }} />
              <Text style={styles.filterTitle}>Completed Payments</Text>
            </View>

            {historyVendors.length === 0 ? (
              <Text style={styles.historyEmpty}>No completed payments yet.</Text>
            ) : (
              <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                {historyVendors.map((vendor, index) => (
                  <TouchableOpacity
                    key={`finance-history-${vendor.id}-${index}`}
                    style={styles.completedVendorCard}
                    activeOpacity={0.85}
                    onPress={() => {
                      setHistoryOpen(false);
                      setSelectedVendorId(vendor.id);
                    }}
                  >
                    <View style={styles.completedVendorRow}>
                      <View style={styles.vendorAvatar}>
                        <Text style={styles.vendorAvatarText}>{(vendor.name || '?').charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.vendorName}>{vendor.name}</Text>
                        <Text style={styles.vendorLastPaid}>Initial Date: {vendor.loanDate}</Text>
                        <Text style={styles.vendorLastPaid}>Complete Date: {getVendorCompletedOn(vendor)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.completedAmountText}>{formatCurrency(vendor.loanAmount)}</Text>
                        <Text style={styles.vendorLastPaid}>Total Amount</Text>
                        <View style={styles.completedBadge}>
                          <Text style={styles.completedBadgeText}>Settled</Text>
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
    color: '#F3F6FA',
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
    width: 15,
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
    gap: 2,
  },
  detailFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  deleteVendorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
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
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(10, 80, 0, 0.15)',
    backgroundColor: '#ACFE3E',
    marginRight: 4,
  },
  completeBtnText: {
    color: '#0B1204',
    fontSize: 13,
    fontWeight: '700',
  },
  applyBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
    
    borderRadius: 11,
    backgroundColor: '#ACFE3E',
  },
  applyBtnText: {
    color: '#0B1204',
    fontSize: 13,
    marginTop:0,
    paddingVertical: 4,
    fontWeight: '700',
  },
  actionLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
