import { Text, TouchableOpacity, View } from "react-native";
import { styles } from "@/app/estilos";
import { Icon } from "@/components/icon";
import { COLORS } from "@/constants/design-tokens";

type PermissionBannerProps = {
  label: string;
  ok: boolean;
  onActivar: () => void;
};

export function PermissionBanner({ label, ok, onActivar }: PermissionBannerProps) {
  return (
    <View style={[styles.banner, ok && styles.bannerOk]}>
      <Icon
        name={ok ? "checkmark-circle" : "alert-circle-outline"}
        size={26}
        color={ok ? COLORS.green : COLORS.amberDark}
      />
      <Text style={[styles.bannerText, ok && styles.bannerTextOk]}>{label}</Text>
      {!ok && (
        <TouchableOpacity
          style={styles.bannerButton}
          onPress={onActivar}
          accessibilityRole="button"
          accessibilityLabel={`Activar: ${label}`}
        >
          <Text style={styles.bannerButtonText}>Activar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
