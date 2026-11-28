// Lot 74g — les modules et le rôle qui décident des rubriques des Paramètres et des lignes de « Vos
// données », lus sur le serveur (accueil des Paramètres, « Vos données », coquille de l'app).
import { appDatabase } from "@symbola/db/client";
import { isFeatureEnabled, isModuleEnabled, listDueSoonPrivacyRequests } from "@/modules/hub/service";
import type { SettingsMenuFlags } from "./settings-menu";

export async function loadSettingsFlags(organizationId: string, role: string): Promise<SettingsMenuFlags> {
  const db = appDatabase();
  const [events, budget, quotes, vendors, guests, appointments, selfService] = await Promise.all([
    isModuleEnabled(db, organizationId, "events"),
    isModuleEnabled(db, organizationId, "budget"),
    isModuleEnabled(db, organizationId, "quotes"),
    isModuleEnabled(db, organizationId, "vendors"),
    isModuleEnabled(db, organizationId, "guests"),
    isModuleEnabled(db, organizationId, "appointments"),
    isFeatureEnabled(db, organizationId, "subscription_self_service"),
  ]);
  return { events, budget, quotes, vendors, guests, appointments, isOwner: role === "owner", selfService };
}

// Lot 18 (RGPD-07, D) : les demandes en alerte, que la titulaire seule traite ; le repère est sur « Vos
// données » (74g).
export async function loadPrivacyAlerts(organizationId: string, isOwner: boolean): Promise<number> {
  return isOwner ? (await listDueSoonPrivacyRequests(appDatabase(), organizationId)).length : 0;
}
