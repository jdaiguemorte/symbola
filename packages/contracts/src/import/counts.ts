// Lot 71d (HUB-14, BUD-01, UX-07 ; spécification du lot 71, § 4.4 et § 5.4 ; maquette 08, C-58) — une
// seule fonction de compte. « Vérifier » l'appelle sur ce que l'import va écrire, le bilan redit le
// résultat gardé au journal, la page de reprise redit le bilan : un même nombre, compté de la même
// façon, à chaque écran. Montants en centimes entiers ; un réel vide est « non renseigné », jamais 0 €
// (C-55). « engagé » ne s'affiche plus (§ 0) : le réel est « réel selon votre fichier ».

// Une échéance que l'import crée sur une ligne : l'acompte, le solde ; payée ou due.
export type ImportFigurePayment = { amountCents: number; dueOn: string; paid: boolean };

export type ImportFigureBudgetLine = {
  // Le poste qui reçoit la ligne : un poste du mariage (son identifiant) ou un poste créé (sa clé).
  slotKey: string;
  newSlot: boolean;
  plannedCents: number | null;
  realCents: number | null;
  // Réglé écrit sur la ligne sans échéance datée (le fichier n'a pas de date d'acompte).
  paidCents: number | null;
  payments: ImportFigurePayment[];
  // Le prestataire nommé par la ligne (une clé, son nom replié), et s'il est (ou sera) au carnet.
  vendorKey: string | null;
  vendorInCarnet: boolean;
};

export type BudgetImportFigures = {
  kind: "budget";
  lines: number;
  slots: number;
  newSlots: number;
  plannedCents: number;
  realCents: number;
  // Lignes sans réel : « non renseigné ».
  realMissing: number;
  paidCents: number;
  // Acomptes réglés (une échéance payée, ou un réglé sans échéance).
  paidCount: number;
  toPayCents: number;
  // Soldes à payer, et la première et la dernière de leurs dates (null : aucune date).
  toPayCount: number;
  toPayFrom: string | null;
  toPayTo: string | null;
  // Échéances dues avant aujourd'hui (une échéance due aujourd'hui n'est pas en retard).
  overdue: number;
  vendors: number;
  vendorsOutsideCarnet: number;
};

// Les sortes de fichier qui n'ont pas de nombres propres comptent leurs lignes.
export type RowsImportFigures = { kind: "rows"; rows: number };

// Lot 71e (HUB-14, PRE-01, PRE-02 ; maquette 10) — un prestataire retenu que l'import écrit : son poste
// (un poste du mariage, ou un poste créé, par sa clé), sa fiche du carnet (trouvée ou créée) et son
// contrat, tel que la planner l'a dit (I1) ; « unknown » : non renseigné.
export type ImportFigureRetainedVendor = { slotKey: string; newSlot: boolean; vendorKey: string; inCarnet: boolean; contract: "signed" | "unsigned" | "unknown" };

export type EventVendorsImportFigures = {
  kind: "event_vendors";
  vendors: number;
  // Trouvés dans le carnet + fiches créées = prestataires retenus.
  foundInCarnet: number;
  createdFiches: number;
  // Signés + non signés + non renseignés = prestataires retenus.
  signed: number;
  unsigned: number;
  unknownContracts: number;
  newSlots: number;
};

// Lot 71e (CHR-06, CHR-08 ; maquette 11, D5) — un moment du programme que l'import écrit : sa journée
// (date), sa forme (« span » : un début et une fin, la fin pouvant manquer ; « point » : ponctuel ;
// « marker » : repère), une fin que le fichier ne donne pas, et s'il est caché des mariés.
export type ImportFigureProgramItem = { day: string | null; timing: "span" | "point" | "marker"; endMissing: boolean; hiddenFromClients: boolean };

export type ProgramImportFigures = {
  kind: "program";
  days: number;
  moments: number;
  markers: number;
  // Fins non renseignées : les moments à durée sans heure de fin (jamais déduite).
  endsMissing: number;
  hiddenFromClients: number;
  // L'annuaire non repris : le nombre d'intervenants (noms et téléphones, gardés à part, I4).
  directory: number;
};

export type ImportFigures = BudgetImportFigures | RowsImportFigures | EventVendorsImportFigures | ProgramImportFigures;

