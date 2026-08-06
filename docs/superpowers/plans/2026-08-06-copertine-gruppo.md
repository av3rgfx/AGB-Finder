# Copertine dei gruppi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** rendere la copertina di un gruppo una proprietà del GRUPPO (non di un articolo scelto a caso), così che le sette tessere senza foto tornino a mostrarla senza rimettere una sola foto sbagliata sulle righe; spostare BOCCHETTA e GRANO fra gli Accessori e fondere i due `MANIG.` in MANIGLIA INCASSO.

**Architecture:** tre moduli puri esistenti (`curatela.ts`, `foto-archivio.ts`, `browse.ts`) più il router `article.ts` e due componenti. Nessuna colonna nuova, nessuna migrazione: la copertina si deriva dalle tabelle d'archivio, che sono già nel repo. Il predicato che decide la FORMA della tessera passa da `isModello` a «esiste una foto», e questo rende il riquadro vuoto strutturalmente impossibile.

**Tech Stack:** Next.js 15 · React 19 · TypeScript strict · tRPC v11 · Prisma · Tailwind · Vitest.

## Global Constraints

- **TypeScript strict** sempre. Tutte le API via **tRPC**, tutte le query via **Prisma**; le regole di dominio in TypeScript, **mai** nel raw SQL.
- **UI in italiano**, codici prodotto in **font monospace**.
- **Mobile-first**: ogni schermata va verificata a **≤ 375px** e su desktop, screenshot guardati.
- **La sezione serramenti non si tocca.** Nessun file sotto `src/server/kit/`, `src/server/ai/`, `src/components/product/`, `src/app/(dashboard)/archivio/`, `richieste/`, `clienti/`.
- **Il repo è pubblico**: listino, giacenze e foto del fornitore non si committano mai. Fanno eccezione i **nomi di file** già presenti in `FILE_MODELLO`, a cui questo piano ne aggiunge tre (decisione dell'utente, spec §5.2).
- **Un commit per task.** Test prima dell'implementazione.
- Prima di `pnpm test`, `tsx` o `prisma`: `set -a; source .env; set +a`.
- Gate finali: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`.
- ⚠️ **`pnpm build` mentre gira `pnpm dev` rompe il dev server** (condividono `.next`): fermare `dev`, poi `rm -rf .next`.

---

## File Structure

| file | responsabilità | task |
|---|---|---|
| `src/server/maniglie/curatela.ts` | etichette di sfoglio: fusioni, esclusioni, accessori | 1, 2 |
| `src/server/maniglie/foto-archivio.ts` | tabelle d'archivio, abbinamento foto→codice, **copertine di gruppo** | 3, 4 |
| `src/server/api/routers/article.ts` | `browseGroups`: preview del gruppo con ripiego sulla copertina | 5 |
| `src/components/maniglie/sfoglia.tsx` | tessera di gruppo: forma, area immagine, dichiarazione | 6 |
| `src/app/(dashboard)/maniglie/maniglie-client.tsx` | riga articolo: miniatura senza segnaposto | 7 |
| `scripts/foto-colombo.ts` | carica su Blob anche le copertine | 8 |
| `src/server/maniglie/foto-archivio.integration.test.ts` | gate sull'archivio VERO | 9 |

---

## Task 1: BOCCHETTA e GRANO diventano accessori

**Files:**
- Modify: `src/server/maniglie/curatela.ts:141-159` (insieme `accessori`) e il commento a `:136-140`
- Test: `src/server/maniglie/curatela.test.ts:375-404`, `src/server/maniglie/search.integration.test.ts:668`
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.test.tsx:98-114` (fixture)

**Interfaces:**
- Consumes: `etichetteAccessorio(brand: string): ReadonlySet<string>` (già esistente)
- Produces: nessuna firma nuova. L'insieme passa da 17 a 19 voci.

- [ ] **Step 1: girare i test che asseriscono 17 e «BOCCHETTA non è accessorio»**

In `src/server/maniglie/curatela.test.ts`, sostituire il blocco `describe("etichetteAccessorio", …)` iniziale con:

```ts
describe("etichetteAccessorio", () => {
  test("sono i 19 di Andrea", () => {
    expect([...etichetteAccessorio("COLOMBO")].sort()).toEqual([
      "BATTIPORTA",
      "BLOCCAPORTA",
      "BOCCHETTA",
      "BUSSOLA",
      "COPRIAVVOLG.",
      "DISPOSITIVO",
      "DUMMY",
      "FERMAPORTA",
      "GRANO",
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
    ]);
  });

  // ⚠️ Questo test diceva l'opposto fino al 2026-08-06, e diceva il vero:
  // BOCCHETTA e GRANO NON erano accessori. Era la codifica di una decisione,
  // non la sua sentinella — come i due capovolti nella PR #60. Si gira con la
  // decisione. POMOLINO e MANIGLIONE restano fuori: il titolare li ha citati
  // e poi tolti, e finché non dice altro sono prodotto principale.
  test("POMOLINO e MANIGLIONE non sono accessori; BOCCHETTA e GRANO sì", () => {
    const acc = etichetteAccessorio("COLOMBO");
    expect(acc.has("POMOLINO")).toBe(false);
    expect(acc.has("MANIGLIONE")).toBe(false);
    expect(acc.has("BOCCHETTA")).toBe(true);
    expect(acc.has("GRANO")).toBe(true);
  });
```

Lasciare invariati i tre test che seguono (`ogni accessorio è un'etichetta che la curatela produce davvero`, `una marca senza curatela non eredita gli accessori di COLOMBO`, `NON stanno in vociCuratela`).

- [ ] **Step 2: eseguire e vedere il rosso**

```bash
set -a; source .env; set +a
corepack pnpm vitest run src/server/maniglie/curatela.test.ts -t "etichetteAccessorio"
```

Atteso: FAIL — l'array ha 17 elementi e non contiene `BOCCHETTA`/`GRANO`.

- [ ] **Step 3: aggiungere le due voci**

In `src/server/maniglie/curatela.ts`, dentro `accessori`, in ordine alfabetico:

```ts
      "BATTIPORTA",
      "BLOCCAPORTA",
      // 2026-08-06: BOCCHETTA (318 codici) e GRANO (3) su richiesta del
      // titolare, che ha verificato la versione in produzione. BOCCHETTA sta
      // accanto a ROSETTA (105), che era già qui ed è lo stesso genere di
      // oggetto; GRANO è arrivato rispondendo, «non è una maniglia».
      "BOCCHETTA",
      "BUSSOLA",
      "COPRIAVVOLG.",
      "DISPOSITIVO",
      "DUMMY",
      "FERMAPORTA",
      "GRANO",
      "INSERTO",
```

E ri-misurare il commento sopra l'insieme (`curatela.ts:136-140`), che oggi dice «17 gruppi, 648 codici (19,1%) … 31,5% della pronta consegna»:

```ts
    // 19 gruppi, 969 codici (28,6% dei 3.391 sfogliabili). Misurato sul listino
    // `LP 02-26` e sulla pronta consegna del 03/08: sono il 38,2% di ciò che è
    // in pronta consegna (68 su 178), cioè proprio la parte che sta sullo
    // scaffale. POMOLINO non c'è: il titolare l'ha citato nel primo messaggio e
    // tolto in quello definitivo.
```

- [ ] **Step 4: eseguire e vedere il verde**

```bash
corepack pnpm vitest run src/server/maniglie/curatela.test.ts
```
Atteso: PASS.

- [ ] **Step 5: aggiornare il gate d'integrazione e la fixture del client**

In `src/server/maniglie/search.integration.test.ts`, il test `gli accessori sono 17 gruppi, tutti presenti a listino`:

```ts
  it("gli accessori sono 19 gruppi, tutti presenti a listino", async () => {
    const gruppi = await browseFirstWords(db, "COLOMBO");
    const acc = gruppi.filter((g) => etichetteAccessorio("COLOMBO").has(g.word));
    expect(acc).toHaveLength(19);
    // Sul listino puro sono 969 codici su 3.391 sfogliabili (28,6%); qui il
    // seed aggiunge righe finte, quindi si verifica l'ordine di grandezza.
    expect(acc.reduce((n, g) => n + g.count, 0)).toBeGreaterThanOrEqual(969);
  });
```

In `src/app/(dashboard)/maniglie/maniglie-client.test.tsx`, la fixture `GRUPPI` e il commento sopra:

```tsx
/**
 * `isAccessorio` è una lista di ANDREA, e non è deducibile da `isModello`:
 * KIT e ROSETTA non hanno archivio e sono accessori, MANIGLIONE non ha
 * archivio e maniglia è. BOCCHETTA è passata fra gli accessori il 2026-08-06,
 * quindi non serve più come controesempio: MANIGLIONE lo è ancora.
 */
const GRUPPI = [
  { word: "BOCCHETTA", count: 318, isModello: false, isAccessorio: true, preview: null },
  { word: "KIT", count: 140, isModello: false, isAccessorio: true, preview: null },
  {
    word: "LARA",
    count: 28,
    isModello: true,
    isAccessorio: false,
    preview: "/api/article-image?k=lara&size=320",
  },
  { word: "MANIGLIONE", count: 353, isModello: false, isAccessorio: false, preview: null },
  { word: "ROSETTA", count: 105, isModello: false, isAccessorio: true, preview: null },
];
```

Con tre accessori nella fixture, due asserzioni del `describe("ManiglieClient — la sezione Accessori")` cambiano numero: il collegamento diventa `/Accessori \(3\)/` e il titolo del test sul filtro va da «compaiono i 17» a «compaiono i 19». Aggiornare entrambi.

- [ ] **Step 6: eseguire la suite dei file toccati**

```bash
corepack pnpm vitest run src/server/maniglie/curatela.test.ts "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"
```
Atteso: PASS.

- [ ] **Step 7: commit**

```bash
git add src/server/maniglie/curatela.ts src/server/maniglie/curatela.test.ts \
  src/server/maniglie/search.integration.test.ts \
  "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"
git commit -m "feat(maniglie): BOCCHETTA e GRANO fra gli accessori"
```

---

## Task 2: i due `MANIG.` si fondono in MANIGLIA INCASSO

**Files:**
- Modify: `src/server/maniglie/curatela.ts:93-97` (blocco delle fusioni «maniglia»)
- Test: `src/server/maniglie/curatela.test.ts`

**Interfaces:**
- Consumes: `browseLabel(brand, name)`, `sourceFirstWords(brand, label)`, `foldBrowseGroups(brand, rows)` (già esistenti)
- Produces: nessuna firma nuova. I gruppi passano da 90 a 88; MANIGLIA INCASSO da 90 a 93 codici.

- [ ] **Step 1: scrivere i test che falliscono**

In `src/server/maniglie/curatela.test.ts`, aggiungere in fondo al `describe` delle fusioni:

```ts
  /**
   * Le due etichette esistono solo perché COLOMBO ha scritto `MANIG.CD213`
   * senza spazio. La prova che vanno in MANIGLIA INCASSO e non in un gruppo
   * nuovo dei due è nel listino: `0LC413RS-CM` è «MANIG.LC413RS SCRO.COMPL.CM»
   * e `0LC413RS-CR` è «MANIG. LC413RS SCOR.COMPLAN.CR» — lo STESSO prodotto in
   * due finiture, in due gruppi diversi. Un gruppo nuovo lascerebbe il `-CR`
   * dov'è: sposterebbe la spaccatura invece di chiuderla.
   */
  test.each([
    ["MANIG.CD213 SCOR.COMPLAN. CM", "MANIGLIA INCASSO"],
    ["MANIG.LC413RS SCRO.COMPL.CM", "MANIGLIA INCASSO"],
    ["MANIG. LC413RS SCOR.COMPLAN.CR", "MANIGLIA INCASSO"],
  ])("«%s» si elenca sotto %s", (name, atteso) => {
    expect(browseLabel("COLOMBO", name)).toBe(atteso);
  });

  test("un ?tipo=MANIG.CD213 condiviso prima della fusione si risolve", () => {
    expect(resolveLabel("COLOMBO", "MANIG.CD213")).toBe("MANIGLIA INCASSO");
  });

  test("sourceFirstWords di MANIGLIA INCASSO cita le due parole storte", () => {
    const w = sourceFirstWords("COLOMBO", "MANIGLIA INCASSO");
    expect(w).toContain("MANIG.CD213");
    expect(w).toContain("MANIG.LC413RS");
  });

  test("foldBrowseGroups somma i due MANIG. in MANIGLIA INCASSO", () => {
    expect(
      foldBrowseGroups("COLOMBO", [
        { first: "MANIG.", second: "INCASSO", count: 89 },
        { first: "MANIG.CD213", second: "SCOR.COMPLAN.", count: 2 },
        { first: "MANIG.LC413RS", second: "SCRO.COMPL.CM", count: 1 },
      ]),
    ).toEqual([{ word: "MANIGLIA INCASSO", count: 92 }]);
  });
```

- [ ] **Step 2: eseguire e vedere il rosso**

```bash
corepack pnpm vitest run src/server/maniglie/curatela.test.ts -t "MANIG"
```
Atteso: FAIL — `browseLabel` restituisce `MANIG.CD213`.

- [ ] **Step 3: aggiungere le due fusioni**

In `src/server/maniglie/curatela.ts`, subito sotto le quattro righe «maniglia»:

```ts
      "MANIG.": "MANIGLIA INCASSO", //   57
      "MANIG.INCASSO": "MANIGLIA INCASSO", // 4
      MANIGLIA: "MANIGLIA INCASSO", //   28
      MANIGLIE: "MANIGLIA INCASSO", //    1
      // ── 2026-08-06, ottava tornata: «vanno unite» ──────────────────────
      // Esistono solo perché COLOMBO ha scritto il codice attaccato a
      // `MANIG.`. Vanno in MANIGLIA INCASSO e non in un gruppo nuovo dei due,
      // perché `0LC413RS-CR` — lo stesso prodotto in un'altra finitura — è già
      // là: un gruppo nuovo sposterebbe la spaccatura invece di chiuderla.
      "MANIG.CD213": "MANIGLIA INCASSO", // 2
      "MANIG.LC413RS": "MANIGLIA INCASSO", // 1
```

- [ ] **Step 4: eseguire e vedere il verde**

```bash
corepack pnpm vitest run src/server/maniglie/curatela.test.ts
```
Atteso: PASS.

- [ ] **Step 5: commit**

```bash
git add src/server/maniglie/curatela.ts src/server/maniglie/curatela.test.ts
git commit -m "feat(maniglie): i due MANIG. si elencano sotto MANIGLIA INCASSO"
```

---

## Task 3: `soloCopertina` — un archivio può nominare un gruppo senza prestare foto ai codici

**Files:**
- Modify: `src/server/maniglie/foto-archivio.ts:30-35` (`VoceArchivio`), `:138-149` (i tre casi non decidibili), `:426-430` (filtro delle candidate)
- Test: `src/server/maniglie/foto-archivio.test.ts`

**Interfaces:**
- Produces: `interface VoceArchivio { etichetta: string | null; serie?: string; soloCopertina?: true }`
- `etichetteModello()` inizia a includere `MILLA`, `SPIDER`, `TRAMA`.
- `abbinaFoto()` continua a NON assegnare foto ai codici di quei tre gruppi.

- [ ] **Step 1: scrivere i test che falliscono**

In `src/server/maniglie/foto-archivio.test.ts`, sostituire il test `gli archivi la cui serie NON è scritta da nessuna parte non hanno etichetta` con:

```ts
  /**
   * ⚠️ Questo test asseriva `etichetta: null` per tutti e sei. Diceva il vero su
   * una cosa (nessuna foto ai codici) e il falso su un'altra (l'archivio non
   * nomina il gruppo): un campo solo faceva due mestieri, e per negare il
   * secondo si negava anche il primo — perdendo la copertina insieme alle
   * righe. Dal 2026-08-06 i due mestieri sono separati.
   *
   * MR11 vs MR15, LC31 vs LC41, LC71 vs LC81 restano non decidibili: quale
   * archivio sia quale serie non è scritto da nessuna parte, e indovinare
   * produrrebbe una foto giusta di un prodotto sbagliato.
   */
  it("i tre archivi ambigui nominano il gruppo ma non prestano foto ai codici", () => {
    expect(ARCHIVI["01_Milla_1"]).toEqual({ etichetta: "MILLA", soloCopertina: true });
    expect(ARCHIVI["01_Milla_2"]).toEqual({ etichetta: "MILLA", soloCopertina: true });
    expect(ARCHIVI["01_Spider_m"]).toEqual({ etichetta: "SPIDER", soloCopertina: true });
    expect(ARCHIVI["01_Spider_p"]).toEqual({ etichetta: "SPIDER", soloCopertina: true });
    expect(ARCHIVI["01_Trama_1"]).toEqual({ etichetta: "TRAMA", soloCopertina: true });
    expect(ARCHIVI["01_Trama_2"]).toEqual({ etichetta: "TRAMA", soloCopertina: true });
  });

  it("i tre gruppi ambigui sono MODELLI: COLOMBO li fotografa", () => {
    for (const e of ["MILLA", "SPIDER", "TRAMA"]) expect(etichetteModello().has(e), e).toBe(true);
  });
```

E aggiungere, nel `describe` dell'abbinamento, la sentinella che protegge i 66 codici:

```ts
  /**
   * LA PROPRIETÀ CHE VALE 66 CODICI. `soloCopertina` esiste per dare a MILLA,
   * SPIDER e TRAMA la copertina SENZA dare ai loro codici la foto
   * dell'archivio sbagliato. Se qualcuno togliesse il flag, la tabella
   * continuerebbe a compilare, la copertura SALIREBBE, e 66 codici
   * mostrerebbero una foto che esiste, si vede benissimo, ed è di un altro
   * prodotto. Nessun conteggio andrebbe a zero.
   */
  it("un archivio soloCopertina non presta foto ai codici del suo gruppo", () => {
    const articoli: ArticoloDaAbbinare[] = [
      { id: "a", code: "0LC31R-CM", codeNorm: "0LC31RCM", name: "MILLA LC31R CROMAT" },
      { id: "b", code: "0MR11R-CR", codeNorm: "0MR11RCR", name: "SPIDER MR11R CROMO" },
      { id: "c", code: "0LC71R-CM", codeNorm: "0LC71RCM", name: "TRAMA LC71R CROMAT" },
    ];
    const foto: FotoArchivio[] = [
      { archivio: "01_Milla_1", nome: "milla1_2CRCM" },
      { archivio: "01_Spider_m", nome: "spider1_1CR" },
      { archivio: "01_Trama_1", nome: "trama 1_1CMCR" },
    ];
    expect([...abbinaFoto("COLOMBO", articoli, foto).keys()]).toEqual([]);
  });
```

Aggiungere `etichetteModello` all'import in cima al file.

- [ ] **Step 2: eseguire e vedere il rosso**

```bash
corepack pnpm vitest run src/server/maniglie/foto-archivio.test.ts
```
Atteso: FAIL sui tre test nuovi.

- [ ] **Step 3: implementare**

In `src/server/maniglie/foto-archivio.ts`, estendere l'interfaccia:

```ts
export interface VoceArchivio {
  /** Etichetta di sfoglio, post-curatela. `null` = nessun aggancio per modello. */
  etichetta: string | null;
  /** Prefisso di codice; solo dove un'etichetta ha più archivi. */
  serie?: string;
  /**
   * L'archivio NOMINA il gruppo ma non presta foto ai suoi codici.
   *
   * Serve dove COLOMBO tiene due archivi per lo stesso gruppo e non dice quale
   * serie sia quale (MR11/MR15, LC31/LC41, LC71/LC81): «che aspetto ha una
   * MILLA» ha risposta, «questo codice quale delle due è» no. Prima si negava
   * l'etichetta per negare il prestito, e si perdeva la copertina insieme alle
   * righe.
   */
  soloCopertina?: true;
}
```

Sostituire il blocco dei tre casi non decidibili:

```ts
  // ── i tre casi in cui la SERIE non è decidibile ────────────────────────────
  // SPIDER ha due maniglie a listino (MR11 e MR15), MILLA due (LC31, LC41),
  // TRAMA due (LC71, LC81). Gli archivi sono due per ciascuno, ma l'ordinale
  // della cartella non è la serie e nessuna fonte di COLOMBO li accoppia.
  // I 66 codici restano senza foto DI RIGA: è il prezzo dichiarato di non
  // indovinare. La COPERTINA no — «che aspetto ha una MILLA» ha una risposta.
  // → domanda aperta per COLOMBO (handoff.md §DA CHIEDERE).
  "01_Spider_m": { etichetta: "SPIDER", soloCopertina: true },
  "01_Spider_p": { etichetta: "SPIDER", soloCopertina: true },
  "01_Milla_1": { etichetta: "MILLA", soloCopertina: true },
  "01_Milla_2": { etichetta: "MILLA", soloCopertina: true },
  "01_Trama_1": { etichetta: "TRAMA", soloCopertina: true },
  "01_Trama_2": { etichetta: "TRAMA", soloCopertina: true },
```

E nel filtro delle candidate di `abbinaFoto` (gradino 1), come **prima** riga:

```ts
    const candidate = usabili.filter((f) => {
      if (!f.voce || f.voce.etichetta !== etichetta) return false;
      // L'archivio nomina il gruppo ma non presta foto ai codici: vedi
      // `soloCopertina`. Senza questa riga, dare l'etichetta a MILLA/SPIDER/
      // TRAMA rimetterebbe 66 foto sbagliate.
      if (f.voce.soloCopertina) return false;
      if (f.voce.serie && !serieDelCodice.startsWith(f.voce.serie)) return false;
      return f.zero === zero;
    });
```

- [ ] **Step 4: eseguire e vedere il verde**

```bash
corepack pnpm vitest run src/server/maniglie/foto-archivio.test.ts
```
Atteso: PASS.

- [ ] **Step 5: commit**

```bash
git add src/server/maniglie/foto-archivio.ts src/server/maniglie/foto-archivio.test.ts
git commit -m "feat(maniglie): un archivio può nominare il gruppo senza prestare foto ai codici"
```

---

## Task 4: `copertinaDiGruppo` — la chiave Blob della copertina, derivata dalle tabelle

**Files:**
- Modify: `src/server/maniglie/foto-archivio.ts` (`FILE_MODELLO` + nuova funzione esportata)
- Test: `src/server/maniglie/foto-archivio.test.ts`

**Interfaces:**
- Produces: `export function copertinaDiGruppo(etichetta: string): string | null` — la chiave Blob (senza suffisso `-320.webp`) della copertina dichiarata per quel gruppo, o `null`.
- Produces: `export function copertineDichiarate(): Map<string, string>` — etichetta → chiave, per lo script ops e per il gate.

- [ ] **Step 1: scrivere i test che falliscono**

```ts
describe("copertine di gruppo", () => {
  /**
   * La copertina è una proprietà del GRUPPO, non di un suo articolo: dice
   * «questo gruppo è così», non «questo codice è così». Per questo può esistere
   * dove nessun codice ha una foto provata — che è il caso dei quattro pomoli e
   * dei tre modelli ad archivio ambiguo.
   */
  it("i sette gruppi senza foto di riga hanno una copertina dichiarata", () => {
    expect(copertinaDiGruppo("CUT")).toBe("maniglie/colombo/02-pomoli/cut15-45");
    expect(copertinaDiGruppo("PUSH")).toBe("maniglie/colombo/02-pomoli/push-45");
    expect(copertinaDiGruppo("ROUND")).toBe("maniglie/colombo/02-pomoli/round25-45");
    expect(copertinaDiGruppo("SQUARE")).toBe("maniglie/colombo/02-pomoli/square25-45");
    expect(copertinaDiGruppo("MILLA")).toBe("maniglie/colombo/01-milla-1/milla1-2crcm");
    expect(copertinaDiGruppo("SPIDER")).toBe("maniglie/colombo/01-spider-m/spider1-1cr");
    expect(copertinaDiGruppo("TRAMA")).toBe("maniglie/colombo/01-trama-1/trama-1-1cmcr");
  });

  /**
   * Nessuna copertina d'ufficio alle TIPOLOGIE: sarebbe un modello su 56
   * spacciato per la categoria — il verdetto del council del 2026-08-06.
   */
  it("una tipologia non ha copertina", () => {
    for (const t of ["MANIGLIONE", "MANIGLIA INCASSO", "POMOLINO", "BOCCHETTA"]) {
      expect(copertinaDiGruppo(t), t).toBeNull();
    }
  });

  it("un gruppo che non esiste non ha copertina", () => {
    expect(copertinaDiGruppo("NON ESISTE")).toBeNull();
  });

  /**
   * Deterministica: due esecuzioni non devono dare due copertine diverse allo
   * stesso gruppo, o la tessera cambierebbe faccia senza che nessuno l'abbia
   * chiesto. ROUND e SQUARE hanno DUE file dichiarati ciascuno.
   */
  it("con più file dichiarati sceglie sempre lo stesso", () => {
    expect(copertinaDiGruppo("ROUND")).toBe(copertinaDiGruppo("ROUND"));
    expect(copertineDichiarate().get("ROUND")).toBe(copertinaDiGruppo("ROUND"));
  });

  it("copertineDichiarate elenca esattamente i gruppi che ne hanno una", () => {
    expect([...copertineDichiarate().keys()].sort()).toEqual([
      "CUT",
      "MILLA",
      "POMOLO",
      "PUSH",
      "ROBOT",
      "ROUND",
      "SPIDER",
      "SQUARE",
      "TRAMA",
    ]);
  });
});
```

> ⚠️ `ROBOT` e `POMOLO` compaiono perché hanno già voci in `FILE_MODELLO`. Non è un difetto: la copertina dichiarata è un **ripiego** e quei due gruppi hanno foto di riga, quindi non la useranno mai (Task 5). Se l'elenco atteso non combacia all'esecuzione, **correggere il test sui valori veri**, non la funzione.

- [ ] **Step 2: eseguire e vedere il rosso**

```bash
corepack pnpm vitest run src/server/maniglie/foto-archivio.test.ts -t "copertine di gruppo"
```
Atteso: FAIL — `copertinaDiGruppo is not a function`.

- [ ] **Step 3: implementare**

Aggiungere a `FILE_MODELLO`, in fondo, le tre voci nuove:

```ts
  // ── copertine dei tre gruppi ad archivio ambiguo (2026-08-06) ──────────────
  // Non agganciano codici (`soloCopertina`): danno solo la faccia al gruppo.
  // Scelti guardandoli, non dal nome: sono scatti maniglia-sola in cromo su
  // bianco, la stessa grammatica di `Fedra_2CR` che è già nella griglia.
  "01_Milla_1/milla1_2CRCM": { etichetta: "MILLA", soloCopertina: true },
  "01_Spider_m/spider1_1CR": { etichetta: "SPIDER", soloCopertina: true },
  "01_Trama_1/trama 1_1CMCR": { etichetta: "TRAMA", soloCopertina: true },
```

E la funzione, sotto `etichetteModello`:

```ts
/**
 * LA COPERTINA DICHIARATA di un gruppo: etichetta → chiave Blob.
 *
 * È una proprietà del GRUPPO, non di un suo articolo. La differenza non è
 * accademica: la copertina afferma «questo gruppo è così», dove la foto di una
 * riga afferma «questo codice è così». La finitura conta nella seconda e non
 * nella prima, ed è per questo che una copertina può esistere dove nessun
 * codice ha una foto provata — i quattro pomoli, i tre modelli ad archivio
 * ambiguo.
 *
 * Si deriva da `FILE_MODELLO`, che è già la tabella «questo FILE appartiene a
 * questa etichetta»: nessun dato nuovo, nessuna colonna, nessun elenco da
 * tenere allineato. Ordine di chiave crescente, così due esecuzioni danno la
 * stessa copertina allo stesso gruppo.
 */
export function copertineDichiarate(): Map<string, string> {
  const out = new Map<string, string>();
  for (const key of Object.keys(FILE_MODELLO).sort()) {
    const etichetta = FILE_MODELLO[key]!.etichetta;
    if (etichetta === null || out.has(etichetta)) continue;
    const i = key.indexOf("/");
    out.set(etichetta, chiaveFoto(key.slice(0, i), key.slice(i + 1)));
  }
  return out;
}

/** La copertina dichiarata per un'etichetta, o `null`. */
export function copertinaDiGruppo(etichetta: string): string | null {
  return copertineDichiarate().get(etichetta) ?? null;
}
```

- [ ] **Step 4: eseguire e vedere il verde**

```bash
corepack pnpm vitest run src/server/maniglie/foto-archivio.test.ts
```
Atteso: PASS. Se l'elenco di `copertineDichiarate` differisce, allineare il test ai valori veri.

- [ ] **Step 5: commit**

```bash
git add src/server/maniglie/foto-archivio.ts src/server/maniglie/foto-archivio.test.ts
git commit -m "feat(maniglie): la copertina di un gruppo, derivata dalle tabelle d'archivio"
```

---

## Task 5: il router usa la copertina come ripiego

**Files:**
- Modify: `src/server/api/routers/article.ts:183-232` (`browseGroups`)
- Test: `src/server/api/routers/article.test.ts` (se il file non esiste, creare `src/server/api/routers/article-browse.test.ts` con un test puro sulla funzione estratta — vedi Step 3)

**Interfaces:**
- Consumes: `copertinaDiGruppo(etichetta)` da Task 4, `etichetteModello()`, `etichetteAccessorio(brand)`
- Produces: `browseGroups` restituisce `preview: string | null` dove `null` significa «nessuna area immagine».

- [ ] **Step 1: scrivere il test che fallisce**

Estrarre la regola in una funzione pura testabile. Creare `src/server/maniglie/copertina.ts` con il test `src/server/maniglie/copertina.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { previewDiGruppo } from "./copertina";

describe("previewDiGruppo", () => {
  it("un gruppo-modello con foto usa la foto di un suo articolo", () => {
    expect(previewDiGruppo("FEDRA", "maniglie/colombo/01-fedra/fedra-2cr")).toBe(
      "maniglie/colombo/01-fedra/fedra-2cr",
    );
  });

  /**
   * Il caso che questa funzione esiste per risolvere: CUT è un modello, e i
   * suoi undici codici hanno perso la foto perché nessuno prova la propria
   * finitura. Il gruppo però una faccia ce l'ha.
   */
  it("un gruppo-modello senza foto di riga usa la copertina dichiarata", () => {
    expect(previewDiGruppo("CUT", null)).toBe("maniglie/colombo/02-pomoli/cut15-45");
  });

  it("una tipologia non ha preview, nemmeno se un suo articolo ha una foto", () => {
    // Non è una svista: sarebbe l'ESEMPLARE, cioè un modello su 56 spacciato
    // per la categoria. Verdetto del council del 2026-08-06.
    expect(previewDiGruppo("MANIGLIONE", "maniglie/colombo/03-maniglioni-pulls/x")).toBeNull();
  });

  it("una tipologia senza niente non ha preview", () => {
    expect(previewDiGruppo("BOCCHETTA", null)).toBeNull();
  });
});
```

- [ ] **Step 2: eseguire e vedere il rosso**

```bash
corepack pnpm vitest run src/server/maniglie/copertina.test.ts
```
Atteso: FAIL — modulo inesistente.

- [ ] **Step 3: implementare il modulo puro**

Creare `src/server/maniglie/copertina.ts`:

```ts
import { copertinaDiGruppo, etichetteModello } from "./foto-archivio";

/**
 * La chiave Blob da mostrare sulla TESSERA di un gruppo, o `null` per
 * «nessuna area immagine».
 *
 * Due sorgenti in ordine, e nessuna terza:
 *  1. la foto di un suo articolo — solo per i gruppi che COLOMBO fotografa come
 *     MODELLO. Alle TIPOLOGIE non si conferisce un esemplare: una foto sola
 *     sarebbe un modello su 56 spacciato per la categoria.
 *  2. la copertina DICHIARATA in `FILE_MODELLO`, che esiste anche dove nessun
 *     codice ha una foto provata.
 *
 * `null` non è un ripiego: è la risposta vera per una tipologia, e la tessera
 * la disegna come tessera-parola invece che come riquadro vuoto.
 */
export function previewDiGruppo(etichetta: string, daArticolo: string | null): string | null {
  if (!etichetteModello().has(etichetta)) return null;
  return daArticolo ?? copertinaDiGruppo(etichetta);
}
```

- [ ] **Step 4: eseguire e vedere il verde**

```bash
corepack pnpm vitest run src/server/maniglie/copertina.test.ts
```
Atteso: PASS.

- [ ] **Step 5: collegarlo al router**

In `src/server/api/routers/article.ts`, sostituire il `return` di `browseGroups`:

```ts
      return {
        groups: groups.map((g) => ({
          word: g.word,
          count: g.count,
          isModello: modelli.has(g.word),
          isAccessorio: accessori.has(g.word),
          // La FORMA della tessera segue `preview`, non `isModello`: vedi
          // `previewDiGruppo`. Prima seguiva `isModello`, e i quattro gruppi di
          // pomoli — modelli rimasti senza foto — mostravano il riquadro VUOTO,
          // cioè proprio la cosa che quella regola esisteva per impedire.
          preview: urlFoto(
            previewDiGruppo(g.word, perGruppo.get(g.word)?.imageUrl ?? null),
            320,
          ),
        })),
      };
```

Aggiungere l'import `import { previewDiGruppo } from "@/server/maniglie/copertina";` e togliere dal ciclo di `perGruppo` il filtro `!modelli.has(label)` **solo se** `modelli` non serve più altrove: `isModello` resta nella risposta, quindi `modelli` va tenuto. Il filtro nel ciclo può restare: `previewDiGruppo` lo riapplica, e due guardie concordi non fanno danno. Lasciarlo, e annotarlo:

```ts
        // Il filtro sui modelli è ridondante con `previewDiGruppo` ed è tenuto
        // apposta: evita di costruire una mappa di 27 voci che nessuno legge.
        if (label === null || !modelli.has(label)) continue;
```

- [ ] **Step 6: gate**

```bash
corepack pnpm typecheck && corepack pnpm vitest run src/server/maniglie src/server/api
```
Atteso: PASS.

- [ ] **Step 7: commit**

```bash
git add src/server/maniglie/copertina.ts src/server/maniglie/copertina.test.ts src/server/api/routers/article.ts
git commit -m "feat(maniglie): la tessera segue la foto, non isModello"
```

---

## Task 6: la tessera — si allunga, e non mostra mai un riquadro vuoto

**Files:**
- Modify: `src/components/maniglie/sfoglia.tsx:245` (griglia), `:301-359` (`TesseraGruppo`, `FotoGruppo`), `:158-162` (paragrafo che dichiara)
- Test: `src/app/(dashboard)/maniglie/maniglie-client.test.tsx`

**Interfaces:**
- Consumes: `Gruppo { word, count, isModello, isAccessorio, preview }` (invariata)
- L'area immagine dipende da `preview !== null`; `isModello` resta nel tipo perché il livello 2 lo usa.

- [ ] **Step 1: scrivere i test che falliscono**

```tsx
describe("ManiglieClient — la forma della tessera", () => {
  it("una tessera senza foto non ha area immagine", () => {
    const { container } = render(<ManiglieClient />);
    const kit = container.querySelector("a[href*='tipo=KIT']")!;
    expect(kit.querySelector("img")).toBeNull();
    expect(kit.querySelector("svg")).toBeNull();
  });

  /**
   * ⚠️ Il riquadro grigio col pacchetto NON deve tornare. Fino al 2026-08-06 la
   * forma seguiva `isModello`, quindi i quattro gruppi di pomoli — modelli
   * rimasti senza foto — mostravano il riquadro VUOTO: proprio la cosa che la
   * regola della PR #58 esisteva per impedire («in una griglia un buco si legge
   * come immagine rotta»), in produzione per un mese.
   */
  it("un MODELLO senza preview è una tessera-parola, non un riquadro vuoto", () => {
    browseGroupsQuery.mockReturnValue({
      data: {
        groups: [{ word: "CUT", count: 11, isModello: true, isAccessorio: false, preview: null }],
      },
      isPending: false,
      isError: false,
      isFetching: false,
    });
    const { container } = render(<ManiglieClient />);
    const cut = container.querySelector("a[href*='tipo=CUT']")!;
    expect(cut.querySelector("img")).toBeNull();
    expect(cut.querySelector("svg")).toBeNull();
    expect(cut.textContent).toContain("CUT");
  });

  it("dichiara che la foto è del modello e non della finitura", () => {
    render(<ManiglieClient />);
    expect(screen.getByText(/del modello, non della finitura/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: eseguire e vedere il rosso**

```bash
corepack pnpm vitest run "src/app/(dashboard)/maniglie/maniglie-client.test.tsx" -t "la forma della tessera"
```
Atteso: FAIL — la tessera-modello senza preview renderizza l'icona `Package`.

- [ ] **Step 3: implementare**

(a) La griglia, in `GrigliaGruppi`:

```tsx
    // `items-stretch` e non `items-start`: senza, la tessera senza foto resta
    // appesa in cima a una riga di tessere alte e lascia il buco sotto di sé —
    // ed è per QUESTO che si legge come «immagine mancante», non perché la foto
    // manchi. Il `Link` ha già `h-full` e il nome ha già `flex-1 items-center`:
    // il codice era scritto per allungarsi, e `items-start` lo annullava.
    <ul className="grid list-none grid-cols-2 items-stretch gap-2 sm:grid-cols-3 lg:grid-cols-4">
```

(b) `TesseraGruppo`: l'area immagine segue la foto, e il carattere del nome anche.

```tsx
function TesseraGruppo({ gruppo, coda }: { gruppo: Gruppo; coda: string }) {
  const [fallita, setFallita] = useState(false);
  const foto = gruppo.preview !== null && !fallita;
  return (
    <li>
      <Link
        href={`/maniglie?tipo=${encodeURIComponent(gruppo.word)}${coda ? `&${coda}` : ""}`}
        aria-label={`${gruppo.word}, ${conteggio(gruppo.count)}`}
        className="flex h-full flex-col gap-1 rounded-md border border-line bg-surface p-2 transition-colors duration-150 hover:border-line-strong hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- sorgente dinamica dietro auth, non da ottimizzare
          <img
            src={gruppo.preview!}
            alt=""
            loading="lazy"
            onError={() => setFallita(true)}
            className="aspect-square w-full rounded bg-white object-contain"
          />
        ) : null}
        <span
          className={
            foto
              ? "break-words text-sm font-medium leading-tight text-ink"
              : "flex min-h-[40px] flex-1 items-center break-words text-base font-semibold leading-tight text-ink"
          }
        >
          {gruppo.word}
        </span>
        <span aria-hidden className="text-xs tabular-nums text-ink-subtle">
          {gruppo.count}
        </span>
      </Link>
    </li>
  );
}
```

Cancellare del tutto il componente `FotoGruppo` e l'import di `Package` se non più usato altrove nel file. Sostituire il commento di `TesseraGruppo` con:

```tsx
/**
 * La tessera di un gruppo, in DUE forme, e la differenza non è estetica.
 *
 * **Con foto**: copertina grande, nome, conteggio. La copertina è una proprietà
 * del GRUPPO — dice «questo gruppo è così», non «questo codice è così» — e per
 * questo esiste anche dove nessun codice ha una foto provata. Quali gruppi ne
 * abbiano una NON è un nostro giudizio: è l'archivio fotografico di COLOMBO.
 *
 * **Senza**: solo testo, nome più grande, tessera piena. Le TIPOLOGIE non hanno
 * copertina perché una foto della categoria non esiste: quella di un suo membro
 * sarebbe un modello su 56 spacciato per tutti (verdetto del council,
 * 2026-08-06).
 *
 * ⚠️ La forma segue `preview`, NON `isModello`. Con `isModello` i quattro gruppi
 * di pomoli — modelli rimasti senza foto dopo la PR #60 — mostravano il riquadro
 * VUOTO: la cosa che quella regola esisteva per impedire. Un riquadro vuoto ora
 * è impossibile per costruzione, e lo è anche quando la foto non arriva (404 su
 * Blob): `onError` fa tornare la tessera-parola, che è uno stato coerente.
 *
 * L'etichetta va a capo invece di troncarsi: fra i gruppi veri ci sono
 * `ROBOQUATTRO`, `FERMAPORTA`, `MANIGLIA INCASSO`, e a 375px in due colonne non
 * ci stanno su una riga sola.
 */
