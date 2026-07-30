# Kit ARTECH legno: l'entrata maniglia, da costante muta a scelta

> Spec del 2026-07-30. Chiude l'ultimo parametro noto che il motore decide da sé
> senza dirlo. Segue la PR #39 (sette geometrie reali) e ne applica la stessa
> dottrina: tabelle di **codici interi**, guardie che **rifiutano** invece di
> inferire, e un test che rende impossibile la ricaduta.

---

## 1. Il fatto

Il motore sceglie la cremonese in **entrata 15** — `A50122.15.NN` — dalla Fase 1d,
cablata. Non c'è nessuna guardia, perché il campo **non esiste nell'input**:
`assertSeatConfigSupportata` e la tabella `GEOMETRIE` coprono aria, interasse,
battuta e sede, e basta.

Un serramento a entrata 7,5 riceve quindi **in silenzio** la cremonese
dell'entrata 15. Il codice emesso esiste, ha un prezzo, non produce alcun
warning: la distinta non somiglia a un guasto, somiglia a una risposta. È
esattamente la classe di difetto che la bonifica del 2026-07-25 ha chiuso sui
quattro campi geometria — sopravvissuta su un parametro che nessuno aveva
guardato.

Sul GR07, che è quello del golden, l'errore vale **6,09 € su 90,20 €**: il 38 %
in più sulla riga, il 6,7 % sul totale.

---

## 2. Cosa dice il listino

### 2.1 L'asse ha due valori, non tre

L'handoff della sessione precedente descrive l'entrata come «0, 8 e 15». È
sbagliato in due punti. A `p0424 (422)` la colonna ENTRATA è etichettata:

| Etichetta a listino | 2° segmento | Che cos'è |
|---|---|---|
| `1) 7,5` | `.08` | entrata **7,5** — non 8 |
| `2) 15` | `.15` | entrata 15 |
| `3) Asta*` | `.00` | **non è un'entrata**: è la versione ad asta |

La nota della terza riga lo dice: «*nella versione asta non sono presenti il DSS
e il monoblocco martellina*». È un'altra famiglia di prodotto — niente maniglia,
quindi niente entrata — e resta **fuori scope** (§10).

L'asse reale ha dunque **due valori**. Un'ulteriore conferma che la quota è
quella della maniglia viene dalla NB della stessa pagina: «*monoblocco martellina
sostituibile per variare l'**entrata maniglia***».

### 2.2 Anta-ribalta: uno scambio pulito

`A50122.08.*` e `A50122.15.*` hanno **le stesse nove bande HBB**, gli stessi GR e
la stessa altezza maniglia, riga per riga. Cambia il codice e cambia il prezzo:

| GR | HBB | entrata 15 | € | entrata 7,5 | € | Δ |
|---|---|---|---|---|---|---|
| 02 | 610-810 | `A50122.15.02` | 12,38 | `A50122.08.02` | 17,09 | +4,71 |
| 03 | 794-1010 | `A50122.15.03` | 12,62 | `A50122.08.03` | 17,28 | +4,66 |
| 04 | 994-1210 | `A50122.15.04` | 13,00 | `A50122.08.04` | 17,95 | +4,95 |
| 05 | 1194-1410 | `A50122.15.05` | 13,77 | `A50122.08.05` | 19,14 | +5,37 |
| 06 | 1394-1610 | `A50122.15.06` | 14,54 | `A50122.08.06` | 19,92 | +5,38 |
| **07** | **1594-1810** | `A50122.15.07` | **16,03** | `A50122.08.07` | **22,12** | **+6,09** |
| 08 | 1794-2110 | `A50122.15.08` | 17,50 | `A50122.08.08` | 23,97 | +6,47 |
| 09 | 1994-2310 | `A50122.15.09` | 19,38 | `A50122.08.09` | 27,06 | +7,68 |
| 10 | 2194-2510 | `A50122.15.10` | 21,25 | `A50122.08.10` | 28,93 | +7,68 |

Tutti e nove i codici dell'entrata 7,5 sono **a listino con prezzo**. Restano
esclusi, per entrambe le entrate e per le ragioni già documentate, il `.17`
(«07bis», altezza maniglia 1050 che si sovrappone al `.07`) e le `.31`/`.41` di
`p0425 (423)`, che si selezionano per HBB **e** per LBB.

**Unica asimmetria fra le due entrate**: al GR03 l'entrata 7,5 dichiara `NOT. −`
dove la 15 dichiara `1`, con nota «*il cremonese entrata 7,5 GR3 nelle due ante
deve essere usato con asta a leva `A51504.19.13`*». Vedi §7.2.

### 2.3 Vasistas: **non** è uno scambio

