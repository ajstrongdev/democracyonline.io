import { z } from "zod";
import { calculateIssuedSharesFromCapital } from "@/lib/utils/stock-economy";

export const CreateCompanySchema = z
  .object({
    name: z.string().min(1, "Company name is required").max(100),
    symbol: z
      .string()
      .min(1, "Stock symbol is required")
      .max(10)
      .regex(/^[A-Z]+$/, "Symbol must be uppercase letters only"),
    description: z.string().optional(),
    capital: z
      .number()
      .min(100, "Minimum startup capital is $100")
      .max(1000000, "Maximum startup capital is $1,000,000"),
    retainedShares: z.number().min(0, "Cannot retain negative shares"),
    logo: z.string().nullable().optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format")
      .default("#3b82f6"),
  })
  .refine(
    (data) => {
      const totalShares = calculateIssuedSharesFromCapital(data.capital);
      return data.retainedShares <= totalShares;
    },
    {
      message: "Cannot retain more shares than will be issued",
      path: ["retainedShares"],
    },
  );

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;

export const UpdateCompanySchema = z.object({
  companyId: z.number(),
  name: z.string().min(1, "Company name is required").max(100),
  description: z.string().optional(),
  logo: z.string().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format")
    .default("#3b82f6"),
});

export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;
