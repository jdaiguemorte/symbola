# Runbook — Recette du MVP et bascule en production (lot 6)

Recette sur le **staging** avec la planner, puis bascule en **production**. Toutes les actions
sur le serveur, les secrets et le DNS sont faites par **Julien** (CLAUDE.md §8) ; les étapes de
déploiement renvoient à [`deploiement.md`](deploiement.md), les sauvegardes à
[`restauration.md`](restauration.md), le durcissement à
[`durcissement-serveur.md`](durcissement-serveur.md).

Cocher chaque case au fil de la session ; noter tout écart dans la section « Écarts constatés »
en fin de fichier (écran, étape, ce qui était attendu, ce qui s'est passé). Un écart bloquant
devient une correction avant la bascule ; un écart mineur peut devenir une story V2.

Durée indicative : une demi-journée de préparation (Julien), deux demi-journées de recette avec
la planner (un ordinateur **et** un téléphone), une heure de bascule.

## 1. Préparation du staging (Julien)

- [ ] `main` à jour : toutes les PR du lot 6 fusionnées, CI verte, image publiée (noter le SHA).
- [ ] Sauvegarde manuelle du staging avant mise à jour :
      `sudo systemctl start symbola-backup@staging.service`.
- [ ] Mise à jour du staging (`deploiement.md` § « Mise à jour ») avec le SHA noté.
- [ ] Migrations appliquées **avant** le redémarrage de l'app (tunnel SSH) :
      `pnpm --filter @symbola/db migrate` — elles vont jusqu'à **0057** (lots 5 et 6 : 0043 → 0057).
- [ ] `https://staging.<domaine>/health` répond `ok` (base, stockage, antivirus).
- [ ] En-têtes de sécurité présents (`deploiement.md`, commande `curl -sI`).
- [ ] Signature : Documenso en service sur le staging (`deploiement.md` § Signature),
      `SIGNATURE_PROVIDER=documenso`, webhook testé (un appel sans secret est rejeté).
- [ ] E-mails : `SMTP_*` renseignés ; un e-mail de test reçu (invitation d'un collaborateur).
      **Jamais d'adresse réelle de marié sur le staging** : utiliser des adresses de test.
- [ ] Compte Admin : `/admin/parametres` renseigné — seuils de franchise de TVA (valeurs de
      l'année en cours), limites de l'import (10 Mo, 5 000 lignes, 7 j, 90 j), durée des exports
      RGPD (7 j).
- [ ] Compte de la planner créé sur le staging (organisation dédiée à la recette), MFA activée.
- [ ] Fichier d'export de l'outil actuel **anonymisé** prêt (noms, e-mails et téléphones remplacés),
      à défaut un export réel uniquement si la planner l'accepte et que le staging est purgé
      ensuite (section 5).

## 2. Recette avec la planner (staging)

Chaque bloc se fait **sur ordinateur puis sur téléphone** (375 px ou plus). Cocher « OK » quand
le parcours se déroule sans aide ; sinon noter l'écart.

### Hub, onboarding, aide (HUB, ONB, AIDE)

- [ ] Connexion avec MFA ; déconnexion ; reconnexion sans ressaisir le code sur la même session.
- [ ] Questionnaire d'onboarding complet (métier, forme juridique, SIREN, adresse, logo, TVA) ;
      interrompu puis repris.
- [ ] Changement de régime de TVA avec date d'effet (ONB-02).
- [ ] Langue : passer en anglais puis revenir en français (HUB-04).
- [ ] Tableau de bord : blocs Tâches, Calendrier, Encaissements à venir, alertes RGPD.
- [ ] Visite guidée de chaque module, relancée depuis l'aide ; articles d'aide lisibles.
- [ ] Essai guidé (données de test marquées) : démarré, parcouru, terminé ; plus aucune trace
      ensuite dans les listes, statistiques et recherches.

### Import (IMP-01 à 05) — avec l'export de l'outil actuel

- [ ] Envoi du fichier (`/import`) : format, encodage et séparateur reconnus ; cellules à risque
      neutralisées signalées.
- [ ] Colonnes : propositions correctes, corrections faciles ; colonnes sans équivalent gardées
      en champs libres.
- [ ] Rapprochements : doublons et sources inconnues bien proposés (source inconnue créée,
      « Perdu » accepté sans motif).
- [ ] Rapport des écarts téléchargé (CSV) et compréhensible.
- [ ] Aperçu puis confirmation ; vérifier 5 fiches importées au hasard (dates, montants,
      clients, champs libres) ; journal de l'import.
- [ ] Annulation d'un import d'essai : tout revient comme avant ; une fiche modifiée à la main
      entre-temps est gardée et signalée.

### Événements et Chrono (EVT-01 à 07)

- [ ] Liste des événements : filtres par statut, année, source ; recherche par nom.
- [ ] Création d'un prospect (source obligatoire), passage par les étapes jusqu'à « confirmé »,
      puis « perdu » avec motif sur un autre.
- [ ] Postes prestataires : statuts, réservation avec prestataire et montant.
- [ ] Rétroplanning appliqué depuis un modèle ; échéances recalculées après changement de date.
- [ ] Programme du jour J : lignes, intervenants, notes internes ; PDF « mariés » (sans notes)
      et « prestataires ».
- [ ] Accès des mariés : invitation, connexion d'un marié de test, il ne voit que son
      événement, coche une tâche ; la planner le voit dans le fil d'activité.

### Budget (BUD-01 à 04)

- [ ] Simulation pour un prospect depuis un modèle de répartition ; ajustements.
- [ ] Prévu / réel / écart ; totaux justes.
- [ ] **Réservation d'un poste avec montant → le réel de la ligne se met à jour seul en moins
      d'une minute** (worker des événements internes, lot 6). Un réel corrigé à la main ensuite
      n'est pas écrasé.
- [ ] Devis prestataire joint (PDF), ouvert par lien temporaire ; un fichier non autorisé est
      refusé.
- [ ] Vue du marié en lecture seule, sans les devis joints.

### Devis et Facturation (DEV-01 à 04)

- [ ] Catalogue : articles, modes de paiement ; devis composé, remise, TVA selon le régime.
- [ ] PDF du devis relu par la planner (mentions, logo, totaux).
- [ ] Signature en ligne via Documenso par un « marié » de test ; événement confirmé
      automatiquement ; e-mail de notification reçu.
- [ ] Échéancier d'acomptes, paiement enregistré, encaissements à venir au tableau de bord.
- [ ] Facture d'acompte puis de solde : numérotation continue, PDF conforme ; avoir sur une
      facture ; une facture émise ne se modifie plus ; export e-reporting.
- [ ] **À faire relire par le comptable** : un PDF de facture, d'avoir et l'export e-reporting.

### RGPD (RGPD-01 à 05) — titulaire seulement

- [ ] Un collaborateur n'a pas accès à `/rgpd` ; l'Admin non plus.
- [ ] Recherche d'une personne (nom, e-mail, téléphone) : données groupées par module ; les
      homonymes sont distinguables.
- [ ] Demande d'accès enregistrée (`/rgpd/demandes`), échéance affichée, alerte au tableau de
      bord à moins de 7 jours (modifier temporairement le seuil dans `/rgpd/reglages` pour la
      voir), prolongation avec motif.
- [ ] Export des fiches cochées : avertissement sur les notes internes, PDF lisible, archive ZIP
      ouverte dans un tableur (accents corrects), liens qui expirent.
- [ ] Demande d'oubli : aperçu (supprimée, anonymisée, conservée avec motif et date de fin),
      validation, accusés des modules, demande close, preuve PDF, modèle de réponse ; la
      personne n'est plus trouvée (hors factures et devis signés conservés).
- [ ] Purge mensuelle (`/rgpd/purge`) : la liste est vide sur des données récentes (normal) ;
      vérifier les durées dans `/rgpd/reglages`.
- [ ] **À faire valider par un juriste** (avant l'ouverture SaaS) : durées de conservation,
      modèle de réponse à une demande d'effacement, registre `privacy.registry.yaml`.

### Transverse

- [ ] Chaque écran utilisé sur téléphone : rien ne déborde, boutons accessibles au pouce.
- [ ] Textes : aucune clé de traduction affichée brute, aucune faute gênante relevée.
- [ ] Temps de réponse acceptables sur la liste des événements après l'import réel
      (objectif PRD : 200 événements en moins de 2 s en 4G).

## 3. Critères de bascule en production

Tous doivent être remplis :

- [ ] Aucun écart **bloquant** ouvert (section « Écarts constatés »).
- [ ] CI verte sur le SHA à déployer, parcours bout en bout compris (job `e2e`), sans alerte
      critique (Semgrep, Gitleaks, Trivy, OSV) ;
      scan ZAP du staging sans alerte haute.
- [ ] Sauvegarde **et** restauration testées sur le staging ce mois-ci (`restauration.md` § 5).
- [ ] Durcissement du serveur vérifié (`sudo bash infra/server/check-hardening.sh`).
- [ ] Surveillance Uptime Kuma active sur la production (alerte e-mail testée).
- [ ] E-mails de production : domaine authentifié (SPF, DKIM, DMARC), test de délivrabilité.
- [ ] Factures et e-reporting relus par le comptable ; valeurs « proposées » du PRD validées.
- [ ] Limites connues acceptées par Julien : sauvegardes sur le même VPS (copie externe avant un
      second client), pas d'avertissement au marié avant suppression d'un compte inactif,
      page `/admin` sans pagination des organisations (à prévoir avant plusieurs clients).

## 4. Bascule en production (Julien)

1. [ ] Sauvegarde manuelle de la production (si elle existe déjà).
2. [ ] Déploiement de la production avec **le même SHA** que le staging recetté
       (`deploiement.md`), migrations appliquées avant le redémarrage.
3. [ ] Documenso de production (`signature.<domaine>`), clé et webhook ; `SIGNATURE_PROVIDER=documenso`.
4. [ ] `/health` OK ; en-têtes de sécurité ; isolation staging ↔ production vérifiée
       (`deploiement.md` § isolation).
5. [ ] Compte Admin, paramètres de la plateforme (section 1), compte de la planner avec MFA.
6. [ ] Import réel depuis l'outil actuel en production (le vrai fichier), vérification de 5 fiches.
7. [ ] Première sauvegarde de production réussie le soir même ; restauration testée sur le
       staging dans le mois.
8. [ ] Le staging est purgé des données réelles éventuellement utilisées pour la recette
       (restauration d'une sauvegarde vierge ou suppression de l'organisation de recette).

## 5. Après la bascule

- [ ] Première purge mensuelle examinée avec la planner le mois suivant.
- [ ] Revue des journaux de l'app après une semaine : aucune donnée personnelle en clair, aucune
      erreur répétée (worker des événements, purges horaires).
- [ ] Retours de la planner notés comme stories V2 (cahier des charges : apps hors MVP).

## Écarts constatés

| Date | Écran / étape | Attendu | Constaté | Bloquant ? | Suite |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
