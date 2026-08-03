/**
 * I reparti dell'app: gli insiemi di schermate fra cui si sceglie al login.
 *
 * «Reparto», non «programma»: in un gestionale italiano «il programma» È il
 * software, e un selettore di programmi dentro un programma legge come un menù
 * d'avvio. La parola compare in un punto solo dell'interfaccia: «Cambia reparto».
 *
 * Il MARCHIO sta nel sottotitolo e non nel nome, perché il reparto maniglie
 * ospiterà almeno cinque marche (COLOMBO, poi HOPPE, OLIVARI, DND, GHIDINI…):
 * chiamare la tessera «COLOMBO» sarebbe sbagliato il giorno della seconda marca
 * e andrebbe rinominata. La divisione è per merce e mestiere, le marche stanno
 * dentro — ed è la stessa ragione per cui `Article.brand` è una colonna.
 *
 * Modulo foglia e puro: nessun import, nessun JSX, nessuna icona. Serve sia al
 * layout server sia alla sidebar client, e `repartoDaPathname` dev'essere
 * verificabile senza montare React.
 */

export interface Reparto {
  slug: string;
  /** Come compare a schermo, in maiuscolo. */
  nome: string;
  /** Il mestiere, sotto il nome: è ciò che disambigua. */
  mestiere: string;
  /** Le marche che ci stanno dentro. Cresce senza rinominare la tessera. */
  marchi: string[];
  /** Dove si atterra scegliendolo. */
  home: string;
  /** Le sezioni, elencate nella tessera perché non si debba provare per capire. */
  sezioni: string[];
}

/**
 * ⚠️ ASIMMETRIA DICHIARATA: il reparto storico non ha prefisso di rotta.
 *
 * `/archivio`, `/richieste`, `/dashboard`… restano dove sono; solo il reparto
 * nuovo vive sotto `/maniglie/*`. È la condizione per cui «la sezione finestre
 * non si tocca» è vero alla lettera: zero rinomine, zero redirect, i segnalibri
 * degli agenti continuano a funzionare.
 *
 * L'alternativa — due route group `(serramenti)/` e `(maniglie)/` — è stata
 * scartata su un fatto RIPRODOTTO: i route group di Next non entrano nell'URL,
 * quindi separano il layout ma NON il namespace, e due gruppi fratelli che
 * risolvono lo stesso path fanno fallire la build (`E28`).
 */
export const REPARTI: Reparto[] = [
  {
    slug: "serramenti",
    nome: "SERRAMENTI",
    mestiere: "Ferramenta per serramenti",
    marchi: ["AGB"],
    home: "/dashboard",
    sezioni: ["Archivio", "Assistente", "Richieste Kit", "Clienti"],
  },
  {
    slug: "maniglie",
    nome: "MANIGLIE",
    mestiere: "Maniglie per porte e finestre",
    marchi: ["COLOMBO"],
    home: "/maniglie",
    sezioni: ["Disponibilità"],
  },
];

/** La rotta della schermata di scelta. */
export const HOME_REPARTI = "/";

/** Prefissi che appartengono a un reparto diverso da quello storico. */
const PREFISSI: { prefisso: string; slug: string }[] = [{ prefisso: "/maniglie", slug: "maniglie" }];

export const repartoDaSlug = (slug: string): Reparto | null =>
  REPARTI.find((r) => r.slug === slug) ?? null;

/**
 * In che reparto ci si trova, dedotto dall'INDIRIZZO e non da uno stato salvato.
 *
 * Niente cookie e niente `localStorage`: un reparto ripescato in silenzio da uno
 * stato invisibile sarebbe l'ottava occorrenza della classe di difetto che
 * questo progetto ha già chiuso sette volte — un valore deciso dal programma e
 * mai dichiarato. E un indirizzo condiviso mostrerebbe il reparto sbagliato,
 * perché il cookie dice una cosa e l'URL un'altra.
 *
 * `null` sulla schermata di scelta: lì non si è ancora in nessun reparto.
 */
export function repartoDaPathname(pathname: string): Reparto | null {
  if (pathname === HOME_REPARTI) return null;
  for (const { prefisso, slug } of PREFISSI) {
    if (pathname === prefisso || pathname.startsWith(`${prefisso}/`)) {
      return repartoDaSlug(slug);
    }
  }
  return repartoDaSlug("serramenti");
}
