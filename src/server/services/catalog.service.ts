import { and, asc, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { ErrorCodes } from '../common/constants/error-codes';
import { HttpStatusCode } from '../common/constants/http-status';
import { UserRole } from '../common/constants/roles.enum';
import {
  blogs,
  consultations,
  contactMessages,
  customers,
  orders,
  products,
  productCategories,
  quoteTemplates,
  users,
  type OrderLineItem,
} from '../db/schema';
import { AppError } from '../lib/app-error';
import { sendContactMessageEmails } from '../lib/contact-message-email';
import {
  blogToFrontend,
  consultationToFrontend,
  contactMessageToFrontend,
  customerToFrontend,
  orderToFrontend,
  productToFrontend,
} from '../lib/store-mappers';
import type { Env } from '../types';
import { buildAnalytics } from './analytics.service';

function normalizeCategoryName(raw: string): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function ensureCategoryExists(db: Database, nameRaw: string): Promise<void> {
  const name = normalizeCategoryName(nameRaw);
  if (!name) return;
  const [existing] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(eq(productCategories.name, name))
    .limit(1);
  if (existing) return;
  await db.insert(productCategories).values({ name, sortOrder: 0, updatedAt: new Date() });
}

export function listProductCategoriesPublic(db: Database) {
  return db
    .select()
    .from(productCategories)
    .orderBy(productCategories.sortOrder, productCategories.name)
    .then((rows) =>
      rows.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sortOrder })),
    );
}

export function listProductCategoriesAdmin(db: Database) {
  return listProductCategoriesPublic(db);
}

export async function createProductCategoryAdmin(
  db: Database,
  payload: { name: string; sortOrder?: number },
) {
  const name = normalizeCategoryName(payload.name);
  if (!name) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Category name required');
  }
  const [row] = await db
    .insert(productCategories)
    .values({
      name,
      sortOrder: Number.isFinite(payload.sortOrder) ? Number(payload.sortOrder) : 0,
      updatedAt: new Date(),
    })
    .returning();
  if (!row) throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, HttpStatusCode.INTERNAL_SERVER_ERROR);
  return { id: row.id, name: row.name, sortOrder: row.sortOrder };
}

export async function updateProductCategoryAdmin(
  db: Database,
  id: number,
  patch: Partial<{ name: string; sortOrder: number }>,
) {
  const [existing] = await db.select().from(productCategories).where(eq(productCategories.id, id)).limit(1);
  if (!existing) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.NOT_FOUND, 'Category not found');
  }
  const set: Partial<{ name: string; sortOrder: number; updatedAt: Date }> = {
    updatedAt: new Date(),
  };
  if (patch.name !== undefined) {
    const name = normalizeCategoryName(patch.name);
    if (!name) {
      throw new AppError(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Category name required');
    }
    set.name = name;
  }
  if (patch.sortOrder !== undefined && Number.isFinite(patch.sortOrder)) {
    set.sortOrder = Number(patch.sortOrder);
  }
  const [row] = await db.update(productCategories).set(set).where(eq(productCategories.id, id)).returning();
  if (!row) throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, HttpStatusCode.INTERNAL_SERVER_ERROR);
  return { id: row.id, name: row.name, sortOrder: row.sortOrder };
}

export async function deleteProductCategoryAdmin(db: Database, id: number) {
  const [existing] = await db.select().from(productCategories).where(eq(productCategories.id, id)).limit(1);
  if (!existing) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.NOT_FOUND, 'Category not found');
  }
  await db.delete(productCategories).where(eq(productCategories.id, id));
}

function quoteTemplateToFrontend(row: typeof quoteTemplates.$inferSelect) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeQuoteTemplateText(raw: string): string {
  return String(raw ?? '').trim();
}

export function listQuoteTemplatesStaff(db: Database) {
  return db
    .select()
    .from(quoteTemplates)
    .where(eq(quoteTemplates.isActive, true))
    .orderBy(asc(quoteTemplates.sortOrder), asc(quoteTemplates.category))
    .then((rows) => rows.map(quoteTemplateToFrontend));
}

