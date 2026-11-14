// Lot 9 — deux organisations peuvent porter le même nom : les zones qui le
// reprennent dans leur nom accessible doivent rester distinctes (axe-core,
// landmark-unique). Le 2e homonyme devient « Nom (2) », etc.
export function uniqueLabels(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name} (${count})`;
  });
}
