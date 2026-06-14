import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z
    .string()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(20, { message: "Username must be at most 20 characters" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
});

export const SignInSchema = z.object({
  email: z
    .string()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(20, { message: "Username must be at most 20 characters" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
});

export const CreateRoomSchema = z.object({
  slug: z
    .string()
    .min(3, { message: "Room name must be at least 3 characters" })
    .max(20, { message: "Room name must be at most 20 characters" })
    .regex(/^[a-z0-9-]+$/, {
      message:
        "Room name can only contain lowercase letters, numbers, and hyphens",
    }),
});
