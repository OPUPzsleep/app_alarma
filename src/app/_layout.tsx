import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AlarmGate } from "@/components/alarm-gate";
import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { COLORS } from "@/constants/design-tokens";
import { MedicinesProvider } from "@/context/medicines-provider";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={DefaultTheme}>
        <MedicinesProvider>
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="historial"
              options={{
                headerShown: true,
                title: "Historial de tomas",
                headerStyle: { backgroundColor: COLORS.teal },
                headerTintColor: "#fff",
                headerTitleStyle: { fontSize: 19 },
              }}
            />
          </Stack>
          <AlarmGate />
        </MedicinesProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
