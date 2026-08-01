# Cambiare le varianti dopo la creazione — design

> 2026-08-01 · verifica funzionale della #47 → brainstorming → `/llm-council`
> (5 advisor + 3 peer review, verdetto unanime) → questa spec.
> Nessuna migrazione: la colonna `kit_requests.variants JSONB` esiste dalla #47
> ed è già su Neon (ops run `30659737114`).

---

## 1. Da dove nasce

La #47 ha dato all'agente il passo «Componenti»: cinque scelte che il listino lascia
aperte — squadra angolare, incontro ribalta, movimento angolare, incontri nottolino,
piastrino antieffrazione — con codice, nome a catalogo, prezzo e differenza davanti.

Una volta creata la richiesta, però, **quelle scelte non si cambiano più**.
`kit.ricalcola` le fa ereditare verbatim alla nuova versione
(`src/server/api/routers/kit.ts:249-252`) e nessuna mutation le tocca: chi ha creato
una richiesta «Normale» e poi vuole l'antieffrazione **deve rifare il wizard da capo**.
La spec della #47 sosteneva il contrario ed è stata corretta nel commit di chiusura
review; il difetto è dichiarato in `handoff.md` fra le cose aperte.

È il seguito naturale, ed è piccolo perché la colonna c'è già.

---

## 2. Il vincolo dell'utente

Due decisioni prese prima della spec, che questo design non rimette in discussione:

1. **Si riapre il wizard precompilato** dalla richiesta esistente, posizionato al passo
   «Componenti». Non un pannello sulla scheda, non una schermata nuova.
2. **Su una riga `DRAFT` le nuove varianti si scrivono sulla stessa riga**, senza creare
   una versione. Su `DRAFT` non c'è nulla di emesso da proteggere, ed è coerente con
   «Rigenera», che già riscrive in loco per la stessa ragione.

E una terza, presa a valle del council: **«Ricalcola» si chiamerà «Nuova versione»**.
La parola «ricalcola» promette «rifai lo stesso conto», mentre il pulsante emette un
documento con un numero nuovo e congela il precedente. «Componenti» **resta** com'è.

---

## 3. La scelta: solo «Componenti» è editabile

Nel wizard riaperto su una richiesta già emessa, i passi 1-3 (tipologia, quote,
geometria/entrata/mano/chiusure) sono **visibili ma non modificabili**. Solo il passo
«Componenti» accetta input.

Le alternative sono state pressate dal council e bocciate 5 a 0.

**«Tutto editabile, un diff decide fra versione e richiesta nuova»** affida a un
`deepEqual` una domanda di **identità commerciale** — *questa è la stessa richiesta o
un'altra?* — che spetta all'agente. Due click identici produrrebbero esiti diversi, e
l'agente lo scoprirebbe dopo. Per giunta il diff girerebbe proprio sul campo dove
`NULL` significa «lo standard»: è il difetto che la #47 ha già corretto una volta (la
potatura al cambio geometria materializzava a DB uno standard che una richiesta
identica scrive `NULL`), e un diff ingenuo leggerebbe «cambiato» dove nulla è cambiato.

**«Tutto editabile, `ricalcola` accetta l'intera `specs`»** scioglie l'invariante su cui
poggia tutto il resto: la riga **è** l'input. Se la nuova versione può adottare
specifiche diverse, «v2 di KIT-2026-0001» può essere **un altro serramento**, e la
catena `supersededById` — l'unico documento di cosa è stato mandato al cliente — smette
di significare qualcosa.

La ragione per cui si sceglie A non è la prudenza, è il tipo:

> `ricalcola({ kitRequestId, variants? })` **congela la geometria nella firma**. Lo spazio
> rappresentabile resta (geometria immutata) × (varianti validate contro quella
> geometria): la combinazione mai validata diventa **irrappresentabile**, non
> «sconsigliata».

Il caso d'uso legittimo dell'opzione scartata esiste — rifare lo stesso serramento con
quote diverse — e va servito **nominato**, non dedotto: un futuro «Duplica e modifica»
verso `kit.create`. Due intenti, due pulsanti. Fuori scope qui (§7).

