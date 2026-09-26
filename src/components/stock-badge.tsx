import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { COLORS } from "@/constants/design-tokens";
import { useStyles } from "@/context/font-scale-provider";

export function StockBadge({ stockActual }: { stockActual: number }) {
  const styles = useStyles();
  return (
    <View style={styles.stockBadge}>
      <Icon name="alert-circle-outline" size={18} color={COLORS.amberDark} />
      <Text style={styles.stockBadgeText}>Se está acabando: quedan {stockActual}</Text>
    </View>
  );
}
