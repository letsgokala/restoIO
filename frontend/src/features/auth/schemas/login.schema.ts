import { z } from 'zod';
export const createLoginSchema = (messages: { emailInvalid: string; passwordRequired: string }) => z.object({
  email: z.string().email(messages.emailInvalid),
  password: z.string().min(1, messages.passwordRequired),
});
export type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>;
