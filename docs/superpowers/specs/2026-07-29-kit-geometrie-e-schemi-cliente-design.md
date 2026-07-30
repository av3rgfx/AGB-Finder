# Kit ARTECH legno: geometrie reali, schemi cliente e composer delle chiusure

> **Origine.** Testimonianza diretta di un agente di vendita UFPtrade (2026-07-29): il
> generatore di kit «così com'è non è funzionale». Verdetto `/llm-council` (5 advisor +
> 3 peer review): **evolvere, non riscrivere** — il problema non è l'architettura, è il
> modello del dominio e il questionario.
>
> **Pagine.** Sempre la **pagina fisica del PDF con la stampata fra parentesi**
> (fisica = stampata + 2), es. `p0451 (449)`. `Product.listinoPage` a DB è la fisica.

---

## 1. Il problema, misurato

Il modulo anta-ribalta ha una guardia `assertPilotGeometry()` che accetta **una sola**
combinazione: aria 12 / interasse 13 / battuta 20 / sede 18. Eseguendo il codice
(`vitest`, 2026-07-29) i tre clienti principali dell'agente sono **tutti rifiutati**:

| Cliente | aria | interasse | battuta | Esito oggi |
|---|---|---|---|---|
| **MC** | 4 | **8,5** | 15 | rifiutato **da zod**: `axisOffsetMm` è `z.number().int().min(9)` → 8,5 non è nemmeno esprimibile |
| **Fosca** | 12 | 13 | **18** | rifiutato dal motore (`artech.geometria`) |
| **Peruzzi** | **4** | **9** | **18** | rifiutato dal motore (`artech.geometria`) |

Il motore copre una **quarta** combinazione che nessuno dei tre ordina.

### 1.1 La causa radice: due quote, un nome

A `p0474 (472)` AGB pubblica **due tabelle adiacenti, sulla stessa pagina**, con le stesse
famiglie di codici e gli stessi numeri, intitolate in due modi diversi: «Incontri per
Microventilazione» ha la colonna **«sede telaio 18 / 24 / 30»**; «Incontri magnetici →
Parte telaio - Aria 12» ha la colonna **«BATTUTA 18 / 20 / 24 / 30»**. Sono la stessa quota.

Nel listino «battuta» indica quindi **due grandezze diverse**:

| Quota | Valori | Dove compare | Cosa seleziona |
|---|---|---|---|
| **Battuta anta** | 15 · 18 · 20 | cerniere `p0451 (449)`, forbici `p0439 (437)`, supporti `p0449 (447)` | famiglia `.22`/`.24`/`.26`/`.34`/`.36` |
| **Sede telaio** — che AGB chiama **anche** «battuta» | 18 · 20 · 24 · 30 | incontri `p0469-0474 (467-472)` | famiglia `.05`/`.12`/`.CR`/`.MN` |

L'agente dice «battuta 15 o 18, 20 per il ferro»: è **la prima**. Non nomina mai la sede
perché è **la seconda**, e nelle tabelle che consulta per ordinare non si chiama così.
Non è una lacuna dell'agente: sono due quote omonime. Questo chiude la questione aperta
dalla PR #37, che aveva trattato il sintomo (etichetta + hint) senza la causa.

---

## 2. Cosa il listino determina davvero

### 2.1 La geometria è un selettore, non una misura

Il 2° segmento del codice codifica `(aria, interasse, battuta)` in modo **identico** su tre
famiglie indipendenti — squadre angolari `p0451 (449)`, bracci forbice `p0439 (437)`,
supporti `p0449 (447)`/`p0451 (449)`. I prezzi sono **identici** fra varianti di geometria:
cambia solo il codice.

