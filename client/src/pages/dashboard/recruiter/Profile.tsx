import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { COUNTRY_CODES } from "@shared/countryCodes";
import { useEffect } from "react";

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
});

type FormData = z.infer<typeof formSchema>;

export default function RecruiterProfile() {
  const { toast } = useToast();

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["/api/profile/recruiter"],
  });

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
    },
  });

  useEffect(() => {
    if (profileData) {
      const telephone = (profileData as any).telephone || "";
      const parts = telephone.split(" ");
      const countryCode = parts[0] || "+27";
      const phoneNumber = parts.slice(1).join(" ");

      form.reset({
        agencyName: (profileData as any).agencyName || "",
        website: (profileData as any).website || "",
        email: (profileData as any).email || "",
        telephoneCountryCode: countryCode,
        telephoneNumber: phoneNumber,
        sectors: (profileData as any).sectors || [],
      });
    }
  }, [profileData, form]);

  useEffect(() => {
    if ((userData as any)?.email && !(profileData as any)?.email) {
      form.setValue("email", (userData as any).email);
    }
  }, [userData, profileData, form]);

  const updateProfileMutation = useMutation({
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
      };

      const res = await apiRequest('PUT', '/api/profile/recruiter', payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/recruiter"] });
      toast({
        title: "Profile updated",
        description: "Your recruiter profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    updateProfileMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Recruiter Profile</h1>
        <p className="text-muted-foreground mt-2">
          Manage your agency information and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agency Information</CardTitle>
          <CardDescription>
            Update your agency details and industry sectors
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
                        placeholder="Your Agency Name"
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
                        placeholder="www.youragency.co.za"
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
                      <Select onValueChange={field.onChange} value={field.value}>
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

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save-profile"
                >
                  {updateProfileMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
