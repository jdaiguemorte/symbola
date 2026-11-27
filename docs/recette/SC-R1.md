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
