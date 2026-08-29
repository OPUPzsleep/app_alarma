import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Medicina, normalizarTexto } from "./medicine-model";

// Exporta la lista completa (incluidas las fotos, convertidas a base64 para
// que el archivo sea autocontenido) a un JSON que se comparte por el menú
// nativo del celular, para poder restaurarlo en otro teléfono.
export const exportarDatos = async (medicinas: Medicina[]): Promise<void> => {
  const medicinasExportables = medicinas.map((med) => {
    if (!med.photo) return med;
    try {
      const fotoFile = new File(med.photo);
      if (!fotoFile.exists) return { ...med, photo: null };
      const base64 = fotoFile.base64Sync();
      return { ...med, photo: `data:image/jpeg;base64,${base64}` };
    } catch {
      return { ...med, photo: null };
    }
  });

  const contenido = JSON.stringify(
    { app: "mis-medicinas", version: 2, medicinas: medicinasExportables },
    null,
    2,
  );

  const archivo = new File(Paths.cache, "mis-medicinas-backup.json");
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(contenido);

  const disponible = await Sharing.isAvailableAsync();
  if (!disponible) {
    throw new Error("Este dispositivo no puede compartir archivos.");
  }
  await Sharing.shareAsync(archivo.uri, {
    mimeType: "application/json",
    dialogTitle: "Compartir respaldo de Mis Medicinas",
  });
};

export type ResultadoSeleccionArchivo =
  | { cancelado: true }
  | { cancelado: false; medicinas: Medicina[] };

export const seleccionarArchivoDeRespaldo = async (): Promise<ResultadoSeleccionArchivo> => {
  const resultado = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (resultado.canceled || !resultado.assets?.[0]) return { cancelado: true };

  const archivo = new File(resultado.assets[0].uri);
  const contenido = await archivo.text();
  const datos = JSON.parse(contenido);
  const listaImportada: Medicina[] = Array.isArray(datos) ? datos : (datos.medicinas ?? []);

  const conFotosLocales = listaImportada.map((med) => {
    if (!med.photo || !med.photo.startsWith("data:")) return med;
    try {
      const base64 = med.photo.split(",")[1];
      const nuevaFoto = new File(Paths.document, `medicina-${med.id}-${Date.now()}.jpg`);
      nuevaFoto.create();
      nuevaFoto.write(base64, { encoding: "base64" });
      return { ...med, photo: nuevaFoto.uri };
    } catch {
      return { ...med, photo: null };
    }
  });

  return { cancelado: false, medicinas: conFotosLocales };
};

// Al "agregar" un respaldo a las medicinas actuales: si una medicina
// importada tiene el mismo id que una ya existente, se le asigna un id
// nuevo (evita pisar el requestCode de la alarma nativa, derivado de
// medId+horaIndex). Si además nombre+horas coinciden exactamente con una ya
// existente, se descarta por ser casi seguro un duplicado del mismo respaldo.
export const combinarConDeduplicacion = (
  actuales: Medicina[],
  importadas: Medicina[],
): Medicina[] => {
  const idsExistentes = new Set(actuales.map((m) => m.id));
  const clavesExistentes = new Set(
    actuales.map((m) => `${normalizarTexto(m.nombre)}|${m.horas.join(",")}`),
  );

  const resultado: Medicina[] = [];
  for (const med of importadas) {
    const clave = `${normalizarTexto(med.nombre)}|${med.horas.join(",")}`;
    if (clavesExistentes.has(clave)) continue;

    let candidato = med;
    if (idsExistentes.has(candidato.id)) {
      candidato = { ...candidato, id: Date.now() + resultado.length };
    }
    idsExistentes.add(candidato.id);
    clavesExistentes.add(clave);
    resultado.push(candidato);
  }

  return [...actuales, ...resultado];
};
