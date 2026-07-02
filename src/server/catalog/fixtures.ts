// Real excerpts from the AGB LISTINO 2026 PDF (pdftotext -layout, pages 120/300/620).
// Ground truth for the parser tests and source of the synthetic dev seed.
// Keep VERBATIM — column spacing matters. Regenerate only from the real PDF.

export const PAGE_SERRATURE = `                SERRATURE                                                                LISTINO 2026

Incontri - Sicurezza
                            Larghezza 22 mm, bordo tondo spessore 3 mm
                            ACCIAIO
                            LUNGHEZZA         FINITURA               CODICE                     € CS
                            238 mm            Ottonato lucido        B00590.15.03   25 250    1,23   A2
                                              Nichelato lucido       B00590.15.06   25 250    1,35   A2
                                              Bronzato opaco vern.   B00590.15.22   25 250    0,97   A2
                                              Cromato opaco          B00590.15.34   25 250    2,07   A2




                            Larghezza 22 mm, bordo tondo spessore 2 mm
                            ACCIAIO
                            LUNGHEZZA         FINITURA               CODICE                     € CS
                            238 mm            Ottonato lucido        B00590.30.03   25 250    1,05   A1
                                              Nichelato lucido       B00590.30.06   25 250    1,15   A1
                                              Bronzato opaco vern.   B00590.30.22   25 250    0,70   A1
                                              Cromato opaco          B00590.30.34   25 250    1,90   A1




                            Larghezza 20 mm, bordo tondo
                            ACCIAIO
                            LUNGHEZZA         FINITURA               CODICE                     € CS
                            238 mm            Ottonato lucido        B00590.43.03   25 250    1,23   A2
                                              Zinco Tropical         B00590.43.04   25 250    0,92   A2
                                              Nichelato lucido       B00590.43.06   25 250    1,35   A2
                                              Zinco Silver           B00590.43.15   25 250    0,92   A2
                                              Bronzato opaco vern.   B00590.43.22   25 250    0,97   A2
                                              Cromato opaco          B00590.43.34   25 250    2,07   A2




 118`;

export const PAGE_CERNIERE = `                CERNIERE                                                                                 LISTINO 2026

Per Legno - Per terza anta
                             Mod.120 Ala, lame in asse con perni e corpo maggiorato
                             ACCIAIO
                                      FINITURA          ALTEZZA            MANO   CODICE                        € CS
                             ø 14     Black Powerage 83                    dx     E10157.14.93   50 50        5,52   C1
                                      Black Powerage 83                    sx     E10158.14.93   50 50        5,52   C1




                             Mod.120 Ala, lame sovrapposte senza perni
                             ACCIAIO
                                      FINITURA          ALTEZZA            MANO   CODICE                        € CS
                             ø 14     Black Powerage 50                    dx     E10062.14.93   50 200       3,97   C1
                                      Black Powerage 50                    sx     E10063.14.93   50 200       3,97   C1




                             Mod.179 Ala, lame in asse senza perni
                             ACCIAIO
                                      FINITURA          ALTEZZA            MANO   CODICE                        € CS
                             ø 18     Black Powerage 79                    dx     E10037.18.93   20 80        4,71   C1
                                      Black Powerage 79                    sx     E10038.18.93   20 80        4,71   C1
                                      Silver Powerage 79                   dx     E10037.18.21   20 80        5,08   C1
                                      Silver Powerage 79                   sx     E10038.18.21   20 80        5,08   C1
                             NB: la versione DX e SX lavora in aria 4 mm




 298`;

export const PAGE_PROFILI = `          IMAGO E IMAGO+                                                                                            LISTINO 2026

Profili
                      Kit profilo reggivetro IMAGO
                      GRIGIO RAL 7035
                      LUNGHEZZA                                                              CODICE                         € CS
                      2000 mm                                                                G01342.01.86   1   1        87,18   H1
                      3000 mm                                                                G01342.02.86   1   1       124,88   H1
                      4000 mm                                                                G01342.03.86   1   1       178,89   H1
                      6000 mm                                                                G01342.05.86   1   1       283,09   H1
                      NERO OPACO
                      LUNGHEZZA                                                              CODICE                         € CS
                      2000 mm                                                                G01342.01.93   1   1        95,90   H1
                      3000 mm                                                                G01342.02.93   1   1       137,37   H1
                      4000 mm                                                                G01342.03.93   1   1       196,78   H1
                      6000 mm                                                                G01342.05.93   1   1       311,40   H1


                      Guarnizione profilo reggivetro IMAGO per battuta 17
                      NERO
                      LUNGHEZZA                                                              CODICE                         € CS
                      10 metri                                                               G02019.10.93   1   1        24,04 H1


                      Profilo di chiusura superiore
                      ALLUMINIO ARGENTO
                      LUNGHEZZA                                                              CODICE                         € CS
                      1500 mm                                                                G02401.15.01   1   1        36,13 H1
                      2000 mm                                                                G02401.20.01   1   1        43,16 H1
                      3000 mm                                                                G02401.30.01   1   1        72,30 H1


                      Profilo di chiusura superiore da 50 mm per sistemi legno-alluminio
                      ALLUMINIO ARGENTO
                      LUNGHEZZA                                                              CODICE                         € CS
                      1500 mm                                                                G02406.15.01   1   1        36,13 H1
                      2000 mm                                                                G02406.20.01   1   1        43,16 H1
                      3000 mm                                                                G02406.30.01   1   1        72,30 H1
                      NB: spugna con biadesivo da incollare dopo aver rifilato l'alluminio




 618`;

export const ALL_FIXTURE_PAGES = [PAGE_SERRATURE, PAGE_CERNIERE, PAGE_PROFILI].join("\n");
