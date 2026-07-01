// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const signInEmail = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { email: (...args: unknown[]) => signInEmail(...args) } },
}));

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

    expect(signInEmail).not.toHaveBeenCalled();
    expect(screen.getByText("Inserisci un'email valida.")).toBeTruthy();
  });

  it("calls authClient.signIn.email on a valid submit", async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "mario@rossi.it");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.click(screen.getByRole("button", { name: /^accedi$/i }));

    await waitFor(() =>
      expect(signInEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: "mario@rossi.it", password: "password1" }),
      ),
    );
  });

  it("shows an error banner when credentials are rejected", async () => {
    signInEmail.mockResolvedValue({ data: null, error: { message: "Invalid" } });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "mario@rossi.it");
    await user.type(screen.getByLabelText("Password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: /^accedi$/i }));

    expect(await screen.findByText("Email o password errate.")).toBeTruthy();
  });
});
