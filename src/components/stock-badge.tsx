import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { COLORS } from "@/constants/design-tokens";
import { styles } from "@/app/estilos";

export function StockBadge({ stockActual }: { stockActual: number }) {
  return (
    <View style={styles.stockBadge}>
      <Icon name="alert-circle-outline" size={18} color={COLORS.amberDark} />
      <Text style={styles.stockBadgeText}>Se está acabando: quedan {stockActual}</Text>
    </View>
  );
}