```

(c) Il paragrafo che dichiara, in `SfogliaGruppi`:

```tsx
        <p className="text-xs text-ink-subtle">
          {groups.length} gruppi in ordine alfabetico. Il numero è quanti codici
          {insiemeContato(soloPronta, finitura)}, non quanti modelli: lo stesso pezzo compare una
          volta per finitura. Le foto sono del modello, non della finitura del singolo codice.
        </p>
```

con sopra il commento:

```tsx
        {/* «Le foto sono del modello, non della finitura» paga un debito che il
            council ha trovato all'unanimità: la copertina di un gruppo-modello
            mostra la finitura del PRIMO CODICE IN ORDINE ALFABETICO
            (`article.ts`), e nessuno l'aveva mai dichiarato. È la classe
            «valore deciso dal programma e mai dichiarato», chiusa otto volte da
            questo progetto. Non si ripete DENTRO il gruppo, dove sarebbe falsa:
            le foto delle righe la finitura ce l'hanno provata. */}
```

- [ ] **Step 4: eseguire e vedere il verde**

```bash
corepack pnpm vitest run "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"
```
Atteso: PASS.

- [ ] **Step 5: commit**

```bash
git add src/components/maniglie/sfoglia.tsx "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"
git commit -m "feat(maniglie): la tessera si allunga, e il riquadro vuoto diventa impossibile"
```

---

## Task 7: le righe articolo — spazio vuoto, mai un riquadro grigio

**Files:**
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.tsx:480-510` (`Foto`)
- Test: `src/app/(dashboard)/maniglie/maniglie-client.test.tsx`

