# Varianti componente e antieffrazione — design

> 2026-07-31 · brainstorming → `/llm-council` (5 advisor + 3 peer review) → questa spec.
> Tutti i codici citati sono stati **verificati sul PDF del listino AGB 2026** (959 pagine)
> con la stessa firma di riga che legge l'importatore: 78 codici, 74 presenti a prezzo e
> 4 confermati **assenti**. Convenzione del progetto: «pagina fisica (stampata)».

---

## 1. Da dove nasce

L'utente ha chiesto l'antieffrazione. Nel prepararla sono emerse due domande a cui **non
esiste risposta nel listino** — il «nottolino a fungo» va su serramenti sede 30? gli incontri
si ordinano a viti inclinate o dritte? — e l'utente ha risposto:

> «Non saprei risponderti a queste domande. Posso solo dirti che secondo me ha senso
> aggiungere una sezione finale nel wizard, per decidere e far scegliere in modo semplice e
> visivo, quando ci sono più scelte per uno o più componenti che non dipendono dallo schema
> dello sviluppo del kit ma da una scelta personale (dell'agente o del cliente).»

È un riorientamento, non una richiesta in più: **le due domande smettono di essere un
prerequisito**. Non si sceglie una volta per tutte al posto dell'agente — si mostra la scelta
a chi sta ordinando, con i codici e i prezzi davanti.

Ed è la settima volta che questo progetto incontra lo stesso difetto — `openingDir` raccolto
e mai letto, l'entrata cablata, la geometria cablata, `PILOT_GEOMETRY` ignorata, il default
`A12_I13_B20` nel wizard — cioè **una decisione che il motore prende da sé e non dichiara**.
Le prime sei sono state chiuse una alla volta. Questa chiude la classe.

---

## 2. Definizione, e la sua eccezione dichiarata

**Variante** = una scelta che non cambia *quali* righe compone la distinta, ma *quale codice*
va su una riga esistente.

L'**antieffrazione non rientra** in questa definizione: sostituisce due codici **e aggiunge
una riga** (il piastrino). Quattro advisor su cinque l'hanno rilevato indipendentemente. Di
conseguenza:

- l'antieffrazione **non** entra nel registro delle varianti come una di esse;
- la sezione del wizard **non si chiama «Varianti»** ma «**Componenti**», perché conterrebbe
  una cosa che variante non è, e il primo a confondersi saremmo noi fra sei mesi.

---

## 3. Il censimento, e cosa entra

Sei candidate censite sul listino. Entrano **tre** cose; il resto è motivato.

| | Componente | Entra | Perché |
|---|---|---|---|
| **V1** | Squadra angolare | ✅ | Chiude la **domanda 2** e un'incoerenza reale: MC riceve la base da 5,77 € e gli altri sei la versione da 9,83 €, per un motivo che **non è tecnico** (`A50904` non esiste nel formato `.22`). 4,06 € a pezzo. |
| **V4** | Incontro ribalta — acciaio o zama | ✅ | Chiude un'**ASSUNZIONE scritta nel codice** (`artech-incontri.ts`: «*si adotta lo ZAMA per coerenza col pilota*»). |
| **A** | Antieffrazione (3 scelte) | ✅ | È la richiesta d'origine. |
| **V2** | Corpo incontro nottolino `.02` / `.13` | ❌ | È l'asse (a) della **domanda 29**, aperta; e `.13` è marcato `(*)` «ordinare coperture separatamente» — produrrebbe una distinta che sappiamo già incompleta (**domanda 20**). |
| **V3/V5** | «Con perni di posizionamento Ø 8x3» | ❌ | Asse (b) della **domanda 29**. Tocca *due* righe con una scelta, quindi non è nemmeno una variante nel senso di §2. `A52200.05.02` porta anche il simbolo ☎. |
| **V6** | Viti inclinate / dritte | ❌ come variante | Non è una scelta a sé: è **una proprietà della famiglia**. Si risolve elencando le opzioni per esteso (§5), non con un asse annidato. |

---

## 4. Dati — una colonna sola

```prisma
/// Varianti componente scelte dall'agente. SOLO serie ARTECH.
/// NULL = i codici che il motore emette da sempre → NESSUN backfill, e nessuna
/// riga esistente si muove. Stesso criterio di `seatConfig`/`entrata`/
/// `discountPercent`: nessun `@default` a livello DB.
variants Json? @map("variants")
```

**PERCHÉ UNA COLONNA JSON E NON SEI COLONNE TIPIZZATE.** `src/server/api/routers/kit.ts:228-257`
— `ricalcola` **ricopia la riga campo per campo a mano**, diciotto campi, con un commento che
dice esattamente perché è pericoloso: *«un campo dimenticato qui produrrebbe una distinta
diversa in silenzio»*. Sei colonne nuove sono **sei occasioni** di dimenticarne una in quel
punto; una colonna è una riga sola. Termine di paragone misurato: `entrata` — un enum a due
valori — ha toccato 34 file e una migrazione.

**Dove vive.** Dentro il **ramo ARTECH** di `kitInputSchema`, non nei campi comuni. Fuori,
una riga TOUR potrebbe portarsi addosso varianti ARTECH: è esattamente l'impossibilità
strutturale che l'unione discriminata è stata introdotta a garantire (PR #35).

**Forma.** Un `z.object` di enum, uno per variante, tutti `.optional()`:

```ts
export const variantiSchema = z.object({
  squadraAngolare:   z.enum(["BASE","TRAVERSO_ALU","COMPENSATORE","TRAVERSO_ALU_COMPENSATORE"]).optional(),
  incontroRibalta:   z.enum(["ZAMA","ACCIAIO_INCLINATE","ACCIAIO_DRITTE"]).optional(),
  movimentoAngolare: z.enum(["UN_NOTTOLINO","DUE_NOTTOLINI"]).optional(),
  incontroNottolino: z.enum(["NORMALE","ANTIEFFRAZIONE_INCLINATE","ANTIEFFRAZIONE_DRITTE"]).optional(),
  piastrinoAntieffrazione: z.boolean().optional(),
}).strict();
```

`.strict()` non è decorativo: una chiave sconosciuta — una variante rinominata, un residuo di
una versione precedente — **fallisce il parse** invece di essere ignorata in silenzio.
`from-request.ts` fa già `safeParse` dell'intera riga ricostruita, quindi la validazione passa
di lì senza codice nuovo e **senza alcun `as`**.

`undefined` = «il default», che è il codice emesso oggi. Non si materializza il default nel
dato: se domani un default cambia, le righe vecchie devono seguire il **ricalcolo versionato**,
non un valore congelato che nessuno sa più da dove viene.

---

## 5. Il registro

Un modulo puro, `src/server/kit/artech-varianti.ts`, che dichiara per ogni variante: id,
etichetta italiana, riga su cui agisce, e **la tabella dei codici interi**.

**REGOLA DURA, e qui è a rischio massimo:** nessun codice composto per concatenazione. La
tabella della squadra angolare è *troppo regolare* — 4 famiglie × 5 interassi × 2 mani — ed è
esattamente la forma che invita a scrivere `` `A509${fam}.${mid}.${mano}` ``. È il difetto che
ha fatto disattivare i moduli PVC e battente: **`A50904.22` non esiste** ed è la prima cosa che
una formula produrrebbe. Le 36 righe si scrivono per esteso.

**La disponibilità è la tabella, non una lista a parte.** Un'opzione è disponibile per una
geometria se e solo se la tabella ha una voce per quella geometria. Nessun predicato scritto a
mano che possa disallinearsi (è il motivo per cui `GEOMETRIE`/`AssertNever` esistono già).

### 5.1 Squadra angolare — 36 codici, `p0451-0452 (449-450)`

| Opzione | Famiglia | € | `.22` (int. 8,5) | `.24` | `.26` | `.34` | `.36` |
|---|---|---|---|---|---|---|---|
| Base | `A50902` | 5,77 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Traverso alluminio | `A50903` | 7,54 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Con compensatore | `A50901` | 8,05 | ❌ **non esiste** | ✅ | ✅ | ✅ | ✅ |
| Traverso alu + compensatore | `A50904` | 9,83 | ❌ **non esiste** | ✅ | ✅ | ✅ | ✅ |

Mano: `.01` = destra, `.02` = sinistra. Geometria → interasse: `A4_I85_B15`→`.22` ·
`A4_I9_B18`/`A12_I9_B18`→`.24` · `A12_I9_B20`→`.26` · `A4_I13_B18`/`A12_I13_B18`→`.34` ·
`A12_I13_B20`→`.36`.

**Conseguenza visibile:** MC (interasse 8,5) vede **due** opzioni; le altre sei geometrie ne
vedono quattro. Non quattro di cui due grigie — due.

Default = ciò che il motore emette oggi: **base** per `A4_I85_B15`, **traverso alu +
compensatore** per le altre sei. Il default è quindi *per geometria*, e riproduce l'attuale
esattamente.

### 5.2 Incontro ribalta — `p0471 (469)`

| Chiave | Zama (attuale) | Acciaio viti inclinate | Acciaio viti dritte |
|---|---|---|---|
| `A4_ASSE9` | — *(non esiste)* | `A514DX/SX.01.64` 3,03 **(attuale)** | — |
| `A4_ASSE13` | `A514DX/SX.DC.70` 2,64 | `A514DX/SX.DC.64` 3,03 | — |
| `A12_9x18` | `A51400.05.70` 2,54 ambidestro | `A514DX/SX.05.64` 3,03 | `A514DX/SX.05.65` 3,03 |
| `A12_13x24` | `A51400.CR.70` 2,54 ambidestro | `A514DX/SX.CR.64` 3,03 | `A514DX/SX.CR.65` 3,03 |

Per `A4_ASSE9` esiste **una sola** opzione: la variante non si mostra affatto, non si mostra
disabilitata. Per `A4_ASSE13` sono due (le viti dritte, in aria 4, il listino non le pubblica).

Chiave incontri per geometria (invariata, da `artech-incontri.ts`): `A4_I85_B15`/`A4_I9_B18`
→ `A4_ASSE9` · `A4_I13_B18` → `A4_ASSE13` · `A12_I9_B18`/`A12_I9_B20`/**`A12_I13_B20`** →
`A12_9x18` · `A12_I13_B18` → `A12_13x24`. (Il pilota su `A12_9x18` è la contraddizione nota
`13x18`, **domanda 3b**: non la si tocca qui.)

### 5.3 Antieffrazione — tre scelte indipendenti

**(a) Movimento angolare** — `p0435 (433)`, indipendente da geometria e mano, quantità 2:

| Opzione | Codice | € |
|---|---|---|
| Un nottolino **(attuale)** | `A50302.01.02` | 6,66 |
| Due nottolini | `A50302.02.02` | 9,73 |

> **NB stampata a `p0435 (433)`:** «*mov. angolare `A50302.02.02` necessario per tutte le
> classi antieffrazione*». Non era nella richiesta dell'utente: **l'ha aggiunto il listino**.

**(b) Incontro nottolino** — normale `p0469 (467)`, antieffrazione `p0470 (468)`:

| Chiave | Normale (attuale) | Antieffr. viti inclinate | Antieffr. viti dritte |
|---|---|---|---|
| `A4_ASSE9` | `A514DX/SX.01.02` 0,81 | `A514DX/SX.01.67` 3,03 | — *(l'aria 4 non le pubblica)* |
| `A4_ASSE13` | `A48011/A48012.DC.02` 0,87 | `A514DX/SX.DC.67` 3,03 | — |
| `A12_9x18` | `A51400.05.02` 0,81 ambidestro | `A514DX/SX.05.67` 3,03 | `A514DX/SX.05.68` 3,03 |
| `A12_13x24` | `A51400.CR.13` 0,89 ambidestro | `A514DX/SX.CR.67` 3,03 | `A514DX/SX.CR.68` 3,03 |

**È qui che la seconda domanda senza risposta si dissolve:** non si sceglie inclinate o dritte
una volta per tutte: si mostrano dove esistono, e per l'aria 4 — cioè **MC e Peruzzi** — le
dritte non compaiono perché a listino non ci sono.

**(c) Piastrino antieffrazione** — `p0432 (430)`, riga **aggiunta**, quantità 1, dipende
dall'**entrata** (il campo reso esplicito dalla PR #40):

| Entrata | Codice | € |
|---|---|---|
| `E75` (7,5 mm) | `A50194.00.01` | 3,17 |
| `E15` (15 mm) | `A20050.00.02` | 2,69 |

### 5.4 Il «doppio nottolino a fungo» resta fuori — e non è una rinuncia

`A50320.02.01` non è un pezzo in più: sta nel capitolo **Movimenti Angolari** con la stessa
tabella (DIMENSIONI · LBB · HBB · NOT. · CODICE), quindi *prende il posto* di un movimento
angolare. E il listino lo lega alla **sede 30** nei due versi:

- `p0435 (433)`, sotto la sua tabella: «*NB: soluzione per serramenti con sede incontri da 30 mm*»;
- `p0469 (467)`, nota `(**)` stampata **solo** sulle righe `13x30`: «*necessario utilizzo con
  movimenti angolari inferiori doppio nottolino a fungo cod. `A50320.02.01`*».

Sede 30 ⟹ fungo **e** fungo ⟹ sede 30. La sede 30 il motore la rifiuta a monte
(`assertSeatConfigSupportata`: manca l'incontro DSS 13x30 a listino). Il fungo è quindi una
**famiglia di schemi diversa**, non una variante — ed è così che **la prima domanda senza
risposta si dissolve**: non serviva deciderla, serviva collocarla.

---

## 6. Confine col motore, e la garanzia che rende impossibile la variante inerte

Il kit resta un **motore deterministico TypeScript**. Le varianti sono **input**, non logica:
stesso input → stesso output, come sempre.

**Il problema da risolvere.** Questo progetto ha già pagato quattro volte il difetto «campo
raccolto, validato, persistito e mai letto da nessun modulo». Con cinque varianti in un blob
JSON il rischio si moltiplica, e `no-silent-fields.test.ts` non lo copre da solo: **un blob è
un campo**, mutarlo non equivale a mutare ogni variante.

**La risposta strutturale, in due strati automatici.** Nessuno dei due è «ricordarsi di».

**Strato 1 — a runtime, nel motore.** `RuleModule` acquisisce un campo **obbligatorio**
`varianti: readonly VarianteId[]`: ogni modulo **dichiara** quali varianti consuma (`[]` per
TOUR e vasistas). Obbligatorio, non `?`, così un modulo nuovo **non compila** senza averci
pensato. `engine.ts` — un punto solo — rifiuta con `KitGenerationError` **col nome della
variante** se la richiesta ne porta una che il modulo non dichiara. Questo chiude «persistita,
e il modulo non la conosce nemmeno».

**Strato 2 — nei test, dal registro.** `no-silent-fields.test.ts` deriva i casi **dalla
dichiarazione del modulo**: per ogni id dichiarato, mutarlo deve cambiare la distinta o farla
rifiutare. Questo chiude «dichiarata, ma di fatto mai letta».

Insieme coprono i due versi, e nessuno dei due si può dimenticare: il primo è un errore di
compilazione, il secondo un test che si costruisce da sé.

**PERCHÉ NON UN ACCESSORE CHE MARCA LE LETTURE.** Sarebbe la versione «pura», ma impone un
secondo parametro a `RuleModule.generate` e quindi tocca tutti e sei i moduli per una garanzia
che i due strati sopra danno già. Il costo non si paga.

**Due garanzie di contorno:**

1. `no-silent-fields.test.ts` deriva i suoi casi **dal registro** (`variants.<id>`), quindi una
   variante aggiunta al registro e non consumata **fallisce col proprio nome** — come già oggi
   per i campi di primo livello. Serve `setPath` a un livello (~10 righe) al posto dello spread.
2. **Una fixture per variante.** Oggi la mutazione parte da **una sola** geometria; V4 e le
   antieffrazione dipendono dalla chiave incontri, quindi su quella fixture risulterebbero
   *legittimamente* inerti e la lista degli inerti diventerebbe un alibi. Ogni variante muta a
   partire da una geometria in cui è **davvero disponibile**.

**Il ricalcolo resta versionato — ma NON è una via per cambiare le varianti.** Una distinta
emessa non si riscrive, questo è vero e resta vero. Non è vero, invece, che il ricalcolo permetta
di cambiare una variante: `kit.ricalcola` (`src/server/api/routers/kit.ts:249-252`) le fa
ereditare **verbatim** alla nuova versione, con tanto di commento che lo dichiara, e **nessuna
mutation le modifica** — `kit.setVariants` non esiste. In PR1 le varianti si scelgono **alla
creazione e basta**.

**Conseguenza da dire agli agenti**, perché è la prima segnalazione che arriverà dal campo: chi
ha creato una richiesta «Normale» e poi vuole l'antieffrazione **deve rifare il wizard da capo**.
Non c'è alcun percorso di modifica.

**Il seguito naturale, lavoro a parte:** un `variants` **opzionale** nell'input di `ricalcola`
(assente = eredita com'è oggi, presente = sostituisce). Non riscriverebbe nulla di già emesso —
la riga vecchia viene marcata `supersededById` e la nuova nasce comunque `DRAFT` — quindi la
garanzia «una distinta in mano al cliente non si riscrive» regge senza modifiche.

**I tre punti del percorso dati** — e sono tre, non due, perché è dove si perdono i campi:

1. `kit.create` accetta `variants` nell'input e lo riversa nella colonna;
2. `from-request.ts` lo rilegge **senza `?? default`** (il default vive nel registro, non nella
   ricostruzione: un fallback qui renderebbe indistinguibile «non scelto» da «dato rotto»);
3. `kit.ricalcola` lo **ricopia** — è la riga che l'intera §4 esiste per rendere una sola.

Un test per ciascuno dei tre: creazione → rilettura → ricalcolo, con la variante che sopravvive
al giro completo.

---

## 7. Precedenza: non esiste, per costruzione

L'utente ha chiesto un interruttore «Antieffrazione» **più** un tasto «modifica» che apra le
tre scelte separate, «*dato che ogni tanto capita di ordinare solo un componente*».

Ne segue la regola che chiude anche il buco strutturale sollevato dalla peer review («chi vince
se una variante punta alla stessa riga dell'antieffrazione?»):

> **La verità persistita sono le tre scelte indipendenti. L'interruttore è un'azione di UI che
> le imposta, e NON viene salvato.**

Il motore vede solo le tre scelte → **nessuna precedenza da arbitrare**, nessun ordine di
valutazione implicito. E l'audit resta possibile: «quali richieste erano antieffrazione» si
interroga sulle tre colonne del JSON, che sono nominate e queryabili (`jsonb`).

Se l'interruttore fosse salvato *accanto* alle tre scelte, i due dati potrebbero contraddirsi
alla rigenerazione — ed è esattamente la classe di difetto che questa spec esiste per chiudere.

---

## 8. Inesistente ≠ vietato

Due casi distinti, due comportamenti distinti:

| Caso | Comportamento |
|---|---|
| **Il codice non esiste** per questa geometria (viti dritte in aria 4; `A50904.22`) | **Non si mostra.** Non disabilitata: assente. MC vede due opzioni di squadra, non quattro. |
| **I codici esistono tutti, ma il listino stampa un divieto** (la NB «due nottolini necessario per tutte le classi antieffrazione») | **Avviso persistito, mai blocco.** |

**PERCHÉ AVVISO E NON BLOCCO.** È il precedente stabilito dal progetto per lo sconto oltre
soglia: *avviso, mai blocco*. E impedire un ordine i cui codici esistono tutti, sulla base della
**nostra lettura** di una NB, sarebbe peggio del difetto che stiamo togliendo. L'avviso non si
perde: `kit.generate` salva l'intero output in `generatedKit`, e `dettaglio-client.tsx`
(`getWarnings`) lo rilegge già sulla scheda della richiesta.

*(Nota: la domanda che avevo portato al council — «i warning non sono persistiti» — era
**falsa**, e l'ha smontata il Contrarian verificando il codice.)*

**Il ritorno indietro nel wizard.** La geometria si sceglie al passo 3 e le varianti al passo 4:
tornare indietro e cambiare geometria può lasciare nel form una variante ora impossibile. Serve
**una sola** funzione `variantiDisponibili(geometry, entrata)`, usata **sia** dal wizard **sia**
dal modulo — non due liste che possono divergere. Al cambio di geometria, le scelte non più
disponibili tornano al default.

---

## 9. UI — «Componenti», mobile-first

Nuovo passo **4 «Componenti»**; il riepilogo diventa il **5**.

- **Parte chiusa**: *«Componenti standard · modifica»*. Sei scelte in fondo a un wizard, a
  375px, sono un muro; e se non si tocca nulla la distinta è quella di oggi.
- **Etichetta del default** — e qui si diverge da come l'aveva formulata l'utente. Non «quello
  che ordiniamo oggi»: quella è un'affermazione su come ordina l'azienda, che **il progetto non
  possiede** — le tre distinte reali di MC, Peruzzi e Fosca non sono mai arrivate. L'etichetta è
  «**standard del programma**», con la nota «*mai confrontato con un ordine vero*», nella stessa
  voce già adottata dalla PR #44 per il profilo cliente.
- **Ogni opzione mostra**: codice intero in **mono**, prezzo, e il **Δ rispetto all'attuale**
  (`+0,49 €`, `−4,06 €`) — perché sulla squadra angolare ballano 4 € che vanno visti *mentre* si
  sceglie, non nel totale. I prezzi sono al **lordo di listino AGB**, come le righe della
  distinta (lo sconto cliente resta solo nel riepilogo, PR #42).
- **Pulsante «Visualizza nel listino»** su ogni opzione: il visore esiste già e apre alla pagina
  evidenziando il codice. Un'opzione senza pagina da mostrare non è un fatto ma una nostra
  deduzione — e non ce ne sono, tutte e 74 hanno la loro.
- **Antieffrazione**: un interruttore in cima; acceso, mostra in chiaro **cosa cambia** (vecchio
  codice → nuovo, Δ prezzo) e un tasto **«Modifica»** che apre le tre scelte separate.
  Poiché l'interruttore **non è salvato** (§7), riaprendo una richiesta il suo stato si
  **deriva** dalle tre scelte: tutte e tre antieffrazione → acceso; nessuna → spento; parziale →
  acceso con l'indicazione «*parziale — 2 di 3*». Una sola funzione pura, testata, e mai una
  parola che descriva uno stato che i dati non hanno.
- Le sigle interne (V1…V6) **non compaiono mai** a schermo.
- Riepilogo: le tre scelte scritte **per esteso**, mai la parola «antieffrazione» da sola.
- Verifica obbligatoria a **≤375px** e desktop, screenshot **guardati** (non solo verdi).

---

## 10. Test

1. **Golden invariato, asserito**: `variants` assente → 16 righe / 21 pezzi / **90,20 €**;
   gemello entrata 7,5 → **96,29 €**. Non può muoversi per costruzione (i default *sono* i
   codici di oggi), e il gate lo dimostra.
2. **Un test per variante**: cambia il codice atteso e **solo** quello (ortogonalità, come già
   fatto per l'entrata nella PR #40).
3. **`no-silent-fields`** esteso al registro, con una fixture per variante (§6).
4. **Variante non consumata → errore**, con il nome nella diagnostica.
5. **Disponibilità**: `A50901.22`/`A50904.22` non offerti su `A4_I85_B15`; viti dritte non
   offerte in aria 4; `incontroRibalta` non offerto su `A4_ASSE9`.
6. **Avviso** (non errore) su antieffrazione con movimento angolare a un nottolino.
7. **`.strict()`**: una chiave sconosciuta in `variants` fa fallire il parse.
8. **Gate su catalogo reale esteso alle TABELLE del registro**, non alle sole distinte: tutti e
   74 i codici, non i 10 che capita di emettere. È il test che smascherò PVC e battente.
9. **Antieffrazione sul golden**: 17 righe / 22 pezzi / **110,13 €** (mov. angolare +6,14 ·
   incontri 5×(3,03−0,81) = +11,10 · piastrino +2,69).

---

## 11. Fuori scope, esplicitamente

- **V2, V3/V5** (corpo incontro, perni di posizionamento): domanda 29 aperta (§3).
- **Varianti sul cliente**: decisione dell'utente, «solo sulla richiesta, per ora». Conseguenza
  da dichiarare: la squadra angolare *è* per definizione un'abitudine per cliente, quindi se un
  cliente devia stabilmente dallo standard lo si riscoprirà a ogni richiesta. Il dato ha la
  stessa forma, quindi spostarlo sul cliente resta poco costoso.
- **Cambiare le varianti dopo la creazione**: non è possibile, in nessun modo. `kit.setVariants`
  non esiste, e `kit.ricalcola` le eredita **verbatim** (`src/server/api/routers/kit.ts:249-252`):
  l'unica via è **rifare il wizard da capo**. Qui c'era scritto «si usa il ricalcolo versionato»,
  ed era **falso** — corretto in §4 insieme a questo punto. Il seguito naturale è un `variants`
  opzionale in input a `ricalcola` (assente = eredita, presente = sostituisce): non riscrive
  nulla di emesso, perché la nuova versione nasce comunque `DRAFT`. **Va detto agli agenti
  insieme alla feature**, altrimenti è la prima segnalazione dal campo.
- **Il fungo e la sede 30**: §5.4. Sono una famiglia di schemi, e richiedono prima l'incontro
  DSS 13x30, che a listino **non esiste**.
- **Finiture** (11 colori di copertura, **domanda 22**) e **microventilazione / spessori di
  sollevamento** (**domanda 20**): niente codici mappati con certezza.

---

## 12. Difetto pre-esistente rilevato, NON corretto qui

`src/server/api/routers/kit.ts:143` — `output.lines.filter((line) => line.productId !== null)`:
una riga il cui codice non è a catalogo **sparisce** dai componenti, lasciando solo una stringa
in `generatedKit`. L'agente vede una distinta **più corta** e un avviso testuale, non una riga
segnalata. Le varianti moltiplicano la superficie di codici e quindi il rischio; il gate di §10.8
lo neutralizza *per queste tabelle*, ma il difetto resta. Va aperto a parte.

---

## 13. Azioni ops

**Una migrazione** (`variants` su `kit_requests`, nullable, nessun default DB, **nessun
backfill**). Lezione applicata dalla PR #44: si lancia «Ops — Neon» **sul ref del branch, prima
del merge** — `kit.get` fa `findFirst` senza `select`, quindi prima della migrazione
fallirebbero le **letture**, non solo le scritture (la PR #40 costò venti minuti di produzione
rotta).

Nessun re-import, nessun seed nuovo previsto: i 74 codici sono stati verificati **sul PDF**, con
la stessa firma di riga che legge l'importatore, e hanno tutti la forma già coperta dal parser
allargato del 2026-07-25 (segmenti alfanumerici `.DX/.SX/.CR/.DC`). La prova sul **catalogo
vero** è il gate di §10.8, che gira prima del merge: se lì mancasse un codice, l'azione ops
diventa migrazione **+ re-import**.

---

## 14. Cosa questa PR chiude

- ✅ Le **due domande** dell'antieffrazione, senza che l'esperto debba rispondere.
- ✅ **Domanda 2** (squadra angolare): non più indovinata, e l'incoerenza MC/altri diventa
  visibile e correggibile da chi ordina.
- ✅ L'**ASSUNZIONE acciaio/zama** dell'incontro ribalta.
- ⏳ **Non** chiude: domanda 29, domanda 20, domanda 22 — e non chiude, soprattutto, la
  mancanza delle **tre distinte reali**, che resta la cosa che vale di più. Anzi la rende più
  urgente: ora avremmo un posto preciso dove mettere la risposta.
