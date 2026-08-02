import { NativeModule, requireNativeModule } from "expo";

import { AlarmActionData, ExpoMedAlarmModuleEvents } from "./ExpoMedAlarm.types";

declare class ExpoMedAlarmModule extends NativeModule<ExpoMedAlarmModuleEvents> {
  scheduleAlarm(
    medId: number,
    horaIndex: number,
    hour: number,
    minute: number,
    title: string,
    body: string,
  ): void;
  cancelAlarm(medId: number, horaIndex: number): void;
  scheduleAplazo(
    medId: number,
    horaIndex: number,
    intentos: number,
    delaySeconds: number,
    title: string,
    body: string,
  ): void;
  cancelAplazo(medId: number, horaIndex: number, intentos: number): void;
  stopRinging(): void;
  getLaunchAlarmData(): AlarmActionData | null;
}

export default requireNativeModule<ExpoMedAlarmModule>("ExpoMedAlarm");