export type ImportFiguresPlan =
  | { kind: "budget"; lines: readonly ImportFigureBudgetLine[] }
  | { kind: "rows"; rows: number }
  | { kind: "event_vendors"; vendors: readonly ImportFigureRetainedVendor[] }
  | { kind: "program"; items: readonly ImportFigureProgramItem[]; directory: number };

function cents(value: number | null): number {
  if (value === null) return 0;
  if (!Number.isSafeInteger(value)) throw new Error("montant hors centimes entiers");
  return value;
}

export function budgetImportFigures(lines: readonly ImportFigureBudgetLine[], today: string): BudgetImportFigures {
  const slots = new Set<string>();
  const newSlots = new Set<string>();
  const vendors = new Map<string, boolean>();
  let plannedCents = 0;
  let realCents = 0;
  let realMissing = 0;
  let paidCents = 0;
  let paidCount = 0;
  let toPayCents = 0;
  let toPayCount = 0;
  let overdue = 0;
  const dueDates: string[] = [];
  for (const entry of lines) {
    slots.add(entry.slotKey);
    if (entry.newSlot) newSlots.add(entry.slotKey);
    plannedCents += cents(entry.plannedCents);
    if (entry.realCents === null) realMissing += 1;
    else realCents += cents(entry.realCents);
    if (entry.vendorKey !== null) vendors.set(entry.vendorKey, (vendors.get(entry.vendorKey) ?? false) || entry.vendorInCarnet);
    if (entry.payments.length > 0) {
      for (const payment of entry.payments) {
        const amount = cents(payment.amountCents);
        if (payment.paid) {
          paidCents += amount;
          paidCount += 1;
          continue;
        }
        toPayCents += amount;
        toPayCount += 1;
        dueDates.push(payment.dueOn);
        if (payment.dueOn < today) overdue += 1;
      }
      continue;
    }
    const paid = cents(entry.paidCents);
    if (paid > 0) {
      paidCents += paid;
      paidCount += 1;
    }
    if (entry.realCents !== null && entry.realCents > paid) {
      toPayCents += entry.realCents - paid;
      toPayCount += 1;
    }
  }
  dueDates.sort();
  return {
    kind: "budget",
    lines: lines.length,
    slots: slots.size,
    newSlots: newSlots.size,
    plannedCents,
    realCents,
    realMissing,
    paidCents,
    paidCount,
    toPayCents,
    toPayCount,
    toPayFrom: dueDates[0] ?? null,
    toPayTo: dueDates.at(-1) ?? null,
    overdue,
    vendors: vendors.size,
    vendorsOutsideCarnet: [...vendors.values()].filter((inCarnet) => !inCarnet).length,
  };
}

export function eventVendorsImportFigures(vendors: readonly ImportFigureRetainedVendor[]): EventVendorsImportFigures {
  const newSlots = new Set(vendors.filter((vendor) => vendor.newSlot).map((vendor) => vendor.slotKey));
  return {
    kind: "event_vendors",
    vendors: vendors.length,
    foundInCarnet: vendors.filter((vendor) => vendor.inCarnet).length,
    createdFiches: vendors.filter((vendor) => !vendor.inCarnet).length,
    signed: vendors.filter((vendor) => vendor.contract === "signed").length,
    unsigned: vendors.filter((vendor) => vendor.contract === "unsigned").length,
    unknownContracts: vendors.filter((vendor) => vendor.contract === "unknown").length,
    newSlots: newSlots.size,
  };
}

export function programImportFigures(items: readonly ImportFigureProgramItem[], directory: number): ProgramImportFigures {
  return {
    kind: "program",
    days: new Set(items.map((item) => item.day ?? "")).size,
    moments: items.length,
    markers: items.filter((item) => item.timing === "marker").length,
    endsMissing: items.filter((item) => item.timing === "span" && item.endMissing).length,
    hiddenFromClients: items.filter((item) => item.hiddenFromClients).length,
    directory,
  };
}

// `today` : la date du jour à Paris (AAAA-MM-JJ), pour les échéances en retard.
export function importFigures(plan: ImportFiguresPlan, today: string): ImportFigures {
  if (plan.kind === "rows") return { kind: "rows", rows: plan.rows };
  if (plan.kind === "event_vendors") return eventVendorsImportFigures(plan.vendors);
  if (plan.kind === "program") return programImportFigures(plan.items, plan.directory);
  return budgetImportFigures(plan.lines, today);
}
