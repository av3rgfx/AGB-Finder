// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { isEditableTarget } from "./is-editable-target";

describe("isEditableTarget", () => {
  it("true per input/textarea/select/contenteditable", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(isEditableTarget(document.createElement(tag))).toBe(true);
    }
    const ce = document.createElement("div");
    ce.setAttribute("contenteditable", "true");
    expect(isEditableTarget(ce)).toBe(true);
  });
  it("false per div/button/null", () => {
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