export function listQuoteTemplatesAdmin(db: Database) {
  return db
    .select()
    .from(quoteTemplates)
    .orderBy(asc(quoteTemplates.sortOrder), asc(quoteTemplates.category))
    .then((rows) => rows.map(quoteTemplateToFrontend));
}

export async function createQuoteTemplateAdmin(
  db: Database,
  payload: {
    category: string;
    title: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  const category = normalizeCategoryName(payload.category);
  const title = normalizeQuoteTemplateText(payload.title);
  if (!category) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Category required');
  }
  if (!title) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Title required');
  }
  const [row] = await db
    .insert(quoteTemplates)
    .values({
      category,
      title,
      description: payload.description ?? '',
      sortOrder: Number.isFinite(payload.sortOrder) ? Number(payload.sortOrder) : 0,
      isActive: payload.isActive ?? true,
      updatedAt: new Date(),
    })
    .returning();
  if (!row) throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, HttpStatusCode.INTERNAL_SERVER_ERROR);
  return quoteTemplateToFrontend(row);
}

export async function updateQuoteTemplateAdmin(
  db: Database,
  id: number,
  patch: Partial<{
    category: string;
    title: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
  }>,
) {
  const [existing] = await db.select().from(quoteTemplates).where(eq(quoteTemplates.id, id)).limit(1);
  if (!existing) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.NOT_FOUND, 'Quote template not found');
  }
  const set: Partial<typeof quoteTemplates.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (patch.category !== undefined) {
    const category = normalizeCategoryName(patch.category);
    if (!category) {
      throw new AppError(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Category required');
    }
    set.category = category;
  }
  if (patch.title !== undefined) {
    const title = normalizeQuoteTemplateText(patch.title);
    if (!title) {
      throw new AppError(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Title required');
    }
    set.title = title;
  }
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.sortOrder !== undefined && Number.isFinite(patch.sortOrder)) {
    set.sortOrder = Number(patch.sortOrder);
  }
  if (patch.isActive !== undefined) set.isActive = patch.isActive;

  const [row] = await db.update(quoteTemplates).set(set).where(eq(quoteTemplates.id, id)).returning();
  if (!row) throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, HttpStatusCode.INTERNAL_SERVER_ERROR);
  return quoteTemplateToFrontend(row);
}

export async function deleteQuoteTemplateAdmin(db: Database, id: number) {
  const [existing] = await db.select().from(quoteTemplates).where(eq(quoteTemplates.id, id)).limit(1);
  if (!existing) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.NOT_FOUND, 'Quote template not found');
  }
  await db.delete(quoteTemplates).where(eq(quoteTemplates.id, id));
}

export function listProductsPublic(db: Database) {
  return db
    .select()
    .from(products)
    .where(eq(products.status, 'active'))
    .orderBy(desc(products.id))
    .then((rows) => rows.map(productToFrontend));
}

export async function getProductPublic(db: Database, id: number) {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.status, 'active')))
    .limit(1);
  if (!row) {
    throw new AppError(ErrorCodes.PRODUCT_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }
  return productToFrontend(row);
}

export function listProductsAdmin(db: Database) {
  return db
    .select()
    .from(products)
    .orderBy(desc(products.id))
    .then((rows) => rows.map(productToFrontend));
}

export async function createProductAdmin(
  db: Database,
  payload: {
    name: string;
    category: string;
    price: number;
    stock: number;
    description: string;
    longDescription?: string;
    brand?: string;
    status?: string;
    images?: string[];
    specifications?: Record<string, string>;
    attachments?: { title: string; href: string }[];
    highlightOptions?: string[];
  },
) {
  await ensureCategoryExists(db, payload.category);
  const [row] = await db
    .insert(products)
    .values({
      name: payload.name,
      category: payload.category,
      price: String(payload.price),
      stock: payload.stock,
      description: payload.description,
      longDescription: payload.longDescription || null,
      brand: payload.brand || null,
      status: payload.status ?? 'active',
      images: payload.images ?? [],
      specifications: payload.specifications ?? {},
      attachments: payload.attachments ?? [],
      highlightOptions: payload.highlightOptions ?? [],
    })
    .returning();
  if (!row) throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, HttpStatusCode.INTERNAL_SERVER_ERROR);
  return productToFrontend(row);
}

