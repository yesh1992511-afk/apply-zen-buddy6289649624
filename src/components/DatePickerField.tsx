import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string; // ISO yyyy-MM-dd or ""
  onChange: (v: string | null) => void;
  className?: string;
  /** restrict range; defaults sensible per use-case */
  fromYear?: number;
  toYear?: number;
  disabled?: (d: Date) => boolean;
};

export function DatePickerField({
  label, value, onChange, className,
  fromYear = 1940,
  toYear = new Date().getFullYear() + 10,
  disabled,
}: Props) {
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const date = parsed && isValid(parsed) ? parsed : undefined;

  return (
    <div className={className}>
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "mt-1 w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
            {date && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(null); }}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : null)}
            captionLayout="dropdown"
            fromYear={fromYear}
            toYear={toYear}
            disabled={disabled}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
