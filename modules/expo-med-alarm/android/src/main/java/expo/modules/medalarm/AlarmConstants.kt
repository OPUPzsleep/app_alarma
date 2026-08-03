package expo.modules.medalarm

object AlarmConstants {
  const val EXTRA_MED_ID = "medId"
  const val EXTRA_HORA_INDEX = "horaIndex"
  const val EXTRA_INTENTOS = "intentos"
  const val EXTRA_TITLE = "title"
  const val EXTRA_BODY = "body"
  const val EXTRA_ACCION = "accion"
  const val EXTRA_HOUR = "hour"
  const val EXTRA_MINUTE = "minute"

  const val ACTION_STOP_RINGING = "expo.modules.medalarm.STOP_RINGING"

  const val ACCION_APLAZAR = "aplazar"
  const val ACCION_TOMADA = "tomada"
  const val ACCION_ABRIR = "abrir"

  const val CHANNEL_ID = "alarmas-medicinas-nativas"

  // medId es un Date.now() de JS (13 dígitos), no entra en un Int de 32 bits,
  // así que se combina con hashCode() (mezcla los 64 bits en 32) en vez de
  // multiplicar directo, para que el requestCode de PendingIntent siga
  // siendo un Int válido y estable por medicina+horario.
  fun requestCode(medId: Long, horaIndex: Int): Int = medId.hashCode() * 10 + horaIndex
}
