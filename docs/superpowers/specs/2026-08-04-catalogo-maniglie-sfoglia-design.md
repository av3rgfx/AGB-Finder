# Catalogo maniglie — «Sfoglia» senza digitare

> **Stato**: ✅ **COSTRUITO** — branch `claude/maniglie-catalogo-browse-cgxvjr`.
> **Data**: 2026-08-04 · **Metodo**: 3 ricerche parallele + 3 critiche avversariali + sintesi;
> poi le cinque misure di §7 sul file vero, e `/llm-council` sulle tre decisioni residue.
> **Il prerequisito di §9.5 è stato onorato**: i file sono arrivati, le misure sono state
> fatte PRIMA di scrivere UI, e hanno **falsificato la premessa** di questa spec.
>
> ---
>
> ## ⚠️ ESITO DELLE MISURE — leggere prima del resto
>
> Questa spec assume che la prima parola della descrizione sia una **tipologia
> merceologica**. **È falso**, e la correzione è in meglio.
>
> | # | Misura (§7) | Valore misurato |
> |---|---|---|
> | a | prime parole distinte | **114** (né ≤40 né ~300) · 75 coprono il 95% · 11 singoletti |
> | b | il **secondo** token è la famiglia | **53%** — domanda sbagliata: la famiglia c'è ma cambia posto |
> | b bis | la famiglia **ovunque stia** | **79,8%** (66% al 2° token, 26% al 3°) |
> | c | famiglie distinte | **533** |
> | d | codici per famiglia (mediana) | **3** — smentisce i «36 per nome» di §5 |
> | e | code dopo l'ultimo separatore | **133**, le prime 14 coprono il **72%** |
>
> **Le 114 parole sono un misto**: tipologie (MANIGLIONE 338, BOCCHETTA 288) **e nomi
> commerciali** (ROBOT 129, PETER 41, LARA 28, FEDRA 35). Quindi **§4 riga 2 e §10.3
> sono superate**: il nome commerciale NON vive solo nel PDF con copertura 71/96 —
> è nel listino, copre il 100% delle righe e costa zero. **Il catalogo `ER MAN 2026`
> serve ora SOLO per le foto** (§6.5 resta valido).
>
> **§6.1 e §6.2 sono superate** dal verdetto `/llm-council` confermato dall'utente:
> livello 1 **alfabetico** e non per numerosità (il conteggio misura le finiture:
> MANIGLIONE ha 338 codici e **160 descrizioni distinte**), **a chip** e non a righe
> (~5,8 schermate a 375px invece di ~14), con un **filtro sulle etichette**. Aggiunto
> un **livello 2** che la spec non prevedeva, perché MANIGLIONE con 338 codici
> sarebbe 56 schermate.
>
> **§9.1 regge alla lettera** — nessuna regexp deduce nulla dal codice: la famiglia
> si trova **intersecando** descrizione e codice, due campi scritti entrambi da
> COLOMBO. **§9.3 regge**: nessuna schermata «scegli la marca».
>
> Il piano eseguito: `docs/superpowers/plans/2026-08-04-catalogo-maniglie-sfoglia.md`.

---

## 0. La richiesta, testuale

> «Non voglio una semplice ricerca della disponibilità. […] oltre a poter cercare la
> disponibilità tramite ricerca vorrei avere un vero e proprio catalogo digitalizzato. Con
> le suddivisioni in marche (per esempio: COLOMBO, HOPE, OLIVARI, DND, GHIDINI. Con magari
> al posto dei nomi delle marche come titolo, voglio i loro loghi) […] E dentro ogni marca
> tutte le sotto categorie di maniglie se esistono. Proprio come un catalogo ben ordinato,
> così se uno può cercare le maniglie anche a vista senza scrivere nulla.»

---

## 1. Il verdetto

