import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppState } from "react-native";
import ExpoMedAlarm from "../../modules/expo-med-alarm/src/ExpoMedAlarmModule";
import {
  aplazarToma,
  cancelarAlarmasDeMedicina,
  cancelarAplazosPendientes,
  sincronizarAlarmas,
} from "@/services/alarms";
import { combinarConDeduplicacion, exportarDatos } from "@/services/export-import";
import { registrarEvento } from "@/services/history";
import { Medicina, yaTomadaEnEsteTurno } from "@/services/medicine-model";
import { prepararNotificaciones } from "@/services/notifications";
import { loadMedications, saveMedications } from "@/services/storage";

type ResultadoAccion = { ok: boolean; mensaje: string };

type MedicinesContextValue = {
  medicinas: Medicina[];
  cargando: boolean;
  // El booleano indica si las alarmas se pudieron (re)programar sin errores
  // (por ejemplo, false si falta el permiso de alarma exacta): los datos
  // siempre quedan guardados de todas formas, esto es solo para avisar.
  guardarMedicina: (medData: Medicina) => Promise<boolean>;
  eliminarMedicina: (id: number) => Promise<void>;
  marcarComoTomada: (id: number, horaIndex: number, fechaISO?: string) => Promise<ResultadoAccion>;
  registrarAplazo: (med: Medicina, horaIndex: number, intentos: number) => Promise<void>;
  agregarImportadas: (importadas: Medicina[]) => Promise<{ agregadas: number; alarmasOk: boolean }>;
  reemplazarTodas: (importadas: Medicina[]) => Promise<boolean>;
  exportar: () => Promise<void>;
  obtenerMedicinaFresca: (id: number) => Promise<Medicina | null>;
};

const MedicinesContext = createContext<MedicinesContextValue | null>(null);

// AlarmScheduler.arm() (en Kotlin) puede lanzar una excepción si al sistema
// le falta el permiso de alarma exacta (Android 12+). Nunca debe dejarse
// escapar sin capturar: en el arranque de la app tumbaría toda la pantalla,
// y en un guardado dejaría el flujo colgado sin avisar nada al usuario.
const sincronizarAlarmasSeguro = (lista: Medicina[]): boolean => {
  try {
    sincronizarAlarmas(lista);
    return true;
  } catch {
    return false;
  }
};

