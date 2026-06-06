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
const generateYears = (): string[] => {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];

    for (let y = 2024; y <= currentYear + 4; y++) {
        years.push(String(y));
    }

    return years;
};

const YEARS = generateYears();

const OWNER_NAME = 'Chief';
const SHOP_NAME = 'Your Shop Name';
const PRODUCTS_HISTORY_KEY = 'products_completed_history_v1';

type PurchaseRecord = {
    id?: string;
    name: string;
    amount: number;
    paidOn: string;
    timestamp: number;
};

type ProductItem = {
    id: string;
    name: string;
    createdOn: string;
    totalValue: number;
    purchases: PurchaseRecord[];
};

const isPurchaseRecord = (value: unknown): value is PurchaseRecord => {
    if (!value || typeof value !== 'object') return false;
    const item = value as Partial<PurchaseRecord>;
    return (
        typeof item.name === 'string'
        && typeof item.amount === 'number'
        && typeof item.paidOn === 'string'
        && typeof item.timestamp === 'number'
    );
};

const toProductItem = (value: unknown): ProductItem | null => {
    if (!value || typeof value !== 'object') return null;
    const item = value as Partial<ProductItem>;
    if (
        typeof item.id !== 'string'
        || typeof item.name !== 'string'
        || typeof item.createdOn !== 'string'
        || typeof item.totalValue !== 'number'
        || !Array.isArray(item.purchases)
    ) {
        return null;
    }

    const normalized = item.purchases.filter(isPurchaseRecord);
    return {
        id: item.id,
        name: item.name,
        createdOn: item.createdOn,
        totalValue: item.totalValue,
        purchases: normalized,
    };
};

const normalizeProducts = (value: unknown): ProductItem[] => {
    if (!Array.isArray(value)) return [];
    return value
        .map(toProductItem)
        .filter((p): p is ProductItem => p !== null);
};

const INITIAL_PRODUCTS: ProductItem[] = [];

const formatCurrency = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

const getProductTotalPurchases = (p: ProductItem) => p.purchases.reduce((s, it) => s + it.amount, 0);

const getProductRemaining = (p: ProductItem) => Math.max(p.totalValue - getProductTotalPurchases(p), 0);

const getProductLatest = (p: ProductItem) => {
    const latest = [...p.purchases].sort((a, b) => b.timestamp - a.timestamp)[0];
    return latest?.paidOn ?? '--';
};

const getActualLatestPurchase = (p: ProductItem) => {
    return [...p.purchases]
        .sort((a, b) => b.timestamp - a.timestamp)[0];
};

const parseProductDate = (dateStr: string): Date | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    // Try ISO first
    const iso = Date.parse(dateStr);
    if (!Number.isNaN(iso)) return new Date(iso);

    const months: Record<string, number> = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };

    // Match formats like "Jun 5, 2026" or "June 5, 2026"
    const m = dateStr.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
    if (!m) return null;
    const monthPart = m[1].substring(0, 3);
    const day = Number(m[2]);
    const year = Number(m[3]);
    const month = months[monthPart];
    if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) return null;
    return new Date(year, month, day);
};

