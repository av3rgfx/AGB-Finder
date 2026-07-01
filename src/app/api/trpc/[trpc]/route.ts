import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { getServerSession } from "next-auth";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { authOptions } from "@/server/auth/config";

const handler = async (req: Request) => {
  const session = await getServerSession(authOptions);
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ session }),
  });
};

export { handler as GET, handler as POST };
