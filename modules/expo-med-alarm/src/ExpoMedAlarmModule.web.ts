import { registerWebModule, NativeModule } from "expo";

import { AlarmActionData, ExpoMedAlarmModuleEvents } from "./ExpoMedAlarm.types";

// La alarma nativa (vibración/sonido en bucle) no existe en web; se dejan
// no-ops para que el mismo código de la app no rompa el bundle web.
class ExpoMedAlarmModule extends NativeModule<ExpoMedAlarmModuleEvents> {
  scheduleAlarm(
    _medId: number,
    _horaIndex: number,
    _hour: number,
    _minute: number,
    _title: string,
    _body: string,
  ): void {}
  cancelAlarm(_medId: number, _horaIndex: number): void {}
  scheduleAplazo(
    _medId: number,
    _horaIndex: number,
    _intentos: number,
    _delaySeconds: number,
    _title: string,
    _body: string,
  ): void {}
  cancelAplazo(_medId: number, _horaIndex: number, _intentos: number): void {}
  stopRinging(): void {}
  getLaunchAlarmData(): AlarmActionData | null {
    return null;
  }
}

export default registerWebModule(ExpoMedAlarmModule, "ExpoMedAlarmModule");
