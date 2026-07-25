// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MarkdownMessage, sanitizeHref } from "./markdown-message";

afterEach(cleanup);

describe("MarkdownMessage", () => {
  it("rende una lista puntata", () => {
    render(<MarkdownMessage content={"- primo\n- secondo"} />);
    expect(screen.getByText("primo").tagName).toBe("LI");
    expect(screen.getByText("secondo").tagName).toBe("LI");
  });

  it("rende una tabella GFM", () => {
    const md = "| Codice | Prezzo |\n| --- | --- |\n| A50122 | 12,50 EUR |";
    const { container } = render(<MarkdownMessage content={md} />);
    expect(container.querySelector("table")).not.toBeNull();
    expect(screen.getByText("Prezzo").tagName).toBe("TH");
    expect(screen.getByText("12,50 EUR").tagName).toBe("TD");
  });

  it("rende il grassetto", () => {
    render(<MarkdownMessage content={"testo **importante** qui"} />);
    expect(screen.getByText("importante").tagName).toBe("STRONG");
  });

  it("rende in monospace un codice AGB nel testo prosa", () => {
    render(<MarkdownMessage content={"Ti consiglio la A50122 per l'anta."} />);
    const code = screen.getByText("A50122");
    expect(code.tagName).toBe("CODE");
    expect(code.className).toContain("font-mono");
  });

  it("rende in monospace un codice AGB dentro una cella di tabella", () => {
    const md = "| Codice |\n| --- |\n| A50122 |";
    render(<MarkdownMessage content={md} />);
    const code = screen.getByText("A50122");
    expect(code.tagName).toBe("CODE");
  });

  it("rende un blocco di codice con pulsante di copia funzionante", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const md = "```\nA50122\nB00590.15.03\n```";
    render(<MarkdownMessage content={md} />);
    const button = screen.getByRole("button", { name: "Copia codice" });
    fireEvent.click(button);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("A50122\nB00590.15.03"));
  });

  it("non annida <pre> dentro <pre> per un blocco di codice", () => {
    const md = "```\nconst x = 1;\n```";
    const { container } = render(<MarkdownMessage content={md} />);
    expect(container.querySelectorAll("pre").length).toBe(1);
  });

  it("NON raddoppia il wrapping di un codice AGB dentro un blocco di codice fenced", () => {
    const md = "```\nA50122\n```";
    const { container } = render(<MarkdownMessage content={md} />);
    const codeEls = container.querySelectorAll("code");
    // un solo <code>: quello del blocco — nessun <code> (inline-mono) annidato dentro
    expect(codeEls.length).toBe(1);
    expect(codeEls[0]?.textContent).toBe("A50122");
    expect(codeEls[0]?.querySelector("code")).toBeNull();
  });

  it("non rende HTML grezzo presente nel contenuto (XSS guard)", () => {
    const { container } = render(
      <MarkdownMessage content={'testo <img src=x onerror="window.__pwned = true"> fine'} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it("non lancia eccezioni con markdown incompleto (fence non chiusa, streaming)", () => {
    expect(() =>
      render(<MarkdownMessage content={"testo prima\n```ts\nconst x = 1;"} />),
    ).not.toThrow();
  });

  it("non lancia eccezioni con una tabella a metà (streaming)", () => {
    expect(() => render(<MarkdownMessage content={"| Codice | Pre"} />)).not.toThrow();
  });

  it("non rende cliccabile un link con href javascript: (XSS guard)", () => {
    render(<MarkdownMessage content={"[clicca qui](javascript:alert(1))"} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("clicca qui")).toBeTruthy();
  });

  it("rende cliccabile un link https: normale", () => {
    render(<MarkdownMessage content={"[sito AGB](https://example.com/listino)"} />);
    const link = screen.getByRole("link", { name: "sito AGB" });
    expect(link.getAttribute("href")).toBe("https://example.com/listino");
  });
});

/**
 * Controllo di sicurezza pinnato direttamente sulla funzione: il modello può emettere QUALUNQUE
 * href, e i bypass classici non passano dal rendering markdown (che scarta già newline e simili
 * nelle destinazioni). Qui si fissa il comportamento voluto schema per schema, così non può
 * cambiare in silenzio con un refactor.
 */
describe("sanitizeHref", () => {
  it.each([
    ["https://example.com/x", "https:"],
    ["http://example.com/x", "http:"],
    ["mailto:info@ufptrade.it", "mailto:"],
    ["/archivio?q=A50122", "relativo → eredita https dalla base"],
    ["//evil.com/x", "protocol-relative → risolve in https, ammesso per scelta"],
  ])("ammette %s (%s)", (href) => {
    expect(sanitizeHref(href)).toBe(href);
  });

  it.each([
    ["javascript:alert(1)", "schema pericoloso"],
    ["JavaScript:alert(1)", "maiuscole: lo schema va confrontato normalizzato"],
    ["JAVASCRIPT:alert(1)", "tutto maiuscolo"],
    ["\tjava\nscript:alert(1)", "tab/newline iniettati dentro lo schema"],
    ["\u0000javascript:alert(1)", "carattere di controllo (NUL) iniziale"],
    ["  javascript:alert(1)", "spazi iniziali"],
    ["data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==", "data: URL"],
    ["vbscript:msgbox(1)", "altro schema eseguibile"],
    ["file:///etc/passwd", "schema locale"],
  ])("rifiuta %s (%s)", (href) => {
    expect(sanitizeHref(href)).toBeUndefined();
  });

  it("href assente o vuoto → undefined (nessun <a> senza destinazione)", () => {
    expect(sanitizeHref(undefined)).toBeUndefined();
    expect(sanitizeHref("")).toBeUndefined();
  });
});
