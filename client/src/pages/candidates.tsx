import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Mail, Phone, MapPin, Users, TrendingUp, Award, Globe } from "lucide-react";
import type { Candidate } from "@shared/schema";

interface StatsData {
  success: boolean;
  stats: {
    totalCandidates: number;
    recentCandidates: number;
    topSkills: Array<{ skillName: string; count: number }>;
    topLocations: Array<{ location: string; count: number }>;
  };
}

export default function CandidatesPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: candidatesData, isLoading } = useQuery<{
    success: boolean;
    count: number;
    candidates: Candidate[];
  }>({
    queryKey: ["/api/ats/candidates"],
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ["/api/ats/stats"],
  });

  const candidates = candidatesData?.candidates || [];
  const stats = statsData?.stats;
  
  const filteredCandidates = candidates.filter((candidate) =>
    searchQuery
      ? candidate.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        candidate.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        candidate.headline?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white-brand" data-testid="heading-candidates">
              Candidate Database
            </h1>
            <p className="text-slate mt-1">
              Manage your talent pool and track candidates
            </p>
          </div>
          <Link href="/candidates/new">
            <Button className="bg-amber-gradient text-charcoal hover:opacity-90" data-testid="button-add-candidate">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Candidate
            </Button>
          </Link>
        </div>

        {statsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-8 bg-muted rounded w-16"></div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : stats && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card data-testid="card-stat-total">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white-brand">Total Candidates</CardTitle>
                  <Users className="h-4 w-4 text-amber" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber" data-testid="text-total-candidates">{stats.totalCandidates}</div>
                  <p className="text-xs text-slate mt-1">
                    in your talent pool
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-recent">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white-brand">Recent Additions</CardTitle>
                  <TrendingUp className="h-4 w-4 text-amber" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber" data-testid="text-recent-candidates">{stats.recentCandidates}</div>
                  <p className="text-xs text-slate mt-1">
                    added in last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-skills">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white-brand">Top Skills</CardTitle>
                  <Award className="h-4 w-4 text-amber" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber" data-testid="text-top-skill">
                    {stats.topSkills[0]?.skillName || "N/A"}
                  </div>
                  <p className="text-xs text-slate mt-1">
                    {stats.topSkills[0] ? `${stats.topSkills[0].count} candidates` : "No skills data"}
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-locations">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white-brand">Top Location</CardTitle>
                  <Globe className="h-4 w-4 text-amber" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber truncate" data-testid="text-top-location">
                    {stats.topLocations[0]?.location || "N/A"}
                  </div>
                  <p className="text-xs text-slate mt-1">
                    {stats.topLocations[0] ? `${stats.topLocations[0].count} candidates` : "No location data"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {stats.topSkills.length > 1 && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="text-white-brand">Skills Distribution</CardTitle>
                  <CardDescription className="text-slate">Most common skills across your talent pool</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.topSkills.slice(0, 5).map((skill, index) => (
                      <div key={index} className="flex items-center justify-between" data-testid={`skill-${index}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Badge variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-amber text-charcoal">
                            {index + 1}
                          </Badge>
                          <span className="font-medium truncate text-white-brand">{skill.skillName}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-32 bg-graphite rounded-full h-2">
                            <div 
                              className="bg-amber h-2 rounded-full" 
                              style={{ width: `${(skill.count / stats.topSkills[0].count) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-slate w-16 text-right">{skill.count} candidates</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate w-4 h-4" />
            <Input
              placeholder="Search candidates by name, email, or headline..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-graphite border-slate text-white-brand placeholder:text-slate"
              data-testid="input-search-candidates"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-6 bg-muted rounded w-1/3"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                    <div className="h-4 bg-muted rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCandidates.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-graphite flex items-center justify-center">
                  <UserPlus className="w-8 h-8 text-amber" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1 text-white-brand">No candidates found</h3>
                  <p className="text-slate mb-4">
                    {searchQuery
                      ? "Try adjusting your search criteria"
                      : "Get started by adding your first candidate"}
                  </p>
                  {!searchQuery && (
                    <Link href="/candidates/new">
                      <Button className="bg-amber-gradient text-charcoal hover:opacity-90">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Candidate
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredCandidates.map((candidate) => (
              <Link
                key={candidate.id}
                href={`/candidates/${candidate.id}`}
                data-testid={`card-candidate-${candidate.id}`}
              >
                <Card className="hover-elevate active-elevate-2 cursor-pointer transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl truncate text-white-brand" data-testid="text-candidate-name">
                          {candidate.fullName || "Unnamed Candidate"}
                        </CardTitle>
                        {candidate.headline && (
                          <p className="text-sm text-slate mt-1" data-testid="text-candidate-headline">
                            {candidate.headline}
                          </p>
                        )}
                      </div>
                      {candidate.workAuthorization && (
                        <Badge variant="secondary" className="bg-amber text-charcoal" data-testid="badge-work-auth">
                          {candidate.workAuthorization}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-4 text-sm text-slate">
                      {candidate.email && (
                        <div className="flex items-center gap-1.5" data-testid="text-candidate-email">
                          <Mail className="w-3.5 h-3.5" />
                          <span>{candidate.email}</span>
                        </div>
                      )}
                      {candidate.phone && (
                        <div className="flex items-center gap-1.5" data-testid="text-candidate-phone">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{candidate.phone}</span>
                        </div>
                      )}
                      {(candidate.city || candidate.country) && (
                        <div className="flex items-center gap-1.5" data-testid="text-candidate-location">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>
                            {[candidate.city, candidate.country].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                    {candidate.summary && (
                      <p className="text-sm text-slate line-clamp-2 mt-3" data-testid="text-candidate-summary">
                        {candidate.summary}
                      </p>
                    )}
                    {(candidate.availability || candidate.salaryExpectation) && (
                      <div className="flex gap-2 mt-3">
                        {candidate.availability && (
                          <Badge variant="outline" className="border-amber text-amber" data-testid="badge-availability">
                            {candidate.availability}
                          </Badge>
                        )}
                        {candidate.salaryExpectation && (
                          <Badge variant="outline" className="border-amber text-amber" data-testid="badge-salary">
                            {candidate.salaryExpectation}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 text-center text-sm text-slate">
          {filteredCandidates.length > 0 && (
            <span data-testid="text-candidate-count">
              Showing {filteredCandidates.length} of {candidates.length} candidates
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