| # | aria | interasse | battuta | Suffisso cerniere/forbici | Famiglia incontri | Sede |
|---|---|---|---|---|---|---|
| 1 | 4 | 8,5 | 15 | `.22` | `.01` (asse 9) ⚠️ | — *fresatura* |
| 2 | 4 | 9 | 18 | `.24` | `.01` (asse 9) | — *fresatura* |
| 3 | 4 | 13 | 18 | `.34` | `.DC` (asse 13) | — *fresatura* |
| 4 | 12 | 9 | 18 | `.24` | `.05` | 18 |
| 5 | 12 | 9 | 20 | `.26` | `.05` | 18 |
| 6 | 12 | 13 | 18 | `.34` | `.CR` | 24 |
| 7 | 12 | 13 | 20 | `.36` | `.CR` / `.MN` | 24 / 30 |

**MC = riga 1 · Peruzzi = riga 2 · Fosca = riga 6.** Il pilota attuale è la riga 7.

⚠️ **Assunzione sulla riga 1.** Gli incontri aria 4 esistono a listino solo per **asse 9**
e **asse 13** (`p0469 (467)`, `p0471 (469)`, `p0473 (471)`): non c'è un asse 8,5. Si assume
che l'interasse 8,5 delle cerniere usi gli incontri **asse 9** (famiglia `.01`). È
un'inferenza, non un dato stampato: **domanda 17** per l'esperto AGB. Il modulo la dichiara
nel codice; se l'assunzione cade, cambia la famiglia incontri di MC (non i suoi codici di
cerniera/forbice, che sono `.22` verificati).

⚠️ **Mano sugli incontri — requisito nuovo dell'aria 4.** Per aria 12 gli incontri nottolino
sono **ambidestri** (`A51400.05.02`); per **aria 4** hanno la mano
(`A514DX.01.02` / `A514SX.01.02`, e asse 13 `A48011.DC.02` / `A48012.DC.02`, con prefisso di
famiglia diverso). Il modulo oggi emette un solo codice ambidestro: aprire l'aria 4 richiede
di propagare `openingSide` anche sugli incontri.

### 2.2 La sede è derivabile

Prove convergenti:
- Il 2° segmento **è** la coppia (asse, sede): `.05`=9×18, `.12`=9×20, `.CR`=13×24,
  `.MN`=13×30 — dimostrato dalla microventilazione `p0474 (472)`, che scrive le coppie
  in chiaro, e dai «magnetici parte telaio» sulla stessa pagina.
- Per **aria 4 la sede non esiste come dimensione**: il listino parla di «**Fresatura**
  23 mm» (`p0469 (467)`) e le famiglie sono `.01` (asse 9) / `.DC` (asse 13) — le stesse
  sia per gli incontri sia per i supporti forbice, cross-conferma su due sezioni diverse.
- **asse ≡ interasse**: `p0449 (447)` usa i due termini per la stessa quota nella stessa
  pagina (`Interasse 9` → `.01`, `Asse 13` → `.DC`).

Resta **una** scelta binaria che il listino non deriva (asse 9 → sede 18 o 20; asse 13 →
sede 24 o 30). Ed è esattamente lì che AGB **spacca i suoi schemi in due famiglie**: la NB
«*per tipologia di serramento con sede incontri da 30 mm riferirsi agli schemi "sede 30 mm"*»
compare su 22 pagine, e il *doppio nottolino a fungo* è annotato «*soluzione per serramenti
con sede incontri da 30 mm*» (`p0435 (433)`). **Un solo asse esplicito la risolve.**

### 2.3 Le chiusure supplementari NON sono derivabili — e non devono esserlo

Ricognizione di `p0443-0448 (441-446)`: **non esiste alcuna tabella di selezione per
altezza**. AGB pubblica un set di pezzi e la composizione la fa chi ordina:

- **Angolare verticale**: senza nottolino `A50330.00.00` (5,36 €) · con nottolino
  `A50330.01.00` (5,78 €) — «*necessario per classi antieffrazione RC1 e superiori*»
- **Prolunghe**: 200 (`A51801.00.01`, NOT. −) · 200 (`A51803.00.01`, NOT. 1) · 320 rasabile
  200 (`A51801.01.11`, NOT. −) · 400 (`A51803.00.02`) · 600 (`A51803.00.03`) · 800
  (`A51803.00.04`)
