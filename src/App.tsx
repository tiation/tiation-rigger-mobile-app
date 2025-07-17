import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';

// Redux Store
import { store, persistor } from './store';

// Screens
import SplashScreen from './screens/SplashScreen';
import AuthScreen from './screens/AuthScreen';
import DashboardScreen from './screens/DashboardScreen';
import JobsScreen from './screens/JobsScreen';
import ProfileScreen from './screens/ProfileScreen';
import ComplianceScreen from './screens/ComplianceScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import SettingsScreen from './screens/SettingsScreen';

// Navigation
import { AuthNavigator } from './navigation/AuthNavigator';
import { MainNavigator } from './navigation/MainNavigator';

// Components
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorFallback from './components/common/ErrorFallback';

// Services
import { initializeServices } from './services';
import { setupPushNotifications } from './services/PushNotificationService';
import { BiometricService } from './services/BiometricService';
import { CrashReportingService } from './services/CrashReportingService';
import { AnalyticsService } from './services/AnalyticsService';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useAppState } from './hooks/useAppState';
import { useNetworkStatus } from './hooks/useNetworkStatus';

// Types
import { RootStackParamList } from './types/navigation';

// Create Stack Navigator
const Stack = createStackNavigator<RootStackParamList>();

// Create Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

// Error Handler
const errorHandler = (error: Error, errorInfo: React.ErrorInfo) => {
  console.error('App Error:', error, errorInfo);
  CrashReportingService.recordError(error, errorInfo);
  AnalyticsService.track('app_error', {
    error: error.message,
    stack: error.stack,
  });
};

// Main App Component
const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { isOnline } = useNetworkStatus();
  const appState = useAppState();

  React.useEffect(() => {
    // Initialize services
    initializeServices();
    
    // Setup push notifications
    setupPushNotifications();
    
    // Setup biometric authentication
    BiometricService.initialize();
    
    // Setup crash reporting
    CrashReportingService.initialize();
    
    // Setup analytics
    AnalyticsService.initialize();
  }, []);

  React.useEffect(() => {
    // Handle app state changes
    if (appState === 'background') {
      // Handle background state
      AnalyticsService.track('app_backgrounded');
    } else if (appState === 'active') {
      // Handle foreground state
      AnalyticsService.track('app_foregrounded');
    }
  }, [appState]);

  React.useEffect(() => {
    // Handle network status changes
    AnalyticsService.track('network_status_changed', { isOnline });
  }, [isOnline]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          cardStyleInterpolator: ({ current, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          },
        }}
      >
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Root App Component
const App: React.FC = () => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={errorHandler}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Provider store={store}>
          <PersistGate loading={<LoadingSpinner />} persistor={persistor}>
            <QueryClientProvider client={queryClient}>
              <SafeAreaProvider>
                <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
                <AppContent />
                <Toast />
              </SafeAreaProvider>
            </QueryClientProvider>
          </PersistGate>
        </Provider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
};

export default App;
