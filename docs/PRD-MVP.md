# PRD du MVP — Symbola

2026-10-25 · Julien

## 1. Périmètre

Le MVP doit permettre à la planner de gérer tous ses événements en cours sans ouvrir Wedding Plan. Il comprend 4 apps, l'import, le module RGPD, l'onboarding et l'aide intégrée : 36 user stories, chacune avec des critères d'acceptation au format **Étant donné / Quand / Alors**, que Claude Code transforme directement en tests automatisés.

**Dans le MVP**

| Brique               | Stories                           | Rôle                                                                                |
|----------------------|-----------------------------------|-------------------------------------------------------------------------------------|
| Hub                  | HUB-01 à HUB-04                   | Connexion, tableau de bord, administration, langue                                  |
| Événements et Chrono | EVT-01 à EVT-07                   | Porte d'entrée, rétroplanning, jour J, accès mariés                                 |
| Budget               | BUD-01 à BUD-04                   | Simulation, prévu / réel / écart                                                    |
| Devis et Facturation | DEV-01 à DEV-04                   | Catalogue, signature DocuSeal, acomptes, factures conformes                         |
| Import               | IMP-01 à IMP-05                   | Reprise de données depuis n'importe quel outil                                      |
| RGPD                 | RGPD-01 à RGPD-06                 | Recherche, export, oubli, purge                                                     |
| Onboarding et aide   | ONB-01, ONB-02, AIDE-01 à AIDE-04 | Questionnaire d'entrée, régime de TVA, visites guidées, essais avec données de test |

**Hors MVP** : Prestataires et carte, Booking, Quiz, Save-the-date, Temps et frais, paiement en ligne, envoi automatique des e-factures par API, abonnements Stripe, multi-planners. Le socle est néanmoins multi-tenant dès le départ : ajouter un deuxième client plus tard ne demandera pas de refonte.

**Une story est « terminée » quand :**

1.  Tous ses critères d'acceptation passent en tests automatisés.

2.  Le test d'isolation entre organisations passe pour chaque nouvelle donnée ou API.

3.  Le pipeline de sécurité n'a aucune alerte critique (Semgrep, Gitleaks, Trivy, ZAP rapide).

4.  Les textes affichés existent en français et en anglais.

5.  Tout champ personnel nouveau est déclaré dans le registre de données de l'app.

6.  L'écran fonctionne sur téléphone (largeur 375 px) et sur ordinateur.

7.  Aucune liste, aucun modèle ni aucune règle fiscale n'est écrit dans le code : tout vient des paramètres de l'organisation.

8.  Le module a sa visite guidée, son essai avec données de test et ses articles d'aide (section 9).

9.  La fonctionnalité a été essayée sur le staging avec des données fictives.

## 2. Modèle de données

**Note (ADR 0011-0012) :** le schéma ci-dessous montre la logique cible (API entre apps
séparées). Au MVP, « Budget », « Événements » et « Devis » sont des schémas PostgreSQL distincts
dans **une seule base**, et les flèches en pointillés représentent des appels au `service.ts` du
module Événements, pas un appel réseau — mêmes règles d'isolation (pas de jointure SQL directe
entre schémas), transport différent.

L'Événement est le pivot : Budget et Devis s'y rattachent par son identifiant, sans jamais lire le schéma Événements directement. Si le module Événements n'est pas souscrit, Devis et Budget se rattachent à un simple « dossier » local.

```mermaid
flowchart LR
  subgraph HUB["Hub et identité (Zitadel)"]
    ORG[Organisation] --- USR["Utilisateurs et rôles (titulaire, client, admin)"]
    ORG --- APPS[Apps activées]
    ORG --- RGPD[Demandes RGPD]
  end
  subgraph BUD["Budget — son propre schéma (base unique au MVP, ADR 0012)"]
    B[Budget] --> BL["Ligne de budget (poste, prévu, réel, écart)"]
    BL --> PJ["Pièce jointe (devis prestataire)"]
    MR["Modèle de répartition (% par poste)"]
  end
  subgraph EVT["Événements et Chrono — son propre schéma (base unique au MVP, ADR 0012)"]
    E["Événement (date, lieu, statut, source)"]
    E --> C["Client / marié (prénom, nom, e-mail)"]
    E --> P["Poste prestataire (type, statut, montant)"]
    E --> T["Tâche (échéance, responsable)"]
    E --> J["Programme du jour J (heure, intitulé, lieu)"]
    MT["Modèle de rétroplanning (tâches à J-n)"]
  end
  subgraph DEV["Devis et Facturation — son propre schéma (base unique au MVP, ADR 0012)"]
    D["Devis (version, statut, signature)"] --> DL["Ligne de devis"]
    DL --> A["Article du catalogue (prix HT, TVA, unité)"]
    D --> EC["Échéance d'acompte (montant, date, payée ?)"]
    D --> F["Facture (numéro continu, avoir)"]
  end
  B -. evenement_id via service.ts du module Événements .-> E
  D -. evenement_id via service.ts du module Événements .-> E
```

