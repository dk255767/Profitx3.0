import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LinearGradient as _LG } from "expo-linear-gradient";
const LinearGradient = _LG as React.ComponentType<any>;
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  Pressable,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Line, Path, Circle, Defs, Rect, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import ProfileDrawer from '../../components/ProfileDrawer';
import AppHeader from '../../components/AppHeader';
import BottomNavBar from '../../components/BottomNavBar';
import {
  loadFinanceSnapshot,
  type AdditionalRow,
  type IncomeRow,
} from '../../constants/finance-storage';
import { getUserScopedKey, STORAGE_KEYS } from '../../constants/app-flow';
import { apiFetch } from '../../constants/api-client';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS = ['2023','2024','2025','2026'];
const OWNER_NAME = 'Chief';
const SHOP_NAME = 'Your Shop Name';

const toNum = (value: string) => parseFloat(value) || 0;

const parseDMY = (value: string): Date | null => {
  const normalized = value.trim();
  if (!normalized) return null;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(normalized);
  if (slash) {
    const dd = Number(slash[1]);
    const mm = Number(slash[2]);
    const yyyy = Number(slash[3]);
    const date = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatMoney = (value: number) => `\u20b9${value.toFixed(2)}`;

const additionalInvestment = (row: AdditionalRow) =>
  toNum(row.egg) + toNum(row.piece) + toNum(row.potato) + toNum(row.gas) + toNum(row.fuel);

export default function HomeScreen() {
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [monthDropdown, setMonthDropdown] = useState(false);
  const [yearDropdown, setYearDropdown] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [shopName, setShopName] = useState(SHOP_NAME);
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>([]);
  const [addRows, setAddRows] = useState<AdditionalRow[]>([]);
  const [selectedChartDate, setSelectedChartDate] = useState<string | null>(null);
  const [liveNow, setLiveNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadShopName = useCallback(async () => {
    try {
      const shopNameKey = await getUserScopedKey(STORAGE_KEYS.shopName);
      const savedShopName = await AsyncStorage.getItem(shopNameKey);
      const nextShopName = savedShopName?.trim();
      if (nextShopName) {
        setShopName(nextShopName);
        return;
      }

      // fallback: fetch profile from server and persist
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
      } catch {
        // ignore
      }

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
    useCallback(() => {
      const sync = async () => {
        const snapshot = await loadFinanceSnapshot();
        setIncomeRows(snapshot.incomeRows);
        setAddRows(snapshot.addRows);
        await loadShopName();
      };
      sync();
    }, [loadShopName]),
  );

  const images: Record<string, any> = {
    cash: require('../../assets/images/cash.png'),
    gpay: require('../../assets/images/gpay.png'),
    total: require('../../assets/images/total.png'),
    invest: require('../../assets/images/invest.png'),
    today: require('../../assets/images/today.png'),
  };

  const filteredIncomeRows = useMemo(() => {
    return incomeRows.filter((row) => {
      const date = parseDMY(row.date);
      if (!date) return !month && !year;
      const monthMatch = !month || MONTHS[date.getMonth()] === month;
      const yearMatch = !year || String(date.getFullYear()) === year;
      return monthMatch && yearMatch;
    });
  }, [incomeRows, month, year]);

  const filteredAdditionalRows = useMemo(() => {
    return addRows.filter((row) => {
      const date = parseDMY(row.date);
      if (!date) return !month && !year;
      const monthMatch = !month || MONTHS[date.getMonth()] === month;
      const yearMatch = !year || String(date.getFullYear()) === year;
      return monthMatch && yearMatch;
    });
  }, [addRows, month, year]);

  const additionalByDate = useMemo(() => {
    const map = new Map<string, number>();
    filteredAdditionalRows.forEach((row) => {
      map.set(row.date, (map.get(row.date) || 0) + additionalInvestment(row));
    });
    return map;
  }, [filteredAdditionalRows]);

  const profitRows = useMemo(() => {
    return filteredIncomeRows
      .map((row) => {
        const cash = toNum(row.cash);
        const gpay = toNum(row.gpay);
        const incomeInvestment = toNum(row.malliKadai) + toNum(row.market);
        const investment = incomeInvestment + (additionalByDate.get(row.date) || 0);
        const profit = cash + gpay - investment;
        return { date: row.date, cash, gpay, investment, profit };
      })
      .sort((a, b) => {
        const ad = parseDMY(a.date)?.getTime() || 0;
        const bd = parseDMY(b.date)?.getTime() || 0;
        return ad - bd;
      });
  }, [filteredIncomeRows, additionalByDate]);

  const cashTotal = profitRows.reduce((sum, row) => sum + row.cash, 0);
  const gpayTotal = profitRows.reduce((sum, row) => sum + row.gpay, 0);
  const investmentTotal = profitRows.reduce((sum, row) => sum + row.investment, 0);
  const grossTotal = cashTotal + gpayTotal;
  const profitTotal = grossTotal - investmentTotal;

  const latestRow = profitRows.length ? profitRows[profitRows.length - 1] : null;
  const chartRows = useMemo(() => {
    if (!profitRows.length) return [];

    if (month) {
      return profitRows.filter((row) => {
        const d = parseDMY(row.date);
        if (!d) return false;
        const monthMatch = MONTHS[d.getMonth()] === month;
        const yearMatch = !year || String(d.getFullYear()) === year;
        return monthMatch && yearMatch;
      });
    }

    const lastDate = parseDMY(profitRows[profitRows.length - 1].date);
    if (!lastDate) return profitRows;
    const targetMonth = lastDate.getMonth();
    const targetYear = lastDate.getFullYear();

    return profitRows.filter((row) => {
      const d = parseDMY(row.date);
      return !!d && d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });
  }, [profitRows, month, year]);
  const chartMonthTitle = useMemo(() => {
    if (!chartRows.length) return 'No Data Month';
    const firstDate = parseDMY(chartRows[0].date);
    if (!firstDate) return month || 'Selected Month';
    return `${MONTHS[firstDate.getMonth()]} ${firstDate.getFullYear()}`;
  }, [chartRows, month]);
  const activeChartDate = chartRows.some(r => r.date === selectedChartDate) ? selectedChartDate : null;
  const _cp = chartRows.map(r => r.profit);
  const chartMin = Math.min(0, ...(_cp.length ? _cp : [0]));
  const chartMax = Math.max(1, ...(_cp.length ? _cp : [1]));
  const chartRange = (chartMax - chartMin) || 1;

  const buildChart = () => {
    const n = chartRows.length;
    if (n === 0) return null;
    const chartLeft = 60;
    const chartWidth = 292;
    const xStep = n > 1 ? chartWidth / (n - 1) : 0;
    const pts = chartRows.map((row, i) => ({
      x: n > 1 ? chartLeft + i * xStep : 206,
      y: 175 - ((row.profit - chartMin) / chartRange) * 165,
      income: row.cash + row.gpay,
      invest: row.investment,
      profit: row.profit,
      date: row.date,
    }));
    let pathD = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i < pts.length - 2 ? pts[i + 2] : p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    const fillD = `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} 175 L ${pts[0].x.toFixed(1)} 175 Z`;
    return { pts, pathD, fillD };
  };

  const chart = buildChart();
  const selectedPoint = activeChartDate ? chart?.pts.find((pt) => pt.date === activeChartDate) || null : null;
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);
  const liveTimeText = useMemo(
    () => liveNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [liveNow],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={['#2c3e50', '#0C1114']}
        locations={[0, 0.30]}
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

        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.chartSection}>
            <View style={styles.chartCard}>
              {chart === null ? (
                <Text style={{ color: '#ffffff70', opacity: 0.6 }}>[No profit data yet]</Text>
              ) : (
                <Svg width="100%" height="100%" viewBox="0 0 360 220">
                  <Defs>
                    <SvgLinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor="#ACFE3E" stopOpacity="0.30" />
                      <Stop offset="100%" stopColor="#ACFE3E" stopOpacity="0" />
                    </SvgLinearGradient>
                  </Defs>

                  {[0, 0.25, 0.5, 0.75, 1.0].map((pct, gi) => {
                    const yPos = 175 - pct * 165;
                    const val = chartMin + chartRange * pct;
                    const label = Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0);
                    return (
                      <React.Fragment key={gi}>
                        <Line x1="48" y1={yPos} x2="352" y2={yPos} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                        <SvgText x="44" y={yPos + 4} fontSize="9" fill="rgba(255,255,255,0.45)" textAnchor="end">{label}</SvgText>
                      </React.Fragment>
                    );
                  })}

                  <Line x1="48" y1="10" x2="48" y2="175" stroke="rgba(255,255,255,0.30)" strokeWidth="1" />
                  <Line x1="48" y1="175" x2="352" y2="175" stroke="rgba(255,255,255,0.30)" strokeWidth="1" />

                  {chartMin < 0 && chartMax > 0 && (
                    <Line
                      x1="48" y1={175 - ((0 - chartMin) / chartRange) * 165}
                      x2="352" y2={175 - ((0 - chartMin) / chartRange) * 165}
                      stroke="rgba(255,100,100,0.35)" strokeWidth="1" strokeDasharray="4,3"
                    />
                  )}

                  <Path d={chart.fillD} fill="url(#areaGrad)" />
                  <Path d={chart.pathD} stroke="#ACFE3E" strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />

                  {selectedPoint && (
                    <>
                      <Rect
                        x={Math.max(54, Math.min(selectedPoint.x - 70, 216))}
                        y={Math.max(12, selectedPoint.y - 62)}
                        width="140"
                        height="52"
                        rx="8"
                        fill="rgba(12,17,20,0.92)"
                        stroke="rgba(172,254,62,0.55)"
                        strokeWidth="1"
                      />
                      <SvgText
                        x={Math.max(60, Math.min(selectedPoint.x - 64, 222))}
                        y={Math.max(26, selectedPoint.y - 48)}
                        fontSize="8"
                        fill="#ACFE3E"
                        fontWeight="700"
                      >
                        {selectedPoint.date}
                      </SvgText>
                      <SvgText
                        x={Math.max(60, Math.min(selectedPoint.x - 64, 222))}
                        y={Math.max(37, selectedPoint.y - 37)}
                        fontSize="8"
                        fill="#E5E7EB"
                      >
                        Income: {selectedPoint.income.toFixed(0)}
                      </SvgText>
                      <SvgText
                        x={Math.max(60, Math.min(selectedPoint.x - 64, 222))}
                        y={Math.max(48, selectedPoint.y - 26)}
                        fontSize="8"
                        fill="#E5E7EB"
                      >
                        Invest: {selectedPoint.invest.toFixed(0)}
                      </SvgText>
                      <SvgText
                        x={Math.max(60, Math.min(selectedPoint.x - 64, 222))}
                        y={Math.max(59, selectedPoint.y - 15)}
                        fontSize="8"
                        fill="#E5E7EB"
                      >
                        Profit: {selectedPoint.profit.toFixed(0)}
                      </SvgText>
                    </>
                  )}

                  {chart.pts.map((pt, pi) => {
                    const parts = pt.date.split('/');
                    const shortDate = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : pt.date.slice(0, 5);
                    const valLabel = Math.abs(pt.profit) >= 1000 ? `${(pt.profit / 1000).toFixed(1)}k` : pt.profit.toFixed(0);
                    const dotColor = pt.profit >= 0 ? '#ACFE3E' : '#FF6B6B';
                    const isSelected = pt.date === activeChartDate;
                    return (
                      <React.Fragment key={`pt-${pi}`}>
                        <Circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 6 : 4}
                          fill={dotColor}
                          stroke={isSelected ? '#ffffff' : '#0C1114'}
                          strokeWidth={isSelected ? 2 : 1.5}
                          onPress={() => setSelectedChartDate(prev => (prev === pt.date ? null : pt.date))}
                        />
                        <SvgText x={pt.x} y={pt.y - 9} fontSize="8" fill={dotColor} textAnchor="middle">{valLabel}</SvgText>
                        <SvgText x={pt.x} y="192" fontSize="9" fill="rgba(255,255,255,0.55)" textAnchor="middle">{shortDate}</SvgText>
                      </React.Fragment>
                    );
                  })}

                  <SvgText x="1" y="110" fontSize="9" fill="rgba(255,255,255,0.40)" textAnchor="middle" rotation="-90" originX="6" originY="100">Profit</SvgText>
                  <SvgText x="200" y="212" fontSize="9" fill="rgba(255,255,255,0.40)" textAnchor="middle">Date</SvgText>
                </Svg>
              )}
            </View>

            <View style={styles.chartInfo}>
              <Text style={styles.statusText}>{profitTotal >= 0 ? 'In Profit' : 'In Loss'}</Text>
              <Text style={styles.chartTitle}>{chartMonthTitle}</Text>
              <Text style={styles.amount}>Rupee <Text style={styles.whiteText}>{profitTotal.toFixed(2)}</Text></Text>
            </View>
          </View>

          <LinearGradient
            colors={['#3F8105', '#ACFE3E']}
            start={[0, 0]}
            end={[1, 0]}
            style={styles.profitBanner}
          >
            <View style={styles.profitContent}>
              <View style={styles.iconBox}>
                <Image source={require('../../assets/images/bannerlogo.png')} style={{margin:0, width: 58, height: 30}} />
              </View>
              <Text style={styles.profitText}>ProfitX</Text>
            </View>
          </LinearGradient>

          <View style={styles.menuSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Amount Menu</Text>
              <View style={styles.filtersRow}>
                <TouchableOpacity style={styles.select} onPress={() => setMonthDropdown(true)}>
                  <Text style={styles.selectText}>{month || 'Month'}</Text>
                </TouchableOpacity>
                <View style={styles.yearFilter}>
                  <TouchableOpacity style={styles.select} onPress={() => setYearDropdown(true)}>
                    <Text style={styles.selectText}>{year || 'Year'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {}}>
                    <LinearGradient
                      colors={['#3F8105', '#ACFE3E']}
                      start={[0, 0]}
                      end={[1, 0]}
                      style={styles.filterBtn}
                    >
                      <Ionicons name="filter" size={12} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>

              <Modal transparent visible={monthDropdown} animationType="fade" onRequestClose={() => setMonthDropdown(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setMonthDropdown(false)}>
                  <View style={styles.dropdownBox}>
                    <FlatList
                      data={MONTHS}
                      keyExtractor={item => item}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMonth(item); setMonthDropdown(false); }}>
                          <Text style={[styles.dropdownText, month === item && styles.dropdownTextActive]}>{item}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                </Pressable>
              </Modal>

              <Modal transparent visible={yearDropdown} animationType="fade" onRequestClose={() => setYearDropdown(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setYearDropdown(false)}>
                  <View style={styles.dropdownBox}>
                    <FlatList
                      data={YEARS}
                      keyExtractor={item => item}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => { setYear(item); setYearDropdown(false); }}>
                          <Text style={[styles.dropdownText, year === item && styles.dropdownTextActive]}>{item}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                </Pressable>
              </Modal>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsWrapper}>
              {[
                { key: 'cash', title: 'Cash', value: formatMoney(cashTotal) },
                { key: 'gpay', title: 'GPay', value: formatMoney(gpayTotal) },
                { key: 'total', title: 'Total', value: formatMoney(grossTotal) },
                { key: 'invest', title: 'Investment', value: formatMoney(investmentTotal) },
              ].map(item => (
                <LinearGradient
                  key={item.key}
                  colors={['#ffffff', '#ffffff', '#8a8a8a', '#6f6f6f', '#0C1114', '#0C1114']}
                  locations={[0, 0.10, 0.30, 0.55, 0.75, 1.0]}
                  start={[0, 0]}
                  end={[0, 1]}
                  style={styles.card}
                >
                  <LinearGradient
                    colors={['#1a1a1a', 'rgba(30,30,30,0.63)']}
                    start={[0, 0]}
                    end={[0, 1]}
                    style={styles.cardInner}
                  >
                    <LinearGradient
                      colors={['#7CFF00', '#7CFF00', '#000000', '#000000']}
                      locations={[0, 0.10, 0.30, 1.0]}
                      start={[0, 0]}
                      end={[1, 1]}
                      style={styles.displayBox}
                    >
                      <View style={styles.cardImageContainer}>
                        <Image
                          source={images[item.key] || { uri: 'https://via.placeholder.com/135x80' }}
                          style={styles.cardImage}
                          resizeMode="cover"
                        />
                      </View>
                    </LinearGradient>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.amountGreen}>{item.value}</Text>
                  </LinearGradient>
                </LinearGradient>
              ))}
            </ScrollView>
          </View>

          <View style={styles.todaySection}>
            <Text style={styles.sectionTitle}>Today</Text>
            <LinearGradient
              colors={['#ffffff', '#ffffff', '#8a8a8a', '#6f6f6f', '#0C1114', '#0C1114']}
              locations={[0, 0.10, 0.30, 0.55, 0.75, 1.0]}
              start={[0, 0]}
              end={[1, 0]}
              style={styles.todayCardd}
            >
              <LinearGradient
                colors={['#1a1a1a', 'rgba(30,30,30,0.63)']}
                start={[0, 0]}
                end={[0, 1]}
                style={styles.todayCard}
              >
                <LinearGradient
                  colors={['#7CFF00', '#7CFF00', '#000000', '#000000']}
                  locations={[0, 0.10, 0.30, 1.0]}
                  start={[0, 0]}
                  end={[1, 1]}
                  style={styles.tdisplayBox}
                >
                  <View style={styles.tcardImageContainer}>
                    <Image source={images.today} style={styles.tcardImage} resizeMode="cover" />
                  </View>
                </LinearGradient>
                <View style={styles.itemDetails}>
                  <Text style={styles.meta}>Time: <Text style={styles.metaValue}>{liveTimeText}</Text> | Date: <Text style={styles.metaValue}>{latestRow?.date || '--/--/----'}</Text></Text>
                  <View style={styles.statsRow}>
                    <Text style={styles.whiteText}>Profit <Text style={styles.green}>{formatMoney(latestRow?.profit || 0)}</Text></Text>
                  </View>
                  <View style={styles.statsRow}>
                    <Text style={styles.whiteText}>Investment <Text style={styles.yellow}>{formatMoney(latestRow?.investment || 0)}</Text></Text>
                  </View>
                </View>
              </LinearGradient>
            </LinearGradient>
          </View>
        </ScrollView>
      </LinearGradient>

      <ProfileDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <BottomNavBar />
    </SafeAreaView>
  );
}

