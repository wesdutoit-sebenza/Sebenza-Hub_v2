import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CheckCircle, XCircle } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

type CalendarProvider = 'google' | 'microsoft' | 'zoom';

export default function RecruiterSettings() {
  const { toast } = useToast();
  const [location] = useLocation();

  // Check for calendar connection result in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarStatus = params.get('calendar');
    
    if (calendarStatus === 'success') {
      toast({
        title: "Calendar Connected",
        description: "Your calendar has been successfully connected!",
      });
      window.history.replaceState({}, '', window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/status'] });
    } else if (calendarStatus === 'error') {
      toast({
        title: "Connection Failed",
        description: "Failed to connect your calendar. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location, toast]);

  // Get calendar connection status for all providers
  const { data: calendarStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ['/api/calendar/status'],
  });

  // Connect calendar mutation
  const connectMutation = useMutation({
    mutationFn: async (provider: CalendarProvider) => {
      const response = await fetch(`/api/calendar/${provider}/connect`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to initiate calendar connection');
      }
      
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: () => {
      toast({
        title: "Connection Error",
        description: "Failed to initiate calendar connection. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Disconnect calendar mutation
  const disconnectMutation = useMutation({
    mutationFn: async (provider: CalendarProvider) => {
      await apiRequest(`/api/calendar/${provider}/disconnect`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/status'] });
      toast({
        title: "Calendar Disconnected",
        description: "Your calendar has been disconnected.",
      });
    },
    onError: () => {
      toast({
        title: "Disconnection Error",
        description: "Failed to disconnect calendar. Please try again.",
        variant: "destructive",
      });
    },
  });

  const googleConnected = calendarStatus?.google?.connected;
  const googleEmail = calendarStatus?.google?.email;
  const microsoftConnected = calendarStatus?.microsoft?.connected;
  const microsoftEmail = calendarStatus?.microsoft?.email;
  const zoomConnected = calendarStatus?.zoom?.connected;
  const zoomEmail = calendarStatus?.zoom?.email;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" data-testid="heading-settings">Recruiter Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure your calendar integrations and account settings
        </p>
      </div>

      <div className="grid gap-6">
        {/* Google Calendar Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Google Calendar & Meet
            </CardTitle>
            <CardDescription>
              Connect your Google Calendar to schedule interviews with Google Meet links
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStatus ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading connection status...
              </div>
            ) : googleConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900 dark:text-green-100">
                      Connected
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300" data-testid="text-google-email">
                      {googleEmail}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  onClick={() => disconnectMutation.mutate('google')}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-disconnect-google"
                >
                  {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect Google Calendar"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      Not Connected
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Connect to schedule interviews with Google Meet
                    </p>
                  </div>
                </div>
                
                <Button
                  onClick={() => connectMutation.mutate('google')}
                  disabled={connectMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-connect-google"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {connectMutation.isPending ? "Connecting..." : "Connect Google Calendar"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Microsoft Teams Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Microsoft Teams & Outlook
            </CardTitle>
            <CardDescription>
              Connect your Microsoft account to schedule interviews with Teams meetings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStatus ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading connection status...
              </div>
            ) : microsoftConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900 dark:text-green-100">
                      Connected
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300" data-testid="text-microsoft-email">
                      {microsoftEmail}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  onClick={() => disconnectMutation.mutate('microsoft')}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-disconnect-microsoft"
                >
                  {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect Microsoft"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      Not Connected
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Connect to schedule interviews with Microsoft Teams
                    </p>
                  </div>
                </div>
                
                <Button
                  onClick={() => connectMutation.mutate('microsoft')}
                  disabled={connectMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-connect-microsoft"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {connectMutation.isPending ? "Connecting..." : "Connect Microsoft Teams"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Zoom Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Zoom Meetings
            </CardTitle>
            <CardDescription>
              Connect your Zoom account to schedule interviews with Zoom meetings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStatus ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading connection status...
              </div>
            ) : zoomConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900 dark:text-green-100">
                      Connected
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300" data-testid="text-zoom-email">
                      {zoomEmail}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  onClick={() => disconnectMutation.mutate('zoom')}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-disconnect-zoom"
                >
                  {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect Zoom"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      Not Connected
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Connect to schedule interviews with Zoom
                    </p>
                  </div>
                </div>
                
                <Button
                  onClick={() => connectMutation.mutate('zoom')}
                  disabled={connectMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-connect-zoom"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {connectMutation.isPending ? "Connecting..." : "Connect Zoom"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>
              Manage how you receive updates and alerts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <p>Settings options coming soon.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>
              Manage your account preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <p>Account settings coming soon.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
