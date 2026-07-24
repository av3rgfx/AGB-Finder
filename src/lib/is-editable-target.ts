/** True se il target è un campo editabile (per non intercettare le scorciatoie mentre si scrive). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable || target.getAttribute("contenteditable") === "true";
}
