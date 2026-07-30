# Entrata maniglia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'entrata maniglia smette di essere una costante cablata del motore (`A50122.15.NN`) e diventa un campo dell'input, scelto esplicitamente dall'agente, coperto su entrambi i valori pubblicati per l'anta-ribalta e rifiutato con la ragione dove il listino non lo permette.

**Architecture:** Un campo `entrata` (`"E75" | "E15"`) sul solo ramo ARTECH dell'unione discriminata, **ortogonale** a `geometry`. La tabella `CREMONESI` diventa una mappa per entrata con **codici interi**, mai composti. La riga `kit_requests` porta la colonna, perché la riga a DB *è* l'input di ogni rigenerazione. Vasistas e battente rifiutano l'entrata 7,5, ciascuno per la propria ragione di listino.

**Tech Stack:** TypeScript strict · zod 3 · Prisma 6 / PostgreSQL · tRPC v11 · React 19 / Next 15 (App Router) · Tailwind 3 · Vitest.

**Spec:** `docs/superpowers/specs/2026-07-30-kit-entrata-design.md`

---

## Global Constraints

- **TypeScript strict sempre.** Nessun `any`, nessun `@ts-expect-error` nuovo.
- **Il kit è un engine deterministico TypeScript. MAI un LLM.**
- **Tutte le API via tRPC; tutte le query via Prisma.** Raw SQL solo per pgvector (non tocca questo lavoro) e nelle migrazioni.
- **UI in italiano.** Codici prodotto in font monospace (`font-mono`).
- **Mobile-first**: ogni schermata toccata va verificata a **≤ 375 px** oltre che su desktop.
- **Codici interi, mai composti a runtime.** Vietato `` `A50122.${entrata}.${gr}` ``: per l'entrata 7,5 la vasistas pubblica 6 gruppi e l'anta-ribalta 9, quindi la composizione genererebbe codici inesistenti (`A50111.08.10`).
- **Nessun valore preselezionato per l'entrata.** Deciso dall'utente il 2026-07-30: un default sarebbe lo stesso silenzio di oggi in un posto più visibile.
- **Il golden non si muove:** 550×1820 SX ARGENTO, `supplementaryClosures: true`, `entrata: "E15"` → **16 righe / 21 pezzi / 90,20 €**. Set obbligatorio senza chiusure: **12 righe / 17 pezzi**.
- **Nomenclatura:** `E75` = entrata **7,5** (segue `I85` = interasse 8,5 in `ArtechGeometryId`). Va dichiarato nel commento del tipo: il nome da solo è ambiguo.
- **Riferimenti di listino** sempre nella forma «pagina fisica (stampata)»: `p0424 (422)` cremonesi anta-ribalta · `p0426 (424)` cremonesi vasistas · `p0429 (427)` cremonese battente Mod. 502 · `p0425 (423)` finestre basse.
- **Un commit per task**, messaggio in italiano, corpo che spiega *perché*.
- **Gate a fine di ogni task:** `pnpm typecheck` · `pnpm lint` · `pnpm test`.

---

## File Structure

**Modificati — motore e input**

| File | Responsabilità dopo il lavoro |
|---|---|
| `src/server/kit/types.ts` | Dichiara `ENTRATE`, il tipo `Entrata` e il campo `entrata` sul ramo ARTECH, con messaggio d'errore italiano |
| `src/server/kit/rules-artech-legno.ts` | `CREMONESI` diventa `Record<Entrata, readonly Banda[]>`; l'emissione legge `input.entrata` |
| `src/server/kit/rules-artech-vasistas-legno.ts` | Guardia che rifiuta `E75` citando le due NB di `p0426 (424)` |
| `src/server/kit/rules-artech-battente-legno.ts` | Solo commento: il listino pubblica una sola entrata per la Mod. 502 |
| `src/server/kit/from-request.ts` | `PersistedKitRequest.entrata` e rilettura **senza fallback** |
| `src/server/api/routers/kit.ts` | `entrata` fra le colonne del ramo ARTECH in `create` |
| `prisma/schema.prisma` | `enum Entrata` + `KitRequest.entrata` nullable |
| `prisma/migrations/…_kit_entrata/migration.sql` | Enum, colonna, backfill `E15` sulle righe ARTECH |

**Modificati — UI**

| File | Responsabilità |
|---|---|
| `src/lib/kit-labels.ts` | `ENTRATA_LABELS` / `entrataLabel` — un solo posto per «7,5 mm» e «15 mm» |
| `src/app/(dashboard)/richieste/nuova/nuova-client.tsx` | Il fieldset «Entrata maniglia», senza preselezione, nello step 3 e nel riepilogo |
| `src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx` | Riga «Entrata maniglia» nelle specifiche |

**Modificati — test**

`types.test.ts` · `rules-artech-legno.test.ts` · `rules-artech-vasistas-legno.test.ts` · `rules-artech-battente-legno.test.ts` · `rules-artech-pvc.test.ts` · `rules-artech-alu.test.ts` · `rules-tour-bilico-legno.test.ts` · `engine.test.ts` · `engine.integration.test.ts` · `from-request.test.ts` · `no-silent-fields.test.ts` · `codici-a-listino.integration.test.ts` · `src/server/api/routers/kit.test.ts` · `nuova-client.test.tsx` · `dettaglio-client.test.tsx` · `richieste-client.test.tsx`

**Modificati — documentazione**

`docs/superpowers/kit-assunzioni/DOMANDE-APERTE.md` · `docs/superpowers/kit-assunzioni/legno.md` · `docs/superpowers/kit-assunzioni/vasistas.md`

---

## Ordine dei task e perché è questo

Il Task 1 è più grande degli altri e non si può spezzare: `from-request.ts` ricostruisce l'input **rileggendo la riga**, quindi lo schema zod, la colonna Prisma e la rilettura devono atterrare insieme o la suite non è verde in nessun punto intermedio. Il suo risultato è verificabile e vale una revisione a sé: *il campo esiste, viene trasportato end-to-end, e non cambia nulla*. Dal Task 2 in poi ogni task è piccolo.

| # | Task | Deliverable |
|---|---|---|
| 1 | Il campo esiste end-to-end, inerte | Schema, colonna, migrazione, rilettura, router. Golden invariato |
| 2 | La cremonese si sceglie per entrata | L'entrata inizia a contare. Nasce il golden gemello |
| 3 | Vasistas rifiuta, battente documentato | I due rifiuti, con la ragione di listino |
| 4 | `no-silent-fields` + esaustività | Impossibile ricadere, ora e in futuro |
| 5 | Gate su catalogo reale × 2 entrate | 28 combinazioni, zero codici orfani |
| 6 | Il wizard chiede l'entrata, senza default | La scelta esplicita |
| 7 | Riepilogo, scheda richiesta, etichette | L'entrata è visibile dove si legge la richiesta |
| 8 | Documentazione | Domanda 27 e schede aggiornate |

---

### Task 1: Il campo esiste end-to-end, e non cambia nulla

**Files:**
- Modify: `src/server/kit/types.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_kit_entrata/migration.sql`
- Modify: `src/server/kit/from-request.ts`
- Modify: `src/server/api/routers/kit.ts:29-35`
- Test: `src/server/kit/types.test.ts`, `src/server/kit/from-request.test.ts`
- Modify (letterali `KitInput`, aggiunta di `entrata: "E15"`): `src/server/kit/engine.test.ts`, `engine.integration.test.ts`, `rules-artech-legno.test.ts`, `rules-artech-vasistas-legno.test.ts`, `rules-artech-battente-legno.test.ts`, `rules-artech-pvc.test.ts`, `rules-artech-alu.test.ts`, `no-silent-fields.test.ts`, `codici-a-listino.integration.test.ts`, `src/server/api/routers/kit.test.ts`, `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`

