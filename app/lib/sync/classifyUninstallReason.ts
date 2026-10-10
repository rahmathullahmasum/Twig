export type UninstallReasonCategory =
  | "PRICING"
  | "MISSING_FEATURE"
  | "USABILITY"
  | "SWITCHED_COMPETITOR"
  | "EVALUATING"
  | "STORE_CLOSED"
  | "NO_LONGER_NEEDED"
  | "TECHNICAL_ISSUE"
  | "OTHER";

// Confirmed against real production data (see CLAUDE.md): Shopify's own
// uninstall survey gives the merchant a fixed dropdown, and the `reason`
// field comes back as that option's text IN THE MERCHANT'S OWN LOCALE (e.g.
// German, Chinese observed), not a stable language-independent code. These
// English entries are exact matches for the dropdown text; anything in
// another locale currently falls through to the keyword matcher below (which
// mostly won't match) and lands on OTHER. Known gap -- add translations here
// as they're observed, rather than guessing them upfront.
const KNOWN_REASON_PRESETS: Record<string, UninstallReasonCategory> = {
  "too expensive": "PRICING",
  "found a better app": "SWITCHED_COMPETITOR",
  "switched to another app": "SWITCHED_COMPETITOR",
  "app didn't work as expected": "TECHNICAL_ISSUE",
  "missing features i need": "MISSING_FEATURE",
  "not using app now": "NO_LONGER_NEEDED",
  "store is closing or pausing": "STORE_CLOSED",
  "testing multiple apps": "EVALUATING",
  "other (please specify)": "OTHER", // classify by `description` instead, see below

  // Non-English values for the SAME presets above, confirmed by observing
  // real production events (not translated/guessed) -- add more as they
  // turn up instead of trying to pre-translate every locale upfront.
  "app wird derzeit nicht genutzt": "NO_LONGER_NEEDED", // de: "Not using app now"
  "测试多个应用": "EVALUATING", // zh: "Testing multiple apps"
  "test de plusieurs applis": "EVALUATING", // fr: "Testing multiple apps"
  "no me satisfacen las funciones de la app": "MISSING_FEATURE", // es: "App's features don't satisfy me"
};

// English display text for the non-English preset keys above, so the "Actual
// reason given" column can show something readable regardless of the
// merchant's locale. Only covers the fixed dropdown presets (not free-text
// `description`, which isn't translated -- see CLAUDE.md for why). Keyed by
// the same lowercased text as KNOWN_REASON_PRESETS; add an entry here
// whenever a new non-English preset is confirmed there.
const REASON_TRANSLATIONS: Record<string, string> = {
  "app wird derzeit nicht genutzt": "Not using app now", // de
  "测试多个应用": "Testing multiple apps", // zh
  "test de plusieurs applis": "Testing multiple apps", // fr
  "no me satisfacen las funciones de la app": "Missing features I need", // es
};

// Translates a known non-English dropdown reason to English for display.
// Returns the original text unchanged if it's not a recognized preset
// (including if it's already English) -- never guesses a translation.
export function translateReason(reason?: string | null): string | null {
  if (!reason) return reason ?? null;
  return REASON_TRANSLATIONS[reason.trim().toLowerCase()] ?? reason;
}

const KEYWORD_RULES: { category: UninstallReasonCategory; keywords: string[] }[] = [
  { category: "PRICING", keywords: ["price", "expensive", "cost", "afford", "cheap", "money"] },
  { category: "MISSING_FEATURE", keywords: ["feature", "doesn't have", "missing", "wish it had", "needed it to"] },
  { category: "USABILITY", keywords: ["confusing", "hard to use", "complicated", "difficult", "couldn't figure"] },
  {
    category: "SWITCHED_COMPETITOR",
    keywords: ["switched", "another app", "found a better", "different app", "competitor"],
  },
  { category: "TECHNICAL_ISSUE", keywords: ["bug", "broke", "error", "crash", "didn't work", "not working"] },
  { category: "STORE_CLOSED", keywords: ["closed", "closing", "pausing", "stopped selling"] },
  { category: "NO_LONGER_NEEDED", keywords: ["no longer need", "don't need", "not using"] },
];

function matchKeywords(text: string): UninstallReasonCategory | null {
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) return rule.category;
  }
  return null;
}

export function classifyUninstallReason(reason?: string | null, description?: string | null): UninstallReasonCategory {
  const normalizedReason = (reason ?? "").trim().toLowerCase();

  if (normalizedReason in KNOWN_REASON_PRESETS) {
    const preset = KNOWN_REASON_PRESETS[normalizedReason];
    // "Other (please specify)" -- the real signal is in the free-text description.
    if (preset === "OTHER" && description) {
      return matchKeywords(description.toLowerCase()) ?? "OTHER";
    }
    return preset;
  }

  // Unrecognized reason (likely a non-English locale, or free text on an
  // older API version) -- fall back to keyword matching across both fields.
  const combined = `${reason ?? ""} ${description ?? ""}`.trim().toLowerCase();
  if (combined.length === 0) return "OTHER";
  return matchKeywords(combined) ?? "OTHER";
}