---

## 4. Il contratto del router

```ts
kit.ricalcola({ kitRequestId: string, variants?: Varianti })
```

| valore | significato | effetto a DB |
|---|---|---|
| **assente** (`undefined`) | eredita verbatim | comportamento odierno, invariato |
| **`{}`** | reset esplicito allo standard del programma | scrive `NULL` |
| **`{…}`** | sostituzione **integrale** (mai un merge) | scrive il JSON potato |

Tre note, ciascuna con una ragione:

**Il reset non si inventa.** `variantiSchema` ha le 5 chiavi tutte `.optional()` dentro
uno `.strict()`: `{}` è già un valore valido e già significa «nessuna variante». Serviva
solo dichiararlo nel contratto. Senza, «assente = eredita» renderebbe l'operazione a
senso unico: si potrebbe accendere l'antieffrazione e mai più spegnerla.

**`{}` si normalizza a `NULL` in scrittura.** Scrivere `{}` sulla colonna
materializzerebbe uno standard dove una richiesta identica creata da zero scrive `NULL`:
due righe indistinguibili sul serramento, diverse a DB, e il giorno in cui il default
cambia si comportano diversamente. È testualmente il difetto corretto dalla #47. Vale
anche per un oggetto che dopo la potatura resta vuoto (`{ piastrinoAntieffrazione: false }`
è «nessuna variante», non «una variante spenta»).

**Sostituzione, non merge.** Un merge lascerebbe sopravvivere una variante che l'agente
non vede più a schermo — la stessa classe di «campo raccolto e mai letto» che il progetto
ha già pagato sette volte.

**Ramo TOUR:** una richiesta bilico che riceva `variants` viene **rifiutata**
(`BAD_REQUEST`). Le varianti stanno nel ramo ARTECH dell'unione discriminata, e il motore
già rifiuta a runtime una variante che il modulo non dichiara: qui il rifiuto arriva
prima, con un messaggio che nomina la serie.

---

## 5. La validazione sta prima di qualunque scrittura

`ricalcola` con `variants`:

1. rilegge la riga (`findFirst`, ownership per `agentId`);
2. applica le guardie odierne (`supersededById`, stato);
3. ricostruisce l'input con **`kitInputFromRequest`** sostituendo le varianti;
4. **esegue il motore in memoria** (`new KitEngine(ctx.db).generate(input)`);
5. **solo se il motore produce righe** apre la transazione che crea la versione e marca
   `supersededById`.

Il punto 4 non è cintura e bretelle. Le varianti disponibili **dipendono dalla
geometria**: per l'interasse 8,5 di MC il listino pubblica **due** squadre angolari su
quattro, e per l'aria 4 gli incontri a viti dritte non esistono affatto. Senza la
validazione a monte, una variante non disponibile verrebbe scoperta da `generate`
**dopo** che la nuova riga esiste e la vecchia è già marcata superata: resterebbe una
richiesta superata che punta a una riga non generabile, e la vecchia sarebbe congelata
(sia `generate` sia `ricalcola` la rifiutano).

**`generate` NON entra nella transazione.** Tre advisor su cinque l'hanno chiesto, ma la
premessa era sbagliata su due punti verificati nel codice: l'atomicità e la guardia di
concorrenza **esistono già** (`$transaction` a callback + `updateMany({ where: { id,
supersededById: null } })`, con il check-then-act documentato), e ciò che resta dopo la
validazione in memoria non è una «bozza morta» ma una `DRAFT` con «Rigenera» e il
messaggio — uno stato di recupero progettato apposta, non un vicolo cieco. Fondere due
mutation per un caso che ha già una via d'uscita è costo senza ritorno.

**Su `DRAFT`:** niente versione (vincolo §2.2). Le varianti si scrivono sulla stessa
riga e si restituisce lo stesso id, come oggi. La validazione a monte vale identica: una
variante non disponibile deve essere rifiutata **prima** di toccare la colonna, altrimenti
la bozza resta con un dato che nessuna generazione accetterà.

---

## 6. L'idratazione del wizard non è un secondo percorso di lettura

