# ADR 0063 — Mots de passe compromis : liste locale tenue à jour

- Statut : accepté (spécification du lot 24 validée par Julien le 11/11/2026, décision D2 ;
  décision Q22 de `docs/QUESTIONS.md` : « une dépendance tenue à jour »)
- Date : 2026-11-11
- Exigences : SEC-03 de `docs/CAHIER_DES_CHARGES.md`.

## Contexte

SEC-03 demande des mots de passe de douze caractères au moins, contrôlés contre les listes de
mots de passe compromis, sans règle de composition arbitraire. Critère : « Un mot de passe connu
comme compromis est refusé. » Jusqu'au lot 24b, seule la longueur était contrôlée, à trois
endroits (réinitialisation, invitation de l'équipe, invitation du marié).

## Décision

1. **Dépendance** : `@zxcvbn-ts/language-common` 4.1.3, licence MIT, dans `@symbola/auth`. On
   n'utilise que sa liste des mots de passe les plus répandus dans les fuites publiées
   (`passwords-common`, 49 233 entrées), pas le calcul de robustesse de zxcvbn. Sa seule
   dépendance, `@zxcvbn-ts/dictionary-compression`, décompresse la liste. Environ 1,9 Mo.
2. **Hors ligne** : la liste est chargée en mémoire au premier contrôle ; aucun mot de passe,
   même haché, ne quitte le serveur. Pas de sous-traitant.
3. **Contrôle de la base du mot de passe** : la liste ne compte que 308 mots de passe de douze
   caractères ou plus. Le contrôle compare donc aussi la base du mot de passe : minuscules, sans
   les chiffres et symboles collés au début ou à la fin, sans les substitutions courantes (`@`
   pour a, `0` pour o, `3` pour e…), sans répétition. « Password1234! », « p@ssw0rd2027 » et
   « azertyazerty » sont refusés ; une phrase de passe est acceptée.
4. **Règle unique** : `checkPassword` (`packages/auth/src/password-policy.ts`), appelée à la
   réinitialisation, à l'acceptation d'une invitation de l'équipe et à celle d'un marié. Le
   message invite à choisir une phrase de plusieurs mots.
5. **Mise à jour** : par Renovate, comme toute dépendance ; une nouvelle version de la liste
   passe par une PR et les tests de `password-policy.test.ts`.

## Limites assumées

- La liste est surtout anglophone : les mots de passe français les plus courants y figurent
  (« motdepasse », « soleil », « azerty »), mais pas tous (« doudou »). Le paquet
  `@zxcvbn-ts/language-fr` (mots et prénoms français) pourrait s'ajouter ; ce serait une
  seconde dépendance, à décider par Julien.
- Le paquet a un seul mainteneur. Parade : version figée par le fichier de verrouillage,
  OSV-Scanner et Trivy en CI, mise à jour relue en PR. Si le paquet était abandonné, la liste
  (un tableau de chaînes) se reprendrait dans le dépôt sans changer le reste.
- Ce n'est pas la base des mots de passe fuités (centaines de millions d'empreintes) : la
  consulter supposerait un appel sortant vers un service tiers, écarté par Q22.

## Conséquences

- Un mot de passe choisi par une personne passe par `checkPassword` ; les mots de passe générés
  (création d'un compte en ligne de commande, jeu fictif) sont aléatoires.
- Un mot de passe existant n'est pas contrôlé rétroactivement : la règle s'applique au prochain
  changement.
