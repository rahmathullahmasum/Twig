import { Badge, type BadgeTone } from "./ui";
import type { UninstallReasonCategory } from "../lib/sync/classifyUninstallReason";

const LABELS: Record<UninstallReasonCategory, string> = {
  PRICING: "Pricing",
  MISSING_FEATURE: "Missing feature",
  USABILITY: "Usability",
  SWITCHED_COMPETITOR: "Switched to competitor",
  EVALUATING: "Evaluating options",
  STORE_CLOSED: "Store closed/paused",
  NO_LONGER_NEEDED: "No longer needed",
  TECHNICAL_ISSUE: "Technical issue",
  OTHER: "Unspecified",
};

const TONES: Record<UninstallReasonCategory, BadgeTone> = {
  PRICING: "warning",
  MISSING_FEATURE: "brand",
  USABILITY: "teal",
  SWITCHED_COMPETITOR: "purple",
  EVALUATING: "neutral",
  STORE_CLOSED: "neutral",
  NO_LONGER_NEEDED: "success",
  TECHNICAL_ISSUE: "critical",
  OTHER: "neutral",
};

// Hex equivalents of the tones above, for the proportional bar fills on the
// "Why shops uninstalled" chart (badges use the softer bg/text pair instead).
const COLORS: Record<UninstallReasonCategory, string> = {
  PRICING: "#D9831F",
  MISSING_FEATURE: "#3E5BD6",
  USABILITY: "#0F9D86",
  SWITCHED_COMPETITOR: "#8B4FC9",
  EVALUATING: "#9A9AA6",
  STORE_CLOSED: "#9A9AA6",
  NO_LONGER_NEEDED: "#1F9D60",
  TECHNICAL_ISSUE: "#D2483B",
  OTHER: "#9A9AA6",
};

function normalize(category: string | null): UninstallReasonCategory {
  return (category ?? "OTHER") as UninstallReasonCategory;
}

export function reasonLabel(category: string | null): string {
  const key = normalize(category);
  return LABELS[key] ?? key;
}

export function reasonColor(category: string | null): string {
  return COLORS[normalize(category)] ?? COLORS.OTHER;
}

export function ReasonBadge({ category }: { category: string | null }) {
  const key = normalize(category);
  return <Badge tone={TONES[key] ?? "neutral"}>{LABELS[key] ?? key}</Badge>;
}
