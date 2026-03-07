export type Window = {
  start: Date;
  end: Date;
  days: number;
  label: string;
};

export function getWindow(period: "day" | "week" | "month", startISO: string): Window {
  const base = new Date(startISO);
  base.setHours(0, 0, 0, 0);

  let start: Date;
  let end: Date;
  let label: string;

  if (period === "day") {
    start = new Date(base);
    end = new Date(base);
    end.setHours(23, 59, 59, 999);
    label = start.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  } else if (period === "week") {
    const dayOfWeek = base.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start = new Date(base);
    start.setDate(base.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    label = `${start.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;
  } else {
    start = new Date(base.getFullYear(), base.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    
    end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    
    label = start.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  }

  const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return { start, end, days, label };
}

export function eachDay(start: Date, end: Date): string[] {
  const days: string[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    days.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }

  return days;
}
