# L'indice dell'archivio COLOMBO — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** far tornare a girare `pnpm foto:colombo` derivando la lista degli
archivi dalle 79 chiavi di `ARCHIVI` invece che dall'indice che COLOMBO non
pubblica più, e rimettere il segnale «è uscito qualcosa di nuovo» su un canale
che arriva a una persona.

**Architecture:** il modulo di dominio `foto-archivio.ts` guadagna una funzione
pura `urlArchivio()`; lo script itera su `Object.keys(ARCHIVI)`, raccoglie tutti
gli archivi irraggiungibili e **si rifiuta prima di toccare Blob e DB**. In
parallelo, un modulo puro nuovo `vigilanza.ts` più uno script e un workflow
`schedule:` sorvegliano l'indice pubblico dei documenti dell'area download e
**falliscono** su qualunque differenza.

**Tech Stack:** TypeScript strict · Vitest · Prisma · `@vercel/blob` · `sharp` ·
GitHub Actions. Nessuna dipendenza nuova.

## Global Constraints

- **TypeScript strict sempre.** Nessun `any`, nessun `!` non giustificato.
- **UI in italiano** — qui non si tocca UI, ma i messaggi di log e di errore
  degli script sono in italiano, come il resto.
- **Il repo è PUBBLICO.** Nei file committati NON vanno: nomi di file di foto,
  prezzi, giacenze. **VANNO** invece: i nomi degli **archivi** (79, già in
  `ARCHIVI` da mesi) e gli id/titoli/href dei documenti dell'area download, che
  COLOMBO serve **senza password**.
- **NON TOCCARE LA SEZIONE SERRAMENTI** (catalogo AGB, assistente, kit, clienti).
  Nessun file sotto `src/server/kit/`, `src/server/ai/`, `src/app/archivio/`,
  `src/app/kit/`, `src/app/clienti/`.
