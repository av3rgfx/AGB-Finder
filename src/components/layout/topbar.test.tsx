// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TopBar } from "./topbar";

const pathname = vi.fn(() => "/dashboard");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathname(),
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));

const renderBar = () => render(<TopBar name="Marco Bianchi" initials="MB" role="AGENT" />);

beforeEach(() => {
  cleanup();
  pathname.mockReturnValue("/dashboard");
});

/**
 * A 375px la sidebar vive dentro un drawer chiuso e la TopBar non mostra né
 * wordmark né nome della sezione: senza l'etichetta sul pulsante del menu,
 * sapere in che reparto si è costerebbe un tocco. È il punto in cui il distacco
 * fra i due mondi si vede da dentro l'app.
 */
describe("TopBar — il reparto corrente", () => {
  it("scrive SERRAMENTI sul pulsante del menu nelle rotte senza prefisso", () => {
    pathname.mockReturnValue("/archivio");
    renderBar();
    expect(screen.getByText("SERRAMENTI")).toBeTruthy();
  });

  it("scrive MANIGLIE sotto /maniglie", () => {
    pathname.mockReturnValue("/maniglie");
    renderBar();
    expect(screen.getByText("MANIGLIE")).toBeTruthy();
  });

  it("segue il reparto anche in una sotto-rotta", () => {
    pathname.mockReturnValue("/maniglie/abc123");
    renderBar();
    expect(screen.getByText("MANIGLIE")).toBeTruthy();
  });

  it("il reparto è nell'etichetta accessibile, non nel solo colore o posizione", () => {
    // Chi usa uno screen reader deve sentire dove sta andando, non «pulsante».
    pathname.mockReturnValue("/maniglie");
    renderBar();
    expect(screen.getByLabelText(/reparto MANIGLIE/i)).toBeTruthy();
  });

  it("NON esiste più il campo di ricerca finto, né la campanella finta", () => {
    // Erano due controlli decorativi: nessun handler, e nessun sistema di
    // notifiche in tutta l'app. Il campo era il peggiore, perché sulla pagina
    // «Disponibilità» sedeva SOPRA quello vero e a 375px l'agente ne trovava
    // due impilati, con quello d'istinto morto.
    //
    // PRIMA di affermare un'assenza, questo test dimostra di guardare nel posto
    // giusto: se la TopBar non renderizzasse affatto, l'assenza sarebbe vera e
    // il test passerebbe a vuoto.
    renderBar();
    expect(screen.getByLabelText(/apri menu di navigazione/i)).toBeTruthy();
    expect(screen.getByText("Marco Bianchi")).toBeTruthy();

    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByLabelText("Cerca")).toBeNull();
    expect(screen.queryByLabelText("Notifiche")).toBeNull();
  });

  it("il pulsante apre ancora il drawer di navigazione", () => {
    // L'etichetta si è aggiunta a un pulsante che aveva già un compito: se lo
    // rompesse, a 375px l'app resterebbe senza navigazione.
    pathname.mockReturnValue("/maniglie");
    renderBar();
    const btn = screen.getByLabelText(/apri menu di navigazione/i);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(screen.getByRole("dialog", { name: "Navigazione" })).toBeTruthy();
  });
});
