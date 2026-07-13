/**
 * Email-segnaposto per gli account senza email reale (login via username).
 * Unica fonte di verità condivisa tra server (che la scrive) e client (che la
 * riconosce): NON duplicare il dominio altrove.
 */
export const PLACEHOLDER_EMAIL_DOMAIN = "no-email.ufptrade.local";

/** Email sintetica per un account senza email reale. */
export function placeholderEmailFor(username: string): string {
  return `${username}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

/** True se l'email è un segnaposto (account senza email reale). */
export function isPlaceholderEmail(email: string): boolean {
  return email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}
