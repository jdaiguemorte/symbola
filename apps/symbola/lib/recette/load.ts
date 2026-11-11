// Lot 24a (DAT-10, décision D7) — jeu fictif de recette chargé en une commande
// (docs/recette/symbola-synthetic-users.json). Tout passe par les services des
// modules : la RLS, le journal et les règles métier s'appliquent comme en vrai.
// Les deux organisations ont des identifiants fixes et un nom marqué
// « [Recette] » ; le chargement refuse de tourner en production et sur une base
// où le jeu est déjà chargé. Il couvre ce que l'app sait faire aujourd'hui :
// comptes, événements, clients, catalogue, devis et échéancier, budget,
// tâches, carnet de prestataires. Le reste du jeu (invités, tables, accès
// payeur, liens des tiers) viendra avec les lots qui créent ces écrans.
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createUser, type Role } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { organizations } from "@symbola/db/schema/hub";
import { confirmEventBudget, createAllocationModel, simulateEventBudget } from "@/modules/budget/service";
import {
  acceptEventClientInvitation,
  addDefaultVendorSlots,
  addEventTask,
  changeEventStatus,
  createProspect,
  createProspectSource,
  inviteEventClient,
} from "@/modules/events/service";
import { completeSetup } from "@/modules/hub/service";
import { addQuoteLine, addScheduleItem, createCatalogItem, createQuote } from "@/modules/quotes/service";
import { createVendor } from "@/modules/vendors/service";

// Identifiants fixes des deux organisations du jeu (« 7ec37e » : recette).
export const RECETTE_ORGANIZATION_IDS: Record<string, string> = {
  "ORG-01": "7ec37e00-0000-4000-8000-000000000001",
  "ORG-02": "7ec37e00-0000-4000-8000-000000000002",
};
export const RECETTE_PREFIX = "[Recette]";

const memberSchema = z.object({ profil: z.string().optional(), nom: z.string().optional(), role: z.string() });
const datasetSchema = z.object({
  profils: z.array(z.object({ id: z.string(), nom: z.string() })),
  organisations: z.array(
    z.object({
      id: z.string(),
      nom: z.string(),
      regime_tva: z.string(),
      membres: z.array(memberSchema),
      catalogue: z.array(z.object({ libelle: z.string(), prix_centimes: z.number().int().nonnegative() })).optional(),
      evenements: z.array(z.object({ id: z.string().optional(), nom: z.string(), date: z.string(), statut: z.string().optional() })).optional(),
      volumes: z.object({ evenements: z.number().int().nonnegative(), prospects: z.number().int().nonnegative() }).optional(),
    }),
  ),
  evenements: z.array(
    z.object({
      id: z.string(),
      organisation: z.string(),
      nom: z.string(),
      statut: z.string(),
      date: z.string().optional(),
      dates: z.array(z.string()).optional(),
      clients: z.array(z.object({ nom: z.string(), email: z.string(), role: z.string() })).optional(),
      client: z.object({ contact: z.string(), email: z.string() }).optional(),
      lieux: z.array(z.object({ nom: z.string() })).optional(),
      lieu: z.object({ nom: z.string(), commune: z.string().optional() }).optional(),
      prestataires: z
        .array(z.object({ nom: z.string(), categorie: z.string(), contact: z.string().optional(), email: z.string().optional(), telephone: z.string().optional() }))
        .optional(),
      budget: z
        .object({
          synthese: z.object({ enveloppe_centimes: z.number().int().positive() }).optional(),
          lignes: z.array(z.object({ poste: z.string(), estime_centimes: z.number().int().nonnegative() })).optional(),
          postes: z.array(z.object({ poste: z.string(), ht_centimes: z.number().int().nonnegative() })).optional(),
          taux_tva_pct: z.number().optional(),
        })
        .optional(),
      taches: z.array(z.object({ titre: z.string(), responsable: z.string(), echeance: z.string() })).optional(),
      invites: z.object({ synthese: z.object({ invites: z.number().int().nonnegative() }) }).optional(),
      participants: z.number().int().nonnegative().optional(),
    }),
  ),
});
export type RecetteDataset = z.infer<typeof datasetSchema>;

export type RecetteAccount = { organisation: string; profil: string | null; nom: string; email: string; password: string; role: Role };
export type RecetteResult = {
  organizations: { key: string; id: string; name: string; events: number }[];
  accounts: RecetteAccount[];
};

export class RecetteRefusedError extends Error {
  constructor(readonly reason: "production" | "already_loaded") {
    super(reason === "production" ? "jeu fictif refusé en production" : "jeu fictif déjà chargé dans cette base");
    this.name = "RecetteRefusedError";
  }
}

export type RecetteOptions = {
  nodeEnv?: string | undefined;
  // Tests : d'autres identifiants et un suffixe d'e-mail, pour charger le jeu
  // plusieurs fois dans une même base.
  organizationIds?: Record<string, string>;
  emailTag?: string;
};

