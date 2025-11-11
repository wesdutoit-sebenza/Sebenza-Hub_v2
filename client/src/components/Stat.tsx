import { ArrowDown, ArrowUp } from "lucide-react";

interface StatProps {
  value: string;
  label: string;
  trend?: "up" | "down";
  color?: "violet" | "cyan" | "green" | "amber";
}

export default function Stat({ value, label, trend, color = "violet" }: StatProps) {
  const colorClasses = {
    violet: "text-violet",
    cyan: "text-cyan",
    green: "text-green",
    amber: "text-amber",
  };

  return (
    <div className="flex flex-col" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-baseline gap-2">
        <span className={`text-4xl md:text-5xl font-bold ${colorClasses[color]}`} data-testid="text-stat-value">
          {value}
        </span>
        {trend && (
          <span className={`text-sm ${trend === 'down' ? 'text-green' : 'text-amber'}`}>
            {trend === 'down' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
          </span>
        )}
      </div>
      <span className="text-sm text-muted-foreground mt-1" data-testid="text-stat-label">{label}</span>
    </div>
  );
}
