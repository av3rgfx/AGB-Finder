// Genera «Domande-aperte-distinte-AGB.docx» dal contenuto di DOMANDE-APERTE.md.
// Uso:  npm i docx  &&  node genera-docx.js "Domande-aperte-distinte-AGB.docx"
// Aggiornare QUI quando cambiano le domande, poi rigenerare: il .docx non si edita a mano.

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  PageBreak, LevelFormat, convertInchesToTwip,
} = require("docx");
const fs = require("fs");

const INK = "1C2833";
const SUBTLE = "566573";
const ROSSO = "A93226";
const AMBRA = "B9770E";
const GRIGIO = "5D6D7E";
const LINEA = "D5D8DC";
const FONDO = "F4F6F7";

const W = 9026; // larghezza utile A4 con margini da 1"

const p = (text, o = {}) =>
  new Paragraph({
    spacing: { after: o.after ?? 120, line: 276 },
    alignment: o.align,
    indent: o.indent,
    children: [new TextRun({ text, bold: o.bold, italics: o.italics, color: o.color ?? INK, size: o.size ?? 21, font: "Calibri" })],
  });

/** Paragrafo con più run (per grassetti in linea). */
const rich = (runs, o = {}) =>
  new Paragraph({
    spacing: { after: o.after ?? 120, line: 276 },
    indent: o.indent,
    children: runs.map((r) =>
      typeof r === "string"
        ? new TextRun({ text: r, color: INK, size: 21, font: "Calibri" })
        : new TextRun({ color: r.color ?? INK, size: r.size ?? 21, font: r.mono ? "Consolas" : "Calibri", ...r }),
    ),
  });

const h1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINEA, space: 6 } },
    children: [new TextRun({ text, bold: true, color: INK, size: 30, font: "Calibri" })],
  });

const h2 = (text, colore) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 100 },
    children: [new TextRun({ text, bold: true, color: colore ?? INK, size: 24, font: "Calibri" })],
  });

/** Riquadro di richiamo: paragrafo con sfondo e bordo sinistro spesso vietato → bordo completo leggero. */
const box = (righe, colore) => [
  new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: colore },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: colore },
      left: { style: BorderStyle.SINGLE, size: 4, color: colore },
      right: { style: BorderStyle.SINGLE, size: 4, color: colore },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: W, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: FONDO },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: righe,
          }),
        ],
      }),
    ],
  }),
];

const cell = (children, w, opts = {}) =>
  new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    verticalAlign: "center",
    children,
  });

const th = (t, w) => cell([p(t, { bold: true, size: 18, color: "FFFFFF" })], w, { fill: "34495E" });
const td = (t, w, o = {}) => cell([p(t, { size: 18, bold: o.bold, color: o.color })], w, { fill: o.fill });

// ─────────────────────────────────────────────────────────── tabella di sintesi
const COLS = [620, 4180, 1500, 2726];
const SINTESI = [
  ["1", "Battente: quali cerniere per l'anta singola?", "agente o AGB", "una tipologia intera, oggi spenta", "bloc"],
  ["17", "L'entrata: quale usate?", "agente", "oggi la cremonese è scelta in silenzio", "bloc"],
  ["10", "L'altezza è dell'anta o della maniglia?", "agente", "la cremonese su ogni distinta", "bloc"],
  ["4", "Sede 18 o sede 30?", "AGB", "se il generatore è sulla configurazione giusta", "bloc"],
  ["3b", "Incontri: il formato 13x18 non esiste", "AGB", "un dato falso su ogni richiesta", "bloc"],
  ["6", "Il «listino PVC e ALLUMINIO»", "AGB", "PVC e alluminio insieme", "bloc"],
  ["3a", "Numero di incontri lungo il perimetro", "agente o AGB", "la quantità su ogni distinta", "imp"],
  ["2", "Squadra angolare: quale delle quattro?", "agente", "4 € a pezzo", "imp"],
  ["20", "Cosa è di serie e cosa è opzione", "agente", "sei voci dello schema di montaggio", "imp"],
  ["7", "Finestre basse (maniglia sotto i 60 cm)", "agente o AGB", "configurazioni oggi rifiutate", "imp"],
  ["22", "Quali finiture vendete davvero", "agente", "oggi solo argento", "imp"],
  ["19", "Quali combinazioni ordinate più spesso", "agente", "ordine di priorità del lavoro", "imp"],
  ["23", "La finestra 700×1400 battuta 18 sede 30", "agente", "secondo esempio di riferimento", "imp"],
  ["18", "Dove leggete le quote", "agente", "come impostare le domande del programma", "det"],
  ["21", "Chiusure supplementari: da quale altezza", "agente", "una banda oggi assunta", "det"],
  ["5, 8, 9", "Vasistas: cerniere, terminali, misure piccole", "agente o AGB", "la vasistas è provvisoria", "det"],
  ["11-15", "Bilico TOUR: asta, 2 m², guarnizione, spessori", "AGB", "assunzioni dichiarate", "det"],
  ["16", "(rilievo interno, non si chiede a nessuno)", "—", "un campo raccolto e mai usato", "det"],
];
const TINTA = { bloc: "FDEDEC", imp: "FEF9E7", det: undefined };
const COLORE = { bloc: ROSSO, imp: AMBRA, det: GRIGIO };

