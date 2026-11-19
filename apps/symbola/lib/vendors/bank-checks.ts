// Lot 48a (PRE-10, SEC-27 ; D5, ADR 0093) — IBAN « à vérifier par un autre canal », vus depuis un
// évènement : orchestration events → vendors par leurs service.ts (ADR 0011). Sert l'échéancier du
// budget et les remises du jour J. Module des prestataires fermé : rien à signaler.
import { listVendorCandidates } from "@/modules/events/service";
import { listPendingBankChecks } from "@/modules/vendors/service";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";

// Prestataires consultés de l'évènement dont la fiche a un changement d'IBAN non vérifié.
export async function bankToVerifyCandidates(organizationId: string, eventId: string): Promise<Set<string>> {
  if (!(await isVendorsModuleEnabled(organizationId))) return new Set();
  const candidates = (await listVendorCandidates(organizationId, eventId)).filter((candidate) => candidate.vendorId !== null);
  if (candidates.length === 0) return new Set();
  const pending = await listPendingBankChecks(organizationId, candidates.map((candidate) => candidate.vendorId!));
  return new Set(candidates.filter((candidate) => pending.has(candidate.vendorId!)).map((candidate) => candidate.id));
}

// Fiches du carnet dont un changement d'IBAN attend la vérification, parmi celles données.
export async function bankToVerifyVendors(organizationId: string, vendorIds: string[]): Promise<Set<string>> {
  if (vendorIds.length === 0 || !(await isVendorsModuleEnabled(organizationId))) return new Set();
  return new Set((await listPendingBankChecks(organizationId, vendorIds)).keys());
}
