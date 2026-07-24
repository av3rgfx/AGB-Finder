# Spec — UX Archivio (follow-up): scorciatoia, copia-link, visti di recente, listino sulle card

**Data:** 2026-07-24 (segue `2026-07-24-archivio-ux-design.md`)
**Branch:** `claude/archivio-ux-persistence-aj3zvy` (estende **PR #29**, ancora aperta).
**Workflow:** brainstorming → (nessun dubbio da council: decisioni prese) → questa spec → piano → TDD.
`/ponytail` per il codice.

---

## 1. Obiettivo

Quattro miglioramenti UX additivi all'Archivio, tutti a basso rischio e coerenti coi vincoli
(TS strict, tRPC/Prisma, UI in italiano, codici mono, mobile-first ≤375px, minimalismo).
**Nessuna migrazione, nessuna dipendenza, NESSUNA AZIONE OPS.**

A. **Scorciatoia tastiera `/`** per focalizzare la ricerca.
B. **«Copia link»** della ricerca (l'URL è già condivisibile).
C. **«Prodotti visti di recente»** (fonte: **`localStorage`**, per-dispositivo — decisione utente).
D. **Pulsante «visualizza nel listino» sulle card/righe** dei risultati (dati già disponibili).

---

## 2. A — Scorciatoia tastiera `/`

**Comportamento:** premendo `/` quando il focus **non** è già in un campo editabile
(`input`/`textarea`/`select`/`contenteditable`), si porta il focus sulla barra di ricerca
dell'Archivio (`preventDefault` per non inserire `/`). `Esc` mentre la barra è a fuoco la sfoca.
Beneficio desktop; su mobile (niente tastiera fisica) è inerte e innocuo.

**Implementazione:**
- Helper puro `src/lib/is-editable-target.ts` → `isEditableTarget(el: EventTarget | null): boolean`
  (true per input di testo/textarea/select/contenteditable) — **unit-testabile**.
- In `archivio-client.tsx`: `useEffect` con listener `keydown` su `window`. Riusa il
  `searchInputRef` già presente. `/` → focus; `Escape` quando l'attivo è la barra → `blur()`.
- **Hint di scoperta:** un `<kbd>/</kbd>` discreto nel `trailingSlot` dell'`Input` (prop già
  esistente), **solo desktop** (`hidden sm:flex`). Se in verifica browser si sovrappone al
  pulsante nativo di «clear» del `type=search`, si rimuove l'hint (la scorciatoia resta).

## 3. B — «Copia link»

**Comportamento:** un pulsante nell'intestazione dei risultati copia `window.location.href`
(che già codifica query/filtri/pagina grazie al lavoro precedente) e mostra «Copiato ✓» per ~2s.
Visibile **solo** nel ramo risultati (quindi con una ricerca attiva).

**Implementazione:**
- Nuovo `src/components/product/copy-link-button.tsx` (client), stessa meccanica di
  `copy-code-button.tsx` (stato `copied`, `navigator.clipboard.writeText`, try/catch fail-soft,
  `aria-label` che cambia). Icona `Link2`/`Check`. Copia `window.location.href` al click.
- Se `navigator.clipboard` è assente (contesto non sicuro), il pulsante non rompe nulla (catch).
- Reso in `archivio-client.tsx` nella riga del conteggio risultati (a destra), con `flex justify-between`.

## 4. C — «Prodotti visti di recente» (localStorage)

**Modello:** `interface ViewedProduct { id: string; agbCode: string; name: string }`.

**Modulo** `src/lib/recently-viewed.ts` (fail-soft, SSR-safe):
```ts
export function pushViewed(p: ViewedProduct): void; // dedup per id, unshift, cap 8, write
export function getViewed(): ViewedProduct[];        // read+parse+valida, [] su errore
```
- Chiave `archivio:recently-viewed`. `pushViewed` legge la lista, rimuove un eventuale duplicato
  per `id`, mette `p` in testa, tronca a 8, scrive (try/catch → no-op su quota/private).
- `getViewed` valida la forma di ogni voce (scarta le malformate).

**Registrazione:** in `ProductDetail` (`product-detail.tsx`), un `useEffect` su `product.isSuccess`
chiama `pushViewed({ id, agbCode, name })` con i dati del prodotto caricato.

**Visualizzazione:** nuovo `src/components/product/recently-viewed.tsx` (client): legge `getViewed()`
**post-mount** (in `useEffect` → stato, SSR-safe, niente flash) e mostra una sezione «Visti di
recente» con un elenco compatto di `<Link href="/archivio/[id]">` (codice **mono** + nome troncato).
Nessuna card-grid (anti-reference PRODUCT.md): lista/righe leggere.

**Collocazione:** nell'empty-state dell'Archivio (query vuota), **sopra** «Ricerche recenti»
(un prodotto concreto è più immediato di una query). Ordine empty-state: Visti di recente →
Ricerche recenti → Prova a cercare. Ogni sezione appare solo se ha contenuto.

## 5. D — Pulsante listino sulle card/righe (stretched-link)

**Dati:** `product.search` **restituisce già `listinoPage`** per ogni hit (SELECT del RAG,
`rag.ts`). Oggi `ProductSummary` non lo espone. → estendere `ProductSummary` con
`listinoPage?: number | null` (**opzionale**: gli hit di `getRelated` non lo hanno → resta
`undefined` → nessun pulsante lì, comportamento corretto).

**Problema markup:** card/riga sono un unico `<Link>` che avvolge tutto → non si può annidare un
`<button>` (`ListinoButton`) dentro un'anchor. Soluzione **stretched-link**:
- Il contenitore diventa `<div class="group relative …">` con dentro il contenuto (thumb, codice,
  nome, categoria, prezzo) come oggi.
- La navigazione al dettaglio è un `<Link class="absolute inset-0 z-0" aria-label={name}>` **vuoto**
  (nome accessibile da `aria-label`) che copre l'intera card → clic ovunque = vai al dettaglio.
- Il `ListinoButton` (già esistente) sta in `absolute` con `z-10` (sopra il link): è un **fratello**
  del link, non annidato → il suo clic apre il viewer e **non** naviga (nessuno `stopPropagation`
  necessario). Reso solo se `listinoPage != null` (`ListinoButton` ritorna già `null` altrimenti).
- Hover/focus: `hover:shadow-pop` e `transition-shadow` passano sul `div` contenitore;
  `group-hover:text-brand` sul nome; il focus-ring resta sul `<Link>` (bordo card intero).

**Card (griglia):** `ListinoButton` in alto a destra (`absolute right-2 top-2 z-10`), tutti i viewport.
**Riga (lista):** `ListinoButton` come **ultima cella** (icona), a destra del prezzo. A ≤375px la
riga è densa: se in verifica browser il pulsante causa overflow, lo si mostra solo `sm:` in su
(desktop) — sul mobile resta la scorciatoia via scheda dettaglio. Griglia riga aggiornata di
conseguenza.

**Contesto viewer:** `ListinoButton` usa `useListinoViewer()`; l'Archivio è già dentro
`ListinoViewerProvider` (in `layout.tsx`) → nessun provider aggiuntivo. Nei test dei componenti si
avvolge in un provider fittizio o si mocka il hook.

---

## 6. Error handling / edge cases
- `localStorage` assente/quota → `recently-viewed` fail-soft (no-op / `[]`).
- Clipboard assente/insicuro → `copy-link` catch, nessun crash.
- `/` con focus in un campo (anche di altre pagine/topbar) → ignorato (`isEditableTarget`).
- `listinoPage == null` → nessun pulsante (né duplicazione, né errori).
- Stretched-link: il link vuoto ha `aria-label` = nome (accessibile); il codice/nome restano nel
  DOM come testo (non nel nome del link) → nessun doppio annuncio.

## 7. Testing (TDD)

**Unit (Vitest puri):**
- `is-editable-target.test.ts`: input/textarea/select/contenteditable → true; div/button/null → false.
- `recently-viewed.test.ts` (jsdom): `pushViewed` dedup per id, ordine (ultimo in testa), cap 8;
  `getViewed` parse + scarta malformati + `[]` su JSON rotto; fail-soft su setItem che lancia.

**Componenti (Vitest + Testing Library):**
- `copy-link-button.test.tsx`: click → `navigator.clipboard.writeText` (mock) chiamato con
  `location.href`; stato «Copiato» dopo il click.
- `recently-viewed.test.tsx`: con voci mostra la sezione e i link `/archivio/[id]`; vuoto → nulla.
- `product-card.test.tsx` (esteso): il link stretched punta ancora a `/archivio/[id]`; con
  `listinoPage` valorizzato compare il `ListinoButton` (wrap in `ListinoViewerProvider`/hook mockato);
  senza `listinoPage`, nessun pulsante (test attuali restano verdi).
- `product-row.test.tsx` (nuovo): link al dettaglio + pulsante listino condizionale.

**Verifica browser (Chromium, desktop + ≤375px):**
- `/` focalizza la barra (e non scrive `/`); `Esc` la sfoca.
- «Copia link»: clic → clipboard = URL corrente + «Copiato ✓».
- «Visti di recente»: apri 2-3 prodotti → tornano nell'empty-state, cliccabili, in ordine, senza duplicati.
- Card/riga: clic sulla card → dettaglio; clic sul pulsante listino → apre il viewer **senza** navigare.
- Nessun overflow orizzontale a 375px (in particolare la riga col pulsante listino).

## 8. File

**Nuovi:** `src/lib/is-editable-target.ts` (+test) · `src/lib/recently-viewed.ts` (+test) ·
`src/components/product/copy-link-button.tsx` (+test) · `src/components/product/recently-viewed.tsx` (+test) ·
`src/components/product/product-row.test.tsx`.

**Modificati:** `archivio-client.tsx` (scorciatoia, copia-link, «visti di recente» nell'empty-state) ·
`product-card.tsx` (`ProductSummary.listinoPage?`, stretched-link + ListinoButton) ·
`product-row.tsx` (stretched-link + ListinoButton) · `product-detail.tsx` (`pushViewed` on view) ·
`product-card.test.tsx` (esteso).

**Nessuna migrazione DB. Nessuna dipendenza. NESSUNA AZIONE OPS.**

## 9. Ordine di build (indipendente, low-risk prima)
1. `is-editable-target` + scorciatoia `/` in archivio-client. 2. `copy-link-button` + integrazione.
3. `recently-viewed` (modulo → registrazione in detail → componente → empty-state).
4. `listino sulle card` (tipo `ProductSummary` → stretched-link card → riga → test).
5. Verifica browser ≤375px + desktop. Ogni step: gate verdi + commit.