**Interfaces:**
- Produces: `ENTRATE: readonly ["E75", "E15"]` e `type Entrata = "E75" | "E15"` esportati da `src/server/kit/types.ts`; `ArtechKitInput.entrata: Entrata`; `PersistedKitRequest.entrata: string | null`; colonna Prisma `KitRequest.entrata: Entrata?`.

- [ ] **Step 1: Scrivere i test falliti sullo schema**

In `src/server/kit/types.test.ts`, dentro `describe("kitInputSchema", …)`:

```ts
it("il ramo ARTECH esige l'entrata: senza, rifiuta con un messaggio italiano", () => {
  const { entrata: _omessa, ...senzaEntrata } = golden;
  const result = kitInputSchema.safeParse(senzaEntrata);
  expect(result.success).toBe(false);
  if (!result.success)
    expect(result.error.issues[0]?.message).toBe("Scegli l'entrata maniglia (7,5 o 15 mm).");
});

it("accetta entrambe le entrate pubblicate e rifiuta qualunque altra", () => {
  for (const entrata of ["E75", "E15"] as const)
    expect(kitInputSchema.safeParse({ ...golden, entrata }).success).toBe(true);
  expect(kitInputSchema.safeParse({ ...golden, entrata: "E0" }).success).toBe(false);
});
```

E dentro `describe("kitInputSchema — ramo TOUR", …)`:

```ts
it("scarta l'entrata da un input TOUR invece di persistirla", () => {
  const parsed = kitInputSchema.parse({ ...bilico, entrata: "E15" });
  expect("entrata" in parsed).toBe(false);
});
```

`golden` e `bilico` sono le costanti già presenti in quel file: **non crearne di nuove**. A `golden` va aggiunto `entrata: "E15"` (Step 4).

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `pnpm test src/server/kit/types.test.ts`
Expected: FAIL — il primo test passa per la ragione sbagliata (nessun campo `entrata` esiste, quindi l'errore riportato è un altro), il secondo fallisce perché `entrata: "E0"` viene accettato e scartato come campo estraneo.

- [ ] **Step 3: Aggiungere il campo allo schema**

In `src/server/kit/types.ts`, subito prima di `const COMMON`:

```ts
/**
 * Entrata maniglia. **Due valori**, non tre: a `p0424 (422)` la colonna ENTRATA
 * è etichettata `1) 7,5` · `2) 15` · `3) Asta*`, e la terza NON è un'entrata ma
 * la versione ad asta — «nella versione asta non sono presenti il DSS e il
 * monoblocco martellina». Che la quota sia quella della maniglia lo dice la NB
 * della stessa pagina: «monoblocco martellina sostituibile per variare
 * l'entrata maniglia».
 *
 * `E75` è l'entrata **7,5**, non 75: stessa convenzione di `I85` = interasse 8,5
 * in `ArtechGeometryId`.
 */
export const ENTRATE = ["E75", "E15"] as const;
export type Entrata = (typeof ENTRATE)[number];
```

Dentro `artechInputSchema`, dopo `geometry`:

```ts
  /**
   * Asse ORTOGONALE alla geometria: seleziona la famiglia della cremonese e
   * nient'altro, identicamente in tutte e sette le geometrie. Per questo è un
   * campo e non un valore di `geometry` — dentro il discriminatore avrebbe
   * raddoppiato le righe di `GEOMETRIE` da 7 a 14 per cambiare un codice.
   *
   * NESSUN `.default()`, di proposito. Fino al 2026-07-30 l'entrata era una
   * costante del motore (`A50122.15.NN`) e un serramento a entrata 7,5 riceveva
   * in silenzio il codice sbagliato — che esiste, ha un prezzo e non produce
   * warning. Un default preselezionato sarebbe lo stesso silenzio spostato in un
   * posto più visibile.
   */
  entrata: z.enum(ENTRATE, {
    required_error: "Scegli l'entrata maniglia (7,5 o 15 mm).",
    invalid_type_error: "Scegli l'entrata maniglia (7,5 o 15 mm).",
  }),
```

Il messaggio è esplicito perché il wizard mostra `result.error.issues[0].message` così com'è (`firstIssueMessage` in `nuova-client.tsx`): col testo di default di zod l'agente leggerebbe «Required» in una UI italiana, proprio sul campo che stiamo aggiungendo per farsi capire.

- [ ] **Step 4: Aggiungere `entrata: "E15"` a ogni letterale ARTECH esistente**

`pnpm typecheck` è l'oracolo esaustivo: ogni errore è un letterale `KitInput`/`ArtechKitInput` a cui manca il campo. Il valore è **sempre `"E15"`**, che è ciò che il motore emetteva finora — quindi nessun comportamento cambia.

Run: `pnpm typecheck`

Aggiungere `entrata: "E15",` subito dopo la riga `geometry: …` in ciascun letterale segnalato. I file attesi:

```
src/server/kit/types.test.ts              (golden)
src/server/kit/engine.test.ts             (3 letterali)
src/server/kit/engine.integration.test.ts (3 letterali)
src/server/kit/rules-artech-legno.test.ts (base)
src/server/kit/rules-artech-vasistas-legno.test.ts
src/server/kit/rules-artech-battente-legno.test.ts
src/server/kit/rules-artech-pvc.test.ts
src/server/kit/rules-artech-alu.test.ts
src/server/kit/rules-tour-bilico-legno.test.ts (il letterale ARTECH del rifiuto asTour)
src/server/kit/no-silent-fields.test.ts   (artechBase, vasistasBase)
src/server/kit/codici-a-listino.integration.test.ts (base)
src/server/api/routers/kit.test.ts
src/app/(dashboard)/richieste/nuova/nuova-client.tsx (ARTECH_DEFAULT)
```

In `nuova-client.tsx` il campo va in `ARTECH_DEFAULT` **temporaneamente**, con questo commento — il Task 6 lo toglie:

```ts
  // TEMPORANEO (Task 1 → rimosso dal Task 6): tiene il build verde finché il
  // wizard non chiede l'entrata. Il valore definitivo è «nessun valore».
  entrata: "E15",
```

- [ ] **Step 5: Eseguire i test dello schema**

Run: `pnpm test src/server/kit/types.test.ts`
Expected: PASS

- [ ] **Step 6: Aggiungere la colonna a Prisma**

In `prisma/schema.prisma`, accanto a `enum SeatConfig`:

```prisma
/// Entrata maniglia. Due soli valori pubblicati: p0424 (422) etichetta la colonna
/// ENTRATA come `1) 7,5` e `2) 15`; la terza voce («Asta») è un'altra famiglia,
/// senza DSS né monoblocco martellina, e resta fuori perimetro.
/// E75 = entrata 7,5 (convenzione di ArtechGeometry, dove I85 = interasse 8,5).
enum Entrata {
  E75
  E15
}
```

Dentro `model KitRequest`, subito dopo `seatConfig`:

```prisma
  /// SOLO serie ARTECH — NULL sulle righe TOUR (il bilico ha entrata 30 come
  /// proprietà costruttiva del kit, non come scelta). Nessun `@default` a
  /// livello DB, stesso criterio di `seatConfig`: un default DB valorizzerebbe
  /// anche le righe che non devono averlo. Il backfill è nella migrazione.
  entrata Entrata?
```

- [ ] **Step 7: Generare la migrazione e scriverne il backfill a mano**

Run: `set -a; source .env; set +a; pnpm prisma migrate dev --name kit_entrata --create-only`

