// Lot 24a (DAT-10, décision D7) — jeu fictif de recette chargé en une commande
// (docs/recette/symbola-synthetic-users.json). Tout passe par les services des
// modules : la RLS, le journal et les règles métier s'appliquent comme en vrai.
// Les deux organisations ont des identifiants fixes et un nom marqué
// « [Recette] » ; le chargement refuse de tourner en production et sur une base
// où le jeu est déjà chargé. Il couvre ce que l'app sait faire aujourd'hui :
// comptes, événements, clients, catalogue, devis et échéancier, budget,
// tâches, carnet de prestataires, et les liens personnels des clients et du
// payeur (lot 26a) et du prestataire retenu joué par un profil (lot 26b). Le
// reste du jeu (invités, tables) viendra avec les lots qui créent ces écrans.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createUser, type Role } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { organizations } from "@symbola/db/schema/hub";
import { addBudgetLine, addVendorPayment, createAllocationModel, setVendorPaymentPaid, simulateEventBudget, updateBudgetLine } from "@/modules/budget/service";
import {
  addDefaultVendorSlots,
  addEventPlace,
  addEventTask,
  addProgramItem,
  addVendorCandidate,
  changeEventStatus,
  createEventLink,
  createProspect,
  createProspectSource,
  getEvent,
  listEventVendorSlots,
  listLinkProfiles,
  listVendorCandidates,
  selectVendorCandidate,
  setEventWantedBudget,
  updateEventClientContact,
  updateEventTask,
  updateVendorCandidate,
  type VendorCandidateStatus,
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
  profils: z.array(z.object({ id: z.string(), nom: z.string(), donnees_de_test: z.string().optional() })),
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
      lieux: z.array(z.object({ nom: z.string(), commune: z.string().optional() })).optional(),
      // Lot 29a (rejeu de SC-08) : déroulé du jour J, chargé comme programme.
      chrono: z
        .array(
          z.object({
            jour: z.string(),
            heure: z.string().regex(/^\d{2}:\d{2}$/),
            duree_min: z.number().int().nonnegative().optional(),
            titre: z.string(),
            lieu: z.string().nullable().optional(),
            prestataire: z.string().nullable().optional(),
          }),
        )
        .optional(),
      lieu: z.object({ nom: z.string(), commune: z.string().optional() }).optional(),
      prestataires: z
        .array(
          z.object({
            id: z.string().optional(),
            nom: z.string(),
            categorie: z.string(),
            statut: z.string().optional(),
            contact: z.string().optional(),
            email: z.string().optional(),
            telephone: z.string().optional(),
          }),
        )
        .optional(),
      budget: z
        .object({
          synthese: z.object({ enveloppe_centimes: z.number().int().positive() }).optional(),
          // Lot 28b (Q33) : plusieurs lignes par poste, avec leur prestataire.
          lignes: z
            .array(
              z.object({
                id: z.string().optional(),
                poste: z.string(),
                libelle: z.string().optional(),
                prestataire: z.string().nullable().optional(),
                estime_centimes: z.number().int().nonnegative(),
                engage_centimes: z.number().int().nonnegative().optional(),
                paye_centimes: z.number().int().nonnegative().optional(),
              }),
            )
            .optional(),
          echeances: z
            .array(z.object({ ligne: z.string(), libelle: z.string(), montant_centimes: z.number().int().positive(), date: z.string(), statut: z.string(), payeur: z.string().optional() }))
            .optional(),
          postes: z.array(z.object({ poste: z.string(), ht_centimes: z.number().int().nonnegative() })).optional(),
          taux_tva_pct: z.number().optional(),
        })
        .optional(),
      taches: z.array(z.object({ titre: z.string(), responsable: z.string(), echeance: z.string(), statut: z.string().optional() })).optional(),
      invites: z.object({ synthese: z.object({ invites: z.number().int().nonnegative() }) }).optional(),
      participants: z.number().int().nonnegative().optional(),
    }),
  ),
});
export type RecetteDataset = z.infer<typeof datasetSchema>;

