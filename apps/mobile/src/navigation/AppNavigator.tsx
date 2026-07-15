import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import LoginScreen from '../screens/LoginScreen';
import MapScreen from '../screens/MapScreen';
import CustomerDetailScreen from '../screens/CustomerDetailScreen';
import RegisterDeliveryScreen from '../screens/RegisterDeliveryScreen';
import CustomerPreferencesScreen from '../screens/CustomerPreferencesScreen';
import DeliveriesHistoryScreen from '../screens/DeliveriesHistoryScreen';
import DailyLoadScreen from '../screens/DailyLoadScreen';
import TruckStockScreen from '../screens/TruckStockScreen';
import ManualScreen from '../screens/ManualScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import type { Customer } from '../types';

export type RootStackParamList = {
  Map: undefined;
  CustomerDetail: { customer: Customer };
  RegisterDelivery: { customer: Customer };
  CustomerPreferences: undefined;
  DeliveriesHistory: undefined;
  DailyLoad: undefined;
  TruckStock: undefined;
  Manual: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fffbeb' }}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  if (!profile) return <LoginScreen />;

  if (profile.must_change_password) return <ChangePasswordScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
        <Stack.Screen name="RegisterDelivery" component={RegisterDeliveryScreen} />
        <Stack.Screen name="CustomerPreferences" component={CustomerPreferencesScreen} />
        <Stack.Screen name="DeliveriesHistory" component={DeliveriesHistoryScreen} />
        <Stack.Screen name="DailyLoad" component={DailyLoadScreen} />
        <Stack.Screen name="TruckStock" component={TruckStockScreen} />
        <Stack.Screen name="Manual" component={ManualScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
