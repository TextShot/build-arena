export type ValidationNotice = Readonly<{
  tone: "neutral" | "success" | "error";
  message: string;
}>;

export function ValidationPanel({ notice }: Readonly<{ notice: ValidationNotice }>) {
  return (
    <section
      aria-live="polite"
      className="validation-notice"
      data-tone={notice.tone}
      role={notice.tone === "error" ? "alert" : "status"}
    >
      <span aria-hidden="true" className="notice-symbol">
        {notice.tone === "success" ? "✓" : notice.tone === "error" ? "!" : "i"}
      </span>
      <p>{notice.message}</p>
    </section>
  );
}
