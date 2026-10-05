CREATE TABLE "trip_expenses" (
	"room" text,
	"id" text,
	"day" integer NOT NULL,
	"category" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"payer" text NOT NULL,
	"cents" integer NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "trip_expenses_pkey" PRIMARY KEY("room","id")
);
