import { z } from 'zod';
import { UserRole } from '../common/constants/roles.enum';

/** Public sign-up: only these fields; role is always USER on the server (never from the client). */
export const registerSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
  })
  .strict();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const adminRegisterSchema = registerSchema.extend({
  inviteSecret: z.string().min(1),
});

export const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    role: z.nativeEnum(UserRole).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field required' });

const attachmentSchema = z.object({ title: z.string(), href: z.string() });

const highlightOptionsSchema = z
  .array(z.string().trim().min(1).max(120))
  .max(4);

export const productCreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  description: z.string(),
  longDescription: z.string().optional(),
  brand: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  images: z.array(z.string()).optional(),
  specifications: z.record(z.string(), z.string()).optional(),
  attachments: z.array(attachmentSchema).optional(),
  highlightOptions: highlightOptionsSchema.optional(),
});

export const productUpdateSchema = productCreateSchema
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

export const productCategoryCreateSchema = z
  .object({
    name: z.string().min(1),
    sortOrder: z.number().int().optional(),
  })
  .strict();

export const productCategoryUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

export const quoteTemplateCreateSchema = z
  .object({
    category: z.string().min(1).max(200),
    title: z.string().min(1).max(500),
    description: z.string().max(10000).optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const quoteTemplateUpdateSchema = z
  .object({
    category: z.string().min(1).max(200).optional(),
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(10000).optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

export const orderStatusUpdateSchema = z.object({
  order_status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
});

export const consultationStatusUpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'converted', 'closed']),
});

export const storeOrderCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  notes: z.string().optional(),
  payment_method: z.string().optional(),
  total_price: z.number().nonnegative(),
  products: z.array(
    z.object({
      id: z.number().optional(),
      name: z.string().optional(),
      quantity: z.number().int().nonnegative(),
      price: z.number().nonnegative(),
    }),
  ),
});

export const consultationCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  city: z.string().min(1),
  monthly_bill: z.string().optional(),
  message: z.string().optional(),
});

export const contactMessageStatusUpdateSchema = z.object({
  status: z.enum(['new', 'read', 'replied', 'closed']),
});

export const contactMessageCreateSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(64).optional(),
  subject: z.string().min(1).max(500),
  message: z.string().min(1).max(10000),
});

const quoteLineSchema = z
  .object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    productId: z.number().int().positive().optional().nullable(),
    variantLabel: z.string().optional().nullable(),
    catalogCategoryKey: z.string().optional().nullable(),
    catalogCustomCategory: z.string().optional().nullable(),
    itemTitle: z.string().optional().nullable(),
    itemDescription: z.string().optional().nullable(),
    includeInPdf: z.boolean().optional(),
  })
  .refine(
    (l) =>
      String(l.itemTitle ?? "").trim().length > 0 || String(l.description ?? "").trim().length > 0,
    { message: 'Each line needs a product title or description' },
  );

export const quoteDataSchema = z.object({
  lines: z.array(quoteLineSchema).min(1),
  taxPercent: z.number().nonnegative().max(100).optional(),
  discountAmount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  validUntil: z.string().optional(),
});

export const leadStatusSchema = z.enum(['New', 'Assigned', 'In Progress', 'Won', 'Lost']);

export const leadCreateSchema = z.object({
  name: z.string().min(1),
  contact: z.string().min(1),
  location: z.string().min(1),
  productInterest: z.string().min(1).optional(),
  notes: z.string().optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
});

export const leadPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    contact: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
    productInterest: z.string().min(1).optional(),
    status: leadStatusSchema.optional(),
    notes: z.string().optional(),
    assignedToUserId: z.string().uuid().nullable().optional(),
    quoteData: quoteDataSchema.nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

export const createSalesmanSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export const createAdminUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole),
});

export const patchSalesmanSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

export const blogCreateSchema = z.object({
  title: z.string().min(1),
  tag: z.string().optional(),
  imageUrl: z.string().min(1),
  excerpt: z.string().optional(),
  body: z.string().optional(),
  isPublished: z.boolean().optional(),
  /** ISO 8601 or datetime string */
  publishedAt: z.string().optional(),
});

export const blogUpdateSchema = z
  .object({
    title: z.string().min(1).optional(),
    tag: z.string().optional(),
    imageUrl: z.string().min(1).optional(),
    excerpt: z.string().optional(),
    body: z.string().optional(),
    isPublished: z.boolean().optional(),
    publishedAt: z.string().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });
