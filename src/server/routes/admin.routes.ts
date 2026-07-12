import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HttpStatusCode } from '../common/constants/http-status';
import { UserRole } from '../common/constants/roles.enum';
import { createDb } from '../db/client';
import * as usersRepo from '../db/users.repo';
import { ErrorCodes } from '../common/constants/error-codes';
import { jsonWithRevalidation } from '../lib/http-revalidation';
import { buildErrorResponse, buildSuccessResponse } from '../lib/responses';
import { ensureSalesmanEnumValue } from '../lib/ensure-salesman-enum';
import { toPublicUser } from '../lib/user-public';
import { requireAdmin, requireAuth, type AppBindings, type AppVariables } from '../middleware/auth';
import * as catalog from '../services/catalog.service';
import * as leadsService from '../services/leads.service';
import * as userService from '../services/user.service';
import {
  consultationStatusUpdateSchema,
  contactMessageStatusUpdateSchema,
  createAdminUserSchema,
  createSalesmanSchema,
  patchSalesmanSchema,
  quoteTemplateCreateSchema,
  quoteTemplateUpdateSchema,
} from '../validators/schemas';

export const adminRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

adminRoutes.use('*', requireAuth);
adminRoutes.use('*', requireAdmin);

/** Admin UI bootstrap: CRM / tools metrics in one request. */
adminRoutes.get('/bootstrap', async (c) => {
  const db = createDb(c.env);
  const auth = c.get('auth');
  const [quoteTemplates, consultations, contactMessages, leads, salesTeam] = await Promise.all([
    catalog.listQuoteTemplatesAdmin(db),
    catalog.listConsultationsAdmin(db),
    catalog.listContactMessagesAdmin(db),
    leadsService.listLeads(db, auth),
    usersRepo.listUsersByRole(db, UserRole.SALESMAN).catch(async () => {
      await ensureSalesmanEnumValue(db);
      return usersRepo.listUsersByRole(db, UserRole.SALESMAN);
    }),
  ]);

  const leadStatusCounts: Record<string, number> = {};
  let quotesCount = 0;
  for (const lead of leads) {
    const status = String(lead.status ?? 'new');
    leadStatusCounts[status] = (leadStatusCounts[status] ?? 0) + 1;
    if (lead.quoteData && Array.isArray(lead.quoteData.lines) && lead.quoteData.lines.length > 0) {
      quotesCount += 1;
    }
  }

  const openConsultations = consultations.filter((row) => row.status === 'pending' || row.status === 'new').length;
  const openMessages = contactMessages.filter((row) => row.status === 'new' || row.status === 'unread').length;

  return jsonWithRevalidation(
    c,
    buildSuccessResponse({
      quoteTemplates,
      consultations,
      contactMessages,
      leads,
      salesTeam: salesTeam.map((u) => toPublicUser(u)).filter(Boolean),
      analytics: {
        totalLeads: leads.length,
        totalQuotes: quotesCount,
        totalSalesTeam: salesTeam.length,
        totalQuoteTemplates: quoteTemplates.length,
        openConsultations,
        openMessages,
        leadStatusCounts,
      },
    }),
    { cacheControl: 'private, max-age=0, must-revalidate' },
  );
});

adminRoutes.get('/quote-templates', async (c) => {
  const db = createDb(c.env);
  const data = await catalog.listQuoteTemplatesAdmin(db);
  return jsonWithRevalidation(c, buildSuccessResponse(data));
});

adminRoutes.post('/quote-templates', zValidator('json', quoteTemplateCreateSchema), async (c) => {
  const body = c.req.valid('json');
  const db = createDb(c.env);
  const data = await catalog.createQuoteTemplateAdmin(db, body);
  return c.json(buildSuccessResponse(data), HttpStatusCode.CREATED);
});

adminRoutes.patch(
  '/quote-templates/:id',
  zValidator('json', quoteTemplateUpdateSchema),
  async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isFinite(id) || id < 1) {
      return c.json(
        buildErrorResponse(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Invalid id'),
        HttpStatusCode.BAD_REQUEST,
      );
    }
    const body = c.req.valid('json');
    const db = createDb(c.env);
    const data = await catalog.updateQuoteTemplateAdmin(db, id, body);
    return c.json(buildSuccessResponse(data));
  },
);

