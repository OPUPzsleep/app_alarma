export type AlarmActionData = {
  medId: number;
  horaIndex: number;
  intentos: number;
  accion: "abrir" | "aplazar" | "tomada";
};

export type ExpoMedAlarmModuleEvents = {
  onAlarmAction: (event: AlarmActionData) => void;
};
