# Prompt di apertura — prossima sessione

> Copia il blocco qui sotto e incollalo come primo messaggio.
> Allega, se li hai, i tre file di Andrea (vedi in fondo).

---

Ciao. Riprendiamo UFPtrade. Leggi prima `handoff.md` (§RIPRENDI DA QUI) e
`docs/superpowers/specs/2026-08-04-catalogo-maniglie-sfoglia-design.md`.

**Dove siamo.** Il reparto MANIGLIE è vivo sul branch `claude/program-selector-yxw8zd`
(passi 1-3 + selettore di reparto, migrazione già applicata a Neon col run ops
`30848665038`). Nella scorsa sessione ho chiesto un **catalogo digitalizzato sfogliabile**
e tu hai fatto l'analisi senza scrivere codice: il verdetto è che il bisogno è reale ma
l'albero `marca → sottocategoria → prodotto` non è costruibile, e va rovesciato in **una
schermata sola, un livello solo**, costruita sulla **prima parola della descrizione del
listino**.

**Rispondo alle sei domande di §10 della spec:**

1. Chi sfoglia davvero (Andrea col magazzino, o l'agente col cliente davanti)?
   → **[RISPONDI QUI]**
2. I tre file veri: te li allego? Quali?
   → **[RISPONDI QUI]**
3. I clienti chiedono per nome commerciale («la LARA») o per codice?
   → **[RISPONDI QUI]**
4. Esiste un documento COLOMBO con la corrispondenza sigla→finitura (`CM`, `NM`, `OL`)?
   → **[RISPONDI QUI]**
5. Lo schermo si mostra al cliente o resta fra colleghi?
   → **[RISPONDI QUI]**
6. Le altre marche (HOPPE, OLIVARI, DND, GHIDINI) hanno un listino con un campo categoria?
   → **[RISPONDI QUI]**

**Cosa voglio da questa sessione**, nell'ordine:

1. **Le cinque misure di §7 sul listino vero** — script, zero UI. Soprattutto: **quante
   prime parole distinte esistono sui 3.456 codici?** Se sono ≤ 40 la strada regge; se sono
   ~300 muore e me lo devi dire subito, prima di costruirci sopra.
2. Se la misura regge: **«Sfoglia»** come da §6 — un livello, dentro `/maniglie`, elenco
   `TIPOLOGIA · numero di codici`, filtro come chip nell'URL, stesso componente riga della
   ricerca. Chiudendo i due debiti dichiarati: **`offset` collegato** e **ripristino dello
   scroll riusando `src/lib/archivio-scroll.ts`** (non reinventarlo).
3. La fascia della data **sticky** nell'elenco filtrato: in una lista lunga il banner esce
   dallo schermo e resterebbero pallini verdi senza data.

**Vincoli che non voglio vedere violati** (sono in `CLAUDE.md`, li ripeto perché contano
qui): niente regexp sul codice per dedurre modello o categoria · niente scraping del sito
COLOMBO · **niente schermata «scegli la marca» finché la marca è una** · nessuna
disponibilità senza la data dell'ultimo import · mobile-first verificato a 375px in browser
vero · UI in italiano, codici in monospace.

**Workflow:** usa `/using-superpowers`, poi `/brainstorming` se serve chiarire, poi
`/writing-plans` e TDD. Usa `/ponytail` mentre scrivi. Usa `/impeccable` per la UI, in
versione mobile **e** desktop. Se emerge un dubbio architetturale vero, `/llm-council`.

**Ricorda:** finché i file veri non ci sono, il dominio gira su **20 articoli inventati** e
qualunque prototipo di sfoglio funzionerà benissimo senza dire nulla sugli altri 3.436. Se
non te li ho allegati, **chiedimeli invece di procedere**.

---

## File da allegare

| File | A cosa serve | Stato |
|---|---|---|
| Listino COLOMBO aggiornato (`.xlsx`) | le cinque misure, l'import vero, la tassonomia | Andrea doveva procurarlo |
| Pronta consegna (`.xls`) | collaudo dell'aggancio e degli orfani | esiste (201 codici) |
| `ER MAN 2026_100726.pdf` | passo 4: pagina tecnica, foto, nome commerciale | esiste, 261 pagine |

## Altri fronti aperti (non bloccanti)

- **Vercel Pro entro sabato 2026-08-08** (Hobby vieta l'uso commerciale).
- Storage Neon al 72-80%: causa unica sono le 7.082 foto AGB **dentro Postgres**.
- Le **tre distinte reali** di MC, Peruzzi e Fosca (aperta da più sessioni).
- Passo 4 del dominio maniglie (foto su Blob, **ridimensionate all'estrazione**).
