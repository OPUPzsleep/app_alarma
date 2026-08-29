import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { ConfirmDoseModal, Confirmacion } from "@/components/confirm-dose-modal";
import { useMedicines } from "@/context/medicines-provider";
import ExpoMedAlarm from "../../modules/expo-med-alarm/src/ExpoMedAlarmModule";
import type { AlarmActionData } from "../../modules/expo-med-alarm/src/ExpoMedAlarm.types";

// Montado una sola vez en la raíz (_layout.tsx), por encima de la
// navegación: así el flujo de alarma (tocar la notificación, "La voy a
// tomar", "Ya la tomé") funciona sin importar en qué pestaña esté la
// persona, sin importar cuántas pantallas tenga la app.
export function AlarmGate() {
  const { marcarComoTomada, registrarAplazo, obtenerMedicinaFresca } = useMedicines();
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);

  useEffect(() => {
    const procesarAccionAlarma = async (datos: AlarmActionData) => {
      ExpoMedAlarm.stopRinging();

      const { medId, horaIndex, intentos, accion } = datos;
      if (!medId) return;

      const med = await obtenerMedicinaFresca(medId);
      if (!med) return;

      if (accion === "tomada") {
        const resultado = await marcarComoTomada(med.id, horaIndex);
        setConfirmacion({ med, horaIndex, intentos, mensaje: resultado.mensaje });
      } else if (accion === "aplazar") {
        await registrarAplazo(med, horaIndex, intentos + 1);
        setConfirmacion({
          med,
          horaIndex,
          intentos: intentos + 1,
          mensaje: "Perfecto, ve por tu pastilla. Te recordamos en 2 minutos.",
        });
      } else {
        setConfirmacion({ med, horaIndex, intentos });
      }
    };

    const datosDeInicio = ExpoMedAlarm.getLaunchAlarmData();
    if (datosDeInicio) {
      procesarAccionAlarma(datosDeInicio);
    }

    const suscripcion = ExpoMedAlarm.addListener("onAlarmAction", (datos) => {
      procesarAccionAlarma(datos);
    });

    return () => suscripcion.remove();
  }, [marcarComoTomada, registrarAplazo, obtenerMedicinaFresca]);

  return (
    <ConfirmDoseModal
      confirmacion={confirmacion}
      onCerrar={() => setConfirmacion(null)}
      onYaLaTome={async () => {
        if (!confirmacion) return;
        const resultado = await marcarComoTomada(confirmacion.med.id, confirmacion.horaIndex);
        setConfirmacion(null);
        if (!resultado.ok) Alert.alert("Aviso", resultado.mensaje);
      }}
      onAplazar={async () => {
        if (!confirmacion) return;
        await registrarAplazo(confirmacion.med, confirmacion.horaIndex, confirmacion.intentos + 1);
        setConfirmacion(null);
      }}
    />
  );
}
