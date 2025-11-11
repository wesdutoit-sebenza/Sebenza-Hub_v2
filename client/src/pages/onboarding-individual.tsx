import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { JOB_TITLES_BY_INDUSTRY } from "@shared/jobTitles";
import { SkillsMultiSelect } from "@/components/SkillsMultiSelect";
import { COUNTRIES, DEFAULT_COUNTRY } from "@shared/countries";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@shared/countryCodes";
import { CITIES_BY_PROVINCE, getLocationDataForCity } from "@shared/cities";
import { GoogleAddressSearch } from "@/components/GoogleAddressSearch";
import { useEffect, useState } from "react";
import type { User } from "@shared/schema";

const formSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  surname: z.string().min(2, "Surname must be at least 2 characters"),
  province: z.string().min(1, "Please select a province"),
  postalCode: z.string().optional(),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Please select a country"),
  physicalAddress: z.string().optional(),
  email: z.string().email("Valid email is required").optional(),
  countryCode: z.string().default(DEFAULT_COUNTRY_CODE),
  telephone: z.string().optional(),
  jobTitle: z.string().min(1, "Please select a job title"),
  customJobTitle: z.string().optional(),
  experienceLevel: z.enum(['entry', 'intermediate', 'senior', 'executive']),
  skills: z.array(z.string()).min(1, "Please select at least one skill").max(10, "Maximum 10 skills allowed"),
  isPublic: z.boolean().default(true),
  dataConsent: z.boolean().refine((val) => val === true, {
    message: "You must agree to the data collection policy (POPIA compliance)",
  }),
}).refine((data) => {
  if (data.jobTitle === "Other" && !data.customJobTitle) {
    return false;
  }
  return true;
}, {
  message: "Please specify your job title",
  path: ["customJobTitle"],
});

type FormData = z.infer<typeof formSchema>;

