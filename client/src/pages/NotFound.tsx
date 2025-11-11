import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function NotFound() {
  useEffect(() => {
    document.title = "Page Not Found | Sebenza Hub";
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-serif font-semibold mb-4" data-testid="text-404">
          404
        </h1>
        <h2 className="text-2xl font-semibold mb-4" data-testid="text-not-found-title">
          Page not found
        </h2>
        <p className="text-muted-foreground mb-8" data-testid="text-not-found-description">
          Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>
        <Link href="/">
          <Button data-testid="button-home">
            Go back home
          </Button>
        </Link>
      </div>
    </div>
  );
}
