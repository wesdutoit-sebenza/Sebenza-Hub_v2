import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function AdminSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  // Check if admin already exists
  useEffect(() => {
    const checkAdminExists = async () => {
      try {
        const response = await apiRequest("POST", "/api/admin/setup", {
          email: "test@test.com",
          password: "test123",
          firstName: "Test",
          lastName: "Test",
        });
        // If request succeeds, no admin exists
        setAdminExists(false);
      } catch (error: any) {
        // Parse error message
        const errorMessage = error?.message || "";
        if (errorMessage.includes("Admin setup is disabled") || errorMessage.includes("admin already exists")) {
          setAdminExists(true);
        } else {
          setAdminExists(false);
        }
      }
    };

    checkAdminExists();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/admin/setup", formData);
      const data = await response.json();
      
      toast({
        title: "Success!",
        description: "Admin account created successfully. You can now log in.",
      });
      
      // Redirect to login
      setTimeout(() => {
        setLocation("/login");
      }, 1500);
    } catch (error: any) {
      console.error("Admin setup error:", error);
      
      let errorMessage = "Failed to create admin account.";
      if (error?.message) {
        const match = error.message.match(/\d+:\s*(.+)/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            errorMessage = parsed.message || errorMessage;
          } catch {
            errorMessage = match[1] || errorMessage;
          }
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking
  if (adminExists === null) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-amber" />
      </div>
    );
  }

  // Show error if admin already exists
  if (adminExists) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl text-center" data-testid="text-admin-exists-title">
              Admin Already Exists
            </CardTitle>
            <CardDescription className="text-center" data-testid="text-admin-exists-description">
              An administrator account has already been created. This setup page is now disabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => setLocation("/login")}
              className="w-full bg-amber-gradient text-charcoal"
              data-testid="button-go-to-login"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-amber" />
          </div>
          <CardTitle className="text-2xl text-center" data-testid="text-admin-setup-title">
            Create Admin Account
          </CardTitle>
          <CardDescription className="text-center" data-testid="text-admin-setup-description">
            Set up the first administrator for Sebenza Hub
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  data-testid="input-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  data-testid="input-lastname"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@sebenzahub.com"
                value={formData.email}
                onChange={handleChange}
                required
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                data-testid="input-password"
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-amber-gradient text-charcoal"
              disabled={isLoading}
              data-testid="button-create-admin"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating admin...
                </>
              ) : (
                "Create Admin Account"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>This setup page will be disabled after the first admin is created.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
