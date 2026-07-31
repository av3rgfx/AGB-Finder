# Profilo serramento del cliente — design

> Sessione 2026-07-30 (terza della giornata, dopo entrata maniglia e scontistica).
> Branch `claude/distinte-schema-cliente-6qhe7o`.
> Workflow: `/using-superpowers` → brainstorming → **`/llm-council`** (5 advisor +
> 3 peer review) → design approvato dall'utente → questa spec → `/writing-plans` → TDD.

---

## 1. Il problema, misurato

Dopo la PR #40 il wizard chiede all'agente, a **ogni** richiesta:

- `geometry` — una fra **7** combinazioni aria/interasse/battuta;
- `entrata` — una fra **2**.

Sono 14 combinazioni, e **nessun errore è rilevabile**: i codici della combinazione
sbagliata esistono a listino, hanno un prezzo, non producono warning. L'agente se ne
accorge quando arriva il pezzo sbagliato al cliente.

Ma queste due quote **non cambiano da un ordine all'altro dello stesso cliente**: sono
misure del serramento che quel cliente produce. L'intervista all'agente lo conferma —
MC aria 4/interasse 8,5/battuta 15, Peruzzi aria 4/9/18, Fosca aria 12/13/18: una
combinazione ciascuno, stabile. L'agente le ri-sceglie **a memoria** ogni volta.

### 1.1 Un difetto già in produzione, indipendente da questa feature

`src/app/(dashboard)/richieste/nuova/nuova-client.tsx:57` cabla

```ts
const ARTECH_DEFAULT: ArtechFormValues = {
  …
  geometry: "A12_I13_B20",   // ← la geometria del cliente del golden 2021
```

cioè **ogni nuovo ordine parte con la geometria di un altro cliente**. Non è
un'incoerenza di stile rispetto a `entrata` (che invece nasce non valorizzata, per
decisione esplicita della #40): è la **stessa classe di difetto della cremonese**,
ancora attiva. Tutti e cinque gli advisor del council l'hanno segnalata
indipendentemente, ed è stata verificata nel file.

Va tolta, e va tolta in un commit **isolato** — non nascosta dentro la feature.

---

## 2. Cosa il council ha cambiato nel design

La proposta iniziale era **precompilare** geometria ed entrata dal profilo, con
etichetta di provenienza. Il council l'ha respinta, e con un argomento che regge:

> La #40 ha tolto il default dell'entrata scrivendo «nessun valore preselezionato: un
> default sarebbe lo stesso silenzio in un posto più visibile». Un valore che arriva da
> un profilo è comunque un valore che l'agente **non ha scelto in quel momento**, e in
> più porta un'etichetta che lo fa *sembrare* verificato — mentre oggi il primo dato lo
> digita l'agente, dalla stessa memoria che è il punto di rottura.

### 2.1 La sintesi adottata: un atto esplicito, non un valore che c'è già

Il profilo **non precompila**. Al passo 3 compare, accanto ai campi, un blocco col
profilo del cliente e un pulsante **«Usa il profilo»** che scrive i due valori in un
colpo.

Stessa quantità di codice del semplice promemoria, stessa ergonomia della
precompilazione, ma il riempimento resta **un clic dell'agente**. La regola della #40
regge **alla lettera su entrambi i campi**: nulla è mai preselezionato.

### 2.2 L'etichetta è onesta finché non arrivano le distinte reali

Il profilo lo scrive l'agente a memoria. Finché non arriva un ordine vero che lo
confermi, l'etichetta **non** dice «dal profilo di Fosca» (che suona come un fatto
accertato) ma dichiara la sua natura: *dichiarato in anagrafica, mai confrontato con un
ordine*. È testo statico, non una colonna: oggi **tutti** i profili sono in quello
stato, e una colonna che vale sempre lo stesso valore è la colonna che non serve. Quando
arriveranno le tre distinte reali, allora sarà uno stato da modellare.

### 2.3 Il segnale di divergenza (il guadagno non richiesto)

Se al passo 4 la scelta dell'agente **differisce** dal profilo del cliente, il riepilogo
lo dice. Non blocca, non chiede conferma: **constata**.

È il primo rilevatore d'errore che il sistema possieda — oggi nessuno confronta la
richiesta di marzo con quella di settembre — e costa una decina di righe. Non richiede
la certezza che il profilo sia giusto: segnala che **due dichiarazioni sullo stesso
cliente non coincidono**, il che è informativo in entrambe le direzioni.

### 2.4 Quello che il council ha scartato

