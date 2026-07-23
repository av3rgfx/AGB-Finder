function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * customTextRenderer per react-pdf: ritorna l'HTML del text-item con il codice
 * evidenziato. Match esatto (case-insensitive) all'interno del singolo item.
 */
export function makeHighlighter(code: string): (item: { str: string }) => string {
  const needle = code.toUpperCase();
  return ({ str }) => {
    if (!str) return str;
    const idx = str.toUpperCase().indexOf(needle);
    if (idx === -1) return escapeHtml(str);
    return (
      escapeHtml(str.slice(0, idx)) +
      `<mark class="listino-hl">${escapeHtml(str.slice(idx, idx + needle.length))}</mark>` +
      escapeHtml(str.slice(idx + needle.length))
    );
  };
}
