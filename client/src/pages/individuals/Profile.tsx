import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User, Briefcase, MapPin, Mail, Phone, Save, Edit } from "lucide-react";
import { type User as UserType } from "@shared/schema";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@shared/countryCodes";
import { COUNTRIES } from "@shared/countries";
import { CITIES_BY_PROVINCE, getLocationDataForCity } from "@shared/cities";
import { GoogleAddressSearch } from "@/components/GoogleAddressSearch";

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

interface ProfileData {
  id: string;
  userId: string;
  fullName: string;
  province: string;
  postalCode: string | null;
  city: string;
  country: string;
  physicalAddress: string | null;
  email: string | null;
  telephone: string | null;
  jobTitle: string;
  experienceLevel: string;
  skills: string[];
  cvUrl: string | null;
  isPublic: number;
  popiaConsentGiven: number;
  popiaConsentDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export default function IndividualProfile() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");

  // Parse existing telephone to separate country code and number
  const parsePhoneNumber = (telephone: string) => {
    if (!telephone) return { code: DEFAULT_COUNTRY_CODE, number: "" };
    const match = telephone.match(/^(\+\d+(?:-\d+)?)\s*(.*)$/);
    if (match) {
      return { code: match[1], number: match[2] };
    }
    return { code: DEFAULT_COUNTRY_CODE, number: telephone };
  };

  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneNumber, setPhoneNumber] = useState("");

  const { data: user } = useQuery<UserType>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const { data, isLoading } = useQuery<{ profile: ProfileData | null }>({
    queryKey: ["/api/individuals/profile"],
    enabled: !!user,
  });

  const form = useForm({
    defaultValues: {
      fullName: "",
      email: "",
      telephone: "",
      city: "",
      province: "",
      postalCode: "",
      country: "",
      physicalAddress: "",
      jobTitle: "",
      experienceLevel: "",
    },
  });

  // Filtered cities based on search query
  const filteredCities = citySearchQuery
    ? CITIES_BY_PROVINCE.map((provinceData) => ({
        province: provinceData.province,
        cities: provinceData.cities.filter((cityData) =>
          cityData.city.toLowerCase().includes(citySearchQuery.toLowerCase())
        ),
      })).filter((provinceData) => provinceData.cities.length > 0)
    : CITIES_BY_PROVINCE;

  // Update form when data loads
  useEffect(() => {
    if (data?.profile) {
      const profile = data.profile;
      
      // Parse telephone number
      const parsedPhone = parsePhoneNumber(profile.telephone || "");
      setCountryCode(parsedPhone.code);
      setPhoneNumber(parsedPhone.number);
      
      form.reset({
        fullName: profile.fullName || "",
        email: profile.email || "",
        telephone: profile.telephone || "",
        city: profile.city || "",
        province: profile.province || "",
        postalCode: profile.postalCode || "",
        country: profile.country || "",
        physicalAddress: profile.physicalAddress || "",
        jobTitle: profile.jobTitle || "",
        experienceLevel: profile.experienceLevel || "",
      });
    }
  }, [data?.profile, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: any) => {
      // Remove leading 0 from phone number before combining with country code
      let cleanPhone = phoneNumber.trim();
      if (cleanPhone.startsWith("0")) {
        cleanPhone = cleanPhone.substring(1);
      }
      const fullTelephone = cleanPhone ? `${countryCode} ${cleanPhone}` : "";
      
      return apiRequest("PUT", "/api/individuals/profile", {
        fullName: values.fullName,
        email: values.email,
        telephone: fullTelephone,
        city: values.city,
        province: values.province,
        postalCode: values.postalCode,
        country: values.country,
        physicalAddress: values.physicalAddress,
        jobTitle: values.jobTitle,
        experienceLevel: values.experienceLevel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/individuals/profile"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Failed to update profile. Please try again.",
      });
    },
  });

  const onSubmit = (values: any) => {
    updateMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No profile found. Please complete your onboarding.</p>
            <Button onClick={() => navigate("/onboarding/individual")} className="mt-4" data-testid="button-onboarding">
              Complete Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profile = data.profile;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-profile-title">
            My Profile
          </h1>
          <p className="text-muted-foreground">View and manage your professional information</p>
        </div>
        <Button
          onClick={() => setIsEditing(!isEditing)}
          variant={isEditing ? "outline" : "default"}
          data-testid="button-edit-toggle"
        >
          <Edit className="h-4 w-4 mr-2" />
          {isEditing ? "Cancel" : "Edit Profile"}
        </Button>
      </div>

      {isEditing ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-full-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-job-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="experienceLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experience Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-experience-level">
                            <SelectValue placeholder="Select experience level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="entry">Entry Level</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="senior">Senior</SelectItem>
                          <SelectItem value="executive">Executive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <FormLabel>Telephone</FormLabel>
                    <div className="flex gap-2">
                      <Select value={countryCode} onValueChange={setCountryCode}>
                        <SelectTrigger className="w-[180px]" data-testid="select-country-code">
                          <SelectValue placeholder="Code" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {COUNTRY_CODES.map((cc) => (
                            <SelectItem key={cc.code} value={cc.dialCode}>
                              {cc.dialCode} {cc.country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="tel"
                        placeholder="e.g. 082 123 4567"
                        data-testid="input-phone"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </FormItem>
                </div>
              </CardContent>
            </Card>

            {/* Location Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

            <Button type="submit" disabled={updateMutation.isPending} className="w-full" data-testid="button-save">
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>
      ) : (
        <div className="space-y-6">
          {/* Personal Information View */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="text-base font-medium" data-testid="text-full-name">{profile.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Job Title</p>
                <p className="text-base font-medium flex items-center gap-2" data-testid="text-job-title">
                  <Briefcase className="h-4 w-4" />
                  {profile.jobTitle}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Experience Level</p>
                <Badge variant="secondary" className="mt-1" data-testid="badge-experience-level">
                  {profile.experienceLevel.charAt(0).toUpperCase() + profile.experienceLevel.slice(1)}
                </Badge>
              </div>
              {profile.skills && profile.skills.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((skill, index) => (
                      <Badge key={index} variant="outline" data-testid={`badge-skill-${index}`}>
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact Information View */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.email && (
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-base font-medium flex items-center gap-2" data-testid="text-email">
                    <Mail className="h-4 w-4" />
                    {profile.email}
                  </p>
                </div>
              )}
              {profile.telephone && (
                <div>
                  <p className="text-sm text-muted-foreground">Telephone</p>
                  <p className="text-base font-medium flex items-center gap-2" data-testid="text-telephone">
                    <Phone className="h-4 w-4" />
                    {profile.telephone}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location View */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="text-base font-medium" data-testid="text-location">
                  {profile.city}, {profile.province}
                  {profile.postalCode && `, ${profile.postalCode}`}
                  <br />
                  {profile.country}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
