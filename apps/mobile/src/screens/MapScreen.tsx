import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  FlatList,
  Keyboard,
  Modal,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMyCustomers } from '../hooks/useMyCustomers';
import { useMyRoute, getTodayDayOfWeek, isSummerSeason, type MyRouteResult } from '../hooks/useMyRoute';
import { getDisplayName } from '../types';
import type { Customer } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useInactivityTimer } from '../hooks/useInactivityTimer';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Map'>;
type MarkerKind = 'route' | 'route-visited' | 'own' | 'delegated';
type DrawerView = 'map' | 'route';

const DRAWER_WIDTH = Dimensions.get('window').width * 0.78;
const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function buildMapHtml(
  own: Customer[],
  delegated: Customer[],
  todayRouteIds: Set<string>,
  visitedIds: Set<string>,
  userLat?: number,
  userLng?: number,
): string {
  const toMarker = (c: Customer, isDelegated: boolean) => {
    let kind: MarkerKind;
    if (todayRouteIds.has(c.id)) {
      kind = visitedIds.has(c.id) ? 'route-visited' : 'route';
    } else {
      kind = isDelegated ? 'delegated' : 'own';
    }
    return {
      id: c.id,
      lat: c.lat,
      lng: c.lng,
      name: getDisplayName(c).replace(/'/g, "\\'"),
      phone: (c.phone ?? '').replace(/'/g, "\\'"),
      address: (c.address ?? '').replace(/'/g, "\\'"),
      kind,
    };
  };

  const markers = [
    ...own.map((c) => toMarker(c, false)),
    ...delegated.map((c) => toMarker(c, true)),
  ];

  const userMarker =
    userLat != null && userLng != null
      ? `L.circleMarker([${userLat}, ${userLng}], {
          radius: 9, fillColor: '#2563eb', color: '#ffffff', weight: 3, fillOpacity: 1,
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
    .popup-btn { display:inline-block;margin-top:6px;padding:4px 10px;background:#f59e0b;color:#fff;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer; }
    .visit-btn { display:inline-block;margin-top:4px;margin-left:4px;padding:4px 10px;background:#16a34a;color:#fff;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer; }
    @keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(22,163,74,.6)} 70%{box-shadow:0 0 0 10px rgba(22,163,74,0)} 100%{box-shadow:0 0 0 0 rgba(22,163,74,0)} }
    .pulse { animation: pulse 1.8s infinite; border-radius: 50%; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true }).setView([-34.9011, -54.9595], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map);

  var redIcon = L.divIcon({ html: '<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);opacity:0.7;"></div>', iconSize:[14,14],iconAnchor:[7,7],className:'' });
  var orangeIcon = L.divIcon({ html: '<div style="background:#f97316;width:14px;height:14px;border-radius:4px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);transform:rotate(45deg);opacity:0.7;"></div>', iconSize:[14,14],iconAnchor:[7,7],className:'' });
  var routeIcon = L.divIcon({ html: '<div class="pulse" style="background:#16a34a;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>', iconSize:[20,20],iconAnchor:[10,10],className:'' });
  var visitedIcon = L.divIcon({ html: '<div style="background:#9ca3af;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:10px;font-weight:bold;">✓<\/span><\/div>', iconSize:[16,16],iconAnchor:[8,8],className:'' });
  var highlightIcon = L.divIcon({ html: '<div style="background:#7c3aed;width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(124,58,237,0.4);"></div>', iconSize:[22,22],iconAnchor:[11,11],className:'' });
  var iconMap = { route: routeIcon, 'route-visited': visitedIcon, own: redIcon, delegated: orangeIcon };

  var markerRefs = {};
  var customers = ${JSON.stringify(markers)};

  customers.forEach(function(c) {
    var routeBadge = (c.kind==='route'||c.kind==='route-visited') ? '<br><span style="font-size:9px;background:#16a34a;color:#fff;padding:1px 5px;border-radius:3px;font-weight:600;">'+(c.kind==='route-visited'?'✓ VISITADO':'RUTA HOY')+'<\/span>' : '';
    var delegBadge = c.kind==='delegated' ? '<br><span style="font-size:9px;background:#f97316;color:#fff;padding:1px 5px;border-radius:3px;font-weight:600;">EN COBERTURA<\/span>' : '';
    var visitBtn = c.kind==='route' ? '<a class="visit-btn" onclick="window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:\\'visited\\',id:\\''+c.id+'\\'}))">✓ Marcar visitado<\/a>' : '';
    var popup = routeBadge+delegBadge+'<b style="font-size:13px;">'+c.name+'<\/b><br><span style="font-size:11px;color:#6b7280;">'+c.phone+'<\/span><br><span style="font-size:10px;color:#9ca3af;">'+c.address+'<\/span><br><a class="popup-btn" onclick="window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:\\'navigate\\',id:\\''+c.id+'\\'}))">Ver detalles →<\/a>'+visitBtn;
    var m = L.marker([c.lat,c.lng],{icon:iconMap[c.kind]||redIcon}).bindPopup(popup,{maxWidth:220}).addTo(map);
    markerRefs[c.id] = m;
  });

  ${userMarker}

  document.addEventListener('message', handleCmd);
  window.addEventListener('message', handleCmd);
  function handleCmd(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type==='highlight'&&msg.id&&markerRefs[msg.id]) { map.flyTo(markerRefs[msg.id].getLatLng(),16,{duration:0.8}); markerRefs[msg.id].setIcon(highlightIcon); markerRefs[msg.id].openPopup(); }
      if (msg.type==='clearHighlight'&&msg.id&&markerRefs[msg.id]) { var c=customers.find(function(x){return x.id===msg.id}); if(c) markerRefs[msg.id].setIcon(iconMap[c.kind]||redIcon); }
      if (msg.type==='markVisited'&&msg.id&&markerRefs[msg.id]) { markerRefs[msg.id].setIcon(visitedIcon); var c=customers.find(function(x){return x.id===msg.id}); if(c) c.kind='route-visited'; markerRefs[msg.id].closePopup(); }
    } catch(err) {}
  }
<\/script>
</body>
</html>`;
}

export default function MapScreen() {
  const { profile, signOut } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: myCustomers, isLoading, isFetching, refetch } = useMyCustomers(profile?.id);
  const { data: routeData, refetch: refetchRoute } = useMyRoute(profile?.id);
  const routeFound = routeData?.routeFound ?? false;
  const routeStops = routeData?.stops ?? [];
  const ownCustomers = myCustomers?.own ?? [];
  const delegatedCustomers = myCustomers?.delegated ?? [];
  const allCustomers = [...ownCustomers, ...delegatedCustomers];
  const navigation = useNavigation<Nav>();
  const webViewRef = useRef<WebView>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [lastHighlighted, setLastHighlighted] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);

  // Route alert modal
  const [routeAlertVisible, setRouteAlertVisible] = useState(false);
  const [routeAlertCountdown, setRouteAlertCountdown] = useState(8);

  // Inactivity modals
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const [inactivityLogout, setInactivityLogout] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>('map');
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const todayDow = getTodayDayOfWeek();
  const summer = isSummerSeason();
  const hasRouteToday = todayDow >= 1 && (summer ? todayDow <= 6 : todayDow <= 5);

  const todayRouteIds = new Set(
    hasRouteToday
      ? routeStops.filter((s) => s.day_of_week === todayDow).map((s) => s.customer_id)
      : [],
  );
  const todayCount = todayRouteIds.size;
  const visitedCount = [...visitedIds].filter((id) => todayRouteIds.has(id)).length;

  const todayRouteCustomers = allCustomers.filter((c) => todayRouteIds.has(c.id));
  const pendingCustomers = todayRouteCustomers.filter((c) => !visitedIds.has(c.id));
  const visitedCustomers = todayRouteCustomers.filter((c) => visitedIds.has(c.id));

  // Inactivity timer
  const { resetTimers } = useInactivityTimer(
    signOut,
    () => setInactivityWarning(true),
    () => { setInactivityWarning(false); setInactivityLogout(true); },
  );

  // Drawer animation
  function openDrawer() {
    setDrawerOpen(true);
    Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
  }
  function closeDrawer() {
    Animated.spring(drawerAnim, { toValue: -DRAWER_WIDTH, useNativeDriver: true, speed: 20, bounciness: 0 }).start(() => setDrawerOpen(false));
  }

  // Re-mount map when route data changes
  useEffect(() => {
    if (routeData !== undefined) setMapKey((k) => k + 1);
  }, [routeData]);

  // Route alert
  useEffect(() => {
    if (isLoading || routeData === undefined) return;
    const noRoute = hasRouteToday && !routeFound;
    const noStopsToday = hasRouteToday && routeFound && todayCount === 0;
    if (noRoute || noStopsToday) {
      setRouteAlertVisible(true);
      setRouteAlertCountdown(8);
    }
  }, [isLoading, routeData, todayCount]);

  useEffect(() => {
    if (!routeAlertVisible) return;
    if (routeAlertCountdown <= 0) { setRouteAlertVisible(false); return; }
    const t = setTimeout(() => setRouteAlertCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [routeAlertVisible, routeAlertCountdown]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  const searchResults = searchQuery.trim().length >= 1
    ? allCustomers.filter((c) => {
        const q = searchQuery.toLowerCase();
        return getDisplayName(c).toLowerCase().includes(q) || (c.tax_id ?? '').toLowerCase().includes(q);
      }).slice(0, 6)
    : [];

  const sendToMap = useCallback((msg: object) => {
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify(msg))} })); true;`
    );
  }, []);

  function handleSelectSearchResult(customer: Customer) {
    if (lastHighlighted && lastHighlighted !== customer.id) sendToMap({ type: 'clearHighlight', id: lastHighlighted });
    sendToMap({ type: 'highlight', id: customer.id });
    setLastHighlighted(customer.id);
    setSearchQuery(getDisplayName(customer));
    setSearchFocused(false);
    Keyboard.dismiss();
  }

  function handleMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'navigate' && msg.id) {
        const customer = allCustomers.find((c) => c.id === msg.id);
        if (customer) navigation.navigate('CustomerDetail', { customer });
      }
      if (msg.type === 'visited' && msg.id) {
        setVisitedIds((prev) => new Set([...prev, msg.id]));
        sendToMap({ type: 'markVisited', id: msg.id });
      }
    } catch { }
  }

  const html = buildMapHtml(ownCustomers, delegatedCustomers, todayRouteIds, visitedIds, userLocation?.lat, userLocation?.lng);

  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const initial = profile?.full_name?.[0]?.toUpperCase() ?? '?';

  return (
    <View style={styles.container} onTouchStart={resetTimers}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>📵  Sin conexión — mostrando datos guardados</Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, !isOnline && styles.headerOffline]}>
        <TouchableOpacity onPress={openDrawer} style={styles.hamburgerBtn}>
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => { setRouteAlertVisible(false); refetch(); refetchRoute(); }}
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

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar cliente por nombre o RUT..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={(t) => { setSearchQuery(t); setSearchFocused(true); }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => {
              if (lastHighlighted) sendToMap({ type: 'clearHighlight', id: lastHighlighted });
              setSearchQuery('');
              setLastHighlighted(null);
            }}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {searchFocused && searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            <FlatList
              data={searchResults}
              keyExtractor={(c) => c.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchItem} onPress={() => handleSelectSearchResult(item)}>
                  <Text style={styles.searchItemName}>{getDisplayName(item)}</Text>
                  <Text style={styles.searchItemSub}>{item.address}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* Map */}
      <WebView
        key={mapKey}
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

      {/* Route progress banner */}
      {!isLoading && hasRouteToday && todayCount > 0 && (
        <View style={styles.routeBanner}>
          <View style={styles.routeDot} />
          <Text style={styles.routeBannerText}>
            Ruta {DAY_NAMES[todayDow]} · {visitedCount}/{todayCount} visitados
          </Text>
        </View>
      )}
      {!isLoading && !hasRouteToday && (
        <View style={[styles.routeBanner, styles.routeBannerOff]}>
          <Text style={styles.routeBannerTextOff}>
            {todayDow === -1 ? 'Domingo — sin ruta' : 'Sábado — fuera de temporada de verano'}
          </Text>
        </View>
      )}

      {/* Status bar */}
      {!isLoading && (
        <View style={[styles.statusBar, !isOnline && styles.statusBarOffline]}>
          <Text style={[styles.statusText, !isOnline && styles.statusTextOffline]}>
            {profile?.full_name}
            {allCustomers.length > 0
              ? ` · ${ownCustomers.length} propios${delegatedCustomers.length > 0 ? ` + ${delegatedCustomers.length} cobertura` : ''}`
              : ' · Sin clientes asignados'}
            {!isOnline ? ' · OFFLINE' : ''}
          </Text>
        </View>
      )}

      {/* ── Drawer ── */}
      {drawerOpen && (
        <TouchableOpacity style={styles.drawerOverlay} activeOpacity={1} onPress={closeDrawer} />
      )}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
        {/* Greeting */}
        <View style={styles.drawerHeader}>
          <View style={styles.drawerAvatar}>
            <Text style={styles.drawerAvatarText}>{initial}</Text>
          </View>
          <View>
            <Text style={styles.drawerGreeting}>Hola, {firstName} 👋</Text>
            <Text style={styles.drawerRole}>Chofer</Text>
          </View>
        </View>

        {/* Nav */}
        <View style={styles.drawerNav}>
          <TouchableOpacity
            style={[styles.drawerNavItem, drawerView === 'map' && styles.drawerNavItemActive]}
            onPress={() => { setDrawerView('map'); closeDrawer(); }}
          >
            <Text style={styles.drawerNavIcon}>🗺️</Text>
            <Text style={[styles.drawerNavLabel, drawerView === 'map' && styles.drawerNavLabelActive]}>Mis clientes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.drawerNavItem, drawerView === 'route' && styles.drawerNavItemActive]}
            onPress={() => setDrawerView('route')}
          >
            <Text style={styles.drawerNavIcon}>📋</Text>
            <Text style={[styles.drawerNavLabel, drawerView === 'route' && styles.drawerNavLabelActive]}>
              Ruta de hoy
              {todayCount > 0 && (
                <Text style={styles.drawerNavBadge}> · {visitedCount}/{todayCount}</Text>
              )}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Route view inside drawer */}
        {drawerView === 'route' && (
          <ScrollView style={styles.drawerContent} contentContainerStyle={{ paddingBottom: 24 }}>
            {!hasRouteToday ? (
              <View style={styles.drawerEmpty}>
                <Text style={styles.drawerEmptyIcon}>😴</Text>
                <Text style={styles.drawerEmptyText}>Hoy no hay ruta configurada</Text>
              </View>
            ) : !routeFound ? (
              <View style={styles.drawerEmpty}>
                <Text style={styles.drawerEmptyIcon}>🗺️</Text>
                <Text style={styles.drawerEmptyText}>Sin ruta asignada</Text>
                <Text style={styles.drawerEmptySub}>Contactá al administrador</Text>
              </View>
            ) : todayCount === 0 ? (
              <View style={styles.drawerEmpty}>
                <Text style={styles.drawerEmptyIcon}>📋</Text>
                <Text style={styles.drawerEmptyText}>Sin clientes para el {DAY_NAMES[todayDow]}</Text>
                <Text style={styles.drawerEmptySub}>Contactá al administrador</Text>
              </View>
            ) : (
              <>
                {/* Pending */}
                <Text style={styles.drawerSectionTitle}>
                  ⏳ Pendientes ({pendingCustomers.length})
                </Text>
                {pendingCustomers.length === 0 ? (
                  <Text style={styles.drawerAllDone}>¡Todos visitados! 🎉</Text>
                ) : (
                  pendingCustomers.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.drawerCustomerCard}
                      onPress={() => { closeDrawer(); setTimeout(() => handleSelectSearchResult(c), 350); }}
                    >
                      <View style={styles.drawerDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.drawerCustomerName}>{getDisplayName(c)}</Text>
                        <Text style={styles.drawerCustomerAddr}>{c.address}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}

                {/* Visited */}
                {visitedCustomers.length > 0 && (
                  <>
                    <Text style={[styles.drawerSectionTitle, { marginTop: 16 }]}>
                      ✅ Visitados ({visitedCustomers.length})
                    </Text>
                    {visitedCustomers.map((c) => (
                      <View key={c.id} style={[styles.drawerCustomerCard, styles.drawerCustomerCardVisited]}>
                        <View style={[styles.drawerDot, styles.drawerDotVisited]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.drawerCustomerName, styles.drawerCustomerNameVisited]}>{getDisplayName(c)}</Text>
                          <Text style={styles.drawerCustomerAddr}>{c.address}</Text>
                        </View>
                        <Text style={styles.drawerCheckmark}>✓</Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </ScrollView>
        )}
      </Animated.View>

      {/* Route alert modal */}
      <Modal visible={routeAlertVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconRow}>
              <Text style={styles.modalIcon}>{!routeFound ? '🗺️' : '📋'}</Text>
            </View>
            <Text style={styles.modalTitle}>
              {!routeFound ? 'Sin ruta configurada' : `Sin clientes para el ${DAY_NAMES[todayDow]}`}
            </Text>
            <Text style={styles.modalMessage}>
              {!routeFound
                ? 'No tenés una ruta de reparto asignada. Contactá al administrador.'
                : `Tu ruta existe pero no tiene clientes asignados para el ${DAY_NAMES[todayDow]}. Contactá al administrador.`}
            </Text>
            <View style={styles.modalFooter}>
              <View style={styles.modalCountdownBox}>
                <Text style={styles.modalCountdown}>{routeAlertCountdown}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setRouteAlertVisible(false)}>
                <Text style={styles.modalCloseBtnText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Inactivity warning modal */}
      <Modal visible={inactivityWarning} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconRow}>
              <Text style={styles.modalIcon}>⏰</Text>
            </View>
            <Text style={styles.modalTitle}>Sesión a punto de expirar</Text>
            <Text style={styles.modalMessage}>
              Tu sesión se cerrará en 1 minuto por inactividad.
            </Text>
            <TouchableOpacity
              style={[styles.modalCloseBtn, { width: '100%' }]}
              onPress={() => { setInactivityWarning(false); resetTimers(); }}
            >
              <Text style={styles.modalCloseBtnText}>Seguir conectado</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Inactivity logout modal (auto-dismisses after signOut navigates away) */}
      <Modal visible={inactivityLogout} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconRow}>
              <Text style={styles.modalIcon}>🔒</Text>
            </View>
            <Text style={styles.modalTitle}>Sesión cerrada</Text>
            <Text style={styles.modalMessage}>
              Tu sesión fue cerrada automáticamente por inactividad.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  offlineBanner: { backgroundColor: '#dc2626', paddingVertical: 6, paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 50 : 6 },
  offlineBannerText: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  headerOffline: { paddingTop: 12 },
  hamburgerBtn: { padding: 8, gap: 5, justifyContent: 'center' },
  hamburgerLine: { width: 22, height: 2.5, backgroundColor: '#374151', borderRadius: 2 },
  headerRight: { flexDirection: 'row', gap: 8 },
  refreshBtn: { height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: '#fef3c7', borderWidth: 1.5, borderColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', minWidth: 44 },
  refreshBtnDisabled: { opacity: 0.45 },
  refreshBtnText: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  signOutBtn: { height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  signOutBtnText: { fontSize: 14, fontWeight: '700', color: '#dc2626' },
  searchContainer: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', zIndex: 10 },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 10, height: 40 },
  searchIcon: { fontSize: 14, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 13, color: '#111827', paddingVertical: 0 },
  searchClear: { fontSize: 14, color: '#9ca3af', paddingLeft: 6 },
  searchDropdown: { position: 'absolute', top: 58, left: 12, right: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8, maxHeight: 260, zIndex: 20 },
  searchItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  searchItemName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  searchItemSub: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  map: { flex: 1 },
  webviewLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#6b7280' },
  routeBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#f0fdf4', borderTopWidth: 1, borderTopColor: '#bbf7d0' },
  routeBannerOff: { backgroundColor: '#f9fafb', borderTopColor: '#e5e7eb' },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' },
  routeBannerText: { fontSize: 12, fontWeight: '600', color: '#15803d' },
  routeBannerTextOff: { fontSize: 12, color: '#9ca3af' },
  statusBar: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fffbeb', borderTopWidth: 1, borderTopColor: '#fde68a' },
  statusBarOffline: { backgroundColor: '#fee2e2', borderTopColor: '#fca5a5' },
  statusText: { fontSize: 12, color: '#92400e', fontWeight: '500', textAlign: 'center' },
  statusTextOffline: { color: '#991b1b' },

  // Drawer
  drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 40 },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: DRAWER_WIDTH, backgroundColor: '#fff',
    zIndex: 50, shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 16,
  },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fffbeb' },
  drawerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  drawerAvatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  drawerGreeting: { fontSize: 16, fontWeight: '700', color: '#111827' },
  drawerRole: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  drawerNav: { paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  drawerNavItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12 },
  drawerNavItemActive: { backgroundColor: '#f59e0b' },
  drawerNavIcon: { fontSize: 18 },
  drawerNavLabel: { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1 },
  drawerNavLabelActive: { color: '#fff' },
  drawerNavBadge: { fontWeight: '700' },
  drawerContent: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  drawerSectionTitle: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  drawerCustomerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#f0fdf4', borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: '#bbf7d0' },
  drawerCustomerCardVisited: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  drawerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16a34a', flexShrink: 0 },
  drawerDotVisited: { backgroundColor: '#9ca3af' },
  drawerCustomerName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  drawerCustomerNameVisited: { color: '#9ca3af' },
  drawerCustomerAddr: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  drawerCheckmark: { fontSize: 14, color: '#9ca3af', fontWeight: '700' },
  drawerEmpty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  drawerEmptyIcon: { fontSize: 36 },
  drawerEmptyText: { fontSize: 14, fontWeight: '600', color: '#374151', textAlign: 'center' },
  drawerEmptySub: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
  drawerAllDone: { fontSize: 14, color: '#16a34a', fontWeight: '600', textAlign: 'center', paddingVertical: 12 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 },
  modalIconRow: { alignItems: 'center', marginBottom: 12 },
  modalIcon: { fontSize: 40 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 },
  modalMessage: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  modalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalCountdownBox: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  modalCountdown: { fontSize: 14, fontWeight: '700', color: '#6b7280' },
  modalCloseBtn: { backgroundColor: '#f59e0b', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22 },
  modalCloseBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