**Il bisogno è reale e verificato; l'albero `marca → sottocategoria → prodotto` non è
costruibile su nessun dato che possediamo.** Va rovesciato in **una schermata sola, un
livello solo**, costruito sull'unica fonte che copre il 100% dei codici — la **prima parola
della descrizione del listino** — con la **marca rimandata** a quando le marche saranno due
e le **foto rimandate** a quando esisteranno.

---

## 2. Cosa è giusto nell'idea

**Il vuoto esiste, ed è nel codice.** `article.search` impone `query.min(1)`
(`src/server/api/routers/article.ts:74`) e il client non chiama nemmeno la query finché non
si digita (`maniglie-client.tsx`, `enabled: committed.length > 0`). **Non esiste alcun
percorso che elenchi qualcosa senza scrivere.** La sezione si chiama «Disponibilità» ed è
letteralmente una casella bianca: risponde solo a chi conosce già il codice. Chiedere di
guardare senza scrivere non è un capriccio: è la denuncia di un attrito preciso — battere
`0CD41R-CM` su un telefono, in piedi, col cliente davanti.

**La marca come asse è già nel modello.** `Article.brand` esiste con
`@@unique([brand, code])` e `@@index([brand])`, e `article.search` accetta già `brand`.
L'intuizione è corretta: sbagliati sono il *quando* e il *come*.

**Il riconoscimento batte il richiamo, e qui doppiamente.** L'agente non ha un codice: ha un
oggetto che il cliente indica. E la ricerca per nome non lo salva, perché le descrizioni
sono troncate a 35 caratteri, con refusi alla fonte, e il nome che il cliente pronuncia
(«la LARA») **non è un campo di `Article`**.

**Le sottocategorie esistono davvero** — il sito è stato letto (≈10 pagine, VERIFICATO). Ma
esistono **come faccette di filtro, non come livelli**, e sono diverse fra collezioni:
*Contemporanee* espone 5 gruppi con sotto-voci, *Antologhia* ne espone 4 piatte e diverse,
l'arredo bagno una decina disgiunte. **Un albero unico è già falsificato dentro COLOMBO.**

---

## 3. Il problema vero, che non è la UI

**Non esiste il campo su cui sfogliare, e la cosa che si vuole vedere non è la cosa che il
listino vende.**

`Article` ha 13 colonne e **nessuna è tassonomica**. Il listino xlsx ne ha **sei**: codice,
descrizione, prezzo, surcharge, somma, EAN (`src/server/maniglie/listino-parse.ts:17-24`).
La pronta consegna ne ha **una**. Per AGB la categoria non l'abbiamo dedotta, l'abbiamo
**letta**: era stampata nell'intestazione di pagina del listino
(`src/server/catalog/parse-listino.ts:65`). Per COLOMBO quel testo, nel file ordinabile, non
esiste.

### 3.1 Il fatto che uccide lo scraping (VERIFICATO)

**Il sito non pubblica mai un codice ordinabile.** Mostra `MD 11 R-RY`; il listino scrive
`0MD11R-CM`. Sotto `normalizeArticleCode` (soli `[A-Z0-9]`, `code-norm.ts:16-18`) diventano
`MD11RRY` e `0MD11RCM`: **non combaciano**. La chiave con zero collisioni su 3.456 codici —
la spina dorsale dell'intero dominio maniglie — **non aggancia il sito**. Insistere
significherebbe inventare una grammatica (togli lo `0`, taglia la coda): esattamente ciò che
produce `0CD63CM`, un codice che si parsifica benissimo, è nel file vero di Andrea, e **non
esiste**.

La domanda quindi non è «come disegno l'albero», è: **quale fonte autorizza l'etichetta che
scriverò sopra un codice?**

---

## 4. Le tre fonti possibili della tassonomia