- Pointillés : référence par identifiant d'événement, lue par API ; jamais de jointure entre deux bases.
- Chaque ligne de chaque base porte l'identifiant de son organisation (Row-Level Security).

Le modèle détaillé (champs, types, contraintes) sera rédigé par Claude Code au lot 0, sous forme de schéma relu par toi avant toute migration.

## 3. Hub

Le hub est la seule porte d'entrée : connexion, tableau de bord, administration et langue. Les valeurs par défaut notées « proposé » sont à confirmer.

### HUB-01 — Connexion unique et double authentification

- **Étant donné** une planner avec un compte, **quand** elle saisit son mot de passe et son code de double authentification (application TOTP ou passkey), **alors** elle arrive sur le hub et voit uniquement les apps actives de son organisation.

- **Étant donné** un compte professionnel sans double authentification, **quand** il se connecte, **alors** il doit la configurer avant d'accéder au hub.

- **Étant donné** une planner connectée au hub, **quand** elle ouvre une app, **alors** elle n'a pas à se reconnecter.

- **Étant donné** 5 mots de passe faux d'affilée (proposé), **alors** le compte est bloqué temporairement et le titulaire reçoit un e-mail.

- **Quand** elle se déconnecte du hub, **alors** elle est déconnectée de toutes les apps.

- **Étant donné** 8 h sans activité (proposé), **alors** la session expire et la reconnexion est demandée.

### HUB-02 — Tableau de bord

- **Quand** la planner ouvre le hub, **alors** elle voit un calendrier des 12 mois. Chaque week-end avec un événement confirmé est coloré ; une date posée sur un prospect apparaît en couleur atténuée.

- **Étant donné** deux événements le même week-end, **alors** les deux sont affichés, avec un badge « 2 ».

- **Quand** elle clique sur un week-end, **alors** elle ouvre la fiche de l'événement.

- Le bloc **Tâches** liste les tâches non faites en retard ou dues dans les 14 jours (proposé), triées par échéance, avec le nom de l'événement. Cocher une tâche depuis le bloc la marque faite dans l'app Événements.

- Le bloc **Encaissements à venir** liste les acomptes non payés des 90 prochains jours (proposé), avec un total par mois.

- **Étant donné** une app non souscrite, **alors** son bloc n'apparaît pas. **Étant donné** une app qui ne répond pas en 2 secondes, **alors** son bloc affiche « indisponible » et le reste de la page fonctionne.

### HUB-03 — Administration de la suite

- **Quand** l'Admin crée une organisation (nom, langue, SIRET facultatif) et saisit l'e-mail du titulaire, **alors** le titulaire reçoit une invitation valable 7 jours (proposé).

- **Quand** l'Admin active ou désactive une app pour une organisation, **alors** le changement s'applique au prochain chargement. Désactiver une app ne supprime aucune donnée.

- **Quand** l'Admin ouvre la page Santé, **alors** il voit pour chaque app son état (en ligne / hors ligne) et sa version déployée.

- **Étant donné** le compte Admin, **quand** il tente de lire les événements, budgets ou devis d'une organisation, **alors** l'accès est refusé (test automatisé obligatoire).

- Chaque action de l'Admin est inscrite au journal d'audit : qui, quoi, quand.

### HUB-04 — Langue

