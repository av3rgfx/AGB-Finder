import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

/** Browser auth client (sign-in/out, session hook, admin actions). */
export const authClient = createAuthClient({
  plugins: [adminClient()],
});

export const { signIn, signOut, useSession } = authClient;
