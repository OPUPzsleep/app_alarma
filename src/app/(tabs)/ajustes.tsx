import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { styles } from "@/app/estilos";
import { Icon } from "@/components/icon";
import { PermissionBanner } from "@/components/permission-banner";
import { COLORS } from "@/constants/design-tokens";
import { useMedicines } from "@/context/medicines-provider";
import { useAlarmPermissions } from "@/hooks/use-alarm-permissions";
import { seleccionarArchivoDeRespaldo } from "@/services/export-import";

export default function AjustesScreen() {
  const { exportar, agregarImportadas, reemplazarTodas } = useMedicines();
  const { alarmaExacta, bateria, notificaciones, solicitarAlarmaExacta, solicitarExencionBateria } =
    useAlarmPermissions();

  const exportarDatos = async () => {
    try {
      await exportar();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "No se pudo generar el respaldo.");
    }
  };

  const importarDatos = async () => {
    try {
      const resultado = await seleccionarArchivoDeRespaldo();
      if (resultado.cancelado) return;
      if (resultado.medicinas.length === 0) {
        return Alert.alert("Archivo vacío", "No se encontraron medicinas en ese archivo.");
      }

      Alert.alert(
        "Importar respaldo",
        `Se encontraron ${resultado.medicinas.length} medicina(s) en el archivo. ¿Qué querés hacer?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Agregar a las actuales",
            onPress: async () => {
              const { agregadas, alarmasOk } = await agregarImportadas(resultado.medicinas);
              Alert.alert(
                "Listo",
                `Se agregaron ${agregadas} medicina(s) nueva(s).${
                  alarmasOk ? "" : " Revisa el permiso de alarmas exactas en esta pantalla."
                }`,
              );
            },
          },
          {
            text: "Reemplazar todo",
            style: "destructive",
            onPress: async () => {
              const alarmasOk = await reemplazarTodas(resultado.medicinas);
              Alert.alert(
                "Listo",
                `Medicinas importadas.${
                  alarmasOk ? "" : " Revisa el permiso de alarmas exactas en esta pantalla."
                }`,
              );
            },
          },
        ],
      );
    } catch {
      Alert.alert(
        "Error",
        "No se pudo leer el archivo. Asegúrate de que sea un respaldo válido de Mis Medicinas.",
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Icon name="settings-outline" size={26} color="#fff" />
          <Text style={styles.headerTitle}>Ajustes y ayuda</Text>
        </View>
        <Text style={styles.headerSubtitle}>Cómo funciona la app y estado de los permisos.</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.view}>
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>¿Cómo funciona la app?</Text>
            <Text style={styles.paragraph}>
              1. En la pestaña Agregar escribes el nombre de tu medicina y a qué hora la tomas.
            </Text>
            <Text style={styles.paragraph}>
              2. Cuando llegue la hora, el celular sonará y vibrará fuerte, aunque la app esté cerrada.
            </Text>
            <Text style={styles.paragraph}>
              3. En la pantalla de la alarma tocas “Ya la tomé” si ya la tomaste, o “La voy a tomar” si
              necesitas un par de minutos más.
            </Text>
            <Text style={styles.paragraph}>
              4. “Permanente” quiere decir que suena todos los días para siempre. “Temporal” quiere decir
              que se detiene sola cuando terminan los días de tratamiento.
            </Text>
            <Text style={styles.paragraph}>
              5. En la pestaña Inicio puedes ver todas tus medicinas y marcar una toma sin esperar la
              alarma.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Estado de la app</Text>
            <PermissionBanner
              label="Permiso de alarmas exactas"
              ok={alarmaExacta}
              onActivar={solicitarAlarmaExacta}
            />
            <PermissionBanner
              label="Ahorro de batería sin restringir la app"
              ok={bateria}
              onActivar={solicitarExencionBateria}
            />
            <PermissionBanner
              label="Notificaciones activadas"
              ok={notificaciones}
              onActivar={() => Linking.openSettings()}
            />
            {(!alarmaExacta || !bateria || !notificaciones) && (
              <Text style={styles.helperText}>
                Si algo está en naranja, toca “Activar” y sigue las instrucciones en Ajustes del celular
                para que las alarmas nunca fallen.
              </Text>
            )}
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Historial</Text>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => router.push("/historial")}
              accessibilityRole="button"
              accessibilityLabel="Ver historial de tomas"
            >
              <Icon name="list-outline" size={20} color={COLORS.teal} />
              <Text style={styles.btnSecondaryText}>Ver historial de tomas</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Respaldo</Text>
            <Text style={styles.paragraph}>
              Guarda una copia de tus medicinas o restaura una copia guardada antes.
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.btnSecondary, styles.smallButton]}
                onPress={exportarDatos}
                accessibilityRole="button"
                accessibilityLabel="Exportar respaldo"
              >
                <Icon name="cloud-upload-outline" size={20} color={COLORS.teal} />
                <Text style={styles.btnSecondaryText}>Exportar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSecondary, styles.smallButton]}
                onPress={importarDatos}
                accessibilityRole="button"
                accessibilityLabel="Importar respaldo"
              >
                <Icon name="cloud-download-outline" size={20} color={COLORS.teal} />
                <Text style={styles.btnSecondaryText}>Importar</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.helperText, { textAlign: "center", marginTop: 8 }]}>
            Mis Medicinas · versión {Constants.expoConfig?.version ?? "1.0.0"}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
