import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import ExpoMedAlarm from "../../modules/expo-med-alarm/src/ExpoMedAlarmModule";
import type { AlarmActionData } from "../../modules/expo-med-alarm/src/ExpoMedAlarm.types";
import { styles } from "./estilos";

type TipoCiclo = "permanente" | "temporal";

type Medicina = {
  id: number;
  nombre: string;
  descripcion: string;
  horas: string[];
  photo: string | null;
  vecesPorDia: number;
  tipoCiclo: TipoCiclo;
  diasDuracion: number | null;
  fechaInicio: string;
  fechaFin: string | null;
  tomasCompletadas: number;
  tomasTotales: number | null;
  ultimaTomaEn: string | null;
};

type ChatMessage = {
  id: number;
  author: "user" | "bot";
  text: string;
};

const STORAGE_KEY = "med_reminder_data";

// Formato interno sin ambigüedad (24h, ej. "21:17"). No usar formato de
// 12h aquí: mezclar "9:17 p. m." con split(":") rompía el parseo (Invalid Date).
const formatearHora = (fecha: Date) => {
  const horas = String(fecha.getHours()).padStart(2, "0");
  const minutos = String(fecha.getMinutes()).padStart(2, "0");
  return `${horas}:${minutos}`;
};

// Formato solo para mostrar en pantalla (12h con a. m./p. m.)
const formatearHoraVisual = (fecha: Date) =>
  fecha.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const parsearHora = (hora: string) => {
  const [horas, minutos] = hora.split(":").map(Number);
  const fecha = new Date();
  fecha.setHours(horas || 0, minutos || 0, 0, 0);
  return fecha;
};

