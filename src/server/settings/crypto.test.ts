import { afterEach, describe, expect, it, vi } from "vitest";

// Master key mutabile: 32 byte in base64 (Buffer.alloc(32, 1)).
const VALID_KEY = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { SETTINGS_ENCRYPTION_KEY: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=" as string | undefined },
}));

vi.mock("@/env", () => ({ env: mockEnv }));

import { decrypt, encrypt, isCryptoConfigured, SettingsCryptoUnavailableError } from "./crypto";

afterEach(() => {
  mockEnv.SETTINGS_ENCRYPTION_KEY = VALID_KEY;
});

describe("settings crypto", () => {
  it("fa il roundtrip encrypt→decrypt", () => {
    const plaintext = "sk-super-secret-1234";
    const payload = encrypt(plaintext);
    expect(payload).not.toContain(plaintext);
    expect(decrypt(payload)).toBe(plaintext);
  });

  it("usa un IV diverso per ogni cifratura (payload diversi)", () => {
    expect(encrypt("stessa-key")).not.toBe(encrypt("stessa-key"));
  });

  it("lancia se il ciphertext è manomesso", () => {
    const payload = encrypt("integcustomer");
    const tampered = Buffer.from(payload, "base64");
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    expect(() => decrypt(tampered.toString("base64"))).toThrow();
  });

  it("segnala cifratura non configurata quando manca la master key", () => {
    mockEnv.SETTINGS_ENCRYPTION_KEY = undefined;
    expect(isCryptoConfigured()).toBe(false);
    expect(() => encrypt("x")).toThrow(SettingsCryptoUnavailableError);
    expect(() => decrypt("x")).toThrow(SettingsCryptoUnavailableError);
  });

  it("segnala non configurata se la master key non è di 32 byte", () => {
    mockEnv.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(isCryptoConfigured()).toBe(false);
  });
});