- [ ] **Step 1: scrivere il test che fallisce**

```tsx
  /**
   * 336 righe su 353 in MANIGLIONE, e — visto in browser — sotto
   * un'intestazione di serie che la foto CE L'HA: non dice «non l'abbiamo»,
   * dice «ce l'abbiamo e non te la mostriamo». Non è una decisione nuova: è già
   * scritta in `AnteprimaSerie` («otto riquadri grigi in colonna si leggono
   * come *il programma è rotto*») e non era stata applicata alle righe.
   */
  it("una riga senza foto lascia lo spazio, non un segnaposto", () => {
    const { container } = render(<ManiglieClient />);
    // Niente `li:has(…)`: il selettore `:has` non è garantito nell'ambiente di
    // test. Si risale dall'ancora della riga, che è ciò che la identifica.
    const riga = container.querySelector("a[href^='/maniglie/']")!.closest("li")!;
    expect(riga.querySelector("svg")).toBeNull();
    // La colonna resta, o l'allineamento si muove riga per riga.
    expect(riga.className).toContain("44px");
  });
```

- [ ] **Step 2: eseguire e vedere il rosso**

```bash
corepack pnpm vitest run "src/app/(dashboard)/maniglie/maniglie-client.test.tsx" -t "lascia lo spazio"
```
Atteso: FAIL — c'è l'icona `Package`.

