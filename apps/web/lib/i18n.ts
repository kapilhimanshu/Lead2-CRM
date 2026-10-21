"use client";
import { useEffect, useState } from "react";

export type LanguageCode =
  | "en"
  | "fr"
  | "de"
  | "id"
  | "ms"
  | "ja"
  | "zh"
  | "he"
  | "ar"
  | "es";

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  rtl?: boolean;
  compliance: string;
  currency: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English (Default / India)", nativeName: "English", flag: "🇮🇳/🇬🇧", compliance: "DPDP Act 2023 · SOC 2 · GDPR", currency: "INR" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", compliance: "EU GDPR · PSD2 SCA", currency: "EUR" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", compliance: "EU GDPR · BDSG · ISO 27001", currency: "EUR" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩", compliance: "UU PDP (Law No. 27/2022)", currency: "IDR" },
  { code: "ms", name: "Malaysian", nativeName: "Bahasa Melayu", flag: "🇲🇾", compliance: "PDPA 2010 · BNM RMiT", currency: "MYR" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", compliance: "APPI · FISC Guidelines", currency: "JPY" },
  { code: "zh", name: "Chinese", nativeName: "中文 (简体)", flag: "🇨🇳", compliance: "PIPL · DSL · MLPS 2.0", currency: "CNY" },
  { code: "he", name: "Hebrew (Habiru)", nativeName: "עברית", flag: "🇮🇱", rtl: true, compliance: "PPL · Data Security Regs 2017", currency: "ILS" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", rtl: true, compliance: "UAE/KSA PDPL · SAMA CSF", currency: "AED" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", compliance: "EU GDPR · LOPDGDD", currency: "EUR" },
];

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en: {
    overview: "Overview",
    leads: "Leads",
    pipeline: "Pipeline",
    tasks: "Tasks",
    proposals: "Proposals",
    team_access: "Team & access",
    commercials: "Commercials",
    workspace_settings: "Workspace settings",
    account: "Account",
    sign_out: "Sign out",
    search_placeholder: "Search leads or companies…",
    send_email: "Send email",
    draft_email: "Draft & Send Email",
    manage_seats: "Manage Seats & Billing",
    conversion_rate: "Conversion Rate",
    pipeline_value: "Pipeline Value",
    deal_size: "Average Deal Size",
    sales_velocity: "Sales Velocity",
    top_rep: "Top Rep",
    acquisition_channel: "Top Channel",
    export_pdf: "Export PDF",
    export_excel: "Export Excel",
    export_ppt: "Export PPT",
    email_report: "Email Report",
    unallocated_prompt: "leads are open and not allocated yet.",
    allocate_now: "Allocate Now",
    seats_licensed: "Licensed Seats",
    active_users: "Active Reps",
    upscale_seats: "Upscale / Add Seats",
    pay_with: "Pay With",
    annual_save: "Pay annually & save 33%",
  },
  fr: {
    overview: "Aperçu",
    leads: "Prospects",
    pipeline: "Pipeline",
    tasks: "Tâches",
    proposals: "Devis",
    team_access: "Équipe & accès",
    commercials: "Catalogue",
    workspace_settings: "Paramètres",
    account: "Compte",
    sign_out: "Déconnexion",
    search_placeholder: "Rechercher prospects ou entreprises…",
    send_email: "Envoyer un e-mail",
    draft_email: "Rédiger & Envoyer",
    manage_seats: "Gérer sièges & facturation",
    conversion_rate: "Taux de conversion",
    pipeline_value: "Valeur du pipeline",
    deal_size: "Taille moyenne",
    sales_velocity: "Vélocité des ventes",
    top_rep: "Meilleur commercial",
    acquisition_channel: "Canal principal",
    export_pdf: "Exporter PDF",
    export_excel: "Exporter Excel",
    export_ppt: "Exporter PPT",
    email_report: "Envoyer par e-mail",
    unallocated_prompt: "prospects sont ouverts et non attribués.",
    allocate_now: "Attribuer maintenant",
    seats_licensed: "Licences actives",
    active_users: "Utilisateurs actifs",
    upscale_seats: "Ajouter des sièges",
    pay_with: "Payer avec",
    annual_save: "Paiement annuel - économisez 33%",
  },
  de: {
    overview: "Übersicht",
    leads: "Leads",
    pipeline: "Pipeline",
    tasks: "Aufgaben",
    proposals: "Angebote",
    team_access: "Team & Zugriff",
    commercials: "Katalog",
    workspace_settings: "Einstellungen",
    account: "Konto",
    sign_out: "Abmelden",
    search_placeholder: "Leads oder Firmen suchen…",
    send_email: "E-Mail senden",
    draft_email: "E-Mail verfassen",
    manage_seats: "Lizenzen & Abrechnung",
    conversion_rate: "Konversionsrate",
    pipeline_value: "Pipeline-Wert",
    deal_size: "Durchschnittliche Dealgröße",
    sales_velocity: "Vertriebsgeschwindigkeit",
    top_rep: "Bester Vertriebler",
    acquisition_channel: "Top-Kanal",
    export_pdf: "PDF exportieren",
    export_excel: "Excel exportieren",
    export_ppt: "PPT exportieren",
    email_report: "Bericht senden",
    unallocated_prompt: "Leads sind offen und nicht zugewiesen.",
    allocate_now: "Jetzt zuweisen",
    seats_licensed: "Lizenzierte Plätze",
    active_users: "Aktive Benutzer",
    upscale_seats: "Plätze erweitern",
    pay_with: "Bezahlen mit",
    annual_save: "Jährlich zahlen & 33% sparen",
  },
  id: {
    overview: "Ringkasan",
    leads: "Prospek (Leads)",
    pipeline: "Saluran Penjualan",
    tasks: "Tugas",
    proposals: "Proposal",
    team_access: "Tim & Akses",
    commercials: "Katalog",
    workspace_settings: "Pengaturan",
    account: "Akun",
    sign_out: "Keluar",
    search_placeholder: "Cari prospek atau perusahaan…",
    send_email: "Kirim Email",
    draft_email: "Tulis & Kirim Email",
    manage_seats: "Kelola Lisensi & Tagihan",
    conversion_rate: "Tingkat Konversi",
    pipeline_value: "Nilai Saluran",
    deal_size: "Ukuran Rata-rata Kesepakatan",
    sales_velocity: "Kecepatan Penjualan",
    top_rep: "Sales Terbaik",
    acquisition_channel: "Saluran Utama",
    export_pdf: "Unduh PDF",
    export_excel: "Unduh Excel",
    export_ppt: "Unduh PPT",
    email_report: "Kirim Laporan Email",
    unallocated_prompt: "prospek terbuka dan belum dialokasikan.",
    allocate_now: "Alokasikan Sekarang",
    seats_licensed: "Lisensi Kursi",
    active_users: "Pengguna Aktif",
    upscale_seats: "Tambah Kursi",
    pay_with: "Bayar Dengan",
    annual_save: "Bayar tahunan hemat 33%",
  },
  ms: {
    overview: "Gambaran Keseluruhan",
    leads: "Prospek",
    pipeline: "Saluran Jualan",
    tasks: "Tugasan",
    proposals: "Cadangan",
    team_access: "Pasukan & Akses",
    commercials: "Katalog",
    workspace_settings: "Tetapan",
    account: "Akaun",
    sign_out: "Log Keluar",
    search_placeholder: "Cari prospek atau syarikat…",
    send_email: "Hantar E-mel",
    draft_email: "Draf & Hantar E-mel",
    manage_seats: "Urus Tempat Duduk & Bil",
    conversion_rate: "Kadar Penukaran",
    pipeline_value: "Nilai Saluran",
    deal_size: "Purata Saiz Tawaran",
    sales_velocity: "Kelajuan Jualan",
    top_rep: "Wakil Jualan Terbaik",
    acquisition_channel: "Saluran Utama",
    export_pdf: "Eksport PDF",
    export_excel: "Eksport Excel",
    export_ppt: "Eksport PPT",
    email_report: "E-melkan Laporan",
    unallocated_prompt: "prospek dibuka dan belum diperuntukkan.",
    allocate_now: "Peruntukkan Sekarang",
    seats_licensed: "Tempat Duduk Berlesen",
    active_users: "Pengguna Aktif",
    upscale_seats: "Tambah Tempat Duduk",
    pay_with: "Bayar Dengan",
    annual_save: "Bayar tahunan jimat 33%",
  },
  ja: {
    overview: "概要",
    leads: "リード",
    pipeline: "パイプライン",
    tasks: "タスク",
    proposals: "提案書",
    team_access: "チームとアクセス",
    commercials: "カタログ",
    workspace_settings: "ワークスペース設定",
    account: "アカウント",
    sign_out: "サインアウト",
    search_placeholder: "リードや企業を検索…",
    send_email: "メール送信",
    draft_email: "メール作成と送信",
    manage_seats: "シートと請求管理",
    conversion_rate: "成約率",
    pipeline_value: "パイプライン総額",
    deal_size: "平均案件規模",
    sales_velocity: "営業サイクル速度",
    top_rep: "トップ営業担当",
    acquisition_channel: "主要チャネル",
    export_pdf: "PDF出力",
    export_excel: "Excel出力",
    export_ppt: "PPT出力",
    email_report: "レポートをメール送信",
    unallocated_prompt: "件の未割り当てリードがあります。",
    allocate_now: "今すぐ割り当てる",
    seats_licensed: "契約シート数",
    active_users: "利用中の担当者",
    upscale_seats: "シートを追加",
    pay_with: "支払方法",
    annual_save: "年払いで33%お得",
  },
  zh: {
    overview: "概览",
    leads: "线索 (Leads)",
    pipeline: "销售漏斗",
    tasks: "任务",
    proposals: "报价方案",
    team_access: "团队与权限",
    commercials: "产品名录",
    workspace_settings: "工作区设置",
    account: "个人账户",
    sign_out: "退出登录",
    search_placeholder: "搜索客户或企业…",
    send_email: "发送邮件",
    draft_email: "起草并发送邮件",
    manage_seats: "席位与订阅管理",
    conversion_rate: "转化率",
    pipeline_value: "商机总金额",
    deal_size: "平均客单价",
    sales_velocity: "销售周期速度",
    top_rep: "金牌销售",
    acquisition_channel: "主要获客渠道",
    export_pdf: "导出 PDF",
    export_excel: "导出 Excel",
    export_ppt: "导出 PPT",
    email_report: "邮件发送报告",
    unallocated_prompt: "条线索未分配销售代表。",
    allocate_now: "立即分配",
    seats_licensed: "已购席位数",
    active_users: "活跃成员数",
    upscale_seats: "增加席位",
    pay_with: "支付方式",
    annual_save: "按年支付立省 33%",
  },
  he: {
    overview: "סקירה כללית",
    leads: "לידים",
    pipeline: "צינור מכירות",
    tasks: "משימות",
    proposals: "הצעות מחיר",
    team_access: "צוות והרשאות",
    commercials: "מחירון",
    workspace_settings: "הגדרות",
    account: "חשבון",
    sign_out: "התנתק",
    search_placeholder: "חיפוש לידים או חברות…",
    send_email: "שלח דוא״ל",
    draft_email: "ניסוח ושליחת דוא״ל",
    manage_seats: "ניהול רישיונות ותשלום",
    conversion_rate: "אחוז המרה",
    pipeline_value: "שווי הצינור",
    deal_size: "גודל עסקה ממוצע",
    sales_velocity: "מהירות מכירה",
    top_rep: "נציג מוביל",
    acquisition_channel: "ערוץ מוביל",
    export_pdf: "ייצוא PDF",
    export_excel: "ייצוא Excel",
    export_ppt: "ייצוא PPT",
    email_report: "שליחת דוח בדוא״ל",
    unallocated_prompt: "לידים פתוחים טרם הוקצו.",
    allocate_now: "הקצה כעת",
    seats_licensed: "מקומות ברישיון",
    active_users: "משתמשים פעילים",
    upscale_seats: "הוסף רישיונות",
    pay_with: "תשלום באמצעות",
    annual_save: "תשלום שנתי - 33% הנחה",
  },
  ar: {
    overview: "نظرة عامة",
    leads: "العملاء المحتملون",
    pipeline: "مسار المبيعات",
    tasks: "المهام",
    proposals: "العروض",
    team_access: "الفريق والصلاحيات",
    commercials: "قائمة الأسعار",
    workspace_settings: "إعدادات مساحة العمل",
    account: "الحساب",
    sign_out: "تسجيل الخروج",
    search_placeholder: "البحث عن عملاء أو شركات…",
    send_email: "إرسال بريد إلكتروني",
    draft_email: "صياغة وإرسال بريد",
    manage_seats: "إدارة المقاعد والاشتراك",
    conversion_rate: "معدل التحويل",
    pipeline_value: "قيمة الصفقات",
    deal_size: "متوسط حجم الصفقة",
    sales_velocity: "سرعة المبيعات",
    top_rep: "أفضل ممثل مبيعات",
    acquisition_channel: "أهم قناة استقطاب",
    export_pdf: "تصدير PDF",
    export_excel: "تصدير Excel",
    export_ppt: "تصدير PPT",
    email_report: "إرسال التقرير بالبريد",
    unallocated_prompt: "عملاء محتملون غير مخصصين بعد.",
    allocate_now: "تخصيص الآن",
    seats_licensed: "المقاعد المرخصة",
    active_users: "المستخدمون النشطون",
    upscale_seats: "ترقية / إضافة مقاعد",
    pay_with: "الدفع بواسطة",
    annual_save: "الدفع سنوياً ووفر 33%",
  },
  es: {
    overview: "Resumen",
    leads: "Prospectos",
    pipeline: "Pipeline",
    tasks: "Tareas",
    proposals: "Propuestas",
    team_access: "Equipo y acceso",
    commercials: "Catálogo",
    workspace_settings: "Configuración",
    account: "Cuenta",
    sign_out: "Cerrar sesión",
    search_placeholder: "Buscar prospectos o empresas…",
    send_email: "Enviar correo",
    draft_email: "Redactar y enviar correo",
    manage_seats: "Gestionar asientos y facturación",
    conversion_rate: "Tasa de conversión",
    pipeline_value: "Valor del pipeline",
    deal_size: "Tamaño promedio de acuerdo",
    sales_velocity: "Velocidad de ventas",
    top_rep: "Mejor representante",
    acquisition_channel: "Canal principal",
    export_pdf: "Exportar PDF",
    export_excel: "Exportar Excel",
    export_ppt: "Exportar PPT",
    email_report: "Enviar reporte por correo",
    unallocated_prompt: "prospectos abiertos aún no están asignados.",
    allocate_now: "Asignar ahora",
    seats_licensed: "Asientos licenciados",
    active_users: "Usuarios activos",
    upscale_seats: "Añadir asientos",
    pay_with: "Pagar con",
    annual_save: "Pago anual: ahorre 33%",
  },
};

