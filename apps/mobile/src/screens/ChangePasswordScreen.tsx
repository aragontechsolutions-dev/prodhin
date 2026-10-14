import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function ChangePasswordScreen() {
  const { profile, setProfile, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successVisible, setSuccessVisible] = useState(false);
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    if (!successVisible) return;
    setCountdown(4);
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) { clearInterval(interval); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [successVisible]);

  function showError(msg: string) {
    setErrorMsg(msg);
    setErrorVisible(true);
  }

  async function handleChange() {
    if (password.length < 6) {
      showError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      showError('Las contraseñas no coinciden. Verificá e intentá de nuevo.');
      return;
    }

    setLoading(true);
    try {
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw pwErr;

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', profile!.id);
      if (profErr) throw profErr;

      setSuccessVisible(true);
      // Sign out immediately to prevent onAuthStateChange from re-fetching the
      // updated profile (must_change_password: false) and navigating to the map.
      signOut();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Ocurrió un error. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>🔐</Text>
        <Text style={styles.title}>Cambiar contraseña</Text>
        <Text style={styles.subtitle}>
          Hola <Text style={styles.name}>{profile?.full_name?.split(' ')[0]}</Text>, por seguridad debés establecer una contraseña propia antes de continuar.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Nueva contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            autoFocus
          />

          <Text style={styles.label}>Confirmar contraseña</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repetir contraseña"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            onSubmitEditing={handleChange}
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleChange}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Guardar contraseña</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Error modal */}
      <Modal visible={errorVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Text style={styles.modalIconText}>✕</Text>
            </View>
            <Text style={styles.modalTitle}>Error</Text>
            <Text style={styles.modalMessage}>{errorMsg}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setErrorVisible(false)}>
              <Text style={styles.modalBtnText}>Intentar de nuevo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success modal */}
      <Modal visible={successVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconCircle, styles.modalIconCircleSuccess]}>
              <Text style={[styles.modalIconText, styles.modalIconTextSuccess]}>✓</Text>
            </View>
            <Text style={styles.modalTitle}>¡Contraseña actualizada!</Text>
            <Text style={styles.modalMessage}>
              Tu contraseña fue cambiada correctamente.{'\n'}Serás redirigido al inicio de sesión en {countdown} segundo{countdown !== 1 ? 's' : ''}...
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fffbeb' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logo: { fontSize: 52, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 8, marginBottom: 32, lineHeight: 20 },
  name: { fontWeight: '700', color: '#f59e0b' },
  form: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: '#111827', backgroundColor: '#fff',
  },
  button: {
    marginTop: 24, backgroundColor: '#f59e0b', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  logoutBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  logoutText: { fontSize: 13, color: '#9ca3af' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 28,
    width: '100%', maxWidth: 340, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 16,
  },
  modalIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalIconCircleSuccess: { backgroundColor: '#dcfce7' },
  modalIconText: { fontSize: 28, color: '#dc2626', fontWeight: '700', lineHeight: 32 },
  modalIconTextSuccess: { color: '#16a34a' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 10 },
  modalMessage: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  modalBtn: { width: '100%', backgroundColor: '#dc2626', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalBtnSuccess: { backgroundColor: '#16a34a' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