- [ ] **Step 3: implementare**

```tsx
/**
 * Miniatura, servita da `/api/article-image` (Blob privato, dietro auth).
 *
 * Foto mancante = **spazio vuoto**, non segnaposto, ed è la stessa regola già
 * scritta per l'anteprima delle serie: con la copertura al 46,6% l'assenza è
 * la maggioranza, e una colonna di riquadri grigi si legge come «il programma è
 * rotto». Lo spazio resta, così l'allineamento non si muove.
 *
 * ⚠️ La scheda del singolo articolo tiene invece il suo segnaposto: lì l'oggetto
 * è uno solo, un vuoto grande è peggio di un riquadro neutro, e l'argomento «N
 * buchi si leggono come guasto» richiede la ripetizione.
 */
function Foto({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <span aria-hidden className="size-11 shrink-0" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sorgente dinamica dietro auth, non da ottimizzare
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-11 shrink-0 rounded border border-line bg-white object-contain"
    />
  );
}
```

Togliere l'import di `Package` da `maniglie-client.tsx` se non più usato (verificare con `grep -n "Package" src/app/\(dashboard\)/maniglie/maniglie-client.tsx`).

- [ ] **Step 4: eseguire e vedere il verde**

```bash
corepack pnpm vitest run "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"
```
Atteso: PASS.