// Lot 33 : plus de mot de passe ; connexion par lien magique (Mailpit en local).
export type RecetteAccount = { organisation: string; profil: string | null; nom: string; email: string; role: Role };
// Lot 26a (ADR 0053) : lien personnel d'un client ou d'un payeur ; l'adresse
// n'est montrée qu'une fois, ici, pour le fichier local de recette.
export type RecetteLink = { organisation: string; evenement: string; nom: string; email: string; profil: string; url: string };
export type RecetteResult = {
  organizations: { key: string; id: string; name: string; events: number }[];
  accounts: RecetteAccount[];
  links: RecetteLink[];
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

// Lot 28b (PRE-02) : statut d'un prestataire du jeu, en clair, vers celui de l'app.
const VENDOR_STATUS: Record<string, VendorCandidateStatus> = {
  "contrat signé": "contract_signed",
  "retenu, validé par le client": "retained",
  "devis reçu, contrat en retard": "quote_received",
  "consulté, devis reçu": "quote_received",
  "consulté, indisponible": "dismissed",
  soldé: "paid_off",
};
const ENGAGED: VendorCandidateStatus[] = ["retained", "contract_signed", "paid_off"];

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
  const result: RecetteResult = { organizations: [], accounts: [], links: [] };

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
      const account = { organisation: organisation.id, profil: member.profil ?? null, nom: memberName, email: recetteEmail(memberName, options.emailTag), role };
      const user = await createUser(db, { organizationId, email: account.email, role });
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

      // Lot 29a (rejeu de SC-08) : l'e-mail des clients et les lieux de l'événement,
      // lus sur l'écran du jour J ; chaque fiche de prestataire est retenue pour être
      // rattachée à sa consultation (coordonnées du jour J).
      const createdClients = (await getEvent(organizationId, created.id))?.clients ?? [];
      for (const [index, client] of clients.entries()) {
        const clientId = createdClients[index]?.id;
        const email = options.emailTag ? client.email.replace("@", `+${options.emailTag}@`) : client.email;
        if (clientId) await updateEventClientContact({ organizationId, eventId: created.id, clientId, contact: { email } });
      }
      for (const place of event.lieux ?? []) await addEventPlace(organizationId, created.id, { label: place.nom, address: place.commune ?? null });

      const vendorIds = new Map<string, string>();
      for (const vendor of event.prestataires ?? []) {
        const saved = await createVendor(organizationId, { name: vendor.nom, typeId: null, contactName: vendor.contact ?? null, email: vendor.email ?? null, phone: vendor.telephone ?? null });
        if (vendor.id) vendorIds.set(vendor.id, saved.vendor.id);
      }
      for (const task of event.taches ?? []) {
        const added = await addEventTask(organizationId, created.id, { label: task.titre, dueDate: task.echeance, responsible: task.responsable === "client" ? "clients" : "planner" });
        // Lot 27a (POR-02) : les tâches faites du jeu le sont aussi dans l'app
        // (avancement et prochaines actions du portail).
        if (task.statut === "fait") await updateEventTask({ organizationId, taskId: added.id, done: true });
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

      // Budget : l'enveloppe du client et sa simulation, puis (lot 28b) les lignes
      // du jeu sous chaque poste, leurs prestataires rattachés et leurs échéances.
      const lines = event.budget?.lignes ?? [];
      if (event.budget?.synthese && lines.length > 0) {
        await setEventWantedBudget(organizationId, created.id, event.budget.synthese.enveloppe_centimes);
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
        await loadBudgetLines(organizationId, ownerId, created.id, event, vendorIds);
      }
      await loadProgram(organizationId, created.id, event);

      // Lot 26a (UX-11, POR-01) : un lien personnel par client (profil
      // « Marié(e) ») et par payeur (profil « Payeur », limité à ses postes).
      for (const person of event.clients ?? []) {
        const payer = person.role === "payeur";
        const profile = listLinkProfiles("fr", "couple").find((candidate) => candidate.key === (payer ? "payer" : "couple"))!;
        const email = options.emailTag ? person.email.replace("@", `+${options.emailTag}@`) : person.email;
        const eventClient = payer ? undefined : (await getEvent(organizationId, created.id))?.clients.find((client) => [client.firstName, client.lastName].filter(Boolean).join(" ") === person.nom);
        const delivery = await createEventLink({
          organizationId,
          eventId: created.id,
          createdByUserId: ownerId,
          audience: "client",
          locale: "fr",
          link: {
            personName: person.nom,
            email,
            eventClientId: eventClient?.id ?? null,
            rights: { rubrics: profile.rubrics, budgetScope: profile.budgetScope, sharedSlotIds: payer ? await payerSlotIds(organizationId, created.id, person.nom, event, dataset) : [] },
          },
        });
        result.links.push({ organisation: organisation.id, evenement: event.id, nom: person.nom, email, profil: profile.label, url: delivery.url });
      }

      // Lot 26b (UX-11, D9) : un lien personnel pour chaque prestataire retenu
      // dont le contact est un profil du jeu (Karim Haddad, SU-08, pour SC-S3).
      const personas = new Set(dataset.profils.map((profile) => profile.nom));
      const candidates = await listVendorCandidates(organizationId, created.id);
      for (const vendor of event.prestataires ?? []) {
        if (!vendor.contact || !vendor.email || !personas.has(vendor.contact)) continue;
        const candidate = candidates.find((item) => item.vendorName === vendor.nom && item.outcome === "selected");
        if (!candidate) continue;
        const email = options.emailTag ? vendor.email.replace("@", `+${options.emailTag}@`) : vendor.email;
        const delivery = await createEventLink({
          organizationId,
          eventId: created.id,
          createdByUserId: ownerId,
          audience: "vendor",
          vendorCandidateId: candidate.id,
          locale: "fr",
          link: { personName: vendor.contact, email, rights: { rubrics: [], budgetScope: "all", sharedSlotIds: [] } },
        });
        result.links.push({ organisation: organisation.id, evenement: event.id, nom: vendor.contact, email, profil: "Prestataire", url: delivery.url });
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

// Lot 26a (POR-01, POR-10) — postes ouverts au lien d'un payeur : ceux des
// échéances qu'il règle, et ceux que sa fiche de profil nomme (« Accès payeur
// limité aux lignes Lieu et Traiteur »), reconnus par le premier mot du poste.
async function payerSlotIds(organizationId: string, eventId: string, payerName: string, event: RecetteDataset["evenements"][number], dataset: RecetteDataset): Promise<string[]> {
  const lines = event.budget?.lignes ?? [];
  const paid = new Set((event.budget?.echeances ?? []).filter((payment) => payment.payeur === payerName).flatMap((payment) => lines.filter((line) => line.id === payment.ligne).map((line) => line.poste)));
  const described = (dataset.profils.find((profile) => profile.nom === payerName)?.donnees_de_test ?? "").toLowerCase();
  const slots = await listEventVendorSlots(organizationId, eventId);
  return slots.filter((slot) => paid.has(slot.label) || (described && described.includes(slot.label.split(" ")[0]!.toLowerCase()))).map((slot) => slot.id);
}

// Lot 28b (BUD-01, BUD-03, PRE-02) — lignes du jeu sous chaque poste : libellé,
// prestataire rattaché (au statut du jeu), estimé, devisé et engagé, payé ;
// échéances à venir. Un payé déjà versé sur une ligne qui a des échéances
// devient une échéance payée (le payé d'une telle ligne en est la somme, D13).
async function loadBudgetLines(
  organizationId: string,
  ownerId: string,
  eventId: string,
  event: RecetteDataset["evenements"][number],
  vendorIds: Map<string, string>,
): Promise<void> {
  const lines = event.budget?.lignes ?? [];
  const slotOf = new Map((await listEventVendorSlots(organizationId, eventId)).map((slot) => [slot.label, slot.id]));
  const vendorOf = new Map((event.prestataires ?? []).flatMap((vendor) => (vendor.id ? [[vendor.id, vendor]] : [])));

  // Un prestataire rattaché par poste où il a des lignes ; son devis = l'engagé de ces lignes.
  // Ses statuts sont posés après les lignes : la retenue engage alors les lignes
  // existantes (le worker peut la traiter à tout moment) au lieu d'en créer une.
  const candidateOf = new Map<string, string>();
  const statuses: { candidateId: string; status: VendorCandidateStatus; quote: number }[] = [];
  for (const line of lines) {
    const vendor = line.prestataire ? vendorOf.get(line.prestataire) : undefined;
    const slotId = slotOf.get(line.poste);
    if (!vendor || !slotId || candidateOf.has(`${slotId}:${line.prestataire}`)) continue;
    const candidate = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slotId, vendorName: vendor.nom, vendorId: vendorIds.get(line.prestataire!) ?? null });
    candidateOf.set(`${slotId}:${line.prestataire}`, candidate.id);
    const quote = lines.filter((other) => other.poste === line.poste && other.prestataire === line.prestataire).reduce((sum, other) => sum + (other.engage_centimes ?? 0), 0);
    statuses.push({ candidateId: candidate.id, status: VENDOR_STATUS[vendor.statut ?? ""] ?? "contacted", quote });
  }

  const lineIdOf = new Map<string, string>();
  for (const line of lines) {
    const slotId = slotOf.get(line.poste);
    if (!slotId) continue;
    const label = line.libelle ?? line.poste;
    const vendorCandidateId = line.prestataire ? (candidateOf.get(`${slotId}:${line.prestataire}`) ?? null) : null;
    const view = await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slotId, label, vendorCandidateId });
    const lineId = view.lines.filter((entry) => entry.eventVendorSlotId === slotId && entry.label === label).at(-1)!.id;
    if (line.id) lineIdOf.set(line.id, lineId);
    const set = (field: "estimated" | "quoted" | "committed" | "paid", amountCents: number) =>
      updateBudgetLine({ organizationId, eventId, lineId, field, amountCents, changedByUserId: ownerId });
    await set("estimated", line.estime_centimes);
    if ((line.engage_centimes ?? 0) > 0) {
      await set("quoted", line.engage_centimes!);
      await set("committed", line.engage_centimes!);
    }
    const hasPayments = (event.budget?.echeances ?? []).some((payment) => payment.ligne === line.id);
    if ((line.paye_centimes ?? 0) > 0 && !hasPayments) await set("paid", line.paye_centimes!);
  }

  // Lot 27b (POR-03) : les prestataires consultés du jeu sans ligne de budget
  // (fleuristes consultés pour EV-REF-01) sont aussi rattachés à leur poste, au
  // statut du jeu ; ils peuvent alors être proposés au client.
  // La catégorie du jeu (« Fleuriste ») ne reprend pas toujours le libellé du
  // poste (« Fleurs et décoration ») : libellé exact, sinon la racine du premier mot.
  const stem = (text: string) => text.split(" ")[0]!.toLowerCase().replace(/s$/, "");
  const slotForCategory = (category: string) =>
    slotOf.get(category) ?? [...slotOf.entries()].find(([label]) => stem(category).startsWith(stem(label)) || stem(label).startsWith(stem(category)))?.[1];
  const attached = new Set(lines.flatMap((line) => (line.prestataire ? [line.prestataire] : [])));
  for (const vendor of event.prestataires ?? []) {
    const slotId = slotForCategory(vendor.categorie);
    if (!vendor.id || attached.has(vendor.id) || !slotId) continue;
    const candidate = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slotId, vendorName: vendor.nom, vendorId: vendorIds.get(vendor.id) ?? null });
    statuses.push({ candidateId: candidate.id, status: VENDOR_STATUS[vendor.statut ?? ""] ?? "contacted", quote: 0 });
  }

  for (const { candidateId, status, quote } of statuses) {
    if (ENGAGED.includes(status)) {
      await updateVendorCandidate({ organizationId, candidateId, quoteAmountCents: quote > 0 ? quote : null });
      await selectVendorCandidate({ organizationId, candidateId, changedByUserId: ownerId });
      if (status !== "retained") await updateVendorCandidate({ organizationId, candidateId, status, changedByUserId: ownerId });
    } else {
      await updateVendorCandidate({ organizationId, candidateId, status, ...(quote > 0 ? { quoteAmountCents: quote } : {}) });
    }
  }

  const date = event.date ?? event.dates?.[0] ?? null;
  for (const line of lines) {
    const lineId = line.id ? lineIdOf.get(line.id) : undefined;
    const payments = (event.budget?.echeances ?? []).filter((payment) => payment.ligne === line.id);
    if (!lineId || payments.length === 0) continue;
    if ((line.paye_centimes ?? 0) > 0) {
      const paidOn = date ? weeklyDate(date, -40) : payments[0]!.date;
      const view = await addVendorPayment({ organizationId, eventId, lineId, label: "Paiements déjà versés", fixedAmountCents: line.paye_centimes!, dueOn: paidOn, changedByUserId: ownerId });
      const paymentId = view.lines.find((entry) => entry.id === lineId)!.payments.find((payment) => payment.label === "Paiements déjà versés")!.id;
      await setVendorPaymentPaid({ organizationId, eventId, paymentId, paidOn, changedByUserId: ownerId });
    }
    for (const payment of payments) {
      await addVendorPayment({ organizationId, eventId, lineId, label: payment.libelle, fixedAmountCents: payment.montant_centimes, dueOn: payment.date, changedByUserId: ownerId });
    }
  }
}

