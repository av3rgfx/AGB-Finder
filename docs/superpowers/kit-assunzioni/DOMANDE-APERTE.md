# Domande aperte — tutte, in un posto solo

> Sostituisce le due liste separate (AGB da una parte, agente dall'altra). La **numerazione è
> globale e va conservata**: i commenti nel codice rimandano per numero («domanda 4 per
> l'esperto»). Le 1-16 esistevano già; le **17-23** nascono dalla verifica del 2026-07-27; le
> **24-26** dal lavoro sulle sette geometrie del 2026-07-29; la **27** dal lavoro sull'entrata maniglia,
> la **28** dalla scontistica cliente e la **29** dal profilo serramento del cliente (tutte e tre del
> 2026-07-30); la **30** dall'antieffrazione, 2026-07-31.
>
> ⚠️ Questo è l'**unico** indice della numerazione globale: le schede per tipologia
> (`legno.md`, `tour.md`, …) discutono le domande nel merito ma **non** ricopiano l'elenco —
> due indici della stessa numerazione divergono al primo aggiornamento.
>
> L'audit di `kit_requests` è rimasto in `DA-FARE-audit-e-domande-agb.md`: non è una domanda.
>
> 🆕 **2026-07-31 — due domande CHIUSE senza essere state risposte: la 2 e la 30.** Non è un modo
> di dire. Sono diventate **scelte dell'agente** nel wizard (passo «Componenti»): il programma
> smette di indovinare, mostra le opzioni che il listino pubblica per quella geometria — col
> codice, il prezzo e la differenza — e chi ordina decide. Restano qui, con la loro numerazione,
> perché **la risposta di merito continua a mancare**: sapere quale sia quella giusta permetterebbe
> di spostare il *default*, che oggi è «ciò che il programma ordina da sempre» e nient'altro.

---

## In sintesi

| # | Domanda | Chiedere a | Sblocca |
|---|---|---|---|
| **1** | **Battente: quali cerniere per l'anta singola?** | agente o AGB | 🔴 una tipologia intera, oggi spenta |
| **10** | **L'altezza è dell'anta o della maniglia?** | agente | 🔴 il cremonese su *ogni* distinta |
| **4** | **Sede 18 o sede 30?** | AGB | 🔴 se il pilota è sulla configurazione giusta |
| **3b** | **Incontri: il formato `13x18` non esiste** | AGB | 🔴 un dato falso su ogni richiesta |
| **6** | **Il «listino PVC e ALLUMINIO»** | AGB | 🔴 PVC e alluminio insieme |
| 3a | Numero di incontri lungo il perimetro | agente o AGB | 🟡 la quantità su ogni distinta |
| ~~2~~ | ~~Squadra angolare: quale delle quattro?~~ | — | ✅ **CHIUSA 31/07**: è una scelta nel wizard |
| 20 | Cosa è di serie e cosa è opzione | agente | 🟡 sei voci dello schema |
| 7 | Finestre basse (altezza maniglia < 60 cm) | agente o AGB | 🟡 configurazioni oggi rifiutate |
| 22 | Quali finiture vendete davvero | agente | 🟡 oggi solo argento |
| 19 | Quali combinazioni ordinate più spesso | agente | 🟡 ordine di priorità del lavoro |
| 23 | La finestra 700×1400 battuta 18 sede 30 | agente | 🟡 **secondo golden**, se esiste |
| 26 | Il nottolino di Fosca vuole una copertura | agente o AGB | 🟡 una riga mancante sulle geometrie nuove |
| **29** | **«Incontro nottolino incassato»: quale dei tre assi?** | agente | 🟡 **tre assi che il motore cabla senza chiederli** |
| ~~30~~ | ~~Antieffrazione: il fungo è per sede 30? viti inclinate o dritte?~~ | — | ✅ **CHIUSA 31/07**: sono scelte nel wizard, il fungo è fuori |
| 25 | Confezioni: si applica il +20% fuori confezione? | AGB o ufficio | 🟡 **i totali di ogni distinta** |
| 28 | Lo sconto è unico per cliente, o per classe? | AGB o ufficio | 🟡 **il netto di ogni distinta** |
| 24 | Interasse 8,5: quali incontri? | agente o AGB | 🟡 la famiglia incontri del cliente «MC» |
| 17 | **L'entrata: quale usate?** | agente | 🟡 quale sia il caso frequente |
| 27 | GR03: l'entrata 7,5 dichiara zero nottolini | agente o AGB | ⚪ asimmetria fra le due entrate |
| 18 | Dove leggete le quote | agente | ⚪ come impostare il wizard |
| 21 | Chiusure supplementari: da quale altezza | agente | ⚪ una banda oggi assunta |
| 5 · 8 · 9 | Vasistas: cerniere, terminali, GR00 | agente o AGB | ⚪ la vasistas è provvisoria |
| 11-15 | Bilico TOUR: asta, 2 m², guarnizione, spessori, LBB | AGB | ⚪ assunzioni dichiarate |
| 16 | *(rilievo interno, non si chiede a nessuno)* | — | ⚪ `openingDir` mai letto |

---

# 🔴 Le cinque bloccanti

## 1 — Battente: quali cerniere?

**In parole semplici:** per una finestra a **una sola anta che si apre solo a battente** (non
anta-ribalta), quali cerniere montate?

**Perché blocca:** lo schema del listino ne mostra **tre possibilità** e non dice quale valga per
l'anta singola. Oggi il programma **non genera** l'anta a battente: la distinta uscirebbe senza il
punto di sospensione in alto, cioè con l'anta non appesa. Una risposta, una riga di codice, e la
tipologia torna disponibile.

*Riferimento tecnico: schema `p0416 (414)`, 21 voci, schema composito.*

## 10 — L'altezza è dell'anta o della maniglia?

**In parole semplici:** l'**altezza** che ci date è quella dell'anta o quella della **maniglia**?
Sono la stessa cosa, o c'è una differenza fissa fra le due? E vale allo stesso modo per
anta-ribalta e vasistas?

**Perché blocca:** la cremonese si sceglie su quella quota. Oggi il programma **sottrae 10 mm**
sull'anta-ribalta e **0** sulla vasistas: due tipologie, due regole, quindi una delle due è
sbagliata. Se quella sbagliata è l'anta-ribalta, la cremonese è errata su **ogni** distinta,
**incluso il nostro riferimento** — e non se ne accorgerebbe nessuno, perché il codice risulta
comunque valido e prezzato.

## 4 — Sede 18 o sede 30?

**In parole semplici:** la **sede 18** è ancora ordinabile, o il listino 2026 l'ha sostituita con
la **30**?

**Perché blocca:** decide se il generatore sta lavorando sulla configurazione giusta. **Tutti** gli
schemi base del 2026 sono intitolati «sede 30 mm», e la nota «*per serramenti con sede incontri da
30 mm riferirsi agli schemi "sede 30 mm"*» compare su **22 pagine**. Per la sede 18 — quella del
nostro riferimento, che viene da una vostra distinta del 16/11/2021 — nel 2026 **non esiste alcuna
pagina-schema**. Se la risposta è «sede 30», il pilota va rifatto, e con lui il golden.

## 3b — Incontri: il formato `13x18` non esiste

**In parole semplici:** nelle tabelle degli incontri il formato è scritto come un numero solo nella
colonna ASSE (`9x18`, `13x24`, `13x30`), dove il secondo numero è la sede telaio. Cercando su tutte
le 959 pagine esistono **solo** `9x18`, `9x20`, `13x24` e `13x30`: **`13x18` non compare mai**. La
distinta di riferimento dichiara però **interasse 13** e monta incontri **`9x18`**. Quale delle due
indicazioni è giusta — l'interasse è in realtà 9, oppure gli incontri dovevano essere `13x24`/`13x30`?

**Perché blocca:** non cambia i codici che escono oggi né il totale, ma vuol dire che **una delle
due etichette scritte sulla richiesta è falsa**. Va sciolta insieme alla 4: sono la stessa indagine.

## 6 — Il «listino PVC e ALLUMINIO»

**In parole semplici:** il volume 2026 rimanda più volte a un **listino separato per PVC e
alluminio** (per esempio a pag. 847, per nottolini, antieffrazione e DSS). Possiamo riceverlo?

**Perché blocca:** senza, PVC e alluminio restano **entrambi** non trattabili. Non è propriamente
una domanda: è un documento da farsi mandare.

---

# 🟡 Importanti — spostano prezzi o allargano la copertura

## 17 — L'entrata: quale usate?

**In parole semplici:** la cremonese esiste in **entrata 7,5** e **entrata 15**
(più una versione ad **asta**, senza maniglia). Voi quale usate di solito? E da
cosa dipende quando cambia? Ve la dice il cliente o la deducete dal serramento?

**Perché conta (non blocca più):** dal 2026-07-30 il programma **ve la chiede** e
copre entrambe le entrate pubblicate. La risposta non serve più a sbloccare il
codice: serve a sapere quale sia il caso frequente — per il default del profilo
cliente, quando lo faremo, e per capire se l'entrata 7,5 vi capita davvero.

*Riferimento tecnico: `A50122.`**`08`**`/`**`15`**`.NN`, `p0424 (422)`.*

## 3a — Numero di incontri lungo il perimetro
Come lo decidete? C'è una regola pratica (uno ogni tot centimetri) o si legge da una tabella?
*Oggi è una formula ricavata dal solo esempio che abbiamo, quindi vale su un caso e basta.*

## 2 — Squadra angolare: quale delle quattro? — ✅ **CHIUSA il 2026-07-31**

> ### Come è stata chiusa: non rispondendola
>
> La domanda non ha ricevuto risposta. **Ha smesso di essere una domanda del programma.**
>
> Dal 2026-07-31 la squadra angolare è una **scelta dell'agente** nel passo «Componenti» del
> wizard. Il programma non indovina più fra le quattro famiglie: mostra **quelle che il listino
> pubblica per quell'interasse** — con il codice, il nome a catalogo, il prezzo e la differenza
> rispetto allo standard — e chi ordina sceglie.
>
> | Interasse | Opzioni mostrate |
> |---|---|
> | **8,5** — il cliente **MC** | **due**: base `A50902.22` 5,77 € · traverso alluminio `A50903.22` 7,54 € |
> | 9 e 13 — le altre **sei** geometrie | **quattro**: le due sopra + compensatore `A50901.*` 8,05 € · traverso alu + compensatore `A50904.*` 9,83 € |
>
> Due e non «quattro di cui due grigie»: `A50901.22` e `A50904.22` **non esistono**, e
> un'opzione disabilitata sarebbe un'offerta che il listino non fa. **I 36 codici sono scritti
> per esteso e verificati sul catalogo reale** dal gate `codici-a-listino.integration.test.ts` —
> nessuna concatenazione, che è precisamente ciò che avrebbe prodotto `A50904.22`.
>
> **Il default non si è mosso** (base per `A4_I85_B15`, traverso alu + compensatore per le altre
> sei): è ciò che il motore emette da sempre, e il golden resta a 90,20 €.
>
> ### Cosa resterebbe da sapere
>
> La risposta di merito **serve ancora**, e vale meno di prima: non più «quale codice esce», ma
> «quale opzione deve essere **preselezionata**». Oggi l'etichetta a schermo dice la verità —
> *«preimpostato su ciò che il programma ordina oggi, mai confrontato con un ordine vero»* — e
> con una risposta diventerebbe una raccomandazione. La domanda originale resta qui sotto.

---

Il listino ne ha quattro versioni: una base, una «per traverso in alluminio», una «con
compensatore» e una con tutte e due. Su una finestra **tutta in legno** quale montate?
*Fra la più economica e quella che usiamo noi ballano 4 € a pezzo.*

> **⚠️ Aggiornata il 2026-07-29 — ora ci sono due clienti che ricevono pezzi diversi.**
>
> Finché il generatore copriva una sola geometria, questa domanda valeva un pezzo su una
> finestra. Ora ne copre sette, e la situazione è questa:
>
> | Cliente | Geometria | Squadra emessa | € |
> |---|---|---|---|
> | **MC** | aria 4 · interasse **8,5** · battuta 15 | `A50902.22.02` — **base** | 5,77 |
> | **Peruzzi** | aria 4 · interasse 9 · battuta 18 | `A50904.24.02` — traverso alu + compensatore | 9,83 |
>
> Sono **entrambi serramenti tutto-legno ad aria 4**, e ricevono **varianti diverse dello
> stesso pezzo**. La ragione non è tecnica: è che `A50904` **non esiste** nel formato `.22`
> (per l'interasse 8,5 il listino pubblica solo la base `A50902.22` e la «per traverso in
> alluminio» `A50903.22`), quindi per MC la base è **forzata**, mentre sulle altre sei
> geometrie si è conservata `A50904` perché è quella prescritta dal certificato ift
> «ARTech Legno» per il pilota.
>
> Il commento nel codice (`artech-geometrie.ts`) argomenta che per MC la base è
> «appropriata a una finestra tutto-legno» — il che, se è vero, **contraddice la scelta
> fatta sulle altre sei righe**. Una delle due è sbagliata, e sono 4,06 € a pezzo.
>
> **Domanda, in concreto:** su un serramento tutto-legno senza traverso in alluminio, la
> squadra giusta è la **base**? Se sì, va cambiata su tutte e sette le geometrie e il
> certificato ift descrive una configurazione particolare, non la regola. Se no, MC sta
> ricevendo un pezzo sottodimensionato per un limite del listino, e va segnalato ad AGB.
>
> *Riferimento tecnico: base `A50902.{22,24,26,34,36}` 5,77 € (`p0451 (449)`) · traverso alu
> `A50903.*` 7,54 € · compensatore `A50901.*` 8,05 € (solo interasse 9 e 13) · traverso alu +
> compensatore `A50904.*` 9,83 € (solo interasse 9 e 13) — `p0452 (450)`.*

## 20 — Cosa è di serie e cosa è opzione
Una risposta per riga, anche solo «sempre» o «a richiesta»:
- la **microventilazione**?
- il **doppio nottolino a fungo** (antieffrazione)?
- gli **spessori di sollevamento** — sempre, o solo su ante di un certo peso o misura?
- il **DSS**?
- le **coperture degli incontri** — insieme al kit o ordinate a parte?

*Sono cinque delle sei voci che compaiono sullo schema di montaggio ma che il programma oggi non
emette. Sapere quali sono opzionali chiude la questione.*

**I codici che fanno scattare la copertura** (verificati 2026-07-30, listino 2026):

| Codice emesso | Dove | Marcato |
|---|---|---|
| `A51400.CR.13` | incontro nottolino 13x24 — è la geometria **`A12_I13_B18`, cioè Fosca** | `(*)` |
| `A51400.05.70` | incontro **ribalta** 9x18 — è quello del **golden** | `*` |
| `A51400.CR.70` | incontro ribalta 13x24 | `*` |

`(*)`/`*` = «ordinare coperture separatamente» (p0469 (467) e p0471 (469)). Coperture:
`A52102.01.44` (grigio RAL 7040) o `.87` (antracite), **0,39 €**.

Il golden è un ordine **reale** del 16/11/2021 a 16 righe: o la copertura è facoltativa nella
pratica, o il listino 2021 differiva. **Non si tocca il golden** su questa base — è la ragione per
cui la domanda resta aperta invece di essere «risolta» aggiungendo righe.

*Nota di lettura:* `A52102.05.44` **non** è una copertura viti nonostante la famiglia — a catalogo
si chiama «Inserto DSS per incontri con copertura».

## 29 — «Incontro nottolino incassato»: quale dei tre assi?

**Da dove nasce:** richiesta dell'utente, 2026-07-30. I clienti esprimono una preferenza per
l'incontro nottolino **incassato**, descritto così: «sagomato per essere inserito **a filo nel
telaio tramite fresatura**, con scasso eseguito a fresa o pantografo, viti a testa ridotta»,
scelto per **mano DX/SX**.

**Il problema:** la parola «incassato» compare **due volte in 959 pagine**, entrambe fuori
contesto — p0590 (588) per un *binario*, p0628 (626) per una *serratura*. Non è mappabile a un
codice. Il blocco incontri pubblica però **tre assi che il generatore cabla senza chiederli**:

| # | Asse | Fonte | Codici | Cosa fa oggi il motore |
|---|---|---|---|---|
| **a** | **Corpo dell'incontro** — stesso formato 9x18, due pezzi fisicamente diversi | p0469 (467), voci **2** e **4** del disegno | `A51400.05.02` (piastrina stampata sottile) · `A51400.05.13` (corpo pieno con rampa) — **stesso prezzo 0,81 €** | emette **sempre** `.02` |
| **b** | **Con perni di posizionamento Ø 8x3** | p0469 (467), p0471 (469), p0473 (471) | famiglia `A52200.*` — stessi formati, stesso prezzo, pubblicata per nottolino, ribalta **e** DSS | non la emette **mai** |
| **c** | **Antieffrazione** | p0470 (468) — pagina **non citata** fra le fonti di `artech-incontri.ts` | `A514DX/SX.05.67` (viti inclinate) · `.68` (viti dritte) · `A522DX/SX.05.67` — **2,04-3,03 €** contro 0,81 | non la emette **mai** |

**Due indizi si contraddicono, e vietano di indovinare:**

1. La descrizione parla di **mano DX/SX**, ma gli incontri nottolino aria 12 standard (asse **a**)
   sono **ambidestri**. Ad avere DX/SX per aria 12 è l'**antieffrazione** (**c**).
2. «Fresatura» nel listino AGB è una caratterizzazione della **geometria**, non una variante
   ordinabile: p0469 (467) scrive «Aria 4 - Asse 13 - **Fresatura** 23 mm» contro «Aria 12 -
   Asse 13 - **Sede** 24 mm». E le dime esistono per entrambe («Per fresatura incontri aria 4»,
   «Dima per fresatura a telaio per asse 9 - aria 12»).

**Domanda:** quale dei tre? E se è **a**, occorre prima la domanda 20 — il `.13` richiede la
copertura viti che oggi non emettiamo, quindi metterlo nel profilo di un cliente produrrebbe una
distinta che sappiamo già incompleta.

*Perché non è stato indovinato: scegliere l'asse sbagliato significa scrivere nel profilo di un
cliente una preferenza che il motore applica alla riga sbagliata — cioè un campo raccolto,
mostrato al cliente, e inerte.*

> **🆕 2026-07-31 — resta APERTA, ma ora si sa perché è stata rimandata.**
>
> Il 31/07 il passo «Componenti» ha reso scelte dell'agente la squadra angolare, l'incontro
> ribalta e le tre voci antieffrazione. **L'asse (a) — il corpo dell'incontro nottolino `.02` /
> `.13` — è stato censito ed escluso**, e non per prudenza generica: `A51400.05.13` è marcato
> `(*)` **«ordinare coperture separatamente»**, quindi offrirlo come opzione significherebbe far
> scegliere all'agente una distinta che **sappiamo già incompleta** — è la **domanda 20**, ancora
> aperta. Mostrare una scelta che produce un ordine non ordinabile è peggio del difetto che il
> passo «Componenti» esiste per chiudere.
>
> Anche l'asse **(b)** resta fuori, per una ragione diversa e strutturale: «con perni di
> posizionamento» tocca **due righe** con una sola scelta (nottolino *e* ribalta), quindi non è
> una variante nel senso adottato — «una scelta, un codice, una riga».
>
> L'asse **(c)**, l'antieffrazione, **è entrato** ed è la domanda 30 qui sotto.

## 30 — Antieffrazione: due nodi — ✅ **CHIUSA il 2026-07-31**

> ### Come è stata chiusa: allo stesso modo della 2, e per esplicita indicazione dell'utente
>
> I «due nodi» erano due domande a cui **il listino non risponde**. Messe all'utente, la risposta
> è stata:
>
> > «Non saprei risponderti. Posso solo dirti che secondo me ha senso aggiungere una sezione
> > finale nel wizard, per decidere e far scegliere in modo semplice e visivo, quando ci sono più
> > scelte per uno o più componenti che non dipendono dallo schema dello sviluppo del kit ma da
> > una scelta personale (dell'agente o del cliente).»
>
> È un riorientamento, non una richiesta in più: **le due domande smettono di essere un
> prerequisito**. L'antieffrazione è **tre scelte indipendenti** nel passo «Componenti» —
> movimento angolare, incontri nottolino, piastrino — più un interruttore «Antieffrazione» che le
> imposta tutte e tre in un clic e **non viene salvato** (la verità persistita sono le tre
> scelte: nessuna precedenza da arbitrare).
>
> **Nodo 2 — viti inclinate o dritte: il fatto nuovo, e non era noto.** Non si sceglie una volta
> per tutte: si mostrano **dove esistono**. E per l'**aria 4** il listino pubblica **solo le viti
> inclinate**, quindi per **MC e Peruzzi le dritte non compaiono affatto** — non disabilitate,
> proprio assenti. Le due opzioni convivono solo in aria 12.
>
> | Chiave incontri | Normale (standard) | Antieffr. viti inclinate | Antieffr. viti dritte |
> |---|---|---|---|
> | `A4_ASSE9` — **MC, Peruzzi** | `A514DX/SX.01.02` 0,81 | `A514DX/SX.01.67` 3,03 | **— non pubblicate** |
> | `A4_ASSE13` | `A48011/A48012.DC.02` 0,87 | `A514DX/SX.DC.67` 3,03 | **— non pubblicate** |
> | `A12_9x18` — il **golden** | `A51400.05.02` 0,81 | `A514DX/SX.05.67` 3,03 | `A514DX/SX.05.68` 3,03 |
> | `A12_13x24` — **Fosca** | `A51400.CR.13` 0,89 | `A514DX/SX.CR.67` 3,03 | `A514DX/SX.CR.68` 3,03 |
>
> **Nodo 1 — il fungo resta FUORI, e non è una rinuncia.** `A50320.02.01` sta nel capitolo
> **Movimenti Angolari** con la stessa tabella (DIMENSIONI · LBB · HBB · NOT. · CODICE): *prende
> il posto* di un movimento angolare, non si aggiunge. E il listino lo lega alla **sede 30 nei due
> versi**:
>
> - `p0435 (433)`, sotto la sua tabella: «*NB: soluzione per serramenti con sede incontri da 30 mm*»;
> - `p0469 (467)`, nota `(**)` stampata **solo** sulle righe `13x30`: «*necessario utilizzo con
>   movimenti angolari inferiori doppio nottolino a fungo cod. `A50320.02.01`*».
>
> Sede 30 ⟹ fungo **e** fungo ⟹ sede 30. La sede 30 il motore la **rifiuta a monte**
> (`assertSeatConfigSupportata`: manca l'incontro DSS 13x30 a listino). Il fungo è quindi una
> **famiglia di schemi diversa**, non una variante: non serviva deciderlo, serviva collocarlo.
> Il giorno in cui la sede 30 verrà aperta (**domanda 4**), il fungo entra con lei.
>
> **Il movimento angolare a due nottolini invece è entrato**, e non era nella richiesta
> dell'utente: lo impone la **NB stampata** a `p0435 (433)`. L'ha aggiunto il listino.
>
> **Effetto sul golden, misurato sul catalogo reale**: standard **16 righe / 21 pezzi / 90,20 €**
> (invariato) → antieffrazione completa **17 righe / 22 pezzi / 110,13 €**, zero warning. Il
> «~18 righe / ~112 €» stimato qui sotto era vicino: le righe sono 17 perché il fungo non entra.
>
> ### Cosa resterebbe da sapere
>
> Come per la 2, la risposta di merito sposterebbe il **default**, non i codici disponibili. In
> più: se con «nottolino a fungo» l'utente intendeva davvero il movimento angolare a due
> nottolini, il nodo 1 è già risolto in pieno; se intendeva il pezzo `A50320.02.01`, allora sta
> ordinando serramenti **sede 30**, e serve la **domanda 4**.

---

**Da dove nasce:** richiesta dell'utente, 2026-07-31 — «*quando si sviluppa un'anta-ribalta bisogna
chiedere se si vuole il nottolino e l'incontro nottolino antieffrazione o normale*». Alla domanda su
cosa cambi nell'ordine: «**cambio entrambi e ci metto anche il nottolino a fungo**».

**Il listino pubblica DUE configurazioni per la stessa finestra**, e i nomi ingannano:

| | `p0406 (404)` «**sicurezza base**», sede 30 | `p0408 (406)` «**config. antieffrazione RC1/RC2**» |
|---|---|---|
| Incontro nottolino | voce 16 = **«Antieffrazione»** | voce 15 = «Aria 12» — i **normali** |
| Pezzo distintivo | voce 22 copertura + voce 9 doppio nottolino a fungo | voce 3 **«Piastrino antieffrazione»** |
| Voci totali | 22 | 18 |

`p0408` dichiara «*per serramenti con sede incontri da 30 mm riferirsi agli schemi sede 30*»: è
quindi **lo schema della nostra sede**. Il che riduce il «divario 22 contro 16» della domanda 20 a
**due voci** — piastrino e spessori di sollevamento — non sei.

**Codici, tutti verificati sul catalogo reale (7.488 prodotti):**

| Pezzo | Oggi | Antieffrazione | Fonte |
|---|---|---|---|
| Movimento angolare | `A50302.01.02` (1 nott.) 6,66 € × 2 | **`A50302.02.02`** (2 nott.) 9,73 € | p0435 (433) |
| Incontro nottolino | `A51400.05.02` 0,81 € × 5 | `A514DX/SX.05.67` (viti inclinate) · `.68` (dritte) 3,03 € | p0470 (468) |
| Piastrino antieffrazione | — | `A50194.00.01` (entrata 7,5) 3,17 € · `A20050.00.02` (entrata 15) 2,69 € | p0432 (430) |
| Doppio nottolino a fungo | — | `A50320.02.01` 7,58 € | p0435 (433) |

Il **movimento angolare** non era nella lista dell'utente: lo impone una **NB stampata** a p0435
(433) — «*mov. angolare `A50302.02.02` necessario per tutte le classi antieffrazione*». È una
scoperta del listino, non un'assunzione. E il **piastrino dipende dall'entrata**, cioè dal campo
reso esplicito dalla PR #40.

### Le due domande

1. **Il «nottolino a fungo» va su serramenti sede 30?** La sua tabella porta la NB «*soluzione per
   serramenti con sede incontri da 30 mm*», e **nessuno dei tre clienti è sede 30** (MC e Peruzzi
   aria 4 senza sede, Fosca sede 24). O si monta su serramenti sede 30 — che il motore oggi
   **rifiuta a monte** (`assertSeatConfigSupportata`) — oppure con «fungo» si intende il
   **movimento angolare a 2 nottolini `A50302.02.02`**, che ha davvero due dentini ed è quello che
   la NB rende obbligatorio.
2. **Viti inclinate (`.67`) o dritte (`.68`)?** Stesso prezzo, due codici.

> ⚠️ `A522SX.05.67` — con perni, mano SX, 9x18 — **non esiste a catalogo**: p0470 pubblica «con
> perni di posiz.» solo **dx** per il 9x18, entrambe le mani per il 13x24. Se la scelta cadesse lì,
> metà dei serramenti non sarebbe ordinabile.

**Con le due risposte la feature è una spec breve:** un campo `sicurezza: "BASE" | "ANTIEFFRAZIONE"`
sul ramo ARTECH, ortogonale a geometria ed entrata esattamente come lo è l'entrata, che sostituisce
due righe e ne aggiunge due.

*Esempio numerico sul golden (550×1820, aria 12/13/20, entrata 15, chiusure ON), oggi 16 righe / 21
pezzi / **90,20 €**: sostituendo movimento angolare e incontri e aggiungendo piastrino e fungo si
va a **~18 righe** e **~112 €**. Da confermare a valle delle due risposte.*

## 7 — Finestre basse
Vi capitano finestre con altezza maniglia **sotto i 60 cm**? Se sì, come le ordinate?
*Oggi il programma le rifiuta, anche se il listino le prevede.*

## 22 — Quali finiture vendete davvero
*Oggi il programma conosce solo l'argento.*

## 19 — Quali combinazioni ordinate più spesso
Le tre o quattro più frequenti, in ordine. E ce ne sono che il listino prevede ma che **non vi
capitano mai**?
*Serve a decidere cosa coprire per primo.*

## 23 — La finestra 700 × 1400, battuta 18, sede 30
È una richiesta vera di un cliente? Se sì, **sapete quale distinta è stata poi effettivamente
ordinata**? Va bene anche una foto dell'ordine.

> **È la domanda che rende di più di tutte.** Se esiste una distinta reale per quella
> configurazione diventa il **secondo esempio di riferimento**, e possiamo *verificare* quello che
> costruiamo invece di fidarci della nostra lettura del listino. È esattamente così che è nato il
> generatore attuale: da una distinta reale del 16/11/2021.

## 26 — Il nottolino di Fosca vuole una copertura che non emettiamo

**In parole semplici:** l'incontro nottolino `13x24` (`A51400.CR.13`) — quello che esce sulle
distinte di **Fosca** — a listino è marcato **«(*) ordinare coperture separatamente»**. La
copertura c'è (`A52102.01.44` grigio / `.87` grigio antracite, 0,39 €) e c'è anche un «inserto DSS
per incontri con copertura» dedicato (`A52104.13.44`/`.87`). Il generatore **non li emette**.

**Perché è nuovo:** il nottolino `9x18` del pilota **non** ha l'asterisco. È quindi un'incompletezza
che compare **solo sulle geometrie nuove**, cioè proprio quelle che questo lavoro ha aperto.

**Perché non è implementabile oggi:** le coperture esistono in **grigio RAL 7040 e grigio
antracite**, mentre il modulo copre la sola finitura **ARGENTO**. Emetterle vorrebbe dire scegliere
una finitura che non c'entra con quella del kit. Ricade nel «divario schema `p0406`» già dichiarato
(voce 22 = «copertura per incontro nottolino»).

**Domanda:** su un serramento aria 12 / interasse 13 / battuta 18 (il caso Fosca), la copertura
dell'incontro nottolino va ordinata sempre, o solo su richiesta? E in quale finitura, se la
ferramenta è argento?

*Riferimento tecnico: `p0469 (467)` per l'asterisco e le coperture; `p0473 (471)` per l'inserto DSS.*

## 25 — Confezioni: si applica il «+20% fuori confezione»?

**In parole semplici:** il listino AGB vende in confezioni (50, 20, 10 pezzi a seconda
dell'articolo — è la colonna **CS**). Una distinta ne usa **1, 2, 5**. L'art. 4 delle condizioni
generali (`p0006 (4)`) dice che sotto la confezione AGB può *«aumentare l'ordine fino al
quantitativo della confezione, oppure applicare una maggiorazione di prezzo del 20%»*.

Quando vendiamo un kit a un serramentista, il prezzo unitario che gli facciamo è quello di listino
liscio, o c'è una maggiorazione perché sono pezzi sciolti?

**Perché conta:** se una maggiorazione esiste e non la calcoliamo, **tutti i totali che mostriamo
sono sottostimati** — su ogni distinta, non su un caso limite. Il software AGB 4K ha una funzione
dedicata a questo («ottimizzazione pezzi singoli o confezioni»), quindi per AGB il problema esiste.
Plausibilmente non ci riguarda, perché noi siamo distributori e le confezioni le rompiamo: ma è
un'assunzione che vale l'intero prezzario, e non l'abbiamo mai verificata con nessuno.

*Riferimento tecnico: colonna CS del listino, art. 4 delle condizioni generali `p0006 (4)`.*

## 28 — Lo sconto è unico per cliente, o cambia per classe di articolo?

**In parole semplici:** il listino AGB stampa una **classe di sconto** accanto a ogni articolo (la
colonna con `A2`, `F3`, `T1`…). Sulle 959 pagine del 2026 ce ne sono **34**. Quando fate lo sconto
a un cliente, applicate **una sola percentuale a tutto**, oppure una percentuale **diversa per
classe**?

**Perché conta:** i codici che il generatore emette non stanno tutti nella stessa classe.

| Distinta | Classe |
|---|---|
| Anta-ribalta e vasistas ARTECH (tutte e sette le geometrie) | **F3** |
| Bilico rettangolare TOUR | **T1** |

Dentro una distinta la classe è uniforme; fra le due serie cambia. Dal 2026-07-30 il programma
applica **una percentuale sola** — è una scelta fatta consapevolmente, non una svista. Ma se lo
sconto vero cambia per classe, il totale mostrato su un **bilico** è sbagliato: quelle distinte
stanno fra 433 € e 766 €, quindi cinque punti di scarto valgono 20-38 € a serramento.

**Cosa cambierebbe la risposta:** se è per classe, `Customer.discount` diventa una tabella
cliente × classe. La percentuale è già su una colonna propria della richiesta e non dentro il
prezzo delle righe, quindi cambierebbe **come si calcola** quel numero, non le distinte già emesse.

*Riferimento tecnico: classe sconto catturata dal parser in `Product.specifications.classeSconto`
(gruppo 5 di `PRODUCT_SIGNATURE`, `parse-listino.ts`); i conteggi vengono dall'applicazione della
stessa firma di riga a tutte le 959 pagine — 7.488 codici, identico all'import su Neon.*

## 24 — Interasse 8,5: quali incontri si ordinano?

**In parole semplici:** il cliente «MC» lavora ad aria 4 · interasse **8,5** · battuta 15. Per
quella combinazione cerniere, bracci e supporti esistono a listino. Gli **incontri** invece sono
pubblicati solo per **asse 9** e **asse 13**: un asse 8,5 non c'è. Noi diamo per scontato che si
usino quelli **asse 9**. È giusto?

**Perché conta:** è un'inferenza nostra, non un dato stampato. Se è sbagliata, le distinte di MC
escono con la famiglia di incontri sbagliata — e MC è uno dei tre clienti principali. Non tocca gli
altri suoi codici (cerniera, forbice, supporto), che sono verificati a listino.

*Riferimento tecnico: famiglia `.01` (asse 9) contro `.DC` (asse 13); `p0469 (467)`, `p0471 (469)`,
`p0473 (471)`. Il generatore assume `.01`, dichiarato in `artech-geometrie.ts`.*

---

# ⚪ Da chiarire

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

## 18 — Dove leggete le quote
Quando un cliente vi chiede un kit, dove leggete **aria, asse, battuta, sede ed entrata**? Sul
disegno del serramentista, su una scheda, o ve li dice a voce? Ce n'è qualcuno che **non chiedete
mai** perché è sempre lo stesso? E se il cliente non li sa dire, come fate?

## 21 — Chiusure supplementari
Da quale altezza in su le mettete?

## 5 · 8 · 9 — Vasistas
- **5** Per le tre cerniere usate la versione base o l'alternativa?
- **8** I due terminali in alto sui montanti: sempre, o solo a richiesta?
- **9** Le finestre molto piccole (altezza maniglia sotto i 66 cm) sono ordinabili?

## 11-15 — Bilico TOUR
Tecniche, da girare ad AGB: asta verticale senza braccetto sopra HBB 1000 · superficie
**esattamente** 2 m², 3 o 4 lati · la guarnizione va nella distinta e quanti metri ha la confezione ·
quantità del kit spessori sullo schema 3 · larghezza 645 mm, gruppo 1 o 2.

## 16 — Rilievo interno, non si chiede a nessuno
`openingDir` (tirare / spingere) è raccolto dal wizard, validato, salvato e **letto da nessun
modulo**. Va tolto dall'input o usato: è una decisione nostra.

> Vale però la pena chiedere all'agente, come controprova: **la direzione di apertura cambia
> qualcosa nella ferramenta che ordinate, o è solo un'informazione per il cliente?**

---

# Testi pronti da inviare

## A) Per l'agente esperto

> Ciao, ti chiedo una mano su alcune cose del programma che genera le distinte. Sono domande
> pratiche, di quelle che sai tu e che sul listino non si leggono. Rispondi anche a voce o a
> braccio, non serve precisione da manuale.
>
> **Le più importanti**
>
> 1. Per una finestra a **una sola anta che si apre solo a battente** (non anta-ribalta), quali
>    cerniere montate? Il listino ne mostra tre possibilità e non dice quale sia quella giusta.
> 2. La **cremonese** esiste in entrata 0, 8 e 15: voi quale usate? Da cosa dipende quando cambia?
> 3. L'**altezza** che mi dai quando ordini è quella dell'anta o quella della **maniglia**? C'è una
>    differenza fissa fra le due?
>
> **Sulla distinta**
>
> 4. Il **numero di incontri** lungo il perimetro come lo decidi? C'è una regola pratica?
> 5. La **squadra angolare** ha quattro versioni (base, per traverso in alluminio, con
>    compensatore, entrambe). Su una finestra tutta in legno quale usi? *(Dal 31/07 il programma
>    te le fa scegliere tutte e quattro col prezzo davanti, quindi non è più bloccante: la tua
>    risposta serve a decidere quale presentare già spuntata.)*
> 6. Di queste, cosa metti **sempre** e cosa **solo se richiesto**: microventilazione · doppio
>    nottolino a fungo · spessori di sollevamento · DSS · coperture degli incontri.
> 7. Le **chiusure supplementari** da quale altezza in su le metti?
> 8. Quali **finiture** vendiamo davvero? Il programma per ora conosce solo l'argento.
>
> **Sul lavoro di tutti i giorni**
>
> 9. Dove leggi aria, asse, battuta, sede ed entrata? Ce n'è qualcuno che non chiedi mai perché è
>    sempre lo stesso? E se il cliente non li sa dire, come fai?
> 10. Quali sono le **tre o quattro combinazioni** che ordini più spesso?
> 11. Vi capitano **finestre basse**, con altezza maniglia sotto i 60 cm? Come le ordinate?
> 12. La **direzione di apertura** (tirare/spingere) cambia qualcosa nella ferramenta, o è solo
>     un'informazione per il cliente?
>
> **Sull'incontro «incassato»** *(nuova, 2026-07-30)*
>
> 13. Quando dici **incontro nottolino incassato** — quello che va fresato nel telaio e sta a
>     filo — a listino ne trovo **tre** che potrebbero essere quello, e il programma ne monta
>     sempre uno solo senza chiedertelo. Ti mando la foto della pagina 467:
>
>     - il pezzo **2** del disegno (`A51400.05.02`, piastrina sottile) contro il pezzo **4**
>       (`A51400.05.13`, corpo pieno con la rampa) — stesso formato 9x18, stesso prezzo;
>     - quelli **«con perni di posizionamento Ø 8x3»** (`A52200.*`), che si piantano in due fori
>       da 8 nel telaio;
>     - quelli **antieffrazione** in acciaio o zama (pagina 468), che costano 2-3 € invece di 0,81.
>
>     Quale usate? E cambia da cliente a cliente, o è sempre lo stesso?
>
>     *(Me lo chiedo perché tu hai detto «si sceglie DX o SX», e i primi due sono ambidestri:
>     ad avere destro e sinistro è l'antieffrazione. Non voglio indovinare.)*
>
> **Una in particolare**
>
> 14. La finestra **700 × 1400 con battuta 18 e sede 30** che abbiamo provato insieme: era una
>     richiesta vera? Se sì, **sai quale distinta è stata poi ordinata**? Anche una foto
>     dell'ordine mi basta — con quella posso verificare il programma invece di fidarmi della mia
>     lettura del listino.
>
> Grazie!

## 31 — Il numero di richiesta identifica la richiesta o la versione?

*(Aperta il 2026-08-01, quando le varianti sono diventate modificabili dopo la creazione. Non serve
AGB: la decide l'**ufficio commerciale**.)*

**In parole semplici:** oggi ogni volta che una distinta si rifà — perché è cambiata una variante,
o perché il listino è stato reimportato — nasce una riga nuova con un **numero nuovo**. Il cliente
che aveva ricevuto `KIT-2026-0007` si vede arrivare `KIT-2026-0018`, e non c'è niente, nel numero,
che dica che è lo **stesso serramento**.

**Perché conta adesso e non prima:** finché il ricalcolo era raro la cosa non si vedeva. Da oggi
l'agente può cambiare le varianti quando vuole, quindi versionare diventa **ordinario**.

**Le due strade:**

| | Cosa vede il cliente | Costo |
|---|---|---|
| **Come oggi** — un numero nuovo per versione | `KIT-2026-0007` poi `KIT-2026-0018` | zero, ma la commessa non ha identità stabile |
| **Numero stabile + versione** | `KIT-2026-0007` poi `KIT-2026-0007 v2` | una colonna `version` e una migrazione |

La seconda renderebbe leggibile anche il **confronto fra versioni** (v1 90,20 € → v2 110,13 €, cioè
quanto costa l'antieffrazione su quel serramento), che oggi si può solo ricostruire a mano.

**Nota tecnica, per chi implementa e non per chi risponde:** il numero è coniato con `count() + 1`
sulle richieste dell'anno (`kit.ts:47-50` e `219-222`) su una colonna `@unique`, quindi due
creazioni nello **stesso istante** collidono e una delle due dà errore all'agente (nessuna
corruzione: si riprova e funziona). Verificato il 2026-08-01 che **non esiste** alcun
`kitRequest.delete`/`deleteMany` e che nessun `onDelete: Cascade` punta a `KitRequest`, quindi lo
scenario peggiore — un conteggio che scende e **ripete** un numero già mandato a un cliente — oggi
**non è raggiungibile**. Attenzione al rimedio ovvio: un retry attorno alla `create` **non basta**,
perché in `ricalcola` il `count()` sta fuori dalla `$transaction` e la `create` dentro — un `P2002`
aborta l'intero callback, `updateMany` compreso.

---

## B) Per AGB

Il testo completo è in `DA-FARE-audit-e-domande-agb.md`. Le due che contano più di tutte:

- **domanda 4** — sede 18 o sede 30, con la 3b (il formato `13x18` che non esiste) che va sciolta
  nella stessa risposta;
- **domanda 6** — il «listino PVC e ALLUMINIO»;
- **domanda 28** — se lo sconto cliente sia unico o per classe di articolo (questa si può girare
  anche all'ufficio commerciale, non serve AGB).

Se ne mandi solo due, manda queste.
