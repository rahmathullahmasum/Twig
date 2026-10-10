import { useLocation, useNavigate, useSearchParams } from "react-router";
import { SegmentedControl } from "./ui";

const OPTIONS = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
];

export function RangeFilter() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const current = searchParams.get("range") ?? "30";

  return (
    <SegmentedControl
      ariaLabel="Date range"
      options={OPTIONS}
      value={current}
      onChange={(value) => {
        const next = new URLSearchParams(searchParams);
        next.set("range", value);
        navigate(`${location.pathname}?${next.toString()}`);
      }}
    />
  );
}
