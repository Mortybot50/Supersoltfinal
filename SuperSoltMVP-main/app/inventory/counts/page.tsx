"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { track } from "@/lib/analytics";

interface CountSession {
  id: string;
  name: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "POSTED";
  startAt: string;
  endAt: string;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  postedAt: string | null;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500",
  SUBMITTED: "bg-blue-500",
  APPROVED: "bg-yellow-500",
  POSTED: "bg-green-500",
};

export default function CountSessionsPage() {
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ sessions: CountSession[] }>({
    queryKey: ["/api/counts/sessions"],
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { startAt: string; endAt: string }) => {
      const response = await fetch("/api/counts/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/counts/sessions"] });
      track("count_session_created");
      setIsNewDialogOpen(false);
      setStartAt("");
      setEndAt("");
      toast({
        title: "Count session created",
        description: "New count session created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create count session",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!startAt || !endAt) {
      toast({
        title: "Validation error",
        description: "Please select start and end dates",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Counts</h1>
          <p className="text-muted-foreground">
            Manage inventory counts and variance analysis
          </p>
        </div>
        <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-count">
              <Plus className="h-4 w-4 mr-2" />
              New Count
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Stock Count</DialogTitle>
              <DialogDescription>
                Create a new count session with theoretical usage calculation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsNewDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                data-testid="button-create-count"
              >
                {createMutation.isPending ? "Creating..." : "Create Count"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Count Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Count Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !data?.sessions || data.sessions.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No count sessions found. Create your first count session to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sessions.map((session) => (
                    <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                      <TableCell className="font-medium">{session.name}</TableCell>
                      <TableCell>
                        <Badge
                          className={statusColors[session.status] || "bg-gray-500"}
                          data-testid={`badge-status-${session.id}`}
                        >
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(session.startAt), "dd MMM")} -{" "}
                        {format(new Date(session.endAt), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(session.createdAt), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <Link href={`/inventory/counts/${session.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`button-view-${session.id}`}
                          >
                            View
                          </Button>
                        </Link>
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
