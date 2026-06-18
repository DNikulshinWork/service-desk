import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

export const registerInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileInputSchema = z.object({
  name: z.string().min(1).optional(),
});

export const companyInputSchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional(),
});

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.string(),
});

export const companySchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().optional(),
  ownerId: z.string(),
});

export const authUserResponseSchema = z.object({
  user: userSchema,
});

export const authLoginResponseSchema = z.object({
  accessToken: z.string(),
  user: userSchema,
});

export const meResponseSchema = z.object({
  user: userSchema,
});

export const companiesResponseSchema = z.object({
  companies: z.array(companySchema),
});

export const companyUsersResponseSchema = z.object({
  company: companySchema,
  users: z.array(userSchema),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
export type CompanyInput = z.infer<typeof companyInputSchema>;
export type User = z.infer<typeof userSchema>;

