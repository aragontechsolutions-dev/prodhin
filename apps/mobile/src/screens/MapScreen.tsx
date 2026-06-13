import { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMyCustomers } from '../hooks/useMyCustomers';
import { getDisplayName } from '../types';
import type { Customer } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Map'>;

const DEFAULT_REGION: Region = {
  latitude: 10.4696,
  longitude: -66.9036,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export default function MapScreen() {
  const { profile, signOut } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: customers, isLoading, isFetching, refetch } = useMyCustomers(profile?.id);
  const navigation = useNavigation<Nav>();
  const mapRef = useRef<MapView>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleMarkerPress(c: Customer) {
    setSelectedId(c.id);
    mapRef.current?.animateToRegion(
      {
        latitude: c.lat,
        longitude: c.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      400,
    );
  }

  function openDetail(c: Customer) {
    navigation.navigate('CustomerDetail', { customer: c });
  }

  return (
    <View style={styles.container}>
      {/* Banner offline */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📵  Sin conexión — mostrando datos guardados
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, !isOnline && styles.headerOffline]}>
        <View>
          <Text style={styles.headerTitle}>Mis clientes</Text>
          <Text style={styles.headerSub}>
            {isLoading ? 'Cargando...' : `${customers?.length ?? 0} asignados`}
            {isFetching && !isLoading ? ' · actualizando...' : ''}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => refetch()}
            style={[styles.iconBtn, !isOnline && styles.iconBtnDisabled]}
            disabled={!isOnline}
          >
            <Text style={styles.iconBtnText}>↻</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>⏻</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mapa */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton
      >
        {(customers ?? []).map((c) => (
          <Marker
            key={c.id}
            coordinate={{ latitude: c.lat, longitude: c.lng }}
            pinColor={selectedId === c.id ? '#f59e0b' : '#ef4444'}
            onPress={() => handleMarkerPress(c)}
          >
            <Callout onPress={() => openDetail(c)}>
              <View style={styles.callout}>
                <Text style={styles.calloutName}>{getDisplayName(c)}</Text>
                <Text style={styles.calloutPhone}>{c.phone}</Text>
                <Text style={styles.calloutAddress} numberOfLines={2}>
                  {c.address}
                </Text>
                <Text style={styles.calloutAction}>Ver detalles →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Loading overlay (primera carga) */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Cargando clientes...</Text>
        </View>
      )}

      {/* Barra de estado inferior */}
      {!isLoading && (
        <View style={[styles.statusBar, !isOnline && styles.statusBarOffline]}>
          <Text style={[styles.statusText, !isOnline && styles.statusTextOffline]}>
            {profile?.full_name}
            {customers && customers.length > 0
              ? ` · ${customers.length} cliente${customers.length !== 1 ? 's' : ''}`
              : ' · Sin clientes asignados'}
            {!isOnline ? ' · OFFLINE' : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  offlineBanner: {
    backgroundColor: '#dc2626',
    paddingVertical: 6,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 6,
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
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
  headerOffline: {
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: {
    opacity: 0.4,
  },
  iconBtnText: {
    fontSize: 16,
    color: '#374151',
  },
  map: {
    flex: 1,
  },
  callout: {
    width: 200,
    padding: 8,
  },
  calloutName: {
    fontWeight: '700',
    fontSize: 13,
    color: '#111827',
    marginBottom: 2,
  },
  calloutPhone: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  calloutAddress: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 6,
  },
  calloutAction: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fffbeb',
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
  },
  statusBarOffline: {
    backgroundColor: '#fee2e2',
    borderTopColor: '#fca5a5',
  },
  statusText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
    textAlign: 'center',
  },
  statusTextOffline: {
    color: '#991b1b',
  },
});
