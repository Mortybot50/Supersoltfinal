"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

type Suggestion = {
  id: string;
  type: string;
  status: string;
  title: string;
  reason?: string;
  impact?: string;
  payload: any;
};

type SuggestionsPanelProps = {
  initialSuggestions: Suggestion[];
  period?: "day" | "week" | "month";
  start?: string;
};

export function SuggestionsPanel({ 
  initialSuggestions, 
  period = "week",
  start 
}: SuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [processing, setProcessing] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const params = new URLSearchParams({ period });
      if (start) {
        params.append("start", start);
      }

      const res = await fetch(`/api/ops/suggestions/generate?${params}`, { 
        method: "POST" 
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate suggestions");
      }

      const data = await res.json();
      
      // Refresh the page to show new suggestions
      window.location.reload();

      toast({
        title: "Generated",
        description: `Found ${data.total} new suggestion${data.total !== 1 ? "s" : ""}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/ops/suggestions/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to approve suggestion");
      }

      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      toast({
        title: "Approved",
        description: "Suggestion has been applied",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleIgnore = async (id: string) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/ops/suggestions/${id}/ignore`, { method: "POST" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to ignore suggestion");
      }

      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      toast({
        title: "Ignored",
        description: "Suggestion has been dismissed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Suggestions</CardTitle>
            {suggestions.length > 0 && (
              <span className="rounded-full bg-[hsl(var(--accent))]/15 px-2 py-0.5 text-xs font-medium text-[color-mix(in_oklab,hsl(var(--accent))_70%,black)]">
                {suggestions.length}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleGenerate}
            disabled={generating}
            data-testid="button-generate-suggestions"
          >
            <Sparkles className="h-3 w-3" />
            {generating ? "Generating..." : "Generate"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No suggestions yet for this period.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleGenerate}
                disabled={generating}
                data-testid="button-generate-empty"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {generating ? "Generating..." : "Generate Suggestions"}
              </Button>
            </div>
          ) : (
            suggestions.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-black/5 bg-white p-3 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
                data-testid={`suggestion-${s.id}`}
              >
                <div className="text-sm font-medium">{s.title}</div>
                {s.reason && (
                  <div className="mt-1 text-xs text-muted-foreground">{s.reason}</div>
                )}
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  {s.impact && (
                    <span className="rounded-full bg-[hsl(var(--accent))]/15 px-2 py-0.5 font-medium text-[color-mix(in_oklab,hsl(var(--accent))_70%,black)]">
                      {s.impact}
                    </span>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 rounded-md px-2 text-xs"
                      onClick={() => handleIgnore(s.id)}
                      disabled={processing === s.id}
                      data-testid={`button-ignore-${s.id}`}
                    >
                      Ignore
                    </Button>
                    <Button
                      size="sm"
                      className="h-6 rounded-md px-2 text-xs"
                      onClick={() => handleApprove(s.id)}
                      disabled={processing === s.id}
                      data-testid={`button-approve-${s.id}`}
                    >
                      {processing === s.id ? "..." : "Approve"}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
