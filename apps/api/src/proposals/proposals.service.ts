import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import * as mammoth from "mammoth";
import { validateDocxArchive } from "./docx-validation";
import { DbService } from "../db/db.service";
import {
  requirePermission,
  visibleUserIds,
  requireVisibleLead,
  hasPermission,
  tenantUserId,
} from "../common/permissions";
import * as v from "../common/validation";
import {
  calculate,
  computeRevenueBreakdown,
  escapeHtml,
  questions,
  sanitizeTemplate,
  validateTemplate,
  renderProposal,
} from "./proposal-utils";
import { MailService } from "../mail/mail.service";
import { WebhooksService } from "../webhooks/webhooks.service";

const DEFAULT_PRODUCT_TYPES = [
  {
    code: "recurring_saas",
    name: "SaaS Subscription (Monthly)",
    category: "recurring",
    billing_frequency: "monthly",
    description:
      "Recurring monthly cloud subscription counted toward MRR & ARR.",
  },
  {
    code: "recurring_annual",
    name: "Annual Software License",
    category: "recurring",
    billing_frequency: "annual",
    description:
      "Annual recurring license contract counted toward ARR and normalized MRR.",
  },
  {
    code: "service_milestone",
    name: "Service / Milestone (Implementation)",
    category: "service_milestone",
    billing_frequency: "one_time",
    description:
      "Fixed-scope onboarding, data migration, or milestone-based delivery.",
  },
  {
    code: "hourly_consulting",
    name: "Hourly Consulting & Advisory",
    category: "service_milestone",
    billing_frequency: "hourly",
    description:
      "Time-and-materials engineering, training, or custom solution consulting.",
  },
  {
    code: "physical_good",
    name: "Physical / Good (Hardware & Equipment)",
    category: "physical_good",
    billing_frequency: "one_time",
    description:
      "Physical hardware, POS terminals, IoT sensors, or on-premise appliances.",
  },
];

@Injectable()
export class ProposalsService {
  constructor(
    private db: DbService,
    private mail: MailService,
    private webhooks: WebhooksService,
  ) {}