La vasistas ha la sua cremonese cablata sull'entrata 15 (`A50111.15.*`,
`p0426 (424)`, tabella «Anta ribalta/vasistas - altezza maniglia
variabile/centrale»), e a listino esistono anche le `A50111.08.*`. Ma due NB
della stessa tabella dicono:

> NB: GR 1-2-3 E.15 richiede una forb. vasistas `A50545.00.00`. **Su E.7,5 forbici
> vasistas non applicabili**
>
> NB: GR 4-5-6 E.15 richiede due forb. vasistas `A50545.00.00`. **Su E.7,5 forb.
> vasistas solo su GR 5 e 6**

A entrata 7,5 un componente che oggi emettiamo **sparisce su quattro gruppi su
sei**, e il listino **non dice cosa vada al suo posto**. In più il GR00
(`A50111.15.10`, HBB 274-662) esiste **solo** per l'entrata 15.

Questa è, alla lettera, la situazione che ha fatto disattivare PVC e battente
nella bonifica: una distinta a cui manca un pezzo, o un pezzo inventato.

### 2.4 Battente: l'entrata 7,5 non esiste proprio

A `p0429 (427)` la tabella «Anta a battente - Mod. 502 per finestra e porta
finestra a 1 anta» ha nella colonna ENTRATA **un solo valore, `15`**. Non è che
l'entrata 7,5 sia problematica: per questa cremonese **non è pubblicata**. Il
modulo è comunque `isActive: false` dalla bonifica.

---

## 3. Decisioni prese

Tutte e tre dall'utente, il 2026-07-30, prima del design.

| Decisione | Scelta | Alternativa scartata |
|---|---|---|
| **Perimetro** | Asse pieno sull'**anta-ribalta**; vasistas **rifiuta** l'entrata 7,5 | Coprire anche la vasistas (avrebbe richiesto di inferire il pezzo mancante) |
| **Default** | **Nessuno**: scelta esplicita, il passo non avanza senza | Preselezionare la 15 |
| **Backfill** | **Tutte** le righe ARTECH esistenti a `E15` | Solo le emesse · nessuna |

La ragione del «nessun default» è quella per cui il lavoro esiste: un valore
preselezionato è lo stesso silenzio di oggi, spostato in un posto più visibile.
Chi tabula oltre riceverebbe ancora la 15.

La ragione del backfill totale è che fino a oggi l'entrata **non era un input**:
era una **costante del motore**, che ha emesso `A50122.15.*` su ogni distinta
senza eccezioni. Scrivere `E15` su quelle righe non è un'ipotesi, è registrare la
costante che si è applicata. È il caso opposto a quello del backfill della
geometria nella PR #39, dove le colonne legacy potevano dire aria 4 o sede 30 e
assumere il pilota avrebbe **falsificato** dati di produzione.

---

## 4. Il modello

### 4.1 Input

`artechInputSchema` prende un campo, **obbligatorio e senza `.default()`**:

```ts
entrata: z.enum(["E75", "E15"], {
  required_error: "Scegli l'entrata maniglia (7,5 o 15 mm).",
  invalid_type_error: "Scegli l'entrata maniglia (7,5 o 15 mm).",
}),
```

**Il messaggio è esplicito e in italiano, e non è un dettaglio.** Il wizard mostra
`result.error.issues[0].message` così com'è (`firstIssueMessage`): con il testo di
default di zod l'agente leggerebbe «Required» in mezzo a una UI italiana, proprio
sul campo che questo lavoro esiste per rendere comprensibile.

Solo sul ramo ARTECH. Il ramo TOUR non lo prende: il bilico ha entrata 30 come
proprietà costruttiva del kit (`rules-tour-bilico-legno.ts`, NB di listino), non
come scelta.

**Perché un campo e non un valore di `geometry`.** Le due cose non sono lo stesso
tipo di asse. Aria, interasse e battuta **si muovono insieme** — cambiarne una
cambia squadra, supporto, braccio e incontri — e le loro combinazioni valide sono
un insieme chiuso e irregolare: è per questo che `A50904.22` non esiste e la
geometria è un discriminatore. L'entrata è invece **ortogonale**: seleziona la
famiglia della cremonese e nient'altro, identicamente in tutte e sette le
geometrie. Dentro il discriminatore avrebbe raddoppiato le righe di `GEOMETRIE`
da 7 a 14, ognuna copia dell'altra per un solo codice — la duplicazione che
invita al disallineamento. `seatConfig` è il precedente: asse indipendente, campo
indipendente.

**Perché `E75` e non `E7_5`.** Segue la convenzione già in casa: `ArtechGeometryId`
scrive l'interasse 8,5 come `I85` in `A4_I85_B15`. Il commento sul tipo dichiara
per esteso che `E75` è l'entrata **7,5**, perché il nome da solo è ambiguo.

