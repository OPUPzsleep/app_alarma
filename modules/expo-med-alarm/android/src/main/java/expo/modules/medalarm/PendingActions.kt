package expo.modules.medalarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Cola de acciones tocadas en la notificación ("Ya la tomé" / "La voy a
 * tomar") que la parte JS todavía no registró. Los botones se resuelven en
 * nativo sin abrir la app (en Xiaomi/MIUI y teléfonos lentos, abrir la app
 * desde la notificación fallaba o tardaba y la alarma seguía sonando), así
 * que el historial, el stock y el conteo de tomas se actualizan después,
 * cuando JS lee esta cola.
 */
object PendingActions {
  private const val PREFS = "expo_med_alarm_pending"
  private const val KEY = "acciones"

  // Lo registra el módulo mientras JS está vivo, para procesar la acción al
  // momento si la app ya está abierta.
  @Volatile
  var alAgregar: (() -> Unit)? = null

  @Synchronized
  fun agregar(context: Context, medId: Long, horaIndex: Int, intentos: Int, accion: String) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val lista = JSONArray(prefs.getString(KEY, "[]"))
    lista.put(
      JSONObject().apply {
        put("medId", medId)
        put("horaIndex", horaIndex)
        put("intentos", intentos)
        put("accion", accion)
        put("fechaMs", System.currentTimeMillis())
      },
    )
    prefs.edit().putString(KEY, lista.toString()).commit()
    alAgregar?.invoke()
  }

  @Synchronized
  fun tomarTodas(context: Context): List<Map<String, Any>> {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val lista = JSONArray(prefs.getString(KEY, "[]"))
    prefs.edit().remove(KEY).commit()
    return (0 until lista.length()).map { i ->
      val o = lista.getJSONObject(i)
      mapOf(
        "medId" to o.getLong("medId").toDouble(),
        "horaIndex" to o.getInt("horaIndex"),
        "intentos" to o.getInt("intentos"),
        "accion" to o.getString("accion"),
        "fechaMs" to o.getLong("fechaMs").toDouble(),
      )
    }
  }
}
