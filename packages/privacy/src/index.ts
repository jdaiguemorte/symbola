export type { PersonQuery, PrivacyContractV1, PrivacyFindResult } from "./contract";
export { checkMigrationAgainstRegistry, type RegistryViolation } from "./check-migrations";
export { extractColumns, type ColumnReference } from "./migration-scanner";
export { findRegistryEntry, loadRegistry, parseRegistry } from "./registry";
export { registryEntrySchema, registrySchema, type Registry, type RegistryEntry } from "./registry-schema";
export { isSuspiciousPersonalField } from "./suspicious-fields";
