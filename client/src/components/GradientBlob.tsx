interface GradientBlobProps {
  variant?: "violet-cyan" | "cyan" | "green" | "amber";
  className?: string;
}

export default function GradientBlob({ variant = "violet-cyan", className = "" }: GradientBlobProps) {
  const gradients = {
    "violet-cyan": "bg-gradient-to-br from-violet/20 via-cyan/10 to-transparent",
    "cyan": "bg-gradient-to-br from-cyan/20 to-transparent",
    "green": "bg-gradient-to-br from-green/20 to-transparent",
    "amber": "bg-gradient-to-br from-amber/20 to-transparent",
  };

  return (
    <div
      className={`absolute inset-0 ${gradients[variant]} pointer-events-none ${className}`}
      aria-hidden="true"
    />
  );
}
