"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AcceptForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(form: FormData) {
    setLoading(true);
    const password = String(form.get("password"));
    const name = String(form.get("name"));
    
    const res = await fetch("/api/auth/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password })
    });
    
    if (!res.ok) {
      setLoading(false);
      const data = await res.json();
      setMsg(data.error || "Invitation invalid or expired.");
      return;
    }

    const { email } = await res.json();
    
    // Sign in with NextAuth
    const s = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl: "/dashboard"
    });
    
    setLoading(false);
    
    if (s?.ok) {
      // Set orgId cookie before redirecting
      await fetch("/api/session/sync-org", { method: "POST" });
      window.location.href = "/dashboard";
    } else {
      window.location.href = `/auth/login?email=${encodeURIComponent(email)}`;
    }
  }

  return (
    <form action={submit} className="mt-4 space-y-3">
      <Input
        name="name"
        placeholder="Full name"
        required
        data-testid="input-name"
      />
      <Input
        name="password"
        type="password"
        placeholder="Create password"
        required
        minLength={8}
        data-testid="input-password"
      />
      <Button
        type="submit"
        disabled={loading}
        className="w-full"
        data-testid="button-submit"
      >
        {loading ? "Working..." : "Join"}
      </Button>
      {msg && <div className="text-sm text-destructive" data-testid="text-error">{msg}</div>}
    </form>
  );
}
