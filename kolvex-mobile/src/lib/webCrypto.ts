import * as Crypto from "expo-crypto";
// Hermes has no WebCrypto, and without it the auth client sends plain PKCE challenges.
const scope = globalThis as unknown as { crypto?: Record<string, unknown> };
scope.crypto ??= {};
scope.crypto.getRandomValues ??= Crypto.getRandomValues;
scope.crypto.subtle ??= {
  digest: (_algorithm: string, data: BufferSource) =>
    Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data),
};