È il rilievo più importante emerso dal council, ed era fuori dalle tre opzioni.

Un wizard che si precompila leggendo le colonne della riga è una **seconda
ricostruzione** dell'input, parallela a `from-request.ts`. Se le due divergono — un campo
aggiunto dopo, un `NULL` interpretato diversamente — l'agente vede a schermo una
configurazione che **la riga non codifica**, e la conferma. Nessun test attuale se ne
accorgerebbe.

Non si sorveglia: non si crea. **Solo `engine.ts` porta `server-only`**; `from-request.ts`,
`types.ts` e `artech-varianti.ts` sono già importati da componenti client
(`dettaglio-client.tsx`, `nuova-client.tsx`). Quindi il wizard idrata **con la stessa
`kitInputFromRequest`** che usano `kit.generate` e `kit.ricalcola`, e un test lo fissa:
la forma idratata è, per costruzione, quella che il motore rileggerà.

Se `kitInputFromRequest` **rifiuta** la riga (una richiesta scritta prima di un cambio di
schema, `geometry` a `NULL`), il wizard non si apre precompilato a metà: mostra il
rifiuto con il messaggio del motore. Una riga che il motore non sa rileggere non si
modifica — si rifà.

---

## 7. Cosa resta fuori, dichiarato

- **Quote e geometria editabili.** Il caso d'uso c'è, ma è un altro intento: un
  «Duplica e modifica» esplicito verso `kit.create`, nominato in UI. Mai un diff.
