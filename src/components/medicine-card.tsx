import { useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { styles } from "@/app/estilos";
import { DoseRow } from "@/components/dose-row";
import { Icon } from "@/components/icon";
import { StockBadge } from "@/components/stock-badge";
import { COLORS } from "@/constants/design-tokens";
import { Medicina, stockBajo } from "@/services/medicine-model";

type MedicineCardProps = {
  medicina: Medicina;
  onEditar: () => void;
  onEliminar: () => void;
  onMarcarTomada: (horaIndex: number) => void;
};

export function MedicineCard({ medicina, onEditar, onEliminar, onMarcarTomada }: MedicineCardProps) {
  const [expandido, setExpandido] = useState(false);

  const resumenCiclo =
    medicina.tipoCiclo === "temporal"
      ? `Temporal · ${medicina.diasDuracion ?? 0} días`
      : "Permanente";
  const resumenFrecuencia = `${medicina.vecesPorDia ?? 1} vez${
    (medicina.vecesPorDia ?? 1) === 1 ? "" : "es"
  } al día`;

  return (
    <View style={styles.formCard}>
      <TouchableOpacity
        style={styles.cardHeaderRow}
        onPress={() => setExpandido((valor) => !valor)}
        accessibilityRole="button"
        accessibilityLabel={
          expandido ? `Ocultar detalles de ${medicina.nombre}` : `Ver más detalles de ${medicina.nombre}`
        }
        accessibilityState={{ expanded: expandido }}
      >
        <Text style={[styles.medName, { flexShrink: 1 }]}>{medicina.nombre}</Text>
        <Icon
          name={expandido ? "chevron-up-outline" : "chevron-down-outline"}
          size={26}
          color={COLORS.teal}
        />
      </TouchableOpacity>

      <View style={styles.medDetailRow}>
        <Icon
          name={medicina.tipoCiclo === "temporal" ? "hourglass-outline" : "infinite-outline"}
          size={18}
          color={COLORS.inkSoft}
        />
        <Text style={styles.medDetail}>
          {resumenCiclo} · {resumenFrecuencia}
        </Text>
      </View>

      {medicina.stockActual != null && stockBajo(medicina) && (
        <StockBadge stockActual={medicina.stockActual} />
      )}

      {medicina.horas.map((_, horaIndex) => (
        <DoseRow key={horaIndex} med={medicina} horaIndex={horaIndex} onMarcarTomada={onMarcarTomada} />
      ))}

      {expandido && (
        <View style={styles.cardExpandedSection}>
          {medicina.tipoCiclo === "temporal" && (
            <View style={styles.medDetailRow}>
              <Icon name="checkmark-circle-outline" size={18} color={COLORS.inkSoft} />
              <Text style={styles.medDetail}>
                {medicina.tomasCompletadas ?? 0} de{" "}
                {medicina.tomasTotales ?? (medicina.diasDuracion ?? 0) * (medicina.vecesPorDia ?? 1)}{" "}
                tomas
              </Text>
            </View>
          )}

          {!!medicina.descripcion && (
            <Text style={[styles.medDetail, { marginTop: 8 }]}>{medicina.descripcion}</Text>
          )}

          {medicina.photo && <Image source={{ uri: medicina.photo }} style={styles.medPhoto} />}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btnPrimary, styles.smallButton]}
              onPress={onEditar}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${medicina.nombre}`}
            >
              <Icon name="create-outline" size={20} color="#fff" />
              <Text style={styles.btnPrimaryText}>Editar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.btnDangerWrapper}>
            <TouchableOpacity
              style={styles.btnDanger}
              onPress={onEliminar}
              accessibilityRole="button"
              accessibilityLabel={`Eliminar ${medicina.nombre}`}
              accessibilityHint="Se cancelarán sus recordatorios"
            >
              <Icon name="trash-outline" size={20} color={COLORS.red} />
              <Text style={styles.btnDangerText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
