# ADR 0064 — Jour J hors ligne : service worker écrit à la main, copie gardée sur l'appareil

- Statut : accepté (spécification du lot 29 validée par Julien le 12/11/2026, décisions D1 à D8 ;
  décision Q6 (a) de `docs/QUESTIONS.md` : hors-ligne en lecture au MVP)
- Date : 2026-11-12
- Exigences : ARC-09, JRJ-02, JRJ-04, NFR-09 de `docs/CAHIER_DES_CHARGES.md`.

## Contexte

ARC-09 veut une application web progressive : installable, écrans clés en cache, file d'actions
hors ligne pour le jour J, notifications push. Critère : « Le mode Jour J s'ouvre sans réseau
après une première synchronisation. » NFR-09 veut le jour J utilisable serveur injoignable ;
JRJ-02 une consultation complète au MVP, le pointage et les notes en V1. Q6 a limité le MVP à la
lecture hors ligne du jour J, et annonçait une dépendance de service worker.

Contraintes de l'existant :

- l'app est rendue par le serveur (Next.js), avec une CSP par nonce à chaque requête ;
- une session expire après 8 heures sans activité (SEC-05) : préparé la veille au soir, le jour J
  doit s'ouvrir le matin sans session valide ;
- les données du jour J sont personnelles (coordonnées des clients et des prestataires, notes
  internes) et ne doivent quitter le serveur que par un geste (RGP-05, réglages protecteurs).

## Décision

1. **Pas de dépendance** (D2). Le service worker est écrit à la main : `apps/symbola/public/sw.js`,
   environ cent cinquante lignes, relues en entier en revue de sécurité. Une bibliothèque de
   service worker aurait copié toute l'application sur chaque téléphone ; la portée voulue tient
   en un écran, ses fichiers et ses documents.
2. **Portée stricte**. Le service worker ne répond qu'à :
   - les fichiers statiques de Next (`/_next/static/`, noms à empreinte) : la copie d'abord ;
   - la navigation vers l'écran d'un jour J gardé (`/jour-j/<id>`) ou vers son PDF : le réseau
     d'abord ; la copie si le réseau ne répond pas, si le serveur répond une erreur 5xx ou ne
     répond pas en cinq secondes (NFR-09), ou s'il renvoie vers la connexion (session expirée) ;
   - toute autre navigation : le réseau, et la page « Hors ligne » s'il ne répond pas (D6).

   Tout le reste passe au réseau comme sans service worker. Aucun écran de gestion n'est servi
   depuis une copie : on n'y lit jamais une donnée périmée.
3. **Copie faite par l'écran, pas par le service worker** (D3). « Garder sur cet appareil » est un
   geste explicite, propre à chaque appareil. L'écran du jour J (`lib/offline/device-copies.ts`)
   copie dans le Cache Storage sa propre page (HTML rendu par le serveur, avec son en-tête CSP et
   ses nonces), le PDF du programme, les fichiers statiques qu'il a chargés et la page « Hors
   ligne » ; puis il écrit une fiche (compte, évènement, échéance, contenu). Il se met à jour à
   chaque ouverture en ligne. Le service worker n'est enregistré qu'à ce moment, et désinscrit
   quand plus aucune copie ne reste.
4. **Durée de vie** (D4). La copie s'efface :
   - par « Retirer de cet appareil » ;
   - à la déconnexion depuis l'appareil (le bouton efface avant de fermer la session) ;
   - à la connexion d'un autre compte sur le même navigateur (fiche d'un autre compte) ;
   - le lendemain de l'évènement à minuit, heure de Paris, à la première ouverture de Symbola
     qui suit (écran, page « Hors ligne » ou service worker).

   Elle ne s'efface pas à l'expiration de la session : sinon le jour J préparé la veille serait
   perdu au matin.
5. **Contenu** (D5) : programme du jour avec notes internes et participants, lieux, prestataires
   retenus et clients avec leurs coordonnées, PDF du programme en version de l'équipe. Ni
   montants, ni budget, ni tâches.
6. **Installation** (D7) : manifeste (`app/manifest.ts`) et icônes tirées du logo par `next/og`,
   inclus dans Next ; démarrage sur l'accueil, affichage autonome. Pas d'invite automatique ;
   l'aide de l'écran explique l'installation sur iPhone et Android.
7. **Interrupteur d'arrêt** : en cas de défaut, un `sw.js` vide qui se désinscrit et efface les
   caches de Symbola se déploie comme une version ordinaire ; `sw.js` n'est jamais gardé par le
   cache HTTP (`Cache-Control: no-cache, no-store`). Procédure : `docs/runbooks/deploiement.md`.

8. **Documents embarqués** (lot 29b, D8). Le choix vaut pour l'événement (`events.event_day_documents`) :
   chaque appareil de l'équipe embarque les mêmes. Les candidats viennent de chaque module par son
   `service.ts` : documents de l'événement (plan de table, plans, plan B, envoyés à l'onglet
   « Documents »), devis signés, pièces des lignes du budget (devis, contrats, factures des
   prestataires), devis joints aux prestataires retenus. Les fichiers du carnet n'en sont pas : un
   RIB n'a rien à faire sur un téléphone le jour J, une plaquette n'y sert pas. Une pièce n'est
   embarquée et servie que si son module la donne comme candidate de l'événement ; elle s'ouvre
   dans le navigateur (`/jour-j/<id>/documents/<source>/<id>`) et se copie avec l'écran.

## Risques assumés

- **Téléphone perdu ou volé.** « Déconnecter tous mes autres appareils » ferme les sessions, mais
  ne peut pas atteindre un téléphone sans réseau : la copie y reste lisible, pour qui sait
  déverrouiller le téléphone, jusqu'au lendemain de l'évènement. Elle n'est pas chiffrée par
  l'application : le verrouillage et le chiffrement du téléphone restent la protection. L'aide
  de l'écran le dit.
- **Une copie se lit sans contrôle du serveur.** Une personne retirée de l'équipe garde la copie
  qu'elle avait faite jusqu'au lendemain de l'évènement. Même parade, même limite.
- **Effacement à la prochaine ouverture.** Sans ouverture de Symbola après l'évènement, la copie
  reste dans le navigateur (illisible par l'app, mais présente) jusqu'à ce que le navigateur la
  libère ou que Symbola s'ouvre. Aucune tâche de fond n'existe sur iPhone pour l'effacer plus tôt.
- **Navigateurs.** Safari sur iPhone garde les données d'un site installé sur l'écran d'accueil ;
  dans un onglet ordinaire, il peut les effacer après sept jours sans visite. L'aide recommande
  l'installation ; la demande de stockage persistant (`navigator.storage.persist`) est faite.
  Le rejeu sur iPhone se fait sur le staging (porte 2).

## Conséquences

- RGP-08 : la purge des données d'invités doit effacer aussi les copies hors ligne ; c'est déjà le
  cas, la copie s'efface le lendemain de l'évènement, bien avant la purge.
- Le lot 30 transforme l'écran (« Maintenant » et « Ensuite », gros caractères, thème sombre,
  annuaire) sans toucher à cette couche ; le lot 29b ajoute les documents embarqués (JRJ-04) à la
  liste copiée.
- La file d'actions hors ligne (pointage, notes, JRJ-05 à JRJ-09) et les notifications push
  d'ARC-09 viendront en V1 : la file demandera une synchronisation dans l'autre sens, à décider
  alors (nouvel ADR).