export async function updateProductAdmin(
  db: Database,
  id: number,
  patch: Partial<{
    name: string;
    category: string;
    price: number;
    stock: number;
    description: string;
    longDescription: string | null;
    brand: string | null;
    status: string;
    images: string[];
    specifications: Record<string, string>;
    attachments: { title: string; href: string }[];
    highlightOptions: string[];
  }>,
) {
  const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!existing) {
    throw new AppError(ErrorCodes.PRODUCT_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }
  if (patch.category !== undefined) {
    await ensureCategoryExists(db, patch.category);
  }
  const set: Partial<{
    name: string;
    category: string;
    price: string;
    stock: number;
    description: string;
    longDescription: string | null;
    brand: string | null;
    status: string;
    images: string[];
    specifications: Record<string, string>;
    attachments: { title: string; href: string }[];
    highlightOptions: string[];
    updatedAt: Date;
  }> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.category !== undefined) set.category = patch.category;
  if (patch.price !== undefined) set.price = String(patch.price);
  if (patch.stock !== undefined) set.stock = patch.stock;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.longDescription !== undefined) set.longDescription = patch.longDescription;
  if (patch.brand !== undefined) set.brand = patch.brand;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.images !== undefined) set.images = patch.images;
  if (patch.specifications !== undefined) set.specifications = patch.specifications;
  if (patch.attachments !== undefined) set.attachments = patch.attachments;
  if (patch.highlightOptions !== undefined) set.highlightOptions = patch.highlightOptions;

  const [row] = await db.update(products).set(set).where(eq(products.id, id)).returning();
  if (!row) throw new AppError(ErrorCodes.PRODUCT_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  return productToFrontend(row);
}

export async function deleteProductAdmin(db: Database, id: number) {
  const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!existing) {
    throw new AppError(ErrorCodes.PRODUCT_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }
  await db.delete(products).where(eq(products.id, id));
}

export function listOrdersAdmin(db: Database) {
  return db
    .select()
    .from(orders)
    .orderBy(desc(orders.id))
    .then((rows) => rows.map(orderToFrontend));
}