adminRoutes.delete('/quote-templates/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id) || id < 1) {
    return c.json(
      buildErrorResponse(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Invalid id'),
      HttpStatusCode.BAD_REQUEST,
    );
  }
  const db = createDb(c.env);
  await catalog.deleteQuoteTemplateAdmin(db, id);
  return c.json(buildSuccessResponse(null));
});

adminRoutes.get('/consultations', async (c) => {
  const db = createDb(c.env);
  const data = await catalog.listConsultationsAdmin(db);
  return jsonWithRevalidation(c, buildSuccessResponse(data));
});

adminRoutes.patch(
  '/consultations/:id',
  zValidator('json', consultationStatusUpdateSchema),
  async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isFinite(id) || id < 1) {
      return c.json(
        buildErrorResponse(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Invalid id'),
        HttpStatusCode.BAD_REQUEST,
      );
    }
    const { status } = c.req.valid('json');
    const db = createDb(c.env);
    const data = await catalog.updateConsultationStatusAdmin(db, id, status);
    return c.json(buildSuccessResponse(data));
  },
);

adminRoutes.get('/contact-messages', async (c) => {
  const db = createDb(c.env);
  const data = await catalog.listContactMessagesAdmin(db);
  return jsonWithRevalidation(c, buildSuccessResponse(data));
});

adminRoutes.patch(
  '/contact-messages/:id',
  zValidator('json', contactMessageStatusUpdateSchema),
  async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isFinite(id) || id < 1) {
      return c.json(
        buildErrorResponse(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Invalid id'),
        HttpStatusCode.BAD_REQUEST,
      );
    }
    const { status } = c.req.valid('json');
    const db = createDb(c.env);
    const data = await catalog.updateContactMessageStatusAdmin(db, id, status);
    return c.json(buildSuccessResponse(data));
  },
);

adminRoutes.get('/users', async (c) => {
  const db = createDb(c.env);
  const rows = await usersRepo.listAllUsers(db);
  return jsonWithRevalidation(c, buildSuccessResponse(rows.map((u) => toPublicUser(u)).filter(Boolean)));
});

adminRoutes.post('/users', zValidator('json', createAdminUserSchema), async (c) => {
  const body = c.req.valid('json');
  const db = createDb(c.env);
  if (body.role === UserRole.SALESMAN) {
    await ensureSalesmanEnumValue(db);
  }
  const created = await userService.createUser(db, {
    name: body.name,
    email: body.email,
    password: body.password,
    role: body.role,
    emailVerified: true,
  });
  return c.json(buildSuccessResponse(toPublicUser(created)), HttpStatusCode.CREATED);
});

adminRoutes.delete('/users/:id', async (c) => {
  const id = c.req.param('id');
  const db = createDb(c.env);
  await userService.deleteUserAsAdmin(db, id, c.get('auth').sub);
  return c.json(buildSuccessResponse(null));
});

adminRoutes.get('/sales-team', async (c) => {
  const db = createDb(c.env);
  await ensureSalesmanEnumValue(db);
  const rows = await usersRepo.listUsersByRole(db, UserRole.SALESMAN);
  return jsonWithRevalidation(c, buildSuccessResponse(rows.map((u) => toPublicUser(u)).filter(Boolean)));
});

adminRoutes.post('/sales-team', zValidator('json', createSalesmanSchema), async (c) => {
  const body = c.req.valid('json');
  const db = createDb(c.env);
  await ensureSalesmanEnumValue(db);
  const created = await userService.createUser(db, {
    name: body.name,
    email: body.email,
    password: body.password,
    role: UserRole.SALESMAN,
    emailVerified: true,
  });
  return c.json(buildSuccessResponse(toPublicUser(created)), HttpStatusCode.CREATED);
});

adminRoutes.patch('/sales-team/:id', zValidator('json', patchSalesmanSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const db = createDb(c.env);
  await ensureSalesmanEnumValue(db);
  const existing = await usersRepo.findUserById(db, id);
  if (!existing || existing.role !== UserRole.SALESMAN) {
    return c.json(
      buildErrorResponse(ErrorCodes.USER_NOT_FOUND, HttpStatusCode.NOT_FOUND),
      HttpStatusCode.NOT_FOUND,
    );
  }
  const updated = await userService.updateUser(db, id, body);
  return c.json(buildSuccessResponse(toPublicUser(updated)));
});