- **Terminali non rasabili**: 200/400/600/800 → `A50401.00.01`…`.04`
- **Terminali rasabili** (rasabilità 200 mm): 400 `A50411.00.02` · 600 `A50411.00.03`

Conferma dal campo: l'agente dice che **lo sviluppo dei supplementi varia per singolo
ordine, secondo la preferenza del cliente**. Una regola automatica inventerebbe una fonte
che non esiste. La colonna **NOT.** dichiara quanti nottolini porta ogni pezzo: è il dato
che rende una **proposta** calcolabile senza inventare nulla.

---

## 3. Il design

### 3.1 Principio guida (dal consiglio)

> **Ogni campo che chiediamo deve poter essere indicato col dito su una riga della
> distinta.** Se non sappiamo mostrare cosa cambia, non lo chiediamo.

E la regola non negoziabile: **nessun codice composto viene emesso se non esiste a catalogo
con prezzo** — *hard fail*, non warning. È così che sono nati i moduli PVC e battente poi
disattivati.

### 3.2 La geometria diventa un discriminatore unico

Oggi la geometria vive in quattro colonne `Int` (`airGapMm`, `axisOffsetMm`, `rebateMm`,
`seatMm`). Diventa **una sola** colonna, esattamente come `tourSchema` fa già per il bilico
(pattern già in uso e approvato in questo codebase):

```prisma
enum ArtechGeometry {
  A4_I85_B15    // aria 4  · interasse 8,5 · battuta 15   → .22   (MC)
  A4_I9_B18     // aria 4  · interasse 9   · battuta 18   → .24   (Peruzzi)
  A4_I13_B18    // aria 4  · interasse 13  · battuta 18   → .34
  A12_I9_B18    // aria 12 · interasse 9   · battuta 18   → .24
  A12_I9_B20    // aria 12 · interasse 9   · battuta 20   → .26
  A12_I13_B18   // aria 12 · interasse 13  · battuta 18   → .34   (Fosca)
  A12_I13_B20   // aria 12 · interasse 13  · battuta 20   → .36   (pilota storico)
}

enum SeatConfig { STANDARD, SEDE_30 }   // rilevante solo per aria 12
```

**Perché una colonna e non tre numeri.** (a) l'interasse 8,5 non sta in un `Int` e non è
una misura su cui si fa aritmetica: è un **selettore categoriale**, come tutti e tre;
(b) le combinazioni valide sono un insieme chiuso di 7 — tre colonne libere ne
permettono centinaia di inesistenti, e la guardia diventa di nuovo un `if`;
(c) una sola fonte di verità: aria/interasse/battuta si **derivano** dalla tabella per la
UI, quindi non possono divergere dal codice emesso.

Le tre colonne numeriche restano a schema come **legacy nullable** per non perdere le righe
storiche; nessun modulo le legge (dichiarato in `no-silent-fields.test.ts`).

### 3.3 La sede: derivata e *mostrata*

```
sedeFor(geometry, seatConfig) →
  aria 4                      → null   (fresatura: famiglie .01 / .DC per asse)
  aria 12 · asse 9  · STANDARD → 18  (.05)
  aria 12 · asse 13 · STANDARD → 24  (.CR)
  aria 12 · asse 13 · SEDE_30  → 30  (.MN) + richiede doppio nottolino a fungo
```

Sparisce dal wizard, ma **compare nel riepilogo e nella `ruleDescription` di ogni riga**
incontro. Così non diventa la costante muta che i peer reviewer temevano: resta un dato
esplicito e verificabile, semplicemente non più *chiesto* a chi non lo conosce.

`sede 20` (`.12`) e `SEDE_30 + asse 9` restano **fuori perimetro**, dichiarati: il motore
rifiuta con messaggio esplicito.

### 3.4 Il pilota storico NON si tocca (decisione motivata)

Applicando §3.3 alla riga 7 (il pilota, aria 12 · interasse 13 · battuta 20) la sede
derivata sarebbe **24** (`.CR`), mentre il modulo emette oggi la famiglia **`.05`** (9×18) —
e il golden dichiara sede 18. Il totale si muoverebbe da **90,20 €** a circa **90,62 €**.

