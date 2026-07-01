// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({ signIn: (...args: unknown[]) => signIn(...args) }));

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

import { LoginForm } from "./login-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe("LoginForm", () => {
  it("blocks submit and shows a validation message for an invalid email", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.click(screen.getByRole("button", { name: /^accedi$/i }));

    expect(signIn).not.toHaveBeenCalled();
    expect(screen.getByText("Inserisci un'email valida.")).toBeTruthy();
  });

  it("calls signIn with credentials (redirect: false) on a valid submit", async () => {
    signIn.mockResolvedValue({ ok: true, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "mario@rossi.it");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.click(screen.getByRole("button", { name: /^accedi$/i }));

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith(
        "credentials",
        expect.objectContaining({ redirect: false, email: "mario@rossi.it", password: "password1" }),
      ),
    );
  });

  it("shows an error banner when credentials are rejected", async () => {
    signIn.mockResolvedValue({ ok: false, error: "CredentialsSignin" });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "mario@rossi.it");
    await user.type(screen.getByLabelText("Password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: /^accedi$/i }));

    expect(await screen.findByText("Email o password errate.")).toBeTruthy();
  });
});
