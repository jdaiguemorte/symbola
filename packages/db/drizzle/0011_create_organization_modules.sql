CREATE TABLE "hub"."organization_modules" (
	"organization_id" uuid NOT NULL,
	"module_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_modules_organization_id_module_key_pk" PRIMARY KEY("organization_id","module_key")
);
--> statement-breakpoint
ALTER TABLE "hub"."organization_modules" ADD CONSTRAINT "organization_modules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "hub"."organizations"("id") ON DELETE no action ON UPDATE no action;