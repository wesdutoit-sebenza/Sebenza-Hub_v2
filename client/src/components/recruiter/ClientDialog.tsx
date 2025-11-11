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
import { Button } from "@/components/ui/button";
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

// South African provinces
const SA_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];

// Client tiers
const CLIENT_TIERS = ["platinum", "gold", "silver"];

// Industries
const INDUSTRIES = [
  "Accounting & Finance",
  "Agriculture",
  "Automotive",
  "Banking",
  "Construction",
  "Consulting",
  "Education",
  "Engineering",
  "Healthcare",
  "Hospitality",
  "IT & Technology",
  "Insurance",
  "Legal",
  "Manufacturing",
  "Marketing & Advertising",
  "Mining",
  "Real Estate",
  "Retail",
  "Telecommunications",
  "Transportation & Logistics",
];

// Validation schema for client form
const clientFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  registrationNumber: z.string().optional(),
  industry: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  status: z.enum(["active", "inactive", "on-hold"]).default("active"),
  tier: z.enum(["platinum", "gold", "silver", ""]).optional(),
  rating: z.coerce.number().min(1).max(5).optional().or(z.literal("")),
  defaultFeePercent: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  guaranteePeriodDays: z.coerce.number().min(0).optional().or(z.literal("")),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

type CorporateClient = {
  id: string;
  name: string;
  registrationNumber: string | null;
  industry: string | null;
  province: string | null;
  city: string | null;
  status: string;
  tier: string | null;
  rating: number | null;
  defaultFeePercent: number | null;
  guaranteePeriodDays: number | null;
  paymentTerms: string | null;
  notes: string | null;
};

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: CorporateClient;
}

export function ClientDialog({ open, onOpenChange, client }: ClientDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!client;

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      registrationNumber: "",
      industry: "",
      province: "",
      city: "",
      status: "active",
      tier: "",
      rating: "" as any,
      defaultFeePercent: "" as any,
      guaranteePeriodDays: "" as any,
      paymentTerms: "",
      notes: "",
    },
  });

  // Reset form when dialog opens or client changes
  useEffect(() => {
    if (open) {
      if (client) {
        // Editing existing client
        form.reset({
          name: client.name || "",
          registrationNumber: client.registrationNumber || "",
          industry: client.industry || "",
          province: client.province || "",
          city: client.city || "",
          status: (client.status as "active" | "inactive" | "on-hold") || "active",
          tier: (client.tier as "platinum" | "gold" | "silver" | "") || "",
          rating: client.rating || ("" as any),
          defaultFeePercent: client.defaultFeePercent || ("" as any),
          guaranteePeriodDays: client.guaranteePeriodDays || ("" as any),
          paymentTerms: client.paymentTerms || "",
          notes: client.notes || "",
        });
      } else {
        // Creating new client
        form.reset({
          name: "",
          registrationNumber: "",
          industry: "",
          province: "",
          city: "",
          status: "active",
          tier: "",
          rating: "" as any,
          defaultFeePercent: "" as any,
          guaranteePeriodDays: "" as any,
          paymentTerms: "",
          notes: "",
        });
      }
    }
  }, [open, client, form]);

  const createMutation = useMutation({
    mutationFn: async (data: ClientFormValues) => {
      // Clean up empty strings to null
      const cleanData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          value === "" ? null : value,
        ])
      );
      return await apiRequest("POST", "/api/recruiter/clients", cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter/clients"] });
      toast({
        title: "Success",
        description: "Client created successfully.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create client.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ClientFormValues) => {
      // Clean up empty strings to null
      const cleanData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          value === "" ? null : value,
        ])
      );
      return await apiRequest(
        "PATCH",
        `/api/recruiter/clients/${client!.id}`,
        cleanData
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter/clients"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/recruiter/clients", client!.id],
      });
      toast({
        title: "Success",
        description: "Client updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update client.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ClientFormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Client" : "Add New Client"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update client company information and commercial terms."
              : "Add a new client company to your Corporate Clients database."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Company Information</h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="ABC Corporation"
                        data-testid="input-client-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="registrationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="2010/123456/07"
                          data-testid="input-registration-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-industry">
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INDUSTRIES.map((industry) => (
                            <SelectItem key={industry} value={industry}>
                              {industry}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-province">
                            <SelectValue placeholder="Select province" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SA_PROVINCES.map((province) => (
                            <SelectItem key={province} value={province}>
                              {province}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Johannesburg"
                          data-testid="input-city"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Client Classification */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Classification</h3>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="on-hold">On Hold</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tier</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-tier">
                            <SelectValue placeholder="Select tier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CLIENT_TIERS.map((tier) => (
                            <SelectItem key={tier} value={tier}>
                              <span className="capitalize">{tier}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rating (1-5)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="1"
                          max="5"
                          placeholder="5"
                          data-testid="input-rating"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Default Commercial Terms */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">
                Default Commercial Terms
              </h3>
              <FormDescription>
                These will be used as defaults for new agreements with this
                client.
              </FormDescription>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="defaultFeePercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fee %</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          max="100"
                          placeholder="15"
                          data-testid="input-fee-percent"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="guaranteePeriodDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guarantee (days)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          placeholder="90"
                          data-testid="input-guarantee-days"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="30 days"
                          data-testid="input-payment-terms"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Add any internal notes about this client..."
                      className="min-h-[100px]"
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormDescription>
                    These notes are only visible to your team.
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
                disabled={isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-save-client"
              >
                {isPending
                  ? "Saving..."
                  : isEditing
                  ? "Update Client"
                  : "Create Client"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