Prisma genera solo il DDL. Aprire `prisma/migrations/<timestamp>_kit_entrata/migration.sql` e **aggiungere in fondo** il backfill:

```sql
-- Backfill: fino a oggi l'entrata non era un input ma una COSTANTE del motore,
-- che ha emesso A50122.15.* su ogni distinta ARTECH senza eccezioni. Scrivere
-- E15 su quelle righe non è un'ipotesi: registra la costante che si è applicata.
-- È il caso opposto al backfill della geometria (20260730084816_kit_geometria),
-- dove le colonne legacy potevano dire aria 4 o sede 30 e assumere il pilota
-- avrebbe falsificato dati di produzione.
-- Le righe TOUR restano NULL: quel ramo non ha questo campo.
UPDATE "kit_requests" SET "entrata" = 'E15' WHERE "series" = 'ARTECH';
```

- [ ] **Step 8: Applicare la migrazione e rigenerare il client**

Run: `set -a; source .env; set +a; pnpm prisma migrate deploy && pnpm prisma generate`
Expected: `1 migration applied` e nessun errore di generate.

Se il DB locale non è su: `bash scripts/dev-bootstrap.sh`, poi ripetere.

- [ ] **Step 9: Scrivere il test fallito della rilettura**

In `src/server/kit/from-request.test.ts`:

```ts
it("rilegge l'entrata dalla riga e la consegna al motore", () => {
  const input = kitInputFromRequest({ ...rigaArtech, entrata: "E75" });
  expect(input.series).toBe("ARTECH");
  if (input.series === "ARTECH") expect(input.entrata).toBe("E75");
});

it("rifiuta una riga ARTECH senza entrata invece di assumerne una", () => {
  expect(() => kitInputFromRequest({ ...rigaArtech, entrata: null })).toThrow(
    /entrata/i,
  );
});

it("non pretende l'entrata sulle righe TOUR", () => {
  const input = kitInputFromRequest({ ...rigaTour, entrata: null });
  expect(input.series).toBe("TOUR");
});
```

`rigaArtech` e `rigaTour` sono le costanti già presenti nel file; vanno estese con `entrata: "E15"` e `entrata: null` rispettivamente.

- [ ] **Step 10: Eseguire e verificare il fallimento**

Run: `pnpm test src/server/kit/from-request.test.ts`
Expected: FAIL — `Object literal may only specify known properties, 'entrata' does not exist in type 'PersistedKitRequest'`.

- [ ] **Step 11: Portare l'entrata attraverso la rilettura e la scrittura**

In `src/server/kit/from-request.ts`, dentro `PersistedKitRequest`, dopo `seatConfig`:

```ts
  entrata: string | null;
```

E nel ramo ARTECH di `candidate`, dopo `seatConfig`:

```ts
          // NESSUN `?? "E15"`. `seatConfig` e `openingDir` hanno un default nello
          // schema zod e qui lo si riapplica; l'entrata NON ne ha, di proposito.
          // Il backfill della migrazione ha valorizzato tutte le righe ARTECH
          // esistenti: se ne comparisse una a NULL è un dato rotto e va rifiutata
          // con un messaggio, non tappata con un valore plausibile.
          entrata: row.entrata,
```

In `src/server/api/routers/kit.ts`, nel `branch` del ramo ARTECH, dopo `seatConfig`:

```ts
            entrata: specs.entrata,
```

- [ ] **Step 12: Eseguire l'intera suite**

Run: `pnpm test`
Expected: PASS. Il golden è invariato — **12 righe / 17 pezzi** senza chiusure, **16 / 21** con — perché nessun modulo regole legge ancora `entrata`.

- [ ] **Step 13: Gate completo**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: tutti verdi.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(kit): l'entrata maniglia entra nell'input e nella riga

Campo `entrata` (E75 | E15) sul solo ramo ARTECH, ortogonale alla geometria:
seleziona la famiglia della cremonese e nient'altro, identicamente in tutte e
sette le geometrie. Dentro il discriminatore avrebbe raddoppiato GEOMETRIE da
7 a 14 righe per cambiare un codice.

Nessun `.default()`: fino a oggi l'entrata era una costante del motore e un
serramento a entrata 7,5 riceveva in silenzio il codice della 15 — che esiste,
ha un prezzo e non produce warning.

La colonna atterra insieme allo schema perche` `from-request.ts` ricostruisce
l'input rileggendo la riga: la riga a DB E` l'input di ogni rigenerazione.
Backfill a E15 sulle righe ARTECH — non un'ipotesi, ma la costante di motore
che si e` applicata a quelle righe.

Nessun modulo regole lo legge ancora: il golden resta 12/17 e 16/21."
```

---

### Task 2: La cremonese si sceglie per entrata

**Files:**
- Modify: `src/server/kit/rules-artech-legno.ts:56-70` (tabella `CREMONESI`) e `:207-214` (emissione)
- Test: `src/server/kit/rules-artech-legno.test.ts`

**Interfaces:**
- Consumes: `Entrata` e `ArtechKitInput.entrata` dal Task 1.
- Produces: `CREMONESI: Record<Entrata, readonly { minH: number; maxH: number; code: string }[]>` (non esportata; consumata solo qui).

- [ ] **Step 1: Scrivere i test falliti**

In `src/server/kit/rules-artech-legno.test.ts`, in fondo al file:

```ts
describe("artechAntaRibaltaLegno — entrata maniglia", () => {
  // Le nove bande HBB, i GR e l'altezza maniglia di A50122.08.* e A50122.15.*
  // coincidono riga per riga a p0424 (422): cambia il codice, non la selezione.
  // ATTENZIONE ai valori scelti: le bande si SOVRAPPONGONO e `pick()` risolve
  // prendendo la più stretta, a parità di ampiezza la PRIMA della tabella. Con
  // hbb 2100 le bande [1794,2110] e [1994,2310] hanno la stessa ampiezza (316) e
  // vincerebbe la .08, non la .09. Ogni valore qui sotto cade quindi in **una
  // sola** banda.
  const BANDE: [hbb: number, e15: string, e75: string][] = [
    [700, "A50122.15.02", "A50122.08.02"],
    [900, "A50122.15.03", "A50122.08.03"],
    [1100, "A50122.15.04", "A50122.08.04"],
    [1300, "A50122.15.05", "A50122.08.05"],
    [1500, "A50122.15.06", "A50122.08.06"],
    [1700, "A50122.15.07", "A50122.08.07"],
    [1900, "A50122.15.08", "A50122.08.08"],
    [2150, "A50122.15.09", "A50122.08.09"],
    [2400, "A50122.15.10", "A50122.08.10"],
  ];

  it.each(BANDE)("hbb %i → %s con entrata 15, %s con entrata 7,5", (hbb, e15, e75) => {
    // `base` usa hbb = heightMm - 10 (ASSUNZIONE dichiarata, domanda 10).
    const perEntrata = (entrata: "E15" | "E75") =>
      artechAntaRibaltaLegno
        .generate({ ...base, heightMm: hbb + 10, entrata })
        .find((l) => l.position === "cremonese")!.code;

    expect(perEntrata("E15")).toBe(e15);
    expect(perEntrata("E75")).toBe(e75);
  });

  it("l'entrata cambia SOLO la riga della cremonese", () => {
    const senzaCremonese = (entrata: "E15" | "E75") =>
      artechAntaRibaltaLegno
        .generate({ ...base, entrata })
        .filter((l) => l.position !== "cremonese")
        .map((l) => `${l.position}|${l.code}|${l.quantity}`);

    expect(senzaCremonese("E75")).toEqual(senzaCremonese("E15"));
  });

  it("la ruleDescription dichiara l'entrata, così la distinta stampata la riporta", () => {
    const riga = artechAntaRibaltaLegno
      .generate({ ...base, entrata: "E75" })
      .find((l) => l.position === "cremonese")!;
    expect(riga.ruleDescription).toContain("entrata 7,5");
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `pnpm test src/server/kit/rules-artech-legno.test.ts`
Expected: FAIL — ogni riga `entrata 7,5` restituisce ancora il codice `A50122.15.*`.

- [ ] **Step 3: Trasformare la tabella in mappa per entrata**

In `src/server/kit/rules-artech-legno.ts` sostituire l'intero blocco `const CREMONESI = [...] as const;` (commento incluso) con:

```ts
/**
 * Cremonese A/R per entrata × banda di altezza-maniglia. VERIFICATA contro
 * `p0424 (422)`, tabella «Cremonesi · Anta ribalta - altezza maniglia fissa»:
 * le nove bande HBB, i GR e l'altezza maniglia sono **identici** fra le due
 * entrate — cambia il codice e cambia il prezzo (GR07: 16,03 € contro 22,12 €).
 *
 * CODICI INTERI, MAI COMPOSTI. `A50122.${entrata}.${gr}` sarebbe regolarissimo
 * qui e sbagliato altrove: la cremonese vasistas pubblica 6 gruppi per l'entrata
 * 7,5 contro i 9 dell'anta-ribalta, quindi la composizione genererebbe
 * `A50111.08.10`, che non esiste. È la regola della PR #39.
 *
 * Escluse per entrambe le entrate, e per le ragioni già note: `.17` («07bis»,
 * altezza maniglia 1050 che si sovrappone ambiguamente al `.07`) e `.31`/`.41`
 * di `p0425 (423)`, che si selezionano per HBB E per LBB. L'esclusione delle
 * `.31`/`.41` lascia scoperto l'intervallo HBB 357-609 (domanda 7).
 *
 * ASIMMETRIA DICHIARATA (domanda 27): al GR03 l'entrata 7,5 ha `NOT. −` dove la
 * 15 ha `1`, con nota che nelle DUE ANTE serve l'asta a leva `A51504.19.13`.
 * Questo motore genera anta singola, quindi nessun codice cambia.
 */