**Non si applica.** Il golden è l'unico riscontro con una distinta reale in nostro possesso
(AGB 16/11/2021): correggerlo su una derivazione significherebbe sostituire un'assunzione
con un'altra — la stessa ragione per cui la bonifica del 2026-07-25 lasciò intatte le
domande 2 e 3. La riga 7 conserva i codici verificati, con l'anomalia **dichiarata nel
codice e nella scheda**; è la domanda 3b, aperta. Le righe 1-6 nascono invece con la sede
derivata.

**Vincolo di regressione: il golden resta 16 righe / 21 pezzi / 90,20 €.**

### 3.5 Schemi cliente

`Customer` **esiste già** a schema Prisma ed è inutilizzata. Si aggiunge:

```prisma
model CustomerKitProfile {
  id         String @id @default(cuid())
  customerId String
  name       String           // «linea standard», «serie 68»
  isDefault  Boolean @default(false)

  geometry   ArtechGeometry
  seatConfig SeatConfig       @default(STANDARD)
  openingDir OpeningDirection @default(TIRARE)

  // abitudine chiusure: alimenta la PROPOSTA, non la impone
  preferredExtensionMm       Int?     // 200 | 320 | 400 | 600 | 800
  preferredTerminalTrimmable Boolean?
  angolareWithNottolino      Boolean?
}
```

Un cliente può avere **più profili** (linee di serramento diverse), da cui la tabella
separata e non campi su `Customer`.

**Prefill + snapshot — la regola che chiude il bug storico.** Il profilo fornisce
**default al momento della creazione**; `kit.create` **copia** i valori risolti nella riga.
**Mai una lookup a tempo di generazione.** Conseguenza: modificare il profilo di Fosca
domani non riscrive le distinte di ieri. I valori precompilati restano **visibili e
modificabili** nel wizard — un default nascosto sarebbe la terza incarnazione del bug
«campo raccolto e ignorato».

### 3.6 Composer delle chiusure supplementari

`KitRequest.supplementaryClosures: Boolean` **viene sostituito**: un booleano non può
esprimere «3 prolunghe da 600 + terminale rasabile da 400». Tenerlo e aggiungere il
composer sopra sarebbe *esattamente* il bug storico.

```prisma
enum ClosureKind { ANGOLARE, PROLUNGA, TERMINALE }

model KitClosureLine {
  id           String @id @default(cuid())
  kitRequestId String
  sortOrder    Int
  kind         ClosureKind
  lengthMm     Int?     // null per l'angolare
  trimmable    Boolean @default(false)
  withNottolino Boolean @default(false)   // solo angolare
  quantity     Int     @default(1)
}
```

**Il modulo puro `closure-composer.ts`** (nessun I/O, interamente testabile):
- `suggest(runMm, preferences) → Composition[]` — cerca le combinazioni che coprono la
  corsa e le ordina per scostamento del **passo dei nottolini** dalla banda **400-600 mm**
  indicata dall'agente. Ricerca limitata (5 lunghezze, corsa ≤ 3000): esaustiva, non
  euristica. Il terminale **rasabile** assorbe il resto per arrivare alla quota esatta.
- `evaluate(composition, runMm) → { coveredMm, nottolini, passoMedioMm, warnings }`
- Vincolo **duro**: la catena non può superare la corsa. Vincoli **morbidi** (warning, non
  blocco): passo fuori 400-600; assenza di terminale.

**UI — una schermata, non un sotto-wizard.** Un wizard dentro il wizard aggiunge attrito a
un passo frequente. Composer live: barra verticale che rappresenta il montante con i pezzi
impilati, e in tempo reale *corsa coperta · nottolini · passo medio · prezzo*. Si apre con
la proposta **etichettata «proposta»** e accettabile con un tap; `+`/`−` per pezzo.
La barra verticale è nativamente adatta al mobile (regola mobile-first: verifica ≤ 375px).

