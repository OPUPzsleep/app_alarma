import AsyncStorage from "@react-native-async-storage/async-storage";

export type TipoEventoHistorial = "tomada" | "aplazada";

export type EntradaHistorial = {
  id: string;
  medId: number;
  medNombre: string;
  horaIndex: number;
  horaProgramada: string;
  fechaHoraTomaISO: string;
  tipoEvento: TipoEventoHistorial;
};

// Clave separada de la de medicinas: el historial debe sobrevivir a que se
// borre o complete una medicina, y no queremos inflar el blob que se
// parsea en cada guardado de la lista activa.
const HISTORIAL_KEY = "med_reminder_historial_v1";
const MAX_ENTRADAS = 500;
const MAX_DIAS = 180;

export const cargarHistorial = async (): Promise<EntradaHistorial[]> => {
  const json = await AsyncStorage.getItem(HISTORIAL_KEY);
  if (!json) return [];
  try {
    return JSON.parse(json) as EntradaHistorial[];
  } catch {
    return [];
  }
};

const podar = (lista: EntradaHistorial[]): EntradaHistorial[] => {
  const limiteFecha = Date.now() - MAX_DIAS * 24 * 60 * 60 * 1000;
  const vigentes = lista.filter(
    (entrada) => new Date(entrada.fechaHoraTomaISO).getTime() >= limiteFecha,
  );
  return vigentes.slice(-MAX_ENTRADAS);
};

export const registrarEvento = async (
  entrada: Omit<EntradaHistorial, "id">,
): Promise<void> => {
  const actual = await cargarHistorial();
  const nueva: EntradaHistorial = {
    ...entrada,
    id: `${entrada.medId}-${entrada.horaIndex}-${Date.now()}`,
  };
  await AsyncStorage.setItem(HISTORIAL_KEY, JSON.stringify(podar([...actual, nueva])));
};
