# Cambiare le varianti dopo la creazione — piano di implementazione

> **Per chi esegue:** un task per commit, TDD stretto (test rosso → minimo per farlo
> passare → verde → commit). Gli step hanno le checkbox per essere spuntati.

**Obiettivo:** permettere all'agente di cambiare le 5 varianti componente **dopo** aver
creato la richiesta, senza rifare il wizard da capo.

**Architettura:** `kit.ricalcola` accetta `variants?`; il wizard si riapre in modalità
modifica (`?da=<id>`) idratandosi con **la stessa `kitInputFromRequest`** che usa il
motore. Geometria, entrata e quote **non sono modificabili**: congelarle nella firma
rende irrappresentabile la combinazione geometria/varianti mai validata.

**Stack:** Next.js 15 (App Router) · React 19 · tRPC v11 · Prisma 6 · zod · Vitest.

Spec: `docs/superpowers/specs/2026-08-01-varianti-dopo-creazione-design.md`

## Vincoli globali

- **TypeScript strict.** Tutte le API via **tRPC**, tutte le query via **Prisma**.
- **UI in italiano**, codici prodotto in **font monospace**.
- **Mobile-first**: ogni schermata toccata va verificata a **≤375px** *e* desktop.
- **Il kit è un motore deterministico. Mai un LLM.**
- **NESSUNA migrazione, NESSUNA azione ops.** La colonna `variants` esiste dalla #47 ed è
  già su Neon (run `30659737114`).
- **Il golden non si tocca:** `16 righe / 21 pezzi / 90,20 €`, gemello entrata 7,5
  `96,29 €`, antieffrazione completa `17 righe / 22 pezzi / 110,13 €`. Dalla #47 sono
  asseriti anche l'ordine assoluto delle righe e le 16 descrizioni carattere per
  carattere.
- Comandi: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`.
- Prima di qualunque comando `prisma`/`tsx`: `set -a; source .env; set +a`.
- Il gate su catalogo reale si lancia così (senza la variabile **passa a vuoto**):
  ```bash
  set -a; source .env; set +a
  INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm vitest run \
    src/server/kit/codici-a-listino.integration.test.ts \
    src/server/kit/engine.integration.test.ts
  ```
- **Postgres in questo container muore**: prima di ogni comando che tocca il DB,
  `docker ps`; se serve, `(setsid nohup dockerd > /tmp/dockerd.log 2>&1 & disown)` e poi
  `docker compose up -d`.

---

## Struttura dei file

| File | Responsabilità | Task |
|---|---|---|
| `src/server/kit/engine.integration.test.ts` | gate su catalogo reale: **totali esatti** | 1 |
| `src/server/kit/varianti-schema.ts` | file foglia (solo zod) — vi si sposta `componiVarianti` | 2 |
| `src/server/api/routers/kit.ts` | `ricalcola({kitRequestId, variants?})` | 3 |
| `src/server/api/routers/kit.test.ts` | test del contratto | 3 |
| `src/components/kit/componenti-ribalta.tsx` | il passo «Componenti», estratto dal wizard | 4 |
| `src/app/(dashboard)/richieste/nuova/nuova-client.tsx` | modalità modifica | 5 |
| `src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx` | «Nuova versione» + «Modifica componenti» | 6 |
| `handoff.md`, `CLAUDE.md`, `docs/superpowers/kit-assunzioni/DOMANDE-APERTE.md` | documentazione | 7 |

### Due decisioni di struttura, con la ragione

**1. `componiVarianti` si sposta nel file foglia (Task 2), non si duplica.** La
normalizzazione «blocco vuoto → `undefined`» oggi vive in `nuova-client.tsx` e serve ora
anche al router, che deve scrivere `NULL` e non `{}`. Due copie divergono: sarebbe
esattamente il difetto che la #47 ha corretto (uno standard materializzato a DB dove una
richiesta identica scrive `NULL`). `varianti-schema.ts` è già il file che client e server
importano entrambi, e `componiVarianti` non ha bisogno di nessun altro import — quindi
non riapre il ciclo che quel file esiste per spezzare.

**2. In modalità modifica il wizard ha DUE passi: «Componenti» e «Riepilogo».** Non
cinque passi con i primi tre disabilitati. Le specifiche congelate si mostrano in una
**scheda in testa** — quote, geometria, entrata, mano, chiusure — con scritto **perché**
non si toccano e **dov'è la via d'uscita** («per cambiare le quote serve una richiesta
nuova»). Il motivo è che disabilitare i primi tre passi significherebbe far scendere un
flag `readOnly` dentro ~600 righe di form e in ogni `RadioOption`/`NumberField`: molto
codice per ottenere tre schermate che l'agente attraversa senza poterci fare nulla. La
scheda dice le stesse cose in un colpo d'occhio, e non mente sul numero di passi.

---

## Task 1 — Il gate su catalogo reale asserisce i totali che oggi non asserisce

**Files:**
- Modify: `src/server/kit/engine.integration.test.ts`

**Interfaces:**
- Consuma: `KitEngine.generate(input)` → `{ lines, totalPrice, warnings, … }` (esistente).
- Produce: nulla di codice. È un task di sole asserzioni: nessun file di produzione
  cambia, quindi non può regredire niente.

Perché per primo: è la rete che protegge tutto ciò che i task seguenti muovono, e il DB
col catalogo vero è già montato. `110,13 €` oggi **non è asserito da nessun test** — il
test unitario del modulo non vede i prezzi affatto (i moduli restituiscono righe senza
prezzo, che il motore risolve dopo contro il catalogo), e il numero vive solo nei `.md`.

- [ ] **Step 1: scrivere le asserzioni mancanti**

In `src/server/kit/engine.integration.test.ts`, subito **dopo** il test
«il gemello a entrata 7,5 fa 96,29 €, e cambia solo la cremonese»:

```ts
  // L'antieffrazione completa (movimento a due nottolini + incontri
  // antieffrazione + piastrino) è la configurazione che la PR di oggi rende
  // raggiungibile con un clic su una distinta già emessa. Fino a qui il suo
  // totale non era asserito da NESSUN test: il test del modulo
  // (`rules-artech-legno.test.ts`) conta righe e pezzi ma non vede i prezzi —
  // i moduli restituiscono `KitLine` senza prezzo, che il motore risolve dopo
  // contro il catalogo. Il numero viveva solo nei .md, cioè in una fotografia.
  it("l'antieffrazione completa fa 17 righe / 22 pezzi / 110,13 €", async () => {
    const output = await new KitEngine(db).generate({
      windowType: "ANTA_RIBALTA",
      widthMm: 550,
      heightMm: 1820,
      material: "LEGNO",
      geometry: "A12_I13_B20",
      entrata: "E15",
      seatConfig: "STANDARD",
      openingSide: "SINISTRA",
      openingDir: "TIRARE",
      finish: "ARGENTO",
      series: "ARTECH",
      supplementaryClosures: true,
      variants: {
        movimentoAngolare: "DUE_NOTTOLINI",
        incontroNottolino: "ANTIEFFRAZIONE_INCLINATE",
        piastrinoAntieffrazione: true,
      },
    });
    expect(output.warnings).toEqual([]);
    expect(output.lines).toHaveLength(17);
    expect(output.lines.every((line) => line.unitPrice !== null)).toBe(true);
    expect(output.lines.reduce((n, l) => n + l.quantity, 0)).toBe(22);
    expect(Number(output.totalPrice).toFixed(2)).toBe("110.13");
    // I tre codici che l'antieffrazione sostituisce o aggiunge, sul catalogo vero.
    expect(output.lines.find((l) => l.position === "movimento-angolare")!.code).toBe(
      "A50302.02.02",
    );
    expect(output.lines.find((l) => l.position === "incontri-nottolino")!.code).toBe(
      "A514SX.05.67",
    );
    expect(output.lines.find((l) => l.position === "piastrino-antieffrazione")!.code).toBe(
      "A20050.00.02",
    );
  });