**Guadagno non richiesto.** Ogni nottolino della catena vuole il suo **incontro** sul
telaio. Oggi il numero di incontri è la formula `2 + ⌊H/600⌋ + ⌊L/600⌋`, tirata nella Fase
1d sul golden e ferma come **domanda 3a** ad AGB. Col composer il conteggio smette di
essere una congettura e diventa la **conseguenza di una scelta esplicita**.

### 3.7 Assunzione dichiarata: la corsa verticale

**Non sappiamo da dove a dove corre la catena.** Nel golden (H 1820) i pezzi *prolungabili*
— prolunga 200 + prolunga 600 + terminale 600 — sommano esattamente **1400 mm**, cioè
`1820 − 420`. L'angolare verticale (~185 mm di sviluppo) sta **fuori** da questa somma:
occupa l'angolo, non la corsa.

**Definizione adottata** (una sola, per togliere l'ambiguità): la *corsa* è la lunghezza che
**prolunghe + terminale** devono coprire, e vale `corsa = altezza − 420`. L'angolare non
conta nella corsa. I 420 mm sono l'ingombro non prolungabile agli estremi (angolo,
movimento angolare, zona cerniera).

**È una calibrazione su un solo punto**: una retta tirata per un punto, con la pendenza
assunta a 1. Mitigazione: la corsa è **mostrata e sovrascrivibile** dall'agente; la proposta
è etichettata *proposta* e non spacciata per verità; il vincolo duro è solo «non superare la
corsa». Va confermata dalle **tre distinte reali** che l'agente sta procurando — con altezze
diverse dal golden, altrimenti non discrimina nulla.

### 3.8 Igiene dei dati (autorizzata)

- `KitRequest.engineVersion` promossa da campo del JSON a **colonna**, timbrata alla
  generazione (`ENGINE_VERSION` esiste già in `engine.ts:6`).
- **Ricalcolo versionato invece del blocco.** Rigenerare riesegue il codice-regole
  *corrente* e riscrive `kit_components`; la bonifica ha già cambiato codici e i re-import
  cambiano i prezzi, quindi una distinta già mandata al cliente non può cambiare sotto i
  piedi. La prima stesura di questa spec lo risolveva **bloccando** la rigenerazione fuori
  da `DRAFT`. È troppo rozzo: il confronto con AGB 4K (§7) mostra che il **ricalcolo** è
  una funzione che serve nel mestiere — 4K le dedica un modulo.
  **Sintesi adottata: versionare invece di bloccare.** Su una richiesta non più `DRAFT`,
  «Ricalcola» **crea una nuova versione** e lascia intatta quella emessa. Si ottiene
  l'immutabilità che chiedeva il consiglio *e* la funzione che serve all'agente.
  Implementazione minima: `KitRequest.supersededById` (auto-relazione) + la nuova riga che
  copia l'input e rigenera. Nessuna tabella di versioning separata.
- **Query di audit** su `kit_requests` (già pronta in
  `kit-assunzioni/DA-FARE-audit-e-domande-agb.md`) → azione ops, richiede il DB.

### 3.9 Wizard

1. **Cliente** (+ profilo) → precompila il resto. Opzionale: si può procedere senza cliente.
2. **Misure e mano** — larghezza, altezza, DX/SX.
3. **Geometria** — i 7 preset con `aria · interasse · battuta` in chiaro, riconoscibili
   invece di 4 numeri da indovinare; `apertura` default **a tirare**.
4. **Chiusure supplementari** — il composer di §3.6, saltabile.
5. **Riepilogo** — con la **sede derivata mostrata** e la catena di chiusura in chiaro.

---

## 4. Fuori scope, esplicitamente

- **Varianti componenti** (nottolini antieffrazione, 11 finiture coperture contro l'unica
  implementata, terminali rasabili come *preferenza*, cremonesi con/senza DSS e con foro
  cilindro, 4 varianti di squadra angolare, «senza paraschegge»): rinviate. Il Contrarian:
  non si impilano varianti su una distinta che sappiamo ancora incompleta.
