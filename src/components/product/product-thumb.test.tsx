// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { ProductThumb } from "./product-thumb";

afterEach(cleanup);

describe("ProductThumb", () => {
  it("mostra un placeholder (box riservato) su errore, non null", () => {
    // alt="" ⇒ img decorativa (role="presentation"): la selezioniamo dal DOM.
    const { container } = render(<ProductThumb code="B00590" variant="row" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img!);
    // il box resta: il placeholder è un elemento, non null; l'img è sparita
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstChild).not.toBeNull();
  });
});