const tabellaSintesi = new Table({
  width: { size: W, type: WidthType.DXA },
  columnWidths: COLS,
  borders: {
    top: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
    left: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
    right: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: LINEA },
    insideVertical: { style: BorderStyle.SINGLE, size: 2, color: LINEA },
  },
  rows: [
    new TableRow({
      tableHeader: true,
      children: [th("N.", COLS[0]), th("Domanda", COLS[1]), th("Chiedere a", COLS[2]), th("Cosa sblocca", COLS[3])],
    }),
    ...SINTESI.map(([n, d, chi, sblocca, liv]) =>
      new TableRow({
        children: [
          td(n, COLS[0], { bold: liv === "bloc", fill: TINTA[liv], color: COLORE[liv] }),
          td(d, COLS[1], { bold: liv === "bloc", fill: TINTA[liv] }),
          td(chi, COLS[2], { fill: TINTA[liv] }),
          td(sblocca, COLS[3], { fill: TINTA[liv] }),
        ],
      }),
    ),
  ],
});

// ─────────────────────────────────────────────────────────── domande bloccanti
const bloccante = (num, titolo, semplice, perche, rif) => [
  h2(`${num} — ${titolo}`, ROSSO),
  rich([{ text: "In parole semplici. ", bold: true }, semplice]),
  rich([{ text: "Perché blocca. ", bold: true, color: ROSSO }, perche]),
  ...(rif ? [p(rif, { italics: true, color: SUBTLE, size: 19 })] : []),
];

