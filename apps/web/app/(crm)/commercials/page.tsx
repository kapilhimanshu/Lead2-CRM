"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Plus,
  Pencil,
  FileText,
  BookOpen,
  Trash2,
  Package,
  Layers,
  Globe,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api, money, currentUser, can } from "../../../lib/api";
import {
  PageHead,
  Notice,
  Loading,
  Empty,
  Badge,
  Modal,
  Field,
  CURRENCIES,
  useResource,
} from "../../../components/UI";

const defaultHtml =
  "<h1>{{proposal_title}}</h1>\n<p>Prepared for {{client_name}} at {{company_name}}</p>\n<h2>Your requirements</h2><p>{{scope}}</p>\n{{commercial_table}}\n<h2>Delivery</h2><p>{{timeline}}</p>\n<h2>Terms</h2><p>{{terms}}</p>\n<p>Valid until {{valid_until}}</p>";

const CATEGORY_LABELS: Record<string, string> = {
  recurring: "Recurring (MRR / ARR)",
  service_milestone: "Service / Milestone",
  physical_good: "Physical / Good",
  custom: "Custom Category",
};

const BILLING_LABELS: Record<string, string> = {
  monthly: "Monthly Recurring",
  quarterly: "Quarterly Recurring",
  annual: "Annual Recurring",
  one_time: "One-Time Upfront",
  hourly: "Hourly Consulting",
  milestone: "Milestone Delivery",
};