- **E-commerce**: zero righe di codice. Lo schema cliente nasce però come entità di prima
  classe, così la versione semplificata per i clienti finali sarà un consumatore in più e
  non una migrazione.
- **Classe di sicurezza RC1/RC2** come asse esplicito: il listino la supporta
  (`p0408 (406)`, `A50330.01.00`, `A50302.02.02`, piastrino antieffrazione) → candidata
  naturale per la sessione successiva.
- **Divario schema p0406**: 22 voci a schema contro 16 posizioni emesse. Resta aperto; va
  chiuso **prima** delle varianti.

### 4.1 Roadmap dopo il piano 2 — ordine consigliato

1. **Scontistica e prezzo cliente** ⭐. Oggi i totali sono il **lordo di listino AGB**, non
   quello che il cliente paga. `Customer` ha **già** a schema `discount`, `priceList` e
   `paymentTerms`, **inutilizzati**: metà del lavoro è fatta. È il rapporto
   valore/costo più alto del progetto, ed è un modulo intero di 4K (§7).
2. **Classe di sicurezza RC1/RC2** come asse esplicito + varianti componenti.
3. **Divario schema p0406** (22 voci contro 16).
4. **Commesse**: raggruppare N serramenti in un unico lavoro. Oggi le richieste kit sono una
   lista piatta, un serramento ciascuna; un ordine reale ne contiene molti (§7).

---

## 5. Testing

- **Regressione**: golden anta-ribalta invariato — **16 righe / 21 pezzi / 90,20 €**.
- **I tre clienti**: MC, Fosca, Peruzzi generano senza errori; le loro distinte diventano
  golden **veri** quando arrivano le distinte reali dall'agente, **provvisori** fino ad
  allora (marcati come tali nella scheda).
- **Copertura codici** (il gate che mancava a PVC e battente): un test percorre tutte le 7
  geometrie × 2 mani × 2 seatConfig e verifica che **ogni codice emesso esista a catalogo
  con prezzo**. Integration gated su `INTEGRATION_DATABASE_URL`.
- **`no-silent-fields.test.ts` esteso**: muta ogni nuovo campo (`geometry`, `seatConfig`,
  ogni `KitClosureLine`) e pretende che l'output cambi. Le colonne legacy sono dichiarate
  inerti con la ragione.
- **`closure-composer`**: unit test puri su `suggest`/`evaluate`, inclusi i casi limite
  (corsa minima, corsa non raggiungibile, nessun terminale).
- **Browser**: desktop + **375px**, composer incluso.

---

## 5.1 Decomposizione in piani

La spec copre tre pezzi che **si tengono per mano attraverso il modello di input**, per cui
vanno progettati insieme, ma si implementano in due piani distinti e ordinati:

| Piano | Contenuto | Sblocca |
|---|---|---|
| **1** | §3.2 geometria-discriminatore · §3.3 sede derivata · §3.4 pilota intatto · §3.8 igiene · wizard passi 2-3-5 | i tre clienti oggi rifiutati — è il valore |
| **2** | §3.5 schemi cliente · §3.6-3.7 composer chiusure · wizard passi 1 e 4 | il «non richiede ogni volta gli stessi dati» |

Il piano 1 è autonomo e rilasciabile da solo. Il piano 2 dipende da `ArtechGeometry`
(il profilo lo referenzia) e non è sensato prima.

## 6. Azioni ops previste

1. Migrazione: `ArtechGeometry`/`SeatConfig`/`ClosureKind`, `CustomerKitProfile`,
   `KitClosureLine`, `KitRequest.engineVersion`, colonne geometria → nullable legacy,
   backfill delle righe esistenti a `A12_I13_B20` + `STANDARD`.
2. `db:seed:kit` — invariato nella struttura, i template restano quelli.
3. **Nessun re-import del catalogo**: tutti i codici delle 7 geometrie sono già a listino
   (verifica in §5 come gate).
4. Audit `kit_requests` (query pronta) — fuori dall'app.

---

## 7. Confronto con AGB 4K (fonti verificate, 2026-07-29)

