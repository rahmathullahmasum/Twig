import { useState } from "react";
import { TextField } from "@shopify/polaris";

interface PasswordFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  helpText?: string;
}

export function PasswordField({ label, name, value, onChange, autoComplete, helpText }: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <TextField
      label={label}
      name={name}
      type={revealed ? "text" : "password"}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      helpText={helpText}
      connectedRight={
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? "Hide password" : "Show password"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            border: "1px solid var(--p-color-border)",
            borderRadius: "8px",
            background: "var(--p-color-bg-surface)",
            color: "var(--p-color-text-secondary)",
            cursor: "pointer",
          }}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M2.5 2.5l15 15M8.3 8.4a2.5 2.5 0 003.3 3.3M5.4 5.5C3.1 6.9 1.5 10 1.5 10s3 6 8.5 6c1.5 0 2.8-.4 3.9-1M16.8 13.9c1.1-1.3 1.7-2.5 1.7-3.9 0 0-3-6-8.5-6-.8 0-1.6.1-2.3.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
