import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Speech from 'expo-speech';
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
  Linking,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMyCustomers } from '../hooks/useMyCustomers';
import { useMyRoute, getTodayDayOfWeek, isSummerSeason, type MyRouteResult } from '../hooks/useMyRoute';
import { getDisplayName } from '../types';
import type { Customer } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { useMyDeliveries } from '../hooks/useMyDeliveries';
import { useTruckLoads, useTruckCounts } from '../hooks/useTruckStock';
import { useTruckLoadConfirmations } from '../hooks/useTruckLoadConfirmations';
import { useMapleReturns } from '../hooks/useMapleReturns';
import { useEggReturns } from '../hooks/useEggReturns';
import { useCustomerSchedules } from '../hooks/useCustomerSchedules';
import { ensureNotifPermission, scheduleClosingReminders } from '../lib/notifications';
import { getPendingLoad } from '../lib/loadConfirm';
import { useBoxBalances } from '../hooks/useBoxBalances';
import { buildSuggestionModel, suggestNext } from '../lib/routeSuggestion';
import { useVisited, useVisitedKinds, markVisitedMany, hydrateVisited } from '../lib/visitedStore';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Map'>;
// Alias tipado laxo: los .d.ts de react-native-webview chocan con la versión
// de @types/react del monorepo y marcan las props como `never`. El componente
// funciona igual; el cast evita el falso error de TS sin afectar el runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MapWebView = WebView as any;

type MarkerKind = 'route' | 'route-visited' | 'route-delivered' | 'own' | 'delegated';
type DrawerView = 'map' | 'route';

const DRAWER_WIDTH = Dimensions.get('window').width * 0.78;
const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function buildMapHtml(
  own: Customer[],
  delegated: Customer[],
  todayRouteIds: Set<string>,
  visitedIds: Set<string>,
  deliveredIds: Set<string>,
): string {
  const toMarker = (c: Customer, isDelegated: boolean) => {
    let kind: MarkerKind;
    if (todayRouteIds.has(c.id)) {
      kind = deliveredIds.has(c.id) ? 'route-delivered' : visitedIds.has(c.id) ? 'route-visited' : 'route';
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

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <script src="https://unpkg.com/leaflet.offline@2.2.0/dist/bundle.js"><\/script>
  <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.min.js"><\/script>
  <script src="https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate-src.js"><\/script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#f3f4f6;}
    #map{width:100vw;height:100vh;}
    .popup-btn{display:inline-block;margin-top:6px;padding:4px 10px;background:#f59e0b;color:#fff;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;}
    .nav-btn{display:inline-block;margin-top:4px;margin-left:4px;padding:4px 10px;background:#2563eb;color:#fff;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;}
    @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(22,163,74,.6)}70%{box-shadow:0 0 0 10px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}
    .pulse{animation:pulse 1.8s infinite;border-radius:50%;}
    .savetiles-toastmsg{position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.72);color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;pointer-events:none;z-index:9999;}
    .leaflet-routing-container{display:none !important;}
    .leaflet-map-pane{transition:transform 0.45s linear !important;}

    /* ── Navigation bottom sheet ── */
    #nav-sheet{
      display:none;position:fixed;bottom:0;left:0;right:0;z-index:2000;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      border-radius:20px 20px 0 0;overflow:hidden;
      box-shadow:0 -6px 24px rgba(0,0,0,0.18);
    }
    #nav-sheet.active{display:block;}

    /* Turn instruction row */
    #nav-turn-row{
      background:#1d4ed8;color:#fff;
      display:flex;align-items:center;gap:14px;
      padding:16px 18px 14px;
    }
    #nav-turn-icon{
      width:58px;height:58px;background:rgba(255,255,255,0.18);
      border-radius:16px;display:flex;align-items:center;justify-content:center;
      font-size:32px;flex-shrink:0;
    }
    #nav-turn-texts{flex:1;min-width:0;}
    #nav-turn-dist{font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px;line-height:1.1;}
    #nav-turn-street{font-size:13px;color:rgba(255,255,255,0.82);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    #nav-close-btn{
      width:38px;height:38px;background:rgba(255,255,255,0.18);
      border:none;color:#fff;border-radius:50%;font-size:18px;
      cursor:pointer;flex-shrink:0;line-height:38px;text-align:center;
    }

    /* Info row */
    #nav-info-row{
      background:#fff;
      display:flex;align-items:center;justify-content:space-between;
      padding:11px 18px 22px;border-top:1px solid #f0f0f0;
    }
    #nav-remaining{font-size:15px;font-weight:700;color:#111827;}
    #nav-eta-text{font-size:13px;color:#6b7280;margin-top:1px;}
    #nav-step-badge{
      background:#f3f4f6;border-radius:20px;padding:4px 10px;
      font-size:11px;font-weight:600;color:#6b7280;
    }

    /* Recalculating banner */
    #nav-recalc{
      display:none;background:#f59e0b;color:#fff;
      padding:8px 18px;font-size:13px;font-weight:700;text-align:center;
    }

    /* Arrival overlay (full-screen) */
    #nav-arrived-overlay{
      display:none;position:fixed;inset:0;z-index:3000;
      background:rgba(22,163,74,0.92);
      align-items:center;justify-content:center;flex-direction:column;gap:12px;
    }
    #nav-arrived-overlay.visible{display:flex;}
    #nav-arrived-icon{font-size:56px;}
    #nav-arrived-text{font-size:22px;font-weight:800;color:#fff;}
    #nav-arrived-sub{font-size:14px;color:rgba(255,255,255,0.85);}
    #nav-arrived-close{
      margin-top:8px;background:#fff;color:#166534;border:none;
      border-radius:24px;padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer;
    }
  </style>
</head>
<body>
<div id="map"></div>

<div id="nav-sheet">
  <div id="nav-recalc">🔄 Recalculando ruta…</div>
  <div id="nav-turn-row">
    <div id="nav-turn-icon">⬆</div>
    <div id="nav-turn-texts">
      <div id="nav-turn-dist">—</div>
      <div id="nav-turn-street">Calculando ruta…</div>
    </div>
    <button id="nav-close-btn" onclick="cancelNavigation()">✕</button>
  </div>
  <div id="nav-info-row">
    <div>
      <div id="nav-remaining">—</div>
      <div id="nav-eta-text">—</div>
    </div>
    <div id="nav-step-badge">0/0</div>
  </div>
</div>

<div id="nav-arrived-overlay">
  <div id="nav-arrived-icon">📍</div>
  <div id="nav-arrived-text">¡Llegaste!</div>
  <div id="nav-arrived-sub">Destino alcanzado</div>
  <button id="nav-arrived-close" onclick="cancelNavigation()">Cerrar</button>
</div>

