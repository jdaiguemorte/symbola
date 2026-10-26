# ADR 0017 — Empreinte carbone numérique (brique transverse)

- Statut : accepté
- Date : 2026-10-26

## Contexte

Julien veut une brique transverse permettant un bilan (mensuel et annuel)
de l'empreinte carbone de l'usage de Symbola par organisation, avec un
algorithme et des bilans parfaitement explicables — argument RSE/CSRD
face à des clients plus gros. Périmètre : l'empreinte numérique de la
plateforme elle-même (serveur, stockage, requêtes), pas le bilan carbone
des événements organisés par les clientes (hors périmètre).

## Décision

- **Cadre de calcul** : SCI (*Software Carbon Intensity*), norme
  ISO/IEC 21031:2024, Green Software Foundation. Formule
  `SCI = ((E × I) + M) / R`.
- **E** (énergie) et **M** (empreinte matérielle incorporée) :
  méthodologie ouverte Boavizta (AGPL-3.0, `boaviztapi`,
  <https://github.com/Boavizta/boaviztapi>), à partir des
  caractéristiques du VPS Contabo.
- **I** (intensité carbone du réseau électrique) : valeur publiée,
  datée, sourcée, figée pour l'année — jamais une API temps réel, pour
  que le bilan reste explicable et reproductible. **Localisation du
  VPS Contabo confirmée par Julien : Luxembourg.** Le Luxembourg
  importe 65-70 % de son électricité (petit pays, fortement
  interconnecté) : la valeur retenue doit être **basée sur la
  consommation (imports inclus)**, jamais la seule production
  domestique — sinon le bilan sous-estime fortement (le Luxembourg
  produit très peu en propre ; méthode production seule ≈ 123
  gCO2eq/kWh, nettement plus optimiste et trompeuse, donc explicitement
  écartée). Valeur retenue : **≈ 300 gCO2eq/kWh** (fourchette 2025-2026
  selon la période exacte, méthode consommation — source
  [LowCarbonPower](https://lowcarbonpower.org/region/Luxembourg)).
  Cette valeur, sa source, la date de consultation et la précision
  « méthode consommation, imports inclus » doivent être visibles dans
  le fichier de méthodologie et dans chaque bilan publié — c'est
  exactement le genre de choix méthodologique qui doit rester
  explicite, jamais implicite. À revoir annuellement (même logique que
  le barème kilométrique ailleurs dans le projet), jamais une constante
  figée pour toujours.
- **Allocation par organisation** : compteurs d'usage légers (nombre de
  requêtes, octets de réponse cumulés), captés **une seule fois au
  niveau de la requête HTTP** (middleware Next.js), pas module par
  module — transverse par construction, cohérent avec l'esprit « géré
  par le socle, pas app par app » déjà retenu pour le RGPD (ADR
  implicite de la section 6 du cahier des charges).
- Tous les paramètres (I, hypothèses M, poids d'allocation) versionnés
  dans un fichier `methodology.yaml`, jamais codés en dur (ADR 0007).
  Un bilan publié est immuable une fois généré (même philosophie que
  les factures, ADR 0010) ; une correction passe par une nouvelle
  version documentée, jamais une réécriture silencieuse.
- Aucune donnée personnelle dans ce module : les compteurs sont agrégés
  par organisation, jamais par personne — pas de contrat `privacy/v1`
  nécessaire pour cette brique.

## Conséquences

Le calcul et la restitution (module `carbon`, bilans, export PDF, page
de méthodologie publique) sont du V2 — pas construits maintenant. Mais
la **collecte des compteurs d'usage démarre dès le lot 0** (SOC-13) :
une année d'historique manquante ne se reconstruit pas après coup. Le
choix du cadre SCI et de la méthodologie Boavizta engage la forme des
bilans futurs ; en changer plus tard demanderait de retraiter
l'historique collecté avec la nouvelle méthodologie, pas de perdre les
compteurs bruts eux-mêmes (E, M, requêtes, octets restent calculables
rétroactivement quel que soit le cadre choisi).
