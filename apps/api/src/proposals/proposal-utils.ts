import { BadRequestException } from "@nestjs/common";
import Decimal from "decimal.js";
import sanitizeHtml from "sanitize-html";
import * as v from "../common/validation";
export const RESERVED = [
  "proposal_title",
  "proposal_number",
  "proposal_date",
  "valid_until",
  "client_name",
  "company_name",
  "seller_name",
  "commercial_table",
  "subtotal",
  "discount",
  "tax",
  "total",
  "terms",
  "currency",
];
export function escapeHtml(value: any) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        x
      ]!,
  );
}
export function sanitizeTemplate(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "br",
      "hr",
      "div",
      "span",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
      "ul",
      "ol",
      "li",
      "blockquote",
    ],
    allowedAttributes: {
      "*": ["style"],
      td: ["colspan", "rowspan", "style"],
      th: ["colspan", "rowspan", "style"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i],
        "text-align": [/^(left|right|center)$/],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
      },
    },
  });
}
export function questions(input: any) {
  if (!Array.isArray(input) || input.length > 12)
    throw new BadRequestException("Use at most 12 template questions");
  const used = new Set<string>();
  return input.map((x: any) => {
    const key = v.str(x.key, "Question key", 30);
    if (
      !/^[a-z][a-z0-9_]*$/.test(key) ||
      RESERVED.includes(key) ||
      used.has(key)
    )
      throw new BadRequestException(
        "Use unique question keys with lowercase letters, numbers and underscores",
      );
    used.add(key);
    return {
      key,
      label: v.str(x.label, "Question label", 160),
      required: x.required !== false,
    };
  });
}
export function validateTemplate(html: string, qs: any[]) {
  if (!html.includes("{{commercial_table}}"))
    throw new BadRequestException(
      "Include {{commercial_table}} where the pricing table should appear",
    );
  const keys = new Set([...RESERVED, ...qs.map((x) => x.key)]);
  for (const m of html.matchAll(/{{\s*([^{}]+?)\s*}}/g))
    if (!keys.has(m[1]))
      throw new BadRequestException(`Unknown placeholder: ${m[1]}`);
  return html;
}

export function resolveProductMasterItemPrice(
  product: any,
  currency: string,
  qty: number,
): { unitPrice: number; tierApplied: string | null } {
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
    const min = Number(tier.minQty ?? tier.min_qty ?? 1);
    const max =
      tier.maxQty === null ||
      tier.maxQty === undefined ||
      tier.maxQty === ""
        ? Infinity
        : Number(tier.maxQty ?? tier.max_qty);
    if (qty >= min && qty <= max) {
      const tierCurrencyPrices =
        tier.currencyPrices && typeof tier.currencyPrices === "object"
          ? tier.currencyPrices
          : {};
      if (
        tierCurrencyPrices[currency] !== undefined &&
        tierCurrencyPrices[currency] !== ""
      ) {
        unitPrice = Number(tierCurrencyPrices[currency]);
      } else if (tier.unitPrice !== undefined) {
        unitPrice = Number(tier.unitPrice);
      }
      tierApplied =
        tier.tierName ||
        tier.name ||
        `${min}${max === Infinity ? "+" : "–" + max} units`;
      break;
    }
  }
  return { unitPrice, tierApplied };
}

