export type AlarmActionData = {
  medId: number;
  horaIndex: number;
  intentos: number;
  accion: "abrir" | "aplazar" | "tomada";
};

// Botón tocado en la notificación y ya resuelto en nativo (sonido apagado,
// aplazo programado), pendiente de registrar en historial/stock desde JS.
export type AccionPendiente = {
  medId: number;
  horaIndex: number;
  intentos: number;
  accion: "aplazar" | "tomada";
  fechaMs: number;
};

export type ExpoMedAlarmModuleEvents = {
  onAlarmAction: (event: AlarmActionData) => void;
  onPendingActions: () => void;
};
