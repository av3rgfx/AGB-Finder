import { createAuthClient } from "better-auth/react";
import { adminClient, usernameClient } from "better-auth/client/plugins";

/** Browser auth client (sign-in/out, session hook, admin actions). */
export const authClient = createAuthClient({
  plugins: [adminClient(), usernameClient()],
});

export const { signIn, signOut, useSession } = authClient;
