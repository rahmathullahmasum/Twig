import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ButtonGroup, Button } from "@shopify/polaris";

const OPTIONS: { label: string; value: string }[] = [
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
    <ButtonGroup variant="segmented">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          pressed={current === option.value}
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.set("range", option.value);
            navigate(`${location.pathname}?${next.toString()}`);
          }}
        >
          {option.label}
        </Button>
      ))}
    </ButtonGroup>
  );
}