- **Nessuna migrazione Prisma.** Se un task sembra richiederne una, è sbagliato.
- **Un commit per task**, messaggio in italiano, chiuso dalle due righe di
  attribuzione:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01LcPAMJoNyoYc3qpEhSjLbc
  ```
- **Prima di ogni comando `prisma`/`tsx`:** `set -a; source .env; set +a`.
- **Gate a fine piano:** `pnpm typecheck` · `pnpm lint` · `pnpm test`
  (baseline **1.655 verdi**, 183 skip) · `pnpm build`.

---

### Task 1: `urlArchivio()`, la funzione pura che costruisce il path di uno zip

Il path si costruisce dalla chiave di `ARCHIVI`. **Quattro chiavi su 79
contengono uno spazio** (`01_One Q`, `01_Due Q`, `04_Incasso_Flush handles`,
`05_Blindate_Armored door`): è l'unico punto in cui la derivazione può
sbagliare, ed è proprio dove `elencaArchivi` — che riceveva il path già formato
dall'HTML — non poteva sbagliare. Per questo la funzione nasce **pura e
testata**, invece di stare come template literal dentro lo script.

L'encoding NON si fa qui: `scarica()` e `dimensione()` in `scripts/foto-colombo.ts`
chiamano già `encodeURI(path)`. Una seconda codifica produrrebbe `%2520`.

**Files:**

- Modify: `src/server/maniglie/foto-archivio.ts` (aggiungere la funzione dopo
  `chiaveFoto`, che sta intorno a riga 373)
- Test: `src/server/maniglie/foto-archivio.test.ts`

**Interfaces:**

- Consumes: `ARCHIVI` (già esportata da `foto-archivio.ts`)
- Produces: `export function urlArchivio(chiave: string): string` — restituisce
  un path **non codificato**, es. `/download/maniglie/archivio/01_Fedra.zip`.
  Il Task 2 lo usa così: `await vociDi(urlArchivio(archivio))`.

- [ ] **Step 1: Write the failing test**

In `src/server/maniglie/foto-archivio.test.ts`, aggiungere `urlArchivio`
all'import da `./foto-archivio` e in fondo al file il blocco:

```ts
describe("urlArchivio", () => {
  it("costruisce il path dello zip dalla chiave della tabella", () => {
    expect(urlArchivio("01_Fedra")).toBe("/download/maniglie/archivio/01_Fedra.zip");
  });

  /**
   * Quattro chiavi su 79 contengono uno spazio. NON si codificano qui:
   * `scarica()` e `dimensione()` fanno già `encodeURI`, e una seconda
   * codifica darebbe `%2520`. Il test esiste per fissare QUALE dei due strati
   * codifica — è l'unico modo in cui questa funzione può sbagliare.
   */
  it("lascia gli spazi al chiamante, che codifica lui", () => {
    expect(urlArchivio("01_One Q")).toBe("/download/maniglie/archivio/01_One Q.zip");
    expect(urlArchivio("04_Incasso_Flush handles")).toBe(
      "/download/maniglie/archivio/04_Incasso_Flush handles.zip",
    );
  });

  /**
   * Il pavimento della derivazione: dalle 79 chiavi devono uscire 79 path
   * distinti e ben formati. Senza, una chiave storta darebbe un 404 a run
   * time invece di un test rosso.
   */
  it("dà un path distinto e ben formato a ognuna delle 79 chiavi", () => {
    const path = Object.keys(ARCHIVI).map(urlArchivio);
    expect(new Set(path).size).toBe(79);
    for (const p of path) {
      expect(p.startsWith("/download/maniglie/archivio/"), p).toBe(true);
      expect(p.endsWith(".zip"), p).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/user/AGB-Finder && npx vitest run src/server/maniglie/foto-archivio.test.ts -t urlArchivio
```

Expected: FAIL — `urlArchivio is not a function` (o un errore di import).

- [ ] **Step 3: Write minimal implementation**

In `src/server/maniglie/foto-archivio.ts`, subito dopo la funzione `chiaveFoto`:

```ts
/**
 * Il path dello zip di un archivio, dalla sua chiave in `ARCHIVI`.
 *
 * Dal 2026-09-16 la lista degli archivi si DERIVA da questa tabella: COLOMBO
 * non pubblica più l'indice, e il sito non aveva mai deciso *cosa* scaricare
 * (un archivio non in tabella veniva comunque ignorato). Vive qui e non nello
 * script perché quattro chiavi su 79 contengono uno spazio, ed è l'unico punto
 * in cui la derivazione può sbagliare.
 *
 * NON codifica: `scarica()`/`dimensione()` fanno `encodeURI` a valle, e una
 * seconda codifica darebbe `%2520`.
 */
export function urlArchivio(chiave: string): string {
  return `/download/maniglie/archivio/${chiave}.zip`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/user/AGB-Finder && npx vitest run src/server/maniglie/foto-archivio.test.ts -t urlArchivio
```

Expected: PASS — 3 test.

- [ ] **Step 5: Commit**

```bash
cd /home/user/AGB-Finder
git add src/server/maniglie/foto-archivio.ts src/server/maniglie/foto-archivio.test.ts
git commit -F - <<'EOF'
feat(maniglie): urlArchivio, il path di uno zip dalla chiave della tabella

Quattro chiavi su 79 contengono uno spazio: è l'unico punto in cui la
derivazione della lista può sbagliare, e dove `elencaArchivi` — che riceveva il
path già formato dall'HTML — non poteva. Quindi nasce pura e testata, e il test
fissa quale dei due strati codifica (a valle, in `scarica`/`dimensione`).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LcPAMJoNyoYc3qpEhSjLbc
EOF
```

---

### Task 2: lo script deriva da `ARCHIVI`, e si rifiuta prima di Blob e DB

Il cuore del piano. `elencaArchivi()` sparisce insieme alla password; lo script
itera sulle 79 chiavi, **raccoglie tutti** gli archivi irraggiungibili (non muore
al primo: lo scenario realistico è «ne hanno rinominati sei») e si rifiuta
**prima** di toccare Blob e DB. In più: errore duro se un archivio noto
restituisce **zero** `.jpg`, che non è mai legittimo e passerebbe la `HEAD`.

⚠️ La rimozione della password dal workflow sta **in questo stesso task**: se
lo script smettesse di leggerla mentre `ops-foto-colombo.yml` continua a
pretenderla, la guardia `test -n` farebbe fallire in zero secondi un run che non
ne ha più bisogno — la lezione `NEON_DIRECT_URL` letta al contrario.

**Files:**

- Modify: `scripts/foto-colombo.ts` (intestazione righe 1-19 · `elencaArchivi`
  righe 48-73 · `main` righe 112-148)
- Modify: `.github/workflows/ops-foto-colombo.yml` (riga `env:` della password ·
  la riga `test -n "$COLOMBO_DOWNLOAD_PASSWORD"`)

**Interfaces:**

- Consumes: `urlArchivio(chiave: string): string` dal Task 1; `ARCHIVI`,
  `abbinaFoto`, `chiaveFoto`, `copertineDichiarate` (già importate); `vociDi`,
  `dimensione`, `scarica` (locali allo script, invariate)
- Produces: niente per i task successivi. Il Task 3 modifica la stessa `main`,
  più in basso.

- [ ] **Step 1: Verificare da dove si parte**

Questo task non ha un test unitario proprio: `elencaArchivi` non ne ha mai avuto
(è locale allo script) e la sua sostituzione è coperta dal Task 1 e dal gate
d'integrazione del Task 5. La verifica è **eseguire lo script**, che oggi
fallisce. Registrare il punto di partenza:

```bash
cd /home/user/AGB-Finder && set -a && source .env && set +a
COLOMBO_DOWNLOAD_PASSWORD=qualsiasi pnpm foto:colombo --dry-run 2>&1 | tail -5
```

Expected: `Error: Nessun archivio nell'elenco: password errata, oppure il form
dell'area download è cambiato.`

- [ ] **Step 2: Togliere `elencaArchivi` e la password**

In `scripts/foto-colombo.ts`:

1. **Cancellare** l'intera funzione `elencaArchivi` (dal commento
   `/** L'elenco degli zip, dietro il form a sola password. ...` fino alla `}`
   di chiusura, righe 48-73) e mettere al suo posto **solo** questo commento,
   che è ciò che resta di valore — dice a chi legge dove cercare se COLOMBO
   ripristina qualcosa:

```ts
// ── l'indice degli archivi, e perché non si raschia più ─────────────────────
//
// Fino al 2026-09 la lista degli zip si scopriva con una POST al form a sola
// password di `download.colombodesign.com/`, raschiando dall'HTML i link
// `'/download/maniglie/archivio/*.zip'` (fra APICI SINGOLI: era un `onclick`).
// Poi COLOMBO ha rifatto l'area download: non è più un elenco piatto di file ma
// un indice di 29 categorie `mostra.php?lang=en&catalogo=NNN`, che pubblicano
// SOLO PDF. L'indice dell'archivio fotografico non esiste più in nessuna pagina
// — mentre gli zip restano serviti, e senza password (79/79, verificato).
//
// La lista viene quindi da `ARCHIVI`, che era GIÀ l'autorità: un archivio non in
// tabella veniva comunque ignorato, quindi non si scarica un file diverso da
// prima. Cambia solo come si fallisce — vedi il rifiuto in `main`.
//
// Costo dichiarato: un archivio NUOVO non è più scopribile. Il segnale si è
// spostato su `scripts/vigila-colombo.ts`, che sorveglia l'indice pubblico dei
// documenti. Le domande C7/C8 in `docs/superpowers/domande-colombo.md`.
```

2. In `main`, **cancellare** le due righe della password:

```ts
const password = process.env.COLOMBO_DOWNLOAD_PASSWORD;
if (!password) throw new Error("COLOMBO_DOWNLOAD_PASSWORD mancante nell'ambiente.");
```

3. **Sostituire** il blocco che va da `console.log("▶ area download COLOMBO…")`
   (riga 122) fino a `console.log(\` ${foto.length} foto indicizzate\`);`(riga 139) **inclusa** con il codice qui sotto — che quella riga la
ristampa. ⚠️ Il blocco **successivo**, il controllo su`FOTO_ATTESE = 707`
   (righe 140-144), **resta com'è e non si tocca**: misurato il 2026-09-16,
   sono ancora esattamente 707, e i cinque archivi del 2026 erano già dentro
   quel numero.

```ts
console.log(`▶ indicizzo ${Object.keys(ARCHIVI).length} archivi COLOMBO…`);

// 1. l'indice: due Range per zip, niente byte di foto.
//
// Si raccolgono TUTTI i falliti e ci si rifiuta dopo, non al primo: lo
// scenario realistico non è «un archivio sparito» ma «ne hanno rinominati
// sei», e col fail-fast sarebbero sei cicli run→commit→run.
const foto: (FotoArchivio & { path: string; voce: VoceZip })[] = [];
const problemi: string[] = [];
for (const archivio of Object.keys(ARCHIVI)) {
  const path = urlArchivio(archivio);
  let voci: VoceZip[];
  try {
    voci = await vociDi(path);
  } catch (e) {
    problemi.push(`${archivio} — ${(e as Error).message}`);
    continue;
  }
  // Uno zip che c'è ma è vuoto passa la HEAD e non produce alcun errore: i
  // suoi articoli perderebbero la foto dentro un run VERDE. Misurato il
  // 2026-09-16: zero archivi vuoti su 79. Non è mai legittimo.
  if (voci.length === 0) {
    problemi.push(`${archivio} — nessun .jpg nello zip`);
    continue;
  }
  for (const voce of voci) {
    const nome = voce.nome.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
    foto.push({ archivio, nome, path, voce });
  }
}

// Il rifiuto sta PRIMA di Blob e del DB, ed è deliberato: il passo 4 azzera
// `image_url` e riscrive solo gli abbinati, quindi un indice parziale non
// darebbe un errore ma un SUCCESSO più povero — `✓ N articoli con foto` con N
// più piccolo, e nessuno se ne accorge.
//
// Non esiste un flag per proseguire: un archivio ritirato davvero si registra
// togliendo la sua riga da ARCHIVI, in un commit che passa da review.
if (problemi.length > 0) {
  throw new Error(
    `${problemi.length} archivi di ARCHIVI non sono utilizzabili:\n  ` +
      problemi.join("\n  ") +
      `\nCorreggere src/server/maniglie/foto-archivio.ts e rilanciare. ` +
      `Niente è stato caricato su Blob e niente è stato scritto a DB.`,
  );
}
console.log(`  ${foto.length} foto indicizzate`);
```

4. In testa al file, aggiungere `urlArchivio` all'import da
   `../src/server/maniglie/foto-archivio`, e **rimuovere** dall'intestazione le
   due righe sulla password (righe 13-14), sostituendo il paragrafo delle righe
   8-11 con:

```ts
// Idempotente: ciò che è già su Blob non si riscarica, quindi rilanciarlo dopo
// un listino nuovo costa la sola rilettura degli indici.
//
// Il confine col repo pubblico: i nomi degli ARCHIVI stanno nel repo (sono le 79
// chiavi di `ARCHIVI`, lì da mesi); i nomi dei FILE e i byte delle foto no. Il
// contenuto di ogni zip si rilegge dal vivo da COLOMBO a ogni run, con le Range
// sulle central directory: si localizza l'elenco degli ZIP, non l'indice dei
// FILE — quindi l'abbinamento foto→codice resta misurato sulla realtà.
```

e la riga d'uso (riga 17) diventa:

```ts
//   BLOB_READ_WRITE_TOKEN=... pnpm foto:colombo
```

- [ ] **Step 3: Togliere la password dal workflow**

In `.github/workflows/ops-foto-colombo.yml`:

1. cancellare la riga `COLOMBO_DOWNLOAD_PASSWORD: ${{ secrets.COLOMBO_DOWNLOAD_PASSWORD }}`
   dal blocco `env:`;
2. cancellare la riga
   `test -n "$COLOMBO_DOWNLOAD_PASSWORD" || { echo "::error::Secret COLOMBO_DOWNLOAD_PASSWORD mancante"; exit 1; }`
   dallo step `Foto COLOMBO → Blob privato + articles.image_url`;
3. aggiungere sopra il blocco `env:` il commento:

```yaml
# La password dell'area download NON serve più: dal 2026-09 la lista degli
# archivi si deriva da ARCHIVI, e gli zip COLOMBO li serve senza password.
# Il secret resta nelle impostazioni del repo, non referenziato: serve
# ancora a una persona per scaricare i PDF a mano.
```

- [ ] **Step 4: Eseguire lo script e verificare che il rifiuto funzioni**

Il dry run legge comunque il DB (serve ad `abbinaFoto`), quindi Postgres deve
essere su. Se il container è stato riavviato, il daemon Docker è caduto:

```bash
cd /home/user/AGB-Finder
docker info >/dev/null 2>&1 || { (sudo -n dockerd >/tmp/dockerd.log 2>&1 &) ; sleep 10; }
docker compose up -d && sleep 5
```

Poi il caso felice — **senza** alcuna password nell'ambiente:

```bash
cd /home/user/AGB-Finder && set -a && source .env && set +a
pnpm foto:colombo --dry-run 2>&1 | tail -8
```

Expected (qualche minuto, ~240 richieste Range):

```
▶ indicizzo 79 archivi COLOMBO…
  707 foto indicizzate
▶ abbinamento: 1728/3692 articoli (46.8%) con 320 foto · 9 copertine di gruppo
— dry run: né Blob né DB toccati
```

Poi **provare il rifiuto rosso**, che è ciò che il task aggiunge davvero:
aggiungere temporaneamente a `ARCHIVI` (in `foto-archivio.ts`) la riga
`"99_NonEsiste": { etichetta: null },`, rilanciare il comando sopra e
verificare che esca **non-zero** con `99_NonEsiste — 404 su /download/…`, che
NON stampi «foto indicizzate», e che dica «Niente è stato caricato». **Poi
togliere la riga** e rilanciare per confermare il verde.

- [ ] **Step 5: Commit**

```bash
cd /home/user/AGB-Finder
git add scripts/foto-colombo.ts .github/workflows/ops-foto-colombo.yml
git commit -F - <<'EOF'
fix(maniglie): la lista degli archivi si deriva da ARCHIVI, non dal sito

COLOMBO ha rifatto l'area download e l'indice dell'archivio fotografico non è
più pubblicato: `elencaArchivi()` raschiava quell'elenco, e il run ops moriva in
29 secondi. La lista viene ora dalle 79 chiavi di ARCHIVI, che era GIÀ
l'autorità — `if (!(archivio in ARCHIVI)) continue` esisteva già, quindi non si
scarica un file diverso da prima.

Cambia come si fallisce, ed è il punto: la transazione è atomica, quindi il
pericolo non era un crash ma un run VERDE con indice parziale, che stampa
`✓ N articoli con foto` con N più piccolo e non allarma nessuno. Ora un archivio
sparito, rinominato o VUOTO è un errore col nome, raccolto insieme agli altri e
sollevato prima di Blob e del DB. Nessun flag per proseguire: un archivio
ritirato si registra togliendo la sua riga dalla tabella.

La password esce dallo script e dal workflow nello stesso commit, guardia
`test -n` compresa: lasciarla avrebbe fatto fallire in zero secondi un run che
non ne ha più bisogno. Il secret resta, non referenziato.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LcPAMJoNyoYc3qpEhSjLbc
EOF
```

---

### Task 3: il run dichiara `prima → dopo` gli articoli con foto

Una copertura che cala per cause **nostre** — un listino nuovo, una regola sulle
finiture che si stringe, una voce `soloCopertina` aggiunta — non fa fallire
niente e nessun conteggio va a zero.

⚠️ **Nessuna soglia di abort**, ed è una decisione presa contro un advisor del
council: la PR #60 è passata **deliberatamente** da 2.118 a 1.609 foto (−24 %)
per togliere 350 immagini che mostravano la finitura di un altro codice. Una
guardia che vieta i cali avrebbe bloccato una decisione giusta. Il numero di
partenza si **dichiara**; non si usa per decidere.

Zero stato nuovo: **il DB è già il registro dell'ultimo run**.

**Files:**

- Modify: `scripts/foto-colombo.ts` (la query `db.article.findMany` intorno a
  riga 152, e la riga finale `✓ … articoli con foto`)

**Interfaces:**

- Consumes: `db` (il `PrismaClient` già creato nella `main`), `MARCA`
- Produces: niente

- [ ] **Step 1: Leggere il «prima» insieme agli articoli**

In `scripts/foto-colombo.ts`, subito dopo la `findMany` degli articoli:

```ts
// Il «prima» per la riga finale. Non è una soglia e non blocca nulla: la PR
// #60 fece scendere la copertura da 2.118 a 1.609 DI PROPOSITO, togliendo 350
// foto che mostravano la finitura di un altro codice. Un calo può essere la
// decisione giusta; quello che mancava era il numero di partenza, senza il
// quale il numero d'arrivo non si può leggere.
const conFotoPrima = await db.article.count({
  where: { brand: MARCA, imageUrl: { not: null } },
});
```

- [ ] **Step 2: Dichiararlo nella riga finale**

Sostituire la riga finale:

```ts
console.log(`✓ ${perArticolo.size} articoli con foto, ${articoli.length - perArticolo.size} senza`);
```

con:

```ts
const delta = perArticolo.size - conFotoPrima;
const segno = delta > 0 ? `+${delta}` : `${delta}`;
console.log(
  `✓ articoli con foto: ${conFotoPrima} → ${perArticolo.size} (${segno}), ` +
    `${articoli.length - perArticolo.size} senza`,
);
```

- [ ] **Step 3: Verificare sul DB vero**

```bash
cd /home/user/AGB-Finder && set -a && source .env && set +a
pnpm foto:colombo --dry-run 2>&1 | tail -4
```

Expected: il dry run esce prima di scrivere, quindi la riga `✓` non compare —
verificare invece che **`pnpm typecheck` sia verde**, che è ciò che prova che
`conFotoPrima` è usata e tipizzata:

```bash
cd /home/user/AGB-Finder && pnpm typecheck
```

Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
cd /home/user/AGB-Finder
git add scripts/foto-colombo.ts
git commit -F - <<'EOF'
feat(maniglie): il run dichiara prima → dopo gli articoli con foto

Una copertura che cala per cause nostre — un listino nuovo, una regola sulle
finiture che si stringe — non faceva fallire niente e nessun conteggio andava a
zero. Ora il run legge il «prima» dal DB, che è già il registro dell'ultimo run,
e lo stampa accanto al «dopo».

Nessuna soglia di abort, ed è deliberato: la PR #60 fece scendere la copertura
da 2.118 a 1.609 DI PROPOSITO. Una guardia che vieta i cali avrebbe bloccato una
decisione giusta. Il numero di partenza si dichiara, non decide.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LcPAMJoNyoYc3qpEhSjLbc
EOF
```

---

### Task 4: il pavimento sui cinque modelli del listino 2026

Le cinque righe `00a_Laconica`…`00e_Kubo` sono in `ARCHIVI` dalla sessione
scorsa e sono rimaste **inerti** perché il run non girava. Con questa PR
tornano vive, e serve un'asserzione che lo provi: un refuso in una di quelle
cinque righe lascerebbe i loro gruppi come tessere-parola, e **nessun conteggio
andrebbe a zero**.

È la stessa forma del test «i sette gruppi segnalati hanno una copertina» della
PR #61.

**Files:**

- Modify: `src/server/maniglie/foto-archivio.integration.test.ts` (aggiungere in
  fondo al `describe`, prima della `});` finale)

**Interfaces:**

- Consumes: `articoli`, `abbinati` (già preparati nel `beforeAll` del file),
  `browseLabel` e `previewDiGruppo` (già importati nel file)
- Produces: niente

- [ ] **Step 1: Write the failing test**

Aggiungere in fondo al `describe("foto ↔ catalogo vero", …)`:

```ts
/**
 * I CINQUE MODELLI DEL LISTINO VISION 2026, sul catalogo vero.
 *
 * Le loro righe in `ARCHIVI` sono state scritte quando i prodotti erano a
 * catalogo ma non a listino, e sono rimaste inerti finché il run delle foto
 * non è tornato a girare (2026-09-16). Un refuso in una di quelle cinque
 * righe lascerebbe il gruppo come tessera-parola, e nessun conteggio andrebbe
 * a zero — è la ragione per cui questo pavimento esiste.
 *
 * Espresso come proprietà e non come conteggio: HALO e KUBO sono coperti
 * PARZIALMENTE (5/25 e 10/30 sul listino puro) perché è la regola della
 * finitura che lavora, e il seed del gate aggiunge righe che spostano i
 * denominatori.
 */
it("i cinque modelli del listino 2026 hanno foto di riga e copertina", () => {
  for (const g of ["LACONICA", "ROBOT6", "ROBOT6 S", "HALO", "KUBO"]) {
    const conFoto = articoli.filter(
      (a) => browseLabel("COLOMBO", a.name) === g && abbinati.has(a.id),
    );
    expect(conFoto.length, `${g}: nessun articolo con foto`).toBeGreaterThan(0);
    expect(previewDiGruppo(g, abbinati.get(conFoto[0]!.id)!), g).not.toBeNull();
  }
});
```

- [ ] **Step 2: Run test to verify it fails for the right reason**

Il DB locale deve avere il listino vero **e** il delta Vision 2026. Se il
daemon Docker è caduto, rialzarlo prima:

```bash
cd /home/user/AGB-Finder
docker info >/dev/null 2>&1 || (sudo -n dockerd >/tmp/dockerd.log 2>&1 &) ; sleep 8
docker compose up -d && sleep 5
set -a && source .env && set +a
npx vitest run src/server/maniglie/foto-archivio.integration.test.ts -t "listino 2026"
```

Expected senza le due variabili d'ambiente: **skipped** (`describe.skipIf`).
Questo è il modo in cui il test può «passare a vuoto», e va visto una volta.

- [ ] **Step 3: Rigenerare l'indice e far girare il gate davvero**

```bash
cd /home/user/AGB-Finder && set -a && source .env && set +a
pnpm foto:colombo --dry-run --dump /tmp/claude-0/foto-index.json
INTEGRATION_DATABASE_URL="$DATABASE_URL" COLOMBO_FOTO_INDEX=/tmp/claude-0/foto-index.json \
  npx vitest run src/server/maniglie/foto-archivio.integration.test.ts
```

Expected: **16 test passati** (i 15 esistenti più il nuovo).

⚠️ Se il DB non ha gli articoli Vision 2026, il test fallisce su `LACONICA` con
«nessun articolo con foto». In quel caso importare il delta prima
(`pnpm import:vision COLOMBO <pdf>`), **non** allentare il test.

- [ ] **Step 4: Provarlo rosso**

Cambiare temporaneamente `"00a_Laconica": { etichetta: "LACONICA" }` in
`{ etichetta: "LACONICAX" }` in `foto-archivio.ts` e rilanciare il comando dello
Step 3.

Expected: FAIL — su `LACONICA: nessun articolo con foto` **oppure** sul test
preesistente «ogni etichetta della tabella esiste davvero fra quelle dello
sfoglio». **Poi rimettere il valore giusto** e riconfermare il verde.

- [ ] **Step 5: Commit**

```bash
cd /home/user/AGB-Finder
git add src/server/maniglie/foto-archivio.integration.test.ts
git commit -F - <<'EOF'
test(maniglie): il pavimento sui cinque modelli del listino 2026

Le righe 00a_Laconica…00e_Kubo sono in ARCHIVI dalla sessione scorsa e sono
rimaste inerti perché il run delle foto non girava. Ora tornano vive, e un
refuso in una di quelle cinque righe lascerebbe il gruppo come tessera-parola
senza che nessun conteggio vada a zero.

Proprietà e non conteggio: HALO e KUBO sono coperti parzialmente perché è la
regola della finitura che lavora, e il seed del gate sposta i denominatori.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LcPAMJoNyoYc3qpEhSjLbc
EOF
```

---

### Task 5: `vigilanza.ts`, il modulo puro che legge l'indice dei documenti

Il segnale «COLOMBO ha pubblicato qualcosa di nuovo» si sposta sull'unica
superficie che il fornitore mantiene viva: l'indice pubblico dei documenti
dell'area download. Qui nasce la parte **pura e testabile**: due parser e un
diff, senza rete.

Le due forme di HTML sono state misurate il 2026-09-16 sul sito vero:

- homepage → `href="mostra.php?lang=en&catalogo=161">…Vision 2026 catalogue</a>`
- pagina categoria → `href="/download/maniglie/pdf/Vision2026_maniglie_catalogo_100726.pdf"`

**Files:**

- Create: `src/server/maniglie/vigilanza.ts`
- Test: `src/server/maniglie/vigilanza.test.ts`

**Interfaces:**

- Consumes: niente
- Produces:

  ```ts
  export interface Categoria {
    id: string;
    titolo: string;
  }
  export type Indice = Record<string, { titolo: string; file: string[] }>;
  export function parseCategorie(html: string): Categoria[];
  export function parseDocumenti(html: string): string[];
  export function confronta(attuale: Indice, atteso: Indice): string[];
  ```

  Il Task 6 usa tutte e tre.

- [ ] **Step 1: Write the failing test**

Creare `src/server/maniglie/vigilanza.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseCategorie, parseDocumenti, confronta, type Indice } from "./vigilanza";

describe("parseCategorie", () => {
  it("legge id e titolo dai link dell'indice", () => {
    const html = `
      <li><a href="mostra.php?lang=en&catalogo=161"><span class="x">.</span> Vision 2026 catalogue</a></li>
      <li><a href="mostra.php?lang=en&catalogo=152"> RR catalogue 2026</a></li>`;
    expect(parseCategorie(html)).toEqual([
      { id: "161", titolo: ". Vision 2026 catalogue" },
      { id: "152", titolo: "RR catalogue 2026" },
    ]);
  });

  it("deduplica gli id: la stessa categoria può comparire due volte", () => {
    const html = `<a href="mostra.php?lang=en&catalogo=161">A</a>
                  <a href="mostra.php?lang=en&catalogo=161">A</a>`;
    expect(parseCategorie(html)).toHaveLength(1);
  });

  it("su una pagina che non è l'indice non trova niente", () => {
    expect(parseCategorie("<html><body>niente</body></html>")).toEqual([]);
  });
});

describe("parseDocumenti", () => {
  /**
   * Si prende QUALUNQUE file sotto /download/, non i soli PDF: se COLOMBO
   * ripubblicasse l'indice degli archivi, uno `.zip` comparirebbe qui e il
   * confronto lo direbbe da sé. È l'intento dello scraper che NON abbiamo
   * riscritto, senza lo scraper.
   */
  it("prende qualunque file sotto /download/, non i soli PDF", () => {
    const html = `<a href="/download/maniglie/pdf/Vision2026.pdf">x</a>
                  <a href="/download/maniglie/archivio/01_Fedra.zip">y</a>
                  <a href="http://www.colombodesign.com/contatti/">z</a>`;
    expect(parseDocumenti(html)).toEqual([
      "/download/maniglie/archivio/01_Fedra.zip",
      "/download/maniglie/pdf/Vision2026.pdf",
    ]);
  });

  it("ordina e deduplica, così il confronto non dipende dall'ordine dell'HTML", () => {
    const html = `<a href="/download/b.pdf">b</a><a href="/download/a.pdf">a</a><a href="/download/b.pdf">b</a>`;
    expect(parseDocumenti(html)).toEqual(["/download/a.pdf", "/download/b.pdf"]);
  });
});

describe("confronta", () => {
  const atteso: Indice = {
    "161": { titolo: "Vision 2026 catalogue", file: ["/download/v.pdf"] },
    "152": { titolo: "RR catalogue 2026", file: ["/download/rr.pdf"] },
  };

  it("non dice niente quando combaciano", () => {
    expect(confronta({ ...atteso }, atteso)).toEqual([]);
  });

  it("nomina una categoria nuova", () => {
    const attuale = { ...atteso, "170": { titolo: "Vision 2027", file: ["/download/v27.pdf"] } };
    expect(confronta(attuale, atteso)).toEqual([
      "NUOVA categoria 170: «Vision 2027» → /download/v27.pdf",
    ]);
  });

  it("nomina una categoria sparita", () => {
    const { "152": _tolta, ...attuale } = atteso;
    expect(confronta(attuale, atteso)).toEqual(["SPARITA categoria 152: «RR catalogue 2026»"]);
  });

  /**
   * Il titolo che cambia È il segnale: «ER catalogue 2026» → «2027» è come
   * veniamo a sapere che esiste un'edizione nuova. Non si filtra.
   */
  it("nomina un titolo cambiato", () => {
    const attuale = {
      ...atteso,
      "152": { titolo: "RR catalogue 2027", file: ["/download/rr.pdf"] },
    };
    expect(confronta(attuale, atteso)).toEqual([
      "CAMBIATO titolo di 152: «RR catalogue 2026» → «RR catalogue 2027»",
    ]);
  });

  it("nomina i file cambiati, che è come si vede una ristampa", () => {
    const attuale = {
      ...atteso,
      "152": { titolo: "RR catalogue 2026", file: ["/download/rr2.pdf"] },
    };
    expect(confronta(attuale, atteso)).toEqual([
      "CAMBIATI i file di 152 «RR catalogue 2026»: /download/rr.pdf → /download/rr2.pdf",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/user/AGB-Finder && npx vitest run src/server/maniglie/vigilanza.test.ts
```

Expected: FAIL — `Failed to resolve import "./vigilanza"`.

- [ ] **Step 3: Write the implementation**

Creare `src/server/maniglie/vigilanza.ts`:

```ts
/**
 * L'INDICE PUBBLICO DEI DOCUMENTI DELL'AREA DOWNLOAD COLOMBO.
 *
 * Perché esiste: fino al 2026-09 sapevamo dei prodotti nuovi perché
 * `foto:colombo` raschiava l'elenco degli archivi fotografici e segnalava
 * quelli non in tabella — così comparvero i cinque modelli 2026, mesi prima
 * del listino. COLOMBO ha rifatto il sito e quell'elenco non esiste più.
 *
 * L'indice dei documenti è la superficie che il fornitore mantiene viva, è
 * PUBBLICA (nessuna password) ed è di fatto il segnale che ha fatto partire le
 * ultime due sessioni: `Vision 2026 catalogue` ed `ER catalogue 2026` sono lì.
 *
 * Il modulo è PURO — due parser e un diff, niente rete — perché un rilevatore
 * che non si può osservare mentre rileva è un commento che costa CI. La rete
 * sta in `scripts/vigila-colombo.ts`.
 */

/** Una voce dell'indice: `mostra.php?lang=en&catalogo=<id>` più il suo titolo. */
export interface Categoria {
  id: string;
  titolo: string;
}

/** Lo stato dell'area download: id → titolo e file pubblicati. */
export type Indice = Record<string, { titolo: string; file: string[] }>;

/**
 * Le categorie dell'indice, dall'HTML della homepage.
 *
 * Il titolo si ripulisce dal markup e dagli spazi, ma NON dai caratteri
 * decorativi che COLOMBO ci mette dentro: se un giorno li togliesse, è un
 * cambiamento del sito e vogliamo saperlo.
 */
export function parseCategorie(html: string): Categoria[] {
  const out = new Map<string, Categoria>();
  for (const m of html.matchAll(
    /href="mostra\.php\?lang=en&catalogo=(\d+)"[^>]*>([\s\S]*?)<\/a>/g,
  )) {
    const id = m[1]!;
    if (out.has(id)) continue;
    const titolo = m[2]!
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    out.set(id, { id, titolo });
  }
  return [...out.values()];
}

/**
 * I file pubblicati da una pagina di categoria: QUALUNQUE cosa sotto
 * `/download/`, non i soli PDF.
 *
 * Il «non i soli PDF» è deliberato e vale quanto il resto: se COLOMBO
 * ripubblicasse l'indice dell'archivio fotografico, i suoi `.zip` comparirebbero
 * qui e il confronto li nominerebbe. È l'intento dello scraper che abbiamo
 * scartato — una regex ritagliata su un markup che non esiste più — ottenuto
 * senza lo scraper, e osservabile: questo codice trova qualcosa tutte le
 * settimane, quindi si sa che funziona.
 */
export function parseDocumenti(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="(\/download\/[^"]+)"/g)) out.add(m[1]!);
  return [...out].sort();
}

/**
 * Le differenze fra ciò che il sito mostra e ciò che il repo si aspetta, in
 * righe leggibili. Vuoto = niente di nuovo.
 *
 * Non filtra nulla: un titolo che cambia («ER catalogue 2026» → «2027») È il
 * segnale, e filtrarlo vorrebbe dire indovinare quale cambiamento conta.
 */
export function confronta(attuale: Indice, atteso: Indice): string[] {
  const righe: string[] = [];
  for (const id of Object.keys(attuale).sort()) {
    const a = attuale[id]!;
    const b = atteso[id];
    if (b === undefined) {
      righe.push(`NUOVA categoria ${id}: «${a.titolo}» → ${a.file.join(", ")}`);
      continue;
    }
    if (a.titolo !== b.titolo) {
      righe.push(`CAMBIATO titolo di ${id}: «${b.titolo}» → «${a.titolo}»`);
    }
    if (a.file.join("|") !== b.file.join("|")) {
      righe.push(
        `CAMBIATI i file di ${id} «${a.titolo}»: ${b.file.join(", ")} → ${a.file.join(", ")}`,
      );
    }
  }
  for (const id of Object.keys(atteso).sort()) {
    if (!(id in attuale)) righe.push(`SPARITA categoria ${id}: «${atteso[id]!.titolo}»`);
  }
  return righe;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/user/AGB-Finder && npx vitest run src/server/maniglie/vigilanza.test.ts
```

Expected: PASS — 9 test.

- [ ] **Step 5: Commit**

```bash
cd /home/user/AGB-Finder
git add src/server/maniglie/vigilanza.ts src/server/maniglie/vigilanza.test.ts
git commit -F - <<'EOF'
feat(maniglie): vigilanza.ts, i parser e il diff dell'indice documenti COLOMBO

La parte pura del guardiano che sostituisce il segnale perduto: due parser e un
confronto, senza rete, perché un rilevatore che non si può osservare mentre
rileva è un commento che costa CI.

`parseDocumenti` prende qualunque file sotto /download/ e non i soli PDF: se
COLOMBO ripubblicasse l'indice dell'archivio fotografico, i suoi .zip
comparirebbero e il confronto li nominerebbe. È l'intento dello scraper
scartato — la sua regex pretendeva gli apici singoli di un markup che non
esiste più — ottenuto senza lo scraper, e osservabile.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LcPAMJoNyoYc3qpEhSjLbc
EOF
```

---

### Task 6: lo snapshot committato e `pnpm vigila:colombo`

Lo stato atteso vive nel repo come modulo TypeScript — non come JSON letto da
disco — per la stessa ragione per cui `ARCHIVI` è un modulo: viene
typecheckato, e la ratifica di un cambiamento è un commit datato che passa da
review.

⚠️ **Zero categorie è un ERRORE, mai «nessuna novità».** È esattamente la
guardia che il 2026-09-15 ha fatto morire `foto:colombo` in 29 secondi senza
toccare Blob né DB, ed è il pezzo di questa storia che ha funzionato. Senza, il
giorno che COLOMBO rifà il sito un'altra volta il guardiano direbbe «tutto a
posto» per sempre.

**Files:**

- Create: `src/server/maniglie/documenti-colombo.ts`
- Create: `scripts/vigila-colombo.ts`
- Modify: `package.json` (aggiungere lo script `vigila:colombo` dopo
  `foto:colombo`)

**Interfaces:**

- Consumes: `parseCategorie`, `parseDocumenti`, `confronta`, `type Indice` dal
  Task 5
- Produces: `export const DOCUMENTI: Indice` da
  `src/server/maniglie/documenti-colombo.ts`; lo script `pnpm vigila:colombo`,
  usato dal workflow del Task 7.

- [ ] **Step 1: Scrivere lo script**

Creare `scripts/vigila-colombo.ts`:

```ts
// Il guardiano dell'area download COLOMBO.
//
// Confronta l'indice pubblico dei documenti con lo stato registrato in
// `src/server/maniglie/documenti-colombo.ts` ed esce NON-ZERO su qualunque
// differenza. Non stampa e prosegue: un run schedulato che fallisce manda una
// mail al proprietario del repo, e quella è la differenza fra un segnale e una
// riga di log — il segnale precedente viveva in uno scrollback e si è perso.
//
// Nessuna password: le pagine dell'area download rispondono a una GET nuda.
//
// Uso:
//   pnpm vigila:colombo             # confronta ed esce non-zero se differisce
//   pnpm vigila:colombo --aggiorna  # stampa il blocco da incollare nel modulo
import { DOCUMENTI } from "../src/server/maniglie/documenti-colombo";
import {
  confronta,
  parseCategorie,
  parseDocumenti,
  type Indice,
} from "../src/server/maniglie/vigilanza";

const BASE = "https://download.colombodesign.com";

async function pagina(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} su ${url}`);
  return res.text();
}

async function main() {
  const aggiorna = process.argv.includes("--aggiorna");

  const categorie = parseCategorie(await pagina(`${BASE}/`));
  // Zero categorie NON è «nessuna novità»: è il sito che è cambiato di nuovo.
  // Senza questa riga il guardiano direbbe «tutto a posto» per sempre — cioè
  // ricadrebbe nella classe di difetto che è nato per correggere.
  if (categorie.length === 0) {
    throw new Error(
      "Nessuna categoria nell'indice dell'area download: la pagina è cambiata. " +
        "Aggiornare parseCategorie in src/server/maniglie/vigilanza.ts.",
    );
  }
  console.log(`▶ ${categorie.length} categorie nell'indice`);

  const attuale: Indice = {};
  for (const c of categorie) {
    const file = parseDocumenti(await pagina(`${BASE}/mostra.php?lang=en&catalogo=${c.id}`));
    attuale[c.id] = { titolo: c.titolo, file };
  }

  if (aggiorna) {
    console.log("\n// ── da incollare in src/server/maniglie/documenti-colombo.ts ──");
    console.log(`export const DOCUMENTI: Indice = ${JSON.stringify(attuale, null, 2)};`);
    return;
  }

  const righe = confronta(attuale, DOCUMENTI);
  if (righe.length === 0) {
    console.log("✓ l'area download COLOMBO è come la conosciamo");
    return;
  }
  console.log(`\n▶ ${righe.length} novità nell'area download COLOMBO:\n`);
  for (const r of righe) console.log(`  ${r}`);
  console.log(
    "\nSe sono cambiamenti attesi, ratificarli con:\n" +
      "  pnpm vigila:colombo --aggiorna\n" +
      "e committare il blocco in src/server/maniglie/documenti-colombo.ts.\n" +
      "⚠️ Un CATALOGO o un LISTINO nuovo qui significa prodotti nuovi da COLOMBO.",
  );
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Registrare lo script in `package.json`**

Nella sezione `"scripts"`, subito dopo la riga `"foto:colombo": …`:

```json
    "vigila:colombo": "tsx --env-file-if-exists=.env scripts/vigila-colombo.ts",
```

⚠️ La riga `"foto:colombo"` è l'ultima della sezione e non ha la virgola:
aggiungergliela.

- [ ] **Step 3: Creare il modulo con uno snapshot VUOTO, e vederlo rosso**

Creare `src/server/maniglie/documenti-colombo.ts`:

```ts
import type { Indice } from "./vigilanza";

/**
 * LO STATO REGISTRATO DELL'AREA DOWNLOAD COLOMBO — id di categoria → titolo e
 * file pubblicati. Misurato il 2026-09-16 con `pnpm vigila:colombo --aggiorna`.
 *
 * È un modulo e non un JSON per la stessa ragione per cui `ARCHIVI` è un
 * modulo: viene typecheckato, e la ratifica di un cambiamento è un commit
 * datato che passa da review invece di un file riscritto dalla CI.
 *
 * Titoli e indirizzi sono PUBBLICI: COLOMBO li serve senza password. È lo
 * stesso confine di `ARCHIVI` — i nomi sì, i byte no.
 */
export const DOCUMENTI: Indice = {};
```

Poi:

```bash
cd /home/user/AGB-Finder && pnpm vigila:colombo; echo "exit=$?"
```

Expected: `▶ 29 categorie nell'indice`, poi **29 righe `NUOVA categoria …`** e
`exit=1`. È il guardiano che funziona: con lo stato vuoto, tutto è nuovo.

- [ ] **Step 4: Registrare lo stato vero e vederlo verde**

```bash
cd /home/user/AGB-Finder && pnpm vigila:colombo --aggiorna
```

Copiare il blocco stampato (dalla riga `export const DOCUMENTI` in giù) dentro
`src/server/maniglie/documenti-colombo.ts`, **sostituendo** `export const
DOCUMENTI: Indice = {};` e **tenendo** l'import e il commento in testa. Poi:

```bash
cd /home/user/AGB-Finder && pnpm vigila:colombo; echo "exit=$?"
pnpm typecheck
```

Expected: `✓ l'area download COLOMBO è come la conosciamo`, `exit=0`, typecheck
verde.

- [ ] **Step 5: Provare che si accorge di una novità**

Cancellare a mano **una** voce dallo snapshot (per esempio la `"161"`),
rilanciare, e verificare `NUOVA categoria 161: «… Vision 2026 catalogue» → …`
con `exit=1`. **Poi rimetterla** e riconfermare il verde.

- [ ] **Step 6: Commit**

```bash
cd /home/user/AGB-Finder
git add src/server/maniglie/documenti-colombo.ts scripts/vigila-colombo.ts package.json
git commit -F - <<'EOF'
feat(maniglie): pnpm vigila:colombo, e lo stato registrato dell'area download

Lo snapshot vive nel repo come modulo TypeScript, non come JSON riscritto dalla
CI: viene typecheckato, e ratificare un cambiamento è un commit datato che passa
da review — la stessa forma di ARCHIVI. Titoli e indirizzi sono pubblici, il
fornitore li serve senza password.

Zero categorie è un ERRORE e non «nessuna novità»: è la guardia che il 15/09 ha
fatto morire foto:colombo in 29 secondi senza toccare Blob né DB, cioè il pezzo
di quella storia che ha funzionato. Senza, il giorno che COLOMBO rifà il sito
un'altra volta il guardiano direbbe «tutto a posto» per sempre.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LcPAMJoNyoYc3qpEhSjLbc
EOF
```

---

### Task 7: il workflow schedulato — il recapito, che è la parte che conta

Un `console.log` in un run manuale è precisamente il meccanismo che ha fatto
perdere il segnale. Un run **schedulato che fallisce** manda una mail al
proprietario del repo, senza scrivere una riga di integrazione e senza permessi
nuovi — e resta rosso ogni settimana finché qualcuno non ratifica.

Sarà il **primo workflow `schedule:` del repo**.

**Files:**

- Create: `.github/workflows/ops-vigila-colombo.yml`

**Interfaces:**

- Consumes: `pnpm vigila:colombo` dal Task 6
- Produces: niente

- [ ] **Step 1: Scrivere il workflow**

Creare `.github/workflows/ops-vigila-colombo.yml`:

```yaml
name: Ops — Vigila COLOMBO (indice pubblico dei documenti)
# Il segnale «COLOMBO ha pubblicato qualcosa di nuovo».
#
# Fino al 2026-09 arrivava come riga di log dentro `foto:colombo`, che gira a
# mano: ha funzionato una volta, perché chi lanciava il run era la stessa
# persona che leggeva il log. Qui il recapito È il fallimento — un run
# schedulato rosso manda la mail al proprietario del repo.
#
# Nessun secret: le pagine dell'area download rispondono a una GET nuda.
#
# Il rumore è accettato e dichiarato: se COLOMBO aggiunge un PDF qualunque il
# job diventa rosso, e si ratifica con `pnpm vigila:colombo --aggiorna` più un
# commit. Non si filtra, perché un titolo che cambia («ER catalogue 2026» →
# «2027») È il segnale.
on:
  schedule:
    # lunedì alle 06:00 UTC. ⚠️ GitHub disattiva i workflow schedulati dopo 60
    # giorni di inattività del repo: se smette di girare, è questo.
    - cron: "0 6 * * 1"
  workflow_dispatch:
jobs:
  vigila:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Enable corepack (pnpm 10)
        run: corepack enable
      - name: Install deps
        run: pnpm install --frozen-lockfile
      - name: Confronta l'indice dei documenti con quello registrato
        run: pnpm vigila:colombo
```

- [ ] **Step 2: Verificare che il workflow sia YAML valido e che il comando esista**

```bash
cd /home/user/AGB-Finder
npx js-yaml .github/workflows/ops-vigila-colombo.yml >/dev/null && echo "YAML ok"
pnpm vigila:colombo; echo "exit=$?"
```

Expected: `YAML ok`, poi `✓ l'area download COLOMBO è come la conosciamo` con
`exit=0`.

Se `js-yaml` non è disponibile, va bene anche:

```bash
cd /home/user/AGB-Finder && node -e "require('fs').readFileSync('.github/workflows/ops-vigila-colombo.yml','utf8')" && grep -c "cron" .github/workflows/ops-vigila-colombo.yml
```

Expected: `1`.

- [ ] **Step 3: Commit**

```bash
cd /home/user/AGB-Finder
git add .github/workflows/ops-vigila-colombo.yml
git commit -F - <<'EOF'
feat(ops): il guardiano settimanale dell'area download COLOMBO

Il recapito è la parte che conta: fino a ieri il segnale «COLOMBO ha pubblicato
qualcosa» viveva come riga di log dentro un run manuale, e ha funzionato una
volta sola — perché chi lanciava il run era la stessa persona che leggeva il
log. Qui il recapito è il fallimento: un run schedulato rosso manda la mail al
proprietario del repo, senza un servizio in più e senza secret.

Primo workflow `schedule:` del repo. Il rumore è accettato e dichiarato: un PDF
nuovo lo fa diventare rosso, e si ratifica con --aggiorna più un commit. Non si
filtra, perché un titolo che cambia È il segnale.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LcPAMJoNyoYc3qpEhSjLbc
EOF
```

---

### Task 8: le domande per COLOMBO

Due nuove, e una prova in più su una che c'era già. Il canale umano è l'unico
che può restituire il **tempo di anticipo** che il segnale perduto dava.

**Files:**

- Modify: `docs/superpowers/domande-colombo.md` (la tabella «In sintesi», la
  scheda C1, e due schede nuove in fondo prima della sezione «La tabella dei 270
  codici»)

**Interfaces:**

- Consumes: niente
- Produces: niente

- [ ] **Step 1: Aggiungere le due righe alla tabella «In sintesi»**

Dopo la riga `C6`:

```markdown
| C7 | Dov'è l'indice dell'archivio fotografico? | COLOMBO | 🟡 la scoperta di archivi nuovi |
| C8 | Come ci fate sapere di un prodotto nuovo? | COLOMBO | 🔴 il **preavviso** sui prodotti nuovi |
```

- [ ] **Step 2: Aggiungere la prova nuova alla scheda C1**

Nella scheda `## 🔴 C1`, dopo il paragrafo «**Il fatto misurato.**», inserire:

```markdown
**Una prova in più, 2026-09-16.** Indicizzando gli archivi fotografici dei
prodotti 2026 si vede che COLOMBO nomina i propri file con la forma **`HPS1`**,
in entrambi gli archivi interessati (Laconica e Halo). ⚠️ **Non chiude la
domanda**: il nome del file dichiara la **finitura**, non la coda del **codice
d'ordine**, e la pronta consegna di Andrea contiene comunque entrambe le forme
(`0AM41RHPS1` per la Laconica, `0AM15FISSOI1` per la Halo). Sposta il peso
dell'evidenza, non la decide — e questa è esattamente la distinzione che il
§9 protegge.
```

- [ ] **Step 3: Aggiungere le due schede nuove**

Prima della sezione `## La tabella dei 270 codici`:

```markdown
## 🟡 C7 — Dov'è l'indice dell'archivio fotografico, adesso?

**Il fatto misurato (2026-09-15/16).** L'area download è stata rifatta: non è
più un elenco piatto di file ma un indice di **29 categorie**, che pubblicano
**solo PDF**. Gli zip dell'archivio fotografico **ci sono ancora e rispondono**
(79 su 79, e senza password), ma il loro **elenco non è pubblicato in nessuna
pagina**, e la directory risponde `403`.

**Conseguenza oggi.** Le foto continuano ad arrivare, perché la lista dei 79
archivi la teniamo noi. Ma **un archivio nuovo non è più scopribile**: i cinque
modelli del 2026 li avevamo visti mesi prima del listino proprio così.

**E serve anche per il recupero**: il giorno in cui un archivio venisse
rinominato, il run lo direbbe col nome — ma non avremmo alcun modo di scoprire
il nome nuovo.

**Come porla.** _«L'archivio fotografico non compare più fra le categorie
dell'area download: c'è un indice, un feed o un contatto a cui chiederlo?»_

---

## 🔴 C8 — Come ci fate sapere che esce un prodotto nuovo?

**Perché è la più importante delle otto.** Il preavviso sui prodotti nuovi ci
arrivava per **effetto collaterale di uno script di conversione immagini**. È
un'informazione commerciale — chi rifornisce il magazzino la vuole — e non
dovrebbe dipendere da come è fatto l'HTML del sito del fornitore.

**Cosa abbiamo messo al suo posto, nel frattempo.** Un controllo settimanale
dell'indice pubblico dei documenti (`pnpm vigila:colombo`): un catalogo o un
listino nuovo compare lì, ed è di fatto ciò che ha fatto partire le ultime due
sessioni di lavoro. Ma arriva quando COLOMBO **pubblica**, non quando **decide**.

**Come porla.** _«C'è un modo per essere avvisati quando uscite con un prodotto
o una finitura nuova — una mailing list, il vostro agente di zona, un'area
riservata? Oggi ce ne accorgiamo dal sito.»_
```

- [ ] **Step 4: Verificare**

```bash
cd /home/user/AGB-Finder && grep -c "^## " docs/superpowers/domande-colombo.md
```

Expected: `9` (In sintesi + C1…C8).

- [ ] **Step 5: Commit**

```bash
cd /home/user/AGB-Finder
git add docs/superpowers/domande-colombo.md
git commit -F - <<'EOF'
docs: C7 e C8 per COLOMBO, e una prova in più sulla C1

C7: l'indice dell'archivio fotografico non è più pubblicato. Serve alla
scoperta di archivi nuovi e al recupero: se un archivio venisse rinominato il
run lo direbbe col nome, ma non avremmo modo di scoprire il nome nuovo.

C8 è la più importante delle otto: il preavviso sui prodotti nuovi ci arrivava
per effetto collaterale di uno script di conversione immagini. È
un'informazione commerciale, e non deve dipendere dall'HTML del fornitore.

C1: gli archivi 2026 nominano i file con la forma HPS1 in entrambi i casi. Non
chiude la domanda — il nome del file dichiara la finitura, non la coda del
codice d'ordine — e la distinzione è esattamente quella che il §9 protegge.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LcPAMJoNyoYc3qpEhSjLbc
EOF
```

---

### Task 9: gate completo e aggiornamento dei `.md`

**Files:**

- Modify: `handoff.md` (nuova sezione «Sessione attuale» in testa, la precedente
  degradata a «Sessione precedente»)
- Modify: `CLAUDE.md` (una voce nuova in fondo allo §STATO)

**Interfaces:**

- Consumes: i risultati dei gate
- Produces: niente

- [ ] **Step 1: Gate completo**

```bash
cd /home/user/AGB-Finder && set -a && source .env && set +a
pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -5
```

Expected: typecheck e lint verdi; **almeno 1.667 test passati** (1.655 di
baseline + 3 di `urlArchivio` + 9 di `vigilanza`), zero falliti.

```bash
cd /home/user/AGB-Finder && pnpm build 2>&1 | tail -5
```

Expected: build completata. ⚠️ Non lanciare `pnpm build` mentre gira `pnpm dev`:
condividono `.next` e il dev server serve 404 su tutti i chunk.

- [ ] **Step 2: Gate d'integrazione**

```bash
cd /home/user/AGB-Finder && set -a && source .env && set +a
pnpm foto:colombo --dry-run --dump /tmp/claude-0/foto-index.json
INTEGRATION_DATABASE_URL="$DATABASE_URL" COLOMBO_FOTO_INDEX=/tmp/claude-0/foto-index.json \
  npx vitest run src/server/maniglie/foto-archivio.integration.test.ts
```

Expected: **16 test passati**.

- [ ] **Step 3: Aggiornare `handoff.md` e `CLAUDE.md`**

Nella sezione «Sessione attuale» di `handoff.md` devono comparire, con i numeri
**misurati e non attesi**: la decisione (lista da `ARCHIVI`), le tre affermazioni
degli advisor cadute, il costo dichiarato (archivio nuovo non più scopribile),
il guardiano settimanale e come si ratifica, e le **azioni ops**:

> 🟢 **NESSUNA MIGRAZIONE.** 🔴 **UN RUN OPS**: «Ops — Foto COLOMBO», atteso
> `1.609 → 1.727` articoli con foto, ~16 file nuovi su Blob, 79/79 archivi.

In `CLAUDE.md`, una voce in fondo allo §STATO con la stessa sostanza in forma
breve, e **l'aggiornamento della riga sull'area download**, che oggi dice che
l'archivio fotografico si prende con richieste Range sull'indice dei 79 zip: va
detto che l'indice non esiste più e la lista viene da `ARCHIVI`.

- [ ] **Step 4: Commit**

```bash
cd /home/user/AGB-Finder
git add handoff.md CLAUDE.md
git commit -F - <<'EOF'
docs: handoff e CLAUDE.md — l'indice che non c'è più, e cosa lo sostituisce

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LcPAMJoNyoYc3qpEhSjLbc
EOF
```

- [ ] **Step 5: Review indipendente del branch, prima della PR**

Regola permanente del progetto. Il revisore deve avere **almeno** questi punti
sott'occhio:

1. `urlArchivio` non codifica, e `scarica`/`dimensione` codificano una volta
   sola: cercare un `encodeURI` doppio.
2. Il rifiuto sta **prima** di ogni `put()` su Blob e prima della
   `db.$transaction`: leggere l'ordine, non fidarsi del commento.
3. Nessun `process.env.COLOMBO_DOWNLOAD_PASSWORD` residuo nel repo
   (`grep -rn COLOMBO_DOWNLOAD_PASSWORD --include='*.ts' --include='*.yml'`);
   atteso: **zero occorrenze** fuori dai `.md`.
4. `documenti-colombo.ts` non contiene niente di riservato: solo id, titoli e
   path pubblici.
5. `confronta()` non ha un ramo che esce silenziosamente: un `Indice` vuoto da
   una parte deve produrre righe, non `[]`.
6. Il gate d'integrazione **non si salta**: `describe.skipIf` è verde a vuoto
   senza le due variabili, e va verificato che siano state passate.

---

## Ops al merge

**Nessuna migrazione, nessuna finestra di disservizio**, quindi non serve la
regola «run sul ref del branch prima del merge» (quella serve alle migrazioni,
dove il DB deve precedere il codice).

Un run di **«Ops — Foto COLOMBO»** (~7 minuti, idempotente). Atteso, misurato in
locale sul catalogo vero il 2026-09-16:

|                   | atteso                           |
| ----------------- | -------------------------------- |
| archivi           | `79/79`, zero mancanti           |
| foto indicizzate  | `707`                            |
| Blob              | ~16 caricate · ~304 già presenti |
| articoli con foto | `1.609 → 1.727`                  |

Poi, a mano una volta, **«Ops — Vigila COLOMBO»** per confermare che il
guardiano parte verde da CI e non solo dal container.

Verifica funzionale in produzione: aprire `/maniglie?tipo=LACONICA` e
`/maniglie?tipo=KUBO` — tessera con copertina, righe con miniatura, e a **375px**
senza segnaposto rotti.
