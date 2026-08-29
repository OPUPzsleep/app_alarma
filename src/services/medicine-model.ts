export type TipoCiclo = "permanente" | "temporal";
export type EstadoMedicina = "activa" | "completada";

export type Medicina = {
  id: number;
  nombre: string;
  descripcion: string;
  horas: string[];
  photo: string | null;
  vecesPorDia: number;
  tipoCiclo: TipoCiclo;
  diasDuracion: number | null;
  fechaInicio: string;
  fechaFin: string | null;
  tomasCompletadas: number;
  tomasTotales: number | null;
  // Reemplaza el antiguo `ultimaTomaEn` (timestamp único global): con varias
  // tomas al día, un solo timestamp no permitía saber cuál horario específico
  // ya se había confirmado y podía marcar como "tomado" un turno equivocado.
  ultimaTomaPorHorario: Record<number, string | null>;
  stockActual: number | null;
  stockUmbralAviso: number | null;
  estado: EstadoMedicina;
};

// Cuántas veces se vuelve a insistir tras aplazar antes de dejar de sonar.
export const MAX_APLAZOS = 3;
export const SEGUNDOS_APLAZO = 120;

// Máximo de tomas al día que permite el formulario, así que alcanza para
// cancelar cualquier horaIndex que haya existido.
export const MAX_HORAS_POR_DIA = 6;

// Formato interno sin ambigüedad (24h, ej. "21:17"). No usar formato de
// 12h aquí: mezclar "9:17 p. m." con split(":") rompía el parseo (Invalid Date).
export const formatearHora = (fecha: Date) => {
  const horas = String(fecha.getHours()).padStart(2, "0");
  const minutos = String(fecha.getMinutes()).padStart(2, "0");
  return `${horas}:${minutos}`;
};

// Formato solo para mostrar en pantalla (12h con a. m./p. m.)
export const formatearHoraVisual = (fecha: Date) =>
  fecha.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const parsearHora = (hora: string) => {
  const [horas, minutos] = hora.split(":").map(Number);
  const fecha = new Date();
  fecha.setHours(horas || 0, minutos || 0, 0, 0);
  return fecha;
};

export const horasLegibles = (med: Medicina) =>
  med.horas.map((h) => formatearHoraVisual(parsearHora(h))).join(", ");

export const normalizarTexto = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export const clamp = (valor: number, min: number, max: number) =>
  Math.min(max, Math.max(min, valor));

export const tituloYCuerpo = (med: Medicina) => ({
  title: "💊 ¡Es hora de tu medicina!",
  body: med.descripcion ? `${med.nombre} — ${med.descripcion}` : med.nombre,
});

// Migra registros guardados con versiones anteriores del modelo: el formato
// muy viejo (un solo campo "hora" en 12h) y el intermedio (un solo
// "ultimaTomaEn" global en vez de uno por horario).
export const migrarMedicina = (med: any): Medicina => {
  const base = med ?? {};

  let horas: string[] = Array.isArray(base.horas) && base.horas.length > 0 ? base.horas : [];
  if (horas.length === 0) {
    let horaMigrada = "08:00";
    const coincidencia = String(base.hora ?? "").match(/^(\d{1,2}):(\d{2})/);
    if (coincidencia) {
      horaMigrada = `${coincidencia[1].padStart(2, "0")}:${coincidencia[2]}`;
    }
    horas = [horaMigrada];
  }

  let ultimaTomaPorHorario: Record<number, string | null> = {};
  if (base.ultimaTomaPorHorario && typeof base.ultimaTomaPorHorario === "object") {
    ultimaTomaPorHorario = base.ultimaTomaPorHorario;
  } else if (base.ultimaTomaEn && horas.length === 1) {
    // Con un solo horario no hay ambigüedad posible; con varios, no se puede
    // saber a cuál correspondía el timestamp global, así que arranca vacío
    // en vez de adivinar y perpetuar el mismo bug camuflado.
    ultimaTomaPorHorario = { 0: base.ultimaTomaEn };
  }

  return {
    id: base.id ?? Date.now(),
    nombre: base.nombre ?? "",
    descripcion: base.descripcion ?? "",
    horas,
    photo: base.photo ?? null,
    vecesPorDia: base.vecesPorDia ?? horas.length,
    tipoCiclo: base.tipoCiclo === "temporal" ? "temporal" : "permanente",
    diasDuracion: base.diasDuracion ?? null,
    fechaInicio: base.fechaInicio ?? new Date().toISOString(),
    fechaFin: base.fechaFin ?? null,
    tomasCompletadas: base.tomasCompletadas ?? 0,
    tomasTotales: base.tomasTotales ?? null,
    ultimaTomaPorHorario,
    stockActual: base.stockActual ?? null,
    stockUmbralAviso: base.stockUmbralAviso ?? null,
    estado: base.estado === "completada" ? "completada" : "activa",
  };
};

export const tratamientoCompletado = (med: Medicina): boolean => {
  if (med.tipoCiclo !== "temporal") return false;
  if (med.fechaFin && new Date(med.fechaFin) < new Date()) return true;
  const total = med.tomasTotales ?? (med.diasDuracion ?? 1) * (med.vecesPorDia ?? 1);
  return med.tomasCompletadas >= total;
};

// Migra la lista completa y marca (sin borrar) las medicinas temporales que
// acaban de completarse, para que quien llame pueda avisar una sola vez con
// un criterio unificado (antes, completar por fecha y completar por conteo
// de tomas daban experiencias distintas al usuario).
export const normalizarMedicinas = (
  lista: Medicina[],
): { medicinas: Medicina[]; recienCompletadas: Medicina[] } => {
  const recienCompletadas: Medicina[] = [];
  const medicinas = lista.map(migrarMedicina).map((med) => {
    if (med.estado === "activa" && tratamientoCompletado(med)) {
      recienCompletadas.push(med);
      return { ...med, estado: "completada" as const };
    }
    return med;
  });
  return { medicinas, recienCompletadas };
};

// La hora programada más reciente que ya debió sonar para ese horario (hoy
// o, si aún no llega, la de ayer). Sirve para saber si ese turno específico
// ya fue confirmado.
export const obtenerUltimaHoraProgramada = (med: Medicina, horaIndex: number): Date => {
  const ahora = new Date();
  const horaTexto = med.horas[horaIndex];
  if (!horaTexto) return ahora;

  const candidata = parsearHora(horaTexto);
  if (candidata.getTime() > ahora.getTime()) {
    candidata.setDate(candidata.getDate() - 1);
  }
  return candidata;
};

export const yaTomadaEnEsteTurno = (med: Medicina, horaIndex: number): boolean => {
  const ultimaToma = med.ultimaTomaPorHorario?.[horaIndex];
  if (!ultimaToma) return false;
  return new Date(ultimaToma).getTime() >= obtenerUltimaHoraProgramada(med, horaIndex).getTime();
};

export const stockBajo = (med: Medicina): boolean =>
  med.stockActual != null && med.stockUmbralAviso != null && med.stockActual <= med.stockUmbralAviso;

export const diasRestantes = (med: Medicina): number | null => {
  if (med.tipoCiclo !== "temporal" || !med.fechaFin) return null;
  const ms = new Date(med.fechaFin).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
};
