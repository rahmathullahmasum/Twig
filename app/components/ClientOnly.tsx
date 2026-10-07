import { useEffect, useState, type ReactNode } from "react";

/**
 * @shopify/polaris-viz touches `window` directly at render time (no SSR
 * guard), which crashes the server render whenever a chart has enough data
 * to actually render. Charts only ever need to show up client-side anyway,
 * so skip rendering them during SSR and mount on the client instead.
 */
export function ClientOnly({ children, fallback = null }: { children: () => ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children()}</> : <>{fallback}</>;
}
