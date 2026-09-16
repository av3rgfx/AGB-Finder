# L'archivio fotografico COLOMBO non ha più un indice — design

> 2026-09-16 · reparto **maniglie** · branch `claude/colombo-foto-index-0du2f1`
>
> ⚠️ Il repo è **pubblico**: qui non si trascrivono né nomi di file di foto, né
> prezzi, né giacenze. I **nomi degli archivi** sì: sono in `ARCHIVI` da mesi, ed
> è precisamente il confine che questa spec rende esplicito (§6).

---

## 1. Il fatto

`pnpm foto:colombo` non gira più. Il run ops `34965121210` è morto in **29
secondi**, al primo passo, con `Nessun archivio nell'elenco`.

La diagnosi è chiusa e **non va rifatta**:

| ipotesi                             | esito                                                            |
| ----------------------------------- | ---------------------------------------------------------------- |
| il proxy della sandbox              | ❌ fallisce identico sul runner GitHub                           |
| la password è scaduta               | ❌ le pagine dell'area download rispondono                       |
| gli zip sono stati tolti            | ❌ **79/79** rispondono `200`, i cinque del 2026 compresi        |
| **il fornitore ha rifatto il sito** | ✅ l'indice dell'archivio non è più pubblicato in nessuna pagina |

`elencaArchivi()` (`scripts/foto-colombo.ts:57-73`) scopriva la lista
**raschiando** quell'elenco. Non c'è più niente da raschiare.

### Misurato il 2026-09-16, dal container

| misura                                                    | esito                                 |
| --------------------------------------------------------- | ------------------------------------- |
| chiavi di `ARCHIVI`                                       | **79** — una per zip, esatte          |
| zip raggiungibili **per nome**, senza password            | **79 / 79**                           |
| `GET /download/maniglie/archivio/`                        | **403** — nessun listing              |
| homepage area download, **senza password**                | 200 · **29 categorie** · zero `.zip`  |
| occorrenze di «archiv» / «zip» / «photo» in quelle pagine | **0**                                 |
| `mostra.php?lang=en&catalogo=161`, **senza password**     | 200 → il PDF del catalogo Vision 2026 |
| usi di `COLOMBO_DOWNLOAD_PASSWORD` nel repo               | **1** — solo `elencaArchivi`          |

---

## 2. La decisione: la lista viene da `ARCHIVI`

**Verdetto `/llm-council`, 5 advisor su 5.** L'argomento che decide non è la
comodità:

> **Il sito non ha mai deciso _cosa_ scaricare.** `foto-colombo.ts:130` fa già
> `if (!(archivio in ARCHIVI)) { log; continue; }`, quindi l'insieme scaricato è
> sempre stato `sito ∩ ARCHIVI`, e il lato che limita è `ARCHIVI`.

Derivare la lista dalle 79 chiavi **non cambia un byte** di ciò che finisce su
Blob. Cambia **solo come si fallisce** — ed è lì che sta tutto il guadagno.

### 2.1 Il pericolo vero non è il crash: è il run VERDE

`db.$transaction([updateMany({imageUrl:null}), ...update])` è **atomica**: un
crash a metà non lascia il DB senza foto. Due advisor su cinque lo hanno
descritto come «cancellazione di massa»; **è impreciso**, verificato nel codice.

Il pericolo è l'altro, e oggi è reale: un archivio che sparisce dall'elenco del
fornitore produce un run che **finisce bene**, stampa `✓ N articoli con foto`
con N più piccolo, e non allarma nessuno. L'unica spia è `FOTO_ATTESE = 707`,
che è un **totale globale** — due variazioni opposte si compensano — e un
`console.log`.

È la classe di difetto che questo progetto ha già chiuso otto volte
(`isAvailable: true` costante, la casella «Solo disponibili» che non filtrava,
`openingDir` raccolto e mai letto, il `widthMm: 550` del gate). Iterando su
`ARCHIVI`, la tabella fa un'**affermazione** — «questi 79 archivi esistono» — e
ogni run la **verifica**.

### 2.2 La verifica esiste già: il raschiamento la teneva spenta

`vociDi()` chiama `dimensione()`, che è una `HEAD` e **solleva** se
`content-length` non è un numero positivo; `scarica()` solleva su `!res.ok`.
Derivare da `ARCHIVI` **non aggiunge una guardia: ne accende una che c'è**, su
tutte e 79 le righe invece che sulle righe che il sito si ricordava di
pubblicare. Costo di rete: **zero in più**.