| Fonte | Cosa dà | Affidabilità | Costo | Verdetto |
|---|---|---|---|---|
| **Prima parola della descrizione del listino** (`MANIGLIA`, `BOCCHETTA`, `POMOLO`, `ROSETTA`, `MANIGLIONE`, `VITE`, `MOLLA`, `QUADRO`, `BUSSOLA`…) | la **tipologia merceologica**, su **3.456 codici su 3.456** (zero descrizioni mancanti, §4.1 della spec precedente) | **DA MISURARE**, con due tracce convergenti: la spec classifica già i 513 codici scoperti proprio così («bocchette 281, rosette 47, movimenti 33, viti 21, quadri 14…») e non aveva altro campo per farlo; e il seed, dichiarato «forma misurata», ha **tutte** le 20 descrizioni che iniziano con la tipologia | **quasi zero**: un `GROUP BY` sulla prima parola dentro `src/server/maniglie/search.ts`, che è **già** uno dei due moduli autorizzati al raw SQL. Nessuna colonna, nessuna migrazione, nessun run ops | ✅ **L'unica da usare adesso.** L'etichetta è la parola scritta da COLOMBO, non una nostra deduzione |
| **Catalogo `ER MAN 2026`** (PDF, 261 pagine) | il **nome commerciale** (LARA, PETER, MILLA…), la pagina tecnica, la foto | alta dove c'è, ma **parziale e assente dal repo**: 2.943 codici su 3.456 (**85%**), 71 nomi su 96; lo script di estrazione non esiste, la mappatura immagine→codice per COLOMBO **non è mai stata misurata** (quella AGB sfrutta la banda verticale del listino, che un catalogo di design non ha), e lo shift `+29` vive **solo come frase in un `.md`** | un **passo di lavoro intero** (il passo 4) | 🟡 **Dopo, e solo se serve.** È l'unica fonte del nome commerciale: è un progetto, non un campo |
| **Scraping di `colombodesign.com`** | 3 collezioni, le faccette, 25 finiture | il sito **non espone mai un codice ordinabile** → l'aggancio non esiste; ed è **incoerente con sé stesso** (dichiara «sedici finiture», il filtro ne espone 25; `/collezione/formae/` è **404 pur essendo indicizzato**) | uno scraper senza un modo utile di fallire, più manutenzione a ogni restyling | ❌ **No** |

### 4.1 Due candidati che sembrano fonti e non lo sono

**La grammatica del codice** (`XX NN` + suffisso): verdetto **RISCHIOSO** su un campione
< 1%. `RS120`/`YQ115` hanno tre cifre e una regexp li fonde nella famiglia inesistente
`RS12`; `0CD63FP-CM` e `0CD63GB-CM` sono **due bocchette diverse** (confermato da Andrea)
che qualunque raggruppamento per prefisso unisce. Sarebbe la **nona** occorrenza della
classe di difetto chiusa otto volte.

**La curatela a mano**: 3.456 righe, nessun ruolo curatore a schema, nessuna schermata di
editing — ogni correzione di un'etichetta sarebbe branch → gate → PR → deploy → run ops.
Nessuno lo farà.

---

## 5. L'errore da non fare: 3.456 tessere non sono un catalogo

**La tessera non può essere il codice ordinabile, perché il codice ordinabile è la
finitura, e la finitura è proprio ciò che il catalogo non fotografa.**

| Misura | Valore | Fonte |
|---|---|---|
| Finiture per modello | Tool 2 · Gira 5 · Robotre 5 · Peak 6 · RobocinqueS 7 · **maniglione Mood 12** | contate una per una sulle schede del sito (VERIFICATO) |
| Densità | **36 codici per nome commerciale** (3.456 ÷ 96) | §4.3 spec precedente |
| Fotografie | **725 immagini** per 2.943 codici = **1 foto ogni 4 codici**; tetto assoluto di codici con figura propria **21%** | aritmetica sui numeri della spec |
| Confronto interno | AGB: 7.082 immagini per 7.488 prodotti = **0,95** — **4,5× meglio** | `ProductImage` |

