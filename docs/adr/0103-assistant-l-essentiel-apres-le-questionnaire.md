# ADR 0103 — Assistant « L'essentiel » après le questionnaire d'accueil

- Statut : accepté (lot 63f ; décision de Julien du 21/11/2026 sur la recette de la wedding planner)
- Date : 2026-11-21
- Revient sur : la décision D9 du lot 33b (`docs/lots/lot-33-identite-demarrage.md`), qui avait
  retiré l'ancien assistant de démarrage au profit du seul questionnaire.
- Exigences : HUB-09, HUB-18, HUB-23, UX-04, SC-01 ; spécification
  `docs/lots/lot-63-retours-recette-planner.md` (paquet 63f), maquette M1 de
  `docs/maquette/Recette-planner.html`.

## Contexte

Recette du 21/11/2026 (retour #1, `docs/audits/2026-11-21-recette-planner.md`) : après le
questionnaire, la planner devait trouver seule la fiche de l'entreprise, la TVA, le logo, le RIB
et la numérotation, répartis entre « Paramètres › Entreprise » et « Paramètres des devis ». Elle
s'y est perdue. D9 (lot 33b) avait choisi de ne rien demander de plus que le questionnaire avant la
valeur (PAR-01) : la règle reste, mais il manque un chemin guidé pour régler ces informations.

## Décision

1. **Un assistant de six étapes, une question par écran** (`/demarrage/essentiel`) : société et
   SIRET, adresse et contact, logo, TVA, banque (RIB), numérotation. Il vient après le
   questionnaire d'accueil (inchangé) et il est la première ligne de « Pour bien démarrer ».
2. **Aucune nouvelle table.** Chaque étape écrit dans les réglages existants, par les `service.ts`
   des modules : la fiche de l'organisation (`hub.organizations`, `hub.organization_profiles`), le
   régime de TVA daté (`changeVatRegime`), le logo (`uploadOrganizationLogo`), l'IBAN et le BIC
   des documents et les préfixes des séries (module Devis). Les Paramètres restent l'endroit où l'on
   modifie ensuite. L'étape atteinte est gardée dans la progression de l'aide (`hub.help_progress`,
   clé `essentials`), comme les tutoriels.
3. **Rien n'est bloquant pour entrer.** Chaque étape s'enregistre à « Continuer » (ou Entrée) ;
   « Passer » et « Finir plus tard » laissent l'étape vide ; seule une valeur mal formée (SIRET,
   IBAN, préfixe) est refusée, et l'erreur nomme le champ. La fin ramène à l'accueil.
4. **Obligatoires pour envoyer un devis, pas pour entrer** : raison sociale, adresse (ligne, code
   postal, ville), SIRET et régime de TVA portent « * » et la mention « * obligatoire pour envoyer
   un devis ». La liste de ce qui manque est calculée par une fonction pure
   (`lib/onboarding/essentials.ts`), réutilisée par la carte « Pour bien démarrer ».
5. **Dégradation propre** (ARC-06, ARC-07) : sans le module Devis, les étapes Banque et
   Numérotation n'apparaissent pas ; l'assistant compte alors quatre étapes.

## Conséquences

- SC-01 (premier quart d'heure) : l'assistant se fait en quatre minutes environ et ne bloque aucun
  écran ; le scénario reste sous dix minutes.
- La raison sociale devient modifiable par la planner (`renameOrganization`, hub) ; elle n'était
  jusqu'ici réglée qu'à la création du compte.
- L'ancien assistant du lot 12 ne revient pas : ses étapes « documents » et « couleur » restent
  dans les tutoriels et les Paramètres des devis.
