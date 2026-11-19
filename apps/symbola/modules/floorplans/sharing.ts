// Lot 60 (L60-PLA-05 ; partie D, D8, POR-10) — le plan de l'évènement vu par un lien : la dernière
// version diffusée de chaque plan, sans note interne. Un prestataire retenu y voit son emplacement en
// évidence, sa prise et ses besoins ; les autres prestataires sont désignés par leur type, et par leur
// nom seulement si la planner l'a coché. Le client lit la même version, par la rubrique « Plan de
// salle » (fermée par défaut). L'évènement est toujours celui du lien, jamais un identifiant reçu.
import { and, desc, eq, inArray } from "drizzle-orm";
import { layoutVersions, layouts, linkViews } from "@symbola/db/schema/floorplans";
import type { FileDownload, LinkAudience, SharedFloorplan } from "@symbola/contracts";
import { FloorplanNotFoundError } from "./errors";
import { powerTable } from "./geometry";
import { retainedCandidates, type StoredSnapshot } from "./layouts";
import { inOrganization, UUID } from "./repository";
import { readBackground } from "./spaces";

export type FloorplanLinkAccess = { organizationId: string; eventId: string; linkId: string; audience: LinkAudience; vendorCandidateId: string | null };

type Published = { layoutId: string; version: number; publishedAt: Date; snapshot: StoredSnapshot };

async function latestVersions(organizationId: string, eventId: string): Promise<Published[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select().from(layouts).where(eq(layouts.eventId, eventId)).orderBy(layouts.createdAt);
    const published = rows.filter((row) => row.publishedVersion > 0);
    if (published.length === 0) return [];
    const versions = await tx.select().from(layoutVersions).where(inArray(layoutVersions.layoutId, published.map((row) => row.id))).orderBy(desc(layoutVersions.version));
    return published.flatMap((row) => {
      const latest = versions.find((version) => version.layoutId === row.id && version.version === row.publishedVersion);
      return latest ? [{ layoutId: row.id, version: latest.version, publishedAt: latest.publishedAt, snapshot: latest.snapshot as StoredSnapshot }] : [];
    });
  });
}

// Qui peut lire le plan par son lien : un prestataire retenu, ou un client à qui la rubrique est
// ouverte (l'appelant a vérifié la rubrique et les modules).
async function vendorAllowed(access: FloorplanLinkAccess, retained: { id: string }[]): Promise<boolean> {
  return access.audience === "vendor" && access.vendorCandidateId !== null && retained.some((candidate) => candidate.id === access.vendorCandidateId);
}

export async function floorplansForLink(access: FloorplanLinkAccess, options: { markSeen: boolean } = { markSeen: true }): Promise<SharedFloorplan[]> {
  if (access.audience !== "vendor" && access.audience !== "client") return [];
  const retained = await retainedCandidates(access.organizationId, access.eventId);
  if (access.audience === "vendor" && !(await vendorAllowed(access, retained))) return [];
  const published = await latestVersions(access.organizationId, access.eventId);
  if (published.length === 0) return [];
  const nameOf = new Map(retained.map((candidate) => [candidate.id, candidate.vendorName]));
  const seen = await inOrganization(access.organizationId, (tx) =>
    tx.select().from(linkViews).where(and(eq(linkViews.linkId, access.linkId), inArray(linkViews.layoutId, published.map((entry) => entry.layoutId)))),
  );
  const views = published.map(({ layoutId, version, publishedAt, snapshot }): SharedFloorplan => {
    const elements = snapshot.elements.map(({ vendorCandidateId, ...element }) => {
      const mine = access.audience === "vendor" && vendorCandidateId !== null && vendorCandidateId === access.vendorCandidateId;
      const vendorName = vendorCandidateId && (mine || snapshot.showVendorNames) ? (nameOf.get(vendorCandidateId) ?? null) : null;
      return { ...element, vendorName, mine };
    });
    return {
      layoutId,
      version,
      publishedAt: publishedAt.toISOString(),
      isNew: (seen.find((row) => row.layoutId === layoutId)?.seenVersion ?? 0) < version,
      layoutName: snapshot.layoutName,
      space: snapshot.space,
      fixtures: snapshot.fixtures,
      elements,
      power: powerTable(snapshot.fixtures, snapshot.elements),
    };
  });
  if (options.markSeen) {
    await inOrganization(access.organizationId, async (tx) => {
      for (const view of views) {
        await tx
          .insert(linkViews)
          .values({ organizationId: access.organizationId, linkId: access.linkId, layoutId: view.layoutId, seenVersion: view.version })
          .onConflictDoUpdate({ target: [linkViews.linkId, linkViews.layoutId], set: { seenVersion: view.version, updatedAt: new Date() } });
      }
    });
  }
  return views;
}

// Fond de plan de la version diffusée d'un plan de l'évènement du lien.
export async function sharedFloorplanBackground(access: FloorplanLinkAccess, layoutId: string): Promise<FileDownload> {
  if (!UUID.test(layoutId)) throw new FloorplanNotFoundError();
  const views = await floorplansForLink(access, { markSeen: false });
  if (!views.some((view) => view.layoutId === layoutId)) throw new FloorplanNotFoundError();
  const entry = (await latestVersions(access.organizationId, access.eventId)).find((version) => version.layoutId === layoutId);
  if (!entry?.snapshot.backgroundKey || !entry.snapshot.backgroundMime) throw new FloorplanNotFoundError();
  return readBackground(entry.snapshot.backgroundKey, entry.snapshot.backgroundMime);
}

// Nombre de plans diffusés non encore vus par le lien (pour signaler une nouvelle version).
export async function unseenFloorplanVersions(access: FloorplanLinkAccess): Promise<number> {
  return (await floorplansForLink(access, { markSeen: false })).filter((view) => view.isNew).length;
}
