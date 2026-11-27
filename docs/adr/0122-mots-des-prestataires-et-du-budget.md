# ADR 0122 — Les mots des prestataires et du budget

- Statut : accepté (lot 73a ; décisions P2, P5 et P14 de Julien du 27/11/2026, spécification
  `docs/lots/lot-73-prestataires.md` validée le même jour, « Je valide le lot 73 »)
- Date : 2026-11-27
- Diverge de : `docs/CAHIER_DES_CHARGES.md`, PRE-02 (statuts « Pressenti, Consulté, Devis reçu, Retenu,
  Contrat signé, Soldé »), BUD-01 (« un budget à cinq montants : estimé, devisé, engagé, payé, reste ») et
  SC-04 étape 5 (« la ligne passe à « engagé » ») ; la décision du 21/11 de garder la pastille « Engagé »
  et le sous-total « dont engagé » (Q42).
- Complète : ADR 0107 (un poste du budget en une ligne), ADR 0110 (Symbola prépare, la planner envoie).
- Exigences : PRE-02, PRE-05, BUD-01 ; scénario SC-04 ; maquettes du volet 4 (pages 19 à 21, V7, V12) ;
  spécification du lot 73, § 8 (écarts 1 et 3), § 9 (textes).

## Contexte

Le cahier des charges nomme les statuts d'un prestataire rattaché à un poste comme un tableau de bord
d'acheteur (« Pressenti », « Engagé »). La planner pilote ne parle pas ainsi : un prestataire proposé est
« en comparaison » avec d'autres, un prestataire choisi est « retenu », et ce qui compte ensuite, c'est
de savoir si son contrat est signé. Le mot « engagé » n'est pas le sien : elle lit le réel du poste (le
devis retenu) et l'état du contrat. Les maquettes du volet 4 (lot 68) écrivent ces mots, et Julien les a
confirmés le 27/11 (P2, P5, P14).

## Décision

1. **« Pressenti » ne s'affiche plus** (P2, V7). Un prestataire rattaché sans être retenu est « en
   comparaison » ; le bouton qui l'y met dit « Mettre en comparaison ». La valeur `shortlisted` reste en
   base et dans les contrats : seul le mot change, en français (« En comparaison ») et en anglais
   (« Comparing »).
2. **« Retenu, contrat non signé »** (P5) : un prestataire retenu dont le contrat n'est pas signé se dit
   ainsi, partout où l'état « Retenu » s'affiche ; les autres états restent « Contrat signé » et
   « Soldé ». Il n'y a pas d'état « contrat à envoyer » ni de date d'envoi du contrat. Le jour où il a
   été retenu se garde (`events.event_vendor_candidates.retained_at`, migration 0235), posé et effacé par
   un déclencheur de la base pour que toutes les écritures (Retenir, Changer de prestataire, Retenir
   aussi, choix du client, reprise) suivent la même règle ; « retenu le … » le lit, au lieu de la
   dernière modification. Un prestataire retenu avant ce lot n'a pas de date : rien n'est reconstruit
   (P6), rien n'est écrit.
3. **Le mot « engagé » quitte l'écran** (P14, au paquet 73e). La ligne d'un poste dit le réel et l'état
   du contrat en mots ; l'en-tête dit « Réel, tout signé » quand tous les contrats le sont, sinon
   « Réel · dont 27 000,00 € signés ». **L'engagé reste calculé, en base et dans les exports** : BUD-01
   garde ses cinq montants dans les données, seul l'écran en montre quatre. SC-04 étape 5 se lit « la
   ligne dit « Contrat signé » ».
4. **Le nom d'une pièce en tête de son état, sans accord** (P3) : chaque nature de pièce a un nom court
   modifiable (« Assurance », migration 0234), sans genre grammatical enregistré ; les états se disent
   par des tournures qui ne s'accordent pas (« Assurance · à renouveler », « Kbis · à recevoir »).
5. **Le montant d'un mariage sur la fiche d'un prestataire** (P9) est le réel du poste, calculé comme la
   colonne « Réel » du budget (`slotActualCents`), le total réglé une fois soldé.

## Conséquences

- Le paquet 73a change les mots (« En comparaison », « Mettre en comparaison », « Retenu, contrat non
  signé ») et pose les données ; les écrans gardent leur forme jusqu'aux paquets 73b à 73e, qui en
  tirent la ligne du carnet, le tableau du budget et la relance.
- « Annuler » un ajout à un mariage garde l'état d'avant dans `events.task_change_snapshots` (table du
  lot 70a, même délai court), sans table nouvelle ; la tâche d'annulation des tâches n'y lit jamais un
  ajout de prestataire.
- Aucun événement interne ne change : `events.vendor_slot.booked` et `events.vendor_retention.released`
  portent toujours l'engagé au module Budget.
- `docs/gap.csv` porte l'écart sur PRE-02 et BUD-01 (avec la note de SC-04) ; `docs/QUESTIONS.md`, Q50.

## Alternatives écartées

- Garder « Pressenti » à l'écran et « Engagé » en pastille (Q42, 21/11) : les maquettes récentes priment
  (décision du 26/11) et aucune fonction ne disparaît, l'engagé restant dans les données et les exports.
- Une date « contrat envoyé » et un état « contrat à envoyer » (P5) : un geste de plus pour la planner,
  sans usage pour elle aujourd'hui.
- Poser `retained_at` dans chaque fonction du service : plus fragile, une écriture oubliée laisserait une
  date fausse ; le déclencheur garde la règle en un seul endroit, dans le schéma du module.