export function getStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("lead2_lang") as LanguageCode;
  if (stored && TRANSLATIONS[stored]) {
    const opt = LANGUAGES.find((l) => l.code === stored);
    if (opt?.rtl) document.documentElement.setAttribute("dir", "rtl");
    else document.documentElement.setAttribute("dir", "ltr");
    return stored;
  }

  // Auto-detect based on login location / browser locale (India is always English)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const navLang = (navigator.language || "en").toLowerCase();
    if (
      tz.includes("Kolkata") ||
      tz.includes("Calcutta") ||
      navLang.endsWith("-in")
    ) {
      return "en";
    }
    const prefix = navLang.split("-")[0];
    if (prefix === "iw") return "he";
    if (prefix in TRANSLATIONS) return prefix as LanguageCode;
  } catch {
    // Fallback to English
  }
  return "en";
}

export function setStoredLanguage(lang: LanguageCode) {
  if (typeof window === "undefined") return;
  localStorage.setItem("lead2_lang", lang);
  const opt = LANGUAGES.find((l) => l.code === lang);
  if (opt?.rtl) {
    document.documentElement.setAttribute("dir", "rtl");
  } else {
    document.documentElement.setAttribute("dir", "ltr");
  }
  window.dispatchEvent(new Event("lead2_lang_change"));
}

export function useTranslation() {
  const [lang, setLang] = useState<LanguageCode>("en");

  useEffect(() => {
    setLang(getStoredLanguage());
    const onLangChange = () => setLang(getStoredLanguage());
    window.addEventListener("lead2_lang_change", onLangChange);
    return () => window.removeEventListener("lead2_lang_change", onLangChange);
  }, []);

  const t = (key: string, fallback?: string): string => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS["en"];
    return dict[key] || TRANSLATIONS["en"][key] || fallback || key;
  };

  return { lang, setLanguage: setStoredLanguage, t, languages: LANGUAGES };
}
