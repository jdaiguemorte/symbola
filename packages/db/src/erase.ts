// Lot 35c (RGP-11 ; décision D8 de Julien ; ADR 0100) — effacement d'une organisation fermée, à sa
// date de suppression. Chaque module l'appelle par son service.ts pour son schéma ; la base fait le
// travail (core.erase_organization_schema) et refuse tant que l'organisation n'est pas supprimable
// (fermée, date de suppression passée à l'horloge de la base) : aucun défaut de l'app ne peut
// effacer une organisation ouverte, ni avant l'heure.
import { sql } from "drizzle-orm";
import type { OrganizationTransaction } from "./with-organization";

export const ERASABLE_SCHEMAS = ["hub", "events", "budget", "quotes", "vendors", "guests", "appointments", "core"] as const;
export type ErasableSchema = (typeof ERASABLE_SCHEMAS)[number];

// Lignes effacées.
export async function eraseOrganizationSchema(tx: OrganizationTransaction, organizationId: string, schema: ErasableSchema): Promise<number> {
  const [row] = (await tx.execute(sql`select core.erase_organization_schema(${organizationId}::uuid, ${schema}) as deleted`)) as unknown as { deleted: string | number }[];
  return Number(row?.deleted ?? 0);
}

// L'organisation, puis les comptes de son équipe qui n'ont plus d'adhésion ; renvoie leurs sujets
// chez le fournisseur d'identité.
export async function eraseOrganizationIdentity(tx: OrganizationTransaction, organizationId: string, team: readonly string[]): Promise<string[]> {
  const [row] = (await tx.execute(
    sql`select core.erase_organization_identity(${organizationId}::uuid, ${`{${team.join(",")}}`}::uuid[]) as subjects`,
  )) as unknown as { subjects: string[] | null }[];
  return row?.subjects ?? [];
}

export async function isOrganizationErasable(tx: OrganizationTransaction, organizationId: string): Promise<boolean> {
  const [row] = (await tx.execute(sql`select core.organization_erasable(${organizationId}::uuid) as erasable`)) as unknown as { erasable: boolean }[];
  return row?.erasable === true;
}