<script>
  /* rotate:true enables setBearing() if leaflet-rotate loaded; ignored otherwise */
  var mapOpts={zoomControl:true};
  if(typeof L.Map.mergeOptions==='function'){mapOpts.rotate=true;mapOpts.touchRotate=false;mapOpts.bearing=0;}
  var map=L.map('map',mapOpts).setView([-34.9011,-54.9595],12);
  var canRotate=typeof map.setBearing==='function';

  /* ── Tile layer (offline-capable with plain fallback) ── */
  var tileUrl='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var tileOpts={attribution:'© OpenStreetMap',maxZoom:19,subdomains:'abc'};
  var offlineFn=(L.tileLayer&&typeof L.tileLayer.offline==='function')?function(u,o){return L.tileLayer.offline(u,o);}
    :(typeof LeafletOffline!=='undefined'&&typeof LeafletOffline.tileLayerOffline==='function')?function(u,o){return LeafletOffline.tileLayerOffline(u,o);}:null;
  var saveFn=(L.control&&typeof L.control.savetiles==='function')?function(l,o){return L.control.savetiles(l,o);}
    :(typeof LeafletOffline!=='undefined'&&typeof LeafletOffline.ControlSaveTiles==='function')?function(l,o){return new LeafletOffline.ControlSaveTiles(l,o);}:null;
  var baseLayer;
  try{baseLayer=offlineFn?offlineFn(tileUrl,tileOpts):L.tileLayer(tileUrl,tileOpts);}catch(e){baseLayer=L.tileLayer(tileUrl,tileOpts);}
  baseLayer.addTo(map);
  if(offlineFn&&saveFn){try{
    var sc=saveFn(baseLayer,{zoomlevels:[13,14,15,16,17],saveText:'<span style="font-size:18px">⬇</span>',
      rmText:'<span style="font-size:18px">🗑</span>',maxZoom:17,saveWhatYouSee:true,
      confirm:function(l,cb){cb();},confirmRemoval:function(l,cb){cb();}});
    sc.addTo(map);
    function showToast(msg){var ex=document.querySelector('.savetiles-toastmsg');if(ex)ex.remove();if(!msg)return;
      var el=document.createElement('div');el.className='savetiles-toastmsg';el.textContent=msg;
      document.body.appendChild(el);setTimeout(function(){el.remove();},2500);}
    baseLayer.on('savestart',function(e){showToast('Descargando '+e.lengthToBeSaved+' tiles…');});
    baseLayer.on('loadend',function(e){if(e.storagesize>0)showToast('✓ '+e.storagesize+' tiles guardados');});
    baseLayer.on('tilesremoved',function(){showToast('Caché borrado');});
  }catch(e){}}

  /* ── Icons ── */
  var redIcon=L.divIcon({html:'<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);opacity:0.7;"></div>',iconSize:[14,14],iconAnchor:[7,7],className:''});
  var orangeIcon=L.divIcon({html:'<div style="background:#f97316;width:14px;height:14px;border-radius:4px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);transform:rotate(45deg);opacity:0.7;"></div>',iconSize:[14,14],iconAnchor:[7,7],className:''});
  var routeIcon=L.divIcon({html:'<div class="pulse" style="background:#16a34a;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>',iconSize:[20,20],iconAnchor:[10,10],className:''});
  var visitedIcon=L.divIcon({html:'<div style="background:#9ca3af;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:10px;font-weight:bold;">✓<\/span><\/div>',iconSize:[16,16],iconAnchor:[8,8],className:''});
  var deliveredIcon=L.divIcon({html:'<div style="background:#16a34a;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:11px;font-weight:bold;">✓<\/span><\/div>',iconSize:[18,18],iconAnchor:[9,9],className:''});
  var highlightIcon=L.divIcon({html:'<div style="background:#7c3aed;width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(124,58,237,0.4);"></div>',iconSize:[22,22],iconAnchor:[11,11],className:''});
  var iconMap={route:routeIcon,'route-visited':visitedIcon,'route-delivered':deliveredIcon,own:redIcon,delegated:orangeIcon};

  /* ── State ── */
  var markerRefs={};
  var customers=${JSON.stringify(markers)};
  var userPos=null; /* set on first GPS tick via updatePos message */
  var userMarkerRef=null;
  var routingControl=null;

  /* Navigation state */
  var NAV={
    active:false, steps:[], coords:[], stepIdx:0,
    destLat:0, destLng:0, totalDist:0, totalTime:0,
  };
  var ARRIVE_DIST=30;     /* metres to trigger arrival */
  var ADVANCE_DIST=40;    /* metres to advance to next step */
  var OFF_ROUTE_DIST=100; /* metres off-route before recalculating (GPS error ~30-50m) */
  var offRouteTimer=null; /* fires after 5s off-route */
  var recalculating=false;

  /* Route progress polylines (drawn by us; LRM line is hidden) */
  var routeLineTravelled=null; /* grey */
  var routeLineRemaining=null; /* blue */
  var nearestCoordIdx=0;       /* last known position on route */

  /* Smooth heading — low-pass filter avoids jitter */
  var smoothHeading=0;

  /* ── User position marker ──
     leaflet-rotate rotates the map pane by -bearing, so every element in the pane
     rotates by -bearing visually. To make the arrow point "up" on screen (= direction
     of travel when map is rotated to heading-up), the icon CSS must add +heading so
     the net visual rotation is -heading + heading = 0 = screen-up = direction of travel.
     This same formula works in non-nav mode too: map bearing=0, icon rotate=heading → points at heading. */
  /* GPS-style user marker: blue dot + direction cone, heading rotates the whole assembly */
  function setUserMarker(lat,lng,heading){
    heading=heading||0;
    var html=
      '<div style="width:44px;height:44px;transform:rotate('+heading+'deg);transition:transform 0.4s linear;position:relative;">'
      /* Direction cone above the dot */
      +'<svg style="position:absolute;top:-10px;left:7px;" width="30" height="20" viewBox="0 0 30 20">'
      +'<polygon points="15,0 24,20 15,14 6,20" fill="rgba(37,99,235,0.45)"/>'
      +'<\/svg>'
      /* Outer glow ring */
      +'<div style="position:absolute;top:7px;left:7px;width:30px;height:30px;border-radius:50%;background:rgba(37,99,235,0.18);"></div>'
      /* White border */
      +'<div style="position:absolute;top:10px;left:10px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,0.3);">'
      /* Blue dot */
      +'<div style="position:absolute;top:4px;left:4px;width:16px;height:16px;border-radius:50%;background:#2563eb;"></div>'
      +'<\/div>'
      +'<\/div>';
    var icon=L.divIcon({html:html,iconSize:[44,44],iconAnchor:[22,22],className:''});
    if(userMarkerRef) map.removeLayer(userMarkerRef);
    userMarkerRef=L.marker([lat,lng],{icon:icon,zIndexOffset:1000}).addTo(map);
  }
  if(userPos) setUserMarker(userPos[0],userPos[1],0);

  /* ── Helpers ── */
  function haversine(lat1,lng1,lat2,lng2){
    var R=6371000,p=Math.PI/180;
    var a=Math.sin((lat2-lat1)*p/2),b=Math.sin((lng2-lng1)*p/2);
    return 2*R*Math.asin(Math.sqrt(a*a+Math.cos(lat1*p)*Math.cos(lat2*p)*b*b));
  }
  function fmtDist(m){return m>=1000?(m/1000).toFixed(1)+' km':Math.round(m)+' m';}
  function fmtTime(s){var m=Math.round(s/60);return m<60?m+' min':(Math.floor(m/60)+'h '+(m%60)+'min');}
  /* Rumbo (0..360) del punto A al B */
  function bearingBetween(lat1,lng1,lat2,lng2){
    var p=Math.PI/180;
    var y=Math.sin((lng2-lng1)*p)*Math.cos(lat2*p);
    var x=Math.cos(lat1*p)*Math.sin(lat2*p)-Math.sin(lat1*p)*Math.cos(lat2*p)*Math.cos((lng2-lng1)*p);
    return (Math.atan2(y,x)*180/Math.PI+360)%360;
  }
  /* Rumbo de la calle por la que se circula: dirección del tramo de ruta
     desde la posición actual (nearestCoordIdx) hacia ~15 m adelante. Así la
     calle queda siempre vertical y la flecha alineada con ella. */
  function routeCourse(){
    if(!NAV.coords||NAV.coords.length<2) return null;
    var i=Math.min(nearestCoordIdx,NAV.coords.length-2);
    var a=NAV.coords[i];
    var ax=a.lat||a[0], ay=a.lng||a[1];
    var b=NAV.coords[i+1];
    for(var k=i+1;k<NAV.coords.length;k++){
      var c=NAV.coords[k];
      b=c;
      if(haversine(ax,ay,c.lat||c[0],c.lng||c[1])>15) break;
    }
    if(!b) return null;
    return bearingBetween(ax,ay,b.lat||b[0],b.lng||b[1]);
  }

  /* Minimum distance from user to the route polyline.
     Window scales with speed: at 80km/h GPS ticks every 2s = ~45m per tick,
     so we need to look well ahead. We always scan the full remaining route
     (from nearestCoordIdx onward) to avoid false off-route at high speed. */
  function distToRoute(lat,lng){
    if(!NAV.coords||NAV.coords.length<2) return 0;
    var min=Infinity;
    var start=Math.max(0,nearestCoordIdx-50);
    /* scan to end — route coords are typically 200-800 points, negligible cost */
    for(var i=start;i<NAV.coords.length;i++){
      var c=NAV.coords[i];
      var d=haversine(lat,lng,c.lat||c[0],c.lng||c[1]);
      if(d<min) min=d;
      /* early exit once we've passed the closest point and distance is growing */
      if(d>min+50&&i>nearestCoordIdx+100) break;
    }
    return min;
  }

  /* Split route into grey (travelled) + blue (remaining) polylines.
     nearestCoordIdx only ever moves FORWARD — GPS jitter never shrinks the grey segment. */
  function updateRouteProgress(lat,lng){
    if(!NAV.coords||NAV.coords.length<2) return;
    var min=Infinity,idx=nearestCoordIdx;
    var start=Math.max(0,nearestCoordIdx-20);
    /* scan to end of route to handle high speed */
    for(var i=start;i<NAV.coords.length;i++){
      var c=NAV.coords[i];
      var d=haversine(lat,lng,c.lat||c[0],c.lng||c[1]);
      if(d<min){min=d;idx=i;}
      if(d>min+80&&i>idx+50) break; /* stop when clearly past the closest section */
    }
    /* Only advance — never let jitter shrink the travelled segment */
    nearestCoordIdx=Math.max(nearestCoordIdx,idx);

    var toLatLng=function(c){return[c.lat||c[0],c.lng||c[1]];};
    var travelled=NAV.coords.slice(0,idx+1).map(toLatLng);
    var remaining=NAV.coords.slice(idx).map(toLatLng);

    if(travelled.length>1){
      if(!routeLineTravelled) routeLineTravelled=L.polyline([],{color:'#9ca3af',weight:5,opacity:0.6,interactive:false}).addTo(map);
      routeLineTravelled.setLatLngs(travelled);
    }
    if(remaining.length>1){
      if(!routeLineRemaining) routeLineRemaining=L.polyline([],{color:'#2563eb',weight:6,opacity:0.9,interactive:false}).addTo(map);
      routeLineRemaining.setLatLngs(remaining);
    }
  }

  /* Clear both progress polylines */
  function clearRouteLines(){
    if(routeLineTravelled){map.removeLayer(routeLineTravelled);routeLineTravelled=null;}
    if(routeLineRemaining){map.removeLayer(routeLineRemaining);routeLineRemaining=null;}
    nearestCoordIdx=0;
  }

  /* Smooth bearing with low-pass filter to avoid jittery rotation */
  function applyBearing(rawHeading){
    if(!canRotate||rawHeading==null) return;
    var diff=((rawHeading-smoothHeading+540)%360)-180;
    smoothHeading=(smoothHeading+diff*0.35+360)%360;
    map.setBearing(smoothHeading);
  }

  /* ── Voice announcements (Web Speech API) ── */
  var voiceAnnounced={}; /* stepIdx -> {far: bool, near: bool} */
  var VOICE_FAR=300;  /* metres — first warning */
  var VOICE_NEAR=50;  /* metres — imminent warning */

  var TURN_VOICE={
    Left:'gire a la izquierda',Right:'gire a la derecha',
    SlightLeft:'mantenga la izquierda',SlightRight:'mantenga la derecha',
    SharpLeft:'giro cerrado a la izquierda',SharpRight:'giro cerrado a la derecha',
    TurnLeft:'gire a la izquierda',TurnRight:'gire a la derecha',
    Continue:'continúe recto',Roundabout:'tome la rotonda',Uturn:'dé media vuelta',
    DestinationReached:'llegaste a tu destino',Depart:'comenzá a conducir',
    Head:'continúe recto',
    'straight':'continúe recto','turn-left':'gire a la izquierda','turn-right':'gire a la derecha',
    'turn-slight-left':'mantenga la izquierda','turn-slight-right':'mantenga la derecha',
    'turn-sharp-left':'giro cerrado a la izquierda','turn-sharp-right':'giro cerrado a la derecha',
    'uturn':'dé media vuelta','roundabout':'tome la rotonda',
    'arrive':'llegaste a tu destino','depart':'comenzá a conducir',
  };

  function speak(text){
    if(!text) return;
    /* Delegate to React Native native TTS — speechSynthesis is sandboxed in WebView */
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'speak',text:text}));
  }

  function checkVoiceAnnouncements(lat,lng){
    if(!NAV.active||NAV.steps.length===0) return;
    /* Announce for the NEXT step (not the current one being displayed) */
    var nextIdx=NAV.stepIdx+1;
    if(nextIdx>=NAV.steps.length) return;
    var nextStep=NAV.steps[nextIdx];
    var nc=NAV.coords[nextStep.index];
    if(!nc) return;
    var dist=haversine(lat,lng,nc.lat||nc[0],nc.lng||nc[1]);
    var key=nextIdx;
    if(!voiceAnnounced[key]) voiceAnnounced[key]={far:false,near:false};

    var turnText=TURN_VOICE[nextStep.type]||'continúe';
    if(!voiceAnnounced[key].far&&dist<=VOICE_FAR&&dist>VOICE_NEAR){
      voiceAnnounced[key].far=true;
      speak('En '+Math.round(dist/10)*10+' metros, '+turnText);
    } else if(!voiceAnnounced[key].near&&dist<=VOICE_NEAR){
      voiceAnnounced[key].near=true;
      speak(turnText.charAt(0).toUpperCase()+turnText.slice(1));
    }
  }

  /* LRM instruction type → arrow emoji */
  var ARROWS={
    Left:'↰',Right:'↱',SlightLeft:'↖',SlightRight:'↗',SharpLeft:'⬅',SharpRight:'➡',
    TurnLeft:'↰',TurnRight:'↱',Continue:'⬆',Roundabout:'🔄',Uturn:'↩',
    DestinationReached:'📍',WaypointReached:'📌',Depart:'🚗',Head:'⬆',
    'straight':'⬆','turn-left':'↰','turn-right':'↱','turn-slight-left':'↖',
    'turn-slight-right':'↗','turn-sharp-left':'⬅','turn-sharp-right':'➡',
    'uturn':'↩','roundabout':'🔄','arrive':'📍','depart':'🚗',
  };
  function arrow(type){return ARROWS[type]||'⬆';}

  /* ── Sheet update ── */
  function refreshHUD(){
    if(!NAV.active||NAV.steps.length===0) return;
    var step=NAV.steps[NAV.stepIdx];
    var nextStep=NAV.steps[NAV.stepIdx+1];

    var distTxt='—';
    if(nextStep&&NAV.coords.length>nextStep.index&&userPos){
      var nc=NAV.coords[nextStep.index];
      distTxt=fmtDist(haversine(userPos[0],userPos[1],nc.lat||nc[0],nc.lng||nc[1]));
    }

    document.getElementById('nav-turn-icon').textContent=arrow(step.type);
    document.getElementById('nav-turn-dist').textContent=distTxt;
    document.getElementById('nav-turn-street').textContent=step.text||'Continúa recto';
    document.getElementById('nav-step-badge').textContent=(NAV.stepIdx+1)+'/'+NAV.steps.length;
  }

  /* Pan keeping user in lower third of visible map (more look-ahead ahead) */
  function panWithLookAhead(lat,lng){
    try{
      var pt=map.latLngToContainerPoint([lat,lng]);
      var sz=map.getSize();
      /* Shift center up so user appears at ~68% from top (bottom third) */
      var offset=sz.y*0.18;
      var shifted=map.containerPointToLatLng(L.point(pt.x,pt.y-offset));
      map.panTo(shifted,{animate:true,duration:0.5,easeLinearity:0.5,noMoveStart:true});
    }catch(e){
      map.panTo([lat,lng],{animate:true,duration:0.5,noMoveStart:true});
    }
  }

  /* ── Navigation core ── */
  function startNavigation(lat,lng){
    if(!userPos){alert('Activá el GPS para navegar.');return;}
    cancelNavigation();
    NAV.destLat=lat; NAV.destLng=lng;
    NAV.active=false; NAV.stepIdx=0; NAV.steps=[]; NAV.coords=[];

    document.getElementById('nav-sheet').className='active';
    document.getElementById('nav-arrived-overlay').className='';
    document.getElementById('nav-recalc').style.display='none';
    document.getElementById('nav-turn-dist').textContent='—';
    document.getElementById('nav-turn-street').textContent='Calculando ruta…';
    document.getElementById('nav-remaining').textContent='—';
    document.getElementById('nav-eta-text').textContent='';
    document.getElementById('nav-step-badge').textContent='';

    routingControl=L.Routing.control({
      waypoints:[L.latLng(userPos[0],userPos[1]),L.latLng(lat,lng)],
      routeWhileDragging:false,showAlternatives:false,
      /* fitSelectedRoutes MUST be false — we control zoom via panTo; auto-fit causes the zoom-reset loop */
      fitSelectedRoutes:false,addWaypoints:false,
      /* LRM line is invisible — we draw our own grey/blue progress polylines */
      lineOptions:{styles:[{color:'transparent',weight:0,opacity:0}],extendToWaypoints:false,missingRouteTolerance:0},
      createMarker:function(){return null;},
      router:L.Routing.osrmv1({serviceUrl:'https://router.project-osrm.org/route/v1',profile:'driving'}),
    }).addTo(map);

    routingControl.on('routesfound',function(e){
      var route=e.routes[0];
      NAV.steps=route.instructions;
      NAV.coords=route.coordinates;
      NAV.totalDist=route.summary.totalDistance;
      NAV.totalTime=route.summary.totalTime;
      NAV.active=true;
      window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'navState',active:true}));
      NAV.stepIdx=0;
      nearestCoordIdx=0;
      recalculating=false;
      document.getElementById('nav-recalc').style.display='none';
      document.getElementById('nav-remaining').textContent=fmtDist(NAV.totalDist)+' restantes';
      document.getElementById('nav-eta-text').textContent='Llegada estimada en '+fmtTime(NAV.totalTime);
      /* Draw initial full route as blue remaining line */
      clearRouteLines();
      var allLatLng=NAV.coords.map(function(c){return[c.lat||c[0],c.lng||c[1]];});
      routeLineRemaining=L.polyline(allLatLng,{color:'#2563eb',weight:6,opacity:0.9,interactive:false}).addTo(map);
      /* Centre on user at nav zoom without touching zoom level */
      if(userPos) map.setView([userPos[0],userPos[1]],17,{animate:false});
      speak('Ruta calculada. '+fmtDist(NAV.totalDist)+', '+fmtTime(NAV.totalTime)+'.');
      refreshHUD();
    });
    routingControl.on('routingerror',function(){
      document.getElementById('nav-street').textContent='⚠ Sin ruta — verificá conexión';
    });
  }

  function cancelNavigation(){
    NAV.active=false;
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'navState',active:false}));
    recalculating=false;
    smoothHeading=0;
    voiceAnnounced={};
    speak('');
    if(offRouteTimer){clearTimeout(offRouteTimer);offRouteTimer=null;}
    if(routingControl){map.removeControl(routingControl);routingControl=null;}
    clearRouteLines();
    if(canRotate) map.setBearing(0);
    document.getElementById('nav-sheet').className='';
    document.getElementById('nav-arrived-overlay').className='';
    document.getElementById('nav-recalc').style.display='none';
  }

  /* ── Position update (called from React Native on every GPS tick) ── */
  var prevMoveLat=null, prevMoveLng=null, moveHeading=null;
  function onPositionUpdate(lat,lng,heading){
    userPos=[lat,lng];

    /* Rumbo de MOVIMIENTO: dirección del desplazamiento entre posiciones.
       Es la fuente principal (apunta a donde se dirige el punto). Se actualiza
       solo cuando el chofer se movió lo suficiente para ser fiable. */
    if(prevMoveLat!=null){
      var moved=haversine(prevMoveLat,prevMoveLng,lat,lng);
      if(moved>=4){ moveHeading=bearingBetween(prevMoveLat,prevMoveLng,lat,lng); prevMoveLat=lat; prevMoveLng=lng; }
    } else { prevMoveLat=lat; prevMoveLng=lng; }

    /* Rumbo efectivo: movimiento > rumbo del GPS (si es válido) */
    var eff = (moveHeading!=null) ? moveHeading
              : ((heading!=null && heading>=0) ? heading : null);

    if(!NAV.active){ setUserMarker(lat,lng, eff!=null?eff:0); return; }

    /* Actualizar progreso primero para conocer el tramo de ruta actual */
    updateRouteProgress(lat,lng);

    /* En navegación: la flecha apunta en la dirección de movimiento y el mapa
       gira para coincidir. Respaldo: rumbo de la ruta, y si no, el último. */
    var dir = eff;
    if(dir==null) dir = routeCourse();
    if(dir==null || isNaN(dir)) dir = smoothHeading;

    /* La flecha apunta en la dirección de movimiento */
    setUserMarker(lat,lng,dir);

    /* Heading-up: rotar el mapa para que esa dirección quede vertical.
       Pan diferido 50ms para que el bearing se aplique antes de calcular
       el offset de pantalla — evita saltos en los giros. */
    applyBearing(dir);
    setTimeout(function(){ panWithLookAhead(lat,lng); }, 50);

    /* Check arrival */
    if(haversine(lat,lng,NAV.destLat,NAV.destLng)<ARRIVE_DIST){
      NAV.active=false;
      window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'navState',active:false}));
      if(canRotate) map.setBearing(0);
      if(offRouteTimer){clearTimeout(offRouteTimer);offRouteTimer=null;}
      speak('Llegaste a tu destino');
      document.getElementById('nav-sheet').className='';
      document.getElementById('nav-arrived-overlay').className='visible';
      return;
    }

    /* Voice turn warnings */
    checkVoiceAnnouncements(lat,lng);

    /* Off-route detection */
    if(!recalculating){
      var offDist=distToRoute(lat,lng);
      if(offDist>OFF_ROUTE_DIST){
        if(!offRouteTimer){
          offRouteTimer=setTimeout(function(){
            offRouteTimer=null;
            if(!NAV.active||!userPos) return;
            recalculating=true;
            document.getElementById('nav-recalc').style.display='block';
            document.getElementById('nav-turn-dist').textContent='';
            if(routingControl){map.removeControl(routingControl);routingControl=null;}
            clearRouteLines();
            NAV.active=false; NAV.steps=[]; NAV.coords=[]; NAV.stepIdx=0;
            voiceAnnounced={};
            startNavigation(NAV.destLat,NAV.destLng);
          },5000);
        }
      } else {
        if(offRouteTimer){clearTimeout(offRouteTimer);offRouteTimer=null;}
      }
    }

    /* Advance steps */
    while(NAV.stepIdx<NAV.steps.length-1){
      var nxt=NAV.steps[NAV.stepIdx+1];
      var nc=NAV.coords[nxt.index];
      if(!nc) break;
      if(haversine(lat,lng,nc.lat||nc[0],nc.lng||nc[1])<ADVANCE_DIST){NAV.stepIdx++;}else{break;}
    }
    refreshHUD();
  }

  /* ── Customer markers ── */
  try{
    customers.forEach(function(c){
      var routeBadge='';
      if(c.kind==='route'||c.kind==='route-visited'||c.kind==='route-delivered'){
        var badgeBg=c.kind==='route-visited'?'#9ca3af':'#16a34a';
        var badgeTxt=c.kind==='route-delivered'?'✓ ENTREGADO':(c.kind==='route-visited'?'✓ VISITADO (sin venta)':'RUTA HOY');
        routeBadge='<br><span style="font-size:9px;background:'+badgeBg+';color:#fff;padding:1px 5px;border-radius:3px;font-weight:600;">'+badgeTxt+'<\/span>';
      }
      var delegBadge=c.kind==='delegated'?'<br><span style="font-size:9px;background:#f97316;color:#fff;padding:1px 5px;border-radius:3px;font-weight:600;">EN COBERTURA<\/span>':'';
      var navBtn='<a class="nav-btn" onclick="startNavigation('+c.lat+','+c.lng+')">🧭 Navegar<\/a>';
      var popup=routeBadge+delegBadge+'<b style="font-size:13px;">'+c.name+'<\/b><br><span style="font-size:11px;color:#6b7280;">'+c.phone+'<\/span><br><span style="font-size:10px;color:#9ca3af;">'+c.address+'<\/span><br><a class="popup-btn" onclick="window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:\\'navigate\\',id:\\''+c.id+'\\'}))">Ver detalles →<\/a>'+navBtn;
      var m=L.marker([c.lat,c.lng],{icon:iconMap[c.kind]||redIcon}).bindPopup(popup,{maxWidth:240}).addTo(map);
      markerRefs[c.id]=m;
    });
  }catch(err){
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug',msg:'ERROR: '+err.message}));
  }

  document.addEventListener('message',handleCmd);
  window.addEventListener('message',handleCmd);
  function handleCmd(e){
    try{
      var msg=JSON.parse(e.data);
      if(msg.type==='highlight'&&msg.id&&markerRefs[msg.id]){map.flyTo(markerRefs[msg.id].getLatLng(),16,{duration:0.8});markerRefs[msg.id].setIcon(highlightIcon);markerRefs[msg.id].openPopup();}
      if(msg.type==='clearHighlight'&&msg.id&&markerRefs[msg.id]){var c=customers.find(function(x){return x.id===msg.id;});if(c)markerRefs[msg.id].setIcon(iconMap[c.kind]||redIcon);}
      if(msg.type==='markVisited'&&msg.id&&markerRefs[msg.id]){var dk=msg.kind==='delivered';markerRefs[msg.id].setIcon(dk?deliveredIcon:visitedIcon);var c=customers.find(function(x){return x.id===msg.id;});if(c)c.kind=dk?'route-delivered':'route-visited';markerRefs[msg.id].closePopup();}
      if(msg.type==='updatePos'){onPositionUpdate(msg.lat,msg.lng,(msg.heading==null?-1:msg.heading));}
      if(msg.type==='recenter'&&userPos){
        if(NAV.active){ applyBearing(smoothHeading); setTimeout(function(){panWithLookAhead(userPos[0],userPos[1]);},50); }
        else { map.flyTo(userPos,16,{duration:0.6}); }
      }
      if(msg.type==='startNav'&&msg.lat!=null&&msg.lng!=null){ startNavigation(msg.lat,msg.lng); }
    }catch(err){}
  }
