CREATE TABLE "core"."usage_counters" (
	"organization_id" uuid NOT NULL,
	"date" date NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"response_bytes" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_counters_organization_id_date_pk" PRIMARY KEY("organization_id","date")
);
