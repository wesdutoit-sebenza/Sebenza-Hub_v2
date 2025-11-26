import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { COUNTRY_CODES } from "@shared/countryCodes";

const formSchema = z.object({
  agencyName: z.string().min(2, "Agency name must be at least 2 characters"),
  website: z.string()
    .transform((val) => {
      if (!val) return val;
      const trimmed = val.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("www.") || trimmed.startsWith("www")) {
        return `https://${trimmed}`;
      }
      return trimmed;
    })
    .pipe(z.string().url("Invalid URL").or(z.literal(""))),
  email: z.string().email("Invalid email address").or(z.literal("")),
  telephoneCountryCode: z.string().optional(),
  telephoneNumber: z.string().optional(),
  sectors: z.array(z.string()),
  proofUrl: z.string()
    .transform((val) => {
      if (!val) return val;
      const trimmed = val.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("www.") || trimmed.startsWith("www")) {
        return `https://${trimmed}`;
      }
      return trimmed;
    })
    .pipe(z.string().url("Invalid URL").or(z.literal(""))),
});

type FormData = z.infer<typeof formSchema>;

const SECTORS = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "Retail",
  "Manufacturing",
  "Construction",
  "Hospitality",
  "Legal",
  "Engineering",
  "Marketing",
  "Sales",
];

export default function OnboardingRecruiter() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current user data to get email
  const { data: userData } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      agencyName: "",
      website: "",
      email: "",
      telephoneCountryCode: "",
      telephoneNumber: "",
      sectors: [],
      proofUrl: "",
    },
  });

  // Auto-populate email when user data is loaded
  useEffect(() => {
    if ((userData as any)?.user?.email) {
      form.setValue("email", (userData as any).user.email);
    }
  }, [userData, form]);

  const createRecruiterProfileMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Only combine telephone if both fields are provided
      let fullTelephone: string | undefined = undefined;
      if (data.telephoneCountryCode && data.telephoneNumber) {
        const phoneNumber = data.telephoneNumber.replace(/^0+/, '');
        fullTelephone = `${data.telephoneCountryCode} ${phoneNumber}`;
      }
      
      const payload = {
        agencyName: data.agencyName,
        website: data.website || undefined,
        email: data.email || undefined,
        telephone: fullTelephone,
        sectors: data.sectors.length > 0 ? data.sectors : undefined,
        proofUrl: data.proofUrl || undefined,
      };
      
      const res = await apiRequest('POST', '/api/profile/recruiter', payload);
      return res.json();
    },
    onSuccess: () => {
      // Invalidate user cache to refresh role and onboarding status
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      toast({
        title: "Recruiter profile created!",
        description: "Your profile is ready. Welcome to Sebenza Hub!",
      });
      setLocation("/dashboard/recruiter/profile");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create recruiter profile",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    createRecruiterProfileMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="text-white-brand" data-testid="text-onboarding-recruiter-title">Set Up Your Recruiter Profile</CardTitle>
          <CardDescription className="text-slate" data-testid="text-onboarding-recruiter-description">
            Tell us about your recruiting agency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="agencyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agency Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Talent Solutions SA" 
                        {...field} 
                        data-testid="input-agency-name" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://www.youragency.co.za" 
                        type="url"
                        {...field} 
                        data-testid="input-website" 
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
                    <FormLabel>Email Address (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="contact@youragency.co.za" 
                        type="email"
                        {...field} 
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormDescription>
                      Auto-populated from your account email
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="telephoneCountryCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country Code (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-country-code">
                            <SelectValue placeholder="Code" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COUNTRY_CODES.map((item: { code: string; country: string; dialCode: string }) => (
                            <SelectItem key={item.code} value={item.dialCode}>
                              {item.dialCode} {item.country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="telephoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telephone Number (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="82 123 4567" 
                            {...field} 
                            data-testid="input-telephone" 
                          />
                        </FormControl>
                        <FormDescription>
                          Leading 0 will be removed automatically
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="sectors"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Industry Sectors (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                            data-testid="button-sectors-dropdown"
                          >
                            {field.value && field.value.length > 0
                              ? `${field.value.length} sector${field.value.length > 1 ? 's' : ''} selected`
                              : "Select industries"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <div className="max-h-64 overflow-y-auto p-4 space-y-2">
                          {SECTORS.map((sector) => (
                            <div
                              key={sector}
                              className="flex items-center space-x-3 space-y-0"
                            >
                              <Checkbox
                                data-testid={`checkbox-sector-${sector.toLowerCase()}`}
                                checked={field.value?.includes(sector)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, sector])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== sector
                                        )
                                      );
                                }}
                              />
                              <label className="text-sm font-normal cursor-pointer">
                                {sector}
                              </label>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Select all industries you recruit for
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="proofUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn Profile or Company Page (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://linkedin.com/in/yourprofile" 
                        type="url"
                        {...field} 
                        data-testid="input-proof-url" 
                      />
                    </FormControl>
                    <FormDescription>
                      Help us verify your recruiting credentials faster
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="p-4 bg-amber/10 rounded-md border border-amber/20">
                <p className="text-sm text-slate">
                  <strong className="text-amber">Note:</strong> Your recruiter profile will be reviewed by our team before being activated.
                  This typically takes 1-2 business days.
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-amber-gradient text-charcoal hover:opacity-90" 
                disabled={isSubmitting}
                data-testid="button-create-recruiter-profile"
              >
                {isSubmitting ? "Submitting..." : "Submit for Verification"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