  private async ensureDefaultProductMaster(
    q: any,
    tenantId: string,
    currency = "INR",
  ) {
    const existingTypes = (
      await q.query(
        "SELECT * FROM product_types WHERE tenant_id=$1 ORDER BY is_default DESC, name",
        [tenantId],
      )
    ).rows;

    const typeMap = new Map<string, any>();
    for (const t of existingTypes) typeMap.set(t.code, t);

    if (existingTypes.length === 0) {
      for (const dt of DEFAULT_PRODUCT_TYPES) {
        const ins = await q.query(
          `INSERT INTO product_types(tenant_id,code,name,category,billing_frequency,description,is_default,active)
           VALUES($1,$2,$3,$4,$5,$6,true,true)
           ON CONFLICT (tenant_id,code) DO UPDATE SET updated_at=now()
           RETURNING *`,
          [
            tenantId,
            dt.code,
            dt.name,
            dt.category,
            dt.billing_frequency,
            dt.description,
          ],
        );
        if (ins.rows[0]) typeMap.set(dt.code, ins.rows[0]);
      }
    }

    const existingProducts = (
      await q.query(
        "SELECT count(*)::int AS c FROM product_master WHERE tenant_id=$1",
        [tenantId],
      )
    ).rows[0]?.c;

    if (!existingProducts) {
      const starterProducts = [
        {
          sku: "L2-SAAS-PRO",
          name: "Lead2 Revenue Cloud · Pro Seat",
          description:
            "Full-featured CRM, CPQ automation, pipeline governance, and multi-currency analytics per user.",
          code: "recurring_saas",
          unit: "seat / month",
          base_currency: currency || "INR",
          base_price: currency === "USD" ? 29 : 2499,
          tax_pct: 18,
          billing_behavior: "monthly",
          currency_prices: { INR: 2499, USD: 29, EUR: 27, GBP: 23, AED: 109, SGD: 39 },
          pricing_tiers: [
            {
              tierName: "Starter (1–10 seats)",
              minQty: 1,
              maxQty: 10,
              unitPrice: currency === "USD" ? 29 : 2499,
              currencyPrices: { INR: 2499, USD: 29, EUR: 27, GBP: 23 },
            },
            {
              tierName: "Growth (11–50 seats)",
              minQty: 11,
              maxQty: 50,
              unitPrice: currency === "USD" ? 24 : 1999,
              currencyPrices: { INR: 1999, USD: 24, EUR: 22, GBP: 19 },
            },
            {
              tierName: "Enterprise (51+ seats)",
              minQty: 51,
              maxQty: null,
              unitPrice: currency === "USD" ? 19 : 1499,
              currencyPrices: { INR: 1499, USD: 19, EUR: 18, GBP: 15 },
            },
          ],
        },
        {
          sku: "L2-SAAS-ANN",
          name: "Lead2 Enterprise Annual Suite",
          description:
            "Annual committed subscription with dedicated SSO, audit vault, and priority SLA.",
          code: "recurring_annual",
          unit: "seat / year",
          base_currency: currency || "INR",
          base_price: currency === "USD" ? 290 : 24990,
          tax_pct: 18,
          billing_behavior: "annual",
          currency_prices: { INR: 24990, USD: 290, EUR: 270, GBP: 230, AED: 1090, SGD: 390 },
          pricing_tiers: [
            {
              tierName: "Standard (1–25 seats)",
              minQty: 1,
              maxQty: 25,
              unitPrice: currency === "USD" ? 290 : 24990,
              currencyPrices: { INR: 24990, USD: 290, EUR: 270, GBP: 230 },
            },
            {
              tierName: "Volume (26+ seats)",
              minQty: 26,
              maxQty: null,
              unitPrice: currency === "USD" ? 230 : 19990,
              currencyPrices: { INR: 19990, USD: 230, EUR: 215, GBP: 185 },
            },
          ],
        },
        {
          sku: "L2-SVC-IMP",
          name: "Turnkey CRM Onboarding & Data Migration",
          description:
            "One-time implementation milestone: legacy CRM schema mapping, deduplication, and team training.",
          code: "service_milestone",
          unit: "milestone",
          base_currency: currency || "INR",
          base_price: currency === "USD" ? 550 : 45000,
          tax_pct: 18,
          billing_behavior: "one_time",
          currency_prices: { INR: 45000, USD: 550, EUR: 510, GBP: 440, AED: 2000, SGD: 740 },
          pricing_tiers: [],
        },
        {
          sku: "L2-SVC-CNS",
          name: "Solution Architecture & Custom Workflow Consulting",
          description:
            "Senior CRM architect advisory for custom ERP/webhook integrations and territory design.",
          code: "hourly_consulting",
          unit: "hour",
          base_currency: currency || "INR",
          base_price: currency === "USD" ? 65 : 4999,
          tax_pct: 18,
          billing_behavior: "hourly",
          currency_prices: { INR: 4999, USD: 65, EUR: 60, GBP: 52, AED: 240, SGD: 88 },
          pricing_tiers: [
            {
              tierName: "Standard Block (1–20 hrs)",
              minQty: 1,
              maxQty: 20,
              unitPrice: currency === "USD" ? 65 : 4999,
              currencyPrices: { INR: 4999, USD: 65, EUR: 60, GBP: 52 },
            },
            {
              tierName: "Retainer Block (21+ hrs)",
              minQty: 21,
              maxQty: null,
              unitPrice: currency === "USD" ? 52 : 3999,
              currencyPrices: { INR: 3999, USD: 52, EUR: 48, GBP: 42 },
            },
          ],
        },
        {
          sku: "L2-HW-KIT",
          name: "Smart Field Check-In & Badge Scanner Terminal",
          description:
            "Rugged NFC/QR lead capture hardware appliance for trade shows and field sales offices.",
          code: "physical_good",
          unit: "device",
          base_currency: currency || "INR",
          base_price: currency === "USD" ? 220 : 18500,
          tax_pct: 18,
          billing_behavior: "one_time",
          currency_prices: { INR: 18500, USD: 220, EUR: 205, GBP: 175, AED: 810, SGD: 295 },
          pricing_tiers: [
            {
              tierName: "Single Unit (1–5 devices)",
              minQty: 1,
              maxQty: 5,
              unitPrice: currency === "USD" ? 220 : 18500,
              currencyPrices: { INR: 18500, USD: 220, EUR: 205, GBP: 175 },
            },
            {
              tierName: "Fleet Pack (6+ devices)",
              minQty: 6,
              maxQty: null,
              unitPrice: currency === "USD" ? 190 : 15900,
              currencyPrices: { INR: 15900, USD: 190, EUR: 175, GBP: 150 },
            },
          ],
        },
      ];

      for (const sp of starterProducts) {
        const pt = typeMap.get(sp.code);
        await q.query(
          `INSERT INTO product_master(tenant_id,product_type_id,product_type_code,sku,name,description,unit,base_currency,base_price,tax_pct,billing_behavior,currency_prices,pricing_tiers,active)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)
           ON CONFLICT (tenant_id,sku) DO NOTHING`,
          [
            tenantId,
            pt?.id || null,
            sp.code,
            sp.sku,
            sp.name,
            sp.description,
            sp.unit,
            sp.base_currency,
            sp.base_price,
            sp.tax_pct,
            sp.billing_behavior,
            JSON.stringify(sp.currency_prices),
            JSON.stringify(sp.pricing_tiers),
          ],
        );
      }
    }
  }

