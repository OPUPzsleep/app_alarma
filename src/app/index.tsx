import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import {
    Alert,
    Image,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { styles } from "./estilos";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type TipoCiclo = "permanente" | "temporal";

type Medicina = {
  id: number;
  nombre: string;
  descripcion: string;
  hora: string;
  photo: string | null;
  vecesPorDia: number;
  tipoCiclo: TipoCiclo;
  diasDuracion: number | null;
  fechaInicio: string;
  fechaFin: string | null;
  tomasCompletadas: number;
  tomasTotales: number | null;
};

type ChatMessage = {
  id: number;
  author: "user" | "bot";
  text: string;
};

const STORAGE_KEY = "med_reminder_data";

const formatearHora = (fecha: Date) =>
  fecha.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const parsearHora = (hora: string) => {
  const [horas, minutos] = hora.split(":").map(Number);
  const fecha = new Date();
  fecha.setHours(horas, minutos, 0, 0);
  return fecha;
};

const generarHorasDeToma = (horaBase: Date, vecesPorDia: number) => {
  if (vecesPorDia <= 1) return [horaBase];

  const intervaloHoras = 24 / vecesPorDia;
  const horas: Date[] = [];

  for (let indice = 0; indice < vecesPorDia; indice += 1) {
    const siguienteHora = new Date(
      horaBase.getTime() + indice * intervaloHoras * 60 * 60 * 1000,
    );
    horas.push(siguienteHora);
  }

  return horas;
};

const normalizarMedicinas = (lista: Medicina[]) => {
  const ahora = new Date();
  return lista.filter((med) => {
    if (med.tipoCiclo === "temporal" && med.fechaFin) {
      return new Date(med.fechaFin) >= ahora;
    }
    return true;
  });
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
  const [horaSeleccionada, setHoraSeleccionada] = useState(new Date());
  const [mostrarPicker, setMostrarPicker] = useState(false);
  const [tipoCiclo, setTipoCiclo] = useState<TipoCiclo>("permanente");
  const [duracionDias, setDuracionDias] = useState("7");
  const [vecesPorDia, setVecesPorDia] = useState("1");

  useEffect(() => {
    const init = async () => {
      const saved = await loadMedications();
      setMeds(saved);
      await Notifications.requestPermissionsAsync();
      await sincronizarAlarmas(saved);
    };
    init();
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

  const segundosHastaHora = (hora: Date) => {
    const ahora = new Date();
    const objetivo = new Date();
    objetivo.setHours(hora.getHours(), hora.getMinutes(), 0, 0);

    if (objetivo.getTime() <= ahora.getTime()) {
      objetivo.setDate(objetivo.getDate() + 1);
    }

    return Math.max(
      1,
      Math.round((objetivo.getTime() - ahora.getTime()) / 1000),
    );
  };

  const programarAlarma = async (
    nombreMedicina: string,
    descripcionMedicina: string,
    foto: string | null,
    hora: Date,
  ) => {
    const seconds = segundosHastaHora(hora);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "💊 ¡Es hora!",
        body: descripcionMedicina
          ? `${nombreMedicina} — ${descripcionMedicina}`
          : `Debes de tomar esta pastilla: ${nombreMedicina}`,
        sound: "default",
      },
      trigger: {
        seconds,
        repeats: false,
      } as any,
    });
  };

  const sincronizarAlarmas = async (lista: Medicina[]) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const med of lista) {
      if (med.tipoCiclo === "temporal" && med.fechaFin) {
        const fin = new Date(med.fechaFin);
        if (fin < new Date()) continue;
      }

      const horasDeToma = generarHorasDeToma(
        parsearHora(med.hora),
        med.vecesPorDia ?? 1,
      );

      for (const horaDeToma of horasDeToma) {
        await programarAlarma(
          med.nombre,
          med.descripcion,
          med.photo,
          horaDeToma,
        );
      }
    }
  };

  const marcarComoTomada = async (id: number) => {
    const med = meds.find((m) => m.id === id);
    if (!med) return;

    if (med.tipoCiclo === "temporal") {
      const totalTomas =
        med.tomasTotales ?? (med.diasDuracion ?? 1) * (med.vecesPorDia ?? 1);
      const tomasActuales = (med.tomasCompletadas ?? 0) + 1;
      const tratamientoCompleto = tomasActuales >= totalTomas;

      if (tratamientoCompleto) {
        const nuevasMeds = meds.filter((m) => m.id !== id);
        await saveMedications(nuevasMeds);
        await sincronizarAlarmas(nuevasMeds);
        Alert.alert(
          "¡Tratamiento completado!",
          `Ya completaste las ${totalTomas} tomas de ${med.nombre}. Se eliminó de la lista.`,
        );
        return;
      }

      const nuevasMeds = meds.map((m) =>
        m.id === id ? { ...m, tomasCompletadas: tomasActuales } : m,
      );
      await saveMedications(nuevasMeds);
      await sincronizarAlarmas(nuevasMeds);
      Alert.alert(
        "¡Bien hecho!",
        `Toma ${tomasActuales} de ${totalTomas} registrada.`,
      );
      return;
    }

    const nuevasMeds = meds.map((m) =>
      m.id === id ? { ...m, hora: m.hora } : m,
    );

    await saveMedications(nuevasMeds);
    await sincronizarAlarmas(nuevasMeds);
    Alert.alert(
      "¡Bien hecho!",
      "Se registró la toma y la medicina permanente sigue en la lista.",
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
    setHoraSeleccionada(new Date());
    setTipoCiclo("permanente");
    setDuracionDias("7");
    setVecesPorDia("1");
  };

  const prepararEdicion = (med: Medicina) => {
    setEditingId(med.id);
    setNombre(med.nombre);
    setDescripcion(med.descripcion);
    setPhotoUri(med.photo);
    setHoraSeleccionada(parsearHora(med.hora));
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
      hora: formatearHora(horaSeleccionada),
      photo: photoUri,
      vecesPorDia: frecuenciaPorDia,
      tipoCiclo,
      diasDuracion: dias,
      fechaInicio,
      fechaFin,
      tomasCompletadas: medicinaAnterior?.tomasCompletadas ?? 0,
      tomasTotales: dias != null ? dias * frecuenciaPorDia : null,
    };

    const listaActualizada = editingId
      ? meds.map((med) => (med.id === editingId ? medData : med))
      : [...meds, medData];

    await saveMedications(listaActualizada);
    await sincronizarAlarmas(listaActualizada);

    Alert.alert(
      "Éxito",
      editingId
        ? `Se actualizó la alarma para ${medData.nombre}.`
        : `La alarma sonará a las ${medData.hora}.`,
    );
    limpiarFormulario();
    setActiveTab("home");
  };

  const normalizarTexto = (texto: string) =>
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

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
            `• ${med.nombre} a las ${med.hora}${med.descripcion ? ` — ${med.descripcion}` : ""}`,
        )
        .join("\n");
      return `Lo que se está dando ahora es:\n${resumen}`;
    }

    if (texto.includes("hora") || texto.includes("cuando")) {
      const resumen = meds
        .map((med) => `• ${med.nombre}: ${med.hora}`)
        .join("\n");
      return `Las horas registradas son:\n${resumen}`;
    }

    const coincidencia = meds.find((med) =>
      normalizarTexto(med.nombre).includes(texto),
    );

    if (coincidencia) {
      return `${coincidencia.nombre} se da a las ${coincidencia.hora}${coincidencia.descripcion ? ` y ${coincidencia.descripcion.toLowerCase()}` : ""}.`;
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
    <View style={styles.container}>
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
                <Text style={styles.medDetail}>🕒 {item.hora}</Text>
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
                    style={[styles.btnSecondary, styles.smallButton]}
                    onPress={() => marcarComoTomada(item.id)}
                  >
                    <Text style={styles.btnSecondaryText}>✅ Tomada</Text>
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

              <Text style={styles.label}>Hora de la alarma</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setMostrarPicker(true)}
              >
                <Text>{formatearHora(horaSeleccionada)}</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Veces al día</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. 2"
                keyboardType="number-pad"
                value={vecesPorDia}
                onChangeText={setVecesPorDia}
              />

              {mostrarPicker && (
                <DateTimePicker
                  value={horaSeleccionada}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, selectedDate) => {
                    setMostrarPicker(Platform.OS === "ios");
                    if (selectedDate) setHoraSeleccionada(selectedDate);
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
    </View>
  );
}
