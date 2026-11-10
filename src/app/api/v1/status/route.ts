import { connection } from "next/server";
import { partnerConfig } from "@/lib/server/partner";

/**
 * GET /api/v1/status
 *
 * Tells the app which optional services this deployment has, so it can offer
 * the AI partner only when one is really there. No secrets, nothing personal.
 */
export async function GET() {
  // Read the configuration when asked, not when the site was built.
  await connection();
  const config = partnerConfig();
  return Response.json(
    {
      ai: Boolean(config.apiKey),
      accounts: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
