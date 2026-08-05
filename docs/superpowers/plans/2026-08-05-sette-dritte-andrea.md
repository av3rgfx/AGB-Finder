# Le sette dritte di Andrea — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Applicare le sette correzioni che Andrea ha portato dal campo sul catalogo maniglie COLOMBO: copia senza separatori, sei correzioni di curatela (etichette), la regola sulle foto della finitura sbagliata, la sezione «Accessori» e l'anteprima della tendina.

**Architecture:** Tutto si calcola **a lettura**. Le regole di dominio stanno in moduli TypeScript puri (`curatela.ts`, `finiture.ts`, `foto-archivio.ts`), mai nel raw SQL: al `$queryRaw` arriva al massimo una lista di id già decisa. Nessuna migrazione, nessuna colonna nuova, nessuna dipendenza nuova. L'unica scrittura a DB è `articles.image_url`, che il run ops ricalcola per intero.

**Tech Stack:** Next 15 App Router · React 19 · TypeScript strict · tRPC v11 · Prisma 6 · Tailwind 3 · Vitest.

## Global Constraints

- **TypeScript strict** sempre. Tutte le API via **tRPC**; tutte le query via **Prisma**, salvo i due moduli di ricerca nominati.
- **Le regole di dominio NON stanno nel raw SQL.** `curatela.ts`, `finiture.ts`, `foto-archivio.ts` e `browse.ts` sono TypeScript puro.
- **UI in italiano.** Codici prodotto in `font-mono` (JetBrains Mono).
- **Mobile-first**: ogni superficie toccata va verificata a **≤375px** *e* desktop, con screenshot guardati.
- **Vietati** i bordi laterali colorati, le animazioni di layout, gli em dash nel testo a schermo.
- **Il repo è PUBBLICO**: mai committare listino, giacenze o foto del fornitore. Nei `.md` solo numeri aggregati. La password dell'area download non si scrive in nessun file.
- Un commit per task, messaggio in italiano.
- Ambiente: `set -a; source .env; set +a` prima di `pnpm tsx`/prisma. Docker muore da solo: `pgrep dockerd || (setsid nohup dockerd >/tmp/dockerd.log 2>&1 & disown)` poi `docker start ufptrade-db`.
- Gate finale: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`. **Mai `pnpm build` mentre gira `pnpm dev`** (condividono `.next`).

---

### Task 1: `CopyCodeButton` copia una cosa e ne mostra un'altra

**Files:**
- Modify: `src/components/product/copy-code-button.tsx`
- Modify: `src/app/(dashboard)/maniglie/[id]/articolo-client.tsx`
- Create: `src/components/product/copy-code-button.test.tsx`

**Interfaces:**
- Produces: `CopyCodeButton({ code, copyAs }: { code: string; copyAs?: string })` — copia `copyAs ?? code`, mostra sempre `code`.

- [ ] **Step 1: Write the failing test**

`src/components/product/copy-code-button.test.tsx`:

```tsx
import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyCodeButton } from "./copy-code-button";

/**
 * Il pulsante è CONDIVISO coi serramenti, dove i codici sono `A50122.08.07` e
 * togliere i punti sarebbe sbagliato. Il default protegge quel reparto: senza
 * `copyAs` si copia esattamente ciò che si vede.
 */
