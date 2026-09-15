# Prompt di apertura — prossima sessione

> Copia il blocco fra le righe e incollalo come primo messaggio.
> Aggiornato il **2026-09-15**, a chiusura della sessione «listino Vision 2026».
>
> La prossima sessione si apre su una **decisione** (come ritrovare gli archivi
> fotografici, ora che COLOMBO ha rifatto il sito), non su un'esecuzione: la
> diagnosi è già chiusa, quel che manca è scegliere.

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

La password dell'area download COLOMBO la fornisco io a richiesta: non va
scritta in nessun file. In CI sta nel secret COLOMBO_DOWNLOAD_PASSWORD.

═══ PUNTO 1 — L'ARCHIVIO FOTOGRAFICO NON HA PIÙ UN INDICE ═══

I 240 articoli del listino Vision 2026 sono in catalogo e i cinque archivi
fotografici dei prodotti nuovi hanno un'etichetta in `foto-archivio.ts`. Ma
«Ops — Foto COLOMBO» NON gira più: run 34965121210, fallita in 29 secondi.

GIÀ DIAGNOSTICATO IL 15/09 — NON RIFARLO:
 · NON è il proxy della sandbox: fallisce identico sul runner GitHub.
 · NON è la password: con `mostra.php?lang=en&catalogo=NNN` la POST risponde
   con i PDF di tutte e 29 le categorie.
 · NON sono spariti i file: `curl -r 0-99` su
   `/download/maniglie/archivio/<chiave>.zip` dà `206 application/zip` su
   tutti, i cinque del 2026 compresi (00a_Laconica, 00b_Robot6, 00c_Robot6S,
   00d_Halo, 00e_Kubo). Non sono nemmeno protetti da password.
 · È IL SITO: `download.colombodesign.com/` non è più un elenco piatto ma un
   indice di 29 categorie. Interrogate tutte con la password: 29 link, tutti
   `.pdf`, ZERO `.zip`. L'indice dell'archivio non è più pubblicato da nessuna
   parte. `elencaArchivi()` (scripts/foto-colombo.ts:57-72) raschiava
   quell'elenco; non c'è più niente da raschiare.

LA DECISIONE (è il motivo per cui non l'ho sbrigata in coda alla PR):
la lista si PUÒ derivare da `ARCHIVI` verificando ogni voce con una Range —
i 118 nomi sono già nel repo, quindi non si rivela nulla di nuovo. Ma:
 (a) si perde la riga «⚠️ archivio non in tabella, ignorato», che oggi è
     l'UNICO modo in cui veniamo a sapere che COLOMBO ha pubblicato un
     prodotto nuovo — ed è esattamente il segnale che ha fatto nascere la
     sessione del listino 2026. Perderlo per guadagnare le foto di quei
     prodotti sarebbe una beffa. Cercare se un segnale equivalente esista
     altrove (le pagine `mostra.php` elencano i PDF: un listino nuovo lì si
     vede?) è parte della domanda, non un extra.
 (b) la password diventa codice morto per l'archivio (resta viva per i PDF):
     il commento in testa a foto-colombo.ts va riscritto, non lasciato a
     dire una cosa che non è più vera.
 (c) quel commento dice anche «nessun elenco di nomi del fornitore dentro un
     repo pubblico», ed è GIÀ mezzo falso: le 118 chiavi di ARCHIVI sono nomi
     di cartelle del fornitore, nel repo, da mesi. Da riscrivere per dire ciò
     che davvero protegge (i BYTE delle foto, non i nomi).
Portala a /llm-council verificando nel repo le affermazioni degli advisor.

Poi: girare il gate della copertura (vuole COLOMBO_FOTO_INDEX, si produce con
`pnpm foto:colombo --dry-run --dump`) e il run ops. Atteso: i cinque modelli
2026 prendono copertina e foto di riga; le 1.609 esistenti non si muovono.

═══ PUNTO 2 — LE DOMANDE PER COLOMBO ═══
Sono in `docs/superpowers/domande-colombo.md`, pronte da mandare, con la
misura dietro ciascuna. Dimmi quali ho ricevuto e le applichiamo:
 · C1 (HPS/1: `I1` o `HPS1`?) → fa entrare 19 righe GIÀ misurate, subito.
 · C2 (il 3,5 % vale sul 05/26?) → un solo UPDATE, e la UI smette di dover
   dichiarare due convenzioni.
 · C6 (quale archivio è MR11 e quale MR15) → 66 codici senza foto.

═══ PUNTO 3 — UNA COSA CHE HO LASCIATO DECIDERE A TE ═══
Nelle fixture dei test del listino Vision restano ~5 prezzi VERI di COLOMBO
(`vision-parse.test.ts`, `vision-codici.test.ts`, e un `toBe("53.6")` nel test
d'integrazione). I .md sono già puliti. Sostituirli con numeri di comodo è
meccanico e la suite lo verifica da sé, ma tocca file di test: dimmi se lo
faccio.

═══ APERTE DA PRIMA, non toccate ═══
 · Vercel Hobby vieta l'uso commerciale → passaggio a Pro (era deciso per
   l'08/08 e non risulta fatto). È l'unica con un rischio esterno.
 · Le tre distinte reali di MC, Peruzzi e Fosca: aperta da sessioni, è la
   cosa che vale di più sul reparto serramenti.
 · `familyOf` mette AM15 FISSO e AM25 FISSO nella stessa serie (49 articoli
   preesistenti, dalle descrizioni di COLOMBO): dichiarato, non corretto.
 · `dedupeRows` last-wins in map-product.ts.
 · Preview Vercel rotte su ogni PR.

═══ UNA LEZIONE DA PORTARSI DIETRO ═══
Il run ops è fallito in 29 secondi, al primo passo, senza toccare Blob né il
DB — e quel fallimento pulito È il motivo per cui la diagnosi si è potuta fare
con calma. Una guardia che si rifiuta presto vale più di una che tollera e
prosegue: la seconda avrebbe azzerato `image_url` e poi trovato zero archivi.
```

---

## Se invece vuoi aprire su altro

Il prompt qui sopra è **la continuazione naturale**, non un obbligo. Le altre
strade aperte, in ordine di valore:

| strada                                    | perché                                                          |
| ----------------------------------------- | --------------------------------------------------------------- |
| **Le tre distinte reali** (MC, Peruzzi, Fosca) | aperta da sessioni; senza, i tre clienti principali ricevono distinte mai confrontate con un ordine vero |
| **Vercel Pro**                            | l'unica voce con un rischio esterno (sospensione per uso commerciale su Hobby) |
| **Varianti componente su altre tipologie** | il passo «Componenti» oggi esiste solo per l'anta-ribalta ARTECH |

In quel caso, riusa l'intestazione del prompt (workflow + vincoli) e sostituisci
i tre punti centrali.
