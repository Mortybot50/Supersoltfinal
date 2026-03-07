"use client";
import posthog from "posthog-js";
import { useEffect } from "react";

// Simple hash function to anonymize user IDs (non-cryptographic, privacy-preserving)
async function hashId(id: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(id);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

export function AnalyticsProvider({
  user,
  children,
}: {
  user?: { id: string; orgId?: string; role?: string };
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
    });
    
    // Use hashed identifiers to preserve privacy (no PII)
    if (user?.id) {
      hashId(user.id).then(hashedUserId => {
        posthog.identify(hashedUserId, {
          // Only track aggregate, non-PII properties
          role: user.role, // Generic role is not PII
          // Omit orgId as it could be identifying
        });
      });
    }
    
    return () => {
      try {
        // PostHog may have shutdown method in some versions
        (posthog as any).shutdown?.();
      } catch (_) {}
    };
  }, [user?.id, user?.role]);

  return <>{children}</>;
}

export const track = (name: string, props?: Record<string, any>) => {
  try {
    posthog.capture(name, props);
  } catch {}
};
