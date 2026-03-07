"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token || "";
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(form: FormData) {
    setLoading(true);
    const password = String(form.get("password"));
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    setLoading(false);
    if (res.ok) setOk(true);
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      {ok ? (
        <p className="text-sm" data-testid="text-success">
          Password updated.{" "}
          <Link href="/auth/login" className="underline" data-testid="link-signin">
            Sign in
          </Link>
        </p>
      ) : (
        <form action={submit} className="mt-4 space-y-3">
          <Input
            name="password"
            type="password"
            placeholder="New password"
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
            {loading ? "Updating..." : "Update password"}
          </Button>
        </form>
      )}
    </div>
  );
}
