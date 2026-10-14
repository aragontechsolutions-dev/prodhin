import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Linking,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { checkForUpdate, type UpdateInfo } from '../lib/appVersion';

// Muestra un aviso cuando hay una APK nueva publicada. Chequea al abrir la
// app y cada vez que vuelve al primer plano. Si la actualización es
// "mandatory", no se puede cerrar el aviso hasta descargarla.
export default function UpdateGate() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const run = useCallback(async () => {
    const result = await checkForUpdate();
    if (result?.updateAvailable) {
      setInfo(result);
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    run();
    const sub = AppState.addEventListener('change', (next) => {
      // Solo al pasar de background/inactive a active
      if (appState.current.match(/inactive|background/) && next === 'active') {
        run();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [run]);

  if (!info) return null;

  function download() {
    if (info?.apkUrl) Linking.openURL(info.apkUrl).catch(() => {});
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.icon}>🔄</Text>
          <Text style={styles.title}>Actualización disponible</Text>
          <Text style={styles.version}>Versión {info.latestVersion}</Text>
          {info.notes ? <Text style={styles.notes}>{info.notes}</Text> : null}
          <Text style={styles.help}>
            Tocá "Descargar" y luego instalá el archivo. Si Android te pide
            permiso para instalar apps, aceptalo.
          </Text>

          <TouchableOpacity style={styles.downloadBtn} onPress={download} activeOpacity={0.85}>
            <Text style={styles.downloadText}>⬇️  Descargar e instalar</Text>
          </TouchableOpacity>

          {!info.mandatory && (
            <TouchableOpacity style={styles.laterBtn} onPress={() => setVisible(false)} activeOpacity={0.7}>
              <Text style={styles.laterText}>Más tarde</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  icon: { fontSize: 44, marginBottom: 8 },
  title: { fontSize: 19, fontWeight: '800', color: '#111827', textAlign: 'center' },
  version: { fontSize: 13, fontWeight: '700', color: '#f59e0b', marginTop: 4 },
  notes: { fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 20, marginTop: 12 },
  help: { fontSize: 12, color: '#6b7280', textAlign: 'center', lineHeight: 18, marginTop: 12 },
  downloadBtn: {
    width: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  downloadText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  laterBtn: { paddingVertical: 12, marginTop: 4 },
  laterText: { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
});
