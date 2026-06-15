import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMyCustomers } from '../hooks/useMyCustomers';
import { getDisplayName } from '../types';
import type { Customer } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useInactivityTimer } from '../hooks/useInactivityTimer';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Map'>;

function buildMapHtml(own: Customer[], delegated: Customer[], userLat?: number, userLng?: number): string {
  const toMarker = (c: Customer, isDelegated: boolean) => ({
    id: c.id,
    lat: c.lat,
    lng: c.lng,
    name: getDisplayName(c).replace(/'/g, "\\'"),
    phone: (c.phone ?? '').replace(/'/g, "\\'"),
    address: (c.address ?? '').replace(/'/g, "\\'"),
    delegated: isDelegated,
  });
  const markers = [
    ...own.map((c) => toMarker(c, false)),
    ...delegated.map((c) => toMarker(c, true)),
  ];

  const userMarker =
    userLat != null && userLng != null
      ? `L.circleMarker([${userLat}, ${userLng}], {
          radius: 9,
          fillColor: '#2563eb',
          color: '#ffffff',
          weight: 3,
          fillOpacity: 1,
        }).bindPopup('Mi ubicación').addTo(map);`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f3f4f6; }
    #map { width: 100vw; height: 100vh; }
    .popup-btn {
      display: inline-block;
      margin-top: 6px;
      padding: 4px 10px;
      background: #f59e0b;
      color: #fff;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true }).setView([-34.9011, -54.9595], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  var redIcon = L.divIcon({
    html: '<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);"></div>',
    iconSize: [16, 16], iconAnchor: [8, 8], className: '',
  });

  var orangeIcon = L.divIcon({
    html: '<div style="background:#f97316;width:16px;height:16px;border-radius:4px;border:2.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);transform:rotate(45deg);"></div>',
    iconSize: [16, 16], iconAnchor: [8, 8], className: '',
  });

  var customers = ${JSON.stringify(markers)};

  customers.forEach(function(c) {
    var badge = c.delegated ? '<br><span style="font-size:9px;background:#f97316;color:#fff;padding:1px 5px;border-radius:3px;font-weight:600;">EN COBERTURA</span>' : '';
    var popup = badge +
      '<b style="font-size:13px;">' + c.name + '</b>' +
      '<br><span style="font-size:11px;color:#6b7280;">' + c.phone + '</span>' +
      '<br><span style="font-size:10px;color:#9ca3af;">' + c.address + '</span>' +
      '<br><a class="popup-btn" onclick="window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:\\'navigate\\',id:\\''+c.id+'\\'}))" href="#">Ver detalles →</a>';

    L.marker([c.lat, c.lng], { icon: c.delegated ? orangeIcon : redIcon })
      .bindPopup(popup, { maxWidth: 200 })
      .addTo(map);
  });

  ${userMarker}
<\/script>
</body>
</html>`;
}

export default function MapScreen() {
  const { profile, signOut } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: myCustomers, isLoading, isFetching, refetch } = useMyCustomers(profile?.id);
  const ownCustomers = myCustomers?.own ?? [];
  const delegatedCustomers = myCustomers?.delegated ?? [];
  const allCustomers = [...ownCustomers, ...delegatedCustomers];
  const navigation = useNavigation<Nav>();
  const webViewRef = useRef<WebView>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const { resetTimers } = useInactivityTimer(signOut);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  function handleMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'navigate' && msg.id) {
        const customer = allCustomers.find((c) => c.id === msg.id);
        if (customer) navigation.navigate('CustomerDetail', { customer });
      }
    } catch {
      // ignore malformed messages
    }
  }

  const html = buildMapHtml(ownCustomers, delegatedCustomers, userLocation?.lat, userLocation?.lng);

  return (
    <View style={styles.container} onTouchStart={resetTimers}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📵  Sin conexión — mostrando datos guardados
          </Text>
        </View>
      )}

      <View style={[styles.header, !isOnline && styles.headerOffline]}>
        <View>
          <Text style={styles.headerTitle}>Mis clientes</Text>
          <Text style={styles.headerSub}>
            {isLoading ? 'Cargando...' : `${ownCustomers.length} propios${delegatedCustomers.length > 0 ? ` · ${delegatedCustomers.length} en cobertura` : ''}`}
            {isFetching && !isLoading ? ' · actualizando...' : ''}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => refetch()}
            style={[styles.refreshBtn, (!isOnline || isFetching) && styles.refreshBtnDisabled]}
            disabled={!isOnline || isFetching}
          >
            {isFetching && !isLoading ? (
              <ActivityIndicator size="small" color="#92400e" />
            ) : (
              <Text style={styles.refreshBtnText}>↻ Actualizar</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
            <Text style={styles.signOutBtnText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        onMessage={handleMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.webviewLoading}>
            <ActivityIndicator size="large" color="#f59e0b" />
          </View>
        )}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Cargando clientes...</Text>
        </View>
      )}

      {showDebug && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>🔍 Debug info (toca para cerrar)</Text>
          <TouchableOpacity onPress={() => setShowDebug(false)}>
            <Text style={styles.debugText}>{myCustomers?.debug ?? 'Sin datos aún'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && (
        <TouchableOpacity onPress={() => setShowDebug((v) => !v)} style={[styles.statusBar, !isOnline && styles.statusBarOffline]}>
          <Text style={[styles.statusText, !isOnline && styles.statusTextOffline]}>
            {profile?.full_name}
            {allCustomers.length > 0
              ? ` · ${ownCustomers.length} propios${delegatedCustomers.length > 0 ? ` + ${delegatedCustomers.length} cobertura` : ''}`
              : ' · Sin clientes asignados'}
            {!isOnline ? ' · OFFLINE' : ''}
            {' · toca para debug'}
          </Text>
        </TouchableOpacity>
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
  refreshBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  refreshBtnDisabled: {
    opacity: 0.45,
  },
  refreshBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  signOutBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  map: {
    flex: 1,
  },
  webviewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
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
  debugPanel: {
    position: 'absolute',
    bottom: 48,
    left: 8,
    right: 8,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    zIndex: 100,
  },
  debugTitle: {
    color: '#facc15',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 6,
  },
  debugText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
