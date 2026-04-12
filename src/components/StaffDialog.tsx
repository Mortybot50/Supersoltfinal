import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Staff } from "@/types";
import { useEffect } from "react";

const staffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["manager", "supervisor", "crew"]),
  start_date: z.string().min(1, "Start date is required"),
});

type StaffFormValues = z.infer<typeof staffSchema>;

interface StaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: Staff;
  onSave: (staff: Staff) => void;
}

export function StaffDialog({
  open,
  onOpenChange,
  staff,
  onSave,
}: StaffDialogProps) {
  const { currentOrg, currentVenue } = useAuth();
  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "crew",
      start_date: new Date().toISOString().split("T")[0],
    },
  });

  useEffect(() => {
    if (staff) {
      form.reset({
        name: staff.name,
        email: staff.email,
        role: staff.role,
        start_date:
          typeof staff.start_date === "string"
            ? staff.start_date
            : new Date(staff.start_date).toISOString().split("T")[0],
      });
    } else {
      form.reset({
        name: "",
        email: "",
        role: "crew",
        start_date: new Date().toISOString().split("T")[0],
      });
    }
  }, [staff, form]);

  const onSubmit = (values: StaffFormValues) => {
    const staffData: Staff = {
      id: staff?.id || `staff-${Date.now()}`,
      organization_id: staff?.organization_id || currentOrg?.id || "",
      venue_id: staff?.venue_id || currentVenue?.id || "",
      name: values.name,
      email: values.email,
      role: values.role,
      hourly_rate: staff?.hourly_rate ?? 0,
      start_date: new Date(values.start_date),
      status: staff?.status || "active",
      // Onboarding fields (preserve existing or set defaults)
      onboarding_status: staff?.onboarding_status || "not_started",
      onboarding_progress: staff?.onboarding_progress || 0,
      // TFN fields
      tfn_exemption: staff?.tfn_exemption || false,
      tfn_claimed_tax_free_threshold:
        staff?.tfn_claimed_tax_free_threshold || false,
      tfn_has_help_debt: staff?.tfn_has_help_debt || false,
      tfn_has_tsl_debt: staff?.tfn_has_tsl_debt || false,
      tfn_tax_offset_claimed: staff?.tfn_tax_offset_claimed || false,
      // Super fields
      super_use_employer_default: staff?.super_use_employer_default ?? true,
    };

    onSave(staffData);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {staff ? "Edit Staff Member" : "Add Staff Member"}
          </DialogTitle>
          <DialogDescription>
            {staff
              ? "Update staff member details"
              : "Add a new team member to your organization"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="crew">Crew</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Hourly rate and pay conditions can be set in the staff profile
              after adding.
            </p>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {staff ? "Update Staff" : "Add Staff"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
