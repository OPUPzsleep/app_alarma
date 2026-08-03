package expo.modules.medalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat

private const val TAG = "ExpoMedAlarm"

/**
 * Recibe el disparo de AlarmManager a la hora exacta. Arranca el servicio que
 * hace sonar/vibrar la alarma y reprograma el mismo aviso para mañana, para
 * que siga funcionando todos los días sin que la app tenga que estar abierta.
 */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val medId = intent.getLongExtra(AlarmConstants.EXTRA_MED_ID, -1L)
    Log.d(TAG, "AlarmReceiver.onReceive medId=$medId")
    if (medId == -1L) return

    val horaIndex = intent.getIntExtra(AlarmConstants.EXTRA_HORA_INDEX, 0)
    val intentos = intent.getIntExtra(AlarmConstants.EXTRA_INTENTOS, 0)
    val hour = intent.getIntExtra(AlarmConstants.EXTRA_HOUR, -1)
    val minute = intent.getIntExtra(AlarmConstants.EXTRA_MINUTE, -1)
    val title = intent.getStringExtra(AlarmConstants.EXTRA_TITLE) ?: "💊 ¡Es hora de tu medicina!"
    val body = intent.getStringExtra(AlarmConstants.EXTRA_BODY) ?: ""

    val serviceIntent = Intent(context, AlarmRingService::class.java).apply {
      putExtra(AlarmConstants.EXTRA_MED_ID, medId)
      putExtra(AlarmConstants.EXTRA_HORA_INDEX, horaIndex)
      putExtra(AlarmConstants.EXTRA_INTENTOS, intentos)
      putExtra(AlarmConstants.EXTRA_TITLE, title)
      putExtra(AlarmConstants.EXTRA_BODY, body)
    }
    ContextCompat.startForegroundService(context, serviceIntent)

    if (hour in 0..23 && minute in 0..59) {
      AlarmScheduler.arm(context, medId, horaIndex, hour, minute, title, body)
    }
  }
}