- **Étant donné** un nouvel utilisateur, **alors** la langue par défaut est celle de son navigateur (français si elle n'est ni FR ni EN).

- **Quand** il choisit FR ou EN dans son profil, **alors** toutes les apps s'affichent dans cette langue.

- Dates et montants suivent la langue : « 1 234,56 € » en français, « €1,234.56 » en anglais.

- **Quand** un e-mail part vers un marié, **alors** il est rédigé dans la langue indiquée sur sa fiche.

- Un test en CI échoue si une clé de traduction manque dans l'une des deux langues.

## 4. Événements et Chrono

C'est l'app où la planner passe le plus de temps. Le modèle reste générique (un événement a un type et des « clients ») ; le pack mariage renomme simplement ces clients en « mariés ».

### EVT-01 — Liste des événements

- **Quand** la planner ouvre l'app, **alors** elle voit les événements à venir triés par date croissante, avec : date, prénoms des clients, lieu (nom et commune), statut et avancement (« 5/8 postes réservés »).

- Les événements sans date apparaissent en tête, sous « Date à définir ». Les événements réalisés ou perdus sont dans un onglet séparé.

- Elle peut filtrer par statut et par année, et chercher par prénom, nom ou lieu.

- Sur téléphone, chaque événement s'affiche comme une carte.

### EVT-02 — Étapes d'un événement

- Les statuts sont : Prospect, Devis envoyé, Confirmé, Réalisé, Perdu.

- **Quand** elle passe un événement en Perdu, **alors** un motif est obligatoire : budget, date indisponible, autre prestataire choisi, sans réponse, ou autre (texte libre).

- **Étant donné** l'app Devis souscrite, **quand** un devis est envoyé puis signé, **alors** le statut passe seul à Devis envoyé puis à Confirmé. Sans l'app Devis, elle change le statut à la main.

- **Étant donné** un événement confirmé dont la date est passée, **alors** l'app propose de le passer en Réalisé.

- Revenir à un statut précédent est possible ; chaque changement est historisé (date, auteur).

### EVT-03 — Statut des postes prestataires

- **Quand** un événement est créé, **alors** il reçoit la liste de postes par défaut de la planner (lieu, traiteur, photographe, DJ, fleuriste…), qu'elle peut modifier événement par événement.

- Chaque poste a un statut : À trouver, Devis demandé, Devis reçu, Réservé, Non requis. Chaque statut a sa couleur.

- Le haut de la fiche montre une barre d'avancement : postes réservés sur postes requis.

- **Quand** elle passe un poste à Réservé, **alors** elle saisit le nom du prestataire (texte libre au MVP) et, si elle le souhaite, le montant. **Étant donné** l'app Budget souscrite, **alors** ce montant alimente le « réel » de la ligne correspondante.

### EVT-04 — Rétroplanning

- La planner gère des modèles : chaque tâche a un intitulé, un décalage par rapport à la date (J-365, J-180…) et un responsable (planner ou clients).

- **Quand** elle applique un modèle à un événement daté, **alors** les tâches sont créées avec leurs échéances calculées. **Étant donné** un événement sans date, **alors** l'app l'indique et n'applique pas le modèle.

- **Quand** la date de l'événement change, **alors** l'app propose de recalculer les échéances des tâches non faites.

- Elle peut ajouter, modifier, cocher et réordonner les tâches. La vue par défaut les regroupe par mois.

- Une tâche dont le responsable est « clients » apparaît dans l'espace des mariés.

### EVT-05 — Programme du jour J

- Le programme est une liste de lignes : heure de début, heure de fin (facultative), intitulé, lieu, intervenants, note interne. Les lignes sont triées par heure.

- Elle peut partir d'un modèle de programme.

- **Étant donné** deux lignes qui se chevauchent pour un même intervenant, **alors** l'app le signale sans bloquer.

- **Quand** elle exporte, **alors** elle obtient un PDF A4 lisible à l'impression, avec son logo et la date de version, en deux variantes : « mariés » (sans les notes internes) et « prestataires ».

### EVT-06 — Accès des mariés

- **Quand** la planner invite un marié par e-mail, **alors** il crée son propre compte (un compte par personne). La double authentification lui est proposée, sans être obligatoire.

- Le marié voit : le rétroplanning, ses tâches (qu'il peut cocher), le programme du jour J (variante mariés), le budget en lecture seule et les devis à signer.

- **Étant donné** un compte marié, **quand** il tente d'accéder aux notes internes, à un autre événement ou à une autre organisation, **alors** l'accès est refusé (tests automatisés obligatoires).

- La planner peut retirer un accès à tout moment.

- **Quand** un marié coche une tâche, **alors** la planner le voit dans le fil d'activité de l'événement.

### EVT-07 — Source du prospect

- **Quand** elle crée un prospect, **alors** la source est obligatoire, choisie dans une liste qu'elle paramètre (Instagram, site web, bouche-à-oreille, salon, annuaire en ligne, autre).

- La source est visible dans la fiche et filtrable dans la liste.

## 5. Budget

Le budget suit les dépenses des clients auprès des prestataires, poste par poste : prévu, réel, écart. Il commence dès le prospect, par une simulation.

### BUD-01 — Simulation pour un prospect

- La planner gère des modèles de répartition : un pourcentage par poste. **Étant donné** un modèle dont le total ne fait pas 100 %, **alors** l'app l'affiche en alerte et refuse de l'enregistrer.

- **Quand** elle saisit le budget total et le nombre d'invités, puis choisit un modèle, **alors** elle obtient le montant par poste et le coût par invité.

- Elle peut ajuster un poste à la main ; le total et le reste à répartir se recalculent aussitôt.

- La simulation est enregistrée sur le prospect. **Quand** l'événement passe en Confirmé, **alors** l'app propose d'en faire le budget prévu.

### BUD-02 — Prévu, réel, écart

- Chaque ligne a un poste, un montant prévu, un montant réel et un écart calculé (réel moins prévu), en euros et en pourcentage.

- Un dépassement est en rouge, une économie en vert. Les totaux apparaissent en haut et en bas du tableau.

- Le réel se remplit à la main, ou automatiquement quand un poste est réservé avec un montant (EVT-03).

- Chaque modification est historisée : ancienne valeur, nouvelle valeur, auteur, date.

### BUD-03 — Devis prestataire joint

- **Quand** elle joint un fichier (PDF ou image, 20 Mo maximum, proposé) à une ligne, **alors** il est analysé par l'antivirus, puis rangé dans un stockage privé.

- **Étant donné** un fichier infecté ou d'un autre format, **alors** il est refusé avec un message clair.

- Le fichier s'ouvre par un lien temporaire, jamais par une adresse publique permanente.

### BUD-04 — Budget visible par les mariés

- Le marié voit le budget en lecture seule, sans les notes internes de la planner.

- **Étant donné** un compte marié, **quand** il tente de modifier une ligne, y compris par appel direct à l'API, **alors** la modification est refusée (test automatisé obligatoire).

## 6. Devis et Facturation

Cette app fait rentrer l'argent : devis issus du catalogue, signature en ligne, échéancier d'acomptes, puis factures conformes. Les règles légales de facturation sont des exigences, pas des options.

### DEV-01 — Catalogue et composition d'un devis

- Un article du catalogue a : intitulé, description, unité, prix unitaire HT, taux de TVA, catégorie.

- **Étant donné** une planner en franchise de TVA, **alors** chaque devis et facture porte automatiquement la mention « TVA non applicable, art. 293 B du CGI ».

- **Quand** elle compose un devis, **alors** elle choisit des articles, ajuste quantités et descriptions, ajoute une remise par ligne ou globale, et des lignes libres.

- Chaque devis reçoit un numéro unique et une durée de validité (30 jours, proposé). Modifier un devis envoyé crée une nouvelle version (V2, V3…) ; les versions précédentes restent consultables.

- Le PDF reprend son logo, ses coordonnées et son SIREN.

### DEV-02 — Signature en ligne

- **Quand** elle envoie le devis, **alors** l'app le transmet à DocuSeal par API, et chaque marié signataire reçoit un lien de signature.

- **Quand** le dernier signataire a signé, **alors** DocuSeal prévient l'app (webhook), le devis passe à Signé, la planner reçoit un e-mail, et l'événement passe à Confirmé (EVT-02).

- Le PDF signé et le certificat de preuve sont archivés avec le devis.

- **Étant donné** un appel webhook dont la signature cryptographique est invalide, **alors** il est rejeté et journalisé.

- L'app parle à DocuSeal via l'interface « fournisseur de signature » : un test vérifie qu'un faux fournisseur peut le remplacer.

### DEV-03 — Acomptes et encaissements à venir

- Le devis contient un échéancier : chaque acompte a un montant (ou un pourcentage) et une date. **Étant donné** des acomptes dont la somme dépasse le total, **alors** l'app refuse ; le solde est calculé automatiquement.

- **Quand** elle ouvre « Encaissements », **alors** elle voit les échéances non payées triées par date, avec un total par mois.

- **Quand** elle marque une échéance payée, **alors** elle saisit la date et le mode de paiement.

- **Étant donné** une échéance dépassée et non payée, **alors** elle passe en rouge et apparaît dans le tableau de bord du hub.

### DEV-04 — Factures conformes

- **Quand** elle génère une facture d'acompte ou de solde depuis un devis signé, **alors** elle reçoit un numéro de la série de facturation, continu et sans trou.

- Une facture émise ne peut plus être modifiée ni supprimée : une correction passe par un avoir.

- **Client professionnel** : la facture est produite au format Factur-X, à déposer sur sa plateforme agréée (HBS e-factures).

- **Client particulier (les mariés)** : pas de facture électronique obligatoire, mais des données à déclarer (e-reporting) via la plateforme agréée à partir du 1er septembre 2027. Pour une planner en franchise de TVA, c'est tous les deux mois : montants totaux, et dates et montants des encaissements ([source](https://propulsebyca.fr/comptabilite/facture/electronique/e-reporting)). L'app produit un export de ces données, période par période.

- Ces règles sont à confirmer avec son comptable avant la mise en production.

## 7. Import de données

L'import se déroule en 5 étapes visibles : fichier, colonnes, rapprochements, écarts, confirmation. Rien n'est écrit dans les apps avant la dernière étape, et un import confirmé reste annulable.

### IMP-01 — Formats acceptés

- **Quand** elle dépose un fichier CSV, Excel (.xlsx) ou JSON, **alors** l'app détecte l'encodage (UTF-8, Windows-1252), le séparateur (virgule, point-virgule, tabulation) et la ligne d'en-tête.

- **Étant donné** un fichier d'un autre format, trop gros (10 Mo, proposé) ou infecté, **alors** il est refusé avec un message clair.

- Le contenu des cellules qui commencent par = + - ou @ est neutralisé (protection contre l'injection de formules).

### IMP-02 — Reconnaissance des colonnes

- **Quand** le fichier est lu, **alors** l'app propose une correspondance pour chaque colonne (« Prénom mariée » → client 1, prénom), avec un indice de confiance, en s'appuyant sur le nom de la colonne et sur son contenu (dates, e-mails, montants).

- Elle valide, corrige ou ignore chaque correspondance. Une colonne à faible confiance n'est jamais appliquée sans validation.

- Les dates et montants au format français (31/12/2026, 1 234,56) sont reconnus.

**Portée de l'import au MVP** : événements, clients, tâches, lignes de budget, articles du catalogue, et toute liste paramétrable (postes, sources…). Les prestataires s'importent dans l'app Prestataires quand elle arrive (V2) ; d'ici là, leurs noms importés restent du texte sur les postes.

**Robustesse** : la reconnaissance des colonnes ne dépend d'aucun outil source précis. Elle est testée en CI sur un corpus de fichiers variés : exports d'outils du marché reconstitués, tableaux Excel « maison », CSV Google Sheets, en-têtes en français et en anglais, encodages différents, colonnes dans le désordre. Un vrai export Wedding Plan servira de test supplémentaire, pas de base de développement.

### IMP-03 — Rapprochements

- **Étant donné** une ligne qui ressemble à un élément existant (mêmes clients et même date, même e-mail), **alors** l'app propose de les rapprocher, avec le niveau de ressemblance.

- Elle valide les rapprochements un par un ou en lot, en refuse, et en ajoute à la main.

- Une ligne rapprochée met à jour l'élément existant ; elle n'en crée pas un doublon.

### IMP-04 — Rapport des écarts

- Le rapport liste les colonnes sans équivalent. Pour chacune, elle choisit : garder en « champ libre » visible sur la fiche, ou ignorer.

- Il liste les lignes rejetées avec leur motif (date invalide, champ obligatoire manquant…). Ce rapport se télécharge en CSV pour corriger et réimporter.

### IMP-05 — Aperçu et annulation

- Avant confirmation, elle voit le résultat : X créations, Y mises à jour, Z lignes rejetées, avec un échantillon.

- **Quand** elle annule un import déjà confirmé, **alors** les éléments créés sont supprimés et les éléments mis à jour retrouvent leurs valeurs précédentes. **Étant donné** un élément modifié à la main depuis l'import, **alors** l'app le signale et ne l'écrase pas sans confirmation.

- Chaque import est journalisé : fichier, auteur, date, résultat.

## 8. Module RGPD

Au MVP, c'est le titulaire du compte qui exerce les droits du module ; le rôle DPO arrive en V2. Chaque app implémente le contrat `privacy/v1` (rechercher, exporter, anonymiser, supprimer), et le hub orchestre.

### RGPD-01 — Recherche transverse

- **Quand** la titulaire cherche une personne par e-mail, téléphone ou nom, **alors** le hub interroge chaque app souscrite et affiche toutes ses données, groupées par app : fiches, tâches, budgets, devis, factures, historique.

- **Étant donné** une app qui ne répond pas, **alors** le résultat l'indique clairement comme incomplet, jamais comme « aucune donnée ».

- La recherche ne porte que sur l'organisation de la titulaire (test d'isolation obligatoire).

### RGPD-02 — Export (droits d'accès et de portabilité)

- **Quand** elle lance l'export, **alors** elle obtient un PDF lisible et une archive JSON/CSV réutilisable, avec toutes les données trouvées en RGPD-01.

- Les notes internes de la planner font partie de l'export, car ce sont des données sur la personne. Un avertissement le rappelle avant l'envoi.

- L'archive se télécharge par un lien temporaire.

### RGPD-03 — Demande d'oubli

- **Quand** elle traite une demande d'oubli, **alors** l'aperçu classe chaque donnée : supprimée, anonymisée ou conservée. Chaque donnée conservée indique son motif légal et sa date de fin (ex. facture : 10 ans).

- **Quand** elle valide, **alors** chaque app exécute sa part et renvoie un accusé. La demande n'est close que quand toutes les apps ont répondu.

- **Alors** une preuve horodatée est générée, avec un modèle de réponse à envoyer à la personne.

- Après anonymisation, les statistiques (source, statut, motif de refus, montants) restent justes. Le nom, l'e-mail, le téléphone et les notes libres sont introuvables, y compris par la recherche transverse (test automatisé).

### RGPD-04 — Suivi des demandes

- Chaque demande a : type (accès, rectification, oubli, portabilité, opposition), date de réception, échéance légale (un mois), statut.

- **Étant donné** une échéance à moins de 7 jours (proposé), **alors** la demande apparaît en alerte dans le tableau de bord du hub.

- **Quand** elle prolonge une demande complexe, **alors** le motif est obligatoire et l'échéance passe à trois mois au total.

### RGPD-05 — Purge mensuelle

- **Chaque mois**, le module liste les personnes dont la durée de conservation est échue, selon les règles du cahier des charges (prospect : 3 ans après le dernier contact venant de lui ; compte marié inactif : 2 ans…).

- **Quand** elle valide la liste, **alors** la purge s'exécute. Elle peut exclure une ligne, avec un motif obligatoire. Rien n'est purgé sans validation.

- Les règles de calcul sont couvertes par des tests avec dates simulées (cas limites : la veille et le jour même de l'échéance).

### RGPD-06 — Registre de données vérifié en CI

- Chaque app déclare dans un fichier ses champs personnels, avec leur catégorie, leur règle de conservation et leur règle d'anonymisation.

- **Étant donné** une migration de base qui ajoute un champ marqué personnel (ou nommé comme tel : email, phone, name, address…) sans déclaration, **alors** la CI échoue.

## 9. Paramétrage, onboarding et aide intégrée

**Règle : aucune donnée métier n'est codée en dur.** Listes de postes, sources de prospects, motifs de refus, modèles de rétroplanning, de répartition et de programme, catalogue de tarifs, régime de TVA, mentions légales, format de numérotation : tout est une donnée de l'organisation, modifiable dans ses paramètres. La plateforme fournit seulement des **modèles de départ facultatifs**, livrés comme des données traduisibles, que l'utilisateur peut prendre, modifier, supprimer ou ignorer. Ses propres données arrivent par saisie ou par l'import (section 7).

### ONB-01 — Questionnaire d'onboarding

- **Quand** un titulaire se connecte pour la première fois, **alors** un questionnaire court le guide : identité de l'entreprise (nom, SIREN, adresse, logo), forme juridique, régime de TVA (franchise en base ou assujetti, taux par défaut), métier (wedding planner, autre métier de l'événementiel), langue.

- Pour chaque liste et chaque modèle, il choisit : partir d'un modèle de départ, partir de zéro, ou importer un fichier.

- Les mentions légales des devis et factures sont déduites de ses réponses (ex. « TVA non applicable, art. 293 B du CGI » en franchise).

- Il peut interrompre le questionnaire et le reprendre plus tard. **Étant donné** une information manquante nécessaire à une action (régime de TVA pour émettre un devis), **alors** l'app la demande au moment de l'action, au lieu de bloquer l'entrée dans la plateforme.

- Toutes les réponses restent modifiables dans les paramètres.

### ONB-02 — Changement de régime de TVA

- **Quand** le titulaire change de régime de TVA, **alors** il saisit une date d'effet. Les devis et factures déjà émis ne changent pas ; les documents émis après cette date appliquent le nouveau régime.

- **Étant donné** un devis non signé créé avant la date d'effet, **alors** l'app propose d'en faire une nouvelle version avec le nouveau régime.

- Le seuil de chiffre d'affaires de la franchise est un paramètre, mis à jour par l'Admin, jamais une valeur dans le code.

### AIDE-01 — Visite guidée de chaque module

- **Quand** un utilisateur ouvre un module pour la première fois, **alors** une visite guidée courte lui montre les fonctions principales, écran par écran. Il peut la passer.

- Il peut la relancer à tout moment depuis le bouton « ? » du module.

### AIDE-02 — Essai guidé avec données de test

- Chaque module propose un essai guidé : réaliser une vraie opération (créer un événement, composer un devis et le signer soi-même…) sur des données fictives.

- Les données d'essai sont marquées « démo » : bandeau visible, documents en filigrane « Document fictif », numérotation séparée (série DEMO) qui ne consomme jamais la série légale des factures.

- Elles n'apparaissent jamais dans les statistiques, le tableau de bord, les exports comptables, l'e-reporting ni la recherche RGPD. La signature passe par un faux fournisseur de signature (grâce à l'interface de DEV-02), sans e-mail à un tiers.

- **Quand** l'essai se termine, **alors** toutes ses données sont supprimées automatiquement. **Étant donné** un essai abandonné, **alors** ses données sont supprimées après 24 h (proposé).

- Un test automatisé vérifie qu'après un essai, aucune donnée « démo » ne subsiste dans aucune base.

### AIDE-03 — Aide contextuelle

- Chaque écran a un bouton « ? » qui ouvre un article court, en FR et en EN, sur ce que l'on peut y faire.

- L'aide est consultable et cherchable depuis le hub.

### AIDE-04 — Premiers pas

- Le tableau de bord affiche une liste « Premiers pas » avec sa progression : compléter le profil, importer ou saisir ses données de base, saisir son catalogue, créer son premier événement.

- Chaque étape se coche seule quand elle est réalisée. L'utilisateur peut masquer la liste.

## 10. Exigences non fonctionnelles

Ces exigences valent pour toutes les briques du MVP. Chacune a un moyen de vérification automatique ou une procédure simple.

| Domaine           | Exigence                                                                                                                                               | Vérification                                                                   |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| Sécurité          | OWASP ASVS niveau 2 ; HTTPS uniquement (HSTS) ; en-têtes CSP, X-Frame-Options ; limitation du nombre de tentatives de connexion ; secrets hors du code | Pipeline CI (Semgrep, Gitleaks, Trivy, ZAP) ; checklist ASVS à chaque version  |
| Isolation         | Row-Level Security PostgreSQL ; une base par app                                                                                                       | Tests « organisation A lit B » et « marié lit autre événement » sur chaque API |
| Performance       | Liste de 200 événements affichée en moins de 2 s sur une connexion 4G (proposé)                                                                        | Lighthouse en CI ; test de charge k6 avant mise en production                  |
| Sauvegarde        | Sauvegarde quotidienne chiffrée ; perte maximale acceptée : 24 h de données                                                                            | Restauration testée chaque mois sur le staging                                 |
| Surveillance      | Alerte e-mail si une app ne répond plus                                                                                                                | Uptime Kuma sur le VPS                                                         |
| Mobile            | PWA installable ; écrans utilisables dès 375 px de large ; pas de mode hors connexion (page « hors ligne » seulement)                                  | Tests Playwright en taille téléphone                                           |
| Accessibilité     | WCAG 2.1 niveau AA : contrastes, navigation au clavier, champs étiquetés                                                                               | axe-core en CI                                                                 |
| Navigateurs       | Deux dernières versions de Chrome, Safari (dont iPhone), Firefox, Edge                                                                                 | Playwright multi-navigateurs                                                   |
| Langues           | FR et EN complets                                                                                                                                      | Test de clés de traduction manquantes                                          |
| Dates et montants | Dates stockées en UTC, affichées en heure de Paris ; montants stockés en centimes entiers (EUR)                                                        | Tests unitaires sur les arrondis et le passage à l'heure d'été                 |
| Journaux          | Journal d'audit des actions sensibles ; aucune donnée personnelle en clair dans les logs techniques ; conservation 6 mois (proposé)                    | Revue des logs en staging                                                      |
| E-mails           | Envoi depuis le domaine symbola.fr, authentifié (SPF, DKIM, DMARC)                                                                                     | Test de délivrabilité avant production                                         |

## 11. Ordre de construction et questions ouvertes

On construit en 7 lots, chacun utilisable et testé avant le suivant. Le lot 0 est le plus long ; c'est lui qui rend tous les autres sûrs et rapides.

1.  **Lot 0 — Socle** : monorepo, pipeline CI de sécurité, Docker Compose, Traefik, PostgreSQL, Zitadel, NATS, MinIO, sauvegardes restic, Uptime Kuma, staging sur le VPS, isolé de la production. Une app « bonjour » traverse toute la chaîne jusqu'en production. Le contrôle du registre de données (RGPD-06) est en place dès ce lot.

2.  **Lot 1 — Hub** : HUB-01, HUB-03, HUB-04, le questionnaire d'onboarding et le régime de TVA (ONB-01, ONB-02), le cadre de l'aide intégrée et des essais guidés (AIDE-01 à 04), et la structure du tableau de bord (HUB-02) sans ses blocs. Ensuite, chaque lot livre l'aide et l'essai guidé de son module.

3.  **Lot 2 — Événements et Chrono** : EVT-01, 02, 07, puis 03, 04, 05, et enfin 06 (accès mariés).

4.  **Lot 3 — Budget** : BUD-01 à 04, puis les blocs Tâches et calendrier du tableau de bord.

5.  **Lot 4 — Devis et Facturation** : DEV-01, 03, 02 (DocuSeal), 04, puis le bloc Encaissements.

6.  **Lot 5 — Import** : IMP-01 à 05, testé sur un vrai export Wedding Plan anonymisé.

7.  **Lot 6 — RGPD et recette** : RGPD-01 à 05, puis recette avec ta femme sur le staging, import réel, et bascule en production.

**Méthode avec Claude Code, pour chaque lot**

- Un fichier `CLAUDE.md` à la racine du dépôt fixe les conventions : stack, structure des apps, règles de sécurité, format des tests. Chaque choix d'architecture est noté dans un court document de décision (ADR).

- Les critères d'acceptation de ce PRD sont d'abord écrits en tests, puis le code est écrit pour les faire passer.

- Un lot = une branche et une demande de fusion. Tu relis, la CI doit être verte, puis déploiement sur le staging, essai, et production.

- À chaque version, un audit de sécurité relu par IA complète les scans automatiques.

**Questions ouvertes**

- Faire confirmer par son comptable les règles d'e-reporting et de facturation (DEV-04). Elles seront de toute façon paramétrables.

- Rédiger les modèles de départ facultatifs (postes, rétroplanning, répartition) : je peux en proposer, ta femme les relira.

- Logo et couleurs Symbola, pour l'interface et les PDF.

- Choisir le service d'e-mail transactionnel (hébergé dans l'UE).

- Valider ou corriger toutes les valeurs notées « proposé » dans ce PRD.
