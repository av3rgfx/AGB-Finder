# Scontistica cliente — design

> Spec del 2026-07-30. Stato: **approvata dall'utente**, da implementare.
> Priorità 1 della roadmap fissata in `2026-07-29-kit-geometrie-e-schemi-cliente-design.md` §4.1.

---

## 1. Il problema

I totali che il programma mostra su una distinta sono il **lordo di listino AGB**, cioè quello
che UFPtrade paga al fornitore — non quello che il cliente paga a UFPtrade. Un agente che apre
una richiesta legge `90,20 €` e non è la cifra che dirà al telefono. Manca l'ultimo passaggio,
ed è quello che rende il numero utilizzabile.

## 2. Cosa esiste davvero oggi (verificato, non assunto)

### 2.1 `Customer` è un modello fantasma

La tabella `customers` esiste con tutti i campi (`companyName`, `vatNumber`, `discount`,
`priceList`, `paymentTerms`, indirizzo, referente). **Non esiste alcun router `customer`,
nessuna CRUD, nessuna schermata.** `kit.create` non accetta un `customerId`: l'unico punto del
codice che tocca quella colonna è il ricalcolo versionato (`kit.ts:218`), che si limita a
ricopiarla. Quindi `kit_requests.customer_id` è **sempre NULL** in produzione, e la dashboard
mostra un `customer.companyName` che non arriva mai.

Conclusione: le colonne a schema fanno risparmiare **una migrazione**, non metà del lavoro.

### 2.2 Il listino ha 34 classi di sconto, e le nostre distinte ne toccano due

Il listino AGB pubblica una **classe di sconto per articolo** (colonna `[A-Z]\d`), che il parser
già cattura (`parse-listino.ts`, gruppo 5 della firma di riga) e salva in
`Product.specifications.classeSconto`; la scheda prodotto la mostra già («Classe sconto»).

Applicando la firma di riga del parser reale a tutte le 959 pagine del listino 2026:

