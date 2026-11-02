export type { PersonTerms, PrivacyContractV1, PrivacyRecord, PrivacySearch } from "./contract";
export { hasTerms, matchesTerms, normalizeText, phoneDigits, prepareTerms, recordMatches, type PreparedTerms } from "./match";
export { checkMigrationAgainstRegistry, type RegistryViolation } from "./check-migrations";
export { extractColumns, type ColumnReference } from "./migration-scanner";
export { findRegistryEntry, loadRegistry, parseRegistry } from "./registry";
export { registryEntrySchema, registrySchema, type Registry, type RegistryEntry } from "./registry-schema";
export { isSuspiciousPersonalField } from "./suspicious-fields";
