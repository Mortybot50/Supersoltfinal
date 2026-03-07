export type SignalContext = { 
  venueId: string; 
  at: Date 
};

export type SignalProvider = {
  getMultiplier(ctx: SignalContext): Promise<number>; // returns 1.0 if neutral
};