- [ ] **Step 5: commit**

```bash
git add "src/app/(dashboard)/maniglie/maniglie-client.tsx" "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"
git commit -m "fix(maniglie): una riga senza foto lascia lo spazio, non un riquadro grigio"
```

---

## Task 8: lo script ops carica anche le copertine

**Files:**
- Modify: `scripts/foto-colombo.ts:168-172` (insieme delle chiavi da caricare)

**Interfaces:**
- Consumes: `copertineDichiarate(): Map<string, string>` da Task 4

- [ ] **Step 1: implementare (script ops, non coperto da test unitari)**

```ts
  const perArticolo = abbinaFoto(MARCA, articoli, foto);
  // Le COPERTINE non sono scelte da nessun articolo: dei sette gruppi che ne
  // hanno una, nessuno ha un codice con la foto provata — è il motivo per cui
  // esistono. Senza questa riga il run non le caricherebbe affatto, e la
  // tessera resterebbe una tessera-parola (stato coerente, ma non quello che
  // vogliamo).
  const chiaviScelte = new Set([...perArticolo.values(), ...copertineDichiarate().values()]);
```

Aggiungere `copertineDichiarate` all'import da `../src/server/maniglie/foto-archivio`.

Correggere anche la riga di riepilogo, che oggi dice «con N foto» contando le chiavi scelte:

