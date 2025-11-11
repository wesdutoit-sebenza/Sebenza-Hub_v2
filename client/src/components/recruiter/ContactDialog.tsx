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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

const contactFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  role: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  whatsappConsent: z.boolean().default(false),
  isPrimary: z.boolean().default(false),
  notes: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  contact?: any;
}

export function ContactDialog({
  open,
  onOpenChange,
  clientId,
  contact,
}: ContactDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!contact;

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      fullName: "",
      role: "",
      email: "",
      phone: "",
      whatsappNumber: "",
      whatsappConsent: false,
      isPrimary: false,
      notes: "",
    },
  });

  // Reset form when dialog opens or contact changes
  useEffect(() => {
    if (open) {
      if (contact) {
        // Editing existing contact
        form.reset({
          fullName: contact.fullName || "",
          role: contact.role || "",
          email: contact.email || "",
          phone: contact.phone || "",
          whatsappNumber: contact.whatsappNumber || "",
          whatsappConsent: contact.whatsappConsent === 1,
          isPrimary: contact.isPrimary === 1,
          notes: contact.notes || "",
        });
      } else {
        // Creating new contact
        form.reset({
          fullName: "",
          role: "",
          email: "",
          phone: "",
          whatsappNumber: "",
          whatsappConsent: false,
          isPrimary: false,
          notes: "",
        });
      }
    }
  }, [open, contact, form]);

  const createMutation = useMutation({
    mutationFn: async (data: ContactFormValues) => {
      const payload = {
        clientId,
        fullName: data.fullName,
        role: data.role || null,
        email: data.email || null,
        phone: data.phone || null,
        whatsappNumber: data.whatsappNumber || null,
        whatsappConsent: data.whatsappConsent ? 1 : 0,
        whatsappConsentDate: data.whatsappConsent ? new Date().toISOString() : null,
        isPrimary: data.isPrimary ? 1 : 0,
        notes: data.notes || null,
      };

      return await apiRequest("POST", `/api/recruiter/clients/${clientId}/contacts`, payload);
    },
    onSuccess: () => {
      // Invalidate the main client query which includes contacts
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter/clients", clientId] });
      toast({
        title: "Success",
        description: "Contact added successfully!",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add contact",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ContactFormValues) => {
      // POPIA Compliance: Only update consent date when newly granted
      const wasConsentGranted = contact?.whatsappConsent === 1;
      const isConsentNowGranted = data.whatsappConsent;
      const shouldUpdateConsentDate = !wasConsentGranted && isConsentNowGranted;
      
      const payload = {
        fullName: data.fullName,
        role: data.role || null,
        email: data.email || null,
        phone: data.phone || null,
        whatsappNumber: data.whatsappNumber || null,
        whatsappConsent: data.whatsappConsent ? 1 : 0,
        // Preserve existing consent date unless newly granted
        whatsappConsentDate: shouldUpdateConsentDate 
          ? new Date().toISOString() 
          : data.whatsappConsent && contact?.whatsappConsentDate
            ? contact.whatsappConsentDate
            : data.whatsappConsent 
              ? new Date().toISOString()
              : null,
        isPrimary: data.isPrimary ? 1 : 0,
        notes: data.notes || null,
      };

      return await apiRequest(
        "PATCH",
        `/api/recruiter/clients/${clientId}/contacts/${contact.id}`,
        payload
      );
    },
    onSuccess: () => {
      // Invalidate the main client query which includes contacts
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter/clients", clientId] });
      toast({
        title: "Success",
        description: "Contact updated successfully!",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormValues) => {
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
            {isEditing ? "Edit Contact" : "Add New Contact"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update contact information and POPIA consent status."
              : "Add a new contact person for this corporate client."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Contact Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
                          data-testid="input-contact-fullname"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Job Title / Role</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="HR Manager"
                          data-testid="input-contact-role"
                          {...field}
                        />
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john@company.com"
                          data-testid="input-contact-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+27 11 123 4567"
                          data-testid="input-contact-phone"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* WhatsApp & POPIA Consent */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">WhatsApp Communication</h3>
              
              <FormField
                control={form.control}
                name="whatsappNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+27 82 123 4567"
                        data-testid="input-contact-whatsapp"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      South African format: +27 followed by 9 digits
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsappConsent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-whatsapp-consent"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>POPIA Consent for WhatsApp Communication</FormLabel>
                      <FormDescription>
                        Contact has explicitly consented to receive WhatsApp messages
                        about job opportunities and recruitment updates in compliance
                        with South Africa's Protection of Personal Information Act (POPIA).
                      </FormDescription>
                      {isEditing && contact?.whatsappConsent === 1 && contact?.whatsappConsentDate && (
                        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                          Original consent date: {new Date(contact.whatsappConsentDate).toLocaleString('en-ZA', {
                            dateStyle: 'long',
                            timeStyle: 'short'
                          })}
                        </p>
                      )}
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Settings</h3>
              
              <FormField
                control={form.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-is-primary"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Primary Contact</FormLabel>
                      <FormDescription>
                        Mark this as the main point of contact for this client
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
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
                      placeholder="Add any internal notes about this contact..."
                      className="min-h-[100px]"
                      data-testid="textarea-contact-notes"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    These notes are internal and not shared with the contact
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
                data-testid="button-cancel-contact"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-submit-contact"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update Contact" : "Add Contact"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