Il software di riferimento del settore è **AGB 4K** (parte *Calcolo e Preventivazione*; la
parte *schemi grafici / xDesigner* è fuori interesse). Fonti: [pagina ufficiale](https://www.agb.it/software/agb-4k),
[depliant PDF](https://www.agb.it/getattachment/2fc87bd0-7230-4bf1-9749-a75bd166c932/54768.aspx)
(testo estratto con `pdftotext`: WebFetch non ci riusciva), [video-tutorial](https://www.agb.it/it-it/documentale?path=%2FDocumentale%2FVIDEO-TUTORIAL%2FAGB-4K-SOFTWARE).

**Moduli reali**, dai titoli dei video-tutorial: *gestione cartelle su commesse e preferiti* ·
*creazione e gestione configurazioni* · *esportazione, importazione, funzione di ricalcolo* ·
*impostazioni generali* · *xDesigner* · **wizard per sviluppo ferramenta** ·
**anagrafica cliente — inserimento e gestione scontistiche** · *gestione commerciale*.

### 7.1 Dove 4K conferma le nostre scelte

| Nostra scelta | Riscontro testuale in 4K |
|---|---|
| Wizard + composer guidato (§3.6, §3.9) | «Sviluppo del serramento veloce e **guidato**» · «Funzionalità **wizard** per sviluppo ferramenta» |
| Terminale **rasabile** che assorbe il resto | «Calcolo immediato di posizioni, lavorazioni e **rasabilità** di tutti gli elementi» |
| Schemi cliente / non richiedere sempre gli stessi dati (§3.5) | «**Organizzazione in preferiti e commesse** delle configurazioni» |
| Motore deterministico, mai un LLM | 4K è un calcolatore: nessuna traccia di AI |
| La distinta come oggetto centrale | «Generazione della **distinta base**» |

### 7.2 Dove divergiamo — deliberatamente

4K àncora l'unità tecnica riusabile a una **configurazione salvata** (in preferiti/commesse)
e tiene l'**anagrafica cliente** per la **scontistica**. Noi ancoriamo la geometria **al
cliente** (§3.5).

Non è un errore di nessuno dei due: **cambia chi sta alla tastiera.**

| | AGB 4K | Noi |
|---|---|---|
| Utente | il **serramentista** | l'**agente di un distributore** |
| Di chi è la geometria | sua, una linea produttiva | di **ciascun cliente**, diversa |
| Unità riusabile corretta | «la mia configurazione preferita» | «lo schema di *quel* cliente» |

4K **non può** precompilare per cliente: non possiede la geometria del cliente. Noi sì.
`CustomerKitProfile` non è quindi una deviazione da 4K, è la stessa idea ri-domiciliata su
un ruolo che 4K non serve — ed è il vantaggio strutturale del prodotto.

### 7.3 Cosa 4K ha e noi no

1. **Scontistica per cliente** → promossa a priorità 1 della roadmap (§4.1).
2. **«Ottimizzazione pezzi singoli o confezioni».** Base contrattuale reale: art. 4 delle
   condizioni generali, `p0006 (4)` — «*per ordini di quantità inferiori alla confezione …
   di aumentare l'ordine fino al quantitativo della confezione, oppure di applicare una
   maggiorazione di prezzo del 20%*». I nostri kit emettono quantità 1/2/5 contro confezioni
   da 50/20/10 (colonna CS del listino). Per UFPtrade, che è distributore e rompe le
   confezioni, plausibilmente non ricade sul cliente finale — **domanda 18** per l'azienda,
   non un'assunzione da prendere in silenzio.
3. **Commesse e cartelle** → roadmap §4.1 punto 4.
4. **Ricalcolo esplicito** → recepito in §3.8 come ricalcolo *versionato*.
5. **Export/import e interfacciamento col gestionale** → rilevante quando si affronterà
   l'e-commerce.
6. «Distinta base con **bollatura**»: il significato esatto di *bollatura* in questo contesto
   non è determinabile dalle fonti pubbliche. Non si assume nulla.
