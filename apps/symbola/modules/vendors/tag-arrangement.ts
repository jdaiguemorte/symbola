// Lot 21 (L21-PRE-18, L21-PRE-19, ADR 0050) — plans de rangement des étiquettes,
// en fonctions pures (le service les applique en une transaction) :
// - étiquettes de départ : créer ce qui manque ; une étiquette existante du
//   même libellé (sans casse ni accents, en français ou en anglais) prend le
//   groupe et les familles du modèle, sans doublon ;
// - étiquettes importées (ni groupe ni famille) : celle qui correspond à une
//   étiquette de départ en prend le groupe et les familles ; les tranches
//   (« 50 à 100 personnes ») rejoignent le palier de leur unité ; les autres
//   prennent les familles des prestataires qui les portent.
// Une fiche qui portait plusieurs tranches d'un même palier garde la plus
// haute ; elle est signalée dans le récapitulatif.
import { parseTier, proposeTierGroups, tierUnitKey } from "./tag-tiers";

export type PlanTag = { id: string; label: string; groupId: string | null; familyIds: string[]; position: number };
export type PlanGroup = { id: string; label: string; exclusive: boolean; position: number };
export type PlanVendor = { id: string; name: string; familyId: string | null; tagIds: string[] };
// familyIds nul : la famille visée n'existe plus dans l'organisation (étiquette ignorée).
export type PlanCatalogGroup = { label: string; exclusive: boolean; tags: { label: string; aliases: string[]; familyIds: string[] | null }[] };

export type GroupRef = { id: string } | { key: string };

export type TagPlan = {
  newGroups: { key: string; label: string; exclusive: boolean; position: number }[];
  tagUpdates: { id: string; group: GroupRef | null; familyIds: string[]; position: number }[];
  newTags: { label: string; group: GroupRef; familyIds: string[]; position: number }[];
  vendorUpdates: { id: string; tagIds: string[] }[];
};

export type ArrangementRecap = {
  looseTags: number;
  familiesSet: number;
  catalogMatched: number;
  tiers: { label: string; count: number }[];
  adjustedVendors: { id: string; name: string }[];
  remaining: number;
};

export function foldTagLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("fr") + value.slice(1);
}

const refKey = (ref: GroupRef): string => ("id" in ref ? `id:${ref.id}` : `new:${ref.key}`);

// Les groupes de l'organisation, par libellé ; un groupe manquant est créé
// (une seule fois) à la suite des autres.
function groupRegistry(groups: PlanGroup[]) {
  const byLabel = new Map(groups.map((group) => [foldTagLabel(group.label), { ref: { id: group.id } as GroupRef, label: group.label, exclusive: group.exclusive }]));
  const created: TagPlan["newGroups"] = [];
  let next = Math.max(-1, ...groups.map((group) => group.position)) + 1;
  return {
    created,
    ref(label: string, exclusive: boolean): { ref: GroupRef; label: string; exclusive: boolean } {
      const key = foldTagLabel(label);
      const known = byLabel.get(key);
      if (known) return known;
      const entry = { ref: { key } as GroupRef, label, exclusive };
      created.push({ key, label, exclusive, position: next++ });
      byLabel.set(key, entry);
      return entry;
    },
    exclusive(ref: GroupRef): boolean {
      for (const entry of byLabel.values()) if (refKey(entry.ref) === refKey(ref)) return entry.exclusive;
      return false;
    },
  };
}

type Registry = ReturnType<typeof groupRegistry>;

// Ordre des paliers : du plus petit au plus grand ; ce qui n'est pas une
// tranche chiffrée (« Pas de couchage ») vient d'abord, dans l'ordre reçu.
function tierOrder(label: string): number {
  return parseTier(label)?.floor ?? Number.NEGATIVE_INFINITY;
}

