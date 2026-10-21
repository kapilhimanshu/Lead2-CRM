"use client";
import { useEffect, useState } from "react";
import { Mail, CheckCircle2, Server, Key, Send } from "lucide-react";
import { api, currentUser, clearSession } from "../../../lib/api";
import { PageHead, Field, Notice } from "../../../components/UI";

export default function Account() {
  const u = currentUser();
  const [f, setF] = useState({ currentPassword: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Email Settings state
  const [emailSettings, setEmailSettings] = useState({
    senderName: "",
    senderEmail: "",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPass: "",
    hasSmtpPass: false,
  });
  const [emailNotice, setEmailNotice] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [customSmtpOpen, setCustomSmtpOpen] = useState(false);

  useEffect(() => {
    api("/users/me/email-settings")
      .then((s: any) => {
        setEmailSettings({
          senderName: s.senderName || u?.name || "",
          senderEmail: s.senderEmail || u?.email || "",
          smtpHost: s.smtpHost || "",
          smtpPort: s.smtpPort || 587,
          smtpSecure: !!s.smtpSecure,
          smtpUser: s.smtpUser || "",
          smtpPass: "",
          hasSmtpPass: !!s.hasSmtpPass,
        });
        if (s.smtpHost) {
          setCustomSmtpOpen(true);
        }
      })
      .catch(() => {});
  }, [u]);

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailBusy(true);
    setEmailError("");
    setEmailNotice("");
    try {
      const res = await api("/users/me/email-settings", {
        method: "PUT",
        body: JSON.stringify(emailSettings),
      });
      setEmailSettings((prev) => ({
        ...prev,
        hasSmtpPass: !!res.hasSmtpPass,
        smtpPass: "",
      }));
      setEmailNotice("Outbound email settings saved successfully!");
    } catch (err: any) {
      setEmailError(err.message || "Failed to save email settings");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestBusy(true);
    setEmailError("");
    setEmailNotice("");
    try {
      const res = await api("/users/me/email-settings/test", {
        method: "POST",
        body: JSON.stringify({
          smtpHost: emailSettings.smtpHost,
          smtpPort: emailSettings.smtpPort,
          smtpSecure: emailSettings.smtpSecure,
          smtpUser: emailSettings.smtpUser,
          smtpPass: emailSettings.smtpPass,
        }),
      });
      if (res.success) {
        setEmailNotice("SMTP connection successful! Your mailbox is ready to send.");
      } else {
        setEmailError(`Connection test failed: ${res.message || "Unknown error"}`);
      }
    } catch (err: any) {
      setEmailError(`Connection test failed: ${err.message}`);
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="YOUR ACCOUNT"
        title={
          u?.mustChangePassword ? "Set your own password" : "Account & settings"
        }
        description={
          u?.mustChangePassword
            ? "Change your temporary password to activate workspace access."
            : "Manage your credentials and outbound email settings."
        }
      />

      <div className="split" style={{ alignItems: "flex-start", gap: 24 }}>
        {/* Outbound Email Settings Card */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-head">
            <h2>Outbound Email & Direct Messaging</h2>
            <Mail size={16} />
          </div>
          <p className="subtle" style={{ margin: "4px 0 16px 0", fontSize: 13 }}>
            Configure the email address and sender name used when drafting and sending direct emails to leads from the platform.
          </p>

          <Notice message={emailError} />
          {emailNotice && <Notice message={emailNotice} success />}

          <form className="form" onSubmit={handleSaveEmailSettings}>
            <Field label="Sender Display Name" hint="Appears in the customer's inbox as the sender">
              <input
                required
                type="text"
                className="input"
                placeholder="e.g. Sarah Chen"
                value={emailSettings.senderName}
                onChange={(e) =>
                  setEmailSettings({ ...emailSettings, senderName: e.target.value })
                }
              />
            </Field>

            <Field label="Sender & Reply-To Email" hint="Where customer replies will be delivered">
              <input
                required
                type="email"
                className="input"
                placeholder="e.g. sarah@company.com"
                value={emailSettings.senderEmail}
                onChange={(e) =>
                  setEmailSettings({ ...emailSettings, senderEmail: e.target.value })
                }
              />
            </Field>

            <div style={{ margin: "16px 0 8px 0", borderTop: "1px solid var(--border, #e2e8f0)", paddingTop: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={customSmtpOpen}
                  onChange={(e) => setCustomSmtpOpen(e.target.checked)}
                />
                Use Custom Mailbox SMTP (Gmail, Outlook, or Company Server)
              </label>
              <p className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
                Optional: Connect your own mailbox credentials to deliver emails directly through your email account. If unchecked, emails send via the platform default mailer with your email as Reply-To.
              </p>
            </div>

            {customSmtpOpen && (
              <div className="stack" style={{ background: "var(--card-subtle, #f8fafc)", padding: 16, borderRadius: 8, border: "1px solid var(--border, #e2e8f0)", gap: 12 }}>
                <div className="row spaced">
                  <Field label="SMTP Host">
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. smtp.gmail.com"
                      value={emailSettings.smtpHost}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, smtpHost: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="SMTP Port">
                    <input
                      type="number"
                      className="input"
                      style={{ width: 100 }}
                      placeholder="587"
                      value={emailSettings.smtpPort}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, smtpPort: Number(e.target.value) })
                      }
                    />
                  </Field>
                </div>

                <label className="row" style={{ gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={emailSettings.smtpSecure}
                    onChange={(e) =>
                      setEmailSettings({ ...emailSettings, smtpSecure: e.target.checked })
                    }
                  />
                  Use SSL/TLS (typically enabled for port 465)
                </label>

                <Field label="SMTP Username">
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. sarah@company.com"
                    value={emailSettings.smtpUser}
                    onChange={(e) =>
                      setEmailSettings({ ...emailSettings, smtpUser: e.target.value })
                    }
                  />
                </Field>

                <Field
                  label="SMTP Password / App Password"
                  hint={
                    emailSettings.hasSmtpPass
                      ? "A password is already saved securely. Leave blank to keep existing password."
                      : "For Gmail, use a 16-character Google App Password."
                  }
                >
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="input"
                    placeholder={emailSettings.hasSmtpPass ? "••••••••••••••••" : "Enter password"}
                    value={emailSettings.smtpPass}
                    onChange={(e) =>
                      setEmailSettings({ ...emailSettings, smtpPass: e.target.value })
                    }
                  />
                </Field>

                {emailSettings.smtpHost && emailSettings.smtpUser && (
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ alignSelf: "flex-start", marginTop: 4 }}
                    disabled={testBusy || emailBusy}
                    onClick={handleTestSmtp}
                  >
                    <Server size={13} />
                    {testBusy ? "Testing Connection…" : "Test SMTP Connection"}
                  </button>
                )}
              </div>
            )}

            <button className="btn" disabled={emailBusy} style={{ marginTop: 12 }}>
              {emailBusy ? "Saving…" : "Save Email Settings"}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="card" style={{ flex: 1, maxWidth: 500 }}>
          <div className="card-head">
            <h2>Change Password</h2>
            <Key size={16} />
          </div>
          <Notice message={error} />
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (f.password !== f.confirm) {
                setError("The new passwords don’t match");
                return;
              }
              setBusy(true);
              try {
                await api("/auth/change-password", {
                  method: "POST",
                  body: JSON.stringify(f),
                });
                clearSession();
                location.href = "/login";
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Current password">
              <input
                required
                type="password"
                autoComplete="current-password"
                className="input"
                value={f.currentPassword}
                onChange={(e) => setF({ ...f, currentPassword: e.target.value })}
              />
            </Field>
            <Field
              label="New password"
              hint="Use at least 12 characters. You’ll sign in again after saving."
            >
              <input
                required
                minLength={12}
                type="password"
                autoComplete="new-password"
                className="input"
                value={f.password}
                onChange={(e) => setF({ ...f, password: e.target.value })}
              />
            </Field>
            <Field label="Confirm new password">
              <input
                required
                type="password"
                autoComplete="new-password"
                className="input"
                value={f.confirm}
                onChange={(e) => setF({ ...f, confirm: e.target.value })}
              />
            </Field>
            <button className="btn" disabled={busy}>
              {busy ? "Saving…" : "Change password"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