- **La matrice dei prezzi di tutte le combinazioni**, precalcolata e mostrata prima del
  conferma. Bocciata da tutti e tre i reviewer: sarebbe una **terza fonte di verità sul
  listino** accanto al modulo e al DB, e ripeterebbe il difetto «prezzo non a catalogo»
  affermato mentre la query sta ancora caricando (già corretto nella #47).
- **`requestNumber` coniato con `count() + 1`** su una colonna `@unique`
  (`kit.ts:47-50` e `219-222`). Portato al council il 2026-08-01 e tenuto **fuori**, con
  la diagnosi riscritta dopo aver verificato tre affermazioni degli advisor:
  - «basta una riga cancellata e la collisione diventa deterministica» → **non
    raggiungibile oggi**: non esiste alcun `kitRequest.delete`/`deleteMany` in `src/` né
    in `prisma/`, e nessuno dei quattro `onDelete: Cascade` dello schema punta a
    `KitRequest` (vanno verso `ActivityLog`, `KitComponent`, `ChatMessage`).
  - «retry da cinque righe» → **non funziona come descritto**: in `ricalcola` il `count()`
    sta **fuori** dalla `$transaction` e la `create` dentro, quindi un `P2002` aborta
    l'intero callback — il retry dovrebbe riavvolgere anche l'`updateMany` che marca
    `supersededById`. Non è una pezza, è un rifacimento della mutation.
  - ciò che regge: `count()` conta **anche le righe superate**, quindi ogni ricalcolo
    consuma un numero e `KIT-2026-0042` e `0043` possono essere lo stesso serramento. Ma
    è **il disegno attuale**, non un difetto: l'activity log scrive «nuova versione di X».
    Rendere il ricalcolo routine trasforma però la domanda in una vera — *il numero
    identifica la richiesta o la versione?* — che è una decisione dell'**ufficio
    commerciale**, non una patch. Va in `DOMANDE-APERTE.md`, non nei debiti tecnici.

  Resta quindi aperta la sola corsa: un 500 raro, senza corruzione, che il riprova
  dell'agente risolve.
- **Il test che lega le 18 colonne copiate a mano in `ricalcola` allo schema Prisma.**
  È `no-silent-fields` applicato alla persistenza invece che ai moduli, e `variants?` in
  input tocca proprio quella lista. Subito dopo, non dentro.
- **Il totale può cambiare fra v1 e v2 senza che sia cambiata una variante**, se nel
  frattempo il catalogo è stato re-importato. Vero, e fuori scope: è il senso stesso del
  ricalcolo versionato.

---

## 8. Test — cosa deve fallire se qualcuno rompe qualcosa

**Router** (`kit.test.ts`):
- `variants` assente → la nuova versione eredita verbatim (regressione della #47).
- `variants: {…}` → la nuova versione porta le nuove, non un merge con le vecchie.
- `variants: {}` → la nuova versione ha `NULL`, non `{}`.
- una variante potata a vuoto → `NULL`, non `{}`.
- variante non disponibile per la geometria della riga → `BAD_REQUEST` **e nessuna
  scrittura**: la vecchia riga non è marcata superata e non esiste una riga nuova.
- riga `DRAFT` → stesso id, colonna aggiornata, nessuna versione nuova, nessun numero
  `KIT-` consumato.
- riga `TOUR` + `variants` → `BAD_REQUEST` che nomina la serie.
- riga superata → `CONFLICT` (guardia odierna, invariata).

**Idratazione** (`from-request` / wizard): la forma con cui il wizard si precompila
coincide con `kitInputFromRequest(row)` — cioè non esistono due letture.

**Golden, non negoziabile:** `16 righe / 21 pezzi / 90,20 €`, gemello entrata 7,5
`96,29 €`, antieffrazione completa `17 righe / 22 pezzi / 110,13 €`. Dalla #47 sono
asseriti anche l'**ordine assoluto** delle righe e le 16 descrizioni carattere per
carattere.

**Da chiudere in questa PR** (buco trovato durante la verifica funzionale del 2026-08-01,
portato al council il 2026-08-01, verdetto unanime «dentro questa PR»):

`110,13 €` **non è asserito da nessun test**, e non «solo da un test unitario» come
scritto in un primo momento: `rules-artech-legno.test.ts:548` asserisce 17 righe, 22
pezzi e i tre codici, ma **non vede i prezzi affatto** — i moduli regola restituiscono
righe senza prezzo, che il motore risolve dopo contro il catalogo. Il numero vive solo
nei `.md`. Le ~15 righe non aggiungono una seconda rete: **sono la prima**.

Nello **stesso file** il bilico TOUR asserisce ancora `toBeGreaterThan(0)`
(`engine.integration.test.ts:159`) mentre i tre totali reali sono noti dalla #35 e sono
stati **ri-misurati sul catalogo importato oggi**, identici: `450,03 €` (3 lati, 7 righe
/ 18 pezzi) · `766,51 €` (4 lati, 9 / 20) · `433,46 €` (schema 3, 8 / 19). Si asseriscono
anche quelli: `toBeGreaterThan(0)` accanto a tre totali esatti è la stessa asimmetria che
la #44 ha già chiuso una volta sul golden, e il gate diventa così un **oracolo di
prezzo** — al listino 2027 non dirà «rotto», dirà *quali configurazioni sono cambiate e
di quanto*.

**Browser**: desktop e **375px**, con gli screenshot guardati.

---

## 9. Cosa vede l'agente

- Sulla scheda: il pulsante oggi chiamato «Ricalcola» diventa **«Nuova versione»**, e
  accanto compare **«Modifica componenti»** (stesso nome del passo, che §2 lascia
  invariato). Compare su una richiesta **emessa** e anche su una **bozza** — su bozza è
  proprio il caso in cui la generazione è fallita e l'agente vuole cambiare qualcosa —
  e **non** su una riga superata, dove già oggi non si opera.
- Il wizard si apre al passo «Componenti», con i passi precedenti **visibili e non
  modificabili**, ciascuno con il **motivo** scritto e la via d'uscita — «per cambiare le
  quote serve una richiesta nuova». Un campo grigio senza spiegazione è un ticket al
  supporto.
- L'intestazione **nomina la richiesta di partenza** (`KIT-2026-0007`), perché al conferma
  ne nascerà un'altra con un numero diverso, e quella vecchia smette di valere.
- Al conferma — e **solo** al conferma — parte `ricalcola`. Se partisse all'apertura,
  un agente che cambia idea e chiude la scheda lascerebbe la vecchia richiesta superata e
  congelata, puntando a una bozza vuota.

Mobile-first, verificato a ≤375px come da regola inviolabile.
