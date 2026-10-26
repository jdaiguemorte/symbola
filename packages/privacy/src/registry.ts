import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { registrySchema, type Registry, type RegistryEntry } from "./registry-schema";

export type { Registry, RegistryEntry };

export function parseRegistry(yamlSource: string): Registry {
  const raw = parseYaml(yamlSource);
  return registrySchema.parse(raw);
}

export function loadRegistry(path: string): Registry {
  return parseRegistry(readFileSync(path, "utf8"));
}

export function findRegistryEntry(
  registry: Registry,
  column: { schema: string; table: string; field: string },
): RegistryEntry | undefined {
  return registry.fields.find(
    (entry) =>
      entry.schema === column.schema && entry.table === column.table && entry.field === column.field,
  );
}