### 4.2 Persistenza

```prisma
enum Entrata { E75  E15 }

model KitRequest {
  entrata Entrata? @map("entrata")   // NULL sulle righe TOUR
}
```

Nullable come `geometry` e `seatConfig`, e per la stessa ragione: le righe TOUR
non hanno questo campo. **Nessun `@default` a livello DB** — stesso criterio già
motivato nello schema per `seatConfig`: un default DB valorizzerebbe anche le
righe che non devono averlo.

Migrazione `…_kit_entrata` (timestamp generato da Prisma): crea l'enum, aggiunge
la colonna, e backfilla `E15` su `WHERE series = 'ARTECH'`. Le TOUR restano NULL.

### 4.3 Rilettura

`from-request.ts` legge `entrata: row.entrata` **senza `?? "E15"`**.

È il punto in cui la decisione «nessun default» diventa strutturale invece che
cosmetica. Il modulo esiste perché `kit.generate` non rigenera dall'input
originale: **rilegge la riga**, che va trattata come input non fidato. Se un
giorno comparisse una riga ARTECH senza entrata, è un dato rotto e va rifiutata
con un messaggio, non tappata con un valore plausibile. Dopo il backfill non ne
esistono.

`PersistedKitRequest` prende `entrata: string | null`.

---

## 5. Le regole

`CREMONESI` in `rules-artech-legno.ts` passa da lista a mappa per entrata:

```ts
const CREMONESI: Record<Entrata, readonly Banda[]> = { E15: [...], E75: [...] };
```

**Codici interi, mai composti.** Non `A50122.${entrata}.${gr}`. È la regola
stabilita dalla PR #39, e qui vale doppio: per l'entrata 7,5 la vasistas pubblica
**sei** gruppi mentre l'anta-ribalta ne pubblica **nove**, quindi una
composizione a runtime genererebbe `A50111.08.10` — un GR00 a entrata 7,5 che non
esiste.

`pick()` non cambia: le bande sono identiche fra le due entrate, cambia solo il
codice associato.

L'entrata tocca **una riga su sedici**. Gli altri quindici componenti — squadra,
supporti, braccio, fusto, movimento angolare, incontri, coperture, chiusure — non
la vedono.

**Non estraggo un modulo condiviso** per le due tabelle cremonesi. La simmetria è
apparente: quella dell'anta-ribalta è «altezza maniglia fissa», quella della
vasistas «altezza maniglia variabile/centrale», con bande, numerazione dei GR e
colonna NOT. diversi. Metterle nello stesso file le farebbe sembrare due varianti
di una cosa sola, che non sono.

---

## 6. La UI

Un `<fieldset>` nuovo al **passo 3 «Geometria e mano»**, subito dopo la geometria
e prima della sede — l'ordine in cui le tre quote si leggono sul disegno.

- **Etichetta**: «Entrata maniglia». Non «Entrata» secca: la lezione della PR #37
  è che un agente esperto non riconosce il nome di una quota se il listino la
  chiama in due modi.
- **Hint**, legato con `aria-describedby`: l'entrata è il **secondo numero del
  codice** della cremonese — `A50122.`**`15`**`.07` — ed è la colonna ENTRATA
  delle tabelle «Cremonesi». Stessa struttura dell'hint della sede: prima dove si
  legge sul listino, poi come si scrive.
- **Due opzioni**, `7,5 mm` e `15 mm`, ognuna col prefisso di codice che produce.
  **Nessuna preselezionata.**
- `STEP_SCHEMAS.ARTECH[2]` prende `entrata: true` nel `pick`: il passo non avanza
  e mostra il messaggio dello schema.

**Il costo tecnico della scelta «nessun default», ed è l'unico.** `ARTECH_DEFAULT`
non può più essere un `ArtechKitInput` completo, perché l'entrata deve nascere
non valorizzata. Lo stato del form diventa un tipo con `entrata?: Entrata`; la
validazione vera resta quella dello schema, all'avanzamento del passo e al
submit. Nessun altro punto della catena si allenta.

Compare inoltre: nel **riepilogo** (passo 4) e nella **scheda richiesta**, accanto
a Geometria e Sede; e nella `ruleDescription` della riga cremonese, così la
distinta stampata dice a quale entrata si riferisce.

**Mobile-first**: verifica a ≤ 375 px. Il gruppo sta su una colonna sotto `sm`,
come gli altri (`grid-cols-1 sm:grid-cols-2`); la griglia dei materiali ha già
dato questo problema nella bonifica.

---

## 7. Rifiuti e assunzioni dichiarate

### 7.1 Rifiuti