```ts
  console.log(
    `▶ abbinamento: ${perArticolo.size}/${articoli.length} articoli (${pct}%) con ${new Set(perArticolo.values()).size} foto · ${copertineDichiarate().size} copertine di gruppo`,
  );
```

- [ ] **Step 2: verificare a secco, senza toccare Blob né DB**

```bash
set -a; source .env; set +a
COLOMBO_DOWNLOAD_PASSWORD=<dall'utente> corepack pnpm foto:colombo --dry-run
```
Atteso: `▶ abbinamento: 1609/3456 articoli (46.6%) con 299 foto · 9 copertine di gruppo`.

- [ ] **Step 3: commit**

```bash
git add scripts/foto-colombo.ts
git commit -m "feat(ops): il run carica anche le copertine di gruppo"
```

---

## Task 9: il gate sull'archivio VERO

**Files:**
- Modify: `src/server/maniglie/foto-archivio.integration.test.ts`

- [ ] **Step 1: scrivere i test**

```ts
  /**
   * Le copertine dichiarate devono ESISTERE nell'archivio COLOMBO. Senza questo,
   * `FILE_MODELLO` è un elenco di stringhe che nessuno confronta con la realtà:
   * un nome sbagliato darebbe una chiave Blob che non esiste, un 404, e la
   * tessera tornerebbe silenziosamente una tessera-parola.
   */
  it("ogni copertina dichiarata esiste davvero nell'archivio", () => {
    const chiavi = new Set(
      foto.filter((f) => scattoDiProdotto(f.nome)).map((f) => chiaveFoto(f.archivio, f.nome)),
    );
    for (const [etichetta, chiave] of copertineDichiarate()) {
      expect(chiavi, `${etichetta} → ${chiave}`).toContain(chiave);
    }
  });

  /**
   * IL PAVIMENTO DI QUESTA SESSIONE: i sette gruppi che Andrea ha segnalato
   * devono avere una preview. È la differenza fra «l'abbiamo sistemato» e «lo
   * crediamo sistemato».
   */
  it("i sette gruppi segnalati hanno una copertina", () => {
    for (const g of ["CUT", "PUSH", "ROUND", "SQUARE", "MILLA", "SPIDER", "TRAMA"]) {
      expect(previewDiGruppo(g, null), g).not.toBeNull();
    }
  });

  /**
   * E i loro CODICI restano senza foto: la copertina è del gruppo, la riga è del
   * codice. Se questa proprietà cadesse, 66 codici mostrerebbero la foto
   * dell'archivio sbagliato e la copertura SALIREBBE — nessun conteggio
   * andrebbe a zero.
   */
  it("i codici dei tre gruppi ad archivio ambiguo restano senza foto", () => {
    const senza = articoli.filter((a) => {
      const e = browseLabel("COLOMBO", a.name);
      return e !== null && ["MILLA", "SPIDER", "TRAMA"].includes(e) && abbinati.has(a.id);
    });
    expect(senza.map((a) => a.code)).toEqual([]);
  });
```

