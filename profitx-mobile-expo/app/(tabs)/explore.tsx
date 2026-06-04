/**
 * DataScreen – Finance Income Entry & History
 * Dark fintech theme · Neon green · Glassmorphism
 */
import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient as _LG } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import BottomNavBar from '../../components/BottomNavBar';

const LinearGradient = _LG as React.ComponentType<any>;
const { width: W } = Dimensions.get('window');

/* ─── Design tokens ─────────────────────────────────────────────── */
const NEON        = '#00FF88';
const NEON_DARK   = '#00C96B';
const BG_TOP      = '#000D1A';
const BG_MID      = '#001428';
const BG_BOT      = '#000508';
const CARD_BG     = 'rgba(0,30,60,0.60)';
const CARD_BORDER = 'rgba(0,255,136,0.28)';
const INPUT_BG    = 'rgba(0,18,40,0.85)';
const INPUT_BDR   = 'rgba(0,255,136,0.22)';
const TEXT        = '#FFFFFF';
const MUTED       = 'rgba(255,255,255,0.42)';
const TH_BG       = 'rgba(0,255,136,0.11)';
const RED         = '#FF3B3B';
const ROW_ALT     = 'rgba(255,255,255,0.025)';

/* ─── Column widths ─────────────────────────────────────────────── */
const INCOME_COLS = [88, 66, 66, 80, 70, 68, 42] as const;
const ADD_COLS    = [88, 66, 72, 66, 66, 68, 42] as const;
const colW = (i: number, kind: 'income' | 'add'): number =>
  kind === 'income' ? INCOME_COLS[i] : ADD_COLS[i];

/* ─── Types ─────────────────────────────────────────────────────── */
type IncomeRow = {
  id: string;
  date: string;
  cash: string;
  gpay: string;
  malliKadai: string;
  market: string;
};

type AdditionalRow = {
  id: string;
  date: string;
  egg: string;
  potato: string;
  gas: string;
  fuel: string;
};

const numSum = (vals: string[]): number =>
  vals.reduce((s, v) => s + (parseFloat(v) || 0), 0);

/* ─── Shared InputField ─────────────────────────────────────────── */
type InputFieldProps = {
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
};
const InputField = ({ icon, placeholder, value, onChangeText, keyboardType = 'default' }: InputFieldProps) => (
  <View style={s.inputRow}>
    <Ionicons name={icon as any} size={17} color={NEON} style={s.inputIcon} />
    <TextInput
      style={s.input}
      placeholder={placeholder}
      placeholderTextColor={MUTED}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      selectionColor={NEON}
    />
  </View>
);

/* ─── Table header ──────────────────────────────────────────────── */
const TableHeader = ({ cols, kind }: { cols: string[]; kind: 'income' | 'add' }) => (
  <View style={s.tableHeaderRow}>
    {cols.map((c, i) => (
      <Text key={i} style={[s.tableHeaderCell, { width: colW(i, kind) }]}>
        {c}
      </Text>
    ))}
  </View>
);

