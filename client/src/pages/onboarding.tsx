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
    onSuccess: async (_, role) => {
      // Invalidate and refetch user data
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      await queryClient.refetchQueries({ queryKey: ['/api/auth/user'] });
      
      // Redirect to role-specific onboarding page to complete profile
      if (role === 'individual') {
        setLocation('/onboarding/individual');
      } else if (role === 'business') {
        setLocation('/onboarding/business');
      } else if (role === 'recruiter') {
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
          setLocation('/settings/business');
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
      <div className="max-w-6xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3 text-white" data-testid="text-onboarding-title">
            Welcome to Sebenza Hub
          </h1>
          <p className="text-lg text-white" data-testid="text-onboarding-description">
            How will you use the platform?
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card 
            className="hover-elevate active-elevate-2 cursor-pointer transition-all duration-300 hover:scale-105 flex flex-col" 
            onClick={() => handleSelectRole('individual')} 
            data-testid="card-role-individual"
          >
            <CardHeader className="text-center pt-8 pb-6 px-6 flex-1">
              <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-amber/20 flex items-center justify-center shadow-lg ring-2 ring-amber/30">
                <UserCircle className="h-12 w-12 text-amber" />
              </div>
              <CardTitle className="text-2xl font-bold mb-3 text-slate">I'm a Job Seeker</CardTitle>
              <CardDescription className="text-base text-slate leading-relaxed">
                Ready to find my next career move.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8 px-6">
              <Button
                className="w-full min-h-12 bg-amber-gradient text-charcoal font-semibold text-base"
                disabled={selectRoleMutation.isPending}
                data-testid="button-select-individual"
              >
                {selectRoleMutation.isPending && selectedRole === 'individual' ? 'Setting up...' : 'Get Started'}
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="hover-elevate active-elevate-2 cursor-pointer transition-all duration-300 hover:scale-105 flex flex-col" 
            onClick={() => handleSelectRole('recruiter')} 
            data-testid="card-role-recruiter"
          >
            <CardHeader className="text-center pt-8 pb-6 px-6 flex-1">
              <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-amber/20 flex items-center justify-center shadow-lg ring-2 ring-amber/30">
                <Briefcase className="h-12 w-12 text-amber" />
              </div>
              <CardTitle className="text-2xl font-bold mb-3 text-slate">We are a recruiting agency</CardTitle>
              <CardDescription className="text-base text-slate leading-relaxed">
                Looking to connect great talent with top roles.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8 px-6">
              <Button
                className="w-full min-h-12 bg-amber-gradient text-charcoal font-semibold text-base"
                disabled={selectRoleMutation.isPending}
                data-testid="button-select-recruiter"
              >
                {selectRoleMutation.isPending && selectedRole === 'recruiter' ? 'Setting up...' : 'Get Started'}
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="hover-elevate active-elevate-2 cursor-pointer transition-all duration-300 hover:scale-105 flex flex-col" 
            onClick={() => handleSelectRole('business')} 
            data-testid="card-role-business"
          >
            <CardHeader className="text-center pt-8 pb-6 px-6 flex-1">
              <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-amber/20 flex items-center justify-center shadow-lg ring-2 ring-amber/30">
                <Building2 className="h-12 w-12 text-amber" />
              </div>
              <CardTitle className="text-2xl font-bold mb-3 text-slate">We hire for our company</CardTitle>
              <CardDescription className="text-base text-slate leading-relaxed">
                We are hiring and ready to grow our team.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8 px-6">
              <Button
                className="w-full min-h-12 bg-amber-gradient text-charcoal font-semibold text-base"
                disabled={selectRoleMutation.isPending}
                data-testid="button-select-business"
              >
                {selectRoleMutation.isPending && selectedRole === 'business' ? 'Setting up...' : 'Get Started'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
