// Lot 61 (UX-13, L13-HUB-16 ; retours de recette) — le menu des Paramètres, en un seul endroit : ses groupes, ses
// rubriques et leurs adresses. Le menu latéral des réglages (settings-nav.tsx) et la règle « cet
// écran est un réglage » (settings-paths.ts) lisent tous deux cette liste : une rubrique ajoutée ici
// s'ouvre donc toujours dans les Paramètres, sans seconde liste à tenir à jour. Les libellés sont des
// clés de « SettingsMenu » (fichiers de traduction).

export type SettingsGroupIcon = "company" | "events" | "appointments" | "sales" | "data";

export type SettingsMenuFlags = {
  events: boolean;
  budget: boolean;
  quotes: boolean;
  vendors: boolean;
  guests: boolean;
  appointments: boolean;
  isOwner: boolean;
  // Lot 54 (HUB-27, ADR 0101) : « Mon abonnement », quand le libre-service est ouvert.
  selfService: boolean;
};

export type SettingsMenuItem = { href: string; label: string };
export type SettingsMenuGroup = { label: string; icon: SettingsGroupIcon; items: SettingsMenuItem[] };

function when(condition: boolean, items: SettingsMenuItem[]): SettingsMenuItem[] {
  return condition ? items : [];
}

// Seules apparaissent les rubriques des modules souscrits (ARC-06) et du rôle ; un groupe vide
// disparaît.
export function settingsMenu(flags: SettingsMenuFlags): SettingsMenuGroup[] {
  const { events, budget, quotes, vendors, guests, appointments, isOwner, selfService } = flags;
  const groups: SettingsMenuGroup[] = [
    {
      label: "groupCompany",
      icon: "company",
      items: [
        { href: "/parametres", label: "company" },
        { href: "/profil", label: "account" },
        // Lot 53 (HUB-15, UX-16) : les notifications de chacun ; HUB-28, GC-02 : automatismes et radar.
        { href: "/parametres/notifications", label: "notifications" },
        ...when(isOwner && selfService, [{ href: "/parametres/abonnement", label: "subscription" }]),
        { href: "/parametres/automatisations", label: "automations" },
        { href: "/parametres/radar", label: "riskRadar" },
        // Lot 24b (SEC-06, décision D3) : équipe, titulaire seulement.
        ...when(isOwner, [{ href: "/parametres/equipe", label: "team" }]),
        // Lot 38a (MSG-01, D3) : les e-mails envoyés au nom de l'organisation.
        ...when(events || quotes, [
          { href: "/parametres/emails", label: "emailTemplates" },
          // Lot 55 (MSG-04 révisée, MSG-05) : l'adresse d'où partent les e-mails, et leur journal.
          { href: "/parametres/adresse-envoi", label: "senderAddress" },
          { href: "/parametres/envois", label: "emailDeliveries" },
        ]),
        // Lot 38b (HUB-21, D10) : les messages types de la planner, utilisés depuis la fiche.
        ...when(events, [{ href: "/parametres/messages", label: "messageTemplates" }]),
        // Lot 39a (HUB-17, ADR 0073) : ce qui a été supprimé depuis moins de 30 jours.
        { href: "/parametres/corbeille", label: "trash" },
      ],
    },
    {
      label: "groupEvents",
      icon: "events",
      items:
        events || budget
          ? [
              ...when(events, [
                { href: "/events/parametres", label: "budgetLines" },
                { href: "/events/parametres/sources", label: "sourcesReasons" },
                { href: "/events/parametres/types", label: "eventTypes" },
                // Lot 64 (HUB-29, RDV-02) : les heures qu'un évènement prend, par type.
                { href: "/events/parametres/plages-occupees", label: "busyRanges" },
                // Lot 53 (HUB-24, D8) : le terme qui désigne les clients de chaque type.
                { href: "/events/parametres/termes", label: "clientTerms" },
                // Lot 44 (CRM-01, CRM-02) : étapes du pipeline et formulaire de contact, titulaire seulement.
                ...when(isOwner, [
                  { href: "/events/parametres/etapes", label: "pipelineStages" },
                  { href: "/events/parametres/contact", label: "contactForm" },
                ]),
                // Lot 45 (HUB-21, POR-07) : modèles de questionnaires.
                { href: "/events/parametres/questionnaires", label: "questionnaires" },
                { href: "/events/modeles", label: "retroplanning" },
                // Lot 63d (CHR-03, HUB-20) : catégories et priorité des tâches.
                { href: "/events/parametres/taches", label: "taskCategories" },
                { href: "/events/modeles-programme", label: "program" },
                // Lot 58 (EVT-08) : modèles d'évènement (structures, sans donnée personnelle).
                { href: "/events/modeles-evenement", label: "eventTemplates" },
                // Lot 51 (JRJ-06) : modèles des listes de contrôle du jour J.
                { href: "/events/parametres/listes-jour-j", label: "dayChecklists" },
                ...when(guests, [
                  { href: "/events/parametres/regimes", label: "dietaryOptions" },
                  { href: "/events/parametres/repas", label: "mealTypes" },
                ]),
                // Lot 47 (partie F) : prestataires par lien.
                { href: "/events/parametres/prestataires-par-lien", label: "vendorCoordination" },
              ]),
              ...when(budget, [{ href: "/budget/parametres", label: "allocation" }]),
              { href: "/parametres/relances", label: "followUp" },
            ]
          : [],
    },
    // Lot 46 (RDV-01, D11) : la page de réservation, les types et les disponibilités.
    {
      label: "groupAppointments",
      icon: "appointments",
      items: when(appointments, [
        { href: "/rendez-vous/reglages", label: "appointmentTypes" },
        { href: "/rendez-vous/disponibilites", label: "appointmentAvailability" },
      ]),
    },
    {
      label: "groupSales",
      icon: "sales",
      items: when(quotes, [
        { href: "/devis/catalogue", label: "catalog" },
        // Lot 31a/31b (HUB-21) : modèles de devis et de contrat.
        { href: "/devis/modeles", label: "quoteTemplates" },
        { href: "/devis/modeles-contrat", label: "contractTemplates" },
        // Lot 43 (FAC-02, FAC-09, FAC-15) : page de proposition et relances.
        { href: "/devis/modeles-proposition", label: "proposalTemplates" },
        { href: "/devis/relances", label: "paymentReminders" },
        { href: "/devis/parametres", label: "quotes" },
        { href: "/devis/parametres/documents", label: "documents" },
        { href: "/devis/e-reporting", label: "eReporting" },
        // Lot 58 (FAC-11) : exports comptables (journaux, FEC, PDF d'origine).
        { href: "/devis/exports-comptables", label: "accountingExports" },
        // Lot 23b (JUR-06, décision D7) : archive comptable, titulaire seulement.
        ...when(isOwner, [{ href: "/devis/parametres/archive", label: "accountingArchive" }]),
      ]),
    },
    {
      label: "groupData",
      icon: "data",
      items: [
        ...when(vendors, [
          { href: "/prestataires/parametres", label: "vendorTypes" },
          { href: "/prestataires/parametres/etiquettes", label: "vendorTags" },
          { href: "/prestataires/parametres/trajet", label: "vendorTravel" },
          // Lot 48a (PRE-05) : délai d'alerte et natures des pièces des prestataires.
          { href: "/prestataires/parametres/pieces", label: "vendorDocuments" },
        ]),
        ...when(events || budget || quotes, [{ href: "/import", label: "import" }]),
        ...when(isOwner, [
          { href: "/rgpd", label: "privacy" },
          // Lot 23 (HUB-16, décision D4) : journal d'activité, titulaire seulement.
          { href: "/parametres/journal", label: "activityLog" },
          // Lot 35a (HUB-13, décision D5) : export complet des données.
          { href: "/parametres/export", label: "export" },
          // Lot 35b (HUB-13, D6) : reprise d'un export Symbola dans un espace vide.
          { href: "/parametres/reprise", label: "organizationImport" },
          // Lot 35c (RGP-11, D8) : fermer l'espace.
          { href: "/parametres/fermeture", label: "organizationClosure" },
          // Lot 37b (DOC-12, décision D12) : relevé mensuel du stockage.
          { href: "/parametres/stockage", label: "storage" },
        ]),
      ],
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

// Toutes les adresses du menu, tous modules et rôles confondus.
export const SETTINGS_MENU_HREFS: readonly string[] = settingsMenu({
  events: true,
  budget: true,
  quotes: true,
  vendors: true,
  guests: true,
  appointments: true,
  isOwner: true,
  selfService: true,
}).flatMap((group) => group.items.map((item) => item.href));
