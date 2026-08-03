package expo.modules.medalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.CountDownTimer
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

/**
 * Servicio en primer plano que hace sonar y vibrar la alarma de forma
 * continua (en bucle) hasta que la persona toca "La voy a tomar" o
 * "Ya la tomé" en la notificación, o hasta un límite de seguridad de 5
 * minutos para no drenar la batería si nadie responde.
 */
class AlarmRingService : Service() {
  private var vibrator: Vibrator? = null
  private var mediaPlayer: MediaPlayer? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var autoStopTimer: CountDownTimer? = null

  companion object {
    private const val NOTIFICATION_ID = 4821
    private const val MAX_RING_MS = 5 * 60 * 1000L
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == AlarmConstants.ACTION_STOP_RINGING) {
      detenerTodo()
      stopSelf()
      return START_NOT_STICKY
    }

    val medId = intent?.getLongExtra(AlarmConstants.EXTRA_MED_ID, -1L) ?: -1L
    val horaIndex = intent?.getIntExtra(AlarmConstants.EXTRA_HORA_INDEX, 0) ?: 0
    val intentos = intent?.getIntExtra(AlarmConstants.EXTRA_INTENTOS, 0) ?: 0
    val title = intent?.getStringExtra(AlarmConstants.EXTRA_TITLE) ?: "💊 ¡Es hora de tu medicina!"
    val body = intent?.getStringExtra(AlarmConstants.EXTRA_BODY) ?: ""

    startForeground(NOTIFICATION_ID, construirNotificacion(medId, horaIndex, intentos, title, body))
    iniciarVibracion()
    iniciarSonido()
    adquirirWakeLock()
    programarAutoStop()

    return START_REDELIVER_INTENT
  }

  private fun construirNotificacion(
    medId: Long,
    horaIndex: Int,
    intentos: Int,
    title: String,
    body: String,
  ): Notification {
    crearCanalSiHaceFalta()

    val abrirIntent = crearActivityPendingIntent(medId, horaIndex, intentos, AlarmConstants.ACCION_ABRIR)
    val aplazarIntent = crearActivityPendingIntent(medId, horaIndex, intentos, AlarmConstants.ACCION_APLAZAR)
    val tomadaIntent = crearActivityPendingIntent(medId, horaIndex, intentos, AlarmConstants.ACCION_TOMADA)

    val iconRes = resources.getIdentifier("notification_icon", "drawable", packageName)
      .takeIf { it != 0 } ?: applicationInfo.icon

    return NotificationCompat.Builder(this, AlarmConstants.CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(body)
      .setSmallIcon(iconRes)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(abrirIntent)
      .setFullScreenIntent(abrirIntent, true)
      .addAction(0, "🚶 La voy a tomar", aplazarIntent)
      .addAction(0, "✅ Ya la tomé", tomadaIntent)
      .build()
  }

  private fun crearCanalSiHaceFalta() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(AlarmConstants.CHANNEL_ID) == null) {
      val channel = NotificationChannel(
        AlarmConstants.CHANNEL_ID,
        "Alarmas de medicinas",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Avisos de toma de medicinas"
        // El sonido y la vibración los maneja este servicio en bucle, no el
        // canal (que solo sonaría/vibraría una vez).
        enableVibration(false)
        setSound(null, null)
        setBypassDnd(true)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      manager.createNotificationChannel(channel)
    }
  }

  private fun crearActivityPendingIntent(
    medId: Long,
    horaIndex: Int,
    intentos: Int,
    accion: String,
  ): PendingIntent {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      putExtra(AlarmConstants.EXTRA_MED_ID, medId)
      putExtra(AlarmConstants.EXTRA_HORA_INDEX, horaIndex)
      putExtra(AlarmConstants.EXTRA_INTENTOS, intentos)
      putExtra(AlarmConstants.EXTRA_ACCION, accion)
    } ?: Intent()

    val accionOffset = when (accion) {
      AlarmConstants.ACCION_APLAZAR -> 1
      AlarmConstants.ACCION_TOMADA -> 2
      else -> 0
    }

    return PendingIntent.getActivity(
      this,
      AlarmConstants.requestCode(medId, horaIndex) * 10 + accionOffset,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun iniciarVibracion() {
    vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
      vibratorManager.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    val patron = longArrayOf(0, 800, 400)
    vibrator?.vibrate(VibrationEffect.createWaveform(patron, 0))
  }

  private fun iniciarSonido() {
    try {
      val soundResId = resources.getIdentifier("alarma", "raw", packageName)
      if (soundResId == 0) return

      mediaPlayer = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        val uri = Uri.parse("android.resource://$packageName/$soundResId")
        setDataSource(this@AlarmRingService, uri)
        isLooping = true
        prepare()
        start()
      }
    } catch (e: Exception) {
      // Si el sonido falla por algún motivo, al menos sigue vibrando.
    }
  }

  private fun adquirirWakeLock() {
    val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = powerManager.newWakeLock(
      PowerManager.PARTIAL_WAKE_LOCK,
      "ExpoMedAlarm:RingWakeLock",
    ).apply {
      acquire(MAX_RING_MS + 5000)
    }
  }

  private fun programarAutoStop() {
    autoStopTimer?.cancel()
    autoStopTimer = object : CountDownTimer(MAX_RING_MS, MAX_RING_MS) {
      override fun onTick(millisUntilFinished: Long) {}
      override fun onFinish() {
        detenerTodo()
        stopSelf()
      }
    }.start()
  }

  private fun detenerTodo() {
    vibrator?.cancel()
    vibrator = null

    mediaPlayer?.let {
      try {
        it.stop()
      } catch (e: Exception) {
        // Puede que ya no estuviera reproduciendo.
      }
      it.release()
    }
    mediaPlayer = null

    autoStopTimer?.cancel()
    autoStopTimer = null

    if (wakeLock?.isHeld == true) {
      wakeLock?.release()
    }
    wakeLock = null
  }

  override fun onDestroy() {
    detenerTodo()
    super.onDestroy()
  }
}
