import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HttpStatusCode } from '../common/constants/http-status';
import { ErrorCodes } from '../common/constants/error-codes';
import { createDb } from '../db/client';
import { ensureLeadsSchema } from '../lib/ensure-leads-table';
import { buildErrorResponse, buildSuccessResponse } from '../lib/responses';
import { requireAuth, requireStaff, type AppBindings, type AppVariables } from '../middleware/auth';
import * as catalog from '../services/catalog.service';
import * as leadsService from '../services/leads.service';
import { leadCreateSchema, leadPatchSchema } from '../validators/schemas';

export const leadsRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

/** Create `leads` + indexes when DB was never migrated (see scripts/apply-api-schema.sql). */
leadsRoutes.use('*', async (c, next) => {
  await ensureLeadsSchema(createDb(c.env));
  await next();
});

leadsRoutes.use('*', requireAuth);
leadsRoutes.use('*', requireStaff);

leadsRoutes.get('/', async (c) => {
  const db = createDb(c.env);
  const rows = await leadsService.listLeads(db, c.get('auth'));
  return c.json(buildSuccessResponse(rows));
});

leadsRoutes.get('/quote-templates', async (c) => {
  const db = createDb(c.env);
  const rows = await catalog.listQuoteTemplatesStaff(db);
  return c.json(buildSuccessResponse(rows));
});

leadsRoutes.post('/', zValidator('json', leadCreateSchema), async (c) => {
  const db = createDb(c.env);
  const body = c.req.valid('json');
  const row = await leadsService.createLead(db, c.get('auth'), {
    name: body.name,
    contact: body.contact,
    location: body.location,
    productInterest: body.productInterest ?? 'Solar Panels',
    notes: body.notes,
    assignedToUserId: body.assignedToUserId,
  });
  return c.json(buildSuccessResponse(row), HttpStatusCode.CREATED);
});

leadsRoutes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id) || id < 1) {
    return c.json(
      buildErrorResponse(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Invalid lead id'),
      HttpStatusCode.BAD_REQUEST,
    );
  }
  const db = createDb(c.env);
  const row = await leadsService.getLead(db, id, c.get('auth'));
  if (!row) {
    return c.json(buildErrorResponse(ErrorCodes.LEAD_NOT_FOUND, HttpStatusCode.NOT_FOUND), HttpStatusCode.NOT_FOUND);
  }
  return c.json(buildSuccessResponse(row));
});

leadsRoutes.patch('/:id', zValidator('json', leadPatchSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id) || id < 1) {
    return c.json(
      buildErrorResponse(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Invalid lead id'),
      HttpStatusCode.BAD_REQUEST,
    );
  }
  const body = c.req.valid('json');
  const db = createDb(c.env);
  const row = await leadsService.updateLead(db, id, c.get('auth'), body);
  if (!row) {
    return c.json(buildErrorResponse(ErrorCodes.LEAD_NOT_FOUND, HttpStatusCode.NOT_FOUND), HttpStatusCode.NOT_FOUND);
  }
  return c.json(buildSuccessResponse(row));
});

leadsRoutes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id) || id < 1) {
    return c.json(
      buildErrorResponse(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, 'Invalid lead id'),
      HttpStatusCode.BAD_REQUEST,
    );
  }
  const db = createDb(c.env);
  const result = await leadsService.deleteLead(db, id, c.get('auth'));
  if (result === 'not_found') {
    return c.json(buildErrorResponse(ErrorCodes.LEAD_NOT_FOUND, HttpStatusCode.NOT_FOUND), HttpStatusCode.NOT_FOUND);
  }
  if (result === 'forbidden') {
    return c.json(buildErrorResponse(ErrorCodes.ACCESS_DENIED, HttpStatusCode.FORBIDDEN), HttpStatusCode.FORBIDDEN);
  }
  return c.json(buildSuccessResponse({ ok: true as const }));
});