export default function ProductScreen() {
    const historyHydratedRef = useRef(false);
    const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
    const now = new Date();

    const currentMonthName = MONTHS[now.getMonth()];
    const currentYearStr = String(now.getFullYear());

    const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
    const [selectedYear, setSelectedYear] = useState(currentYearStr);

    const isAllMonths = selectedMonth === 'All Months';
    const [filterOpen, setFilterOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [shopName, setShopName] = useState(SHOP_NAME);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [purchaseProductId, setPurchaseProductId] = useState<string | null>(null);
    const [purchaseAmountInput, setPurchaseAmountInput] = useState('');
    const [addProductOpen, setAddProductOpen] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const [newProductValueInput, setNewProductValueInput] = useState('');
    const [isAddingProduct, setIsAddingProduct] = useState(false);

    // New: Add purchase flow
    const [addPurchaseOpen, setAddPurchaseOpen] = useState(false);
    const [newPurchaseName, setNewPurchaseName] = useState('');
    const [newPurchaseAmount, setNewPurchaseAmount] = useState('');

    const [historyProducts, setHistoryProducts] = useState<ProductItem[]>([]);
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
            } catch { }

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
        getUserScopedKey(PRODUCTS_HISTORY_KEY)
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

    const fetchProducts = React.useCallback(() => {
        let mounted = true;
        apiFetch('/products')
            .then(async (response) => {
                if (!mounted || !response.ok) return;
                const payload = await response.json();
                if (!Array.isArray(payload)) return;
                setProducts(normalizeProducts(payload));
            })
            .catch(() => { });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => fetchProducts(), [fetchProducts]);

    useFocusEffect(
        React.useCallback(() => {
            const cleanup = fetchProducts();
            return cleanup;
        }, [fetchProducts]),
    );

    useEffect(() => {
        if (!historyStorageKey) {
            historyHydratedRef.current = true;
            return;
        }

        let mounted = true;
        AsyncStorage.getItem(historyStorageKey)
            .then((raw) => {
                if (!mounted) return;

                if (raw) {
                    const parsed = JSON.parse(raw);
                    setHistoryProducts(normalizeProducts(parsed));
                }
            })
            .catch(() => { })
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
        AsyncStorage.setItem(historyStorageKey, JSON.stringify(historyProducts))
            .then(() => {
                try {
                    DeviceEventEmitter.emit('productsHistoryUpdated');
                } catch { }
            })
            .catch(() => { });
    }, [historyProducts, historyStorageKey]);

    const activePurchaseProduct = products.find(p => p.id === purchaseProductId) ?? null;

    const selectedProduct = [...products, ...historyProducts].find(p => p.id === selectedProductId) ?? null;

    const selectedIsCompleted = historyProducts.some(p => p.id === selectedProductId);

    const monthlyPurchases = products.reduce((sum, product) => {
        let totalPurchases = product.purchases
            .filter(p => {
                const date = new Date(p.timestamp);
                return (
                    (isAllMonths || MONTHS[date.getMonth()] === selectedMonth) && // was getMonth() + 1
                    String(date.getFullYear()) === selectedYear
                );
            })
            .reduce((acc, purchase) => acc + purchase.amount, 0);

        // If there are no purchase records for this product, consider the product's
        // creation as an initial purchase (so new products show up in the selected month).
        if (totalPurchases === 0 && (!product.purchases || product.purchases.length === 0)) {
            try {
                const createdDate = parseProductDate(product.createdOn);
                if (createdDate) {
                    if ((isAllMonths || MONTHS[createdDate.getMonth()] === selectedMonth) // was getMonth() + 1
                        && String(createdDate.getFullYear()) === selectedYear) {
                        totalPurchases += product.totalValue;
                    }
                }
            } catch { }
        }

        return sum + totalPurchases;
    }, 0);

    useEffect(() => {
        if (!__DEV__) return;
        try {
            console.log('DEBUG: products', products.map(p => ({ id: p.id, name: p.name, createdOn: p.createdOn, totalValue: p.totalValue, purchases: p.purchases.length })));
            console.log('DEBUG: selectedMonth, selectedYear, isAllMonths', selectedMonth, selectedYear, isAllMonths);
            products.forEach(p => {
                const parsed = parseProductDate(p.createdOn);
                console.log(`DEBUG: product ${p.id} createdOn raw=`, p.createdOn, 'parsed=', parsed ? parsed.toISOString() : 'INVALID', 'purchases=', p.purchases.length);
            });
            console.log('DEBUG: monthlyPurchases', monthlyPurchases);
        } catch (e) {
            console.warn('DEBUG: product debug error', e);
        }
    }, [products, selectedMonth, selectedYear]);

    const paidAmountLabel =
        `${isAllMonths
            ? selectedYear
            : `${selectedMonth.slice(0, 3)} ${selectedYear}`
        } Purchases: ${formatCurrency(monthlyPurchases)}`;

    const createDateLabel = () => {
        const today = new Date();
        const shortMonth = MONTHS[today.getMonth()].slice(0, 3);
        return `${shortMonth} ${today.getDate()}`;
    };

    const createProductDateLabel = () => {
        const today = new Date();
        const shortMonth = MONTHS[today.getMonth()].slice(0, 3);
        return `${shortMonth} ${today.getDate()}, ${today.getFullYear()}`;
    };

    const handleAddPurchase = async () => {
        if (!activePurchaseProduct) return;
        const name = newPurchaseName.trim();
        const amount = Number(newPurchaseAmount);
        if (!name) {
            Alert.alert('Name required', 'Enter purchase name.');
            return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            Alert.alert('Invalid amount', 'Enter a valid amount.');
            return;
        }

        try {
            const response = await apiFetch(`/products/${activePurchaseProduct.id}/purchases`, {
                method: 'POST',
                body: JSON.stringify({ name, amount, paidOn: createDateLabel(), timestamp: Date.now() }),
            });

            if (!response.ok) {
                Alert.alert('Add failed', 'Unable to add purchase on server.');
                return;
            }

            const payload = await response.json();
            const created: PurchaseRecord = {
                id: String(payload?.id ?? Date.now()),
                name: String(payload?.name ?? name),
                amount: Number(payload?.amount ?? amount),
                paidOn: String(payload?.paidOn ?? createDateLabel()),
                timestamp: Number(payload?.timestamp ?? Date.now()),
            };

            setProducts(prev => prev.map(p => p.id === activePurchaseProduct.id ? { ...p, purchases: [...p.purchases, created] } : p));
            setNewPurchaseName('');
            setNewPurchaseAmount('');
            setAddPurchaseOpen(false);
            setPurchaseProductId(null);
        } catch (e) {
            Alert.alert('Error', 'Unable to add purchase now.');
        }
    };


    const handleAddProduct = async () => {
        if (isAddingProduct) return;

        const pname = newProductName.trim();
        const pvalue = Number(newProductValueInput);

        if (!pname) {
            Alert.alert('Product name required', 'Enter a product name.');
            return;
        }
        if (!Number.isFinite(pvalue) || pvalue <= 0) {
            Alert.alert('Invalid value', 'Enter a valid product total value.');
            return;
        }

        setIsAddingProduct(true);
        try {
            const response = await apiFetch('/products', {
                method: 'POST',
                body: JSON.stringify({ name: pname, createdOn: createProductDateLabel(), totalValue: pvalue }),
            });

            if (!response.ok) {
                Alert.alert('Add failed', 'Unable to create product on server.');
                return;
            }

            const payload = await response.json();
            const created = toProductItem(payload);
            if (!created) {
                Alert.alert('Add failed', 'Server returned invalid product data.');
                return;
            }

            setProducts(prev => [created, ...prev]);
        } catch {
            Alert.alert('Add failed', 'Unable to reach server.');
        } finally {
            setIsAddingProduct(false);
        }

        setNewProductName('');
        setNewProductValueInput('');
        setAddProductOpen(false);
    };

    const handleDeleteProduct = (productId: string) => {
        Alert.alert(
            'Delete Product',
            'Are you sure you want to delete this product and its purchases?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const resp = await apiFetch(`/products/${productId}`, { method: 'DELETE' });
                            if (resp.ok || resp.status === 204) {
                                setProducts(prev => prev.filter(p => p.id !== productId));
                                setHistoryProducts(prev => prev.filter(p => p.id !== productId));
                                setSelectedProductId(null);
                                return;
                            }

                            let detail = '';
                            try { detail = await resp.text(); } catch { }
                            Alert.alert('Delete failed', `Server error: ${resp.status} ${detail}`);
                        } catch (e) {
                            Alert.alert('Delete failed', 'Unable to reach server.');
                        }
                    },
                },
            ],
        );
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
                                    <Text style={styles.filterMiniValue}>
                                        {selectedMonth === 'All Months'
                                            ? 'All'
                                            : selectedMonth.slice(0, 3)}
                                    </Text>
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
                            <Text style={styles.summaryTitle} numberOfLines={1}>Product overall Dashboard</Text>
                            <Text style={styles.summaryPaid} numberOfLines={1}>{paidAmountLabel}</Text>
                        </View>

                        {/* summary bottom row intentionally omitted (no remaining amount shown) */}
                    </View>

                    <View style={styles.vendorHeaderRow}>
                        <Text style={styles.vendorSectionTitle}>Products</Text>
                        <View style={styles.vendorHeaderActions}>
                            <TouchableOpacity
                                style={styles.newVendorBtn}
                                activeOpacity={0.86}
                                onPress={() => setAddProductOpen(true)}
                            >
                                <Text style={styles.newVendorText}>New Product +</Text>
                            </TouchableOpacity>

                        </View>
                    </View>

                    <View style={styles.vendorListWrap}>
                        {products.map((product, index) => {
                            const latest = getActualLatestPurchase(product);

                            return (
                                <TouchableOpacity
                                    key={`product-${product.id}-${index}`}
                                    style={styles.vendorCard}
                                    activeOpacity={0.9}
                                    onPress={() => setSelectedProductId(product.id)}
                                >
                                    <View style={styles.vendorAvatar}>
                                        <Text style={styles.vendorAvatarText}>{(product.name || '?').charAt(0)}</Text>
                                    </View>

                                    <View style={styles.vendorMeta}>
                                        <View style={styles.vendorRow}>
                                            <Text style={styles.vendorName} numberOfLines={1}>{product.name}</Text>
                                            <Text style={styles.vendorAmount}>
                                                {formatCurrency(product.totalValue)}
                                            </Text>
                                        </View>
                                        <View style={styles.vendorRow}>
                                            <Text style={styles.vendorLastPaid} numberOfLines={1}>
                                                {latest
                                                    ? `${latest.name} • ${latest.paidOn}`
                                                    : `Date : ${product.createdOn}`}
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <TouchableOpacity
                                                    style={{ padding: 8 }}
                                                    onPress={() => handleDeleteProduct(product.id)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="trash-outline" size={14} color="#FF7B7B" />
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

            {/* Product Details Modal */}
            <Modal
                transparent
                visible={Boolean(selectedProduct)}
                animationType="fade"
                onRequestClose={() => setSelectedProductId(null)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setSelectedProductId(null)}>
                    <Pressable style={styles.filterModal} onPress={() => { }}>
                        <Text style={styles.filterTitle}>Product Details</Text>

                        <Text style={styles.detailName}>{selectedProduct?.name}</Text>
                        <Text style={styles.detailMeta}>Created On: {selectedProduct?.createdOn}</Text>
                        <Text style={styles.detailMeta}>Total Value: {selectedProduct ? formatCurrency(selectedProduct.totalValue) : '--'}</Text>
                        {selectedIsCompleted ? (
                            <Text style={styles.detailMeta}>Complete Date: {selectedProduct ? getProductLatest(selectedProduct) : '--'}</Text>
                        ) : null}



                        <View style={styles.detailFooter}>
                            <View style={styles.detailFooterLeft}>
                                {!selectedIsCompleted ? (
                                    <TouchableOpacity style={styles.deleteVendorBtn} onPress={() => selectedProduct && handleDeleteProduct(selectedProduct.id)} activeOpacity={0.8}>
                                        <Ionicons name="trash-outline" size={14} color="#FF7B7B" />
                                        <Text style={styles.deleteVendorBtnText}>Delete Product</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                            <TouchableOpacity style={styles.applyBtn} onPress={() => setSelectedProductId(null)}>
                                <Text style={styles.applyBtnText}>Close</Text>
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
                    <Pressable style={styles.filterModal} onPress={() => { }}>
                        <Text style={styles.filterTitle}>Filter Product Data</Text>

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
                                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                            {month === 'All Months' ? 'All Months' : month}
                                        </Text>
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

            {/* Add Purchase Modal */}
            <Modal
                transparent
                visible={Boolean(activePurchaseProduct) && addPurchaseOpen}
                animationType="fade"
                onRequestClose={() => { setPurchaseProductId(null); setAddPurchaseOpen(false); }}
            >
                <Pressable style={styles.modalOverlay} onPress={() => { setPurchaseProductId(null); setAddPurchaseOpen(false); }}>
                    <Pressable style={styles.filterModal} onPress={() => { }}>
                        <Text style={styles.filterTitle}>New Purchase</Text>
                        <Text style={styles.paymentContext}>{activePurchaseProduct?.name}</Text>

                        <TextInput
                            value={newPurchaseName}
                            onChangeText={setNewPurchaseName}
                            placeholder="Purchase name"
                            placeholderTextColor="#6f7984"
                            style={styles.amountInput}
                        />

                        <TextInput
                            value={newPurchaseAmount}
                            onChangeText={setNewPurchaseAmount}
                            keyboardType="numeric"
                            placeholder="Amount"
                            placeholderTextColor="#6f7984"
                            style={styles.amountInput}
                        />

                        <View style={styles.paymentActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => { setPurchaseProductId(null); setAddPurchaseOpen(false); }}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.applyBtn}
                                onPress={handleAddPurchase}
                                activeOpacity={0.88}
                            >
                                <Text style={styles.applyBtnText}>Add Purchase</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Add Product Modal */}
            <Modal
                transparent
                visible={addProductOpen}
                animationType="fade"
                onRequestClose={() => { if (!isAddingProduct) setAddProductOpen(false); }}
            >
                <Pressable style={styles.modalOverlay} onPress={() => { if (!isAddingProduct) setAddProductOpen(false); }}>
                    <Pressable style={styles.filterModal} onPress={() => { }}>
                        <Text style={styles.filterTitle}>Add New Product</Text>

                        <TextInput
                            value={newProductName}
                            onChangeText={setNewProductName}
                            placeholder="Product Name"
                            placeholderTextColor="#6f7984"
                            style={styles.amountInput}
                        />

                        <TextInput
                            value={newProductValueInput}
                            onChangeText={setNewProductValueInput}
                            keyboardType="numeric"
                            placeholder="Total Value"
                            placeholderTextColor="#6f7984"
                            style={styles.amountInput}
                        />

                        <View style={styles.paymentActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setAddProductOpen(false)}
                                disabled={isAddingProduct}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.applyBtn}
                                onPress={handleAddProduct}
                                activeOpacity={0.88}
                                disabled={isAddingProduct}
                            >
                                {isAddingProduct ? (
                                    <View style={styles.actionLoadingRow}>
                                        <ActivityIndicator size="small" color="#0B1204" />
                                        <Text style={styles.applyBtnText}>Adding...</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.applyBtnText}>Add Product</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            <ProfileDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
            <BottomNavBar />
        </SafeAreaView>
    );
}

// Reuse finance styles by importing from file to avoid duplication.

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#07090B' },
    bgGradient: { flex: 1 },
    container: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 132 },
    summaryCard: {
        height: 200, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
        marginBottom: 20, marginTop: 8, backgroundColor: '#020405',
        shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 }, elevation: 8, overflow: 'hidden',
    },
    summaryBannerImage: { position: 'absolute', width: '100%', height: '100%', top: 15, left: 0 },
    summaryBannerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(2,4,5,0.42)'
    },
    summaryTopRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start', marginBottom: 6 },
    summaryTitleWrap: { width: '100%', marginTop: 4 },
    summaryTitle: { color: '#F3F5F7', fontSize: 16, fontWeight: '800', lineHeight: 15, letterSpacing: 0.1 },
    summaryPaid: { marginTop: 4, color: '#A9FF4A', fontSize: 13, fontWeight: '500' },
    bannerFilters: { flexDirection: 'row', alignItems: 'center' },
    filterInlineLabel: { color: '#E6EAEE', fontSize: 8, marginRight: 4 },
    filterMiniBox: {
        minWidth: 26, height: 14, borderRadius: 10, backgroundColor: '#E8EAEC',
        borderColor: '#ccc', alignItems: 'center', justifyContent: 'center', marginRight: 4, paddingHorizontal: 2,
    },
    filterMiniBoxYear: { minWidth: 30 },
    filterMiniValue: { color: '#333', fontSize: 8, fontWeight: '400' },
    filterBtn: { width: 14, height: 14, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    vendorHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    vendorSectionTitle: { color: '#EFF3F7', fontSize: 19, fontWeight: '700' },
    vendorHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    newVendorBtn: {
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: '#8DE22A',
        shadowColor: '#8DE22A', shadowOpacity: 0.35, shadowRadius: 9, shadowOffset: { width: 0, height: 2 }, elevation: 8,
    },
    newVendorText: { color: '#0B1205', fontSize: 10, fontWeight: '700' },
    vendorListWrap: { gap: 6 },
    vendorCard: {
        flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14,
        paddingVertical: 11, paddingHorizontal: 12, backgroundColor: 'rgba(1,3,5,0.88)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000000', shadowOpacity: 0.4, shadowRadius: 12,
        shadowOffset: { width: 0, height: 7 }, elevation: 7,
    },
    vendorAvatar: {
        marginTop: 4, width: 31, height: 31, borderRadius: 15.5, marginRight: 10,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(172,254,62,0.18)', borderWidth: 1, borderColor: 'rgba(172,254,62,0.36)',
    },
    vendorAvatarText: { color: '#BCFF69', fontWeight: '700', fontSize: 14 },
    vendorMeta: { flex: 1 },
    vendorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 2 },
    vendorName: { color: '#F3F6FA', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
    vendorLastPaid: { color: '#929AA3', fontSize: 11, flex: 1 },
    vendorAmount: { color: '#ACFE3E', fontSize: 15, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.56)', justifyContent: 'center', paddingHorizontal: 18 },
    filterModal: {
        borderRadius: 18, padding: 16, backgroundColor: '#12171D',
        borderWidth: 1, borderColor: 'rgba(172,254,62,0.25)',
    },
    filterTitle: { color: '#F4F7FB', fontSize: 17, fontWeight: '700', marginBottom: 12 },
    detailName: { color: '#F4F7FB', fontSize: 16, fontWeight: '700', marginBottom: 8 },
    detailMeta: { color: '#C9D0D8', fontSize: 13, marginBottom: 4 },
    detailFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, gap: 2 },
    detailFooterLeft: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    deleteVendorBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 8, paddingVertical: 6, borderRadius: 11,
        borderWidth: 1, borderColor: 'rgba(255,123,123,0.35)', backgroundColor: 'rgba(255,123,123,0.1)',
    },
    deleteVendorBtnText: { color: '#FF7B7B', fontSize: 13, fontWeight: '600' },
    applyBtn: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 11, backgroundColor: '#ACFE3E' },
    applyBtnText: { color: '#0B1204', fontSize: 13, marginTop: 0, paddingVertical: 4, fontWeight: '700' },
    filterGroupLabel: { color: '#C7CDD4', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 2 },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' },
    chipActive: { borderColor: 'rgba(172,254,62,0.8)', backgroundColor: 'rgba(172,254,62,0.16)' },
    chipText: { color: '#A9B0B8', fontSize: 12, fontWeight: '500' },
    chipTextActive: { color: '#D4FF9A' },
    yearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    yearPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)' },
    yearPillActive: { borderColor: 'rgba(172,254,62,0.8)', backgroundColor: 'rgba(172,254,62,0.18)' },
    yearPillText: { color: '#A9B0B8', fontSize: 12, fontWeight: '600' },
    yearPillTextActive: { color: '#D4FF9A' },
    paymentContext: { color: '#F4F7FB', fontSize: 14, fontWeight: '600', marginBottom: 2 },
    amountInput: {
        height: 42, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
        backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, color: '#F4F7FB', marginBottom: 10,
    },
    paymentActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 2 },
    cancelBtn: {
        flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.03)',
    },
    cancelBtnText: { color: '#D7DDE4', fontSize: 13, fontWeight: '600' },
    actionLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    vendorPendingRow: { flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
    vendorPending: { color: '#8D949C', fontSize: 11 },
    payButton: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(172,254,62,0.2)', borderWidth: 1, borderColor: 'rgba(172,254,62,0.4)' },
    payButtonText: { color: '#D9FF9E', fontSize: 10, fontWeight: '700' },
});