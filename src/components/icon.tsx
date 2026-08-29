import { Ionicons } from "@react-native-vector-icons/ionicons";
import type { IoniconsIconName } from "@react-native-vector-icons/ionicons";

// Wrapper único sobre la librería de iconos: si algún día hay que cambiar de
// set de iconos, solo se toca este archivo.
type IconProps = {
  name: IoniconsIconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 24, color }: IconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}
