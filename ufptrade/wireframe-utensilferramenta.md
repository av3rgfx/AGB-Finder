# Wireframe UI — Utensilferramenta Pistoiese S.p.A.
## Documento di Specifica Interfaccia — v1.0

---

## Indice
1. [Sito Pubblico — Homepage](#1-sito-pubblico--homepage)
2. [Login / Accesso Area Agenti](#2-login--accesso-area-agenti)
3. [Dashboard Agente](#3-dashboard-agente)
4. [Chat AI](#4-chat-ai)
5. [Archivio Prodotti](#5-archivio-prodotti)
6. [Kit Builder](#6-kit-builder)
7. [Richieste Kit](#7-richieste-kit)
8. [Admin — Gestione Utenti](#8-admin--gestione-utenti)

---

## Design System Reference

| Token | Valore | Uso |
|---|---|---|
| `--color-brand` | `#E86824` | CTA, accenti, stati attivi |
| `--color-dark` | `#1A1714` | Sidebar, header dark, testo primario |
| `--color-neutral-700` | `#4A4540` | Testo secondario, icone |
| `--color-neutral-500` | `#7A756E` | Testo terziario, bordi |
| `--color-neutral-100` | `#F5F3EF` | Sfondo card, hover row |
| `--color-neutral-50` | `#FAF9F7` | Sfondo pagina |
| `--font-ui` | `Inter, sans-serif` | Tutti i testi UI |
| `--font-mono` | `JetBrains Mono, monospace` | Codici prodotto |
| `--radius-sm` | `6px` | Bottoni, input |
| `--radius-md` | `8px` | Card, panel |
| `--radius-lg` | `12px` | Modal, toast |
| `--shadow-card` | `0 1px 3px rgba(26,23,20,0.06)` | Card default |
| `--shadow-elevated` | `0 4px 12px rgba(26,23,20,0.10)` | Modal, dropdown |

---

## 1. Sito Pubblico — Homepage

### 1.1 Layout ASCII

```
+------------------------------------------------------------------+
|  [LOGO UFP]     Prodotti    Azienda    Contatti      [Area Agenti] |
+------------------------------------------------------------------+
|                                                                    |
|                    FERRAMENTA PER SERRAMENTI                       |
|              Soluzioni B2B per finestre, porte e infissi          |
|                                                                    |
|         [Esplora Catalogo]           [Richiedi un Kit]            |
|                                                                    |
+------------------------------------------------------------------+
|  PRODOTTI IN EVIDENZA                                              |
|  +----------------+  +----------------+  +----------------+       |
|  | [img]          |  | [img]          |  | [img]          |       |
|  | 5111-A0001     |  | 5111-A0045     |  | 5111-B0012     |       |
|  | Cerniera AGB   |  | Serratura MCM  |  | Scrocco Rullo  |       |
|  | E01013.05.04   |  | 1092P-16       |  | 1403-S         |       |
|  | Cerniere       |  | Serrature      |  | Scrocci        |       |
|  | EUR 12.50      |  | EUR 34.00      |  | EUR 8.90       |       |
|  +----------------+  +----------------+  +----------------+       |
+------------------------------------------------------------------+
|  RICHIEDI UN KIT                                                   |
|  Nome azienda: [________________]  Email: [________________]       |
|  Telefono:     [________________]  Tipo:  [Finestra ▼]            |
|  Note:         [______________________________]                    |
|                                                                  |
|                         [Invia Richiesta]                         |
+------------------------------------------------------------------+
|  UTENSILFERRAMENTA PISTOIESE S.p.A.                                |
|  Via dell'Artigianato, 15 — 51100 Pistoia (PT)                     |
|  Tel: +39 0573 12345  |  info@utensilferramenta.it                 |
|  [LI] [FB]                                                         |
+------------------------------------------------------------------+
```

### 1.2 Componenti Dettagliati

| Elemento | Componente | Specifiche |
|---|---|---|
| Header | `Navbar` | `position: fixed`, `bg: #FAF9F7`, `border-bottom: 1px solid #F5F3EF`, `height: 64px`, `z-index: 50` |
| Logo | `BrandLogo` | SVG, `height: 36px`, link a homepage |
| Nav links | `NavLink` | Font: Inter 15px/500, colore `#4A4540`, hover: `#E86824`, underline animato 2px |
| Bottone "Area Agenti" | `ButtonPrimary` | `bg: #E86824`, `color: white`, `radius: 6px`, `padding: 10px 20px`, icon: `LogIn` 16px |
| Hero | `HeroSection` | `min-height: 420px`, `bg: #FAF9F7`, testo centrato, `padding-top: 120px` |
| Hero titolo | `DisplayText` | Inter 48px/700, `#1A1714`, `max-width: 700px`, `text-align: center` |
| Hero sottotitolo | `BodyLarge` | Inter 18px/400, `#7A756E`, `max-width: 560px`, `margin-top: 16px` |
| CTA primario | `ButtonPrimary` | `bg: #E86824`, `padding: 14px 32px`, Inter 16px/600 |
| CTA secondario | `ButtonSecondary` | `border: 1.5px solid #1A1714`, `bg: transparent`, `padding: 14px 32px` |
| Griglia prodotti | `ProductGrid` | `display: grid`, `grid-template-columns: repeat(3, 1fr)`, `gap: 24px`, `max-width: 1100px` |
| Card prodotto | `ProductCard` | `bg: white`, `radius: 8px`, `shadow: --shadow-card`, `padding: 0` (img full-bleed top) |
| Card img | `ProductImage` | `aspect-ratio: 4/3`, `object-fit: cover`, `radius-top: 8px`, placeholder grigio `#E8E6E3` |
| Card codice | `ProductCode` | JetBrains Mono 13px/500, `#E86824`, `padding: 16px 16px 0` |
| Card nome | `ProductName` | Inter 15px/600, `#1A1714`, `padding: 4px 16px` |
| Card marca | `ProductBrand` | Inter 13px/400, `#7A756E`, `padding: 0 16px 4px` |
| Card categoria | `CategoryBadge` | `bg: #F5F3EF`, `color: #4A4540`, `radius: 4px`, `padding: 2px 8px`, Inter 12px |
| Card prezzo | `ProductPrice` | Inter 16px/700, `#1A1714`, `padding: 8px 16px 16px` |
| Sezione kit | `KitSection` | `bg: #F5F3EF`, `padding: 64px 24px`, `margin-top: 64px` |
| Form kit | `KitForm` | `max-width: 700px`, `display: grid`, `grid-template-columns: 1fr 1fr`, `gap: 16px` |
| Input testo | `TextInput` | `height: 44px`, `radius: 6px`, `border: 1px solid #D9D5D0`, `padding: 0 12px`, focus: `border-color: #E86824`, `outline: 2px solid rgba(232,104,36,0.15)` |
| Input textarea | `TextArea` | `min-height: 80px`, `grid-column: 1 / -1`, stessi stili input |
| Submit button | `ButtonPrimary` | `grid-column: 1 / -1`, `justify-self: center`, `min-width: 220px` |
| Footer | `Footer` | `bg: #1A1714`, `color: #FAF9F7`, `padding: 48px 24px`, Inter 14px/400 |

### 1.3 Interazioni Chiave

| Trigger | Azione | Dettaglio |
|---|---|---|
| Click "Area Agenti" | Navigazione | Redirect a `/login` |
| Click "Esplora Catalogo" | Scroll ancorato | Scroll smooth a sezione prodotti |
| Click card prodotto | Navigazione | A pagina dettaglio prodotto (futuro) |
| Hover card prodotto | Transizione | `transform: translateY(-2px)`, `shadow: --shadow-elevated`, `transition: 200ms ease` |
| Submit form kit | API call | POST `/api/kit-request`, mostra toast successo, reset form |
| Focus input | Stile | Bordo arancione, outline arancione trasparente |

### 1.4 Stati

| Stato | Descrizione |
|---|---|
| **Empty** | Se nessun prodotto in evidenza: messaggio "Catalogo in aggiornamento" con icona toolbox |
| **Loading** | Skeleton card: 3 rettangoli grigio animati pulsing `#E8E6E3` → `#F5F3EF` |
| **Error** | Toast rosso in alto a destra: "Errore caricamento prodotti. Riprova." |
| **Success form** | Toast verde: "Richiesta inviata! Ti contatteremo entro 24h." Form resettato |

### 1.5 Responsive Notes (Tablet 768px)

| Elemento | Adattamento |
|---|---|
| Header | Nav links collassati in hamburger menu (☰), "Area Agenti" rimane visibile |
| Hero | Titolo: 36px, sottotitolo: 16px, bottoni full-width stack |
| Griglia prodotti | `grid-template-columns: repeat(2, 1fr)` |
| Form kit | `grid-template-columns: 1fr` (colonna singola) |
| Footer | Stack verticale, testo centrato |

---

## 2. Login / Accesso Area Agenti

### 2.1 Layout ASCII

```
+---------------------------------------------+-------------------------+
|                                             |                         |
|                                             |   Accedi all'Area Agenti |
|            [LOGO UFP BIANCO]                |                         |
|                                             |   Email                  |
|         Utensilferramenta                   |   [________________]    |
|            Pistoiese S.p.A.                 |                         |
|                                             |   Password               |
|         "Ferramenta per serramenti          |   [________________] [O]|
|          dal 1978"                          |                         |
|                                             |   [x] Ricordami         |
|                                             |                         |
|         [non mostrare su mobile]            |   [      ACCEDI       ] |
|                                             |                         |
|                                             |   Password dimenticata? |
|                                             |                         |
|                                             |   ─── oppure ───        |
|                                             |                         |
|      bg: #E86824  |  pattern geometrico    |   [Richiedi accesso]    |
|      svg subtle   |  tono su tono          |   (contatta admin)      |
|                                             |                         |
+---------------------------------------------+-------------------------+
```

### 2.2 Componenti Dettagliati

| Elemento | Componente | Specifiche |
|---|---|---|
| Split container | `LoginLayout` | `display: grid`, `grid-template-columns: 1fr 480px`, `min-height: 100vh` |
| Panel sinistro | `BrandPanel` | `bg: #E86824`, `display: flex`, `flex-direction: column`, `justify-content: center`, `align-items: center`, pattern SVG geometrico opacità 0.08 |
| Logo bianco | `BrandLogoWhite` | SVG monocromo bianco, `height: 60px` |
| Tagline | `Tagline` | Inter 20px/400, bianco, opacità 0.9, `margin-top: 24px`, `text-align: center` |
| Panel destro | `FormPanel` | `bg: #FAF9F7`, `padding: 48px 56px`, `display: flex`, `flex-direction: column`, `justify-content: center` |
| Titolo form | `Heading2` | Inter 28px/700, `#1A1714`, `margin-bottom: 32px` |
| Label | `FormLabel` | Inter 14px/600, `#4A4540`, `margin-bottom: 6px`, `display: block` |
| Input email | `TextInput` | `height: 48px`, `radius: 6px`, `border: 1px solid #D9D5D0`, icona Mail 20px a sinistra |
| Input password | `TextInput` | Stesso stile, icona Lock 20px, bottone occhio toggle visibilità a destra |
| Checkbox | `Checkbox` | `16px × 16px`, `radius: 4px`, checked: `bg: #E86824`, bordo `#D9D5D0` |
| Bottone Accedi | `ButtonPrimary` | `width: 100%`, `height: 48px`, `bg: #E86824`, Inter 16px/600, `radius: 6px` |
| Link password | `TextLink` | Inter 14px/500, `#E86824`, hover: underline |
| Divider | `Divider` | `border-top: 1px solid #D9D5D0`, testo "oppure" centrato, `#7A756E` 13px |
| Link richiesta | `ButtonSecondary` | `width: 100%`, `border: 1.5px solid #D9D5D0`, `bg: transparent`, Inter 14px |

### 2.3 Interazioni Chiave

| Trigger | Azione | Dettaglio |
|---|---|---|
| Click "Accedi" | Submit form | Validazione client: email regex, password min 6 char. Se valido: POST `/api/auth/login` |
| Login success | Redirect | JWT salvato in localStorage, redirect a `/dashboard` |
| Login error | Feedback | Input bordo rosso `#DC2626`, messaggio sotto: "Credenziali non valide" |
| Toggle password | Visibilità | Click icona occhio: type="text"/"password", icona cambia |
| "Ricordami" | Persistenza | Checkbox salva email in localStorage (non password) |
| "Password dimenticata?" | Modal | Apre modal con input email per reset (flow admin-only, mostra messaggio info) |
| "Richiedi accesso" | Navigazione | Apre mailto:admin@utensilferramenta.it o pagina contatto |

### 2.4 Stati

| Stato | Descrizione |
|---|---|
| **Empty** | Form pulito, placeholder visibili |
| **Loading** | Bottone "Accedi" mostra spinner 16px bianco, `disabled: true`, input `disabled` |
| **Error** | Messaggio errore in banner rosso sopra form: "Email o password errate." Input con bordo `#DC2626` |
| **Success** | Redirect immediato, toast "Bentornato, {nome}" |
| **Password dimenticata** | Modal con messaggio: "Contatta l'amministratore per reimpostare la password." |

### 2.5 Responsive Notes (Tablet 768px)

| Elemento | Adattamento |
|---|---|
| Layout | Panel brand nascosto. Form panel: `width: 100%`, `padding: 40px 32px` |
| Titolo | 24px, centrato |
| Input | Full width, `height: 52px` (touch-friendly) |
| Logo brand | Non visibile su tablet/mobile. Mostra logo arancione piccolo (40px) sopra il titolo form |

---

## 3. Dashboard Agente (Home post-login)

### 3.1 Layout ASCII

```
+-----------+--------------------------------------------------------+
|           |  🔍 Cerca prodotti, kit, codici...       🔔   [AB]      |
|  [LOGO]   +--------------------------------------------------------+
|           |                                                        |
| Dashboard |  +------------+ +------------+ +------------+ +------+ |
|           |  | Richieste  | | Kit        | | Tempo      | | Prod | |
|  Chat AI  |  | Oggi       | | Generati   | | Risparmiato| | Cerc | |
|           |  |            | |            | |            | |      | |
|  Archivio |  |    12      | |     5      | |   2.4h     | |  47  | |
|           |  |  ↑ 3       | |  ↑ 2       | |  ↑ 0.5h    | |  ↑12 | |
|  Richieste|  +------------+ +------------+ +------------+ +------+ |
|  Kit      |                                                        |
|           |  +--------------------------------------------------+  |
|  Imposta- |  | ULTIME RICHIESTE KIT                             |  |
|  zioni    |  | ID      Cliente        Data        Stato         |  |
|           |  | ───────────────────────────────────────────────  |  |
|           |  | #1042  Rossi Serramenti  14/01  [Completata  ]  |  |
|           |  | #1041  Bianchi Infissi   14/01  [In lavoraz..]  |  |
|           |  | #1040  Nardi Porte       13/01  [Nuova      🟡]  | |
|           |  | #1039  Gigli Finestre    13/01  [Completata  ]  |  |
|           |  | #1038  Moretti Alluminio 12/01  [Inviata    📤]  | |
|           |  |                                                  |  |
|           |  | [Vedi tutte le richieste →]                      |  |
|           |  +--------------------------------------------------+  |
|           |                                                        |
|           |  +--------------------------------------------------+  |
|           |  | 🤖 CHAT AI — Come posso aiutarti?                |  |
|           |  |                                                  |  |
|           |  |  [Cerca codice]  [Genera Kit]  [Analizza Email]  |  |
|           |  |                                                  |  |
|           |  | [📎] [Descrivi il prodotto o incolla un'email... ] [🎙] [➤]|
|           |  +--------------------------------------------------+  |
|           |                                                        |
+-----------+--------------------------------------------------------+
```

### 3.2 Componenti Dettagliati

**Sidebar (scura)**

| Elemento | Componente | Specifiche |
|---|---|---|
| Sidebar container | `Sidebar` | `width: 240px`, `bg: #1A1714`, `height: 100vh`, `position: fixed`, `display: flex`, `flex-direction: column` |
| Logo area | `SidebarLogo` | `padding: 24px`, logo bianco 32px, "UFP" Inter 18px/700 bianco |
| Nav container | `SidebarNav` | `flex: 1`, `padding: 8px 12px`, `display: flex`, `flex-direction: column`, `gap: 4px` |
| Nav item | `NavItem` | `height: 44px`, `radius: 6px`, `padding: 0 14px`, Inter 14px/500, colore `#9A9590`, icona 20px a sinistra, `gap: 12px` |
| Nav item active | `NavItemActive` | `bg: rgba(232,104,36,0.12)`, colore `#E86824`, icona arancione |
| Nav item hover | `NavItemHover` | `bg: rgba(255,255,255,0.04)`, colore `#FAF9F7` |
| Badge notifiche | `NavBadge` | `bg: #E86824`, `color: white`, `radius: 10px`, `padding: 0 6px`, Inter 11px/600 |
| Divider | `SidebarDivider` | `border-top: 1px solid rgba(255,255,255,0.06)`, `margin: 12px` |
| Impostazioni | `NavItem` | In fondo, icona Settings |

**Top Bar**

| Elemento | Componente | Specifiche |
|---|---|---|
| Top bar | `TopBar` | `height: 64px`, `bg: white`, `border-bottom: 1px solid #F5F3EF`, `padding: 0 24px`, `display: flex`, `align-items: center`, `justify-content: space-between` |
| Search globale | `GlobalSearch` | `width: 400px`, `height: 40px`, `bg: #F5F3EF`, `radius: 6px`, icona Search 18px, placeholder "Cerca prodotti, kit, codici..." Inter 14px |
| Icona notifiche | `IconButton` | `40px × 40px`, `radius: 6px`, icona Bell 20px `#4A4540`, badge rosso se nuove |
| Profilo | `UserMenu` | Avatar cerchio 34px `bg: #E86824` con iniziali "AB" bianco, nome Inter 14px/500 |

**Stat Cards (Row 1)**

| Elemento | Componente | Specifiche |
|---|---|---|
| Container | `StatsRow` | `display: grid`, `grid-template-columns: repeat(4, 1fr)`, `gap: 20px`, `margin-bottom: 24px` |
| Stat card | `StatCard` | `bg: white`, `radius: 8px`, `shadow: --shadow-card`, `padding: 20px`, NO sfondo sfumato, NO gradient |
| Icona | `StatIcon` | `32px × 32px`, `radius: 8px`, `bg: rgba(232,104,36,0.08)`, icona arancione 18px |
| Valore | `StatValue` | Inter 32px/700, `#1A1714`, `margin-top: 12px` |
| Label | `StatLabel` | Inter 13px/500, `#7A756E`, `margin-top: 2px` |
| Trend | `StatTrend` | Inter 13px/600, `color: #16A34A` (verde) per positivo, `color: #DC2626` per negativo, icona freccia |

**Lista Richieste Kit (Row 2)**

| Elemento | Componente | Specifiche |
|---|---|---|
| Container | `RequestsPanel` | `bg: white`, `radius: 8px`, `shadow: --shadow-card`, `padding: 0` |
| Header panel | `PanelHeader` | `padding: 20px 24px`, `border-bottom: 1px solid #F5F3EF`, `display: flex`, `justify-content: space-between` |
| Titolo | `PanelTitle` | Inter 16px/600, `#1A1714` |
| Tabella | `DataTable` | `width: 100%`, colonne: ID 80px, Cliente 1fr, Data 100px, Stato 120px |
| Row | `TableRow` | `height: 52px`, `padding: 0 24px`, hover: `bg: #FAF9F7` |
| Cell ID | `MonoCell` | JetBrains Mono 13px/500, `#E86824` |
| Cell cliente | `TextCell` | Inter 14px/400, `#1A1714` |
| Cell data | `TextCell` | Inter 13px/400, `#7A756E` |
| Badge stato | `StatusBadge` | `radius: 4px`, `padding: 4px 10px`, Inter 12px/600: Nuova=`bg: #FEF3C7`/`#92400E`, In lavorazione=`bg: #DBEAFE`/`#1E40AF`, Completata=`bg: #DCFCE7`/`#166534`, Inviata=`bg: #E0E7FF`/`#3730A3` |
| Link tutte | `TextLink` | Inter 14px/500, `#E86824`, `padding: 16px 24px`, `display: block` |

**Chat AI Promo (Row 3)**

| Elemento | Componente | Specifiche |
|---|---|---|
| Container | `ChatPromoPanel` | `bg: #FEF0E6`, `border: 1px solid rgba(232,104,36,0.15)`, `radius: 8px`, `padding: 24px`, `margin-top: 24px` |
| Header | `ChatPromoHeader` | Icona robot 24px arancione, Inter 16px/600, `#1A1714` |
| Quick actions | `QuickActionsRow` | `display: flex`, `gap: 12px`, `margin: 16px 0` |
| Quick action btn | `QuickActionButton` | `bg: white`, `border: 1px solid #E86824`, `color: #E86824`, `radius: 6px`, `padding: 8px 16px`, Inter 13px/500 |
| Input bar | `ChatInputBar` | `bg: white`, `radius: 8px`, `border: 1px solid #D9D5D0`, `height: 48px`, `display: flex`, `align-items: center`, `padding: 0 12px` |
| Input | `ChatInput` | `flex: 1`, border: none, Inter 14px, placeholder arancione chiaro |
| Icona attach | `IconButton` | Icona Paperclip 18px `#7A756E` |
| Icona mic | `IconButton` | Icona Mic 18px `#7A756E` |
| Send button | `SendButton` | `32px × 32px`, `radius: 6px`, `bg: #E86824`, icona Send 16px bianco |

### 3.3 Interazioni Chiave

| Trigger | Azione | Dettaglio |
|---|---|---|
| Click nav item | Navigazione | Cambia route, nav item diventa active |
| Click riga richiesta | Navigazione | Vai a `/richieste/{id}` |
| Click "Vedi tutte" | Navigazione | Vai a `/richieste` |
| Click quick action | Navigazione | Vai a `/chat` con intent pre-selezionato |
| Click input chat | Focus | Espande input, mantiene in pagina, non naviga |
| Submit input chat | Navigazione | Vai a `/chat` con query pre-popolata |
| Click notifiche | Dropdown | Apre dropdown con lista notifiche, segna come lette |
| Click profilo | Dropdown | Menu: Profilo, Impostazioni, Esci |

### 3.4 Stati

| Stato | Descrizione |
|---|---|
| **Empty stats** | Valore "0", trend nascosto, label visibile |
| **Empty richieste** | Messaggio in tabella: "Nessuna richiesta recente. I kit generati appariranno qui." |
| **Loading** | Skeleton: 4 stat card grigio pulsing, 5 row skeleton in tabella |
| **Error** | Toast rosso: "Errore caricamento dati. Aggiorna la pagina." |

### 3.5 Responsive Notes (Tablet 768px)

| Elemento | Adattamento |
|---|---|
| Sidebar | Collassata a icona (`width: 64px`), solo icone, label nascoste. Toggle hamburger su top bar |
| Stat cards | `grid-template-columns: repeat(2, 1fr)`, 2 righe |
| Search globale | `width: 280px` |
| Top bar | Padding ridotto, nome utente nascosto (solo avatar) |
| Chat promo | Quick actions wrap su 2 righe |

---

## 4. Chat AI (Schermata Principale)

### 4.1 Layout ASCII

```
+-----------+----------------------------------------+-----------------------------------+
|           |                                        | PANEL DESTRO (contesto-dipendente) |
|  [LOGO]   |  🤖 Chat AI                            |                                   |
|           |                                        | RISULTATI RICERCA PRODOTTO:       |
| Dashboard |  +----------------------------------+  |                                   |
|           |  | Ciao! Descrivi il prodotto       |  | 5111-A0001 Cerniera AGB           |
|  Chat AI  |  | che stai cercando o incolla      |  | E01013.05.04          EUR 12.50  |
|           |  | un'email del cliente.            |  | [📋] [Dettagli →]                 |
|  Archivio |  | bg: #FEF0E6, border-left: 3px    |  | ───────────────────────────────── |
|           |  | solid #E86824                    |  | 5111-A0045 Serratura MCM          |
|  Richieste|  +----------------------------------+  | 1092P-16              EUR 34.00  |
|  Kit      |                                        | [📋] [Dettagli →]                 |
|           |  +----------------------------------+  | ───────────────────────────────── |
|  Imposta- |  | Cerco cerniera per anta battente  |  | 5111-B0012 Scrocco Rullo 1403-S   |
|  zioni    |  | alluminio 800mm, serie ARTECH    |  | EUR 8.90  [📋] [Dettagli →]      |
|           |  | bg: #F5F3EF, align: right        |  |                                   |
|           |  +----------------------------------+  |                                   |
|           |                                        |                                   |
|           |  [Cerca codice] [Genera Kit] [Analiz..]|                                   |
|           |                                        |                                   |
|           |  [📎] [Descrivi il prodotto...      ]  |                                   |
|           |        [🎙] [➤]                      |                                   |
+-----------+----------------------------------------+-----------------------------------+
```

### 4.2 Componenti Dettagliati

**Layout Split**

| Elemento | Componente | Specifiche |
|---|---|---|
| Container | `ChatLayout` | `display: grid`, `grid-template-columns: 55% 45%`, `height: calc(100vh - 64px)` (sotto top bar) |
| Panel chat | `ChatPanel` | `border-right: 1px solid #F5F3EF`, `display: flex`, `flex-direction: column` |
| Panel info | `InfoPanel` | `bg: #FAF9F7`, `overflow-y: auto` |

**Area Chat**

| Elemento | Componente | Specifiche |
|---|---|---|
| Messages area | `MessagesContainer` | `flex: 1`, `overflow-y: auto`, `padding: 24px`, `display: flex`, `flex-direction: column`, `gap: 16px` |
| Messaggio AI | `AIMessage` | `align-self: flex-start`, `max-width: 85%`, `bg: #FEF0E6`, `border-left: 3px solid #E86824`, `radius: 0 8px 8px 8px`, `padding: 16px` |
| Messaggio user | `UserMessage` | `align-self: flex-end`, `max-width: 75%`, `bg: #F5F3EF`, `radius: 8px 0 8px 8px`, `padding: 14px 18px` |
| Testo messaggio AI | `MessageText` | Inter 15px/400, `#1A1714`, `line-height: 1.6` |
| Testo messaggio user | `MessageText` | Inter 15px/400, `#1A1714` |
| Timestamp | `MessageTime` | Inter 11px/400, `#7A756E`, `margin-top: 6px` |
| Indicator typing | `TypingIndicator` | Tre puntini animati, `bg: #FEF0E6`, stesso stile messaggio AI |
| Input area | `ChatInputArea` | `border-top: 1px solid #F5F3EF`, `bg: white`, `padding: 16px 24px` |
| Quick actions | `QuickActions` | `display: flex`, `gap: 8px`, `margin-bottom: 12px` |
| Quick action btn | `QuickActionChip` | `bg: #F5F3EF`, `radius: 6px`, `padding: 6px 14px`, Inter 13px/500, `#4A4540`, hover: `bg: #E86824`, `color: white` |
| Input container | `ChatInputContainer` | `display: flex`, `align-items: center`, `gap: 8px`, `bg: #F5F3EF`, `radius: 8px`, `padding: 0 8px`, `min-height: 48px` |
| Attach button | `IconButton` | Icona Paperclip 18px `#7A756E`, hover: `#E86824` |
| Text input | `ChatTextInput` | `flex: 1`, border: none, `bg: transparent`, Inter 15px, `min-height: 20px`, `max-height: 120px`, resize vertical |
| Mic button | `IconButton` | Icona Mic 18px `#7A756E`, hover: `#E86824` |
| Send button | `SendButton` | `36px × 36px`, `radius: 8px`, `bg: #E86824`, icona Send 18px bianco, hover: darken 10% |

**Panel Destro — Ricerca Prodotto**

| Elemento | Componente | Specifiche |
|---|---|---|
| Header | `PanelHeader` | `padding: 20px 24px`, `border-bottom: 1px solid #F5F3EF` |
| Titolo | `PanelTitle` | Inter 15px/600, `#1A1714`, "N risultati trovati" |
| Lista risultati | `ResultsList` | `padding: 12px`, `display: flex`, `flex-direction: column`, `gap: 8px` |
| Card risultato | `ResultCard` | `bg: white`, `radius: 8px`, `shadow: --shadow-card`, `padding: 16px` |
| Codice prodotto | `ProductCode` | JetBrains Mono 14px/600, `#E86824` |
| Nome prodotto | `ProductName` | Inter 14px/500, `#1A1714`, `margin-top: 4px` |
| Dettagli | `ProductMeta` | Inter 12px/400, `#7A756E`, `margin-top: 2px` |
| Prezzo | `ProductPrice` | Inter 16px/700, `#1A1714`, `margin-top: 8px` |
| Azioni | `ResultActions` | `display: flex`, `gap: 8px`, `margin-top: 12px` |
| Copia codice | `CopyButton` | `height: 32px`, `radius: 6px`, `border: 1px solid #D9D5D0`, icona Copy 14px, Inter 12px/500 |
| Espandi | `ExpandButton` | `height: 32px`, `radius: 6px`, `bg: #E86824`, `color: white`, Inter 12px/500 |
| Dettaglio espanso | `ProductDetail` | `margin-top: 12px`, `padding-top: 12px`, `border-top: 1px solid #F5F3EF`, tabella: campo/valore |

**Panel Destro — Kit Generazione**

| Elemento | Componente | Specifiche |
|---|---|---|
| Tabella componenti | `ComponentsTable` | `width: 100%`, colonne: Codice 120px, Descrizione 1fr, Qty 60px, Prezzo 80px, Totale 80px |
| Header tabella | `TableHeader` | `bg: #F5F3EF`, Inter 12px/600, `#4A4540`, `height: 40px`, `padding: 0 16px` |
| Row | `TableRow` | `height: 48px`, `padding: 0 16px`, `border-bottom: 1px solid #F5F3EF`, hover: `bg: #FAF9F7` |
| Totale kit | `KitTotal` | `padding: 16px 24px`, `border-top: 2px solid #1A1714`, `display: flex`, `justify-content: space-between` |
| Valore totale | `TotalValue` | Inter 20px/700, `#1A1714` |
| Azioni kit | `KitActions` | `padding: 0 24px 24px`, `display: flex`, `gap: 12px` |
| Salva kit | `ButtonPrimary` | `flex: 1`, `bg: #E86824` |
| Esporta | `ButtonSecondary` | `flex: 1`, `border: 1.5px solid #1A1714` |

**Panel Destro — Analisi Email**

| Elemento | Componente | Specifiche |
|---|---|---|
| Email preview | `EmailPreview` | `bg: white`, `radius: 8px`, `padding: 16px`, `border: 1px solid #F5F3EF` |
| Header email | `EmailHeader` | Da:, Oggetto:, Data: — Inter 13px/400, `#7A756E` |
| Corpo email | `EmailBody` | Inter 14px/400, `#1A1714`, `line-height: 1.6`, prodotti evidenziati con `bg: #FEF3C7` |
| Prodotti trovati | `ExtractedProducts` | Lista card sotto email, stessa struttura ricerca prodotto |
| Conferma estrazione | `ConfirmButton` | `bg: #E86824`, "Aggiungi al kit" |

### 4.3 Interazioni Chiave

| Trigger | Azione | Dettaglio |
|---|---|---|
| Invio messaggio | API call | POST `/api/chat/message`, mostra typing indicator, streaming risposta SSE |
| Click "Cerca codice" | Quick action | Popola input con placeholder hint, setta intent="search" |
| Click "Genera Kit" | Quick action | Popola input con prompt kit, setta intent="kit" |
| Click "Analizza Email" | Quick action | Apre file picker per upload email (.eml/.txt), setta intent="email" |
| Click "Copia codice" | Clipboard | Copia codice in clipboard, toast "Codice copiato!", icona diventa ✓ per 2s |
| Click "Dettagli" | Espansione | Toggle dettaglio prodotto sotto card, animazione 200ms |
| Attach file | Upload | Apre file picker, mostra nome file sopra input, invia con messaggio |
| Microfono | Speech-to-text | Se browser supporta Web Speech API, registra audio, trascrive in input |
| Hover risultato | Stile | `shadow: --shadow-elevated`, `translateY(-1px)` |
| Scroll messaggi | Auto-scroll | Mantiene scroll bottom per nuovi messaggi, salva posizione se user scrolla up |

### 4.4 Stati

| Stato | Descrizione |
|---|---|
| **Empty chat** | Messaggio welcome AI con suggerimenti: "Ciao! Cosa cerchi oggi?" + 3 suggerimenti cliccabili |
| **Loading risposta** | Typing indicator (3 puntini animati) nel messaggio AI |
| **Loading ricerca** | Skeleton: 3 card risultato grigio pulsing nel panel destro |
| **Error API** | Messaggio AI in stile errore: "Si è verificato un errore. Riprova." con bottone "Riprova" |
| **Empty risultati** | Panel destro: "Nessun prodotto trovato. Prova con altri termini." |
| **Streaming** | Messaggio AI si popola carattere per carattere (SSE) |
| **File uploading** | Barra progresso sopra input, nome file con spinner |

### 4.5 Responsive Notes (Tablet 768px)

| Elemento | Adattamento |
|---|---|
| Layout split | Cambia a `grid-template-columns: 1fr` (colonna singola), panel destro diventa sotto chat scrollabile |
| Panel destro | Collassabile: toggle "Risultati ↑" in alto a destra area chat |
| Messaggi | `max-width: 90%` per entrambi |
| Quick actions | Wrap su 2 righe |
| Input | Full width, `height: 52px` |
| Top bar | Search globale nascosta |

---

## 5. Archivio Prodotti (Ricerca Catalogo)

### 5.1 Layout ASCII — Grid View

```
+-----------+---------+----------------------------------------------------------+
|           |FILTRI   |  [🔍 Cerca...            ]  [Grid | List]  [Ordina ▼]    |
|  [LOGO]   |         |                                                          |
|           |Categoria|  +----------------+ +----------------+ +-------------+    |
| Dashboard | ▼ Tutte |  | [img]          | | [img]          | | [img]       |    |
|           |         |  | 5111-A0001     | | 5111-A0045     | | 5111-B0012  |    |
|  Chat AI  |Sottocat |  | Cerniera AGB   | | Serratura MCM  | | Scrocco     |    |
|           | ▼ Tutte |  | E01013.05.04   | | 1092P-16       | | 1403-S      |    |
|  Archivio |         |  | Cerniere       | | Serrature      | | Scrocci     |    |
|  [active] |Marca    |  | EUR 12.50      | | EUR 34.00      | | EUR 8.90    |    |
|           | ▼ Tutte |  | [Disponibile 🟢]| | [Esaurito 🔴]  | | [Bassa 🟡]  |    |
|  Richieste|         |  +----------------+ +----------------+ +-------------+    |
|  Kit      |Prezzo   |  +----------------+ +----------------+ +-------------+    |
|           | [====●=]|  | [img]          | | [img]          | | [img]       |    |
|  Imposta- | 0-500   |  | 5111-C0023     | | 5111-D0056     | | 5111-E0090  |    |
|  zioni    |         |  | Maniglia       | | Cremonese      | | Angolo      |    |
|           |Dispo-   |  | 3670-37        | | 01181P         | | 1400/50     |    |
|           |nibilità |  | Maniglie       | | Cremonesi      | | Angoli      |    |
|           | ☑ Stock |  | EUR 28.00      | | EUR 45.00      | | EUR 5.50    |    |
|           |         |  | [Disponibile 🟢]| | [Disponibile 🟢]| | [Disponibile🟢]| |
|           |[Applica]|  +----------------+ +----------------+ +-------------+    |
|           |         |                                                          |
|           |         |  [1] [2] [3] ... [12]  [Successivo →]                    |
+-----------+---------+----------------------------------------------------------+
```

### 5.2 Layout ASCII — List View

```
+-----------+---------+----------------------------------------------------------+
|  (sidebar)|  FILTRI |  [🔍 Cerca...            ]  [Grid | List]  [Ordina ▼]    |
|           |  (same) |                                                          |
|           |         |  Codice    Nome          Categoria   Prezzo   Stock Azioni |
|           |         |  ─────────────────────────────────────────────────────── |
|           |         |  5111-A..  Cerniera AGB  Cerniere    EUR 12.50 🟢   [👁][📋]|
|           |         |  5111-A..  Serratura MCM Serrature   EUR 34.00 🔴   [👁][📋]|
|           |         |  5111-B..  Scrocco Rullo Scrocci     EUR  8.90 🟡   [👁][📋]|
|           |         |  5111-C..  Maniglia      Maniglie    EUR 28.00 🟢   [👁][📋]|
|           |         |  5111-D..  Cremonese     Cremonesi   EUR 45.00 🟢   [👁][📋]|
|           |         |  5111-E..  Angolo        Angoli      EUR  5.50 🟢   [👁][📋]|
|           |         |                                                          |
|           |         |  [1] [2] [3] ... [12]  [Successivo →]                    |
+-----------+---------+----------------------------------------------------------+
```

### 5.2 Componenti Dettagliati

**Sidebar Filtri**

| Elemento | Componente | Specifiche |
|---|---|---|
| Sidebar | `FilterSidebar` | `width: 240px`, `bg: white`, `border-right: 1px solid #F5F3EF`, `padding: 20px`, `overflow-y: auto` |
| Sezione filtro | `FilterSection` | `margin-bottom: 20px` |
| Label sezione | `FilterLabel` | Inter 13px/600, `#4A4540`, `margin-bottom: 8px`, `text-transform: uppercase`, `letter-spacing: 0.3px` |
| Select | `FilterSelect` | `width: 100%`, `height: 40px`, `radius: 6px`, `border: 1px solid #D9D5D0`, Inter 14px |
| Range slider | `PriceSlider` | Due handle (min/max), track `bg: #F5F3EF`, fill `bg: #E86824`, handle `16px` cerchio arancione |
| Range valori | `PriceRangeValues` | Inter 13px/400, `#7A756E`, `display: flex`, `justify-content: space-between` |
| Checkbox | `FilterCheckbox` | `16px`, checked arancione, label Inter 14px/400 `#1A1714` |
| Bottone applica | `ButtonPrimary` | `width: 100%`, `height: 40px`, `bg: #E86824`, `margin-top: 16px` |
| Bottone reset | `TextButton` | `width: 100%`, Inter 13px/500, `#7A756E`, `margin-top: 8px`, hover: `#E86824` |

**Top Bar**

| Elemento | Componente | Specifiche |
|---|---|---|
| Search | `SearchInput` | `width: 360px`, `height: 40px`, `bg: #F5F3EF`, `radius: 6px`, icona Search 18px, autocomplete dropdown |
| View toggle | `ViewToggle` | `display: flex`, `border: 1px solid #D9D5D0`, `radius: 6px`, `overflow: hidden` |
| Toggle btn | `ToggleButton` | `width: 40px`, `height: 36px`, active: `bg: #1A1714` icona bianca, inactive: `bg: white` icona grigia |
| Sort | `SortSelect` | `width: 160px`, `height: 40px`, opzioni: Rilevanza, Prezzo ↑, Prezzo ↓, Nome, Disponibilità |
| Risultati count | `ResultsCount` | Inter 14px/400, `#7A756E`, "1-24 di 20.450 risultati" |

**Grid View — Card Prodotto**

| Elemento | Componente | Specifiche |
|---|---|---|
| Grid | `ProductGrid` | `display: grid`, `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))`, `gap: 20px` |
| Card | `ProductCard` | `bg: white`, `radius: 8px`, `shadow: --shadow-card`, `overflow: hidden` |
| Immagine | `ProductImage` | `aspect-ratio: 4/3`, `bg: #E8E6E3`, `object-fit: cover`, placeholder: icona Image 48px `#7A756E` |
| Contenuto | `CardContent` | `padding: 16px` |
| Codice | `ProductCode` | JetBrains Mono 13px/600, `#E86824` |
| Nome | `ProductName` | Inter 15px/500, `#1A1714`, `margin-top: 4px`, truncate 2 righe |
| Categoria badge | `CategoryBadge` | `bg: #F5F3EF`, `radius: 4px`, `padding: 2px 8px`, Inter 11px/500, `#4A4540`, `margin-top: 8px` |
| Footer card | `CardFooter` | `display: flex`, `justify-content: space-between`, `align-items: center`, `margin-top: 12px`, `padding-top: 12px`, `border-top: 1px solid #F5F3EF` |
| Prezzo | `ProductPrice` | Inter 16px/700, `#1A1714` |
| Stock badge | `StockBadge` | Disponibile=`bg: #DCFCE7`/`#166534` 🟢, Esaurito=`bg: #FEE2E2`/`#DC2626` 🔴, Bassa=`bg: #FEF3C7`/`#92400E` 🟡 |

**List View — Tabella**

| Elemento | Componente | Specifiche |
|---|---|---|
| Tabella | `ProductTable` | `width: 100%`, `border-collapse: collapse` |
| Header | `TableHeader` | `height: 44px`, `bg: #F5F3EF`, Inter 12px/600, `#4A4540`, `text-align: left`, `padding: 0 16px` |
| Row | `TableRow` | `height: 56px`, `border-bottom: 1px solid #F5F3EF`, hover: `bg: #FAF9F7` |
| Cell codice | `CodeCell` | JetBrains Mono 13px/500, `#E86824`, `padding: 0 16px` |
| Cell nome | `NameCell` | Inter 14px/500, `#1A1714` |
| Cell categoria | `CategoryCell` | CategoryBadge come sopra |
| Cell prezzo | `PriceCell` | Inter 14px/600, `#1A1714`, `text-align: right` |
| Cell stock | `StockCell` | StockBadge centrato |
| Cell azioni | `ActionsCell` | IconButton occhio (dettaglio), IconButton copia, `display: flex`, `gap: 4px` |

**Paginazione**

| Elemento | Componente | Specifiche |
|---|---|---|
| Container | `Pagination` | `display: flex`, `justify-content: center`, `align-items: center`, `gap: 8px`, `margin-top: 24px`, `padding: 16px` |
| Page btn | `PageButton` | `36px × 36px`, `radius: 6px`, active: `bg: #E86824` bianco, inactive: `bg: #F5F3EF`, disabled: opacità 0.4 |
| Prev/Next | `PageNav` | Inter 14px/500, icona freccia |

### 5.3 Interazioni Chiave

| Trigger | Azione | Dettaglio |
|---|---|---|
| Typing in search | Autocomplete | Debounce 300ms, dropdown con suggerimenti (max 8), highlight match |
| Click suggerimento | Navigazione | Vai a prodotto o popola search |
| Cambio filtro | Aggiornamento | Filtri applicati in tempo reale con URL params, badge filtri attivi sotto top bar |
| Click "Applica" | Aggiornamento | Chiama API con filtri, mostra skeleton, aggiorna risultati |
| Click "Reset" | Pulizia | Resetta tutti i filtri, ricarica risultati completi |
| Toggle view | Cambio vista | Salva preferenza in localStorage, transizione fade 150ms |
| Click card grid | Navigazione | Vai a pagina dettaglio prodotto |
| Click occhio list | Navigazione | Vai a pagina dettaglio prodotto |
| Click copia | Clipboard | Copia codice, toast conferma |
| Hover card | Transizione | `translateY(-2px)`, shadow elevata |
| Cambio pagina | Scroll top | Scroll a inizio lista, skeleton durante caricamento |

### 5.4 Stati

| Stato | Descrizione |
|---|---|
| **Empty (nessun filtro)** | Mostra tutti i prodotti, paginazione attiva |
| **Empty (filtrato, 0 risultati)** | Illustrazione + "Nessun prodotto trovato. Prova ad allargare i filtri." + bottone "Resetta filtri" |
| **Loading** | Skeleton grid: 24 card placeholder grigio pulsing. Skeleton list: 15 row |
| **Loading filtri** | Overlay semi-trasparente su risultati con spinner |
| **Error** | Toast rosso: "Errore caricamento catalogo. Riprova." |
| **Offline** | Banner giallo: "Connessione assente. Visualizzazione dati in cache." |

### 5.5 Responsive Notes (Tablet 768px)

| Elemento | Adattamento |
|---|---|
| Sidebar filtri | Collassabile: bottone "Filtri" su top bar apre drawer slide-in da sinistra (`width: 300px`, overlay scuro 40%) |
| Grid | `grid-template-columns: repeat(2, 1fr)` |
| List | Tabella scrollabile orizzontalmente (`overflow-x: auto`), colonne codice+nome+prezzo visibili, altre nascoste |
| Search | `width: 100%` (sotto top bar su riga separata) |
| Top bar | Stack verticale: search → view toggle + sort |
| Paginazione | Pagine intermedie nascoste, solo: Prev [N] Next |

---

## 6. Kit Builder (Generazione Kit)

### 6.1 Layout ASCII — Step 1 Specifiche

```
+-----------+--------------------------------------------------------------------+
|           |  GENERA KIT FERRAMENTA                    [? Guida] [Salva B]   |
|  [LOGO]   |                                                                    |
|           |  ─────────────────────────────────────────────────────────────     |
| Dashboard |  ●──○──○──○                                                      |
|           |  1    2    3    4                                                  |
|  Chat AI  | Specifiche  Configurazione  Review  Esporta                       |
|           |                                                                    |
|  Archivio |  +----------------------+  +----------------------+               |
|           |  | TIPO FINESTRA        |  | DIMENSIONI (mm)      |               |
|  Richieste|  | [Anta battente   ▼]  |  | Larghezza: [______]  |               |
|  Kit      |  |                      |  | Altezza:   [______]  |               |
|  [active] |  +----------------------+  +----------------------+               |
|           |                                                                    |
|  Imposta- |  +----------------------+  +----------------------+               |
|  zioni    |  | MATERIALE            |  | ARIA / ASSE          |               |
|           |  | (•) Alluminio        |  | Aria:  [12    ▼]     |               |
|           |  | ( ) PVC              |  | Asse:  [13    ▼]     |               |
|           |  | ( ) Legno            |  |                      |               |
|           |  | ( ) Alluminio/Legno  |  +----------------------+               |
|           |  +----------------------+                                        |
|           |                                                                    |
|           |  +----------------------+  +----------------------+  +----------+ |
|           |  | BATTUTA              |  | SEDE                 |  | MANO     | |
|           |  | [15    ▼]            |  | [18    ▼]            |  | (•) DX   | |
|           |  |                      |  |                      |  | ( ) SX   | |
|           |  +----------------------+  +----------------------+  | Tirare   | |
|           |                                                     | Spingere | |
|           |  +----------------------+  +----------------------+  +----------+ |
|           |  | FINITURA             |  | SERIE                |               |
|           |  | [Argento      ▼]     |  | [ARTECH       ▼]     |               |
|           |  +----------------------+  +----------------------+               |
|           |                                                                    |
|           |  [            Avanti →            ]                              |
|           |                                                                    |
+-----------+--------------------------------------------------------------------+
```

### 6.2 Layout ASCII — Step 2 Configurazione

```
+-----------+--------------------------------------------------------------------+
|           |  GENERA KIT FERRAMENTA                              [Salva B]   |
|  [LOGO]   |                                                                    |
|           |  ─────────────────────────────────────────────────────────────     |
| Dashboard |  ●──●──○──○                                                      |
|           |  1    2    3    4                                                  |
|  Chat AI  | Specifiche  Configurazione  Review  Esporta                       |
|           |                                                                    |
|  Archivio |  Componenti calcolati per: Anta battente, Alluminio, 800×1200mm  |
|           |  [Modifica specifiche ←]                                           |
|  Richieste|                                                                    |
|  Kit      |  +--------+------+------+-----+------+------+----------+---------+ |
|  [active] |  | # | Codice | Descrizione         | Qty | Prezzo | Totale | Azioni  | |
|           |  +--------+------+------+-----+------+------+----------+---------+ |
|           |  | 1 | C0001  | Cerniera superiore  |  2  | 12.50  | 25.00  | [✎][🗑] | |
|           |  | 2 | C0002  | Cerniera inferiore  |  2  | 12.50  | 25.00  | [✎][🗑] | |
|           |  | 3 | C0003  | Scrocco centrale    |  1  |  8.90  |  8.90  | [✎][🗑] | |
|           |  | 4 | C0004  | Maniglia DK         |  1  | 28.00  | 28.00  | [✎][🗑] | |
|           |  | 5 | C0005  | Cremonese           |  1  | 45.00  | 45.00  | [✎][🗑] | |
|           |  +--------+------+------+-----+------+------+----------+---------+ |
|           |                                                                    |
|           |  [+ Aggiungi componente]        TOTALE PROVVISORIO: EUR 131.90     |
|           |                                                                    |
|           |  [← Indietro]              [          Avanti →          ]          |
|           |                                                                    |
+-----------+--------------------------------------------------------------------+
```

### 6.3 Layout ASCII — Step 3 Review & Step 4 Esporta

```
+-----------+--------------------------------------------------------------------+
|           |  Step 3 REVIEW:                                                   |
|  (sidebar)|  Tabella completa (come step 2 ma readonly) + totale finale        |
|           |  Note: [____________________________________]                      |
|           |  [← Indietro]              [          Esporta →        ]          |
|           +--------------------------------------------------------------------+
|           |  Step 4 ESPORTA:                                                  |
|           |  +-------------------+ +-------------------+ +-----------------+  |
|           |  |   [📄 icona]      | |   [✉ icona]       | |   [💾 icona]    |  |
|           |  |   Scarica PDF     | |   Invia Email     | |   Salva in CRM  |  |
|           |  |   Kit completo    | |   Al cliente      | |   per follow-up |  |
|           |  |   con listino     | |   o all'ufficio   | |                 |  |
|           |  +-------------------+ +-------------------+ +-----------------+  |
|           |                                                                    |
|           |  [🔄 Nuovo Kit]                                                  |
+-----------+--------------------------------------------------------------------+
```

### 6.4 Componenti Dettagliati

**Stepper**

| Elemento | Componente | Specifiche |
|---|---|---|
| Container | `Stepper` | `display: flex`, `align-items: center`, `justify-content: center`, `gap: 0`, `margin-bottom: 32px` |
| Step | `StepItem` | `display: flex`, `flex-direction: column`, `align-items: center`, `gap: 8px` |
| Cerchio | `StepCircle` | `40px × 40px`, `radius: 50%`, completato: `bg: #E86824` bianco, attivo: `bg: #E86824` `border: 3px solid #F5F3EF`, futuro: `bg: #F5F3EF` `#7A756E` |
| Label | `StepLabel` | Inter 13px/500, completato/attivo: `#1A1714`, futuro: `#7A756E` |
| Connettore | `StepConnector` | `width: 60px`, `height: 2px`, completato: `bg: #E86824`, futuro: `bg: #D9D5D0` |

**Step 1 — Form Specifiche**

| Elemento | Componente | Specifiche |
|---|---|---|
| Container | `SpecsForm` | `max-width: 720px`, `margin: 0 auto`, `display: grid`, `grid-template-columns: 1fr 1fr`, `gap: 24px` |
| Gruppo campo | `FormGroup` | `display: flex`, `flex-direction: column`, `gap: 6px` |
| Label | `FormLabel` | Inter 14px/600, `#4A4540` |
| Select | `FormSelect` | `height: 48px`, `radius: 6px`, `border: 1px solid #D9D5D0`, `padding: 0 12px`, Inter 15px, icona ChevronDown 16px a destra |
| Input dimensioni | `DimensionInput` | `height: 48px`, `width: 100%`, placeholder "mm", JetBrains Mono 15px, suffix "mm" grigio |
| Radio group | `RadioGroup` | `display: flex`, `flex-direction: column`, `gap: 10px` |
| Radio item | `RadioItem` | `display: flex`, `align-items: center`, `gap: 10px`, `height: 40px`, `padding: 0 14px`, `radius: 6px`, `border: 1px solid #D9D5D0`, selected: `border-color: #E86824`, `bg: #FEF0E6` |
| Radio circle | `RadioCircle` | `18px`, cerchio vuoto, selected: cerchio pieno arancione |
| Bottone avanti | `ButtonPrimary` | `grid-column: 1 / -1`, `height: 52px`, `bg: #E86824`, Inter 16px/600, `margin-top: 16px` |

**Step 2 — Configurazione**

| Elemento | Componente | Specifiche |
|---|---|---|
| Info bar | `ConfigInfoBar` | `bg: #FEF0E6`, `radius: 8px`, `padding: 16px 20px`, Inter 14px/500, `#1A1714`, bottone testuale "Modifica" |
| Tabella | `ComponentsTable` | `width: 100%`, `margin-top: 20px`, `radius: 8px`, `overflow: hidden`, `border: 1px solid #F5F3EF` |
| Header | `TableHeader` | `height: 44px`, `bg: #F5F3EF`, Inter 12px/600, `#4A4540` |
| Row | `TableRow` | `height: 56px`, `border-bottom: 1px solid #F5F3EF`, hover: `bg: #FAF9F7` |
| Cell # | `IndexCell` | Inter 13px/400, `#7A756E`, `text-align: center` |
| Cell codice | `CodeCell` | JetBrains Mono 13px/500, `#E86824` |
| Cell descrizione | `DescCell` | Inter 14px/400, `#1A1714` |
| Cell qty | `QtyCell` | Inter 14px/600, `#1A1714`, `text-align: center` |
| Cell prezzo | `PriceCell` | Inter 14px/400, `#4A4540`, `text-align: right` |
| Cell totale | `TotalCell` | Inter 14px/600, `#1A1714`, `text-align: right` |
| Cell azioni | `ActionCell` | IconButton modifica (Pencil 14px), IconButton elimina (Trash 14px rosso) |
| Bottone aggiungi | `AddButton` | `border: 1.5px dashed #D9D5D0`, `height: 48px`, Inter 14px/500, `#7A756E`, hover: `border-color: #E86824`, `#E86824` |
| Totale bar | `TotalBar` | `display: flex`, `justify-content: space-between`, `align-items: center`, `padding: 20px 0`, `border-top: 2px solid #1A1714` |
| Label totale | `TotalLabel` | Inter 16px/500, `#4A4540` |
| Valore totale | `TotalValue` | Inter 24px/700, `#1A1714` |
| Navigazione | `StepNav` | `display: flex`, `justify-content: space-between`, `margin-top: 24px` |
| Bottone indietro | `ButtonSecondary` | `border: 1.5px solid #D9D5D0`, Inter 15px |

**Step 3 — Review**

| Elemento | Componente | Specifiche |
|---|---|---|
| Tabella | Stessa struttura step 2 ma readonly (no azioni modifica) |
| Note | `TextArea` | `min-height: 80px`, `width: 100%`, placeholder "Note aggiuntive per il cliente..." |
| Bottone esporta | `ButtonPrimary` | `height: 52px`, `bg: #E86824` |

**Step 4 — Esporta**

| Elemento | Componente | Specifiche |
|---|---|---|
| Grid | `ExportGrid` | `display: grid`, `grid-template-columns: repeat(3, 1fr)`, `gap: 24px`, `max-width: 720px`, `margin: 32px auto` |
| Card esporta | `ExportCard` | `bg: white`, `radius: 8px`, `shadow: --shadow-card`, `padding: 32px 24px`, `display: flex`, `flex-direction: column`, `align-items: center`, `text-align: center`, hover: `shadow: --shadow-elevated`, `translateY(-2px)` |
| Icona | `ExportIcon` | `48px × 48px`, `radius: 12px`, `bg: #FEF0E6`, icona 24px `#E86824` |
| Titolo | `ExportTitle` | Inter 16px/600, `#1A1714`, `margin-top: 16px` |
| Descrizione | `ExportDesc` | Inter 13px/400, `#7A756E`, `margin-top: 4px` |
| Bottone nuovo | `ButtonSecondary` | `margin: 0 auto`, `display: block` |
| Success state | `SuccessOverlay` | Checkmark animato, "Kit esportato con successo!" |

### 6.5 Interazioni Chiave

| Trigger | Azione | Dettaglio |
|---|---|---|
| Cambio select/input Step 1 | Validazione | Valida campo, segna valido con bordo verde, mostra errore se invalido |
| Click "Avanti" Step 1 | Validazione + API | Valida tutti i campi, se ok: POST `/api/kit/calculate`, mostra loading, passa a Step 2 |
| Click "Modifica qty" Step 2 | Inline edit | Cell qty diventa input numerico, valida >0, ricalcola totale in tempo reale |
| Click "Elimina" Step 2 | Conferma | Confirm dialog: "Eliminare questo componente?", poi rimuovi e ricalcola |
| Click "Aggiungi componente" | Modal ricerca | Apre modal con search catalogo, selezione aggiunge alla tabella |
| Click "Avanti" Step 2 | Navigazione | Passa a Step 3 (review), nessuna API call |
| Click "Esporta →" Step 3 | API call | POST `/api/kit/export`, payload: componenti + note, risposta con URL PDF |
| Click "Scarica PDF" | Download | GET `/api/kit/{id}/pdf`, download file |
| Click "Invia Email" | Modal | Apre modal con input email, oggetto pre-compilato, invia |
| Click "Salva in CRM" | API call | POST `/api/crm/kit`, mostra toast successo |
| Click "Nuovo Kit" | Reset | Torna a Step 1 con form pulito |

### 6.6 Stati

| Stato | Descrizione |
|---|---|
| **Step 1 empty** | Form pulito, nessun campo compilato, bottone avanti disabilitato |
| **Step 1 valid parziale** | Alcuni campi compilati, bottone abilitato se campi required OK |
| **Step 1 error** | Campi invalidi con bordo rosso `#DC2626`, messaggio sotto |
| **Step 1→2 loading** | Spinner full-page overlay con "Calcolo componenti..." |
| **Step 2 empty table** | Messaggio: "Nessun componente calcolato. Verifica le specifiche." |
| **Step 2 modificato** | Badge "Modificato" accanto a componenti editati dall'utente |
| **Step 3 readonly** | Tabella non editabile, note facoltative |
| **Step 4 loading** | Card esporta mostrano spinner al posto delle icone |
| **Step 4 success** | Checkmark verde animato, card diventano verdi con bordo `#16A34A` |
| **Step 4 error** | Card diventano rosse, messaggio "Errore esportazione. Riprova." |

### 6.7 Responsive Notes (Tablet 768px)

| Elemento | Adattamento |
|---|---|
| Stepper | Label nascoste, solo numeri. Connettore più corto |
| Step 1 form | `grid-template-columns: 1fr` (colonna singola) |
| Radio materiali | 2 colonne `grid-template-columns: 1fr 1fr` |
| Step 2 tabella | Scroll orizzontale, colonne: Codice + Descrizione + Qty (prezzo nascosto) |
| Totale bar | Stack: totale sopra, bottoni sotto full-width |
| Step 4 export | `grid-template-columns: 1fr` (colonna singola), card full-width stack |
| Bottoni navigazione | Full-width stack: Avanti sopra, Indietro sotto |

---

## 7. Richieste Kit (Gestione Richieste Cliente)

### 7.1 Layout ASCII — Lista

```
+-----------+--------------------------------------------------------------------+
|           |  RICHIESTE KIT                                                      |
|  [LOGO]   |  [Tutti] [Nuove 🟡] [In lavorazione 🔵] [Completate 🟢] [Inviate 📤] |
|           |                                                                    |
| Dashboard |  [🔍 Cerca cliente...]      Da: [__/__/____] A: [__/__/____]      |
|           |                                                                    |
|  Chat AI  |  +--------+--------------+------+------------+---------+---------+ |
|           |  | ID     | Cliente      | Data | Stato      | Azioni  |         | |
|  Archivio |  +--------+--------------+------+------------+---------+---------+ |
|           |  | #1042  | Rossi Serram.| 14/01| Completata🟢| [👁][✉][✓]        | |
|  Richieste|  | #1041  | Bianchi Infis| 14/01| In lavoraz.🔵|[👁][✉][✓]        | |
|  Kit      |  | #1040  | Nardi Porte  | 13/01| Nuova 🟡   | [👁][✉][→]        | |
|  [active] |  | #1039  | Gigli Finestr| 13/01| Completata🟢| [👁][✉][✓]        | |
|           |  | #1038  | Moretti Allum| 12/01| Inviata 📤 | [👁][✉][✓]        | |
|           |  | #1037  | Fabbri Infiss| 12/01| In lavoraz.🔵|[👁][✉][→]        | |
|           |  +--------+--------------+------+------------+---------+---------+ |
|           |                                                                    |
|           |  [1] [2] [3] ... [8]  [Successivo →]                             |
+-----------+--------------------------------------------------------------------+
```

### 7.2 Layout ASCII — Dettaglio Richiesta

```
+-----------+--------------------------------------------------------------------+
|           |  [← Torna alla lista]    Richiesta #1040                         |
|  (sidebar)|                                                                    |
|           |  +----------------------+  +----------------------+               |
|           |  | INFO CLIENTE         |  | SPECIFICHE RICHIESTA |               |
|           |  | Mario Nardi          |  | Tipo: Anta battente  |               |
|           |  | Nardi Porte Srl      |  | Dimensioni: 800×1200 |               |
|           |  | mario@nardi.it       |  | Materiale: Alluminio |               |
|           |  | 0573 987654          |  | Aria: 15             |               |
|           |  |                      |  | Asse: 16             |               |
|           |  | [✉ Invia email]      |  | Battuta: 20          |               |
|           |  | [📞 Chiama]          |  | Sede: 22             |               |
|           |  +----------------------+  +----------------------+               |
|           |                                                                    |
|           |  +--------------------------------------------------------------+ |
|           |  | KIT GENERATO                                                 | |
|           |  | # | Codice   | Descrizione        | Qty | Prezzo  | Totale   | |
|           |  |───|──────────|────────────────────|─────|─────────|──────────| |
|           |  | 1 | C0001    | Cerniera sup.      |  2  | 12.50   | 25.00    | |
|           |  | 2 | C0002    | Cerniera inf.      |  2  | 12.50   | 25.00    | |
|           |  | 3 | C0003    | Scrocco centrale   |  1  |  8.90   |  8.90    | |
|           |  |                                                        58.90 | |
|           |  +--------------------------------------------------------------+ |
|           |                                                                    |
|           |  +--------------------------------------------------------------+ |
|           |  | NOTE AGENTE                                                  | |
|           |  | [______________________________________________]             | |
|           |  | [Salva note]                                                 | |
|           |  +--------------------------------------------------------------+ |
|           |                                                                    |
|           |  STATO: Nuova 🟡                                                 |
|           |  [In lavorazione →]  (disabled: Completata, Inviata)             |
|           |                                                                    |
+-----------+--------------------------------------------------------------------+
```

### 7.3 Componenti Dettagliati

**Lista**

| Elemento | Componente | Specifiche |
|---|---|---|
| Header | `PageHeader` | Inter 24px/700, `#1A1714`, `margin-bottom: 20px` |
| Filter tabs | `FilterTabs` | `display: flex`, `gap: 8px`, `margin-bottom: 20px`, scroll orizzontale su mobile |
| Filter tab | `FilterTab` | `height: 36px`, `radius: 6px`, `padding: 0 14px`, Inter 14px/500, active: `bg: #1A1714` bianco, inactive: `bg: #F5F3EF` `#4A4540` |
| Search bar | `SearchInput` | `width: 280px`, `height: 40px`, `bg: #F5F3EF`, `radius: 6px` |
| Date picker | `DateRange` | Due input data `width: 140px` ciascuno, icona Calendar |
| Tabella | `RequestsTable` | `width: 100%`, `radius: 8px`, `overflow: hidden`, `border: 1px solid #F5F3EF` |
| Header | `TableHeader` | `height: 44px`, `bg: #F5F3EF`, Inter 12px/600 `#4A4540` |
| Row | `TableRow` | `height: 56px`, hover: `bg: #FAF9F7`, cursor pointer |
| Cell ID | `MonoCell` | JetBrains Mono 14px/500, `#E86824` |
| Cell cliente | `TextCell` | Inter 14px/500, `#1A1714` |
| Cell data | `DateCell` | Inter 13px/400, `#7A756E`, formato DD/MM |
| Cell stato | `StatusBadge` | Come definito in Dashboard |
| Cell azioni | `ActionsCell` | IconButton: eye (dettaglio), mail (invia email), check (marca completata) — `display: flex`, `gap: 4px` |

**Dettaglio**

| Elemento | Componente | Specifiche |
|---|---|---|
| Breadcrumb | `Breadcrumb` | Inter 14px/500, `#E86824`, `margin-bottom: 20px` |
| Grid info | `InfoGrid` | `display: grid`, `grid-template-columns: 1fr 1fr`, `gap: 20px`, `margin-bottom: 24px` |
| Card info | `InfoCard` | `bg: white`, `radius: 8px`, `shadow: --shadow-card`, `padding: 20px` |
| Card titolo | `CardTitle` | Inter 14px/600, `#7A756E`, uppercase, `letter-spacing: 0.5px`, `margin-bottom: 12px` |
| Campo cliente | `InfoField` | `display: flex`, `flex-direction: column`, `gap: 2px`, `margin-bottom: 10px` |
| Label campo | `FieldLabel` | Inter 12px/400, `#7A756E` |
| Valore campo | `FieldValue` | Inter 15px/500, `#1A1714` |
| Bottone email | `ButtonSecondary` | `height: 36px`, icona Mail 16px, Inter 13px |
| Bottone chiama | `ButtonSecondary` | `height: 36px`, icona Phone 16px, Inter 13px |
| Kit tabella | `KitTable` | Stessa struttura Kit Builder review |
| Note textarea | `TextArea` | `width: 100%`, `min-height: 80px`, `radius: 6px`, `border: 1px solid #D9D5D0` |
| Salva note | `ButtonSecondary` | `height: 36px`, Inter 13px |
| Stato workflow | `WorkflowBar` | `display: flex`, `align-items: center`, `gap: 12px`, `padding: 20px`, `bg: #F5F3EF`, `radius: 8px` |
| Stato attuale | `CurrentStatus` | StatusBadge grande `padding: 8px 16px`, Inter 14px/600 |
| Bottone avanzamento | `WorkflowButton` | `height: 44px`, `radius: 6px`, `bg: #E86824`, Inter 15px/600 bianco, disabled: `bg: #F5F3EF`, `#7A756E` |
| Stato finale | `CompletedState` | Checkmark verde, "Richiesta completata e inviata." Inter 14px/500 `#16A34A` |

### 7.4 Interazioni Chiave

| Trigger | Azione | Dettaglio |
|---|---|---|
| Click filtro tab | Filtra | Aggiorna tabella, URL params, count nel badge |
| Click riga | Navigazione | Vai a detail view richiesta |
| Click icona email | Compose | Apre mailto: con oggetto pre-compilato |
| Click icona check | Avanzamento | PATCH `/api/requests/{id}/status`, avanza al prossimo stato |
| Salva note | API | PATCH `/api/requests/{id}/notes`, toast "Note salvate" |
| Click "In lavorazione →" | Cambio stato | Da Nuova a In lavorazione, tabella aggiorna, badge cambia |
| Click "Completata →" | Cambio stato | Da In lavorazione a Completata |
| Click "Inviata" | Cambio stato | Da Completata a Inviata, ultimo stato |
| Date filter | Filtra | Filtra per range data, aggiorna in tempo reale |

### 7.5 Stati

| Stato | Descrizione |
|---|---|
| **Lista empty** | Nessuna richiesta: illustrazione + "Nessuna richiesta kit. I clienti possono richiederli dal sito web." |
| **Lista filtrata empty** | "Nessuna richiesta con questi filtri." + bottone reset |
| **Lista loading** | Skeleton: 8 row pulsing |
| **Dettaglio loading** | Skeleton: card info grigio, tabella skeleton |
| **Errore** | Toast: "Errore caricamento richiesta." |
| **Workflow completato** | Bottoni avanzamento nascosti, stato "Inviata" con checkmark verde |

### 7.6 Responsive Notes (Tablet 768px)

| Elemento | Adattamento |
|---|---|
| Filter tabs | Scroll orizzontale con fade laterale |
| Search + date | Stack verticale, full width |
| Tabella | Scroll orizzontale, colonne ID+Cliente+Stato visibili |
| Dettaglio grid | `grid-template-columns: 1fr`, card info stack |
| Workflow bar | Stack: stato sopra, bottone sotto full-width |
| Kit tabella | Scroll orizzontale |

---

## 8. Admin — Gestione Utenti

### 8.1 Layout ASCII — Lista Utenti

```
+-----------+--------------------------------------------------------------------+
|           |  GESTIONE UTENTI                              [+ Crea Utente]     |
|  [LOGO]   |                                                                    |
|           |  [Tutti] [Agenti] [Admin]        [🔍 Cerca nome o email...]       |
| Dashboard |                                                                    |
|           |  +--------+------------+--------+--------+------+---------+------+ |
|  Chat AI  |  | Nome   | Email      | Ruolo  | Stato  | Creato | Azioni  |      | |
|           |  +--------+------------+--------+--------+------+---------+------+ |
|  Archivio |  | A. Bianchi| a.bian..| Agente | Attivo |12/01 | [✎][⊘][🗑]      | |
|           |  | M. Rossi  | m.rossi.| Agente | Attivo |10/01 | [✎][⊘][🗑]      | |
|  Richieste|  | L. Verdi  | l.verdi.| Agente |Sospeso|08/01 | [✎][↩][🗑]      | |
|  Kit      |  | Admin     | admin@..| Admin  | Attivo |01/01 | [✎][⊘][—]       | |
|           |  | S. Neri   | s.neri..| Agente | Attivo |05/01 | [✎][⊘][🗑]      | |
|  Imposta- |  +--------+------------+--------+--------+------+---------+------+ |
|  zioni    |                                                                    |
|  [active] |                                                                    |
+-----------+--------------------------------------------------------------------+
```

### 8.2 Layout ASCII — Modal Crea Utente

```
+-----------+----------------------------------------------------+----------------+
|           |                                                    |  CREA UTENTE   |
|  (sidebar)|                                                    |  +------------+  |
|           |                                                    |  | Nome       |  |
|           |                                                    |  | [________] |  |
|           |                                                    |  |            |  |
|           |                                                    |  | Email      |  |
|           |                                                    |  | [________] |  |
|           |                                                    |  |            |  |
|           |                                                    |  | Ruolo      |  |
|           |                                                    |  | [Agente ▼] |  |
|           |                                                    |  |            |  |
|           |                                                    |  | Password   |  |
|           |                                                    |  | [________] |  |
|           |                                                    |  | [Genera ↻] |  |
|           |                                                    |  |            |  |
|           |                                                    |  | [✉ Invia   |
|           |                                                    |  |  credenziali]|  |
|           |                                                    |  |            |  |
|           |                                                    |  | [Annulla] [Crea]|
|           |                                                    |  +------------+  |
+-----------+----------------------------------------------------+----------------+
```

### 8.3 Componenti Dettagliati

**Pagina**

| Elemento | Componente | Specifiche |
|---|---|---|
| Header | `PageHeader` | `display: flex`, `justify-content: space-between`, `align-items: center` |
| Titolo | `Heading1` | Inter 24px/700, `#1A1714` |
| Bottone crea | `ButtonPrimary` | `bg: #E86824`, icona Plus 18px, Inter 15px/600, `height: 44px` |
| Filter tabs | `FilterTabs` | Stessi stili Richieste Kit |
| Search | `SearchInput` | `width: 320px`, `height: 40px`, `bg: #F5F3EF`, `radius: 6px` |
| Tabella | `UsersTable` | `width: 100%`, `radius: 8px`, `border: 1px solid #F5F3EF`, `overflow: hidden` |
| Header | `TableHeader` | `height: 44px`, `bg: #F5F3EF`, Inter 12px/600 `#4A4540` |
| Row | `TableRow` | `height: 56px`, hover: `bg: #FAF9F7` |
| Cell nome | `UserCell` | Avatar 32px cerchio `#E86824` con iniziali + Inter 14px/500 `#1A1714`, `display: flex`, `align-items: center`, `gap: 12px` |
| Cell email | `EmailCell` | Inter 14px/400, `#4A4540` |
| Cell ruolo | `RoleBadge` | Agente=`bg: #F5F3EF` `#4A4540`, Admin=`bg: #FEF0E6` `#E86824`, `radius: 4px`, `padding: 4px 10px`, Inter 12px/600 |
| Cell stato | `StatusBadge` | Attivo=`bg: #DCFCE7` `#16A34A`, Sospeso=`bg: #FEF3C7` `#92400E`, `radius: 4px`, `padding: 4px 10px` |
| Cell data | `DateCell` | Inter 13px/400, `#7A756E`, formato DD/MM/YY |
| Cell azioni | `ActionsCell` | IconButton modifica (Pencil 16px), IconButton disattiva (PauseCircle 16px), IconButton attiva (PlayCircle 16px verde), IconButton elimina (Trash 16px `#DC2626`), `display: flex`, `gap: 4px` |

**Modal Crea Utente**

| Elemento | Componente | Specifiche |
|---|---|---|
| Overlay | `ModalOverlay` | `bg: rgba(26,23,20,0.5)`, `backdrop-filter: blur(2px)` |
| Modal | `Modal` | `width: 440px`, `bg: white`, `radius: 12px`, `shadow: --shadow-elevated`, `padding: 32px` |
| Titolo | `ModalTitle` | Inter 20px/700, `#1A1714`, `margin-bottom: 24px` |
| Form | `UserForm` | `display: flex`, `flex-direction: column`, `gap: 16px` |
| Gruppo | `FormGroup` | `display: flex`, `flex-direction: column`, `gap: 6px` |
| Label | `FormLabel` | Inter 14px/600, `#4A4540` |
| Input nome | `TextInput` | `height: 44px`, `radius: 6px`, `border: 1px solid #D9D5D0`, Inter 15px |
| Input email | `TextInput` | Stesso stile, type="email" |
| Select ruolo | `FormSelect` | `height: 44px`, opzioni: Agente, Admin |
| Password group | `PasswordGroup` | `display: flex`, `gap: 8px` |
| Input password | `TextInput` | `flex: 1`, type="text" (visibile per admin), JetBrains Mono 14px |
| Genera btn | `IconButton` | `height: 44px`, `width: 44px`, icona RefreshCw 16px, `border: 1px solid #D9D5D0` |
| Checkbox invio | `CheckboxRow` | `display: flex`, `align-items: center`, `gap: 10px`, label Inter 14px/400 `#4A4540` |
| Footer modal | `ModalFooter` | `display: flex`, `justify-content: flex-end`, `gap: 12px`, `margin-top: 24px` |
| Annulla | `ButtonSecondary` | `height: 40px`, Inter 14px |
| Crea | `ButtonPrimary` | `height: 40px`, `bg: #E86824`, Inter 14px/600 |

### 8.4 Interazioni Chiave

| Trigger | Azione | Dettaglio |
|---|---|---|
| Click "Crea Utente" | Modal | Apre modal con form pulito, password auto-generata |
| Click "Genera" password | Generazione | Genera password casuale 12 char (lettere, numeri, simboli), popola input |
| Click "Crea" | API | POST `/api/admin/users`, payload: nome, email, ruolo, password. Se checkbox: invia email credenziali |
| Success crea | Feedback | Chiude modal, toast "Utente creato con successo. Email inviata.", tabella aggiornata |
| Click modifica (✎) | Modal | Apre modal pre-popolato con dati utente |
| Click disattiva (⊘) | Conferma + API | Confirm: "Disattivare {nome}? Non potrà più accedere." PATCH `/api/admin/users/{id}/deactivate` |
| Click attiva (↩) | API | PATCH `/api/admin/users/{id}/activate`, stato torna Attivo |
| Click elimina (🗑) | Conferma + API | Confirm: "Eliminare {nome}? Questa azione è irreversibile." DELETE `/api/admin/users/{id}` |
| Filtro tab | Filtra | Aggiorna tabella per ruolo, URL params |
| Search | Filtra | Debounce 300ms, cerca per nome o email |
| Invio credenziali | Email | Checkbox default: true, POST `/api/admin/users/{id}/send-credentials` |

### 8.5 Stati

| Stato | Descrizione |
|---|---|
| **Lista empty** | "Nessun utente trovato. Crea il primo utente agente." |
| **Lista filtrata empty** | "Nessun utente con questo ruolo." |
| **Loading** | Skeleton: 6 row pulsing |
| **Modal loading** | Spinner sul bottone "Crea", form disabilitato |
| **Modal error** | Messaggi sotto campi invalidi, banner rosso per errori server |
| **Success crea** | Toast verde, nuovo utente appare in tabella con stato "Attivo" |
| **Disattivato** | Riga utente opacità 0.6, stato "Sospeso", azione cambia da ⊘ a ↩ |
| **Errore permessi** | Toast rosso: "Non hai i permessi per questa azione." (solo admin vede questa pagina) |

### 8.6 Responsive Notes (Tablet 768px)

| Elemento | Adattamento |
|---|---|
| Header | Stack: titolo sopra, bottone crea sotto full-width |
| Filter + search | Stack verticale |
| Tabella | Scroll orizzontale, colonne: Nome+Ruolo+Stato+Azioni |
| Modal | `width: 100%`, `margin: 24px`, max-height `calc(100vh - 48px)`, scroll interno |
| Azioni utente | IconButton mantengono dimensione touch 40px |

---

## Componenti Condivisi Cross-Schermata

### Toast / Notifiche

| Elemento | Specifiche |
|---|---|
| Container | `position: fixed`, `top: 24px`, `right: 24px`, `z-index: 100`, `display: flex`, `flex-direction: column`, `gap: 8px` |
| Toast success | `bg: #DCFCE7`, `border-left: 3px solid #16A34A`, `radius: 8px`, `padding: 14px 20px`, Inter 14px/500 `#166534`, `shadow: --shadow-elevated` |
| Toast error | `bg: #FEE2E2`, `border-left: 3px solid #DC2626`, radius/padding/ombra uguali, `#DC2626` |
| Toast warning | `bg: #FEF3C7`, `border-left: 3px solid #F59E0B`, `#92400E` |
| Toast info | `bg: #DBEAFE`, `border-left: 3px solid #3B82F6`, `#1E40AF` |
| Icona | 20px a sinistra del testo, colore match |
| Auto-dismiss | 4 secondi, progress bar sotto che si svuota |

### Confirm Dialog

| Elemento | Specifiche |
|---|---|
| Overlay | Come modal overlay |
| Dialog | `width: 400px`, `bg: white`, `radius: 12px`, `padding: 24px` |
| Icona | 48px cerchio, `bg` variabile per tipo (warning=giallo, danger=rosso) |
| Titolo | Inter 18px/600, `#1A1714` |
| Messaggio | Inter 14px/400, `#4A4540`, `margin-top: 8px` |
| Azioni | `display: flex`, `justify-content: flex-end`, `gap: 12px`, `margin-top: 24px` |
| Bottone conferma | `bg: #DC2626` per elimina, `#E86824` per azioni neutre |

### Loading Spinner

| Elemento | Specifiche |
|---|---|
| Spinner | Cerchio `20px`, `border: 2px solid #F5F3EF`, `border-top-color: #E86824`, `border-radius: 50%`, `animation: spin 0.6s linear infinite` |
| Full-page overlay | `position: fixed`, inset 0, `bg: rgba(250,249,247,0.8)`, `display: flex`, `justify-content: center`, `align-items: center`, `z-index: 90` |
| Inline skeleton | Rettangolo `bg: #E8E6E3`, `radius: 4px`, `animation: pulse 1.5s ease-in-out infinite` |

### Empty State

| Elemento | Specifiche |
|---|---|
| Container | `display: flex`, `flex-direction: column`, `align-items: center`, `justify-content: center`, `padding: 64px 24px`, `text-align: center` |
| Icona | `64px × 64px`, `radius: 16px`, `bg: #F5F3EF`, icona 32px `#7A756E` |
| Titolo | Inter 18px/600, `#1A1714`, `margin-top: 20px` |
| Descrizione | Inter 14px/400, `#7A756E`, `max-width: 400px`, `margin-top: 8px` |
| Azione | `ButtonPrimary` o `ButtonSecondary`, `margin-top: 20px` |

---

## Note Implementazione

### Performance
- **Virtualizzazione**: Tabella > 50 righe usa virtual scrolling
- **Debounce**: Search 300ms, filtri con chiamata API
- **Lazy loading**: Immagini prodotto con `loading="lazy"`, placeholder SVG
- **Cache**: Risultati catalogo in sessionStorage, stat dashboard in SWR pattern

### Accessibilità
- **Contrasto**: Tutti i testi sopra WCAG AA 4.5:1
- **Focus**: Outline arancione `2px solid rgba(232,104,36,0.3)` su tutti gli elementi interattivi
- **ARIA**: Label su icon buttons, live regions per toast, role="status" per loading
- **Keyboard**: Tab order logico, Escape chiude modal/dropdown, Enter su form submit

### Token Design
```css
:root {
  --color-brand: #E86824;
  --color-dark: #1A1714;
  --color-neutral-700: #4A4540;
  --color-neutral-500: #7A756E;
  --color-neutral-100: #F5F3EF;
  --color-neutral-50: #FAF9F7;
  --font-ui: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-card: 0 1px 3px rgba(26,23,20,0.06);
  --shadow-elevated: 0 4px 12px rgba(26,23,20,0.10);
}
```

---

*Documento preparato per Utensilferramenta Pistoiese S.p.A. — Interface Design Specification v1.0*