```

Poi, nei tre test del bilico TOUR più in basso, sostituire le asserzioni deboli con i
totali veri. Rimpiazzare nel test «il bilico 3 lati risolve 7 codici reali, tutti con
prezzo» la riga `expect(output.totalPrice).toBeGreaterThan(0);` con:

```ts
    expect(output.lines.reduce((n, l) => n + l.quantity, 0)).toBe(18);
    // `toBeGreaterThan(0)` accanto a tre totali esatti era la stessa asimmetria
    // che la #44 ha chiuso sul golden: un verde che non verifica. I tre numeri
    // sono quelli misurati alla #35 e ri-misurati sul catalogo importato oggi.
    expect(Number(output.totalPrice).toFixed(2)).toBe("450.03");
```

Nel test «il bilico 4 lati aggiunge le due aste di mano opposta», dopo
`expect(output.lines.every((line) => line.unitPrice !== null)).toBe(true);` aggiungere:

```ts
    expect(output.lines.reduce((n, l) => n + l.quantity, 0)).toBe(20);
    expect(Number(output.totalPrice).toFixed(2)).toBe("766.51");
```

Nel test «lo schema 3 aggiunge il kit spessori, anch'esso a catalogo con prezzo», dopo
`expect(spessori?.unitPrice).toBeGreaterThan(0);` aggiungere:

```ts
    expect(output.lines).toHaveLength(8);
    expect(output.lines.reduce((n, l) => n + l.quantity, 0)).toBe(19);
    expect(Number(output.totalPrice).toFixed(2)).toBe("433.46");
```

- [ ] **Step 2: eseguire il gate e verificare che passi sul catalogo vero**

```bash
docker ps   # se manca ufptrade-db, rialzare docker (vedi Vincoli globali)
set -a; source .env; set +a
INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm vitest run src/server/kit/engine.integration.test.ts
```
Atteso: `Tests 11 passed` (10 esistenti + 1 nuovo), **nessuno skippato**.

Se un totale non torna, **non aggiustare il numero atteso**: significa che il catalogo
importato non è quello di riferimento. Verificare `SELECT count(*) FROM products` = 7.488
e, se diverge, rifare `pnpm import:agb <listino.pdf>`.

- [ ] **Step 3: verificare che senza la variabile il gate resti innocuo**

```bash
pnpm vitest run src/server/kit/engine.integration.test.ts
```
Atteso: `11 skipped`. È il comportamento previsto: in CI, dove non c'è un DB col listino,
il file non deve fallire.

- [ ] **Step 4: commit**

```bash
git add src/server/kit/engine.integration.test.ts
git commit -m "test(kit): il gate su catalogo reale asserisce i totali, non solo l'esistenza

110,13 € non era asserito da NESSUN test: il test del modulo conta righe e pezzi
ma non vede i prezzi (i moduli restituiscono KitLine senza prezzo, risolti dopo
contro il catalogo), quindi il numero viveva solo nei .md. Ed è la
configurazione che la PR rende raggiungibile con un clic su una distinta emessa.

Chiusa nello stesso file l'asimmetria del bilico: tre totali già misurati alla
#35 stavano dietro un toBeGreaterThan(0). Ri-misurati sul catalogo importato e
identici: 450,03 · 766,51 · 433,46."
```

---

## Task 2 — `componiVarianti` diventa condivisa fra client e server

**Files:**
- Modify: `src/server/kit/varianti-schema.ts`
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`
- Test: `src/server/kit/varianti-schema.test.ts` (creare)

**Interfaces:**
- Produce: `componiVarianti(v: Varianti): Varianti | undefined` esportata da
  `@/server/kit/varianti-schema`. Il Task 3 la importa per normalizzare `{}` → `NULL`;
  il Task 5 la usa dal client come già fa oggi.

- [ ] **Step 1: scrivere il test (rosso)**

Creare `src/server/kit/varianti-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { componiVarianti, variantiSchema, VARIANTE_IDS } from "./varianti-schema";

describe("componiVarianti", () => {
  it("toglie le chiavi non scelte", () => {
    expect(componiVarianti({ squadraAngolare: "BASE", incontroRibalta: undefined })).toEqual({
      squadraAngolare: "BASE",
    });
  });

  // `false` si pota come `undefined`: per il piastrino — l'unica variante
  // booleana — lo standard è «nessun piastrino», che il motore legge da
  // `=== true`. `{ piastrinoAntieffrazione: false }` sarebbe uno standard
  // MATERIALIZZATO, cioè ciò che la potatura esiste per impedire alle altre.
  it("pota anche il false del piastrino", () => {
    expect(componiVarianti({ piastrinoAntieffrazione: false })).toBeUndefined();
  });

  it("un blocco vuoto è undefined, non {}", () => {
    expect(componiVarianti({})).toBeUndefined();
  });

  it("il blocco potato resta valido per lo schema", () => {
    const potato = componiVarianti({ squadraAngolare: "BASE", piastrinoAntieffrazione: false });
    expect(variantiSchema.safeParse(potato).success).toBe(true);
  });

  it("VARIANTE_IDS copre tutte le chiavi dello schema", () => {
    expect([...VARIANTE_IDS].sort()).toEqual(Object.keys(variantiSchema.shape).sort());
  });
});
```

- [ ] **Step 2: eseguire e verificare che fallisca**