- **Conferma esplicita del blocco geometria+entrata prima di avanzare** — «teatro del
  consenso»: dopo due settimane si clicca senza leggere, e produce solo la prova che
  l'agente aveva confermato, cioè sposta la colpa e chiude l'indagine.
- **Derivare il profilo dall'ultima richiesta del cliente** (zero migrazioni). Due
  reviewer su tre l'hanno proposta ed è elegante: `KitRequest` persiste già geometria ed
  entrata per cliente. Ma in produzione l'anagrafica clienti è **vuota** e `customerId`
  è **sempre NULL**: non c'è storia da cui derivare, quindi non può innescarsi da sola.
  Resta la naturale evoluzione del giorno in cui ci saranno ordini a sufficienza.
- **`CustomerKitProfile` come tabella separata** (spec 2026-07-29 §3.5). La sua unica
  giustificazione dichiarata era «un cliente può avere più profili»; l'utente ha
  stabilito che i clienti hanno **una linea a testa**. Passare a una tabella, se un
  domani servisse, è una migrazione di dati banale che non riscrive nulla di già emesso.

---

## 3. Il design

### 3.1 Dati — due colonne, nessun modello nuovo

```prisma
model Customer {
  …
  /// Profilo serramento — SOLO serie ARTECH. NULL = nessun profilo dichiarato,
  /// che è lo stato di ogni cliente prima di questa migrazione: nessun backfill.
  kitGeometry ArtechGeometry? @map("kit_geometry")
  kitEntrata  Entrata?        @map("kit_entrata")
}
```

Le due colonne sono **indipendenti**: un cliente può avere la geometria e non l'entrata.
«Usa il profilo» scrive ciò che c'è.

**Il nome dice «serramento», non «cliente».** Il council ha insistito, con ragione, che
la geometria è una proprietà del serramento: Fosca non *ha* una geometria, ha avuto
quella negli infissi ordinati finora. Il giorno che le arriva una commessa con telai
diversi il profilo è un dato falso — ed è esattamente perché il valore si scrive con un
clic e resta modificabile che quel giorno non fa danni silenziosi.

**Lo snapshot è già gratis.** `kit.create` scrive di suo `geometry` ed `entrata` sulla
riga di `kit_requests`. Correggere il profilo di un cliente domani **non tocca** le
distinte di ieri, senza scrivere una riga di server. È la stessa proprietà per cui lo
sconto vive sulla richiesta e non solo sul cliente.

### 3.2 Il confine col motore

Le due colonne **non entrano** in `kitInputSchema`, **non** compaiono in
`PersistedKitRequest`, **non** le legge `from-request.ts`. Il profilo è un suggerimento
al *wizard*; l'input del motore resta ciò che è persistito sulla richiesta.

Un test lo asserisce, sulla falsariga di quello già scritto per `customerId` in
`types.test.ts`: lo schema **scarta** `kitGeometry`/`kitEntrata`.

### 3.3 Router

`customer.list`, `create` e `update` crescono dei due campi, con la stessa disciplina
già usata per `discount`:

- in `update` sono **`nullable().optional()`** — azzerare un profilo deve essere
  possibile, ed è diverso dal non toccarlo;
- `SELECT` e `toDto` li restituiscono, così `CustomerOption` li porta al wizard senza
  una query in più.

### 3.4 UI — due superfici, entrambe mobile-first

**(a) Pagina `/clienti`** — elenco e modifica. Chiude anche il buco per cui
`customer.update` e `customer.delete` esistono nel router e **non sono raggiungibili da
nessuna schermata**: oggi un cliente, una volta creato, non è più correggibile. Forma e
responsività di `/utenti` (azioni in menu ⋯, dropdown `position:fixed`), già verificata
a 375px.

**(b) I due campi nel form di creazione inline del `CustomerPicker`** — chi crea un
cliente al volo dentro il wizard può dargli subito il suo profilo senza cambiare
schermata.

**(c) Il blocco «Usa il profilo» al passo 3**, con l'etichetta di §2.2.

**(d) La riga di divergenza al passo 4**, con i valori del profilo per esteso.

Verifica a viewport **≤ 375px** e desktop, con screenshot **guardati** — la lezione della
sessione scorsa: il totale fuori schermo era coperto da un'asserzione verde che leggeva
`innerText`.

### 3.5 Il difetto di §1.1, in un commit isolato

Rimozione di `geometry: "A12_I13_B20"` da `ARTECH_DEFAULT`. Il campo diventa non
valorizzato come `entrata`, e il passo 3 non avanza finché l'agente non sceglie — che è
la ragione per cui questa feature esiste ed è ciò che la rende indolore.

`ArtechFormValues` diventa `Omit<ArtechKitInput, "entrata" | "geometry"> & { entrata?:
Entrata; geometry?: ArtechGeometryId }`.