// Après les changements prévus : places des paliers recalculées, et une seule
// tranche par palier sur chaque fiche (la plus haute).
function finalize(plan: TagPlan, tags: PlanTag[], registry: Registry, vendors: PlanVendor[]): { id: string; name: string }[] {
  const updates = new Map(plan.tagUpdates.map((update) => [update.id, update]));
  type Member = { id: string | null; label: string; group: GroupRef | null; familyIds: string[]; position: number; newIndex?: number };
  const members: Member[] = [
    ...tags.map((tag) => {
      const update = updates.get(tag.id);
      return { id: tag.id, label: tag.label, group: update ? update.group : tag.groupId ? { id: tag.groupId } : null, familyIds: update ? update.familyIds : tag.familyIds, position: update ? update.position : tag.position };
    }),
    ...plan.newTags.map((tag, newIndex) => ({ id: null, label: tag.label, group: tag.group, familyIds: tag.familyIds, position: tag.position, newIndex })),
  ];
  const finalPosition = new Map<string, number>();
  const exclusiveOf = new Map<string, string>();
  const byGroup = new Map<string, Member[]>();
  for (const member of members) {
    if (!member.group || !registry.exclusive(member.group)) continue;
    const key = refKey(member.group);
    byGroup.set(key, [...(byGroup.get(key) ?? []), member]);
  }
  for (const [key, list] of byGroup) {
    const ordered = [...list].sort((a, b) => tierOrder(a.label) - tierOrder(b.label) || a.position - b.position);
    ordered.forEach((member, position) => {
      if (member.newIndex !== undefined) {
        plan.newTags[member.newIndex]!.position = position;
        return;
      }
      const id = member.id!;
      finalPosition.set(id, position);
      exclusiveOf.set(id, key);
      if (member.position === position) return;
      const existing = updates.get(id);
      if (existing) existing.position = position;
      else {
        const update = { id, group: member.group, familyIds: member.familyIds, position };
        plan.tagUpdates.push(update);
        updates.set(id, update);
      }
    });
  }

  const adjusted: { id: string; name: string }[] = [];
  for (const vendor of vendors) {
    const keep = new Map<string, string>();
    for (const tagId of vendor.tagIds) {
      const group = exclusiveOf.get(tagId);
      if (!group) continue;
      const current = keep.get(group);
      if (!current || finalPosition.get(tagId)! > finalPosition.get(current)!) keep.set(group, tagId);
    }
    const tagIds = vendor.tagIds.filter((tagId) => {
      const group = exclusiveOf.get(tagId);
      return !group || keep.get(group) === tagId;
    });
    if (tagIds.length !== vendor.tagIds.length) {
      plan.vendorUpdates.push({ id: vendor.id, tagIds });
      adjusted.push({ id: vendor.id, name: vendor.name });
    }
  }
  return adjusted;
}

// L21-PRE-18 — étiquettes de départ.
export function planStarterTags(input: { tags: PlanTag[]; groups: PlanGroup[]; vendors: PlanVendor[]; catalog: PlanCatalogGroup[] }): {
  plan: TagPlan;
  created: number;
  placed: number;
  adjustedVendors: { id: string; name: string }[];
} {
  const registry = groupRegistry(input.groups);
  const plan: TagPlan = { newGroups: registry.created, tagUpdates: [], newTags: [], vendorUpdates: [] };
  const byLabel = new Map(input.tags.map((tag) => [foldTagLabel(tag.label), tag]));
  const used = new Set<string>();
  let created = 0;
  let placed = 0;
  for (const group of input.catalog) {
    group.tags.forEach((tag, index) => {
      if (tag.familyIds === null) return;
      const existing = tag.aliases.map((alias) => byLabel.get(foldTagLabel(alias))).find((candidate) => candidate && !used.has(candidate.id));
      if (existing) {
        used.add(existing.id);
        const needsGroup = existing.groupId === null;
        const needsFamilies = existing.familyIds.length === 0 && tag.familyIds!.length > 0;
        if (!needsGroup && !needsFamilies) return;
        plan.tagUpdates.push({
          id: existing.id,
          group: needsGroup ? registry.ref(group.label, group.exclusive).ref : { id: existing.groupId! },
          familyIds: needsFamilies ? tag.familyIds! : existing.familyIds,
          position: needsGroup ? index : existing.position,
        });
        placed += 1;
        return;
      }
      plan.newTags.push({ label: tag.label, group: registry.ref(group.label, group.exclusive).ref, familyIds: tag.familyIds!, position: index });
      created += 1;
    });
  }
  const adjustedVendors = finalize(plan, input.tags, registry, input.vendors);
  return { plan, created, placed, adjustedVendors };
}

