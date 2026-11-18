# ADR 0082 — Module Rendez-vous : page publique sur les disponibilités réelles, agendas connectés par adresse ICS (ical.js), lien de gestion sans compte

- Statut : accepté (spécification du lot 46 validée par Julien le 18/11/2026 ; décisions D1 à D11
  retenues dans leur option (a), dépendance `ical.js` accordée)
- Date : 2026-11-18
- Complète : [0011](0011-monolithe-modulaire-pour-le-mvp.md) et
  [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md) (un module, un schéma),
  [0053](0053-acces-des-tiers-par-lien-personnel.md) (liens personnels),
  [0062](0062-modules-autonomes-preuve-par-combinaisons.md) (modules autonomes),
  [0069](0069-contact-dans-le-noyau.md) (contact dans le noyau),
  [0072](0072-emails-a-l-image-de-l-organisation.md) (e-mails, flux ICS),
  [0076](0076-file-des-taches-et-adaptateur-e-mail.md) (file des tâches),
  [0079](0079-socle-des-modules-rendez-vous-et-invites.md) (module fermé par défaut, chiffrement de
  champ, jeton de lien commun).
- Exigences : RDV-01 à RDV-04, EVT-10, HUB-08, POR-02 de `docs/CAHIER_DES_CHARGES.md` ;
  spécification `docs/lots/lot-46-rendez-vous.md`.

## Contexte

Symbola n'avait pas d'app Rendez-vous : la planner propose ses rendez-vous par e-mail ou par
téléphone et les note dans son agenda personnel. Le cahier des charges demande une page publique
de réservation « alimentée par les disponibilités réelles des calendriers connectés », dont le
critère est « aucun créneau proposé sur une plage occupée » (RDV-02), un report « sans compte »
(RDV-03), une app autonome (RDV-04) et des comptes rendus dont les actions deviennent des tâches
(EVT-10).

## Décision

1. **Un module neuf** (D1) : `apps/symbola/modules/appointments`, schéma PostgreSQL `appointments`,
   clé `appointments`, fermé par défaut (ADR 0079). Neuf tables, chacune avec `organization_id` et
   RLS forcée ; auteur et dates (DAT-06) ; suppression logique des types et des rendez-vous
   (ADR 0073). Les autres modules ne sont connus que par un identifiant opaque (compte qui reçoit,
   contact, évènement, tâche), sans clé étrangère entre schémas. Migrations 0150 (création) et 0151
   (droits, RLS, déclencheurs), annulables ; 0152 dans `hub`, voir « Conséquences », E-mails.
2. **Exception écrite à la RLS** : la page de réservation (`booking_pages`) a une politique de
   lecture ouverte (`public_lookup`) pour retrouver l'organisation d'une adresse publique ;
   l'écriture reste à la seule organisation. La table ne porte que l'adresse, son état et la
   mention d'information affichée sur la page.
3. **Créneaux** : une fonction pure (`slots.ts`) calcule les créneaux libres d'après les plages
   hebdomadaires (heure murale de Paris, heure d'été comprise), la durée, les marges, le délai de
   prévenance et l'horizon, moins les plages occupées : rendez-vous pris (avec leurs marges),
   agendas extérieurs, jours fermés et jours d'évènement confirmé (D6). Au pas de 30 minutes
   (15 pour un rendez-vous de moins de 30 minutes). À la réservation, le créneau est recalculé
   dans la transaction, sous un verrou par personne qui reçoit (`pg_advisory_xact_lock`) : deux
   réservations du même créneau, une seule passe ; l'autre reçoit les créneaux voisins.
4. **Agendas connectés** (D2) : l'adresse secrète ICS d'un agenda Google, Apple ou Outlook,
   chiffrée au repos (`sealField`, ADR 0079), jamais réaffichée ni journalisée. Relue toutes les
   quinze minutes (tâche périodique), et à l'ouverture de la page si sa lecture a plus de quinze
   minutes. Seules les plages occupées sont gardées (D4), sans titre, lieu ni participant. Trois
   échecs de suite : « en erreur », la planner est prévenue dans « Aujourd'hui », et **aucun
   créneau n'est proposé pour cette personne** tant que l'agenda n'est pas relu (ni avant sa
   première lecture). Nous lisons « aucun créneau du jour concerné » comme « aucun jour » : sans
   l'agenda, on ne sait pas quels jours sont pris.
5. **Garde réseau (SSRF)** : `https` seulement (`webcal://` lu en `https`), pas d'identifiants dans
   l'adresse ; la résolution DNS est faite par la connexion elle-même et refuse toute adresse
   privée, locale, de lien local, de métadonnées ou réservée (IPv4 et IPv6, IPv4 inscrite dans
   IPv6) : pas de seconde résolution qu'un nom pourrait faire changer. Chaque redirection est
   jugée de même (trois au plus) ; 2 Mo et 10 secondes au plus. Une erreur ne porte que son genre.
