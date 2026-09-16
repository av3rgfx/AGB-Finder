import type { Indice } from "./vigilanza";

/**
 * LO STATO REGISTRATO DELL'AREA DOWNLOAD COLOMBO — id di categoria → titolo e
 * file pubblicati. Misurato il 2026-09-16 con `pnpm vigila:colombo --aggiorna`.
 *
 * È un modulo e non un JSON per la stessa ragione per cui `ARCHIVI` è un
 * modulo: viene typecheckato, e ratificare un cambiamento è un **commit datato
 * che passa da review**, invece di un file riscritto dalla CI.
 *
 * Titoli e indirizzi sono **pubblici**: COLOMBO li serve senza password. È lo
 * stesso confine di `ARCHIVI` — i nomi sì, i byte no.
 */
export const DOCUMENTI: Indice = {
  "49": {
    titolo: ". Master_2021",
    file: ["/download/formae/pdf/10_Formae.pdf"],
  },
  "52": {
    titolo: ". Master_2013",
    file: ["/download/signs/pdf/Generale - General.pdf"],
  },
  "72": {
    titolo: ". 6 good reasons to",
    file: ["/download/maniglie/pdf/6 good reasons to.pdf"],
  },
  "110": {
    titolo: ". Save The Planet_Handles",
    file: ["/download/maniglie/pdf/Save The Planet_handles_0722.pdf"],
  },
  "111": {
    titolo: ". Save The Planet_Bathroom Accessories",
    file: ["/download/bagno/pdf/Save The Planet_Bath_0722.pdf"],
  },
  "128": {
    titolo: ". MINI catalogue 0603",
    file: ["/download/bagno/pdf/MINI_brochure_0603.pdf"],
  },
  "130": {
    titolo: ". Open Art 2023.pdf",
    file: ["/download/maniglie/pdf/Open Art_leaflet_0623.pdf"],
  },
  "131": {
    titolo: ". Open Art 2023",
    file: ["/download/bagno/pdf/Open Art_bagno brochure bath_0623_intranet.pdf"],
  },
  "132": {
    titolo: ". Master_2024_part1",
    file: ["/download/bagno/pdf/Master_2024_part1.pdf"],
  },
  "133": {
    titolo: ". Master_2024_part2",
    file: ["/download/bagno/pdf/Master_2024_part2.pdf"],
  },
  "142": {
    titolo: ". PVD Brochure",
    file: ["/download/bagno/pdf/PVD brochure 2024.pdf"],
  },
  "143": {
    titolo: ". 963 leaflet 2024",
    file: ["/download/maniglie/pdf/963 leaflet 2024.pdf"],
  },
  "144": {
    titolo: ". Peak leaflet 2024",
    file: ["/download/maniglie/pdf/Peak leaflet 2024.pdf"],
  },
  "146": {
    titolo: ". PVD world 2024",
    file: ["/download/bagno/pdf/PVD world 2024.pdf"],
  },
  "147": {
    titolo: ". ADJ_catalog_2024",
    file: ["/download/bagno/pdf/adj_catalog_2024.pdf"],
  },
  "148": {
    titolo: ". Catalist_Antologhia_0726",
    file: ["/download/antologhia/pdf/Antologhia_catalistino_110626 no prices.pdf"],
  },
  "149": {
    titolo: ". Kombo_box_leaflet_181024",
    file: ["/download/maniglie/pdf/Kombo_box_leaflet_181024.pdf"],
  },
  "150": {
    titolo: ". MiniQ_brochure",
    file: ["/download/bagno/pdf/MiniQ_brochure_0225.pdf"],
  },
  "151": {
    titolo: ". Mood Collection 2025",
    file: ["/download/maniglie/pdf/MOOD_brochure_2025.pdf"],
  },
  "152": {
    titolo: ". RR catalogue 2026",
    file: ["/download/maniglie/pdf/RR MAN 2026_100726.pdf"],
  },
  "153": {
    titolo: ". ColomboDesign_sostenibilita_ITALIANO",
    file: ["/download/news/pdf/ColomboDesign_sostenibilita_ITALIANO.pdf"],
  },
  "154": {
    titolo: ". ColomboDesign_sostenibilita_INGLESE",
    file: ["/download/news/pdf/ColomboDesign_sostenibilita_INGLESE.pdf"],
  },
  "155": {
    titolo: ". GreenMade_brochure 2025",
    file: ["/download/maniglie/pdf/GreenMade_brochure 2025.pdf"],
  },
  "156": {
    titolo: ". GreenMade_brochure 2025",
    file: ["/download/bagno/pdf/GreenMade_brochure 2025.pdf"],
  },
  "158": {
    titolo: ". RR catalogue 2026",
    file: ["/download/bagno/pdf/CATBAT RR_2026_181225.pdf"],
  },
  "159": {
    titolo: ". ER catalogue 2026",
    file: ["/download/maniglie/pdf/ER MAN 2026_140926.pdf"],
  },
  "160": {
    titolo: ". ER catalogue 2026",
    file: ["/download/bagno/pdf/CATBAT ER_2026 Rel1_181225.pdf"],
  },
  "161": {
    titolo: ". Vision 2026 catalogue",
    file: ["/download/maniglie/pdf/Vision2026_maniglie_catalogo_100726.pdf"],
  },
  "162": {
    titolo: ". Vision 2026 Meda flyer",
    file: ["/download/maniglie/pdf/Vision2026_Meda_flyer_210426.pdf"],
  },
};
