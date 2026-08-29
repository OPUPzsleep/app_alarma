import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// El sonido/vibración de la alarma en sí los maneja el servicio nativo en
// bucle (modules/expo-med-alarm), no este canal. Este canal es el que usa
// expo-notifications para pedir el permiso POST_NOTIFICATIONS (Android 13+):
// crearlo antes de pedir el permiso evita que el sistema deje el diálogo sin
// mostrar por no haber ningún canal registrado todavía.
const CANAL_ID = "avisos-generales";

export const prepararNotificaciones = async () => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CANAL_ID, {
      name: "Avisos de Mis Medicinas",
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  await Notifications.requestPermissionsAsync();
};
