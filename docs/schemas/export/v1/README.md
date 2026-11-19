# Format symbola.export/v1 — entités et exclusions

Fichier généré (`pnpm --filter @symbola/app export:schemas`) : ne pas le modifier à la main.
Le format est décrit dans `docs/export/format-v1.md`.

## Module `hub`

| Entité | Champs | Schéma |
| --- | --- | --- |
| `organizations` | `id`, `name`, `language`, `siret`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [organizations.schema.json](hub/organizations.schema.json) |
| `organization_profiles` | `siren`, `address`, `logoKey`, `logoSizeBytes`, `legalForm`, `metier`, `metierPrecision`, `vatRegime`, `vatRateDefaultBasisPoints`, `annualEventVolume`, `replacedTools`, `completedAt`, `setupStep`, `setupCompletedAt`, `quoteFollowUpDays`, `prospectFollowUpDays`, `contactEmail`, `contactPhone`, `website`, `vatNumber`, `registration`, `shareCapitalCents`, `insurer`, `insurancePolicy`, `insuranceCoverage`, `mediatorName`, `mediatorUrl`, `generalTerms`, `postalCode`, `city`, `countryCode`, `vatOnDebits`, `vatOnDebitsFrom`, `updatedAt`, `createdAt`, `createdBy`, `updatedBy` | [organization_profiles.schema.json](hub/organization_profiles.schema.json) |
| `organization_modules` | `moduleKey`, `enabled`, `updatedAt`, `createdAt`, `createdBy`, `updatedBy` | [organization_modules.schema.json](hub/organization_modules.schema.json) |
| `vat_regime_changes` | `id`, `previousRegime`, `newRegime`, `effectiveDate`, `changedByUserId`, `createdAt`, `createdBy` | [vat_regime_changes.schema.json](hub/vat_regime_changes.schema.json) |
| `contacts` | `id`, `kind`, `firstName`, `lastName`, `name`, `email`, `phone`, `addressLine`, `postalCode`, `city`, `country`, `billingAddress`, `companyIdNumber`, `vatNumber`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [contacts.schema.json](hub/contacts.schema.json) |
| `contact_notes` | `id`, `contactId`, `authorUserId`, `body`, `isConfidential`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [contact_notes.schema.json](hub/contact_notes.schema.json) |
| `contact_duplicates` | `id`, `firstContactId`, `secondContactId`, `reason`, `detectedAt`, `dismissedAt`, `dismissedBy`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [contact_duplicates.schema.json](hub/contact_duplicates.schema.json) |
| `contact_merges` | `id`, `keptContactId`, `absorbedContactId`, `fieldsFromAbsorbed`, `mergedByUserId`, `mergedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [contact_merges.schema.json](hub/contact_merges.schema.json) |
| `contact_members` | `id`, `groupContactId`, `memberContactId`, `role`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [contact_members.schema.json](hub/contact_members.schema.json) |
| `email_templates` | `id`, `kind`, `locale`, `subject`, `body`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [email_templates.schema.json](hub/email_templates.schema.json) |
| `message_templates` | `id`, `eventTypeId`, `name`, `locale`, `version`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [message_templates.schema.json](hub/message_templates.schema.json) |
| `message_template_versions` | `id`, `templateId`, `version`, `subject`, `body`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [message_template_versions.schema.json](hub/message_template_versions.schema.json) |
| `privacy_settings` | `requestAlertDays`, `prospectRetentionMonths`, `clientRetentionMonths`, `accountingRetentionMonths`, `inactiveAccountMonths`, `signedQuoteRetentionMonths`, `requestProofRetentionMonths`, `linkPrivacyNotice`, `guestRetentionDays`, `guestDietRetentionDays`, `guestPurgeMaxPostponeDays`, `updatedAt`, `createdAt`, `createdBy`, `updatedBy` | [privacy_settings.schema.json](hub/privacy_settings.schema.json) |
| `privacy_requests` | `id`, `type`, `personLabel`, `receivedOn`, `dueOn`, `status`, `extensionReason`, `extendedAt`, `closedAt`, `actionDoneAt`, `responseSentAt`, `createdByUserId`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | [privacy_requests.schema.json](hub/privacy_requests.schema.json) |
| `privacy_exports` | `id`, `requestId`, `recordCount`, `createdByUserId`, `createdAt`, `expiresAt`, `purgedAt`, `createdBy`, `updatedAt`, `updatedBy` | [privacy_exports.schema.json](hub/privacy_exports.schema.json) |
| `privacy_erasures` | `id`, `requestId`, `status`, `items`, `acks`, `createdByUserId`, `createdAt`, `completedAt`, `createdBy` | [privacy_erasures.schema.json](hub/privacy_erasures.schema.json) |
| `privacy_purges` | `id`, `period`, `status`, `lines`, `items`, `acks`, `createdByUserId`, `createdAt`, `completedAt`, `createdBy` | [privacy_purges.schema.json](hub/privacy_purges.schema.json) |
| `activity_journal` | `id`, `occurredAt`, `actorKind`, `actorId`, `action`, `category`, `objectType`, `objectId`, `details`, `reason` | [activity_journal.schema.json](hub/activity_journal.schema.json) |
| `team_members` | `userId`, `email`, `role`, `disabledAt` | [team_members.schema.json](hub/team_members.schema.json) |

Tables non exportées :

- `sessions` — secret : sessions ouvertes (jetons hachés)
- `invitations` — secret : invitations en attente (jetons hachés) ; une invitation se renvoie
- `users` — identité : les comptes sont listés dans team_members ; leurs identifiants de connexion restent chez le fournisseur d'identité
- `memberships` — identité : listées dans team_members
- `help_progress` — préférence : avancement de l'aide à l'écran, propre à chaque compte
- `user_tour_seen` — préférence : visites guidées vues, propres à chaque compte
- `imports` — technique : imports en cours ou confirmés, purgés ; les données importées sont dans leurs entités
- `import_items` — technique : détail des imports, gardé pour leur annulation puis purgé
- `import_jobs` — technique : traitements de fond des imports
- `platform_settings` — exploitation : réglages de la plateforme Symbola
- `backup_runs` — exploitation : sauvegardes de la plateforme
- `connection_traces` — exploitation : adresses IP des connexions, pour l'enquête de sécurité
- `organization_exports` — technique : trace des exports complets eux-mêmes
- `storage_snapshots` — exploitation : relevé mensuel du stockage (nombres de fichiers et volumes)
- `calendar_feeds` — secret : adresses des flux de calendrier (jetons hachés), propres à chaque personne
- `form_drafts` — temporaire : brouillons de saisie, effacés à l'enregistrement et purgés après 30 jours
- `jobs` — temporaire : e-mails en attente d'envoi ; contenu effacé à la fin, ligne purgée après 30 jours
- `domain_events` — technique : événements internes entre modules
- `domain_event_consumers` — technique : suivi des événements internes
- `rate_limit_events` — exploitation : tentatives limitées
- `usage_counters` — exploitation : compteurs d'usage de la plateforme

## Module `events`

| Entité | Champs | Schéma |
| --- | --- | --- |
| `default_vendor_slots` | `id`, `label`, `icon`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [default_vendor_slots.schema.json](events/default_vendor_slots.schema.json) |
| `event_types` | `id`, `label`, `audience`, `position`, `starterKey`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_types.schema.json](events/event_types.schema.json) |
| `prospect_sources` | `id`, `label`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [prospect_sources.schema.json](events/prospect_sources.schema.json) |
| `loss_reasons` | `id`, `label`, `isFreeText`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [loss_reasons.schema.json](events/loss_reasons.schema.json) |
| `pipeline_stages` | `id`, `label`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [pipeline_stages.schema.json](events/pipeline_stages.schema.json) |
| `contact_forms` | `id`, `active`, `slug`, `hiddenFields`, `privacyPolicyUrl`, `allowedOrigins`, `notifyOwner`, `locale`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [contact_forms.schema.json](events/contact_forms.schema.json) |
| `task_templates` | `id`, `name`, `eventTypeId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [task_templates.schema.json](events/task_templates.schema.json) |
| `task_template_items` | `id`, `templateId`, `label`, `offsetDays`, `responsible`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [task_template_items.schema.json](events/task_template_items.schema.json) |
| `program_templates` | `id`, `name`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [program_templates.schema.json](events/program_templates.schema.json) |
| `program_template_items` | `id`, `templateId`, `startTime`, `endTime`, `label`, `location`, `participantLabels`, `position`, `momentName`, `dayOffset`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [program_template_items.schema.json](events/program_template_items.schema.json) |
| `day_checklist_templates` | `id`, `starterKey`, `name`, `phase`, `items`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [day_checklist_templates.schema.json](events/day_checklist_templates.schema.json) |
| `vendor_coordination_settings` | `briefDeadlineDays`, `briefReminder`, `roadmapMonth`, `roadmapWeek`, `roadmapAlertDays`, `followUpTasks`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_coordination_settings.schema.json](events/vendor_coordination_settings.schema.json) |
| `prospect_follow_up_settings` | `id`, `enabled`, `autoSend`, `steps`, `brochureStorageKey`, `brochureFileName`, `brochureSizeBytes`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [prospect_follow_up_settings.schema.json](events/prospect_follow_up_settings.schema.json) |
| `questionnaire_templates` | `id`, `eventTypeId`, `name`, `locale`, `starterKey`, `version`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [questionnaire_templates.schema.json](events/questionnaire_templates.schema.json) |
| `questionnaire_template_items` | `id`, `templateId`, `version`, `position`, `itemKey`, `label`, `help`, `nature`, `choices`, `eventField`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [questionnaire_template_items.schema.json](events/questionnaire_template_items.schema.json) |
| `events` | `id`, `status`, `eventDate`, `timeZone`, `postponedFromDate`, `postponedFromStatus`, `guestsEstimated`, `guestsConfirmed`, `style`, `notes`, `notesConfidentialBy`, `importedFields`, `wantedBudgetCents`, `prospectSourceId`, `eventTypeId`, `lossReasonId`, `lossReasonNote`, `pipelineStageId`, `tasksScheduledFor`, `programUpdatedAt`, `demoExpiresAt`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`, `deletedBy` | [events.schema.json](events/events.schema.json) |
| `event_clients` | `id`, `eventId`, `contactId`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_clients.schema.json](events/event_clients.schema.json) |
| `event_status_history` | `id`, `eventId`, `fromStatus`, `toStatus`, `changedByUserId`, `changedAt`, `createdBy` | [event_status_history.schema.json](events/event_status_history.schema.json) |
| `event_places` | `id`, `eventId`, `label`, `address`, `city`, `startTime`, `endTime`, `contactName`, `contactPhone`, `contactEmail`, `vendorId`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [event_places.schema.json](events/event_places.schema.json) |
| `prospect_requests` | `id`, `eventId`, `state`, `message`, `period`, `budgetRange`, `pending`, `receivedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [prospect_requests.schema.json](events/prospect_requests.schema.json) |
| `key_moments` | `id`, `eventId`, `name`, `date`, `startTime`, `placeId`, `position`, `autoCreated`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [key_moments.schema.json](events/key_moments.schema.json) |
| `event_day_contacts` | `id`, `eventId`, `name`, `role`, `phone`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_day_contacts.schema.json](events/event_day_contacts.schema.json) |
| `event_document_folders` | `id`, `eventId`, `name`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_document_folders.schema.json](events/event_document_folders.schema.json) |
| `event_documents` | `id`, `eventId`, `label`, `fileKey`, `mime`, `sizeBytes`, `uploadedByUserId`, `uploadedByLinkId`, `folderId`, `sharedWithClients`, `sharedWithVendors`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [event_documents.schema.json](events/event_documents.schema.json) |
| `event_document_versions` | `id`, `documentId`, `version`, `fileKey`, `mime`, `sizeBytes`, `uploadedByUserId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_document_versions.schema.json](events/event_document_versions.schema.json) |
| `event_day_documents` | `id`, `eventId`, `source`, `sourceId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_day_documents.schema.json](events/event_day_documents.schema.json) |
| `event_vendor_slots` | `id`, `eventId`, `label`, `notRequired`, `position`, `importedFields`, `brief`, `icon`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | [event_vendor_slots.schema.json](events/event_vendor_slots.schema.json) |
| `vendor_briefs` | `id`, `eventId`, `vendorSlotId`, `need`, `guestCount`, `indicativeBudgetCents`, `showBudget`, `deadline`, `sentAt`, `sentByUserId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_briefs.schema.json](events/vendor_briefs.schema.json) |
| `vendor_brief_documents` | `id`, `briefId`, `documentId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_brief_documents.schema.json](events/vendor_brief_documents.schema.json) |
| `event_vendor_candidates` | `id`, `eventId`, `vendorSlotId`, `vendorId`, `vendorName`, `status`, `contactedOn`, `quoteAmountCents`, `currency`, `quoteFileKey`, `quoteMime`, `quoteSizeBytes`, `shownToClients`, `shareRibWithClients`, `position`, `briefId`, `availability`, `answeredAt`, `answerMessage`, `remindedAt`, `dismissalReason`, `invoiceDocumentId`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | [event_vendor_candidates.schema.json](events/event_vendor_candidates.schema.json) |
| `vendor_scenarios` | `id`, `eventId`, `name`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_scenarios.schema.json](events/vendor_scenarios.schema.json) |
| `vendor_scenario_choices` | `id`, `scenarioId`, `vendorSlotId`, `candidateId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_scenario_choices.schema.json](events/vendor_scenario_choices.schema.json) |
| `vendor_roadmaps` | `id`, `candidateId`, `stage`, `sentAt`, `confirmedAt`, `programVersion`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_roadmaps.schema.json](events/vendor_roadmaps.schema.json) |
| `event_vendor_candidate_notes` | `id`, `candidateId`, `body`, `visibleToClients`, `createdByUserId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_vendor_candidate_notes.schema.json](events/event_vendor_candidate_notes.schema.json) |
| `event_tasks` | `id`, `eventId`, `label`, `dueDate`, `offsetDays`, `fixedAt`, `responsible`, `vendorCandidateId`, `followUpCandidateId`, `doneAt`, `position`, `importedFields`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`, `deletedBy` | [event_tasks.schema.json](events/event_tasks.schema.json) |
| `event_task_comments` | `id`, `eventId`, `taskId`, `authorUserId`, `body`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [event_task_comments.schema.json](events/event_task_comments.schema.json) |
| `event_task_attachments` | `id`, `eventId`, `taskId`, `label`, `fileKey`, `mime`, `sizeBytes`, `uploadedByUserId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_task_attachments.schema.json](events/event_task_attachments.schema.json) |
| `program_items` | `id`, `eventId`, `startTime`, `endTime`, `label`, `location`, `internalNote`, `responsible`, `keyMomentId`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`, `deletedBy` | [program_items.schema.json](events/program_items.schema.json) |
| `program_item_participants` | `id`, `programItemId`, `vendorSlotId`, `freeLabel`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [program_item_participants.schema.json](events/program_item_participants.schema.json) |
| `program_versions` | `id`, `eventId`, `number`, `publishedAt`, `publishedByUserId`, `items`, `notifiedAt`, `notifiedCount`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [program_versions.schema.json](events/program_versions.schema.json) |
| `day_checkpoints` | `id`, `eventId`, `programItemId`, `kind`, `deviceAt`, `userId`, `actionId`, `receivedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [day_checkpoints.schema.json](events/day_checkpoints.schema.json) |
| `day_shifts` | `id`, `eventId`, `keyMomentId`, `lateItemId`, `minutes`, `itemIds`, `vendorSlotIds`, `validatedAt`, `validatedBy`, `actionId`, `outcome`, `appliedAt`, `programVersion`, `notifiedAt`, `notifiedCount`, `receivedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [day_shifts.schema.json](events/day_shifts.schema.json) |
| `day_incidents` | `id`, `eventId`, `keyMomentId`, `body`, `severity`, `deviceAt`, `userId`, `actionId`, `receivedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [day_incidents.schema.json](events/day_incidents.schema.json) |
| `day_checklists` | `id`, `eventId`, `keyMomentId`, `templateId`, `name`, `phase`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [day_checklists.schema.json](events/day_checklists.schema.json) |
| `day_checklist_items` | `id`, `checklistId`, `label`, `position`, `checkedAt`, `checkedBy`, `checkActionId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [day_checklist_items.schema.json](events/day_checklist_items.schema.json) |
| `day_photos` | `id`, `eventId`, `subject`, `subjectId`, `state`, `rejection`, `storageKey`, `contentType`, `sizeBytes`, `takenAt`, `takenBy`, `actionId`, `receivedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [day_photos.schema.json](events/day_photos.schema.json) |
| `day_reports` | `id`, `eventId`, `preparedAt`, `summary`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [day_reports.schema.json](events/day_reports.schema.json) |
| `event_links` | `id`, `eventId`, `audience`, `personName`, `email`, `eventClientId`, `contactId`, `rubrics`, `budgetScope`, `vendorCandidateId`, `otpRequired`, `taskReminders`, `locale`, `customExpiresOn`, `renewalRequestedAt`, `lastOpenedAt`, `programVersionSeen`, `revokedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_links.schema.json](events/event_links.schema.json) |
| `event_link_shared_slots` | `id`, `linkId`, `vendorSlotId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_link_shared_slots.schema.json](events/event_link_shared_slots.schema.json) |
| `event_document_links` | `id`, `eventId`, `documentId`, `expiresAt`, `revokedAt`, `createdByUserId`, `openCount`, `lastOpenedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_document_links.schema.json](events/event_document_links.schema.json) |
| `event_decisions` | `id`, `eventId`, `kind`, `subjectId`, `slotId`, `title`, `note`, `snapshot`, `dueOn`, `status`, `choiceId`, `comment`, `decidedByLinkId`, `decidedByName`, `decidedAt`, `replacesDecisionId`, `engagedAt`, `requestedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_decisions.schema.json](events/event_decisions.schema.json) |
| `event_decision_option_feedback` | `id`, `decisionId`, `candidateId`, `linkId`, `opinion`, `comment`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_decision_option_feedback.schema.json](events/event_decision_option_feedback.schema.json) |
| `event_activities` | `id`, `eventId`, `actorUserId`, `actorLinkId`, `kind`, `taskId`, `taskLabel`, `vendorCandidateId`, `createdAt`, `createdBy` | [event_activities.schema.json](events/event_activities.schema.json) |
| `event_messages` | `id`, `eventId`, `contactId`, `kind`, `delivery`, `templateId`, `templateVersion`, `subject`, `body`, `brochureExpiresAt`, `sentByUserId`, `occurredAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_messages.schema.json](events/event_messages.schema.json) |
| `prospect_follow_ups` | `id`, `eventId`, `contactId`, `anchorMessageId`, `rank`, `readyAt`, `subject`, `body`, `sentAt`, `sentMessageId`, `stoppedAt`, `stopReason`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [prospect_follow_ups.schema.json](events/prospect_follow_ups.schema.json) |
| `event_questionnaires` | `id`, `eventId`, `contactId`, `linkId`, `templateId`, `templateVersion`, `name`, `locale`, `questions`, `sentAt`, `finishedAt`, `seenAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_questionnaires.schema.json](events/event_questionnaires.schema.json) |
| `questionnaire_answers` | `id`, `questionnaireId`, `itemKey`, `value`, `answeredAt`, `resolution`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [questionnaire_answers.schema.json](events/questionnaire_answers.schema.json) |