// Convierte datos guardados con el formato viejo (un solo "hora" en 12h)
// al formato nuevo ("horas": string[] en 24h), para no romper medicinas
// creadas antes de esta actualización.
const migrarMedicina = (med: any): Medicina => {
  const base = { ultimaTomaEn: med.ultimaTomaEn ?? null, ...med };

  if (Array.isArray(base.horas) && base.horas.length > 0) {
    return base as Medicina;
  }

  let horaMigrada = "08:00";
  const coincidencia = String(base.hora ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (coincidencia) {
    horaMigrada = `${coincidencia[1].padStart(2, "0")}:${coincidencia[2]}`;
  }

  return {
    ...base,
    horas: [horaMigrada],
  };
};

const normalizarMedicinas = (lista: Medicina[]) => {
  const ahora = new Date();
  return lista.map(migrarMedicina).filter((med) => {
    if (med.tipoCiclo === "temporal" && med.fechaFin) {
      return new Date(med.fechaFin) >= ahora;
    }
    return true;
  });
};

// Cuántas veces se vuelve a insistir tras aplazar antes de dejar de sonar.
const MAX_APLAZOS = 3;
const SEGUNDOS_APLAZO = 120;

// Máximo de tomas al día que permite el formulario (ver actualizarVecesPorDia),
// así que alcanza para cancelar cualquier horaIndex que haya existido.
const MAX_HORAS_POR_DIA = 6;

const tituloYCuerpo = (med: Medicina) => ({
  title: "💊 ¡Es hora de tu medicina!",
  body: med.descripcion ? `${med.nombre} — ${med.descripcion}` : med.nombre,
});

const programarAlarma = (med: Medicina, horaIndex: number) => {
  const hora = parsearHora(med.horas[horaIndex]);
  const { title, body } = tituloYCuerpo(med);
  ExpoMedAlarm.scheduleAlarm(med.id, horaIndex, hora.getHours(), hora.getMinutes(), title, body);
};

const sincronizarAlarmas = (lista: Medicina[]) => {
  // Se cancelan todos los horarios posibles de cada medicina antes de
  // reprogramar, para no dejar alarmas viejas si se editaron o redujeron
  // las horas de toma.
  for (const med of lista) {
    for (let indice = 0; indice < MAX_HORAS_POR_DIA; indice += 1) {
      ExpoMedAlarm.cancelAlarm(med.id, indice);
    }
  }

  for (const med of lista) {
    if (med.tipoCiclo === "temporal" && med.fechaFin) {
      const fin = new Date(med.fechaFin);
      if (fin < new Date()) continue;
    }
    for (let indice = 0; indice < med.horas.length; indice += 1) {
      programarAlarma(med, indice);
    }
  }
};

// Reprograma un aviso único (no diario) para dentro de unos minutos cuando la
// persona pide más tiempo ("La voy a tomar"). Tras MAX_APLAZOS veces sin
// confirmar se deja de insistir para no generar una alarma infinita.
const aplazarToma = (med: Medicina, horaIndex: number, intentos: number) => {
  if (intentos > MAX_APLAZOS) return;
  const { title, body } = tituloYCuerpo(med);
  ExpoMedAlarm.scheduleAplazo(med.id, horaIndex, intentos, SEGUNDOS_APLAZO, title, body);
};

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<"home" | "add" | "chat">("home");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [meds, setMeds] = useState<Medicina[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      author: "bot",
      text: "Hola, soy tu asistente de medicinas. Puedes preguntarme: ¿qué le estoy dando? o ¿a qué hora?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [horasSeleccionadas, setHorasSeleccionadas] = useState<Date[]>([
    new Date(),
  ]);
  const [pickerIndexActivo, setPickerIndexActivo] = useState<number | null>(
    null,
  );
  const [tipoCiclo, setTipoCiclo] = useState<TipoCiclo>("permanente");
  const [duracionDias, setDuracionDias] = useState("7");
  const [vecesPorDia, setVecesPorDia] = useState("1");

  const [confirmacion, setConfirmacion] = useState<{
    med: Medicina;
    horaIndex: number;
    intentos: number;
    mensaje?: string;
  } | null>(null);

  const actualizarVecesPorDia = (valor: string) => {
    setVecesPorDia(valor);
    const cantidad = Math.min(6, Math.max(1, Number(valor) || 1));
    setHorasSeleccionadas((prev) => {
      const nuevas = [...prev];
      while (nuevas.length < cantidad) {
        nuevas.push(new Date());
      }
      return nuevas.slice(0, cantidad);
    });
  };

  useEffect(() => {
    const init = async () => {
      const saved = await loadMedications();
      setMeds(saved);
      // Necesario para que Android 13+ deje mostrar la notificación de la
      // alarma (incluida la del servicio en primer plano que la hace sonar).
      await Notifications.requestPermissionsAsync();
      sincronizarAlarmas(saved);
    };
    init();
  }, []);

  // Procesa tanto el toque en el cuerpo de la alarma como los botones
  // "La voy a tomar"/"Ya la tomé", sin importar si la app estaba abierta, en
  // segundo plano o recién se abrió por la alarma. Lo primero que hace es
  // apagar la vibración/sonido en curso.
  const procesarAccionAlarma = async (datos: AlarmActionData) => {
    ExpoMedAlarm.stopRinging();

    const { medId, horaIndex, intentos, accion } = datos;
    if (!medId) return;

    const listaActual = await loadMedications();
    const med = listaActual.find((m) => m.id === medId);
    if (!med) return;

    if (accion === "tomada") {
      await marcarComoTomada(med.id);
      setConfirmacion({
        med,
        horaIndex,
        intentos,
        mensaje: "✅ ¡Registrado! Bien hecho.",
      });
    } else if (accion === "aplazar") {
      aplazarToma(med, horaIndex, intentos + 1);
      setConfirmacion({
        med,
        horaIndex,
        intentos: intentos + 1,
        mensaje: "🚶 Perfecto, ve por tu pastilla. Te recordamos en 2 minutos.",
      });
    } else {
      setConfirmacion({ med, horaIndex, intentos });
    }
  };

  useEffect(() => {
    const datosDeInicio = ExpoMedAlarm.getLaunchAlarmData();
    if (datosDeInicio) {
      procesarAccionAlarma(datosDeInicio);
    }

    const suscripcion = ExpoMedAlarm.addListener("onAlarmAction", (datos) => {
      procesarAccionAlarma(datos);
    });

    return () => suscripcion.remove();
  }, []);

  const saveMedications = async (nuevaLista: Medicina[]) => {
    const listaActiva = normalizarMedicinas(nuevaLista);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(listaActiva));
    setMeds(listaActiva);
  };

  const loadMedications = async (): Promise<Medicina[]> => {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    if (jsonValue == null) return [];
    return normalizarMedicinas(JSON.parse(jsonValue) as Medicina[]);
  };

  // La hora programada más reciente que ya debió sonar (hoy o, si aún no
  // llega ninguna hora de hoy, la de ayer). Sirve para saber si el turno
  // actual ya fue confirmado.
  const obtenerUltimaHoraProgramada = (med: Medicina): Date => {
    const ahora = new Date();
    let masReciente: Date | null = null;

    for (const horaTexto of med.horas) {
      const candidata = parsearHora(horaTexto);
      if (candidata.getTime() > ahora.getTime()) {
        candidata.setDate(candidata.getDate() - 1);
      }
      if (!masReciente || candidata.getTime() > masReciente.getTime()) {
        masReciente = candidata;
      }
    }

    return masReciente ?? ahora;
  };

  const yaTomadaEnEsteTurno = (med: Medicina): boolean => {
    if (!med.ultimaTomaEn) return false;
    return (
      new Date(med.ultimaTomaEn).getTime() >=
      obtenerUltimaHoraProgramada(med).getTime()
    );
  };

  // Si había avisos de "¿ya la tomaste?" programados por un aplazo, se
  // cancelan al confirmar para que no vuelvan a sonar preguntando algo que
  // ya se contestó.
  const cancelarAplazosPendientes = (med: Medicina) => {
    for (let indice = 0; indice < med.horas.length; indice += 1) {
      for (let intentos = 1; intentos <= MAX_APLAZOS; intentos += 1) {
        ExpoMedAlarm.cancelAplazo(med.id, indice, intentos);
      }
    }
  };

  const marcarComoTomada = async (id: number) => {
    const listaActual = await loadMedications();
    const med = listaActual.find((m) => m.id === id);
    if (!med) return;

    cancelarAplazosPendientes(med);

    if (yaTomadaEnEsteTurno(med)) {
      Alert.alert(
        "Ya registrada",
        "Ya marcaste esta toma. Se vuelve a habilitar cuando llegue la siguiente hora programada.",
      );
      return;
    }

    const ahoraISO = new Date().toISOString();

    if (med.tipoCiclo === "temporal") {
      const totalTomas =
        med.tomasTotales ?? (med.diasDuracion ?? 1) * (med.vecesPorDia ?? 1);
      const tomasActuales = (med.tomasCompletadas ?? 0) + 1;
      const tratamientoCompleto = tomasActuales >= totalTomas;

      if (tratamientoCompleto) {
        const nuevasMeds = listaActual.filter((m) => m.id !== id);
        await saveMedications(nuevasMeds);
        Alert.alert(
          "¡Tratamiento completado!",
          `Ya completaste las ${totalTomas} tomas de ${med.nombre}. Se eliminó de la lista.`,
        );
        return;
      }

      const nuevasMeds = listaActual.map((m) =>
        m.id === id
          ? { ...m, tomasCompletadas: tomasActuales, ultimaTomaEn: ahoraISO }
          : m,
      );
      await saveMedications(nuevasMeds);
      Alert.alert(
        "¡Bien hecho!",
        `Toma ${tomasActuales} de ${totalTomas} registrada.`,
      );
      return;
    }

    const nuevasMeds = listaActual.map((m) =>
      m.id === id ? { ...m, ultimaTomaEn: ahoraISO } : m,
    );
    await saveMedications(nuevasMeds);
    Alert.alert(
      "¡Bien hecho!",
      "Se registró la toma y la medicina permanente sigue en la lista.",
    );
  };

  const borrarMedicina = (id: number) => {
    const med = meds.find((m) => m.id === id);
    if (!med) return;

    Alert.alert(
      "Eliminar medicina",
      `¿Seguro que quieres eliminar "${med.nombre}"? Se cancelarán sus recordatorios.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            for (let indice = 0; indice < med.horas.length; indice += 1) {
              ExpoMedAlarm.cancelAlarm(id, indice);
              for (let intentos = 1; intentos <= MAX_APLAZOS; intentos += 1) {
                ExpoMedAlarm.cancelAplazo(id, indice, intentos);
              }
            }
            const nuevasMeds = meds.filter((m) => m.id !== id);
            await saveMedications(nuevasMeds);
          },
        },
      ],
    );
  };

  const tomarFoto = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return Alert.alert("Error", "Permiso de cámara denegado");
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const seleccionarFotoDesdeGaleria = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return Alert.alert("Error", "Permiso de galería denegado");

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const limpiarFormulario = () => {
    setEditingId(null);
    setNombre("");
    setDescripcion("");
    setPhotoUri(null);
    setHorasSeleccionadas([new Date()]);
    setTipoCiclo("permanente");
    setDuracionDias("7");
    setVecesPorDia("1");
  };

  const prepararEdicion = (med: Medicina) => {
    setEditingId(med.id);
    setNombre(med.nombre);
    setDescripcion(med.descripcion);
    setPhotoUri(med.photo);
    setHorasSeleccionadas(
      med.horas.length > 0 ? med.horas.map(parsearHora) : [new Date()],
    );
    setTipoCiclo(med.tipoCiclo);
    setDuracionDias(med.diasDuracion ? String(med.diasDuracion) : "7");
    setVecesPorDia(String(med.vecesPorDia ?? 1));
    setActiveTab("add");
  };

  const guardarYProgramar = async () => {
    if (!nombre.trim()) {
      return Alert.alert(
        "Falta el nombre",
        "Escribe el nombre de la medicina.",
      );
    }

    const dias =
      tipoCiclo === "temporal" ? Math.max(1, Number(duracionDias) || 1) : null;
    const frecuenciaPorDia = Math.min(6, Math.max(1, Number(vecesPorDia) || 1));
    const fechaInicio = new Date().toISOString();
    const fechaFin =
      tipoCiclo === "temporal" && dias != null
        ? new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const medicinaAnterior = editingId
      ? meds.find((med) => med.id === editingId)
      : undefined;

    const medData: Medicina = {
      id: editingId ?? Date.now(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      horas: horasSeleccionadas.slice(0, frecuenciaPorDia).map(formatearHora),
      photo: photoUri,
      vecesPorDia: frecuenciaPorDia,
      tipoCiclo,
      diasDuracion: dias,
      fechaInicio,
      fechaFin,
      tomasCompletadas: medicinaAnterior?.tomasCompletadas ?? 0,
      tomasTotales: dias != null ? dias * frecuenciaPorDia : null,
      ultimaTomaEn: medicinaAnterior?.ultimaTomaEn ?? null,
    };

    const listaActualizada = editingId
      ? meds.map((med) => (med.id === editingId ? medData : med))
      : [...meds, medData];

    await saveMedications(listaActualizada);

    try {
      await sincronizarAlarmas(listaActualizada);
      Alert.alert(
        "Éxito",
        `Vas a recibir una notificación a las ${medData.horas
          .map((h) => formatearHoraVisual(parsearHora(h)))
          .join(", ")}.`,
      );
    } catch (error) {
      Alert.alert(
        "Se guardó con un aviso",
        "Se guardó la medicina, pero hubo un problema al programar la notificación. Revisa que la app tenga permiso de notificaciones.",
      );
    }

    limpiarFormulario();
    setActiveTab("home");
  };

  const normalizarTexto = (texto: string) =>
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const horasLegibles = (med: Medicina) =>
    med.horas.map((h) => formatearHoraVisual(parsearHora(h))).join(", ");

  const responderPregunta = (pregunta: string) => {
    const texto = normalizarTexto(pregunta);

    if (meds.length === 0) {
      return "Todavía no hay medicinas registradas. Puedes agregar una desde la pestaña ➕.";
    }

    if (
      texto.includes("que") &&
      (texto.includes("dando") ||
        texto.includes("estoy dando") ||
        texto.includes("estoy administrando") ||
        texto.includes("esta dando"))
    ) {
      const resumen = meds
        .map(
          (med) =>
            `• ${med.nombre} a las ${horasLegibles(med)}${med.descripcion ? ` — ${med.descripcion}` : ""}`,
        )
        .join("\n");
      return `Lo que se está dando ahora es:\n${resumen}`;
    }

    if (texto.includes("hora") || texto.includes("cuando")) {
      const resumen = meds
        .map((med) => `• ${med.nombre}: ${horasLegibles(med)}`)
        .join("\n");
      return `Las horas registradas son:\n${resumen}`;
    }

    const coincidencia = meds.find((med) =>
      normalizarTexto(med.nombre).includes(texto),
    );

    if (coincidencia) {
      return `${coincidencia.nombre} se da a las ${horasLegibles(coincidencia)}${coincidencia.descripcion ? ` y ${coincidencia.descripcion.toLowerCase()}` : ""}.`;
    }

    return "Puedo ayudarte con preguntas como: ¿qué le estoy dando? o ¿a qué hora?";
  };

  const enviarMensaje = async () => {
    const texto = chatInput.trim();
    if (!texto) return;

    setChatMessages((prev) => [
      ...prev,
      { id: Date.now(), author: "user", text: texto },
    ]);
    setChatInput("");
    setIsChatLoading(true);

    const respuesta = responderPregunta(texto);

    setChatMessages((prev) => [
      ...prev,
      { id: Date.now() + 1, author: "bot", text: respuesta },
    ]);
    setIsChatLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💊 Mis Medicinas</Text>
        <Text style={styles.headerSubtitle}>
          Gestiona alarmas permanentes o por unos días.
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === "home" && (
          <View style={styles.view}>
            {meds.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyBoxText}>
                  Aún no tienes medicinas registradas. Toca ➕ para agregar una.
                </Text>
              </View>
            )}
            {meds.map((item) => (
              <View key={item.id} style={styles.formCard}>
                <Text style={styles.medName}>{item.nombre}</Text>
                <Text style={styles.medDetail}>
                  🕒 {item.horas.map((h) => formatearHoraVisual(parsearHora(h))).join(", ")}
                </Text>
                <Text style={styles.medDetail}>
                  🔁 {item.vecesPorDia ?? 1} vez
                  {(item.vecesPorDia ?? 1) === 1 ? "" : "es"} al día
                </Text>
                <Text style={styles.medDetail}>
                  {item.tipoCiclo === "temporal"
                    ? `⏳ Temporal · ${item.diasDuracion ?? 0} días`
                    : "♾️ Permanente"}
                </Text>
                {item.tipoCiclo === "temporal" && (
                  <Text style={styles.medDetail}>
                    ✅ {item.tomasCompletadas ?? 0} de{" "}
                    {item.tomasTotales ??
                      (item.diasDuracion ?? 0) * (item.vecesPorDia ?? 1)}{" "}
                    tomas
                  </Text>
                )}
                {!!item.descripcion && (
                  <Text style={styles.medDetail}>{item.descripcion}</Text>
                )}
                {item.photo && (
                  <Image
                    source={{ uri: item.photo }}
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 10,
                      marginVertical: 10,
                    }}
                  />
                )}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.btnPrimary, styles.smallButton]}
                    onPress={() => prepararEdicion(item)}
                  >
                    <Text style={styles.btnPrimaryText}>✏️ Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.btnSecondary,
                      styles.smallButton,
                      yaTomadaEnEsteTurno(item) && styles.btnDisabled,
                    ]}
                    onPress={() => marcarComoTomada(item.id)}
                    disabled={yaTomadaEnEsteTurno(item)}
                  >
                    <Text
                      style={[
                        styles.btnSecondaryText,
                        yaTomadaEnEsteTurno(item) && styles.btnDisabledText,
                      ]}
                    >
                      {yaTomadaEnEsteTurno(item)
                        ? "✅ Ya tomada"
                        : "✅ Tomada"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.btnDangerWrapper}>
                  <TouchableOpacity
                    style={styles.btnDanger}
                    onPress={() => borrarMedicina(item.id)}
                  >
                    <Text style={styles.btnDangerText}>🗑️ Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === "add" && (
          <View style={styles.view}>
            <View style={styles.formCard}>
              <Text style={styles.label}>Nombre de la medicina</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Paracetamol"
                value={nombre}
                onChangeText={setNombre}
              />

              <Text style={styles.label}>Descripción (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Tomar con alimentos"
                value={descripcion}
                onChangeText={setDescripcion}
              />

              <Text style={styles.label}>Ciclo de la alarma</Text>
              <View style={styles.optionRow}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    tipoCiclo === "permanente" && styles.optionButtonActive,
                  ]}
                  onPress={() => setTipoCiclo("permanente")}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      tipoCiclo === "permanente" &&
                        styles.optionButtonTextActive,
                    ]}
                  >
                    ♾️ Permanente
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    tipoCiclo === "temporal" && styles.optionButtonActive,
                  ]}
                  onPress={() => setTipoCiclo("temporal")}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      tipoCiclo === "temporal" && styles.optionButtonTextActive,
                    ]}
                  >
                    ⏳ Temporal
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>
                {tipoCiclo === "permanente"
                  ? "Permanente: la alarma sigue sonando todos los días sin fecha de fin, hasta que tú la elimines."
                  : "Temporal: la alarma se detiene sola cuando terminan los días de tratamiento que pongas abajo."}
              </Text>

              {tipoCiclo === "temporal" && (
                <View>
                  <Text style={styles.label}>Días de tratamiento</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. 5"
                    keyboardType="number-pad"
                    value={duracionDias}
                    onChangeText={setDuracionDias}
                  />
                </View>
              )}

              <Text style={styles.label}>Veces al día</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. 2"
                keyboardType="number-pad"
                value={vecesPorDia}
                onChangeText={actualizarVecesPorDia}
              />
              <Text style={styles.helperText}>
                Escribe cuántas veces al día se toma. Abajo va a aparecer un
                reloj para poner la hora exacta de cada toma.
              </Text>

              {horasSeleccionadas.map((hora, index) => (
                <View key={index}>
                  <Text style={styles.label}>
                    {horasSeleccionadas.length > 1
                      ? `Hora — Toma ${index + 1}`
                      : "Hora de la alarma"}
                  </Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setPickerIndexActivo(index)}
                  >
                    <Text>{formatearHoraVisual(hora)}</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {pickerIndexActivo !== null && (
                <DateTimePicker
                  value={horasSeleccionadas[pickerIndexActivo]}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, selectedDate) => {
                    const indice = pickerIndexActivo;
                    setPickerIndexActivo(Platform.OS === "ios" ? indice : null);
                    if (selectedDate && indice !== null) {
                      setHorasSeleccionadas((prev) => {
                        const nuevas = [...prev];
                        nuevas[indice] = selectedDate;
                        return nuevas;
                      });
                    }
                  }}
                />
              )}


              <Text style={[styles.label, { marginTop: 20 }]}>
                Foto (opcional)
              </Text>
              <TouchableOpacity style={styles.btnSecondary} onPress={tomarFoto}>
                <Text style={styles.btnSecondaryText}>📷 Tomar foto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSecondary, { marginTop: 8 }]}
                onPress={seleccionarFotoDesdeGaleria}
              >
                <Text style={styles.btnSecondaryText}>
                  🖼️ Elegir de la galería
                </Text>
              </TouchableOpacity>

              {photoUri && (
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photoPreview}
                  resizeMode="cover"
                />
              )}

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.btnSecondary, styles.smallButton]}
                  onPress={limpiarFormulario}
                >
                  <Text style={styles.btnSecondaryText}>Limpiar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimary, styles.smallButton]}
                  onPress={guardarYProgramar}
                >
                  <Text style={styles.btnPrimaryText}>
                    {editingId ? "Guardar cambios" : "Guardar y programar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {activeTab === "chat" && (
          <View style={styles.view}>
            <View style={styles.chatCard}>
              <Text style={styles.chatTitle}>💬 Asistente de medicinas</Text>
              <Text style={styles.chatSubtitle}>
                Pregunta qué se está dando o a qué hora.
              </Text>

              <ScrollView style={styles.chatMessages}>
                {chatMessages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.chatBubble,
                      message.author === "user"
                        ? styles.chatBubbleUser
                        : styles.chatBubbleBot,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chatBubbleText,
                        message.author === "user" && styles.chatBubbleTextUser,
                      ]}
                    >
                      {message.text}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.chatInputRow}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Ej. ¿Qué le estoy dando?"
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                />
                <TouchableOpacity
                  style={styles.chatSendButton}
                  onPress={enviarMensaje}
                >
                  <Text style={styles.chatSendButtonText}>Enviar</Text>
                </TouchableOpacity>
              </View>

              {isChatLoading && (
                <Text style={styles.chatStatus}>Pensando...</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setActiveTab("home")}
        >
          <Text style={styles.navIcon}>🏠</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setActiveTab("add")}
        >
          <Text style={styles.navIcon}>➕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setActiveTab("chat")}
        >
          <Text style={styles.navIcon}>💬</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={!!confirmacion}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmacion(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            {confirmacion?.med.photo && (
              <Image
                source={{ uri: confirmacion.med.photo }}
                style={styles.confirmPhoto}
              />
            )}
            <Text style={styles.confirmNombre}>{confirmacion?.med.nombre}</Text>
            {!!confirmacion?.med.descripcion && (
              <Text style={styles.medDetail}>{confirmacion.med.descripcion}</Text>
            )}

            {confirmacion?.mensaje ? (
              <>
                <Text style={styles.confirmMensaje}>{confirmacion.mensaje}</Text>
                <TouchableOpacity
                  style={[styles.btnPrimary, { width: "100%" }]}
                  onPress={() => setConfirmacion(null)}
                >
                  <Text style={styles.btnPrimaryText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.btnPrimary, { width: "100%", marginTop: 16 }]}
                  onPress={async () => {
                    if (!confirmacion) return;
                    await marcarComoTomada(confirmacion.med.id);
                    setConfirmacion(null);
                  }}
                >
                  <Text style={styles.btnPrimaryText}>✅ Ya la tomé</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnSecondary, { marginTop: 10 }]}
                  onPress={() => {
                    if (!confirmacion) return;
                    aplazarToma(
                      confirmacion.med,
                      confirmacion.horaIndex,
                      confirmacion.intentos + 1,
                    );
                    setConfirmacion(null);
                  }}
                >
                  <Text style={styles.btnSecondaryText}>🚶 La voy a tomar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
