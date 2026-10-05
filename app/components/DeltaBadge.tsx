import { Badge } from "@shopify/polaris";

export function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    if (current === 0) return <Badge tone="info">Flat</Badge>;
    return <Badge tone="success">New</Badge>;
  }

  const deltaPct = Math.round(((current - previous) / previous) * 100);
  if (deltaPct === 0) return <Badge tone="info">Flat</Badge>;

  return (
    <Badge tone={deltaPct > 0 ? "success" : "critical"}>
      {`${deltaPct > 0 ? "↑" : "↓"} ${Math.abs(deltaPct)}%`}
    </Badge>
  );
}