Una griglia sui codici ordinabili mostrerebbe **dodici tessere Mood con la stessa foto**, lo
stesso nome troncato a 35 caratteri, e come unica differenza due lettere di cui **non
possediamo la tabella**: COLOMBO non pubblica da nessuna parte la corrispondenza
sigla→finitura (VERIFICATO: cercata, assente). Nei dati reali `CM` è attestato 4 volte, `NM`
una, `OL` **zero** (esiste solo nel seed inventato), e `RY` probabilmente **non è affatto
una finitura** — il catalogo scrive `SE 11 R-RY` conservandola e `CD 41 R` togliendo il
`CM`. L'occhio non separa nulla: **sfogliare, che è un atto visivo, non funziona**.

**Aritmetica dello scorrimento.** A 375px, due colonne con foto, entrano ~6 tessere per
schermata: 3.456 codici sono **576 schermate**; 96 modelli sono **16**. È la differenza fra
un catalogo e un muro.

**Se la tessera è il modello**, il prezzo diventa un intervallo — «da 101,00 €» — cioè una
classe di affermazione nuova, subito dopo che il progetto ha imposto che il totale sia
derivato e mai persistito. Va bene **purché sia scritto «da»**, e purché la tessera **apra
l'elenco dei codici veri**, ciascuno col suo prezzo e il suo stato. **Mai una griglia
terminale.**

---

## 6. Il disegno raccomandato

**Una schermata sola, un livello solo, zero migrazioni. Si chiama «Sfoglia» e vive dentro
`/maniglie`.**

### 6.1 `/maniglie` — la schermata che c'è già

Restano al loro posto la casella di ricerca e la data dell'ultimo import (già mostrata
*prima* di cercare via `article.stockInfo`, ed è l'unica cosa che autorizza il pallino
verde). **Sotto**, quando la casella è vuota — cioè al posto del nulla di oggi — compare
**«Sfoglia»**: un elenco a una colonna, righe da 44px, `TIPOLOGIA · numero di codici ·
chevron`.

Le etichette sono **le parole di COLOMBO, verbatim**, e sopra l'elenco una riga in chiaro
dice da dove vengono: *«raggruppato per la prima parola della descrizione del listino»*.
Nessun programma decide niente: è la ragione per cui questa fonte, e solo questa, non
riapre la classe di difetto chiusa otto volte.

Il gruppo è **calcolato a lettura e mai persistito**: i codici del listino nuovo si
collocano da soli — niente bucket «Altro» che cresce, niente backfill, niente fossile.

### 6.2 `/maniglie?tipo=BOCCHETTA` — nessuna schermata nuova

L'elenco è **lo stesso componente dei risultati di ricerca** (stessa riga, stessa
miniatura, stesso `StockBadge`, stessa data in cima) e il filtro entra come **chip attivo
con la ✕**, come nell'archivio serramenti. Lato server: `article.search` accetta `query`
**oppure** `tipo` (almeno uno), condividendo `resolveStock` e `toSummary` — ~30 righe, non
una feature.

**Due debiti vanno chiusi qui**, perché sfogliando si arriva oltre la ventesima riga:
- **`offset` va finalmente collegato** (il client oggi manda solo `{query, limit}`);
- il **ripristino della posizione al ritorno dalla scheda** si **riusa** da
  `src/lib/archivio-scroll.ts`, non si reinventa — per l'archivio è costato una sessione e
  due bug trovati solo col browser vero.

### 6.3 A 375px

Si vede: data dell'import → casella → «Sfoglia» → una decina di righe tipologia. **Tre
tocchi al risultato**, uno in più della ricerca, ma **zero caratteri digitati** — che è ciò
che è stato chiesto.

⚠️ La regola della data non si rompe: nell'elenco filtrato la fascia della data va resa
**sticky** (~28px), perché in una lista lunga il banner in cima esce dallo schermo dopo una
passata di pollice e resterebbero **pallini verdi senza data**.

### 6.4 La marca non è una schermata