export function computeRevenueBreakdown(
  items: any[],
  discountPct: number,
) {
  const netFactor = new Decimal(100 - (discountPct || 0)).div(100);
  let mrr = new Decimal(0);
  let arr = new Decimal(0);
  let recurringTotal = new Decimal(0);
  let serviceRevenue = new Decimal(0);
  let hardwareRevenue = new Decimal(0);

  for (const item of items) {
    const netAmount = new Decimal(item.amount || 0).mul(netFactor);
    const category = String(item.productCategory || "service_milestone").toLowerCase();
    const billing = String(item.billingBehavior || "one_time").toLowerCase();

    if (category === "recurring" || billing === "monthly" || billing === "annual") {
      recurringTotal = recurringTotal.plus(netAmount);
      if (billing === "annual") {
        arr = arr.plus(netAmount);
        mrr = mrr.plus(netAmount.div(12));
      } else {
        mrr = mrr.plus(netAmount);
        arr = arr.plus(netAmount.mul(12));
      }
    } else if (category === "physical_good") {
      hardwareRevenue = hardwareRevenue.plus(netAmount);
    } else {
      serviceRevenue = serviceRevenue.plus(netAmount);
    }
  }

  return {
    mrr: mrr.toDecimalPlaces(2).toNumber(),
    arr: arr.toDecimalPlaces(2).toNumber(),
    recurringTotal: recurringTotal.toDecimalPlaces(2).toNumber(),
    serviceRevenue: serviceRevenue.toDecimalPlaces(2).toNumber(),
    hardwareRevenue: hardwareRevenue.toDecimalPlaces(2).toNumber(),
  };
}