| Caso | Comportamento |
|---|---|
| **Vasistas + `E75`** | `KitGenerationError` con la ragione: le due NB di `p0426 (424)` tolgono le forbici vasistas su quattro GR su sei e il listino non dice cosa metterci |
| **Battente + `E75`** | `KitGenerationError`: la cremonese Mod. 502 è pubblicata solo in entrata 15 (`p0429 (427)`). Il modulo è già inattivo — la guardia esiste perché non resti un buco il giorno che si riaccende |
| **Riga ARTECH con `entrata` NULL** | Rifiuto in `from-request.ts` |

Le tabelle di vasistas e battente **restano E15-only**: non si trascrivono righe
che non si possono usare.

### 7.2 Dichiarata, non rifiutata — nuova domanda 27

Al **GR03** l'entrata 7,5 dichiara `NOT. −` dove la 15 dichiara `1`, con nota che
nelle **due ante** serve l'asta a leva `A51504.19.13`.

Il motore genera **anta singola**, quindi la nota non ci riguarda e nessun codice
cambia. Ma è un'asimmetria vera fra le due entrate, sull'unico gruppo in cui il
listino le tratta diversamente: va scritta invece che lasciata implicita.
Diventa **domanda 27** in `DOMANDE-APERTE.md` (l'ultima usata dalla PR #39 è la
26).

---

## 8. Testing

| Prova | Atteso |
|---|---|
| **Golden invariato** | 550×1820 SX argento, chiusure ON, `entrata: "E15"` → **16 righe / 21 pezzi / 90,20 €**, zero warning |
| **Golden gemello** | stessa finestra, `entrata: "E75"` → 16 righe / 21 pezzi, cremonese `A50122.08.07`, totale **96,29 €** |
| **`no-silent-fields`** | `entrata` fra le **mutazioni** dell'anta-ribalta: cambiarla **deve** cambiare l'output. Sulla vasistas la mutazione **solleva** |
| **Gate su catalogo reale** | da 7 geometrie × 2 mani a **× 2 entrate**: ogni codice emesso esiste a listino **con prezzo** |
| **Rifiuti** | vasistas + `E75` · battente + `E75` · riga ARTECH senza entrata |
| **Bande** | i 9 codici di ciascuna entrata sulle 9 bande HBB, estremi inclusi |
| **Browser** | desktop e **375 px**: blocco del passo senza scelta, entrambe le entrate fino al riepilogo |

I **96,29 €** sono aritmetica (90,20 − 16,03 + 22,12) e vanno **confermati sul
catalogo vero** prima di trattarli come secondo golden: il golden a 90,20 € è
verificato su una distinta reale AGB, questo no.

`no-silent-fields.test.ts` è il test che conta. Verifica la lista degli inerti
**nei due sensi**, quindi non si può chiudere questo lavoro dichiarando l'entrata
inerte: se lo fosse, il test fallirebbe.

---

## 9. Azioni ops al merge

1. **`migrate deploy`** → `…_kit_entrata` (enum, colonna, backfill `E15` sulle
   righe ARTECH).
2. **Nessun re-import del catalogo**: i nove `A50122.08.*` sono già a listino con
   prezzo, garantito dal gate di §8.
3. **Nessun `db:seed:kit`**: i template non cambiano.
4. Verifica funzionale: il golden 550×1820 SX argento chiusure ON con entrata 15
   deve restare **16 righe / 90,20 €**.

---

## 10. Fuori scope, esplicitamente

- **Versione asta** (`A50122.00.*`, `A50111.00.*`): non è un valore dell'entrata
  ma un'altra famiglia — senza DSS né monoblocco martellina, e per l'anta-ribalta
  pubblicata solo fino al GR07 (oltre, il listino rimanda a `A50104.00.xx`).
- **Famiglia «senza DSS»** (`A50125.*`, stessa pagina, stesse bande, prezzo più
  basso): è un asse **variante**, non l'entrata. Ricade nel fuori-scope
  «varianti componenti» già dichiarato dalla spec del 2026-07-29.
- **Entrata sul profilo cliente**: l'entrata è tipicamente costante per cliente,
  quindi è un candidato naturale per `CustomerKitProfile` (§3.5 della spec del
  2026-07-29, Piano 2). Qui non si tocca: prima il campo deve esistere.
- **Vasistas a entrata 7,5**: riaperta solo da una risposta dell'esperto o di AGB.

---

## 11. Domande

- **Nuova 27** — l'asimmetria del GR03 fra le due entrate (§7.2).
- **17, già aperta** — «quale entrata usate, e da cosa dipende?». Questo lavoro
  **non ci dipende più**: il campo esiste e l'agente sceglie. La risposta serve
  ora a sapere quale sia il caso frequente, non a sbloccare il codice.
