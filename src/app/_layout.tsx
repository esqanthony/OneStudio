import '../global.css';

import { DarkTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.canvas,
    card: colors.surface,
    text: colors.ink,
    border: colors.line,
    primary: colors.accent,
  },
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.canvas },
            headerTintColor: colors.ink,
            contentStyle: { backgroundColor: colors.canvas },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="record"
            options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
          />
          <Stack.Screen name="edit/[sessionId]" options={{ title: 'Your video', headerBackTitle: 'Projects' }} />
          <Stack.Screen name="scripts/index" options={{ presentation: 'modal', title: 'Scripts' }} />
          <Stack.Screen name="scripts/[scriptId]" options={{ presentation: 'modal', title: 'Edit script' }} />
          <Stack.Screen name="teleprompter-settings" options={{ presentation: 'modal', title: 'Teleprompter' }} />
          <Stack.Screen name="slides" options={{ presentation: 'modal', title: 'Slides' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
