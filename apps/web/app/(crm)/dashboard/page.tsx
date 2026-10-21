"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Plus,
  UsersRound,
  TrendingUp,
  Clock3,
  CalendarDays,
  ChevronRight,
  FileText,
  FileSpreadsheet,
  Presentation,
  Mail,
  Printer,
  Award,
  Percent,
  Zap,
  DollarSign,
  Target,
} from "lucide-react";
import { api, currentUser, shortMoney, money, date } from "../../../lib/api";
import {
  PageHead,
  Notice,
  Loading,
  Empty,
  Avatar,
  Badge,
  useResource,
} from "../../../components/UI";
import { useTranslation } from "../../../lib/i18n";

export default function Dashboard() {
  const { t } = useTranslation();
  const [emailing, setEmailing] = useState(false);
  const [notice, setNotice] = useState("");
  const [reportError, setReportError] = useState("");

  const { data, error, reload } = useResource(() =>
    Promise.all([
      api("/dashboard"),
      api("/tasks?status=open"),
      api("/proposals"),
    ]),
  );

  if (error) return <Notice message={error} />;
  if (!data) return <Loading />;

  const [d, tasks, proposals] = data,
    u = currentUser(),
    k = d.kpis,
    top6 = d.top6Parameters || {
      conversionRate: { label: "Lead Conversion Rate", value: `${Math.round(((k.won_this_month || 0) / Math.max(1, k.open_leads || 1)) * 100)}%`, description: "Ratio of won leads to total volume" },
      pipelineValue: { label: "Total Pipeline Value", value: k.total_value || 0, description: `${k.open_leads || 0} active open opportunities` },
      averageDealSize: { label: "Average Deal Size", value: k.open_leads > 0 ? Math.round((k.total_value || 0) / k.open_leads) : 0, description: "Average volume per deal" },
      salesVelocity: { label: "Sales Velocity (Cycle)", value: `${k.avg_open_age_days || 0} days`, description: "Average cycle length" },
      teamPerformance: { label: "Top Rep Performance", value: d.owners?.[0]?.owner || "N/A", description: "Top performing team member" },
      sourceAttribution: { label: "Top Acquisition Channel", value: d.sources?.[0]?.source || "N/A", description: "Best lead conversion channel" },
    },
    stages = d.stages.filter(
      (s: any) => s.probability > 0 && s.probability < 100,
    ),
    max = Math.max(1, ...stages.map((s: any) => Number(s.value))),
    pending = proposals.filter((x: any) => x.status === "approval_required");

  // Export functions
  function exportPdf() {
    window.print();
  }

  function exportExcel() {
    const currency = d.currency || "INR";
    const rows: (string | number)[][] = [
      ["LEAD2 CRM — EXECUTIVE ANALYTICS REPORT"],
      ["Generated At", new Date().toLocaleString()],
      ["Workspace Scope", d.scope || "All Workspace"],
      [],
      ["TOP 6 EXECUTIVE KPI PARAMETERS", "VALUE", "DETAILS / BENCHMARK"],
      ["1. Lead Conversion Rate", top6.conversionRate.value, top6.conversionRate.description],
      ["2. Total Pipeline Value", `${currency} ${Number(top6.pipelineValue.value).toLocaleString()}`, top6.pipelineValue.description],
      ["3. Average Deal Size", `${currency} ${Number(top6.averageDealSize.value).toLocaleString()}`, top6.averageDealSize.description],
      ["4. Sales Velocity (Cycle Length)", top6.salesVelocity.value, top6.salesVelocity.description],
      ["5. Top Sales Performer", top6.teamPerformance.value, top6.teamPerformance.description],
      ["6. Top Acquisition Channel", top6.sourceAttribution.value, top6.sourceAttribution.description],
      [],
      ["PIPELINE STAGE FUNNEL", "LEADS COUNT", `STAGE VALUE (${currency})`, "PROBABILITY"],
      ...d.stages.map((s: any) => [s.name, s.count, s.value, `${s.probability}%`]),
      [],
      ["SALES TEAM LEADERBOARD", "TOTAL ASSIGNED LEADS", "WON DEALS", `PIPELINE VALUE (${currency})`],
      ...d.owners.map((o: any) => [o.owner, o.count, o.won, o.open_value]),
      [],
      ["LEAD SOURCES / CHANNELS", "LEADS COUNT", "WON DEALS", `GENERATED VALUE (${currency})`],
      ...d.sources.map((src: any) => [src.source, src.count, src.won, src.value]),
    ];

    const csvContent = rows
      .map((e) =>
        e
          .map((cell) => {
            const str = String(cell ?? "");
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Lead2-Analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Excel (CSV) analytics report downloaded successfully!");
  }

  function exportPpt() {
    const currency = d.currency || "INR";
    const pptHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Lead2 CRM Executive Analytics Presentation</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .slide { background: #1e293b; border-radius: 16px; padding: 48px; margin-bottom: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); page-break-after: always; }
    .slide-header { border-bottom: 2px solid #334155; padding-bottom: 20px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: baseline; }
    h1 { font-size: 34px; margin: 0 0 8px 0; color: #38bdf8; font-weight: 700; }
    h2 { font-size: 26px; margin: 0 0 6px 0; color: #f1f5f9; }
    p.subtitle { font-size: 15px; color: #94a3b8; margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 24px; }
    .card { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 24px; }
    .card-title { font-size: 12px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.06em; margin-bottom: 10px; font-weight: 600; }
    .card-val { font-size: 32px; font-weight: 700; color: #38bdf8; margin-bottom: 8px; }
    .card-desc { font-size: 13px; color: #64748b; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 14px; }
    th { text-align: left; padding: 12px 16px; background: #0f172a; color: #94a3b8; border-bottom: 2px solid #334155; text-transform: uppercase; font-size: 12px; }
    td { padding: 14px 16px; border-bottom: 1px solid #334155; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; background: #0284c7; color: white; font-weight: 600; }
  </style>
</head>
<body>
  <!-- Slide 1: Top 6 Executive Parameters -->
  <div class="slide">
    <div class="slide-header">
      <div>
        <h1>Lead2 CRM · Executive Performance Deck</h1>
        <p class="subtitle">Top 6 Business Metrics · ${d.scope} · Generated on ${new Date().toLocaleDateString()}</p>
      </div>
    </div>
    <div class="grid">
      <div class="card">
        <div class="card-title">1. Conversion Rate</div>
        <div class="card-val">${top6.conversionRate.value}</div>
        <div class="card-desc">${top6.conversionRate.description}</div>
      </div>
      <div class="card">
        <div class="card-title">2. Total Pipeline Value</div>
        <div class="card-val">${currency} ${Number(top6.pipelineValue.value).toLocaleString()}</div>
        <div class="card-desc">${top6.pipelineValue.description}</div>
      </div>
      <div class="card">
        <div class="card-title">3. Average Deal Size</div>
        <div class="card-val">${currency} ${Number(top6.averageDealSize.value).toLocaleString()}</div>
        <div class="card-desc">${top6.averageDealSize.description}</div>
      </div>
      <div class="card">
        <div class="card-title">4. Sales Velocity</div>
        <div class="card-val">${top6.salesVelocity.value}</div>
        <div class="card-desc">${top6.salesVelocity.description}</div>
      </div>
      <div class="card">
        <div class="card-title">5. Top Sales Performer</div>
        <div class="card-val" style="font-size:24px;">${top6.teamPerformance.value}</div>
        <div class="card-desc">${top6.teamPerformance.description}</div>
      </div>
      <div class="card">
        <div class="card-title">6. Top Acquisition Channel</div>
        <div class="card-val" style="font-size:24px;">${top6.sourceAttribution.value}</div>
        <div class="card-desc">${top6.sourceAttribution.description}</div>
      </div>
    </div>
  </div>

  <!-- Slide 2: Funnel & Sales Team -->
  <div class="slide">
    <div class="slide-header">
      <div>
        <h2>Sales Funnel & Team Leaderboard</h2>
        <p class="subtitle">Detailed performance progression across stages and sales representatives</p>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Sales Representative</th>
          <th>Total Assigned Leads</th>
          <th>Won Deals</th>
          <th>Open Pipeline Value</th>
        </tr>
      </thead>
      <tbody>
        ${d.owners.map((o: any) => `
          <tr>
            <td><strong>${o.owner}</strong></td>
            <td>${o.count}</td>
            <td><span class="badge">${o.won} Won</span></td>
            <td>${currency} ${Number(o.open_value).toLocaleString()}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
</body>
</html>`;

    const blob = new Blob([pptHtml], { type: "application/vnd.ms-powerpoint;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Lead2-Executive-Presentation-${new Date().toISOString().split("T")[0]}.ppt`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("PPT presentation deck downloaded successfully!");
  }

  async function handleEmailReport() {
    setEmailing(true);
    setNotice("");
    setReportError("");
    try {
      const res = await api("/dashboard/email-report", {
        method: "POST",
        headers: { "X-Lead2-CSRF": "1" },
      });
      setNotice(res.message || "Executive analytics report sent to your email!");
    } catch (err: any) {
      setReportError(err.message || "Failed to dispatch email report");
    } finally {
      setEmailing(false);
    }
  }

  return (
    <>
      <PageHead
        eyebrow="EXECUTIVE ANALYTICS & INTELLIGENCE"
        title={`Welcome back, ${u?.name?.split(" ")[0] || "there"}.`}
        description="A real-time overview of your top 6 sales parameters, pipeline health, and team velocity."
        actions={
          <div className="analytics-export-actions" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn ghost print-hide"
              onClick={exportPdf}
              title="Print or save as PDF"
            >
              <Printer size={14} />
              <span>{t("export_pdf", "Export PDF")}</span>
            </button>
            <button
              type="button"
              className="btn ghost print-hide"
              onClick={exportExcel}
              title="Download structured Excel / CSV data"
            >
              <FileSpreadsheet size={14} />
              <span>{t("export_excel", "Export Excel")}</span>
            </button>
            <button
              type="button"
              className="btn ghost print-hide"
              onClick={exportPpt}
              title="Download presentation deck for slides"
            >
              <Presentation size={14} />
              <span>{t("export_ppt", "Export PPT")}</span>
            </button>
            <button
              type="button"
              className="btn ghost print-hide"
              onClick={handleEmailReport}
              disabled={emailing}
              title="Send full analytics summary to your email"
            >
              <Mail size={14} />
              <span>{emailing ? "Sending…" : t("email_report", "Email Report")}</span>
            </button>
            <Link href="/leads?new=1" className="btn print-hide">
              <Plus size={14} />
              New lead
            </Link>
          </div>
        }
      />

      <Notice message={notice} success onClose={() => setNotice("")} />
      <Notice message={reportError} onClose={() => setReportError("")} />

      {/* TOP 6 PERFORMANCE PARAMETERS SECTION */}
      <section className="top-parameters-section" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--fg, #0f172a)" }}>
              Top 6 Performance Parameters
            </h2>
            <p style={{ fontSize: 13, color: "var(--muted, #64748b)", margin: "2px 0 0 0" }}>
              Core KPIs driving pipeline conversion, sales velocity, and revenue attribution
            </p>
          </div>
          <span className="badge-scope" style={{ fontSize: 11, fontWeight: 600, background: "#f1f5f9", padding: "4px 10px", borderRadius: 20, color: "#475569" }}>
            {d.scope}
          </span>
        </div>

        <div className="grid top-6-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
          {/* KPI 1: Conversion Rate */}
          <div className="card kpi-card-rich" style={{ padding: "18px 20px", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b" }}>
                {t("conversion_rate", "Conversion Rate")}
              </span>
              <span style={{ background: "#ecfdf5", color: "#059669", padding: "4px 8px", borderRadius: 6, fontSize: 12 }}>
                <Percent size={14} />
              </span>
            </div>
            <strong style={{ fontSize: 26, fontWeight: 700, color: "#059669", display: "block" }}>
              {top6.conversionRate.value}
            </strong>
            <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 0 0" }}>
              {top6.conversionRate.description}
            </p>
          </div>

          {/* KPI 2: Pipeline Value */}
          <div className="card kpi-card-rich" style={{ padding: "18px 20px", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b" }}>
                {t("pipeline_value", "Pipeline Value")}
              </span>
              <span style={{ background: "#eff6ff", color: "#2563eb", padding: "4px 8px", borderRadius: 6, fontSize: 12 }}>
                <DollarSign size={14} />
              </span>
            </div>
            <strong style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", display: "block" }}>
              {shortMoney(top6.pipelineValue.value, d.currency)}
            </strong>
            <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 0 0" }}>
              {top6.pipelineValue.description}
            </p>
          </div>

          {/* KPI 3: Average Deal Size */}
          <div className="card kpi-card-rich" style={{ padding: "18px 20px", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b" }}>
                {t("deal_size", "Average Deal Size")}
              </span>
              <span style={{ background: "#f5f3ff", color: "#7c3aed", padding: "4px 8px", borderRadius: 6, fontSize: 12 }}>
                <Target size={14} />
              </span>
            </div>
            <strong style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", display: "block" }}>
              {shortMoney(top6.averageDealSize.value, d.currency)}
            </strong>
            <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 0 0" }}>
              {top6.averageDealSize.description}
            </p>
          </div>

          {/* KPI 4: Sales Velocity */}
          <div className="card kpi-card-rich" style={{ padding: "18px 20px", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b" }}>
                {t("sales_velocity", "Sales Velocity")}
              </span>
              <span style={{ background: "#fffbeb", color: "#d97706", padding: "4px 8px", borderRadius: 6, fontSize: 12 }}>
                <Zap size={14} />
              </span>
            </div>
            <strong style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", display: "block" }}>
              {top6.salesVelocity.value}
            </strong>
            <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 0 0" }}>
              {top6.salesVelocity.description}
            </p>
          </div>

          {/* KPI 5: Top Sales Rep */}
          <div className="card kpi-card-rich" style={{ padding: "18px 20px", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b" }}>
                {t("top_rep", "Top Rep")}
              </span>
              <span style={{ background: "#fef2f2", color: "#dc2626", padding: "4px 8px", borderRadius: 6, fontSize: 12 }}>
                <Award size={14} />
              </span>
            </div>
            <strong style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {top6.teamPerformance.value}
            </strong>
            <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 0 0" }}>
              {top6.teamPerformance.description}
            </p>
          </div>

          {/* KPI 6: Acquisition Channel */}
          <div className="card kpi-card-rich" style={{ padding: "18px 20px", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b" }}>
                {t("acquisition_channel", "Top Channel")}
              </span>
              <span style={{ background: "#f0fdfa", color: "#0d9488", padding: "4px 8px", borderRadius: 6, fontSize: 12 }}>
                <TrendingUp size={14} />
              </span>
            </div>
            <strong style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {top6.sourceAttribution.value}
            </strong>
            <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 0 0" }}>
              {top6.sourceAttribution.description}
            </p>
          </div>
        </div>
      </section>

      {/* DASHBOARD CHARTS & TASKS */}
      <div className="dashboard-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Pipeline at a glance</h2>
              <p>Open opportunity value by stage</p>
            </div>
            <Link href="/pipeline" className="text-link print-hide">
              View pipeline <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="bar-chart">
            {stages.map((s: any) => (
              <div className="chart-column" key={s.id}>
                <b>{shortMoney(s.value, d.currency)}</b>
                <div
                  className="chart-bar"
                  title={`${s.name}: ${s.count} leads, ${money(s.value, d.currency)}`}
                  style={{
                    height: Math.max(3, (Number(s.value) / max) * 146),
                    background: s.color,
                    opacity: 0.72,
                  }}
                />
                <small>{s.name}</small>
              </div>
            ))}
          </div>
          <div className="chart-foot">
            <span>
              Avg. lead age <b>{k.avg_open_age_days} days</b>
            </span>
            <span>
              Won this month <b>{k.won_this_month}</b>
            </span>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Your next moves</h2>
              <p>Keep the important things moving</p>
            </div>
            <Clock3 size={17} color="#a7b6aa" />
          </div>
          {pending.length > 0 && (
            <Link className="focus-item" href="/proposals">
              <span className="focus-icon">
                <FileText size={17} />
              </span>
              <div>
                <b>
                  {pending.length} proposal{pending.length === 1 ? "" : "s"}{" "}
                  awaiting approval
                </b>
                <small>Review before sharing with customers</small>
              </div>
              <ChevronRight size={16} />
            </Link>
          )}
          {tasks.slice(0, 3).map((t: any) => (
            <Link href="/tasks" className="focus-item" key={t.id}>
              <span
                className="focus-icon"
                style={{ background: "#edf3ec", color: "#7d9e7b" }}
              >
                <CalendarDays size={16} />
              </span>
              <div>
                <b>{t.title}</b>
                <small>
                  {t.lead_name || t.assignee_name} · {date(t.due_at)}
                </small>
              </div>
              {t.due_at && new Date(t.due_at) < new Date() && (
                <Badge tone="amber">Overdue</Badge>
              )}
            </Link>
          ))}
          {!tasks.length && !pending.length && (
            <Empty
              title="All caught up"
              text="Your upcoming tasks and approvals will appear here."
            />
          )}
          <Link
            href="/tasks"
            className="text-link print-hide"
            style={{ display: "block", marginTop: 20 }}
          >
            All tasks <span>→</span>
          </Link>
        </section>
      </div>

      {/* RECENT OPPORTUNITIES */}
      <section className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <div>
            <h2>Recent opportunities</h2>
            <p>Every conversation is a place to start</p>
          </div>
          <Link href="/leads" className="text-link print-hide">
            View all leads →
          </Link>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Lead / company</th>
                <th>Stage</th>
                <th>Deal value</th>
                <th>Owner</th>
                <th>Stage age</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {d.recentLeads.map((l: any) => (
                <tr key={l.id}>
                  <td>
                    <Link className="person-cell" href={"/leads/" + l.id}>
                      <Avatar name={l.name} small />
                      <div>
                        <b>{l.name}</b>
                        <small>{l.company || "Individual"}</small>
                      </div>
                    </Link>
                  </td>
                  <td>
                    <Badge tone={l.stage_name.toLowerCase()}>
                      <span
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 4,
                          background: l.stage_color,
                        }}
                      />
                      {l.stage_name}
                    </Badge>
                  </td>
                  <td>
                    <b>{money(l.value, d.currency)}</b>
                  </td>
                  <td>{l.owner_name}</td>
                  <td>
                    <Badge tone={l.stage_age_days > 14 ? "amber" : "neutral"}>
                      {l.stage_age_days} days
                    </Badge>
                  </td>
                  <td>{date(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!d.recentLeads.length && (
          <Empty
            title="Your pipeline starts here"
            text="Add your first lead to see live sales insights."
            action={
              <Link className="btn print-hide" href="/leads?new=1">
                Add a lead
              </Link>
            }
          />
        )}
      </section>

      {/* TEAM LEADERBOARD & SOURCES */}
      <div className="dashboard-grid equal">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Team performance leaderboard</h2>
              <p>{d.scope}</p>
            </div>
            <UsersRound size={17} color="#a7b6aa" />
          </div>
          {d.owners.map((o: any, i: number) => (
            <div className="progress-row" key={i}>
              <div className="row spaced">
                <div className="person-cell">
                  <Avatar name={o.owner} small />
                  <div>
                    <b style={{ fontSize: 11 }}>{o.owner}</b>
                    <div className="subtle">
                      {o.count} leads · {o.won} won
                    </div>
                  </div>
                </div>
                <b style={{ fontSize: 12 }}>
                  {shortMoney(o.open_value, d.currency)}
                </b>
              </div>
              <div className="bar">
                <span
                  style={{
                    width:
                      (Number(o.open_value) /
                        Math.max(1, Number(k.total_value))) *
                        100 +
                      "%",
                  }}
                />
              </div>
            </div>
          ))}
          {!d.owners.length && <Empty title="Team insights will appear here" />}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Where opportunities begin</h2>
              <p>Performance across your lead sources</p>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Leads</th>
                <th>Won</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {d.sources.map((s: any) => (
                <tr key={s.source}>
                  <td>
                    <b>{s.source}</b>
                  </td>
                  <td>{s.count}</td>
                  <td>{s.won}</td>
                  <td>{shortMoney(s.value, d.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.sources.length && <Empty title="No sources yet" />}
        </section>
      </div>

      <div className="page-footer print-hide">
        <span>
          <span className="live-dot" /> Live workspace data · {d.scope}
        </span>
        <span>Lead2 CRM · Enterprise Analytics Engine</span>
      </div>
    </>
  );
}
