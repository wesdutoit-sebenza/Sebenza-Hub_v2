import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

const engagementFormSchema = z.object({
  agreementType: z.enum(["retained", "contingent", "contract"], {
    required_error: "Agreement type is required",
  }),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  feePercent: z.string().optional(),
  retainerAmount: z.string().optional(),
  termsDocument: z.string().optional(),
  status: z.enum(["active", "expired", "terminated"]).default("active"),
  notes: z.string().optional(),
});

type EngagementFormValues = z.infer<typeof engagementFormSchema>;

interface EngagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  engagement?: any;
}

export function EngagementDialog({
  open,
  onOpenChange,
  clientId,
  engagement,
}: EngagementDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!engagement;

  const form = useForm<EngagementFormValues>({
    resolver: zodResolver(engagementFormSchema),
    defaultValues: {
      agreementType: "contingent",
      startDate: "",
      endDate: "",
      feePercent: "",
      retainerAmount: "",
      termsDocument: "",
      status: "active",
      notes: "",
    },
  });

  // Reset form when dialog opens or engagement changes
  useEffect(() => {
    if (open) {
      if (engagement) {
        // Editing existing engagement
        form.reset({
          agreementType: engagement.agreementType || "contingent",
          startDate: engagement.startDate
            ? new Date(engagement.startDate).toISOString().split("T")[0]
            : "",
          endDate: engagement.endDate
            ? new Date(engagement.endDate).toISOString().split("T")[0]
            : "",
          feePercent: engagement.feePercent?.toString() || "",
          retainerAmount: engagement.retainerAmount
            ? (engagement.retainerAmount / 100).toString()
            : "",
          termsDocument: engagement.termsDocument || "",
          status: engagement.status || "active",
          notes: engagement.notes || "",
        });
      } else {
        // Creating new engagement
        form.reset({
          agreementType: "contingent",
          startDate: "",
          endDate: "",
          feePercent: "",
          retainerAmount: "",
          termsDocument: "",
          status: "active",
          notes: "",
        });
      }
    }
  }, [open, engagement, form]);

  const createMutation = useMutation({
    mutationFn: async (data: EngagementFormValues) => {
      // Create date at noon UTC to avoid timezone shifts
      const startDate = new Date(data.startDate + "T12:00:00Z");
      const endDate = data.endDate ? new Date(data.endDate + "T12:00:00Z") : null;
      
      const payload = {
        clientId,
        agreementType: data.agreementType,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        feePercent: data.feePercent ? parseInt(data.feePercent) : null,
        retainerAmount: data.retainerAmount
          ? Math.round(parseFloat(data.retainerAmount) * 100)
          : null,
        termsDocument: data.termsDocument || null,
        status: data.status,
        notes: data.notes || null,
      };

      return await apiRequest("POST", `/api/recruiter/clients/${clientId}/engagements`, payload);
    },
    onSuccess: () => {
      // Invalidate the main client query which includes engagements
      queryClient.invalidateQueries({
        queryKey: ["/api/recruiter/clients", clientId],
      });
      toast({
        title: "Success",
        description: "Engagement created successfully!",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create engagement",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EngagementFormValues) => {
      // Create date at noon UTC to avoid timezone shifts
      const startDate = new Date(data.startDate + "T12:00:00Z");
      const endDate = data.endDate ? new Date(data.endDate + "T12:00:00Z") : null;
      
      const payload = {
        agreementType: data.agreementType,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        feePercent: data.feePercent ? parseInt(data.feePercent) : null,
        retainerAmount: data.retainerAmount
          ? Math.round(parseFloat(data.retainerAmount) * 100)
          : null,
        termsDocument: data.termsDocument || null,
        status: data.status,
        notes: data.notes || null,
      };

      return await apiRequest(
        "PATCH",
        `/api/recruiter/clients/${clientId}/engagements/${engagement.id}`,
        payload
      );
    },
    onSuccess: () => {
      // Invalidate the main client query which includes engagements
      queryClient.invalidateQueries({
        queryKey: ["/api/recruiter/clients", clientId],
      });
      toast({
        title: "Success",
        description: "Engagement updated successfully!",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update engagement",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EngagementFormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Agreement" : "Add New Agreement"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update fee agreement and commercial terms."
              : "Create a new fee agreement for this corporate client."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Agreement Type & Status */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Agreement Details</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="agreementType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agreement Type *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-agreement-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="contingent">Contingent</SelectItem>
                          <SelectItem value="retained">Retained</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Contingent (success fee), Retained (upfront + success), or Contract
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="terminated">Terminated</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Dates */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Contract Period</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          data-testid="input-start-date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          data-testid="input-end-date"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Leave empty for ongoing</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Fee Structure */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Fee Structure</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="feePercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fee Percentage</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="15"
                          data-testid="input-fee-percent"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Success fee as % of annual salary
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="retainerAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retainer Amount (ZAR)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="10000"
                          data-testid="input-retainer-amount"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Upfront retainer fee if applicable
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Terms Document */}
            <FormField
              control={form.control}
              name="termsDocument"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terms Document URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://..."
                      data-testid="input-terms-document"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Link to signed agreement document (optional)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any internal notes about this agreement..."
                      className="min-h-[100px]"
                      data-testid="textarea-engagement-notes"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    These notes are internal and not shared with the client
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                data-testid="button-cancel-engagement"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-submit-engagement"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update Agreement" : "Add Agreement"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
