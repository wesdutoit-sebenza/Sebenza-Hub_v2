import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Loader2, CheckCircle } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  // Check for error messages in URL (from magic link verification)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    
    if (error) {
      // Clear the error from URL
      window.history.replaceState({}, '', window.location.pathname);
      
      // Show user-friendly error message
      let title = "Authentication Failed";
      let description = error;
      
      // Check more specific errors first
      if (error.includes('Invalid or expired magic link')) {
        title = "Invalid Link";
        description = "This magic link has already been used or is invalid. Please request a new one.";
      } else if (error.includes('missing token')) {
        title = "Invalid Link";
        description = "The link you clicked is incomplete. Please try requesting a new magic link.";
      } else if (error.includes('expired')) {
        title = "Link Expired";
        description = "Your magic link has expired. Links are valid for 15 minutes. Please request a new one.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  }, [toast]);

  // Redirect if user is already logged in
  useEffect(() => {
    if (!loading && user) {
      setLocation("/onboarding");
    }
  }, [user, loading, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.toLowerCase() }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        setEmailSent(true);
        toast({
          title: "Magic link sent!",
          description: "Check your email for a login link.",
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to send magic link. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Magic link error:", error);
      toast({
        title: "Error",
        description: "Failed to send magic link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTryAgain = () => {
    setEmailSent(false);
    setEmail("");
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-amber/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-amber" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription className="text-base">
              We've sent a magic link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm text-muted-foreground">
                Click the link in the email to sign in. The link will expire in 15 minutes.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Can't find it?</strong> Check your spam folder.
              </p>
            </div>
            <Button 
              onClick={handleTryAgain} 
              variant="outline" 
              className="w-full"
              data-testid="button-try-again"
            >
              Try different email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-[#3e3233] bg-[#1a2328]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Sebenza Hub</CardTitle>
          <CardDescription>
            Enter your email to receive a magic link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={isLoading}
                  data-testid="input-email"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#ae6d0f]" 
              disabled={isLoading || !email}
              data-testid="button-send-magic-link"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send magic link
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              <p>
                We'll send you a secure link to sign in.
                <br />
                No password needed.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