Aggiungere gli import `copertineDichiarate` da `./foto-archivio` e `previewDiGruppo` da `./copertina`.

- [ ] **Step 2: eseguire il gate**

```bash
set -a; source .env; set +a
COLOMBO_DOWNLOAD_PASSWORD=<dall'utente> corepack pnpm foto:colombo --dry-run --dump /tmp/foto.json
INTEGRATION_DATABASE_URL="$DATABASE_URL" COLOMBO_FOTO_INDEX=/tmp/foto.json \
  corepack pnpm vitest run src/server/maniglie/foto-archivio.integration.test.ts
```
Atteso: PASS, e **non** «skipped». Se dice skipped, mancano le due variabili.

- [ ] **Step 3: commit**

```bash
git add src/server/maniglie/foto-archivio.integration.test.ts
git commit -m "test(maniglie): il gate prova le copertine sull'archivio vero"
```

---

## Task 10: ri-misurare i commenti che una misura ha reso falsi

**Files:**
- Modify: `src/components/maniglie/sfoglia.tsx:195-202` (banda senza intestazione), `:282-299` già fatto in Task 6
- Modify: `src/server/maniglie/foto-archivio.ts:207-218` (`etichetteModello`)
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.test.tsx:865-871`

- [ ] **Step 1: il commento della banda senza intestazione**

```tsx
          {/* ⚠️ LA BANDA DI SOPRA NON HA INTESTAZIONE, ed è una scelta.
              Qualunque nome sarebbe FALSO — «Maniglie» starebbe sopra
              MANIGLIONE (353), MANIGLIA INCASSO (93), POMOLINO (41) — oppure
              sarebbe una SECONDA parola nostra.
              ⚠️ Ri-misurato il 2026-08-06: BOCCHETTA (318) e GRANO sono passati
              fra gli accessori, quindi i controesempi sono scesi da 10 gruppi /
              787 codici a 3 / 487. L'argomento ora regge sulla metà PIÙ FORTE,
              non sui numeri: il giorno che COLOMBO aggiunge un gruppo e nessuno
              lo classifica, quel gruppo cade in una banda che non afferma
              nulla. */}
