package expo.modules.medalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast

private const val TAG = "ExpoMedAlarm"

/**
 * Recibe los botones de la notificación de alarma. Todo se resuelve aquí, sin
 * abrir la app: antes los botones abrían la Activity y era JS quien apagaba
 * el sonido, lo que en MIUI (bloquea abrir pantallas desde segundo plano) o
 * en teléfonos lentos dejaba los botones "muertos" y la alarma sonando.
 */
class AlarmActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val medId = intent.getLongExtra(AlarmConstants.EXTRA_MED_ID, -1L)
    val horaIndex = intent.getIntExtra(AlarmConstants.EXTRA_HORA_INDEX, 0)
    val intentos = intent.getIntExtra(AlarmConstants.EXTRA_INTENTOS, 0)
    val accion = intent.getStringExtra(AlarmConstants.EXTRA_ACCION) ?: return
    val title = intent.getStringExtra(AlarmConstants.EXTRA_TITLE) ?: ""
    val body = intent.getStringExtra(AlarmConstants.EXTRA_BODY) ?: ""
    Log.d(TAG, "AlarmActionReceiver accion=$accion medId=$medId horaIndex=$horaIndex intentos=$intentos")

    // stopService no tiene las restricciones de arranque en segundo plano de
    // startService; onDestroy del servicio apaga sonido, vibración y
    // notificación.
    context.stopService(Intent(context, AlarmRingService::class.java))
    if (medId == -1L) return

    val mensaje = when (accion) {
      AlarmConstants.ACCION_TOMADA -> {
        for (i in 1..AlarmConstants.MAX_APLAZOS) {
          AlarmScheduler.cancelAplazo(context, medId, horaIndex, i)
        }
        PendingActions.agregar(context, medId, horaIndex, intentos, accion)
        "✅ ¡Bien hecho! Se registró la toma."
      }
      AlarmConstants.ACCION_APLAZAR -> {
        val siguiente = intentos + 1
        PendingActions.agregar(context, medId, horaIndex, siguiente, accion)
        if (siguiente <= AlarmConstants.MAX_APLAZOS) {
          AlarmScheduler.armAplazo(
            context, medId, horaIndex, siguiente, AlarmConstants.SEGUNDOS_APLAZO, title, body,
          )
          "Ve por tu pastilla. Te recordamos en 2 minutos."
        } else {
          "Está bien. No volveremos a insistir con esta toma."
        }
      }
      else -> return
    }
    Toast.makeText(context, mensaje, Toast.LENGTH_LONG).show()
  }
}