`src/lib/reparti.ts` mette già i marchi **nel sottotitolo** della tessera del reparto:
l'agente ha letto «COLOMBO» un tocco prima, e una schermata che glielo richiede è **un bivio
con un ramo solo** — la stessa cosa che il repo ha appena rifiutato di costruire per lo skip
del selettore («sarebbe codice morto»). Alla **marca #2** diventa una **riga di chip** in
cima a `/maniglie`, accanto al chip tipologia: `article.search` prende già `brand`, quindi è
una prop.

### 6.5 Il livello «modello» con le foto arriva dopo, e solo se «Sfoglia» viene usato

È il passo 4, e richiede due cose che oggi mancano:

1. **Foto ridimensionate all'estrazione** (400px di lato). Lo store Blob è **privato** — lo
   ha dimostrato l'incidente `Cannot use public access on a private store` della PR #26 —
   quindi i byte passano da una route Node e pesano su **Fast Origin Transfer**, che è la
   metrica al 40% che si voleva proteggere: **conta la dimensione, non la collocazione**.
2. Una **colonna di edizione/data** accanto a `catalogPage`, che oggi non c'è:
   `ER MAN 2027` rinumera le pagine e le 2.943 righe continuerebbero a dire «Pagina 63» con
   la stessa sicurezza. È la lezione di `lastListingAt` applicata all'altra metà dello
   stesso modello.

---

## 7. Le cinque misure da fare PRIMA di scrivere UI

Un pomeriggio di script sul file vero, zero interfaccia. **Sono la condizione che decide se
il disegno di §6 sta in piedi.**

| # | Misura | Soglia che decide |
|---|---|---|
| a | quante **prime parole distinte** sui 3.456 codici | **≤ 40 → l'elenco è sfogliabile · ~300 → questa strada muore** |
| b | se il **secondo token** della descrizione è la famiglia del codice (`MANIGLIA CD41 …`) | se sì, il livello «modello» arriva **gratis dalla descrizione**, senza toccare il PDF e senza regexp sul codice |
| c | quante **famiglie distinte** | dimensiona il livello 2 |
| d | quanti **codici per famiglia** (mediana) | conferma o smentisce i «36 per nome» |
| e | cardinalità della **coda dopo l'ultimo separatore** | **15-30 → la finitura è un asse vero · ~300 → non lo è** |

---

## 8. I loghi

**Il rischio che si teme non è quello vero.** Un distributore che espone il marchio della
merce che effettivamente rivende, dentro uno strumento autenticato usato da una ventina di
dipendenti, fa uso descrittivo/nominativo (art. 21 CPI): nessun titolare ha appiglio né
interesse.

Si perde su tre cose pratiche:

1. **Con una marca sola la schermata non esiste**, quindi oggi la domanda non si pone.
2. I loghi vanno **chiesti alle marche** (press kit, una mail per marca) e committati come
   **SVG locali**, mai puntati al CDN altrui: un `<img src>` esterno si rompe in silenzio
   (sul loro sito `/collezione/formae/` è **già 404 pur essendo indicizzato**), passa il
   `Referer` a un terzo, e cade dietro il proxy come qualunque risorsa esterna. Cinque
   loghi raccattati dal web sono cinque risoluzioni, cinque proporzioni e fondi bianchi in
   tema scuro — il primo posto in cui il prodotto sembra artigianale.
3. **Logo + nome, mai logo al posto del nome**: un'immagine senza testo non è leggibile da
   chi usa uno screen reader e non dice «COLOMBO» a chi non riconosce il segno. E
   `reparti.ts` ha già stabilito che il marchio sta nel sottotitolo e la tessera non si
   rinomina mai.

---

## 9. Cosa NON fare

1. **Non dedurre modello o categoria dal codice con una regexp.** `0CD63CM` si parsifica
   benissimo e non esiste; `RS120`/`YQ115` producono la famiglia inventata `RS12`;
   `0CD63FP-CM` e `0CD63GB-CM` — due bocchette diverse — collassano in una. Sbaglia sempre
   **in silenzio**: il codice mal raggruppato ha comunque prezzo, EAN e descrizione.