### 2.3 Cosa si perde, cosa si guadagna

|                                     | prima (raschiamento)                    | dopo (derivazione)                      |
| ----------------------------------- | --------------------------------------- | --------------------------------------- |
| archivio **aggiunto** dal fornitore | riga `⚠️ archivio non in tabella`       | **invisibile** — §5                     |
| archivio **tolto** o rinominato     | **silenzio**, e un run verde più povero | **errore col nome**, prima di Blob e DB |

Non è una perdita secca: è uno **scambio**. E il ramo che si perde non produceva
niente di automatico — un archivio non in tabella veniva comunque ignorato.

### 2.4 Non è «inventare per concatenazione»

Il divieto §9 (`A50904.22` non esiste, ed è il difetto che ha disattivato i
moduli kit PVC e battente) **non si applica qui**, ed è una distinzione di
sostanza: un **codice** inventato produce una riga con un prezzo e nessun
errore, indistinguibile da una riga giusta; un **URL** costruito viene
verificato dal server del fornitore nello stesso secondo. La regola vera non è
«mai concatenare», è «mai affermare ciò che non si può verificare». Qui la
verifica è una `HEAD`, e oggi dà 79 su 79.

---

## 3. Come deve fallire

**Si raccolgono TUTTI i fallimenti e ci si rifiuta prima di toccare Blob e DB**,
elencando i nomi. Non si muore al primo: lo scenario realistico non è «un
archivio sparito» ma «ne hanno rinominati sei», e col fail-fast sarebbero sei
cicli run → commit → run da sette minuti l'uno.

È la stessa forma della guardia che 29 secondi fa ha lasciato la produzione
intatta. **Si generalizza, non si sostituisce.**

**Nessun flag `--consenti-mancanti`.** Un archivio ritirato davvero si registra
togliendo la sua riga da `ARCHIVI`, in un commit datato che passa da review.
Un flag digitato di sera fa sparire foto dalla produzione senza lasciare traccia
e senza che nessuno abbia guardato la copertura.

### 3.1 Due spie nuove, e nessuna soglia

1. **Errore duro se un archivio noto restituisce zero `.jpg`.** Misurato oggi:
   **0 su 79**. Non è mai legittimo, e un archivio svuotato passerebbe la `HEAD`.
2. **Il run stampa `prima → dopo`** degli articoli con foto, leggendo il _prima_
   da `articles.imageUrl != null`. Zero stato nuovo: **il DB è già il registro
   dell'ultimo run**.

⚠️ **Niente soglia di abort sul calo**, ed è un'obiezione di un advisor a un
altro, **verificata nel repo**: la PR #60 è passata **deliberatamente** da
**2.118 a 1.609** foto (−24 %) per togliere 350 immagini che mostravano la
finitura di un altro codice. Una soglia al −5 % avrebbe bloccato una decisione
giusta. Il numero di partenza si **dichiara**; non si usa per decidere.

### 3.2 `FOTO_ATTESE = 707` resta com'è

Misurato oggi derivando da `ARCHIVI`: **707 foto esatte**. La costante è ancora
vera, e i cinque archivi 2026 erano già dentro quel numero.

**Scartate** due proposte del council:

- **l'impronta sha256 dei nomi**: vuole una costante che cambia a ogni ritocco
  del fornitore più un flag `--accetta-indice` per ratificarla. Copre un rischio
  reale (un file rinominato dentro un archivio noto) a un costo di manutenzione
  perpetuo, su un run che gira qualche volta al mese;
- **i conteggi per archivio**: 79 numeri da tenere allineati, cioè il **secondo
  manifest** che lo stesso council rifiuta altrove.

Il rischio resta **dichiarato e non coperto** (§7).

---

## 4. La password

Esce da `scripts/foto-colombo.ts` **e** da `.github/workflows/ops-foto-colombo.yml`,
**guardia `test -n` compresa** — che altrimenti farebbe fallire in zero secondi
un run che non ne ha più bisogno: la lezione `NEON_DIRECT_URL` letta al
contrario.

Due correzioni a quanto si credeva:

