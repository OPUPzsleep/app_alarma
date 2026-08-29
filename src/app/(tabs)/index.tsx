import { router } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { styles } from "@/app/estilos";
import { Icon } from "@/components/icon";
import { MedicineCard } from "@/components/medicine-card";
import { COLORS } from "@/constants/design-tokens";
import { useMedicines } from "@/context/medicines-provider";

export default function InicioScreen() {
  const { medicinas, eliminarMedicina, marcarComoTomada } = useMedicines();
  const activas = medicinas.filter((med) => med.estado === "activa");

  const confirmarEliminar = (id: number, nombre: string) => {
    Alert.alert(
      "Eliminar medicina",
      `¿Seguro que quieres eliminar "${nombre}"? Se cancelarán sus recordatorios.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => eliminarMedicina(id) },
      ],
    );
  };

  const handleMarcarTomada = async (id: number, horaIndex: number) => {
    const resultado = await marcarComoTomada(id, horaIndex);
    Alert.alert(resultado.ok ? "Listo" : "Aviso", resultado.mensaje);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Icon name="medkit-outline" size={26} color="#fff" />
          <Text style={styles.headerTitle}>Mis Medicinas</Text>
        </View>
        <Text style={styles.headerSubtitle}>Tus medicinas y alarmas de hoy.</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.view}>
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => router.push("/historial")}
            accessibilityRole="button"
            accessibilityLabel="Ver historial de tomas"
          >
            <Icon name="list-outline" size={20} color={COLORS.teal} />
            <Text style={styles.btnSecondaryText}>Ver historial de tomas</Text>
          </TouchableOpacity>

          {activas.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyBoxText}>
                Aún no tienes medicinas registradas. Toca la pestaña Agregar para crear una.
              </Text>
            </View>
          )}

          {activas.map((item) => (
            <MedicineCard
              key={item.id}
              medicina={item}
              onEditar={() =>
                router.push({ pathname: "/agregar", params: { editingId: String(item.id) } })
              }
              onEliminar={() => confirmarEliminar(item.id, item.nombre)}
              onMarcarTomada={(horaIndex) => handleMarcarTomada(item.id, horaIndex)}
            />
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