const CREMONESI: Record<Entrata, readonly { minH: number; maxH: number; code: string }[]> = {
  E15: [
    { minH: 610, maxH: 810, code: "A50122.15.02" },
    { minH: 794, maxH: 1010, code: "A50122.15.03" },
    { minH: 994, maxH: 1210, code: "A50122.15.04" },
    { minH: 1194, maxH: 1410, code: "A50122.15.05" },
    { minH: 1394, maxH: 1610, code: "A50122.15.06" },
    { minH: 1594, maxH: 1810, code: "A50122.15.07" }, // golden
    { minH: 1794, maxH: 2110, code: "A50122.15.08" },
    { minH: 1994, maxH: 2310, code: "A50122.15.09" },
    { minH: 2194, maxH: 2510, code: "A50122.15.10" },
  ],
  E75: [
    { minH: 610, maxH: 810, code: "A50122.08.02" },
    { minH: 794, maxH: 1010, code: "A50122.08.03" },
    { minH: 994, maxH: 1210, code: "A50122.08.04" },
    { minH: 1194, maxH: 1410, code: "A50122.08.05" },
    { minH: 1394, maxH: 1610, code: "A50122.08.06" },
    { minH: 1594, maxH: 1810, code: "A50122.08.07" },
    { minH: 1794, maxH: 2110, code: "A50122.08.08" },
    { minH: 1994, maxH: 2310, code: "A50122.08.09" },
    { minH: 2194, maxH: 2510, code: "A50122.08.10" },
  ],
};

/** «7,5» / «15» per le descrizioni di riga — la UI ha il suo in `kit-labels.ts`. */
const ENTRATA_MM: Record<Entrata, string> = { E75: "7,5", E15: "15" };
```

Aggiungere `Entrata` all'import da `./types` già presente in testa al file.

- [ ] **Step 4: Leggere l'entrata all'emissione**

Sostituire il blocco dell'emissione della cremonese con:

```ts
    // ASSUNZIONE (emendamento): hbb = heightMm - 10 (golden: 1820-10=1810,
    // bordo max incluso in A50122.15.07). Vale per entrambe le entrate: le bande
    // sono identiche.
    const cremonese = pick(
      CREMONESI[input.entrata], input.heightMm - 10, "H", "artech.cremonese", "cremonese",
    );
    lines.push({
      position: "cremonese",
      code: cremonese.code,
      quantity: 1,
      ruleId: "artech.cremonese",
      ruleDescription:
        `Cremonese A/R entrata ${ENTRATA_MM[input.entrata]} mm per altezza anta ` +
        `${input.heightMm} mm (hbb ${input.heightMm - 10})`,
    });
```

- [ ] **Step 5: Eseguire i test del modulo**

Run: `pnpm test src/server/kit/rules-artech-legno.test.ts`
Expected: PASS, **golden incluso** — `base` ha `entrata: "E15"` dal Task 1, quindi il set obbligatorio resta 12 righe / 17 pezzi con `A50122.15.07`.

- [ ] **Step 6: Gate completo**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: tutti verdi.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(kit): la cremonese si sceglie per entrata, non piu` per costante

CREMONESI diventa una mappa entrata → bande, con i codici INTERI di entrambe le
famiglie trascritti da p0424 (422). Le nove bande HBB coincidono fra E15 e E75:
cambia il codice e cambia il prezzo (GR07: 16,03 € contro 22,12 €).

Codici interi e non `A50122.\${entrata}.\${gr}`: la composizione sarebbe
regolarissima qui e sbagliata sulla vasistas, che per l'entrata 7,5 pubblica 6
gruppi contro i 9 dell'anta-ribalta.

La ruleDescription dichiara l'entrata, cosi` la distinta stampata dice a quale
si riferisce. Un test verifica che l'entrata cambi SOLO la riga della cremonese:
gli altri quindici componenti non la vedono.

