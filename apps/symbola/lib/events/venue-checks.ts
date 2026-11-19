// Lot 48a (PRE-06 ; D4, ADR 0093) — contrôles du chrono par les contraintes du lieu : orchestration
// entre modules par leurs service.ts (ADR 0011). Pour chaque lieu de l'évènement qui désigne une fiche
// du carnet, ses contraintes (champs de la fiche porteurs d'une règle) contrôlent les séquences qui
// s'y déroulent : celles dont le temps fort est à ce lieu, ou, sans lieu précisé, celles du lieu de
// réception (le premier). Une séquence est « musique » si un prestataire retenu de son poste est d'un
// type musique (venue-rules.json). Signalé sur le programme et dans le mode Jour J, jamais bloquant ;
// le nombre d'invités au-delà de la capacité est signalé sur la fiche de l'évènement. Module des
// prestataires fermé : aucun contrôle (dégradation propre, ARC-06).
import type { EventProgram, VenueCapacityFinding, VenueProgramFinding } from "@symbola/contracts";
import { listEventPlaces, listKeyMoments, listVendorCandidates } from "@/modules/events/service";
import { checkProgramWithVenue, checkVenueCapacity, getVenueConstraints } from "@/modules/vendors/service";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";

export type VenueChecks = { findings: VenueProgramFinding[]; capacity: VenueCapacityFinding | null };

const NONE: VenueChecks = { findings: [], capacity: null };

export async function venueChecksFor(organizationId: string, eventId: string, program: Pick<EventProgram, "items">, guests: number | null): Promise<VenueChecks> {
  if (!(await isVendorsModuleEnabled(organizationId))) return NONE;
  const places = await listEventPlaces(organizationId, eventId);
  const venuePlaces = places.filter((place) => place.vendorId !== null);
  if (venuePlaces.length === 0) return NONE;
  const constraints = await getVenueConstraints(organizationId, venuePlaces.map((place) => place.vendorId!));
  if (constraints.length === 0) return NONE;
  const [moments, candidates] = await Promise.all([listKeyMoments(organizationId, eventId), listVendorCandidates(organizationId, eventId)]);
  const retainedBySlot = new Map<string, string[]>();
  for (const candidate of candidates) {
    if (candidate.outcome !== "selected" || !candidate.vendorId) continue;
    retainedBySlot.set(candidate.vendorSlotId, [...(retainedBySlot.get(candidate.vendorSlotId) ?? []), candidate.vendorId]);
  }
  const reception = places[0]?.id ?? null;
  const placeOfMoment = new Map(moments.map((moment) => [moment.id, moment.placeId ?? null]));
  const findings: VenueProgramFinding[] = [];
  for (const place of venuePlaces) {
    const venue = constraints.find((candidate) => candidate.vendorId === place.vendorId);
    if (!venue) continue;
    const sequences = program.items
      .filter((item) => {
        const momentPlace = item.keyMomentId ? (placeOfMoment.get(item.keyMomentId) ?? null) : null;
        return momentPlace === place.id || (momentPlace === null && place.id === reception);
      })
      .map((item) => {
        const slots = item.participants.flatMap((participant) => (participant.vendorSlotId ? [participant.vendorSlotId] : []));
        return { id: item.id, startTime: item.startTime, endTime: item.endTime, vendorIds: slots.flatMap((slot) => retainedBySlot.get(slot) ?? []), hasVendorSlot: slots.length > 0 };
      });
    findings.push(...(await checkProgramWithVenue(organizationId, venue, sequences)));
  }
  const receptionVenue = constraints.find((candidate) => candidate.vendorId === places[0]?.vendorId);
  return { findings, capacity: receptionVenue ? checkVenueCapacity(receptionVenue, guests) : null };
}
