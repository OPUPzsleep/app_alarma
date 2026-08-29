import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { styles } from "@/app/estilos";
import { Icon } from "@/components/icon";
import { COLORS } from "@/constants/design-tokens";
import { cargarHistorial, EntradaHistorial } from "@/services/history";
import { formatearHoraVisual, parsearHora } from "@/services/medicine-model";

const formatearFechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });

export default function HistorialScreen() {
  const [entradas, setEntradas] = useState<EntradaHistorial[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const lista = await cargarHistorial();
      setEntradas([...lista].reverse());
      setCargando(false);
    })();
  }, []);

  const grupos = entradas.reduce<Record<string, EntradaHistorial[]>>((acc, entrada) => {
    const clave = new Date(entrada.fechaHoraTomaISO).toDateString();
    acc[clave] = acc[clave] ?? [];
    acc[clave].push(entrada);
    return acc;
  }, {});

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.view}>
      {!cargando && entradas.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyBoxText}>
            Todavía no hay tomas registradas. Aquí van a aparecer a medida que confirmes tus medicinas.
          </Text>
        </View>
      )}

      {Object.entries(grupos).map(([clave, items]) => (
        <View key={clave}>
          <Text style={styles.historyDayTitle}>{formatearFechaLarga(items[0].fechaHoraTomaISO)}</Text>
          {items.map((entrada) => (
            <View key={entrada.id} style={styles.historyItem}>
              <Icon
                name={entrada.tipoEvento === "tomada" ? "checkmark-circle" : "walk-outline"}
                size={22}
                color={entrada.tipoEvento === "tomada" ? COLORS.green : COLORS.amberDark}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.historyItemTitle}>{entrada.medNombre}</Text>
                <Text style={styles.historyItemSubtitle}>
                  {entrada.tipoEvento === "tomada" ? "Tomada" : "Aplazada"} a las{" "}
                  {new Date(entrada.fechaHoraTomaISO).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · hora programada "}
                  {formatearHoraVisual(parsearHora(entrada.horaProgramada))}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
