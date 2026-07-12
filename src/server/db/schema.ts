import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Matches legacy Sequelize `enum_users_role` for existing databases. */
export const usersRoleEnum = pgEnum('enum_users_role', ['ADMIN', 'USER', 'SALESMAN']);

/** Line items stored in `leads.quoteData` for PDF / UI. */
export type LeadQuoteLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  /** Shop `products.id` when picked from catalog */
  productId?: number | null;
  /** e.g. `Power: 550W` from product specifications */
  variantLabel?: string | null;
  /** Per-line shop category for quote UI (matches `product_categories.name` or `"__custom__"`) */
  catalogCategoryKey?: string | null;
  catalogCustomCategory?: string | null;
  /** Bold line title on quotation PDF */
  itemTitle?: string | null;
  /** Multi-line detail under title on quotation PDF */
  itemDescription?: string | null;
  /** When false, line is hidden from the generated PDF. */
  includeInPdf?: boolean;
};

export type LeadQuoteData = {
  lines: LeadQuoteLine[];
  taxPercent?: number;
  discountAmount?: number;
  notes?: string;
  validUntil?: string;
};

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: usersRoleEnum('role').notNull().default('USER'),
  isActive: boolean('isActive').notNull().default(true),
  /** New signups set false; default true keeps existing rows usable after migration. */
  emailVerified: boolean('emailVerified').notNull().default(true),
  emailVerifyToken: varchar('emailVerifyToken', { length: 128 }),
  emailVerifyExpiresAt: timestamp('emailVerifyExpiresAt', { withTimezone: true, mode: 'date' }),
  passwordResetToken: varchar('passwordResetToken', { length: 128 }),
  passwordResetExpiresAt: timestamp('passwordResetExpiresAt', { withTimezone: true, mode: 'date' }),
  refreshToken: varchar('refreshToken', { length: 255 }),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export type OrderLineItem = {
  productId?: number;
  name: string;
  quantity: number;
  price: number;
};

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 500 }).notNull(),
  category: varchar('category', { length: 200 }).notNull(),
  price: numeric('price', { precision: 14, scale: 2 }).notNull(),
  stock: integer('stock').notNull().default(0),
  description: text('description').notNull().default(''),
  longDescription: text('longDescription'),
  brand: varchar('brand', { length: 255 }),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  images: jsonb('images').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  specifications: jsonb('specifications')
    .$type<Record<string, string>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  attachments: jsonb('attachments')
    .$type<{ title: string; href: string }[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  /** Up to 4 short labels shown on the product page (e.g. Free Delivery). */
  highlightOptions: jsonb('highlightOptions')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export const productCategories = pgTable('product_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull().unique(),
  /** Optional ordering for UIs (lower first). */
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export const quoteTemplates = pgTable('quote_templates', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 200 }).notNull().unique(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sortOrder').notNull().default(0),
  isActive: boolean('isActive').notNull().default(true),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  customerName: varchar('customerName', { length: 255 }).notNull(),
  customerPhone: varchar('customerPhone', { length: 64 }).notNull(),
  customerEmail: varchar('customerEmail', { length: 255 }).notNull(),
  city: varchar('city', { length: 128 }).notNull(),
  address: text('address').notNull(),
  notes: text('notes').notNull().default(''),
  paymentMethod: varchar('paymentMethod', { length: 64 }).notNull().default('cod'),
  totalPrice: numeric('totalPrice', { precision: 14, scale: 2 }).notNull(),
  products: jsonb('products').$type<OrderLineItem[]>().notNull().default(sql`'[]'::jsonb`),
  paymentStatus: varchar('paymentStatus', { length: 64 }).notNull().default('pending'),
  orderStatus: varchar('orderStatus', { length: 64 }).notNull().default('pending'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 64 }).notNull(),
  city: varchar('city', { length: 128 }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export const consultations = pgTable('consultations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 64 }).notNull(),
  city: varchar('city', { length: 128 }).notNull(),
  monthlyBill: varchar('monthlyBill', { length: 64 }).notNull().default(''),
  message: text('message').notNull().default(''),
  status: varchar('status', { length: 64 }).notNull().default('new'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 64 }).notNull().default(''),
  subject: varchar('subject', { length: 500 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 64 }).notNull().default('new'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export const leads = pgTable('leads', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  contact: varchar('contact', { length: 64 }).notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  productInterest: varchar('productInterest', { length: 255 }).notNull().default('Solar Panels'),
  status: varchar('status', { length: 64 }).notNull().default('New'),
  notes: text('notes').notNull().default(''),
  assignedToUserId: uuid('assignedToUserId').references(() => users.id),
  createdByUserId: uuid('createdByUserId')
    .notNull()
    .references(() => users.id),
  quoteData: jsonb('quoteData').$type<LeadQuoteData | null>(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export type ProductRow = typeof products.$inferSelect;
export type ProductCategoryRow = typeof productCategories.$inferSelect;
export type QuoteTemplateRow = typeof quoteTemplates.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type CustomerRow = typeof customers.$inferSelect;
export type ConsultationRow = typeof consultations.$inferSelect;
export type ContactMessageRow = typeof contactMessages.$inferSelect;
export type LeadRow = typeof leads.$inferSelect;

export const blogs = pgTable('blogs', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  tag: varchar('tag', { length: 200 }).notNull().default(''),
  imageUrl: text('imageUrl').notNull(),
  excerpt: text('excerpt').notNull().default(''),
  body: text('body').notNull().default(''),
  isPublished: boolean('isPublished').notNull().default(true),
  publishedAt: timestamp('publishedAt', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type BlogRow = typeof blogs.$inferSelect;