```

- [ ] **Step 2: il commento di `etichetteModello`**

```ts
/**
 * Le etichette di sfoglio che COLOMBO fotografa come MODELLO: quelle a cui
 * `ARCHIVI` o `FILE_MODELLO` assegnano un archivio.
 *
 * Misurate sul listino 02-26: **66 gruppi su 88** dopo che MILLA, SPIDER e
 * TRAMA hanno riavuto l'etichetta (2026-08-06). Gli altri 22 sono TIPOLOGIE
 * (BOCCHETTA raccoglie 28 serie, MANIGLIONE 56): lì una foto sola sarebbe un
 * modello a caso spacciato per la categoria.
 *
 * ⚠️ Questa funzione decide se un gruppo può ricevere una preview DAI PROPRI
 * ARTICOLI; NON decide la forma della tessera, che segue `preview` (vedi
 * `previewDiGruppo`). Erano la stessa cosa fino al 2026-08-06, ed è per questo
 * che quattro modelli senza foto mostravano un riquadro vuoto.
 */
```

- [ ] **Step 3: il commento del `describe` degli Accessori nel test del client**

Sostituire «(«Maniglie» starebbe sopra BOCCHETTA 318 e MANIGLIONE 353)» con «(«Maniglie» starebbe sopra MANIGLIONE 353 e POMOLINO 41)».

- [ ] **Step 4: gate completi**

```bash
corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test
```
Atteso: tutti verdi.

- [ ] **Step 5: commit**

```bash
git add -A src/
git commit -m "docs(maniglie): ri-misurati i commenti che lo spostamento ha reso falsi"
```

---

## Task 11: verifica in browser, 375px e desktop

**Files:** nessuno (verifica).

- [ ] **Step 1: ambiente**

```bash
# il dev server NON deve girare insieme a una build
pkill -f "next dev" || true
rm -rf .next
set -a; source .env; set +a
(setsid nohup corepack pnpm dev > /tmp/dev.log 2>&1 & disown)
```

Il DB locale deve avere il listino vero e `image_url` scritto con l'abbinamento vero
(`pnpm import:listino COLOMBO <listino.xlsx>` e lo script di scrittura chiavi).
Le foto stanno su Blob privato, assente in locale: intercettare `/api/article-image`
con un PNG vero per provare il **layout**.

- [ ] **Step 2: i controlli, a 375px e su desktop**

1. La griglia mostra **88 gruppi** (non 90).
2. Il collegamento in cima dice **«Accessori (19) ↓»**.
3. **BOCCHETTA** e **GRANO** stanno nella banda Accessori, non nella principale.
4. **`MANIG.CD213` e `MANIG.LC413RS` non esistono più** come tessere.
5. Le tessere senza foto sono **alte quanto le vicine** (nessun buco sotto).
6. **Nessuna tessera mostra il riquadro grigio col pacchetto.**
7. Sopra la griglia si legge «**Le foto sono del modello, non della finitura del singolo codice**».
8. Dentro **MANIGLIONE**, le righe senza foto lasciano lo spazio: **nessun riquadro grigio**.
9. Dentro **CUT** (con la copertina intercettata) la tessera di livello 1 ha la foto.
10. La scheda del singolo articolo **tiene** il suo segnaposto (eccezione dichiarata).

- [ ] **Step 3: guardare gli screenshot**

Non basta che le asserzioni passino: **aprire le immagini**. Tre volte in questo progetto un controllo browser è passato o fallito per la ragione sbagliata.

- [ ] **Step 4: commit degli eventuali fix, poi gate finali**

```bash
pkill -f "next dev"; rm -rf .next
corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test && corepack pnpm build
```

---

## Task 12: documentazione e chiusura

**Files:**
- Modify: `handoff.md`, `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-08-06-copertine-gruppo-design.md` (§9, esito delle domande)

- [ ] **Step 1: aggiornare `handoff.md`** — nuova sezione «Sessione attuale» con: cosa ha chiesto Andrea, la distinzione fra i due problemi, il verdetto del council e le tre affermazioni cadute, i numeri finali, **l'azione ops**, e le domande aperte per COLOMBO e per Andrea.
- [ ] **Step 2: aggiornare `CLAUDE.md`** §STATO con un paragrafo sulla sessione.
- [ ] **Step 3: cancellare `.scratch/`** (è gitignored, ma va lasciato pulito) e verificare che **nessun dato del fornitore** sia finito nel diff: `git diff main --stat` e controllare che gli unici nomi di file COLOMBO aggiunti siano i tre di `FILE_MODELLO`.
- [ ] **Step 4: commit e push**

```bash
git add -A
git commit -m "docs: chiusura sessione — le copertine dei gruppi"
git push -u origin claude/ufptrade-andrea-feedback-f0s2re
```

---

## Note di esecuzione

- **L'azione ops** («Ops — Foto COLOMBO», ~7 minuti, idempotente) va lanciata **dopo** il merge o sul ref del branch: non c'è migrazione e non c'è finestra di disservizio, perché prima del run le sette copertine sono tessere-parola, che è uno stato coerente.
- **Non toccare** `abbinaFoto` oltre alla riga di `soloCopertina`: la regola delle finiture è quella che ha portato le foto provate sbagliate da 350 a 0.
- Il golden del kit e tutto il reparto serramenti **non si toccano**: se un test di `src/server/kit/` cambia, qualcosa è andato storto.
