import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Mostrar las notificaciones aunque la app esté en primer plano.
// Se usa `as any` porque los nombres de campos cambiaron entre versiones
// (shouldShowAlert → shouldShowBanner/shouldShowList).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as unknown as Notifications.NotificationBehavior),
});

const CHANNEL_ID = 'cierres';

// Pide permiso (y crea el canal en Android). Devuelve true si quedó habilitado.
export async function ensureNotifPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Cierres de clientes',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === 'granted') return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted || req.status === 'granted';
  } catch {
    return false;
  }
}

export interface ClosingTarget {
  customerId: string;
  name: string;
  closingTime: string; // "HH:MM"
}

async function scheduleAt(date: Date, title: string, body: string): Promise<void> {
  const trigger: Record<string, unknown> = { date };
  const types = (Notifications as unknown as { SchedulableTriggerInputTypes?: { DATE?: unknown } }).SchedulableTriggerInputTypes;
  if (types?.DATE) trigger.type = types.DATE;
  if (Platform.OS === 'android') trigger.channelId = CHANNEL_ID;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: trigger as unknown as Notifications.NotificationTriggerInput,
  });
}

// Reprograma TODAS las notificaciones de cierre: cancela las anteriores y
// agenda, para cada cliente con horario, un aviso 1 h y 30 min antes del
// cierre (solo si esa hora todavía no pasó hoy).
export async function scheduleClosingReminders(targets: ClosingTarget[]): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = new Date();
    for (const t of targets) {
      const parts = t.closingTime.split(':');
      const hh = parseInt(parts[0], 10);
      const mm = parseInt(parts[1] ?? '0', 10);
      if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
      const close = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
      for (const r of [{ mins: 60, label: '1 hora' }, { mins: 30, label: '30 minutos' }]) {
        const when = new Date(close.getTime() - r.mins * 60000);
        if (when.getTime() <= now.getTime() + 1000) continue; // ya pasó
        await scheduleAt(
          when,
          `⏰ ${t.name} cierra pronto`,
          `Cierra a las ${t.closingTime}. Te queda ${r.label} para llegar.`,
        );
      }
    }
  } catch {
    /* noop */
  }
}