1. la password **non «resta viva per i PDF»**: nel repo non è mai stata usata per
   i PDF, e oggi il sito non la chiede nemmeno per quelli (`mostra.php` risponde
   a una `GET` nuda);
2. i 79 zip **non la vogliono**: la password sbarrava solo l'indice, che non
   esiste più.

**Il secret su GitHub resta**, non referenziato (decisione utente). Serve ancora
agli umani per l'area download — il PDF Vision 2026 di questa sessione è stato
scaricato di lì — e rimetterlo in un workflow costa secondi, mentre perderlo
costa una telefonata al fornitore.

---

## 5. Il segnale «archivio non in tabella»

### 5.1 Quanto valeva davvero

Va detto prima di spendere per ricostruirlo. Ha sparato **una volta** in tutta
la vita del progetto — i cinque archivi 2026, annotati mesi prima del listino —
e ha funzionato per una ragione che non si ripete su ordinazione: chi lanciava
il run era la stessa persona che leggeva il log ed era la stessa che sapeva
cosa farsene.

Tre difetti strutturali: non è indirizzato a nessuno, è indistinguibile dalle
altre trecento righe, e si accende solo per caso. **La regola che ne ricaviamo:
i log di un run manuale servono a confermare ciò che hai appena chiesto, mai a
dirti ciò che non hai chiesto.**

E c'è un fatto che chiude la questione: **il segnale non è morto quando si è
rotto lo script — è morto quando COLOMBO ha smesso di pubblicare l'indice.**
Nessuna soluzione nostra lo ripristina.

### 5.2 Scartato: continuare a raschiare «per se tornasse»

Un advisor l'ha refutato con una misura che **ho verificato**: la regex è
`/'(\/download\/maniglie\/archivio\/[^']+\.zip)'/` — pretende gli **apici
singoli**, cioè è ritagliata su un `onclick='…'` di un HTML che non esiste più.
«Si riaccende da sé» è quasi certamente falso: il sito è stato rifatto e quel
markup non torna identico.

Peggio: è codice il cui esito «niente» è **indistinguibile** da «il selettore
non combacia più». Questo progetto ha già pagato quattro volte per script di
verifica che mentivano (`details summary`, `ul.grid`), e una per un gate che
usciva in silenzio senza verificare nulla. **Un rilevatore che non si può
osservare mentre rileva è un commento che costa CI.**

Al suo posto, nel punto in cui stava `elencaArchivi`, un commento che dice
**dove** era l'indice, **che forma** aveva e **quando** è sparito: se il
fornitore ripristina qualcosa, quel commento vale più di otto righe morte,
perché dice a chi legge cosa cercare.

### 5.3 Adottato: il guardiano dell'indice pubblico dei documenti

L'area download pubblica ancora **29 categorie**, senza password, e — argomento
decisivo — **è il segnale che ha davvero fatto partire le ultime due sessioni**:
`Vision 2026 catalogue` ed `ER catalogue 2026` sono lì. Il rilevatore-zip ha
sparato una volta; il rilevatore-documenti due, ed è quello da cui sono nati i
240 articoli del listino 2026.

Va adottato **sui suoi meriti**, non come consolazione: andrebbe fatto anche se
l'indice degli zip non fosse mai sparito.

Quattro vincoli, tutti non negoziabili:

1. **Fuori da `foto:colombo`.** Un segnale infilato in un run manuale eredita il
   difetto che ha fatto perdere il precedente. E con la §2 non ci arriverebbe
   nemmeno: il run si rifiuta prima.
2. **Il recapito è il fallimento, non il log.** Workflow `schedule:` settimanale
   (**sarebbe il primo del repo**): un run schedulato rosso manda la mail al
   proprietario, senza scrivere una riga di integrazione. E resta rosso ogni
   settimana finché qualcuno non ratifica — e **la ratifica è un commit datato**,
   la stessa forma di `ARCHIVI`.
3. **Zero risultati è un ERRORE, mai «nessuna novità».** È esattamente la
   guardia che oggi ha lasciato la produzione intatta. Senza, il giorno che
   COLOMBO rifà il sito un'altra volta il guardiano direbbe «tutto a posto» per
   sempre — cioè ricadrebbe nella classe di difetto che stiamo correggendo.
4. **Segnala qualunque link non-`.pdf`.** Una riga, e assorbe l'intento
   dell'opzione scartata senza il suo scraper: se un `.zip` ricompare da
   qualche parte, il guardiano lo dice.