2. **Non fare scraping del sito COLOMBO.** Non pubblica codici ordinabili, quindi l'aggancio
   non esiste; e la sua tipologia è una faccetta di marketing, non un albero — «maniglie per
   finestre» **non è una categoria** sul sito: la maniglia da finestra è una variante dentro
   il modello da porta.
3. **Non fare una schermata «scegli la marca» finché le marche sono una**, e non ricostruire
   «maniglie per finestre» come categoria: oggi la distingueremmo solo dall'ultima cifra del
   codice, che è **inferita**.
4. **Non fare una griglia di tessere sui 3.456 codici ordinabili**: foto identiche, tetto
   fotografico 21%, 576 schermate, e la finitura — la variazione dominante — invisibile.
5. 🔴 **Non scrivere una riga di questa feature prima che i tre file veri siano nel repo.**
   Oggi il dominio gira su **20 articoli inventati** (`prisma/seed-maniglie.ts:19-40`,
   dichiarati tali alle righe 5-8): un prototipo di sfoglio su venti righe scelte da noi
   funzionerà benissimo e non dirà **nulla** sugli altri 3.436.

---

## 10. Le domande a cui solo l'utente può rispondere

1. **Chi sfoglia davvero: Andrea o l'agente col cliente davanti?**
   Andrea parte da una lista di codici che ha già in mano e chiede «quante bocchette ho?» →
   livello 1 = **tipologia**, costruibile subito. L'agente parte da un oggetto e chiede
   «questa qual è?» → livello 1 = **nome commerciale**, che costa l'intera estrazione dal
   PDF. **Sono due prodotti diversi e uno dei due oggi non è costruibile.**
2. **Quando arrivano il listino aggiornato e `ER MAN 2026`?**
   Senza i file non si misura niente, e il primo import vero sarà comunque il primo collaudo
   di listino, aggancio, catalogo e sfoglio *tutti la stessa mattina*.
3. **I clienti chiedono per nome commerciale («la LARA») o per codice?**
   Il nome **non è un campo di `Article`** e vive solo nel PDF, che copre 71 nomi su 96. Se
   nessuno lo pronuncia, quel passo non si fa e si risparmia il pezzo più caro del progetto.
4. **Esiste un documento COLOMBO con la corrispondenza sigla→finitura (`CM`, `NM`, `OL`…)?**
   Sul sito **non c'è** (verificato). Senza, `-CM` resta due lettere e la scheda modello non
   può mostrare le pastiglie di colore, che sono il «a vista» vero.
5. **Lo schermo si mostra al cliente, o resta fra colleghi?**
   Cambia i prezzi a schermo, la qualità richiesta alle foto e l'argomento «solo uso
   interno» su cui poggiano i loghi — lo stesso argomento **già caduto** per Vercel Hobby.
6. **Le altre quattro marche hanno un listino con un campo categoria?**
   Se sì, la tassonomia si **legge** come per AGB e il problema sparisce alla marca #2. Se
   no, ogni marca è un reverse-engineering a sé, e allora il livello «tipologia dalla
   descrizione» va tenuto **volutamente povero e uguale per tutti**.

---

## 11. Ordine di lavoro proposto

| # | Cosa | Bloccato da |
|---|---|---|
| 0 | **Le cinque misure di §7** sul listino vero | i file di Andrea |
| 1 | «Sfoglia» a un livello + `tipo` in `article.search` + `offset` + scroll restore | la misura (a) |
| 2 | Passo 4: estrazione catalogo (pagina, foto ridimensionate su Blob, nome commerciale) | il PDF `ER MAN 2026` |
| 3 | Livello «modello» con foto e prezzo «da …» | il passo 2 |
| 4 | Riga di chip marca | l'arrivo della marca #2 |
