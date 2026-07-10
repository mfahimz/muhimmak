import { z } from 'zod';

/**
 * A staff PIN is always exactly 4 digits. Kept as a string (not number) so
 * leading zeros ("0042") are preserved.
 */
export const pinSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, 'PIN must be exactly 4 digits');

export const loginRequestSchema = z.object({
  profileId: z.string().uuid('Select who you are'),
  pin: pinSchema,
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
