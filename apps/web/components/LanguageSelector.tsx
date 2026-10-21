"use client";
import { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check, ShieldCheck } from "lucide-react";
import { useTranslation, LANGUAGES } from "../lib/i18n";

export default function LanguageSelector() {
  const { lang, setLanguage } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="lang-picker-wrapper" ref={ref} style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
      <span
        className="encryption-badge-pill"
        title={`AES-256-GCM Encrypted · Regional Compliance: ${current.compliance}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 9px",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          color: "#166534",
          whiteSpace: "nowrap",
        }}
      >
        <ShieldCheck size={13} color="#16a34a" />
        <span>AES-256 · {current.compliance.split("·")[0].trim()}</span>
      </span>

      <button
        type="button"
        className="lang-picker-btn"
        onClick={() => setOpen(!open)}
        title="Select country, language & regional compliance"
        aria-label="Select language / country"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 12px",
          background: "var(--card, #ffffff)",
          border: "1px solid var(--line, #e2e8f0)",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 500,
          color: "inherit",
          cursor: "pointer",
          whiteSpace: "nowrap",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <span style={{ fontSize: "15px", lineHeight: 1 }}>{current.flag}</span>
        <span style={{ maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis" }}>
          {current.nativeName}
        </span>
        <ChevronDown size={14} style={{ opacity: 0.6 }} />
      </button>

      {open && (
        <div
          className="lang-picker-dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 100,
            width: "285px",
            maxHeight: "420px",
            overflowY: "auto",
            background: "#ffffff",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: "10px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
            padding: "6px",
          }}
        >
          <div
            style={{
              padding: "6px 10px 8px 10px",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#64748b",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Globe size={13} />
              <span>Country, Language & Compliance</span>
            </span>
          </div>

          <div style={{ marginTop: "4px" }}>
            {LANGUAGES.map((item) => {
              const active = item.code === lang;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setLanguage(item.code);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "none",
                    background: active ? "#f0fdf4" : "transparent",
                    color: active ? "#166534" : "#1e293b",
                    fontSize: "13px",
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "16px", minWidth: "28px" }}>{item.flag}</span>
                    <div>
                      <div>
                        {item.nativeName}{" "}
                        <span style={{ fontSize: "11px", color: active ? "#15803d" : "#64748b" }}>
                          ({item.name})
                        </span>
                      </div>
                      <div style={{ fontSize: "10px", color: active ? "#16a34a" : "#94a3b8", marginTop: 1 }}>
                        🛡️ {item.compliance} · {item.currency} {item.rtl ? "· RTL" : ""}
                      </div>
                    </div>
                  </div>
                  {active && <Check size={16} color="#16a34a" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