6. **Lecture des fichiers ICS** (D3) : la bibliothèque **`ical.js` 2.2.1** (Mozilla, celle de
   Thunderbird ; MPL-2.0, sans dépendance), employée sans modification. Elle lit les répétitions
   (règles, exceptions, occurrences déplacées) et les fuseaux décrits dans le fichier (fuseaux
   Windows d'Outlook compris). Une heure sans fuseau décrit est lue dans le fuseau nommé s'il est
   connu, sinon à Paris ; jamais dans le fuseau du serveur. Un lecteur maison (option b) aurait
   dû couvrir les mêmes cas pour tenir le critère ; c'était plus coûteux et plus risqué.
7. **Confirmation immédiate** (D5), avec limitation de débit (adresse IP et adresse e-mail), piège à
   robots et au plus trois rendez-vous à venir par adresse et par organisation. Le plafond atteint
   reçoit le même message qu'un débit dépassé : la réponse ne dit jamais si une adresse est connue.
8. **Lien de gestion** (D10) : jeton de 256 bits (`newLinkSecret`, ADR 0079), après « # », retiré
   de l'adresse à l'ouverture, envoyé en POST seulement, sans cookie ni compte ; valable jusqu'à
   la fin du rendez-vous. L'empreinte sert à retrouver le rendez-vous ; le jeton lui-même est gardé
   chiffré (DAT-08), pour redonner **le même lien** dans les rappels et après un déplacement.
9. **Rappels** (D10) : par e-mail, 24 h avant par défaut, réglables par type (aucun, 24 h, 24 h et
   2 h), par la file des tâches (ADR 0076) avec une clé d'unicité par rendez-vous, rappel et heure
   du rendez-vous : un passage rejoué ne renvoie rien, un rendez-vous déplacé a d'autres clés, un
   rendez-vous annulé n'est plus candidat. Un rappel n'est envoyé que si le rendez-vous a été pris
   avant son heure.
10. **Prospect** (D7) : chaque rendez-vous publie l'évènement interne
    `appointments.appointment.booked` (version 1, identifiants seulement) ; l'app Prospects
    (lot 44) s'y abonnera. En attendant, la planner rattache le rendez-vous à un évènement, ou en
    crée une option sans ressaisie (contact repris). Le contact du hub est créé, ou rattaché par son
    adresse e-mail (DAT-12).
11. **Comptes rendus** (D8, D9) : dans le module Rendez-vous ; une action devient une tâche de
    l'évènement lié (`addEventTask`), en un geste ; sans évènement, l'écran propose d'abord de
    rattacher. Le compte rendu n'est jamais partagé au client (POR-10).

## Conséquences

- **Aucun nouveau sous-traitant** : les agendas sont lus par leur adresse publique secrète ;
  `docs/conformite/sous-traitants.md` est inchangé. La limite connue (quinze minutes) est dite sur
  la page publique et dans l'aide.
- **Dépendance** : `ical.js` entre à l'inventaire des licences (`docs/conformite/licences.md`).
- **E-mails** : les quatre natures d'e-mails de rendez-vous (confirmé, rappel, déplacé, annulé)
  ont leur texte de départ et se personnalisent dans Paramètres › Modèles d'e-mails (groupe
  « Rendez-vous »). **Exception écrite** à « une migration ne touche que le schéma de son module »
  (DAT-09, ADR 0036), accordée par Julien le 18/11/2026 : la migration **0152** remplace la seule
  contrainte `hub.email_templates_kind_check` par la liste élargie, rien d'autre dans `hub` ; une
  nature inconnue reste refusée par la base ; l'annulation est refusée tant qu'un modèle de
  rendez-vous personnalisé existe. Le lot 49 a le même accord pour ses natures : la seconde PR
  fusionnée réunit les deux listes en renumérotant sa migration.
- **Fuseaux** : les disponibilités sont à l'heure de Paris (ARC-17) ; le fuseau de chaque
  participant relève de RDV-05 (P2).
- **Hors périmètre** : synchronisation dans les deux sens et OAuth (V2), SMS (D10), intégration de
  la page dans le site de la planner (`X-Frame-Options: DENY`), partage du compte rendu au portail.
- **Conseils** : DPO-1 à DPO-3 (fiche de la DPO, question 13) et AV-3 (fiche de l'avocat,
  question 15) ; en attendant, le défaut prudent s'applique (mention d'information de départ à
  faire relire, règle des prospects pour une personne qui a seulement pris rendez-vous).
