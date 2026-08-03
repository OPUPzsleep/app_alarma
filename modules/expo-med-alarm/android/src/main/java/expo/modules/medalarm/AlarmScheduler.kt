package expo.modules.medalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

/**
 * Programa la alarma con AlarmManager.setAlarmClock: es la misma API que usan
 * las apps de reloj/alarma reales, exenta de Doze y restricciones de batería.
 * Se reprograma para el día siguiente cada vez que AlarmReceiver la recibe,
 * así no depende de que la app esté abierta para seguir sonando cada día.
 */
object AlarmScheduler {
  // Namespace de requestCode separado del de la alarma diaria, para que un
  // aplazo nunca pise el PendingIntent de la alarma principal.
  private fun requestCodeAplazo(medId: Long, horaIndex: Int, intentos: Int): Int =
    AlarmConstants.requestCode(medId, horaIndex) * 100 + 50 + intentos

  private fun crearPendingIntent(
    context: Context,
    requestCode: Int,
    medId: Long,
    horaIndex: Int,
    intentos: Int,
    hour: Int,
    minute: Int,
    title: String,
    body: String,
  ): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      putExtra(AlarmConstants.EXTRA_MED_ID, medId)
      putExtra(AlarmConstants.EXTRA_HORA_INDEX, horaIndex)
      putExtra(AlarmConstants.EXTRA_INTENTOS, intentos)
      putExtra(AlarmConstants.EXTRA_HOUR, hour)
      putExtra(AlarmConstants.EXTRA_MINUTE, minute)
      putExtra(AlarmConstants.EXTRA_TITLE, title)
      putExtra(AlarmConstants.EXTRA_BODY, body)
    }
    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** Alarma diaria recurrente (la hora normal de la medicina). */
  fun arm(
    context: Context,
    medId: Long,
    horaIndex: Int,
    hour: Int,
    minute: Int,
    title: String,
    body: String,
  ) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val calendar = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, hour)
      set(Calendar.MINUTE, minute)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      if (timeInMillis <= System.currentTimeMillis()) {
        add(Calendar.DAY_OF_MONTH, 1)
      }
    }
    val requestCode = AlarmConstants.requestCode(medId, horaIndex)
    val pendingIntent = crearPendingIntent(context, requestCode, medId, horaIndex, 0, hour, minute, title, body)
    val info = AlarmManager.AlarmClockInfo(calendar.timeInMillis, pendingIntent)
    alarmManager.setAlarmClock(info, pendingIntent)
  }

  fun cancel(context: Context, medId: Long, horaIndex: Int) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val requestCode = AlarmConstants.requestCode(medId, horaIndex)
    val pendingIntent = crearPendingIntent(context, requestCode, medId, horaIndex, 0, 0, 0, "", "")
    alarmManager.cancel(pendingIntent)
    pendingIntent.cancel()
  }

  /**
   * Alarma única (no diaria) para el "La voy a tomar": suena de nuevo a los
   * pocos segundos para confirmar. hour/minute quedan en -1 para que
   * AlarmReceiver sepa que no debe reprogramarla para mañana.
   */
  fun armAplazo(
    context: Context,
    medId: Long,
    horaIndex: Int,
    intentos: Int,
    delaySeconds: Int,
    title: String,
    body: String,
  ) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val triggerAtMillis = System.currentTimeMillis() + delaySeconds * 1000L
    val requestCode = requestCodeAplazo(medId, horaIndex, intentos)
    val pendingIntent = crearPendingIntent(context, requestCode, medId, horaIndex, intentos, -1, -1, title, body)
    val info = AlarmManager.AlarmClockInfo(triggerAtMillis, pendingIntent)
    alarmManager.setAlarmClock(info, pendingIntent)
  }

  fun cancelAplazo(context: Context, medId: Long, horaIndex: Int, intentos: Int) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val requestCode = requestCodeAplazo(medId, horaIndex, intentos)
    val pendingIntent = crearPendingIntent(context, requestCode, medId, horaIndex, intentos, -1, -1, "", "")
    alarmManager.cancel(pendingIntent)
    pendingIntent.cancel()
  }
}
