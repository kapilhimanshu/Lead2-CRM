"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Plus,
  ArrowRight,
  ArrowLeft,
  Download,
  ExternalLink,
  Check,
  TrendingUp,
  Layers,
  Package,
  ShieldCheck,
} from "lucide-react";
import {
  api,
  API,
  currentUser,
  can,
  money,
  date,
  label,
  downloadDocument,
} from "../../../lib/api";
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

function resolveClientItemPrice(product: any, currency: string, qty: number) {
  const currPrices =
    product.currency_prices && typeof product.currency_prices === "object"
      ? product.currency_prices
      : {};
  let unitPrice =
    currPrices[currency] !== undefined && currPrices[currency] !== ""
      ? Number(currPrices[currency])
      : Number(product.base_price ?? product.unitPrice ?? 0);
  let tierApplied: string | null = null;

  const tiers = Array.isArray(product.pricing_tiers)
    ? product.pricing_tiers
    : [];
  for (const tier of tiers) {
    const min = Number(tier.minQty ?? 1);
    const max =
      tier.maxQty === null || tier.maxQty === undefined || tier.maxQty === ""
        ? Infinity
        : Number(tier.maxQty);
    if (qty >= min && qty <= max) {
      if (
        tier.currencyPrices &&
        tier.currencyPrices[currency] !== undefined &&
        tier.currencyPrices[currency] !== ""
      ) {
        unitPrice = Number(tier.currencyPrices[currency]);
      } else if (tier.unitPrice !== undefined) {
        unitPrice = Number(tier.unitPrice);
      }
      tierApplied =
        tier.tierName || `${min}${max === Infinity ? "+" : "–" + max} units`;
      break;
    }
  }
  return { unitPrice, tierApplied };
}

