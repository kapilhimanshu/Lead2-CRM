"use client";
import { useEffect, useState } from "react";
import { Mail, Send, Save, FileText, CheckCircle2 } from "lucide-react";
import { api, currentUser } from "../lib/api";
import { Modal, Field, Notice } from "./UI";

interface EmailModalProps {
  lead: {
    id: string;
    name: string;
    company?: string;
    email?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function EmailModal({ lead, onClose, onSuccess }: EmailModalProps) {
  const user = currentUser();
  const [to, setTo] = useState(lead.email || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [senderInfo, setSenderInfo] = useState<{ senderName: string; senderEmail: string } | null>(null);

  useEffect(() => {
    // Load existing draft if available
    api(`/leads/${lead.id}/email-draft`)
      .then((d: any) => {
        if (d?.subject) setSubject(d.subject);
        if (d?.body) setBody(d.body);
      })
      .catch(() => {});

    // Load user email settings
    api("/users/me/email-settings")
      .then((s: any) => {
        setSenderInfo({
          senderName: s.senderName || user?.name || "You",
          senderEmail: s.senderEmail || user?.email || "",
        });
      })
      .catch(() => {
        setSenderInfo({
          senderName: user?.name || "You",
          senderEmail: user?.email || "",
        });
      });
  }, [lead.id, user]);

  const applyTemplate = (key: string) => {
    const sName = senderInfo?.senderName || user?.name || "Sales Team";
    const cName = lead.company || lead.name;

    switch (key) {
      case "intro":
        setSubject(`Introduction: ${cName} & Lead2`);
        setBody(
          `Hi ${lead.name},\n\nI hope this email finds you well.\n\nI noticed your team at ${cName} might be exploring solutions for your current workflows, and I wanted to introduce myself. We help teams streamline customer acquisition and drive measurable revenue growth.\n\nWould you have 10 minutes open later this week for a brief introductory call?\n\nBest regards,\n${sName}`
        );
        break;
      case "proposal":
        setSubject(`Follow-up: Proposal for ${cName}`);
        setBody(
          `Hi ${lead.name},\n\nI wanted to follow up on the proposal we shared for ${cName}.\n\nHave you and the team had a chance to review the details? I'd be happy to answer any questions or make any adjustments to better match your requirements.\n\nLooking forward to hearing your thoughts.\n\nBest regards,\n${sName}`
        );
        break;
      case "meeting":
        setSubject(`Meeting Request: ${cName} Demo`);
        setBody(
          `Hi ${lead.name},\n\nThank you for reaching out! I would love to walk you through a tailored demo of our platform for ${cName}.\n\nDo you have 15-20 minutes available over the next few days? Let me know what times work best for your schedule.\n\nBest regards,\n${sName}`
        );
        break;
      case "checkin":
        setSubject(`Next steps for ${cName}`);
        setBody(
          `Hi ${lead.name},\n\nJust checking in to see how things are progressing on your end with ${cName}.\n\nPlease let me know if there's any additional information, pricing breakdown, or documentation I can provide to support your evaluation.\n\nBest regards,\n${sName}`
        );
        break;
      default:
        break;
    }
  };

  const handleSaveDraft = async () => {
    setDraftBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/leads/${lead.id}/email-draft`, {
        method: "PUT",
        body: JSON.stringify({ subject, body }),
      });
      setNotice("Draft saved successfully");
    } catch (e: any) {
      setError(e.message || "Failed to save draft");
    } finally {
      setDraftBusy(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) {
      setError("Please provide a valid recipient email address.");
      return;
    }
    if (!subject.trim()) {
      setError("Please enter an email subject.");
      return;
    }
    if (!body.trim()) {
      setError("Please enter the email message body.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await api(`/leads/${lead.id}/send-email`, {
        method: "POST",
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body: body.trim() }),
      });

      if (res.simulated) {
        setNotice("Email simulated & logged to lead timeline (local demo mode).");
      } else {
        setNotice("Email sent successfully!");
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
    } catch (e: any) {
      setError(e.message || "Failed to send email");
      setBusy(false);
    }
  };

  return (
    <Modal title="Draft & Send Email" wide onClose={onClose}>
      <Notice message={error} />
      {notice && <Notice message={notice} success />}

      <form className="form" onSubmit={handleSend}>
        <div style={{ background: "var(--card-subtle, #f8fafc)", padding: "10px 14px", borderRadius: 8, fontSize: 13, border: "1px solid var(--border, #e2e8f0)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "var(--muted, #64748b)" }}>From:</span>
            <b>{senderInfo?.senderName} &lt;{senderInfo?.senderEmail || "platform@crm"}&gt;</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--muted, #64748b)" }}>Lead / Account:</span>
            <span>{lead.name} {lead.company ? `(${lead.company})` : ""}</span>
          </div>
        </div>

        <Field label="To (Recipient Email)">
          <input
            required
            type="email"
            className="input"
            placeholder="customer@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>

        <Field label="Quick Template" hint="Select a pre-built outreach template to speed up drafting">
          <select
            className="input"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                applyTemplate(e.target.value);
                e.target.value = "";
              }
            }}
          >
            <option value="">Choose a template to insert...</option>
            <option value="intro">👋 Introduction & Discovery</option>
            <option value="proposal">📋 Proposal Follow-up</option>
            <option value="meeting">📅 Schedule Demo / Call</option>
            <option value="checkin">🤝 Check-in & Next Steps</option>
          </select>
        </Field>

        <Field label="Subject">
          <input
            required
            type="text"
            className="input"
            placeholder="e.g. Follow up regarding your request..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </Field>

        <Field label="Email Body">
          <textarea
            required
            rows={10}
            className="input"
            style={{ fontFamily: "inherit", resize: "vertical" }}
            placeholder="Write your email message here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>

        <div className="row spaced" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn ghost"
            disabled={draftBusy || busy}
            onClick={handleSaveDraft}
          >
            <Save size={13} />
            {draftBusy ? "Saving draft…" : "Save Draft"}
          </button>

          <div className="row">
            <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={busy}>
              <Send size={13} />
              {busy ? "Sending…" : "Send Email"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
