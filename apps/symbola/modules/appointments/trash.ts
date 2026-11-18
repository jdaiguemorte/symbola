// Lot 46 (DAT-03, UX-07 ; ADR 0073, ADR 0083) — corbeille du module Rendez-vous : un type ou un
// rendez-vous supprimé y reste 30 jours, puis est purgé ; il revient tel qu'il était. Les rendez-vous
// gardent le nom figé de leur type : supprimer un type ne change aucun rendez-vous.
import type { TrashedObject } from "@symbola/contracts";
import { findTrashedRows, purgeTrashedRows } from "./repository";

export type AppointmentsTrashKind = "appointmentType" | "appointment";

export async function listTrashedAppointmentsRows(organizationId: string): Promise<TrashedObject[]> {
  const { types, appointments } = await findTrashedRows(organizationId);
  return [
    ...types.map((row): TrashedObject => ({ kind: "appointmentType", id: row.id, label: row.label, eventId: null, deletedAt: row.deletedAt!, deletedBy: null })),
    ...appointments.map((row): TrashedObject => ({ kind: "appointment", id: row.id, label: `${row.typeName} — ${row.label}`, eventId: null, deletedAt: row.deletedAt!, deletedBy: null })),
  ];
}

export async function isAppointmentsObjectTrashed(organizationId: string, kind: AppointmentsTrashKind, id: string): Promise<boolean> {
  const { types, appointments } = await findTrashedRows(organizationId);
  return (kind === "appointmentType" ? types : appointments).some((row) => row.id === id);
}

// Purge : un objet précis (« Supprimer définitivement »), ou tout ce qui est à la corbeille avant
// une date (purge planifiée). Renvoie le nombre d'objets purgés.
export async function purgeTrashedAppointmentsObjects(organizationId: string, target: { kind: AppointmentsTrashKind; id: string } | { before: Date }): Promise<number> {
  if ("before" in target) {
    const { types, appointments } = await findTrashedRows(organizationId, target.before);
    await purgeTrashedRows(organizationId, { types: types.map((row) => row.id), appointments: appointments.map((row) => row.id) });
    return types.length + appointments.length;
  }
  await purgeTrashedRows(organizationId, target.kind === "appointmentType" ? { types: [target.id], appointments: [] } : { types: [], appointments: [target.id] });
  return 1;
}
