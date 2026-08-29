import { Image, Modal, Text, TouchableOpacity, View } from "react-native";
import { styles } from "@/app/estilos";
import { Icon } from "@/components/icon";
import { COLORS } from "@/constants/design-tokens";
import { Medicina } from "@/services/medicine-model";

export type Confirmacion = {
  med: Medicina;
  horaIndex: number;
  intentos: number;
  mensaje?: string;
};

type ConfirmDoseModalProps = {
  confirmacion: Confirmacion | null;
  onCerrar: () => void;
  onYaLaTome: () => void;
  onAplazar: () => void;
};

export function ConfirmDoseModal({
  confirmacion,
  onCerrar,
  onYaLaTome,
  onAplazar,
}: ConfirmDoseModalProps) {
  return (
    <Modal visible={!!confirmacion} transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={styles.confirmOverlay} accessibilityViewIsModal>
        <View style={styles.confirmCard}>
          {confirmacion?.med.photo && (
            <Image source={{ uri: confirmacion.med.photo }} style={styles.confirmPhoto} />
          )}
          <Text style={styles.confirmNombre}>{confirmacion?.med.nombre}</Text>
          {!!confirmacion?.med.descripcion && (
            <Text style={styles.medDetail}>{confirmacion.med.descripcion}</Text>
          )}

          {confirmacion?.mensaje ? (
            <>
              <Text style={styles.confirmMensaje} accessibilityLiveRegion="polite">
                {confirmacion.mensaje}
              </Text>
              <TouchableOpacity
                style={[styles.btnPrimary, { width: "100%" }]}
                onPress={onCerrar}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Text style={styles.btnPrimaryText}>Cerrar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.btnPrimary, { width: "100%", marginTop: 16 }]}
                onPress={onYaLaTome}
                accessibilityRole="button"
                accessibilityLabel="Ya la tomé"
              >
                <Icon name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.btnPrimaryText}>Ya la tomé</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSecondary, { marginTop: 10 }]}
                onPress={onAplazar}
                accessibilityRole="button"
                accessibilityLabel="La voy a tomar en un momento, recuérdamelo en 2 minutos"
              >
                <Icon name="walk-outline" size={22} color={COLORS.teal} />
                <Text style={styles.btnSecondaryText}>La voy a tomar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
