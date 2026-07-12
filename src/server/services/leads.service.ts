import { desc, eq, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { UserRole } from '../common/constants/roles.enum';
import type { Database } from '../db/client';
import { leads, users, type LeadQuoteData, type LeadRow } from '../db/schema';
import type { AccessJwtPayload } from '../lib/jwt';

export type LeadPublic = {
  id: number;
  name: string;
  contact: string;
  location: string;
  productInterest: string;
  status: string;
  notes: string;
  assignedToUserId: string | null;
  createdByUserId: string;
  quoteData: LeadQuoteData | null;
  createdAt: string;
  updatedAt: string;
  assignedToName: string | null;
  createdByName: string | null;
};

function toIso(d: Date): string {
  return d.toISOString();
}

function rowToPublic(
  lead: LeadRow,
  assignedToName: string | null,
  createdByName: string | null,
): LeadPublic {
  return {
    id: lead.id,
    name: lead.name,
    contact: lead.contact,
    location: lead.location,
    productInterest: lead.productInterest,
    status: lead.status,
    notes: lead.notes,
    assignedToUserId: lead.assignedToUserId,
    createdByUserId: lead.createdByUserId,
    quoteData: lead.quoteData ?? null,
    createdAt: toIso(lead.createdAt),
    updatedAt: toIso(lead.updatedAt),
    assignedToName,
    createdByName,
  };
}

function canSeeLead(auth: AccessJwtPayload, lead: LeadRow): boolean {
  if (auth.role === UserRole.ADMIN) return true;
  return lead.createdByUserId === auth.sub || lead.assignedToUserId === auth.sub;
}

const assignee = alias(users, 'lead_assignee');
const creator = alias(users, 'lead_creator');

export async function listLeads(db: Database, auth: AccessJwtPayload): Promise<LeadPublic[]> {
  const selectJoin = () =>
    db
      .select({
        lead: leads,
        assignedToName: assignee.name,
        createdByName: creator.name,
      })
      .from(leads)
      .leftJoin(assignee, eq(leads.assignedToUserId, assignee.id))
      .leftJoin(creator, eq(leads.createdByUserId, creator.id));

  const rows =
    auth.role === UserRole.ADMIN
      ? await selectJoin().orderBy(desc(leads.id))
      : await selectJoin()
          .where(or(eq(leads.createdByUserId, auth.sub), eq(leads.assignedToUserId, auth.sub)))
          .orderBy(desc(leads.id));

  return rows.map((r) => rowToPublic(r.lead, r.assignedToName, r.createdByName));
}

export async function getLead(
  db: Database,
  id: number,
  auth: AccessJwtPayload,
): Promise<LeadPublic | null> {
  const [row] = await db
    .select({
      lead: leads,
      assignedToName: assignee.name,
      createdByName: creator.name,
    })
    .from(leads)
    .leftJoin(assignee, eq(leads.assignedToUserId, assignee.id))
    .leftJoin(creator, eq(leads.createdByUserId, creator.id))
    .where(eq(leads.id, id))
    .limit(1);

  if (!row) return null;
  if (!canSeeLead(auth, row.lead)) return null;
  return rowToPublic(row.lead, row.assignedToName, row.createdByName);
}

export async function createLead(
  db: Database,
  auth: AccessJwtPayload,
  input: {
    name: string;
    contact: string;
    location: string;
    productInterest: string;
    notes?: string;
    assignedToUserId?: string | null;
  },
): Promise<LeadPublic> {
  const createdByUserId = auth.sub;
  let assignedToUserId: string | null =
    input.assignedToUserId === undefined ? null : input.assignedToUserId;

  if (auth.role === UserRole.SALESMAN) {
    assignedToUserId = assignedToUserId ?? auth.sub;
  }

  const [inserted] = await db
    .insert(leads)
    .values({
      name: input.name.trim(),
      contact: input.contact.trim(),
      location: input.location.trim(),
      productInterest: input.productInterest.trim() || 'Solar Panels',
      notes: (input.notes ?? '').trim(),
      status: 'New',
      createdByUserId,
      assignedToUserId,
    })
    .returning();

  if (!inserted) {
    throw new Error('Failed to create lead');
  }

  const got = await getLead(db, inserted.id, auth);
  if (!got) throw new Error('Lead not found after create');
  return got;
}

export async function updateLead(
  db: Database,
  id: number,
  auth: AccessJwtPayload,
  patch: {
    name?: string;
    contact?: string;
    location?: string;
    productInterest?: string;
    status?: string;
    notes?: string;
    assignedToUserId?: string | null;
    quoteData?: LeadQuoteData | null;
  },
): Promise<LeadPublic | null> {
  const [existing] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!existing) return null;
  if (!canSeeLead(auth, existing)) return null;

  const isAdmin = auth.role === UserRole.ADMIN;

  const updates: Partial<typeof leads.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (isAdmin) {
    if (patch.name !== undefined) updates.name = patch.name.trim();
    if (patch.contact !== undefined) updates.contact = patch.contact.trim();
    if (patch.location !== undefined) updates.location = patch.location.trim();
    if (patch.productInterest !== undefined) updates.productInterest = patch.productInterest.trim();
    if (patch.status !== undefined) updates.status = patch.status.trim();
    if (patch.notes !== undefined) updates.notes = patch.notes.trim();
    if (patch.assignedToUserId !== undefined) updates.assignedToUserId = patch.assignedToUserId;
    if (patch.quoteData !== undefined) updates.quoteData = patch.quoteData;
  } else {
    if (patch.notes !== undefined) updates.notes = patch.notes.trim();
    if (patch.quoteData !== undefined) updates.quoteData = patch.quoteData;
  }

  const changedFields = Object.keys(updates).filter((k) => k !== 'updatedAt');
  if (changedFields.length === 0) {
    return getLead(db, id, auth);
  }

  await db.update(leads).set(updates).where(eq(leads.id, id));
  return getLead(db, id, auth);
}

export async function deleteLead(
  db: Database,
  id: number,
  auth: AccessJwtPayload,
): Promise<'deleted' | 'not_found' | 'forbidden'> {
  const [existing] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!existing) return 'not_found';
  if (auth.role !== UserRole.ADMIN) return 'forbidden';
  await db.delete(leads).where(eq(leads.id, id));
  return 'deleted';
}
