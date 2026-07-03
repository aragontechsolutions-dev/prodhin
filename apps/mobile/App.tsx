import { QueryClient, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { CREATE_DELIVERY_KEY, createDelivery } from './src/lib/deliveries';

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
      <StatusBar style="dark" />
      <AppNavigator />
    </PersistQueryClientProvider>
  );
}