<\/script>
</body>
</html>`;
}

export default function MapScreen() {
  const { profile, signOut } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: myCustomers, isLoading, isFetching, refetch } = useMyCustomers(profile?.id);
  const { data: myDeliveries } = useMyDeliveries(profile?.id);
  // Precargar (y cachear en el teléfono) los datos que la entrega necesita
  // para validar offline: stock del camión y saldos de cajas de los locales.
  const { data: prefTruckLoads } = useTruckLoads(profile?.id);
  const { data: prefTruckCounts } = useTruckCounts(profile?.id);
  const { data: loadConfirmations } = useTruckLoadConfirmations(profile?.id);
  const { data: mapleReturns } = useMapleReturns(profile?.id);
  const { data: eggReturns } = useEggReturns(profile?.id);
  const { data: schedules } = useCustomerSchedules();
  const { data: prefBoxBalances } = useBoxBalances();
  const { data: routeData, refetch: refetchRoute } = useMyRoute(profile?.id);
  const routeFound = routeData?.routeFound ?? false;
  const routeStops = routeData?.stops ?? [];
  const ownCustomers = myCustomers?.own ?? [];
  const delegatedCustomers = myCustomers?.delegated ?? [];
  const allCustomers = [...ownCustomers, ...delegatedCustomers];
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const webViewRef = useRef<WebView>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  // "Visitado" vive en un store compartido: registrar una entrega lo marca
  const visitedIds = useVisited();
  const visitedKinds = useVisitedKinds();
  const deliveredIds = useMemo(
    () => new Set([...visitedKinds].filter(([, k]) => k === 'delivered').map(([id]) => id)),
    [visitedKinds],
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [lastHighlighted, setLastHighlighted] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [navActive, setNavActive] = useState(false); // navegación activa (para ubicar el botón de recentrar)

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
  const deliveredCustomers = todayRouteCustomers.filter((c) => deliveredIds.has(c.id));
  const visitedNoSaleCustomers = todayRouteCustomers.filter((c) => visitedIds.has(c.id) && !deliveredIds.has(c.id));

  // Carga del día asignada por el admin, pendiente de confirmar
  const pendingLoad = useMemo(
    () => getPendingLoad(prefTruckLoads ?? [], loadConfirmations ?? [], Date.now()),
    [prefTruckLoads, loadConfirmations],
  );

  // Clientes pendientes de hoy que tienen horario de cierre → recordatorios
  const closingTargets = useMemo(() => {
    const map = new Map((schedules ?? []).map((s) => [s.customer_id, s.closing_time]));
    return pendingCustomers
      .filter((c) => map.has(c.id))
      .map((c) => ({ customerId: c.id, name: getDisplayName(c), closingTime: String(map.get(c.id)).slice(0, 5) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitedIds, schedules, routeStops, myCustomers]);

  const notifSigRef = useRef<string>('INIT');
  useEffect(() => {
    const sig = closingTargets.map((t) => `${t.customerId}@${t.closingTime}`).sort().join('|');
    if (sig === notifSigRef.current) return;
    notifSigRef.current = sig;
    (async () => {
      if (closingTargets.length === 0) { await scheduleClosingReminders([]); return; }
      const ok = await ensureNotifPermission();
      if (ok) await scheduleClosingReminders(closingTargets);
    })();
  }, [closingTargets]);

  // ── Sugerencia de orden (histórica) + animación de completado ──
  const suggestionModel = useMemo(() => buildSuggestionModel(myDeliveries ?? []), [myDeliveries]);

  const [suggestion, setSuggestion] = useState<{ text: string; lat: number; lng: number } | null>(null);
  const [navChooser, setNavChooser] = useState<{ lat: number; lng: number } | null>(null);
  const suggestAnim = useRef(new Animated.Value(0)).current;
  // No se autooculta: el chofer la cierra con la ✕. Así, aunque quede en el
  // detalle del cliente tras entregar, al volver al mapa la sigue viendo.
  const showSuggestion = useCallback((text: string, lat: number, lng: number) => {
    setSuggestion({ text, lat, lng });
    Animated.timing(suggestAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [suggestAnim]);
  const dismissSuggestion = useCallback(() => {
    Animated.timing(suggestAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setSuggestion(null));
  }, [suggestAnim]);

  function openGoogleMaps(lat: number, lng: number) {
    const url = Platform.select({
      ios: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
      android: `google.navigation:q=${lat},${lng}&mode=d`,
    });
    const fallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.canOpenURL(url!).then((ok) => Linking.openURL(ok ? url! : fallback)).catch(() => Linking.openURL(fallback));
  }
  function openWaze(lat: number, lng: number) {
    Linking.openURL(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`).catch(() =>
      Alert.alert('Waze', 'No se pudo abrir Waze. ¿Está instalado?'),
    );
  }
  function chooseNav(kind: 'app' | 'gmaps' | 'waze') {
    if (!navChooser) return;
    const { lat, lng } = navChooser;
    setNavChooser(null);
    if (kind === 'app') sendToMap({ type: 'startNav', lat, lng });
    else if (kind === 'gmaps') openGoogleMaps(lat, lng);
    else openWaze(lat, lng);
  }

  const [showDone, setShowDone] = useState(false);
  const doneAnim = useRef(new Animated.Value(0)).current;
  const doneShownRef = useRef(false);
  const triggerDone = useCallback(() => {
    setShowDone(true);
    doneAnim.setValue(0);
    Animated.spring(doneAnim, { toValue: 1, useNativeDriver: true, friction: 5, tension: 80 }).start();
    setTimeout(() => {
      Animated.timing(doneAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => setShowDone(false));
    }, 4500);
  }, [doneAnim]);


  // Aviso "listo para trabajar sin conexión" cuando terminó de precargar todo
  const [readyVisible, setReadyVisible] = useState(false);
  const readyAnim = useRef(new Animated.Value(0)).current;
  const readyShownRef = useRef(false);
  useEffect(() => {
    if (readyShownRef.current || !isOnline) return;
    const dataReady =
      myCustomers !== undefined && routeData !== undefined && myDeliveries !== undefined &&
      prefTruckLoads !== undefined && prefTruckCounts !== undefined && prefBoxBalances !== undefined;
    if (!dataReady) return;
    readyShownRef.current = true;
    setReadyVisible(true);
    Animated.timing(readyAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(readyAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setReadyVisible(false));
    }, 3500);
  }, [isOnline, myCustomers, routeData, myDeliveries, prefTruckLoads, prefTruckCounts, prefBoxBalances, readyAnim]);

  // Aviso: carga del día sin confirmar (toast que se autooculta, tappable)
  const [loadToastVisible, setLoadToastVisible] = useState(false);
  const loadToastAnim = useRef(new Animated.Value(0)).current;
  const loadToastShownFor = useRef<number | null>(null);
  useEffect(() => {
    if (!pendingLoad) return;
    if (loadToastShownFor.current === pendingLoad.atMs) return;
    loadToastShownFor.current = pendingLoad.atMs;
    setLoadToastVisible(true);
    Animated.timing(loadToastAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(loadToastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setLoadToastVisible(false));
    }, 6000);
  }, [pendingLoad, loadToastAnim]);

  // Aviso: resultado de una entrega de maples (aprobada / rechazada)
  const [mapleToast, setMapleToast] = useState<{ text: string; ok: boolean } | null>(null);
  const mapleToastAnim = useRef(new Animated.Value(0)).current;
  const mapleStatusRef = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!mapleReturns) return;
    // Primer carga: sembrar sin avisar (no notificar resultados históricos)
    if (mapleStatusRef.current === null) {
      mapleStatusRef.current = new Map(mapleReturns.map((r) => [r.id, r.status]));
      return;
    }
    const prev = mapleStatusRef.current;
    let changed: { text: string; ok: boolean } | null = null;
    for (const r of mapleReturns) {
      const before = prev.get(r.id);
      if (before && before === 'pendiente' && r.status !== 'pendiente') {
        if (r.status === 'aprobada') {
          const cnt = r.approved_qty ?? r.declared_qty;
          changed = { text: `✅ Tu entrega de maples fue aprobada (${cnt}).`, ok: true };
        } else {
          changed = { text: '❌ Tu entrega de maples fue rechazada. Revisá el detalle.', ok: false };
        }
      }
    }
    mapleStatusRef.current = new Map(mapleReturns.map((r) => [r.id, r.status]));
    if (changed) {
      setMapleToast(changed);
      Animated.timing(mapleToastAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(mapleToastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setMapleToast(null));
      }, 7000);
    }
  }, [mapleReturns, mapleToastAnim]);

  // Aviso: resultado de una devolución de rotos/vencidos (aprobada / rechazada)
  const [eggToast, setEggToast] = useState<{ text: string; ok: boolean } | null>(null);
  const eggToastAnim = useRef(new Animated.Value(0)).current;
  const eggStatusRef = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!eggReturns) return;
    if (eggStatusRef.current === null) {
      eggStatusRef.current = new Map(eggReturns.map((r) => [r.id, r.status]));
      return;
    }
    const prev = eggStatusRef.current;
    let changed: { text: string; ok: boolean } | null = null;
    for (const r of eggReturns) {
      const before = prev.get(r.id);
      if (before && before === 'pendiente' && r.status !== 'pendiente') {
        changed = r.status === 'aprobada'
          ? { text: '✅ El admin controló tu devolución de rotos/vencidos.', ok: true }
          : { text: '❌ Tu devolución fue rechazada. Revisá el detalle.', ok: false };
      }
    }
    eggStatusRef.current = new Map(eggReturns.map((r) => [r.id, r.status]));
    if (changed) {
      setEggToast(changed);
      Animated.timing(eggToastAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(eggToastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setEggToast(null));
      }, 7000);
    }
  }, [eggReturns, eggToastAnim]);

  const prevVisitedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!hasRouteToday || todayCount === 0) { prevVisitedRef.current = new Set(visitedIds); return; }
    const prev = prevVisitedRef.current;
    // ¿algún cliente de la ruta de hoy se visitó recién?
    let lastVisited: string | null = null;
    for (const id of visitedIds) {
      if (!prev.has(id) && todayRouteIds.has(id)) lastVisited = id;
    }
    const firstRun = prev.size === 0;
    prevVisitedRef.current = new Set(visitedIds);

    const pendingIds = todayRouteCustomers.filter((c) => !visitedIds.has(c.id)).map((c) => c.id);

    if (pendingIds.length === 0) {
      if (!doneShownRef.current) { doneShownRef.current = true; triggerDone(); }
      dismissSuggestion();
      return;
    }
    doneShownRef.current = false; // si vuelve a haber pendientes, permitir re-mostrar

    // Mostrar sugerencia al inicio o justo después de una entrega
    if (lastVisited || firstRun) {
      const coords = new Map(allCustomers.map((c) => [c.id, { lat: c.lat, lng: c.lng }]));
      const nextId = suggestNext(suggestionModel, lastVisited, pendingIds, {
        coords,
        current: userLocation,
      });
      const cust = allCustomers.find((c) => c.id === nextId);
      if (cust) {
        const isStart = visitedIds.size === 0;
        showSuggestion(`${isStart ? '🧭 Más cercano' : '➡️ Seguí con'}: ${getDisplayName(cust)}`, cust.lat, cust.lng);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitedIds]);

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

  // Inyecta JS al WebView del mapa. Declarado antes de los efectos que lo usan.
  const sendToMap = useCallback((msg: object) => {
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify(msg))} })); true;`
    );
  }, []);

  // Re-mount map when route or customer data changes
  useEffect(() => {
    if (routeData !== undefined) setMapKey((k) => k + 1);
  }, [routeData]);

  useEffect(() => {
    if (myCustomers !== undefined) setMapKey((k) => k + 1);
  }, [myCustomers]);

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

  const [locationDenied, setLocationDenied] = useState(false);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationDenied(true); return; }
      setLocationDenied(false);

      // Quick initial fix
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const initial = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUserLocation(initial);

      // Continuous watch for navigation follow-mode
      locationWatcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 2000 },
        (position) => {
          const { latitude: lat, longitude: lng, heading } = position.coords;
          setUserLocation({ lat, lng });
          // Enviar el rumbo crudo (puede ser null/-1 si el GPS no lo da);
          // el mapa calcula el rumbo por desplazamiento cuando falta.
          sendToMap({ type: 'updatePos', lat, lng, heading: heading == null ? -1 : heading });
        },
      );
    })();
    return () => { locationWatcher.current?.remove(); };
  }, [sendToMap]);

  const searchResults = searchQuery.trim().length >= 1
    ? allCustomers.filter((c) => {
        const q = searchQuery.toLowerCase();
        return getDisplayName(c).toLowerCase().includes(q) || (c.tax_id ?? '').toLowerCase().includes(q);
      }).slice(0, 6)
    : [];

  // Cargar el "visitado" persistido (sobrevive a reinicios de la app/teléfono)
  useEffect(() => { hydrateVisited(); }, []);

  // Reconstruir "visitado" desde las entregas de HOY (fuente en la BD): así,
  // aunque se pierda el estado local, los clientes con entrega hoy siguen
  // marcados como visitados.
  useEffect(() => {
    if (!myDeliveries) return;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const today = myDeliveries.filter((d) => new Date(d.delivered_at).getTime() >= startOfToday);
    const delivered = today.filter((d) => d.status === 'entregado').map((d) => d.customer_id);
    const visitedOnly = today.filter((d) => d.status !== 'entregado').map((d) => d.customer_id);
    if (delivered.length) markVisitedMany(delivered, 'delivered');
    if (visitedOnly.length) markVisitedMany(visitedOnly, 'visited');
  }, [myDeliveries]);

  // Inyecta al mapa cada cliente marcado (o cuando cambia su tipo). Idempotente
  // vía injectedVisited (clave id:tipo, así un ascenso a "entregado" se reinyecta).
  const injectedVisited = useRef<Set<string>>(new Set());
  useEffect(() => {
    visitedKinds.forEach((kind, id) => {
      const tag = id + ':' + kind;
      if (!injectedVisited.current.has(tag)) {
        injectedVisited.current.add(tag);
        sendToMap({ type: 'markVisited', id, kind });
      }
    });
  }, [visitedKinds, sendToMap]);

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
      if (msg.type === 'speak') {
        Speech.stop();
        if (msg.text) Speech.speak(msg.text, { language: 'es-419', rate: 1.0, pitch: 1.0 });
      }
      if (msg.type === 'navState') {
        setNavActive(!!msg.active);
      }
    } catch { }
  }

  // Only rebuild HTML when mapKey changes (data load / explicit refresh).
  // userLocation and visitedIds changes go via sendToMap injection — never via HTML rebuild,
  // which would reload the WebView and reset the map view during navigation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildMapHtml(ownCustomers, delegatedCustomers, todayRouteIds, visitedIds, deliveredIds), [mapKey]);

  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const initial = profile?.full_name?.[0]?.toUpperCase() ?? '?';

  return (
    <View style={styles.container} onTouchStart={resetTimers}>
      {/* Sin conexión — banner compacto */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerIcon}>📵</Text>
          <View>
            <Text style={styles.offlineBannerTitle}>Sin conexión a internet</Text>
            <Text style={styles.offlineBannerSub}>Mostrando datos guardados. El mapa puede no estar actualizado.</Text>
          </View>
        </View>
      )}

      {/* Sin GPS — banner compacto */}
      {locationDenied && (
        <View style={[styles.offlineBanner, styles.gpsBanner]}>
          <Text style={styles.offlineBannerIcon}>📍</Text>
          <View>
            <Text style={styles.offlineBannerTitle}>Ubicación desactivada</Text>
            <Text style={styles.offlineBannerSub}>Activá el GPS para ver tu posición en el mapa.</Text>
          </View>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, !isOnline && styles.headerOffline, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={openDrawer} style={styles.hamburgerBtn}>
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          {pendingLoad && <View style={styles.hamburgerDot} />}
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => {
              setRouteAlertVisible(false);
              refetch();
              refetchRoute();
              // Refrescar también stock del camión, entregas, cajas y confirmaciones
              queryClient.invalidateQueries({ queryKey: ['truck-loads'] });
              queryClient.invalidateQueries({ queryKey: ['truck-counts'] });
              queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
              queryClient.invalidateQueries({ queryKey: ['box-balances-all'] });
              queryClient.invalidateQueries({ queryKey: ['load-confirmations'] });
              queryClient.invalidateQueries({ queryKey: ['maple-returns'] });
            }}
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
      <MapWebView
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

      {/* Botón recentrar en la posición del chofer (encima del HUD en navegación) */}
      {!isLoading && (
        <TouchableOpacity
          style={[styles.recenterBtn, navActive && styles.recenterBtnNav, { bottom: (navActive ? 190 : 96) + insets.bottom }]}
          onPress={() => sendToMap({ type: 'recenter' })}
          activeOpacity={0.85}
        >
          <Text style={styles.recenterIcon}>📍</Text>
        </TouchableOpacity>
      )}

      {/* Aviso: datos listos para trabajar sin conexión */}
      {readyVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.readyToast,
            { top: insets.top + 118 },
            {
              opacity: readyAnim,
              transform: [{ translateY: readyAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
            },
          ]}
        >
          <Text style={styles.readyText}>✓ Datos actualizados — listo para trabajar sin conexión</Text>
        </Animated.View>
      )}

      {/* Aviso: carga del día sin confirmar (tappable) */}
      {loadToastVisible && (
        <Animated.View
          style={[
            styles.loadToast,
            { top: insets.top + 118 },
            {
              opacity: loadToastAnim,
              transform: [{ translateY: loadToastAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => { setLoadToastVisible(false); navigation.navigate('DailyLoad'); }}
          >
            <Text style={styles.loadToastText}>🚚 Tenés una carga sin confirmar. Tocá para confirmarla.</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Aviso: resultado de entrega de maples (tappable) */}
      {mapleToast && (
        <Animated.View
          style={[
            styles.loadToast,
            { top: insets.top + 118, backgroundColor: mapleToast.ok ? '#16a34a' : '#b91c1c' },
            {
              opacity: mapleToastAnim,
              transform: [{ translateY: mapleToastAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => { setMapleToast(null); navigation.navigate('MapleReturns'); }}
          >
            <Text style={styles.loadToastText}>{mapleToast.text}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Aviso: resultado de devolución de rotos/vencidos (tappable) */}
      {eggToast && (
        <Animated.View
          style={[
            styles.loadToast,
            { top: insets.top + 118, backgroundColor: eggToast.ok ? '#16a34a' : '#b91c1c' },
            {
              opacity: eggToastAnim,
              transform: [{ translateY: eggToastAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={0.9} onPress={() => { setEggToast(null); navigation.navigate('EggReturns'); }}>
            <Text style={styles.loadToastText}>{eggToast.text}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Sugerencia de próximo cliente (persiste hasta cerrarla con la ✕) */}
      {suggestion && (
        <Animated.View
          style={[
            styles.suggestToast,
            { top: insets.top + 118 },
            {
              opacity: suggestAnim,
              transform: [{ translateY: suggestAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
            },
          ]}
        >
          <View style={styles.suggestRow}>
            <Text style={styles.suggestText}>{suggestion.text}</Text>
            <TouchableOpacity
              onPress={dismissSuggestion}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.suggestClose}
            >
              <Text style={styles.suggestCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.suggestGoBtn}
            activeOpacity={0.85}
            onPress={() => setNavChooser({ lat: suggestion.lat, lng: suggestion.lng })}
          >
            <Text style={styles.suggestGoText}>🧭 Ir hasta el cliente</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Selector de navegación (app / Google Maps / Waze) */}
      <Modal visible={navChooser !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setNavChooser(null)}>
        <TouchableOpacity style={styles.navSheetOverlay} activeOpacity={1} onPress={() => setNavChooser(null)}>
          <View style={styles.navSheet}>
            <Text style={styles.navSheetTitle}>¿Cómo querés ir?</Text>
            <TouchableOpacity style={styles.navOption} activeOpacity={0.8} onPress={() => chooseNav('app')}>
              <Text style={styles.navOptionIcon}>🧭</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.navOptionTitle}>Navegación de la app</Text>
                <Text style={styles.navOptionSub}>Guía dentro de Prodhin</Text>
              </View>
              <Text style={styles.navOptionArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navOption} activeOpacity={0.8} onPress={() => chooseNav('gmaps')}>
              <Text style={styles.navOptionIcon}>🗺️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.navOptionTitle}>Google Maps</Text>
                <Text style={styles.navOptionSub}>Abre la app de Google Maps</Text>
              </View>
              <Text style={styles.navOptionArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.navOption, styles.navOptionLast]} activeOpacity={0.8} onPress={() => chooseNav('waze')}>
              <Text style={styles.navOptionIcon}>🚗</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.navOptionTitle}>Waze</Text>
                <Text style={styles.navOptionSub}>Abre la app de Waze</Text>
              </View>
              <Text style={styles.navOptionArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCancel} activeOpacity={0.7} onPress={() => setNavChooser(null)}>
              <Text style={styles.navCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Animación: todas las entregas completadas */}
      {showDone && (
        <Animated.View style={[styles.doneOverlay, { opacity: doneAnim }]}>
          <TouchableOpacity style={styles.doneFill} activeOpacity={1} onPress={() => setShowDone(false)}>
            <Animated.View style={{ transform: [{ scale: doneAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
              <Text style={styles.doneEmoji}>🎉</Text>
              <View style={styles.doneCheckCircle}><Text style={styles.doneCheck}>✓</Text></View>
              <Text style={styles.doneTitle}>¡Todas las entregas{'\n'}completadas!</Text>
              <Text style={styles.doneSub}>Buen trabajo 💪</Text>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
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
        <View style={[styles.statusBar, !isOnline && styles.statusBarOffline, { paddingBottom: insets.bottom + 10 }]}>
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
        <TouchableOpacity style={styles.drawerOverlay} activeOpacity={1} onPress={() => { setDrawerView('map'); closeDrawer(); }} />
      )}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
        {/* Greeting */}
        <View style={[styles.drawerHeader, { paddingTop: insets.top + 24 }]}>
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
          <TouchableOpacity
            style={styles.drawerNavItem}
            onPress={() => { closeDrawer(); setTimeout(() => navigation.navigate('CustomerPreferences'), 300); }}
          >
            <Text style={styles.drawerNavIcon}>🥚</Text>
            <Text style={styles.drawerNavLabel}>Tipos de huevo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.drawerNavItem, pendingLoad && styles.drawerNavItemActive]}
            onPress={() => { closeDrawer(); setTimeout(() => navigation.navigate('DailyLoad'), 300); }}
          >
            <Text style={styles.drawerNavIcon}>🚚</Text>
            <Text style={styles.drawerNavLabel}>Carga del día</Text>
            {pendingLoad && <Text style={styles.drawerNavWarn}> ⚠️ sin confirmar</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.drawerNavItem}
            onPress={() => { closeDrawer(); setTimeout(() => navigation.navigate('TruckStock'), 300); }}
          >
            <Text style={styles.drawerNavIcon}>📦</Text>
            <Text style={styles.drawerNavLabel}>Stock del camión</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.drawerNavItem}
            onPress={() => { closeDrawer(); setTimeout(() => navigation.navigate('MapleReturns'), 300); }}
          >
            <Text style={styles.drawerNavIcon}>🧺</Text>
            <Text style={styles.drawerNavLabel}>Entregar maples</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.drawerNavItem}
            onPress={() => { closeDrawer(); setTimeout(() => navigation.navigate('EggReturns'), 300); }}
          >
            <Text style={styles.drawerNavIcon}>♻️</Text>
            <Text style={styles.drawerNavLabel}>Rotos y devoluciones</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.drawerNavItem}
            onPress={() => { closeDrawer(); setTimeout(() => navigation.navigate('ProspectCapture'), 300); }}
          >
            <Text style={styles.drawerNavIcon}>🎯</Text>
            <Text style={styles.drawerNavLabel}>Captar cliente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.drawerNavItem}
            onPress={() => { closeDrawer(); setTimeout(() => navigation.navigate('MarkCompetitor'), 300); }}
          >
            <Text style={styles.drawerNavIcon}>🚩</Text>
            <Text style={styles.drawerNavLabel}>Marcar competencia</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.drawerNavItem}
            onPress={() => { closeDrawer(); setTimeout(() => navigation.navigate('DeliveriesHistory'), 300); }}
          >
            <Text style={styles.drawerNavIcon}>📦</Text>
            <Text style={styles.drawerNavLabel}>Mis entregas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.drawerNavItem}
            onPress={() => { closeDrawer(); setTimeout(() => navigation.navigate('Manual'), 300); }}
          >
            <Text style={styles.drawerNavIcon}>📖</Text>
            <Text style={styles.drawerNavLabel}>Manual</Text>
          </TouchableOpacity>
        </View>

        {/* Route view inside drawer */}
        {drawerView === 'route' && (
          <ScrollView style={styles.drawerContent} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
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

                {/* Entregados (con venta) */}
                {deliveredCustomers.length > 0 && (
                  <>
                    <Text style={[styles.drawerSectionTitle, { marginTop: 16 }]}>
                      ✅ Entregados ({deliveredCustomers.length})
                    </Text>
                    {deliveredCustomers.map((c) => (
                      <View key={c.id} style={[styles.drawerCustomerCard, styles.drawerCustomerCardDelivered]}>
                        <View style={[styles.drawerDot, styles.drawerDotDelivered]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.drawerCustomerName}>{getDisplayName(c)}</Text>
                          <Text style={styles.drawerCustomerAddr}>{c.address}</Text>
                        </View>
                        <Text style={styles.drawerCheckmarkDelivered}>✓</Text>
                      </View>
                    ))}
                  </>
                )}

                {/* Visitados sin venta */}
                {visitedNoSaleCustomers.length > 0 && (
                  <>
                    <Text style={[styles.drawerSectionTitle, { marginTop: 16 }]}>
                      ⚪ Visitados sin venta ({visitedNoSaleCustomers.length})
                    </Text>
                    {visitedNoSaleCustomers.map((c) => (
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
  offlineBanner: {
    backgroundColor: '#dc2626', flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 50 : 8,
  },
  gpsBanner: { backgroundColor: '#d97706' },
  offlineBannerIcon: { fontSize: 20 },
  offlineBannerTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  offlineBannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  headerOffline: { paddingTop: 12 },
  hamburgerBtn: { padding: 8, gap: 5, justifyContent: 'center' },
  hamburgerLine: { width: 22, height: 2.5, backgroundColor: '#374151', borderRadius: 2 },
  hamburgerDot: {
    position: 'absolute', top: 4, right: 2, width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#dc2626', borderWidth: 1.5, borderColor: '#fff',
  },
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
  recenterBtn: {
    position: 'absolute', right: 16, bottom: 96, width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 30,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  recenterBtnNav: { bottom: 190 }, // encima del bottom sheet de navegación
  recenterIcon: { fontSize: 22 },
  suggestToast: {
    position: 'absolute', top: Platform.OS === 'ios' ? 150 : 118, left: 16, right: 16, zIndex: 35,
    backgroundColor: '#1d4ed8', borderRadius: 14, paddingVertical: 11, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
    alignItems: 'center',
  },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggestText: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
  suggestClose: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  suggestCloseText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  suggestGoBtn: {
    marginTop: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10,
    paddingVertical: 9, alignItems: 'center',
  },
  suggestGoText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  navSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  navSheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 28 },
  navSheetTitle: { fontSize: 16, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 12 },
  navOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 6,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  navOptionLast: { borderBottomWidth: 0 },
  navOptionIcon: { fontSize: 26 },
  navOptionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  navOptionSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  navOptionArrow: { fontSize: 22, color: '#d1d5db', fontWeight: '300' },
  navCancel: { marginTop: 10, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  navCancelText: { fontSize: 15, fontWeight: '700', color: '#6b7280' },
  readyToast: {
    position: 'absolute', top: Platform.OS === 'ios' ? 150 : 118, left: 16, right: 16, zIndex: 36,
    backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 8,
    alignItems: 'center',
  },
  readyText: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  loadToast: {
    position: 'absolute', left: 16, right: 16, zIndex: 37,
    backgroundColor: '#b45309', borderRadius: 14, paddingVertical: 11, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
  },
  loadToastText: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  doneOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 },
  doneFill: { flex: 1, backgroundColor: 'rgba(22,163,74,0.96)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  doneEmoji: { fontSize: 56, textAlign: 'center', marginBottom: 8 },
  doneCheckCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  doneCheck: { fontSize: 52, color: '#16a34a', fontWeight: '800' },
  doneTitle: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 30 },
  doneSub: { fontSize: 15, color: '#dcfce7', textAlign: 'center', marginTop: 8 },
  webviewLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center', gap: 12 },
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
  drawerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 40 },
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
  drawerNavWarn: { fontSize: 11, fontWeight: '800', color: '#b45309' },
  drawerContent: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  drawerSectionTitle: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  drawerCustomerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#f0fdf4', borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: '#bbf7d0' },
  drawerCustomerCardVisited: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  drawerCustomerCardDelivered: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  drawerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16a34a', flexShrink: 0 },
  drawerDotVisited: { backgroundColor: '#9ca3af' },
  drawerDotDelivered: { backgroundColor: '#16a34a' },
  drawerCustomerName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  drawerCustomerNameVisited: { color: '#9ca3af' },
  drawerCustomerAddr: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  drawerCheckmark: { fontSize: 14, color: '#9ca3af', fontWeight: '700' },
  drawerCheckmarkDelivered: { fontSize: 14, color: '#16a34a', fontWeight: '700' },
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
