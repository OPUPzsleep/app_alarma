import AsyncStorage from "@react-native-async-storage/async-storage";
import { Medicina, normalizarMedicinas } from "./medicine-model";

const STORAGE_KEY = "med_reminder_data";

export const loadMedications = async (): Promise<{
  medicinas: Medicina[];
  recienCompletadas: Medicina[];
}> => {
  const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
  if (jsonValue == null) return { medicinas: [], recienCompletadas: [] };
  return normalizarMedicinas(JSON.parse(jsonValue) as Medicina[]);
};

export const saveMedications = async (
  lista: Medicina[],
): Promise<{ medicinas: Medicina[]; recienCompletadas: Medicina[] }> => {
  const resultado = normalizarMedicinas(lista);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(resultado.medicinas));
  return resultado;
};
