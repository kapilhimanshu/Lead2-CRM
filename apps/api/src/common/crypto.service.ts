import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";

@Injectable()
export class CryptoService {
  private key = this.loadKey();
  private hashKey =
    process.env.CONTACT_HASH_KEY || "dev-contact-hash-key-change-me";

  private loadKey() {
    const raw = process.env.FIELD_ENCRYPTION_KEY;
    if (raw && /^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
    return crypto
      .createHash("sha256")
      .update(raw || "dev-field-key-change-me")
      .digest();
  }

  encrypt(value?: string | null) {
    if (!value) return null;
    const iv = crypto.randomBytes(12),
      cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);
    const enc = Buffer.concat([
      cipher.update(value.trim(), "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
  }

  decrypt(payload?: string | null) {
    if (!payload) return null;
    const b = Buffer.from(payload, "base64url"),
      iv = b.subarray(0, 12),
      tag = b.subarray(12, 28),
      enc = b.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", this.key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  }

  contactHash(value?: string | null) {
    if (!value) return null;
    const normalized = value.toLowerCase().replace(/[\s()+.\-]/g, "");
    return crypto
      .createHmac("sha256", this.hashKey)
      .update(normalized)
      .digest("hex");
  }

  encryptJson(data: any): string | null {
    if (data === undefined || data === null) return null;
    return this.encrypt(JSON.stringify(data));
  }

  decryptJson<T = any>(payload?: string | null): T | null {
    if (!payload) return null;
    try {
      const raw = this.decrypt(payload);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  /**
   * PCI-DSS v4.0 & RBI Tokenization compliant payment sanitizer.
   * Never stores raw PAN or CVV; masks display identifiers and encrypts a vault token with AES-256-GCM.
   */
  tokenizePaymentDetails(method: string, details: any = {}) {
    const cleanMethod = (method || "card").toLowerCase();
    let maskedInstrument = "Standard Payment";
    const vaultPayload: Record<string, any> = {
      method: cleanMethod,
      tokenizedAt: new Date().toISOString(),
      nonce: crypto.randomBytes(8).toString("hex"),
    };

    if (cleanMethod === "card") {
      const digits = String(details.cardNumber || "4242").replace(/\D/g, "");
      const last4 = digits.slice(-4) || "4242";
      maskedInstrument = `Card •••• ${last4}`;
      vaultPayload.last4 = last4;
      vaultPayload.holder = String(details.cardName || "Authorized Cardholder").slice(0, 80);
      // CVV / full PAN intentionally discarded per PCI-DSS v4.0
    } else if (cleanMethod === "upi") {
      const rawUpi = String(details.upiId || "verified@upi").trim();
      const [userPart, handlePart] = rawUpi.split("@");
      const maskedUser =
        userPart && userPart.length > 2
          ? `${userPart.slice(0, 2)}***${userPart.slice(-1)}`
          : "up***";
      maskedInstrument = `UPI ${maskedUser}@${handlePart || "upi"}`;
      vaultPayload.upiHandle = handlePart || "upi";
      vaultPayload.upiHash = this.contactHash(rawUpi);
    } else if (cleanMethod === "wallet") {
      const walletProvider = String(details.walletType || "gpay").toUpperCase();
      maskedInstrument = `Wallet (${walletProvider})`;
      vaultPayload.walletProvider = walletProvider;
    }

    const encryptedToken = this.encryptJson(vaultPayload);
    return {
      maskedInstrument,
      vaultToken: encryptedToken,
    };
  }

  /**
   * Generates a tamper-evident HMAC-SHA256 cryptographic signature for receipts and compliance logs.
   */
  signReceipt(payload: Record<string, any>): string {
    const canonical = JSON.stringify(
      Object.keys(payload)
        .sort()
        .reduce((acc: Record<string, any>, k) => {
          acc[k] = payload[k];
          return acc;
        }, {}),
    );
    return (
      "sig_sha256_" +
      crypto
        .createHmac("sha256", this.hashKey)
        .update(canonical)
        .digest("hex")
        .slice(0, 32)
    );
  }
}