const EVENT_STATUS: Record<string, "prospect" | "quote_sent" | "confirmed"> = {
  "En préparation": "confirmed",
  Option: "prospect",
  "Devis envoyé": "quote_sent",
};

export function parseRecetteDataset(raw: unknown): RecetteDataset {
  return datasetSchema.parse(raw);
}

// « Camille Roussel » → camille.roussel@exemple.test (domaine réservé à la fiction).
export function recetteEmail(name: string, tag?: string): string {
  const local = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
  return `${local}${tag ? `+${tag}` : ""}@exemple.test`;
}

function newPassword(): string {
  return randomBytes(18).toString("base64url");
}

function splitName(name: string): { firstName: string; lastName: string | null } {
  const [firstName, ...rest] = name.split(" ");
  return { firstName: firstName!, lastName: rest.length > 0 ? rest.join(" ") : null };
}

// Répartition en points de base (somme exacte : 10 000), à partir des montants.
export function percentages(amounts: number[]): number[] {
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const shares = amounts.map((amount) => Math.floor((amount * 10_000) / total));
  shares[shares.length - 1]! += 10_000 - shares.reduce((sum, share) => sum + share, 0);
  return shares;
}

function weeklyDate(start: string, week: number): string {
  const date = new Date(`${start}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 7 * week);
  return date.toISOString().slice(0, 10);
}

export async function loadRecette(raw: unknown, options: RecetteOptions = {}): Promise<RecetteResult> {
  if ((options.nodeEnv ?? process.env.NODE_ENV) === "production") throw new RecetteRefusedError("production");
  const dataset = parseRecetteDataset(raw);
  const ids = options.organizationIds ?? RECETTE_ORGANIZATION_IDS;
  const db = appDatabase();
  for (const id of Object.values(ids)) {
    if ((await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, id))).length > 0) {
      throw new RecetteRefusedError("already_loaded");
    }
  }

  const profileName = new Map(dataset.profils.map((profile) => [profile.id, profile.nom]));
  const result: RecetteResult = { organizations: [], accounts: [] };

  for (const organisation of dataset.organisations) {
    const organizationId = ids[organisation.id];
    if (!organizationId) continue;
    const name = `${RECETTE_PREFIX} ${organisation.nom}`;
    await db.insert(organizations).values({ id: organizationId, name });
    await completeSetup(db, organizationId);

    // Comptes de l'équipe : la propriétaire est la titulaire ; les autres, collaborateurs.
    let ownerId: string | null = null;
    for (const [index, member] of organisation.membres.entries()) {
      const memberName = (member.profil ? profileName.get(member.profil) : undefined) ?? member.nom ?? `Membre ${index + 1}`;
      const role: Role = member.role === "Propriétaire" ? "owner" : "member";
      const account = { organisation: organisation.id, profil: member.profil ?? null, nom: memberName, email: recetteEmail(memberName, options.emailTag), password: newPassword(), role };
      const user = await createUser(db, { organizationId, email: account.email, password: account.password, role });
      if (role === "owner" && !ownerId) ownerId = user.id;
      result.accounts.push(account);
    }
    if (!ownerId) throw new Error(`organisation ${organisation.id} sans propriétaire`);

    const source = await createProspectSource(organizationId, "Recette");
    const catalogue = new Map<string, string>();
    const vatRate = organisation.regime_tva.startsWith("franchise") ? 0 : 2000;
    for (const item of organisation.catalogue ?? []) {
      const created = await createCatalogItem(organizationId, { label: item.libelle, unit: "forfait", unitPriceCents: item.prix_centimes, vatRateBasisPoints: vatRate });
      catalogue.set(item.libelle, created.id);
    }

    // Postes du budget par défaut, tirés des événements détaillés de l'organisation.
    const detailed = dataset.evenements.filter((event) => event.organisation === organisation.id);
    const postes = [...new Set(detailed.flatMap((event) => (event.budget?.lignes ?? []).map((line) => line.poste)))];
    const slots = postes.length > 0 ? await addDefaultVendorSlots(organizationId, postes.map((label) => ({ label, icon: null }))) : [];

    let events = 0;
    for (const event of detailed) {
      const clients = event.clients?.filter((client) => client.role !== "payeur") ?? [];
      const venue = event.lieux?.[0]?.nom ?? event.lieu?.nom ?? null;
      const created = await createProspect({
        organizationId,
        createdByUserId: ownerId,
        prospectSourceId: source.id,
        clients: clients.length > 0 ? clients.map((client) => splitName(client.nom)) : [splitName(event.client?.contact ?? event.nom)],
        eventDate: event.date ?? event.dates?.[0] ?? null,
        venueName: venue,
        venueCity: event.lieu?.commune ?? null,
      });
      events += 1;
      const status = EVENT_STATUS[event.statut] ?? "confirmed";
      if (status !== "prospect") await changeEventStatus({ organizationId, eventId: created.id, changedByUserId: ownerId, toStatus: status });

      // Comptes des mariés (espace client) ; le payeur attend son accès propre.
      for (const client of clients) {
        const email = options.emailTag ? client.email.replace("@", `+${options.emailTag}@`) : client.email;
        const password = newPassword();
        const invitation = await inviteEventClient({ organizationId, eventId: created.id, email, invitedByUserId: ownerId, locale: "fr" });
        await acceptEventClientInvitation(invitation.invitationToken!, password);
        result.accounts.push({ organisation: organisation.id, profil: null, nom: client.nom, email, password, role: "client" });
      }

      for (const vendor of event.prestataires ?? []) {
        await createVendor(organizationId, { name: vendor.nom, typeId: null, contactName: vendor.contact ?? null, email: vendor.email ?? null, phone: vendor.telephone ?? null });
      }
      for (const task of event.taches ?? []) {
        await addEventTask(organizationId, created.id, { label: task.titre, dueDate: task.echeance, responsible: task.responsable === "client" ? "clients" : "planner" });
      }

      // Devis : le catalogue pour un particulier, les postes HT pour une entreprise.
      const quote = await createQuote({ organizationId, eventId: created.id, createdByUserId: ownerId });
      if (event.budget?.postes) {
        const rate = Math.round((event.budget.taux_tva_pct ?? 20) * 100);
        for (const poste of event.budget.postes) {
          await addQuoteLine(organizationId, quote.id, { label: poste.poste, unit: "forfait", quantityMilli: 1000, unitPriceCents: poste.ht_centimes, vatRateBasisPoints: rate });
        }
      } else {
        for (const itemId of [...catalogue.values()].slice(0, 2)) await addQuoteLine(organizationId, quote.id, { catalogItemId: itemId, quantityMilli: 1000 });
      }
      const date = event.date ?? event.dates?.[0];
      if (date) {
        await addScheduleItem(organizationId, quote.id, { label: "Acompte", dueDate: weeklyDate(date, -20), percentageBasisPoints: 3000 });
        await addScheduleItem(organizationId, quote.id, { label: "Solde", dueDate: weeklyDate(date, -2), percentageBasisPoints: 7000 });
      }

      // Budget : enveloppe répartie selon les montants estimés, puis confirmé.
      const lines = event.budget?.lignes ?? [];
      if (event.budget?.synthese && lines.length > 0) {
        const bySlot = slots.map((slot) => lines.filter((line) => line.poste === slot.label).reduce((sum, line) => sum + line.estime_centimes, 0));
        const shares = percentages(bySlot);
        const model = await createAllocationModel({
          organizationId,
          name: `Recette ${event.id}`,
          items: slots.map((slot, index) => ({ defaultVendorSlotId: slot.id, percentageBasisPoints: shares[index]! })),
        });
        await simulateEventBudget({
          organizationId,
          eventId: created.id,
          totalAmountCents: event.budget.synthese.enveloppe_centimes,
          guestCount: event.invites?.synthese.invites ?? event.participants ?? 0,
          allocationModelId: model.id,
        });
        await confirmEventBudget({ organizationId, eventId: created.id, confirmedByUserId: ownerId });
      }
    }

    // Autres événements de la liste (noms et dates seuls), puis les volumes.
    const listed = (organisation.evenements ?? []).filter((event) => !event.id);
    for (const event of listed) {
      const created = await createProspect({ organizationId, createdByUserId: ownerId, prospectSourceId: source.id, clients: [splitName(event.nom)], eventDate: event.date });
      events += 1;
      const status = EVENT_STATUS[event.statut ?? ""] ?? "confirmed";
      if (status !== "prospect") await changeEventStatus({ organizationId, eventId: created.id, changedByUserId: ownerId, toStatus: status });
    }
    const volumes = organisation.volumes ?? { evenements: 0, prospects: 0 };
    const extraEvents = Math.max(0, volumes.evenements - detailed.length);
    for (let index = 0; index < extraEvents + volumes.prospects; index += 1) {
      const prospect = index >= extraEvents;
      const label = prospect ? `Prospect fictif ${index - extraEvents + 1}` : `Évènement fictif ${index + 1}`;
      const created = await createProspect({ organizationId, createdByUserId: ownerId, prospectSourceId: source.id, clients: [{ firstName: label, lastName: null }], eventDate: weeklyDate("2027-01-09", index % 52) });
      events += 1;
      if (!prospect) await changeEventStatus({ organizationId, eventId: created.id, changedByUserId: ownerId, toStatus: "confirmed" });
    }

    result.organizations.push({ key: organisation.id, id: organizationId, name, events });
  }
  return result;
}