**Il rumore si accetta e si dichiara**: COLOMBO aggiunge un PDF qualunque → job
rosso. Non si filtra, perché un titolo che cambia (`ER catalogue 2026` →
`2027`) **è** il segnale, e filtrarlo vorrebbe dire indovinare quale
cambiamento conta. Se dopo qualche settimana risultasse insostenibile, la
risposta è restringere il confronto agli id `catalogo=NNN` e ai link PDF, **non**
spegnere il job.

### 5.4 Le domande al fornitore

Due nuove in `docs/superpowers/domande-colombo.md`, perché il canale umano è
l'unico che può restituire il **tempo di anticipo**:

- **C7** — «l'archivio fotografico non compare più in nessuna pagina dell'area
  download: c'è un indice, un feed o un contatto a cui chiederlo?» Serve anche al
  **recupero**: quando il pre-volo dirà «`01_Fedra` non c'è più», oggi non
  abbiamo alcun modo di scoprire il nome nuovo (il listing è 403).
- **C8** — «come ci fate sapere che esce un prodotto nuovo?» Un advisor la
  giudica valere più delle altre quattro messe insieme, e ha ragione: è
  l'informazione commerciale che il segnale perduto forniva per effetto
  collaterale di uno script di conversione immagini.

⚠️ **Cinque domande non poste sono un canale che non esiste.** Se il file resta
non spedito, questa non è una soluzione: è un desiderio.

---

## 6. Il confine del repo pubblico, riscritto

Due commenti in testa a `scripts/foto-colombo.ts` affermano il falso, e uno lo
faceva **già prima** di questa modifica:

| oggi dice                                                              | verità                                                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| «nessun elenco di nomi del fornitore dentro un repo pubblico»          | **falso da mesi**: 79 chiavi di `ARCHIVI` sono nomi di cartelle del fornitore |
| «la password dell'area download arriva da `COLOMBO_DOWNLOAD_PASSWORD`» | sparisce con la funzione                                                      |

⚠️ **La prima riscrittura era anch'essa mezza falsa, e l'ha trovata la review di
branch.** Diceva «i nomi degli ARCHIVI stanno nel repo; i nomi dei FILE e i byte
delle foto no»: ma `FILE_MODELLO` (`foto-archivio.ts:202-235`) contiene **15 nomi
di singoli file** dell'archivio — `02_Pomoli/robot45_45`,
`01_Milla_1/milla1_2CRCM`, … — verificati esistenti contro l'indice vivo. Avevo
corretto la metà su `ARCHIVI` e lasciato falsa la metà sui file, che è il modo in
cui un commento sbagliato sopravvive a una correzione.

Il confine vero, per intero: **nel repo stanno i 79 nomi degli ARCHIVI e i 15
nomi di file di `FILE_MODELLO`** (quelli in cui COLOMBO scrive la serie).
**Non ci stanno gli altri ~690 nomi, e mai i byte delle foto.** E resta vero — ed
è la ragione per cui la §2 è accettabile — che **il contenuto di ogni zip si
rilegge dal vivo** a ogni run, con le Range sulle central directory: si localizza
l'elenco degli **zip**, non l'indice dei **file**. L'abbinamento foto → codice
continua a essere misurato sulla realtà, non postulato.

È lo stesso confine che regge il gate: `COLOMBO_FOTO_INDEX` arriva da un JSON
fuori dal repo, prodotto con `--dry-run --dump`.

---

## 7. I rischi, e quali non si coprono

| rischio                                                                                    | stato                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| archivio **tolto o rinominato**                                                            | ✅ coperto: errore col nome, prima di Blob e DB                                                                                                                                                                                        |
| archivio **svuotato** (zip c'è, zero `.jpg`)                                               | ✅ coperto: errore duro                                                                                                                                                                                                                |
| calo di copertura per cause nostre                                                         | ✅ **dichiarato** (`prima → dopo`), mai bloccato                                                                                                                                                                                       |
| **contenuto cambiato dentro un archivio noto** (un file rinominato, uno scatto sostituito) | 🔴 **NON coperto, e dichiarato.** È la forma di cambiamento più probabile. L'unica spia resta `FOTO_ATTESE`, che è globale. Il rimedio esiste (l'impronta dei nomi) ed è stato scartato per costo (§3.2): se capiterà una volta, si fa |
| archivio **nuovo** per un modello già esistente                                            | 🔴 non coperto da nulla, nemmeno dal guardiano                                                                                                                                                                                         |
| prodotto nuovo annunciato solo in fiera o dal rappresentante                               | 🔴 non copribile con software: è la domanda **C8**                                                                                                                                                                                     |
| il guardiano che marcisce in silenzio                                                      | ✅ guardia «zero categorie → errore», §5.3                                                                                                                                                                                             |