// Lot 29a (JRJ-02, rejeu de SC-08) : le déroulé du jour de l'événement devient son
// programme (les autres jours, comme le brunch du lendemain, n'ont pas de place dans un
// programme d'un jour). Un prestataire y participe par son poste, sinon par son nom.
async function loadProgram(organizationId: string, eventId: string, event: RecetteDataset["evenements"][number]): Promise<void> {
  const day = event.date ?? event.dates?.[0];
  const sequences = (event.chrono ?? []).filter((sequence) => sequence.jour === day);
  if (sequences.length === 0) return;
  const slotOf = new Map((await listEventVendorSlots(organizationId, eventId)).map((slot) => [slot.label, slot.id]));
  const vendorOf = new Map((event.prestataires ?? []).flatMap((vendor) => (vendor.id ? [[vendor.id, vendor]] : [])));
  for (const sequence of sequences) {
    const vendor = sequence.prestataire ? vendorOf.get(sequence.prestataire) : undefined;
    const slotId = vendor ? slotOf.get(vendor.categorie) : undefined;
    await addProgramItem(organizationId, eventId, {
      startTime: sequence.heure,
      endTime: sequence.duree_min ? addMinutes(sequence.heure, sequence.duree_min) : null,
      label: sequence.titre,
      location: sequence.lieu ?? null,
      vendorSlotIds: slotId ? [slotId] : [],
      freeParticipants: vendor && !slotId ? [vendor.nom] : [],
    });
  }
}

// « HH:MM » plus une durée ; après minuit, le programme lit une heure de fin plus petite.
export function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number) as [number, number];
  const total = (hours * 60 + mins + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
