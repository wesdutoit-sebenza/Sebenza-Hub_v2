import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Briefcase, Building2, UserCircle } from "lucide-react";
import type { User } from "@shared/schema";

type UserRole = 'individual' | 'business' | 'recruiter';

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const selectRoleMutation = useMutation({
    mutationFn: async (role: UserRole) => {
      const res = await apiRequest('POST', '/api/me/role', { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      if (selectedRole === 'individual') {
        setLocation('/onboarding/individual');
      } else if (selectedRole === 'business') {
        setLocation('/onboarding/business');
      } else if (selectedRole === 'recruiter') {
        setLocation('/onboarding/recruiter');
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to select role. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!authLoading && !user) {
      setLocation('/login');
      return;
    }

    // If user has already completed onboarding, go to role-specific dashboard
    if (!authLoading && user) {
      const role = user.role;
      const onboarding = user.onboardingComplete || 0;

      if (role && onboarding === 1) {
        if (role === 'individual') {
          setLocation('/dashboard/individual/profile');
        } else if (role === 'recruiter') {
          setLocation('/dashboard/recruiter/profile');
        } else if (role === 'business') {
          setLocation('/');
        } else if (role === 'admin') {
          setLocation('/admin/overview');
        }
      }
    }
  }, [user, authLoading, setLocation]);

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    selectRoleMutation.mutate(role);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <p className="text-slate">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-white-brand" data-testid="text-onboarding-title">
            Welcome to Sebenza Hub
          </h1>
          <p className="text-slate" data-testid="text-onboarding-description">
            How will you use the platform?
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="hover-elevate cursor-pointer" onClick={() => handleSelectRole('individual')} data-testid="card-role-individual">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber/10 flex items-center justify-center">
                <UserCircle className="h-8 w-8 text-amber" />
              </div>
              <CardTitle className="text-white-brand">Find a Job</CardTitle>
              <CardDescription className="text-slate">
                I'm looking for employment opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full bg-amber-gradient text-charcoal hover:opacity-90"
                disabled={selectRoleMutation.isPending}
                data-testid="button-select-individual"
              >
                {selectRoleMutation.isPending && selectedRole === 'individual' ? 'Setting up...' : 'Get Started'}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => handleSelectRole('business')} data-testid="card-role-business">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-amber" />
              </div>
              <CardTitle className="text-white-brand">Hire for My Company</CardTitle>
              <CardDescription className="text-slate">
                I need to find talent for my business
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full bg-amber-gradient text-charcoal hover:opacity-90"
                disabled={selectRoleMutation.isPending}
                data-testid="button-select-business"
              >
                {selectRoleMutation.isPending && selectedRole === 'business' ? 'Setting up...' : 'Get Started'}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => handleSelectRole('recruiter')} data-testid="card-role-recruiter">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber/10 flex items-center justify-center">
                <Briefcase className="h-8 w-8 text-amber" />
              </div>
              <CardTitle className="text-white-brand">I'm a Recruiter</CardTitle>
              <CardDescription className="text-slate">
                I run a recruiting agency or firm
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full bg-amber-gradient text-charcoal hover:opacity-90"
                disabled={selectRoleMutation.isPending}
                data-testid="button-select-recruiter"
              >
                {selectRoleMutation.isPending && selectedRole === 'recruiter' ? 'Setting up...' : 'Get Started'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
