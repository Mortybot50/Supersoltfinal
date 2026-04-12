import { useState } from "react";
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  startOfYear,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PeriodType = "day" | "week" | "month" | "custom";

interface DateRangeSelectorProps {
  onDateRangeChange?: (
    startDate: Date,
    endDate: Date,
    period: PeriodType,
  ) => void;
}

export function DateRangeSelector({
  onDateRangeChange,
}: DateRangeSelectorProps) {
  const [period, setPeriod] = useState<PeriodType>("week");
  const [startDate, setStartDate] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [endDate, setEndDate] = useState(
    endOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(
    startDate,
  );
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(endDate);

  const updateDateRange = (
    newStartDate: Date,
    newEndDate: Date,
    newPeriod: PeriodType,
  ) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setPeriod(newPeriod);
    onDateRangeChange?.(newStartDate, newEndDate, newPeriod);
  };

  const handlePeriodChange = (newPeriod: PeriodType) => {
    const today = new Date();
    let newStartDate: Date;
    let newEndDate: Date;

    if (newPeriod === "day") {
      newStartDate = startOfDay(today);
      newEndDate = startOfDay(today);
    } else if (newPeriod === "week") {
      newStartDate = startOfWeek(today, { weekStartsOn: 1 });
      newEndDate = endOfWeek(today, { weekStartsOn: 1 });
    } else if (newPeriod === "month") {
      newStartDate = startOfMonth(today);
      newEndDate = endOfMonth(today);
    } else {
      return;
    }

    updateDateRange(newStartDate, newEndDate, newPeriod);
  };

  const handlePrev = () => {
    let newStartDate: Date;
    let newEndDate: Date;

    if (period === "day") {
      newStartDate = subDays(startDate, 1);
      newEndDate = subDays(endDate, 1);
    } else if (period === "week") {
      newStartDate = subWeeks(startDate, 1);
      newEndDate = subWeeks(endDate, 1);
    } else if (period === "month") {
      newStartDate = startOfMonth(subMonths(startDate, 1));
      newEndDate = endOfMonth(subMonths(startDate, 1));
    } else {
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      newStartDate = subDays(startDate, daysDiff + 1);
      newEndDate = subDays(endDate, daysDiff + 1);
    }

    updateDateRange(newStartDate, newEndDate, period);
  };

  const handleNext = () => {
    let newStartDate: Date;
    let newEndDate: Date;

    if (period === "day") {
      newStartDate = addDays(startDate, 1);
      newEndDate = addDays(endDate, 1);
    } else if (period === "week") {
      newStartDate = addWeeks(startDate, 1);
      newEndDate = addWeeks(endDate, 1);
    } else if (period === "month") {
      newStartDate = startOfMonth(addMonths(startDate, 1));
      newEndDate = endOfMonth(addMonths(startDate, 1));
    } else {
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      newStartDate = addDays(startDate, daysDiff + 1);
      newEndDate = addDays(endDate, daysDiff + 1);
    }

    updateDateRange(newStartDate, newEndDate, period);
  };

  const handleToday = () => {
    const today = new Date();
    let newStartDate: Date;
    let newEndDate: Date;

    if (period === "day") {
      newStartDate = startOfDay(today);
      newEndDate = startOfDay(today);
    } else if (period === "week") {
      newStartDate = startOfWeek(today, { weekStartsOn: 1 });
      newEndDate = endOfWeek(today, { weekStartsOn: 1 });
    } else if (period === "month") {
      newStartDate = startOfMonth(today);
      newEndDate = endOfMonth(today);
    } else {
      newStartDate = startOfDay(today);
      newEndDate = startOfDay(today);
    }

    updateDateRange(newStartDate, newEndDate, period);
  };

  // Inline quick presets
  const handleQuickSelect = (
    preset:
      | "today"
      | "yesterday"
      | "this-week"
      | "last-week"
      | "this-month"
      | "last-month",
  ) => {
    const now = new Date();
    switch (preset) {
      case "today":
        updateDateRange(startOfDay(now), startOfDay(now), "day");
        break;
      case "yesterday": {
        const y = subDays(now, 1);
        updateDateRange(startOfDay(y), startOfDay(y), "day");
        break;
      }
      case "this-week":
        updateDateRange(
          startOfWeek(now, { weekStartsOn: 1 }),
          endOfWeek(now, { weekStartsOn: 1 }),
          "week",
        );
        break;
      case "last-week": {
        const lw = subWeeks(now, 1);
        updateDateRange(
          startOfWeek(lw, { weekStartsOn: 1 }),
          endOfWeek(lw, { weekStartsOn: 1 }),
          "week",
        );
        break;
      }
      case "this-month":
        updateDateRange(startOfMonth(now), endOfMonth(now), "month");
        break;
      case "last-month": {
        const lm = subMonths(now, 1);
        updateDateRange(startOfMonth(lm), endOfMonth(lm), "month");
        break;
      }
    }
  };

  const handleCustomOpen = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setCustomDialogOpen(true);
  };

  const handleCustomApply = () => {
    if (tempStartDate && tempEndDate && tempStartDate <= tempEndDate) {
      updateDateRange(tempStartDate, tempEndDate, "custom");
      setCustomDialogOpen(false);
    }
  };

  const handleQuickPreset = (days: number) => {
    const today = new Date();
    const newEndDate = startOfDay(today);
    const newStartDate = subDays(newEndDate, days - 1);
    setTempStartDate(newStartDate);
    setTempEndDate(newEndDate);
  };

  const handleYearToDate = () => {
    const today = new Date();
    setTempStartDate(startOfYear(today));
    setTempEndDate(startOfDay(today));
  };

  const formatDateRange = () => {
    if (period === "day") {
      return format(startDate, "dd MMM yyyy");
    }
    return `${format(startDate, "dd MMM yyyy")} - ${format(endDate, "dd MMM yyyy")}`;
  };

  const quickPresets = [
    { label: "Today", key: "today" as const },
    { label: "Yesterday", key: "yesterday" as const },
    { label: "This Week", key: "this-week" as const },
    { label: "Last Week", key: "last-week" as const },
    { label: "This Month", key: "this-month" as const },
    { label: "Last Month", key: "last-month" as const },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      {/* Quick preset buttons */}
      <div className="flex flex-wrap gap-1">
        {quickPresets.map(({ label, key }) => (
          <Button
            key={key}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => handleQuickSelect(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="w-px h-5 bg-border hidden sm:block" />

      {/* Period tabs */}
      <div className="inline-flex rounded-md border border-input">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "rounded-none rounded-l-md border-r border-input h-8 px-3",
            period === "day"
              ? "bg-blue-50 text-blue-600 font-medium hover:bg-blue-50"
              : "hover:bg-accent",
          )}
          onClick={() => handlePeriodChange("day")}
        >
          Day
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "rounded-none border-r border-input h-8 px-3",
            period === "week"
              ? "bg-blue-50 text-blue-600 font-medium hover:bg-blue-50"
              : "hover:bg-accent",
          )}
          onClick={() => handlePeriodChange("week")}
        >
          Week
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "rounded-none rounded-r-md h-8 px-3",
            period === "month"
              ? "bg-blue-50 text-blue-600 font-medium hover:bg-blue-50"
              : "hover:bg-accent",
          )}
          onClick={() => handlePeriodChange("month")}
        >
          Month
        </Button>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 gap-0.5"
          onClick={handlePrev}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Prev</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3"
          onClick={handleToday}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 gap-0.5"
          onClick={handleNext}
        >
          <span>Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Custom date picker button */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-8 px-2 gap-0.5",
          period === "custom" &&
            "bg-blue-50 text-blue-600 font-medium border-blue-600",
        )}
        onClick={handleCustomOpen}
      >
        <CalendarIcon className="h-3.5 w-3.5" />
        <span>Custom</span>
      </Button>

      {/* Date display */}
      <div className="text-xs text-muted-foreground ml-1">
        {formatDateRange()}
      </div>

      {/* Custom date range dialog */}
      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Custom Date Range</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Quick presets */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickPreset(7)}
              >
                Last 7 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickPreset(30)}
              >
                Last 30 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickPreset(90)}
              >
                Last 3 months
              </Button>
              <Button variant="outline" size="sm" onClick={handleYearToDate}>
                Year to date
              </Button>
            </div>

            {/* Date pickers */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Calendar
                  mode="single"
                  selected={tempStartDate}
                  onSelect={setTempStartDate}
                  className="rounded-md border pointer-events-auto"
                  disabled={(date) =>
                    tempEndDate ? date > tempEndDate : false
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Calendar
                  mode="single"
                  selected={tempEndDate}
                  onSelect={setTempEndDate}
                  className="rounded-md border pointer-events-auto"
                  disabled={(date) =>
                    tempStartDate ? date < tempStartDate : false
                  }
                />
              </div>
            </div>

            {tempStartDate && tempEndDate && tempStartDate > tempEndDate && (
              <p className="text-sm text-destructive">
                End date must be after start date
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCustomDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCustomApply}
              disabled={
                !tempStartDate || !tempEndDate || tempStartDate > tempEndDate
              }
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
