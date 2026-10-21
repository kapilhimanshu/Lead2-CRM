"use client";
import { useState, useEffect } from "react";
import {
  CreditCard,
  QrCode,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Info,
} from "lucide-react";
import { api } from "../lib/api";
import { Modal, Field, Notice, Badge } from "./UI";

interface PricingPlan {
  annualMonthlyRate: number;
  annualBilledYearly: number;
  monthlyRate: number;
  symbol: string;
  currency: string;
}

const DEFAULT_PRICING: Record<string, PricingPlan> = {
  USD: { annualMonthlyRate: 1.99, annualBilledYearly: 23.88, monthlyRate: 2.99, symbol: "$", currency: "USD" },
  INR: { annualMonthlyRate: 149, annualBilledYearly: 1788, monthlyRate: 249, symbol: "₹", currency: "INR" },
  EUR: { annualMonthlyRate: 1.99, annualBilledYearly: 23.88, monthlyRate: 2.99, symbol: "€", currency: "EUR" },
  GBP: { annualMonthlyRate: 1.79, annualBilledYearly: 21.48, monthlyRate: 2.49, symbol: "£", currency: "GBP" },
  JPY: { annualMonthlyRate: 299, annualBilledYearly: 3588, monthlyRate: 399, symbol: "¥", currency: "JPY" },
  AED: { annualMonthlyRate: 7.99, annualBilledYearly: 95.88, monthlyRate: 11.99, symbol: "AED ", currency: "AED" },
  SGD: { annualMonthlyRate: 2.79, annualBilledYearly: 33.48, monthlyRate: 3.99, symbol: "S$", currency: "SGD" },
  IDR: { annualMonthlyRate: 29900, annualBilledYearly: 358800, monthlyRate: 44900, symbol: "Rp", currency: "IDR" },
  MYR: { annualMonthlyRate: 8.99, annualBilledYearly: 107.88, monthlyRate: 12.99, symbol: "RM", currency: "MYR" },
  CNY: { annualMonthlyRate: 14.99, annualBilledYearly: 179.88, monthlyRate: 21.99, symbol: "¥", currency: "CNY" },
  ILS: { annualMonthlyRate: 7.49, annualBilledYearly: 89.88, monthlyRate: 10.99, symbol: "₪", currency: "ILS" },
};