export default function OnboardingIndividual() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [jobTitleDropdownOpen, setJobTitleDropdownOpen] = useState(false);
  const [jobTitleSearchQuery, setJobTitleSearchQuery] = useState("");

  const { data: userData } = useQuery<{ user: User }>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const user = userData?.user;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      surname: "",
      province: "",
      postalCode: "",
      city: "",
      country: DEFAULT_COUNTRY,
      physicalAddress: "",
      email: "",
      countryCode: DEFAULT_COUNTRY_CODE,
      telephone: "",
      jobTitle: "",
      customJobTitle: "",
      experienceLevel: "entry",
      skills: [],
      isPublic: true,
      dataConsent: false,
    },
  });

  // Pre-populate email with user's authentication email
  useEffect(() => {
    if (user?.email) {
      form.setValue("email", user.email);
    }
  }, [user?.email, form]);

  const selectedJobTitle = form.watch("jobTitle");
  const selectedCountry = form.watch("country");

  // Filtered cities based on search query
  const filteredCities = citySearchQuery
    ? CITIES_BY_PROVINCE.map((provinceData) => ({
        province: provinceData.province,
        cities: provinceData.cities.filter((cityData) =>
          cityData.city.toLowerCase().includes(citySearchQuery.toLowerCase())
        ),
      })).filter((provinceData) => provinceData.cities.length > 0)
    : CITIES_BY_PROVINCE;

  // Filtered job titles based on search query
  const filteredJobTitles = jobTitleSearchQuery
    ? JOB_TITLES_BY_INDUSTRY.map((category) => ({
        industry: category.industry,
        titles: category.titles.filter((title) =>
          title.toLowerCase().includes(jobTitleSearchQuery.toLowerCase())
        ),
      })).filter((category) => category.titles.length > 0)
    : JOB_TITLES_BY_INDUSTRY;

  const createProfileMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const fullName = `${data.firstName} ${data.surname}`;
      const finalJobTitle = data.jobTitle === "Other" ? data.customJobTitle || "" : data.jobTitle;
      
      // Remove leading 0 from telephone number before combining with country code
      let phoneNumber = data.telephone ? data.telephone.trim() : "";
      if (phoneNumber.startsWith("0")) {
        phoneNumber = phoneNumber.substring(1);
      }
      const fullTelephone = phoneNumber ? `${data.countryCode} ${phoneNumber}` : "";
      
      const res = await apiRequest('POST', '/api/profile/candidate', {
        fullName,
        province: data.province,
        postalCode: data.postalCode,
        city: data.city,
        country: data.country,
        physicalAddress: data.physicalAddress,
        email: data.email,
        telephone: fullTelephone,
        jobTitle: finalJobTitle,
        experienceLevel: data.experienceLevel,
        skills: data.skills,
        isPublic: data.isPublic ? 1 : 0,
        popiaConsentGiven: data.dataConsent ? 1 : 0,
      });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate user cache to refresh role and onboarding status
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      toast({
        title: "Profile created!",
        description: "Your job seeker profile is ready.",
      });
      setLocation('/dashboard/individual/profile');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createProfileMutation.mutate(data);
  };

  const provinces = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"];

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full">
        <CardHeader>
          <CardTitle data-testid="text-onboarding-individual-title">Set Up Your Job Seeker Profile</CardTitle>
          <CardDescription className="text-slate" data-testid="text-onboarding-individual-description">
            Tell us about yourself so employers can find you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="surname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Surname</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-surname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Location Fields - matching Job Posting form */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City / Town *</FormLabel>
                      <Popover open={cityDropdownOpen} onOpenChange={setCityDropdownOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={cityDropdownOpen}
                              className="w-full justify-between text-left font-normal"
                              data-testid="select-city"
                            >
                              <span className={field.value ? "" : "text-muted-foreground"}>
                                {field.value || "Select city / town"}
                              </span>
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Search cities..."
                              value={citySearchQuery}
                              onValueChange={setCitySearchQuery}
                              data-testid="input-city-search"
                            />
                            <CommandList className="max-h-[300px]">
                              <CommandEmpty>No cities found.</CommandEmpty>
                              {filteredCities.map((provinceData) => (
                                <CommandGroup
                                  key={provinceData.province}
                                  heading={provinceData.province}
                                >
                                  {provinceData.cities.map((cityData) => (
                                    <CommandItem
                                      key={`${provinceData.province}-${cityData.city}`}
                                      value={cityData.city}
                                      onSelect={() => {
                                        field.onChange(cityData.city);
                                        // Auto-fill province and postal code based on selected city
                                        const locationData = getLocationDataForCity(cityData.city);
                                        if (locationData) {
                                          form.setValue("province", locationData.province);
                                          form.setValue("postalCode", locationData.postalCode);
                                        }
                                        setCityDropdownOpen(false);
                                        setCitySearchQuery("");
                                      }}
                                      className="cursor-pointer"
                                      data-testid={`city-option-${cityData.city}`}
                                    >
                                      {cityData.city}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              ))}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled
                          placeholder="Select a city to auto-fill"
                          data-testid="input-province"
                          className="bg-muted"
                        />
                      </FormControl>
                      <FormDescription>Auto-filled based on selected city</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled
                          placeholder="Select a city to auto-fill"
                          data-testid="input-postal-code"
                          className="bg-muted"
                        />
                      </FormControl>
                      <FormDescription>Auto-filled based on selected city</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="physicalAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Physical Address (Google Search)</FormLabel>
                    <FormControl>
                      <GoogleAddressSearch
                        value={field.value}
                        onChange={(address, placeDetails) => {
                          field.onChange(address);
                          // Optionally auto-fill city, province, postal code from Google Maps
                          if (placeDetails?.address_components) {
                            const components = placeDetails.address_components;
                            const city = components.find(c => c.types.includes('locality'))?.long_name;
                            const province = components.find(c => c.types.includes('administrative_area_level_1'))?.long_name;
                            const postalCode = components.find(c => c.types.includes('postal_code'))?.long_name;
                            
                            if (city && province && postalCode) {
                              // Check if this matches our SA cities data
                              const locationData = getLocationDataForCity(city);
                              if (locationData) {
                                form.setValue("city", city);
                                form.setValue("province", locationData.province);
                                form.setValue("postalCode", locationData.postalCode);
                              }
                            }
                          }
                        }}
                        placeholder="Start typing an address..."
                        data-testid="input-physical-address"
                      />
                    </FormControl>
                    <FormDescription>
                      Start typing to search for an address. This will auto-fill city, province, and postal code.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="email" 
                          readOnly 
                          className="bg-muted cursor-not-allowed"
                          data-testid="input-email" 
                        />
                      </FormControl>
                      <FormDescription>
                        Your login email address
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Telephone</FormLabel>
                  <div className="flex gap-2">
                    <FormField
                      control={form.control}
                      name="countryCode"
                      render={({ field }) => (
                        <FormItem className="w-[180px]">
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-country-code">
                                <SelectValue placeholder="Code" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[300px]">
                              {COUNTRY_CODES.map((cc) => (
                                <SelectItem key={cc.code} value={cc.dialCode}>
                                  {cc.dialCode} {cc.country}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="telephone"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input {...field} type="tel" placeholder="e.g., 082 123 4567" data-testid="input-telephone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </FormItem>
              </div>

              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title / Role</FormLabel>
                    <Popover open={jobTitleDropdownOpen} onOpenChange={setJobTitleDropdownOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={jobTitleDropdownOpen}
                            className="w-full justify-between text-left font-normal"
                            data-testid="select-job-title"
                          >
                            <span className={field.value ? "" : "text-muted-foreground"}>
                              {field.value || "Select your job title"}
                            </span>
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Search job titles..."
                            value={jobTitleSearchQuery}
                            onValueChange={setJobTitleSearchQuery}
                            data-testid="input-job-title-search"
                          />
                          <CommandList className="max-h-[300px]">
                            <CommandEmpty>No job titles found.</CommandEmpty>
                            {filteredJobTitles.map((category) => (
                              <CommandGroup
                                key={category.industry}
                                heading={category.industry}
                                className="[&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-semibold"
                              >
                                {category.titles.map((title) => (
                                  <CommandItem
                                    key={title}
                                    value={title}
                                    onSelect={() => {
                                      field.onChange(title);
                                      setJobTitleDropdownOpen(false);
                                      setJobTitleSearchQuery("");
                                    }}
                                    className="cursor-pointer"
                                    data-testid={`job-title-option-${title}`}
                                  >
                                    {title}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedJobTitle === "Other" && (
                <FormField
                  control={form.control}
                  name="customJobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specify Job Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter your job title" data-testid="input-custom-job-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="experienceLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Experience Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-experience-level">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="entry">Entry Level (0-2 years)</SelectItem>
                        <SelectItem value="intermediate">Intermediate (3-5 years)</SelectItem>
                        <SelectItem value="senior">Senior (6+ years)</SelectItem>
                        <SelectItem value="executive">Executive / Leadership</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="skills"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skills</FormLabel>
                    <FormControl>
                      <SkillsMultiSelect
                        value={field.value}
                        onChange={field.onChange}
                        maxSkills={10}
                        placeholder="Select your skills..."
                      />
                    </FormControl>
                    <FormDescription>
                      Select up to 10 skills from the list
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-is-public"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Make my profile visible to employers
                      </FormLabel>
                      <FormDescription>
                        Recruiters and employers can find and contact you
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dataConsent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-data-consent"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        I agree to the collection of my personal data
                      </FormLabel>
                      <FormDescription>
                        Required for POPIA (Protection of Personal Information Act) compliance. We will store and use your data only to connect you with job opportunities.
                      </FormDescription>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-amber-gradient text-charcoal hover:opacity-90"
                disabled={createProfileMutation.isPending}
                data-testid="button-complete-onboarding"
              >
                {createProfileMutation.isPending ? "Creating profile..." : "Complete Setup"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
