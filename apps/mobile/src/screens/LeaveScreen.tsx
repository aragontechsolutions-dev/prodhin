import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import type { MyLeave } from '../hooks/useMyLeave';

function fmt(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function LeaveScreen({ leave }: { leave: MyLeave }) {
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.emoji}>🌴</Text>
      <Text style={styles.title}>Estás de licencia</Text>
      <Text style={styles.body}>
        Hola {profile?.full_name?.split(' ')[0] ?? ''}. Tu licencia está activa
        {leave.end_date ? ` hasta el ${fmt(leave.end_date)}` : ''}.
      </Text>
      <Text style={styles.body}>
        Mientras estés de licencia no podés registrar operaciones.
        {leave.cover_name ? ` Tus clientes los está atendiendo ${leave.cover_name}.` : ''}
      </Text>
      <Text style={styles.note}>
        Si creés que es un error, avisá a la administración.
      </Text>

      <TouchableOpacity style={styles.btn} onPress={signOut} activeOpacity={0.85}>
        <Text style={styles.btnText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fffbeb', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingTop: Platform.OS === 'ios' ? 80 : 40, gap: 14 },
  emoji: { fontSize: 64 },
  title: { fontSize: 24, fontWeight: '800', color: '#92400e', textAlign: 'center' },
  body: { fontSize: 15, color: '#78350f', textAlign: 'center', lineHeight: 22 },
  note: { fontSize: 13, color: '#b45309', textAlign: 'center', marginTop: 6 },
  btn: { marginTop: 24, backgroundColor: '#f59e0b', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
