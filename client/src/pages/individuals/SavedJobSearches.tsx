import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Save, Search } from "lucide-react";

export default function SavedJobSearches() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Saved Job Searches</h1>
        <p className="text-muted-foreground">
          Quick access to your frequently used search criteria
        </p>
      </div>

      <div className="bg-graphite rounded-lg p-8">
        <div className="text-center mb-6">
          <Save className="h-16 w-16 mx-auto mb-4 text-amber-500" />
          <h2 className="text-3xl font-bold text-white mb-2">Your Saved Searches</h2>
          <p className="text-white/80">
            Quickly access and run your frequently used search criteria
          </p>
        </div>

        <div className="space-y-4">
          <Card className="bg-white/95 hover-elevate" data-testid="saved-search-example-1">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-1">Software Developer in Cape Town</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Technology • Cape Town • Permanent • Min R30,000
                  </p>
                </div>
                <Badge variant="secondary">5 new jobs</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button className="flex-1" data-testid="button-view-saved-search-1">
                  <Search className="h-4 w-4 mr-2" />
                  View Results
                </Button>
                <Button variant="outline" size="icon" data-testid="button-delete-saved-search-1">
                  <span className="sr-only">Delete</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 hover-elevate" data-testid="saved-search-example-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-1">Project Manager - Remote</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Any Industry • Remote • Permanent • Min R40,000
                  </p>
                </div>
                <Badge variant="secondary">2 new jobs</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button className="flex-1" data-testid="button-view-saved-search-2">
                  <Search className="h-4 w-4 mr-2" />
                  View Results
                </Button>
                <Button variant="outline" size="icon" data-testid="button-delete-saved-search-2">
                  <span className="sr-only">Delete</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 hover-elevate" data-testid="saved-search-example-3">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-1">Data Analyst in Johannesburg</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Finance • Johannesburg • Contract • Min R35,000
                  </p>
                </div>
                <Badge variant="secondary">8 new jobs</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button className="flex-1" data-testid="button-view-saved-search-3">
                  <Search className="h-4 w-4 mr-2" />
                  View Results
                </Button>
                <Button variant="outline" size="icon" data-testid="button-delete-saved-search-3">
                  <span className="sr-only">Delete</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/95">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                Save your searches from the Manual Job Search page to quickly access them here
              </p>
              <Button variant="outline" data-testid="button-go-to-manual-search">
                Go to Manual Search
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
