import { Badge } from "@shopify/polaris";
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

const TONES: Record<UninstallReasonCategory, "critical" | "warning" | "info" | "success"> = {
  PRICING: "warning",
  MISSING_FEATURE: "warning",
  USABILITY: "warning",
  SWITCHED_COMPETITOR: "critical",
  EVALUATING: "info",
  STORE_CLOSED: "info",
  NO_LONGER_NEEDED: "info",
  TECHNICAL_ISSUE: "critical",
  OTHER: "info",
};

export function ReasonBadge({ category }: { category: string | null }) {
  const key = (category ?? "OTHER") as UninstallReasonCategory;
  return <Badge tone={TONES[key] ?? "info"}>{LABELS[key] ?? key}</Badge>;
}
