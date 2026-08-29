import { Text, TouchableOpacity, View } from "react-native";
import { styles } from "@/app/estilos";
import { Icon } from "@/components/icon";
import { COLORS } from "@/constants/design-tokens";
import { formatearHoraVisual, Medicina, parsearHora, yaTomadaEnEsteTurno } from "@/services/medicine-model";

type DoseRowProps = {
  med: Medicina;
  horaIndex: number;
  onMarcarTomada: (horaIndex: number) => void;
};

export function DoseRow({ med, horaIndex, onMarcarTomada }: DoseRowProps) {
  const tomada = yaTomadaEnEsteTurno(med, horaIndex);
  const horaTexto = formatearHoraVisual(parsearHora(med.horas[horaIndex]));
  const etiquetaToma = med.horas.length > 1 ? `Toma ${horaIndex + 1} — ${horaTexto}` : horaTexto;

  return (
    <View style={styles.doseRow}>
      <View style={styles.doseRowTime}>
        <Icon name="time-outline" size={20} color={COLORS.inkSoft} />
        <Text style={styles.doseRowTimeText}>{etiquetaToma}</Text>
      </View>
      <TouchableOpacity
        style={[styles.doseRowButton, tomada && styles.doseRowButtonDone]}
        onPress={() => onMarcarTomada(horaIndex)}
        disabled={tomada}
        accessibilityRole="button"
        accessibilityLabel={
          tomada
            ? `${med.nombre}, toma de las ${horaTexto} ya registrada`
            : `Marcar como tomada la toma de ${med.nombre} de las ${horaTexto}`
        }
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon
          name={tomada ? "checkmark-circle" : "checkmark-circle-outline"}
          size={20}
          color={tomada ? COLORS.green : COLORS.teal}
        />
        <Text style={[styles.doseRowButtonText, tomada && styles.doseRowButtonTextDone]}>
          {tomada ? "Ya tomada" : "Tomada"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