describe("CopyCodeButton", () => {
  const writeText = vi.fn(() => Promise.resolve());
  beforeEach(() => {
    writeText.mockClear();
    Object.assign(navigator, { clipboard: { writeText } });
  });

  test("senza copyAs copia ciò che mostra — è il caso dei serramenti", async () => {
    render(<CopyCodeButton code="A50122.08.07" />);
    await userEvent.click(screen.getByRole("button"));
    expect(writeText).toHaveBeenCalledWith("A50122.08.07");
  });

  test("con copyAs mostra il codice col trattino e copia quello normalizzato", async () => {
    render(<CopyCodeButton code="0ID41R-CR" copyAs="0ID41RCR" />);
    expect(screen.getByRole("button")).toHaveTextContent("0ID41R-CR");
    await userEvent.click(screen.getByRole("button"));
    expect(writeText).toHaveBeenCalledWith("0ID41RCR");
  });

  test("l'etichetta accessibile nomina il codice VISIBILE, non quello copiato", () => {
    render(<CopyCodeButton code="0ID41R-CR" copyAs="0ID41RCR" />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Copia codice 0ID41R-CR");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/product/copy-code-button.test.tsx`
Expected: FAIL — il secondo test copia `0ID41R-CR` invece di `0ID41RCR`.

- [ ] **Step 3: Implement**

In `src/components/product/copy-code-button.tsx`, sostituire la firma e la riga della copia:

```tsx
/**
 * `copyAs` esiste perché i due reparti scrivono i codici in modo diverso e uno
 * solo dei due va normalizzato. Le maniglie si ordinano `0ID41RCR` ma si
 * leggono `0ID41R-CR`; i serramenti si ordinano `A50122.08.07`, punti compresi.
 * Il default è «copia ciò che mostri», quindi nessuna chiamata esistente cambia
 * comportamento e chi aggiunge una schermata non deve ricordarsi di nulla.
 */
export function CopyCodeButton({ code, copyAs }: { code: string; copyAs?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyAs ?? code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard non disponibile: nessun feedback, il codice resta selezionabile
    }
  };
```

Il resto del componente non cambia: `aria-label` e il testo continuano a usare `code`, che è ciò che l'utente vede.

- [ ] **Step 4: Passare il valore dalla scheda articolo**

In `src/app/(dashboard)/maniglie/[id]/articolo-client.tsx`, trovare il `<CopyCodeButton code={...} />` e aggiungere la prop, prendendo `codeNorm` dal dato già presente nella risposta di `article.getById`:

```tsx
<CopyCodeButton code={articolo.code} copyAs={articolo.codeNorm} />
```

Se `codeNorm` non è nel `select` della procedura, aggiungerlo lì (`src/server/api/routers/article.ts`, procedura `getById`): è la colonna che l'import ha già scritto, non un calcolo nuovo.

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/components/product/copy-code-button.test.tsx && pnpm typecheck`
Expected: PASS, 3 test.

- [ ] **Step 6: Commit**

```bash
git add src/components/product/copy-code-button.tsx src/components/product/copy-code-button.test.tsx "src/app/(dashboard)/maniglie/[id]/articolo-client.tsx" src/server/api/routers/article.ts
git commit -m "feat(maniglie): il codice si copia senza separatori, e solo qui

Andrea ordina 0ID41RCR e legge 0ID41R-CR. Il pulsante è condiviso coi
serramenti, dove A50122.08.07 va copiato coi punti: il default resta
«copia ciò che mostri», quindi quel reparto non cambia di una riga.
Il valore non si ricalcola in UI, è articles.code_norm — la stessa
chiave con cui si aggancia la pronta consegna."
```

---

### Task 2: Le quattro fusioni nuove

**Files:**
- Modify: `src/server/maniglie/curatela.ts:46-75` (tabella `fusioni` di COLOMBO)
- Modify: `src/server/maniglie/curatela.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces: `browseLabel("COLOMBO", …)` mappa `PL.`→`PLACCA`, `BOCCHETTE`→`BOCCHETTA`, `HEIDI/PETER`→`HEIDI`, `LUNDCREM`→`LUND`.

- [ ] **Step 1: Write the failing test**

In `src/server/maniglie/curatela.test.ts`, dentro `describe("browseLabel — fusioni")`, aggiungere:

```ts
  /**
   * Le quattro chieste da Andrea il 2026-08-05, ognuna con una riga VERA del
   * listino `LP 02-26`. `PL.`+`PLACCA` erano state tenute separate perché
   * misurate come due prodotti (`PB02*` contro `0AM113PL*`): Andrea è la fonte
   * di verità sulla sua tassonomia, e la fusione non perde la distinzione —
   * gli 87 codici restano divisi in 14 serie al livello 2.
   */
  test.each([
    ["PL.OTT. 85mm. + SOTTOPL.NYLON", "PLACCA"],
    ["PL.OTT.YALE 93mm+SOTTOPL.NYLON", "PLACCA"],
    ["HEIDI/PETER CREM CD32 OROPLUS", "HEIDI"],
    ["LUNDCREM SE12 GRAFITE MAT", "LUND"],
  ])("%s si elenca sotto %s", (name, atteso) => {
    expect(browseLabel("COLOMBO", name)).toBe(atteso);
  });

  // Il plurale arriva sciogliendo COPPIA (task 3): `COPPIA BOCCHETTE YALE` deve
  // finire in BOCCHETTA e non fondare un gruppo nuovo da 28 codici. Misurando
  // è successo davvero, e nessun conteggio sarebbe andato a zero.
  test("il plurale BOCCHETTE è BOCCHETTA", () => {
    expect(browseLabel("COLOMBO", "BOCCHETTE YALE ZERO")).toBe("BOCCHETTA");
  });
```

E in `describe("sourceFirstWords")` (o equivalente esistente):

```ts
  test("PLACCA raccoglie anche le tre grafie con PL.", () => {
    expect(sourceFirstWords("COLOMBO", "PLACCA")).toEqual([
      "PL.",
      "PL.OTT.",
      "PL.OTT.YALE",
      "PLACCA",
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/maniglie/curatela.test.ts`
Expected: FAIL — `browseLabel("COLOMBO", "PL.OTT. …")` restituisce `PL.`, non `PLACCA`.

- [ ] **Step 3: Implement**

In `src/server/maniglie/curatela.ts`, dentro `CURATELE.COLOMBO.fusioni`, **sostituire** le due righe `"PL.OTT."`/`"PL.OTT.YALE"` (che oggi puntano a `"PL."`) e aggiungere le altre:

```ts
      // ── 2026-08-05, seconda tornata di Andrea ───────────────────────────
      // `PL.` è l'abbreviazione di `PLACCA`. La sessione scorsa le teneva
      // separate perché misurate come due prodotti (placche in ottone `PB02*`
      // contro placche dei maniglioni `0AM113PL*`), e la misura era giusta ma
      // la domanda era sbagliata: la tassonomia è di Andrea. La distinzione
      // non si perde, la fa il livello 2 — 87 codici in 14 serie.
      "PL.": "PLACCA", //                22
      "PL.OTT.": "PLACCA", //             1
      "PL.OTT.YALE": "PLACCA", //        11
      // Il plurale, che arriva sciogliendo COPPIA: senza questa riga
      // `COPPIA BOCCHETTE YALE` fonderebbe un gruppo nuovo da 28 codici.
      BOCCHETTE: "BOCCHETTA",
      // Cremonesi delle due serie: la maniglia si chiama HEIDI (CD31) e LUND
      // (SE11), la cremonese CD32 e SE12. La foto NON le segue: ci pensa la
      // `serie` dichiarata sugli archivi (`foto-archivio.ts`).
      "HEIDI/PETER": "HEIDI", //          2
      LUNDCREM: "LUND", //                1
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/server/maniglie/curatela.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/curatela.ts src/server/maniglie/curatela.test.ts
git commit -m "feat(maniglie): PL. è PLACCA, e le due cremonesi tornano dalla loro maniglia

Quattro fusioni chieste da Andrea, ognuna misurata su righe vere del
listino. PL.+PLACCA fa 87 codici che il livello 2 divide comunque in 14
serie, quindi la distinzione misurata la sessione scorsa non si perde:
cambia solo chi la dichiara. BOCCHETTE al plurale serve al task 3."
```

---

### Task 3: `COPPIA` si scioglie — le prime parole trasparenti

**Files:**
- Modify: `src/server/maniglie/curatela.ts` (interfaccia `Curatela`, `labelFromTokens`, `sourceFirstWords`, `resolveLabel`, `vociCuratela`)
- Modify: `src/server/maniglie/curatela.test.ts`

**Interfaces:**
- Consumes: le fusioni del Task 2 (in particolare `BOCCHETTE`→`BOCCHETTA` e `MANIGLIONI`→`MANIGLIONE`).
- Produces: `browseLabel("COLOMBO", "COPPIA BOCCHETTE YALE ZERO") === "BOCCHETTA"`. `sourceFirstWords` include sempre le trasparenti. `resolveLabel("COLOMBO", "COPPIA") === null`.

- [ ] **Step 1: Write the failing test**

In `src/server/maniglie/curatela.test.ts`:

```ts
/**
 * `COPPIA` non è un prodotto, è una confezione: «COPPIA BOCCHETTE YALE» è una
 * bocchetta, e Andrea ha ragione che una categoria «COPPIA» non esiste.
 * Misurato sul listino vero: 35 codici, e sono puliti — 7 `COPPIA MANIGLIONI`
 * e 28 `COPPIA BOCCHETTE`, nient'altro.
 *
 * L'etichetta viene dal SECONDO token, che poi passa dalla stessa tabella di
 * fusioni di tutti gli altri: è ciò che manda `BOCCHETTE` in `BOCCHETTA` e
 * `MANIGLIONI` in `MANIGLIONE` senza una seconda regola.
 */
describe("browseLabel — prime parole trasparenti", () => {
  test.each([
    ["COPPIA BOCCHETTE YALE ZERO", "BOCCHETTA"],
    ["COPPIA BOCCHETTE PATENT Q ZERO", "BOCCHETTA"],
    ["COPPIA MANIGLIONI CLOUD LC26", "MANIGLIONE"],
    ["COPPIA MANIGLIONI WIND LC36", "MANIGLIONE"],
  ])("%s si elenca sotto %s", (name, atteso) => {
    expect(browseLabel("COLOMBO", name)).toBe(atteso);
  });

  // Una parola trasparente da sola non dice che prodotto sia. Meglio non
  // sfogliarla che inventarle una categoria.
  test("«COPPIA» da sola non si sfoglia", () => {
    expect(browseLabel("COLOMBO", "COPPIA")).toBeNull();
  });

  // Il `WHERE` del livello 2 sa leggere solo la prima parola cruda: se COPPIA
  // non fosse fra le sorgenti, i 28 codici entrerebbero nel conteggio di
  // BOCCHETTA e poi sparirebbero aprendolo.
  test("le trasparenti sono fra le sorgenti di ogni etichetta", () => {
    expect(sourceFirstWords("COLOMBO", "BOCCHETTA")).toContain("COPPIA");
    expect(sourceFirstWords("COLOMBO", "MANIGLIONE")).toContain("COPPIA");
  });

  // …ma non di un'etichetta esclusa, o `?tipo=VITE` rimetterebbe a schermo un
  // gruppo che abbiamo tolto.
  test("un'etichetta esclusa non prende sorgenti", () => {
    expect(sourceFirstWords("COLOMBO", "VITE")).toEqual([]);
  });

  // Un link condiviso prima dello scioglimento: COPPIA non è più un'etichetta,
  // e non se ne può scegliere una delle due — la risposta vera è «non si
  // sfoglia», che la pagina mostra come stato vuoto e non come gruppo finto.
  test("un ?tipo=COPPIA vecchio non risolve a nulla", () => {
    expect(resolveLabel("COLOMBO", "COPPIA")).toBeNull();
  });

  test("la sentinella della curatela cita anche le trasparenti", () => {
    expect(vociCuratela("COLOMBO")).toContain("COPPIA");
  });
});
```

E il conteggio del livello 1, che è la prova che i due gruppi assorbono davvero:

```ts
test("foldBrowseGroups somma COPPIA nei due gruppi giusti", () => {
  const gruppi = foldBrowseGroups("COLOMBO", [
    { first: "BOCCHETTA", second: "CD41", count: 290 },
    { first: "COPPIA", second: "BOCCHETTE", count: 28 },
    { first: "COPPIA", second: "MANIGLIONI", count: 7 },
    { first: "MANIGLIONE", second: "AM113", count: 346 },
  ]);
  expect(gruppi).toEqual([
    { word: "BOCCHETTA", count: 318 },
    { word: "MANIGLIONE", count: 353 },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/maniglie/curatela.test.ts`
Expected: FAIL — `browseLabel("COLOMBO", "COPPIA BOCCHETTE YALE ZERO")` restituisce `"COPPIA"`.

- [ ] **Step 3: Implement**

In `src/server/maniglie/curatela.ts`:

**(a)** aggiungere il campo all'interfaccia `Curatela`, sotto `divise`:

```ts
  /**
   * Prime parole che non nominano il prodotto ma la CONFEZIONE: l'etichetta
   * viene dal secondo token. «COPPIA BOCCHETTE YALE» è una bocchetta, e una
   * categoria «COPPIA» raccoglierebbe oggetti che non hanno niente in comune
   * tranne l'essere venduti a due a due.
   *
   * Il secondo token ripassa dalle `fusioni`, quindi `BOCCHETTE`→`BOCCHETTA` e
   * `MANIGLIONI`→`MANIGLIONE` valgono anche qui senza una seconda regola.
   */
  trasparenti: ReadonlySet<string>;
```

**(b)** popolarlo in `CURATELE.COLOMBO`, dopo `divise`:

```ts
    // Misurato: 35 codici, 7 `COPPIA MANIGLIONI` e 28 `COPPIA BOCCHETTE`.
    // Nessuna delle due destinazioni ha archivio fotografico, quindi lo
    // scioglimento non può prestare la foto di un modello a un altro.
    trasparenti: new Set(["COPPIA"]),
```

**(c)** aggiungerlo a `VUOTA`:

```ts
const VUOTA: Curatela = {
  fusioni: {},
  escluse: new Set(),
  divise: new Set(),
  trasparenti: new Set(),
};
```

**(d)** `labelFromTokens` — la trasparenza si applica **per prima**:

```ts
function labelFromTokens(brand: string, first: string, second: string | null): string | null {
  const c = curatelaDi(brand);
  // Le trasparenti per prime: il resto della regola vale sul token che nomina
  // davvero il prodotto. `divise` non si riapplica dopo lo spostamento, e non
  // è una dimenticanza: il `GROUP BY` del livello 1 restituisce due token, non
  // tre, quindi il marcatore della S dopo una trasparente non è leggibile.
  // Misurato che il caso non esiste: dentro COPPIA ci sono solo MANIGLIONI e
  // BOCCHETTE, e nessuna delle due è divisa.
  if (c.trasparenti.has(first)) {
    if (second === null || c.escluse.has(second)) return null;
    return c.fusioni[second] ?? second;
  }
  if (c.escluse.has(first)) return null;
  if (c.divise.has(first) && MARCATORE_S.test(second ?? "")) return `${first} S`;
  return c.fusioni[first] ?? first;
}
```

**(e)** `sourceFirstWords` — le trasparenti si includono sempre:

```ts
export function sourceFirstWords(brand: string, label: string): string[] {
  const c = curatelaDi(brand);
  if (c.escluse.has(label)) return [];
  const base = label.endsWith(" S") ? label.slice(0, -2) : label;
  if (label.endsWith(" S")) return c.divise.has(base) ? [base] : [];
  const words = new Set([base]);
  for (const [storta, giusta] of Object.entries(c.fusioni)) {
    if (giusta === label) words.add(storta);
  }
  // Una trasparente può produrre QUALUNQUE etichetta, e da qui non si sa
  // quale: si includono tutte e ci pensa il rifiltro con `browseLabel`, che
  // il chiamante fa già. Costa una parola in più nella `IN` e fino a 35 righe
  // lette per gruppo; calcolare quali etichette una trasparente produca
  // davvero vorrebbe dire scandire il listino da un modulo che non lo vede.
  for (const t of c.trasparenti) words.add(t);
  return [...words].sort();
}
```

**(f)** `resolveLabel` — una trasparente non risolve:

```ts
export function resolveLabel(brand: string, tipo: string): string | null {
  const c = curatelaDi(brand);
  if (c.escluse.has(tipo) || c.trasparenti.has(tipo)) return null;
  return c.fusioni[tipo] ?? tipo;
}
```

**(g)** `vociCuratela` — la sentinella le cita:

```ts
export function vociCuratela(brand: string): string[] {
  const c = curatelaDi(brand);
  return [...Object.keys(c.fusioni), ...c.escluse, ...c.divise, ...c.trasparenti].sort();
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/server/maniglie/ && pnpm typecheck`
Expected: PASS. Se `search.test.ts` o altri test costruiscono un `Curatela` a mano, aggiungere `trasparenti: new Set()`.

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/curatela.ts src/server/maniglie/curatela.test.ts
git commit -m "feat(maniglie): COPPIA non è una categoria, è una confezione

Andrea: «COPPIA BOCCHETTE YALE dovrebbe stare dentro BOCCHETTE». Ha
ragione, e vale per tutte e 35 le righe — misurato che dentro COPPIA ci
sono solo MANIGLIONI (7) e BOCCHETTE (28).

La prima parola trasparente cede l'etichetta al secondo token, che
ripassa dalle stesse fusioni: BOCCHETTA 290 -> 318, MANIGLIONE 346 -> 353."
```

---

### Task 4: La foto non segue la fusione delle cremonesi

**Files:**
- Modify: `src/server/maniglie/foto-archivio.ts:61,66` (voci `01_Heidi` e `01_Lund` di `ARCHIVI`)
- Modify: `src/server/maniglie/foto-archivio.test.ts`

**Interfaces:**
- Consumes: le fusioni del Task 2.
- Produces: `abbinaFoto` non assegna foto a `0CD32-*` né a `0SE12-*`.

- [ ] **Step 1: Write the failing test**

In `src/server/maniglie/foto-archivio.test.ts`:

```ts
/**
 * Le fusioni del 2026-08-05 mandano tre cremonesi dentro il gruppo della loro
 * maniglia. Senza guardia erediterebbero la foto della maniglia — e la regola
 * sulle finiture NON le intercetta: `0CD32-UB` prenderebbe `Heidi_R_UB`, cioè
 * finitura provata giusta e PRODOTTO sbagliato.
 *
 * La guardia è la `serie` già usata per ROBOT (CD41/CD75) e MOOD (CC11/CC21).
 * La fonte qui è il LISTINO, non i nomi dei file: COLOMBO scrive «HEIDI CD31R»
 * e «HEIDI/PETER CREM CD32». È scritta da COLOMBO, in un altro suo documento.
 */
describe("le cremonesi non ereditano la foto della loro maniglia", () => {
  const foto: FotoArchivio[] = [
    { archivio: "01_Heidi", nome: "Heidi_R_UB" },
    { archivio: "01_Lund", nome: "lund_2CM" },
  ];

  test("la maniglia HEIDI la prende", () => {
    const m = abbinaFoto("COLOMBO", [
      { id: "h", code: "0CD31R-UB", codeNorm: "0CD31RUB", name: "HEIDI CD31R UMBER BRONZE" },
    ], foto);
    expect(m.get("h")).toBe(chiaveFoto("01_Heidi", "Heidi_R_UB"));
  });

  test("la cremonese CD32 no, benché ora si elenchi sotto HEIDI", () => {
    const m = abbinaFoto("COLOMBO", [
      { id: "c", code: "0CD32-UB", codeNorm: "0CD32UB", name: "HEIDI/PETER CREM CD32 UMBER" },
    ], foto);
    expect(m.has("c")).toBe(false);
  });

  test("la maniglia LUND la prende, la cremonese SE12 no", () => {
    const m = abbinaFoto("COLOMBO", [
      { id: "m", code: "0SE11R-CM", codeNorm: "0SE11RCM", name: "LUND SE11R CROMAT" },
      { id: "c", code: "0SE12-GM", codeNorm: "0SE12GM", name: "LUNDCREM SE12 GRAFITE MAT" },
    ], foto);
    expect(m.get("m")).toBe(chiaveFoto("01_Lund", "lund_2CM"));
    expect(m.has("c")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/maniglie/foto-archivio.test.ts`
Expected: FAIL — la cremonese riceve la chiave della maniglia.

- [ ] **Step 3: Implement**

In `src/server/maniglie/foto-archivio.ts`, sostituire le due voci:

```ts
  // ── due archivi che ora ospitano anche una cremonese ────────────────────────
  // Dal 2026-08-05 `HEIDI/PETER` si elenca sotto HEIDI e `LUNDCREM` sotto LUND
  // (fusioni chieste da Andrea). Ma la cremonese è un altro prodotto, e senza
  // `serie` prenderebbe la foto della maniglia: una foto che esiste, si vede
  // benissimo, ed è di un'altra cosa.
  // La fonte della serie è il LISTINO e non i nomi dei file — COLOMBO scrive
  // «HEIDI CD31R» contro «HEIDI/PETER CREM CD32», «LUND SE11R» contro
  // «LUNDCREM SE12». Va detto, perché la regola di questo campo è «solo dove
  // COLOMBO l'ha scritta» e qui l'ha scritta altrove.
  "01_Heidi": { etichetta: "HEIDI", serie: "CD31" },
  "01_Lund": { etichetta: "LUND", serie: "SE11" },
```

(rimuovere le due righe originali `"01_Heidi": { etichetta: "HEIDI" }` e `"01_Lund": { etichetta: "LUND" }` dall'elenco alfabetico dei modelli.)

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/server/maniglie/foto-archivio.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/foto-archivio.ts src/server/maniglie/foto-archivio.test.ts
git commit -m "fix(maniglie): la fusione sposta l'etichetta, non la foto

HEIDI/PETER e LUNDCREM sono cremonesi; HEIDI e LUND sono maniglie con
archivio. Fondendo le etichette, i tre codici avrebbero preso la foto
della maniglia — e la regola sulle finiture non li salva: 0CD32-UB
avrebbe avuto Heidi_R_UB, finitura giusta e prodotto sbagliato.

Guardia = la serie già usata per ROBOT e MOOD. La fonte è il listino,
non i nomi dei file, ed è scritto nel commento."
```

---

### Task 5: Le finiture scritte a parole

**Files:**
- Modify: `src/server/maniglie/finiture.ts`
- Modify: `src/server/maniglie/finiture.test.ts`

**Interfaces:**
- Produces: `finituraDiTesto(s: string): string | null` — il codice della finitura nominata nel testo, `null` se non ce n'è o se ce ne sono due (bicolore).

- [ ] **Step 1: Write the failing test**

In `src/server/maniglie/finiture.test.ts`:

```ts
/**
 * COLOMBO scrive la finitura nei nomi dei file in due modi: col suo codice
 * (`Fedra_1OL`) o A PAROLE (`due frontale capri blue`). Il secondo caso non era
 * letto, e sono 268 file su 638 — è la ragione per cui tutti gli otto
 * `0CC31R-C0x` mostravano la maniglia blu.
 *
 * Il match ingenuo sarebbe stato PEGGIO del silenzio: `Cromo` è sottostringa di
 * «cromo matte», che è Cromat. La prova sta nel listino stesso — nell'archivio
 * `01_Ama` COLOMBO scrive «cromat» sulla variante zero e «cromo matte» su
 * quella liscia. Quindi: match più lungo, alias ricavati dal vocabolario
 * chiuso delle 195 code, e i bicolori rifiutati.
 */
describe("finituraDiTesto", () => {
  test.each([
    ["due frontale capri blue", "C12"],
    ["dueq frontale lemon yellow", "C09"],
    ["oneq frontale strawberry red", "C07"],
    ["Laconica_still_01 Oroplus", "OL"],
    ["Laconica_still_06 Cherry", "CH"],
    ["R6S_still_05 Biancomat", "BI"],
  ])("%s è %s", (nome, atteso) => {
    expect(finituraDiTesto(nome)).toBe(atteso);
  });

  // I quattro casi in cui un nome ufficiale è PREFISSO di un altro: vince il
  // più lungo, o si affermerebbe la finitura sbagliata con la stessa sicurezza.
  test.each([
    ["Laconica_still_04 Umber bronze", "UB"], // non C02 «Bronze»
    ["R6_still_04 Silvermat", "SM"], //         non C04 «Silver»
    ["Laconica_still_03 Grafite Mat", "GM"], // non GL «Grafite»
    ["electra verticale vintage matte", "VM"], // non VL «Vintage»
  ])("%s è %s e non il nome più corto che ci sta dentro", (nome, atteso) => {
    expect(finituraDiTesto(nome)).toBe(atteso);
  });

  // Gli alias, tutti ricavati dal vocabolario reale dei nomi file.
  test.each([
    ["ama cromo matte", "CM"], //               «cromo mat» = Cromat: lo dice 01_Ama
    ["gryps frontale oro matte", "OM"],
    ["elle frontale nero matte", "NM"],
    ["robocinque zero frontale bianco matte", "BI"],
    ["robocinque verticale matte white", "BI"], //  ordine invertito
    ["flessa nickel matte", "NI"], //            Nikelmat scritto all'inglese
  ])("%s è %s", (nome, atteso) => {
    expect(finituraDiTesto(nome)).toBe(atteso);
  });

  // Un bicolore non è una delle 31: dichiararne una sarebbe inventare.
  test.each([
    ["963 verticale cromo-cromo matte 2", null],
    ["alba cromo-cromo matte", null],
  ])("%s è un bicolore, quindi nessuna", (nome, atteso) => {
    expect(finituraDiTesto(nome)).toBe(atteso);
  });

  test("il nome del modello da solo non è una finitura", () => {
    expect(finituraDiTesto("Fedra_def")).toBeNull();
    expect(finituraDiTesto("Robot m verticale")).toBeNull();
  });

  // «cromo» pieno esiste eccome, e non va confuso col matte.
  test("cromo liscio resta Cromo", () => {
    expect(finituraDiTesto("Kubo_ID45_frontal_Cromo")).toBe("CR");
  });
});
```

Aggiungere `finituraDiTesto` all'import in cima al file di test.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/maniglie/finiture.test.ts`
Expected: FAIL con "finituraDiTesto is not a function".

- [ ] **Step 3: Implement**

In fondo a `src/server/maniglie/finiture.ts`:

```ts
/**
 * Le grafie con cui COLOMBO scrive una finitura A PAROLE nei nomi dei file,
 * quando non usa il suo codice. Ricavate dal vocabolario CHIUSO dei nomi reali
 * (638 scatti di prodotto → 195 code distinte, guardate una per una), non
 * indovinate: ognuna compare nell'archivio.
 *
 * `cromo mat` è la più importante e la meno ovvia: vale **Cromat**, non Cromo.
 * Lo dimostra l'archivio `01_Ama`, dove COLOMBO scrive `cromat` sulla variante
 * zero e `cromo matte` su quella liscia — stessa finitura, due generazioni di
 * nomi. Senza questa riga, il match più lungo direbbe «Cromo» su 64 file.
 */
const GRAFIE: Record<string, string> = {
  cromomat: "CM",
  oromat: "OM",
  neromat: "NM", // «nero matte»
  biancomat: "BI", // «bianco matte»
  matwhite: "BI", // le stesse due parole in ordine inverso, stesso archivio
  nickelmat: "NI", // Nikelmat scritto all'inglese
};

/** `matte` e `mat` sono la stessa parola; i separatori non contano. */
function normalizzaTesto(s: string): string {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((t) => (t === "matte" ? "mat" : t))
    .join("");
}

/**
 * Gli aghi in ordine di LUNGHEZZA DECRESCENTE: quattro nomi ufficiali sono
 * prefisso di un altro (`Bronze`⊂`Umber Bronze`, `Silver`⊂`Silvermat`,
 * `Grafite`⊂`Grafite Mat`, `Vintage`⊂`Vintage Mat`), e col primo che capita si
 * affermerebbe la finitura sbagliata con la stessa sicurezza della giusta.
 *
 * Sotto i 4 caratteri un ago aggancerebbe per caso.
 */
const AGHI: { codice: string; ago: string }[] = [
  ...FINITURE.map((f) => ({ codice: f.codice, ago: normalizzaTesto(f.nome) })),
  ...Object.entries(GRAFIE).map(([ago, codice]) => ({ codice, ago })),
]
  .filter((x) => x.ago.length >= 4)
  .sort((a, b) => b.ago.length - a.ago.length);

/**
 * La finitura NOMINATA in un testo libero, `null` se non ce n'è.
 *
 * `null` anche per i **bicolori** (`cromo-cromo matte`, 16 file): due finiture
 * nello stesso nome non fanno una delle 31, e sceglierne una sarebbe inventare
 * — la stessa ragione per cui `CR8` e `OL9` non sono nella tabella.
 */
export function finituraDiTesto(s: string): string | null {
  const n = normalizzaTesto(s);
  const trovati = new Set<string>();
  let primo: string | null = null;
  for (const { codice, ago } of AGHI) {
    if (!n.includes(ago)) continue;
    trovati.add(codice);
    primo ??= codice;
  }
  return trovati.size === 1 ? primo : null;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/server/maniglie/finiture.test.ts`
Expected: PASS.

- [ ] **Step 5: Collegare `finituraDiFoto`**

In `src/server/maniglie/foto-archivio.ts`, sostituire il corpo e il commento di `finituraDiFoto`:

```ts
/**
 * La finitura che COLOMBO ha scritto nel nome del file: come SUO codice
 * (`Fedra_1OL`, `robot41_4NM_new`) oppure A PAROLE (`due frontale capri blue`).
 *
 * Le due strade sono disgiunte sui 638 scatti reali — zero file le hanno
 * entrambe — quindi l'ordine fra loro non decide nulla. Il codice viene prima
 * perché è la grafia più stretta.
 *
 * ⚠️ Le parole NON si cercavano, e sono 268 file su 638: è la ragione per cui
 * tutti gli otto `0CC31R-C0x` mostravano la maniglia blu. Il riconoscitore delle
 * grafie sta in `finiture.ts`, che è il modulo che sa come si chiamano.
 */
export function finituraDiFoto(nome: string): string | null {
  const m = /[ _-]\d(C\d\d|[A-Z]{2})(_new)?$/i.exec(nome);
  if (m) {
    const codice = m[1]!.toUpperCase();
    if (FINITURE_PER_CODICE.has(codice)) return codice;
  }
  return finituraDiTesto(nome);
}
```

Aggiornare l'import: `import { FINITURE_PER_CODICE, finituraDiCodice, finituraDiTesto } from "./finiture";`

Aggiungere in `foto-archivio.test.ts`:

```ts
test("finituraDiFoto legge anche le finiture scritte a parole", () => {
  expect(finituraDiFoto("Fedra_1OL")).toBe("OL"); // il codice, come prima
  expect(finituraDiFoto("due frontale capri blue")).toBe("C12"); // e ora le parole
});
```

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run src/server/maniglie/ && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/maniglie/finiture.ts src/server/maniglie/finiture.test.ts src/server/maniglie/foto-archivio.ts src/server/maniglie/foto-archivio.test.ts
git commit -m "feat(maniglie): leggere la finitura anche quando COLOMBO la scrive a parole

268 nomi file su 638 dicono la finitura a parole e non col codice: è la
ragione per cui gli otto 0CC31R-C0x mostravano tutti la maniglia blu.

Il match ingenuo sarebbe stato peggio del silenzio — «cromo matte»
contiene «Cromo» ma vale Cromat, e lo dimostra l'archivio 01_Ama, che
scrive «cromat» sulla variante zero della stessa maniglia. Quindi match
più lungo, sei grafie ricavate dal vocabolario chiuso, bicolori rifiutati.

Da solo questo NON toglie foto: ne sposta 265 da sbagliate a giuste."
```

---

### Task 6: La foto contesa resta solo a chi la dimostra sua

**Files:**
- Modify: `src/server/maniglie/foto-archivio.ts` (`abbinaFoto`)
- Modify: `src/server/maniglie/foto-archivio.test.ts`

**Interfaces:**
- Consumes: `finituraDiFoto` del Task 5.
- Produces: `abbinaFoto` invariata nella firma; cambia solo quali id compaiono nella mappa.

- [ ] **Step 1: Write the failing test**

In `src/server/maniglie/foto-archivio.test.ts`:

```ts
/**
 * LA REGOLA (decisione dell'utente, 2026-08-05): una foto contesa resta solo a
 * chi può dimostrare che è sua.
 *
 * Misurato sul catalogo vero: 667 articoli si contendevano 72 file, quindi al
 * più 72 mostravano la finitura giusta e almeno 595 no. Non serve saper leggere
 * la finitura della foto per dimostrarlo: se n articoli di finiture DIVERSE
 * ricevono lo stesso file, al più uno è giusto.
 *
 * Chi non ha coda di finitura non perde nulla: non afferma una finitura, quindi
 * non può sbagliarla.
 */
describe("la foto contesa resta solo a chi la dimostra sua", () => {
  const unaFotoSola: FotoArchivio[] = [{ archivio: "03_Maniglioni_Pulls", nome: "CC113Q ocean blue" }];
  const dodiciColori = ["C01", "C06", "C12"].map((f) => ({
    id: f,
    code: `0CC113/Q-${f}`,
    codeNorm: `0CC113Q${f}`,
    name: "MANIGLIONE CC113 Q SINGOLO A/S",
  }));

  test("fra i contendenti resta solo quello provato", () => {
    const m = abbinaFoto("COLOMBO", dodiciColori, unaFotoSola);
    // «ocean blue» è C06: gli altri undici mostravano un maniglione blu.
    expect([...m.keys()]).toEqual(["C06"]);
  });

  test("una finitura provata DIVERSA non tiene la foto nemmeno da sola", () => {
    const m = abbinaFoto(
      "COLOMBO",
      [{ id: "x", code: "0BD11R-NM", codeNorm: "0BD11RNM", name: "ELLE BD11R NEROMAT RAL 9005" }],
      [{ archivio: "01_Elle", nome: "Elle_1CR" }],
    );
    expect(m.has("x")).toBe(false);
  });

  test("un file NON conteso resta anche se la sua finitura non si legge", () => {
    const m = abbinaFoto(
      "COLOMBO",
      [{ id: "u", code: "0CD31R-OL", codeNorm: "0CD31ROL", name: "HEIDI CD31R OROPLUS" }],
      [{ archivio: "01_Heidi", nome: "heidi_1OP" }], // OP non è fra le 31 pubblicate
    );
    expect(m.get("u")).toBe(chiaveFoto("01_Heidi", "heidi_1OP"));
  });

  test("un articolo senza coda di finitura non afferma nulla e tiene la foto", () => {
    const m = abbinaFoto(
      "COLOMBO",
      [{ id: "s", code: "XKIT/PS", codeNorm: "XKITPS", name: "KITPORTE SCORREVOLI OPER S/SER" }],
      [{ archivio: "06_Complementi", nome: "XKIT PS_45" }],
    );
    expect(m.get("s")).toBe(chiaveFoto("06_Complementi", "XKIT PS_45"));
  });

  test("quando la foto della finitura giusta ESISTE, la contesa non si apre", () => {
    const m = abbinaFoto(
      "COLOMBO",
      [
        { id: "a", code: "0CC31R-C12", codeNorm: "0CC31RC12", name: "DUE CC31R CAPRI BLUE" },
        { id: "b", code: "0CC31R-C09", codeNorm: "0CC31RC09", name: "DUE CC31R LEMON YELLOW" },
      ],
      [
        { archivio: "01_Due", nome: "due frontale capri blue" },
        { archivio: "01_Due", nome: "due frontale lemon yellow" },
      ],
    );
    expect(m.get("a")).toBe(chiaveFoto("01_Due", "due frontale capri blue"));
    expect(m.get("b")).toBe(chiaveFoto("01_Due", "due frontale lemon yellow"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/maniglie/foto-archivio.test.ts`
Expected: FAIL — il primo test restituisce tutte e tre le chiavi.

- [ ] **Step 3: Implement**

In `src/server/maniglie/foto-archivio.ts`, sostituire la parte finale di `abbinaFoto` (dal `const out = new Map…` fino al `return out`) con:

```ts
  // Prima passata: la scelta, come prima. Si tiene anche la finitura di ciò che
  // si è scelto, che serve alla seconda passata.
  type Scelta = { chiave: string; finituraFoto: string | null; finituraArt: string | null };
  const scelte = new Map<string, Scelta>();

  for (const a of articoli) {
    const finitura = finituraDiCodice(a.code);
    const nu = nucleo(a);
    if (nu.length >= MIN_NUCLEO) {
      const perCodice = usabili.filter((f) => f.nomeNorm.includes(nu));
      if (perCodice.length > 0) {
        const ordinate = [...perCodice].sort(
          (x, y) => y.nomeNorm.length - x.nomeNorm.length || x.chiave.localeCompare(y.chiave),
        );
        // Fra i file che nominano il codice, se ce n'è uno della finitura
        // giusta si prende QUELLO. Sul catalogo vero recupera poco (13 → 17):
        // per quegli accessori l'archivio ha una foto e basta.
        const scelta =
          (finitura ? ordinate.find((f) => f.finitura === finitura) : undefined) ?? ordinate[0]!;
        scelte.set(a.id, {
          chiave: scelta.chiave,
          finituraFoto: scelta.finitura,
          finituraArt: finitura,
        });
        continue;
      }
    }

    const etichetta = browseLabel(brand, a.name);
    if (etichetta === null) continue;
    const zero = varianteZero(a.name);
    const serieDelCodice = senzaZeroIniziale(a.codeNorm);
    const candidate = usabili.filter((f) => {
      if (!f.voce || f.voce.etichetta !== etichetta) return false;
      if (f.voce.serie && !serieDelCodice.startsWith(f.voce.serie)) return false;
      return f.zero === zero;
    });
    if (candidate.length === 0) continue;

    const esatta = finitura ? candidate.find((f) => f.finitura === finitura) : undefined;
    const scelta = esatta ?? candidate[0]!;
    scelte.set(a.id, {
      chiave: scelta.chiave,
      finituraFoto: scelta.finitura,
      finituraArt: finitura,
    });
  }

  // ── LA REGOLA: una foto contesa resta solo a chi la dimostra sua ───────────
  //
  // Quante finiture DIVERSE puntano allo stesso file? Se più d'una, al più un
  // articolo mostra la propria — e non serve saper leggere la finitura della
  // foto per saperlo. Sul catalogo vero: 667 articoli su 72 file, quindi almeno
  // 595 vedevano il colore di un altro codice.
  //
  // Andrea, che usa il programma: «se mancano le foto delle giuste finiture è
  // meglio togliere direttamente le foto, perché confondono e sono fuorvianti».
  // Un'immagine sbagliata non è un'approssimazione: l'agente non sa dedurre la
  // finitura dal codice, quindi la crede.
  const finiturePerChiave = new Map<string, Set<string>>();
  for (const s of scelte.values()) {
    if (s.finituraArt === null) continue;
    const set = finiturePerChiave.get(s.chiave) ?? new Set<string>();
    set.add(s.finituraArt);
    finiturePerChiave.set(s.chiave, set);
  }

  const out = new Map<string, string>();
  for (const [id, s] of scelte) {
    // 1. Chi non ha coda di finitura non afferma nulla, quindi non può sbagliare.
    if (s.finituraArt === null) {
      out.set(id, s.chiave);
      continue;
    }
    // 2. Provata uguale: è sua.
    if (s.finituraFoto === s.finituraArt) {
      out.set(id, s.chiave);
      continue;
    }
    // 3. Provata diversa: non è sua, e questo si sa.
    if (s.finituraFoto !== null) continue;
    // 4. Illeggibile: resta solo se nessun altro se la contende. Con due
    //    finiture sullo stesso file, tenerla vorrebbe dire scommettere.
    if ((finiturePerChiave.get(s.chiave)?.size ?? 0) <= 1) out.set(id, s.chiave);
  }
  return out;
```

Aggiornare anche il commento di intestazione di `abbinaFoto`, che oggi dice «679 codici / 994 / 322»: quei numeri non valgono più.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/server/maniglie/foto-archivio.test.ts && pnpm typecheck`
Expected: PASS. Alcuni test esistenti sulla copertura possono diventare rossi: **non si allentano**, si verifica caso per caso che il nuovo esito sia quello giusto e si aggiorna l'atteso con la ragione nel commento.

- [ ] **Step 5: Misurare sul catalogo vero prima di committare**

Con il DB locale popolato e l'indice foto in `/tmp/.../foto.json`:

```bash
set -a; source .env; set +a
COLOMBO_DOWNLOAD_PASSWORD=<dalla chat, mai in un file> pnpm foto:colombo --dry-run
```

Expected: `▶ abbinamento: 1528/3456 articoli (44.2%)`. Se il numero differisce di più di qualche unità, **fermarsi e capire perché** prima di committare.

- [ ] **Step 6: Commit**

```bash
git add src/server/maniglie/foto-archivio.ts src/server/maniglie/foto-archivio.test.ts
git commit -m "feat(maniglie): una foto contesa resta solo a chi la dimostra sua

Andrea: «se mancano le foto delle giuste finiture è meglio toglierle,
perché confondono e sono fuorvianti». Misurato che aveva ragione con un
margine: 667 articoli si contendevano 72 file, quindi almeno 595
mostravano il colore di un altro codice — e si dimostra senza nemmeno
saper leggere la finitura della foto.

Tiene la foto chi non ha coda di finitura (non afferma nulla), chi la
prova uguale, e chi ha un file che nessun altro si contende.
Copertura 61,3% -> 44,2%. Provate sbagliate: 350 -> 0."
```

---

### Task 7: Gli accessori — il dato

**Files:**
- Modify: `src/server/maniglie/curatela.ts`
- Modify: `src/server/maniglie/curatela.test.ts`
- Modify: `src/server/api/routers/article.ts` (procedura `browseGroups`, ~riga 217)
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.test.tsx` (fixture dei gruppi)

**Interfaces:**
- Produces: `etichetteAccessorio(brand: string): ReadonlySet<string>`; `browseGroups` restituisce `{ word, count, isModello, isAccessorio, preview }`.

- [ ] **Step 1: Write the failing test**

In `src/server/maniglie/curatela.test.ts`:

```ts
/**
 * I 17 gruppi che Andrea rifornisce. NON sono deducibili dai dati: i cinque
 * gruppi di pomoli hanno l'archivio fotografico e non sono maniglie, e MILLA,
 * SPIDER e TRAMA sono maniglie che l'archivio non ce l'hanno. È una lista, e va
 * dichiarata come tale a schermo.
 *
 * POMOLINO NON c'è: Andrea l'ha citato nel primo messaggio e tolto in quello
 * definitivo. Resta prodotto principale finché non dice altro.
 */
describe("etichetteAccessorio", () => {
  test("sono i 17 di Andrea", () => {
    expect([...etichetteAccessorio("COLOMBO")].sort()).toEqual([
      "BATTIPORTA", "BLOCCAPORTA", "BUSSOLA", "COPRIAVVOLG.", "DISPOSITIVO",
      "DUMMY", "FERMAPORTA", "INSERTO", "KIT", "MOLLA", "MOSTRINA", "MOVIMENTO",
      "NOTTOLINO", "PLACCA", "PROLUNGA", "QUADRO", "ROSETTA",
    ]);
  });

  test("POMOLINO e BOCCHETTA non sono accessori", () => {
    const acc = etichetteAccessorio("COLOMBO");
    expect(acc.has("POMOLINO")).toBe(false);
    expect(acc.has("BOCCHETTA")).toBe(false);
    expect(acc.has("MANIGLIONE")).toBe(false);
  });

  // La sentinella: se una di queste etichette smettesse di esistere, la voce
  // sarebbe morta e nessun conteggio andrebbe a zero.
  test("ogni accessorio è un'etichetta che la curatela produce davvero", () => {
    for (const a of etichetteAccessorio("COLOMBO")) {
      expect(browseLabel("COLOMBO", `${a} QUALCOSA`)).toBe(a);
    }
  });

  test("una marca senza curatela non eredita gli accessori di COLOMBO", () => {
    expect(etichetteAccessorio("HOPPE").size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/maniglie/curatela.test.ts`
Expected: FAIL con "etichetteAccessorio is not a function".

- [ ] **Step 3: Implement in `curatela.ts`**

**(a)** campo nell'interfaccia `Curatela`:

```ts
  /**
   * I gruppi che NON sono maniglie, decisi da Andrea (rifornimento magazzino).
   *
   * ⚠️ «Accessori» è la PRIMA parola nostra in questo schermo: tutte le altre
   * etichette sono parole scritte da COLOMBO. Va dichiarata a schermo come
   * nostra, e per questo la sezione ha un'intestazione mentre il resto della
   * griglia non ne ha nessuna.
   *
   * ⚠️ NON coincide con «ha un archivio fotografico»: i cinque gruppi di pomoli
   * (POMOLO, PUSH, ROUND, SQUARE, CUT) hanno l'archivio e non sono maniglie;
   * MILLA, SPIDER e TRAMA sono maniglie e l'archivio non ce l'hanno. Non è
   * deducibile: è una lista.
   *
   * ⚠️ Da non confondere con gli «archivi di accessori» di `foto-archivio.ts`
   * (`02_Pomoli`, `03_Maniglioni_Pulls`): quelli sono sezioni dell'archivio
   * fotografico di COLOMBO, e POMOLO e MANIGLIONE non sono in questa lista.
   */
  accessori: ReadonlySet<string>;
```

**(b)** in `CURATELE.COLOMBO`, dopo `trasparenti`:

```ts
    // 17 gruppi, 648 codici (19,1%). Misurato: sono il 31,5% di ciò che è in
    // pronta consegna, cioè proprio la parte che sta sullo scaffale.
    accessori: new Set([
      "BATTIPORTA",
      "BLOCCAPORTA",
      "BUSSOLA",
      "COPRIAVVOLG.",
      "DISPOSITIVO",
      "DUMMY",
      "FERMAPORTA",
      "INSERTO",
      "KIT",
      "MOLLA",
      "MOSTRINA",
      "MOVIMENTO",
      "NOTTOLINO",
      "PLACCA",
      "PROLUNGA",
      "QUADRO",
      "ROSETTA",
    ]),
```

**(c)** in `VUOTA`: `accessori: new Set(),`

**(d)** l'export, in fondo al file:

```ts
/** I gruppi che si elencano sotto «Accessori». Vuoto per una marca senza curatela. */
export function etichetteAccessorio(brand: string): ReadonlySet<string> {
  return curatelaDi(brand).accessori;
}
```

**(e)** `vociCuratela` include anche questi: `...c.accessori`.

- [ ] **Step 4: Esporre il dato dal router**

In `src/server/api/routers/article.ts`, procedura `browseGroups`: aggiungere l'import
`etichetteAccessorio` da `@/server/maniglie/curatela`, calcolarlo accanto a `modelli`, e
aggiungere il campo:

```ts
      const modelli = etichetteModello();
      const accessori = etichetteAccessorio(input.brand);
```

```ts
        groups: groups.map((g) => ({
          word: g.word,
          count: g.count,
          isModello: modelli.has(g.word),
          isAccessorio: accessori.has(g.word),
          preview: urlFoto(perGruppo.get(g.word)?.imageUrl ?? null, 320),
        })),
```

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/server/ && pnpm typecheck`
Expected: PASS. Il typecheck segnalerà i fixture di `maniglie-client.test.tsx` che costruiscono un `Gruppo` senza `isAccessorio`: aggiungerlo (`isAccessorio: false`) dove il gruppo non è un accessorio.

- [ ] **Step 6: Commit**

```bash
git add src/server/maniglie/curatela.ts src/server/maniglie/curatela.test.ts src/server/api/routers/article.ts "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"
git commit -m "feat(maniglie): i 17 gruppi che Andrea chiama accessori

Non è deducibile dai dati e non va tentato: i cinque gruppi di pomoli
hanno l'archivio fotografico e non sono maniglie, MILLA/SPIDER/TRAMA
sono maniglie e l'archivio non ce l'hanno. È una lista di Andrea, sta
in curatela.ts per marca come le altre sue liste, e a schermo verrà
dichiarata come parola nostra.

POMOLINO non c'è: citato nel primo messaggio, tolto nel definitivo."
```

---

### Task 8: La sezione «Accessori» a schermo

**Files:**
- Modify: `src/components/maniglie/sfoglia.tsx` (`Gruppo`, `SfogliaGruppi`)
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.test.tsx`

**Interfaces:**
- Consumes: `Gruppo.isAccessorio` dal Task 7.
- Produces: nessuna API nuova.

- [ ] **Step 1: Write the failing test**

In `src/app/(dashboard)/maniglie/maniglie-client.test.tsx` (o in un nuovo `describe`):

```tsx
/**
 * La banda di sopra NON ha intestazione, e non è una svista: qualunque nome
 * sarebbe falso («Maniglie» starebbe sopra BOCCHETTA, MANIGLIONE, POMOLINO,
 * GRANO) oppure sarebbe una SECONDA parola nostra. Non affermare nulla è ciò
 * che la rende onesta — e fa sì che un gruppo nuovo non classificato non
 * produca un'affermazione falsa.
 */
describe("SfogliaGruppi — la sezione Accessori", () => {
  const gruppi: Gruppo[] = [
    { word: "FEDRA", count: 35, isModello: true, isAccessorio: false, preview: "/f.png" },
    { word: "BOCCHETTA", count: 318, isModello: false, isAccessorio: false, preview: null },
    { word: "NOTTOLINO", count: 162, isModello: false, isAccessorio: true, preview: null },
    { word: "ROSETTA", count: 105, isModello: false, isAccessorio: true, preview: null },
  ];
  const rendi = (g = gruppi) =>
    render(<SfogliaGruppi groups={g} soloPronta={false} finitura={null} />);

  test("dimostra prima di guardare nel posto giusto: le tessere ci sono", () => {
    rendi();
    expect(screen.getByRole("link", { name: /FEDRA/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /NOTTOLINO/ })).toBeInTheDocument();
  });

  test("solo la banda accessori ha un'intestazione", () => {
    rendi();
    const titoli = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titoli).toEqual(["Accessori"]);
  });

  test("dichiara che «Accessori» è parola nostra, non di COLOMBO", () => {
    rendi();
    expect(screen.getByText(/raggruppamento nostro/i)).toHaveTextContent(/COLOMBO/);
  });

  test("gli accessori stanno DOPO gli altri nell'ordine del documento", () => {
    const { container } = rendi();
    const testi = [...container.querySelectorAll("a[href^='/maniglie?tipo=']")].map(
      (a) => a.getAttribute("href"),
    );
    expect(testi.indexOf("/maniglie?tipo=NOTTOLINO")).toBeGreaterThan(
      testi.indexOf("/maniglie?tipo=BOCCHETTA"),
    );
  });

  test("il collegamento in cima porta alla banda e ne dice il numero", () => {
    rendi();
    const salto = screen.getByRole("link", { name: /Accessori \(2\)/ });
    expect(salto).toHaveAttribute("href", "#accessori");
  });

  test("digitando «accessori» compaiono i 17, che nessuno di loro contiene nel nome", () => {
    rendi();
    fireEvent.change(screen.getByPlaceholderText("Filtra i gruppi…"), {
      target: { value: "accessori" },
    });
    expect(screen.getByRole("link", { name: /NOTTOLINO/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /FEDRA/ })).not.toBeInTheDocument();
  });

  test("quando il filtro svuota la banda, sparisce anche il collegamento", () => {
    rendi();
    fireEvent.change(screen.getByPlaceholderText("Filtra i gruppi…"), {
      target: { value: "FEDRA" },
    });
    expect(screen.queryByRole("heading", { level: 3, name: "Accessori" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Accessori \(/ })).not.toBeInTheDocument();
  });

  test("senza accessori a schermo non nasce una sezione vuota", () => {
    rendi(gruppi.filter((g) => !g.isAccessorio));
    expect(screen.queryByRole("heading", { level: 3, name: "Accessori" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"`
Expected: FAIL — nessuna intestazione «Accessori».

- [ ] **Step 3: Implement**

In `src/components/maniglie/sfoglia.tsx`:

**(a)** l'interfaccia `Gruppo` guadagna un campo:

```ts
export interface Gruppo {
  word: string;
  count: number;
  /** Il gruppo È un modello: COLOMBO gli dedica un archivio fotografico. */
  isModello: boolean;
  /** Il gruppo non è una maniglia: è nella lista di Andrea. Parola NOSTRA. */
  isAccessorio: boolean;
  /** Percorso della foto di anteprima, o `null`. */
  preview: string | null;
}
```

**(b)** in `SfogliaGruppi`, dopo il calcolo di `visibili`:

```tsx
  const cerca = filtro.trim().toUpperCase();
  // «Accessori» è a schermo ma non è il nome di nessun gruppo: senza questo,
  // digitarla non troverebbe nulla mentre la parola si legge sopra la griglia.
  // Da 3 caratteri, così «AC» non svuota la ricerca di chi cerca altro.
  const cercaAccessori = cerca.length >= 3 && "ACCESSORI".startsWith(cerca);
  const visibili = cerca
    ? groups.filter((g) => g.word.includes(cerca) || (cercaAccessori && g.isAccessorio))
    : groups;
  const accessori = visibili.filter((g) => g.isAccessorio);
  const resto = visibili.filter((g) => !g.isAccessorio);
```

**(c)** il collegamento, sulla riga dell'`<h2>`:

```tsx
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="sfoglia-titolo" className="text-sm font-semibold text-ink">
            Sfoglia il catalogo
          </h2>
          {/* Un'ancora, non un filtro: 73 tessere a 375px sono ~37 righe, e la
              banda in fondo altrimenti si trova solo scorrendo. `<a href="#">`
              e non uno scroll in JS, così il tasto indietro funziona da sé.
              Sparisce quando il filtro svuota la banda: un collegamento che
              porta a un'ancora inesistente è peggio della sua assenza. */}
          {accessori.length > 0 ? (
            <a
              href="#accessori"
              className="shrink-0 rounded text-xs font-medium text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              Accessori ({accessori.length}) ↓
            </a>
          ) : null}
        </div>
```

(il resto del blocco — le due righe `text-xs text-ink-subtle` — resta identico, e `{groups.length} gruppi…` non cambia.)

**(d)** la griglia diventa due griglie. Sostituire il blocco `{visibili.length === 0 ? … : <ul>…</ul>}` con:

```tsx
      {visibili.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-subtle">
          {cerca
            ? `Nessun gruppo contiene «${filtro.trim()}»${insiemeContato(soloPronta, finitura) ? ` fra quelli${insiemeContato(soloPronta, finitura)}` : ""}. Per cercare un articolo usa il campo qui sopra.`
            : "Nessun articolo in pronta consegna."}
        </p>
      ) : (
        <>
          {resto.length > 0 ? <GrigliaGruppi gruppi={resto} coda={codaFiltri(soloPronta, finitura)} /> : null}

          {/* LA BANDA DI SOPRA NON HA INTESTAZIONE, ed è una scelta.
              Qualunque nome sarebbe falso — «Maniglie» starebbe sopra
              BOCCHETTA (318), MANIGLIONE (353), POMOLINO (41), GRANO (3):
              misurato che dei 27 gruppi di solo testo 17 sono accessori e 10
              no — oppure sarebbe una SECONDA parola nostra.
              Ha anche un effetto che nessun test potrebbe dare: il giorno che
              COLOMBO aggiunge un gruppo e nessuno lo classifica, quel gruppo
              cade in una banda che non afferma nulla. */}
          {accessori.length > 0 ? (
            <section aria-labelledby="accessori" className="flex flex-col gap-3 border-t border-line pt-4">
              <div className="flex flex-col gap-0.5">
                <h3 id="accessori" className="scroll-mt-4 text-sm font-semibold text-ink">
                  Accessori
                </h3>
                {/* L'unica parola NOSTRA di questo schermo, e lo dice. Tutte le
                    altre etichette sono parole del listino COLOMBO, refusi
                    compresi: se questa non si dichiarasse, sembrerebbe una loro
                    categoria. È la classe di difetto che il progetto ha chiuso
                    otto volte. */}
                <p className="text-xs text-ink-subtle">
                  «Accessori» è un raggruppamento nostro: le altre etichette sono parole del listino
                  COLOMBO.
                </p>
              </div>
              <GrigliaGruppi gruppi={accessori} coda={codaFiltri(soloPronta, finitura)} />
            </section>
          ) : null}
        </>
      )}
```

**(e)** estrarre la griglia, che ora serve due volte — **stessa griglia e stessa densità**, perché un accessorio e un MANIGLIONE sono lo stesso oggetto a schermo (entrambi tessere di solo testo):

```tsx
function GrigliaGruppi({ gruppi, coda }: { gruppi: Gruppo[]; coda: string }) {
  return (
    <ul className="grid list-none grid-cols-2 items-start gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {gruppi.map((g) => (
        <TesseraGruppo key={g.word} gruppo={g} coda={coda} />
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run "src/app/(dashboard)/maniglie/" && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/maniglie/sfoglia.tsx "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"
git commit -m "feat(maniglie): la sezione Accessori, e una banda che non afferma nulla

Verdetto del council (5 advisor + peer review, affermazioni verificate
nel repo): non un livello e non un filtro — una sezione, zero stato,
zero parametri URL. Un terzo filtro accanto a pronta e finitura darebbe
sette modi diversi di avere un elenco vuoto.

La banda di sopra NON ha intestazione: «Maniglie» sarebbe falso sopra
BOCCHETTA e POMOLINO, e qualunque altro nome sarebbe una seconda parola
nostra. Non affermare nulla è ciò che la rende onesta, e fa sì che un
gruppo nuovo non classificato non dica il falso.

Il campo filtro impara «accessori», che non è il nome di nessun gruppo."
```

---

### Task 9: L'anteprima della tendina

**Files:**
- Modify: `src/components/maniglie/sfoglia.tsx` (`SfogliaSerie`, `AnteprimaSerie`)
- Modify: `src/server/api/routers/article.ts` (procedura `browseSerie`)
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.tsx` (passaggio della prop)
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.test.tsx`

**Interfaces:**
- Produces: `browseSerie` restituisce anche `isModello: boolean`; `SfogliaSerie` accetta `isModello: boolean`.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * Andrea: «la foto della tendina che si rimpicciolisce quando si apre confonde
 * e non serve a nulla quando è piccola perché non si vede».
 *
 * La regola è quella già scritta al livello 1: la foto compare dove distingue,
 * non dove ripete. Dentro FEDRA le serie sono la stessa maniglia in varianti —
 * la foto non era piccola, era RIPETUTA. Dentro BOCCHETTA (22 modelli) e
 * MANIGLIONE (52) distingue davvero.
 */
describe("SfogliaSerie — l'anteprima", () => {
  const serie: Serie[] = [
    { serie: "AC11R", count: 5, preview: "/a.png", rows: [] },
    { serie: "AC11RSM", count: 4, preview: "/b.png", rows: [] },
  ];
  const rendi = (isModello: boolean) =>
    render(
      <SfogliaSerie
        serie={serie}
        aperte={[]}
        onToggle={() => {}}
        senzaSerie={[]}
        isModello={isModello}
        renderRiga={() => null}
      />,
    );

  test("dimostra di guardare nel posto giusto: le tendine ci sono", () => {
    const { container } = rendi(false);
    expect(container.querySelectorAll("details")).toHaveLength(2);
  });

  test("dentro una TIPOLOGIA l'anteprima c'è", () => {
    const { container } = rendi(false);
    expect(container.querySelectorAll("summary img")).toHaveLength(2);
  });

  test("dentro un GRUPPO-MODELLO non c'è area immagine affatto", () => {
    const { container } = rendi(true);
    expect(container.querySelectorAll("summary img")).toHaveLength(0);
  });

  test("l'anteprima non cambia misura all'apertura", () => {
    const { container } = render(
      <SfogliaSerie
        serie={serie}
        aperte={["AC11R"]}
        onToggle={() => {}}
        senzaSerie={[]}
        isModello={false}
        renderRiga={() => null}
      />,
    );
    const classi = [...container.querySelectorAll("summary img")].map((i) => i.className);
    expect(classi[0]).toBe(classi[1]);
  });

  test("una preview mancante non disegna un segnaposto", () => {
    const { container } = render(
      <SfogliaSerie
        serie={[{ serie: "AC11R", count: 5, preview: null, rows: [] }]}
        aperte={[]}
        onToggle={() => {}}
        senzaSerie={[]}
        isModello={false}
        renderRiga={() => null}
      />,
    );
    expect(container.querySelector("summary svg.lucide-package")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"`
Expected: FAIL — `SfogliaSerie` non accetta `isModello`.

- [ ] **Step 3: Implement — il dato dal router**

In `src/server/api/routers/article.ts`, procedura `browseSerie`: dopo `const tipo = resolveLabel(...)`, il ramo `null` e il ritorno finale devono portare `isModello`:

```ts
      if (tipo === null)
        return { tipo: input.tipo, isModello: false, serie: [], senzaSerie: [], total: 0 };
```

e nel `return` finale aggiungere `isModello: etichetteModello().has(tipo),`.

- [ ] **Step 4: Implement — il componente**

In `src/components/maniglie/sfoglia.tsx`:

```tsx
export function SfogliaSerie({
  serie,
  aperte,
  onToggle,
  senzaSerie,
  isModello,
  renderRiga,
}: {
  serie: Serie[];
  aperte: string[];
  onToggle: (serie: string, aperta: boolean) => void;
  senzaSerie: ArticleSummary[];
  /** Il gruppo è un MODELLO: qui la foto per-serie ripeterebbe. */
  isModello: boolean;
  renderRiga: (a: ArticleSummary) => ReactNode;
}) {
```

e nel `<summary>`, al posto di `<AnteprimaSerie url={s.preview} piccola={aperta} />`:

```tsx
                    {isModello ? null : <AnteprimaSerie url={s.preview} />}
```

Il commento sopra `SfogliaSerie`, che oggi descrive l'anteprima che si rimpicciolisce, va sostituito:

```tsx
/**
 * L'anteprima di una serie: 56px, FERMA.
 *
 * ⚠️ SEMBRA IL CONTRARIO DEL LIVELLO 1, E NON LO È. Lì `isModello` ACCENDE la
 * foto, qui la SPEGNE. Stesso principio, unità diversa: la tessera di livello 1
 * ritrae il modello intero, e una foto lo rappresenta; la riga di livello 2
 * ritrae UNA SERIE dentro quel modello, e le serie di FEDRA sono la stessa
 * maniglia in varianti — la foto sarebbe identica su ognuna. Dentro una
 * TIPOLOGIA (BOCCHETTA raccoglie 22 modelli, MANIGLIONE 52) distingue davvero.
 * Chi legge questo codice non lo "corregga" per simmetria.
 *
 * Non si rimpicciolisce aprendo: era una scelta nostra, e Andrea che usa il
 * programma l'ha smentita sul campo. È anche un'animazione di layout, vietata.
 *
 * Preview mancante = spazio vuoto, non segnaposto: con la copertura al 44,2%
 * le assenze sono frequenti, e otto riquadri grigi in colonna si leggono come
 * «il programma è rotto». L'allineamento regge, l'assenza si dice tacendo.
 */
function AnteprimaSerie({ url }: { url: string | null }) {
  const [fallita, setFallita] = useState(false);
  if (!url || fallita) return <span aria-hidden className="size-14 shrink-0" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sorgente dinamica dietro auth, non da ottimizzare
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFallita(true)}
      className="size-14 shrink-0 rounded border border-line bg-white object-contain"
    />
  );
}
```

- [ ] **Step 5: Passare la prop dal client**

In `src/app/(dashboard)/maniglie/maniglie-client.tsx`, al `<SfogliaSerie …>` aggiungere:

```tsx
                isModello={serie.data?.isModello ?? false}
```

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run && pnpm typecheck && pnpm lint`
Expected: PASS. Se `Package` non è più usato in `sfoglia.tsx`, il lint segnalerà l'import inutilizzato: `FotoGruppo` lo usa ancora al livello 1, quindi verificare prima di toglierlo.

- [ ] **Step 7: Commit**

```bash
git add src/components/maniglie/sfoglia.tsx src/server/api/routers/article.ts "src/app/(dashboard)/maniglie/maniglie-client.tsx" "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"
git commit -m "fix(maniglie): la foto della serie compare dove distingue, non dove ripete

Andrea: «la foto della tendina che si rimpicciolisce confonde, e da
piccola non si vede». Il rimedio non è ingrandirla: dentro FEDRA le
serie sono la stessa maniglia in varianti, quindi la foto non era
piccola, era ripetuta. Dentro BOCCHETTA (22 modelli) e MANIGLIONE (52)
distingue davvero, e lì resta — ferma, perché rimpicciolirsi è anche
un'animazione di layout.

È la stessa regola del livello 1 applicata all'unità giusta, e produce
l'esito opposto: il commento lo spiega, perché sembra una svista."
```

---

### Task 10: Il gate sul catalogo e sull'archivio veri

**Files:**
- Modify: `src/server/maniglie/foto-archivio.integration.test.ts`
- Modify: `src/server/maniglie/search.integration.test.ts`

**Interfaces:**
- Consumes: tutto.

- [ ] **Step 1: Write the failing test**

In `foto-archivio.integration.test.ts`, aggiungere `finituraDiCodice` (da `./finiture`) e
`finituraDiFoto`, `scattoDiProdotto` agli import, poi una variabile del `describe` accanto a
`abbinati` e i due test.

Nel corpo del `describe`, accanto alle altre `let`:

```ts
  /** chiave Blob → nome del file scelto: serve a rileggerne la finitura. */
  let nomePerChiave: Map<string, string>;
```

In fondo al `beforeAll`, dopo `abbinati = abbinaFoto(...)`:

```ts
    nomePerChiave = new Map(
      foto
        .filter((f) => scattoDiProdotto(f.nome))
        .map((f) => [chiaveFoto(f.archivio, f.nome), f.nome]),
    );
```

I due test:

```ts
  /**
   * Il pavimento della regola nuova: NESSUN articolo può ricevere una foto la
   * cui finitura è provata DIVERSA dalla sua. Questo test è la regola stessa,
   * misurata sul catalogo vero invece che su fixture — ed è l'unico posto in
   * cui l'affermazione «le foto non mentono più» è verificata su tutti e 3.456
   * i codici e tutti e 707 i file.
   */
  it("nessuna foto mostra una finitura provata diversa da quella dell'articolo", () => {
    const colpevoli = articoli
      .filter((a) => {
        const chiave = abbinati.get(a.id);
        if (chiave === undefined) return false;
        const fc = finituraDiCodice(a.code);
        if (fc === null) return false;
        const ff = finituraDiFoto(nomePerChiave.get(chiave)!);
        return ff !== null && ff !== fc;
      })
      .map((a) => a.code);
    expect(colpevoli).toEqual([]);
  });

  /**
   * E il pavimento della copertura. Una regola che TOGLIE non deve poter
   * scivolare verso lo zero senza che nulla se ne accorga: è la lezione del
   * `widthMm: 550` del kit, dove una copertura ristretta non faceva fallire
   * niente e nessun conteggio andava a zero.
   *
   * Il vecchio «almeno il 60%» è SOSTITUITO, non allentato: la copertura scende
   * di proposito da 61,3% a 44,2% perché 590 foto mostravano la finitura di un
   * altro codice.
   */
  it("copre almeno il 40% dei codici, e almeno il 25% con finitura provata", () => {
    expect(abbinati.size / articoli.length).toBeGreaterThan(0.4);
    const provati = articoli.filter((a) => {
      const chiave = abbinati.get(a.id);
      if (chiave === undefined) return false;
      const fc = finituraDiCodice(a.code);
      return fc !== null && finituraDiFoto(nomePerChiave.get(chiave)!) === fc;
    });
    expect(provati.length / articoli.length).toBeGreaterThan(0.25);
  });
```

Il vecchio `it("copre almeno il 60% dei codici")` va **sostituito**, non allentato in silenzio: la copertura scende di proposito da 61,3% a 44,2%, e il commento deve dirlo.

In `search.integration.test.ts`, la sentinella delle etichette nuove:

```ts
  it("COPPIA si scioglie: nessun gruppo si chiama COPPIA, e i due destinatari crescono", async () => {
    const gruppi = await browseFirstWords(db, "COLOMBO");
    const nomi = gruppi.map((g) => g.word);
    expect(nomi).not.toContain("COPPIA");
    expect(nomi).not.toContain("BOCCHETTE");
    expect(nomi).not.toContain("PL.");
    expect(nomi).not.toContain("HEIDI/PETER");
    expect(nomi).not.toContain("LUNDCREM");
    expect(gruppi.find((g) => g.word === "BOCCHETTA")?.count).toBe(318);
    expect(gruppi.find((g) => g.word === "MANIGLIONE")?.count).toBe(353);
    expect(gruppi.find((g) => g.word === "PLACCA")?.count).toBe(87);
    expect(gruppi).toHaveLength(90);
  });

  it("aprendo BOCCHETTA si trovano davvero anche i 28 di COPPIA", async () => {
    const righe = await articleIdsByFirstWord(db, "COLOMBO", "BOCCHETTA");
    expect(righe).toHaveLength(318);
    expect(righe.some((r) => r.name.startsWith("COPPIA BOCCHETTE"))).toBe(true);
  });

  it("ogni accessorio dichiarato esiste fra i gruppi del listino", async () => {
    const nomi = new Set((await browseFirstWords(db, "COLOMBO")).map((g) => g.word));
    for (const a of etichetteAccessorio("COLOMBO")) expect(nomi).toContain(a);
  });
```

- [ ] **Step 2: Run the gate**

```bash
pgrep dockerd >/dev/null || (setsid nohup dockerd >/tmp/dockerd.log 2>&1 & disown); sleep 6; docker start ufptrade-db; sleep 8
set -a; source .env; set +a
INTEGRATION_DATABASE_URL="$DATABASE_URL" COLOMBO_FOTO_INDEX=/tmp/claude-0/*/scratchpad/colombo/foto.json pnpm vitest run src/server/maniglie/foto-archivio.integration.test.ts src/server/maniglie/search.integration.test.ts
```

Expected: tutti verdi. Il DB locale deve avere il listino vero importato (`pnpm import:listino COLOMBO <file>`), altrimenti i test si saltano dichiarandolo.

- [ ] **Step 3: Commit**

```bash
git add src/server/maniglie/foto-archivio.integration.test.ts src/server/maniglie/search.integration.test.ts
git commit -m "test(maniglie): il pavimento sul catalogo e sull'archivio veri

La regola nuova è un'affermazione sul listino AGB e sull'archivio
COLOMBO, non sul codice: va provata su quelli. Zero articoli con una
finitura provata diversa; copertura ≥40% e ≥25% con finitura provata.

Il vecchio «almeno il 60%» è sostituito e non allentato: la copertura
scende di proposito a 44,2%, ed è scritto perché il prossimo che legge
non lo prenda per un cedimento."
```

---

### Task 11: Verifica in browser e chiusura

**Files:**
- Modify: `handoff.md`, `CLAUDE.md` (sezione STATO)

- [ ] **Step 1: Gate completo**

```bash
pkill -f "next dev" || true
rm -rf .next
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

- [ ] **Step 2: Verifica in browser, desktop e 375px**

Avviare `pnpm dev` (mai insieme a `build`), accedere come admin e verificare **guardando gli screenshot**:

1. `/maniglie` — la griglia ha **una sola** intestazione, «Accessori», in fondo.
2. Il collegamento «Accessori (17) ↓» in cima porta alla banda; il tasto indietro torna su.
3. Digitando `accessori` compaiono i 17 e spariscono gli altri.
4. Digitando `FEDRA` sparisce la banda accessori **e** il collegamento.
5. `/maniglie?tipo=FEDRA` — le tendine **non** hanno anteprima.
6. `/maniglie?tipo=BOCCHETTA` — le tendine hanno l'anteprima, e **aprendone una non cambia misura**.
7. Una serie senza foto non mostra un riquadro grigio.
8. Scheda articolo: il codice si vede `0ID41R-CR` e, premendolo, negli appunti c'è `0ID41RCR`.
9. Scheda prodotto **serramenti**: il codice `A50122.*` si copia **coi punti**.
10. A 375px: nessuno scorrimento orizzontale, il collegamento in cima non va a capo male, le tessere accessorio hanno la stessa densità delle altre.

Playwright: `executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"`, **mai** `npx playwright install`.

- [ ] **Step 3: Aggiornare `handoff.md` e `CLAUDE.md`**

Riportare: le sette correzioni, i numeri misurati (94→90 gruppi, foto 61,3%→44,2%, provate sbagliate 350→0), il verdetto del council, **l'azione ops**, e le domande aperte (i codici finitura `OP`/`NK`/`GR`/`SS`; MR11/MR15, LC31/LC41, LC71/LC81; `MANIG.CD213` e `MANIG.LC413RS`).

- [ ] **Step 4: Commit e push**

```bash
git add handoff.md CLAUDE.md
git commit -m "docs: chiusura sessione — le sette dritte di Andrea"
git push -u origin claude/uftrade-handles-catalog-fixes-q5mc0o
```

---

## L'azione ops, al merge

🟢 **NESSUNA MIGRAZIONE.** Nessuna colonna nuova, nessuna dipendenza nuova, nessuna finestra di disservizio: fra il deploy e il run le foto restano quelle di oggi, che è uno stato coerente e non uno stato rotto.

🔴 **UN RUN**: workflow **«Ops — Foto COLOMBO»** (`.github/workflows/ops-foto-colombo.yml`), che ricalcola gli abbinamenti. Non carica foto nuove: le 240 già su Blob bastano. Azzera `image_url` su tutta la marca e riscrive i 1.528 abbinati (`scripts/foto-colombo.ts:207`), quindi **le foto tolte spariscono da sole**. Idempotente, ~7 minuti. Richiede i secret `COLOMBO_DOWNLOAD_PASSWORD`, `BLOB_READ_WRITE_TOKEN` e `NEON_DIRECT_URL` (**non** `DATABASE_URL`: è la lezione della sessione del 05/08, dove il primo run morì in zero secondi alla guardia).

Il resto — etichette, sezione accessori, anteprime, copia del codice — si applica al deploy senza toccare il database.