```bash
pnpm vitest run src/server/kit/varianti-schema.test.ts
```
Atteso: FAIL — `componiVarianti` non è esportata da quel modulo.

- [ ] **Step 3: spostare la funzione**

In `src/server/kit/varianti-schema.ts`, in fondo al file, aggiungere:

```ts
/**
 * Blocco varianti senza le chiavi vuote — e `undefined` se non ne resta nessuna.
 * `{}` non deve raggiungere il DB: `undefined` significa «lo standard del
 * programma», e il default vive nel REGISTRO, non nel dato persistito
 * (`artech-varianti.ts`). Senza questa normalizzazione, spegnere l'interruttore
 * lascerebbe una colonna `{}` indistinguibile da una scelta.
 *
 * `false` si pota come `undefined`, e non è una simmetria estetica: per il
 * piastrino — l'unica variante booleana — lo standard è «nessun piastrino», che
 * il motore legge da `=== true`. `{ piastrinoAntieffrazione: false }` sarebbe
 * quindi UNO STANDARD MATERIALIZZATO, cioè esattamente ciò che la potatura
 * esiste per impedire alle altre quattro.
 *
 * Vive QUI e non nel wizard perché dal 2026-08-01 la usano in due: il form, e
 * `kit.ricalcola`, che deve scrivere `NULL` e non `{}`. Due copie divergono, e
 * la divergenza sarebbe invisibile — una riga con `{}` e una con `NULL` sono
 * indistinguibili sul serramento e diverse a DB.
 */
export function componiVarianti(v: Varianti): Varianti | undefined {
  const pulite = Object.fromEntries(
    Object.entries(v).filter(([, valore]) => valore !== undefined && valore !== false),
  ) as Varianti;
  return Object.keys(pulite).length === 0 ? undefined : pulite;
}
```

In `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`, **cancellare** la definizione
locale di `componiVarianti` (con tutto il suo commento) e importarla:

```ts
import { componiVarianti, type Varianti } from "@/server/kit/varianti-schema";
```

