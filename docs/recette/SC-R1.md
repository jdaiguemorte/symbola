# Rejeu SC-R1 — Reprendre un mariage en cours

Scénario local du lot 71 (décision I11 de Julien du 27/11/2026 ; son entrée au § 17 du cahier des
charges reste ouverte, Q48) : Camille (SU-01) reprend « Juliette & Romain » de son tableur, puis Sophie
(SU-04) le refait à 150 %. Rejoué à chaque paquet du lot qui touche le parcours ; les écrans arrivent
aux paquets 71b à 71g.

## Lot 71a — le socle et les règles de fond

- Date : 27/11/2026, en local, par Claude Code. Base de test dédiée (`symbola_lot71a`, migrations
  jusqu'à 0223), stockage Garage et ClamAV du socle de dev. **Aucun écran** : le paquet 71a ne change
  que les règles d'écriture de l'import ; le parcours est rejoué par les services, sur les fichiers
  fictifs du tableur de la planner (`packages/testing/import-corpus/files/tableur-planner/`) et la
  fiche PDF fictive du logiciel (`logiciel-tiers/fiche-evenement-complete.pdf`), dans
  `apps/symbola/lib/import/takeovers-71a.integration.test.ts`.

| Étape du parcours | Ce qui est vérifié | Résultat |
| --- | --- | --- |
| Commencer la reprise avant le mariage | Six lignes dans l'ordre R2, « 0 fichier sur 6 », ligne du carnet déjà faite au deuxième mariage | Tenu |
| Le mariage (fiche PDF « Signé, en préparation ») | Confirmé ; statut « date non renseignée » ; aucune source ; le type de l'espace ; note dans « Notes » ; 21 650,50 € dont 3 200,00 € à répartir ; rien dans « Champs importés » ; la reprise reçoit son mariage | Tenu |
| Le budget (`budget.csv`, « Oui, payés ») | 8 727,00 € réglés, 18 775,00 € à payer, aucune échéance en retard au 24/11/2026 ; avec « Non », 6 en retard | Tenu |
| Rien n'est fondu | 14 lignes, 36 450,00 € prévus ; les trois lignes « Traiteur » sous un seul poste | Tenu |
| Les prestataires du budget | Retenus, contrat déclaré (signé, non signé, non renseigné) ; « Aujourd'hui » n'a aucun « Contrat de … à faire signer » né de l'import | Tenu |
| La liste « à faire » (`a-faire.csv`) | Les 5 tâches cochées « x » arrivent faites, date de fin non renseignée, sans auteur | Tenu (colonnes choisies à la main : « Quoi » et « Pour quand » seront reconnus au paquet 71c) |
| Les noms | « Léa MARTIN », « POITIERS » → « Léa Martin », « Poitiers » ; « Garder les capitales » les laisse | Tenu |

Mesures :

- **Le lendemain d'une reprise, aucune fausse alerte née de l'import** : tenu pour les acomptes et les
  contrats (règles de fond) ; la page « Aujourd'hui » elle-même est rejouée au paquet 71f.
- **30 minutes par mariage** : non mesuré (aucun écran) ; la cible reste au rejeu des paquets 71b à 71g.
- Sophie à 150 % : sans objet pour ce paquet (aucun écran).

## Lot 71b — la page de reprise et ses portes

- Date : 27/11/2026, en local, par Claude Code. Base de test dédiée (`symbola_lot71b`, migrations
  jusqu'à 0223), socle de dev (Garage, ClamAV, Mailpit, Logto). Rejoué **à l'écran**, à 1 440 et à
  375 px, par le parcours `apps/symbola/e2e/lot-71b-page-de-reprise.spec.ts` (16 parcours verts) et à
  la main dans le navigateur, sur les fichiers fictifs du tableur de la planner
  (`packages/testing/import-corpus/files/tableur-planner/`). Camille seulement : Sophie à 150 % reste au
  paquet 71g (messages d'erreur) et au rejeu d'ensemble.

| Étape du parcours | Ce qui est vérifié | Résultat |
| --- | --- | --- |
| Arriver sur la reprise | Par « Nouvel évènement › Reprendre ses fichiers », la fin de l'assistant (réponse « un tableur »), la recherche, l'état « À vérifier » de « Tâches » | Tenu |
| La page vide | Six lignes dans l'ordre (carnet, mariage, budget, prestataires retenus, liste « à faire », programme), « 0 fichier sur 6 », seule action principale sur la ligne 1, lignes 3 à 6 « Après le mariage » sans bouton ; rien n'est écrit avant le premier geste | Tenu |
| Le carnet | « Je n'ai pas ce fichier » règle la ligne (« Pas de fichier · Choisi le … ») et se défait par « Déposer un fichier », qui ouvre l'import du carnet avec « ‹ Reprendre un mariage en cours » en tête | Tenu |
| Le mariage | « Saisir les noms et la date » : « Juliette & Romain », 20/03/2027 ; Confirmé, d'origine « reprise », statut « date non renseignée », aucune tâche ; message de retour « Mariage enregistré » | Tenu |
| Le budget (`budget.csv`) | Déposé depuis sa ligne : rattaché au mariage (« Les lignes iront dans l'évènement « Juliette & Romain » »), la ligne « En cours », « Arrêté à « Colonnes » », « Continuer » en bouton plein ; la ligne 4 « Avec le budget : votre budget nomme 7 prestataires » dès le dépôt ; « 3 fichiers sur 6 » | Tenu |
| Un import laissé en plan | En tête de « Reprendre et importer » (« Import en cours : budget.csv, pour « Juliette & Romain » ») ; « Abandonner cet import… » demande confirmation et rend la ligne | Tenu |
| La fin | Six lignes réglées : « Reprise terminée. Il reste 3 points à compléter à la main. » (les tâches, le lien des mariés, les invités), « Ouvrir « À compléter » », jamais « à jour » ; « Reprendre un autre mariage » repart d'une page où le carnet est déjà fait | Tenu |

Mesures :

- **Aucune commande sous 44 px, aucun défilement de côté à 375 px** sur la page vide, en cours, terminée,
  « Saisir les noms et la date », « Reprendre et importer » et la fin de l'assistant (qui avait un
  bouton « Ouvrir l'exemple » de 40 px, corrigé).
- **axe-core** : aucune violation sur la page vide, en cours, terminée, « Reprendre et importer » et la fin
  de l'assistant.
- **30 minutes par mariage** : non mesuré ; l'assistant d'import lui-même change aux paquets 71c à 71e.
- Ce qui reste provisoire jusqu'au 71c : chaque ligne ouvre l'assistant d'import d'avant (sans l'étape
  « Questions ») ; les PDF des prestataires retenus et du programme s'ouvrent sur la fiche du mariage et
  cochent leur ligne sans bilan (paquet 71e).
