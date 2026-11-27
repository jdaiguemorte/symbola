-- Lot 72a (EVT-05 ; E2, J2) : la date effective d'un changement de statut, quand elle n'est pas le jour du
-- clic (« Le contrat est signé… » à une date passée : contrat signé sur papier) ; posée aussi à
-- l'annulation. Nulle pour les lignes d'avant : elles se lisent à changed_at, dans le fuseau de
-- l'évènement. Schéma events seulement ; colonne facultative, compatible avec l'image précédente.
ALTER TABLE "events"."event_status_history" ADD COLUMN "effective_on" date;
