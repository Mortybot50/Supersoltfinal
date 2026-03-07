import type { SignalProvider, SignalContext } from "../types";

// Scaffold only – returns neutral in dev; you can wire a real API later.
export const weatherProvider: SignalProvider = {
  async getMultiplier(_: SignalContext) {
    // e.g., return 1.08 for heavy rain if venue is delivery-heavy
    return 1.0;
  }
};
