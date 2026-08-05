import { QueryClient, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import UpdateGate from './src/components/UpdateGate';
import Toast from './src/components/Toast';
import { CREATE_DELIVERY_KEY, createDelivery } from './src/lib/deliveries';
import {
  ADD_PREFERENCE_KEY,
  REMOVE_PREFERENCE_KEY,
  SET_PRIMARY_PREFERENCE_KEY,
  addPreference,
  removePreference,
  setPrimaryPreference,
} from './src/lib/preferences';
import {
  REGISTER_LOADS_KEY,
  REGISTER_COUNTS_KEY,
  registerLoads,
  registerCounts,
} from './src/lib/truck';
import { CONFIRM_LOAD_KEY, confirmLoad } from './src/lib/loadConfirm';
import { REGISTER_MAPLE_KEY, registerMapleReturn } from './src/lib/mapleReturns';
import { REGISTER_EGG_RETURN_KEY, registerEggReturn } from './src/lib/eggReturns';
import { REGISTER_PICKUP_KEY, registerBoxPickup } from './src/lib/boxPickups';
import { REGISTER_PROSPECT_KEY, registerProspect } from './src/lib/prospects';

// React Query sabe si hay conexión a través de NetInfo. Cuando no hay red,
// las mutaciones quedan "pausadas" y se persisten; al reconectar se reanudan.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  }),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,        // 5 min — datos frescos
      gcTime: 1000 * 60 * 60 * 24,     // 24 h — caché en memoria
    },
    mutations: {
      // Reintenta tras errores transitorios de red al reconectar
      retry: 3,
    },
  },
});

// Default de la mutación de entrega. Definirla aquí (fuera del componente)
// permite que una mutación pausada offline se reanude tras reiniciar la app,
// porque la mutationFn se rehidrata desde este default.
queryClient.setMutationDefaults(CREATE_DELIVERY_KEY, {
  mutationFn: createDelivery,
});
queryClient.setMutationDefaults(ADD_PREFERENCE_KEY, { mutationFn: addPreference });
queryClient.setMutationDefaults(REMOVE_PREFERENCE_KEY, { mutationFn: removePreference });
queryClient.setMutationDefaults(SET_PRIMARY_PREFERENCE_KEY, { mutationFn: setPrimaryPreference });
queryClient.setMutationDefaults(REGISTER_LOADS_KEY, { mutationFn: registerLoads });
queryClient.setMutationDefaults(REGISTER_COUNTS_KEY, { mutationFn: registerCounts });
queryClient.setMutationDefaults(CONFIRM_LOAD_KEY, { mutationFn: confirmLoad });
queryClient.setMutationDefaults(REGISTER_MAPLE_KEY, { mutationFn: registerMapleReturn });
queryClient.setMutationDefaults(REGISTER_EGG_RETURN_KEY, { mutationFn: registerEggReturn });
queryClient.setMutationDefaults(REGISTER_PICKUP_KEY, { mutationFn: registerBoxPickup });
queryClient.setMutationDefaults(REGISTER_PROSPECT_KEY, { mutationFn: registerProspect });

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'prodhin-query-cache',
  throttleTime: 3000,
});

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24 h en disco
      }}
      onSuccess={() => {
        // Al restaurar la caché, reanuda entregas que quedaron pendientes offline
        queryClient.resumePausedMutations();
      }}
    >
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AppNavigator />
        <UpdateGate />
        <Toast />
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}
