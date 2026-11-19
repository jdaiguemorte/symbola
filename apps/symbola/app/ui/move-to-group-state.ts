// Socle des lots 44 et 50 (D0 ; UX-14, NFR-17) — logique du déplacement d'un élément vers un groupe
// (une carte vers une étape du pipeline, un invité vers une table), sans React : l'affectation
// locale, sa signature pour reconnaître des données nouvelles du serveur, et une file qui
// enregistre les déplacements l'un après l'autre (modèle de sortable-budget-lines.tsx, lot 13).

export type MovableItem = { id: string; label: string; groupId: string | null };
export type MoveTarget = { id: string; label: string };

// Groupe de chaque élément ; null = hors de tout groupe (« Non placés »).
export type Assignment = Readonly<Record<string, string | null>>;

export function toAssignment(items: readonly MovableItem[]): Assignment {
  return Object.fromEntries(items.map((item) => [item.id, item.groupId]));
}

// Les données du serveur font foi : un élément ajouté, renommé, retiré ou déplacé ailleurs change
// la signature, et l'affectation locale est remplacée (comparaison du contenu, pas de la référence).
export function assignmentSignature(items: readonly MovableItem[]): string {
  return items.map((item) => `${item.id}:${item.groupId ?? ""}:${item.label}`).join("|");
}

// Un élément inconnu, ou déjà dans le groupe demandé, ne change rien (même objet rendu).
export function moveAssignment(assignment: Assignment, itemId: string, groupId: string): Assignment {
  if (!(itemId in assignment) || assignment[itemId] === groupId) return assignment;
  return { ...assignment, [itemId]: groupId };
}

export function itemsInGroup<T extends MovableItem>(items: readonly T[], assignment: Assignment, groupId: string | null): T[] {
  return items.filter((item) => (assignment[item.id] ?? null) === groupId);
}

// Enregistrements à la suite les uns des autres : deux déplacements rapides ne se doublent jamais,
// et le dernier demandé est le dernier enregistré. Une tâche en échec n'arrête pas les suivantes.
export type SerialQueue = {
  run<T>(task: () => Promise<T>): Promise<T>;
  readonly pending: number;
};

export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      pending += 1;
      const result = tail.then(task);
      tail = result
        .catch(() => undefined)
        .finally(() => {
          pending -= 1;
        });
      return result;
    },
    get pending() {
      return pending;
    },
  };
}