const doc = new Document({
  creator: "UFPtrade",
  title: "Domande aperte — generatore di distinte",
  numbering: {
    config: [
      {
        reference: "punti",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "–",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 460, hanging: 240 } } },
          },
        ],
      },
      {
        reference: "elenco-agente",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 460, hanging: 320 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: [
        // ── testata
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: "UTENSILFERRAMENTA PISTOIESE", bold: true, color: SUBTLE, size: 17, font: "Calibri", characterSpacing: 40 })],
        }),
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: "Domande aperte", bold: true, color: INK, size: 44, font: "Calibri" })],
        }),
        new Paragraph({
          spacing: { after: 240 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: INK, space: 8 } },
          children: [new TextRun({ text: "Generatore automatico di distinte ferramenta · listino AGB 2026", color: SUBTLE, size: 22, font: "Calibri" })],
        }),

        p("Il programma che genera le distinte legge gli schemi di montaggio del listino riga per riga. Su alcuni punti il listino da solo non basta a decidere: dove non siamo certi il programma si rifiuta di produrre la distinta invece di tirare a indovinare, così non si rischia di far montare la ferramenta sbagliata."),
        p("Per questo ogni risposta sblocca qualcosa di concreto. Le domande sono ordinate per quanto pesano, non per chi deve rispondere: alcune vanno a un agente esperto, altre ad AGB, alcune a entrambi."),

        ...box(
          [
            p("Le tre più insidiose sono la 17, la 10 e la 3b, perché falliscono in silenzio: il codice che esce esiste, ha un prezzo e sembra giusto. Nessun errore, nessun avviso. Le altre almeno si manifestano con un rifiuto.", { after: 0 }),
          ],
          ROSSO,
        ),
        p("", { after: 200 }),

        h1("In sintesi"),
        tabellaSintesi,
        p("", { after: 240 }),

        new Paragraph({ children: [new PageBreak()] }),

        h1("Le sei bloccanti"),

        ...bloccante(
          "1",
          "Battente: quali cerniere?",
          "Per una finestra a una sola anta che si apre solo a battente (non anta-ribalta), quali cerniere montate?",
          "Lo schema del listino ne mostra tre possibilità e non dice quale valga per l'anta singola. Oggi il programma non genera l'anta a battente: la distinta uscirebbe senza il punto di sospensione in alto, cioè con l'anta non appesa. Una risposta e la tipologia torna disponibile.",
          "Schema a pag. 414 del listino, 21 voci, con tre alternative di cerniera.",
        ),

        ...bloccante(
          "17",
          "L'entrata: quale usate?",
          "La cremonese esiste in entrata 0, 8 e 15. Voi quale usate di solito? Da cosa dipende quando cambia? Ve la dice il cliente o la deducete dal serramento?",
          "Il programma usa sempre l'entrata 15 e non ve la chiede nemmeno. Un serramento con entrata 8 riceve oggi in silenzio la cremonese sbagliata: non compare nessun errore, perché il codice esiste e ha un prezzo.",
          "Famiglia A50122.00 / .08 / .15, tabelle cremonesi da pag. 422.",
        ),

        ...bloccante(
          "10",
          "L'altezza è dell'anta o della maniglia?",
          "L'altezza che ci date è quella dell'anta o quella della maniglia? Sono la stessa cosa, o c'è una differenza fissa fra le due? Vale allo stesso modo per anta-ribalta e vasistas?",
          "La cremonese si sceglie su quella quota. Oggi il programma sottrae 10 mm sull'anta-ribalta e 0 sulla vasistas: due tipologie, due regole, quindi una delle due è sbagliata. Se quella sbagliata è l'anta-ribalta, la cremonese è errata su ogni distinta, compreso il nostro esempio di riferimento, senza che nulla lo segnali.",
        ),

        ...bloccante(
          "4",
          "Sede 18 o sede 30?",
          "La sede 18 è ancora ordinabile, o il listino 2026 l'ha sostituita con la 30?",
          "Decide se il generatore sta lavorando sulla configurazione giusta. Tutti gli schemi base del 2026 sono intitolati «sede 30 mm», e la nota che rimanda a quegli schemi compare su 22 pagine. Per la sede 18 — quella del nostro riferimento, che viene da una distinta AGB del 16/11/2021 — nel 2026 non esiste alcuna pagina-schema. Se la risposta è «sede 30», il generatore va rifatto su quella.",
        ),

        ...bloccante(
          "3b",
          "Incontri: il formato 13x18 non esiste",
          "Nelle tabelle degli incontri il formato è scritto come un numero solo nella colonna ASSE (9x18, 13x24, 13x30), dove il secondo numero è la sede telaio. Cercando su tutte le 959 pagine esistono solo 9x18, 9x20, 13x24 e 13x30: 13x18 non compare mai. La distinta di riferimento dichiara però interasse 13 e monta incontri 9x18. Quale delle due indicazioni è giusta?",
          "Non cambia i codici che escono oggi né il totale, ma vuol dire che una delle due etichette scritte sulla richiesta è falsa. Va sciolta insieme alla domanda 4: sono la stessa indagine.",
        ),

        ...bloccante(
          "6",
          "Il «listino PVC e ALLUMINIO»",
          "Il volume 2026 rimanda più volte a un listino separato per PVC e alluminio, per esempio a pag. 847 per nottolini, antieffrazione e DSS. Possiamo riceverlo?",
          "Senza, PVC e alluminio restano entrambi non trattabili. Non è propriamente una domanda: è un documento da farsi mandare.",
        ),

        new Paragraph({ children: [new PageBreak()] }),

        h1("Importanti"),
        p("Non fermano il lavoro, ma spostano prezzi reali o allargano le configurazioni coperte.", { color: SUBTLE, italics: true, after: 200 }),

        h2("3a — Numero di incontri lungo il perimetro", AMBRA),
        p("Come lo decidete? C'è una regola pratica, tipo uno ogni tot centimetri, o si legge da una tabella?"),
        p("Oggi è una formula ricavata dal solo esempio che abbiamo, quindi vale su un caso e basta.", { italics: true, color: SUBTLE, size: 19 }),

        h2("2 — Squadra angolare: quale delle quattro?", AMBRA),
        p("Il listino ne ha quattro versioni: una base, una «per traverso in alluminio», una «con compensatore» e una con tutte e due. Su una finestra tutta in legno quale montate?"),
        p("Fra la più economica e quella che usiamo noi ballano 4 € a pezzo.", { italics: true, color: SUBTLE, size: 19 }),

        h2("20 — Cosa è di serie e cosa è opzione", AMBRA),
        p("Basta «sempre» o «a richiesta» per ciascuna voce:"),
        ...[
          "la microventilazione",
          "il doppio nottolino a fungo (antieffrazione)",
          "gli spessori di sollevamento — sempre, o solo su ante di un certo peso o misura?",
          "il DSS",
          "le coperture degli incontri — insieme al kit o ordinate a parte?",
        ].map((t) => new Paragraph({ numbering: { reference: "punti", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t, size: 21, font: "Calibri", color: INK })] })),
        p("Sono cinque delle sei voci che compaiono sullo schema di montaggio ma che il programma oggi non emette. Sapere quali sono opzionali chiude la questione.", { italics: true, color: SUBTLE, size: 19 }),

        h2("7 — Finestre basse", AMBRA),
        p("Vi capitano finestre con altezza maniglia sotto i 60 cm? Se sì, come le ordinate?"),
        p("Oggi il programma le rifiuta, anche se il listino le prevede.", { italics: true, color: SUBTLE, size: 19 }),

        h2("22 — Quali finiture vendete davvero", AMBRA),
        p("Oggi il programma conosce solo l'argento."),

        h2("19 — Quali combinazioni ordinate più spesso", AMBRA),
        p("Le tre o quattro più frequenti, in ordine. E ce ne sono che il listino prevede ma che non vi capitano mai?"),
        p("Serve a decidere cosa coprire per primo.", { italics: true, color: SUBTLE, size: 19 }),

        h2("23 — La finestra 700 × 1400, battuta 18, sede 30", AMBRA),
        p("È una richiesta vera di un cliente? Se sì, sapete quale distinta è stata poi effettivamente ordinata? Va bene anche una foto dell'ordine."),
        ...box(
          [
            rich(
              [
                { text: "È la domanda che rende di più di tutte. ", bold: true },
                "Se esiste una distinta reale per quella configurazione diventa il secondo esempio di riferimento, e possiamo verificare quello che costruiamo invece di fidarci della nostra lettura del listino. È esattamente così che è nato il generatore attuale: da una distinta reale del 16/11/2021.",
              ],
              { after: 0 },
            ),
          ],
          AMBRA,
        ),
        p("", { after: 200 }),

        h1("Da chiarire"),

        h2("18 — Dove leggete le quote", GRIGIO),
        p("Quando un cliente vi chiede un kit, dove leggete aria, asse, battuta, sede ed entrata? Sul disegno del serramentista, su una scheda, o ve li dice a voce? Ce n'è qualcuno che non chiedete mai perché è sempre lo stesso? E se il cliente non li sa dire, come fate?"),

        h2("21 — Chiusure supplementari", GRIGIO),
        p("Da quale altezza in su le mettete?"),

        h2("5, 8, 9 — Vasistas", GRIGIO),
        ...[
          "5 — Per le tre cerniere usate la versione base o l'alternativa?",
          "8 — I due terminali in alto sui montanti: sempre, o solo a richiesta?",
          "9 — Le finestre molto piccole, con altezza maniglia sotto i 66 cm, sono ordinabili?",
        ].map((t) => new Paragraph({ numbering: { reference: "punti", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t, size: 21, font: "Calibri", color: INK })] })),

        h2("11-15 — Bilico TOUR", GRIGIO),
        p("Tecniche, da girare ad AGB: asta verticale senza braccetto sopra i 1000 mm di altezza; superficie esattamente 2 m², 3 o 4 lati; se la guarnizione va nella distinta e quanti metri ha la confezione; quantità del kit spessori sullo schema 3; larghezza 645 mm, gruppo 1 o 2."),

        h2("16 — Rilievo interno", GRIGIO),
        p("La direzione di apertura (tirare / spingere) viene chiesta dal programma, salvata, e poi non usata da nessuna parte. Va tolta o usata: è una decisione nostra."),
        p("Vale però la pena chiedere all'agente, come controprova: la direzione di apertura cambia qualcosa nella ferramenta che ordinate, o è solo un'informazione per il cliente?", { italics: true, color: SUBTLE, size: 19 }),

        new Paragraph({ children: [new PageBreak()] }),

        h1("Testo pronto per l'agente"),
        p("Da inoltrare così com'è. Sono domande pratiche: si può rispondere a braccio, non serve precisione da manuale.", { color: SUBTLE, italics: true, after: 200 }),

        ...box(
          [
            p("Ciao, ti chiedo una mano su alcune cose del programma che genera le distinte. Sono domande pratiche, di quelle che sai tu e che sul listino non si leggono.", { after: 160 }),

            p("Le più importanti", { bold: true, after: 80 }),
            ...[
              "Per una finestra a una sola anta che si apre solo a battente (non anta-ribalta), quali cerniere montate? Il listino ne mostra tre possibilità e non dice quale sia quella giusta.",
              "La cremonese esiste in entrata 0, 8 e 15: voi quale usate? Da cosa dipende quando cambia?",
              "L'altezza che mi dai quando ordini è quella dell'anta o quella della maniglia? C'è una differenza fissa fra le due?",
            ].map((t) => new Paragraph({ numbering: { reference: "elenco-agente", level: 0 }, spacing: { after: 70 }, children: [new TextRun({ text: t, size: 21, font: "Calibri", color: INK })] })),

            p("Sulla distinta", { bold: true, after: 80 }),
            ...[
              "Il numero di incontri lungo il perimetro come lo decidi? C'è una regola pratica?",
              "La squadra angolare ha quattro versioni (base, per traverso in alluminio, con compensatore, entrambe). Su una finestra tutta in legno quale usi?",
              "Di queste, cosa metti sempre e cosa solo se richiesto: microventilazione, doppio nottolino a fungo, spessori di sollevamento, DSS, coperture degli incontri.",
              "Le chiusure supplementari da quale altezza in su le metti?",
              "Quali finiture vendiamo davvero? Il programma per ora conosce solo l'argento.",
            ].map((t) => new Paragraph({ numbering: { reference: "elenco-agente", level: 0 }, spacing: { after: 70 }, children: [new TextRun({ text: t, size: 21, font: "Calibri", color: INK })] })),

            p("Sul lavoro di tutti i giorni", { bold: true, after: 80 }),
            ...[
              "Dove leggi aria, asse, battuta, sede ed entrata? Ce n'è qualcuno che non chiedi mai perché è sempre lo stesso? E se il cliente non li sa dire, come fai?",
              "Quali sono le tre o quattro combinazioni che ordini più spesso?",
              "Vi capitano finestre basse, con altezza maniglia sotto i 60 cm? Come le ordinate?",
              "La direzione di apertura (tirare / spingere) cambia qualcosa nella ferramenta, o è solo un'informazione per il cliente?",
            ].map((t) => new Paragraph({ numbering: { reference: "elenco-agente", level: 0 }, spacing: { after: 70 }, children: [new TextRun({ text: t, size: 21, font: "Calibri", color: INK })] })),

            p("Una in particolare", { bold: true, after: 80 }),
            ...[
              "La finestra 700 × 1400 con battuta 18 e sede 30 che abbiamo provato insieme: era una richiesta vera? Se sì, sai quale distinta è stata poi ordinata? Anche una foto dell'ordine mi basta — con quella posso verificare il programma invece di fidarmi della mia lettura del listino.",
            ].map((t) => new Paragraph({ numbering: { reference: "elenco-agente", level: 0 }, spacing: { after: 70 }, children: [new TextRun({ text: t, size: 21, font: "Calibri", color: INK })] })),

            p("Grazie!", { after: 0 }),
          ],
          LINEA,
        ),

        p("", { after: 240 }),
        h1("Testo per AGB"),
        p("La mail completa, con i riferimenti di pagina e i codici, è già pronta nel repository del progetto. Se se ne mandano solo due, sono queste:"),
        ...[
          "Domanda 4 — sede 18 o sede 30, con la 3b (il formato 13x18 che non esiste) da sciogliere nella stessa risposta.",
          "Domanda 6 — il «listino PVC e ALLUMINIO».",
        ].map((t) => new Paragraph({ numbering: { reference: "punti", level: 0 }, spacing: { after: 70 }, children: [new TextRun({ text: t, size: 21, font: "Calibri", color: INK })] })),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((b) => {
  fs.writeFileSync(process.argv[2] || "Domande-aperte.docx", b);
  console.log("✓ scritto");
});
