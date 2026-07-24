# Handoff — UFPtrade WebApp

> Creato/aggiornato da Claude alla fine di ogni sessione per riprendere il lavoro
> senza perdere contesto. (Regola permanente: aggiornare tutti i `.md` a fine sessione.)

---

## Sessione attuale

| Campo | Valore |
|-------|--------|
| **Data** | 2026-07-24 (sessione UX Archivio — PR aperta, da mergiare) |
| **Fase in corso** | Fase 1 — MVP Gestionale |
| **Sotto-fase** | …**IMMAGINI PRODOTTO ✅ (#27)** · **UX ARCHIVIO ✅ (branch `claude/archivio-ux-persistence-aj3zvy`, PR aperta)**: persistenza ricerca (URL+localStorage) · ritorno-alla-lista con scroll (verificato browser) · cronologia 7gg · thumbnail/chip/empty-state. |
| **Branch git** | **PR #25–#27 MERGIATE.** Corrente: **`claude/archivio-ux-persistence-aj3zvy`** (da `origin/main`, 13 commit, pushato) — **PR aperta, attende merge (chiedere ok utente prima di mergiare).** |
| **Stato deploy** | **LIVE** su `catalogo-finder-kappa.vercel.app`. UX Archivio: **NESSUNA azione ops** al merge (no migrazione, no dep, no env) → deploy Vercel standard. |
| **Piani/spec** | `docs/superpowers/{specs,plans}/2026-07-24-archivio-ux*` · `…-immagini-prodotto-design.md`. |

> **▶ RIPRENDI DA QUI — UX Archivio ✅ (branch `claude/archivio-ux-persistence-aj3zvy`, PR APERTA, da mergiare).**
>
> **Cosa è stato fatto (13 commit TDD, gate verdi typecheck·lint·test 369·build, verifica browser desktop+mobile):**
> - **Persistenza** (req.1): `query`/`filtri`/`pagina` negli **URL searchParams** (letti `useSearchParams` sotto
>   `<Suspense>` in `archivio/page.tsx`; scrittura `router.replace(…,{scroll:false})`); **vista** in `localStorage`.
> - **Ritorno-alla-lista con scroll** (req.2, priorità #1): snapshot `scrollY` per-chiave in `sessionStorage`
>   (`src/lib/archivio-scroll.ts`), `history.scrollRestoration='manual'`, ripristino `rAF` una volta dopo i dati in
>   cache. **Salvataggio su `pointerdown` (cattura) + `pagehide`** — MAI su `scroll`/unmount (Next scrolla in cima
>   aprendo il dettaglio → salverebbe 0: bug scovato in verifica browser e corretto).
> - **Cronologia 7gg** (req.3): `product.recentSearches` read-side su `ActivityLog` (`src/lib/recent-searches.ts`) →
>   «Ricerche recenti» nell'empty-state.
> - **Extra**: thumbnail card/righe (riservate; `ProductImage` esteso con `fallback` + `ProductThumb`), chip filtri
>   attivi + azzera, empty-state con suggerimenti. Hook `use-archivio-search.ts`; moduli puri con test.
> - Spec+piano: `docs/superpowers/{specs,plans}/2026-07-24-archivio-ux*`. Critica adversariale 3-lenti recepita
>   (Suspense, race scroll nativo, reset pagina, YAGNI): vedi §12 della spec.
>
> **FOLLOW-UP (stesso branch, estende PR #29) — le 4 idee prima fuori scope, tutte ✅ (verifica browser 12/12):**
> - **(A) Scorciatoia `/`** → focus ricerca (`is-editable-target.ts`; `Esc` sfoca; hint `<kbd>` desktop).
> - **(B) «Copia link»** dell'URL della ricerca (feedback «Copiato»).
> - **(C) «Visti di recente»** via `localStorage` (`recently-viewed.ts`, dedup/cap 8; registrato in `product-detail`;
>   rail nell'empty-state).
> - **(D) Pulsante listino su card/righe** (stretched-link; `listinoPage` già in `product.search`; sulla riga solo
>   desktop). Gate verdi (**test 380**). Spec/piano: `…2026-07-24-archivio-ux-follow-up*`. **Nessuna azione ops.**
>
> **➡ PROSSIMI PASSI:** 1) **mergiare la PR** (chiedere ok utente). **NESSUNA azione ops** (no migrazione/dep/env)
> → deploy Vercel standard. 2) Verifica UI reale in produzione (le thumbnail useranno le foto vere di `product_images`).
> 3) Scelta fase successiva = decisione utente. Idee UX rimaste (non richieste): scorciatoia `/`, prodotti visti di
> recente, pulsante «copia link» ricerca condivisibile (l'URL è già condivisibile), pulsante listino sulle card.
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
> 4. **Con l'esperto**: domande in `docs/superpowers/kit-assunzioni/{alu,pvc,battente}.md`
>    (validazione battente provvisorio + sblocco alluminio + conferma PVC); poi bump `version`.
> ⚠️ battente è **PROVVISORIO** (dati derivati dal listino, non validati); golden = snapshot auto-coerente.
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
| ChatProvider | `src/server/ai/providers/{types,gemini,kimi}.ts` | solo fetch (NO SDK); Gemini `generateContent` v1beta, Kimi OpenAI-compatible |
| **AIGateway** | `src/server/ai/gateway.ts` | UNICO punto uscita AI: rate limit → breaker → timeout 30s + 1 retry jitter su 429/5xx → fallback Gemini→Kimi; `embedQuery` (3s, null su errore); `getAIGateway()` singleton da env |
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
- **Gap di catalogo — supporto-cerniera (`A50801.01.xx`)**: il listino 2026
  non ha una variante "Supporto cerniera — Parte telaio" per aria 12/interasse
  13/battuta 20 (i parametri del golden); esistono solo due varianti "Aria 4"
  (`A50801` int.9/battuta18, `A50803` int.8,5/battuta15). Pinnato `A50801`
  (più vicino su entrambi gli assi di confronto) — **da verificare con AGB**
  prima di fidarsi in produzione: potrebbe mancare a catalogo un codice
  interasse13/battuta20 dedicato.
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
- [ ] **Key Moonshot API platform** per il fallback Kimi (quella "Kimi Code" dà 401)
- [X] Merge 1c su `main` (2026-07-04, merge locale + push; suite verde sul risultato)

### Da Fase 1d
- [ ] **Verificare con AGB il supporto-cerniera** `A50801.01.xx` pinnato per
  aria 12/interasse 13/battuta 20 (gap di catalogo — vedi Decisioni 1d): non
  esiste una variante dedicata nel listino 2026, va confermato col tecnico o
  con una prossima distinta reale.
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
- [ ] Fallback Kimi (key Moonshot platform) · finiture coperture · regole PVC/ALLUMINIO.

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
| Kit engine (1d) | [X] Pilota ARTECH anta-ribalta LEGNO completo; golden 16 righe verificato su catalogo reale + browser (vedi «Fase 1d») |
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