Tables non exportées :

- `event_link_codes` — secret : codes à usage unique des liens personnels (hachés)
- `event_link_sessions` — secret : sessions ouvertes par les liens personnels (jetons hachés)
- `event_task_reminders` — technique : rappels déjà envoyés par les liens, qui ne sont pas repris

## Module `budget`

| Entité | Champs | Schéma |
| --- | --- | --- |
| `allocation_models` | `id`, `name`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [allocation_models.schema.json](budget/allocation_models.schema.json) |
| `allocation_model_items` | `id`, `modelId`, `defaultVendorSlotId`, `percentageBasisPoints`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [allocation_model_items.schema.json](budget/allocation_model_items.schema.json) |
| `alert_thresholds` | `id`, `eventId`, `percent`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [alert_thresholds.schema.json](budget/alert_thresholds.schema.json) |
| `event_budgets` | `id`, `eventId`, `totalAmountCents`, `guestCount`, `allocationModelId`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | [event_budgets.schema.json](budget/event_budgets.schema.json) |
| `event_budget_items` | `id`, `eventBudgetId`, `defaultVendorSlotId`, `amountCents`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | [event_budget_items.schema.json](budget/event_budget_items.schema.json) |
| `budget_lines` | `id`, `eventId`, `eventVendorSlotId`, `label`, `vendorCandidateId`, `position`, `estimatedAmountCents`, `quotedAmountCents`, `committedAmountCents`, `paidAmountCents`, `vatRateBasisPoints`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`, `deletedBy` | [budget_lines.schema.json](budget/budget_lines.schema.json) |
| `event_payers` | `id`, `eventId`, `name`, `kind`, `linkId`, `ownShareOnly`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_payers.schema.json](budget/event_payers.schema.json) |
| `budget_line_payer_shares` | `id`, `lineId`, `payerId`, `percentageBasisPoints`, `amountCents`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [budget_line_payer_shares.schema.json](budget/budget_line_payer_shares.schema.json) |
| `planner_instalment_payers` | `id`, `eventId`, `scheduleItemId`, `payerId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [planner_instalment_payers.schema.json](budget/planner_instalment_payers.schema.json) |
| `budget_line_history` | `id`, `lineId`, `field`, `oldValueCents`, `newValueCents`, `changedByUserId`, `changedAt`, `createdBy` | [budget_line_history.schema.json](budget/budget_line_history.schema.json) |
| `budget_line_attachments` | `id`, `lineId`, `kind`, `fileKey`, `mime`, `sizeBytes`, `uploadedByUserId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [budget_line_attachments.schema.json](budget/budget_line_attachments.schema.json) |
| `vendor_payments` | `id`, `eventId`, `lineId`, `label`, `fixedAmountCents`, `percentageBasisPoints`, `dueOn`, `paidOn`, `declaredPaidOn`, `declaredMethod`, `declaredByLinkId`, `declaredAt`, `refusalReason`, `refusedAt`, `handoverOnDay`, `handoverMethod`, `handoverBy`, `handedOverAt`, `handedOverBy`, `handoverActionId`, `handoverReceiptPhotoId`, `payerId`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [vendor_payments.schema.json](budget/vendor_payments.schema.json) |

Toutes les tables du module sont exportées.


## Module `quotes`

| Entité | Champs | Schéma |
| --- | --- | --- |
| `quote_settings` | `id`, `validityDays`, `quotePrefix`, `invoicePrefix`, `creditNotePrefix`, `upcomingHorizonDays`, `invoicePaymentTermDays`, `invoiceMentions`, `documentColor`, `documentFont`, `iban`, `bic`, `quoteIntro`, `quoteTerms`, `invoiceIntro`, `documentFooter`, `advanceKindDefault`, `invoiceMentionsProfessional`, `latePenaltyRate`, `receiptPrefix`, `professionalPaymentTermDays`, `professionalPaymentTermEndOfMonth`, `professionalDiscountTerms`, `expiryReminderDays`, `paymentReminderDays`, `consumerLatePenaltyBasisPoints`, `updatedAt`, `createdAt`, `createdBy`, `updatedBy` | [quote_settings.schema.json](quotes/quote_settings.schema.json) |
| `number_series` | `id`, `kind`, `year`, `lastNumber` | [number_series.schema.json](quotes/number_series.schema.json) |
| `payment_methods` | `id`, `label`, `position`, `archivedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [payment_methods.schema.json](quotes/payment_methods.schema.json) |
| `catalog_items` | `id`, `label`, `description`, `unit`, `unitPriceCents`, `vatRateBasisPoints`, `category`, `nature`, `importedFields`, `archivedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [catalog_items.schema.json](quotes/catalog_items.schema.json) |
| `contract_templates` | `id`, `eventTypeId`, `name`, `title`, `version`, `legalReviewedOn`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [contract_templates.schema.json](quotes/contract_templates.schema.json) |
| `contract_template_clauses` | `id`, `templateId`, `title`, `body`, `optional`, `role`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [contract_template_clauses.schema.json](quotes/contract_template_clauses.schema.json) |
| `contract_template_acceptances` | `id`, `templateId`, `templateVersion`, `userId`, `acceptedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [contract_template_acceptances.schema.json](quotes/contract_template_acceptances.schema.json) |
| `quote_templates` | `id`, `eventTypeId`, `name`, `version`, `globalDiscountKind`, `globalDiscountValue`, `advanceKind`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [quote_templates.schema.json](quotes/quote_templates.schema.json) |
| `quote_template_sections` | `id`, `templateId`, `title`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [quote_template_sections.schema.json](quotes/quote_template_sections.schema.json) |
| `quote_template_lines` | `id`, `templateId`, `sectionId`, `catalogItemId`, `label`, `description`, `unit`, `quantityMilli`, `unitPriceCents`, `vatRateBasisPoints`, `discountBasisPoints`, `isOption`, `position`, `nature`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [quote_template_lines.schema.json](quotes/quote_template_lines.schema.json) |
| `quote_template_schedule_items` | `id`, `templateId`, `label`, `amountCents`, `percentageBasisPoints`, `dueRule`, `daysBeforeEvent`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [quote_template_schedule_items.schema.json](quotes/quote_template_schedule_items.schema.json) |
| `proposal_templates` | `id`, `eventTypeId`, `greeting`, `blocks`, `photos`, `version`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [proposal_templates.schema.json](quotes/proposal_templates.schema.json) |
| `quotes` | `id`, `eventId`, `number`, `status`, `currentVersion`, `clientKind`, `createdByUserId`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`, `deletedBy`, `buyerContactId`, `clientOrderReference`, `buyerReference`, `deliveryAddress` | [quotes.schema.json](quotes/quotes.schema.json) |
| `quote_versions` | `id`, `quoteId`, `version`, `globalDiscountKind`, `globalDiscountValue`, `validUntil`, `vatRegime`, `legalMention`, `sellerSnapshot`, `totalsSnapshot`, `sentAt`, `advanceKind`, `optionsChosenAt`, `optionsChosenBy`, `optionsChosenByKind`, `templateId`, `templateVersion`, `proposalGreeting`, `proposalTemplateId`, `proposalTemplateVersion`, `expiryRemindedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [quote_versions.schema.json](quotes/quote_versions.schema.json) |
| `quote_sections` | `id`, `versionId`, `title`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [quote_sections.schema.json](quotes/quote_sections.schema.json) |
| `quote_lines` | `id`, `versionId`, `catalogItemId`, `label`, `description`, `unit`, `quantityMilli`, `unitPriceCents`, `vatRateBasisPoints`, `discountBasisPoints`, `position`, `sectionId`, `isOption`, `optionChosen`, `nature`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [quote_lines.schema.json](quotes/quote_lines.schema.json) |
| `payment_schedule_items` | `id`, `versionId`, `label`, `amountCents`, `percentageBasisPoints`, `dueDate`, `paidOn`, `paymentMethodId`, `paidRecordedAt`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [payment_schedule_items.schema.json](quotes/payment_schedule_items.schema.json) |
| `contracts` | `id`, `quoteId`, `quoteVersionId`, `version`, `templateId`, `templateVersion`, `templateReviewedOn`, `title`, `clauses`, `conclusionChannel`, `clientCategory`, `smallBusinessConfirmed`, `withdrawalApplies`, `signatureLevel`, `generatedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [contracts.schema.json](quotes/contracts.schema.json) |
| `contract_signer_acts` | `id`, `contractId`, `signerId`, `kind`, `signerName`, `presentedText`, `actedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [contract_signer_acts.schema.json](quotes/contract_signer_acts.schema.json) |
| `signature_requests` | `id`, `versionId`, `provider`, `externalId`, `status`, `kind`, `contractId`, `signedDocumentKey`, `auditCertificateKey`, `signedDocumentSha256`, `auditCertificateSha256`, `signedDocumentSizeBytes`, `auditCertificateSizeBytes`, `createdAt`, `completedAt`, `createdBy`, `updatedAt`, `updatedBy` | [signature_requests.schema.json](quotes/signature_requests.schema.json) |
| `quote_signers` | `id`, `requestId`, `eventClientId`, `contactId`, `name`, `email`, `billingAddress`, `externalId`, `status`, `signedAt`, `signingCodeVerifiedAt`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [quote_signers.schema.json](quotes/quote_signers.schema.json) |
| `contract_evidence` | `id`, `requestId`, `contractId`, `documentKey`, `sha256`, `sizeBytes`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [contract_evidence.schema.json](quotes/contract_evidence.schema.json) |
| `invoices` | `id`, `quoteId`, `versionId`, `scheduleItemId`, `kind`, `number`, `issuedAt`, `issuedOn`, `serviceDate`, `paymentDueOn`, `amountCents`, `vatRegime`, `legalMention`, `mentions`, `sellerSnapshot`, `buyerSnapshot`, `linesSnapshot`, `totalsSnapshot`, `createdBy`, `reformSnapshot` | [invoices.schema.json](quotes/invoices.schema.json) |
| `scheduled_deposit_invoices` | `id`, `quoteId`, `versionId`, `scheduleItemId`, `issueOn`, `paymentNotBefore`, `status`, `missingFields`, `invoiceId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [scheduled_deposit_invoices.schema.json](quotes/scheduled_deposit_invoices.schema.json) |
| `credit_notes` | `id`, `invoiceId`, `number`, `issuedAt`, `issuedOn`, `amountCents`, `reason`, `legalMention`, `sellerSnapshot`, `buyerSnapshot`, `totalsSnapshot`, `createdBy`, `reformSnapshot` | [credit_notes.schema.json](quotes/credit_notes.schema.json) |
| `payment_entries` | `id`, `scheduleItemId`, `kind`, `amountCents`, `paidOn`, `paymentMethodId`, `paymentMethodLabel`, `reversesEntryId`, `reason`, `createdAt`, `createdBy` | [payment_entries.schema.json](quotes/payment_entries.schema.json) |
| `earnest_receipts` | `id`, `quoteId`, `scheduleItemId`, `paymentEntryId`, `number`, `issuedAt`, `issuedOn`, `paidOn`, `amountCents`, `label`, `paymentMethodLabel`, `sellerSnapshot`, `buyerSnapshot`, `createdBy` | [earnest_receipts.schema.json](quotes/earnest_receipts.schema.json) |
| `payment_references` | `id`, `scheduleItemId`, `reference`, `declaredAt`, `declaredPaidOn`, `declaredByLinkId`, `declaredByName`, `remindersSuspendedAt`, `remindersSuspensionReason`, `remindersSuspendedBy`, `detailsMailedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [payment_references.schema.json](quotes/payment_references.schema.json) |
| `payment_reminders` | `id`, `scheduleItemId`, `rank`, `dueOn`, `sentAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [payment_reminders.schema.json](quotes/payment_reminders.schema.json) |
| `original_documents` | `id`, `documentKind`, `documentId`, `storageKey`, `sha256`, `byteSize`, `isReconstructed`, `createdAt`, `createdBy`, `format` | [original_documents.schema.json](quotes/original_documents.schema.json) |
| `ledger_entries` | `id`, `sequence`, `entryKind`, `objectId`, `payload`, `previousHash`, `hash`, `isBackfill`, `recordedAt`, `createdBy` | [ledger_entries.schema.json](quotes/ledger_entries.schema.json) |

Tables non exportées :

- `signature_webhook_log` — technique : notifications reçues du fournisseur de signature

## Module `vendors`

| Entité | Champs | Schéma |
| --- | --- | --- |
| `vendor_families` | `id`, `label`, `color`, `icon`, `position`, `starterKey`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_families.schema.json](vendors/vendor_families.schema.json) |
| `vendor_types` | `id`, `label`, `color`, `position`, `familyId`, `starterKey`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_types.schema.json](vendors/vendor_types.schema.json) |
| `vendor_type_fields` | `id`, `typeId`, `label`, `kind`, `choices`, `isFilter`, `position`, `ruleKey`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_type_fields.schema.json](vendors/vendor_type_fields.schema.json) |
| `vendor_tag_groups` | `id`, `label`, `exclusive`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_tag_groups.schema.json](vendors/vendor_tag_groups.schema.json) |
| `vendor_tags` | `id`, `label`, `groupId`, `familyIds`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_tags.schema.json](vendors/vendor_tags.schema.json) |
| `vendors` | `id`, `typeId`, `name`, `contactName`, `email`, `phone`, `addressLine`, `postalCode`, `city`, `country`, `latitude`, `longitude`, `locationSource`, `internalNote`, `internalNoteConfidentialBy`, `ibanMasked`, `rating`, `indicativePrices`, `website`, `socialLinks`, `siret`, `importedFields`, `fieldValues`, `tagIds`, `archivedAt`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | [vendors.schema.json](vendors/vendors.schema.json) |
| `vendor_files` | `id`, `vendorId`, `kind`, `fileName`, `fileKey`, `mime`, `sizeBytes`, `uploadedByUserId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_files.schema.json](vendors/vendor_files.schema.json) |
| `vendor_settings` | `detourFactorPermille`, `averageSpeedKmh`, `familiesSeededAt`, `documentAlertDays`, `documentKindsSeededAt`, `venueFieldsSeededAt`, `updatedAt`, `createdAt`, `createdBy`, `updatedBy` | [vendor_settings.schema.json](vendors/vendor_settings.schema.json) |
| `vendor_document_kinds` | `id`, `label`, `expires`, `starterKey`, `position`, `archivedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_document_kinds.schema.json](vendors/vendor_document_kinds.schema.json) |
| `vendor_documents` | `id`, `vendorId`, `kindId`, `status`, `fileName`, `fileKey`, `mime`, `sizeBytes`, `validUntil`, `uploadedByUserId`, `uploadedByLinkId`, `uploadedAt`, `requestedAt`, `verifiedAt`, `verifiedByUserId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_documents.schema.json](vendors/vendor_documents.schema.json) |
| `vendor_bank_changes` | `id`, `vendorId`, `previousMasked`, `nextMasked`, `changedByUserId`, `changedByLinkId`, `changedAt`, `verifiedAt`, `verifiedByUserId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_bank_changes.schema.json](vendors/vendor_bank_changes.schema.json) |

Toutes les tables du module sont exportées.


## Module `guests`

| Entité | Champs | Schéma |
| --- | --- | --- |
| `module_settings` | `impactAssessmentConfirmedAt`, `impactAssessmentConfirmedBy`, `privacyNotice`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [module_settings.schema.json](guests/module_settings.schema.json) |
| `dietary_options` | `id`, `kind`, `starterKey`, `label`, `hidden`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [dietary_options.schema.json](guests/dietary_options.schema.json) |
| `meal_types` | `id`, `starterKey`, `label`, `hidden`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [meal_types.schema.json](guests/meal_types.schema.json) |
| `event_settings` | `id`, `eventId`, `responsesCloseOn`, `askDiet`, `askAccommodation`, `askTransport`, `reminderDays`, `invitationsSentAt`, `dietPurgeNoticeAt`, `purgeNoticeAt`, `dietsPurgedAt`, `purgedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [event_settings.schema.json](guests/event_settings.schema.json) |
| `household_groups` | `id`, `eventId`, `label`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [household_groups.schema.json](guests/household_groups.schema.json) |
| `guest_imports` | `id`, `eventId`, `channel`, `householdCount`, `guestCount`, `undoneAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [guest_imports.schema.json](guests/guest_imports.schema.json) |
| `households` | `id`, `eventId`, `displayName`, `sideKind`, `sideClientId`, `groupId`, `language`, `respondentGuestId`, `keyMomentIds`, `needsAccommodation`, `needsTransport`, `answeredAt`, `invitedAt`, `importId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [households.schema.json](guests/households.schema.json) |
| `guests` | `id`, `eventId`, `householdId`, `kind`, `firstName`, `lastName`, `email`, `phone`, `ageRange`, `position`, `opposedAt`, `mealTypeId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [guests.schema.json](guests/guests.schema.json) |
| `rsvp_answers` | `id`, `guestId`, `keyMomentId`, `attending`, `channel`, `answeredAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [rsvp_answers.schema.json](guests/rsvp_answers.schema.json) |
| `diet_consents` | `id`, `eventId`, `guestId`, `givenByGuestId`, `textVersion`, `channel`, `legalGuardian`, `grantedAt`, `withdrawnAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [diet_consents.schema.json](guests/diet_consents.schema.json) |
| `purge_postponements` | `id`, `eventId`, `reason`, `postponedUntil`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [purge_postponements.schema.json](guests/purge_postponements.schema.json) |
| `seating_plans` | `id`, `eventId`, `keyMomentId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [seating_plans.schema.json](guests/seating_plans.schema.json) |
| `seating_tables` | `id`, `planId`, `name`, `shape`, `capacity`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [seating_tables.schema.json](guests/seating_tables.schema.json) |
| `seat_assignments` | `id`, `planId`, `tableId`, `guestId`, `releasedAt`, `releasedTableName`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [seat_assignments.schema.json](guests/seat_assignments.schema.json) |
| `vendor_meal_counts` | `id`, `eventId`, `keyMomentId`, `mealCount`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [vendor_meal_counts.schema.json](guests/vendor_meal_counts.schema.json) |
| `caterer_summary_downloads` | `id`, `eventId`, `keyMomentId`, `version`, `format`, `downloadedBy`, `downloadedAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [caterer_summary_downloads.schema.json](guests/caterer_summary_downloads.schema.json) |

Tables non exportées :

- `diets` — régimes et allergies des invités, chiffrés au niveau du champ (données de santé, article 9) : ils restent dans Symbola, réservés à la titulaire, et sont purgés sept jours après l'évènement
- `guest_links` — empreintes des jetons des liens personnels des invités : sans usage hors de Symbola
- `seating_constraints` — contraintes de placement « ensemble » et « séparés » : données internes de l'organisation, jamais exportées (lot 50, D4)
- `seating_constraint_members` — personnes d'une contrainte de placement : données internes de l'organisation, jamais exportées (lot 50, D4)

## Module `appointments`

| Entité | Champs | Schéma |
| --- | --- | --- |
| `booking_pages` | `id`, `slug`, `active`, `privacyNotice`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [booking_pages.schema.json](appointments/booking_pages.schema.json) |
| `appointment_types` | `id`, `name`, `durationMinutes`, `locationKind`, `location`, `bufferBeforeMinutes`, `bufferAfterMinutes`, `minNoticeMinutes`, `horizonDays`, `reminders`, `questions`, `hostUserId`, `allowEventDays`, `active`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [appointment_types.schema.json](appointments/appointment_types.schema.json) |
| `availability_rules` | `id`, `userId`, `weekday`, `startTime`, `endTime`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [availability_rules.schema.json](appointments/availability_rules.schema.json) |
| `availability_closures` | `id`, `userId`, `startsOn`, `endsOn`, `reason`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [availability_closures.schema.json](appointments/availability_closures.schema.json) |
| `calendar_sources` | `id`, `userId`, `label`, `urlHint`, `state`, `failures`, `lastErrorKind`, `lastReadAt`, `lastSuccessAt`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [calendar_sources.schema.json](appointments/calendar_sources.schema.json) |
| `appointments` | `id`, `typeId`, `typeName`, `hostUserId`, `startsAt`, `endsAt`, `bufferBeforeMinutes`, `bufferAfterMinutes`, `locationKind`, `location`, `reminders`, `status`, `origin`, `personName`, `personEmail`, `personPhone`, `locale`, `answers`, `contactId`, `eventId`, `manageTokenSealed`, `rescheduledAt`, `cancelledAt`, `cancelledBy`, `cancelReason`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy` | [appointments.schema.json](appointments/appointments.schema.json) |
| `appointment_reports` | `id`, `appointmentId`, `notes`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [appointment_reports.schema.json](appointments/appointment_reports.schema.json) |
| `appointment_report_actions` | `id`, `reportId`, `label`, `dueOn`, `responsible`, `taskId`, `taskEventId`, `position`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | [appointment_report_actions.schema.json](appointments/appointment_report_actions.schema.json) |

Tables non exportées :

- `busy_intervals` — technique : plages occupées relues dans les agendas extérieurs toutes les quinze minutes, sans titre ; l'agenda d'origine les garde
