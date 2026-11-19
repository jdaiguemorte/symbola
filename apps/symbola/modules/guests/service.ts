// Porte d'entrée publique du module guests (lot 49, ADR 0011 et 0083) — seul fichier que les autres
// modules, lib/ et les écrans peuvent importer. Pensé comme le futur contrat HTTP /v1/guests si le
// module est extrait. Le module est fermé par défaut (ADR 0079) ; sans l'analyse d'impact confirmée,
// aucune saisie (partie G). Les régimes nominatifs ne sortent que vers la titulaire (D8).
export {
  addDietaryOption,
  assertGuestsReady,
  confirmImpactAssessment,
  getDietTallies,
  getGuestEventSettings,
  getGuestEventSummary,
  getGuestModuleState,
  getGuestPrivacyNotice,
  guestPrivacyNoticeTemplate,
  GuestEventNotFoundError,
  GuestSettingsInvalidError,
  GuestsNotReadyError,
  HouseholdInvalidError,
  HouseholdNotFoundError,
  listDietaryOptions,
  listHouseholdGroups,
  listHouseholds,
  recordHouseholdAnswers,
  removeEventGuestRows as removeEventGuestsData,
  removeHousehold,
  saveGuestEventSettings,
  saveHousehold,
  setDietaryOptionHidden,
  updateGuestPrivacyNotice,
} from "./households";
export {
  GuestLinkUnavailableError,
  GuestNotFoundError,
  InvitationsNotReadyError,
  issueGuestLink,
  listInvitationRecipients,
  listManualFollowUps,
  revokeGuestLinks,
  sendGuestInvitations,
  sendGuestReminders,
  type InvitationWords,
} from "./links";
export { answerRsvp, openRsvp, opposeAsGuest, type OpenRsvpResult } from "./rsvp-page";
export { getGuestPurgeSchedule, listGuestPurgeNotices, listRecentOppositions, postponeGuestPurge, PostponementInvalidError, runGuestPurge, type GuestPurgePass } from "./purge";
export { GuestImportNotFoundError, importGuests, listGuestImports, undoGuestImport } from "./import";
export { guestsPrivacy } from "./privacy";
export { describeGuestsExport, exportGuestsData, GUESTS_EXPORT_EXCLUSIONS, eraseGuestsData, importGuestsData, registerGuestsImportIds } from "./export";
// Lot 50 (INV-05, INV-06 ; ADR 0086) : plan de table, types de repas, synthèse pour le traiteur.
export {
  addSeatingConstraint,
  addSeatingTables,
  copySeatingPlan,
  createSeatingPlan,
  dismissSeatRelease,
  downloadCatererSummary,
  getSeatingPlan,
  listSeatingMoments,
  removeSeatingConstraint,
  removeSeatingPlan,
  removeSeatingTable,
  seatGuest,
  seatHousehold,
  setVendorMealCount,
  updateSeatingTable,
  type CatererSummaryRequest,
} from "./seating";
export { addMealType, listMealTypes, renameMealType, setGuestMealType, setMealTypeHidden } from "./meal-types";
export { SeatingInvalidError, SeatingNotFoundError, type SeatingProblem } from "./seating-errors";
export { buildCatererSummary, catererCsvTable, type CatererCsvLabels } from "./caterer-summary";
export { renderCatererSummary, type CatererSummaryFile } from "./caterer-summary-render";
