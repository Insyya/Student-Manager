import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

/* ---------- Icons ---------- */

type IconProps = { size?: number };
const svg = (size: number, children: ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const Icon = {
  Logo: ({ size = 20 }: IconProps) =>
    svg(size, <><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" /></>),
  Plus: ({ size = 16 }: IconProps) => svg(size, <path d="M12 5v14M5 12h14" />),
  Search: ({ size = 16 }: IconProps) => svg(size, <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  X: ({ size = 16 }: IconProps) => svg(size, <path d="M18 6 6 18M6 6l12 12" />),
  Edit: ({ size = 16 }: IconProps) => svg(size, <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>),
  Trash: ({ size = 16 }: IconProps) => svg(size, <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></>),
  Alert: ({ size = 16 }: IconProps) => svg(size, <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>),
  Check: ({ size = 16 }: IconProps) => svg(size, <path d="M20 6 9 17l-5-5" />),
  Eye: ({ size = 16 }: IconProps) => svg(size, <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>),
  EyeOff: ({ size = 16 }: IconProps) => svg(size, <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>),
  Logout: ({ size = 16 }: IconProps) => svg(size, <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>),
  Users: ({ size = 18 }: IconProps) => svg(size, <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-4-6.3" /></>),
  Chart: ({ size = 18 }: IconProps) => svg(size, <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></>),
  Trophy: ({ size = 18 }: IconProps) => svg(size, <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>),
  Badge: ({ size = 18 }: IconProps) => svg(size, <><circle cx="12" cy="9" r="6" /><path d="m9 14-2 7 5-3 5 3-2-7" /></>),
};

/* ---------- Form field ---------- */

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
};

export function Field({ label, error, hint, trailing, id, required, ...input }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  return (
    <div className={`field${error ? " field-invalid" : ""}`}>
      <label htmlFor={inputId}>
        {label}
        {required && <span className="field-required" aria-hidden="true"> *</span>}
      </label>
      <div className="field-control">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={error || hint ? messageId : undefined}
          {...input}
        />
        {trailing}
      </div>
      {error ? (
        <p id={messageId} className="field-error">
          <Icon.Alert size={14} />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function PasswordField(props: Omit<FieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          className="field-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <Icon.EyeOff /> : <Icon.Eye />}
        </button>
      }
    />
  );
}

/* ---------- Alerts ---------- */

export function Alert({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="alert" role="alert">
      <Icon.Alert />
      <span>{children}</span>
      {onClose && (
        <button className="icon-button" onClick={onClose} aria-label="Dismiss">
          <Icon.X size={14} />
        </button>
      )}
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/* ---------- Modal ---------- */

type ModalProps = {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
};

export function Modal({ title, description, onClose, children, busy }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, button:not(.modal-close)");
    first?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && !busy) onClose();
    if (e.key !== "Tab" || !ref.current) return;
    const items = ref.current.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled)",
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={() => !busy && onClose()}>
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button modal-close" onClick={onClose} disabled={busy} aria-label="Close">
            <Icon.X />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
