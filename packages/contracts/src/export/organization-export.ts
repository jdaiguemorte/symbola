// Lot 35a (HUB-13, DAT-13, ADR 0068) — contrat interne export/v1 : chaque module livre, par son
// service.ts, toutes les données d'une organisation (ses entités, ligne à ligne, et les fichiers
// qu'elles portent) ; l'app les range dans une archive ZIP au format symbola.export/v1, décrit
// par son manifeste. Le format est stable : un champ facultatif ajouté garde la v1, tout autre
// changement crée une v2 (docs/export/format-v1.md).
import { z } from "zod";

export const ORGANIZATION_EXPORT_FORMAT = "symbola.export/v1";

// Dans l'ordre de l'archive : le hub d'abord (l'organisation, ses réglages), puis les modules
// dans l'ordre de leurs dépendances (la reprise du lot 35b les écrit dans cet ordre).
// Lot 49 : « guests », le module Invités (foyers, personnes, réponses ; jamais les régimes).
// Lot 46 : « appointments », le module Rendez-vous.
export const ORGANIZATION_EXPORT_MODULES = ["hub", "events", "budget", "quotes", "vendors", "guests", "appointments"] as const;
export type OrganizationExportModule = (typeof ORGANIZATION_EXPORT_MODULES)[number];

// Valeurs d'une ligne : celles de JSON. Montants en centimes entiers, dates en AAAA-MM-JJ,
// instants en ISO 8601 UTC, heures en HH:MM:SS.
export type ExportValue = string | number | boolean | null | ExportValue[] | { [key: string]: ExportValue };
export type ExportRow = { [field: string]: ExportValue };

// Fichier porté par une ligne : la ligne garde son chemin dans l'archive, à la place de la clé
// du stockage, que seul l'orchestrateur lit (et qui ne figure pas dans l'archive).
export type ExportFileRef = {
  // fichiers/<module>/<entité>/<identifiant de la ligne>-<champ>.<extension>
  path: string;
  storageKey: string;
  // <module>/<entité>
  entity: string;
  rowId: string;
  field: string;
};

export type ModuleExportEntity = { name: string; rows: ExportRow[] };

export type ModuleExport = {
  module: OrganizationExportModule;
  entities: ModuleExportEntity[];
  files: ExportFileRef[];
};

// Ce que l'orchestrateur transmet à chaque module : les événements d'essai (is_demo), dont
// aucune donnée n'est exportée, quel que soit le module qui la porte (CLAUDE.md § 2.9).
export type ModuleExportContext = { excludedEventIds: ReadonlySet<string> };

// Schéma d'une entité, publié dans docs/schemas/export/v1/<module>/<entité>.schema.json.
export type ExportEntitySchema = { module: OrganizationExportModule; name: string; schema: z.ZodObject };

const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const entityName = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const exportManifestSchema = z.object({
  format: z.literal(ORGANIZATION_EXPORT_FORMAT),
  generatedAt: z.iso.datetime(),
  organization: z.object({ id: z.guid(), name: z.string() }),
  entities: z.array(
    z.object({
      module: z.enum(ORGANIZATION_EXPORT_MODULES),
      name: entityName,
      rows: z.number().int().nonnegative(),
      json: z.string(),
      csv: z.string(),
      schema: z.string(),
    }),
  ),
  files: z.array(
    z.object({
      path: z.string(),
      entity: z.string(),
      rowId: z.string(),
      field: z.string(),
      bytes: z.number().int().nonnegative(),
      sha256,
    }),
  ),
  // Fichier référencé par une ligne mais absent du stockage : signalé, jamais inventé.
  missingFiles: z.array(z.object({ path: z.string(), entity: z.string(), rowId: z.string(), field: z.string() })),
  // Empreinte de chaque autre entrée de l'archive (JSON, CSV, schémas, LISEZMOI).
  checksums: z.record(z.string(), sha256),
});

export type ExportManifest = z.infer<typeof exportManifestSchema>;