export function MedicinesProvider({ children }: { children: ReactNode }) {
  const [medicinas, setMedicinas] = useState<Medicina[]>([]);
  const [cargando, setCargando] = useState(true);

  const aplicarLista = useCallback(async (lista: Medicina[]) => {
    const resultado = await saveMedications(lista);
    setMedicinas(resultado.medicinas);
    const alarmasOk = sincronizarAlarmasSeguro(resultado.medicinas);
    return { ...resultado, alarmasOk };
  }, []);

  const guardarMedicina = useCallback(
    async (medData: Medicina) => {
      const existe = medicinas.some((m) => m.id === medData.id);
      const listaActualizada = existe
        ? medicinas.map((m) => (m.id === medData.id ? medData : m))
        : [...medicinas, medData];
      const { alarmasOk } = await aplicarLista(listaActualizada);
      return alarmasOk;
    },
    [medicinas, aplicarLista],
  );

  const eliminarMedicina = useCallback(
    async (id: number) => {
      const med = medicinas.find((m) => m.id === id);
      if (!med) return;
      cancelarAlarmasDeMedicina(med);
      cancelarAplazosPendientes(med);
      const { medicinas: guardadas } = await saveMedications(medicinas.filter((m) => m.id !== id));
      setMedicinas(guardadas);
    },
    [medicinas],
  );

  // Siempre relee de disco (no de este estado) porque puede dispararse desde
  // una alarma nativa recién abierta en frío, antes de que el estado de
  // React llegue a cargar.
  // fechaISO viene de una toma confirmada desde la notificación y registrada
  // después: se guarda con la hora real en que se tocó el botón.
  const marcarComoTomada = useCallback(
    async (id: number, horaIndex: number, fechaISO?: string): Promise<ResultadoAccion> => {
      const { medicinas: actuales } = await loadMedications();
      const med = actuales.find((m) => m.id === id);
      if (!med) return { ok: false, mensaje: "No se encontró la medicina." };

      cancelarAplazosPendientes(med);

      const ultimaToma = med.ultimaTomaPorHorario?.[horaIndex];
      const yaRegistrada = fechaISO
        ? !!ultimaToma && new Date(ultimaToma).getTime() >= new Date(fechaISO).getTime()
        : yaTomadaEnEsteTurno(med, horaIndex);
      if (yaRegistrada) {
        return {
          ok: false,
          mensaje:
            "Ya marcaste esta toma. Se vuelve a habilitar cuando llegue la siguiente hora programada.",
        };
      }

      const ahoraISO = fechaISO ?? new Date().toISOString();
      const esTemporal = med.tipoCiclo === "temporal";
      const tomasActuales = esTemporal ? (med.tomasCompletadas ?? 0) + 1 : med.tomasCompletadas;

      const medActualizada: Medicina = {
        ...med,
        ultimaTomaPorHorario: { ...med.ultimaTomaPorHorario, [horaIndex]: ahoraISO },
        tomasCompletadas: tomasActuales,
        stockActual: med.stockActual != null ? Math.max(0, med.stockActual - 1) : null,
      };

      const listaActualizada = actuales.map((m) => (m.id === id ? medActualizada : m));
      const { medicinas: guardadas, recienCompletadas } = await saveMedications(listaActualizada);
      setMedicinas(guardadas);
      // Solo hace falta si el tratamiento se acaba de completar (para
      // cancelar sus alarmas); para una medicina que sigue activa, el propio
      // AlarmReceiver ya se reprogramó solo para el día siguiente.
      sincronizarAlarmasSeguro(guardadas);

      await registrarEvento({
        medId: med.id,
        medNombre: med.nombre,
        horaIndex,
        horaProgramada: med.horas[horaIndex] ?? "",
        fechaHoraTomaISO: ahoraISO,
        tipoEvento: "tomada",
      });

      const completadaAhora = recienCompletadas.some((m) => m.id === id);
      let mensaje = "¡Bien hecho! Se registró la toma.";
      if (completadaAhora) {
        mensaje = `¡Tratamiento completado! Ya terminaste las tomas de ${med.nombre}.`;
      } else if (esTemporal) {
        const total = med.tomasTotales ?? (med.diasDuracion ?? 1) * (med.vecesPorDia ?? 1);
        mensaje = `Toma ${tomasActuales} de ${total} registrada.`;
      }
      return { ok: true, mensaje };
    },
    [],
  );

  const registrarAplazo = useCallback(
    async (med: Medicina, horaIndex: number, intentos: number) => {
      aplazarToma(med, horaIndex, intentos);
      await registrarEvento({
        medId: med.id,
        medNombre: med.nombre,
        horaIndex,
        horaProgramada: med.horas[horaIndex] ?? "",
        fechaHoraTomaISO: new Date().toISOString(),
        tipoEvento: "aplazada",
      });
    },
    [],
  );

  // Registra los botones de la notificación que Android ya resolvió (sonido
  // apagado y aplazo programado en nativo). Encadenado para que dos llamadas
  // seguidas (arranque + volver a primer plano) no procesen en paralelo.
  const colaPendientes = useRef(Promise.resolve());
  const procesarPendientes = useCallback(() => {
    colaPendientes.current = colaPendientes.current.then(async () => {
      const acciones = ExpoMedAlarm.takePendingActions();
      for (const accion of acciones) {
        const fechaISO = new Date(accion.fechaMs).toISOString();
        if (accion.accion === "tomada") {
          await marcarComoTomada(accion.medId, accion.horaIndex, fechaISO);
        } else {
          const { medicinas: actuales } = await loadMedications();
          const med = actuales.find((m) => m.id === accion.medId);
          if (!med) continue;
          await registrarEvento({
            medId: med.id,
            medNombre: med.nombre,
            horaIndex: accion.horaIndex,
            horaProgramada: med.horas[accion.horaIndex] ?? "",
            fechaHoraTomaISO: fechaISO,
            tipoEvento: "aplazada",
          });
        }
      }
    });
    return colaPendientes.current;
  }, [marcarComoTomada]);

  useEffect(() => {
    (async () => {
      // Primero se registran los botones tocados en la notificación mientras
      // la app estaba cerrada, así la lista que se carga ya los incluye.
      await procesarPendientes();
      const { medicinas: cargadas } = await loadMedications();
      setMedicinas(cargadas);
      await prepararNotificaciones();
      sincronizarAlarmasSeguro(cargadas);
      setCargando(false);
    })();
  }, [procesarPendientes]);

  useEffect(() => {
    const suscripcionEstado = AppState.addEventListener("change", (estado) => {
      if (estado === "active") procesarPendientes();
    });
    const suscripcionNativa = ExpoMedAlarm.addListener("onPendingActions", () => {
      procesarPendientes();
    });
    return () => {
      suscripcionEstado.remove();
      suscripcionNativa.remove();
    };
  }, [procesarPendientes]);

  const agregarImportadas = useCallback(
    async (importadas: Medicina[]) => {
      const combinada = combinarConDeduplicacion(medicinas, importadas);
      const agregadas = combinada.length - medicinas.length;
      const { alarmasOk } = await aplicarLista(combinada);
      return { agregadas, alarmasOk };
    },
    [medicinas, aplicarLista],
  );

  const reemplazarTodas = useCallback(
    async (importadas: Medicina[]) => {
      for (const med of medicinas) cancelarAlarmasDeMedicina(med);
      const { alarmasOk } = await aplicarLista(importadas);
      return alarmasOk;
    },
    [medicinas, aplicarLista],
  );

  const exportar = useCallback(() => exportarDatos(medicinas), [medicinas]);

  const obtenerMedicinaFresca = useCallback(async (id: number) => {
    const { medicinas: actuales } = await loadMedications();
    return actuales.find((m) => m.id === id) ?? null;
  }, []);

  return (
    <MedicinesContext.Provider
      value={{
        medicinas,
        cargando,
        guardarMedicina,
        eliminarMedicina,
        marcarComoTomada,
        registrarAplazo,
        agregarImportadas,
        reemplazarTodas,
        exportar,
        obtenerMedicinaFresca,
      }}
    >
      {children}
    </MedicinesContext.Provider>
  );
}

export function useMedicines() {
  const context = useContext(MedicinesContext);
  if (!context) {
    throw new Error("useMedicines debe usarse dentro de MedicinesProvider");
  }
  return context;
}
