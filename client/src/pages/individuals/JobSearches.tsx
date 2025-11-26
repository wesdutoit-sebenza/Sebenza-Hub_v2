import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, MapPin, DollarSign, Clock, Search, Filter, ExternalLink, FileText, Sparkles, Save, Bell } from "lucide-react";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  description: string;
  requirements: string;
  whatsappContact: string;
  employmentType: string;
  industry: string;
  createdAt: Date;
}

export default function IndividualJobSearches() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: jobsData, isLoading } = useQuery<{ success: boolean; jobs: Job[] }>({
    queryKey: ["/api/jobs?status=Live"],
  });

  const locations = jobsData?.jobs
    ? Array.from(new Set(jobsData.jobs.map(job => job.location)))
    : [];
  
  const industries = jobsData?.jobs
    ? Array.from(new Set(jobsData.jobs.map(job => job.industry)))
    : [];

  const employmentTypes = jobsData?.jobs
    ? Array.from(new Set(jobsData.jobs.map(job => job.employmentType)))
    : [];

  const filteredJobs = jobsData?.jobs?.filter(job => {
    const matchesSearch = searchQuery === "" || 
      job.title?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
      job.company?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
      job.description?.toLowerCase()?.includes(searchQuery.toLowerCase());
    
    const matchesLocation = locationFilter === "all" || job.location === locationFilter;
    const matchesIndustry = industryFilter === "all" || job.industry === industryFilter;
    const matchesType = typeFilter === "all" || job.employmentType === typeFilter;

    return matchesSearch && matchesLocation && matchesIndustry && matchesType;
  }) || [];

  const formatSalary = (min: number, max: number) => {
    return `R${min.toLocaleString()} - R${max.toLocaleString()}`;
  };

  const handleApplyViaWhatsApp = (job: Job) => {
    const message = `Hi! I'm interested in the ${job.title} position at ${job.company}. I found this opportunity on Sebenza Hub.`;
    const whatsappUrl = `https://wa.me/${job.whatsappContact.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Job Searches</h1>
        <p className="text-muted-foreground">
          Find your next opportunity with transparent salary ranges and direct WhatsApp applications
        </p>
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="auto" data-testid="tab-auto-search">
            <Sparkles className="h-4 w-4 mr-2" />
            Auto Job Search
          </TabsTrigger>
          <TabsTrigger value="manual" data-testid="tab-manual-search">
            <Search className="h-4 w-4 mr-2" />
            Manual Job Search
          </TabsTrigger>
          <TabsTrigger value="saved" data-testid="tab-saved-searches">
            <Save className="h-4 w-4 mr-2" />
            Saved Job Searches
          </TabsTrigger>
        </TabsList>

        {/* Auto Job Search Tab */}
        <TabsContent value="auto" data-testid="content-auto-search">
          <div className="bg-graphite rounded-lg p-8">
            <div className="text-center mb-6">
              <Sparkles className="h-16 w-16 mx-auto mb-4 text-amber-500" />
              <h2 className="text-3xl font-bold text-white mb-2">Auto Job Search</h2>
              <p className="text-white/80">
                Set your preferences once and get automatically matched with relevant jobs
              </p>
            </div>

            <Card className="bg-white/95">
              <CardHeader>
                <CardTitle>Set Your Job Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preferred Job Titles</label>
                  <Input 
                    placeholder="e.g., Software Developer, Project Manager" 
                    data-testid="input-auto-job-titles"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter job titles you're interested in, separated by commas
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preferred Locations</label>
                    <Select defaultValue="any">
                      <SelectTrigger data-testid="select-auto-location">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any Location</SelectItem>
                        <SelectItem value="cape-town">Cape Town</SelectItem>
                        <SelectItem value="johannesburg">Johannesburg</SelectItem>
                        <SelectItem value="durban">Durban</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preferred Industries</label>
                    <Select defaultValue="any">
                      <SelectTrigger data-testid="select-auto-industry">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any Industry</SelectItem>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="healthcare">Healthcare</SelectItem>
                        <SelectItem value="retail">Retail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Employment Type</label>
                    <Select defaultValue="any">
                      <SelectTrigger data-testid="select-auto-employment-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any Type</SelectItem>
                        <SelectItem value="permanent">Permanent</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="temporary">Temporary</SelectItem>
                        <SelectItem value="internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Minimum Salary (Monthly)</label>
                    <Input 
                      type="number" 
                      placeholder="e.g., 25000" 
                      data-testid="input-auto-min-salary"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
                  <Bell className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Email Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Get notified when new jobs match your preferences
                    </p>
                  </div>
                  <Button variant="outline" size="sm" data-testid="button-enable-notifications">
                    Enable
                  </Button>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button className="flex-1" data-testid="button-save-preferences">
                    <Save className="h-4 w-4 mr-2" />
                    Save Preferences
                  </Button>
                  <Button variant="outline" className="flex-1" data-testid="button-view-matches">
                    View Matched Jobs
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 text-center">
              <p className="text-white/60 text-sm">
                Your preferences are saved automatically and can be updated anytime
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Manual Job Search Tab */}
        <TabsContent value="manual" data-testid="content-manual-search">
          <div className="bg-graphite rounded-lg p-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-white mb-2">Browse Available Jobs</h2>
              <p className="text-white/80">
                All jobs include transparent salary ranges. Apply directly via WhatsApp.
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <Input
                  type="text"
                  placeholder="Search by job title, company, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base bg-white"
                  data-testid="input-job-search"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Filter className="h-4 w-4 text-white/70" />
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white" data-testid="select-location">
                      <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {locations.map(location => (
                        <SelectItem key={location} value={location}>{location}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Select value={industryFilter} onValueChange={setIndustryFilter} >
                  <SelectTrigger className="bg-white/10 border-white/20 text-white flex-1" data-testid="select-industry">
                    <SelectValue placeholder="All Industries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {industries.map(industry => (
                      <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white flex-1" data-testid="select-type">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {employmentTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6">
              {isLoading ? (
                <Card className="bg-white/95">
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Loading jobs...</p>
                  </CardContent>
                </Card>
              ) : filteredJobs.length > 0 ? (
                <div className="space-y-4">
                  {filteredJobs.map((job) => (
                    <Card key={job.id} className="bg-white/95 hover-elevate" data-testid={`job-card-${job.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-xl mb-2 flex items-center gap-2">
                              <Briefcase className="h-5 w-5 text-primary" />
                              {job.title}
                            </CardTitle>
                            <p className="text-lg font-semibold text-muted-foreground mb-3">{job.company}</p>
                            <div className="flex flex-wrap gap-3 text-sm">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                {job.location}
                              </div>
                              <div className="flex items-center gap-1 text-green-600 font-semibold">
                                <DollarSign className="h-4 w-4" />
                                {formatSalary(job.salaryMin, job.salaryMax)}
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                {new Date(job.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Badge variant="secondary">{job.employmentType}</Badge>
                            <Badge variant="outline">{job.industry}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2">Description</h4>
                          <p className="text-sm text-muted-foreground line-clamp-3">{job.description}</p>
                        </div>
                        <div className="flex gap-3">
                          <Button 
                            onClick={() => setLocation(`/jobs/${job.id}`)}
                            variant="outline"
                            className="flex-1"
                            data-testid={`button-view-details-${job.id}`}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                          <Button 
                            onClick={() => handleApplyViaWhatsApp(job)}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            data-testid={`button-apply-${job.id}`}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Apply via WhatsApp
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-white/95">
                  <CardContent className="p-12 text-center">
                    <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mb-2">No jobs found</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your filters or search terms
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Saved Job Searches Tab */}
        <TabsContent value="saved" data-testid="content-saved-searches">
          <div className="bg-graphite rounded-lg p-8">
            <div className="text-center mb-6">
              <Save className="h-16 w-16 mx-auto mb-4 text-amber-500" />
              <h2 className="text-3xl font-bold text-white mb-2">Saved Job Searches</h2>
              <p className="text-white/80">
                Quick access to your frequently used search criteria
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

              <Card className="bg-white/95">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    Save your searches from the Manual Job Search tab to quickly access them here
                  </p>
                  <Button variant="outline" data-testid="button-go-to-manual-search">
                    Go to Manual Search
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