---

## 8. Cosa NON si fa, e perché

- **Niente enumerazione o indovinelli di nomi nuovi** (`00f_*`, `01_<modello>`).
  COLOMBO usa sigle interne (`Robot4` = ROBOQUATTRO): l'enumerazione fallisce
  **proprio sui casi storti**, che sono quelli per cui la tabella è scritta a
  mano. E produrrebbe centinaia di 404 sul sito del fornitore.
- **Niente secondo manifest** (un `archivi.json`, una tabella a DB): `ARCHIVI`
  è già il manifest, con etichetta, `serie` e `soloCopertina` riga per riga.
- **Niente fallback «raschia, e se fallisci deriva»**: lo stesso comando farebbe
  cose diverse a seconda dell'HTML del fornitore, e il run riuscito non direbbe
  quale strada ha preso.
- **Niente mirror dei 3,5 GB**: risolve un problema che non abbiamo (79/79
  rispondono) e renderebbe _invisibile_ l'invecchiamento.
- **Niente `--prova <nome>`** per interrogare un archivio ipotizzato: è una
  comodità per un gesto che si fa con un `curl`, e nessuno l'ha chiesta.

---

## 9. Verifica e ops

**Gate.** `pnpm typecheck` · `pnpm lint` · `pnpm test` (baseline **1.655**) ·
`pnpm build` · il gate d'integrazione con `COLOMBO_FOTO_INDEX` e
`INTEGRATION_DATABASE_URL`.

⚠️ **Il gate d'integrazione sulle foto è INESEGUIBILE da quando COLOMBO ha
cambiato il sito**, e nessuno l'aveva scritto fra le conseguenze del blocco:
`foto-colombo.ts:117` pretende la password **prima** del ramo `--dry-run`, e
chiama `elencaArchivi` comunque, quindi `--dry-run --dump` — l'unico modo di
produrre `COLOMBO_FOTO_INDEX` — è morto con lei. **Questa PR lo resuscita**, ed
è una seconda ragione, indipendente, per farla subito.

**Nessuna migrazione. Nessuna finestra di disservizio.**

**Un run ops**: «Ops — Foto COLOMBO», idempotente (ciò che è già su Blob non si
riscarica). Misurato oggi in locale sul catalogo vero, è ciò che deve produrre:

|                       | atteso                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| archivi               | 79 / 79, zero mancanti                                                                                                          |
| foto indicizzate      | 707                                                                                                                             |
| articoli con foto     | **1.609 → 1.727** (46,6 % → 46,9 %)                                                                                             |
| file distinti su Blob | 304 → **320** (≈ 16 caricate)                                                                                                   |
| i cinque modelli 2026 | LACONICA **30/30** · ROBOT6 **36/36** · ROBOT6 S **36/36** · HALO **5/25** · KUBO **10/30** righe con foto, tutti con copertina |

HALO e KUBO sono parziali perché è la **regola della finitura** che lavora: una
foto resta solo a chi può dimostrare che è sua. Non è un difetto da correggere.

⚠️ «tutti con copertina» **non è un'osservazione, è un'asserzione da provare**:
`previewDiGruppo` fa `daArticolo ?? copertinaDiGruppo(etichetta)`, quindi un
gruppo-modello con articoli fotografati la copertina ce l'ha, ma **solo** se la
sua etichetta è in `etichetteModello()`. Entra quindi nel gate d'integrazione un
pavimento nuovo, della stessa forma dei «sette gruppi segnalati» della PR #61:

> **i cinque modelli del listino 2026 hanno una copertina e almeno una foto di
> riga.** Senza, un errore in una delle cinque righe di `ARCHIVI` lascerebbe quei
> gruppi come tessere-parola e **nessun conteggio andrebbe a zero**.
