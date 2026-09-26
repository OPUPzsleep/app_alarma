import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "@/components/icon";
import { COLORS } from "@/constants/design-tokens";
import { useMedicines } from "@/context/medicines-provider";
import {
  calcularFechaFin,
  calcularHorasPorIntervalo,
  clamp,
  detectarIntervalo,
  formatearHora,
  formatearHoraVisual,
  INTERVALOS_HORAS,
  MAX_HORAS_POR_DIA,
  Medicina,
  parsearHora,
  textoFinTratamiento,
  TipoCiclo,
} from "@/services/medicine-model";
import { useStyles } from "@/context/font-scale-provider";

export default function AgregarScreen() {
  const { editingId } = useLocalSearchParams<{ editingId?: string }>();
  // La key fuerza un remount cada vez que cambia el objetivo de edición, así
  // el formulario calcula sus valores iniciales una sola vez a partir de la
  // medicina (sin useEffect ni setState reactivo a los parámetros de ruta).
  return <MedicineForm key={editingId ?? "new"} editingId={editingId} />;
}

function MedicineForm({ editingId }: { editingId?: string }) {
  const styles = useStyles();
  const { medicinas, guardarMedicina } = useMedicines();
  const medicinaAnterior = editingId
    ? medicinas.find((m) => m.id === Number(editingId))
    : undefined;

  const [photoUri, setPhotoUri] = useState<string | null>(medicinaAnterior?.photo ?? null);
  const [nombre, setNombre] = useState(medicinaAnterior?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(medicinaAnterior?.descripcion ?? "");
  const [horasSeleccionadas, setHorasSeleccionadas] = useState<Date[]>(() =>
    medicinaAnterior && medicinaAnterior.horas.length > 0
      ? medicinaAnterior.horas.map(parsearHora)
      : [new Date()],
  );
  // null = horario personalizado (cada hora se elige a mano).
  const [intervalo, setIntervalo] = useState<number | null>(() =>
    medicinaAnterior && medicinaAnterior.horas.length > 0
      ? detectarIntervalo(medicinaAnterior.horas)
      : 24,
  );
  const [verOtrasTomas, setVerOtrasTomas] = useState(false);
  const [pickerIndexActivo, setPickerIndexActivo] = useState<number | null>(null);
  const [tipoCiclo, setTipoCiclo] = useState<TipoCiclo>(
    medicinaAnterior?.tipoCiclo ?? "permanente",
  );
  const [duracionDias, setDuracionDias] = useState(
    medicinaAnterior?.diasDuracion ? String(medicinaAnterior.diasDuracion) : "7",
  );
  const [vecesPorDia, setVecesPorDia] = useState(String(medicinaAnterior?.vecesPorDia ?? 1));
  const [stockTexto, setStockTexto] = useState(
    medicinaAnterior?.stockActual != null ? String(medicinaAnterior.stockActual) : "",
  );
  const [umbralTexto, setUmbralTexto] = useState(
    medicinaAnterior?.stockUmbralAviso != null ? String(medicinaAnterior.stockUmbralAviso) : "",
  );

  // Al editar un tratamiento temporal, los días se siguen contando desde que
  // empezó (antes se contaban desde la edición y el tratamiento se alargaba).
  // Si recién pasa de permanente a temporal, empieza a contar desde ahora.
  const [inicioTratamiento] = useState(() =>
    medicinaAnterior?.tipoCiclo === "temporal"
      ? new Date(medicinaAnterior.fechaInicio)
      : new Date(),
  );
  const diasNumero = Number(duracionDias);
  const finPrevisto =
    Number.isInteger(diasNumero) && diasNumero >= 1
      ? calcularFechaFin(inicioTratamiento, diasNumero)
      : null;

  const limpiarFormulario = () => {
    setNombre("");
    setDescripcion("");
    setPhotoUri(null);
    setHorasSeleccionadas([new Date()]);
    setIntervalo(24);
    setTipoCiclo("permanente");
    setDuracionDias("7");
    setVecesPorDia("1");
    setStockTexto("");
    setUmbralTexto("");
  };

  const actualizarVecesPorDia = (valor: string) => {
    setVecesPorDia(valor);
    const cantidadSugerida = clamp(Math.round(Number(valor)) || 1, 1, MAX_HORAS_POR_DIA);
    setHorasSeleccionadas((prev) => {
      const nuevas = [...prev];
      while (nuevas.length < cantidadSugerida) nuevas.push(new Date());
      return nuevas.slice(0, cantidadSugerida);
    });
  };

  const elegirIntervalo = (nuevo: number | null) => {
    setIntervalo(nuevo);
    if (nuevo != null) {
      setVecesPorDia(String(24 / nuevo));
      setHorasSeleccionadas((prev) => calcularHorasPorIntervalo(prev[0], nuevo));
    }
  };

  const tomarFoto = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return Alert.alert("Error", "Permiso de cámara denegado");
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.5 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const seleccionarFotoDesdeGaleria = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return Alert.alert("Error", "Permiso de galería denegado");
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.5 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const guardarYProgramar = async () => {
    if (!nombre.trim()) {
      return Alert.alert("Falta el nombre", "Escribe el nombre de la medicina.");
    }

    const frecuenciaPorDia = Number(vecesPorDia);
    if (
      !Number.isInteger(frecuenciaPorDia) ||
      frecuenciaPorDia < 1 ||
      frecuenciaPorDia > MAX_HORAS_POR_DIA
    ) {
      return Alert.alert(
        "Revisa “Veces al día”",
        `Escribe un número entero entre 1 y ${MAX_HORAS_POR_DIA}.`,
      );
    }

    let dias: number | null = null;
    if (tipoCiclo === "temporal") {
      dias = Number(duracionDias);
      if (!Number.isInteger(dias) || dias < 1) {
        return Alert.alert("Revisa “Días de tratamiento”", "Escribe un número entero de 1 o más.");
      }
    }

    let stockActual: number | null = null;
    if (stockTexto.trim() !== "") {
      const valor = Number(stockTexto);
      if (!Number.isFinite(valor) || valor < 0) {
        return Alert.alert(
          "Revisa “Unidades disponibles”",
          "Escribe un número de 0 o más, o deja el campo vacío.",
        );
      }
      stockActual = Math.floor(valor);
    }

    let stockUmbralAviso: number | null = null;
    if (stockActual != null && umbralTexto.trim() !== "") {
      const valor = Number(umbralTexto);
      if (!Number.isFinite(valor) || valor < 0) {
        return Alert.alert(
          "Revisa “Avisar cuando queden”",
          "Escribe un número de 0 o más, o deja el campo vacío.",
        );
      }
      stockUmbralAviso = Math.floor(valor);
    }

    const fechaInicio = inicioTratamiento.toISOString();
    const fechaFin =
      tipoCiclo === "temporal" && dias != null
        ? calcularFechaFin(inicioTratamiento, dias).toISOString()
        : null;

    const medData: Medicina = {
      id: medicinaAnterior?.id ?? Date.now(),
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
      ultimaTomaPorHorario: medicinaAnterior?.ultimaTomaPorHorario ?? {},
      stockActual,
      stockUmbralAviso,
      estado: medicinaAnterior?.estado ?? "activa",
    };

    const alarmasOk = await guardarMedicina(medData);

    if (alarmasOk) {
      Alert.alert(
        "Éxito",
        `Vas a recibir una notificación a las ${medData.horas
          .map((h) => formatearHoraVisual(parsearHora(h)))
          .join(", ")}.`,
      );
    } else {
      Alert.alert(
        "Se guardó con un aviso",
        "Se guardó la medicina, pero hubo un problema al programar la alarma. Revisa el permiso de alarmas exactas en la pestaña Ajustes.",
      );
    }

    router.setParams({ editingId: undefined });
    router.push("/");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Icon name="add-circle" size={26} color="#fff" />
          <Text style={styles.headerTitle}>
            {editingId ? "Editar medicina" : "Agregar medicina"}
          </Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Completa los datos y guarda para programar la alarma.
        </Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.view}>
          <View style={styles.formCard}>
            <Text style={styles.label}>Nombre de la medicina</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Paracetamol"
              value={nombre}
              onChangeText={setNombre}
              accessibilityLabel="Nombre de la medicina"
            />

            <Text style={styles.label}>Descripción (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Tomar con alimentos"
              value={descripcion}
              onChangeText={setDescripcion}
              accessibilityLabel="Descripción"
            />

            <Text style={styles.label}>Ciclo de la alarma</Text>
            <View style={styles.optionRow}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  tipoCiclo === "permanente" && styles.optionButtonActive,
                ]}
                onPress={() => setTipoCiclo("permanente")}
                accessibilityRole="button"
                accessibilityLabel="Ciclo permanente"
              >
                <Icon
                  name="infinite-outline"
                  size={20}
                  color={tipoCiclo === "permanente" ? "#fff" : COLORS.inkSoft}
                />
                <Text
                  style={[
                    styles.optionButtonText,
                    tipoCiclo === "permanente" && styles.optionButtonTextActive,
                  ]}
                >
                  Permanente
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, tipoCiclo === "temporal" && styles.optionButtonActive]}
                onPress={() => setTipoCiclo("temporal")}
                accessibilityRole="button"
                accessibilityLabel="Ciclo temporal"
              >
                <Icon
                  name="hourglass-outline"
                  size={20}
                  color={tipoCiclo === "temporal" ? "#fff" : COLORS.inkSoft}
                />
                <Text
                  style={[
                    styles.optionButtonText,
                    tipoCiclo === "temporal" && styles.optionButtonTextActive,
                  ]}
                >
                  Temporal
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
                  accessibilityLabel="Días de tratamiento"
                />
                {finPrevisto && (
                  <Text style={styles.helperText}>{textoFinTratamiento(finPrevisto)}</Text>
                )}
              </View>
            )}

            <Text style={styles.label}>¿Cada cuántas horas?</Text>
            <View style={[styles.optionRow, styles.optionRowWrap]}>
              {INTERVALOS_HORAS.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.optionButton,
                    styles.optionButtonHalf,
                    intervalo === h && styles.optionButtonActive,
                  ]}
                  onPress={() => elegirIntervalo(h)}
                  accessibilityRole="button"
                  accessibilityLabel={`Cada ${h} horas, ${24 / h} ${h === 24 ? "vez" : "veces"} al día`}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      intervalo === h && styles.optionButtonTextActive,
                    ]}
                  >
                    Cada {h} h
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { flexBasis: "100%" },
                  intervalo === null && styles.optionButtonActive,
                ]}
                onPress={() => elegirIntervalo(null)}
                accessibilityRole="button"
                accessibilityLabel="Otro horario, elegir cada hora a mano"
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    intervalo === null && styles.optionButtonTextActive,
                  ]}
                >
                  Otro horario
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              {intervalo != null
                ? `${24 / intervalo} ${intervalo === 24 ? "vez" : "veces"} al día. Elige la hora de la primera toma y las demás se calculan solas.`
                : "Escribe cuántas veces al día se toma y elige la hora de cada toma."}
            </Text>

            {intervalo === null && (
              <>
                <Text style={styles.label}>Veces al día</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 2"
                  keyboardType="number-pad"
                  value={vecesPorDia}
                  onChangeText={actualizarVecesPorDia}
                  accessibilityLabel="Veces al día"
                />
                <Text style={styles.helperText}>De 1 a {MAX_HORAS_POR_DIA}.</Text>
              </>
            )}

            {intervalo != null ? (
              <>
                <Text style={styles.label}>
                  {horasSeleccionadas.length > 1 ? "Hora de la primera toma" : "Hora de la alarma"}
                </Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setPickerIndexActivo(0)}
                  accessibilityRole="button"
                  accessibilityLabel={`Elegir hora de la primera toma, actualmente ${formatearHoraVisual(horasSeleccionadas[0])}`}
                >
                  <Text style={styles.horaTexto}>{formatearHoraVisual(horasSeleccionadas[0])}</Text>
                </TouchableOpacity>

                {horasSeleccionadas.length > 1 && (
                  <>
                    <TouchableOpacity
                      style={styles.desplegableBoton}
                      onPress={() => setVerOtrasTomas((v) => !v)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: verOtrasTomas }}
                      accessibilityLabel={`${verOtrasTomas ? "Ocultar" : "Ver"} las otras ${horasSeleccionadas.length - 1} tomas`}
                    >
                      <Text style={styles.desplegableTexto}>
                        {verOtrasTomas ? "Ocultar" : "Ver"} las otras{" "}
                        {horasSeleccionadas.length - 1} tomas
                      </Text>
                      <Icon
                        name={verOtrasTomas ? "chevron-up-outline" : "chevron-down-outline"}
                        size={22}
                        color={COLORS.teal}
                      />
                    </TouchableOpacity>
                    {verOtrasTomas &&
                      horasSeleccionadas.slice(1).map((hora, i) => (
                        <View key={i} style={styles.medDetailRow}>
                          <Icon name="time-outline" size={18} color={COLORS.inkSoft} />
                          <Text style={styles.medDetail}>
                            Toma {i + 2}: {formatearHoraVisual(hora)}
                          </Text>
                        </View>
                      ))}
                  </>
                )}
              </>
            ) : (
              horasSeleccionadas.map((hora, index) => (
                <View key={index}>
                  <Text style={styles.label}>
                    {horasSeleccionadas.length > 1
                      ? `Hora — Toma ${index + 1}`
                      : "Hora de la alarma"}
                  </Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setPickerIndexActivo(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Elegir hora de la toma ${index + 1}, actualmente ${formatearHoraVisual(hora)}`}
                  >
                    <Text style={styles.horaTexto}>{formatearHoraVisual(hora)}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            {pickerIndexActivo !== null && (
              <DateTimePicker
                value={horasSeleccionadas[pickerIndexActivo]}
                mode="time"
                is24Hour={false}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_event, selectedDate) => {
                  const indice = pickerIndexActivo;
                  setPickerIndexActivo(Platform.OS === "ios" ? indice : null);
                  if (selectedDate && indice !== null) {
                    if (intervalo != null) {
                      setHorasSeleccionadas(calcularHorasPorIntervalo(selectedDate, intervalo));
                      return;
                    }
                    setHorasSeleccionadas((prev) => {
                      const nuevas = [...prev];
                      nuevas[indice] = selectedDate;
                      return nuevas;
                    });
                  }
                }}
              />
            )}

            <Text style={[styles.label, { marginTop: 20 }]}>Existencias (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. 30 pastillas disponibles"
              keyboardType="number-pad"
              value={stockTexto}
              onChangeText={setStockTexto}
              accessibilityLabel="Unidades disponibles"
            />
            <Text style={styles.helperText}>
              Si lo llenas, la app va restando una unidad cada vez que confirmes una toma.
            </Text>

            {stockTexto.trim() !== "" && (
              <>
                <Text style={styles.label}>Avisar cuando queden (opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 5"
                  keyboardType="number-pad"
                  value={umbralTexto}
                  onChangeText={setUmbralTexto}
                  accessibilityLabel="Avisar cuando queden"
                />
              </>
            )}

            <Text style={[styles.label, { marginTop: 20 }]}>Foto (opcional)</Text>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={tomarFoto}
              accessibilityRole="button"
              accessibilityLabel="Tomar foto"
            >
              <Icon name="camera-outline" size={20} color={COLORS.teal} />
              <Text style={styles.btnSecondaryText}>Tomar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnSecondary, { marginTop: 8 }]}
              onPress={seleccionarFotoDesdeGaleria}
              accessibilityRole="button"
              accessibilityLabel="Elegir foto de la galería"
            >
              <Icon name="images-outline" size={20} color={COLORS.teal} />
              <Text style={styles.btnSecondaryText}>Elegir de la galería</Text>
            </TouchableOpacity>

            {photoUri && (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.btnSecondary, styles.smallButton]}
                onPress={() => {
                  limpiarFormulario();
                  router.setParams({ editingId: undefined });
                }}
                accessibilityRole="button"
                accessibilityLabel="Limpiar formulario"
              >
                <Text style={styles.btnSecondaryText}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, styles.smallButton]}
                onPress={guardarYProgramar}
                accessibilityRole="button"
                accessibilityLabel={editingId ? "Guardar cambios" : "Guardar y programar"}
              >
                <Icon name="save-outline" size={20} color="#fff" />
                <Text style={styles.btnPrimaryText}>
                  {editingId ? "Guardar cambios" : "Guardar y programar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
