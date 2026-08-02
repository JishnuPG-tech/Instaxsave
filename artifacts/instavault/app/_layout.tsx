import React, { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { setBaseUrl } from '@workspace/api-client-react';
import { initDatabase } from '@/services/database';
import { useSettings } from '@/store/settings';

// Set base URL for API requests outside components
setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { hasSeenOnboarding } = useSettings();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Database init on mount
    if (Platform.OS !== 'web') {
      initDatabase();
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    
    const inTabsGroup = segments[0] === '(tabs)';
    if (!hasSeenOnboarding && inTabsGroup) {
      router.replace('/onboarding');
    } else if (hasSeenOnboarding && segments[0] === 'onboarding') {
      router.replace('/(tabs)');
    }
  }, [hasSeenOnboarding, segments, isReady]);

  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="download/[id]" options={{ presentation: 'card', headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
