import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icon";
import { COLORS, FONT_SIZES, TOUCH } from "@/constants/design-tokens";

// tabBarActiveTintColor/tabBarInactiveTintColor son siempre strings hex
// planos aquí (nunca PlatformColor), así que el color recibido por
// tabBarIcon nunca es un OpaqueColorValue en la práctica.
const asColor = (color: ColorValue): string => color as string;

export default function TabsLayout() {
  // Con edge-to-edge (obligatorio desde Android 15), el contenido se dibuja
  // detrás de la barra de navegación del sistema: sin sumar este margen, los
  // botones de la pestaña quedan tapados por los botones de navegación del
  // teléfono.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.teal,
        tabBarInactiveTintColor: COLORS.inkSoft,
        tabBarStyle: {
          height: TOUCH.tabItem + 20 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 14 + insets.bottom,
          borderTopColor: COLORS.line,
        },
        tabBarLabelStyle: {
          fontSize: FONT_SIZES.tabLabel,
          fontWeight: "700",
        },
        tabBarItemStyle: {
          minHeight: TOUCH.tabItem,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={asColor(color)} />,
        }}
      />
      <Tabs.Screen
        name="agregar"
        options={{
          title: "Agregar",
          tabBarIcon: ({ color, size }) => <Icon name="add-circle" size={size} color={asColor(color)} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }) => (
            <Icon name="chatbubble-ellipses-outline" size={size} color={asColor(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color, size }) => <Icon name="settings-outline" size={size} color={asColor(color)} />,
        }}
      />
    </Tabs>
  );
}