**Nota dichiarata, non risolta:** il form cabla anche `seatConfig: "STANDARD"`,
`openingSide: "SINISTRA"`, `widthMm: 550`, `heightMm: 1820`. Le quote sono default
innocui (si digitano sempre); `seatConfig` **non** lo è — decide gli incontri — ma oggi
ha un solo valore ammesso dai moduli (`SEDE_30` è rifiutata a monte), quindi non può
sbagliare in silenzio. `openingSide` è una scelta per-finestra, sempre visibile al passo
3. Fuori scope, ma scritto qui perché un reviewer l'ha giustamente rilevato.

---

## 4. Il gate su catalogo reale — chiusura del debito `widthMm`

`codici-a-listino.integration.test.ts` fissa `widthMm: 550`, quindi esercita **1 banda su
5** di `FORBICI` e **1 su 4** di `BRACCI_GRUPPI`. Il codice del braccio è
`A5191{1=DX,2=SX}.{mid}.0{gruppo}`, con 5 `mid` distinti dalle 7 geometrie: **40 codici
braccio esistono, il gate ne verifica 10**. Più 4 dei 5 codici forbice mai passati per il
catalogo reale.

È la stessa lacuna che fece disattivare PVC e battente: codici plausibili con prezzo,
assenti dal listino vero.

Chiusura: cinque larghezze rappresentative, ciascuna nell'**interno non sovrapposto**
della propria banda (le bande si accavallano: 476-490 sta sia nella prima sia nella
seconda), incrociate con le 7 geometrie e le 2 mani.

| Larghezza | Forbice | Gruppo braccio |
|---|---|---|
| 400 | `A50510.00.01` | 01 |
| 550 *(golden)* | `A50510.00.02` | 02 |
| 700 | `A50510.00.03` | 03 |
| 900 | `A50510.00.04` | 04 |
| 1100 | `A50510.00.05` | 04 |

`entrata` resta fissa: cambia **solo** la riga della cremonese, già coperta dal test
delle 9 bande HBB. Stesso criterio con cui quel test fissa la geometria.

---

## 5. Fuori scope, esplicitamente

### 5.1 L'asse dell'incontro nottolino («incassato»)

Emerso in sessione da una richiesta dell'utente: i clienti esprimono una preferenza per
l'**incontro nottolino incassato**, cioè sagomato per essere inserito a filo nel telaio
tramite fresatura.

**Il listino non permette di mappare quella parola a un codice.** «Incassato» compare
**due volte in 959 pagine**, entrambe fuori contesto: p0590 (588) per un binario, p0628
(626) per una serratura. In compenso il blocco incontri pubblica **tre assi che il
generatore cabla senza chiederli**:

| Asse | Fonte | Cosa fa il motore |
|---|---|---|
| **Corpo dell'incontro** — stesso formato 9x18, due pezzi diversi: `A51400.05.02` (piastrina stampata, voce **2** del disegno) e `A51400.05.13` (corpo pieno con rampa, voce **4**). Stesso prezzo 0,81 € | p0469 (467) | emette **sempre** `.02` |
| **Perni di posizionamento Ø 8x3** — famiglia parallela `A52200.*`, stessi formati, stesso prezzo, pubblicata per nottolino, ribalta **e** DSS | p0469 (467), p0471 (469), p0473 (471) | non la emette **mai** |
| **Antieffrazione** — acciaio o zama, viti inclinate o dritte, 2,04-3,03 € contro 0,81 | p0470 (468) — pagina **non citata** fra le fonti di `artech-incontri.ts` | non la emette **mai** |

Due indizi si contraddicono e vietano di indovinare:

1. La descrizione parla di **mano DX/SX**, ma gli incontri nottolino aria 12 standard
   sono **ambidestri**; ad avere DX/SX per aria 12 è la famiglia **antieffrazione**
   `A514DX/SX.05.*`.
2. «Fresatura» nel listino AGB è una caratterizzazione della **geometria**, non una
   variante ordinabile: a p0469 (467) si legge «Aria 4 - Asse 13 - **Fresatura** 23 mm»
   contro «Aria 12 - Asse 13 - **Sede** 24 mm». E le dime esistono per entrambe («Per
   fresatura incontri aria 4», «Dima per fresatura a telaio per asse 9 - aria 12»).

**E c'è una ragione tecnica che decide da sola.** Il `.13` è marcato `(*)` = «ordinare
coperture separatamente», e quella copertura è **la voce 22 dello schema p0406 (404)**
che già sappiamo di non emettere — la **domanda 20**. Metterlo nel profilo oggi
significherebbe far scegliere al cliente una variante che produce una distinta che
**sappiamo già** incompleta.

