// Agentic onboarding types

export type VenueType = "restaurant" | "cafe" | "bar" | "qsr";

export interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface QuickAction {
  id: string;
  label: string;
  value: string;
  icon?: string;
  action?: "next" | "skip" | "custom";
}

export interface ConversationState {
  id: string;
  userId: string;
  orgId?: string;
  conversationHistory: Message[];
  currentStep?: string;
  metadata: {
    venueType?: VenueType;
    squareConnected?: boolean;
    importProgress?: ImportProgress;
    completedSteps?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportProgress {
  catalog?: {
    status: "pending" | "importing" | "complete" | "error";
    count?: number;
    error?: string;
  };
  team?: {
    status: "pending" | "importing" | "complete" | "error";
    count?: number;
    error?: string;
  };
  sales?: {
    status: "pending" | "importing" | "complete" | "error";
    count?: number;
    error?: string;
  };
  venue?: {
    status: "pending" | "importing" | "complete" | "error";
    error?: string;
  };
}

export interface ProgressiveTask {
  id: string;
  orgId: string;
  taskType:
    | "roster_setup"
    | "supplier_config"
    | "tax_setup"
    | "inventory_init"
    | "staff_onboarding";
  taskData: Record<string, any>;
  scheduledFor: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

export interface VenueDefaults {
  tradingHours: {
    [key: string]: { open: string; close: string } | null;
  };
  features: string[];
  suggestedIntegrations: string[];
  taxSettings: {
    gstRegistered: boolean;
    basReporting: "monthly" | "quarterly";
  };
}