(se l'import da `varianti-schema` esiste già, aggiungere solo `componiVarianti` alla lista).

- [ ] **Step 4: eseguire i test e verificare che passino**

```bash
pnpm vitest run src/server/kit/varianti-schema.test.ts src/app/\(dashboard\)/richieste/nuova/nuova-client.test.tsx
pnpm typecheck && pnpm lint
```
Atteso: tutti verdi. `lint` deve restare pulito: la regola `no-restricted-imports` su
`varianti-schema.ts` vieta gli import relativi in quel file, e `componiVarianti` non ne
introduce nessuno.

- [ ] **Step 5: commit**

```bash
git add src/server/kit/varianti-schema.ts src/server/kit/varianti-schema.test.ts "src/app/(dashboard)/richieste/nuova/nuova-client.tsx"
git commit -m "refactor(kit): componiVarianti nel file foglia, condivisa con il router

Dal prossimo commit la usa anche kit.ricalcola, che deve scrivere NULL e non {}.
Duplicarla sarebbe stata una seconda sorgente della stessa regola, e la
divergenza invisibile: una riga con {} e una con NULL sono indistinguibili sul
serramento e diverse a DB — il difetto che la #47 ha già corretto una volta."
```

---

## Task 3 — `kit.ricalcola` accetta `variants?`

**Files:**
- Modify: `src/server/api/routers/kit.ts`
- Modify: `src/server/api/routers/kit.test.ts`

**Interfaces:**
- Consuma: `componiVarianti` (Task 2), `kitInputFromRequest` e `KitEngine` (esistenti).
- Produce: `kit.ricalcola({ kitRequestId: string, variants?: Varianti })` →
  `{ id: string, requestNumber: string }`. Il Task 5 la chiama dal wizard.

Semantica, da rispettare alla lettera:

| input | effetto |
|---|---|
| `variants` assente | eredita verbatim — comportamento odierno, invariato |
| `variants: {}` (o che si pota a vuoto) | reset allo standard → scrive `NULL` |
| `variants: {…}` | **sostituzione integrale**, mai un merge |

- [ ] **Step 1: scrivere i test (rossi)**

In `src/server/api/routers/kit.test.ts`, dentro il `describe` di `ricalcola` (o in un
`describe("ricalcola — varianti")` nuovo, in fondo al file):

```ts
  // La riga di partenza per i test sotto: già emessa, quindi `ricalcola` deve
  // creare una versione nuova invece di riscrivere.
  const emessa = {
    id: "k1",
    requestNumber: "KIT-2026-0007",
    status: "COMPLETED",
    supersededById: null,
    windowType: "ANTA_RIBALTA",
    widthMm: 550,
    heightMm: 1820,
    material: "LEGNO",
    finish: "ARGENTO",
    series: "ARTECH",
    sashWeightKg: null,
    geometry: "A12_I13_B20",
    entrata: "E15",
    seatConfig: "STANDARD",
    openingSide: "SINISTRA",
    openingDir: "TIRARE",
    supplementaryClosures: true,
    tourSchema: null,
    notes: null,
    customerId: null,
    discountPercent: null,
    variants: { squadraAngolare: "BASE" },
  };

  /** Prepara i mock perché `ricalcola` arrivi in fondo e la generazione riesca. */
  function preparaRicalcolo(row: unknown = emessa) {
    requestFindFirst.mockResolvedValue(row);
    requestCount.mockResolvedValue(11);
    templateFindFirst.mockResolvedValue({ id: "t1", rules: "artech-ar-legno", isActive: true });
    // Ogni codice risolve: al router serve che il motore non sollevi, non i
    // prezzi veri (quelli li asserisce il gate su catalogo reale).
    productFindMany.mockImplementation(({ where }: { where: { agbCode: { in: string[] } } }) =>
      Promise.resolve(
        where.agbCode.in.map((agbCode, i) => ({
          id: `p${i}`,
          agbCode,
          name: agbCode,
          basePrice: new Prisma.Decimal("1.00"),
        })),
      ),
    );
    const creata = { id: "k2", requestNumber: "KIT-2026-0012" };
    requestCreate.mockResolvedValue(creata);
    transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        kitRequest: { create: requestCreate, updateMany: requestUpdateMany },
      }),
    );
    return creata;
  }

  it("senza `variants` la nuova versione eredita quelle della riga", async () => {
    preparaRicalcolo();
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.ricalcola({ kitRequestId: "k1" });
    expect(requestCreate.mock.calls[0][0].data.variants).toEqual({ squadraAngolare: "BASE" });
  });

  it("con `variants` la nuova versione porta le nuove, non un merge", async () => {
    preparaRicalcolo();
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.ricalcola({
      kitRequestId: "k1",
      variants: { piastrinoAntieffrazione: true },
    });
    // `squadraAngolare` NON sopravvive: una variante che l'agente non vede più
    // a schermo non deve restare nel dato.
    expect(requestCreate.mock.calls[0][0].data.variants).toEqual({
      piastrinoAntieffrazione: true,
    });
  });

  it("`variants: {}` è il reset: scrive NULL, non {}", async () => {
    preparaRicalcolo();
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.ricalcola({ kitRequestId: "k1", variants: {} });
    expect(requestCreate.mock.calls[0][0].data.variants).toBe(Prisma.DbNull);
  });

  it("un blocco che si pota a vuoto scrive NULL, non {}", async () => {
    preparaRicalcolo();
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.ricalcola({
      kitRequestId: "k1",
      variants: { piastrinoAntieffrazione: false },
    });
    expect(requestCreate.mock.calls[0][0].data.variants).toBe(Prisma.DbNull);
  });

  // IL TEST CHE CONTA: la validazione sta PRIMA di qualunque scrittura.
  // `COMPENSATORE` non è pubblicata a listino per l'interasse 8,5 (è il cliente
  // MC): il modulo solleva. Se il rifiuto arrivasse dopo, resterebbe una
  // richiesta superata che punta a una riga non generabile, e la vecchia
  // sarebbe congelata (sia `generate` sia `ricalcola` la rifiutano).
  it("una variante non disponibile per quella geometria è rifiutata SENZA scrivere", async () => {
    preparaRicalcolo({ ...emessa, geometry: "A4_I85_B15", variants: null });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.ricalcola({ kitRequestId: "k1", variants: { squadraAngolare: "COMPENSATORE" } }),
    ).rejects.toThrow(/non disponibile|non la pubblica/);
    expect(requestCreate).not.toHaveBeenCalled();
    expect(requestUpdateMany).not.toHaveBeenCalled();
  });

  it("su una bozza scrive sulla stessa riga: nessuna versione, nessun numero consumato", async () => {
    preparaRicalcolo({ ...emessa, status: "DRAFT" });
    requestUpdate.mockResolvedValue({});
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const out = await caller.kit.ricalcola({
      kitRequestId: "k1",
      variants: { piastrinoAntieffrazione: true },
    });
    expect(out).toEqual({ id: "k1", requestNumber: "KIT-2026-0007" });
    expect(requestUpdate).toHaveBeenCalledWith({
      where: { id: "k1" },
      data: { variants: { piastrinoAntieffrazione: true } },
    });
    expect(requestCreate).not.toHaveBeenCalled();
  });

  // Il ramo TOUR non ha varianti: `kitInputFromRequest` non le proporrebbe
  // nemmeno al parse, quindi senza questo rifiuto verrebbero raccolte,
  // persistite e MAI LETTE — l'ottava occorrenza del difetto storico.
  it("su una richiesta TOUR le varianti sono rifiutate, con la serie nel messaggio", async () => {
    preparaRicalcolo({
      ...emessa,
      series: "TOUR",
      windowType: "BILICO",
      geometry: null,
      entrata: null,
      tourSchema: 2,
      variants: null,
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.ricalcola({ kitRequestId: "k1", variants: { piastrinoAntieffrazione: true } }),
    ).rejects.toThrow(/TOUR/);
    expect(requestCreate).not.toHaveBeenCalled();
  });

  it("una chiave sconosciuta è rifiutata dallo schema", async () => {
    preparaRicalcolo();
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      // @ts-expect-error — chiave inesistente: deve fermarsi allo schema
      caller.kit.ricalcola({ kitRequestId: "k1", variants: { squadraAngolareX: "BASE" } }),
    ).rejects.toThrow();
    expect(requestCreate).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: eseguire e verificare che falliscano**

```bash
pnpm vitest run src/server/api/routers/kit.test.ts
```
Atteso: FAIL sui nuovi test (`variants` non è nell'input di `ricalcola`).

- [ ] **Step 3: implementare**

In `src/server/api/routers/kit.ts`, aggiungere agli import:

```ts
import { componiVarianti, variantiSchema } from "@/server/kit/varianti-schema";
```

Cambiare la firma di `ricalcola`:

```ts
  ricalcola: agentProcedure
    .input(
      z.object({
        kitRequestId: z.string().min(1),
        /**
         * Assente = eredita verbatim (comportamento storico). Presente =
         * SOSTITUISCE integralmente, mai un merge: una variante che l'agente
         * non vede più a schermo non deve sopravvivere nel dato. `{}` è il
         * reset esplicito allo standard, e non è un valore inventato per
         * l'occasione — le 5 chiavi sono tutte `.optional()` dentro uno
         * `.strict()`, quindi `{}` era già valido e già significava «nessuna
         * variante». Senza dichiararlo, accendere l'antieffrazione sarebbe
         * stata un'operazione a senso unico.
         */
        variants: variantiSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
```

Subito **dopo** il `if (!request) throw …NOT_FOUND…` e **prima** delle guardie di stato,
inserire:

```ts
      const sostituisce = input.variants !== undefined;

      // Il ramo TOUR non ha varianti (`kitInputSchema` è un'unione discriminata
      // su `series` e il ramo bilico non le dichiara). Senza questo rifiuto
      // `kitInputFromRequest` non le proporrebbe nemmeno al parse: verrebbero
      // raccolte, persistite e mai lette da nessun modulo — il difetto che
      // questo progetto ha già pagato sette volte.
      if (sostituisce && request.series === "TOUR")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "La serie TOUR non ha varianti componente: la richiesta ne porta, ma nessuna " +
            "riga di distinta le userebbe.",
        });

      // `undefined` = eredita; `null` = reset esplicito → NULL a DB.
      // Si pota PRIMA di scrivere: `{}` sulla colonna sarebbe uno standard
      // materializzato dove una richiesta identica creata da zero scrive NULL —
      // due righe indistinguibili sul serramento, diverse a DB.
      const variantiFinali: Prisma.InputJsonValue | null | undefined = sostituisce
        ? ((componiVarianti(input.variants!) as Prisma.InputJsonValue | undefined) ?? null)
        : undefined;

      // VALIDAZIONE PRIMA DI QUALUNQUE SCRITTURA. Le varianti disponibili
      // dipendono dalla geometria (per l'interasse 8,5 il listino pubblica due
      // squadre angolari su quattro; per l'aria 4 le viti dritte non esistono),
      // e il controllo vive nei moduli, che sollevano `KitGenerationError`.
      // Eseguire il motore in memoria È la validazione: non c'è un secondo
      // validatore che possa disallinearsi dalle tabelle dei codici.
      // Se arrivasse dopo, resterebbe una richiesta superata che punta a una
      // riga non generabile, e la vecchia sarebbe congelata: `generate` e
      // `ricalcola` la rifiutano entrambi.
      if (sostituisce) {
        const prova = (() => {
          try {
            return kitInputFromRequest({ ...request, variants: variantiFinali });
          } catch (error) {
            return toTRPC(error);
          }
        })();
        await new KitEngine(ctx.db).generate(prova).catch(toTRPC);
      }
```

Nel ramo `DRAFT`, sostituire il `return` immediato con:

```ts
      if (request.status === "DRAFT") {
        // Su una bozza non c'è nulla di emesso da proteggere: le nuove varianti
        // si scrivono sulla riga esistente e il `generate` successivo rifà la
        // distinta in loco. Nessuna versione, nessun numero KIT- consumato — è
        // la stessa ragione per cui «Rigenera» riscrive in loco.
        if (variantiFinali !== undefined)
          await ctx.db.kitRequest.update({
            where: { id: request.id },
            data: { variants: variantiFinali ?? Prisma.DbNull },
          });
        return { id: request.id, requestNumber: request.requestNumber };
      }
```

Infine, dentro `tx.kitRequest.create`, sostituire la riga delle varianti con:

```ts
            // Assente in input = la nuova versione eredita: ricalcolare non è
            // rinegoziare la configurazione. Presente = l'agente l'ha appena
            // scelta nel passo «Componenti».
            variants: (variantiFinali ?? request.variants) ?? Prisma.DbNull,
```

- [ ] **Step 4: eseguire i test e verificare che passino**

```bash
pnpm vitest run src/server/api/routers/kit.test.ts
pnpm typecheck && pnpm lint
```
Atteso: tutti verdi, nessun warning di lint.

- [ ] **Step 5: verificare che il golden non si sia mosso**

```bash
docker ps
set -a; source .env; set +a
INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm vitest run src/server/kit/engine.integration.test.ts
```
Atteso: 11 passed. `90,20 €`, `96,29 €`, `110,13 €` invariati.

- [ ] **Step 6: commit**

```bash
git add src/server/api/routers/kit.ts src/server/api/routers/kit.test.ts
git commit -m "feat(kit): ricalcola accetta variants — assente eredita, {} resetta

La validazione sta PRIMA di ogni scrittura, ed è il motore eseguito in memoria:
le varianti disponibili dipendono dalla geometria e il controllo vive nei
moduli, quindi un secondo validatore avrebbe potuto disallinearsi dalle tabelle
dei codici. Se il rifiuto arrivasse dopo, resterebbe una richiesta superata che
punta a una riga non generabile — e congelata, perché generate e ricalcola la
rifiutano entrambi.

Su DRAFT si scrive sulla stessa riga: niente versione, niente numero consumato.
Su TOUR le varianti sono rifiutate con la serie nel messaggio: il ramo non le
dichiara, quindi verrebbero persistite e mai lette."
```

---

## Task 4 — `ComponentiRibalta` esce dal wizard

**Files:**
- Create: `src/components/kit/componenti-ribalta.tsx`
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`

**Interfaces:**
- Produce: `export function ComponentiRibalta(props)` con **la stessa identica firma** che
  ha oggi dentro `nuova-client.tsx` (`geometry`, `entrata`, `openingSide`, `varianti`,
  `set`, e le altre già presenti). Il Task 5 la monta anche in modalità modifica.

Puro spostamento: **nessun cambiamento di comportamento**, nessun test nuovo. È debito già
dichiarato dalla #47 (`nuova-client.tsx` è a ~1.980 righe, di cui ~330 sono questo passo).
Si fa **ora** e non dopo perché il Task 5 monta questo componente in un secondo contesto:
lasciarlo dentro il file del wizard significherebbe importare il wizard da sé stesso.

- [ ] **Step 1: fotografare il comportamento attuale**

```bash
pnpm vitest run "src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx"
```
Annotare il numero di test passati: dopo lo spostamento **deve essere identico**.

- [ ] **Step 2: spostare**

Creare `src/components/kit/componenti-ribalta.tsx` con `"use client";` in testa e
spostarci **tali e quali**: `ComponentiRibalta`, `GruppoVarianti`, `RadioOption` (se usata
solo lì; se serve anche al wizard, esportarla da qui e importarla nel wizard),
`statoAntieffrazione`, `contaAntieffrazione`, `PrezzoVariante` e ogni helper usato solo da
questo passo. Esportare `ComponentiRibalta` e `statoAntieffrazione` (quest'ultima ha già
un test proprio).

In `nuova-client.tsx`, cancellare le definizioni spostate e importare:

```ts
import { ComponentiRibalta } from "@/components/kit/componenti-ribalta";
```

- [ ] **Step 3: verificare che nulla sia cambiato**

```bash
pnpm typecheck && pnpm lint
pnpm test
```
Atteso: **lo stesso numero di test passati** dello Step 1, e la suite intera verde. Se un
test di `nuova-client.test.tsx` fallisce, lo spostamento non è stato puro: confrontare il
diff e ripristinare, non «aggiustare» il test.

- [ ] **Step 4: commit**

```bash
git add src/components/kit/componenti-ribalta.tsx "src/app/(dashboard)/richieste/nuova/nuova-client.tsx"
git commit -m "refactor(kit): ComponentiRibalta in src/components/kit, puro spostamento

Debito dichiarato dalla #47. Si chiude ora perché il prossimo commit monta
questo passo in un secondo contesto (il wizard in modalità modifica): lasciarlo
dentro nuova-client.tsx significherebbe importare il wizard da sé stesso.
Nessun cambiamento di comportamento: stesso numero di test verdi."
```

---

## Task 5 — Il wizard in modalità modifica

**Files:**
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`
- Modify: `src/app/(dashboard)/richieste/nuova/page.tsx`
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`

**Interfaces:**
- Consuma: `kit.ricalcola({kitRequestId, variants})` (Task 3), `ComponentiRibalta`
  (Task 4), `kitInputFromRequest` (esistente), `kit.get` (esistente).
- Produce: la rotta `/richieste/nuova?da=<id>`, che il Task 6 collega dalla scheda.

- [ ] **Step 1: scrivere i test (rossi)**

In `nuova-client.test.tsx` (idiomi del file: `fireEvent`, tRPC mockata a livello di
modulo, **niente `jest-dom`** — solo `toBeTruthy`/`toBeNull`/`.textContent`):

```ts
  it("in modalità modifica idrata dalla richiesta e mostra le specifiche congelate", async () => {
    // `kit.get` restituisce la riga: la geometria e l'entrata devono comparire
    // come TESTO (non come radio selezionabili).
    kitGetData = { ...rigaEmessa };
    render(<NuovaRichiestaClient daId="k1" />);
    const testo = document.body.textContent ?? "";
    expect(testo.includes("Aria 12 · interasse 13 · battuta 20")).toBe(true);
    expect(testo.includes("KIT-2026-0007")).toBe(true);
    // La via d'uscita è scritta, non lasciata indovinare.
    expect(/richiesta nuova/i.test(testo)).toBe(true);
    expect(screen.queryByRole("radio", { name: /Aria 12/i })).toBeNull();
  });

  it("in modalità modifica il conferma chiama ricalcola con le varianti scelte", async () => {
    kitGetData = { ...rigaEmessa, variants: null };
    ricalcolaMutate.mockResolvedValue({ id: "k2", requestNumber: "KIT-2026-0012" });
    generateMutate.mockResolvedValue({});
    render(<NuovaRichiestaClient daId="k1" />);

    fireEvent.click(screen.getByRole("radio", { name: /^Antieffrazione$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /Genera nuova versione/i }));

    await waitFor(() => expect(ricalcolaMutate).toHaveBeenCalled());
    expect(ricalcolaMutate.mock.calls[0][0].kitRequestId).toBe("k1");
    expect(ricalcolaMutate.mock.calls[0][0].variants.piastrinoAntieffrazione).toBe(true);
    // `kit.create` NON deve essere toccata: modificare non è creare.
    expect(createMutate).not.toHaveBeenCalled();
  });

  // Se `ricalcola` partisse all'apertura, chi cambia idea e chiude la scheda
  // lascerebbe la vecchia richiesta superata e congelata, puntando a una bozza
  // vuota.
  it("aprire la modifica non chiama ricalcola", () => {
    kitGetData = { ...rigaEmessa };
    render(<NuovaRichiestaClient daId="k1" />);
    expect(ricalcolaMutate).not.toHaveBeenCalled();
  });

  it("se la riga non è rileggibile dal motore, mostra il rifiuto e non offre il conferma", () => {
    // `geometry: null` è una riga scritta prima del cutover della geometria:
    // `kitInputFromRequest` la rifiuta, e nessuno può indovinarla.
    kitGetData = { ...rigaEmessa, geometry: null };
    render(<NuovaRichiestaClient daId="k1" />);
    expect(screen.getByRole("alert").textContent).toMatch(/incoerente/i);
    expect(screen.queryByRole("button", { name: /Genera nuova versione/i })).toBeNull();
  });
```

- [ ] **Step 2: eseguire e verificare che falliscano**

```bash
pnpm vitest run "src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx"
```
Atteso: FAIL — `NuovaRichiestaClient` non accetta `daId`.

- [ ] **Step 3: implementare**

`page.tsx` legge il parametro e lo passa (in Next 15 `searchParams` è una Promise):

```tsx
export default async function NuovaRichiestaPage({
  searchParams,
}: {
  searchParams: Promise<{ da?: string }>;
}) {
  const { da } = await searchParams;
  return <NuovaRichiestaClient daId={da} />;
}
```

In `nuova-client.tsx`:

```tsx
export function NuovaRichiestaClient({ daId }: { daId?: string }) {
  const modifica = Boolean(daId);
  const partenza = api.kit.get.useQuery({ id: daId! }, { enabled: modifica });
```

L'idratazione passa dalla **stessa** funzione del motore — è il punto per cui non esiste
un secondo percorso di lettura:

```tsx
  /**
   * L'input di partenza NON si ricava rileggendo le colonne a mano: sarebbe una
   * SECONDA ricostruzione, parallela a quella che `kit.generate` e
   * `kit.ricalcola` fanno con `kitInputFromRequest`. Se le due divergessero —
   * un campo aggiunto dopo, un NULL interpretato diversamente — l'agente
   * vedrebbe a schermo una configurazione che la riga non codifica, e la
   * confermerebbe. Nessun test se ne accorgerebbe.
   *
   * `from-request.ts` è importabile dal client: solo `engine.ts` porta
   * `server-only`.
   */
  const idratato = useMemo(() => {
    if (!partenza.data) return null;
    try {
      return { input: kitInputFromRequest(partenza.data), errore: null as string | null };
    } catch (error) {
      return {
        input: null,
        errore: error instanceof Error ? error.message : "Richiesta non rileggibile.",
      };
    }
  }, [partenza.data]);

  useEffect(() => {
    if (idratato?.input) setForm(idratato.input as FormValues);
  }, [idratato]);
```

I passi in modalità modifica sono **due** (vedi «Due decisioni di struttura»):

```tsx
  const labels = modifica ? (["Componenti", "Riepilogo"] as const) : stepLabels(form.series);
```

La scheda delle specifiche congelate, in testa al form quando `modifica` è vero — dice
**cosa** è fermo, **perché**, e **dove** si va per cambiarlo:

```tsx
/**
 * Si alimenta dall'input GIÀ RICOSTRUITO da `kitInputFromRequest`, non dalla riga
 * grezza. Due ragioni, e la seconda è quella che conta:
 * - i tipi tornano da soli (`geometriaLabel` vuole un `ArtechGeometryId`, la
 *   colonna è `string | null`): niente cast, niente `??` di comodo;
 * - leggere qui le colonne sarebbe di nuovo una SECONDA lettura, cioè
 *   esattamente ciò che questa modalità è costruita per non avere.
 */
function SpecificheCongelate({
  input,
  requestNumber,
}: {
  input: ArtechKitInput;
  requestNumber: string;
}) {
  return (
    <div className="mb-6 rounded-md border border-line bg-surface-sunken p-4">
      <p className="text-sm text-ink">
        Stai cambiando i componenti di{" "}
        <span className="font-mono font-semibold">{requestNumber}</span>. Al conferma
        nascerà una nuova versione con un numero nuovo, e questa smetterà di valere.
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <SummaryItem label="Dimensioni" value={`${input.widthMm} × ${input.heightMm} mm`} />
        <SummaryItem label="Geometria" value={geometriaLabel(input.geometry)} />
        <SummaryItem label="Entrata maniglia" value={entrataLabel(input.entrata)} />
        <SummaryItem label="Mano" value={hingeSideLabel(input.openingSide)} />
        <SummaryItem label="Finitura" value={input.finish} />
        <SummaryItem
          label="Chiusure supplementari"
          value={input.supplementaryClosures ? "Sì" : "No"}
        />
      </dl>
      <p className="mt-3 text-xs text-ink-subtle">
        Quote, geometria ed entrata non si cambiano qui: cambiarle vuol dire un altro
        serramento, quindi una <strong>richiesta nuova</strong>.
      </p>
    </div>
  );
}
```

Il `requestNumber` è l'**unico** dato che la scheda prende dalla riga e non dall'input
ricostruito, perché non è un dato del motore: `kitInputSchema` non lo contiene.

> **Sul test `prefill(row) === fromRequest(row)` chiesto dalla spec §6:** qui diventa
> superfluo *per costruzione*, ed è il risultato migliore. Il prefill **è**
> `kitInputFromRequest`: non esistono due funzioni che possano divergere, quindi non c'è
> un'uguaglianza da sorvegliare. Ciò che resta da provare è che il wizard la usi davvero e
> che rifiuti una riga irrileggibile — i due test dello Step 1.

Il conferma chiama `ricalcola` e poi `generate`, con la stessa forma di `handleGenera`
(l'errore di generazione non blocca la navigazione: la riga esiste ed è `DRAFT`):

```tsx
  async function handleNuovaVersione() {
    setSubmitError(null);
    const varianti = componiVarianti((form as ArtechFormValues).variants ?? {}) ?? {};
    let id: string;
    try {
      // `{}` non è un caso da evitare: è il reset esplicito allo standard.
      const nuova = await ricalcola.mutateAsync({ kitRequestId: daId!, variants: varianti });
      id = nuova.id;
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Errore durante il ricalcolo.",
      );
      return;
    }
    try {
      await generate.mutateAsync({ kitRequestId: id });
    } catch {
      /* visibile sulla scheda nuova: DRAFT + «Rigenera» */
    } finally {
      router.push(`/richieste/${id}`);
    }
  }
```

Il pulsante finale cambia etichetta e destinazione in modalità modifica:

```tsx
        ) : (
          <Button
            onClick={() => void (modifica ? handleNuovaVersione() : handleGenera())}
            loading={isSubmitting}
          >
            {modifica ? "Genera nuova versione" : "Genera kit"}
          </Button>
        )}
```

Se `idratato.errore` è valorizzato, il form non si monta: si mostra il messaggio del
motore in un `role="alert"` e un link a `/richieste/{daId}`, **senza** il pulsante di
conferma. Una riga che il motore non sa rileggere non si modifica: si rifà.

- [ ] **Step 4: eseguire i test e verificare che passino**

```bash
pnpm vitest run "src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx"
pnpm typecheck && pnpm lint
```
Atteso: verdi, compresi **tutti** i test preesistenti del wizard (la modalità creazione
non deve cambiare di una virgola).

- [ ] **Step 5: commit**

```bash
git add "src/app/(dashboard)/richieste/nuova/"
git commit -m "feat(richieste): il wizard si riapre in modifica su ?da=<id>

L'idratazione passa da kitInputFromRequest, la STESSA funzione che usano
kit.generate e kit.ricalcola: un prefill che rileggesse le colonne per conto suo
sarebbe una seconda ricostruzione parallela, e se divergesse l'agente vedrebbe a
schermo una configurazione che la riga non codifica — e la confermerebbe, senza
che alcun test se ne accorga.

In modifica i passi sono DUE (Componenti, Riepilogo) e le specifiche congelate
stanno in una scheda in testa, col motivo e la via d'uscita. Disabilitare i tre
passi avrebbe significato far scendere un flag readOnly dentro ~600 righe di
form per ottenere schermate che l'agente attraversa senza poterci fare nulla.

ricalcola parte SOLO al conferma: partendo all'apertura, chi cambia idea
lascerebbe la vecchia superata e congelata su una bozza vuota."
```

---

## Task 6 — La scheda: «Nuova versione» e «Modifica componenti»

**Files:**
- Modify: `src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx`
- Modify: `src/app/(dashboard)/richieste/[id]/dettaglio-client.test.tsx`

**Interfaces:**
- Consuma: la rotta `/richieste/nuova?da=<id>` (Task 5).

- [ ] **Step 1: scrivere i test (rossi)**

```ts
  it("il pulsante si chiama «Nuova versione», non «Ricalcola»", () => {
    render(<DettaglioClient id="k1" />);   // richiesta COMPLETED, non superata
    expect(screen.getByRole("button", { name: /Nuova versione/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Ricalcola$/i })).toBeNull();
  });

  it("«Modifica componenti» porta al wizard sulla richiesta", () => {
    render(<DettaglioClient id="k1" />);
    const link = screen.getByRole("link", { name: /Modifica componenti/i });
    expect(link.getAttribute("href")).toBe("/richieste/nuova?da=k1");
  });

  it("su una bozza «Modifica componenti» c'è comunque", () => {
    // È proprio il caso in cui la generazione è fallita e l'agente vuole
    // cambiare qualcosa.
    kitGetData = { ...bozza };
    render(<DettaglioClient id="k1" />);
    expect(screen.getByRole("link", { name: /Modifica componenti/i })).toBeTruthy();
  });

  it("su una riga superata non si offre nulla da modificare", () => {
    kitGetData = { ...superata, supersededById: "k2" };
    render(<DettaglioClient id="k1" />);
    expect(screen.queryByRole("link", { name: /Modifica componenti/i })).toBeNull();
  });

  it("il bilico non offre «Modifica componenti»: la serie non ha varianti", () => {
    kitGetData = { ...bozza, series: "TOUR", windowType: "BILICO" };
    render(<DettaglioClient id="k1" />);
    expect(screen.queryByRole("link", { name: /Modifica componenti/i })).toBeNull();
  });
```

- [ ] **Step 2: eseguire e verificare che falliscano**

```bash
pnpm vitest run "src/app/(dashboard)/richieste/[id]/dettaglio-client.test.tsx"
```

- [ ] **Step 3: implementare**

Rinominare l'etichetta del pulsante esistente da `Ricalcola` a `Nuova versione`, con il
commento che spiega perché:

```tsx
  {/* «Ricalcola» prometteva «rifai lo stesso conto»: il pulsante invece emette
      un documento con un numero NUOVO e congela questo. L'agente deve poter
      prevedere l'esito prima di premere. */}
  Nuova versione
```

Aggiungere accanto il link alla modifica, visibile solo dove ha senso:

```tsx
  // Le varianti esistono solo sul ramo ARTECH: il modulo TOUR dichiara
  // `varianti: []` e il router rifiuta. Offrire il link su un bilico sarebbe
  // un pulsante che porta a una schermata senza scelte.
  const puoModificareComponenti = r.supersededById === null && r.series !== "TOUR";
```

```tsx
  {puoModificareComponenti && (
    <Link
      href={`/richieste/nuova?da=${r.id}`}
      className="inline-flex items-center gap-1.5 rounded border border-line-strong px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
    >
      <SlidersHorizontal className="size-4" aria-hidden /> Modifica componenti
    </Link>
  )}
```

- [ ] **Step 4: eseguire e verificare che passino**

```bash
pnpm vitest run "src/app/(dashboard)/richieste/[id]/dettaglio-client.test.tsx"
pnpm typecheck && pnpm lint && pnpm test
```
Atteso: suite intera verde.

- [ ] **Step 5: commit**

```bash
git add "src/app/(dashboard)/richieste/[id]/"
git commit -m "feat(richieste): «Nuova versione» al posto di «Ricalcola», e «Modifica componenti»

«Ricalcola» prometteva «rifai lo stesso conto»: il pulsante emette un documento
con un numero nuovo e congela il precedente. Il link alla modifica non compare
sul bilico (il modulo TOUR dichiara varianti: [] e il router rifiuta) né su una
riga superata; compare invece sulle bozze, che è il caso in cui la generazione è
fallita e l'agente vuole cambiare qualcosa."
```

---

## Task 7 — Verifica browser, desktop e 375px

**Files:** nessuno (o correzioni emerse dagli screenshot).

Regola inviolabile del progetto: **ogni schermata si verifica anche a ≤375px**, e gli
screenshot si **guardano**, non si contano i verdi.

- [ ] **Step 1: preparare Playwright fuori dal repo**

```bash
mkdir -p /tmp/pw && cd /tmp/pw && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright
```
Chromium è già in `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. **Non** aggiungere
`playwright` a `package.json`.

- [ ] **Step 2: avviare l'app con il DB reale**

```bash
docker ps   # rialzare se serve
cd /home/user/AGB-Finder && rm -rf .next
set -a; source .env; set +a; pnpm dev
```
(`pnpm build` scrive nella stessa `.next` del dev server: non lanciarli insieme.)

- [ ] **Step 3: percorrere e guardare**

A **1440px** e a **375px**, con screenshot per ogni schermata:
1. Creare un'anta-ribalta `550×1820 / A12_I13_B20 / E15 / sinistra / chiusure ON`
   **senza** antieffrazione → attesi `16 righe / 21 pezzi / 90,20 €`.
2. Dalla scheda: il pulsante dice **«Nuova versione»**; c'è **«Modifica componenti»**.
3. «Modifica componenti» → il wizard si apre al passo **«Componenti»**, la scheda in testa
   nomina `KIT-2026-…` e mostra quote, geometria, entrata, mano, chiusure; **non** ci sono
   radio per la geometria.
4. Accendere **Antieffrazione** → «Genera nuova versione» → attesi
   **`17 righe / 22 pezzi / 110,13 €`, zero warning**, su una richiesta con **numero
   nuovo**; tornando alla vecchia, dice che è stata ricalcolata.
5. Rifare il giro **spegnendo** l'antieffrazione → si torna a `90,20 €` (è il reset `{}`,
   la prova che l'operazione non è a senso unico).
6. A 375px: **nessuno scroll orizzontale** in nessuna delle schermate toccate.

- [ ] **Step 4: commit di eventuali correzioni**

Se gli screenshot mostrano un difetto, correggerlo con un commit dedicato che lo nomina.
Se non emerge nulla, non c'è commit: la verifica si riporta nella descrizione della PR.

---

## Task 8 — Documentazione

**Files:**
- Modify: `handoff.md`, `CLAUDE.md`
- Modify: `docs/superpowers/kit-assunzioni/DOMANDE-APERTE.md`

- [ ] **Step 1: la domanda nuova**

In `DOMANDE-APERTE.md`, aggiungere una domanda (numero successivo all'ultimo presente):

> **Il numero di richiesta identifica la richiesta o la versione?**
> Oggi `kit.ricalcola` conia un numero nuovo a ogni versione e `count()` include le righe
> superate, quindi `KIT-2026-0042` e `KIT-2026-0043` possono essere **lo stesso
> serramento**. Finché il ricalcolo era raro la cosa non si vedeva; con le varianti
> modificabili diventa un'operazione ordinaria. L'alternativa — `KIT-2026-0007 v2`, numero
> stabile per commessa più una colonna `version` — cambia ciò che l'agente scrive al
> cliente, quindi **la decide l'ufficio commerciale**, non il codice.
> *Portata al council il 2026-08-01, tenuta fuori dalla PR di proposito.*

- [ ] **Step 2: i debiti**

In `handoff.md`, sostituire la voce «le varianti non si cambiano dopo la creazione» (che
questa PR chiude) e aggiungere:

> - **`requestNumber` è coniato con `count()+1` su una colonna `@unique`** (`kit.ts:47-50`
>   e `219-222`): due richieste create nello stesso istante collidono → 500 all'agente,
>   nessuna corruzione, il riprova funziona. Verificato il 2026-08-01 che **non** esiste
>   alcun `kitRequest.delete`/`deleteMany` e che nessun `onDelete: Cascade` punta a
>   `KitRequest`, quindi lo scenario «collisione deterministica dopo una cancellazione»
>   **oggi non è raggiungibile**. Attenzione: il retry «da cinque righe» **non funziona**
>   — in `ricalcola` il `count()` sta fuori dalla `$transaction` e la `create` dentro, e un
>   `P2002` aborta l'intero callback, `updateMany` compreso.

- [ ] **Step 3: stato e sintesi**

Aggiornare la sezione «Sessione attuale» di `handoff.md` e lo `## STATO` di `CLAUDE.md`
con: cosa fa la feature, il contratto (`assente`/`{}`/oggetto), il fatto che
**non ci sono migrazioni né azioni ops**, i totali del gate ora asseriti
(`90,20` · `96,29` · `110,13` · `450,03` · `766,51` · `433,46`), e i numeri dei gate.

- [ ] **Step 4: commit**

```bash
git add handoff.md CLAUDE.md docs/superpowers/kit-assunzioni/DOMANDE-APERTE.md
git commit -m "docs: varianti modificabili dopo la creazione, e la domanda sul numero di richiesta"
```

---

## Chiusura

- [ ] `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` tutti verdi
- [ ] gate su catalogo reale eseguito **non a vuoto** (11 test in `engine.integration`)
- [ ] golden invariato: `16 / 21 / 90,20 €` · gemello `96,29 €` · antieffrazione
      `17 / 22 / 110,13 €`
- [ ] verifica browser desktop **e 375px**, screenshot guardati
- [ ] **nessuna migrazione, nessuna azione ops** — da scrivere nella PR