Golden invariato: 12 righe / 17 pezzi con entrata 15."
```

---

### Task 3: La vasistas rifiuta l'entrata 7,5, il battente la documenta

**Files:**
- Modify: `src/server/kit/rules-artech-vasistas-legno.ts` (guardie in `generate`, dopo `assertSeatConfigSupportata`)
- Modify: `src/server/kit/rules-artech-battente-legno.ts:26-32` (solo commento)
- Test: `src/server/kit/rules-artech-vasistas-legno.test.ts`

**Interfaces:**
- Consumes: `ArtechKitInput.entrata` dal Task 1.

- [ ] **Step 1: Scrivere il test fallito**

In `src/server/kit/rules-artech-vasistas-legno.test.ts`:

```ts
describe("artechVasistasLegno — entrata maniglia", () => {
  it("genera con l'entrata 15, l'unica trascritta", () => {
    expect(() => artechVasistasLegno.generate({ ...base, entrata: "E15" })).not.toThrow();
  });

  it("rifiuta l'entrata 7,5 citando le forbici non applicabili", () => {
    expect(() => artechVasistasLegno.generate({ ...base, entrata: "E75" })).toThrow(
      /forbici/i,
    );
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `pnpm test src/server/kit/rules-artech-vasistas-legno.test.ts`
Expected: FAIL sul secondo test — oggi l'entrata 7,5 genera una distinta con i codici dell'entrata 15.

- [ ] **Step 3: Aggiungere la guardia**

In `src/server/kit/rules-artech-vasistas-legno.ts`, dentro `generate`, subito dopo `assertSeatConfigSupportata(input.seatConfig);`:

```ts
    // L'entrata 7,5 NON è uno scambio di codice come sull'anta-ribalta. Le
    // A50111.08.* esistono, ma due NB di p0426 (424) dicono: «GR 1-2-3 E.15
    // richiede una forb. vasistas A50545.00.00. Su E.7,5 forbici vasistas non
    // applicabili» e «GR 4-5-6 E.15 richiede due forb. vasistas A50545.00.00. Su
    // E.7,5 forb. vasistas solo su GR 5 e 6». A entrata 7,5 un componente che
    // questo modulo emette sparisce su quattro gruppi su sei, e il listino non
    // dice cosa vada al suo posto. In più il GR00 (A50111.15.10) esiste solo per
    // l'entrata 15.
    // Inferire il pezzo mancante è ciò che ha prodotto le distinte non
    // ordinabili di PVC e battente: si rifiuta, e la tabella resta E15-only.
    if (input.entrata !== "E15")
      throw new KitGenerationError(
        "Vasistas a entrata 7,5 non coperta: il listino 2026 dichiara le forbici vasistas " +
          "«non applicabili» sui gruppi 1-2-3 e limitate ai gruppi 5-6, senza indicare il " +
          "componente sostitutivo (p0426 (424)). Usare l'entrata 15.",
        "artech.entrata",
      );
```

- [ ] **Step 4: Eseguire i test della vasistas**

Run: `pnpm test src/server/kit/rules-artech-vasistas-legno.test.ts`
Expected: PASS

- [ ] **Step 5: Documentare il battente (nessun codice)**

In `src/server/kit/rules-artech-battente-legno.ts`, estendere il commento sopra `BATTENTE_CREMONESI`:

```ts
/**
 * Cremonese «anta a battente» Mod. 502 per range altezza HBB.
 * VERIFICATA contro il listino p0429 (427), tabella «Cremonesi · Anta a battente
 * - Mod. 502 per finestra e porta finestra a 1 anta», entrata 15: bande e codici
 * identici. La colonna NOT. del listino vale 2/2/2/3/3/3/3/4/4/4.
 *
 * QUI NON ESISTE UN ASSE ENTRATA. A differenza dell'anta-ribalta (p0424 (422))
 * e della vasistas (p0426 (424)), la colonna ENTRATA di questa tabella ha **un
 * solo valore, 15**: l'entrata 7,5 non è problematica, non è proprio pubblicata
 * per questa famiglia. Nessuna guardia nel codice sarebbe raggiungibile —
 * `generate` rifiuta già ogni input — ma chi riaccenderà il modulo deve saperlo.
 */
```

**Nessuna guardia `E75` nel battente**: `generate` solleva incondizionatamente, quindi un controllo sull'entrata sarebbe codice morto. È uno scostamento consapevole dalla §7.1 della spec, che ne prevedeva una.

- [ ] **Step 6: Gate completo**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: tutti verdi.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(kit): la vasistas rifiuta l'entrata 7,5 invece di inventarne i pezzi

Le A50111.08.* esistono a listino, ma due NB di p0426 (424) dicono che a entrata
7,5 le forbici vasistas A50545.00.00 sono «non applicabili» sui gruppi 1-2-3 e
limitate ai gruppi 5-6 — senza indicare il componente sostitutivo. In piu` il
GR00 esiste solo per l'entrata 15.

Un componente che il modulo emette sparirebbe su quattro gruppi su sei: e` la
situazione che ha prodotto le distinte non ordinabili di PVC e battente. Si
rifiuta con la ragione, e la tabella resta E15-only — non si trascrivono righe
che non si sanno usare.

Il battente riceve solo un commento: a p0429 (427) la colonna ENTRATA ha un solo
valore, quindi li` un asse entrata non esiste. Nessuna guardia, sarebbe codice
morto — generate solleva gia` incondizionatamente."
```

---

### Task 4: `no-silent-fields` — l'entrata è una mutazione, e la lista non può più marcire

**Files:**
- Modify: `src/server/kit/no-silent-fields.test.ts`

**Interfaces:**
- Consumes: `artechInputSchema` e `tourInputSchema` da `./types` (già esportati), `ENTRATE`.

Questo è il task che conta: senza, il lavoro sarebbe reversibile per distrazione.

- [ ] **Step 1: Dichiarare l'entrata fra le mutazioni**

Nel caso `"ARTECH anta-ribalta legno"`, in fondo a `mutazioni`:

```ts
      { campo: "entrata", valore: "E75" },
```

Nel caso `"ARTECH vasistas legno"`, in fondo a `mutazioni`:

```ts
      // Sulla vasistas la mutazione produce un RIFIUTO, che `esito()` codifica
      // come "__RIFIUTO__" ≠ riferimento: è la forma corretta di «non ignorato».
      { campo: "entrata", valore: "E75" },
```

- [ ] **Step 2: Eseguire e verificare che passino**

Run: `pnpm test src/server/kit/no-silent-fields.test.ts`
Expected: PASS — l'anta-ribalta cambia codice (Task 2), la vasistas solleva (Task 3).

Se l'anta-ribalta fallisse qui, il Task 2 non è stato completato.

- [ ] **Step 3: Scrivere il test di esaustività, fallito**

Il buco che questo chiude: `mutazioni` e `inerti` sono liste **scritte a mano**, e niente verifica che coprano i campi dello schema. L'entrata è arrivata fino in produzione anche per questo. Aggiungere in testa al file, dopo gli import:

```ts
import { artechInputSchema, tourInputSchema } from "./types";

/**
 * `series` e `windowType` sono i DISCRIMINATORI: mutarli non significa «un'altra
 * distinta», significa «un altro modulo». Sono gli unici campi legittimamente
 * fuori dalle due liste.
 */
const CAMPI_STRUTTURALI = new Set(["series", "windowType"]);
```

Estendere l'interfaccia `Caso` con:

```ts
  /** Campi dello schema del ramo, per il controllo di esaustività. */
  campi: readonly string[];
```

Aggiungere il campo ai tre casi:

```ts
// nei due casi ARTECH
    campi: Object.keys(artechInputSchema.shape),
// nel caso TOUR
    campi: Object.keys(tourInputSchema.shape),
```

E dentro `describe.each(CASI)`, come primo `it`:

```ts
  it("ogni campo dello schema è dichiarato — mutazione o inerte, mai dimenticato", () => {
    const dichiarati = new Set([
      ...caso.mutazioni.map((m) => m.campo),
      ...caso.inerti.map((i) => i.campo),
    ]);
    const dimenticati = caso.campi.filter(
      (campo) => !CAMPI_STRUTTURALI.has(campo) && !dichiarati.has(campo),
    );
    expect(dimenticati).toEqual([]);
  });
```

- [ ] **Step 4: Provare che il controllo morde**

Commentare temporaneamente la riga `{ campo: "entrata", valore: "E75" },` del caso anta-ribalta.

Run: `pnpm test src/server/kit/no-silent-fields.test.ts`
Expected: FAIL con `expected [ 'entrata' ] to deeply equal []`.

Ripristinare la riga e rieseguire.

Run: `pnpm test src/server/kit/no-silent-fields.test.ts`
Expected: PASS

- [ ] **Step 5: Gate completo**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: tutti verdi.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(kit): l'entrata e` una mutazione, e la lista non puo` piu` marcire

`entrata` entra fra le mutazioni dei due moduli ARTECH: sull'anta-ribalta deve
cambiare la distinta, sulla vasistas deve sollevare — entrambe le forme di «non
ignorato in silenzio».

E si chiude il buco che ha permesso a questo bug di arrivare in produzione:
mutazioni e inerti erano liste scritte a mano, e NIENTE verificava che coprissero
i campi dello schema. Ora un campo nuovo non dichiarato fa fallire il test, con
il suo nome nel messaggio. Esenti i soli discriminatori series/windowType:
mutarli non significa «un'altra distinta» ma «un altro modulo».

Verificato che morda: commentando la dichiarazione dell'entrata, il test
fallisce nominandola."
```

---

### Task 5: Il gate su catalogo reale copre entrambe le entrate

**Files:**
- Modify: `src/server/kit/codici-a-listino.integration.test.ts`

**Interfaces:**
- Consumes: `ENTRATE` da `./types`.

- [ ] **Step 1: Estendere il prodotto cartesiano**

Sostituire il blocco `const combinazioni = …` con:

```ts
  // 7 geometrie × 2 mani × 2 ENTRATE = 28 combinazioni: tutte le distinte
  // ordinabili dal modulo. L'entrata è il terzo discriminatore che cambia i
  // codici emessi — e i nove A50122.08.* non erano mai passati per il catalogo
  // reale prima di questo gate.
  const combinazioni = (Object.keys(GEOMETRIE) as ArtechGeometryId[]).flatMap((geometry) =>
    (["DESTRA", "SINISTRA"] as const).flatMap((openingSide) =>
      ENTRATE.map((entrata) => ({ geometry, openingSide, entrata })),
    ),
  );
```

Aggiornare la firma del caso e la generazione:

```ts
  it.each(combinazioni)(
    "$geometry / $openingSide / entrata $entrata — nessun codice orfano",
    async ({ geometry, openingSide, entrata }) => {
      const lines = artechAntaRibaltaLegno.generate({
        ...base,
        geometry,
        openingSide,
        entrata,
      } as KitInput);
```

Aggiungere `ENTRATE` all'import da `./types` (che oggi importa il solo tipo `KitInput` — l'import diventa misto: `import { ENTRATE, type KitInput } from "./types";`).

Rimuovere `entrata: "E15"` da `base` (aggiunto nel Task 1): ora arriva dalla combinazione. Se restasse, verrebbe sovrascritto — ma lasciarlo suggerirebbe un default che non esiste.

- [ ] **Step 2: Eseguire il gate contro il catalogo reale**

Il test è `describe.runIf(Boolean(url))`: senza `INTEGRATION_DATABASE_URL` **non gira**, e passerebbe a vuoto.

Run: `set -a; source .env; set +a; INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm test src/server/kit/codici-a-listino.integration.test.ts`
Expected: PASS, **28 casi** eseguiti (prima 14). Se il conteggio resta 14, la variabile non è arrivata: il gate non ha verificato nulla.

Se il catalogo locale è vuoto: `set -a; source .env; set +a; pnpm import:agb` (richiede `poppler-utils` e il PDF del listino).

- [ ] **Step 3: Gate completo**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: tutti verdi.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(kit): il gate su catalogo reale copre entrambe le entrate

Da 7 geometrie × 2 mani a × 2 entrate: 28 combinazioni. E` il controllo che
mancava a PVC e battente — il test unitario mocka product.findMany, quindi un
codice inesistente gli sfugge.

Serve davvero: i nove A50122.08.* non erano mai passati per il catalogo reale,
e finche` non lo fanno il fatto che siano «a listino con prezzo» resta una mia
lettura del PDF, non un riscontro."
```

---

### Task 6: Il wizard chiede l'entrata, senza preselezionarla

**Files:**
- Modify: `src/lib/kit-labels.ts`
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx` (`ARTECH_DEFAULT` :35-49 · `STEP_SCHEMAS` :182-190 · `Step3ManoFinitura`)
- Test: `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`

**Interfaces:**
- Produces: `entrataLabel(value: string): string` da `@/lib/kit-labels`; il tipo di stato del form `ArtechFormValues = Omit<ArtechKitInput, "entrata"> & { entrata?: Entrata }`.

- [ ] **Step 1: Aggiungere le etichette**

In `src/lib/kit-labels.ts`, dopo `OPENING_DIR_LABELS`:

```ts
/**
 * Entrata maniglia. Le due sole pubblicate: `p0424 (422)` etichetta la colonna
 * ENTRATA come `1) 7,5` e `2) 15`. Il valore si scrive all'italiana, con la
 * virgola — la UI del progetto è in italiano e «7.5» stona.
 */
export const ENTRATA_LABELS: Record<string, string> = {
  E75: "7,5 mm",
  E15: "15 mm",
};

export function entrataLabel(value: string): string {
  return ENTRATA_LABELS[value] ?? value;
}
```

- [ ] **Step 2: Scrivere i test falliti del wizard**

In `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`:

Il file usa `render(<NuovaRichiestaClient />)`, `fireEvent`/`screen` e l'idioma
`getByRole("group", { name: … })` + `within(…)` per i fieldset: **riusarlo, non
introdurne un altro**. `vai()` sotto è un helper locale a questo `describe`, che
porta il wizard al passo 3.

```ts
describe("NuovaRichiestaClient — entrata maniglia", () => {
  const vai = () => {
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3
  };

  it("non preseleziona nessuna entrata", () => {
    render(<NuovaRichiestaClient />);
    vai();
    const gruppo = screen.getByRole("group", { name: /entrata maniglia/i });
    const opzioni = within(gruppo).getAllByRole("radio") as HTMLInputElement[];
    expect(opzioni).toHaveLength(2);
    for (const o of opzioni) expect(o.checked).toBe(false);
  });

  it("blocca il passo finché non se ne sceglie una, con un messaggio italiano", () => {
    render(<NuovaRichiestaClient />);
    vai();
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    expect(screen.getByText("Scegli l'entrata maniglia (7,5 o 15 mm).")).toBeTruthy();
  });

  it("scelta l'entrata, il passo avanza", () => {
    render(<NuovaRichiestaClient />);
    vai();
    const gruppo = screen.getByRole("group", { name: /entrata maniglia/i });
    fireEvent.click(within(gruppo).getByRole("radio", { name: /7,5 mm/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    expect(screen.queryByText("Scegli l'entrata maniglia (7,5 o 15 mm).")).toBeNull();
    expect(screen.getByRole("button", { name: /genera|crea|conferma/i })).toBeTruthy();
  });

  // Regola inviolabile «mobile-first», come già per materiale e geometria.
  it("entrata: griglia a una colonna sotto sm", () => {
    render(<NuovaRichiestaClient />);
    vai();
    const grid = screen
      .getByRole("group", { name: /entrata maniglia/i })
      .querySelector("div.grid");
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:grid-cols-2");
  });
});
```

Il nome del pulsante dell'ultimo passo va allineato a quello reale del wizard —
leggerlo in `nuova-client.tsx` invece di indovinarlo fra le tre alternative del
regex. **La verifica che il riepilogo riporti l'entrata è del Task 7**, che è
dove quella riga viene aggiunta.

- [ ] **Step 3: Eseguire e verificare il fallimento**

Run: `pnpm test src/app/\(dashboard\)/richieste/nuova/nuova-client.test.tsx`
Expected: FAIL — nessun radio con nome «entrata».

- [ ] **Step 4: Togliere il default e allentare il tipo del form**

In `nuova-client.tsx`, rimuovere da `ARTECH_DEFAULT` la riga temporanea `entrata: "E15",` inserita nel Task 1, e cambiarne il tipo:

```ts
/**
 * Lo stato del form NON è un `ArtechKitInput`: l'entrata deve nascere **non
 * valorizzata**, perché sceglierla è il punto di questo campo. È l'unico prezzo
 * della decisione «nessun default», e si paga solo qui — la validazione vera
 * resta quella dello schema, all'avanzamento del passo e al submit.
 */
type ArtechFormValues = Omit<ArtechKitInput, "entrata"> & { entrata?: Entrata };
type FormValues = ArtechFormValues | TourKitInput;

const ARTECH_DEFAULT: ArtechFormValues = {
  // …campi invariati, senza `entrata`
};
```

Sostituire nel file le annotazioni `KitInput` dello **stato** con `FormValues` (`useState<FormValues>`, `Dispatch<SetStateAction<FormValues>>` in `makeUpdate`, e i tipi dei componenti di step ARTECH da `ArtechKitInput` a `ArtechFormValues`). `pnpm typecheck` elenca i punti esatti. La chiamata a `api.kit.create.useMutation` continua a ricevere l'output **parsato** dallo schema, non lo stato: nessun `as KitInput` nuovo.

Aggiungere l'import: `import { ENTRATE, type Entrata } from "@/server/kit/types";` e `import { entrataLabel } from "@/lib/kit-labels";`.

- [ ] **Step 5: Aggiungere `entrata` allo schema del passo**

In `STEP_SCHEMAS.ARTECH`, terzo elemento:

```ts
    artechInputSchema.pick({
      geometry: true,
      entrata: true,
      openingSide: true,
      openingDir: true,
      finish: true,
    }),
```

- [ ] **Step 6: Aggiungere il fieldset**

In `Step3ManoFinitura`, **fra** il fieldset «Geometria del serramento» e quello «Sede degli incontri» — l'ordine in cui le tre quote si leggono sul disegno:

```tsx
      {/* L'entrata è ORTOGONALE alla geometria: sceglie la famiglia della
          cremonese e nient'altro. Nessuna opzione è preselezionata, di
          proposito: è la decisione del 2026-07-30.
          L'hint segue il modello del fix «sede» (PR #37) — prima dove si legge
          la quota sul listino, poi come si scrive nel codice — perché un agente
          esperto non riconosce il nome di una quota che il listino chiama in due
          modi. */}
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">Entrata maniglia</legend>
        <p className="mb-2 text-xs text-ink-subtle">
          È il secondo numero del codice della cremonese —{" "}
          <span className="font-mono">A50122.<b>15</b>.07</span> — e sul listino è la colonna
          ENTRATA delle tabelle «Cremonesi».
        </p>
        {/* Mobile-first: una colonna sotto sm, come gli altri gruppi. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ENTRATE.map((valore) => (
            <RadioOption
              key={valore}
              name="entrata"
              label={`Entrata ${entrataLabel(valore)}`}
              hint={`Codice A50122.${valore === "E75" ? "08" : "15"}.NN`}
              checked={form.entrata === valore}
              onChange={() => update("entrata", valore)}
            />
          ))}
        </div>
      </fieldset>
```

**Nessun `role="radiogroup"` manuale.** `<fieldset>` + `<legend>` espone già un
`role="group"` con nome accessibile — è ciò che i test esistenti interrogano
(`getByRole("group", { name: /materiale/i })`) — e `RadioOption` lega da sé il
proprio hint con `aria-describedby` e `useId`. Aggiungere un ruolo ARIA sopra a
markup nativo che fa già la cosa giusta è il modo tipico di romperla.

- [ ] **Step 7: Eseguire i test del wizard**

Run: `pnpm test src/app/\(dashboard\)/richieste/nuova/nuova-client.test.tsx`
Expected: PASS

- [ ] **Step 8: Gate completo**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: tutti verdi.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(kit): il wizard chiede l'entrata, e non la sceglie per te

Nuovo gruppo al passo «Geometria e mano», fra geometria e sede — l'ordine in cui
le tre quote si leggono sul disegno. NESSUNA opzione preselezionata: il passo non
avanza finche` non se ne sceglie una.

L'hint segue il modello del fix «sede» (PR #37): prima dove la quota si legge sul
listino (colonna ENTRATA delle tabelle Cremonesi), poi come si scrive nel codice
(il secondo numero, A50122.15.07). Un agente esperto non aveva riconosciuto la
parola «sede» proprio perche` il listino la chiama in due modi.

Prezzo della scelta «nessun default», e si paga solo qui: lo stato del form non
e` piu` un ArtechKitInput ma un tipo con `entrata?`, perche` il campo deve nascere
non valorizzato. La validazione vera resta quella dello schema."
```

---

### Task 7: L'entrata è visibile dove si legge la richiesta

**Files:**
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx` (`Step4Riepilogo`)
- Modify: `src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx:204-212`
- Test: `src/app/(dashboard)/richieste/[id]/dettaglio-client.test.tsx`

**Interfaces:**
- Consumes: `entrataLabel` dal Task 6; la colonna `KitRequest.entrata` dal Task 1.

- [ ] **Step 1: Scrivere il test fallito della scheda**

In `dettaglio-client.test.tsx`, riusando la fixture `request` e il mock
`getQuery` già presenti nel file — la scheda riceve `id`, non la richiesta:

```ts
it("mostra l'entrata maniglia fra le specifiche ARTECH", () => {
  getQuery.mockReturnValue({
    isPending: false, isError: false, data: { ...request, entrata: "E75" },
  });
  render(<DettaglioClient id="k1" />);
  expect(screen.getByText("Entrata maniglia")).toBeTruthy();
  expect(screen.getByText("7,5 mm")).toBeTruthy();
});

it("non mostra l'entrata quando la riga non ce l'ha (TOUR, o storico)", () => {
  getQuery.mockReturnValue({
    isPending: false, isError: false, data: { ...request, entrata: null },
  });
  render(<DettaglioClient id="k1" />);
  expect(screen.queryByText("Entrata maniglia")).toBeNull();
});
```

Aggiungere `entrata: "E15"` alla fixture `request` (è un oggetto letterale non
tipizzato: nessun errore di typecheck lo segnalerà, va fatto a mano).

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `pnpm test src/app/\(dashboard\)/richieste/\[id\]/dettaglio-client.test.tsx`
Expected: FAIL — «Entrata maniglia» non è nel documento.

- [ ] **Step 3: Aggiungere la riga alla scheda**

In `dettaglio-client.tsx`, dentro il ramo `r.geometry !== null`, dopo lo `<Spec label="Geometria" …>`:

```tsx
                  {r.entrata !== null && (
                    <Spec label="Entrata maniglia" value={entrataLabel(r.entrata)} />
                  )}
```

Aggiungere `entrataLabel` all'import da `@/lib/kit-labels`.

- [ ] **Step 4: Aggiungere la riga al riepilogo del wizard**

In `Step4Riepilogo` di `nuova-client.tsx`, dopo `<SummaryItem label="Geometria" …>`:

```tsx
      {/* `form.entrata` è opzionale nello stato ma qui è sempre valorizzata: al
          passo 4 si arriva solo dopo la validazione del passo 3. */}
      {form.entrata && (
        <SummaryItem label="Entrata maniglia" value={entrataLabel(form.entrata)} />
      )}
```

- [ ] **Step 5: Eseguire i test**

Run: `pnpm test src/app/\(dashboard\)/richieste`
Expected: PASS

- [ ] **Step 6: Verifica browser — desktop e 375 px**

Avviare l'ambiente se serve: `bash scripts/dev-bootstrap.sh`, poi `pnpm dev`.

Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`

Controllare, a **1440×900** e a **375×667**:

1. Il gruppo «Entrata maniglia» compare fra geometria e sede, con **nessuna opzione selezionata**.
2. «Avanti» senza scegliere → «Scegli l'entrata maniglia (7,5 o 15 mm).»
3. Scelta 7,5 → il riepilogo dice «Entrata maniglia · 7,5 mm».
4. A 375 px il gruppo è su **una colonna**, nessun overflow orizzontale della pagina, il tocco delle opzioni è comodo.
5. Generata la richiesta, la scheda mostra la riga «Entrata maniglia».
6. Il golden — 550×1820, SX, ARGENTO, chiusure ON, entrata 15 — resta **16 righe / 21 pezzi / 90,20 €**.

Salvare gli screenshot in `/tmp/claude-*/scratchpad/`.

- [ ] **Step 7: Gate completo**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: tutti verdi.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(kit): l'entrata si legge nel riepilogo e sulla scheda richiesta

Un campo che decide un codice e un prezzo deve essere visibile dove si controlla
la richiesta, non solo dove si compila. Sulle righe TOUR la riga non compare:
quel ramo non ha l'entrata.

Verificato a 1440x900 e a 375px: gruppo su una colonna sotto sm, nessun overflow,
golden fermo a 16 righe / 21 pezzi / 90,20 €."
```

---

### Task 8: Documentazione

**Files:**
- Modify: `docs/superpowers/kit-assunzioni/DOMANDE-APERTE.md`
- Modify: `docs/superpowers/kit-assunzioni/legno.md`
- Modify: `docs/superpowers/kit-assunzioni/vasistas.md`

- [ ] **Step 1: Aggiungere la domanda 27**

In `DOMANDE-APERTE.md`, nella tabella «In sintesi», dopo la riga 26:

```markdown
| 27 | GR03: l'entrata 7,5 dichiara zero nottolini | agente o AGB | ⚪ asimmetria fra le due entrate |
```

E nella sezione ⚪ «Da chiarire», prima della 18:

```markdown
## 27 — Al gruppo 03, l'entrata 7,5 non ha nottolini

**In parole semplici:** nella tabella delle cremonesi, al gruppo **GR03** (altezza
maniglia 794-1010 mm) l'entrata **7,5** dichiara **nessun nottolino** dove l'entrata
15 ne dichiara **uno**. Sotto c'è una nota: «*il cremonese entrata 7,5 GR3 nelle due
ante deve essere usato con asta a leva `A51504.19.13`*».

**Domanda:** su una finestra a **una sola anta** con entrata 7,5 e altezza maniglia
in quella fascia, il serramento resta senza quel punto di chiusura, o si ordina
qualcos'altro?

**Perché non blocca:** il generatore fa anta singola e non usa la colonna NOT.
dell'anta-ribalta (il numero di incontri viene dalla formula della domanda 3a),
quindi oggi nessun codice cambia. È l'unico gruppo, su nove, in cui il listino
tratta le due entrate diversamente: va scritto invece che lasciato implicito.

*Riferimento tecnico: `p0424 (422)`, righe `A50122.08.03` e `A50122.15.03`.*
```

- [ ] **Step 2: Aggiornare la 17 come non più bloccante**

Nella tabella «In sintesi» sostituire la riga 17 con:

```markdown
| 17 | **L'entrata: quale usate?** | agente | 🟡 quale sia il caso frequente |
```

Spostare la sezione `## 17` da «🔴 Le sei bloccanti» a «🟡 Importanti» e riscriverne il «Perché blocca» come:

```markdown
**Perché conta (non blocca più):** dal 2026-07-30 il programma **ve la chiede** e
copre entrambe le entrate pubblicate. La risposta non serve più a sbloccare il
codice: serve a sapere quale sia il caso frequente — per il default del profilo
cliente, quando lo faremo, e per capire se l'entrata 7,5 vi capita davvero.
```

Aggiornare l'intestazione della sezione da «Le sei bloccanti» a «Le cinque bloccanti».

- [ ] **Step 3: Aggiornare `legno.md`**

Nella scheda dell'anta-ribalta, dove è descritta la cremonese, sostituire l'assunzione «entrata 15 cablata» con l'esito:

```markdown
**Entrata maniglia — RISOLTA il 2026-07-30.** Era una costante del motore
(`A50122.15.NN`), scelta senza chiedere: un serramento a entrata 7,5 riceveva in
silenzio il codice della 15. Ora è un campo dell'input, obbligatorio e senza
default, e il modulo copre entrambe le famiglie pubblicate a `p0424 (422)` — nove
bande identiche, cambia il codice e cambia il prezzo (GR07: 16,03 € contro
22,12 €). Resta aperta la **domanda 27** sull'asimmetria del GR03.
```

- [ ] **Step 4: Aggiornare `vasistas.md`**

Aggiungere fra le assunzioni:

```markdown
**Entrata maniglia: solo 15.** Le `A50111.08.*` esistono, ma le due NB di
`p0426 (424)` dichiarano le forbici vasistas `A50545.00.00` «non applicabili» sui
GR 1-2-3 a entrata 7,5 e limitate ai GR 5-6, senza indicare il sostituto; il GR00
è pubblicato solo per l'entrata 15. Il modulo **rifiuta** l'entrata 7,5 invece di
emettere una distinta a cui manca un pezzo. Si riapre con una risposta dell'esperto.
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs(kit): domanda 27, e la 17 non blocca piu`

La 27 e` l'unica asimmetria fra le due entrate su nove gruppi: al GR03 la 7,5
dichiara zero nottolini dove la 15 ne dichiara uno, con nota sulle due ante. Non
blocca — anta singola, e il numero di incontri viene dalla formula — ma e` un
dato del listino che non va lasciato implicito.

La 17 («quale entrata usate?») scende da bloccante a importante: il programma
ora la chiede e copre entrambe le famiglie. La risposta serve a sapere quale sia
il caso frequente, non a sbloccare il codice.

legno.md e vasistas.md passano da «assunzione» a «esito»."
```

---

## Verifica finale, prima della PR

- [ ] `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`
- [ ] Gate su catalogo reale: **28 combinazioni**, zero orfani
  `set -a; source .env; set +a; INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm test src/server/kit/codici-a-listino.integration.test.ts`
- [ ] Golden: 550×1820 SX ARGENTO chiusure ON entrata 15 → **16 righe / 21 pezzi / 90,20 €**
- [ ] Golden gemello a entrata 7,5 → 16 righe / 21 pezzi, cremonese `A50122.08.07`, **totale atteso 96,29 €**. **Va letto dal catalogo vero**, non calcolato: se differisce dai 96,29 €, è il mio calcolo a essere sbagliato, non il catalogo — riportare il valore reale nella PR
- [ ] Browser desktop **e 375 px** (Task 7, Step 6)

## Azioni ops al merge

1. **`migrate deploy`** → `…_kit_entrata` (enum, colonna, backfill `E15` sulle righe ARTECH)
2. **Nessun re-import del catalogo** — i nove `A50122.08.*` sono già a listino, garantito dal gate
3. **Nessun `db:seed:kit`** — i template non cambiano
4. Verifica funzionale in produzione: il golden con entrata 15 deve restare **16 righe / 90,20 €**

---

## Scostamenti dalla spec, consapevoli

- **§7.1 — nessuna guardia `E75` nel battente.** `generate` solleva incondizionatamente, quindi il controllo sarebbe irraggiungibile. Al suo posto un commento sul modulo, dove chi lo riaccenderà lo leggerà. Il fatto di listino (`p0429 (427)` pubblica una sola entrata) è comunque registrato.
- **Aggiunta non prevista dalla spec — esaustività in `no-silent-fields` (Task 4).** Le liste `mutazioni`/`inerti` erano scritte a mano senza alcun controllo che coprissero i campi dello schema: è una delle ragioni per cui l'entrata è arrivata in produzione inosservata. Dieci righe di test la chiudono per tutti i campi futuri.
