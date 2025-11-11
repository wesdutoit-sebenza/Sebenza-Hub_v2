import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cvPersonalInfoSchema, type CVPersonalInfo, type User } from "@shared/schema";
import { COUNTRIES, DEFAULT_COUNTRY } from "@shared/countries";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@shared/countryCodes";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import PhotoUpload from "@/components/PhotoUpload";

interface Props {
  data: any;
  updateData: (section: string, data: any) => void;
  onNext: () => void;
  cvId?: string;
}

const provinces = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"];

export default function PersonalInfoStep({ data, updateData, onNext, cvId }: Props) {
  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  // Parse existing phone to separate country code and number
  const parsePhoneNumber = (phone: string) => {
    if (!phone) return { code: DEFAULT_COUNTRY_CODE, number: "" };
    const match = phone.match(/^(\+\d+(?:-\d+)?)\s*(.*)$/);
    if (match) {
      return { code: match[1], number: match[2] };
    }
    return { code: DEFAULT_COUNTRY_CODE, number: phone };
  };

  const initialPhone = parsePhoneNumber(data.personalInfo?.contactPhone || "");
  const [countryCode, setCountryCode] = useState(initialPhone.code);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone.number);
  
  // Photo state
  const [photoUrl, setPhotoUrl] = useState<string | null>(data.photoUrl || null);
  const [includePhoto, setIncludePhoto] = useState(data.includePhoto === 1 || data.includePhoto === true); // Convert integer (0/1) or boolean to boolean

  const form = useForm<CVPersonalInfo>({
    resolver: zodResolver(cvPersonalInfoSchema),
    defaultValues: data.personalInfo || {
      fullName: "",
      physicalAddress: "",
      contactPhone: "",
      contactEmail: "",
      legalName: "",
      age: undefined,
      gender: "",
      driversLicense: "",
      province: "",
      postalCode: "",
      city: "",
      country: DEFAULT_COUNTRY,
    },
  });

  const selectedCountry = form.watch("country");

  // Pre-populate email with user's authentication email if not already set
  useEffect(() => {
    if (user?.email && !data.personalInfo?.contactEmail) {
      form.setValue("contactEmail", user.email);
    }
  }, [user?.email, data.personalInfo?.contactEmail, form]);

  // Update combined phone number whenever country code or number changes
  // Remove leading 0 from phone number before combining with country code
  useEffect(() => {
    let cleanedNumber = phoneNumber.trim();
    if (cleanedNumber.startsWith("0")) {
      cleanedNumber = cleanedNumber.substring(1);
    }
    const combinedPhone = cleanedNumber ? `${countryCode} ${cleanedNumber}` : "";
    form.setValue("contactPhone", combinedPhone);
  }, [countryCode, phoneNumber, form]);

  // Auto-save photo data to CVBuilder state whenever it changes
  useEffect(() => {
    updateData("photoUrl", photoUrl);
    updateData("includePhoto", includePhoto ? 1 : 0);
  }, [photoUrl, includePhoto, updateData]);

  const onSubmit = (formData: CVPersonalInfo) => {
    // Update personal info
    updateData("personalInfo", formData);
    
    // Update photo data separately (convert boolean to number for backend)
    updateData("photoUrl", photoUrl);
    updateData("includePhoto", includePhoto ? 1 : 0);
    
    onNext();
  };

  const handlePhotoChange = (newPhotoUrl: string | null) => {
    setPhotoUrl(newPhotoUrl);
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4" data-testid="text-step-title">Personal Information</h3>
      <p className="text-muted-foreground mb-6">
        Let's start with your basic contact information
      </p>

      {/* Photo Upload Section */}
      <div className="mb-6">
        <PhotoUpload 
          photoUrl={photoUrl} 
          onPhotoChange={handlePhotoChange}
          cvId={cvId}
        />
        
        {photoUrl && (
          <div className="flex items-center gap-2 mt-4 p-4 bg-muted rounded-lg">
            <Switch
              checked={includePhoto}
              onCheckedChange={setIncludePhoto}
              data-testid="switch-include-photo"
            />
            <label htmlFor="include-photo" className="text-sm cursor-pointer">
              Include photo in CV
            </label>
          </div>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Wes du Toit" data-testid="input-full-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="physicalAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Physical Address</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. 12 Blackrock, 221 Main Road, Cape Town"
                    data-testid="input-address"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Johannesburg" data-testid="input-city" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="province"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Province / State</FormLabel>
                  {selectedCountry === "South Africa" ? (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-province">
                          <SelectValue placeholder="Select province" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {provinces.map((province) => (
                          <SelectItem key={province} value={province}>
                            {province}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input placeholder="Enter province or state" data-testid="input-province" {...field} />
                    </FormControl>
                  )}
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
                    <Input placeholder="e.g., 2000" data-testid="input-postal-code" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
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
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="e.g. your.email@example.com"
                      data-testid="input-email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Telephone *</FormLabel>
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
                  placeholder="e.g. 082 552 0536"
                  data-testid="input-phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="flex-1"
                />
              </div>
              <FormField
                control={form.control}
                name="contactPhone"
                render={() => (
                  <FormItem className="hidden">
                    <FormControl>
                      <input type="hidden" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormItem>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="legalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Legal Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Wesly John du Toit" data-testid="input-legal-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="age"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Age</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g. 46"
                      data-testid="input-age"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Male" data-testid="input-gender" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="driversLicense"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Driver's License Code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. EB" data-testid="input-license" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" className="w-full" data-testid="button-continue">
            Continue to Work Experience
          </Button>
        </form>
      </Form>
    </div>
  );
}
