import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import ExpoMedAlarm from "../../modules/expo-med-alarm/src/ExpoMedAlarmModule";

export type EstadoPermisosAlarma = {
  alarmaExacta: boolean;
  bateria: boolean;
  notificaciones: boolean;
};

const ESTADO_INICIAL: EstadoPermisosAlarma = {
  alarmaExacta: true,
  bateria: true,
  notificaciones: true,
};

// Android 12+ requiere el permiso "Alarmas y recordatorios" y, en muchos
// fabricantes, la excepción de optimización de batería para que las alarmas
// nunca fallen en silencio. Este hook refleja ese estado y deja pedirlos.
export function useAlarmPermissions() {
  const [estado, setEstado] = useState<EstadoPermisosAlarma>(ESTADO_INICIAL);

  const refrescar = useCallback(() => {
    if (Platform.OS !== "android") return;
    setEstado({
      alarmaExacta: ExpoMedAlarm.canScheduleExactAlarms(),
      bateria: ExpoMedAlarm.isIgnoringBatteryOptimizations(),
      notificaciones: ExpoMedAlarm.areNotificationsEnabled(),
    });
  }, []);

  // useFocusEffect ya cubre el montaje inicial (una pantalla recién montada
  // cuenta como "recién enfocada"), así que no hace falta un useEffect aparte.
  useFocusEffect(refrescar);

  // useFocusEffect solo detecta cambios de pestaña dentro de la propia app.
  // Al tocar "Activar" se abren los Ajustes del sistema (otra Activity) y al
  // volver con el botón atrás la pestaña de Ajustes nunca perdió el foco a
  // nivel de navegación, así que sin esto el banner se quedaba mostrando el
  // estado viejo hasta reiniciar la app.
  useEffect(() => {
    const suscripcion = AppState.addEventListener("change", (estadoApp) => {
      if (estadoApp === "active") refrescar();
    });
    return () => suscripcion.remove();
  }, [refrescar]);

  return {
    ...estado,
    refrescar,
    solicitarAlarmaExacta: () => ExpoMedAlarm.requestExactAlarmPermission(),
    solicitarExencionBateria: () => ExpoMedAlarm.requestIgnoreBatteryOptimizations(),
  };
}
