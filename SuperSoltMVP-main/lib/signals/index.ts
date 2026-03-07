import type { SignalContext } from "./types";
import { manualOverridesProvider } from "./providers/manual-overrides";
import { holidaysProvider } from "./providers/holidays";
import { weatherProvider } from "./providers/weather";

const providers = [manualOverridesProvider, holidaysProvider, weatherProvider];

export async function getDemandMultiplier(ctx: SignalContext): Promise<number> {
  const mults = await Promise.all(providers.map(p => p.getMultiplier(ctx)));
  // cap extremes
  const product = mults.reduce((m, v) => m * (isFinite(v) ? v : 1), 1);
  return Math.max(0.5, Math.min(1.8, product));
}
