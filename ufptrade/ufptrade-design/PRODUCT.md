# Utensilferramenta WebApp — Product Context

## Company
- **Name:** Utensilferramenta Pistoiese S.p.A.
- **Location:** Via Luigi Salvatorelli 161, 51100 Pistoia (PT), Italy
- **Sector:** B2B wholesale of hardware, ironmongery, window/door fittings
- **Employees:** 29
- **Revenue:** ~EUR 9.5M annually
- **Founded:** 1972
- **Primary market:** Craftsmen and companies in the window/door frame sector
- **Main supplier:** AGB Alban Giacomo S.p.A. (ferramenta per porte e finestre)

## Users

### Primary: Sales Agents (10 users max)
- Veteran B2B salespeople with deep product knowledge
- Need fast access to 20,000+ AGB product codes
- Currently spend up to 1 hour searching for a single code in PDF catalogs
- Generate hardware kits for windows/doors from customer specifications
- Receive customer requests via email, need to translate to product codes
- Work primarily desktop, occasionally tablet on the road

### Secondary: Administrator (1-2 users)
- Creates agent accounts
- Manages AI assistant settings (API keys, model selection)
- Views analytics on agent usage
- Manages product catalog updates

### Tertiary: Public Website Visitors (B2B customers)
- Browse products (future e-commerce)
- Request kit quotes via form
- Register for e-commerce access

### Hidden: The AI Assistant
- Trained on AGB 2026 catalog (20,000+ items)
- Acts as technical-commercial assistant
- Must handle: product search, code lookup, email parsing, kit generation
- Must support 10 concurrent conversations without latency

## Product Purpose
Replace manual PDF catalog browsing and email-based kit requests with an intelligent, AI-powered sales tool that reduces code lookup time from hours to seconds and eliminates errors in kit generation.

## Anti-References
- No generic SaaS dashboard look (no "hero metric" templates, no identical card grids)
- No dark mode by default (this is a B2B work tool used in offices, not a dev tool)
- No blue-purple gradients
- No overly minimal/monochrome design (industrial sector needs visual clarity)
- No complex multi-step modals

## Register: PRODUCT
This is a product/tool application (design SERVES the product), not a brand/marketing site.

## Key Principles
- Speed over beauty: agents need answers in seconds, not delight
- Information density: show many products, codes, specs at once
- Progressive disclosure: simple search first, advanced kit builder second
- Trust through accuracy: every code must be verifiable
- Italian language throughout
