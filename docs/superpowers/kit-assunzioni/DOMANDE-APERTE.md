# Domande aperte — tutte, in un posto solo

> Sostituisce le due liste separate (AGB da una parte, agente dall'altra). La **numerazione è
> globale e va conservata**: i commenti nel codice rimandano per numero («domanda 4 per
> l'esperto»). Le 1-16 esistevano già; le **17-23** nascono dalla verifica del 2026-07-27; le
> **24-26** dal lavoro sulle sette geometrie del 2026-07-29; la **27** dal lavoro sull'entrata maniglia del 2026-07-30.
>
> ⚠️ Questo è l'**unico** indice della numerazione globale: le schede per tipologia
> (`legno.md`, `tour.md`, …) discutono le domande nel merito ma **non** ricopiano l'elenco —
> due indici della stessa numerazione divergono al primo aggiornamento.
>
> L'audit di `kit_requests` è rimasto in `DA-FARE-audit-e-domande-agb.md`: non è una domanda.

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
| 2 | Squadra angolare: quale delle quattro? | agente | 🟡 4 € a pezzo |
| 20 | Cosa è di serie e cosa è opzione | agente | 🟡 sei voci dello schema |
| 7 | Finestre basse (altezza maniglia < 60 cm) | agente o AGB | 🟡 configurazioni oggi rifiutate |
| 22 | Quali finiture vendete davvero | agente | 🟡 oggi solo argento |
| 19 | Quali combinazioni ordinate più spesso | agente | 🟡 ordine di priorità del lavoro |
| 23 | La finestra 700×1400 battuta 18 sede 30 | agente | 🟡 **secondo golden**, se esiste |
| 26 | Il nottolino di Fosca vuole una copertura | agente o AGB | 🟡 una riga mancante sulle geometrie nuove |
| 25 | Confezioni: si applica il +20% fuori confezione? | AGB o ufficio | 🟡 **i totali di ogni distinta** |
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

## 2 — Squadra angolare: quale delle quattro?
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
>    compensatore, entrambe). Su una finestra tutta in legno quale usi?
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
> **Una in particolare**
>
> 13. La finestra **700 × 1400 con battuta 18 e sede 30** che abbiamo provato insieme: era una
>     richiesta vera? Se sì, **sai quale distinta è stata poi ordinata**? Anche una foto
>     dell'ordine mi basta — con quella posso verificare il programma invece di fidarmi della mia
>     lettura del listino.
>
> Grazie!

## B) Per AGB

Il testo completo è in `DA-FARE-audit-e-domande-agb.md`. Le due che contano più di tutte:

- **domanda 4** — sede 18 o sede 30, con la 3b (il formato `13x18` che non esiste) che va sciolta
  nella stessa risposta;
- **domanda 6** — il «listino PVC e ALLUMINIO».

Se ne mandi solo due, manda queste.
