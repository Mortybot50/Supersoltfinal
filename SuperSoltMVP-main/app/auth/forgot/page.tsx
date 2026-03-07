"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(form: FormData) {
    setLoading(true);
    const email = String(form.get("email"));
    await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Forgot password</h1>
      {sent ? (
        <p className="text-sm text-muted-foreground" data-testid="text-sent">
          If your email exists, a reset link was sent.
        </p>
      ) : (
        <form action={submit} className="mt-4 space-y-3">
          <Input
            name="email"
            type="email"
            placeholder="you@venue.com"
            required
            data-testid="input-email"
          />
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            data-testid="button-submit"
          >
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}
    </div>
  );
}
