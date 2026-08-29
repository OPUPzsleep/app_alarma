import ExpoMedAlarm from "../../modules/expo-med-alarm/src/ExpoMedAlarmModule";
import {
  MAX_APLAZOS,
  MAX_HORAS_POR_DIA,
  Medicina,
  SEGUNDOS_APLAZO,
  parsearHora,
  tituloYCuerpo,
} from "./medicine-model";

const programarAlarma = (med: Medicina, horaIndex: number) => {
  const hora = parsearHora(med.horas[horaIndex]);
  const { title, body } = tituloYCuerpo(med);
  ExpoMedAlarm.scheduleAlarm(med.id, horaIndex, hora.getHours(), hora.getMinutes(), title, body);
};

// Cancela todos los horarios posibles de cada medicina antes de reprogramar,
// para no dejar alarmas viejas si se editaron o redujeron las horas de toma,
// y salta las medicinas completadas o cuyo tratamiento temporal ya venció.
export const sincronizarAlarmas = (lista: Medicina[]) => {
  for (const med of lista) {
    for (let indice = 0; indice < MAX_HORAS_POR_DIA; indice += 1) {
      ExpoMedAlarm.cancelAlarm(med.id, indice);
    }
  }

  for (const med of lista) {
    if (med.estado === "completada") continue;
    if (med.tipoCiclo === "temporal" && med.fechaFin && new Date(med.fechaFin) < new Date()) {
      continue;
    }
    for (let indice = 0; indice < med.horas.length; indice += 1) {
      programarAlarma(med, indice);
    }
  }
};

export const cancelarAlarmasDeMedicina = (med: Medicina) => {
  for (let indice = 0; indice < MAX_HORAS_POR_DIA; indice += 1) {
    ExpoMedAlarm.cancelAlarm(med.id, indice);
  }
};

// Reprograma un aviso único (no diario) para dentro de unos minutos cuando la
// persona pide más tiempo ("La voy a tomar"). Tras MAX_APLAZOS veces sin
// confirmar se deja de insistir para no generar una alarma infinita.
export const aplazarToma = (med: Medicina, horaIndex: number, intentos: number) => {
  if (intentos > MAX_APLAZOS) return;
  const { title, body } = tituloYCuerpo(med);
  ExpoMedAlarm.scheduleAplazo(med.id, horaIndex, intentos, SEGUNDOS_APLAZO, title, body);
};

// Si había avisos de "¿ya la tomaste?" programados por un aplazo, se
// cancelan al confirmar para que no vuelvan a sonar preguntando algo que
// ya se contestó.
export const cancelarAplazosPendientes = (med: Medicina) => {
  for (let indice = 0; indice < med.horas.length; indice += 1) {
    for (let intentos = 1; intentos <= MAX_APLAZOS; intentos += 1) {
      ExpoMedAlarm.cancelAplazo(med.id, indice, intentos);
    }
  }
};
