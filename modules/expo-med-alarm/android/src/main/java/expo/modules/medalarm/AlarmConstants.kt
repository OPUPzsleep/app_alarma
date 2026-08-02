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

  // horaIndex siempre es < 10 (máximo 6 tomas por día), así que esta
  // combinación es única por medicina+horario sin necesitar más estado.
  fun requestCode(medId: Int, horaIndex: Int): Int = medId * 10 + horaIndex
}