/* ═══════════════════════════════════════════════════════════════════
   DataScreen
══════════════════════════════════════════════════════════════════════ */
export default function DataScreen() {
  const router = useRouter();

  /* Form state */
  const [incomeForm, setIncomeForm] = useState<Omit<IncomeRow, 'id'>>({
    date: '', cash: '', gpay: '', malliKadai: '', market: '',
  });
  const [addForm, setAddForm] = useState<Omit<AdditionalRow, 'id'>>({
    date: '', egg: '', potato: '', gas: '', fuel: '',
  });

  /* Expand state */
  const [addExpanded, setAddExpanded] = useState(false);

  /* Table data */
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>([]);
  const [addRows, setAddRows]       = useState<AdditionalRow[]>([]);

  /* ── Actions ─────────────────────────────────────────────────── */
  const handleUpload = () => {
    if (!incomeForm.date.trim()) { Alert.alert('Required', 'Please enter a date.'); return; }
    setIncomeRows(prev => [{ id: `${Date.now()}`, ...incomeForm }, ...prev]);
    setIncomeForm({ date: '', cash: '', gpay: '', malliKadai: '', market: '' });
  };

  const handleAddEntry = () => {
    if (!addForm.date.trim()) { Alert.alert('Required', 'Please enter a date.'); return; }
    setAddRows(prev => [{ id: `${Date.now()}`, ...addForm }, ...prev]);
    setAddForm({ date: '', egg: '', potato: '', gas: '', fuel: '' });
  };

  const confirmDelete = (onDelete: () => void) =>
    Alert.alert('Delete Record', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);

  /* ── Totals ──────────────────────────────────────────────────── */
  const incomeTotals = incomeRows.reduce(
    (a, r) => ({
      cash:       a.cash       + (parseFloat(r.cash)       || 0),
      gpay:       a.gpay       + (parseFloat(r.gpay)       || 0),
      malliKadai: a.malliKadai + (parseFloat(r.malliKadai) || 0),
      market:     a.market     + (parseFloat(r.market)     || 0),
    }),
    { cash: 0, gpay: 0, malliKadai: 0, market: 0 },
  );

  const addTotals = addRows.reduce(
    (a, r) => ({
      egg:    a.egg    + (parseFloat(r.egg)    || 0),
      potato: a.potato + (parseFloat(r.potato) || 0),
      gas:    a.gas    + (parseFloat(r.gas)    || 0),
      fuel:   a.fuel   + (parseFloat(r.fuel)   || 0),
    }),
    { egg: 0, potato: 0, gas: 0, fuel: 0 },
  );

  const incomeGrandTotal =
    incomeTotals.cash + incomeTotals.gpay + incomeTotals.malliKadai + incomeTotals.market;
  const addGrandTotal =
    addTotals.egg + addTotals.potato + addTotals.gas + addTotals.fuel;

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <LinearGradient colors={[BG_TOP, BG_MID, BG_BOT]} locations={[0, 0.5, 1]} style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={s.safe}>

        {/* ── Header ─────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={TEXT} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Enter the Incomes</Text>
          <TouchableOpacity style={s.headerBtn}>
            <Ionicons name="analytics-outline" size={20} color={NEON} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Income Entry Card ───────────────────────────── */}
          <View style={s.glassCard}>
            <View style={s.neonTopRule} />
            <Text style={s.cardTitle}>Enter Amount</Text>

            <InputField icon="calendar-outline"       placeholder="Date  (e.g. 16 Mar)"  value={incomeForm.date}        onChangeText={t => setIncomeForm(f => ({ ...f, date: t }))} />
            <InputField icon="cash-outline"           placeholder="Cash"                 value={incomeForm.cash}        onChangeText={t => setIncomeForm(f => ({ ...f, cash: t }))}        keyboardType="decimal-pad" />
            <InputField icon="phone-portrait-outline" placeholder="GPay"                 value={incomeForm.gpay}        onChangeText={t => setIncomeForm(f => ({ ...f, gpay: t }))}        keyboardType="decimal-pad" />
            <InputField icon="storefront-outline"     placeholder="Malli Kadai"          value={incomeForm.malliKadai} onChangeText={t => setIncomeForm(f => ({ ...f, malliKadai: t }))} keyboardType="decimal-pad" />
            <InputField icon="cart-outline"           placeholder="Market"               value={incomeForm.market}      onChangeText={t => setIncomeForm(f => ({ ...f, market: t }))}      keyboardType="decimal-pad" />

            <TouchableOpacity onPress={handleUpload} activeOpacity={0.82} style={{ marginTop: 20 }}>
              <LinearGradient
                colors={[NEON_DARK, NEON]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.actionBtn}
              >
                <Ionicons name="cloud-upload-outline" size={18} color="#000" />
                <Text style={s.actionBtnText}>Upload</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* ── Additional Entry Card ───────────────────────── */}
          <View style={s.glassCard}>
            <View style={s.neonTopRule} />
            <TouchableOpacity
              style={s.sectionHeader}
              onPress={() => setAddExpanded(e => !e)}
              activeOpacity={0.78}
            >
              <View>
                <Text style={s.cardTitle}>Additional Entry</Text>
                <Text style={s.cardSubtitle}>Weekly Things</Text>
              </View>
              <View style={[s.chevronBtn, addExpanded && s.chevronBtnActive]}>
                <Ionicons
                  name={addExpanded ? 'chevron-up' : 'chevron-down'}
                  size={17}
                  color={addExpanded ? '#000' : NEON}
                />
              </View>
            </TouchableOpacity>

            {addExpanded && (
              <View style={{ marginTop: 14 }}>
                <InputField icon="calendar-outline" placeholder="Date  (e.g. 16 Mar)" value={addForm.date}   onChangeText={t => setAddForm(f => ({ ...f, date: t }))} />
                <InputField icon="egg-outline"      placeholder="Egg"                 value={addForm.egg}    onChangeText={t => setAddForm(f => ({ ...f, egg: t }))}    keyboardType="decimal-pad" />
                <InputField icon="leaf-outline"     placeholder="Potato"              value={addForm.potato} onChangeText={t => setAddForm(f => ({ ...f, potato: t }))} keyboardType="decimal-pad" />
                <InputField icon="flame-outline"    placeholder="Gas"                 value={addForm.gas}    onChangeText={t => setAddForm(f => ({ ...f, gas: t }))}    keyboardType="decimal-pad" />
                <InputField icon="car-outline"      placeholder="Fuel"                value={addForm.fuel}   onChangeText={t => setAddForm(f => ({ ...f, fuel: t }))}   keyboardType="decimal-pad" />

                <TouchableOpacity onPress={handleAddEntry} activeOpacity={0.82} style={{ marginTop: 18 }}>
                  <LinearGradient
                    colors={['rgba(0,100,50,0.8)', 'rgba(0,180,90,0.9)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.actionBtn}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={NEON} />
                    <Text style={[s.actionBtnText, { color: NEON }]}>Add Entry</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Income History Table ────────────────────────── */}
          <View style={s.tableCard}>
            <View style={s.tableTitleRow}>
              <Ionicons name="receipt-outline" size={15} color={NEON} />
              <Text style={s.tableTitle}>Income History</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <TableHeader kind="income" cols={['Date', 'Cash', 'GPay', 'Malli', 'Market', 'Total', '']} />

                {incomeRows.length === 0 ? (
                  <View style={s.emptyRow}>
                    <Ionicons name="document-outline" size={28} color={MUTED} />
                    <Text style={s.emptyText}>No records yet</Text>
                  </View>
                ) : (
                  incomeRows.map((r, idx) => {
                    const total = numSum([r.cash, r.gpay, r.malliKadai, r.market]);
                    return (
                      <View key={r.id} style={[s.tableRow, idx % 2 !== 0 && { backgroundColor: ROW_ALT }]}>
                        <Text style={[s.tcBase,  { width: colW(0, 'income') }]}>{r.date}</Text>
                        <Text style={[s.tcBase,  { width: colW(1, 'income') }]}>{r.cash       || '—'}</Text>
                        <Text style={[s.tcBase,  { width: colW(2, 'income') }]}>{r.gpay       || '—'}</Text>
                        <Text style={[s.tcBase,  { width: colW(3, 'income') }]}>{r.malliKadai || '—'}</Text>
                        <Text style={[s.tcBase,  { width: colW(4, 'income') }]}>{r.market     || '—'}</Text>
                        <Text style={[s.tcGreen, { width: colW(5, 'income') }]}>{total.toFixed(0)}</Text>
                        <TouchableOpacity
                          style={{ width: colW(6, 'income'), alignItems: 'center', justifyContent: 'center' }}
                          onPress={() => confirmDelete(() => setIncomeRows(p => p.filter(x => x.id !== r.id)))}
                        >
                          <Ionicons name="trash-outline" size={14} color={RED} />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}

                {incomeRows.length > 0 && (
                  <View style={s.totalRow}>
                    <Text style={[s.tcTotal,      { width: colW(0, 'income') }]}>Total</Text>
                    <Text style={[s.tcTotal,      { width: colW(1, 'income') }]}>{incomeTotals.cash.toFixed(0)}</Text>
                    <Text style={[s.tcTotal,      { width: colW(2, 'income') }]}>{incomeTotals.gpay.toFixed(0)}</Text>
                    <Text style={[s.tcTotal,      { width: colW(3, 'income') }]}>{incomeTotals.malliKadai.toFixed(0)}</Text>
                    <Text style={[s.tcTotal,      { width: colW(4, 'income') }]}>{incomeTotals.market.toFixed(0)}</Text>
                    <Text style={[s.tcTotalGreen, { width: colW(5, 'income') }]}>{incomeGrandTotal.toFixed(0)}</Text>
                    <View                           style={{ width: colW(6, 'income') }} />
                  </View>
                )}
              </View>
            </ScrollView>
          </View>

          {/* ── Weekly Entries Table ────────────────────────── */}
          <View style={s.tableCard}>
            <View style={s.tableTitleRow}>
              <Ionicons name="list-outline" size={15} color={NEON} />
              <Text style={s.tableTitle}>Weekly Entries</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <TableHeader kind="add" cols={['Date', 'Egg', 'Potato', 'Gas', 'Fuel', 'Total', '']} />

                {addRows.length === 0 ? (
                  <View style={s.emptyRow}>
                    <Ionicons name="document-outline" size={28} color={MUTED} />
                    <Text style={s.emptyText}>No records yet</Text>
                  </View>
                ) : (
                  addRows.map((r, idx) => {
                    const total = numSum([r.egg, r.potato, r.gas, r.fuel]);
                    return (
                      <View key={r.id} style={[s.tableRow, idx % 2 !== 0 && { backgroundColor: ROW_ALT }]}>
                        <Text style={[s.tcBase,  { width: colW(0, 'add') }]}>{r.date}</Text>
                        <Text style={[s.tcBase,  { width: colW(1, 'add') }]}>{r.egg    || '—'}</Text>
                        <Text style={[s.tcBase,  { width: colW(2, 'add') }]}>{r.potato || '—'}</Text>
                        <Text style={[s.tcBase,  { width: colW(3, 'add') }]}>{r.gas    || '—'}</Text>
                        <Text style={[s.tcBase,  { width: colW(4, 'add') }]}>{r.fuel   || '—'}</Text>
                        <Text style={[s.tcGreen, { width: colW(5, 'add') }]}>{total.toFixed(0)}</Text>
                        <TouchableOpacity
                          style={{ width: colW(6, 'add'), alignItems: 'center', justifyContent: 'center' }}
                          onPress={() => confirmDelete(() => setAddRows(p => p.filter(x => x.id !== r.id)))}
                        >
                          <Ionicons name="trash-outline" size={14} color={RED} />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}

                {addRows.length > 0 && (
                  <View style={s.totalRow}>
                    <Text style={[s.tcTotal,      { width: colW(0, 'add') }]}>Total</Text>
                    <Text style={[s.tcTotal,      { width: colW(1, 'add') }]}>{addTotals.egg.toFixed(0)}</Text>
                    <Text style={[s.tcTotal,      { width: colW(2, 'add') }]}>{addTotals.potato.toFixed(0)}</Text>
                    <Text style={[s.tcTotal,      { width: colW(3, 'add') }]}>{addTotals.gas.toFixed(0)}</Text>
                    <Text style={[s.tcTotal,      { width: colW(4, 'add') }]}>{addTotals.fuel.toFixed(0)}</Text>
                    <Text style={[s.tcTotalGreen, { width: colW(5, 'add') }]}>{addGrandTotal.toFixed(0)}</Text>
                    <View                           style={{ width: colW(6, 'add') }} />
                  </View>
                )}
              </View>
            </ScrollView>
          </View>

          {/* bottom padding – prevents FAB from overlapping last card */}
          <View style={{ height: 130 }} />
        </ScrollView>

        {/* ── FAB ──────────────────────────────────────────── */}
        <View style={s.fab}>
          <LinearGradient colors={[NEON_DARK, NEON]} style={s.fabGradient}>
            <Ionicons name="add" size={28} color="#000" />
          </LinearGradient>
        </View>

        {/* ── Bottom Navigation ────────────────────────────── */}
        <BottomNavBar />
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ─── Styles ────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 46 : 10,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 6,
  },

  /* Glass card */
  glassCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 10,
  },
  neonTopRule: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1.5,
    backgroundColor: NEON,
    opacity: 0.55,
    borderRadius: 1,
  },
  cardTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.25,
  },
  cardSubtitle: {
    color: NEON,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.85,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chevronBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,255,136,0.06)',
  },
  chevronBtnActive: {
    backgroundColor: NEON,
    borderColor: NEON,
  },

  /* Input */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: INPUT_BDR,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 10,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: TEXT,
    fontSize: 14,
    fontWeight: '500',
  },

  /* Action buttons */
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
  },
  actionBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },

  /* Table card */
  tableCard: {
    backgroundColor: 'rgba(0,14,32,0.72)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.16)',
    padding: 16,
    marginBottom: 16,
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 6,
  },
  tableTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  tableTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: TH_BG,
    borderRadius: 9,
    paddingVertical: 8,
    marginBottom: 2,
  },
  tableHeaderCell: {
    color: NEON,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },

  /* Table cells */
  tcBase: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 12,
    textAlign: 'center',
  },
  tcGreen: {
    color: NEON,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* Totals row */
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    marginTop: 4,
    backgroundColor: 'rgba(0,255,136,0.07)',
    borderRadius: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,136,0.22)',
    alignItems: 'center',
  },
  tcTotal: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  tcTotalGreen: {
    color: NEON,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },

  /* Empty state */
  emptyRow: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
    minWidth: W - 60,
  },
  emptyText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '500',
  },

  /* FAB */
  fab: {
    position: 'absolute',
    bottom: 88,
    right: 20,
    borderRadius: 30,
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.60,
    shadowRadius: 14,
    elevation: 14,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
