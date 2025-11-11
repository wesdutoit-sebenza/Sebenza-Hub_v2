import { useState, KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface ChipInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function ChipInput({ value, onChange, placeholder = "Type and press Enter", className }: ChipInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (!value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeChip = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className={`flex flex-wrap gap-2 p-2 border rounded-md min-h-10 ${className || ""}`} data-testid="chip-input-container">
      {value.map((chip, index) => (
        <Badge
          key={index}
          variant="secondary"
          className="gap-1 pl-2 pr-1"
          data-testid={`chip-${index}`}
        >
          <span>{chip}</span>
          <button
            type="button"
            onClick={() => removeChip(index)}
            className="hover:bg-secondary-foreground/10 rounded-full p-0.5"
            data-testid={`button-remove-chip-${index}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 border-0 focus-visible:ring-0 p-0 h-6 min-w-[120px]"
        data-testid="input-chip"
      />
    </div>
  );
}