export default function Commercials() {
  const { data, error, setError, reload } = useResource(() =>
      Promise.all([
        api("/proposals/commercials"),
        api("/proposals/templates"),
        api("/proposals/product-master"),
        api("/proposals/product-types"),
      ]),
    ),
    [tab, setTab] = useState("product_master"),
    [editCatalog, setEditCatalog] = useState<any>(null),
    [editTemplate, setEditTemplate] = useState<any>(null),
    [editProduct, setEditProduct] = useState<any>(null),
    [editType, setEditType] = useState<any>(null),
    [f, setF] = useState<any>({}),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [categoryFilter, setCategoryFilter] = useState("all");

  if (!data) return error ? <Notice message={error} /> : <Loading />;
  const [catalogs, templates, products, productTypes] = data;
  const u = currentUser();
  const canManageCommercials = can(u, "commercial.manage");
  const canManageTemplates = can(u, "template.manage");

  async function save(
    path: string,
    isPatch: boolean,
    close: () => void,
    msg = "Saved. Existing proposals retain their decoupled historical snapshot.",
  ) {
    setBusy(true);
    setError("");
    try {
      await api(path, {
        method: isPatch ? "PATCH" : "POST",
        body: JSON.stringify(f),
      });
      close();
      setNotice(msg);
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function openProductModal(p?: any) {
    const defaultType = productTypes[0];
    setEditProduct(p || {});
    setF(
      p
        ? {
            sku: p.sku,
            name: p.name,
            description: p.description,
            productTypeId: p.product_type_id || defaultType?.id || "",
            productTypeCode: p.product_type_code || defaultType?.code || "recurring_saas",
            billingBehavior: p.billing_behavior || "monthly",
            unit: p.unit || "seat / month",
            baseCurrency: p.base_currency || u?.currency || "INR",
            basePrice: Number(p.base_price || 0),
            taxPct: Number(p.tax_pct ?? 18),
            currencyPrices: p.currency_prices || {},
            pricingTiers: Array.isArray(p.pricing_tiers) ? p.pricing_tiers : [],
            active: p.active !== false,
          }
        : {
            sku: `L2-SKU-${String(products.length + 1).padStart(3, "0")}`,
            name: "",
            description: "",
            productTypeId: defaultType?.id || "",
            productTypeCode: defaultType?.code || "recurring_saas",
            billingBehavior: defaultType?.billing_frequency || "monthly",
            unit: "seat / month",
            baseCurrency: u?.currency || "INR",
            basePrice: 0,
            taxPct: 18,
            currencyPrices: { INR: 0, USD: 0, EUR: 0, GBP: 0 },
            pricingTiers: [],
            active: true,
          },
    );
  }

  function openTypeModal(pt?: any) {
    setEditType(pt || {});
    setF(
      pt
        ? {
            name: pt.name,
            code: pt.code,
            category: pt.category || "service_milestone",
            billingFrequency: pt.billing_frequency || "one_time",
            description: pt.description || "",
            active: pt.active !== false,
          }
        : {
            name: "",
            code: "",
            category: "recurring",
            billingFrequency: "monthly",
            description: "",
            active: true,
          },
    );
  }

  function openCatalogModal(c?: any) {
    setEditCatalog(c || {});
    setF(
      c
        ? { ...c, taxPct: c.tax_pct }
        : {
            name: "",
            currency: u?.currency || "INR",
            taxPct: 18,
            items: [{ description: "", unit: "unit", unitPrice: 0 }],
            terms: "Payment due within 30 days.",
            active: true,
          },
    );
  }

  function openTemplateModal(t?: any) {
    setEditTemplate(t || {});
    setF(
      t
        ? { ...t, bodyHtml: t.body_html }
        : {
            name: "",
            bodyHtml: defaultHtml,
            questions: [
              {
                key: "scope",
                label: "What does the customer need?",
                required: true,
              },
              {
                key: "timeline",
                label: "What is the delivery timeline?",
                required: true,
              },
            ],
            active: true,
          },
    );
  }

  const filteredProducts = products.filter(
    (p: any) =>
      categoryFilter === "all" ||
      p.product_category === categoryFilter ||
      p.product_type_code === categoryFilter,
  );

  return (
    <>
      <PageHead
        eyebrow="SINGLE SOURCE OF TRUTH · CPQ READY"
        title="Commercials, Product Master & Templates"
        description="Centralize SKUs, configurable Product Types, multi-currency price books, and tiered pricing. Every proposal snapshots line items so historical quotes never drift."
        actions={
          <div className="row" style={{ gap: 10 }}>
            <Link className="btn ghost" href="/proposals">
              <FileText size={14} />
              Go to Proposals
            </Link>
            {tab === "product_master" && canManageCommercials && (
              <button className="btn" onClick={() => openProductModal()}>
                <Plus size={14} />
                New Product SKU
              </button>
            )}
            {tab === "product_types" && canManageCommercials && (
              <button className="btn" onClick={() => openTypeModal()}>
                <Plus size={14} />
                New Product Type
              </button>
            )}
            {tab === "commercials" && canManageCommercials && (
              <button className="btn" onClick={() => openCatalogModal()}>
                <Plus size={14} />
                New Commercial Catalog
              </button>
            )}
            {tab === "templates" && canManageTemplates && (
              <button className="btn" onClick={() => openTemplateModal()}>
                <Plus size={14} />
                New Template
              </button>
            )}
          </div>
        }
      />

      <Notice message={error} onClose={() => setError("")} />
      <Notice message={notice} success onClose={() => setNotice("")} />

      <div
        className="card"
        style={{
          marginBottom: 20,
          padding: "16px 20px",
          background: "linear-gradient(135deg, #f3faf7 0%, #ffffff 100%)",
          border: "1px solid #cce3dc",
        }}
      >
        <div
          className="row spaced"
          style={{ flexWrap: "wrap", gap: 16, alignItems: "center" }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span className="workspace-icon" style={{ background: "#1c7364", color: "#fff" }}>
              <ShieldCheck size={18} />
            </span>
            <div>
              <b style={{ fontSize: 14 }}>
                CPQ Architecture · Decoupled Snapshot Guarantee
              </b>
              <p className="subtle" style={{ margin: "2px 0 0" }}>
                Product Master governs standard SKUs, multi-currency rates, and
                volume tiers. Adding an item to a proposal copies an immutable
                snapshot into <code>proposal_line_items</code> so updating or
                archiving a SKU never alters past quotes.
              </p>
            </div>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <Badge tone="green">{products.length} Master SKUs</Badge>
            <Badge tone="blue">{productTypes.length} Product Types</Badge>
            <Badge tone="neutral">{catalogs.length} Price Books</Badge>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={tab === "product_master" ? "active" : ""}
          onClick={() => setTab("product_master")}
        >
          <Package size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Product Master (SKUs & Tiers)
        </button>
        <button
          className={tab === "product_types" ? "active" : ""}
          onClick={() => setTab("product_types")}
        >
          <Layers size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Product Types
        </button>
        <button
          className={tab === "commercials" ? "active" : ""}
          onClick={() => setTab("commercials")}
        >
          <BookOpen size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Commercial Catalogs
        </button>
        <button
          className={tab === "templates" ? "active" : ""}
          onClick={() => setTab("templates")}
        >
          <FileText size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Proposal Templates
        </button>
      </div>

      {tab === "product_master" && (
        <>
          <div
            className="row spaced"
            style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}
          >
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {[
                { key: "all", label: "All Categories" },
                { key: "recurring", label: "Recurring (MRR / ARR)" },
                { key: "service_milestone", label: "Services & Milestones" },
                { key: "physical_good", label: "Physical / Hardware" },
              ].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`btn small ${categoryFilter === c.key ? "" : "ghost"}`}
                  onClick={() => setCategoryFilter(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {!canManageCommercials && (
              <span className="subtle">
                Read-only workspace catalog · Managed by Customer Admin
              </span>
            )}
          </div>

          <div className="cards-grid">
            {filteredProducts.map((p: any) => {
              const tiers = Array.isArray(p.pricing_tiers)
                ? p.pricing_tiers
                : [];
              const currPrices =
                p.currency_prices && typeof p.currency_prices === "object"
                  ? Object.entries(p.currency_prices)
                  : [];
              return (
                <div className="card catalog-card" key={p.id}>
                  <div className="row spaced">
                    <code
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        background: "#edf5f2",
                        color: "#155e52",
                        padding: "4px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {p.sku}
                    </code>
                    <div className="row" style={{ gap: 6 }}>
                      <Badge
                        tone={
                          p.product_category === "recurring"
                            ? "green"
                            : p.product_category === "physical_good"
                              ? "amber"
                              : "blue"
                        }
                      >
                        {p.product_type_name ||
                          CATEGORY_LABELS[p.product_category] ||
                          p.product_type_code}
                      </Badge>
                      <Badge tone={p.active ? "green" : "neutral"}>
                        {p.active ? "Active" : "Archived"} · v{p.version}
                      </Badge>
                    </div>
                  </div>

                  <h2 style={{ marginBottom: 4 }}>{p.name}</h2>
                  <p className="subtle" style={{ marginBottom: 12 }}>
                    {p.description}
                  </p>

                  <div className="stat-line">
                    <span>Standard Base Price ({p.unit})</span>
                    <b>{money(p.base_price, p.base_currency)}</b>
                  </div>
                  <div className="stat-line">
                    <span>Billing Behavior & Tax Rule</span>
                    <span>
                      <b>{BILLING_LABELS[p.billing_behavior] || p.billing_behavior}</b>{" "}
                      · {p.tax_pct}% tax
                    </span>
                  </div>

                  {currPrices.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <small
                        className="subtle"
                        style={{ display: "block", marginBottom: 4 }}
                      >
                        <Globe
                          size={12}
                          style={{ verticalAlign: "middle", marginRight: 4 }}
                        />
                        Multi-Currency Price Book:
                      </small>
                      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                        {currPrices.map(([curr, val]: any) => (
                          <span
                            key={curr}
                            style={{
                              fontSize: 11,
                              padding: "2px 7px",
                              borderRadius: 4,
                              background: "#f4f7f6",
                              border: "1px solid #dde7e3",
                            }}
                          >
                            <b>{curr}</b>: {Number(val).toLocaleString()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {tiers.length > 0 && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "8px 10px",
                        background: "#f8fbfa",
                        borderRadius: 6,
                        border: "1px solid #e3eee9",
                      }}
                    >
                      <small
                        style={{
                          fontWeight: 600,
                          display: "block",
                          marginBottom: 4,
                          color: "#173c3b",
                        }}
                      >
                        <Sparkles
                          size={12}
                          style={{ verticalAlign: "middle", marginRight: 4 }}
                        />
                        Volume Tiers ({tiers.length}):
                      </small>
                      {tiers.map((t: any, idx: number) => (
                        <div
                          key={idx}
                          className="row spaced"
                          style={{ fontSize: 11, padding: "2px 0" }}
                        >
                          <span>
                            {t.tierName ||
                              `${t.minQty}–${t.maxQty ?? "∞"} units`}
                          </span>
                          <b>
                            {money(t.unitPrice, p.base_currency)} / {p.unit}
                          </b>
                        </div>
                      ))}
                    </div>
                  )}

                  <footer style={{ marginTop: 14 }}>
                    <span className="subtle">
                      Decoupled on quote generation
                    </span>
                    {canManageCommercials && (
                      <button
                        className="btn ghost small"
                        onClick={() => openProductModal(p)}
                      >
                        <Pencil size={12} />
                        Edit SKU
                      </button>
                    )}
                  </footer>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "product_types" && (
        <>
          <div className="info-box" style={{ marginBottom: 20 }}>
            <b>Why Configurable Product Types Matter:</b> Product Types define
            whether a line item behaves as <b>Recurring (MRR / ARR)</b>,{" "}
            <b>Service / Milestone (One-Time or Hourly)</b>, or{" "}
            <b>Physical / Good (Hardware)</b>. Tenants can customize categories
            while preserving standard revenue split analytics.
          </div>
          <div className="cards-grid">
            {productTypes.map((pt: any) => (
              <div className="card catalog-card" key={pt.id}>
                <div className="row spaced">
                  <span className="workspace-icon">
                    <Layers size={18} />
                  </span>
                  <div className="row" style={{ gap: 6 }}>
                    {pt.is_default && <Badge tone="blue">Standard Default</Badge>}
                    <Badge tone={pt.active ? "green" : "neutral"}>
                      {pt.active ? "Active" : "Archived"}
                    </Badge>
                  </div>
                </div>
                <h2>{pt.name}</h2>
                <p className="subtle">{pt.description}</p>
                <div className="stat-line">
                  <span>Code</span>
                  <code>{pt.code}</code>
                </div>
                <div className="stat-line">
                  <span>Revenue Bucket</span>
                  <b>{CATEGORY_LABELS[pt.category] || pt.category}</b>
                </div>
                <div className="stat-line">
                  <span>Default Billing</span>
                  <b>
                    {BILLING_LABELS[pt.billing_frequency] ||
                      pt.billing_frequency}
                  </b>
                </div>
                <footer>
                  <span className="subtle">
                    {
                      products.filter(
                        (p: any) =>
                          p.product_type_id === pt.id ||
                          p.product_type_code === pt.code,
                      ).length
                    }{" "}
                    linked SKUs
                  </span>
                  {canManageCommercials && (
                    <button
                      className="btn ghost small"
                      onClick={() => openTypeModal(pt)}
                    >
                      <Pencil size={12} />
                      Configure
                    </button>
                  )}
                </footer>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "commercials" && (
        <div className="cards-grid">
          {catalogs.map((c: any) => (
            <div className="card catalog-card" key={c.id}>
              <div className="row spaced">
                <span className="workspace-icon">
                  <BookOpen size={18} />
                </span>
                <Badge tone={c.active ? "green" : "neutral"}>
                  {c.active ? "Active" : "Archived"} · v{c.version}
                </Badge>
              </div>
              <h2>{c.name}</h2>
              <div>
                {c.items.slice(0, 4).map((x: any) => (
                  <div className="stat-line" key={x.id}>
                    <span>
                      {x.sku ? <code>{x.sku} </code> : null}
                      {x.description}
                    </span>
                    <b>{money(x.unitPrice, c.currency)}</b>
                  </div>
                ))}
                {c.items.length > 4 && (
                  <p className="subtle">+ {c.items.length - 4} more items</p>
                )}
              </div>
              <footer>
                <span className="subtle">
                  {c.currency} · {c.tax_pct}% tax
                </span>
                {canManageCommercials && (
                  <button
                    className="btn ghost small"
                    onClick={() => openCatalogModal(c)}
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                )}
              </footer>
            </div>
          ))}
          {!catalogs.length && (
            <div className="card">
              <Empty
                title="Your first commercial catalog"
                text="Bundle SKUs from your Product Master into region or segment-specific commercial catalogs."
                action={
                  canManageCommercials && (
                    <button className="btn" onClick={() => openCatalogModal()}>
                      Create commercial
                    </button>
                  )
                }
              />
            </div>
          )}
        </div>
      )}

      {tab === "templates" && (
        <>
          <div className="info-box" style={{ marginBottom: 22 }}>
            Upload your standard proposal as DOCX, HTML, TXT or Markdown.
            Include <code>{"{{commercial_table}}"}</code> for pricing and
            placeholders for your questions.{" "}
            <a
              className="text-link"
              href="/sample-proposal-template.html"
              download
            >
              Download sample format →
            </a>
          </div>
          <div className="cards-grid">
            {templates.map((t: any) => (
              <div className="card catalog-card" key={t.id}>
                <div className="row spaced">
                  <span className="workspace-icon">
                    <FileText size={18} />
                  </span>
                  <Badge tone={t.active ? "green" : "neutral"}>
                    {t.active ? "Active" : "Archived"} · v{t.version}
                  </Badge>
                </div>
                <h2>{t.name}</h2>
                <p className="muted">
                  {t.questions.length} guided questions ·{" "}
                  {t.source_filename || "Created in Lead2"}
                </p>
                <div className="row">
                  {t.questions.map((q: any) => (
                    <Badge key={q.key}>{q.key}</Badge>
                  ))}
                </div>
                <footer>
                  <span className="subtle">Client-owned format</span>
                  {canManageTemplates && (
                    <button
                      className="btn ghost small"
                      onClick={() => openTemplateModal(t)}
                    >
                      <Pencil size={12} />
                      Edit template
                    </button>
                  )}
                </footer>
              </div>
            ))}
          </div>
        </>
      )}

      {/* PRODUCT MASTER SKU MODAL */}
      {editProduct && (
        <Modal
          title={
            editProduct.id
              ? `Edit Product Master SKU · ${editProduct.sku}`
              : "New Product Master SKU"
          }
          wide
          onClose={() => setEditProduct(null)}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                "/proposals/product-master" +
                  (editProduct.id ? "/" + editProduct.id : ""),
                !!editProduct.id,
                () => setEditProduct(null),
                "Product Master SKU saved. Existing proposals keep their historical line-item snapshot.",
              );
            }}
          >
            <Notice message={error} />
            <div className="form-grid">
              <Field label="SKU Code (Unique Single Source of Truth)">
                <input
                  required
                  className="input"
                  placeholder="e.g. L2-SAAS-PRO"
                  value={f.sku}
                  onChange={(e) =>
                    setF({ ...f, sku: e.target.value.toUpperCase() })
                  }
                />
              </Field>
              <Field label="Product / Service Name">
                <input
                  required
                  className="input"
                  placeholder="e.g. Lead2 Revenue Cloud · Pro Seat"
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                />
              </Field>
            </div>

            <div className="form-grid">
              <Field label="Product Type (Catalog Category)">
                <select
                  className="input"
                  value={f.productTypeId}
                  onChange={(e) => {
                    const pt = productTypes.find(
                      (x: any) => x.id === e.target.value,
                    );
                    setF({
                      ...f,
                      productTypeId: e.target.value,
                      productTypeCode: pt?.code || f.productTypeCode,
                      billingBehavior:
                        pt?.billing_frequency || f.billingBehavior,
                    });
                  }}
                >
                  {productTypes.map((pt: any) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name} ({CATEGORY_LABELS[pt.category] || pt.category})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Billing Behavior">
                <select
                  className="input"
                  value={f.billingBehavior}
                  onChange={(e) =>
                    setF({ ...f, billingBehavior: e.target.value })
                  }
                >
                  {Object.entries(BILLING_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Standard Proposal Description">
              <textarea
                required
                className="input"
                placeholder="Standardized scope & deliverables shown on proposals"
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
              />
            </Field>

            <div className="form-grid">
              <Field label="Unit of Measure">
                <input
                  required
                  className="input"
                  placeholder="seat / month, hour, milestone, device"
                  value={f.unit}
                  onChange={(e) => setF({ ...f, unit: e.target.value })}
                />
              </Field>
              <Field label="Base Currency">
                <select
                  className="input"
                  value={f.baseCurrency}
                  onChange={(e) =>
                    setF({ ...f, baseCurrency: e.target.value })
                  }
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Standard Base Price">
                <input
                  required
                  className="input"
                  type="number"
                  min="0"
                  step=".01"
                  value={f.basePrice}
                  onChange={(e) =>
                    setF({
                      ...f,
                      basePrice: e.target.value,
                      currencyPrices: {
                        ...(f.currencyPrices || {}),
                        [f.baseCurrency]: Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
              <Field label="Standard Tax Rule (%)">
                <input
                  required
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  step=".01"
                  value={f.taxPct}
                  onChange={(e) => setF({ ...f, taxPct: e.target.value })}
                />
              </Field>
            </div>

            <h3>Multi-Currency Price Book (Optional Overrides)</h3>
            <div className="form-grid">
              {["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((curr) => (
                <Field key={curr} label={`${curr} Unit Price`}>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step=".01"
                    placeholder={`Default in ${curr}`}
                    value={f.currencyPrices?.[curr] ?? ""}
                    onChange={(e) =>
                      setF({
                        ...f,
                        currencyPrices: {
                          ...(f.currencyPrices || {}),
                          [curr]:
                            e.target.value === "" ? "" : Number(e.target.value),
                        },
                      })
                    }
                  />
                </Field>
              ))}
            </div>

            <h3>Volume / Tiered Pricing Rules (CPQ)</h3>
            <p className="subtle">
              Automatically apply discounted unit prices when a sales rep quotes
              higher quantities.
            </p>
            {(f.pricingTiers || []).map((tier: any, idx: number) => (
              <div className="item-row" key={idx}>
                <Field label="Tier Name">
                  <input
                    className="input"
                    placeholder="e.g. Growth (11–50)"
                    value={tier.tierName || ""}
                    onChange={(e) =>
                      setF({
                        ...f,
                        pricingTiers: f.pricingTiers.map(
                          (t: any, j: number) =>
                            j === idx ? { ...t, tierName: e.target.value } : t,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Min Qty">
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={tier.minQty ?? 1}
                    onChange={(e) =>
                      setF({
                        ...f,
                        pricingTiers: f.pricingTiers.map(
                          (t: any, j: number) =>
                            j === idx
                              ? { ...t, minQty: Number(e.target.value) }
                              : t,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Max Qty (blank = ∞)">
                  <input
                    className="input"
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={tier.maxQty ?? ""}
                    onChange={(e) =>
                      setF({
                        ...f,
                        pricingTiers: f.pricingTiers.map(
                          (t: any, j: number) =>
                            j === idx
                              ? {
                                  ...t,
                                  maxQty:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                }
                              : t,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label={`Unit Price (${f.baseCurrency})`}>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step=".01"
                    value={tier.unitPrice ?? 0}
                    onChange={(e) =>
                      setF({
                        ...f,
                        pricingTiers: f.pricingTiers.map(
                          (t: any, j: number) =>
                            j === idx
                              ? { ...t, unitPrice: Number(e.target.value) }
                              : t,
                        ),
                      })
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() =>
                    setF({
                      ...f,
                      pricingTiers: f.pricingTiers.filter(
                        (_: any, j: number) => j !== idx,
                      ),
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                setF({
                  ...f,
                  pricingTiers: [
                    ...(f.pricingTiers || []),
                    {
                      tierName: `Tier ${(f.pricingTiers || []).length + 1}`,
                      minQty: 1,
                      maxQty: null,
                      unitPrice: Number(f.basePrice || 0),
                    },
                  ],
                })
              }
            >
              <Plus size={13} />
              Add Volume Pricing Tier
            </button>

            <label className="row" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={f.active}
                onChange={(e) => setF({ ...f, active: e.target.checked })}
              />
              Active in Product Master for new proposals
            </label>

            <div className="form-actions">
              <button className="btn" disabled={busy}>
                {busy ? "Saving…" : "Save Product Master SKU"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* PRODUCT TYPE MODAL */}
      {editType && (
        <Modal
          title={
            editType.id ? "Configure Product Type" : "New Configurable Product Type"
          }
          onClose={() => setEditType(null)}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                "/proposals/product-types" +
                  (editType.id ? "/" + editType.id : ""),
                !!editType.id,
                () => setEditType(null),
                "Product Type saved.",
              );
            }}
          >
            <Notice message={error} />
            <Field label="Product Type Name">
              <input
                required
                className="input"
                placeholder="e.g. Usage-Based API Metering"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            {!editType.id && (
              <Field
                label="Type Code"
                hint="Lowercase identifier (auto-generated if left blank)"
              >
                <input
                  className="input"
                  placeholder="e.g. usage_api"
                  value={f.code}
                  onChange={(e) => setF({ ...f, code: e.target.value })}
                />
              </Field>
            )}
            <Field label="Revenue Reporting Category">
              <select
                className="input"
                value={f.category}
                onChange={(e) => setF({ ...f, category: e.target.value })}
              >
                <option value="recurring">
                  Recurring (Counts toward MRR & ARR)
                </option>
                <option value="service_milestone">
                  Service / Milestone (One-time or Hourly Services)
                </option>
                <option value="physical_good">
                  Physical / Good (Hardware & Equipment)
                </option>
                <option value="custom">Custom Category</option>
              </select>
            </Field>
            <Field label="Default Billing Frequency">
              <select
                className="input"
                value={f.billingFrequency}
                onChange={(e) =>
                  setF({ ...f, billingFrequency: e.target.value })
                }
              >
                {Object.entries(BILLING_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <textarea
                className="input"
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
              />
            </Field>
            <label className="row">
              <input
                type="checkbox"
                checked={f.active}
                onChange={(e) => setF({ ...f, active: e.target.checked })}
              />
              Active Product Type
            </label>
            <div className="form-actions">
              <button className="btn" disabled={busy}>
                {busy ? "Saving…" : "Save Product Type"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* COMMERCIAL CATALOG MODAL */}
      {editCatalog && (
        <Modal
          title={editCatalog.id ? "Edit commercial" : "New commercial"}
          wide
          onClose={() => setEditCatalog(null)}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                "/proposals/commercials" +
                  (editCatalog.id ? "/" + editCatalog.id : ""),
                !!editCatalog.id,
                () => setEditCatalog(null),
              );
            }}
          >
            <Notice message={error} />
            <Field label="Commercial name">
              <input
                className="input"
                required
                placeholder="e.g. Enterprise services · India"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Currency">
                <select
                  className="input"
                  value={f.currency}
                  onChange={(e) => setF({ ...f, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tax (%)">
                <input
                  required
                  className="input"
                  type="number"
                  step=".01"
                  min="0"
                  max="100"
                  value={f.taxPct}
                  onChange={(e) => setF({ ...f, taxPct: e.target.value })}
                />
              </Field>
            </div>

            <div
              className="row spaced"
              style={{ alignItems: "center", marginTop: 8 }}
            >
              <h3 style={{ margin: 0 }}>Products & services</h3>
              {products.length > 0 && (
                <select
                  className="input"
                  style={{ width: "auto", minWidth: 260 }}
                  defaultValue=""
                  onChange={(e) => {
                    const pm = products.find(
                      (x: any) => x.id === e.target.value,
                    );
                    if (!pm) return;
                    const price =
                      pm.currency_prices?.[f.currency] ?? pm.base_price;
                    setF({
                      ...f,
                      items: [
                        ...f.items.filter((x: any) => x.description),
                        {
                          productMasterId: pm.id,
                          sku: pm.sku,
                          name: pm.name,
                          productTypeCode: pm.product_type_code,
                          productCategory: pm.product_category,
                          billingBehavior: pm.billing_behavior,
                          description: `${pm.name} — ${pm.description}`,
                          unit: pm.unit,
                          unitPrice: Number(price),
                          taxPct: Number(pm.tax_pct ?? f.taxPct),
                        },
                      ],
                    });
                    e.target.value = "";
                  }}
                >
                  <option value="">+ Import SKU from Product Master…</option>
                  {products
                    .filter((x: any) => x.active)
                    .map((pm: any) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.sku} · {pm.name} (
                        {money(
                          pm.currency_prices?.[f.currency] ?? pm.base_price,
                          f.currency,
                        )}
                        )
                      </option>
                    ))}
                </select>
              )}
            </div>

            {f.items.map((item: any, i: number) => (
              <div className="item-row" key={i}>
                <Field
                  label={
                    item.sku ? `Description (${item.sku})` : "Description"
                  }
                >
                  <input
                    required
                    className="input"
                    value={item.description}
                    onChange={(e) =>
                      setF({
                        ...f,
                        items: f.items.map((x: any, j: number) =>
                          j === i ? { ...x, description: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Unit">
                  <input
                    className="input"
                    value={item.unit}
                    onChange={(e) =>
                      setF({
                        ...f,
                        items: f.items.map((x: any, j: number) =>
                          j === i ? { ...x, unit: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Unit price">
                  <input
                    required
                    className="input"
                    type="number"
                    min="0"
                    step=".01"
                    value={item.unitPrice}
                    onChange={(e) =>
                      setF({
                        ...f,
                        items: f.items.map((x: any, j: number) =>
                          j === i ? { ...x, unitPrice: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={"Remove item " + (i + 1)}
                  disabled={f.items.length === 1}
                  onClick={() =>
                    setF({
                      ...f,
                      items: f.items.filter((_: any, j: number) => i !== j),
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                setF({
                  ...f,
                  items: [
                    ...f.items,
                    { description: "", unit: "unit", unitPrice: 0 },
                  ],
                })
              }
            >
              <Plus size={13} />
              Add custom item
            </button>
            <Field label="Standard payment and delivery terms">
              <textarea
                className="input"
                value={f.terms}
                onChange={(e) => setF({ ...f, terms: e.target.value })}
              />
            </Field>
            <label className="row">
              <input
                type="checkbox"
                checked={f.active}
                onChange={(e) => setF({ ...f, active: e.target.checked })}
              />
              Active for new proposals
            </label>
            <div className="form-actions">
              <button className="btn" disabled={busy}>
                {busy ? "Saving…" : "Save commercial"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* PROPOSAL TEMPLATE MODAL */}
      {editTemplate && (
        <Modal
          title={
            editTemplate.id
              ? "Edit proposal template"
              : "New proposal template"
          }
          wide
          onClose={() => setEditTemplate(null)}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                "/proposals/templates" +
                  (editTemplate.id ? "/" + editTemplate.id : ""),
                !!editTemplate.id,
                () => setEditTemplate(null),
              );
            }}
          >
            <Notice message={error} />
            <Field label="Template name">
              <input
                required
                className="input"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <Field
              label="Upload your standard format"
              hint="DOCX, HTML, TXT, Markdown · Maximum 2 MB"
            >
              <input
                className="input"
                type="file"
                accept=".docx,.html,.htm,.txt,.md"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    setError("Maximum file size is 2 MB");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () =>
                    setF({
                      ...f,
                      filename: file.name,
                      fileBase64: String(reader.result).split(",")[1],
                    });
                  reader.onerror = () => setError("Could not read file");
                  reader.readAsDataURL(file);
                }}
              />
            </Field>
            {f.fileBase64 ? (
              <div className="info-box row spaced">
                <span>{f.filename} is ready to upload</span>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() =>
                    setF({ ...f, fileBase64: undefined, filename: undefined })
                  }
                >
                  Use editor instead
                </button>
              </div>
            ) : (
              <Field
                label="Template content (HTML)"
                hint="Required: {{commercial_table}}. Other fields: proposal_title, client_name, company_name, terms, valid_until, seller_name, proposal_number."
              >
                <textarea
                  required
                  className="input code"
                  style={{ minHeight: 200 }}
                  value={f.bodyHtml}
                  onChange={(e) => setF({ ...f, bodyHtml: e.target.value })}
                />
              </Field>
            )}
            <h3>Questions asked during proposal generation</h3>
            <p className="subtle">
              Use each question’s key as a placeholder, such as {"{{scope}}"},
              in your uploaded format or editor.
            </p>
            {f.questions.map((q: any, i: number) => (
              <div className="question-row" key={i}>
                <input
                  className="input"
                  aria-label={"Question " + (i + 1) + " key"}
                  placeholder="key"
                  required
                  value={q.key}
                  onChange={(e) =>
                    setF({
                      ...f,
                      questions: f.questions.map((x: any, j: number) =>
                        j === i ? { ...x, key: e.target.value } : x,
                      ),
                    })
                  }
                />
                <input
                  className="input"
                  aria-label={"Question " + (i + 1) + " label"}
                  placeholder="Question asked to users"
                  required
                  value={q.label}
                  onChange={(e) =>
                    setF({
                      ...f,
                      questions: f.questions.map((x: any, j: number) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Remove question"
                  onClick={() =>
                    setF({
                      ...f,
                      questions: f.questions.filter(
                        (_: any, j: number) => j !== i,
                      ),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={f.questions.length >= 12}
              className="btn ghost"
              onClick={() =>
                setF({
                  ...f,
                  questions: [
                    ...f.questions,
                    { key: "", label: "", required: true },
                  ],
                })
              }
            >
              <Plus size={13} />
              Add question
            </button>
            <label className="row">
              <input
                type="checkbox"
                checked={f.active}
                onChange={(e) => setF({ ...f, active: e.target.checked })}
              />
              Available for new proposals
            </label>
            <div className="form-actions">
              <button className="btn" disabled={busy}>
                {busy ? "Saving…" : "Save template"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
