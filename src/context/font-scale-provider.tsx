import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { crearEstilos } from "@/constants/estilos";

const STORAGE_KEY = "ajuste_escala_letra";

export const ESCALA_MIN = 0.9;
export const ESCALA_MAX = 1.5;
export const ESCALA_PASO = 0.1;

type FontScaleContextValue = {
  escala: number;
  cambiarEscala: (nueva: number) => void;
  styles: ReturnType<typeof crearEstilos>;
};

const FontScaleContext = createContext<FontScaleContextValue | null>(null);

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((guardada) => {
      const valor = Number(guardada);
      if (guardada != null && valor >= ESCALA_MIN && valor <= ESCALA_MAX) setEscala(valor);
    });
  }, []);

  const value = useMemo(
    () => ({
      escala,
      // Se redondea a un decimal para que sumar 0.1 varias veces no acumule
      // errores de coma flotante (1.2000000000000002).
      cambiarEscala: (nueva: number) => {
        const valor = Math.round(Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, nueva)) * 10) / 10;
        setEscala(valor);
        AsyncStorage.setItem(STORAGE_KEY, String(valor));
      },
      styles: crearEstilos(escala),
    }),
    [escala],
  );

  return <FontScaleContext.Provider value={value}>{children}</FontScaleContext.Provider>;
}

export function useFontScale() {
  const contexto = useContext(FontScaleContext);
  if (!contexto) throw new Error("useFontScale debe usarse dentro de FontScaleProvider");
  return contexto;
}

// Estilos de la app con el tamaño de letra elegido en Ajustes.
export const useStyles = () => useFontScale().styles;
