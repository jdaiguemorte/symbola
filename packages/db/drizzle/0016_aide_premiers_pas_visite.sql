CREATE TABLE "hub"."user_tour_seen" (
	"user_id" uuid NOT NULL,
	"module_key" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tour_seen_user_id_module_key_pk" PRIMARY KEY("user_id","module_key")
);
--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "first_steps_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."user_tour_seen" ADD CONSTRAINT "user_tour_seen_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "hub"."users"("id") ON DELETE no action ON UPDATE no action;