- **7.488 codici unici a prezzo** (identico al conteggio dell'import su Neon → la lettura è la stessa);
- **34 classi distinte**, da `H1` (1.933 righe) a `H4` (1 riga).

Che classe hanno i codici che il motore emette davvero:

| Distinta | Codici risolti | Classe |
|---|---|---|
| Golden anta-ribalta (16 righe, 90,20 €) | 16 / 16 | **F3** |
| Le 7 geometrie ARTECH (MC · Peruzzi · Fosca) | 13 / 13 | **F3** |
| Bilico rettangolare TOUR | 32 / 32 | **T1** |

**Dentro una distinta la classe è uniforme; fra le due serie cambia.**

### 2.3 Conseguenza dichiarata: un'unica percentuale è una semplificazione, e va scritta

Uno sconto unico per cliente applica **la stessa percentuale a un'anta-ribalta ARTECH (F3) e a
un bilico TOUR (T1)**. Se il fornitore o l'azienda differenziano per classe, il numero mostrato
su un bilico è sbagliato — e i bilici stanno fra 433 € e 766 €, quindi cinque punti di scarto
valgono ~20-38 € a serramento.

È la stessa forma dei difetti chiusi dalla bonifica del 2026-07-25 e dal lavoro sull'entrata:
un valore raccolto, salvato, applicato e **sbagliato in silenzio** dove nessuno guarda.

**Decisione dell'utente (2026-07-30): sconto unico per cliente.** Non è un'assunzione presa di
nascosto: è una scelta informata da questi dati. Si registra qui, e sopravvive come
**domanda 28** in `kit-assunzioni/DOMANDE-APERTE.md`, perché il giorno in cui la risposta
cambia il modello dati deve cambiare con lei.

*Il disegno lascia la porta aperta senza pagarla oggi*: la percentuale sta su una colonna
propria della richiesta, non nel prezzo delle righe. Passare in futuro a una tabella
cliente × classe significa cambiare **come si calcola** `discountPercent`, non ricostruire le
distinte già emesse.

## 3. Decisioni

| # | Decisione | Perché |
|---|---|---|
| D1 | **Una sola percentuale per cliente** | scelta utente, §2.3 |
| D2 | **Lo sconto applicato vive sulla richiesta**, non solo sul cliente | §3.1 |
| D3 | **Modificabile sempre**, anche a distinta generata | requisito esplicito dell'utente |
| D4 | **Le righe restano al lordo**; lo sconto compare solo nel riepilogo | scelta utente, §3.4 |
| D5 | **Avviso oltre soglia, mai blocco** | scelta utente |
| D6 | **La soglia è configurabile da ADMIN**, non cablata | scelta utente |
| D7 | Il **cliente è facoltativo** | copre il cliente occasionale senza codice in più |
| D8 | `totalPrice` resta il **lordo**; il netto è **derivato**, mai salvato | §3.3 |

### 3.1 Perché lo sconto sta sulla richiesta (D2)

Se la percentuale vivesse solo su `Customer`, ritoccare lo sconto di un cliente **cambierebbe
in silenzio il totale di ogni distinta già mandata**. Questo codice si rifiuta già di fare
esattamente questo altrove: il ricalcolo è *versionato* (`KitRequest.supersededById`) apposta
perché una distinta emessa non cambi sotto i piedi.

Quindi: `Customer.discount` è il **default che precompila**; `KitRequest.discountPercent` è il
valore **davvero applicato**, timbrato alla creazione e da lì in poi indipendente.

### 3.2 Il cliente si sceglie alla creazione, e non si cambia dopo

Non esiste una rotta per cambiare il cliente di una richiesta già creata, ed è deliberato: il
solo momento in cui `discountPercent` viene timbrato è la creazione, quindi **non può esistere**
il caso «il cliente sovrascrive uno sconto ritoccato a mano». È un'impossibilità strutturale,
non una guardia da ricordarsi.

Se l'agente sbaglia cliente, oggi la strada è rifare la richiesta. Se in futuro servirà un
`kit.setCustomer`, quella rotta dovrà **esplicitamente** decidere se ri-timbrare lo sconto — e
la risposta giusta sarà «solo se `discountPercent` è ancora `NULL`», per non buttare via una
trattativa. Va scritto qui perché è la trappola che quella rotta si porterà dietro.

### 3.3 Perché il netto non si salva (D8)

Due totali a DB divergono al primo bug; uno solo no. `totalPrice` conserva il significato che
ha oggi — **nessuna riga storica si muove** — e il netto si ricava con
`netto = lordo × (1 − percentuale/100)`.

**Conseguenza accettata dall'utente:** il KPI «valore» della dashboard continua a mostrare il
**lordo**.

### 3.4 Il marchio «fuori soglia» è derivato, non salvato

`fuoriSoglia = discountPercent > soglia`, calcolato al momento della lettura.

**Conseguenza accettata dall'utente:** se un ADMIN abbassa la soglia, le richieste vecchie si
ri-marcano da sole. È il comportamento voluto — il marchio riflette la politica corrente, non
quella del giorno in cui la richiesta è nata.

## 4. Modello dati

### 4.1 L'unica migrazione

```prisma
model KitRequest {
  // …
  /// Sconto applicato al cliente, in punti percentuali (es. 42.50 = −42,5%).
  /// NULL = nessuno sconto: la distinta resta al lordo di listino, che è il
  /// comportamento di ogni riga esistente prima del 2026-07-30 — per questo
  /// NON c'è backfill. Timbrato dal default del cliente alla creazione e da lì
  /// indipendente: vedi §3.1.
  discountPercent Decimal? @map("discount_percent") @db.Decimal(5, 2)
}
```

`Decimal(5,2)` regge `0.00`-`100.00` con due decimali. **Nessun `@default` a livello DB**, stesso
criterio già adottato per `seatConfig` ed `entrata`: un default DB valorizzerebbe anche le righe
che non devono averlo.

### 4.2 Quello che NON serve migrare

| Campo | Stato |
|---|---|
| `Customer.discount` `Decimal(5,2)?` | già a schema |
| `KitRequest.customerId` + relazione | già a schema, da oggi finalmente scritto |
| `SettingCategory.COMPANY_INFO` | già nell'enum → la soglia non aggiunge valori all'enum Postgres |
| `Settings.value Json` + `isEncrypted` default `false` | la soglia si salva in chiaro senza toccare la cifratura AES delle API key |

Soglia: `Settings{ category: COMPANY_INFO, key: "DISCOUNT_WARN_THRESHOLD", value: <number>, isEncrypted: false }`.

## 5. Moduli

### 5.1 `src/server/pricing/discount.ts` — puro, zero I/O

Il posto dove vivono i test veri. **Tutto in centesimi interi, mai float**, coerente con
`parsePriceCents` che il catalogo usa già.

```ts
export function applicaSconto(lordoCent: number, percent: number | null):
  { nettoCent: number; scontoCent: number };
export function superaSoglia(percent: number | null, soglia: number): boolean;
```

- arrotondamento **half-up al centesimo, una volta sola**, sul totale (le righe non si toccano → nessun problema di somma che non torna);
- `percent === null` → netto = lordo, sconto = 0, e `superaSoglia` è `false` (nessuno sconto non può essere fuori soglia);
- il confronto con la soglia è **stretto** (`>`): una percentuale *pari* alla soglia è ancora dentro;
- niente accesso a Prisma, niente `server-only`: è aritmetica.

### 5.2 `src/server/api/routers/customer.ts` — nuovo

| Rotta | Livello | Note |
|---|---|---|
| `list({ search? })` | `agentProcedure` | ricerca per ragione sociale |
| `create({ companyName, discount? })` | `agentProcedure` | |
| `update({ id, companyName?, discount? })` | `agentProcedure` | |
| `delete({ id })` | `agentProcedure` | **bloccata** se il cliente ha richieste collegate — stesso paletto già usato in `user.delete` |

L'anagrafica è **condivisa** fra gli agenti: `Customer` non ha un campo proprietario e non glielo
si aggiunge — i clienti sono dell'azienda, non dell'agente.

### 5.3 `src/server/settings/service.ts` — esteso

`getDiscountThreshold(db)` / `setDiscountThreshold(db, valore, userId)`, in chiaro
(`isEncrypted: false`). Default se la riga non esiste: **40** — dichiarato in una costante unica,
così il programma funziona prima che un ADMIN entri in impostazioni.

### 5.4 `kit.ts` — modifiche

- `create` accetta `customerId?`; se presente e valido, timbra `discountPercent` dal cliente;
- **`setDiscount({ id, discountPercent })`** — `agentProcedure` con controllo di proprietà, ammessa in **qualunque** stato (D3);
- il ricalcolo versionato copia `discountPercent` e `customerId` nella nuova versione;
- `get` restituisce anche `discountPercent`, il netto derivato e la soglia corrente.

## 6. UI — italiano, mobile-first, `/impeccable` prima di scrivere

### 6.1 Wizard `/richieste/nuova`

Campo **«Cliente»** facoltativo, cercabile, con creazione in linea (ragione sociale + sconto).
Sceglierlo precompila la percentuale, che resta ritoccabile nello stesso passo.

### 6.2 Dettaglio `/richieste/[id]`

**La tabella dei componenti non cambia**: resta al lordo (D4). Sotto, un riepilogo:

```
Totale listino AGB          90,20 €
Sconto cliente  −40%       −36,08 €
─────────────────────────────────────
Totale cliente              54,12 €
```

Matita per correggere la percentuale; oltre soglia compare un avviso visibile che **non
impedisce** di salvare.

### 6.3 `/impostazioni`

Nuova sezione ADMIN «Soglia di avviso sullo sconto».

### 6.4 Mobile ≤ 375px

Il riepilogo è una **lista verticale**, non una tabella. L'editor della percentuale usa
`inputMode="decimal"`. Nessuna funzione nascosta su mobile.

## 7. Casi limite ed errori

| Caso | Comportamento |
|---|---|
| `discountPercent` NULL | si mostra solo il totale di oggi — nessuna regressione visiva sullo storico |
| percentuale fuori `0..100` | rifiutata dallo schema zod con messaggio in italiano |
| più di 2 decimali | rifiutata (il DB è `Decimal(5,2)`: troncare in silenzio falsificherebbe il totale) |
| sconto senza cliente | permesso (D7) |
| cliente scelto su richiesta con sconto già ritoccato | lo sconto **non** viene sovrascritto (§3.2) |
| cancellare un cliente con richieste | bloccata con messaggio esplicito |
| soglia assente in `Settings` | vale il default della costante unica |
| sconto 100% | ammesso; supera la soglia, quindi esce l'avviso |

## 8. Test

- **Puri** su `discount.ts`: arrotondamento al centesimo (inclusi i casi che cadono sul mezzo centesimo), `null`, `0`, `100`, soglia sopra/sotto/uguale.
- **Router `customer`**: paletto sulla cancellazione, ricerca, validazione.
- **`kit.create`** con e senza `customerId`; `setDiscount` ammessa a distinta generata.
- **Confine col motore**: `kitInputSchema` deve **scartare** `customerId` e `discountPercent`, e nessuno dei due deve comparire fra le chiavi dei due rami dell'unione. Non è un caso per `no-silent-fields.test.ts` — quel test copre i campi *dentro* lo schema, e questi ci stanno fuori di proposito: qui si prova che ci restino.
- **Regressione dura**: golden anta-ribalta **16 righe / 21 pezzi / 90,20 € di lordo** e gemello entrata 7,5 **96,29 €** invariati. Sono **già asseriti** in `rules-artech-legno.test.ts`: non vanno duplicati, vanno lasciati verdi. Restano verdi *perché* lo sconto non entra nel motore, che è quanto il punto precedente dimostra.
- **Browser**: desktop 1440×900 e **375px**.

## 9. Fuori scope, esplicitamente

- **Sconto sul catalogo/archivio**: in archivio non esiste un «cliente corrente»; mostrarlo lì
  vorrebbe dire inventare un contesto che non c'è. Si aggiunge dopo senza rifare nulla.
- **Sconto per classe** (`F3`/`T1`/…): §2.3, domanda 28.
- **Approvazioni e autorizzazioni**: la soglia avvisa, non instrada verso nessuno.
- **Export/stampa della distinta per il cliente**: feature a sé.
- **`priceList` e `paymentTerms`**: restano colonne inutilizzate, non si fa finta di gestirle.
- **Anagrafica cliente completa** (P.IVA, indirizzo, referente): fuori dal minimo scelto.

## 10. Azioni ops al merge

1. **Una migrazione**: `discount_percent` su `kit_requests`.

Nient'altro: **niente re-import del catalogo, niente `db:seed:kit`, niente `embed:products`.**
