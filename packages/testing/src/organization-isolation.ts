// Helper de test d'isolation entre organisations (SOC-05, CLAUDE.md §6) —
// réutilisable par n'importe quel module : il ne connaît ni PostgreSQL ni
// Drizzle, seulement le contrat que chaque table protégée par RLS doit
// respecter. Un module l'utilise en lui fournissant des fonctions qui
// parlent sa propre table (voir packages/db pour l'exemple du module hello).
//
// Note : une policy RLS qui bloque une écriture inter-organisation ne lève
// pas d'exception — elle affecte simplement 0 ligne (USING filtre la ligne
// avant même la mise à jour). C'est pourquoi attemptCrossOrganizationUpdate
// renvoie un nombre de lignes affectées plutôt que de lever.
import { randomUUID } from "node:crypto";
import { expect } from "vitest";

export type IsolationFixtures<Row extends { id: string }> = {
  /** Insère une ligne appartenant à l'organisation donnée et la renvoie. */
  seed: (organizationId: string) => Promise<Row>;
  /** Liste les lignes visibles quand app.organization_id = organizationId. */
  listVisible: (organizationId: string) => Promise<Row[]>;
  /**
   * Tente de modifier `targetRow` en étant positionné sur `organizationId`
   * et renvoie le nombre de lignes effectivement modifiées. Doit être 0
   * quand targetRow appartient à une autre organisation.
   */
  attemptCrossOrganizationUpdate?: (
    organizationId: string,
    targetRow: Row,
  ) => Promise<{ affectedRows: number }>;
};

/**
 * Étant donné deux organisations A et B avec des données, quand A lit,
 * liste ou modifie, alors aucune donnée de B n'est visible ou modifiable
 * (et réciproquement). Lève une assertion vitest si l'isolation est violée.
 */
export async function assertOrganizationIsolation<Row extends { id: string }>(
  fixtures: IsolationFixtures<Row>,
): Promise<void> {
  const organizationA = randomUUID();
  const organizationB = randomUUID();

  const rowA = await fixtures.seed(organizationA);
  const rowB = await fixtures.seed(organizationB);

  const visibleToA = await fixtures.listVisible(organizationA);
  const idsVisibleToA = visibleToA.map((row) => row.id);
  expect(idsVisibleToA).toContain(rowA.id);
  expect(idsVisibleToA).not.toContain(rowB.id);

  const visibleToB = await fixtures.listVisible(organizationB);
  const idsVisibleToB = visibleToB.map((row) => row.id);
  expect(idsVisibleToB).toContain(rowB.id);
  expect(idsVisibleToB).not.toContain(rowA.id);

  if (fixtures.attemptCrossOrganizationUpdate) {
    const { affectedRows } = await fixtures.attemptCrossOrganizationUpdate(organizationA, rowB);
    expect(affectedRows).toBe(0);
  }
}
