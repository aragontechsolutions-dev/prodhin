import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function dayEnd(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

interface Props {
  visible: boolean;
  initialFrom?: number | null;
  initialTo?: number | null;
  onClose: () => void;
  onApply: (from: number, to: number) => void;
}

export default function DateRangeModal({ visible, initialFrom, initialTo, onClose, onApply }: Props) {
  const today = new Date();
  const [month, setMonth] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [from, setFrom] = useState<number | null>(initialFrom ?? null);
  const [to, setTo] = useState<number | null>(initialTo ?? null);

  function pick(day: Date) {
    const t = dayStart(day);
    if (from == null || (from != null && to != null)) {
      setFrom(t);
      setTo(null);
    } else if (t < from) {
      setTo(from);
      setFrom(t);
    } else {
      setTo(t);
    }
  }

  function apply() {
    if (from == null) return;
    onApply(from, dayEnd(to ?? from));
  }

  function quickToday() {
    const t = dayStart(new Date());
    setFrom(t);
    setTo(null);
  }

  const year = month.getFullYear();
  const mIndex = month.getMonth();
  const firstWeekday = (new Date(year, mIndex, 1).getDay() + 6) % 7; // lunes primero
  const daysInMonth = new Date(year, mIndex + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, mIndex, d));

  const todayTs = dayStart(today);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          {/* Header mes */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={() => setMonth(new Date(year, mIndex - 1, 1))} style={styles.navBtn}>
              <Text style={styles.navTxt}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{MONTHS[mIndex]} {year}</Text>
            <TouchableOpacity onPress={() => setMonth(new Date(year, mIndex + 1, 1))} style={styles.navBtn}>
              <Text style={styles.navTxt}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Días de la semana */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekTxt}>{w}</Text>
            ))}
          </View>

          {/* Grilla */}
          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={styles.cell} />;
              const ts = dayStart(day);
              const isFuture = ts > todayTs;
              const inRange = from != null && to != null && ts >= from && ts <= to;
              const isEndpoint = ts === from || ts === to;
              const isToday = ts === todayTs;
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.cell}
                  disabled={isFuture}
                  onPress={() => pick(day)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.dayInner,
                    inRange && !isEndpoint && styles.dayInRange,
                    isEndpoint && styles.dayEndpoint,
                  ]}>
                    <Text style={[
                      styles.dayTxt,
                      isFuture && styles.dayFuture,
                      isToday && !isEndpoint && styles.dayToday,
                      isEndpoint && styles.dayEndpointTxt,
                    ]}>
                      {day.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.hint}>
            {from == null ? 'Elegí un día (o dos para un rango)' :
              to == null ? 'Elegí el día final o aplicá para ver solo ese día' :
                'Rango seleccionado'}
          </Text>

          {/* Acciones */}
          <View style={styles.actions}>
            <TouchableOpacity onPress={quickToday} style={styles.todayBtn}>
              <Text style={styles.todayTxt}>Hoy</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={apply} disabled={from == null} style={[styles.applyBtn, from == null && { opacity: 0.5 }]}>
              <Text style={styles.applyTxt}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 20, padding: 18 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  navTxt: { fontSize: 24, color: '#1d4ed8', fontWeight: '700' },
  monthTitle: { fontSize: 16, fontWeight: '700', color: '#111827', textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row' },
  weekTxt: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#9ca3af', paddingBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  dayInner: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayInRange: { backgroundColor: '#eff6ff', borderRadius: 0, width: '100%' },
  dayEndpoint: { backgroundColor: '#1d4ed8' },
  dayTxt: { fontSize: 14, color: '#374151', fontWeight: '600' },
  dayFuture: { color: '#d1d5db' },
  dayToday: { color: '#1d4ed8', fontWeight: '800' },
  dayEndpointTxt: { color: '#fff', fontWeight: '800' },
  hint: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  todayBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' },
  todayTxt: { color: '#92400e', fontWeight: '700', fontSize: 13 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#f3f4f6' },
  cancelTxt: { color: '#374151', fontWeight: '700', fontSize: 13 },
  applyBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#1d4ed8' },
  applyTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
