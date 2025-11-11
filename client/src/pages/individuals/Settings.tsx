import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChipInput } from "@/components/ui/chip-input";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User, Settings as SettingsIcon, Bell, Shield, Trash2, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { CandidateProfile, IndividualPreferences, IndividualNotificationSettings } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function IndividualSettings() {
  const { toast } = useToast();

  // Fetch preferences
  const { data: preferencesData } = useQuery<{ success: boolean; preferences: IndividualPreferences }>({
    queryKey: ["/api/individual/preferences"],
  });

  // Fetch notification settings
  const { data: notificationsData } = useQuery<{ success: boolean; settings: IndividualNotificationSettings }>({
    queryKey: ["/api/individual/notifications"],
  });

  const preferences = preferencesData?.preferences;
  const notifications = notificationsData?.settings;

  // Preferences State
  const [preferredIndustries, setPreferredIndustries] = useState<string[]>([]);
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [preferredEmploymentTypes, setPreferredEmploymentTypes] = useState<string[]>([]);
  const [desiredSalaryMin, setDesiredSalaryMin] = useState<number>(0);
  const [desiredSalaryMax, setDesiredSalaryMax] = useState<number>(0);
  const [availability, setAvailability] = useState("");
  const [willingToRelocate, setWillingToRelocate] = useState(false);
  const [remotePreference, setRemotePreference] = useState("any");

  // Notification State
  const [emailJobAlerts, setEmailJobAlerts] = useState(true);
  const [emailApplicationUpdates, setEmailApplicationUpdates] = useState(true);
  const [emailWeeklyDigest, setEmailWeeklyDigest] = useState(false);
  const [whatsappJobAlerts, setWhatsappJobAlerts] = useState(false);
  const [whatsappApplicationUpdates, setWhatsappApplicationUpdates] = useState(false);

  // Update state when data loads
  useEffect(() => {
    if (preferences) {
      setPreferredIndustries(preferences.preferredIndustries || []);
      setPreferredLocations(preferences.preferredLocations || []);
      setPreferredEmploymentTypes(preferences.preferredEmploymentTypes || []);
      setDesiredSalaryMin(preferences.desiredSalaryMin || 0);
      setDesiredSalaryMax(preferences.desiredSalaryMax || 0);
      setAvailability(preferences.availability || "");
      setWillingToRelocate(preferences.willingToRelocate === 1);
      setRemotePreference(preferences.remotePreference || "any");
    }
  }, [preferences]);

  useEffect(() => {
    if (notifications) {
      setEmailJobAlerts(notifications.emailJobAlerts === 1);
      setEmailApplicationUpdates(notifications.emailApplicationUpdates === 1);
      setEmailWeeklyDigest(notifications.emailWeeklyDigest === 1);
      setWhatsappJobAlerts(notifications.whatsappJobAlerts === 1);
      setWhatsappApplicationUpdates(notifications.whatsappApplicationUpdates === 1);
    }
  }, [notifications]);

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/individual/preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/individual/preferences"] });
      toast({
        title: "Preferences updated",
        description: "Your job preferences have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update notifications mutation
  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/individual/notifications", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/individual/notifications"] });
      toast({
        title: "Notifications updated",
        description: "Your notification settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update notifications. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/individual/delete-account", {});
    },
    onSuccess: () => {
      toast({
        title: "Deletion request received",
        description: "Your account will be deleted after the grace period.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process deletion request.",
        variant: "destructive",
      });
    },
  });

  const handlePreferencesSubmit = () => {
    updatePreferencesMutation.mutate({
      preferredIndustries,
      preferredLocations,
      preferredEmploymentTypes,
      desiredSalaryMin,
      desiredSalaryMax,
      availability,
      willingToRelocate: willingToRelocate ? 1 : 0,
      remotePreference,
    });
  };

  const handleNotificationsSubmit = () => {
    updateNotificationsMutation.mutate({
      emailJobAlerts: emailJobAlerts ? 1 : 0,
      emailApplicationUpdates: emailApplicationUpdates ? 1 : 0,
      emailWeeklyDigest: emailWeeklyDigest ? 1 : 0,
      whatsappJobAlerts: whatsappJobAlerts ? 1 : 0,
      whatsappApplicationUpdates: whatsappApplicationUpdates ? 1 : 0,
    });
  };

  const industries = [
    "Technology", "Finance", "Healthcare", "Retail", "Manufacturing",
    "Education", "Hospitality", "Construction", "Legal", "Marketing", "Other"
  ];

  const employmentTypes = ["Permanent", "Contract", "Temporary", "Part-time", "Internship"];

  const availabilityOptions = ["Immediate", "1 month notice", "2 months notice", "3+ months notice"];

  const remotePreferences = [
    { value: "remote_only", label: "Remote Only" },
    { value: "hybrid", label: "Hybrid" },
    { value: "office", label: "Office Only" },
    { value: "any", label: "Any" },
  ];

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-settings-title">Settings</h1>
        <p className="text-muted-foreground">
          Manage your job preferences, notifications, and account settings
        </p>
      </div>

      <Tabs defaultValue="preferences" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3" data-testid="tabs-settings">
          <TabsTrigger value="preferences" data-testid="tab-preferences">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="privacy" data-testid="tab-privacy">
            <Shield className="w-4 h-4 mr-2" />
            Privacy
          </TabsTrigger>
        </TabsList>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Job Preferences</CardTitle>
              <CardDescription>
                Customize your job search preferences and requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Preferred Industries</Label>
                <ChipInput
                  value={preferredIndustries}
                  onChange={setPreferredIndustries}
                  placeholder="Add an industry and press Enter"
                  data-testid="chip-input-industries"
                />
                <p className="text-xs text-muted-foreground">
                  Suggestions: {industries.join(", ")}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Preferred Locations</Label>
                <ChipInput
                  value={preferredLocations}
                  onChange={setPreferredLocations}
                  placeholder="Add a location and press Enter"
                  data-testid="chip-input-locations"
                />
              </div>

              <div className="space-y-2">
                <Label>Employment Types</Label>
                <ChipInput
                  value={preferredEmploymentTypes}
                  onChange={setPreferredEmploymentTypes}
                  placeholder="Add an employment type and press Enter"
                  data-testid="chip-input-employment-types"
                />
                <p className="text-xs text-muted-foreground">
                  Suggestions: {employmentTypes.join(", ")}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="salaryMin">Desired Salary (Min) ZAR</Label>
                  <Input
                    id="salaryMin"
                    type="number"
                    value={desiredSalaryMin}
                    onChange={(e) => setDesiredSalaryMin(Number(e.target.value))}
                    placeholder="300000"
                    data-testid="input-salary-min"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salaryMax">Desired Salary (Max) ZAR</Label>
                  <Input
                    id="salaryMax"
                    type="number"
                    value={desiredSalaryMax}
                    onChange={(e) => setDesiredSalaryMax(Number(e.target.value))}
                    placeholder="500000"
                    data-testid="input-salary-max"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="availability">Availability</Label>
                  <Select value={availability} onValueChange={setAvailability}>
                    <SelectTrigger id="availability" data-testid="select-availability">
                      <SelectValue placeholder="Select availability" />
                    </SelectTrigger>
                    <SelectContent>
                      {availabilityOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="remotePreference">Remote Preference</Label>
                  <Select value={remotePreference} onValueChange={setRemotePreference}>
                    <SelectTrigger id="remotePreference" data-testid="select-remote">
                      <SelectValue placeholder="Select preference" />
                    </SelectTrigger>
                    <SelectContent>
                      {remotePreferences.map((pref) => (
                        <SelectItem key={pref.value} value={pref.value}>
                          {pref.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="relocate">Willing to Relocate</Label>
                  <p className="text-sm text-muted-foreground">
                    Open to job opportunities in other cities
                  </p>
                </div>
                <Switch
                  id="relocate"
                  checked={willingToRelocate}
                  onCheckedChange={setWillingToRelocate}
                  data-testid="switch-relocate"
                />
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button
                  onClick={handlePreferencesSubmit}
                  disabled={updatePreferencesMutation.isPending}
                  data-testid="button-save-preferences"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updatePreferencesMutation.isPending ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure how you receive updates about jobs and applications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Email Notifications</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailJobAlerts">Job Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified about new jobs matching your preferences
                      </p>
                    </div>
                    <Switch
                      id="emailJobAlerts"
                      checked={emailJobAlerts}
                      onCheckedChange={setEmailJobAlerts}
                      data-testid="switch-email-job-alerts"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailApplicationUpdates">Application Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Status changes on your job applications
                      </p>
                    </div>
                    <Switch
                      id="emailApplicationUpdates"
                      checked={emailApplicationUpdates}
                      onCheckedChange={setEmailApplicationUpdates}
                      data-testid="switch-email-app-updates"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailWeeklyDigest">Weekly Digest</Label>
                      <p className="text-sm text-muted-foreground">
                        Weekly summary of new opportunities
                      </p>
                    </div>
                    <Switch
                      id="emailWeeklyDigest"
                      checked={emailWeeklyDigest}
                      onCheckedChange={setEmailWeeklyDigest}
                      data-testid="switch-email-digest"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">WhatsApp Notifications</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="whatsappJobAlerts">Job Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive job alerts via WhatsApp
                      </p>
                    </div>
                    <Switch
                      id="whatsappJobAlerts"
                      checked={whatsappJobAlerts}
                      onCheckedChange={setWhatsappJobAlerts}
                      data-testid="switch-whatsapp-job-alerts"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="whatsappApplicationUpdates">Application Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Get application status updates on WhatsApp
                      </p>
                    </div>
                    <Switch
                      id="whatsappApplicationUpdates"
                      checked={whatsappApplicationUpdates}
                      onCheckedChange={setWhatsappApplicationUpdates}
                      data-testid="switch-whatsapp-app-updates"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button
                  onClick={handleNotificationsSubmit}
                  disabled={updateNotificationsMutation.isPending}
                  data-testid="button-save-notifications"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateNotificationsMutation.isPending ? "Saving..." : "Save Notifications"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Data</CardTitle>
              <CardDescription>
                Manage your data and account privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-destructive">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" data-testid="button-delete-account">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete My Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account
                        and remove all your data from our servers including your profile, CVs,
                        and application history.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteAccountMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Yes, delete my account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
