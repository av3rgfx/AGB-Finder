import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { auth } from "@/server/auth/config";

// Il loop tool-use della chat supera i 10s di default delle function Vercel.
// Cap del piano Vercel Hobby = 60s (con billing Gemini attivo una chat normale
// resta in 2–5s). Al passaggio a Vercel Pro rialzare a 300.
export const maxDuration = 60;

const handler = async (req: Request) => {
  const session = await auth.api.getSession({ headers: req.headers });
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ session, headers: req.headers }),
  });
};

export { handler as GET, handler as POST };
