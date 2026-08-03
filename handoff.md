# Handoff — UFPtrade WebApp

> Creato/aggiornato da Claude alla fine di ogni sessione per riprendere il lavoro
> senza perdere contesto. (Regola permanente: aggiornare tutti i `.md` a fine sessione.)

---

## Sessione attuale

| Campo | Valore |
|-------|--------|
| **Data** | 2026-08-04 — **REPARTO MANIGLIE (passi 1-3) + SELETTORE DI REPARTO** |
| **Fase in corso** | Fase 1 — MVP Gestionale · **il secondo dominio è vivo** |
| **Sotto-fase** | Archivio pronta consegna COLOMBO — passi **1, 2 e 3 fatti**; passo 4 (foto da catalogo) NON fatto |
| **Branch git** | `claude/program-selector-yxw8zd` (da `main`, dopo il merge #49) — **pushato** |
| **Stato deploy** | **Neon ALLINEATO**: la migrazione è già applicata. Manca solo il merge. |
| **🟢 Azione ops** | **ESEGUITA.** Run «Ops — Neon» **`30848665038`** del 2026-08-03 20:05→20:17Z, lanciato **sul ref del branch** (`8f60bba`) e non su `main`: **15/15 passi verdi**. Migrazione `20260803182947_maniglie_articles_stock` applicata (tre tabelle: `articles`, `stock_imports`, `stock_lines`) · import catalogo AGB · seed admin/kit/clienti · embed **1 secondo** (niente da fare: nessun codice nuovo, come atteso). Lanciata PRIMA del merge, quindi finestra di disservizio **zero** — il precedente da evitare sono i venti minuti della PR #40. ⚠️ Il seed di sviluppo `db:seed:maniglie` NON è nel workflow, ed è giusto: quei 20 articoli sono inventati e non devono arrivare in produzione. Al merge non resta nulla da fare. |
| **Gate** | typecheck · lint · **1212 test** (131 skip) · build **22 route** (erano 18) · **browser 77/81** (desktop e 375px, screenshot guardati) · **integrazione 13/13 su Postgres vero** |
| **Aperto** | **passo 4** (pagina + foto da catalogo ER su Blob) · i **tre file di Andrea** (non sono nel repo) · la **finta ricerca in TopBar** (sotto) · Vercel Pro entro sabato 08/08 · storage Neon da misurare · le tre distinte reali |

---

## Sessione precedente

| Campo | Valore |
|-------|--------|
| **Data** | 2026-08-01 — **CAMBIARE LE VARIANTI DOPO LA CREAZIONE** — **PR #48 MERGIATA** |
| **Fase in corso** | Fase 1 — MVP Gestionale |
| **Sotto-fase** | Kit engine: le varianti del passo «Componenti» diventano modificabili su una richiesta già emessa |
| **Branch git** | `claude/verifica-distinte-reali-8zz9mw` |
| **Stato deploy** | LIVE e allineato. |
| **Azione ops** | Nessuna. |
| **Aperto** | le tre distinte reali · domanda 31 · domanda 4 · domanda 29 · preview Vercel rotte · mail ad AGB · audit `kit_requests` · `dedupeRows` |

---

> **▶ RIPRENDI DA QUI**
>
> ### Cosa è successo (2026-08-04)
>
> Il reparto maniglie esiste: modello dati, import listino, ricerca, scheda, upload della
> pronta consegna. E la prima schermata dopo il login è il **selettore di reparto**.
>
> ### Il council ha scartato tutte e tre le strade della spec §8.0
>
> `/llm-council` (5 advisor + 5 peer review + chairman). La **(b)** — due route group
> affiancati — è caduta su un fatto **riprodotto eseguendo `next build`** con il Next
> 15.5.20 installato: due gruppi fratelli che risolvono lo stesso path fanno fallire la
> build (`E28`, *«two parallel pages that resolve to the same path»*). Il punto che la spec
> non sapeva: **i route group non entrano nell'URL, quindi separano il LAYOUT e non il
> NAMESPACE**. E l'assistente, `/utenti` e `/impostazioni` sono già trasversali ai due
> reparti: sotto la (b) andrebbero collocati in uno o duplicati. Non è né fatale né gratis:
> è **inerte**.
>
> Adottata la **(a) + un segmento URL vero** `(dashboard)/maniglie/…` — l'opzione che
> nessun advisor aveva proposto. Asimmetria dichiarata: **nessun prefisso = serramenti**,
> `/maniglie/*` = maniglie. Zero rinomine, segnalibri vivi, «le finestre non si toccano»
> vero alla lettera.
>
> **ZERO COOKIE.** Il reparto si deduce dall'URL. Ricordarlo sarebbe l'ottava occorrenza
> della classe «valore deciso dal programma e mai dichiarato», e il rimedio non è
> «scriverlo a schermo», è **non ricordare**.
>
> ### Le parole (decisione dell'utente, che ha capovolto il council)
>
> Il council proponeva i **marchi nudi** (AGB / COLOMBO) perché «MANIGLIE» è ambiguo — e
> l'ambiguità è vera e verificata: `recent-searches.tsx:5` suggerisce «maniglia» fra le
> ricerche **dell'archivio AGB**, la cremonese *è* la maniglia della finestra (69
> occorrenze in `src/`). Ma l'utente ha portato un dato nuovo: il reparto ospiterà
> **almeno cinque marche** (COLOMBO, HOPPE, OLIVARI, DND, GHIDINI). Quindi COLOMBO non è
> il *nome* del reparto, è un suo **contenuto**, e la tessera andrebbe rinominata alla
> seconda marca — cioè il difetto che si voleva evitare.
>
> Esito: tessere **SERRAMENTI / MANIGLIE**, **marchio nel sottotitolo** (cresce senza
> rinomine), parola **«reparto»** e mai «programma», e la sezione di ricerca maniglie si
> chiama **«Disponibilità»** e non «Archivio» — due sezioni omonime manderebbero l'agente
> in quella sbagliata.
>
> ### La decisione di disegno che regge tutto: la data sta UNA VOLTA SOLA
>
> La spec impone che nessuna disponibilità si mostri senza la data dell'ultimo import. Ma
> la data è una proprietà **dell'import**, identica su ogni riga: ripeterla su venti righe
> sarebbe N volte lo stesso dato. Vive in una fascia sotto il campo di ricerca — presente
> **prima di cercare**, **coi risultati** e **a zero risultati**. Sulla scheda invece sta
> attaccata al badge, perché lì l'articolo è uno solo. Nessuna data finta: se non c'è
> import si scrive «Nessuna pronta consegna caricata».
>
> **«Da ordinare» NON è rosso**: è il caso normale (3.278 su 3.456). Un allarme su tre
> righe su quattro smette di essere un allarme in due giorni.
>
> ### Il ramo trigram si è guadagnato il posto, sul DB vero
>
> Cercando «bocchetta» si trova **`BOCCEHTTA CD41`**, il refuso digitato a mano dal
> fornitore, subito **dopo** le due bocchette scritte giuste. Con un `ILIKE` quell'articolo
> sarebbe irraggiungibile: un pezzo che è sullo scaffale e non si trova è esattamente ciò
> che riporta l'agente al telefono. C'è un test d'integrazione che lo blinda.
>
> ### Due controlli nuovi, che prima non esistevano
>
> - **L'invariante del prezzo diventa permanente.** «prezzo + surcharge ricostruisce la
>   colonna SOMMA» era una misurazione fatta una volta sulle 3.456 righe: ora l'import lo
>   ricontrolla a ogni passaggio e lo segnala. Se il listino nuovo lo rompe si vede allo
>   script, non in bocca a un agente davanti a un cliente.
> - **Le collisioni di codice normalizzato si trovano prima di scrivere**, e dicono quali.
>   Il vincolo unique le farebbe esplodere comunque, ma a metà import e con un errore di
>   driver muto.
>
> ### ✅ Due controlli finti nella TopBar, trovati col browser e RIMOSSI
>
> **La ricerca nella TopBar era finta.** `topbar.tsx` montava un `<input type="search">`
> con placeholder «Cerca prodotti, kit, codici…» e **nessun `onChange`, nessun form,
> nessun handler**: in produzione da sempre, non faceva niente. L'ho scoperto cadendoci
> dentro — il mio script di verifica ci ha digitato credendolo il campo della pagina.
>
> Non era inerte: sulla pagina «Disponibilità» sedeva **sopra** il campo vero, e a 375px
> l'agente si trovava **due caselle impilate** con quella d'istinto morta (misurato:
> `trovati 2`). È la stessa classe di difetto chiusa otto volte da questo progetto.
>
> **Controllando, anche la campanella delle notifiche era finta**: nessun handler, e in
> tutta l'app non esiste alcun sistema di notifiche (grep: zero riscontri). Rimossi
> entrambi su decisione dell'utente.
>
> **Perché rimuovere e non far funzionare.** Una ricerca globale avrebbe senso, ed è anzi
> il posto in cui vive la domanda che attraversa i due reparti («questo è ordinabile
> oggi?»): digitare un codice e finire nel reparto giusto, qualunque sia — che è
> letteralmente il criterio con cui il council ha deciso di tenere un repo solo. Ma è una
> **feature da progettare**, non un handler da attaccare a una casella rimasta morta per
> mesi senza che nessuno la reclamasse; e quel silenzio è il dato più forte che abbiamo
> sul suo valore attuale. Segnata come lavoro futuro deliberato.
>
> La sentinella (`topbar.test.tsx`) **dimostra prima di guardare nel posto giusto** —
> asserisce che la TopBar renderizzi davvero — e solo dopo afferma l'assenza: altrimenti,
> il giorno che il componente non montasse, l'assenza sarebbe vera e il test passerebbe a
> vuoto. Browser **12/12** su desktop e 375px, serramenti inclusi (l'archivio AGB ha
> ancora il suo campo, i filtri e la scorciatoia `/`).
>
> ### Altre cose viste col browser
>
> - Idratazione disallineata **osservata una volta** su desktop durante una sequenza di
>   navigazione, **non riproducibile** su caricamento pulito di nessuna delle 7 pagine.
>   Registrata come tale: non risolta, non negata.
> - I 404/500 in console erano artefatti del dev server in hot-reload mentre modificavo
>   file: zero risposte ≥ 400 su una sessione pulita.
> - Due miei test browser **passavano per il motivo sbagliato** (leggevano la pagina dei
>   risultati credendola la scheda, perché `networkidle` ritorna prima che la query del
>   client si risolva). Corretti aspettando il **contenuto**.
>
> ### Cosa NON è stato fatto, e perché
>
> - **Passo 4** (pagina di catalogo + foto su Blob): serve il PDF `ER MAN 2026`, che non è
>   nel repo.
> - **L'import vero del listino**: `pnpm import:listino COLOMBO <file.xlsx>` è scritto e
>   testato, ma **i tre file di Andrea non ci sono** (la scratchpad si perde col container).
>   Il seed `pnpm db:seed:maniglie` dà 20 articoli inventati **della forma misurata** (le
>   tre grafie, i due refusi, tre orfani) per lavorare senza.
> - **Lo skip del selettore quando i reparti sono uno solo** (suggerito dal council): oggi
>   la lista è sempre di 2 per tutti (`MAGAZZINO` è fuori scope), quindi sarebbe codice
>   morto. Da fare quando esisterà un utente con un reparto solo.
>
> ### Debito dichiarato
>
> - `article.search` fa `resolveStock` con un giro per marca: con 5 marche sono 5+5 query.
>   Irrilevante a 3.456 articoli e una marca, da rivedere alla terza.
> - Le due schermate maniglie **duplicano ~12 righe** di gestione foto (miniatura e foto
>   grande): un `article-image.tsx` condiviso le unificherebbe.
> - `CopyCodeButton` fissa `text-sm` e non accetta `className`: sulla scheda il codice non
>   può essere più grande senza toccare un componente del reparto serramenti.
>
> ### La regola sul raw SQL è stata riscritta, non aggirata
>
> Diceva «solo per pgvector, nel solo `RAGEngine`». Era **già disattesa** da
> `src/server/chat/tools.ts`, e la ricerca articoli (tsvector + trigram, senza pgvector,
> non esprimibile in Prisma) l'ha resa insostenibile alla lettera. Riscritta in `CLAUDE.md`
> per dire ciò che davvero protegge — **il confinamento in moduli di ricerca nominati** —
> con l'elenco completo dei due moduli. La regola di business (la disponibilità) resta
> fuori dal raw SQL, in `stock-status.ts`, tutta Prisma.
>
> ---
>
> ### (Sessione precedente, 2026-08-03)
>
> ### Cosa è successo (2026-08-03)
>
> L'utente **non** ha continuato lo sviluppo: ha portato un **quesito progettuale**. Andrea,
> addetto al rifornimento magazzino, ha chiesto un software che dica se una maniglia è **in
> pronta consegna** o **da ordinare**. La domanda era: aggiungerlo a UFPtrade o farne uno
> separato?
>
> ### Il verdetto: A′ — stesso repo, dominio affiancato, identità intatta
>
> `/llm-council` (5 advisor + 5 peer review + chairman): **tre per l'integrazione, uno per il
> repo separato, uno che demolisce entrambe le versioni ingenue**; monorepo scartato
> all'unanimità. Il criterio che decide **non** è «utenti in comune», né «riuso di codice»,
> né «rischio di deploy» — sono costi, non discriminanti. È: **esiste una domanda che
> l'agente farà davanti al cliente e che attraversa i due domini, con una risposta sola?**
> Sì: *questo è ordinabile oggi?*
>
> Si condividono repo, deploy, **un solo Better Auth**, layout e **lo stesso database**.
> **NON** si condivide la tabella `Product`: le maniglie hanno tabelle proprie. La
> migrazione multi-fornitore di `Product` (`agbCode @unique`, `ProductImage.agbCode @id`,
> `LISTINO_TOTAL_PAGES` scalare — **128 occorrenze in 22 file**) si rimanda alla **marca #3**,
> quando ci saranno quattro cataloghi a dire che forma deve avere.
>
> ### Il difetto già in produzione che il council ha trovato per caso, ed è il passo 0
>
> `map-product.ts:11,75` scriveva `isAvailable: true` e `stockQuantity: 0` come **tipi
> letterali costanti** per tutti e 7.488 i prodotti. Non era inerte: usciva da **sei canali**
> — pallino «Disponibile» nell'archivio, badge nella chat, **i campi passati a Gemini**
> (quindi affermabili a voce a un cliente), le proiezioni SQL, un `select` nel kit, e —
> scoperto scrivendo il piano, il peggiore — **una casella «Solo disponibili»** con chip e
> parametro URL, che l'agente poteva spuntare ricevendo comunque tutti e 7.488 i prodotti.
> Un pallino che mente lo si ignora; un filtro che hai scelto tu, no.
>
> **Fatto e verificato:** 7 task TDD + 7 review + review finale di branch. Zero occorrenze
> nel codice di produzione; restano i **quattro test sentinella** che asseriscono l'assenza.
>
> ### 🟢 Azioni ops: NESSUNA
>
> Nessuna migrazione, nessun re-import, nessun seed. `import-catalog.ts` fa spread
> dell'oggetto in Prisma: togliendo i due campi subentrano i **default di schema**, quindi
> **il dato a DB non cambia**. Si merge e basta.
>
> ### ▶ LA PROSSIMA SESSIONE: il selettore di programma, poi i passi 1-4
>
> Decisione dell'utente a fine sessione: **la prima schermata dopo il login diventa un
> selettore** — oggi **FINESTRE** e **MANIGLIE**, domani forse altre — per rendere visibile
> il distacco fra i due programmi. **La sezione finestre non si tocca.** Sul disegno delle
> schermate maniglie: **carta bianca**, allo stile del software esistente.
>
> ⚠️ **La tensione da sciogliere per prima:** un selettore *è* una modifica al guscio di
> navigazione — cambia dove atterra il login, aggiunge un livello di route, tocca la
> sidebar. Nessuna funzionalità delle finestre cambia, **ma il loro contenitore sì**. Tre
> strade in spec §8.0; da portare a `/llm-council` e `/impeccable` **prima** di scrivere
> codice.
>
> ### I fatti sui dati, misurati e non assunti (non rifarli)
>
> - **Tre fonti, tre popolazioni che non si contengono**: listino xlsx **3.456 codici** con
>   prezzo ed EAN completi · pronta consegna xls **201 codici** · catalogo PDF.
> - **Lo stesso codice è scritto in tre modi**: `0CD41R-CM` (listino) · `0CD41RCM` (magazzino)
>   · `CD 41 R` spaziato (catalogo). Normalizzando a `[A-Z0-9]` il listino **non ha
>   collisioni**: è una chiave sicura. **178 match su 201.**
> - **I 23 orfani (11%) non sono refusi.** 18 esistono nel catalogo e mancano solo dal listino
>   **perché il listino fornito è vecchio** (Andrea sta procurando quello nuovo) · 2 sono
>   refusi del magazzino **non correggibili in automatico** (`0CD63CM` ha **due** codici
>   giusti) · 3 sono spazzatura (`XALL`, `XMP`, `XGRATZ7SX`).
> - **Il catalogo giusto è `ER MAN 2026`, non `RR`**: 261 pagine, 725 immagini JPEG, copre
>   l'**85%** dei codici contro il 57% di RR, ed è un **sovrainsieme** (ER ∪ RR = ER). Il 15%
>   che resta fuori è minuteria (bocchette, rosette, viti) che nessun catalogo fotografa.
>   URL: `download.colombodesign.com/download/maniglie/pdf/ER MAN 2026_100726.pdf`.
> - **Il testo di quei PDF si decodifica con uno shift costante di +29 byte** (font CorelDRAW
>   senza ToUnicode). Senza quello sembrano illeggibili.
> - **Il prezzo «già sommato» non è mostrabile com'è**: il **96%** delle righe della colonna
>   `SOMMA` ha più di 2 decimali, il 36% ne ha 13-16 per errori float di Excel. Si arrotonda a
>   2 in `Decimal`. Verificato che salvare le due metà e sommarle dà lo stesso risultato su
>   **tutte e 3.456** le righe.
> - **Il listino ha refusi digitati a mano** (`BOCCEHTTA`, `ROBOCINQUQ`): la ricerca full-text
>   non li trova, il ramo **trigram** sì.
>
> ### Le risposte di Andrea (già raccolte, non richiederle)
>
> Quantità: **non servono** (le cerca sul gestionale) · frequenza import: **da due volte
> l'anno a ogni giorno** → **nessuna soglia «dato vecchio»**, si mostra la data e basta ·
> formato file: **solo `.xls`** · credenziali area download COLOMBO: **non disponibili** →
> foto estratte dal PDF · prezzo: **quello sommato** · gli orfani: **nascosti all'agente ma
> conservati** (righe `StockLine` con `articleId = null`: è ciò che li farà riagganciare da
> soli al listino nuovo).
>
> ### 🔴 Vincolo di piattaforma da non dimenticare
>
> **Vercel Hobby vieta l'uso commerciale** (Fair Use Guidelines: *«restricted to
> non-commercial personal use only»*, e commerciale include *«a paid employee»*). Un
> gestionale usato da 15-20 dipendenti ci ricade: rischio **sospensione**, non
> rallentamento. **L'utente passa a Pro entro sabato 2026-08-08.** Pro si paga per membro
> del *team di sviluppo*, non per utente dell'app.
>
> Capacità a 20 utenti: invocazioni 12% · CPU 25% · banda CDN 5% ✅; **Fast Origin Transfer
> 40%** ⚠️ · **storage Neon 72-80%** 🔴 (stimato) · egress Neon 40% ⚠️. I tre punti caldi
> hanno **una sola causa**: le 7.082 foto AGB stanno **dentro Postgres** e ogni miniatura fa
> Neon → funzione → browser. Da qui: **le foto COLOMBO nascono su Vercel Blob**.
> **Da misurare (10 secondi, dashboard Neon → Storage):** se supera i 400 MB su 500, le foto
> AGB vanno spostate su Blob **prima** di aggiungere COLOMBO.
>
> ### Debito e residui dichiarati di questa sessione
>
> - **`product.getById`/`getByCode` fanno `findUnique` senza `select`**: i due campi arrivano
>   ancora al browser. La scheda prodotto è **l'unico punto** dove il pallino tornerebbe con
>   una riga sola e tutti i gate verdi. Chi tocca `product-detail.tsx` lo sappia.
> - **Il dato a DB continua a mentire**: `is_available` ha `DEFAULT true`. Sono spariti i
>   lettori, non l'affermazione. Chiuderla davvero (droppare colonne + `@@index([isAvailable])`,
>   che oggi è **un indice su una costante**) è materia della migrazione del passo 1.
> - **Esistono DUE `DESIGN.md`**: quello di root (vivo, corretto in questa sessione) e
>   `ufptrade/ufptrade-design/DESIGN.md`, fermo alla Fase 1c, che alla riga 22 dice ancora
>   «out of stock». Non aggiornato di proposito: **il problema è il doppione, non la riga**.
> - `product-detail.tsx` e `product-filters.tsx` **non hanno file di test**: sono le due sole
>   superfici toccate senza sentinella.
>
> ### Lezioni operative nuove
>
> - **Il container perde la copia locale del repo a metà lavoro.** È successo davvero: i
>   commit erano già sul remoto e si è recuperato con `git reset --hard origin/<branch>`.
>   **Pushare presto.** La scratchpad invece si perde e basta (l'ER PDF va riscaricato).
> - **Docker muore da solo, più volte per sessione.** Se un comando sul DB fallisce,
>   `setsid nohup dockerd … & disown` + `docker start ufptrade-db` prima di sospettare altro.
> - **`prisma/seed-catalog.ts` dà 50 prodotti veri senza il PDF**: è ciò che rende possibile
>   la verifica browser in locale. Ma le distinte kit citano codici che lì non esistono →
>   la scheda richiesta mostra «Codice … non a listino»: **è un artefatto del seed, non una
>   regressione.**
> - **SheetJS non si installa da npm**: il registry è fermo alla 0.18.5 del 2022 con CVE mai
>   corrette lì. Si prende dal CDN: `pnpm add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
> - **Un gate «grep non deve trovare nulla» è quasi sempre sbagliato**: trova i test
>   sentinella che asseriscono l'assenza. Il gate giusto esclude i `*.test.*`.
> - **Un test che verifica un'assenza deve prima dimostrare di guardare nel posto giusto.**
>   Una sentinella cliccava «il primo bottone che trova»: se domani un bottone la precede, la
>   lista non si apre, il badge non compare perché non c'è nulla, e il test **passa a vuoto**.
>
> ### Prompt di apertura della PROSSIMA sessione
>
> In fondo a questo file, §«PROMPT PER LA PROSSIMA SESSIONE».
>
> ---
>
> ### (Sessione precedente, 2026-08-01)
>
> ### Cosa è stato fatto (2026-08-01)
>
> **Prima cosa: la verifica funzionale della #47, e il buco che ha scoperto.** L'antieffrazione
> esce davvero — sul catalogo reale importato dal listino vero (7.488 prodotti) e **dal wizard**,
> con Chromium: **17 righe / 22 pezzi / 110,13 €, zero warning**. Ma `110,13 €` **non era
> asserito da nessun test**: il test del modulo conta righe e pezzi e **non vede i prezzi affatto**
> (i moduli restituiscono `KitLine` senza prezzo, che il motore risolve dopo contro il catalogo),
> quindi il numero viveva solo nei `.md` — una fotografia, che il giorno in cui AGB cambia un
> prezzo resta identica e sbagliata.
>
> **Poi la feature: le varianti si cambiano dopo la creazione.** Prima si rifaceva il wizard da
> capo. Ora sulla scheda c'è **«Modifica componenti»**, che riapre il wizard precompilato sulla
> richiesta; al conferma nasce una **nuova versione** con le varianti scelte.
>
> ### Le tre decisioni, e perché
>
> **1. Solo il passo «Componenti» è editabile** (verdetto `/llm-council`, 5 advisor su 5 + 3 peer
> review). Non è prudenza, è il tipo: `ricalcola({id, variants?})` **congela la geometria nella
> firma**, quindi lo spazio rappresentabile resta (geometria immutata) × (varianti valide per
> quella geometria) e la combinazione mai validata diventa **irrappresentabile**, non
> «sconsigliata». Le due alternative — un diff che decide fra versione e richiesta nuova, e
> `ricalcola` che accetta l'intera `specs` — aprivano un **secondo percorso di scrittura** su
> `specs`, che l'unione discriminata e `from-request.ts` esistono per impedire.
>
> **2. `{}` è il reset, e non è un valore inventato.** Le cinque chiavi erano già tutte
> `.optional()` dentro uno `.strict()`: `{}` era già valido e già significava «nessuna variante».
> Dichiararlo nel contratto è ciò che impedisce all'operazione di essere **a senso unico** —
> altrimenti si accende l'antieffrazione e non la si spegne più. Si normalizza a `NULL` in
> scrittura, perché `{}` sulla colonna sarebbe uno standard materializzato dove una richiesta
> identica creata da zero scrive `NULL`.
>
> **3. L'idratazione del wizard passa da `kitInputFromRequest`**, la stessa funzione del motore.
> È il rilievo più importante del council, ed era fuori dalle tre opzioni: un prefill che
> rileggesse le colonne per conto suo sarebbe una **seconda ricostruzione**, e se divergesse
> l'agente vedrebbe a schermo una configurazione che la riga non codifica e la confermerebbe —
> senza che alcun test se ne accorga, perché non ci sarebbe niente da confrontare. Possibile
> perché **solo `engine.ts` porta `server-only`**. Corollario: il test «prefill === fromRequest»
> che la spec chiedeva **non serve**, perché non esistono due funzioni che possano divergere.
>
> ### Difetti trovati dai test mentre scrivevo, non dopo
>
> - **`variantiFinali ?? request.variants` faceva ricadere il RESET sull'ereditarietà**, perché
>   `??` tratta `null` come nullish: `undefined` (eredita) e `null` (resetta) vanno distinti alla
>   lettera. Senza il test su `{}` sarebbe finito in produzione, e spegnere l'antieffrazione non
>   avrebbe fatto nulla **in silenzio**.
> - La guardia sulla riga superata girava **dopo** la validazione: una riga già condannata
>   attraversava il motore per un esito impossibile. Salita sopra, e la vecchia copia **rimossa**
>   invece di lasciarne due.
> - La rinomina «Ricalcola» → «Nuova versione» era **a metà**: due stringhe visibili all'agente
>   (l'empty-state della distinta e il messaggio di `CONFLICT` di `kit.generate`) nominavano
>   ancora il pulsante vecchio, mandandolo a cercare qualcosa che non c'è più.
>
> ### Quattro difetti trovati dalla review di branch, tutti corretti
>
> Nessuno dei quattro sarebbe stato visto dai gate: erano tutti verdi.
>
> 1. 🔴 **Un refetch di `kit.get` cancellava le varianti appena scelte.** `kit.get` restituisce
>    campi `Date`, e lo structural sharing di react-query **non regge sulle Date**: con due
>    payload identici che ne contengono una, `replaceEqualDeep` restituisce un oggetto **nuovo**
>    (verificato eseguendolo). Il `QueryClient` è `new QueryClient()` nudo → `staleTime: 0` e
>    `refetchOnWindowFocus: true`: bastava cambiare finestra e tornare. Il form veniva riscritto,
>    la scelta spariva **in silenzio**, e «Genera nuova versione» avrebbe emesso una versione
>    identica alla precedente consumando un numero e congelando l'originale per niente. Ora
>    l'idratazione avviene **una volta sola**.
> 2. 🔴 **La validazione copriva solo il ramo con `variants`.** Il pulsante «Nuova versione»
>    chiama `ricalcola` **senza**, quindi su una riga emessa che il motore rifiuta (una COMPLETED
>    PVC o battente) si creava la versione, si marcava la vecchia superata, e solo dopo `generate`
>    falliva: **due righe morte**. Ora si valida ogni volta che si sta per **scrivere**; la bozza
>    senza varianti resta il no-op storico.
> 3. **Su una bozza la UI prometteva una versione che non nasce.** Il router scrive in loco e
>    restituisce lo stesso id, ma la scheda diceva «nascerà una nuova versione… e questa smetterà
>    di valere» e il pulsante era «Genera nuova versione». È la stessa bugia per cui «Ricalcola» è
>    stato rinominato. Ora su bozza dice «È una bozza: al conferma la distinta viene rifatta qui»
>    e il pulsante è «Rigenera la distinta».
> 4. **La vasistas passava il filtro ma non ha varianti.** `puoModificareComponenti` escludeva
>    solo TOUR, ma la vasistas è ARTECH e il suo modulo dichiara `varianti: []`: il link portava a
>    una schermata senza scelte e il conferma creava comunque una versione. Ora si filtra sulla
>    **tipologia** (`TIPOLOGIE_CON_VARIANTI` in `artech-varianti.ts`), e un test in
>    `registry.test.ts` fa fallire la build se un modulo comincia o smette di dichiarare varianti.
>
> Più due minori: un `?da=` non caricabile lasciava la pagina a **pulsare all'infinito** senza
> messaggio, e il link in testa in modifica tornava all'elenco invece che alla richiesta.
>
> **Conseguenza onesta sui test esistenti:** `ricalcola` ora esegue davvero il motore, quindi
> cinque test che arrivano alla scrittura hanno bisogno di template e prodotti — prima passavano
> perché il motore non veniva invocato. E il fixture di «copia tutti i campi» era una **vasistas
> con sede 30 ed entrata 7,5**, cioè una riga **non generabile**: non è più versionabile, ed è il
> comportamento voluto.
>
> ### Il ciclo di import, di nuovo — e chiuso di nuovo
>
> `ComponentiRibalta` usa `RadioOption`, che viveva nel wizard: estrarre solo la prima avrebbe
> chiuso un ciclo **wizard → componenti → wizard**, la stessa forma del ciclo di valori della #47.
> `RadioOption` è uscita insieme, in `src/components/kit/radio-option.tsx`.
>
> ### I numeri
>
> | | |
> |---|---|
> | Golden | **16 righe / 21 pezzi / 90,20 €** — invariato |
> | Gemello entrata 7,5 | **96,29 €** — invariato |
> | Antieffrazione | **17 / 22 / 110,13 €** — ora **asserito** sul catalogo reale |
> | Bilico TOUR | **450,03 · 766,51 · 433,46 €** — erano `toBeGreaterThan(0)`, ora esatti |
> | Test | 996 → **1.035** · build 18 route |
> | Gate su catalogo reale | **112 test eseguiti**, non skippati |
> | Browser | **22/22 desktop · 22/22 a 375px** (rifatto dopo i fix della review) |
>
> La verifica browser ha percorso il **ciclo intero**: 90,20 € → «Modifica componenti» →
> antieffrazione → **110,13 € su un numero nuovo**, la vecchia marcata come ricalcolata → di nuovo
> «Modifica componenti» → «Normale» → **ritorno a 90,20 €**. È la prova che il reset funziona, cioè
> che l'operazione è reversibile.
>
> ### 🟢 Azioni ops: NESSUNA
>
> Nessuna migrazione (la colonna `variants` esiste dalla #47 ed è su Neon), nessun re-import
> (nessun codice nuovo), nessun seed. Si merge e basta.
>
> ### Debito noto residuo
>
> - **Le tre distinte reali: ANCORA NO.** Sesta sessione. Vale più di tutto il resto: senza,
>   `corsa = altezza − 420` resta una retta tirata per un punto solo, e ora anche le **varianti**
>   (quale squadra angolare ordinano davvero MC, Peruzzi e Fosca? quale incontro ribalta?) restano
>   non confrontate. Basta una foto di un ordine vero, purché con **altezza diversa da 1820**.
> - **`requestNumber` con `count()+1`** → domanda **31** e la nota tecnica nei debiti sopra.
> - **`no-silent-fields.test.ts`: `CASI` non è legato a `RULE_MODULES`** (le varianti sì).
> - **`dedupeRows` last-wins** in `map-product.ts`.
> - **Le preview di Vercel falliscono su OGNI PR** — ipotesi mai smentita: env solo per
>   *Production* e non per *Preview*. Nessun codice da scrivere, ma una preview che non parte è un
>   collaudo che non hai.
> - **«Visualizza nel listino» per singola opzione: ancora OMESSO** (un `<button>` dentro il
>   `<label>` di `RadioOption` è HTML non valido). Ora che `RadioOption` è un file suo, spezzarla
>   costa meno.
>
> ### Lezioni operative nuove
>
> - **`??` non distingue `null` da `undefined`**, e in un contratto dove i due significano cose
>   opposte («resetta» contro «eredita») è un difetto silenzioso. Distinguerli alla lettera.
> - **Una rinomina di etichetta va cercata in tutto il codice**, messaggi d'errore del router
>   compresi: `grep «NomeVecchio»` prima di dire fatto.
> - **Postgres in questo container muore da solo**: se un test gated risulta «skippato» senza
>   ragione, controllare `docker ps` prima di sospettare la variabile d'ambiente. È costato dieci
>   minuti oggi.
> - **Lo structural sharing di react-query non regge sulle `Date`.** Qualunque `useEffect` che
>   idrati uno stato locale da una query il cui payload contiene una `Date` va reso **idempotente**
>   (un `useRef`), altrimenti un refetch — e con `staleTime: 0` + `refetchOnWindowFocus` basta un
>   cambio di finestra — riscrive ciò che l'utente ha appena fatto, **in silenzio**. Vale per ogni
>   schermata futura che precompili un form da `kit.get` o simili.
> - **Il `QueryClient` del progetto è `new QueryClient()` nudo** (`src/trpc/react.tsx`): nessun
>   `staleTime`, nessun `refetchOnWindowFocus: false`. Va saputo prima di scrivere una UI che tiene
>   stato locale accanto a una query.
> - **Una review di branch trova cose che i gate verdi non vedono.** Quattro difetti reali su un
>   branch con typecheck, lint, 1.029 test e browser 22/22. Vale la mezz'ora, ogni volta.
>
> ### Prompt di apertura della PROSSIMA sessione
>
> Sta in fondo a questo file, §«PROMPT PER LA PROSSIMA SESSIONE».
>
> ---
>
> ### (Sessione precedente, 2026-07-31)

>
> ### Cosa è stato fatto (2026-07-31) — passo «Componenti», PR DA APRIRE
>
> L'utente ha chiesto l'**antieffrazione** per l'anta-ribalta. Preparandola erano emerse due
> domande a cui **il listino non risponde** — il «nottolino a fungo» va su serramenti sede 30?
> gli incontri si ordinano a viti inclinate o dritte? — e la risposta dell'utente ha
> riorientato il lavoro:
>
> > «Non saprei risponderti. Posso solo dirti che secondo me ha senso aggiungere una sezione
> > finale nel wizard, per decidere e far scegliere in modo semplice e visivo, quando ci sono
> > più scelte per uno o più componenti che non dipendono dallo schema dello sviluppo del kit
> > ma da una scelta personale (dell'agente o del cliente).»
>
> Le due domande sono state quindi **risolte non rispondendole**: sono diventate **scelte nella
> UI**. È la settima volta che questo progetto incontra lo stesso difetto — `openingDir` mai
> letto, l'entrata cablata, la geometria cablata, `PILOT_GEOMETRY` ignorata, il default
> `A12_I13_B20` nel wizard — cioè **una decisione che il motore prende da sé e non dichiara**.
> Le prime sei sono state chiuse una alla volta; questa chiude la classe.
>
> **Cosa vede l'agente** (passo 4 del wizard, solo ARTECH anta-ribalta legno): «Sicurezza»
> sempre visibile (Normale / Antieffrazione), con **«Cosa cambia»** — vecchio codice → nuovo, e
> il Δ unitario; «Modifica le tre scelte» per ordinare un solo componente; «Altre varianti»
> (squadra angolare, incontro ribalta) dietro un pannello, **aperto d'ufficio se qualcosa è già
> fuori standard**. Ogni opzione mostra **codice, nome a catalogo, prezzo e differenza**.
>
> **Due domande CHIUSE**: la **2** (squadra angolare) e la **30** (antieffrazione). Non
> rispondendole: mostrando le opzioni che il listino pubblica per quella geometria. Vedi
> `kit-assunzioni/DOMANDE-APERTE.md`, che spiega *come* sono state chiuse e cosa resterebbe da
> sapere (la risposta di merito sposterebbe il **default**, non i codici disponibili).
>
> **Il «fungo» resta fuori, ed è una collocazione, non una rinuncia:** `A50320.02.01` sta nel
> capitolo Movimenti Angolari (quindi *sostituisce* un movimento angolare) ed è legato alla
> **sede 30 nei due versi** — NB a `p0435 (433)` e nota `(**)` stampata solo sulle righe `13x30`
> a `p0469 (467)`. La sede 30 il motore la rifiuta a monte: è una **famiglia di schemi diversa**.
> Entrerà con la **domanda 4**.
>
> **Fatto nuovo e dimostrato:** per l'**aria 4** il listino pubblica **solo le viti inclinate**,
> quindi per **MC e Peruzzi le dritte non compaiono affatto** — non disabilitate, assenti.
>
> ### 🔴 AZIONE OPS — una sola, e va lanciata PRIMA del merge
>
> **Migrazione `20260731143758_kit_variants`**, e contiene **solo**:
>
> ```sql
> ALTER TABLE "kit_requests" ADD COLUMN "variants" JSONB;
> ```
>
> Nessun backfill, nessun `@default` a DB: **`NULL` = «lo standard del programma»**, che è
> esattamente ciò che ogni riga esistente ha oggi. Stesso criterio di `seatConfig`, `entrata`,
> `discountPercent`.
>
> **Lanciare «Ops — Neon» sul ref del branch, prima del merge** (il workflow accetta
> `workflow_dispatch` su un ref qualunque: è così che la #44 ha avuto disservizio **zero**).
> Motivo verificato nel codice, non per prudenza: `kit.get`, `kit.generate` e `kit.ricalcola`
> leggono la richiesta con **`findFirst` senza `select`**, quindi Prisma chiede a Postgres
> **tutte** le colonne del modello — inclusa `variants`. Fra il deploy e la migrazione
> fallirebbero le **letture** delle richieste esistenti, non solo le creazioni: è alla lettera
> l'incidente della PR #40, venti minuti di produzione rotta.
>
> **E il raggio è più largo di «le richieste».** `src/server/api/routers/dashboard.ts:40` fa
> `ctx.db.kitRequest.findMany({ … })` **senza `select`** (ha solo un `include` per il cliente):
> Prisma chiede anche lì tutte le colonne, `variants` compresa. Fra deploy e migrazione si rompe
> quindi **anche `dashboard.overview`**, cioè **la pagina d'ingresso di tutti e dieci gli
> agenti** — non una schermata di dettaglio in cui capita di entrare. L'azione non cambia (run
> «Ops — Neon» sul ref del branch **prima** del merge), ma chi legge «solo le richieste» può
> convincersi che qualche minuto di scarto sia tollerabile: non lo è.
>
> **NIENTE re-import del catalogo.** I **74 codici** del registro varianti sono già tutti a
> catalogo con prezzo — non assunto: il gate `codici-a-listino.integration.test.ts` li conta
> (`expect(codici.size).toBe(74)`) e li verifica uno per uno sul DB reale, ed è verde.
>
> ### I numeri
>
> **Il golden NON si è mosso**: **16 righe / 21 pezzi / 90,20 €**, gemello entrata 7,5 a
> **96,29 €**. Novità di questa sessione: ora sono asseriti anche l'**ordine assoluto** delle
> righe e le **16 descrizioni carattere per carattere** — prima nessun test si sarebbe accorto
> di una riga spostata o di una descrizione riscritta.
>
> **Con l'antieffrazione completa** (movimento a due nottolini + incontri antieffrazione +
> piastrino) il golden diventa **17 righe / 22 pezzi / 110,13 €**, zero warning. Misurato sul
> catalogo reale importato, non stimato.
>
> ### La garanzia contro la variante inerte — due strati, nessuno dei due è «ricordarsi di»
>
> Il difetto pagato quattro volte da questo progetto è «campo raccolto, validato, persistito e
> **mai letto da nessun modulo**». Con cinque varianti dentro un blob JSON il rischio si
> moltiplica, perché per `no-silent-fields` **un blob è un campo**: mutarlo non equivale a
> mutare ogni variante.
>
> 1. **A runtime** — `RuleModule.varianti` è **obbligatorio** (`readonly VarianteId[]`, `[]` per
>    TOUR e vasistas): ogni modulo dichiara cosa consuma, e un modulo nuovo **non compila** senza
>    averci pensato. `engine.ts`, in un punto solo, **rifiuta** con `KitGenerationError` — col
>    nome della variante — una richiesta che ne porti una non dichiarata.
> 2. **Nei test** — `no-silent-fields.test.ts` deriva i casi **dalla dichiarazione del modulo**,
>    con una mutazione **per chiave**: una variante che smettesse di essere letta fa fallire il
>    test **col proprio nome**. Provato mutilando il modulo, non solo scritto.
>
> ### Il ciclo di import, che si vedeva solo a volte
>
> `artech-varianti.ts` (registro) e `types.ts` (input del motore) si importano già a vicenda.
> Mettere `variantiSchema` in uno dei due chiude un **ciclo di valori**: con certi ordini di
> caricamento della suite, `variantiSchema` risulta `undefined` mentre `artechInputSchema` sta
> già valutando `variantiSchema.optional()`, e il modulo **crasha a runtime**. Non un'ipotesi:
> riprodotto eseguendo la suite intera del kit.
>
> Sciolto con un **file foglia**, `src/server/kit/varianti-schema.ts` (solo `zod`, nessun import
> di progetto), **protetto da una regola ESLint** (`no-restricted-imports` sui pattern `./*` e
> `../*`, in `.eslintrc.json`) **provata nei due versi**: un import relativo lì dentro fallisce
> il lint, e senza la regola passa.
>
> ### Verifica browser
>
> **Chromium reale** (desktop 1440px e **375px**): **33 check** sulla prima versione e **10**
> sulla versione corretta, con gli **screenshot aperti e guardati** (in scratchpad
> `shots/`). È la lezione del progetto: i verdi non vedono ciò che si vede in un PNG.
>
> ### Due difetti trovati dalla review, e corretti
>
> 1. **La potatura al cambio geometria materializzava a DB uno standard.** Tornando al passo 3 e
>    cambiando geometria, una scelta che sulla **nuova** geometria È lo standard veniva
>    conservata e finiva nella colonna — mentre una richiesta identica creata da zero scrive
>    `NULL`. Due righe indistinguibili sul serramento, diverse a DB, e il giorno in cui il
>    default cambia si comportano diversamente.
> 2. **«Prezzo non a catalogo» affermato mentre la query stava ancora caricando.** È
>    un'affermazione **sul listino AGB** — la stessa classe di segnale che ha smascherato due
>    moduli con codici inesistenti — e al primo render è sempre falsa. Ora gli stati sono tre e
>    distinti (caricamento / errore di rete / assente dal catalogo), con un test per ciascuno.
>
> *(Coda dell'ultimo task: «Senza piastrino» non ha codice, quindi vale **zero per costruzione** e
> non deve dire «in caricamento»; e `isError` ora si **legge**, non si deduce da «non pending».)*
>
> ### Gate (tutti eseguiti su questo branch)
>
> | Gate | Esito |
> |---|---|
> | `pnpm typecheck` | ✅ |
> | `pnpm lint` | ✅ nessun warning |
> | `pnpm test` | ✅ **992 passati**, 117 skippati (i gated), 1109 totali |
> | `pnpm build` | ✅ 18 route |
> | integration su catalogo reale | ✅ **111 test eseguiti** (101 `codici-a-listino` + 10 `engine`), **non** skippati |
>
> Il gate su catalogo reale si lancia così — senza `INTEGRATION_DATABASE_URL` **passa a vuoto**:
>
> ```bash
> set -a; source .env; set +a
> INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm vitest run \
>   src/server/kit/codici-a-listino.integration.test.ts \
>   src/server/kit/engine.integration.test.ts
> ```
>
> ### Debito noto residuo
>
> - ✅ **CHIUSA il 2026-08-01** — «le varianti non si cambiano dopo la creazione»: ora si
>   cambiano, da «Modifica componenti» sulla scheda. Vedi la sessione in testa.
> - ✅ **CHIUSA il 2026-08-01** — l'estrazione di `ComponentiRibalta`: `nuova-client.tsx` è
>   passato da 1.983 a 1.383 righe.
> - 🆕 **`requestNumber` è coniato con `count() + 1`** su una colonna `@unique` (`kit.ts:47-50` e
>   `219-222`): due richieste create nello stesso istante collidono → errore all'agente, nessuna
>   corruzione, il riprova funziona. Portato al council il 2026-08-01 e tenuto **fuori** dalla PR.
>   Verificato allora che **non esiste** alcun `kitRequest.delete`/`deleteMany` e che nessuno dei
>   quattro `onDelete: Cascade` dello schema punta a `KitRequest`: lo scenario «il conteggio scende
>   e il numero successivo RIPETE uno già mandato a un cliente» **oggi non è raggiungibile**.
>   ⚠️ Il rimedio ovvio **non funziona**: un retry attorno alla `create` non basta, perché in
>   `ricalcola` il `count()` sta **fuori** dalla `$transaction` e la `create` dentro — un `P2002`
>   aborta l'intero callback, `updateMany` compreso. La domanda a monte («il numero identifica la
>   richiesta o la versione?») è la **31** in `DOMANDE-APERTE.md`, e la decide l'ufficio
>   commerciale.
> - 🆕 **«Visualizza nel listino» per singola opzione: OMESSO.** Un `<button>` dentro il
>   `<label>` di `RadioOption` è **HTML non valido** e ruberebbe il clic alla radio; servirebbe
>   spezzare `RadioOption` (anchor overlay + fratello z-index, come le card dell'archivio).
> - **`dedupeRows` last-wins** in `map-product.ts` (`T18001.02.93` ha `listinoPage` 561 invece di
>   551 → «Visualizza nel listino» apre la pagina sbagliata; prezzo non affetto).
> - **Le preview di Vercel falliscono su OGNI PR** — verificato su #39-#42. Ipotesi mai smentita:
>   le env sono configurate solo per *Production* e non per *Preview*, e `src/env.ts` valida con
>   zod e muore al primo `parseEnv`. **Nessun codice da scrivere**, ma una preview che non parte è
>   un collaudo che non hai.
> - **`no-silent-fields.test.ts`: `CASI` non è legato a `RULE_MODULES`.** Le **varianti** ora sì
>   (si derivano dal modulo), i campi di primo livello no: il giorno che battente o PVC si
>   riaccendono la garanzia non li segue e nulla lo dice.
> - Il form cabla ancora `seatConfig`, `openingSide`, `widthMm 550`, `heightMm 1820`. Le quote sono
>   innocue (si digitano sempre); `seatConfig` ha oggi un solo valore ammesso dai moduli, quindi
>   non può sbagliare in silenzio.
>
> ### Le tre distinte reali: ANCORA NO
>
> **Quinta sessione** che la domanda resta aperta, ed è la cosa che vale di più: senza, i tre
> clienti principali ricevono distinte che nessuno ha mai confrontato con un ordine vero, e
> `corsa = altezza − 420` resta **una retta tirata per un punto solo**. Basta una foto, purché con
> **altezza diversa da 1820**. I tre clienti sono già in anagrafica su Neon con la loro geometria:
> aprire `/richieste/nuova`, scegliere il cliente, «Usa il profilo», generare, e mettere la
> distinta a fianco della foto dell'ordine.
>
> ### Lezioni operative da non riscoprire
>
> - **Pagina fisica = stampata + 2.** Citare sempre «fisica (stampata)».
> - **Le legende degli schemi sono immagini**: `pdftoppm -r 150 -png` e **guardarle**. I numeri
>   `1)…5)` delle tabelle incontri puntano dentro il disegno: senza renderizzare non si sa che
>   `9x18` esiste in **due corpi diversi**.
> - 🆕 **Un ciclo di import può manifestarsi solo con certi ordini di caricamento**: verde a file
>   singolo, rosso a suite intera. Se un `undefined` appare «a caso», sospettare il ciclo — e
>   chiuderlo con un file foglia **più una regola di lint**, perché il prossimo import relativo lo
>   riaprirebbe in silenzio.
> - 🆕 **Quando si aggiunge un campo a un blob JSON, la garanzia non si eredita**: per i test un
>   blob è **un campo solo**. Derivare i casi dalla dichiarazione del modulo, uno per chiave.
> - **`jest-dom` NON è configurato**: i soli matcher sono `toBeTruthy`/`toBeNull`/`.textContent`.
> - **Idiom dei test**: `nuova-client.test.tsx` usa `fireEvent`, i componenti `userEvent`,
>   **nessuno usa un wrapper** (tRPC mockata a livello di modulo).
> - **Guardare gli screenshot, non solo i verdi.**
> - **`INTEGRATION_DATABASE_URL` è obbligatoria**: senza, i gate passano **a vuoto**.
> - **Docker in questo container muore** se `dockerd` è avviato dentro uno script che poi esce:
>   `setsid nohup dockerd … & disown`, e ricontrollare prima di ogni comando che tocchi il DB.
> - **`poppler-utils` non è installato** di serie: `sudo apt-get install -y poppler-utils` prima
>   di `pnpm import:agb`.
> - **Ambiente**: `.env` va composto a mano (`.env.example` + var engine), con segreti veri.
>   Catalogo: `pnpm import:agb <listino.pdf>` (~15 min, 7.488 prodotti). Playwright non è in
>   `package.json`: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm add -D playwright`, e **rimuoverlo
>   prima del commit**. Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
>
> ### Prompt di apertura (STORICO — sessione 2026-07-31, superato)
>
> ```
> Nuova sessione. Riparti leggendo handoff.md (§«RIPRENDI DA QUI») e CLAUDE.md.
> Segui il workflow: /using-superpowers → brainstorming → /llm-council per dubbi o
> incongruenze sulle regole di distinta → /impeccable se tocchiamo UI (SEMPRE mobile
> ≤375px + desktop) → /writing-plans → esecuzione TDD; /ponytail per il codice.
> Vincoli CLAUDE.md: TS strict, API via tRPC/Prisma, UI in italiano, codici in mono,
> mobile-first, e soprattutto: il KIT È UN ENGINE DETERMINISTICO TypeScript, MAI un LLM.
>
> PRIMA DI TUTTO, verifica lo stato: il branch claude/antieffrazione-feature-dv8d37
> (antieffrazione + varianti componente) era completo e verificato ma NON pushato.
> Controlla se è stato pushato, se la PR è stata aperta e mergiata, e SOPRATTUTTO se
> è stato eseguito il run «Ops — Neon» con la migrazione 20260731143758_kit_variants:
> senza quella, in produzione falliscono le LETTURE delle richieste kit (findFirst
> senza select), non solo le creazioni. Verifica i run su GitHub, non fidarti di qui.
>
> Se tutto è a posto, le strade aperte sono:
>  (a) LE TRE DISTINTE REALI di MC, Peruzzi e Fosca — aperta da CINQUE sessioni, vale
>      più di tutto il resto: i tre clienti sono già in anagrafica, basta generare la
>      distinta e metterla a fianco della foto di un ordine vero (altezza ≠ 1820);
>  (b) domanda 29 (corpo incontro / perni di posizionamento) — richiede però prima la
>      domanda 20 sulle coperture;
>  (c) i debiti in handoff.md §«Debito noto residuo»: estrarre il passo «Componenti»
>      da nuova-client.tsx (1.979 righe), «Visualizza nel listino» per opzione,
>      dedupeRows last-wins, preview Vercel rotte su ogni PR.
>
> NON rompere il golden: 16 righe / 21 pezzi / 90,20 €, gemello entrata 7,5 a 96,29 €,
> e con antieffrazione completa 17 righe / 22 pezzi / 110,13 €. Il gate su catalogo
> reale li asserisce per davvero, insieme all'ordine delle righe e alle 16 descrizioni.
> ```
>
> ---
>

> **▶ STORICO — sessione 2026-07-30/31: PROFILO SERRAMENTO DEL CLIENTE + ANAGRAFICA ✅ — PR #44 + #45 MERGIATE, ops eseguite.**
>
> Il wizard chiedeva **geometria ed entrata a ogni richiesta**, fra 14 combinazioni, e sbagliarle
> non produce alcun errore: i codici dell'altra combinazione esistono, hanno un prezzo, nessun
> warning. Ora quelle due quote vivono **sul cliente** (due colonne nullable su `customers`,
> migrazione `20260730232026`, nessun backfill) e si applicano con **un clic esplicito**.
>
> **La UI l'ha decisa il `/llm-council`**, respingendo la proposta di precompilare: un valore che
> arriva da un profilo resta un valore che l'agente **non ha scelto in quel momento**, con in più
> un'etichetta che lo fa *sembrare* verificato. Sintesi adottata: **nessun prefill, un pulsante
> «Usa il profilo»**. Al passo 4 il riepilogo **constata** la divergenza dal profilo — il **primo
> rilevatore d'errore** che il sistema possieda.
>
> **Un difetto già in produzione, trovato dal council mentre rispondeva ad altro**:
> `nuova-client.tsx:57` cablava `geometry: "A12_I13_B20"` — **ogni nuovo ordine partiva con la
> geometria del cliente del golden**. Dieci test navigavano al riepilogo senza scegliere la
> geometria: erano la codifica del difetto, non la sua sentinella.
>
> La **#45** ha aggiunto il pulsante «Nuovo cliente» che mancava (una pagina «Clienti» da cui non
> si creavano clienti) e ha messo **MC, Peruzzi e Fosca nel seed** con `upsert`/`update: {}`:
> crea se manca, non tocca se c'è. Entrata e sconto restano **NULL** — l'entrata è la domanda 17.
>
> **Gate**: test **875** · browser 30/30 · **integration gated 100 casi** (erano 29: il gate
> fissava `widthMm: 550` e verificava 10 dei 40 codici braccio). **Ops eseguite** (run
> `30614027728` **quattordici minuti prima del merge**, dal ref del branch — prima volta con
> finestra di disservizio **zero** — e `30618326143`).
>
> ---
>

> **▶ STORICO — sessione 2026-07-30: SCONTISTICA CLIENTE ✅ — PR #42 MERGIATA, ops eseguite.**
>
> I totali mostravano il **lordo di listino AGB** — quello che paghiamo al fornitore — non quello
> che il cliente paga. Una sola colonna nuova (`KitRequest.discountPercent`, migrazione
> `20260730201437`, nessun backfill: NULL = comportamento storico); `totalPrice` **resta il lordo**
> e il netto è derivato, mai salvato — due totali a DB divergono al primo bug. Lo sconto vive
> **sulla richiesta** e non solo su `Customer`: se stesse solo lì, ritoccarlo cambierebbe in
> silenzio il totale di ogni distinta già mandata.
>
> **Gate**: test **843** · browser 40/40 · integration gated 38/38 · golden **90,20 €** e gemello
> **96,29 €** invariati. **Ops eseguite** (run `30583325831`, 21:41Z, 4/4 verdi).
>
> **Le tre cose che quella sessione ha scoperto, e che restano vere:**
>
> 1. **Il listino ha 34 classi di sconto**, e i nostri codici ne toccano due: ARTECH tutto **F3**,
>    TOUR tutto **T1**. Una percentuale unica per cliente li tratta uguali — scelta consapevole
>    (**domanda 28**), non svista: se lo sconto vero cambia per classe, il totale di un **bilico**
>    (433-766 €) è sbagliato di 20-38 € a serramento.
> 2. **`Customer` era un modello fantasma**: tabella a schema dal primo giorno, zero router, zero
>    CRUD, `customerId` **sempre NULL** in produzione. Le colonne a schema fanno risparmiare *una
>    migrazione*, non metà del lavoro — ricordarlo prima di stimare guardando lo schema.
> 3. **A 375px la tabella della distinta scorre in orizzontale**, e ci finiva dentro il piè con i
>    totali: sul telefono il numero per cui si apre la pagina era **fuori schermo**. Trovato da uno
>    **screenshot**, non da un'asserzione — che leggeva `innerText`, il quale include anche ciò che
>    sta fuori da un contenitore a scorrimento. **Guardare le immagini, non solo i verdi.**
>
> ---
>
> **▶ STORICO — sessione 2026-07-30: ENTRATA MANIGLIA ✅ — PR #40 MERGIATA, ops eseguite.**
>
> **Il difetto.** Il motore sceglieva la cremonese in **entrata 15** (`A50122.15.NN`) dalla Fase
> 1d, **cablata**, senza guardia — perché il campo **non esisteva nell'input**. Un serramento a
> entrata 7,5 riceveva **in silenzio** il codice della 15: esiste, ha un prezzo, nessun warning.
> Sul GR07 del golden vale **6,09 € su 90,20 €** (+38 % sulla riga).
>
> **L'handoff descriveva l'asse sbagliato.** Diceva «entrata 0, 8 e 15». A `p0424 (422)` la
> colonna ENTRATA è etichettata `1) 7,5` · `2) 15` · `3) Asta*`: `.08` è l'entrata **7,5**, e
> `.00` **non è un'entrata** ma la versione ad asta, «*senza DSS né monoblocco martellina*».
> Conferma trovata **nei dati** in revisione: il nome a catalogo di `A50122.08.07` è «per schema
> A **1) 7,5**».
>
> **Cosa c'è.** `entrata: "E75" | "E15"` sul ramo ARTECH, **ortogonale** a `geometry` (provato da
> un test: cambia SOLO la riga della cremonese) · **nessun valore preselezionato**, il passo 3
> non avanza senza · tabelle di **codici interi** per entrata · colonna `kit_requests.entrata`
> nullable + backfill `E15` sulle sole righe ARTECH · trasporto da **entrambe** le mutation
> (`create` **e** `ricalcola`) · rilettura **senza fallback** in `from-request` · **vasistas
> rifiuta** l'entrata 7,5 citando le due NB di `p0426 (424)` (le forbici spariscono su 4 GR su 6
> e il listino non dice cosa metterci), e il wizard **la disabilita** invece di lasciarla
> scegliere e fallire dopo · battente: `p0429 (427)` pubblica una sola entrata, quindi lì l'asse
> non esiste (solo un commento, nessuna guardia: `generate` solleva già).
>
> **Il buco che aveva lasciato passare il bug è chiuso.** `no-silent-fields.test.ts` mutava ogni
> campo, ma le liste `mutazioni`/`inerti` erano **scritte a mano** e nulla verificava che
> coprissero lo schema. Ora un campo non dichiarato fa fallire il test **col proprio nome**. Ha
> pagato subito: ha scovato che il modulo vasistas ignora `supplementaryClosures` (legittimo,
> ora dichiarato con la ragione).
>
> **Gate:** typecheck · lint puliti · **748 test** (erano 709) · build verde · **gate su catalogo
> reale 29 casi** (28 combinazioni geometria × mano × entrata + 18 codici cremonese su 9 bande) ·
> **browser 375 px e desktop**, 16 screenshot.
>
> **Distinte reali** (catalogo importato, 7.488 prodotti), 550×1820 SX ARGENTO chiusure ON:
> entrata 15 → **16 righe / 21 pezzi / 90,20 €** (golden invariato) · entrata 7,5 → **16 / 21 /
> 96,29 €**, cremonese `A50122.08.07`, zero warning.
>
> **Cinque difetti intercettati dalle review**, che sarebbero arrivati in produzione:
> (1) `kit.ricalcola` non copiava `entrata` → ogni ricalcolo avrebbe prodotto una riga rifiutata;
> (2) un test verde che **non raggiungeva più la schermata** che dichiarava di verificare, salvato
> da una coincidenza di testo; (3) il gate esercitava **1 codice nuovo su 9**; (4) mancava del
> tutto il test sul trasporto in `kit.create` (cancellando la riga del router la suite restava
> verde); (5) la domanda 17 conservava la premessa **smontata da questa stessa sessione**, proprio
> nella frase destinata all'agente esperto. **Tre erano lacune del piano, non degli implementer.**
>
> **AZIONI OPS — ESEGUITE** (run `30572337032`, 19:11Z, 12/12 verdi): migrate
> `20260730160444_kit_entrata` + import + seed + embed.
>
> ⚠️ **Ma con venti minuti di disservizio.** Il merge è delle 18:33Z, la migrazione delle 18:53Z:
> in mezzo la produzione ha risposto **500 su ogni scheda richiesta e su ogni creazione**, perché
> `kit.get` fa `findFirst` senza `select` e Prisma selezionava una colonna che a Neon non c'era.
> L'ho previsto e scritto nella PR, nell'handoff e nel messaggio di chiusura — e non è servito a
> niente, perché **scriverlo non è lanciarlo**. È stato l'utente a scoprirlo provando l'app.
> Regola per la prossima volta: la migrazione parte **nella stessa finestra del merge**, e chi
> mergia lo sa perché gliel'ha detto qualcuno, non perché è scritto in un documento.
>
> Spec/piano: `docs/superpowers/{specs,plans}/2026-07-30-kit-entrata*`.
>
> ---
>
> **▶ STORICO — sessione 2026-07-29: SETTE GEOMETRIE REALI ✅ — PR #38 + #39 MERGIATE.**
>
> *(Sessione che non aveva aggiornato l'handoff; ricostruita dal corpo della PR #39.)*
>
> Un agente, intervistato, disse che il generatore **non era funzionale**: verificato eseguendo il
> codice, i suoi **tre clienti principali venivano tutti rifiutati** — MC (aria 4 · interasse
> **8,5** · battuta 15, respinto da zod perché 8,5 non è intero), Peruzzi (aria 4 · interasse 9 ·
> battuta 18) e Fosca (aria 12 · interasse 13 · battuta **18**). Il motore copriva una **quarta**
> combinazione che nessuno dei tre ordina.
>
> **Causa radice: due quote, un nome.** A `p0474 (472)` AGB pubblica due tabelle adiacenti, stessa
> pagina, stesse famiglie, intitolate «sede telaio 18/24/30» e «BATTUTA 18/20/24/30». Sono la
> stessa quota. Quindi «battuta» a listino indica **due grandezze diverse**: la battuta dell'anta
> (15/18/20 → famiglie `.22`/`.24`/`.26`/`.34`/`.36`) e la sede telaio (18/20/24/30 → `.05`/`.12`/
> `.CR`/`.MN`). L'agente dice «battuta 15 o 18» e intende la prima; non nomina mai la sede perché
> nelle tabelle che consulta non si chiama così.
>
> **Cosa entrò:** `geometry: ArtechGeometry` (7 valori) + `seatConfig` al posto di quattro campi
> numerici liberi · la **sede derivata** e mostrata, non più chiesta · tabelle di **codici interi**
> (`A50904.22` **non esiste**: comporlo avrebbe prodotto un codice plausibile e inesistente) ·
> **ricalcolo versionato** (una distinta emessa non si riscrive: se ne crea una nuova versione,
> garantito nel **router**) · un **gate su catalogo reale** (14 combinazioni, 63 codici).
> `SEDE_30` e `SEDE_20` mostrate e **disabilitate** con la ragione. Test **709**.
>
> ---
>
> **▶ STORICO — sessioni 2026-07-27 e precedenti: perfezionamento anta-ribalta (PR #37).**
>
> La PR #37 corresse il campo «Sede»: un agente esperto non aveva saputo dire cosa fosse, perché
> il listino chiama la stessa quota «sede telaio» nei titoli degli schemi e **secondo numero del
> token ASSE** (`9x18`, `13x24`, `13x30`) nelle tabelle degli incontri. Fix: etichetta «Sede
> telaio» + hint col formato, e `seatMm` da max 22 a **max 30** (il 22 tagliava fuori la sede 30,
> quella di *tutti* gli schemi base 2026).
>
> Il piano che seguì — «perfezionare l'anta-ribalta» — è stato **completato dalle due sessioni
> successive**: la copertura di battuta 18 / sede 30 e delle altre geometrie dalla PR #39,
> l'**entrata** (il «quinto parametro mai notato») dalla PR #40. Resta di quel piano il confronto
> voce-per-voce fra lo schema `p0406 (404)` — **22 voci** — e le **16 posizioni** emesse: sei senza
> corrispondenza (2 DSS · 9 doppio nottolino a fungo · 17 microventilazione · 19-20 spessori di
> sollevamento · 22 copertura incontro). È la **domanda 20** in `DOMANDE-APERTE.md`.
>
> ---
>
> **▶ STORICO — sessione 2026-07-26: BILICO RETTANGOLARE TOUR ✅ — PR #35 + #36 MERGIATE, ops eseguite.**
>
> **Gate:** `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ **659 passed / 15 skipped** (erano 589:
> **+70 test**) · `pnpm build` ✅ 17 route · **integration gated 9/9 sul catalogo reale** ·
> **browser 50/50** (Chromium desktop 1440×900 + **375px**, 14 screenshot).
>
> **LA SCOPERTA CHE HA SEMPLIFICATO TUTTO.** Il bilico non è una distinta di componenti sciolti: le
> legende «Componenti» degli schemi generici `p0536 (534)` e `p0537 (535)` raggruppano tutto in
> **quattro kit ordinabili** (A elementi orizzontali — che contiene anche **la cremonese** —, B
> movimenti angolari, C cerniere, D incontri) più le **due aste verticali**. Quelle legende stanno
> **dentro il disegno**: con `pdftotext` non si vedono, vanno lette renderizzando la pagina.
> La tabella di `p0538 (536)` è la **composizione** dei kit, non una lista d'ordine — provato con
> l'aritmetica: kit incontri 3 lati 43,95 € contro 44,12 € di contenuto dichiarato; 4 lati 68,70
> contro 68,96.
>
> **PERCHÉ NASCE ATTIVO E IL PVC NO.** **61 codici su 61 esistono a listino con prezzo**, verificati
> applicando all'intero PDF la **firma di riga del parser reale** (non un grep). Il totale dei codici
> prezzati è **7.488**, identico all'import su Neon → i codici TOUR **erano già a catalogo**.
>
> **L'INPUT È DIVENTATO UN'UNIONE DISCRIMINATA su `series`** — e non è stile. `kit.create` riversa
> nella riga ogni campo dell'input parsato e `kit.generate` **ricostruisce l'input del motore
> rileggendo quelle colonne** (`kit.ts:53-69`): **la riga a DB è l'input di ogni rigenerazione**.
> Campi solo `.optional()` non sarebbero bastati — il `DEFAULT_FORM` è piatto e ha `airGapMm: 12`
> cablato, quindi ogni riga bilico sarebbe nata con la geometria ARTECH addosso *come input vero*:
> la bonifica riaperta, spostata dal motore alla persistenza. Con l'unione zod **scarta** i campi
> estranei al ramo (verificato su zod 3.25.76) e tRPC consegna l'output parsato → impossibilità
> strutturale, non una guardia da ricordarsi.
>
> **DECISO CON `/llm-council`** (5 advisor + peer review + chairman, con verifica diretta nel repo).
> Due affermazioni del council sono state **verificate e una smentita**: `z.discriminatedUnion` non
> ha davvero `.pick()` (ma `union.options[i].pick()` sì → i rami estendono un oggetto comune); ed è
> **falso** che «`finish` free-text sia lo stesso bug latente» — `requireKey` solleva. Il difetto
> vero è `FINISH_OPTIONS` lato client tenuto in sincrono **da un commento**: per il TOUR è risolto
> importando `FINITURE_TOUR` dal modulo regole.
>
> **RILIEVO TROVATO DAL TEST DI MUTAZIONE:** **`openingDir` (Tirare/Spingere) è raccolto dal wizard,
> validato, persistito, e NESSUN modulo lo legge.** È la stessa classe di bug della bonifica,
> sopravvissuta perché la guardia copriva i soli 4 campi geometria. Oggi è **dichiarato inerte** con
> la ragione nel test; la correzione tocca il ramo ARTECH → **domanda 16**, non fatta.
>
> **DISTINTE REALI** (catalogo importato in locale, 7.488 prodotti, prezzi veri):
> 3 lati schema 2 700×900 marrone → **7 righe / 18 pezzi / 450,03 €**, zero warning ·
> 4 lati schema 5 1500×1600 cromato → **9 righe / 20 pezzi / 766,51 €** ·
> schema 3 (con spessori) → **8 righe / 433,46 €**. Rifiuti corretti: PVC, finitura fuori listino,
> peso oltre portata, altezza sotto il minimo.
>
> **UI.** Wizard ramificato per serie. Lo **schema di montaggio è il campo più pericoloso del
> flusso** — sbagliarlo dà una distinta completa, plausibile e sbagliata — quindi le radio non sono
> numeri nudi: ognuna porta **listello · asse · battuta — modello cerniera, portata**, cioè i dati
> che il serramentista legge sul disegno. Superficie e ferramenta 3/4 lati sono **echeggiate già al
> passo delle quote**. La scheda dettaglio mostra le specifiche del ramo giusto.
>
> **✅ AZIONI OPS — ESEGUITE** (run `30207287069`, 2026-07-26 15:12Z, 12/12 step verdi)
> 1. **`migrate deploy`** → `20260726120000_kit_bilico_tour` (valore enum `BILICO`; le 6 colonne
>    geometria/mano diventano nullable; nuova `kit_requests.tour_schema`). **Nessuna riga esistente
>    viene toccata**: sono tutte ARTECH e restano valorizzate.
> 2. **`db:seed:kit`** → crea il template `TOUR bilico rettangolare legno` (senza, il motore non
>    trova template attivo e rifiuta).
>
> È stato lanciato un run completo, quindi sono passati anche `import:agb` (7.488 prodotti, invariati) ed
> `embed:products` («niente da fare: tutti i prodotti hanno già l'embedding»). Non erano necessari.
>
> **Resta solo la verifica funzionale in produzione**, due minuti: bilico 700×900 schema 2 marrone →
> **7 righe / 450,03 € / zero warning**; anta-ribalta 550×1820 SX argento chiusure ON → deve restare
> **16 righe / 21 pezzi / 90,20 €** (è il canarino del re-import).
>
> **RESTA APERTO, non fatto di proposito**
> - **Audit `kit_requests`** e **domande ad AGB**: entrambi ancora da fare, ma ora sono *pronti da
>   usare* → `docs/superpowers/kit-assunzioni/DA-FARE-audit-e-domande-agb.md` (query SQL da
>   incollare + mail già scritta con tutte e 15 le domande).
> - **Fix `dedupeRows`** last-wins in `map-product.ts` (opzione F). Confermato dal vivo su questa
>   sessione: `T18001.02.93` è a DB con `listinoPage` **561** (bilico *tondo*) invece di 551 →
>   «Visualizza nel listino» apre la pagina sbagliata. **Prezzo identico, totale non affetto.**
> - **Domanda 16** (`openingDir` inutilizzato), gate CI «ogni codice emettibile è prezzato»,
>   disegno dello schema nel wizard invece del solo numero, stamp dell'edizione di catalogo.
>
> ---
>
>
> **▶ STORICO — sessione 2026-07-25 (mattina): CHAT ASSISTENTE riscritta ✅ — PR #32 MERGIATA in `main`.**
>
> **Branch:** `claude/assistant-chat-streaming-mobile-1apei1` — 20 commit da `origin/main` @ `5c143ee`.
> **Gate:** `pnpm typecheck` · `pnpm lint` · `pnpm test` **518 passed / 9 skipped** — tutti verdi.
> **Verifica browser:** **13/13 PASS** (Chromium desktop 1440×900 + **mobile 375×667** + viewport corto ~375×420
> per la tastiera). 17 screenshot. Streaming verificato **intercettando la rotta SSE** con un flusso preconfezionato
> (nessuna `GEMINI_API_KEY` in questo ambiente); conversazioni CRUD verificate contro il **DB reale**.
>
> **COSA È STATO FATTO (12 task SDD: implementer + reviewer per ciascuno)**
> - **Streaming SSE end-to-end**: `GeminiChatProvider.chatStream` (`:streamGenerateContent?alt=sse`, parser
>   frame-safe con `eventsource-parser`) → `AIGateway.chatStream` (rate-limit + breaker, **niente fallback né
>   retry**: con un solo provider un retry a metà stream duplicherebbe i token) → `ChatService.generateStream`
>   (tool-loop **cap 3 round** per il limite 60s di Vercel; eventi `tool|delta|done|error`; persistenza **una sola
>   volta**) → route `POST /api/chat/stream` (Better Auth, ownership, header anti-buffering, `maxDuration=60`) →
>   hook `useChatStream` (batch `rAF`, **STOP**, unica deroga «no fetch» confinata lì).
> - **Gemini-only**: provider Kimi/Moonshot rimosso ovunque (codice, env, pannello key, test).
> - **Conversazioni**: `rename` · `delete` (soft → `DELETED`) · `archive` · `list({search})` · `get` con
>   **prodotti citati per-messaggio** (una sola query, no N+1). `send`/`retry` rimossi (il turno passa dalla route).
> - **UI (scelte utente su anteprima interattiva): A1 + B1** → risposte AI a **tutta larghezza** (niente bolla né
>   bordo sinistro colorato; `DESIGN.md` §Chat Message aggiornato) e **card prodotto inline** sotto la risposta
>   (niente pannello laterale né bottom-sheet). Markdown `react-markdown`+`remark-gfm` con plugin
>   `remark-agb-code` (codici AGB in mono anche dentro la prosa), code-block con copia, **href allowlist**
>   anti-XSS. Composer auto-grow **Invia↔STOP** + contatore + `safe-area`. Drawer conversazioni su mobile,
>   rail collassabile su desktop. `?c=<id>` in URL. Scroll intelligente + «scorri in fondo». Banner errore
>   con countdown `Retry-After` e auto-retry max 2.
>
> **BUG REALI INTERCETTATI DALLE REVIEW** (sarebbero arrivati in produzione):
> 1. lo **STOP dell'utente veniva contato come guasto del provider** → 5 stop in 60s aprivano il circuit breaker e
>    mettevano la chat offline **per tutti**; 2. errori `JSON.parse` **silenziati** nel parser SSE (un payload
>    troncato spariva senza traccia); 3. lo stopgap sulla vecchia UI **rompeva l'invio in silenzio**;
> 4. una **race** faceva riversare lo stream di una conversazione appena creata **dentro un'altra conversazione**.
>
> **DA FARE ALLA RIPRESA**
> 1. ~~Aprire la PR~~ → **fatta: PR #32 MERGIATA** in `main` @ `2216b3c` (è la base della sessione kit).
> 2. **AZIONI OPS: nessuna migrazione, nessun seed.** Unica cosa (non bloccante): rimuovere da Vercel le env
>    `KIMI_API_KEY` / `KIMI_MODEL` se presenti. La key Gemini resta.
> 3. **Verifica post-deploy con Gemini VERO**: in questo ambiente non c'era la key, quindi lo streaming è stato
>    verificato con SSE simulato. In produzione controllare: token progressivi reali, stati «Sto cercando nel
>    catalogo…», STOP che conserva il parziale, e il comportamento sotto **429** (banner + countdown).
> 4. **Follow-up minori** (non bloccanti, raccolti nel ledger `.superpowers/sdd/progress.md`): `ListinoButton` ha
>    touch target ~24px (<40px richiesti) — pre-esistente ma ora anche dentro le card inline; `aria-label`
>    «Copia codice» non univoco con più blocchi nello stesso messaggio; unmount dell'hook non annulla `abortRef`
>    (asimmetrico rispetto a `reset()`, benigno in React 19); mancano test per schema maiuscolo/`data:`/
>    protocol-relative su `sanitizeHref`.
> 5. **v2 rimandata esplicitamente**: feedback 👍/👎 e pin conversazioni (**richiedono migrazione**),
>    modifica-e-reinvia, resume/reconnect dello stream, riga `STREAMING` + sweeper, alert sul tasso di 429.
>
> **⚠️ VINCOLO ARCHITETTURALE DA NON VIOLARE**: `generateStream` **non ha `finally`** — persiste il messaggio sui
> propri percorsi normale/errore. La cancellazione deve avvenire **solo abortendo l'`AbortSignal`**: chiamare
> `.return()`/`.throw()` sul generatore (o cablare `ReadableStream.cancel()` a farlo) **salterebbe la scrittura in
> DB** e perderebbe la risposta parziale dell'utente.
>
> **⚠️ CONCENTRAZIONE VENDOR**: senza Kimi, un outage/429-storm Gemini degrada **chat E ricerca semantica**
> (l'embedding della query è live sulla stessa key/quota). Ricerca testuale e kit deterministico restano attivi.
> Il fix strutturale dei 429 ricorrenti è il **piano Gemini a pagamento**, non un secondo vendor.
>
> ---
>
> **▶ STORICO — sessione 2026-07-24: UX ARCHIVIO ✅ (PR #29 + #30 MERGIATE e in `main`).**
>
> **Core + primi extra (PR #29):** persistenza ricerca in **URL searchParams** (`useSearchParams` sotto `<Suspense>`,
> `router.replace(…,{scroll:false})`) + **vista** in `localStorage`; **ritorno-alla-lista con scroll** (snapshot
> `scrollY` per-chiave in `sessionStorage`, `history.scrollRestoration='manual'`, ripristino `rAF` post-dati;
> salvataggio su `pointerdown`+`pagehide`, MAI su scroll/unmount — bug scovato in verifica browser); **cronologia 7gg**
> (`product.recentSearches` read-side su `ActivityLog`); thumbnail (`ProductImage`+`fallback`, `ProductThumb`), chip
> filtri, empty-state. Critica adversariale 3-lenti recepita (spec §12). **Follow-up (PR #30):** scorciatoia `/`
> (`is-editable-target.ts`), «copia link», «visti di recente» (`localStorage`, `recently-viewed.ts`), pulsante listino
> su card/righe (stretched-link, `listinoPage` già in `product.search`). Gate verdi (**test 380**), verifica browser
> desktop+mobile ≤375px (12/12). **NESSUNA azione ops.** Spec/piani: `docs/superpowers/{specs,plans}/2026-07-24-archivio-ux*`.
> *(Nota processo: la #29 fu mergiata dall'utente mentre giravano i follow-up → i commit follow-up sono stati rebasati
> su `main` e aperti/mergiati come PR nuova #30, mai impilati su storia già mergiata.)*
>
> ---
>
> **▶ STORICO — sessione 2026-07-24 (mattina): IMMAGINI PRODOTTO ✅ (#27).** (dettagli sotto)
>
> **PROMPT DI APERTURA (l'utente lo incolla; qui per memoria):**
>
> > Miglioriamo la UX dell'**Archivio**. Tre cose:
> > 1. **Persistenza delle scelte di visualizzazione + della ricerca**: la modalità vista (lista compressa /
> >    griglia a riquadri), la query, i filtri e la pagina devono **sopravvivere al refresh** (ora si azzerano).
> > 2. **(La più importante) Ritorno alla lista dopo il dettaglio**: se cerco un prodotto (es. «cerniera»),
> >    ottengo una lista lunga; se apro un prodotto e poi torno indietro, **la ricerca si resetta** invece di
> >    riportarmi alla lista dov'ero (con la stessa posizione di scroll). Va risolto.
> > 3. **Cronologia ricerche settimanale per utente**: salvare le ricerche fatte da ciascun utente (finestra
> >    ~7 giorni) e mostrarle (es. «ricerche recenti») per riusarle.
> >
> > Poi fai uno **studio della situazione** e proponi altri miglioramenti UX sensati.
>
> **CONTESTO TECNICO GIÀ RICOGNITO (per non ripartire da zero):**
> - **File chiave**: `src/app/(dashboard)/archivio/archivio-client.tsx` — oggi lo stato è tutto in **`useState`**
>   (`query`, `filters`, `view` `"list"|"grid"`, `offset`) → **si perde all'unmount** (back dalla scheda
>   `/archivio/[id]`) **e al refresh**. È esattamente la causa dei problemi 1 e 2.
> - La ricerca è `api.product.search` (debounce 300ms, react-query `keepPreviousData`), navigazione al dettaglio
>   via `<Link>` in `ProductCard`/`ProductRow`.
> - **Search history — riuso**: `ActivityLog` **già logga** `PRODUCT_SEARCHED` con la query (vedi
>   `product.search` router + `dashboard.ts`) → la «cronologia settimanale» si può **derivare da lì** (query tRPC
>   ultimi 7 giorni, distinte) senza nuova tabella, oppure con una tabella dedicata se si vuole di più.
> - **Approcci candidati (da valutare nel brainstorming/council):**
>   - Stato ricerca in **URL searchParams** (`?q=&view=&offset=&…`) via `useSearchParams`+`router.replace`
>     → sopravvive a refresh **e** back **e** è condivisibile; react-query (staleTime) tiene i risultati in cache
>     al ritorno → niente ricarica. **Scroll restoration** su back (App Router lo fa se non si rimonta lo stato).
>   - Preferenza `view` persistita anche in `localStorage` (preferenza «dispositivo», non per-ricerca).
>   - Alternativa/aggiunta: mantenere la lista montata (nessuna navigazione «hard») — ma i `<Link>` App Router
>     già preservano la history; il problema è lo stato client, non la history.
> - **Vincoli progetto**: TS strict; **tutte le API via tRPC/Prisma**; UI in italiano, codici in mono;
>   **mobile-first** (verifica ≤375px); niente over-engineering (ponytail).
> - **Idee extra da vagliare nello «studio»** (non richieste esplicitamente, proporre e far scegliere):
>   «prodotti visti di recente», ricerche salvate/preferite, chip dei filtri attivi + «azzera», ricerca
>   condivisibile via URL, empty-state con suggerimenti, scorciatoie tastiera, thumbnail immagine prodotto nelle
>   card/righe (ora la foto c'è solo sul dettaglio), paginazione «carica altro» vs pagine.
>
> **Stato attuale (tutto LIVE, niente debito bloccante):** vedi tabella sopra. App su
> `catalogo-finder-kappa.vercel.app`; Neon allineato; immagini prodotto popolate (7082).
>
> ---
>
> **▶ STORICO — 2026-07-24 (IMMAGINI PRODOTTO ✅ live): PR #27 MERGIATA + ops run 30089631152 (`✓ 7082 immagini`).**
>
> **CAUSA RADICE del «immagini viewer»:** le foto del listino sono **JPEG2000 (jpx)** (1503/1790) e **PDF.js non le
> decodifica** → non si vedevano nel viewer (né range né split c'entravano). **Soluzione:** estratte dal PDF con
> poppler (decodifica il jpx → PNG) e mostrate sulla **scheda prodotto** come `<img>` native. Costruito: tabella
> `ProductImage` (separata da Product) + migrazione `20260724100000_add_product_images`; helper puro
> `listino-images.ts` (mappatura immagine→codice per banda verticale); `scripts/extract-listino-images.ts` +
> `ops-extract-images.yml`; route `/api/product-image?code=…` (auth, byte dal DB); UI `ProductImage`
> (`<img onError hide>`) sull'header di `ProductDetail`. Gate verdi (test **341**). **Ops fatto** (run 30089631152,
> `✓ 7082 immagini salvate in product_images`); route verificata live (401 senza auth). Spec:
> `docs/superpowers/specs/2026-07-24-immagini-prodotto-design.md`.
> **Tradeoff noto**: foto di famiglia salvata per ogni codice (duplicazione byte); dedup per hash = follow-up.
> Thumbnail nelle card = follow-up (vedi «idee extra» sopra).
>
> ---
>
> **▶ STORICO — 2026-07-24 (Opzione B, store PRIVATO): PR #25 + #26 MERGIATE.**
>
> Viewer listino a **PAGINE SINGOLE** (Opzione B): il listino non è più un unico PDF da 41 MB servito via Range,
> ma **~959 paginette** su Vercel Blob (ognuna un file minuscolo con TUTTE le sue immagini → scaricata per intero
> → immagini complete, veloce, ottima su mobile, evidenziazione preservata).
>
> **STATO:** **PR #25 MERGIATA** (versione «Blob pubblico»). Al primo run ops lo split è **fallito**:
> `Cannot use public access on a private store` → il Blob store dell'utente è **PRIVATO**. **Follow-up** sul branch
> **`claude/listino-page-split-n8ofuk`** (ripartito da `origin/main` dopo #25) che adatta il codice allo store
> privato — **da mergiare**, poi **ri-lanciare lo split**.
>
> **Cosa fa il follow-up (gate verdi: typecheck · lint · test 330 · build):**
> - **env** (`src/env.ts`, `.env.example`): **`BLOB_READ_WRITE_TOKEN`** (al posto di `LISTINO_PAGE_URL_TEMPLATE`)
>   + `LISTINO_TOTAL_PAGES`. Entrambe assenti = feature off.
> - **route** `src/app/api/listino/route.ts` + `page-param.ts`: `GET /api/listino?page=N` — auth 401 · 503 se env
>   off · **param anti-SSRF** `^[1-9]\d*$` in `[1,total]` → 400 · legge la paginetta **privata** lato server via
>   `@vercel/blob` `get("listino/page-N.pdf", {access:"private", token})` · stream **200 application/pdf** · null/errore → 502.
> - **split** `scripts/split-listino.ts`: `pdfseparate page-%d.pdf` → `put(..., {access:"private", …})` con retry;
>   stampa `LISTINO_TOTAL_PAGES`. `@vercel/blob` ora in **dependencies** (la route lo importa a runtime).
>   Rimosso l'helper `pageUrlTemplateFromUrl` (non serve un URL pubblico).
> - **viewer/provider/layout**: invariati (`<Page pageNumber={1}>`, `totalPages` via prop, width responsive `ResizeObserver`).
> - **ops** `ops-split-listino.yml` invariato (secret `BLOB_READ_WRITE_TOKEN`).
> - Il listino NON è **mai** raggiungibile pubblicamente (risolve del tutto il finding low di enumerabilità).
>
> **➡ AZIONI OPS (utente):**
> 1. **Mergiare il follow-up** (nuova PR).  2. **Secret `BLOB_READ_WRITE_TOKEN`** già presente (aggiunto per il run #1).
> 3. **Ri-lanciare** la GH Action **«Ops — Split listino»** → carica le ~959 paginette **private**. Dal log copiare
>    **`LISTINO_TOTAL_PAGES`**.
> 4. Su **Vercel (Production)**: impostare **`BLOB_READ_WRITE_TOKEN`** (stesso token dello store) + **`LISTINO_TOTAL_PAGES`**,
>    **rimuovere `LISTINO_PDF_URL`**, poi **redeploy**.
> 5. (Opz.) eliminare dal Blob il vecchio `listino.pdf` monolitico.
> 6. **Verifica browser** (≤375px + desktop): un codice → pagina giusta, **immagini complete**, codice evidenziato,
>    nessun overflow orizzontale.
>
> **Nota edizione:** lo split DEVE girare sulla **stessa edizione** del listino che ha popolato `Product.listinoPage`
> (stesso link registrato; il run #1 ha confermato **959 pagine**). A ogni nuova edizione: re-run backfill (`ops-neon`)
> **e** `ops-split-listino` insieme.
>
> **Nota spot-check:** il warning «page-418 NON contiene A50111» è **soft e atteso** (la pagina di calibrazione è lo
> schema di montaggio; il codice può non comparirvi). La numerazione fisica combacia col monolite già verificato LIVE
> (vasistas = pagina 418) → i deep-link sono corretti; verifica reale = browser dopo il deploy.
>
> ---
>
> **▶ STORICO — sessione chiusa 2026-07-23: 4 PR mergiate e in produzione; problema viewer poi risolto da Opzione B.**
>
> Tutto ciò che è stato costruito in quella sessione è **mergiato e in produzione**.
>
> **Cosa è entrato in produzione (gate verdi typecheck·lint·test·build su ogni PR):**
> - **#20 — Fase 1i «Vasistas» ARTECH LEGNO** (`claude/handoff-md-review-erkjm0`). Terza tipologia del kit
>   engine, PROVVISORIA. Modulo `rules-artech-vasistas-legno.ts`: cremonese `A50111.15` per GR + catena DSS
>   `A50190.00.00`/incontro `A51400.05.03` + forbici `A50545` (1/2 per GR) + supporto/perno + terminale +
>   movimento angolare + limitatore + incontri via colonna NOT.(GR). Guardie: solo LEGNO, superficie ≤ 2 m²,
>   campo GR01–GR06. Enum `windowType` += `VASISTAS`, registry, seed `isActive:true`, wizard solo-LEGNO. Golden
>   10 righe/12 pezzi. **10 assunzioni per l'esperto** in `docs/superpowers/kit-assunzioni/vasistas.md`.
> - **#21 — «Visualizza nel listino»** (`claude/listino-viewer`). Pulsante su distinta kit + dettaglio prodotto
>   → viewer `react-pdf` alla pagina del listino col codice **evidenziato**. Mappatura codice→pagina: parser
>   page-aware (`pagina fisica = 1 + form-feed`, calibrato: vasistas «pag.416» = pagina fisica **418**) →
>   `Product.listinoPage` (migrazione `20260723120000_add_listino_page`). PDF su
>   **Vercel Blob** dietro auth (route `/api/listino` con Range). Componenti in `src/components/listino/`.
> - **#22 — ottimizzazione ops** (`claude/optimize-backfill`): backfill in batch (500/transazione, da ~30 min a
>   secondi) + rimosso lo step `Backfill` ridondante dal workflow (l'`import:agb` popola già `listino_page`).
> - **#23 — fix immagini viewer** (`claude/fix-listino-images`): rimosso `disableAutoFetch` dal `<Document>`
>   (con quello PDF.js non recuperava gli XObject immagine). **Parziale** — vedi problema aperto.
>
> **Ops eseguite (dall'utente):** run GitHub Actions **«Ops — Neon» 30024919979** = migrazione `add_listino_page`
> + import (popola le pagine) + `db:seed:kit` (template vasistas) + embed(skip). **Viewer attivato**: listino
> linearizzato caricato su Vercel Blob + `LISTINO_PDF_URL` impostata. Il viewer **funziona** (apre alla pagina
> giusta, evidenzia il codice).
>
> **⚠️ PROBLEMA APERTO (unico) — immagini del viewer parziali.** Nel viewer le foto prodotto si vedono **solo in
> parte** (poche). Causa: con le range-request PDF.js **disegna la pagina prima che tutti gli XObject immagine
> (grossi) siano arrivati e non ri-disegna**; in più le molte richieste-range concorrenti verso la route proxy
> possono non completare tutte. Il fix #23 (via `disableAutoFetch` off) ha migliorato ma non risolto.
>
> **➡ PROSSIMO PASSO DECISO — OPZIONE B: pre-split del listino in pagine singole.** Ogni pagina diventa un file
> minuscolo (~100–300 KB) con **tutte** le sue immagini → il viewer carica solo quella pagina → veloce, immagini
> complete, ottimo su mobile (regola mobile-first), evidenziazione preservata (text-layer intatto). Comporta:
> (a) script di **split** del PDF linearizzato in ~959 paginette (`pdfseparate` di poppler, già in ops) +
> **upload su Vercel Blob**; (b) **route** `/api/listino?page=N` che serve la singola paginetta; (c) **viewer**
> che carica `?page=N` come documento a pagina singola (prev/next → altri file). Vedi il prompt di apertura
> sessione preparato dall'utente. Alternativa scartata: `disableRange` (scarica 41 MB interi → tutte le immagini
> ma pesante su mobile + rischio limite 60s della route). Opzione B è la scelta corretta.
>
> **Altri task ancora aperti (non bloccanti):** validazione esperto AGB dei kit provvisori (vasistas +
> battente/PVC/ALU — schede in `docs/superpowers/kit-assunzioni/`); pulsante listino anche sulle card della
> lista risultati archivio (follow-up «stretched link», oggi solo su distinta kit + dettaglio prodotto).
>
> ---
>
> **▶ STORICO (sessione 2026-07-13) — TUTTO mergiato e in produzione, niente in sospeso.**
> Feature richiesta dall'utente: sezione **solo-admin** per creare/gestire utenti + login anche con
> **nome utente** (oltre che email), inclusi **account senza email**. Sviluppata **subagent-driven**
> (SDD) sul branch `claude/handoff-review-irs3gv` (ripartito da `origin/main` dopo il merge #16),
> 14 commit `33e3227→1623211`, **pushati**, gate verdi: typecheck·lint·**test 293/9 skip**·build 14 route.
>
> **Cosa c'è (Fase A backend+UI · Fase B username):**
> - Router `user` (`src/server/api/routers/user.ts`), **ogni mutation `adminProcedure`**:
>   `create · list · setRole · setActive`(ban+status) `· resetPassword · update · delete`. **Anti-lockout**:
>   mai su self né sull'ultimo admin attivo; `delete` bloccato se l'utente ha record collegati
>   (kit_requests / conversations / **settings**, tutte FK `RESTRICT`).
> - Pagina **`/utenti`** (`src/app/(dashboard)/utenti/`), server-gated ADMIN, + voce nav admin-only.
>   Tabella + azioni + form **crea** e **modifica** (nome/cognome/email/username).
> - **Login email O username** (`login-form.tsx` instrada `signIn.email`/`.username`) + plugin Better Auth
>   `username` (`config.ts`/`auth-client.ts`) + colonne `username`/`display_username` (schema + migrazione
>   `20260713094200_username`). **Account senza email** → email-segnaposto
>   `<username>@no-email.ufptrade.local` (costante unica `src/lib/placeholder-email.ts`).
> - Review finale **opus** (0 Critical, 2 Important **fixati**): `usernameSchema` allineato al validator
>   del plugin (max 30, **no trattino** — altrimenti account creabile ma **non autenticabile**);
>   **rimossa** la route `setStatus` (non guardata, 0 consumer). Minor fixati: pre-check email→CONFLICT,
>   indice username ridondante, costante segnaposto condivisa, UI (pannelli, hint, copy login).
>   Ledger: `.superpowers/sdd/progress.md`.
>
> **✅ FATTO (tutto chiuso in questa sessione):**
> 1. **PR #17 MERGIATA** (gestione utenti + login username).
> 2. **Migrazione `20260713094200_username` APPLICATA a Neon** via **ops run #4** (13/07): aggiunge
>    `users.username`/`display_username` + unique. Login (email *e* username) OK in produzione.
>    *(Nota storica: al primo merge #17 il login si era rotto perché la migrazione non era ancora su Neon —
>    lo schema Prisma interrogava colonne assenti; risolto lanciando ops-neon sul branch.)*
> 3. **PR #18 MERGIATA** — **UI mobile responsive + regola mobile-first**: sidebar era `hidden md:block`
>    senza alternativa (niente nav <768px) → **hamburger + drawer** (Sidebar riusata; overlay/slide-in;
>    chiusura Esc/backdrop/cambio-rotta); TopBar mobile; **`/utenti` azioni in menu ⋯** (dropdown
>    `position: fixed` per non farsi ritagliare dall'`overflow-x-auto`); fix griglia login (`grid-cols-1`).
>    Nuova **REGOLA INVIOLABILE** in `CLAUDE.md`: UI mobile+desktop con verifica a viewport ≤375px.
>    La X rossa sulla CI di #18 era un **outage GitHub Actions** (Service Unavailable nel download action),
>    non il codice — CI su `main` post-merge verde.
> 4. **Deploy verificato LIVE** su `catalogo-finder-kappa.vercel.app` (login 200; HTML servito con `grid-cols-1`).
>
> **Minor differiti** (non-bloccanti, gestione-utenti — dalla review opus): create non atomico su race
> stesso-username (orfano raro); placeholder email non rigenerata al rename username; TOCTOU
> `assertNotLastActiveAdmin` (solo con 2 admin simultanei opposti); alcuni id inesistenti → 500 anziché
> NOT_FOUND. **Kit provvisori** (PVC/ALU/battente) ancora da validare con l'esperto AGB.
> **Verifica mobile su dispositivo reale** consigliata (le pagine dietro login non erano screenshottabili in
> sandbox senza DB; verificate via harness a 375px).
>
> **➡ PROSSIMO PASSO**: scelta della fase successiva — **decisione utente**. Nessun debito bloccante.
>
> ---
>
> **▶ STORICO (Fase 1h — «anta a battente», MERGIATA PR #16; template seedato su Neon via ops run #3).**
> App **LIVE** su Vercel (`catalogo-finder-kappa.vercel.app`); DB Neon popolato; **PR #15
> (Fase 1g) MERGIATA** (migrazione `supplementary_closures` applicata a Neon via ops run #2).
> **Fase 1h DONE** sul branch `claude/handoff-review-irs3gv` (ripartito da `origin/main`
> @ `0d4f4f7` dopo il merge #15; 7 commit `d4b37c2→cd457e7`, **pushati**; gate verdi:
> typecheck·lint·test **252 passed/9 skip**·build 13 route). È una **nuova TIPOLOGIA**, non un
> nuovo materiale: l'**anta proiettante** richiesta NON è nel listino 2026 (0 riscontri, come
> l'alluminio) → **scelta utente = «a battente»** (che ha schema ARTECH legno completo).
> Architettura **Opzione C ESTESA** (no /llm-council, scelta utente):
> - **Task 1** `artech-legno-shared.ts`: estrae la meccanica legno condivisa (cerniere `PER_MANO`,
>   `MOVIMENTO_ANGOLARE`, `incontriNottolino`) — **behavior-preserving**, il golden anta-ribalta
>   (12 righe/17 pezzi) resta invariato.
> - **Task 2** `rules-artech-battente-legno.ts` (`engineId "artech-batt-legno"`) **PROVVISORIO**:
>   cremonese Mod. 502 `A50200.15.NN` (per altezza) + famiglie condivise, **MENO il meccanismo di
>   ribalta** → distinta **5 righe** (`// ASSUNZIONE` ovunque); enum `windowType` allargato ad
>   `ANTA_BATTENTE` (nessuna migrazione: l'enum Postgres ce l'ha già dalla init).
> - **Task 3** `seed-kit.ts` data-driven per-`windowType` + template battente (`isActive:true`, PROVVISORIO).
> - **Task 4** wizard `nuova-client.tsx`: espone `ANTA_BATTENTE` **solo-LEGNO** (PVC/ALU gated per
>   il battente), reset materiale/chiusure al cambio tipologia.
> Spec/piano: `docs/superpowers/{specs,plans}/2026-07-12-fase1h-kit-anta-battente*`. Scheda
> assunzioni + domande esperto: `docs/superpowers/kit-assunzioni/battente.md`. Ledger:
> `.superpowers/sdd/progress.md`.
> **➡ PROSSIMI PASSI**:
> 1. **PR Fase 1h** (branch pushato) — **decisione utente** (NON creata in automatico).
> 2. **Al deploy**: `db:seed:kit` su Neon per inserire il template battente. **NESSUNA migrazione**
>    (l'enum `WindowType` ha già `ANTA_BATTENTE`). Senza il seed, il wizard offre ANTA_BATTENTE ma
>    la generazione dà «Nessun template attivo».
> 3. **Integration gated**: girare `engine.integration.test.ts` con `INTEGRATION_DATABASE_URL` per
>    verificare che i codici battente (`A50200.15.NN` ecc.) siano a catalogo Neon (warning attesi = 0).
> 4. **Con l'esperto**: domande in `docs/superpowers/kit-assunzioni/` (indice in `legno.md`); poi bump `version`.
> ⚠️ **SUPERATO dalla bonifica del 2026-07-25**: il battente è stato **DISATTIVATO** (la distinta era priva del
> gruppo di sospensione superiore) — i punti 2 e 3 qui sopra non valgono più, il template va seedato
> `isActive:false`. Vedi §RIPRENDI DA QUI.
> ⚠️ Minor rimandati (follow-up, in `progress.md`): commento `ASSUNZIONE` orfano in `rules-artech-legno.ts`;
> boilerplate display-string battente/legno; asserzioni del test integration battente (solo count).
> ⚠️ Fase 1f: e2e fatto via **API backend** (non browser UI, limite sandbox↔Vercel); dati di test in staging.

## Stato attuale in breve

- **Fase 1c (Chat AI) implementata al completo, TDD, tutti i gates verdi**:
  `typecheck` · `lint` · `test` (137 passed + 6 integrazione/gated) · `build`.
- Verificata nel **browser** (Playwright, senza key): login → `/assistente`,
  stato vuoto con 3 prompt, invio → bolla utente + bolla errore «Assistente non
  configurato.» con «Riprova» (rigenera senza duplicare), dropdown conversazioni,
  titolo dal primo messaggio, pannello prodotti con stato vuoto. `/archivio`
  continua a funzionare (ramo testuale).
- Integrazione pgvector verificata su Docker: `storeEmbeddings` + ricerca ibrida
  con `FakeEmbeddingService` → `vectorScore > 0`.
- **E2e con key reale (2026-07-04, key Gemini fornita dall'utente, solo in `.env`):**
  - Listino re-importato nel container (6.191/22, identico alla 1b).
  - **Chat reale verificata nel browser**: tool-use multi-round (ricerca filtrata
    → 0 → retry senza filtri nello stesso turno), codici reali citati in mono,
    4 schede nel pannello, messaggi TOOL/ASSISTANT a DB con modello/token/latenza
    (2–5s a quota libera; 1–2 min sotto 429 con retry+backoff del gateway).
  - **Ricerca ibrida reale verificata** (900 embedding reali): «maniglia con
    chiave per anta ribalta» → ramo testuale 0 hit, ramo vettoriale trova i 5
    A50107* giusti (vec≈0.72); prefisso codice `A50122` resta dominante.
  - **Tuning da e2e** (commit dedicati): system prompt (retry immediato senza
    filtri, niente markdown), descrizioni tool (filtri restrittivi), batch
    embedding 100→50 (il free tier rifiuta sistematicamente le richieste da 100).
- **RICICLO CONTAINER (2026-07-04 ~07:00Z)**: l'ambiente remoto è stato
  ricreato → persi `.env` (con la GEMINI_API_KEY), il DB Docker (catalogo +
  **i 900 embedding reali**) e i loop in scratchpad. Il codice era tutto
  pushato: nulla di perso lato git.
- **Ambiente RICOSTRUITO nella sessione del check (2026-07-04)**: install +
  engine Prisma + Docker/Postgres/Redis + migrazioni + seed + **re-import
  listino 6.191/22** (PDF dal link registrato) + suite verde (137 passed).
  Manca SOLO la key in `.env`.
- **SECONDO RICICLO (2026-07-04 ~10:30Z)** + ricostruzione bis: key utente in
  `.env` (e nel transcript sessione: ripristinabili senza richiederle),
  re-import 6.191/22, loop embedding avviato → **fermo a 1.000/6.191: cap
  giornaliero free-tier ~1.000 contenuti confermato al centesimo**. Il trickle
  multi-giorno NON sopravvive ai ricicli (2 in un giorno): le opzioni vere sono
  **billing sulla key** (catalogo intero ≈ centesimi, minuti) o rimandare a
  Neon (1f). Chat e ricerca testuale funzionano comunque.
- **Key Kimi fornita = prodotto "Kimi Code"**: 401 su api.moonshot.ai/.cn —
  per il fallback serve una key della **Moonshot API platform**
  (platform.moonshot.ai). Fallback non attivo, chat su sola Gemini.
- **Raccomandazione persistenza key**: variabili d'ambiente dell'environment
  Claude Code (impostazioni web) — sopravvivono ai ricicli; mai nel repo.

## Fase 1c — cosa è stato costruito

| Componente | File | Note |
|---|---|---|
| CircuitBreaker | `src/server/ai/breaker.ts` | 5 fail/60s → open 30s; stato SOLO su Redis; TTL scaduto = half-open |
| RateLimiter | `src/server/ai/ratelimit.ts` | finestra fissa; 20 msg/min/utente + cap 60 RPM/provider |
| RedisLike + client | `src/server/ai/redis.ts` | ioredis lazy; interfaccia minima iniettabile; `src/test/fake-redis.ts` per i test |
| Errori tipizzati | `src/server/ai/errors.ts` | messaggi italiani; `ProviderHttpError.status` guida retry/fallback |
| ChatProvider | `src/server/ai/providers/{types,gemini,sse}.ts` | solo fetch (NO SDK); Gemini `generateContent` v1beta + **`streamGenerateContent?alt=sse`** (parser frame-safe `sse.ts`). *(`kimi.ts` rimosso 2026-07-24)* |
| **AIGateway** | `src/server/ai/gateway.ts` | UNICO punto uscita AI: rate limit → breaker → timeout 30s. `chat()` (non-stream) ha 1 retry jitter su 429/5xx; **`chatStream()` non ha né retry né fallback** (duplicherebbe token già emessi) e uno **STOP utente non conta come guasto** del provider. `embedQuery` (3s, null su errore); `getAIGateway()` singleton da env |
| RAGEngine esteso | `src/server/ai/rag.ts` | + `listUnembedded`/`storeEmbeddings` (resta l'unico modulo raw SQL); degrado try/catch su embedding; **niente più `server-only`** (riuso da tsx) |
| Embedding batch | `src/server/ai/embedding.ts` + `product-text.ts` + `scripts/embed-products.ts` | `generateBatch` ≤100, `HttpStatusError`, backoff exp; `pnpm embed:products` idempotente (pagina su `embedding IS NULL`) |
| Tool chat | `src/server/chat/tools.ts` | `search_products` (limit ≤10, filtri) + `get_product_by_code`; errori come output al modello |
| ChatService | `src/server/chat/service.ts` | USER persistito PRIMA della chiamata; loop tool cap 5 → round finale forzato senza tool; TOOL/ASSISTANT con metadati; errore → ASSISTANT `ERROR` (RateLimited → rilanciata) |
| Router chat | `src/server/api/routers/chat.ts` | create/list/get/send/retry/archive (AGENT, ownership); ActivityLog; RateLimited → `TOO_MANY_REQUESTS` |
| Ricerca ibrida attiva | `product.search` | `new RAGEngine(ctx.db, getAIGateway().queryEmbeddings())`; senza key → testuale, mai rotta |
| UI Assistente | `src/app/(dashboard)/assistente/` + `src/components/chat/` | split 60/40 (DESIGN.md), bolle con codici mono, pannello prodotti con copia+link, dropdown conversazioni, «Sta scrivendo…», errore inline con Riprova |
| maxDuration | `src/app/api/trpc/[trpc]/route.ts` | `export const maxDuration = 120` |
| CLAUDE.md | regola emendata | **AIGateway al posto di BullMQ** (LLM Council 2026-07-02) |

### Decisioni prese durante la 1c (delta vs spec/piano)
- **Budget per-provider = 60 RPM** (cap di sicurezza globale, non 15): col budget
  sotto il limite utente il rate-limit utente non era mai raggiungibile.
  Saltare tutti i provider SOLO per budget → `RateLimitedError` (non
  «non disponibile»).
- **Rate limit → nessun messaggio ERROR in DB**: `send`/`retry` rilanciano come
  `TOO_MANY_REQUESTS`; la UI mostra banner errore con «Riprova» (stesso esito, meno stato).
- **`retry` = procedura dedicata**: cancella gli ASSISTANT `ERROR` e rigenera dalla storia.
- **Storia per il modello**: solo USER/ASSISTANT `SENT` (i round TOOL restano in DB, non nel prompt).
- **Fix dipendenze (Task 0)**: pnpm risolveva `@better-auth/core@1.6.23` contro
  il peer `better-call@1.1.8` (trascinato dalla vecchia `@better-auth/cli`) →
  import di better-auth rotto. **Override pnpm**: `better-call@1.3.7`,
  `@better-fetch/fetch@1.3.1`.
- Bolla ottimistica utente con stato `pendingContent` (copre anche la fase di
  `chat.create` alla prima domanda).

## Fase 1d — cosa è stato costruito

Kit deterministico (**MAI LLM**), pilota **ARTECH anta-ribalta LEGNO**, 8 task
TDD (piano `docs/superpowers/plans/2026-07-04-fase1d-kit-engine.md` +
emendamento `2026-07-04-fase1d-emendamento-legno.md`). Golden: 550×1820mm,
SX, TIRARE, aria 12, asse/interasse 13, battuta 20, sede 18, ARGENTO →
**16 righe / 21 pezzi**, verificato sia in unit (prodotti fake) sia in
integrazione sul catalogo reale (6.191 prodotti, listino 2026) sia nel
browser end-to-end.

| Componente | File | Note |
|---|---|---|
| Tipi/contratto | `src/server/kit/types.ts` | `kitInputSchema` (zod, generico — nessun campo ARTECH-specifico); `KitLine`/`RuleModule`/`KitGenerationError`; costanti `PILOT` (FINESTRA, verticali passo 600, coperture KIT) |
| Regole ARTECH legno | `src/server/kit/rules-artech.ts` | Tabelle dati `as const` (cremonese per range altezza, corpo forbice per range larghezza, bracci per gruppo larghezza, coperture per finitura+mano) + funzioni pure per quantità; ogni scelta non derivabile con certezza è marcata `// ASSUNZIONE` (vedi Decisioni) |
| Registry | `src/server/kit/registry.ts` | Puntatore `{engine, version}` → `RuleModule`; engine non registrato/puntatore malformato → errore esplicito |
| Seed template | `prisma/seed-kit.ts` (`pnpm db:seed:kit`) | `KitTemplate` "ARTECH anta-ribalta legno" attivo, idempotente |
| **KitEngine** | `src/server/kit/engine.ts` | Pipeline VALIDATE → SELECT TEMPLATE (DB, priority) → APPLY RULES (registry) → risoluzione prezzi da `Product` (Prisma, no raw SQL); codice non a listino → warning esplicito, kit comunque generato |
| Router kit | `src/server/api/routers/kit.ts` | `create`/`generate`/`get`/`list` (AGENT, ownership, transazione su `generate`, ActivityLog `KIT_REQUEST_CREATED`/`KIT_GENERATED`) |
| UI Richieste | `src/app/(dashboard)/richieste/` + `src/components/kit/` | Lista con stato vuoto+CTA, dettaglio con `DistintaTable` (codici mono+copia) e banner warning, wizard `/nuova` 4 step (tipologia → dimensioni → mano/finitura → riepilogo) con default LEGNO |
| Test integrazione | `src/server/kit/engine.integration.test.ts` | Gated `INTEGRATION_DATABASE_URL`; risolve i 16 codici sul catalogo reale, zero warning, tutti prezzati, `totalPrice > 0` |

### Decisioni 1d (delta vs spec/piano)
- **Pivot golden ALLUMINIO → LEGNO** (Task 0): la gamma «ad applicare» ALLUMINIO
  della distinta reale 2021 non esiste più nel listino 2026 (9/20 codici
  sopravvissuti a DB, gli 11 mancanti sono tutti profilo-specifici — nemmeno i
  prefissi esistono). Il capitolo ARTECH 2026 è completo per LEGNO → pilota
  spostato su ARTECH anta-ribalta LEGNO; struttura/quantità della distinta
  reale restano identiche (16 righe/21 pezzi), i codici profilo-specifici sono
  rimappati sugli equivalenti legno 2026.
- **ADR council — regole "a forma di dati" in TypeScript, non JSON a DB**
  (`docs/superpowers/specs/2026-07-04-fase1d-kit-engine-design.md`): con n=1
  distinta reale, progettare oggi uno schema JSON generico è wrong abstraction
  garantita — le tabelle a range sono banali in qualsiasi rappresentazione, sono
  le *formule* a discriminare. **Trigger di migrazione registrato**: alla 2ª
  serie si rivaluta, alla 3ª si estrae il vocabolario comune in
  `KitTemplate.rules`. `KitTemplate` resta comunque vivo come
  registro/dispatcher (puntatore versionato `{engine, version}` validato zod).
- ~~**Gap di catalogo — supporto-cerniera (`A50801.01.xx`)**~~ → **SMENTITO il
  2026-07-25**: il gap non esisteva, era un **buco del parser**. La variante
  aria 12 / interasse 9/13 / battuta 20 è a listino (p0451 (449)) e si chiama
  `A50805.05.DX/.SX`: il parser scartava i codici con **segmenti alfanumerici**,
  quindi non arrivava a DB e sembrava assente. Il pinning su `A50801.01.xx`
  («Aria 4 - Interasse 9», battuta 18) è stato **corretto** in `PER_MANO`.
- **Formula quantità incontri-nottolino, non dati `colonne.'not.'`**: verificata
  l'ipotesi data-driven (somma dei `colonne.'not.'` dei componenti mobili
  selezionati) sui dati reali → non regge (il fusto forbice ha `not."="-"`,
  somma pesata darebbe 4 ≠ 5 atteso). Si usa la formula ASSUNZIONE del piano
  originale (`2 + scatti passo 600 in altezza + scatti passo 600 in
  larghezza`), che riproduce esattamente il golden.
- **Finiture coperte nel pilota: solo ARGENTO** (`COPERTURE_KIT` in
  `rules-artech.ts`); il wizard mostra solo ARGENTO come opzione selezionabile
  (`FINISH_OPTIONS`, duplicato manuale — annotato come minor in review Task 7).

## Fase 1e — cosa è stato costruito (merge PR #9, 2026-07-06)

Dashboard `/dashboard` da placeholder statico a **dati reali via tRPC**, TDD,
nessuna modifica a `schema.prisma`. Spec `docs/superpowers/specs/2026-07-06-fase1e-dashboard-dati-reali-design.md`,
piano `docs/superpowers/plans/2026-07-06-fase1e-dashboard-dati-reali.md`.

| Componente | File | Note |
|---|---|---|
| Helper fuso | `src/lib/format.ts` (`startOfTodayRome`) | Mezzanotte odierna a **Europe/Rome** (DST inclusa) → confine "oggi" per i KPI; niente nuove dipendenze |
| Router dashboard | `src/server/api/routers/dashboard.ts` (`overview`) | `protectedProcedure` (AGENT+); input `{ scope: mine\|team }`, **server autoritativo** (non-ADMIN forzato a `mine`); `Promise.all` di `count`/`findMany` Prisma (no raw SQL); output KPI (richieste, kit generati con `generatedAt != null`, conversazioni, prodotti cercati — total + oggi) + ultime 5 richieste con cliente/prezzo |
| Client dashboard | `src/app/(dashboard)/dashboard/dashboard-client.tsx` | react-query; toggle **"I miei / Team"** solo se ADMIN; 4 StatCard con "+N oggi"; sezione ultime richieste (link a `/richieste/[id]`); card **Scorciatoie** (assistente/nuova richiesta/archivio) che rimpiazza il box AI finto; stati loading (skeleton) / **errore esclusivo** (banner + Riprova, niente empty-state falso) / empty |
| Shell server | `src/app/(dashboard)/dashboard/page.tsx` | resta server component: passa `firstName`/`isAdmin` al client |
| Test | `dashboard.test.ts` · `dashboard-client.test.tsx` · `format.test.ts` | scope mine/team, riduzione AGENT→mine, `kitGenerati` su `generatedAt`, confine oggi, mapping `recentKits`; KPI/toggle/empty/loading/errore; `startOfTodayRome` CET+CEST |

## Gestione API key admin — cosa è stato costruito (merge PR #10, 2026-07-10)

Override **cifrato su DB con fallback env** per le key AI, gestibile da **ADMIN
non-tecnici** dall'app (senza accesso Vercel / redeploy). Verdetto LLM Council
2026-07-10. Spec `docs/superpowers/specs/2026-07-10-gestione-api-key-admin-design.md`,
piano `docs/superpowers/plans/2026-07-10-gestione-api-key-admin.md`. Il modello
`Settings` esisteva già a schema → **nessuna migrazione**.

| Componente | File | Note |
|---|---|---|
| Cifratura | `src/server/settings/crypto.ts` (`server-only`) | **AES-256-GCM** (`node:crypto`); `base64(iv[12]\|tag[16]\|ct)`, IV random per chiamata; master key da `SETTINGS_ENCRYPTION_KEY` (32 byte, base64/hex); assente → `SettingsCryptoUnavailableError` (mai crash/cifratura debole) |
| Env | `src/env.ts` | `SETTINGS_ENCRYPTION_KEY: z.string().optional()` (dev/CI girano senza) |
| Service | `src/server/settings/service.ts` (`server-only`) | `resolveApiKey` (**DB prima → fallback env**); `setApiKey` (cifra, `upsert` su `@@unique([category,key])`, `ActivityLog SETTINGS_CHANGED` con solo `{provider, maskedSuffix}` — **mai** plaintext, poi `INCR` version-stamp Redis); `getStatus` mascherato (`configured/source/maskedSuffix/updatedAt/updatedBy`) |
| Helper test key | `src/server/ai/gateway.ts` (`testProviderKey`) | verifica una key con chat minima, timeout corto, senza persistere |
| Gateway async + invalidazione | `src/server/ai/gateway.ts` (`getAIGateway` **async**) | risolve le key via `resolveApiKey` per chat **e** embedding (stessa key Gemini); version-stamp Redis `settings:ai-keys:version` riletto ~30–60s → ricostruisce il singleton al cambio; **degrada al singleton esistente se Redis è irraggiungibile** (fix `b9a8559`). Tutti i call-site resi `await` |
| Router settings | `src/server/api/routers/settings.ts` | tutte `adminProcedure`: `aiKeys.status` · `aiKeys.testConnection` (`{provider, apiKey?}`, provider temporaneo, no persist) · `aiKeys.set` (**ri-valida server-side** poi `setApiKey`) |
| UI Impostazioni | `src/app/(dashboard)/impostazioni/{page,impostazioni-client}.tsx` | admin-only; card per provider (stato DB/env/mancante, `••••1234` mono, "ultima modifica"); campo key **write-only**; **Salva abilitato solo dopo un test riuscito** |
| Test | `crypto.test.ts` · `service.test.ts` · `settings.test.ts` | roundtrip/tamper/master-key assente; DB-prima+fallback+audit-senza-plaintext+bump versione; `adminProcedure` nega non-ADMIN, `set` ri-valida |

> **Impatto sul task embedding**: con la gestione API key in-app, aggiornare la
> key Gemini **non richiede più redeploy** — un ADMIN la ruota da `/impostazioni`.
> La decisione aperta resta il **billing** della key (per superare il cap
> free-tier ~1.000 ed embeddare i 6.191 prodotti), non il "come" applicarla.

## Fase 1f — deploy staging (IN CORSO)

Spec `docs/superpowers/specs/2026-07-10-fase1f-deploy-design.md`, piano
`docs/superpowers/plans/2026-07-10-fase1f-deploy.md`. Verdetto council: procedere
con 1f ed embeddare come step finale (NON una GH Action anticipata). Scelta ops:
la dev-container web **filtra la 5432**, quindi le operazioni DB girano da **GitHub
Actions** (rete aperta → Neon:5432 ok).

### Fatto ✅ (PR #11 e #12 mergiate)
| Cosa | Dettaglio |
|---|---|
| Task 1 | `maxDuration` 120→60 in `src/app/api/trpc/[trpc]/route.ts` (cap Vercel Hobby) |
| Task 2 | `.env.example` allineato (Better Auth, `SETTINGS_ENCRYPTION_KEY`, URL Neon pooled/direct) |
| Task 3 | `.github/workflows/ci.yml` — Vitest su PR (verde sulla PR reale) |
| Task 4 | `.github/workflows/ops-neon.yml` — pipeline ops `workflow_dispatch` (migrate→import→seed→embed; job punta `DATABASE_URL` al Neon **diretto**) |
| Fix | `vitest.config.ts` forza `SETTINGS_ENCRYPTION_KEY=""` (ermeticità: senza, `resolveApiKey` interroga il DB e 2 test router falliscono) |
| Fix | **Next 15.3.0 → 15.5.20** (PR #12): Vercel **blocca** i deploy su versioni Next vulnerabili («Vulnerable version of Next.js detected»); il build passava ma il deploy veniva rifiutato |
| Deploy | App **LIVE** su Vercel (Hobby): **https://catalogo-finder-kappa.vercel.app** (nome `catalogo-finder` occupato → suffisso `-kappa`) |
| Config | `NEXTAUTH_URL` corretto all'URL reale + redeploy. Env Production su Vercel: `DATABASE_URL` (Neon pooled+pgbouncer), `DIRECT_URL` (Neon diretto), `REDIS_URL` (Upstash `rediss://`), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `IP_HASH_SECRET`, `SETTINGS_ENCRYPTION_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Infra utente | **Neon** (progetto "Catalogo Finder", `eu-west-2`) · **Upstash** (`catalogo-finder`, EU) · **GitHub Secrets**: `NEON_DIRECT_URL`, `GEMINI_API_KEY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` · **billing Gemini attivo** |
| **Task 7 (ops)** | **Pipeline _Ops — Neon_ eseguita e VERDE** (run #1 `29132026156`, 2026-07-11, ~35 min): `migrate deploy` (schema + pgvector/pg_trgm) · `import:agb` **6.191** · `db:seed` admin + `db:seed:kit` · `embed:products` **6.191/6.191** (`Completato: 6191 embedding generati.`). Neon **popolato**. Smoke test non autenticato: root → `/login` (200), «Accedi — UFPtrade» |

### Fatto 2026-07-11 — Task 7 ✅ + Task 8 ✅
1. ✅ **Task 7 — pipeline ops VERDE** (run #1 `29132026156`, ~35 min): migrate
   (schema + pgvector) → import **6.191** → seed admin + kit → embed **6.191/6.191**
   (`Completato: 6191 embedding generati.`). Neon popolato.
2. ✅ **Task 8 — e2e VERIFICATO** (login admin reale `admin@ufptrade.local`,
   2026-07-11). Tutti i flussi backend passano contro Neon popolato:
   - **auth**: sign-in Better Auth OK, `role: ADMIN`, `createdAt` = timestamp del
     seed (00:27:02Z) → conferma account creato dalla pipeline.
   - **`dashboard.overview`** (scope team, isAdmin): KPI reali (0 iniziale = corretto).
   - **`product.search` testuale** «maniglia»: 5 hit reali, `textScore` **e**
     `vectorScore` popolati → **ricerca ibrida attiva**.
   - **`product.search` semantica** «maniglia con chiave per anta a ribalta»:
     `txt=0 / vec≈0.72` → trova per **solo vettore** la famiglia **A50107\*** («Anta
     ribalta – con foro cilindro sotto la maniglia») = golden ibrido su Neon.
   - **chat tool-use** (`chat.create`+`send`+`get`): Gemini risponde citando **5
     codici reali** entro il cap 60s → generateContent + tool `search_products` OK.
   - **kit ARTECH golden** (`kit.create`+`generate`): `KIT-2026-0001` → **16 righe /
     21 pezzi / 90,20€**, **zero warning**, tutti i codici prezzati dal catalogo Neon.
   - **`settings.aiKeys.status`**: Gemini `configured/source=env/••••zrzQ`, Kimi `none`.
3. **➡ Task 9 — chiusura fase (PROSSIMO, decisione utente)**: aggiornare `CLAUDE.md`
   STATO → «Fase 1 MVP completa»; scegliere la fase successiva (produzione: Vercel
   **Pro** + dominio + hardening, oppure **Fase 2**).

### ⚠️ Caveat verifica e2e (2026-07-11)
- **Verificato via API backend, non browser UI**: un browser reale (Chromium/
  Playwright) nella sandbox esce dal **proxy TLS-intercepting** dell'agente e Vercel
  edge gli serve una **challenge anti-bot** (title `catalogo-finder-kappa.vercel.app`)
  la cui JS resetta attraverso il proxy (`ERR_CONNECTION_RESET`). **curl/HTTP passano
  invece perfettamente** → la verifica ha chiamato gli endpoint reali (Better Auth
  `/api/auth/sign-in/email` + tRPC `/api/trpc/*`) con sessione admin. È un limite
  **sandbox↔Vercel**, NON un difetto app: la UI si renderizza (smoke `/login` =
  «Accedi — UFPtrade») ed è servita dallo stesso backend verificato. Per una verifica
  **UI** vera basta aprire il sito da un browser normale.
- **Dati di test creati in staging**: la verifica ha creato **1 conversazione** (2
  messaggi) + **`KIT-2026-0001`** + alcuni log `PRODUCT_SEARCHED` → la **dashboard non
  è più a zero**. Innocui (staging); per azzerare servirebbe un DB reset (altra GH
  Action / pulizia mirata), da valutare se si vuole una demo pulita.

### Note / landmine 1f
- **Vercel Hobby** = uso non commerciale + cap function 60s. Per la produzione vera
  serve **Pro** (termini + headroom 300s → rialzare `maxDuration`; + deployment protection).
- **Preview deploy Vercel falliscono** finché le env stanno solo su Production
  (l'ambiente Preview non le ha → `env.ts` fa fallire il build). Per lo staging non serve.
- **Next vulnerabile**: tenere Next su una release non flaggata da Vercel (era 15.3.0 → 15.5.20).

## Task pendenti

### Immediati
- [X] GEMINI_API_KEY in `.env` (fornita 2026-07-04; anche nel transcript sessione)
- [X] **Embedding catalogo (6.191/6.191 su Neon)** ✅ — generato dalla pipeline ops
  GitHub Actions (`embed:products`, run #1 `29132026156`, 2026-07-11:
  `Completato: 6191 embedding generati.`). Il blocco 5432 della dev-container web
  resta valido (le operazioni DB girano da GitHub Actions, non dal container);
  billing Gemini attivo. Vedi sezione «Fase 1f».
- [x] ~~Key Moonshot API platform per il fallback Kimi~~ → **obsoleto: Kimi rimosso 2026-07-24** (Gemini unico)
- [X] Merge 1c su `main` (2026-07-04, merge locale + push; suite verde sul risultato)

### Da Fase 1d
- [X] ~~**Verificare con AGB il supporto-cerniera** `A50801.01.xx` pinnato per
  aria 12/interasse 13/battuta 20~~ → **RISOLTO dal listino il 2026-07-25**: la
  variante dedicata **esiste**, è `A50805.05.DX/.SX` («Supporto cerniera Aria 12 -
  Interasse 9/13 - Parte telaio», battuta 20, p0451 (449), 4,44 €) — non era stata
  trovata perché il **parser scartava i codici con segmenti alfanumerici**. Corretto
  in `PER_MANO`; il vecchio `A50801.01.xx` è «Aria 4 - Interasse 9» battuta 18.
  ⚠️ Richiede il **re-import del catalogo** su Neon (vedi §RIPRENDI DA QUI).
- [ ] **Altre finiture coperture** (`COPERTURE_KIT` in `rules-artech.ts` copre
  solo ARGENTO): estendere tabella + `FINISH_OPTIONS` nel wizard quando si hanno
  i codici delle altre finiture a listino.
- [ ] **PVC/ALLUMINIO**: `kitInputSchema` accetta già i 3 materiali ma il
  generatore ha solo le regole LEGNO (guardia esplicita → `KitGenerationError`
  sugli altri); wizard li mostra disabilitati con hint «presto disponibile».
  Da abilitare quando ci saranno le regole (nuovo `RuleModule` + registry).
- [X] **Follow-up da review finale 1d** (non bloccanti, chiusi 2026-07-06 su
  branch `claude/handoff-review-ztcteg`, TDD un commit per task):
  - [X] test bordo CHIUSURE_VERTICALI (H valida per cremonese ma fuori banda
    1520-2120 → errore esplicito `artech.verticali`)
  - [X] `.strict()` su `templateRulesSchema` (puntatore con chiavi estranee → errore)
  - [X] doppio push su RequestRow (`stopPropagation` sul `<Link>` interno)
  - [X] test ramo warnings-only del dettaglio (kit fuori listino: warning visibili)
  - [X] hint radio disabilitate fuori dal nome accessibile (`aria-label` +
    `aria-describedby`)
  - [ ] retry su unique per `requestNumber`: **NON fatto (YAGNI)** — "solo se
    crescerà la concorrenza"; da riprendere solo se emergono collisioni reali.

### Fatto dopo l'ultimo aggiornamento handoff (riportato ora)
- [X] **Fase 1e — Dashboard dati reali** (merge PR #9, 2026-07-06) — vedi sezione dedicata
- [X] **Gestione API key admin** (Settings cifrato + `/impostazioni`, merge PR #10, 2026-07-10) — vedi sezione dedicata

### In corso
- [🔄] **Fase 1f — deploy staging**: spec+piano fatti, Task 1–4 mergiati, app **live**
  su Vercel, Next bumpato, **Task 7 (pipeline ops) ✅ → Neon popolato** (6.191 prodotti
  + 6.191 embedding + admin), **Task 8 (e2e) ✅ verificato via API** (auth/dashboard/
  ricerca ibrida/chat tool-use/kit golden 16 righe·21 pezzi·90,20€). **Resta solo
  Task 9**: chiusura docs (`CLAUDE.md` STATO → «Fase 1 MVP completa») + scelta fase
  successiva. Dettagli e caveat: sezione «Fase 1f».

### Sessioni future
- [ ] **Produzione vera** dopo lo staging: Vercel **Pro** (termini commerciali +
  `maxDuration` 300 + deployment protection) + dominio custom.
- [ ] ~~Fallback Kimi~~ (**obsoleto: Kimi rimosso**) · finiture coperture · regole PVC/ALLUMINIO.

## Contesto tecnico

| Componente | Stato |
|------------|-------|
| Database schema | [X] Migrato (nessuna migrazione nuova in 1c/1e/API-key: `Settings` era già a schema) |
| Auth | [X] Better Auth (override better-call 1.3.7 in package.json) |
| Chat AI | [X] Codice completo; SENZA key risponde «Assistente non configurato.» |
| Embedding | [X] **6.191/6.191 su Neon** (pipeline ops run #1, 2026-07-11: `Completato: 6191 embedding generati.`). Ramo testato con fake + reale (900 su Docker in 1c) |
| Dashboard (1e) | [X] `/dashboard` dati reali via `dashboard.overview` (KPI + ultime richieste + scorciatoie, toggle team per ADMIN) |
| Gestione API key | [X] `/impostazioni` admin: override cifrato AES-256-GCM su `Settings` con fallback env; richiede `SETTINGS_ENCRYPTION_KEY` in env per attivarsi |
| **Deploy (1f)** | [🔄→✅ funzionale] App **live** su Vercel Hobby (`catalogo-finder-kappa.vercel.app`), Neon + Upstash, workflow ops/CI su `main`, Next 15.5.20. **DB Neon POPOLATO** + **e2e VERIFICATO** (Task 8, 2026-07-11, via API: auth ADMIN, ricerca ibrida A50107\*, chat tool-use, kit golden 16/21/90,20€, Gemini da env). Resta solo Task 9 (docs + scelta fase successiva). Caveat: e2e via API non browser (challenge Vercel↔proxy sandbox); creati dati test (1 conv + KIT-2026-0001) |
| Kit engine | [X] **2 tipologie attive** dopo la bonifica 2026-07-25: **anta-ribalta LEGNO** (pilota, golden 16 righe/21 pezzi/90,20 € con chiusure) e **vasistas LEGNO** (13 righe/19 pezzi, PROVVISORIO). **PVC e battente DISATTIVATI** (`isActive:false` + moduli che rifiutano): distinte non ordinabili — vedi §RIPRENDI DA QUI. **ALLUMINIO** gated dalla 1g. Geometria coperta: **solo** aria 12 / interasse 13 / battuta 20 / sede 18 (`assertPilotGeometry`) |
| Git | [X] `origin/main` @ `051d3ee` (PR #13 merge); branch `claude/handoff-review-irs3gv` ripartito da main |

### Regola utente — file esterni (2026-07-01)
- **Listino AGB PDF**: se manca nell'ambiente, **chiedere il link all'utente**
  (mai cercarlo sul web autonomamente). Link fornito:
  https://drive.google.com/file/d/1TugU94aM6OP557ELiLQpH0nUxhxrXMUz/view?usp=sharing

### Problemi riscontrati e workaround
- **better-call/better-auth** (vedi sopra): override pnpm permanenti in `package.json`.
- **pnpm 11 ignora `pnpm.overrides` in `package.json`** (2026-07-06): corepack
  di default nel container remoto lancia pnpm 11, che ha spostato `overrides`/
  `onlyBuiltDependencies` in `pnpm-workspace.yaml` e **scarta silenziosamente**
  gli override del repo → `better-call` regredisce a 1.1.8 (senza
  `kAPIErrorHeaderSymbol`) → `better-auth` va in crash a load (test/build auth
  rossi) e il lockfile fa drift. **Fix applicato**: `"packageManager":
  "pnpm@10.17.0"` in `package.json` (pnpm 10 legge ancora `pnpm.overrides`).
  Con il pin, `pnpm install --frozen-lockfile` è pulito. Se un giorno si vuole
  passare a pnpm 11: migrare gli override in `pnpm-workspace.yaml`.
- **`pnpm build` mentre `next dev` gira** invalida `.next` del dev server →
  chunk 404: riavviare `pnpm dev`.
- **Engine Prisma**: `bash scripts/setup-prisma-engines.sh` DOPO `pnpm install`.
- **Container nuovo**: `.env` va completato a mano (DATABASE_URL/DIRECT_URL/REDIS_URL/
  NEXTAUTH_*/IP_HASH_SECRET/SEED_ADMIN_*) — vedi `.env.example`; poi `dev-bootstrap.sh`.