export default function SeatBillingModal({
  currentSeats,
  activeUsers,
  currentCurrency = "INR",
  onClose,
  onSuccess,
}: {
  currentSeats: number;
  activeUsers: number;
  currentCurrency?: string;
  onClose: () => void;
  onSuccess: (data: any) => void;
}) {
  const [seats, setSeats] = useState(Math.max(currentSeats || 5, activeUsers || 1));
  const [billingCycle, setBillingCycle] = useState<"annual" | "monthly">("annual");
  const [currency, setCurrency] = useState(currentCurrency.toUpperCase() in DEFAULT_PRICING ? currentCurrency.toUpperCase() : "INR");
  const [payMethod, setPayMethod] = useState<"card" | "upi" | "wallet">("card");
  
  // Card form state
  const [cardNumber, setCardNumber] = useState("4532 •••• •••• 8821");
  const [cardExp, setCardExp] = useState("12/28");
  const [cardCvc, setCardCvc] = useState("782");
  const [cardName, setCardName] = useState("Lead2 Customer Admin");

  // UPI state
  const [upiId, setUpiId] = useState("admin@okhdfcbank");

  // Wallet state
  const [walletType, setWalletType] = useState("gpay");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const plan = DEFAULT_PRICING[currency] || DEFAULT_PRICING["USD"];
  const isUpscale = seats > currentSeats;
  const isDownscale = seats < currentSeats;

  // Price calculations
  const unitRate = billingCycle === "annual" ? plan.annualMonthlyRate : plan.monthlyRate;
  const billedAmount = billingCycle === "annual" 
    ? Math.round(plan.annualBilledYearly * seats * 100) / 100
    : Math.round(plan.monthlyRate * seats * 100) / 100;
  
  const annualSavings = Math.round((plan.monthlyRate * 12 - plan.annualBilledYearly) * seats * 100) / 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (seats < activeUsers) {
      setError(`Cannot scale seats below active team count (${activeUsers} reps). Please remove reps first if downscaling.`);
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await api("/billing/checkout", {
        method: "POST",
        headers: { "X-Lead2-CSRF": "1" },
        body: JSON.stringify({
          targetSeats: seats,
          billingCycle,
          currency,
          paymentMethod: payMethod,
          paymentDetails: {
            cardNumber: payMethod === "card" ? cardNumber : undefined,
            cardName: payMethod === "card" ? cardName : undefined,
            upiId: payMethod === "upi" ? upiId : undefined,
            walletType: payMethod === "wallet" ? walletType : undefined,
          },
        }),
      });

      onSuccess(res);
    } catch (err: any) {
      setError(err.message || "Checkout failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Manage Sales Rep Seats & Subscription" onClose={onClose}>
      <form onSubmit={handleSubmit} className="form" style={{ maxWidth: "560px" }}>
        {error && <Notice message={error} onClose={() => setError("")} />}

        {/* Currency & Plan Banner */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "#64748b" }}>Billing Currency</span>
          <select
            className="input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={{ width: "auto", minHeight: 32, padding: "4px 10px", fontSize: 13 }}
          >
            <option value="INR">INR (₹) · India Special Roundoff</option>
            <option value="USD">USD ($) · Global ($1.99/mo)</option>
            <option value="EUR">EUR (€) · Europe (€1.99/mo)</option>
            <option value="GBP">GBP (£) · United Kingdom</option>
            <option value="IDR">IDR (Rp) · Indonesia</option>
            <option value="MYR">MYR (RM) · Malaysia</option>
            <option value="JPY">JPY (¥) · Japan</option>
            <option value="CNY">CNY (¥) · China</option>
            <option value="ILS">ILS (₪) · Israel</option>
            <option value="AED">AED · UAE / Middle East</option>
            <option value="SGD">SGD (S$) · Singapore</option>
          </select>
        </div>

        {/* Step 1: Seat count picker */}
        <div className="card" style={{ padding: 16, background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <b style={{ fontSize: 14 }}>Licensed Sales Rep Seats</b>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Current: <b>{currentSeats}</b> seats ({activeUsers} in active use)
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="btn small ghost"
                disabled={seats <= activeUsers}
                onClick={() => setSeats(Math.max(activeUsers, seats - 1))}
              >
                -1
              </button>
              <input
                type="number"
                min={activeUsers}
                max={250}
                value={seats}
                onChange={(e) => setSeats(Math.max(activeUsers, parseInt(e.target.value) || activeUsers))}
                style={{
                  width: 60,
                  textAlign: "center",
                  padding: "4px 8px",
                  fontWeight: 700,
                  fontSize: 16,
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                }}
              />
              <button
                type="button"
                className="btn small ghost"
                onClick={() => setSeats(seats + 1)}
              >
                +1
              </button>
              <button
                type="button"
                className="btn small ghost"
                onClick={() => setSeats(seats + 5)}
              >
                +5
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
            <input
              type="range"
              min={activeUsers}
              max={Math.max(25, seats + 10)}
              value={seats}
              onChange={(e) => setSeats(parseInt(e.target.value))}
              style={{ flex: 1 }}
            />
            {isUpscale && (
              <Badge tone="green">+{seats - currentSeats} New Seats (Upscale)</Badge>
            )}
            {isDownscale && (
              <Badge tone="amber">-{currentSeats - seats} Seats (Downscale)</Badge>
            )}
            {!isUpscale && !isDownscale && (
              <Badge tone="neutral">No seat change</Badge>
            )}
          </div>
        </div>

        {/* Step 2: Billing Cycle Selection */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {/* Annual Plan Card */}
          <div
            onClick={() => setBillingCycle("annual")}
            style={{
              border: billingCycle === "annual" ? "2px solid #16a34a" : "1px solid #e2e8f0",
              background: billingCycle === "annual" ? "#f0fdf4" : "#ffffff",
              padding: 14,
              borderRadius: 10,
              cursor: "pointer",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>Annual Billing</span>
              <span style={{ fontSize: 10, fontWeight: 800, background: "#dcfce7", color: "#15803d", padding: "2px 6px", borderRadius: 4 }}>
                SAVE 33%
              </span>
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: "#166534" }}>
                {plan.symbol}{plan.annualMonthlyRate}
              </span>
              <span style={{ fontSize: 12, color: "#475569" }}> / rep / mo</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              Billed {plan.symbol}{plan.annualBilledYearly}/rep for 1 year advance
            </div>
          </div>

          {/* Monthly Plan Card */}
          <div
            onClick={() => setBillingCycle("monthly")}
            style={{
              border: billingCycle === "monthly" ? "2px solid #2563eb" : "1px solid #e2e8f0",
              background: billingCycle === "monthly" ? "#eff6ff" : "#ffffff",
              padding: 14,
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>Monthly Billing</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>Standard</span>
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: "#1e40af" }}>
                {plan.symbol}{plan.monthlyRate}
              </span>
              <span style={{ fontSize: 12, color: "#475569" }}> / rep / mo</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              Billed month-to-month, cancel anytime
            </div>
          </div>
        </div>

        {/* Step 3: Payment Gateway selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 8 }}>
            Select Payment Method
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setPayMethod("card")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 8px",
                borderRadius: 8,
                border: payMethod === "card" ? "2px solid #0f172a" : "1px solid #cbd5e1",
                background: payMethod === "card" ? "#f8fafc" : "#ffffff",
                fontWeight: payMethod === "card" ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <CreditCard size={15} />
              Credit / Debit Card
            </button>
            <button
              type="button"
              onClick={() => setPayMethod("upi")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 8px",
                borderRadius: 8,
                border: payMethod === "upi" ? "2px solid #0f172a" : "1px solid #cbd5e1",
                background: payMethod === "upi" ? "#f8fafc" : "#ffffff",
                fontWeight: payMethod === "upi" ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <QrCode size={15} />
              UPI / Instant QR
            </button>
            <button
              type="button"
              onClick={() => setPayMethod("wallet")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 8px",
                borderRadius: 8,
                border: payMethod === "wallet" ? "2px solid #0f172a" : "1px solid #cbd5e1",
                background: payMethod === "wallet" ? "#f8fafc" : "#ffffff",
                fontWeight: payMethod === "wallet" ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <Wallet size={15} />
              Digital Wallet
            </button>
          </div>

          {/* Payment Method Details */}
          {payMethod === "card" && (
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>CARD NUMBER</span>
                <input
                  className="input"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4532 •••• •••• 8821"
                  required
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 8 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>EXPIRY</span>
                  <input
                    className="input"
                    value={cardExp}
                    onChange={(e) => setCardExp(e.target.value)}
                    placeholder="MM/YY"
                    required
                  />
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>CVC</span>
                  <input
                    className="input"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="123"
                    required
                  />
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>CARDHOLDER NAME</span>
                  <input
                    className="input"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {payMethod === "upi" && (
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ padding: 10, background: "#ffffff", borderRadius: 8, border: "1px solid #cbd5e1", textAlign: "center" }}>
                  <QrCode size={72} color="#0f172a" />
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>Scan & Pay</div>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>UPI VPA ID</span>
                  <input
                    className="input"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="company@okhdfcbank"
                    required
                  />
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                    Supports Google Pay, PhonePe, Paytm, BHIM and all major Indian bank apps.
                  </div>
                </div>
              </div>
            </div>
          )}

          {payMethod === "wallet" && (
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { id: "gpay", name: "Google Pay" },
                  { id: "applepay", name: "Apple Pay" },
                  { id: "paytm", name: "Paytm Wallet" },
                  { id: "phonepe", name: "PhonePe" },
                ].map((w) => (
                  <label
                    key={w.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px",
                      background: walletType === w.id ? "#eff6ff" : "#ffffff",
                      border: walletType === w.id ? "1px solid #3b82f6" : "1px solid #cbd5e1",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: walletType === w.id ? 600 : 400,
                    }}
                  >
                    <input
                      type="radio"
                      name="wallet"
                      checked={walletType === w.id}
                      onChange={() => setWalletType(w.id)}
                    />
                    {w.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div style={{ background: "#f1f5f9", padding: "12px 16px", borderRadius: 8, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 4 }}>
            <span>Target Seats</span>
            <b>{seats} sales rep{seats > 1 ? "s" : ""}</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 4 }}>
            <span>Effective Rate</span>
            <span>{plan.symbol}{unitRate} / rep / mo</span>
          </div>
          {billingCycle === "annual" && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#166534", marginBottom: 4 }}>
              <span>Annual Advance Savings</span>
              <b>- {plan.symbol}{annualSavings} / year</b>
            </div>
          )}
          <div style={{ borderTop: "1px solid #cbd5e1", paddingTop: 8, marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Total Due Today</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
              {plan.symbol}{billedAmount.toLocaleString()}
            </span>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "8px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={15} color="#16a34a" />
          <span>
            <b>PCI-DSS v4.0 & AES-256-GCM Encrypted:</b> Payment details are tokenized in-flight. Raw card numbers & CVVs are never stored.
          </span>
        </div>

        {/* Submit Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={loading}>
            <ShieldCheck size={16} />
            {loading ? "Processing Payment…" : `Confirm & Pay ${plan.symbol}${billedAmount.toLocaleString()}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
