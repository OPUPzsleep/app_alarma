package expo.modules.medalarm

import android.content.Intent
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoMedAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoMedAlarm")

    Events("onAlarmAction")

    Function("scheduleAlarm") {
      medId: Int,
      horaIndex: Int,
      hour: Int,
      minute: Int,
      title: String,
      body: String,
      ->
      val context = appContext.reactContext ?: return@Function
      AlarmScheduler.arm(context, medId, horaIndex, hour, minute, title, body)
    }

    Function("cancelAlarm") { medId: Int, horaIndex: Int ->
      val context = appContext.reactContext ?: return@Function
      AlarmScheduler.cancel(context, medId, horaIndex)
    }

    Function("scheduleAplazo") {
      medId: Int,
      horaIndex: Int,
      intentos: Int,
      delaySeconds: Int,
      title: String,
      body: String,
      ->
      val context = appContext.reactContext ?: return@Function
      AlarmScheduler.armAplazo(context, medId, horaIndex, intentos, delaySeconds, title, body)
    }

    Function("cancelAplazo") { medId: Int, horaIndex: Int, intentos: Int ->
      val context = appContext.reactContext ?: return@Function
      AlarmScheduler.cancelAplazo(context, medId, horaIndex, intentos)
    }

    Function("stopRinging") {
      val context = appContext.reactContext ?: return@Function Unit
      val intent = Intent(context, AlarmRingService::class.java).apply {
        action = AlarmConstants.ACTION_STOP_RINGING
      }
      context.startService(intent)
      Unit
    }

    Function<Bundle?>("getLaunchAlarmData") {
      extraerDatos(appContext.currentActivity?.intent)
    }

    OnNewIntent { intent ->
      extraerDatos(intent)?.let { datos ->
        sendEvent("onAlarmAction", datos)
      }
    }
  }

  private fun extraerDatos(intent: Intent?): Bundle? {
    val medId = intent?.getIntExtra(AlarmConstants.EXTRA_MED_ID, -1) ?: -1
    if (medId == -1) return null

    return Bundle().apply {
      putInt("medId", medId)
      putInt("horaIndex", intent?.getIntExtra(AlarmConstants.EXTRA_HORA_INDEX, 0) ?: 0)
      putInt("intentos", intent?.getIntExtra(AlarmConstants.EXTRA_INTENTOS, 0) ?: 0)
      putString(
        "accion",
        intent?.getStringExtra(AlarmConstants.EXTRA_ACCION) ?: AlarmConstants.ACCION_ABRIR,
      )
    }
  }
}
