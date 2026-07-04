import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getDisplayName, type Customer, type EggType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useMyCustomers } from '../hooks/useMyCustomers';
import { useEggTypes } from '../hooks/useEggTypes';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CustomerPreferences'>;

const PAGE_SIZE = 12;

function eggDotColor(color: EggType['color']): string {
  if (color === 'rojo') return '#ef4444';
  if (color === 'blanco') return '#d1d5db';
  return '#f59e0b';
}

export default function CustomerPreferencesScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const { data: myCustomers, isLoading } = useMyCustomers(profile?.id);
  const { data: eggTypes } = useEggTypes();

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const eggMap = useMemo(() => {
    const m = new Map<string, EggType>();
    (eggTypes ?? []).forEach((t) => m.set(t.id, t));
    return m;
  }, [eggTypes]);

  const allCustomers = useMemo(() => {
    const own = myCustomers?.own ?? [];
    const delegated = myCustomers?.delegated ?? [];
    return [...own, ...delegated].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b)),
    );
  }, [myCustomers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCustomers;
    return allCustomers.filter((c) => {
      const name = getDisplayName(c).toLowerCase();
      const addr = (c.address ?? '').toLowerCase();
      const egg = c.preferred_egg_type_id
        ? (eggMap.get(c.preferred_egg_type_id)?.name ?? '').toLowerCase()
        : '';
      return name.includes(q) || addr.includes(q) || egg.includes(q);
    });
  }, [allCustomers, query, eggMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function onSearch(text: string) {
    setQuery(text);
    setPage(1);
  }

  function renderItem({ item: c }: { item: Customer }) {
    const egg = c.preferred_egg_type_id ? eggMap.get(c.preferred_egg_type_id) : undefined;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('CustomerDetail', { customer: c })}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{getDisplayName(c)}</Text>
          <Text style={styles.addr} numberOfLines={1}>{c.address}</Text>
        </View>
        {egg ? (
          <View style={styles.eggChip}>
            <View style={[styles.eggDot, { backgroundColor: eggDotColor(egg.color) }]} />
            <Text style={styles.eggName}>{egg.name}</Text>
          </View>
        ) : (
          <View style={styles.noEggChip}>
            <Text style={styles.noEggText}>Sin preferencia</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Tipos de huevo por cliente</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Buscador */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={onSearch}
          placeholder="Buscar cliente, dirección o tipo…"
          placeholderTextColor="#9ca3af"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => onSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#f59e0b" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={pageItems}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🥚</Text>
              <Text style={styles.emptyText}>
                {query ? 'Sin resultados' : 'No tenés clientes asignados'}
              </Text>
            </View>
          }
        />
      )}

      {/* Paginación */}
      {!isLoading && filtered.length > 0 && (
        <View style={styles.pager}>
          <TouchableOpacity
            style={[styles.pagerBtn, safePage <= 1 && styles.pagerBtnDisabled]}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >
            <Text style={[styles.pagerBtnText, safePage <= 1 && styles.pagerBtnTextDisabled]}>‹ Anterior</Text>
          </TouchableOpacity>
          <Text style={styles.pagerInfo}>
            {safePage} / {totalPages}
            <Text style={styles.pagerCount}>  ·  {filtered.length} clientes</Text>
          </Text>
          <TouchableOpacity
            style={[styles.pagerBtn, safePage >= totalPages && styles.pagerBtnDisabled]}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            <Text style={[styles.pagerBtnText, safePage >= totalPages && styles.pagerBtnTextDisabled]}>Siguiente ›</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 14, color: '#92400e', fontWeight: '700' },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: 46,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  clearIcon: { fontSize: 15, color: '#9ca3af', paddingHorizontal: 4 },
  listContent: { padding: 16, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  name: { fontSize: 15, fontWeight: '700', color: '#111827' },
  addr: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  eggChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    maxWidth: 150,
  },
  eggDot: { width: 10, height: 10, borderRadius: 5 },
  eggName: { fontSize: 12, fontWeight: '700', color: '#1d4ed8' },
  noEggChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  noEggText: { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  pagerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  pagerBtnDisabled: { backgroundColor: '#f9fafb', borderColor: '#f3f4f6' },
  pagerBtnText: { fontSize: 13, fontWeight: '700', color: '#92400e' },
  pagerBtnTextDisabled: { color: '#d1d5db' },
  pagerInfo: { fontSize: 13, fontWeight: '700', color: '#374151' },
  pagerCount: { fontSize: 12, fontWeight: '500', color: '#9ca3af' },
});