const COLORS = {
  bgDarker: '#0f172a',
  textWhite: '#ffffff',
  textGray: '#94a3b8',
  textGreen: '#84cc16',
  accent: '#84cc16',
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0C1114' },
  bgGradient: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120 },
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
  iconBtn: { padding: 6 },
  iconText: { color: COLORS.textGray, fontSize: 22 },
  accentBtn: { borderRadius: 8 },
  profileBtn: { padding: 4, marginTop: 8 },
  profileImg: { width: 26, height: 26, borderRadius: 4 },

  chartSection: { marginBottom: -5 },
  chartCard: { height: 230, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 ,marginTop:8},
  chartInfo: { paddingLeft: 6 },
  statusText: { color: COLORS.textGreen, fontSize: 12, fontWeight: '500' },
  chartTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textWhite, marginVertical: 0 },
  amount: { color: COLORS.textGray, fontSize: 14 },
  whiteText: { color: COLORS.textWhite, fontWeight: '600' },

  profitBanner: { marginVertical: 20, marginHorizontal: -20, paddingVertical: 15, paddingHorizontal: 20, borderTopRightRadius: 50, borderBottomRightRadius: 50, width: '50%', shadowColor: '#ACFE3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 8 },
  profitContent: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBox: { width: 48, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  profitText: { color: '#352B2A', fontWeight: '700', fontSize: 18 },

  menuSection: { marginTop: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textWhite },
  filtersRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  select: { paddingVertical: 2, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#ffffff' },
  selectText: { color: '#333333', fontSize: 8 },
  yearFilter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: { width: 20, height: 20, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },

  cardsWrapper: { marginVertical: 8, paddingBottom: 0 },
  card: { minWidth: 60, width: 120, height: 180, borderRadius: 22, padding: 2, marginRight: 10, flexShrink: 0 },
  cardInner: { flex: 1, borderRadius: 20, overflow: 'hidden', flexDirection: 'column', alignItems: 'center' },
  displayBox: { width: '82%', height: 80, marginTop: 18, borderRadius: 14, padding: 2 },
  cardImageContainer: { flex: 1, borderRadius: 12, backgroundColor: '#010101', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardImage: { width: 135, height: 80, borderRadius: 12 },
  title: { marginTop: 18, color: COLORS.textWhite, fontSize: 12, fontWeight: '500' },
  amountGreen: { marginTop: 4, color: '#7CFF00', fontSize: 14, fontWeight: '400' },

  todaySection: { marginTop: 20 },
  todayCardd: { marginTop: 15, borderRadius: 16, padding: 2, height: 120 },
  todayCard: { flexDirection: 'row', alignItems: 'center', gap: 20, borderRadius: 16, padding: 15, height: 115 },
  tdisplayBox: { width: '25%', height: 90, borderRadius: 14, padding: 2 },
  tcardImageContainer: { flex: 1, borderRadius: 12, backgroundColor: '#010101', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tcardImage: { width: 135, height: 80, borderRadius: 12 },
  itemDetails: { flex: 1 },
  meta: { fontSize: 12, color: '#a69e9e', marginBottom: 8 },
  metaValue: { color: COLORS.textWhite },
  statsRow: { marginBottom: 6 },
  green: { color: COLORS.textGreen, fontWeight: '600' },
  yellow: { color: '#facc15', fontWeight: '600' },

  fabContainer: { marginTop: 16, alignItems: 'center' },
  fabMain: { backgroundColor: COLORS.accent, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 30, shadowColor: COLORS.accent, shadowOpacity: 0.3 },
  fabText: { color: '#0f172a', fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  dropdownBox: { backgroundColor: '#1a1a1a', borderRadius: 12, paddingVertical: 8, width: 180, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', maxHeight: 260 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 16 },
  dropdownText: { color: '#94a3b8', fontSize: 14 },
  dropdownTextActive: { color: '#7CFF00', fontWeight: '600' },
});
