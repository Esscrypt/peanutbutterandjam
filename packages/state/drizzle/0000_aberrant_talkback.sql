CREATE TABLE "streams" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"kind" integer NOT NULL,
	"state" text NOT NULL,
	"is_initiator" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "validator_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"validator_index" integer NOT NULL,
	"remote_host" text NOT NULL,
	"remote_port" integer NOT NULL,
	"state" text NOT NULL,
	"connected_at" timestamp with time zone,
	"last_activity" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validators" (
	"index" integer PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"metadata_host" text NOT NULL,
	"metadata_port" integer NOT NULL,
	"epoch" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "validator_connections" ADD CONSTRAINT "validator_connections_validator_index_validators_index_fk" FOREIGN KEY ("validator_index") REFERENCES "public"."validators"("index") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_streams_connection" ON "streams" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_streams_kind" ON "streams" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "idx_connections_validator" ON "validator_connections" USING btree ("validator_index");--> statement-breakpoint
CREATE INDEX "idx_connections_state" ON "validator_connections" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_validators_epoch" ON "validators" USING btree ("epoch");--> statement-breakpoint
CREATE INDEX "idx_validators_active" ON "validators" USING btree ("is_active");