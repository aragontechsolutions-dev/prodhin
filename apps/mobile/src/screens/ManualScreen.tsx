import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Manual'>;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Item {
  icon: string;
  title: string;
  body: string[]; // párrafos / pasos
  tip?: string;
}

const SECTIONS: Item[] = [
  {
    icon: '🗺️',
    title: 'El mapa y tus clientes',
    body: [
      'Al abrir la app ves tus clientes en el mapa.',
      'Verde pulsante: cliente de tu ruta de hoy (pendiente).',
      'Verde con ✓: le registraste una entrega (con venta).',
      'Gris con ✓: lo visitaste pero sin venta (ausente / no quiso / sin stock).',
      'Rojo: cliente tuyo que hoy no está en la ruta.',
      'Naranja (rombo): cliente que estás cubriendo por otro chofer.',
    ],
    tip: 'Usá el buscador (🔍) para encontrar un cliente por nombre o RUT: el mapa vuela hasta él.',
  },
  {
    icon: '☰',
    title: 'El menú lateral',
    body: [
      'Tocá las tres líneas (☰) arriba a la izquierda para abrir el menú.',
      '📍 Mis clientes: todos tus clientes.',
      '🗓️ Ruta de hoy: pendientes, entregados y visitados sin venta.',
      '🥚 Tipos de huevo: qué compra cada cliente.',
      '🚚 Carga del día: cuánto conviene cargar hoy.',
      '📦 Stock del camión: lo que hay arriba del camión.',
      '📦 Mis entregas: historial de lo que entregaste.',
    ],
    tip: 'Tocando fuera del menú, se cierra y volvés al mapa.',
  },
  {
    icon: '🧭',
    title: 'Navegar hasta un cliente',
    body: [
      'Tocá un cliente y luego "Navegar".',
      'El mapa gira para que la calle por la que vas quede siempre vertical.',
      'Te avisa los giros por voz.',
      'Si te salís del camino, recalcula la ruta solo.',
    ],
    tip: 'No necesitás salir a Google Maps: la navegación es dentro de la app.',
  },
  {
    icon: '🥚',
    title: 'Registrar una entrega',
    body: [
      'Entrá al detalle del cliente y tocá "🥚 Registrar entrega".',
      'Elegí el resultado: Entregado, Ausente, No quiso o Sin stock.',
      'Marcá uno o varios tipos de huevo (se prellena con el principal del cliente).',
      'Poné la cantidad de cajas plásticas de cada tipo (con +/− o tocando el número para escribirlo).',
      'Guardá: el cliente queda marcado como visitado.',
    ],
    tip: 'Sin señal se guarda igual y se envía sola al reconectar. 1 cajón = 2 cajas plásticas.',
  },
  {
    icon: '⭐',
    title: 'Tipos de huevo del cliente',
    body: [
      'En el detalle del cliente podés marcar los tipos que suele comprar.',
      'Tocá un tipo para agregarlo o quitarlo.',
      'Mantené presionado un tipo para marcarlo como principal (⭐).',
      'Si entregás un tipo nuevo, la app te ofrece agregarlo a los habituales.',
    ],
  },
  {
    icon: '🚚',
    title: 'Carga del día',
    body: [
      'Te dice cuántas cajas plásticas de cada tipo cargar para la ruta de hoy.',
      'Demanda estimada (lo que suelen comprar + 10%) MENOS lo que ya hay en el camión.',
      'Muestra: demanda · en camión · a cargar.',
      'Tocá un tipo para ver qué clientes lo aportan.',
    ],
    tip: 'Al principio será poco precisa; mejora sola a medida que registrás entregas.',
  },
  {
    icon: '📦',
    title: 'Stock del camión',
    body: [
      'Muestra lo que hay arriba del camión por tipo de huevo.',
      '➕ Registrar carga: sumás lo que subís al camión.',
      '🔢 Hacer recuento: ponés la cantidad real contada (corrige desvíos).',
      'Cada entrega descuenta sola del stock.',
      'El sobrante queda para el día siguiente.',
    ],
    tip: 'A la mañana hacé la carga; a fin del día un recuento rápido deja todo exacto.',
  },
  {
    icon: '📦',
    title: 'Mis entregas',
    body: [
      'Arriba ves un resumen por tipo de huevo (cajas plásticas y cajones).',
      'Filtrá por Hoy, 7/15/30/90 días, o elegí un día o rango con 📅 Fechas.',
      'Buscá por cliente o RUT, y filtrá por tipo de huevo.',
      'Útil si un cliente te pregunta por una entrega de hace días.',
    ],
  },
  {
    icon: '🔒',
    title: 'Sesión y contraseña',
    body: [
      'La primera vez la app te pide cambiar la contraseña temporal.',
      'Por seguridad, la sesión se cierra sola si no usás la app un buen rato.',
      'Si te pasa, volvés a ingresar con tu email y contraseña.',
    ],
  },
];

function AccordionCard({ item, open, onToggle }: { item: Item; open: boolean; onToggle: () => void }) {
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHead} activeOpacity={0.7} onPress={onToggle}>
        <Text style={styles.cardIcon}>{item.icon}</Text>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.cardBody}>
          {item.body.map((line, i) => (
            <View key={i} style={styles.line}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.lineText}>{line}</Text>
            </View>
          ))}
          {item.tip && (
            <View style={styles.tip}>
              <Text style={styles.tipText}>💡 {item.tip}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function ManualScreen() {
  const navigation = useNavigation<Nav>();
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  function toggle(i: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIdx((prev) => (prev === i ? null : i));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Manual del chofer</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Guía rápida para usar la app en la calle. Tocá cada tema para ver los detalles.</Text>
        {SECTIONS.map((item, i) => (
          <AccordionCard key={item.title} item={item} open={openIdx === i} onToggle={() => toggle(i)} />
        ))}
        <Text style={styles.footer}>Prodhin · ¿Dudas? Consultá con el administrador.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: '#fffbeb',
    borderWidth: 1, borderColor: '#fde68a', alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 14, color: '#92400e', fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center', marginHorizontal: 8 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  intro: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginBottom: 4 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  cardIcon: { fontSize: 22 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  chevron: { fontSize: 14, color: '#9ca3af' },
  cardBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  line: { flexDirection: 'row', gap: 8 },
  bullet: { color: '#1d4ed8', fontSize: 15, lineHeight: 20 },
  lineText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  tip: { backgroundColor: '#fffbeb', borderRadius: 10, borderWidth: 1, borderColor: '#fde68a', padding: 10, marginTop: 4 },
  tipText: { fontSize: 13, color: '#92400e', lineHeight: 18 },
  footer: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 12 },
});
