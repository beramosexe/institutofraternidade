import emblem from "@/assets/avatar-emblem.jpg";

export function Logo({
  variant = "full",
  className = "",
}: {
  variant?: "full" | "mark";
  className?: string;
}) {
  if (variant === "mark") {
    return (
      <img
        src={emblem}
        alt="Instituto Fraternidade"
        className={`rounded-full ${className}`}
      />
    );
  }
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img src={emblem} alt="" className="h-10 w-10 rounded-full ring-1 ring-border" />
      <div className="leading-tight">
        <div className="font-display text-base text-foreground">Instituto Fraternidade</div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Nova Terra com Consciência
        </div>
      </div>
    </div>
  );
}