- **Vitest**: `beforeEach` con body a graffe (il return viene invocato come cleanup).
- **`pnpm lint | tail`** maschera l'exit code → mai in catena `&&` con pipe.

## Istruzioni permanenti (utente)
1. **/using-superpowers** — sempre quando si sviluppa.
2. **/llm-council** — sempre per dubbi, quesiti, problematiche.
3. **/impeccable** — sempre per UI/UX.
4. **/ponytail** — sempre quando si scrive codice.
5. **Aggiornare tutti i `.md`** (handoff incluso) **a fine di ogni sessione** (la
   fine sessione la dichiara l'utente).

## Cronologia sessioni

| Data | Cosa fatto | Branch |
|------|-----------|--------|
| 2026-07-01 | Fase 1a completa + migrazione Better Auth + spec Fase 1b | `claude/ufptrade-mvp-setup-gcwxnt` |
| 2026-07-02 | Piano 1b + esecuzione completa (parser, import 6.191 prodotti, RAGEngine tsvector+trigram, router, UI Archivio+dettaglio) | `claude/superpowers-handoff-next-z1wyh7` |
| 2026-07-02 | Spec Fase 1c (LLM Council: AIGateway al posto di BullMQ) | `claude/handoff-review-3xcvvy` (PR #4) |
| 2026-07-03 | Piano 1c + esecuzione completa (AIGateway, provider, ChatService, router chat, embedding batch, UI Assistente, CLAUDE.md); gates verdi + verifica browser senza key | `claude/handoff-review-48kkhi` |
| 2026-07-04 | E2e reale 1c verificato (chat tool-use + ranking ibrido, 900 embedding) · riciclo container: ambiente ricostruito (re-import 6.191, suite verde), embedding da rifare, in attesa key + decisione quota | `claude/handoff-review-48kkhi` |
| 2026-07-05 | Fase 1d completa: spec+piano (ADR council regole-in-TS) + pivot golden ALLUMINIO→LEGNO (Task 0) + 8 task TDD (tipi, regole ARTECH legno, registry+seed, engine, router kit, UI richieste+wizard, golden integrazione su catalogo reale) + verifica browser (positivo 16 righe/90,20€ + negativo errore fuori-campo) + gates verdi | `claude/handoff-review-48kkhi` |
| 2026-07-06 | Follow-up review 1d non bloccanti (TDD, un commit per task): `templateRulesSchema.strict()` · test bordo CHIUSURE_VERTICALI · fix doppio push RequestRow · test ramo warnings-only dettaglio · fix a11y hint radio (`aria-label`/`aria-describedby`). Retry-su-unique lasciato per YAGNI. Scoperto+risolto il landmine pnpm 11 (override scartati) → pin `packageManager: pnpm@10.17.0`. 4 gate verdi (typecheck·lint·test 183 passed·build). | `claude/handoff-review-ztcteg` (PR #8) |
| 2026-07-06 | **Fase 1e — Dashboard dati reali** (TDD): `startOfTodayRome` · router `dashboard.overview` (scope mine/team, server autoritativo) · `DashboardClient` (KPI+oggi, ultime richieste, scorciatoie, stati loading/errore/empty). Fix `db:seed:kit` in bootstrap. **Handoff non aggiornato in questa sessione** (drift). | `claude/handoff-next-steps-p6xyzp` (PR #9) |
| 2026-07-10 | **Gestione API key admin** (TDD): crypto AES-256-GCM · env `SETTINGS_ENCRYPTION_KEY` · service `resolveApiKey`/`setApiKey`/`getStatus` (DB→env, audit senza plaintext, version-stamp) · `getAIGateway` async + invalidazione + degrado se Redis giù · router `settings.aiKeys` (status/testConnection/set) · UI `/impostazioni`. **Handoff non aggiornato in questa sessione** (drift). | `claude/handoff-next-steps-p6xyzp` (PR #10) |
| 2026-07-10 | **Review/riallineamento handoff**: riportate 1e + gestione API key (erano merge ma non documentate qui); aggiornati stato, task pendenti, contesto tecnico, cronologia. Prossimo passo di roadmap: Fase 1f (deploy). | `claude/handoff-md-review-6vyafm` |
| 2026-07-10 | **Fase 1f — deploy staging**: scoperto blocco 5432 dev-container → council → spec+piano (ops via GitHub Actions) · Task 1–4 [CLAUDE] (maxDuration 120→60, `.env.example`, `ci.yml`, `ops-neon.yml`) + fix ermeticità `vitest.config` (**PR #11**) · bump **Next 15.3.0→15.5.20** perché Vercel blocca le versioni vulnerabili (**PR #12**) · **deploy staging live** su `catalogo-finder-kappa.vercel.app` (Vercel Hobby) + Neon + Upstash + GitHub Secrets · `NEXTAUTH_URL` corretto. **Resta**: lanciare la pipeline ops (Task 7 → popola Neon → login), verifica e2e (Task 8), chiusura docs (Task 9). | `claude/handoff-md-review-6vyafm` (PR #11, #12) |
| 2026-07-11 | **Fase 1f — Task 7 (pipeline ops) ESEGUITO**: lanciata la GH Action _Ops — Neon_ (run #1 `29132026156`) → **verde in ~35 min**: `migrate deploy` (schema + pgvector/pg_trgm) · `import:agb` **6.191** · `db:seed` admin + `db:seed:kit` · `embed:products` **6.191/6.191** (`Completato: 6191 embedding generati.`). **Neon ora popolato**; smoke test non autenticato OK (`/login` 200, «Accedi — UFPtrade»). **Resta**: Task 8 (verifica e2e autenticata — serve la password admin dall'utente) + Task 9 (chiusura docs). | `claude/handoff-review-irs3gv` |
| 2026-07-11 | **Fase 1f — Task 8 (e2e) VERIFICATO**: login admin reale fornito dall'utente → verifica end-to-end via **API backend** (browser bloccato da challenge Vercel↔proxy sandbox: scoperto e diagnosticato). Passano TUTTI i flussi contro Neon popolato: auth Better Auth (role ADMIN, createdAt=seed) · `dashboard.overview` · `product.search` **testuale+ibrida** (semantica «maniglia con chiave…» → A50107\* per solo vettore vec≈0.72) · **chat tool-use** (Gemini cita 5 codici reali) · **kit ARTECH golden** `KIT-2026-0001` **16 righe/21 pezzi/90,20€** zero warning · `settings.aiKeys.status` (Gemini da env). Creati dati test in staging (1 conv + KIT-2026-0001). **Resta solo Task 9** (docs + scelta fase successiva). | `claude/handoff-review-irs3gv` |
| 2026-07-12 | **Fase 1g — kit multi-materiale (SDD subagent-driven)**: spec+piano approvati + **LLM Council** (4/4 → Opzione C: `kit-shared` meccanica condivisa, moduli per-materiale isolati). 5 task TDD (7 commit `b51aa11→544d94c`, **PR #15**, gate verdi): (1) fix LEGNO chiusure supplementari opzionali (default off); (2) estrazione `kit-shared.ts` (refactor puro); (3) modulo **PVC provvisorio** (cert ift, `//ASSUNZIONE`) + scheda esperto; (4) **ALLUMINIO gated** — scoperto che il listino 2026 NON ha composizione alluminio («PLANA»=cerniera complanare legno/PVC, non alu, assunzione piano falsificata) → modulo rifiuta + `isActive:false` + domande esperto; (5) colonna `KitRequest.supplementary_closures` + migrazione + wiring `kit.generate` + wizard (PVC on/provvisorio, ALLUMINIO off, toggle). Task 1-3 review individuali *Approved*; Task 4-5 fatti inline (session limit) + review finale inline. **Resta**: merge PR #15 · `migrate deploy`+`db:seed:kit` su Neon al deploy · validazione esperto (`docs/superpowers/kit-assunzioni/`). | `claude/handoff-review-irs3gv` (PR #15) |
| 2026-07-25 | **BONIFICA KIT ARTECH LEGNO** (8 task TDD, un commit per task, dopo il merge #32): studio di tutti i moduli kit contro il **listino AGB 2026** → dei 4 template attivi, **3 producevano distinte non ordinabili**. **PVC spento** (i 4 codici material-specific esistono solo nelle pagine-certificato ift p0013 (11)/p0395 (393), senza prezzo; altri 7 dedotti per simmetria non esistono affatto) · **battente spento** (schema p0416 (414) = 21 voci, il modulo ne generava 5: mancava la **sospensione superiore**; schema composito → terna cerniere non decidibile) · **pilota corretto** (supporto cerniera `A50801.01.0N`→**`A50805.05.DX/.SX`**, banda cremonese GR02 610, descrizione incontro ribalta 9x18) · **guardia `assertPilotGeometry`** (aria/interasse/battuta/sede erano raccolti e ignorati) · **vasistas riscritto** dallo schema p0418 (416): forbici per **LBB**, via DSS+incontro DSS, dentro le **cerniere** (voci 10-11-12) e il 2° terminale, `sashWeightKg` opzionale per le NB sul peso → golden **13 righe/19 pezzi** · **parser catalogo allargato** ai segmenti alfanumerici (**+1.297 codici a prezzo, 6.191→7.488**) · schede `kit-assunzioni/` riscritte come esito + nuova `legno.md` con l'indice **globale** delle 10 domande per l'esperto. Attive: **anta-ribalta LEGNO + vasistas LEGNO**. Gate: typecheck·lint·**test 589/11 skip**. Verifica browser wizard desktop+375px (8 screenshot). **AZIONI OPS AL MERGE**: «Ops — Neon» completo (migrazione `kit_sash_weight` + **RE-IMPORT catalogo** + `db:seed:kit` + embed) e audit `kit_requests`. | `claude/kit-engine-study-wfo2hq` → PR #33 + #34 mergiate |
| 2026-08-01 | **CAMBIARE LE VARIANTI DOPO LA CREAZIONE** (8 task TDD): «Modifica componenti» sulla scheda riapre il wizard precompilato su `?da=<id>`; al conferma nasce una nuova versione. Contratto `ricalcola({kitRequestId, variants?})` — assente eredita · `{}` **resetta** (scrive NULL) · oggetto **sostituisce**; il reset non è inventato (le 5 chiavi erano già `.optional()` in uno `.strict()`), dichiararlo impedisce che l'operazione sia a senso unico. Solo «Componenti» editabile — la firma **congela la geometria**, quindi la combinazione mai validata è **irrappresentabile**. Validazione = **motore in memoria prima di ogni scrittura**. Idratazione via **`kitInputFromRequest`**, la stessa del motore (solo `engine.ts` ha `server-only`): niente secondo percorso di lettura. «Ricalcola» → **«Nuova versione»**. `ComponentiRibalta` + `RadioOption` estratte (insieme: separarle chiudeva un ciclo). **Chiuso il buco trovato nella verifica funzionale della #47**: `110,13 €` non era asserito da nessun test, e i tre totali bilico stavano dietro `toBeGreaterThan(0)`. Difetto colto dai test: `??` faceva ricadere il reset sull'ereditarietà. **Quattro difetti trovati dalla review di branch coi gate tutti verdi**: un **refetch** cancellava le varianti appena scelte (structural sharing di react-query e `Date`), la validazione copriva solo il ramo con `variants` (due righe morte su PVC/battente), su **bozza** la UI prometteva una versione che non nasce, e la **vasistas** passava il filtro per serie pur non avendo varianti. Gate: typecheck·lint·**test 1.035**·build 18 route · catalogo reale 112 · **browser 22/22 desktop e 375px** (rifatto dopo i fix) col ciclo 90,20 → 110,13 → **ritorno a 90,20**. **NESSUNA AZIONE OPS.** Nuova domanda **31** (il numero identifica la richiesta o la versione?). | `claude/verifica-distinte-reali-8zz9mw` → **PR #48** |
| 2026-07-31 | **ANTIEFFRAZIONE + VARIANTI COMPONENTE** (10 task TDD, un commit per task): le due domande senza risposta nel listino (il «fungo» è per sede 30? viti inclinate o dritte?) diventano **scelte dell'agente** nel nuovo passo **«Componenti»** del wizard, per indicazione esplicita dell'utente → **domande 2 e 30 CHIUSE** senza essere risposte. Registro `artech-varianti.ts` (**74 codici** scritti per esteso, verificati sul catalogo reale) · colonna `kit_requests.variants JSONB` (migrazione `20260731143758_kit_variants`, nessun backfill, NULL = standard) · **garanzia in due strati** contro la variante inerte (`RuleModule.varianti` obbligatorio + `no-silent-fields` derivato dal modulo) · ciclo di import sciolto col file foglia `varianti-schema.ts` + regola ESLint. Il **fungo resta fuori**: il listino lo lega alla sede 30 nei due versi, che il motore rifiuta a monte. Golden invariato **16 righe/21 pezzi/90,20 €** (ora asseriti anche ordine righe e 16 descrizioni); antieffrazione completa **17/22/110,13 €**. Gate: typecheck·lint·**test 992**·build 18 route · **integration 111 eseguiti** · browser 33+10 check (desktop e 375px). **AZIONE OPS: «Ops — Neon» sul ref del branch PRIMA del merge** — senza la colonna si rompono le **letture** di `kit.get`/`generate`/`ricalcola` **e `dashboard.overview`** (`dashboard.ts:40`, `findMany` senza `select`), cioè la pagina d'ingresso di tutti gli agenti; nessun re-import. **Le varianti non si cambiano dopo la creazione** (si rifà il wizard): da dire agli agenti. | `claude/antieffrazione-feature-dv8d37` → **PR #47 MERGIATA**, ops run `30659737114` |


---

## PROMPT PER LA PROSSIMA SESSIONE

```
Nuova sessione. Riparti leggendo handoff.md (§«RIPRENDI DA QUI») e CLAUDE.md.

WORKFLOW (regole permanenti CLAUDE.md): /using-superpowers → brainstorming →
/llm-council per dubbi, incongruenze o scelte architetturali → /impeccable per
OGNI schermata (SEMPRE mobile ≤375px + desktop) → /writing-plans → esecuzione
TDD con subagent-driven-development; /ponytail ogni volta che scrivi codice.

VINCOLI: TypeScript strict, API via tRPC, query via Prisma (raw SQL solo in
RAGEngine), UI in italiano, codici prodotto in font mono, mobile-first. E la
regola che vale doppio adesso: NON TOCCARE LA SEZIONE FINESTRE. Catalogo AGB,
assistente, kit, clienti restano esattamente come sono.

CONTESTO: la sessione scorsa ha aperto un SECONDO DOMINIO. Andrea (magazzino)
ha chiesto un archivio delle maniglie che dica se una sono in pronta consegna
o da ordinare. Il /llm-council ha deciso: STESSO REPO, dominio affiancato,
tabelle proprie, MAI la tabella Product. Spec completa e già approvata in
docs/superpowers/specs/2026-08-03-archivio-pronta-consegna-design.md — leggila
per intera prima di propormi qualcosa: contiene i dati veri misurati (3.456
codici a listino, 201 in pronta consegna, 23 orfani già classificati, il
catalogo ER MAN 2026 all'85%, il prezzo da arrotondare a 2 decimali) e le
risposte di Andrea, che NON vanno richieste.

Il passo 0 è FATTO e mergiato (o in PR): cancellata la disponibilità falsa che
l'app affermava su tutti e 7.488 i prodotti AGB.

SI COMINCIA DA QUI — IL SELETTORE DI PROGRAMMA.
Voglio che la prima schermata dopo il login sia un selettore fra i programmi:
oggi «FINESTRE» (tutto l'esistente) e «MANIGLIE» (il nuovo), domani forse
altri. Serve a rendere visibile il distacco fra i due mondi.

Prima di scrivere codice: la spec §8.0 elenca TRE strade (route selettore
sopra l'esistente / due gruppi di route affiancati / commutatore in sidebar) e
la tensione da sciogliere — un selettore È una modifica al guscio di
navigazione, quindi le finestre non cambiano funzionalità ma cambiano
contenitore. Portalo a /llm-council, poi a /impeccable per il disegno, mobile
375px e desktop, e solo dopo /writing-plans.

POI, il dominio maniglie, nell'ordine della spec §11:
 1. modello dati (Article + StockImport + StockLine) e import listino da script
    ops — È L'UNICA MIGRAZIONE, e va lanciata sul ref del branch PRIMA del
    merge (lezione della PR #40: venti minuti di produzione rotta)
 2. ricerca e scheda articolo — due stati per l'agente, la data dell'ultimo
    import sempre accanto, il prezzo arrotondato a 2 decimali
 3. upload della pronta consegna in-app (route ADMIN, .xls con SheetJS dal CDN,
    riepilogo con gli orfani PRIMA di confermare, annulla ultimo import)
 4. arricchimento da catalogo ER: pagina + foto su VERCEL BLOB, mai in Postgres

Sul disegno delle schermate maniglie hai CARTA BIANCA, a un vincolo: stesso
stile del software esistente (DESIGN.md).

DA VERIFICARE ALL'INIZIO, non a metà:
 - lo storage attuale su Neon (dashboard → Storage). Se supera 400 MB su 500,
   le foto AGB vanno spostate su Blob PRIMA di aggiungere COLOMBO.
 - se il passaggio a Vercel Pro è stato fatto (era previsto per sabato 08/08):
   Hobby VIETA l'uso commerciale, e questo è un gestionale aziendale.
 - se Andrea ha portato il LISTINO AGGIORNATO: quello che abbiamo è vecchio, e
   col nuovo 18 dei 23 orfani spariscono da soli.

AMBIENTE (costa tempo se lo scopri dopo):
 - il container arriva senza node_modules e senza .env: `pnpm install`, poi
   `cp .env.example .env` con segreti veri, poi
   `bash scripts/setup-prisma-engines.sh`, poi `pnpm prisma generate`.
 - Docker MUORE da solo più volte per sessione:
   `setsid nohup dockerd > /tmp/dockerd.log 2>&1 & disown` e `docker start
   ufptrade-db` prima di sospettare qualunque altra cosa.
 - `bash scripts/dev-bootstrap.sh` monta Postgres+Redis, migra e semina;
   `pnpm db:seed:catalog` dà 50 prodotti veri SENZA il PDF da 39 MB.
 - le distinte kit in locale mostrano «Codice … non a listino»: è il seed da 50
   prodotti, NON una regressione.
 - Playwright non è nel progetto: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm add
   -D playwright`, Chromium in /opt/pw-browsers/chromium-1194/chrome-linux/chrome,
   e RIMUOVILO prima di committare.
 - PUSHA PRESTO: il container ha perso la copia locale del repo a metà sessione.

NON ROMPERE: il golden del kit resta 16 righe / 21 pezzi / 90,20 €, gemello a
entrata 7,5 96,29 €, antieffrazione 17 / 22 / 110,13 €, bilico 450,03 · 766,51
· 433,46 €. E fai SEMPRE una review indipendente del branch prima della PR: in
questa sessione ne ha trovati di reali con tutti i gate verdi.
```

---

## PROMPT (STORICO — sessione 2026-08-01, superato)


```
Nuova sessione. Riparti leggendo handoff.md (§«RIPRENDI DA QUI») e CLAUDE.md.

WORKFLOW (regole permanenti CLAUDE.md): /using-superpowers → brainstorming →
/llm-council per dubbi o incongruenze sulle regole di distinta → /impeccable se
tocchiamo UI (SEMPRE mobile ≤375px + desktop) → /writing-plans → esecuzione TDD;
/ponytail ogni volta che scrivi codice.

VINCOLI: TypeScript strict, API via tRPC, query via Prisma, UI in italiano,
codici prodotto in font mono, mobile-first — e soprattutto: il KIT È UN ENGINE
DETERMINISTICO TypeScript, MAI un LLM.

STATO: verifica tu la PR e i run ops invece di fidarti dell'handoff. La sessione
scorsa ha chiuso «cambiare le varianti dopo la creazione» sul branch
claude/verifica-distinte-reali-8zz9mw (PR #48). NON c'erano migrazioni né
azioni ops: la colonna `variants` è su Neon dalla #47. Se la PR è ancora aperta,
il primo passo è mergiarla; se è mergiata, NON serve nessun run ops — basta una
verifica funzionale al volo (sotto) e si parte col lavoro nuovo.

═══ VERIFICA FUNZIONALE (un minuto) ═══
/richieste/nuova → aria 12 · interasse 13 · battuta 20 · entrata 15 · mano
sinistra · chiusure ON → «Genera kit» → devono uscire 16 righe / 21 pezzi /
90,20 €. Poi sulla scheda: «Modifica componenti» → accendi ANTIEFFRAZIONE →
«Genera nuova versione» → 17 righe / 22 pezzi / 110,13 € su un NUMERO NUOVO, e
la vecchia deve dire di essere stata ricalcolata. Infine rifai «Modifica
componenti» → «Normale» → si torna a 90,20 € (è il reset: prova che
l'operazione non è a senso unico).

═══ POI, IN ORDINE DI VALORE ═══
(a) LE TRE DISTINTE REALI di MC, Peruzzi e Fosca — aperta da SEI sessioni, vale
    più di tutto il resto. I tre clienti sono in anagrafica su Neon con la loro
    geometria: basta generare la distinta dal wizard e metterla a fianco della
    foto di un ordine vero (serve un'altezza DIVERSA da 1820, altrimenti la
    formula «corsa = altezza − 420» resta una retta tirata per un punto solo).
    Ora servono anche a dire quale SQUADRA ANGOLARE e quale INCONTRO RIBALTA
    ordinano davvero: le varianti sono scelte che il programma mostra, ma
    nessuno le ha mai confrontate con un ordine vero.
(b) DOMANDA 31 (in kit-assunzioni/DOMANDE-APERTE.md): il numero di richiesta
    identifica la richiesta o la VERSIONE? Oggi ogni ricalcolo conia un numero
    nuovo, quindi KIT-2026-0042 e 0043 possono essere lo stesso serramento — e
    da oggi versionare è un'operazione ordinaria. La decide l'ufficio
    commerciale, non il codice. Se la risposta è «numero stabile + versione»,
    serve una colonna `version` e una migrazione, e si sblocca il confronto
    v1→v2 (quanto costa l'antieffrazione su QUEL serramento).
(c) DOMANDA 4 (sede 18 o sede 30): sbloccarla fa entrare il «nottolino a fungo»,
    che oggi resta fuori perché il listino lo lega alla sede 30 nei due versi e
    il motore la rifiuta a monte. Richiede l'incontro DSS 13x30, che a listino
    non è pubblicato → serve AGB.
(d) Debiti: preview Vercel rotte su OGNI PR (ipotesi mai smentita: env solo per
    Production e non per Preview — nessun codice da scrivere, ma senza preview
    non abbiamo collaudo) · `requestNumber` con `count()+1` su colonna `@unique`
    (vedi la nota tecnica nei debiti: il retry «da cinque righe» NON funziona) ·
    «Visualizza nel listino» per singola opzione (ora che `RadioOption` è un
    file suo costa meno) · `no-silent-fields` non legato a `RULE_MODULES` ·
    `dedupeRows` last-wins in map-product.ts.

NON rompere il golden: 16 righe / 21 pezzi / 90,20 €, gemello entrata 7,5 a
96,29 €, antieffrazione completa 17 righe / 22 pezzi / 110,13 €, e i tre bilico
450,03 / 766,51 / 433,46 €. Il gate su catalogo reale li asserisce TUTTI per
davvero, insieme all'ordine assoluto delle righe e alle 16 descrizioni.

LISTINO: il PDF AGB 2026 NON è nel container, scaricalo dal link in CLAUDE.md
(§FILE ESTERNI). Serve poppler-utils (`sudo apt-get update && sudo apt-get
install -y poppler-utils` — l'update PRIMA, altrimenti il download dà 404).
Pagina fisica = stampata + 2. Le legende degli schemi stanno DENTRO il disegno:
nel testo estratto NON compaiono, vanno renderizzate (pdftoppm -r 150 -png) e
GUARDATE.

AMBIENTE (ti fa risparmiare un'ora):
- Postgres MUORE da solo in questo container: `docker ps` prima di ogni comando
  che tocca il DB. Se un test gated risulta «skippato» senza ragione è quello,
  non la variabile d'ambiente (costato dieci minuti la sessione scorsa).
  Riavvio: `(setsid nohup dockerd > /tmp/dockerd.log 2>&1 & disown)` poi
  `docker compose up -d`.
- Chromium C'È in /opt/pw-browsers; manca solo il pacchetto `playwright`, che
  NON è dipendenza del progetto. Installalo FUORI dal repo (scratchpad):
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright`.
- `pnpm build` scrive nella STESSA .next del server `pnpm dev`: non lanciarli
  insieme. Rimuovi .next e riavvia con `setsid nohup pnpm dev …`.
- Prima di prisma/tsx: `set -a; source .env; set +a`. Engine Prisma:
  `bash scripts/setup-prisma-engines.sh`. Catalogo: `pnpm import:agb <pdf>`
  (~3 min, 7.488 prodotti), poi `pnpm db:seed` e `pnpm db:seed:kit`.
- Gate su catalogo reale (senza la variabile passa A VUOTO):
  `INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm vitest run
   src/server/kit/codici-a-listino.integration.test.ts
   src/server/kit/engine.integration.test.ts`
- FAI SEMPRE una review indipendente del branch prima di aprire la PR: la
  sessione scorsa ha trovato QUATTRO difetti reali con typecheck, lint, 1.029
  test e browser 22/22 tutti verdi.
```
