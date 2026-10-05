import { pgTable, text, integer, bigint, primaryKey } from "drizzle-orm/pg-core";

export const expenses = pgTable("trip_expenses", {
  room: text("room").notNull(),
  id: text("id").notNull(),
  day: integer("day").notNull(),
  category: text("category").notNull(),
  details: text("details").notNull().default(""),
  payer: text("payer").notNull(),
  cents: integer("cents").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [primaryKey({ columns: [table.room, table.id] })]);
