"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Save, Send, Check, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { track } from "@/lib/analytics";

interface CountLine {
  id: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  onHandBeforeBase: number;
  theoreticalUsedBase: number;
  countedBase: number;
  varianceBase: number;
  notes: string | null;
}

interface CountSession {
  id: string;
  name: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "POSTED";
  startAt: string;
  endAt: string;
  createdAt: string;
  lines: CountLine[];
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500",
  SUBMITTED: "bg-blue-500",
  APPROVED: "bg-yellow-500",
  POSTED: "bg-green-500",
};

export default function CountSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const { toast } = useToast();
  
  // Local state for edited counts
  const [editedCounts, setEditedCounts] = useState<Record<string, number>>({});
  const [editedNotes, setEditedNotes] = useState<Record<string, string>>({});

  const { data: session, isLoading } = useQuery<CountSession>({
    queryKey: [`/api/counts/sessions/${sessionId}`],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!session) return;

      // Collect all edited line IDs (from both counts and notes)
      const editedLineIds = new Set([
        ...Object.keys(editedCounts),
        ...Object.keys(editedNotes),
      ]);

      const lines = Array.from(editedLineIds).map((lineId) => {
        const line = session.lines.find((l) => l.id === lineId);
        if (!line) return null;

        return {
          lineId,
          countedBase: editedCounts[lineId] !== undefined 
            ? editedCounts[lineId] 
            : line.countedBase,
          notes: editedNotes[lineId] !== undefined 
            ? editedNotes[lineId] 
            : (line.notes || ""),
        };
      }).filter((l) => l !== null);

      const response = await fetch(`/api/counts/sessions/${sessionId}/lines`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/counts/sessions/${sessionId}`] });
      setEditedCounts({});
      setEditedNotes({});
      toast({
        title: "Counts saved",
        description: "Count values have been saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save counts",
        variant: "destructive",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/counts/sessions/${sessionId}/submit`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/counts/sessions/${sessionId}`] });
      track("count_session_submitted");
      toast({
        title: "Count submitted",
        description: "Count session submitted for approval",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/counts/sessions/${sessionId}/approve`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/counts/sessions/${sessionId}`] });
      toast({
        title: "Count approved",
        description: "Count session approved",
      });
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/counts/sessions/${sessionId}/post`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/counts/sessions/${sessionId}`] });
      track("count_session_posted", { adjustments: data.adjustmentsCreated });
      toast({
        title: "Count posted",
        description: `Created ${data.adjustmentsCreated} adjustment movements`,
      });
    },
  });

  const handleCountChange = (lineId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setEditedCounts((prev) => ({ ...prev, [lineId]: numValue }));
  };

  const handleNoteChange = (lineId: string, value: string) => {
    setEditedNotes((prev) => ({ ...prev, [lineId]: value }));
  };

  const getDisplayCount = (line: CountLine) => {
    return editedCounts[line.id] !== undefined
      ? editedCounts[line.id]
      : line.countedBase;
  };

  const hasUnsavedChanges = Object.keys(editedCounts).length > 0 || Object.keys(editedNotes).length > 0;
  const canEdit = session?.status === "DRAFT";
  const canSubmit = session?.status === "DRAFT";
  const canApprove = session?.status === "SUBMITTED";
  const canPost = session?.status === "APPROVED";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Count session not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{session.name}</h1>
          <p className="text-muted-foreground">
            {format(new Date(session.startAt), "dd MMM")} -{" "}
            {format(new Date(session.endAt), "dd MMM yyyy")}
          </p>
        </div>
        <Badge className={statusColors[session.status]}>
          {session.status}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {canEdit && hasUnsavedChanges && (
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Counts"}
          </Button>
        )}
        {canSubmit && (
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || hasUnsavedChanges}
            data-testid="button-submit"
          >
            <Send className="h-4 w-4 mr-2" />
            Submit for Approval
          </Button>
        )}
        {canApprove && (
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
            data-testid="button-approve"
          >
            <Check className="h-4 w-4 mr-2" />
            Approve
          </Button>
        )}
        {canPost && (
          <Button
            onClick={() => postMutation.mutate()}
            disabled={postMutation.isPending}
            data-testid="button-post"
          >
            <Upload className="h-4 w-4 mr-2" />
            Post Adjustments
          </Button>
        )}
      </div>

      {/* Count Lines Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Count Lines
          </CardTitle>
        </CardHeader>
        <CardContent>
          {session.lines.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No ingredients to count
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="text-right">On Hand Before</TableHead>
                    <TableHead className="text-right">Theoretical Used</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.lines.map((line) => (
                    <TableRow key={line.id} data-testid={`row-line-${line.id}`}>
                      <TableCell className="font-medium">
                        {line.ingredientName}
                        <span className="text-muted-foreground text-sm ml-2">
                          ({line.unit})
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {line.onHandBeforeBase.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.theoreticalUsedBase.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit ? (
                          <Input
                            type="number"
                            min="0"
                            value={getDisplayCount(line)}
                            onChange={(e) => handleCountChange(line.id, e.target.value)}
                            className="w-28 text-right"
                            data-testid={`input-count-${line.id}`}
                          />
                        ) : (
                          line.countedBase.toLocaleString()
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          line.varianceBase > 0
                            ? "text-green-600"
                            : line.varianceBase < 0
                            ? "text-red-600"
                            : ""
                        }`}
                      >
                        {line.varianceBase > 0 && "+"}
                        {line.varianceBase.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Input
                            type="text"
                            placeholder="Notes..."
                            value={
                              editedNotes[line.id] !== undefined
                                ? editedNotes[line.id]
                                : line.notes || ""
                            }
                            onChange={(e) => handleNoteChange(line.id, e.target.value)}
                            className="w-48"
                            data-testid={`input-notes-${line.id}`}
                          />
                        ) : (
                          line.notes || "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
