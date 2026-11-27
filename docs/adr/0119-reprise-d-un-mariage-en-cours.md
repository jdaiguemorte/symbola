# ADR 0119 — La reprise d'un mariage en cours : un objet du hub, et un import qui ne ment pas

- Statut : accepté (lot 71a ; spécification `docs/lots/lot-71-reprise-et-import.md` validée par Julien
  le 27/11/2026, § 9 point 1 et décisions I1 à I11)
- Date : 2026-11-27
- Complète : ADR 0022 (import de données), ADR 0035 (traitements de fond des imports), ADR 0012
  (un schéma par module, pas de clé étrangère entre schémas).
- Exigences : HUB-14 (import avec aperçu, doublons, annulation en bloc), PAR-01, UX-02, UX-08, UX-10,
  BUD-01, EVT-05, CHR-02, CHR-06, CHR-08, RGP-03, RGP-05, SEC-21 ; constats C-51 à C-66 de l'audit UX.

## Contexte

Une planner qui arrive avec des mariages déjà en cours les reprend de son ancien outil : un carnet de
prestataires, puis, par mariage, une fiche PDF (ou son nom et sa date), un budget, la liste des
prestataires retenus, une liste « à faire », un programme du jour J. L'app avait une porte d'import par
fichier, sans lien entre elles ni avec le mariage. Surtout, l'import inventait : un acompte daté du
fichier devenait une échéance « en retard de 81 jours », tout prestataire retenu une relance « Contrat
de … à faire signer », un statut et une tâche faite étaient datés du jour de l'import, deux lignes
d'un même poste se fondaient, les totaux d'une fiche finissaient dans « Champs importés ». Le lendemain
d'une reprise, « Aujourd'hui » s'ouvrait sur des alertes fausses (audit UX, C-52 à C-56, C-64).

## Décision

1. **La reprise est un objet du hub** (`hub.takeovers`, `hub.takeover_steps`), qui orchestre déjà
   l'import et son écran. Une reprise par mariage (R1), six lignes dans l'ordre où déposer les
   fichiers (R2), chacune « à faire », « en cours », « faite », « pas de fichier » ou « avec le
   budget ». Elle peut commencer avant que le mariage existe ; son identifiant d'évènement est
   contrôlé par le service des évènements (de l'organisation, pas un essai, visible de la personne,
   lot 52), sans clé étrangère entre schémas. La ligne du carnet est partagée par l'agence.
2. **Le compteur** (« 3 fichiers sur 6 ») compte les lignes faites, sans fichier, ou couvertes, même
   par un import encore en cours (R4). Une ligne remplie par un import suit l'état de l'import.
3. **Aucun nouvel événement interne** : le hub écrit l'import et l'état de la ligne ; le reste se lit
   par les services (`getEventTakeover` pour la fiche du mariage).
4. **Le journal commun des imports** reçoit les PDF des prestataires retenus et du programme (sortes
   `event_vendors` et `program`, retrait d'ensemble au paquet 71e), le lien de chaque import à sa
   reprise, les noms des champs écrits sans valeur (`import_items.fields`, « D'où viennent ces
   valeurs ? », I9) et ce que le fichier contenait sans être repris (`imports.leftovers`, l'annuaire
   d'un programme, I4).
5. **Règle de fond : un import ne crée ni retard ni relance ; ce que le fichier ne dit pas reste « non
   renseigné ».**
   - Ce qui était payé arrive payé (la réponse « les acomptes ont-ils été payés ? » décide), ce qui
     était signé arrive signé, ce qui était fait arrive fait.
   - Une date inconnue est gardée **par une marque plutôt que par une date vide** :
     `event_status_history.date_known` et `event_tasks.done_date_known` sont faux, la date technique
     (l'heure de l'import) reste pour les tris et la contrainte de qui a coché (lot 70a). Une tâche
     reprise faite n'a pas d'auteur.
   - Un prestataire retenu par une reprise porte le contrat déclaré
     (`event_vendor_candidates.takeover_contract` : signé, non signé, non renseigné ; I1) et ne devient
     **jamais d'office** une relance « à faire signer » ; il y revient seulement à la date d'une
     relance que la planner a notée (I2). Un prestataire retenu à la main garde la règle d'avant.
   - La source d'un prospect est facultative ; le type est le seul de l'espace ou la réponse ; le
     statut suit « Où en est-il ? » au lieu d'être déduit.
   - Le total d'une fiche PDF va dans un total « à répartir » du budget (`budget.unallocated_totals`,
     une ligne par mariage, le reste se calcule) ; sa note dans « Notes » ; rien dans « Champs
     importés » (gardé en lecture seule pour les fiches d'avant, I8).
   - Rien n'est fondu : dans un même fichier, chaque ligne est une ligne du budget ; les lignes d'un
     même poste vont sous un seul poste.
   - Un nom ou une ville écrits en capitales retrouvent la casse de l'app, sauf « Garder les
     capitales ».
6. **Les réponses de l'étape « Questions »** (contrat `ImportAnswers`) sont gardées dans
   `hub.imports.matching`, validées par Zod ; aucune n'est cochée d'avance. Un import commencé avant
   le lot, sans réponse ni reprise, se termine avec les règles d'avant.
7. **Données personnelles** : la reprise n'en porte aucune. `leftovers` est gardé 90 jours après
   l'import (`platform_settings.import_leftovers_retention_days`, réglé par l'Admin ; I4, à confirmer
   par le DPO), effacé plus tôt à l'abandon, au retrait, une fois ajouté au carnet ou écarté ; jamais
   exporté. L'effacement définitif d'un mariage efface aussi les valeurs du journal de ses imports et
   sa reprise ; il ne reste qu'une trace sans donnée personnelle (date, sorte, nombres du bilan).

## Conséquences

- Six migrations (0218 à 0223), chacune limitée à son schéma, annulable et compatible avec l'image
  précédente ; les annulations refusent tant qu'une donnée de la reprise existe (0219 efface les
  imports des deux sortes nouvelles, comme le prévoit la spécification).
- HUB-14 (« un import s'annule en bloc ») vaut désormais aussi pour les PDF des prestataires retenus
  et du programme, une fois le paquet 71e livré ; noté dans `docs/gap.csv`.
- Les écrans (page de reprise, étape « Questions », bilan, fiche d'un mariage repris) viennent aux
  paquets 71b à 71g ; le paquet 71a ne change d'écran que ce qui en découle seul : moins de fausses
  relances sur « Aujourd'hui ».
- Deux sortes (`event_vendors`, `program`) existent au contrat sans passer encore par l'envoi de
  fichier commun (`IMPORT_FILE_ENTITY_TYPES`) : elles y entrent au paquet 71e.