// L21-PRE-19 — rangement des étiquettes sans groupe ni famille (reprises de
// l'import) ; scope : seulement ces étiquettes (celles d'un import).
export function planTagArrangement(input: {
  tags: PlanTag[];
  groups: PlanGroup[];
  vendors: PlanVendor[];
  catalog: PlanCatalogGroup[];
  scope?: Set<string>;
}): { plan: TagPlan; recap: ArrangementRecap } {
  const registry = groupRegistry(input.groups);
  const plan: TagPlan = { newGroups: registry.created, tagUpdates: [], newTags: [], vendorUpdates: [] };
  const loose = input.tags.filter((tag) => tag.groupId === null && tag.familyIds.length === 0 && (!input.scope || input.scope.has(tag.id)));

  // Étiquettes de départ reconnues par leur libellé.
  const catalogByLabel = new Map<string, { group: PlanCatalogGroup; index: number; familyIds: string[] }>();
  for (const group of input.catalog) {
    group.tags.forEach((tag, index) => {
      if (tag.familyIds === null) return;
      for (const alias of tag.aliases) catalogByLabel.set(foldTagLabel(alias), { group, index, familyIds: tag.familyIds });
    });
  }
  // Paliers connus par leur unité : ceux des étiquettes de départ et les
  // groupes « palier » de l'organisation.
  const tierGroupByUnit = new Map<string, { label: string; familyIds: string[] }>();
  for (const group of input.catalog.filter((candidate) => candidate.exclusive)) {
    const familyIds = [...new Set(group.tags.flatMap((tag) => tag.familyIds ?? []))];
    for (const tag of group.tags) {
      for (const alias of tag.aliases) {
        const tier = parseTier(alias);
        if (tier && !tierGroupByUnit.has(tierUnitKey(tier.unit))) tierGroupByUnit.set(tierUnitKey(tier.unit), { label: group.label, familyIds });
      }
    }
  }
  for (const group of input.groups.filter((candidate) => candidate.exclusive)) {
    for (const tag of input.tags.filter((candidate) => candidate.groupId === group.id)) {
      const tier = parseTier(tag.label);
      if (tier && !tierGroupByUnit.has(tierUnitKey(tier.unit))) tierGroupByUnit.set(tierUnitKey(tier.unit), { label: group.label, familyIds: [] });
    }
  }

  // Familles des prestataires qui portent chaque étiquette.
  const familiesOf = new Map<string, Set<string>>();
  for (const vendor of input.vendors) {
    if (!vendor.familyId) continue;
    for (const tagId of vendor.tagIds) familiesOf.set(tagId, (familiesOf.get(tagId) ?? new Set()).add(vendor.familyId));
  }
  const deduced = (tagId: string): string[] => [...(familiesOf.get(tagId) ?? [])].sort();

  let catalogMatched = 0;
  let familiesSet = 0;
  const tierCounts = new Map<string, number>();
  const rest: PlanTag[] = [];
  for (const tag of loose) {
    const match = catalogByLabel.get(foldTagLabel(tag.label));
    if (!match) {
      rest.push(tag);
      continue;
    }
    const group = registry.ref(match.group.label, match.group.exclusive);
    plan.tagUpdates.push({ id: tag.id, group: group.ref, familyIds: match.familyIds, position: match.index });
    catalogMatched += 1;
    if (match.group.exclusive) tierCounts.set(group.label, (tierCounts.get(group.label) ?? 0) + 1);
  }

  // Tranches : vers le palier connu de leur unité, sinon un nouveau palier
  // quand au moins deux tranches partagent l'unité.
  const tierTargets = new Map<string, { label: string; familyIds: string[] }>();
  for (const tag of rest) {
    const tier = parseTier(tag.label);
    const known = tier ? tierGroupByUnit.get(tierUnitKey(tier.unit)) : undefined;
    if (known) tierTargets.set(tag.id, known);
  }
  for (const proposal of proposeTierGroups(rest.filter((tag) => !tierTargets.has(tag.id)))) {
    for (const tag of proposal.tags) tierTargets.set(tag.id, { label: capitalize(proposal.unit), familyIds: [] });
  }

  let remaining = 0;
  for (const tag of rest) {
    const families = deduced(tag.id);
    const target = tierTargets.get(tag.id);
    if (target) {
      const group = registry.ref(target.label, true);
      plan.tagUpdates.push({ id: tag.id, group: group.ref, familyIds: families.length > 0 ? families : target.familyIds, position: tag.position });
      tierCounts.set(group.label, (tierCounts.get(group.label) ?? 0) + 1);
      if (families.length > 0) familiesSet += 1;
      continue;
    }
    if (families.length > 0) {
      plan.tagUpdates.push({ id: tag.id, group: null, familyIds: families, position: tag.position });
      familiesSet += 1;
      continue;
    }
    remaining += 1;
  }

  const adjustedVendors = finalize(plan, input.tags, registry, input.vendors);
  return {
    plan,
    recap: {
      looseTags: loose.length,
      familiesSet,
      catalogMatched,
      tiers: [...tierCounts].map(([label, count]) => ({ label, count })),
      adjustedVendors,
      remaining,
    },
  };
}