export async function updateOrderStatusAdmin(db: Database, id: number, orderStatus: string) {
  const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!existing) {
    throw new AppError(ErrorCodes.ORDER_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }
  const [row] = await db
    .update(orders)
    .set({ orderStatus, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();
  if (!row) throw new AppError(ErrorCodes.ORDER_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  return orderToFrontend(row);
}

function dateToIso(value: Date | string | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return new Date(value).toISOString();
  return new Date().toISOString();
}

export async function listCustomersAdmin(db: Database) {
  const [customerRows, userRows] = await Promise.all([
    db.select().from(customers),
    db.select().from(users).where(eq(users.role, UserRole.USER)),
  ]);

  const byEmail = new Map<string, any>();

  for (const row of customerRows) {
    const customer = customerToFrontend(row);
    byEmail.set(customer.email.toLowerCase(), {
      ...customer,
      has_account: false,
      email_verified: null,
      source: 'checkout',
    });
  }

  for (const user of userRows) {
    const email = user.email.toLowerCase();
    const existing = byEmail.get(email);
    byEmail.set(email, {
      id: existing?.id ?? `user:${user.id}`,
      account_id: user.id,
      name: existing?.name || user.name,
      email,
      phone: existing?.phone ?? '',
      city: existing?.city ?? '',
      created_at: existing?.created_at ?? dateToIso(user.createdAt),
      has_account: true,
      email_verified: user.emailVerified,
      source: existing ? 'account_checkout' : 'account',
    });
  }

  return Array.from(byEmail.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function listConsultationsAdmin(db: Database) {
  return db
    .select()
    .from(consultations)
    .orderBy(desc(consultations.id))
    .then((rows) => rows.map(consultationToFrontend));
}

export async function updateConsultationStatusAdmin(db: Database, id: number, status: string) {
  const [existing] = await db.select().from(consultations).where(eq(consultations.id, id)).limit(1);
  if (!existing) {
    throw new AppError(ErrorCodes.CONSULTATION_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }
  const [row] = await db
    .update(consultations)
    .set({ status, updatedAt: new Date() })
    .where(eq(consultations.id, id))
    .returning();
  if (!row) throw new AppError(ErrorCodes.CONSULTATION_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  return consultationToFrontend(row);
}

export async function createStoreOrder(
  db: Database,
  payload: {
    name: string;
    email: string;
    phone: string;
    city: string;
    address: string;
    notes?: string;
    payment_method?: string;
    total_price: number;
    products: { id?: number; name?: string; quantity?: number; price?: number }[];
  },
) {
  const lines: OrderLineItem[] = (payload.products || []).map((it) => ({
    productId: typeof it.id === 'number' ? it.id : undefined,
    name: String(it.name ?? 'Item'),
    quantity: Number(it.quantity) || 0,
    price: Number(it.price) || 0,
  }));

  const [orderRow] = await db
    .insert(orders)
    .values({
      customerName: payload.name.trim(),
      customerEmail: payload.email.trim().toLowerCase(),
      customerPhone: payload.phone.trim(),
      city: payload.city.trim(),
      address: payload.address.trim(),
      notes: (payload.notes ?? '').trim(),
      paymentMethod: payload.payment_method ?? 'cod',
      totalPrice: String(payload.total_price),
      products: lines,
      paymentStatus: 'pending',
      orderStatus: 'pending',
    })
    .returning();

  if (!orderRow) {
    throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, HttpStatusCode.INTERNAL_SERVER_ERROR);
  }

  await db
    .insert(customers)
    .values({
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone.trim(),
      city: payload.city.trim(),
    })
    .onConflictDoUpdate({
      target: customers.email,
      set: {
        name: payload.name.trim(),
        phone: payload.phone.trim(),
        city: payload.city.trim(),
        updatedAt: new Date(),
      },
    });

  for (const line of lines) {
    if (line.productId && line.quantity > 0) {
      const [p] = await db.select().from(products).where(eq(products.id, line.productId)).limit(1);
      if (p) {
        const newStock = Math.max(0, p.stock - line.quantity);
        await db
          .update(products)
          .set({ stock: newStock, updatedAt: new Date() })
          .where(eq(products.id, line.productId));
      }
    }
  }

  return orderToFrontend(orderRow);
}

export async function createConsultationPublic(
  db: Database,
  payload: {
    name: string;
    phone: string;
    city: string;
    monthly_bill?: string;
    message?: string;
  },
) {
  const [row] = await db
    .insert(consultations)
    .values({
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      city: payload.city.trim(),
      monthlyBill: (payload.monthly_bill ?? '').trim(),
      message: (payload.message ?? '').trim(),
      status: 'new',
    })
    .returning();
  if (!row) throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, HttpStatusCode.INTERNAL_SERVER_ERROR);
  return consultationToFrontend(row);
}

export function listContactMessagesAdmin(db: Database) {
  return db
    .select()
    .from(contactMessages)
    .orderBy(desc(contactMessages.id))
    .then((rows) => rows.map(contactMessageToFrontend));
}

export async function updateContactMessageStatusAdmin(db: Database, id: number, status: string) {
  const [existing] = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1);
  if (!existing) {
    throw new AppError(ErrorCodes.CONTACT_MESSAGE_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }
  const [row] = await db
    .update(contactMessages)
    .set({ status, updatedAt: new Date() })
    .where(eq(contactMessages.id, id))
    .returning();
  if (!row) throw new AppError(ErrorCodes.CONTACT_MESSAGE_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  return contactMessageToFrontend(row);
}

export async function createContactMessagePublic(
  env: Env,
  db: Database,
  payload: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
  },
) {
  const [row] = await db
    .insert(contactMessages)
    .values({
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: (payload.phone ?? '').trim(),
      subject: payload.subject.trim(),
      message: payload.message.trim(),
      status: 'new',
    })
    .returning();
  if (!row) throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, HttpStatusCode.INTERNAL_SERVER_ERROR);

  try {
    await sendContactMessageEmails(env, db, row);
  } catch (err) {
    console.error('[contact] email delivery failed (submission saved):', err);
  }

  return contactMessageToFrontend(row);
}

export async function getAnalyticsAdmin(db: Database) {
  const [orderRows, customerRows, productRows] = await Promise.all([
    db.select().from(orders),
    db.select().from(customers),
    db.select().from(products),
  ]);
  return buildAnalytics(orderRows, customerRows.length, productRows.length);
}

export function listBlogsPublic(db: Database) {
  return db
    .select()
    .from(blogs)
    .where(eq(blogs.isPublished, true))
    .orderBy(desc(blogs.publishedAt))
    .then((rows) => rows.map(blogToFrontend));
}

export async function getBlogPublic(db: Database, id: number) {
  const [row] = await db
    .select()
    .from(blogs)
    .where(and(eq(blogs.id, id), eq(blogs.isPublished, true)))
    .limit(1);
  if (!row) {
    throw new AppError(ErrorCodes.BLOG_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }
  return blogToFrontend(row);
}

export function listBlogsAdmin(db: Database) {
  return db
    .select()
    .from(blogs)
    .orderBy(desc(blogs.publishedAt))
    .then((rows) => rows.map(blogToFrontend));
}

export async function createBlogAdmin(
  db: Database,
  payload: {
    title: string;
    tag?: string;
    imageUrl: string;
    excerpt?: string;
    body?: string;
    isPublished?: boolean;
    publishedAt?: string;
  },
) {
  const publishedAt = payload.publishedAt ? new Date(payload.publishedAt) : new Date();
  if (Number.isNaN(publishedAt.getTime())) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Invalid published date');
  }
  const [row] = await db
    .insert(blogs)
    .values({
      title: payload.title.trim(),
      tag: (payload.tag ?? '').trim(),
      imageUrl: payload.imageUrl.trim(),
      excerpt: (payload.excerpt ?? '').trim(),
      body: (payload.body ?? '').trim(),
      isPublished: payload.isPublished ?? true,
      publishedAt,
      updatedAt: new Date(),
    })
    .returning();
  if (!row) throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, HttpStatusCode.INTERNAL_SERVER_ERROR);
  return blogToFrontend(row);
}

export async function updateBlogAdmin(
  db: Database,
  id: number,
  patch: Partial<{
    title: string;
    tag: string;
    imageUrl: string;
    excerpt: string;
    body: string;
    isPublished: boolean;
    publishedAt: string;
  }>,
) {
  const [existing] = await db.select().from(blogs).where(eq(blogs.id, id)).limit(1);
  if (!existing) {
    throw new AppError(ErrorCodes.BLOG_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }
  let publishedAt: Date | undefined;
  if (patch.publishedAt !== undefined) {
    publishedAt = new Date(patch.publishedAt);
    if (Number.isNaN(publishedAt.getTime())) {
      throw new AppError(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Invalid published date');
    }
  }
  const [row] = await db
    .update(blogs)
    .set({
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.tag !== undefined ? { tag: patch.tag.trim() } : {}),
      ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl.trim() } : {}),
      ...(patch.excerpt !== undefined ? { excerpt: patch.excerpt.trim() } : {}),
      ...(patch.body !== undefined ? { body: patch.body.trim() } : {}),
      ...(patch.isPublished !== undefined ? { isPublished: patch.isPublished } : {}),
      ...(publishedAt !== undefined ? { publishedAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(blogs.id, id))
    .returning();
  if (!row) throw new AppError(ErrorCodes.BLOG_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  return blogToFrontend(row);
}

export async function deleteBlogAdmin(db: Database, id: number) {
  const [existing] = await db.select().from(blogs).where(eq(blogs.id, id)).limit(1);
  if (!existing) {
    throw new AppError(ErrorCodes.BLOG_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }
  await db.delete(blogs).where(eq(blogs.id, id));
}
