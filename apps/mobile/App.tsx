import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,        // 5 min — datos frescos
      gcTime: 1000 * 60 * 60 * 24,     // 24 h — caché en memoria
    },
  },
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
    >
      <StatusBar style="dark" />
      <AppNavigator />
    </PersistQueryClientProvider>
  );
}
