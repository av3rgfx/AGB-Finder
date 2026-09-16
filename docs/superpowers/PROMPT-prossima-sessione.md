# Prompt di apertura — prossima sessione

> Copia il blocco fra le righe e incollalo come primo messaggio.
> Aggiornato il **2026-09-16**, a chiusura della sessione «l'indice dell'archivio
> che non c'è più» ([PR #66](https://github.com/av3rgfx/AGB-Finder/pull/66)).
>
> ⚠️ **La sessione non si apre su una decisione, ma su due cose che aspettano
> una risposta umana**: nove domande per Andrea/COLOMBO — **nessuna ancora
> posta**, da mesi — e una verifica che si può fare solo dopo il merge (che la
> mail del guardiano arrivi davvero). Finché nessuno le porta a casa, il codice
> non può fare altro.

---

```
Nuova sessione. Riparti leggendo handoff.md (§«RIPRENDI DA QUI») e CLAUDE.md.

WORKFLOW (regole permanenti CLAUDE.md): /using-superpowers → /brainstorming →
/llm-council sui dubbi veri, VERIFICANDO nel repo le affermazioni degli advisor
→ /impeccable per ogni schermata (SEMPRE mobile ≤375px + desktop, screenshot
GUARDATI) → /ponytail ogni volta che scrivi codice → spec → piano → TDD, un
commit per task → review indipendente del branch PRIMA della PR.

VINCOLI: TypeScript strict · tutto via tRPC · query via Prisma, regole di
dominio in TypeScript e MAI nel raw SQL · UI in italiano, codici in monospace ·
il repo è PUBBLICO, quindi listino, giacenze e foto del fornitore non si
committano mai, e nei .md vanno solo numeri aggregati · un run ops con
migrazione va lanciato sul ref del branch, prima del merge. E la regola che
vale doppio: NON TOCCARE LA SEZIONE SERRAMENTI (catalogo AGB, assistente, kit,
clienti).

═══ PRIMA DI TUTTO — LE DUE COSE CHE ASPETTANO ME, NON IL CODICE ═══

(1) LE NOVE DOMANDE. Sono in `docs/superpowers/domande-colombo.md`, pronte con
la misura dietro ciascuna, e NON NE HO POSTA NESSUNA. Dimmi quali risposte ho
in mano e le applichiamo subito:
 · C1 (HPS/1: la coda del codice è `I1` o `HPS1`?) → fa entrare 19 righe GIÀ
   misurate del listino Vision 2026, senza altro lavoro. È la più pronta.
   ⚠️ Gli archivi fotografici 2026 scrivono `HPS1` in entrambi i casi, ma è la
   FINITURA, non la coda del codice: sposta il peso, non decide.
 · C2 (il 3,5 % vale sull'edizione 05/26?) → un solo UPDATE, e la scheda smette
   di dover dichiarare due convenzioni di prezzo.
 · C6 (quale archivio è MR11 e quale MR15, idem LC31/LC41 e LC71/LC81) → 66
   codici oggi senza foto di riga.
 · C9 è NUOVA e concreta: l'area download serve `ER MAN 2026_140926.pdf`, la
   copia che usiamo è `_100726`. Se Andrea la scarica nella cartella Drive, si
   misura cosa cambia (è la fonte della mappa nome commerciale → pagina).
 · Le altre: C3 (BT13 −24 %), C4 (EAN), C5 (BT19 BZG due prezzi), C7 (dov'è
   l'indice dell'archivio adesso), C8 (come ci avvisate di un prodotto nuovo —
   la più importante di tutte: quel preavviso ci arrivava per effetto
   collaterale di uno script di conversione immagini).

(2) LA VERIFICA DEL RECAPITO, che si può fare SOLO dopo il merge della #66.
Tutto il valore del guardiano settimanale sta in «un run schedulato rosso manda
la mail al proprietario del repo». È un'ASSUNZIONE, non un fatto misurato:
GitHub la manda a chi ha toccato per ultimo il cron, e quel commit è firmato
Claude. Una volta sola: togliere una voce da `DOCUMENTI`, lanciare «Ops —
Vigila COLOMBO» da workflow_dispatch, CONTROLLARE CHE LA MAIL ARRIVI, rimettere
la voce. Se non arriva, il guardiano è un job rosso che nessuno vede — cioè
esattamente il difetto per cui è nato.
⚠️ `schedule:` e `workflow_dispatch:` funzionano solo dal branch di DEFAULT.

═══ E IL RUN OPS DELLA #66 ═══
🟢 Nessuna migrazione. 🔴 Un run di «Ops — Foto COLOMBO» (~7 min, idempotente).
Atteso, misurato in locale su stato pulito: 79/79 archivi · 707 foto ·
articoli con foto 1.609 → 1.727 · ~16 file nuovi su Blob · i cinque modelli
2026 con copertina e foto di riga (LACONICA 30/30 · ROBOT6 36/36 · ROBOT6 S
36/36 · HALO 5/25 · KUBO 10/30 — gli ultimi due parziali perché è la REGOLA
DELLA FINITURA che lavora, non un difetto).
Secret: `NEON_DIRECT_URL`, non `DATABASE_URL`.

═══ SE VUOI SVILUPPARE, LE STRADE APERTE ═══

 (a) VERCEL PRO. È l'unica con un rischio ESTERNO: il piano Hobby vieta l'uso
     commerciale («restricted to non-commercial personal use only», e la
     definizione include «a paid employee») → rischio sospensione. Era deciso
     per l'08/08 e non risulta fatto. Non è codice, è una decisione tua.

 (b) LE TRE DISTINTE REALI di MC, Peruzzi e Fosca (reparto SERRAMENTI). Aperta
     da sei sessioni ed è la cosa che vale di più: senza, i tre clienti
     principali ricevono distinte mai confrontate con un ordine vero, e la
     formula della corsa delle chiusure resta una retta tirata per un punto
     solo.

 (c) `familyOf` fonde `AM15 FISSO` e `AM25 FISSO` nella stessa serie — 49
     articoli preesistenti, dalle descrizioni di COLOMBO stessa. Dichiarato e
     non corretto: correggerlo solo sulle righe nuove le renderebbe incoerenti
     col fornitore.

 (d) `dedupeRows` last-wins in `map-product.ts` (serramenti) · preview Vercel
     rotte su ogni PR · `ci.yml` esegue SOLO `pnpm test`: la PR #64 che
     aggiungeva `pnpm build` NON è in `main` (verificato il 16/09), quindi un
     errore di TypeScript arriva ancora al merge e lo scopre Vercel, dove le
     preview sono rotte — cioè non lo scopre nessuno.

═══ UN RISCHIO DICHIARATO E NON COPERTO, da non riaprire a caso ═══
Il CONTENUTO di uno zip che cambia sotto lo stesso nome (un file rinominato,
uno scatto sostituito). È la forma di cambiamento più probabile, e l'unica spia
resta `FOTO_ATTESE`, che è un TOTALE GLOBALE: due variazioni opposte si
compensano. Il rimedio esiste — un'impronta sha256 dei nomi — ed è stato
scartato per costo: vuole una costante che cambia a ogni ritocco del fornitore
più un flag di ratifica, su un run che gira qualche volta al mese. Se capita
una volta, si fa. Non rifare la valutazione da zero: sta in
`docs/superpowers/specs/2026-09-16-indice-archivio-colombo-design.md` §3.2 e §7.

═══ DUE LEZIONI DA PORTARSI DIETRO ═══
 · IL GATE D'INTEGRAZIONE SPORCA IL DB. `search.integration.test.ts` chiama
   `seedManiglie` quattro volte e fa `article.upsert`: due misure della stessa
   cosa a dieci minuti di distanza hanno dato 1.728 e 1.725, e la differenza
   NON era il fornitore, era il nostro gate. Un numero da pubblicare si misura
   su uno stato pulito (cancellare gli articoli COLOMBO, reimportare listino +
   Vision, misurare, NON girare i gate dopo).
 · UN COMMENTO SBAGLIATO SOPRAVVIVE A UNA CORREZIONE. Ho riscritto la frase sul
   confine del repo pubblico e ne ho corretto metà, lasciando falsa l'altra
   (`FILE_MODELLO` contiene 15 nomi di file del fornitore). L'ha trovata la
   review di branch, non i gate. Quando correggi un'affermazione, verifica
   TUTTA l'affermazione.
```
