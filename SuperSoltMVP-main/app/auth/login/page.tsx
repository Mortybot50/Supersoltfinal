"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const params = useSearchParams();
  const prefill = params.get("email") || "";

  async function submit(form: FormData) {
    setLoading(true);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl: "/dashboard"
    });
    setLoading(false);
    
    if (res?.ok) {
      // Set orgId cookie before redirecting
      await fetch("/api/session/sync-org", { method: "POST" });
      window.location.href = "/dashboard";
    } else {
      setMsg("Invalid credentials.");
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <form action={submit} className="mt-4 space-y-3">
        <Input
          name="email"
          type="email"
          placeholder="you@venue.com"
          required
          defaultValue={prefill}
          data-testid="input-email"
        />
        <Input
          name="password"
          type="password"
          placeholder="Password"
          required
          data-testid="input-password"
        />
        <Button
          type="submit"
          disabled={loading}
          className="w-full"
          data-testid="button-submit"
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
        {msg && <div className="text-sm text-destructive" data-testid="text-error">{msg}</div>}
      </form>
      <Link
        href="/auth/forgot"
        className="mt-2 inline-block text-sm text-muted-foreground hover:underline"
        data-testid="link-forgot"
      >
        Forgot password?
      </Link>
    </div>
  );
}