export function calculate(
  catalog: any,
  selected: any,
  discountInput: any,
  productMasterList: any[] = [],
  overrideCurrency?: string,
) {
  if (!Array.isArray(selected) || !selected.length || selected.length > 100)
    throw new BadRequestException("Select 1–100 commercial items");
  const currency = overrideCurrency || catalog?.currency || "INR";
  const seen = new Set<string>();
  const discountPct = v.num(discountInput ?? 0, "Discount", 0, 100);
  const defaultTaxPct = v.num(catalog?.tax_pct ?? 0, "Tax", 0, 100);

  const items = selected.map((x: any) => {
    const lookupId = x.itemId || x.productMasterId;
    if (!lookupId || seen.has(lookupId))
      throw new BadRequestException(
        "Choose unique items from the selected commercial",
      );
    seen.add(lookupId);
    const qty = v.num(x.qty, "Quantity", 0.01, 100000);

    // Check if item comes from commercial catalog or directly from product_master
    const catalogItem = catalog?.items?.find((p: any) => p.id === lookupId);
    const masterItem = productMasterList.find(
      (m: any) => m.id === (x.productMasterId || catalogItem?.productMasterId || lookupId),
    );

    if (!catalogItem && !masterItem)
      throw new BadRequestException(
        "Choose unique items from the selected commercial",
      );

    let unitPrice = 0;
    let tierApplied: string | null = null;
    if (masterItem) {
      const resolved = resolveProductMasterItemPrice(masterItem, currency, qty);
      unitPrice = resolved.unitPrice;
      tierApplied = resolved.tierApplied;
    } else if (catalogItem) {
      const resolved = resolveProductMasterItemPrice(catalogItem, currency, qty);
      unitPrice = resolved.unitPrice;
      tierApplied = resolved.tierApplied;
    }

    const itemTaxPct =
      masterItem?.tax_pct !== undefined && masterItem?.tax_pct !== null
        ? Number(masterItem.tax_pct)
        : catalogItem?.taxPct !== undefined
          ? Number(catalogItem.taxPct)
          : defaultTaxPct;

    const amount = new Decimal(unitPrice).mul(qty).toDecimalPlaces(2);
    const netAmount = amount
      .mul(new Decimal(100 - discountPct))
      .div(100)
      .toDecimalPlaces(2);
    const itemTaxAmount = netAmount
      .mul(itemTaxPct)
      .div(100)
      .toDecimalPlaces(2);

    const sku =
      masterItem?.sku ||
      catalogItem?.sku ||
      `SKU-${String(lookupId).slice(0, 6).toUpperCase()}`;
    const name =
      masterItem?.name ||
      catalogItem?.name ||
      catalogItem?.description ||
      "Product / Service";
    const description =
      masterItem?.description ||
      catalogItem?.description ||
      name;
    const productTypeCode =
      masterItem?.product_type_code ||
      catalogItem?.productTypeCode ||
      "service_milestone";
    const productCategory =
      masterItem?.product_category ||
      catalogItem?.productCategory ||
      (productTypeCode.includes("recurring")
        ? "recurring"
        : productTypeCode.includes("physical")
          ? "physical_good"
          : "service_milestone");
    const billingBehavior =
      masterItem?.billing_behavior ||
      catalogItem?.billingBehavior ||
      "one_time";

    return {
      itemId: catalogItem?.id || masterItem?.id,
      productMasterId: masterItem?.id || catalogItem?.productMasterId || null,
      sku,
      name,
      description,
      productTypeCode,
      productCategory,
      billingBehavior,
      tierApplied,
      unit: masterItem?.unit || catalogItem?.unit || "unit",
      qty,
      unitPrice: Number(unitPrice),
      taxPct: itemTaxPct,
      taxAmount: itemTaxAmount.toNumber(),
      amount: amount.toNumber(),
    };
  });

  const subtotal = items
    .reduce((s: Decimal, x: any) => s.plus(x.amount), new Decimal(0))
    .toDecimalPlaces(2);
  const discount = subtotal.mul(discountPct).div(100).toDecimalPlaces(2);
  const net = subtotal.minus(discount);

  // Use catalog tax_pct if > 0 or sum per-item tax
  const hasPerItemTax = items.some((x: any) => Number(x.taxPct) > 0);
  const tax =
    defaultTaxPct > 0
      ? net.mul(defaultTaxPct).div(100).toDecimalPlaces(2)
      : hasPerItemTax
        ? items
            .reduce((s: Decimal, x: any) => s.plus(x.taxAmount || 0), new Decimal(0))
            .toDecimalPlaces(2)
        : new Decimal(0);

  const effectiveTaxPct =
    defaultTaxPct > 0
      ? defaultTaxPct
      : net.gt(0)
        ? tax.mul(100).div(net).toDecimalPlaces(2).toNumber()
        : 0;

  const total = net.plus(tax);
  v.num(total.toNumber(), "Proposal total", 0, 999999999999);
  const revenueSplit = computeRevenueBreakdown(items, discountPct);

  return {
    items,
    subtotal: subtotal.toNumber(),
    discount: discount.toNumber(),
    discountPct,
    tax: tax.toNumber(),
    taxPct: effectiveTaxPct,
    total: total.toNumber(),
    revenueSplit,
  };
}
export function renderProposal(p: any, workspace: string) {
  const s = p.snapshot || {},
    money = (x: any) =>
      `${escapeHtml(p.currency)} ${Number(x || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const billingLabel = (b: string) => {
    switch (b) {
      case "monthly":
        return "Recurring · Monthly";
      case "annual":
        return "Recurring · Annual";
      case "hourly":
        return "Hourly Consulting";
      case "milestone":
        return "Service · Milestone";
      default:
        return "One-Time";
    }
  };
  const rev =
    s.calculation?.revenueSplit ||
    computeRevenueBreakdown(p.items || [], Number(p.discount_pct || 0));
  const revSummary =
    rev && (rev.mrr > 0 || rev.serviceRevenue > 0 || rev.hardwareRevenue > 0)
      ? `<div style="margin:18px 0;padding:12px 16px;background:#f4f9f7;border:1px solid #d8e5df;border-radius:8px;font-size:12px;display:flex;gap:24px;flex-wrap:wrap">
          ${rev.mrr > 0 ? `<div><strong>Monthly Recurring (MRR):</strong> ${money(rev.mrr)}/mo <span style="color:#677674">(ARR: ${money(rev.arr)}/yr)</span></div>` : ""}
          ${rev.serviceRevenue > 0 ? `<div><strong>Services / Implementation:</strong> ${money(rev.serviceRevenue)}</div>` : ""}
          ${rev.hardwareRevenue > 0 ? `<div><strong>Hardware / Physical Goods:</strong> ${money(rev.hardwareRevenue)}</div>` : ""}
        </div>`
      : "";
  const table = `<table><thead><tr><th>SKU / Product & Service</th><th>Type & Billing</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${p.items
    .map(
      (i: any) =>
        `<tr><td>${i.sku ? `<code style="font-size:11px;background:#edf5f2;padding:2px 6px;border-radius:4px">${escapeHtml(i.sku)}</code> ` : ""}<strong>${escapeHtml(i.name || i.description)}</strong>${i.name && i.description && i.name !== i.description ? `<br><small>${escapeHtml(i.description)}</small>` : ""}<br><small style="color:#677674">Unit: ${escapeHtml(i.unit || "unit")}${i.tierApplied ? ` · Tier: ${escapeHtml(i.tierApplied)}` : ""}</small></td><td><small>${escapeHtml(billingLabel(i.billingBehavior))}</small></td><td>${escapeHtml(i.qty)}</td><td>${money(i.unitPrice)}</td><td>${money(i.amount ?? i.qty * i.unitPrice)}</td></tr>`,
    )
    .join("")}</tbody></table>${revSummary}<div class="totals"><p>Subtotal <b>${money(p.subtotal)}</b></p><p>Discount (${escapeHtml(p.discount_pct)}%) <b>− ${money(s.calculation?.discount)}</b></p><p>Tax (${escapeHtml(p.tax_pct)}%) <b>${money(s.calculation?.tax)}</b></p><p class="total">Total <b>${money(p.total)}</b></p></div>`;
  const values: any = {
    proposal_title: p.title,
    proposal_number: "L2-" + p.id.slice(0, 8).toUpperCase(),
    proposal_date: new Date(p.created_at).toISOString().slice(0, 10),
    valid_until: p.valid_until
      ? new Date(p.valid_until).toISOString().slice(0, 10)
      : "—",
    client_name: s.lead?.name || p.lead_name,
    company_name: s.lead?.company || "",
    seller_name: s.sellerName || workspace,
    subtotal: money(p.subtotal),
    discount: money(s.calculation?.discount),
    tax: money(s.calculation?.tax),
    total: money(p.total),
    terms: p.terms,
    currency: p.currency,
    ...s.answers,
  };
  const html = (
    s.template?.body_html ||
    "<h1>{{proposal_title}}</h1>{{commercial_table}}<p>{{terms}}</p>"
  ).replace(/{{\s*([^{}]+?)\s*}}/g, (_: string, key: string) =>
    key === "commercial_table"
      ? table
      : escapeHtml(values[key] || "").replace(/\n/g, "<br>"),
  );
  const banner = ["draft", "approval_required", "rejected"].includes(p.status)
    ? `<div class="draft">${p.status === "approval_required" ? "Pending approval · Not authorized for sending" : p.status === "rejected" ? "Rejected · Not authorized for sending" : "Draft · For review"}</div>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(p.title)}</title><style>body{font-family:Arial,sans-serif;color:#173c3b;max-width:850px;margin:48px auto;padding:0 32px;font-size:14px;line-height:1.7}header{display:flex;justify-content:space-between;border-bottom:2px solid #1c7364;padding-bottom:20px;margin-bottom:32px}h1{font-size:32px;line-height:1.2}h2{font-size:18px;margin-top:30px}table{width:100%;border-collapse:collapse;margin:24px 0}th{text-align:left;background:#edf5f2}td,th{padding:12px;border-bottom:1px solid #d8e5df;vertical-align:top}.totals{margin-left:auto;max-width:330px}.totals p{display:flex;justify-content:space-between}.total{border-top:2px solid #1c7364;font-size:20px;padding-top:14px}.draft{padding:10px;background:#fff2da;color:#835d16;margin:16px 0}footer{border-top:1px solid #ddd;margin-top:40px;padding-top:15px;font-size:11px;color:#677674}tr{break-inside:avoid}@page{size:A4;margin:18mm}@media print{body{margin:0;padding:0;max-width:none}h2{break-after:avoid}}</style></head><body><header><strong>${escapeHtml(s.sellerName || workspace)}</strong><span>Powered by Lead2 CRM</span></header>${banner}${html}<footer>Proposal ${escapeHtml(values.proposal_number)} · ${escapeHtml(p.currency)} · Decoupled Product Master & template snapshot preserved at generation.</footer></body></html>`;
}
