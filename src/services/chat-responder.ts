import { diasRestantes, horasLegibles, Medicina, normalizarTexto, stockBajo } from "./medicine-model";

export const responderPregunta = (pregunta: string, meds: Medicina[]): string => {
  const texto = normalizarTexto(pregunta);
  const activas = meds.filter((med) => med.estado === "activa");

  if (activas.length === 0) {
    return "Todavía no hay medicinas registradas. Puedes agregar una desde la pestaña Agregar.";
  }

  if (
    texto.includes("que") &&
    (texto.includes("dando") ||
      texto.includes("estoy dando") ||
      texto.includes("estoy administrando") ||
      texto.includes("esta dando"))
  ) {
    const resumen = activas
      .map(
        (med) =>
          `• ${med.nombre} a las ${horasLegibles(med)}${med.descripcion ? ` — ${med.descripcion}` : ""}`,
      )
      .join("\n");
    return `Lo que se está dando ahora es:\n${resumen}`;
  }

  if (texto.includes("hora") || texto.includes("cuando")) {
    const resumen = activas.map((med) => `• ${med.nombre}: ${horasLegibles(med)}`).join("\n");
    return `Las horas registradas son:\n${resumen}`;
  }

  if (texto.includes("stock") || texto.includes("quedan") || texto.includes("pastillas")) {
    const conStock = activas.filter((med) => med.stockActual != null);
    if (conStock.length === 0) {
      return "No hay ningún medicamento con control de existencias cargado todavía.";
    }
    const resumen = conStock
      .map((med) => `• ${med.nombre}: quedan ${med.stockActual}${stockBajo(med) ? " (¡se está acabando!)" : ""}`)
      .join("\n");
    return `Existencias registradas:\n${resumen}`;
  }

  if (texto.includes("cuanto") && (texto.includes("falta") || texto.includes("queda") || texto.includes("dias"))) {
    const temporales = activas.filter((med) => med.tipoCiclo === "temporal");
    if (temporales.length === 0) {
      return "No tienes tratamientos temporales activos; las demás medicinas son permanentes.";
    }
    const resumen = temporales
      .map((med) => `• ${med.nombre}: quedan ${diasRestantes(med) ?? "?"} día(s) de tratamiento`)
      .join("\n");
    return `Tratamientos con fecha de fin:\n${resumen}`;
  }

  const coincidencia = activas.find((med) => normalizarTexto(med.nombre).includes(texto));

  if (coincidencia) {
    return `${coincidencia.nombre} se da a las ${horasLegibles(coincidencia)}${
      coincidencia.descripcion ? ` y ${coincidencia.descripcion.toLowerCase()}` : ""
    }.`;
  }

  return "Puedo ayudarte con preguntas como: ¿qué le estoy dando?, ¿a qué hora?, ¿cuántas pastillas quedan? o ¿cuánto falta de tratamiento?";
};