  async productTypes(u: any) {
    requirePermission(u, "lead.read");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      await this.ensureDefaultProductMaster(q, u.tenantId, u.currency);
      return (
        await q.query(
          "SELECT * FROM product_types WHERE tenant_id=$1 ORDER BY active DESC, is_default DESC, name",
          [u.tenantId],
        )
      ).rows;
    });
  }

  async saveProductType(u: any, b: any, id?: string) {
    requirePermission(u, "commercial.manage");
    const name = v.str(b.name, "Product type name", 120);
    const rawCode =
      b.code ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 48);
    const code = v.str(rawCode, "Product type code", 64);
    const category = ["recurring", "service_milestone", "physical_good", "custom"].includes(
      b.category,
    )
      ? b.category
      : "service_milestone";
    const billingFrequency = [
      "monthly",
      "quarterly",
      "annual",
      "one_time",
      "hourly",
      "milestone",
    ].includes(b.billingFrequency || b.billing_frequency)
      ? b.billingFrequency || b.billing_frequency
      : "one_time";
    const description = v.str(b.description || "", "Description", 500, false);
    const active = b.active !== false;

    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const r = id
        ? await q.query(
            `UPDATE product_types
             SET name=$2, category=$3, billing_frequency=$4, description=$5, active=$6, updated_at=now()
             WHERE tenant_id=$1 AND id=$7 RETURNING *`,
            [u.tenantId, name, category, billingFrequency, description, active, v.uuid(id)],
          )
        : await q.query(
            `INSERT INTO product_types(tenant_id,code,name,category,billing_frequency,description,is_default,active)
             VALUES($1,$2,$3,$4,$5,$6,false,$7)
             ON CONFLICT (tenant_id,code) DO UPDATE
               SET name=EXCLUDED.name, category=EXCLUDED.category, billing_frequency=EXCLUDED.billing_frequency, description=EXCLUDED.description, active=EXCLUDED.active, updated_at=now()
             RETURNING *`,
            [u.tenantId, code, name, category, billingFrequency, description, active],
          );
      if (!r.rows[0]) throw new NotFoundException();
      await this.db.audit(
        q,
        u.tenantId,
        u.sub,
        "product_type.saved",
        "product_type",
        r.rows[0].id,
        { code: r.rows[0].code, category },
      );
      return r.rows[0];
    });
  }

  async productMaster(u: any) {
    requirePermission(u, "lead.read");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      await this.ensureDefaultProductMaster(q, u.tenantId, u.currency);
      return (
        await q.query(
          `SELECT pm.*, pt.name AS product_type_name, pt.category AS product_category
           FROM product_master pm
           LEFT JOIN product_types pt ON pt.id = pm.product_type_id
           WHERE pm.tenant_id=$1
           ORDER BY pm.active DESC, pm.sku ASC`,
          [u.tenantId],
        )
      ).rows;
    });
  }

  async saveProductMaster(u: any, b: any, id?: string) {
    requirePermission(u, "commercial.manage");
    const sku = v
      .str(b.sku, "SKU", 64)
      .toUpperCase()
      .replace(/\s+/g, "-");
    const name = v.str(b.name, "Product name", 160);
    const description = v.str(b.description || name, "Description", 2000);
    const unit = v.str(b.unit || "unit", "Unit", 40);
    const baseCurrency = v.currency(b.baseCurrency || b.base_currency || u.currency || "INR");
    const basePrice = v.num(b.basePrice ?? b.base_price ?? 0, "Base price", 0, 9999999999);
    const taxPct = v.num(b.taxPct ?? b.tax_pct ?? 0, "Tax %", 0, 100);
    const billingBehavior = [
      "monthly",
      "quarterly",
      "annual",
      "one_time",
      "hourly",
      "milestone",
    ].includes(b.billingBehavior || b.billing_behavior)
      ? b.billingBehavior || b.billing_behavior
      : "one_time";

    const rawCurrencyPrices =
      b.currencyPrices || b.currency_prices || {};
    const currencyPrices: Record<string, number> = {};
    if (rawCurrencyPrices && typeof rawCurrencyPrices === "object") {
      for (const [curr, val] of Object.entries(rawCurrencyPrices)) {
        if (val !== "" && val !== null && val !== undefined && !isNaN(Number(val))) {
          currencyPrices[curr.toUpperCase()] = v.num(
            val,
            `${curr} price`,
            0,
            9999999999,
          );
        }
      }
    }
    currencyPrices[baseCurrency] = basePrice;

    const rawTiers = Array.isArray(b.pricingTiers || b.pricing_tiers)
      ? b.pricingTiers || b.pricing_tiers
      : [];
    const pricingTiers = rawTiers.slice(0, 20).map((t: any, idx: number) => ({
      tierName: v.str(
        t.tierName || t.name || `Tier ${idx + 1}`,
        "Tier name",
        80,
      ),
      minQty: v.num(t.minQty ?? 1, "Tier min qty", 0.01, 1000000),
      maxQty:
        t.maxQty === null || t.maxQty === undefined || t.maxQty === ""
          ? null
          : v.num(t.maxQty, "Tier max qty", 0.01, 1000000),
      unitPrice: v.num(t.unitPrice ?? basePrice, "Tier unit price", 0, 9999999999),
      currencyPrices:
        t.currencyPrices && typeof t.currencyPrices === "object"
          ? t.currencyPrices
          : {},
    }));

    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      await this.ensureDefaultProductMaster(q, u.tenantId, u.currency);
      let productTypeId = b.productTypeId || b.product_type_id || null;
      let productTypeCode =
        b.productTypeCode || b.product_type_code || "service_milestone";

      if (productTypeId) {
        const pt = (
          await q.query(
            "SELECT * FROM product_types WHERE tenant_id=$1 AND id=$2",
            [u.tenantId, v.uuid(productTypeId, "Product Type ID")],
          )
        ).rows[0];
        if (pt) {
          productTypeId = pt.id;
          productTypeCode = pt.code;
        }
      } else {
        const pt = (
          await q.query(
            "SELECT * FROM product_types WHERE tenant_id=$1 AND code=$2",
            [u.tenantId, productTypeCode],
          )
        ).rows[0];
        if (pt) {
          productTypeId = pt.id;
          productTypeCode = pt.code;
        }
      }

      const active = b.active !== false;
      const r = id
        ? await q.query(
            `UPDATE product_master
             SET product_type_id=$2, product_type_code=$3, sku=$4, name=$5, description=$6, unit=$7,
                 base_currency=$8, base_price=$9, tax_pct=$10, billing_behavior=$11,
                 currency_prices=$12, pricing_tiers=$13, active=$14, version=version+1, updated_at=now()
             WHERE tenant_id=$1 AND id=$15 RETURNING *`,
            [
              u.tenantId,
              productTypeId,
              productTypeCode,
              sku,
              name,
              description,
              unit,
              baseCurrency,
              basePrice,
              taxPct,
              billingBehavior,
              JSON.stringify(currencyPrices),
              JSON.stringify(pricingTiers),
              active,
              v.uuid(id),
            ],
          )
        : await q.query(
            `INSERT INTO product_master(tenant_id,product_type_id,product_type_code,sku,name,description,unit,base_currency,base_price,tax_pct,billing_behavior,currency_prices,pricing_tiers,active)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             RETURNING *`,
            [
              u.tenantId,
              productTypeId,
              productTypeCode,
              sku,
              name,
              description,
              unit,
              baseCurrency,
              basePrice,
              taxPct,
              billingBehavior,
              JSON.stringify(currencyPrices),
              JSON.stringify(pricingTiers),
              active,
            ],
          );
      if (!r.rows[0]) throw new NotFoundException();
      await this.db.audit(
        q,
        u.tenantId,
        u.sub,
        "product_master.saved",
        "product_master",
        r.rows[0].id,
        { sku: r.rows[0].sku, version: r.rows[0].version },
      );
      return r.rows[0];
    });
  }

  async cpqAnalytics(u: any) {
    requirePermission(u, "lead.read");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      await this.ensureDefaultProductMaster(q, u.tenantId, u.currency);
      const ids = await visibleUserIds(q, u);
      const proposals = (
        await q.query(
          `SELECT p.id, p.title, p.currency, p.subtotal, p.discount_pct, p.tax_pct, p.total, p.status, p.items, p.snapshot, p.created_at
           FROM proposals p
           JOIN leads l ON l.id = p.lead_id
           WHERE p.tenant_id=$1 AND ($2::uuid[] IS NULL OR l.owner_id=ANY($2))
           ORDER BY p.created_at DESC LIMIT 500`,
          [u.tenantId, ids],
        )
      ).rows;

      let quotedMrr = 0;
      let quotedArr = 0;
      let wonMrr = 0;
      let serviceRevenue = 0;
      let hardwareRevenue = 0;
      let totalQuotedRevenue = 0;

      const skuMap = new Map<
        string,
        {
          sku: string;
          name: string;
          category: string;
          billingBehavior: string;
          proposalCount: number;
          totalQty: number;
          totalRevenue: number;
        }
      >();

      for (const p of proposals) {
        if (p.status === "rejected" || p.status === "declined") continue;
        totalQuotedRevenue += Number(p.total || 0);
        const items = Array.isArray(p.items) ? p.items : [];
        const split =
          p.snapshot?.calculation?.revenueSplit ||
          computeRevenueBreakdown(items, Number(p.discount_pct || 0));

        quotedMrr += Number(split.mrr || 0);
        quotedArr += Number(split.arr || 0);
        serviceRevenue += Number(split.serviceRevenue || 0);
        hardwareRevenue += Number(split.hardwareRevenue || 0);
        if (p.status === "accepted") {
          wonMrr += Number(split.mrr || 0);
        }

        const netFactor = (100 - Number(p.discount_pct || 0)) / 100;
        for (const item of items) {
          const skuKey = item.sku || item.name || item.description || "CUSTOM";
          const cur = skuMap.get(skuKey) || {
            sku: item.sku || "CUSTOM",
            name: item.name || item.description || "Custom Item",
            category: item.productCategory || "service_milestone",
            billingBehavior: item.billingBehavior || "one_time",
            proposalCount: 0,
            totalQty: 0,
            totalRevenue: 0,
          };
          cur.proposalCount += 1;
          cur.totalQty += Number(item.qty || 0);
          cur.totalRevenue += Number(item.amount || 0) * netFactor;
          skuMap.set(skuKey, cur);
        }
      }

      const productAdoption = Array.from(skuMap.values())
        .map((x) => ({
          ...x,
          totalQty: Math.round(x.totalQty * 100) / 100,
          totalRevenue: Math.round(x.totalRevenue * 100) / 100,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

      return {
        currency: u.currency || "INR",
        mrr: Math.round(quotedMrr * 100) / 100,
        arr: Math.round(quotedArr * 100) / 100,
        wonMrr: Math.round(wonMrr * 100) / 100,
        serviceRevenue: Math.round(serviceRevenue * 100) / 100,
        hardwareRevenue: Math.round(hardwareRevenue * 100) / 100,
        totalQuotedRevenue: Math.round(totalQuotedRevenue * 100) / 100,
        productAdoption,
      };
    });
  }

  async catalogs(u: any) {
    requirePermission(u, "lead.read");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      await this.ensureDefaultProductMaster(q, u.tenantId, u.currency);
      return (
        await q.query(
          "SELECT * FROM commercial_catalogs WHERE tenant_id=$1 ORDER BY active DESC,name",
          [u.tenantId],
        )
      ).rows;
    });
  }

  async saveCatalog(u: any, b: any, id?: string) {
    requirePermission(u, "commercial.manage");
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 100)
      throw new BadRequestException(
        "A commercial needs 1–100 products or services",
      );
    const items = b.items.map((x: any) => ({
      id: x.id ? v.uuid(x.id, "Item ID") : randomUUID(),
      productMasterId: x.productMasterId || null,
      sku: x.sku ? v.str(x.sku, "SKU", 64) : undefined,
      name: x.name ? v.str(x.name, "Product name", 160) : undefined,
      productTypeCode: x.productTypeCode || undefined,
      productCategory: x.productCategory || undefined,
      billingBehavior: x.billingBehavior || "one_time",
      description: v.str(x.description, "Description", 1000),
      unit: v.str(x.unit || "unit", "Unit", 40),
      unitPrice: v.num(x.unitPrice, "Unit price", 0, 9999999999),
      taxPct: x.taxPct !== undefined ? v.num(x.taxPct, "Item tax", 0, 100) : undefined,
    }));
    if (new Set(items.map((x: any) => x.id)).size !== items.length)
      throw new BadRequestException("Item IDs must be unique");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const args = [
        u.tenantId,
        v.str(b.name, "Commercial name", 120),
        v.currency(b.currency),
        v.num(b.taxPct ?? 0, "Tax", 0, 100),
        JSON.stringify(items),
        v.str(b.terms || "", "Terms", 12000, false),
        b.active !== false,
      ];
      const r = id
        ? await q.query(
            "UPDATE commercial_catalogs SET name=$2,currency=$3,tax_pct=$4,items=$5,terms=$6,active=$7,version=version+1,updated_at=now() WHERE tenant_id=$1 AND id=$8 RETURNING *",
            [...args, v.uuid(id)],
          )
        : await q.query(
            "INSERT INTO commercial_catalogs(tenant_id,name,currency,tax_pct,items,terms,active) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
            args,
          );
      if (!r.rows[0]) throw new NotFoundException();
      await this.db.audit(
        q,
        u.tenantId,
        u.sub,
        "commercial.saved",
        "commercial",
        r.rows[0].id,
        { version: r.rows[0].version },
      );
      return r.rows[0];
    });
  }

  async templates(u: any) {
    requirePermission(u, "lead.read");
    return this.db.tenant(
      u.tenantId,
      u.sub,
      async (q) =>
        (
          await q.query(
            "SELECT * FROM proposal_templates WHERE tenant_id=$1 ORDER BY active DESC,name",
            [u.tenantId],
          )
        ).rows,
    );
  }

  async saveTemplate(u: any, b: any, id?: string) {
    requirePermission(u, "template.manage");
    let html = b.bodyHtml,
      filename: string | null = null;
    if (b.fileBase64) {
      filename = v.str(b.filename, "Filename", 160);
      if (
        typeof b.fileBase64 !== "string" ||
        b.fileBase64.length > 2800000 ||
        !/^[a-zA-Z0-9+/=\r\n]+$/.test(b.fileBase64)
      )
        throw new BadRequestException("Upload a file smaller than 2 MB");
      const buf = Buffer.from(b.fileBase64, "base64");
      if (buf.length > 2 * 1024 * 1024)
        throw new BadRequestException("File is too large");
      if (/\.docx$/i.test(filename)) {
        try {
          validateDocxArchive(buf);
          const out = await mammoth.convertToHtml({ buffer: buf }, {
            externalFileAccess: false,
          } as any);
          html = out.value;
        } catch {
          throw new BadRequestException(
            "Use a valid DOCX under 2 MB (10 MB expanded). Password-protected files are unsupported.",
          );
        }
      } else if (/\.(html?|txt|md)$/i.test(filename)) {
        const text = buf.toString("utf8");
        html = /\.html?$/i.test(filename)
          ? text
          : text
              .split(/\n\s*\n/)
              .map((p) => "<p>" + escapeHtml(p).replace(/\n/g, "<br>") + "</p>")
              .join("");
      } else
        throw new BadRequestException("Upload DOCX, HTML, TXT, or Markdown");
    }
    const qs = questions(b.questions || []),
      body = validateTemplate(
        sanitizeTemplate(v.str(html, "Template content", 150000)),
        qs,
      );
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const args = [
        u.tenantId,
        v.str(b.name, "Template name", 120),
        body,
        JSON.stringify(qs),
        filename,
        b.active !== false,
      ];
      const r = id
        ? await q.query(
            "UPDATE proposal_templates SET name=$2,body_html=$3,questions=$4,source_filename=coalesce($5,source_filename),active=$6,version=version+1,updated_at=now() WHERE tenant_id=$1 AND id=$7 RETURNING *",
            [...args, v.uuid(id)],
          )
        : await q.query(
            "INSERT INTO proposal_templates(tenant_id,name,body_html,questions,source_filename,active) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
            args,
          );
      if (!r.rows[0]) throw new NotFoundException();
      await this.db.audit(
        q,
        u.tenantId,
        u.sub,
        "template.saved",
        "template",
        r.rows[0].id,
        { version: r.rows[0].version },
      );
      return r.rows[0];
    });
  }

  private allowed(u: any, p: any) {
    return (
      hasPermission(u, "proposal.approve") &&
      (u.platformAdmin || p.created_by !== u.sub) &&
      Number(p.discount_pct) <= u.authority.approveDiscountPct &&
      Number(p.total) <= u.authority.approveTotal
    );
  }

  async list(u: any) {
    requirePermission(u, "lead.read");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const ids = await visibleUserIds(q, u);
      return (
        await q.query(
          "SELECT p.id,p.title,p.currency,p.total,p.discount_pct,p.status,p.created_by,p.approval_required,p.created_at,p.lead_id,p.valid_until,p.items,p.snapshot,l.name lead_name,u.name creator_name FROM proposals p JOIN leads l ON l.id=p.lead_id LEFT JOIN users u ON u.id=p.created_by WHERE p.tenant_id=$1 AND ($2::uuid[] IS NULL OR l.owner_id=ANY($2)) ORDER BY p.created_at DESC LIMIT 500",
          [u.tenantId, ids],
        )
      ).rows.map((p) => ({
        ...p,
        canApprove: this.allowed(u, p),
        revenueSplit:
          p.snapshot?.calculation?.revenueSplit ||
          computeRevenueBreakdown(p.items || [], Number(p.discount_pct || 0)),
      }));
    });
  }

  async one(u: any, id: string) {
    requirePermission(u, "lead.read");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const p = (
        await q.query(
          "SELECT p.*,l.name lead_name FROM proposals p JOIN leads l ON l.id=p.lead_id WHERE p.tenant_id=$1 AND p.id=$2",
          [u.tenantId, v.uuid(id)],
        )
      ).rows[0];
      if (!p) throw new NotFoundException();
      await requireVisibleLead(q, u, p.lead_id);
      const lineItems = (
        await q.query(
          "SELECT * FROM proposal_line_items WHERE tenant_id=$1 AND proposal_id=$2 ORDER BY created_at ASC",
          [u.tenantId, p.id],
        )
      ).rows;
      return { ...p, lineItems };
    });
  }

  async create(u: any, b: any) {
    requirePermission(u, "proposal.write");
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      await this.ensureDefaultProductMaster(q, u.tenantId, u.currency);
      const lead = await requireVisibleLead(q, u, v.uuid(b.leadId, "Lead"));
      const productMasterRows = (
        await q.query(
          `SELECT pm.*, pt.name AS product_type_name, pt.category AS product_category
           FROM product_master pm
           LEFT JOIN product_types pt ON pt.id = pm.product_type_id
           WHERE pm.tenant_id=$1 AND pm.active=true`,
          [u.tenantId],
        )
      ).rows;

      let c: any = null;
      if (b.commercialId && b.commercialId !== "product_master") {
        c = (
          await q.query(
            "SELECT * FROM commercial_catalogs WHERE tenant_id=$1 AND id=$2 AND active FOR SHARE",
            [u.tenantId, v.uuid(b.commercialId, "Commercial")],
          )
        ).rows[0];
      } else {
        // Ensure a master commercial catalog anchor exists for FK integrity when quoting directly from Product Master
        c = (
          await q.query(
            "SELECT * FROM commercial_catalogs WHERE tenant_id=$1 AND active ORDER BY created_at ASC LIMIT 1 FOR SHARE",
            [u.tenantId],
          )
        ).rows[0];
        if (!c && productMasterRows.length) {
          c = (
            await q.query(
              `INSERT INTO commercial_catalogs(tenant_id,name,currency,tax_pct,items,terms,active)
               VALUES($1,'Product Master Standard Price Book',$2,18,$3,'Standard payment within 30 days of invoice.',true)
               RETURNING *`,
              [
                u.tenantId,
                v.currency(b.currency || u.currency || "INR"),
                JSON.stringify(
                  productMasterRows.map((pm: any) => ({
                    id: pm.id,
                    productMasterId: pm.id,
                    sku: pm.sku,
                    name: pm.name,
                    description: pm.description,
                    unit: pm.unit,
                    unitPrice: Number(pm.base_price),
                  })),
                ),
              ],
            )
          ).rows[0];
        }
      }

      const template = (
        await q.query(
          "SELECT * FROM proposal_templates WHERE tenant_id=$1 AND id=$2 AND active FOR SHARE",
          [u.tenantId, v.uuid(b.templateId, "Template")],
        )
      ).rows[0];

      if (!c || !template)
        throw new BadRequestException(
          "Select an active commercial/product master and template",
        );

      const chosenCurrency = b.currency
        ? v.currency(b.currency)
        : c.currency || u.currency || "INR";

      const answers: any = {};
      for (const question of template.questions) {
        answers[question.key] = v.str(
          b.answers?.[question.key] || "",
          question.label,
          4000,
          question.required,
        );
      }

      const catalogForCalc =
        b.commercialId === "product_master"
          ? { ...c, tax_pct: b.taxPct !== undefined ? b.taxPct : 0, currency: chosenCurrency }
          : c;

      const total = calculate(
          catalogForCalc,
          b.items,
          b.discountPct,
          productMasterRows,
          chosenCurrency,
        ),
        requires = total.discountPct > u.authority.selfDiscountPct;

      const validity = v.date(b.validUntil, "Valid until", false)!;
      if (validity.slice(0, 10) < new Date().toISOString().slice(0, 10))
        throw new BadRequestException("Choose a future proposal validity date");

      const snapshot = {
        template: {
          id: template.id,
          name: template.name,
          version: template.version,
          body_html: template.body_html,
        },
        commercial: {
          id: c.id,
          name:
            b.commercialId === "product_master"
              ? "Product Master (CPQ)"
              : c.name,
          version: c.version,
          mode:
            b.commercialId === "product_master" ? "product_master" : "catalog",
        },
        answers,
        lead: { name: lead.name, company: lead.company },
        sellerName: u.tenantName,
        calculation: total,
        decoupledAt: new Date().toISOString(),
      };

      const p = (
        await q.query(
          `INSERT INTO proposals(tenant_id,lead_id,created_by,owner_id,title,currency,items,subtotal,discount_pct,tax_pct,total,terms,status,approval_required,template_id,commercial_id,snapshot,valid_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
          [
            u.tenantId,
            lead.id,
            tenantUserId(u),
            lead.owner_id,
            v.str(b.title || "Commercial proposal", "Title", 180),
            chosenCurrency,
            JSON.stringify(total.items),
            total.subtotal,
            total.discountPct,
            total.taxPct,
            total.total,
            b.terms ? v.str(b.terms, "Terms", 12000, false) : c.terms,
            requires ? "approval_required" : "draft",
            requires,
            template.id,
            c.id,
            JSON.stringify(snapshot),
            validity,
          ],
        )
      ).rows[0];

      // Persist decoupled snapshot rows into proposal_line_items
      for (const item of total.items) {
        await q.query(
          `INSERT INTO proposal_line_items(
             tenant_id, proposal_id, product_master_id, sku, name, description,
             product_type_code, product_category, billing_behavior, unit,
             qty, unit_price, tier_applied, currency, discount_pct, tax_pct, tax_amount, amount, metadata
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
          [
            u.tenantId,
            p.id,
            item.productMasterId || null,
            item.sku || "SKU-CUSTOM",
            item.name || item.description,
            item.description,
            item.productTypeCode || "service_milestone",
            item.productCategory || "service_milestone",
            item.billingBehavior || "one_time",
            item.unit || "unit",
            item.qty,
            item.unitPrice,
            item.tierApplied || null,
            chosenCurrency,
            total.discountPct,
            item.taxPct ?? total.taxPct,
            item.taxAmount ?? 0,
            item.amount,
            JSON.stringify({ snapshotPreserved: true }),
          ],
        );
      }

      await this.db.audit(
        q,
        u.tenantId,
        u.sub,
        "proposal.generated",
        "proposal",
        p.id,
        {
          commercialVersion: c.version,
          templateVersion: template.version,
          approvalRequired: requires,
          revenueSplit: total.revenueSplit,
        },
        u.ip,
      );
      return p;
    });
  }

  async status(u: any, id: string, b: any) {
    return this.db.tenant(u.tenantId, u.sub, async (q) => {
      const p = (
        await q.query(
          "SELECT * FROM proposals WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
          [u.tenantId, v.uuid(id)],
        )
      ).rows[0];
      if (!p) throw new NotFoundException();
      await requireVisibleLead(q, u, p.lead_id);
      const next = b.status;
      if (["approved", "rejected"].includes(next)) {
        requirePermission(u, "proposal.approve");
        if (p.status !== "approval_required")
          throw new ConflictException("Only pending proposals can be reviewed");
        if (!u.platformAdmin && p.created_by === u.sub)
          throw new ForbiddenException(
            "A different authorized person must review your proposal",
          );
        if (next === "approved" && !this.allowed(u, p))
          throw new ForbiddenException(
            "This proposal exceeds your approval authority",
          );
      } else {
        requirePermission(u, "proposal.write");
        if (next === "sent") {
          if (
            !(
              (p.status === "draft" && !p.approval_required) ||
              p.status === "approved"
            )
          )
            throw new ConflictException(
              "This proposal must be approved before sending",
            );
          if (
            p.valid_until &&
            new Date(p.valid_until).toISOString().slice(0, 10) <
              new Date().toISOString().slice(0, 10)
          )
            throw new ConflictException(
              "This proposal has expired. Generate a new one.",
            );
        } else if (["accepted", "declined"].includes(next)) {
          if (p.status !== "sent")
            throw new ConflictException(
              "Only sent proposals can be marked accepted or declined",
            );
        } else throw new BadRequestException("Invalid proposal transition");
      }
      const r = await q.query(
        `UPDATE proposals SET status=$3,approved_by=CASE WHEN $3='approved' THEN $4 ELSE approved_by END,approved_at=CASE WHEN $3='approved' THEN now() ELSE approved_at END,approval_note=CASE WHEN $3 IN ('approved','rejected') THEN $5 ELSE approval_note END,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *`,
        [
          u.tenantId,
          id,
          next,
          tenantUserId(u),
          v.str(b.note || "", "Review note", 2000, false),
        ],
      );
      if (next === "approved" || next === "rejected") {
        const owner = (
          await q.query(
            "SELECT u.name,u.email FROM users u JOIN proposals p ON p.owner_id=u.id WHERE p.id=$1",
            [id],
          )
        ).rows[0];
        if (owner?.email) {
          this.mail
            .sendProposalDecision(
              owner.email,
              owner.name,
              p.title,
              next === "approved",
              b.note,
            )
            .catch(() => null);
        }
      } else if (next === "approval_required") {
        const approvers = (
          await q.query(
            "SELECT u.name,u.email FROM users u JOIN roles r ON r.id=u.role_id WHERE u.tenant_id=$1 AND u.active AND r.permissions::text LIKE '%proposal.approve%'",
            [u.tenantId],
          )
        ).rows;
        for (const approver of approvers) {
          if (approver.email)
            this.mail
              .sendProposalApprovalRequest(
                approver.email,
                approver.name,
                u.name,
                p.title,
                id,
              )
              .catch(() => null);
        }
      }
      this.webhooks
        .dispatch(u.tenantId, `proposal.${next}`, {
          proposalId: id,
          title: p.title,
          status: next,
        })
        .catch(() => null);
      await this.db.audit(
        q,
        u.tenantId,
        u.sub,
        "proposal." + next,
        "proposal",
        id,
        { note: b.note || "" },
        u.ip,
      );
      return r.rows[0];
    });
  }

  async document(u: any, id: string) {
    const p = await this.one(u, id);
    await this.db.tenant(u.tenantId, u.sub, (q) =>
      this.db.audit(
        q,
        u.tenantId,
        u.sub,
        "proposal.exported",
        "proposal",
        id,
        {},
        u.ip,
      ),
    );
    return renderProposal(p, u.tenantName);
  }
}