export default function Proposals() {
  const { data, error, setError, reload } = useResource(() =>
      Promise.all([
        api("/proposals"),
        api("/leads"),
        api("/proposals/commercials"),
        api("/proposals/templates"),
        api("/proposals/product-master"),
        api("/proposals/cpq-analytics"),
      ]),
    ),
    [show, setShow] = useState(false),
    [step, setStep] = useState(0),
    [f, setF] = useState<any>({
      title: "Commercial proposal",
      leadId: "",
      commercialId: "product_master",
      currency: currentUser()?.currency || "INR",
      templateId: "",
      items: [],
      answers: {},
      discountPct: 0,
      validUntil: new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .slice(0, 10),
    }),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<any>(null),
    [notice, setNotice] = useState(""),
    [review, setReview] = useState<any>(null),
    [note, setNote] = useState(""),
    [tab, setTab] = useState("all");

  useEffect(() => {
    const lead = new URLSearchParams(location.search).get("lead");
    if (lead) {
      setF((x: any) => ({ ...x, leadId: lead }));
      setShow(true);
    }
  }, []);

  if (!data) return error ? <Notice message={error} /> : <Loading />;
  const [proposals, leads, commercials, templates, productMaster, cpq] = data;

  const isProductMasterMode = f.commercialId === "product_master";
  const c = commercials.find((x: any) => x.id === f.commercialId);
  const t = templates.find((x: any) => x.id === f.templateId);
  const activeCurrency = isProductMasterMode
    ? f.currency || currentUser()?.currency || "INR"
    : c?.currency || currentUser()?.currency || "INR";

  const availableItems = isProductMasterMode
    ? productMaster
        .filter((pm: any) => pm.active)
        .map((pm: any) => ({
          id: pm.id,
          productMasterId: pm.id,
          sku: pm.sku,
          name: pm.name,
          description: pm.description,
          unit: pm.unit,
          base_price: pm.base_price,
          currency_prices: pm.currency_prices,
          pricing_tiers: pm.pricing_tiers,
          tax_pct: pm.tax_pct,
          product_type_name: pm.product_type_name,
          product_category: pm.product_category,
          billing_behavior: pm.billing_behavior,
        }))
    : (c?.items || []).map((item: any) => {
        const linked = productMaster.find(
          (pm: any) => pm.id === item.productMasterId || pm.id === item.id,
        );
        return {
          ...item,
          sku: item.sku || linked?.sku,
          name: item.name || linked?.name || item.description,
          base_price: item.unitPrice,
          currency_prices: linked?.currency_prices || {},
          pricing_tiers: linked?.pricing_tiers || [],
          tax_pct: item.taxPct ?? linked?.tax_pct ?? c?.tax_pct ?? 0,
          product_category:
            item.productCategory ||
            linked?.product_category ||
            "service_milestone",
          billing_behavior:
            item.billingBehavior || linked?.billing_behavior || "one_time",
        };
      });

  const resolvedLineItems = f.items
    .map((sel: any) => {
      const prod = availableItems.find((p: any) => p.id === sel.itemId);
      if (!prod) return null;
      const qty = Number(sel.qty || 1);
      const { unitPrice, tierApplied } = resolveClientItemPrice(
        prod,
        activeCurrency,
        qty,
      );
      const amount = Math.round(unitPrice * qty * 100) / 100;
      return {
        ...prod,
        itemId: prod.id,
        qty,
        unitPrice,
        tierApplied,
        amount,
      };
    })
    .filter(Boolean);

  const subtotal = resolvedLineItems.reduce(
    (sum: number, x: any) => sum + x.amount,
    0,
  );
  const discount = Math.round(subtotal * Number(f.discountPct || 0)) / 100;
  const net = subtotal - discount;
  const netFactor = (100 - Number(f.discountPct || 0)) / 100;
  const tax = isProductMasterMode
    ? Math.round(
        resolvedLineItems.reduce(
          (s: number, x: any) =>
            s + (x.amount * netFactor * Number(x.tax_pct ?? 18)) / 100,
          0,
        ) * 100,
      ) / 100
    : Math.round(net * Number(c?.tax_pct || 0)) / 100;
  const total = net + tax;

  // Live CPQ revenue split preview
  let draftMrr = 0;
  let draftOneTime = 0;
  for (const item of resolvedLineItems) {
    const netAmt = item.amount * netFactor;
    if (
      item.product_category === "recurring" ||
      item.billing_behavior === "monthly" ||
      item.billing_behavior === "annual"
    ) {
      draftMrr +=
        item.billing_behavior === "annual" ? netAmt / 12 : netAmt;
    } else {
      draftOneTime += netAmt;
    }
  }

  async function transition(id: string, status: string) {
    setBusy(true);
    setError("");
    try {
      await api("/proposals/" + id + "/status", {
        method: "PATCH",
        body: JSON.stringify({ status, note }),
      });
      setReview(null);
      setNotice("Proposal " + label(status).toLowerCase());
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function advance(e: any) {
    e.preventDefault();
    setError("");
    if (step === 0) {
      if ((!isProductMasterMode && !c) || !t) {
        setError("Choose a product source and active proposal template");
        return;
      }
      if (!f.items.length && availableItems.length) {
        setF((prev: any) => ({
          ...prev,
          items: availableItems.slice(0, 2).map((x: any) => ({
            itemId: x.id,
            productMasterId: x.productMasterId || x.id,
            qty: 1,
          })),
        }));
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!f.items.length) {
        setError("Select at least one SKU or service line item");
        return;
      }
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      const p = await api("/proposals", {
        method: "POST",
        body: JSON.stringify({
          ...f,
          currency: activeCurrency,
        }),
      });
      setShow(false);
      setNotice(
        p.status === "approval_required"
          ? "Proposal generated with decoupled SKU snapshot and queued for approval."
          : "Proposal draft generated with decoupled SKU snapshot.",
      );
      await reload();
      setPreview(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const filtered = proposals.filter(
    (p: any) => tab === "all" || p.status === tab,
  );

  return (
    <>
      <PageHead
        eyebrow="CPQ · FROM CONVERSATION TO COMMITMENT"
        title="Proposals & Quoting"
        description="Configure quotes from your Product Master with multi-currency tiers, automatic MRR vs One-Time revenue split, and decoupled line-item snapshots."
        actions={
          <div className="row" style={{ gap: 10 }}>
            <Link className="btn ghost" href="/commercials">
              <Package size={14} />
              Product Master & Catalogs
            </Link>
            {can(currentUser(), "proposal.write") && (
              <button
                className="btn"
                onClick={() => {
                  const firstTpl = templates.find((x: any) => x.active);
                  setF((prev: any) => ({
                    ...prev,
                    commercialId: "product_master",
                    templateId: prev.templateId || firstTpl?.id || "",
                  }));
                  setStep(0);
                  setError("");
                  setShow(true);
                }}
              >
                <Plus size={14} />
                Create proposal
              </button>
            )}
          </div>
        }
      />
      <Notice message={error} onClose={() => setError("")} />
      <Notice message={notice} success onClose={() => setNotice("")} />

      {/* CPQ Revenue Split & Product Adoption Summary */}
      {cpq && (
        <div
          className="cards-grid"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            marginBottom: 20,
          }}
        >
          <div className="card" style={{ padding: "14px 18px" }}>
            <div className="row spaced">
              <span className="subtle">Quoted MRR (Recurring)</span>
              <TrendingUp size={15} style={{ color: "#1c7364" }} />
            </div>
            <b style={{ fontSize: 22, display: "block", marginTop: 6 }}>
              {money(cpq.mrr || 0, cpq.currency)}
              <small className="subtle" style={{ fontSize: 12 }}>
                {" "}
                / mo
              </small>
            </b>
            <small className="subtle">
              ARR: {money(cpq.arr || 0, cpq.currency)} · Won MRR:{" "}
              {money(cpq.wonMrr || 0, cpq.currency)}
            </small>
          </div>

          <div className="card" style={{ padding: "14px 18px" }}>
            <div className="row spaced">
              <span className="subtle">Services & Milestones</span>
              <Layers size={15} style={{ color: "#1c7364" }} />
            </div>
            <b style={{ fontSize: 22, display: "block", marginTop: 6 }}>
              {money(cpq.serviceRevenue || 0, cpq.currency)}
            </b>
            <small className="subtle">
              One-time implementation & hourly consulting
            </small>
          </div>

          <div className="card" style={{ padding: "14px 18px" }}>
            <div className="row spaced">
              <span className="subtle">Hardware & Physical Goods</span>
              <Package size={15} style={{ color: "#1c7364" }} />
            </div>
            <b style={{ fontSize: 22, display: "block", marginTop: 6 }}>
              {money(cpq.hardwareRevenue || 0, cpq.currency)}
            </b>
            <small className="subtle">
              Physical appliances & field kits quoted
            </small>
          </div>

          <div className="card" style={{ padding: "14px 18px" }}>
            <div className="row spaced">
              <span className="subtle">Top Adopted SKUs</span>
              <ShieldCheck size={15} style={{ color: "#1c7364" }} />
            </div>
            {cpq.productAdoption?.length ? (
              <div style={{ marginTop: 6 }}>
                {cpq.productAdoption.slice(0, 2).map((sku: any) => (
                  <div
                    key={sku.sku}
                    className="row spaced"
                    style={{ fontSize: 12, padding: "2px 0" }}
                  >
                    <span>
                      <code>{sku.sku}</code> ({sku.totalQty})
                    </span>
                    <b>{money(sku.totalRevenue, cpq.currency)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <small className="subtle" style={{ display: "block", marginTop: 8 }}>
                Generate quotes to track SKU adoption
              </small>
            )}
          </div>
        </div>
      )}

      <div className="tabs">
        {["all", "draft", "approval_required", "sent", "accepted"].map((x) => (
          <button
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {x === "all"
              ? "All proposals"
              : x === "approval_required"
                ? "Awaiting approval"
                : label(x)}
          </button>
        ))}
      </div>
      <div className="card">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Proposal</th>
                <th>Customer</th>
                <th>Revenue Mix (CPQ)</th>
                <th>Total</th>
                <th>Status</th>
                <th>Valid until</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <button
                      className="icon-btn"
                      style={{ textAlign: "left", display: "block" }}
                      onClick={() => setPreview(p)}
                    >
                      <b>{p.title}</b>
                      <small>
                        {date(p.created_at)} ·{" "}
                        {p.creator_name || "Lead2 Engineer"}
                      </small>
                    </button>
                  </td>
                  <td>{p.lead_name}</td>
                  <td>
                    {p.revenueSplit?.mrr > 0 ? (
                      <span style={{ fontSize: 12 }}>
                        <Badge tone="green">
                          MRR {money(p.revenueSplit.mrr, p.currency)}
                        </Badge>
                        {p.revenueSplit.serviceRevenue +
                          p.revenueSplit.hardwareRevenue >
                          0 && (
                          <small
                            className="subtle"
                            style={{ display: "block", marginTop: 2 }}
                          >
                            +{" "}
                            {money(
                              p.revenueSplit.serviceRevenue +
                                p.revenueSplit.hardwareRevenue,
                              p.currency,
                            )}{" "}
                            one-time
                          </small>
                        )}
                      </span>
                    ) : (
                      <Badge tone="blue">One-Time / Milestone</Badge>
                    )}
                  </td>
                  <td>
                    <b>{money(p.total, p.currency)}</b>
                  </td>
                  <td>
                    <Badge tone={p.status}>{label(p.status)}</Badge>
                  </td>
                  <td>{date(p.valid_until)}</td>
                  <td>
                    <div className="row">
                      <button
                        className="btn ghost small"
                        onClick={() => setPreview(p)}
                      >
                        View
                      </button>
                      {p.status === "approval_required" && p.canApprove && (
                        <button
                          className="btn small"
                          onClick={() => {
                            setReview(p);
                            setNote("");
                          }}
                        >
                          Review
                        </button>
                      )}
                      {["draft", "approved"].includes(p.status) &&
                        can(currentUser(), "proposal.write") && (
                          <button
                            className="btn ghost small"
                            disabled={busy}
                            onClick={() => transition(p.id, "sent")}
                          >
                            Mark sent
                          </button>
                        )}
                      {p.status === "sent" &&
                        can(currentUser(), "proposal.write") && (
                          <>
                            <button
                              className="btn ghost small"
                              disabled={busy}
                              onClick={() => transition(p.id, "accepted")}
                            >
                              Mark accepted
                            </button>
                            <button
                              className="btn ghost small"
                              disabled={busy}
                              onClick={() => transition(p.id, "declined")}
                            >
                              Declined
                            </button>
                          </>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty
            title="Your next proposal starts here"
            text="Choose a customer, select SKUs from the Product Master or a Commercial Catalog, answer guided template questions, and generate."
            action={
              can(currentUser(), "proposal.write") && (
                <button className="btn" onClick={() => setShow(true)}>
                  Create proposal
                </button>
              )
            }
          />
        )}
      </div>
      <p className="subtle" style={{ marginTop: 15 }}>
        “Mark sent” records an external handoff. Line items are snapshotted into{" "}
        <code>proposal_line_items</code> at creation so master catalog edits
        never alter historical proposals.
      </p>

      {show && (
        <Modal title="Create a CPQ Proposal" wide onClose={() => setShow(false)}>
          <div className="stepper">
            {[
              "Choose customer & catalog",
              "Configure SKUs & tiers",
              "Review snapshot & generate",
            ].map((x, i) => (
              <div className={"step " + (i === step ? "active" : "")} key={x}>
                <b>{i + 1}</b>
                <span>{x}</span>
              </div>
            ))}
          </div>
          <form className="form" onSubmit={advance}>
            <Notice message={error} />
            {!templates.some((x: any) => x.active) ? (
              <div className="info-box">
                Your Client Super Admin needs to add an active proposal template
                first.{" "}
                {can(currentUser(), "commercial.manage") && (
                  <Link className="text-link" href="/commercials">
                    Set up commercials →
                  </Link>
                )}
              </div>
            ) : (
              <>
                {step === 0 && (
                  <>
                    <Field label="Who is the proposal for?">
                      <select
                        required
                        className="input"
                        value={f.leadId}
                        onChange={(e) => setF({ ...f, leadId: e.target.value })}
                      >
                        <option value="">Select a lead</option>
                        {leads.map((l: any) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                            {l.company ? " · " + l.company : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="form-grid">
                      <Field label="Pricing Source (Product Master or Catalog)">
                        <select
                          required
                          className="input"
                          value={f.commercialId}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "product_master") {
                              setF({
                                ...f,
                                commercialId: "product_master",
                                items: productMaster
                                  .filter((pm: any) => pm.active)
                                  .slice(0, 2)
                                  .map((pm: any) => ({
                                    itemId: pm.id,
                                    productMasterId: pm.id,
                                    qty: 1,
                                  })),
                              });
                            } else {
                              const next = commercials.find(
                                (x: any) => x.id === val,
                              );
                              setF({
                                ...f,
                                commercialId: val,
                                currency: next?.currency || f.currency,
                                items:
                                  next?.items.map((x: any) => ({
                                    itemId: x.id,
                                    qty: 1,
                                  })) || [],
                              });
                            }
                          }}
                        >
                          <option value="product_master">
                            ★ Product Master (CPQ · Multi-Currency & Volume Tiers)
                          </option>
                          {commercials
                            .filter((x: any) => x.active)
                            .map((c: any) => (
                              <option key={c.id} value={c.id}>
                                Commercial Catalog: {c.name} · {c.currency}
                              </option>
                            ))}
                        </select>
                      </Field>

                      <Field label="Quote Currency">
                        <select
                          className="input"
                          disabled={!isProductMasterMode}
                          value={activeCurrency}
                          onChange={(e) =>
                            setF({ ...f, currency: e.target.value })
                          }
                        >
                          {CURRENCIES.map((curr) => (
                            <option key={curr} value={curr}>
                              {curr}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="Which standard format should we use?">
                      <select
                        required
                        className="input"
                        value={f.templateId}
                        onChange={(e) =>
                          setF({
                            ...f,
                            templateId: e.target.value,
                            answers: {},
                          })
                        }
                      >
                        <option value="">Select a template</option>
                        {templates
                          .filter((x: any) => x.active)
                          .map((t: any) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                  </>
                )}
                {step === 1 && (
                  <>
                    <div className="form-grid">
                      <Field label="Proposal title">
                        <input
                          required
                          className="input"
                          value={f.title}
                          onChange={(e) =>
                            setF({ ...f, title: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Valid until">
                        <input
                          required
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          className="input"
                          value={f.validUntil}
                          onChange={(e) =>
                            setF({ ...f, validUntil: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    {t?.questions.map((q: any) => (
                      <Field key={q.key} label={q.label}>
                        <textarea
                          required={q.required}
                          className="input"
                          value={f.answers[q.key] || ""}
                          onChange={(e) =>
                            setF({
                              ...f,
                              answers: {
                                ...f.answers,
                                [q.key]: e.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                    ))}
                    <h3>Configure SKUs, Quantities & Volume Tiers</h3>
                    {availableItems.map((x: any) => {
                      const item = f.items.find((i: any) => i.itemId === x.id);
                      const qty = item ? Number(item.qty || 1) : 1;
                      const { unitPrice, tierApplied } = resolveClientItemPrice(
                        x,
                        activeCurrency,
                        qty,
                      );
                      return (
                        <div
                          key={x.id}
                          className="row spaced"
                          style={{
                            padding: "10px 12px",
                            border: item
                              ? "1px solid #1c7364"
                              : "1px solid #e2ece8",
                            borderRadius: 8,
                            background: item ? "#f6fbf9" : "#fff",
                          }}
                        >
                          <label
                            className="row"
                            style={{ flex: 1, fontSize: 13, gap: 10 }}
                          >
                            <input
                              type="checkbox"
                              checked={!!item}
                              onChange={(e) =>
                                setF({
                                  ...f,
                                  items: e.target.checked
                                    ? [
                                        ...f.items,
                                        {
                                          itemId: x.id,
                                          productMasterId:
                                            x.productMasterId || x.id,
                                          qty: 1,
                                        },
                                      ]
                                    : f.items.filter(
                                        (i: any) => i.itemId !== x.id,
                                      ),
                                })
                              }
                            />
                            <div>
                              <div className="row" style={{ gap: 6 }}>
                                {x.sku && (
                                  <code
                                    style={{
                                      fontSize: 11,
                                      background: "#e7f3ef",
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    {x.sku}
                                  </code>
                                )}
                                <b>{x.name || x.description}</b>
                                <Badge
                                  tone={
                                    x.product_category === "recurring"
                                      ? "green"
                                      : "blue"
                                  }
                                >
                                  {x.billing_behavior === "monthly"
                                    ? "Monthly Recurring"
                                    : x.billing_behavior === "annual"
                                      ? "Annual Recurring"
                                      : x.billing_behavior === "hourly"
                                        ? "Hourly Consulting"
                                        : "One-Time"}
                                </Badge>
                                {tierApplied && (
                                  <Badge tone="amber">Tier: {tierApplied}</Badge>
                                )}
                              </div>
                              <span
                                className="subtle"
                                style={{ display: "block", fontSize: 12 }}
                              >
                                {money(unitPrice, activeCurrency)} / {x.unit} ·{" "}
                                {x.tax_pct ?? 18}% tax
                              </span>
                            </div>
                          </label>
                          {item && (
                            <input
                              aria-label={
                                "Quantity for " + (x.name || x.description)
                              }
                              className="input"
                              style={{ width: 95 }}
                              type="number"
                              required
                              min="0.01"
                              max="100000"
                              step="1"
                              value={item.qty}
                              onChange={(e) =>
                                setF({
                                  ...f,
                                  items: f.items.map((i: any) =>
                                    i.itemId === x.id
                                      ? { ...i, qty: Number(e.target.value) }
                                      : i,
                                  ),
                                })
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                    <Field
                      label="Requested discount (%)"
                      hint={`Your self-authorized limit is ${currentUser()?.authority?.selfDiscountPct || 0}%. Higher discounts require another authorized reviewer.`}
                    >
                      <input
                        required
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        step=".01"
                        value={f.discountPct}
                        onChange={(e) =>
                          setF({ ...f, discountPct: e.target.value })
                        }
                      />
                    </Field>
                  </>
                )}
                {step === 2 && (
                  <>
                    <div className="info-box">
                      <b>{f.title}</b>
                      <p>
                        {leads.find((l: any) => l.id === f.leadId)?.name} ·{" "}
                        {isProductMasterMode
                          ? `Product Master (${activeCurrency})`
                          : c?.name}
                      </p>
                      <p>
                        Template: {t?.name} · Valid until {date(f.validUntil)}
                      </p>
                    </div>
                    <div className="table-scroll">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>SKU & Product</th>
                            <th>Type & Tier</th>
                            <th>Quantity</th>
                            <th>Unit Price</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resolvedLineItems.map((x: any) => (
                            <tr key={x.itemId}>
                              <td>
                                {x.sku && <code>{x.sku} </code>}
                                <b>{x.name || x.description}</b>
                              </td>
                              <td>
                                <small>
                                  {x.billing_behavior}
                                  {x.tierApplied ? ` · ${x.tierApplied}` : ""}
                                </small>
                              </td>
                              <td>{x.qty}</td>
                              <td>{money(x.unitPrice, activeCurrency)}</td>
                              <td>{money(x.amount, activeCurrency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="totals">
                      {draftMrr > 0 && (
                        <div className="stat-line">
                          <span>Net Monthly Recurring (MRR)</span>
                          <b style={{ color: "#1c7364" }}>
                            {money(draftMrr, activeCurrency)} / mo
                          </b>
                        </div>
                      )}
                      {draftOneTime > 0 && (
                        <div className="stat-line">
                          <span>Net One-Time / Milestone Revenue</span>
                          <b>{money(draftOneTime, activeCurrency)}</b>
                        </div>
                      )}
                      <div className="stat-line">
                        <span>Subtotal</span>
                        <b>{money(subtotal, activeCurrency)}</b>
                      </div>
                      <div className="stat-line">
                        <span>Discount ({f.discountPct}%)</span>
                        <b>−{money(discount, activeCurrency)}</b>
                      </div>
                      <div className="stat-line">
                        <span>Tax</span>
                        <b>{money(tax, activeCurrency)}</b>
                      </div>
                      <div className="stat-line">
                        <span>Total estimate</span>
                        <b>{money(total, activeCurrency)}</b>
                      </div>
                    </div>
                    {Number(f.discountPct) >
                      Number(currentUser()?.authority?.selfDiscountPct) && (
                      <div className="info-box">
                        This discount requires approval. The proposal will enter
                        the approval queue and cannot be marked as sent until
                        approved.
                      </div>
                    )}
                    <p className="subtle">
                      Decoupled Snapshot Protection: Generating this proposal
                      copies the SKU, description, tier, unit price, and tax
                      rules into <code>proposal_line_items</code> so future
                      Product Master updates never alter this quote.
                    </p>
                  </>
                )}
                <div className="form-actions">
                  {step > 0 && (
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setStep(step - 1)}
                    >
                      <ArrowLeft size={13} />
                      Back
                    </button>
                  )}
                  <button className="btn" disabled={busy}>
                    {busy
                      ? "Generating…"
                      : step === 2
                        ? "Generate proposal"
                        : "Continue"}
                    <ArrowRight size={13} />
                  </button>
                </div>
              </>
            )}
          </form>
        </Modal>
      )}
      {preview && (
        <Modal title={preview.title} wide onClose={() => setPreview(null)}>
          <div className="row" style={{ marginBottom: 18 }}>
            <button
              className="btn ghost"
              onClick={() =>
                downloadDocument(preview.id, preview.title).catch((e) =>
                  setError(e.message),
                )
              }
            >
              <Download size={13} />
              Download HTML
            </button>
            <a
              className="btn"
              href={`${API}/proposals/${preview.id}/document`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={13} />
              Open / print PDF
            </a>
          </div>
          <p className="subtle" style={{ marginBottom: 13 }}>
            Open the proposal, then use your browser’s Print → Save as PDF
            option.
          </p>
          <iframe
            title="Proposal document preview"
            className="document-frame"
            sandbox="allow-same-origin"
            src={`${API}/proposals/${preview.id}/document`}
          />
        </Modal>
      )}
      {review && (
        <Modal title="Review proposal" onClose={() => setReview(null)}>
          <Notice message={error} />
          <div className="info-box">
            <b>{review.title}</b>
            <p>
              {money(review.total, review.currency)} · {review.discount_pct}%
              discount
            </p>
          </div>
          <div className="form" style={{ marginTop: 20 }}>
            <Field label="Review note">
              <textarea
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <div className="form-actions">
              <button
                disabled={busy}
                className="btn danger"
                onClick={() => transition(review.id, "rejected")}
              >
                Reject proposal
              </button>
              <button
                disabled={busy}
                className="btn"
                onClick={() => transition(review.id, "approved")}
              >
                <Check size={13} />
                Approve proposal
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