→ Nuova **domanda 29** in `DOMANDE-APERTE.md`, con la pagina renderizzata, i tre assi e i
codici esatti. Il profilo nasce predisposto: il terzo campo sarà una colonna nullable in
più, non un rifacimento.

### 5.2 La copertura degli incontri (domanda 20), ora circostanziata

Non è una scoperta nuova — «22 copertura incontro» è già fra le sei voci dello schema
p0406 senza corrispondenza — ma ora si sa **quali codici la fanno scattare**:

- `A51400.CR.13` (nottolino 13x24) — è la geometria di **Fosca** (`A12_I13_B18`);
- `A51400.05.70` **e** `A51400.CR.70` (incontri ribalta, p0471 (469)): **entrambi**
  marcati `*`. Il primo è quello del **golden**.

Coperture: `A52102.01.44` (grigio RAL 7040) o `.87` (antracite), 0,39 €.

Il golden è un ordine reale del 16/11/2021 a 16 righe, quindi o la copertura è
facoltativa nella pratica o il listino 2021 differiva: **non si tocca il golden** su
questa base. Si aggiorna la domanda 20 con i codici.

Collaterale annotato: `A52102.05.44` **non** è una copertura viti nonostante la famiglia
— a catalogo si chiama «Inserto DSS per incontri con copertura».

### 5.3 Altro fuori scope

- Il composer delle chiusure (spec 2026-07-29 §3.6): la sua calibrazione resta su un
  punto solo finché non arrivano le tre distinte reali.
- `dedupeRows` last-wins in `map-product.ts`.
- `CASI` non legato a `RULE_MODULES` in `no-silent-fields.test.ts`.

---

## 6. Testing

| Livello | Cosa |
|---|---|
| Puro | `customer` router: i due campi in list/create/update, `nullable` distinto da `undefined` in update |
| Puro | `types.test.ts`: `kitInputSchema` **scarta** `kitGeometry`/`kitEntrata` |
| Componente | `CustomerPicker`: i due campi nel form inline; il cliente scelto porta il profilo |
| Componente | Passo 3: **nessun valore preselezionato**; «Usa il profilo» riempie entrambi; assente se il cliente non ha profilo |
| Componente | Passo 4: la riga di divergenza compare **solo** se il cliente ha un profilo **e** la scelta differisce, con i valori del profilo per esteso |
| Componente | `/clienti`: elenco, modifica, azzeramento del profilo |
| Regressione | Il passo 3 **non avanza** senza geometria (era il default cablato) |
| Integration *(gated)* | Il gate allargato alle 5 larghezze: 70 combinazioni, tutti i codici a catalogo con prezzo |
| Browser | Desktop 1440×900 **e 375px**, screenshot guardati |

**Invariante non negoziabile:** il golden resta **16 righe / 21 pezzi / 90,20 €** e il
gemello a entrata 7,5 **96,29 €**. Verificati esplicitamente sul catalogo reale
importato (7.488 prodotti), non solo con i mock.

---

## 7. Azioni ops

Una sola migrazione, **due colonne nullable, nessun backfill**. Il codice che le legge
tollera NULL per costruzione, quindi la finestra fra merge e migrazione è innocua nella
direzione «migrare prima»; nella direzione inversa **no** — `customer.list` con `SELECT`
esplicito chiederebbe a Postgres colonne inesistenti e fallirebbero **le letture**
dell'anagrafica.

→ **La migrazione si applica PRIMA del merge, dal branch della PR** («Ops — Neon» accetta
`workflow_dispatch` su un ref qualunque). È la lezione pagata due volte: #40 venti minuti
di produzione rotta, #42 qualche minuto.

Import, seed ed embed non servono — nessun codice cambia, nessun template cambia — ma il
workflow li esegue comunque e sono idempotenti.

---

## 8. Rischi dichiarati

1. **Il profilo esce dalla memoria dell'agente.** Mitigato dall'atto esplicito (§2.1),
   dall'etichetta onesta (§2.2) e dal segnale di divergenza (§2.3). Non risolto: si
   risolve solo con le distinte reali.
2. **«Un cliente, una geometria» è un'assunzione**, vera oggi per tre clienti. Il
   giorno che un cliente ne ha due, il profilo è modificabile e il valore si scrive con
   un clic: nessun danno silenzioso, e la migrazione verso una tabella resta aperta.
3. **Il segnale di divergenza può diventare rumore** se un cliente ordina spesso fuori
   standard. Constata, non blocca: il costo massimo è una riga di testo ignorata.
