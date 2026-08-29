package expo.modules.medalarm

import android.app.AlarmManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val TAG = "ExpoMedAlarm"

class ExpoMedAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoMedAlarm")

    Events("onAlarmAction")

    Function("scheduleAlarm") {
      medId: Long,
      horaIndex: Int,
      hour: Int,
      minute: Int,
      title: String,
      body: String,
      ->
      Log.d(TAG, "JS llamó scheduleAlarm medId=$medId horaIndex=$horaIndex hour=$hour minute=$minute")
      val context = appContext.reactContext ?: run {
        Log.e(TAG, "scheduleAlarm: reactContext es null")
        return@Function
      }
      AlarmScheduler.arm(context, medId, horaIndex, hour, minute, title, body)
    }

    Function("cancelAlarm") { medId: Long, horaIndex: Int ->
      val context = appContext.reactContext ?: return@Function
      AlarmScheduler.cancel(context, medId, horaIndex)
    }

    Function("scheduleAplazo") {
      medId: Long,
      horaIndex: Int,
      intentos: Int,
      delaySeconds: Int,
      title: String,
      body: String,
      ->
      val context = appContext.reactContext ?: return@Function
      AlarmScheduler.armAplazo(context, medId, horaIndex, intentos, delaySeconds, title, body)
    }

    Function("cancelAplazo") { medId: Long, horaIndex: Int, intentos: Int ->
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

    // Android 12+ (API 31) exige este permiso para AlarmManager.setAlarmClock;
    // sin él, una alarma puede fallar en silencio si el usuario lo revocó a
    // mano en Ajustes. No hay forma de pedirlo con un diálogo estándar: hay
    // que abrir la pantalla de Ajustes correspondiente.
    Function<Boolean>("canScheduleExactAlarms") {
      val context = appContext.reactContext ?: return@Function true
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function true
      val alarmManager = context.getSystemService(android.content.Context.ALARM_SERVICE) as AlarmManager
      alarmManager.canScheduleExactAlarms()
    }

    Function("requestExactAlarmPermission") {
      val context = appContext.reactContext ?: return@Function Unit
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function Unit
      val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
        data = Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      Unit
    }

    Function<Boolean>("isIgnoringBatteryOptimizations") {
      val context = appContext.reactContext ?: return@Function true
      val powerManager = context.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
      powerManager.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("requestIgnoreBatteryOptimizations") {
      val context = appContext.reactContext ?: return@Function Unit
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      Unit
    }

    Function<Boolean>("areNotificationsEnabled") {
      val context = appContext.reactContext ?: return@Function true
      NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    OnNewIntent { intent ->
      extraerDatos(intent)?.let { datos ->
        sendEvent("onAlarmAction", datos)
      }
    }
  }

  private fun extraerDatos(intent: Intent?): Bundle? {
    val medId = intent?.getLongExtra(AlarmConstants.EXTRA_MED_ID, -1L) ?: -1L
    if (medId == -1L) return null

    return Bundle().apply {
      putLong("medId", medId)
      putInt("horaIndex", intent?.getIntExtra(AlarmConstants.EXTRA_HORA_INDEX, 0) ?: 0)
      putInt("intentos", intent?.getIntExtra(AlarmConstants.EXTRA_INTENTOS, 0) ?: 0)
      putString(
        "accion",
        intent?.getStringExtra(AlarmConstants.EXTRA_ACCION) ?: AlarmConstants.ACCION_ABRIR,
      )
    }
  }
}
