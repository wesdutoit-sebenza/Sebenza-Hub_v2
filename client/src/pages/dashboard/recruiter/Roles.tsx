import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Plus, Briefcase, MapPin, DollarSign, Users, Edit, Trash2, CheckCircle2, XCircle, TrendingUp, Target } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRoleSchema } from "@shared/schema";
import { z } from "zod";
import { SkillsMultiSelect } from "@/components/SkillsMultiSelect";

interface RolesStatsData {
  success: boolean;
  stats: {
    totalRoles: number;
    activeRoles: number;
    inactiveRoles: number;
    totalScreenings: number;
    recentRoles: number;
    topRoles: Array<{
      roleId: string;
      roleTitle: string;
      count: number;
      avgScore: number;
    }>;
  };
}

const roleFormSchema = insertRoleSchema.extend({
  mustHaveSkills: z.array(z.string()).default([]),
  niceToHaveSkills: z.array(z.string()).default([]),
  knockouts: z.array(z.string()).default([]),
  weights: z.object({
    skills: z.number().min(0).max(100),
    experience: z.number().min(0).max(100),
    achievements: z.number().min(0).max(100),
    education: z.number().min(0).max(100),
    location_auth: z.number().min(0).max(100),
    salary_availability: z.number().min(0).max(100),
  }).default({
    skills: 30,
    experience: 25,
    achievements: 15,
    education: 10,
    location_auth: 10,
    salary_availability: 10,
  }),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

export default function Roles() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["/api/roles"],
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<RolesStatsData>({
    queryKey: ["/api/roles/stats"],
  });

  const roles = (rolesData as any)?.roles || [];
  const stats = statsData?.stats;

  const createRoleMutation = useMutation({
    mutationFn: async (data: RoleFormValues) => {
      return apiRequest("POST", "/api/roles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setCreateDialogOpen(false);
      toast({
        title: "Role created",
        description: "The role has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create role",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RoleFormValues> }) => {
      return apiRequest("PATCH", `/api/roles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setEditingRole(null);
      toast({
        title: "Role updated",
        description: "The role has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update role",
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({
        title: "Role deactivated",
        description: "The role has been deactivated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to deactivate role",
      });
    },
  });

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Roles & Screenings</h1>
          <p className="text-muted-foreground">Create and manage hiring roles for candidate screening</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-role">
              <Plus className="w-4 h-4 mr-2" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Define a new hiring role to screen candidates against
              </DialogDescription>
            </DialogHeader>
            <RoleForm
              onSubmit={(data) => createRoleMutation.mutate(data)}
              isSubmitting={createRoleMutation.isPending}
            />
          </DialogContent>
        </Dialog>
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
                <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
                <Briefcase className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-roles">{stats.totalRoles}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.activeRoles} active, {stats.inactiveRoles} inactive
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-stat-active" >
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Active Roles</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary" data-testid="text-active-roles">{stats.activeRoles}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  ready for screening
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-stat-screenings" >
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Total Screenings</CardTitle>
                <Target className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary" data-testid="text-total-screenings">{stats.totalScreenings}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  candidates evaluated
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-stat-recent" >
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Recent Roles</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary" data-testid="text-recent-roles">{stats.recentRoles}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  added in last 7 days
                </p>
              </CardContent>
            </Card>
          </div>

          {stats.topRoles && stats.topRoles.length > 0 && (
            <Card className="mb-8" >
              <CardHeader>
                <CardTitle className="text-foreground">Top Roles by Screening Activity</CardTitle>
                <CardDescription className="text-muted-foreground">Roles with the most candidate evaluations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.topRoles.map((role, index) => (
                    <div key={index} className="flex items-center justify-between" data-testid={`top-role-${index}`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Badge variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary text-primary-foreground">
                          {index + 1}
                        </Badge>
                        <span className="font-medium truncate text-foreground">{role.roleTitle}</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-sm text-muted-foreground">
                          {role.count} screenings
                        </div>
                        <Badge variant="outline" className="border-primary text-primary">
                          Avg: {role.avgScore}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : roles.length === 0 ? (
        <Card >
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">No roles yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first role to start screening candidates
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-role">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Role
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role: any) => (
            <Card key={role.id} className="hover-elevate" data-testid={`card-role-${role.id}`} >
              <CardHeader className="space-y-1">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-xl text-foreground">{role.jobTitle}</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingRole(role)}
                      data-testid={`button-edit-${role.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Are you sure you want to deactivate this role?")) {
                          deleteRoleMutation.mutate(role.id);
                        }
                      }}
                      data-testid={`button-delete-${role.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="line-clamp-2 text-muted-foreground">{role.jobDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Briefcase className="w-4 h-4 text-primary" />
                  <span>{role.seniority || "Not specified"} • {role.employmentType || "Not specified"}</span>
                </div>
                {(role.locationCity || role.locationCountry) && (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>
                      {[role.locationCity, role.locationCountry].filter(Boolean).join(", ")}
                      {role.workType && ` (${role.workType})`}
                    </span>
                  </div>
                )}
                {(role.salaryMin || role.salaryMax) && (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span>
                      {role.salaryCurrency || "ZAR"}{" "}
                      {role.salaryMin?.toLocaleString()} - {role.salaryMax?.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1 mt-3">
                  {role.mustHaveSkills?.slice(0, 3).map((skill: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-xs bg-primary text-primary-foreground">
                      {skill}
                    </Badge>
                  ))}
                  {role.mustHaveSkills?.length > 3 && (
                    <Badge variant="outline" className="text-xs border-primary text-primary">
                      +{role.mustHaveSkills.length - 3} more
                    </Badge>
                  )}
                </div>
                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => navigate(`/roles/${role.id}/screen`)}
                  data-testid={`button-screen-${role.id}`}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Screen Candidates
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editingRole && (
        <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Role</DialogTitle>
              <DialogDescription>
                Update the role details
              </DialogDescription>
            </DialogHeader>
            <RoleForm
              initialData={editingRole}
              onSubmit={(data) => updateRoleMutation.mutate({ id: editingRole.id, data })}
              isSubmitting={updateRoleMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function RoleForm({
  initialData,
  onSubmit,
  isSubmitting,
}: {
  initialData?: any;
  onSubmit: (data: RoleFormValues) => void;
  isSubmitting: boolean;
}) {
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: initialData || {
      jobTitle: "",
      jobDescription: "",
      companyId: "",
      seniority: "",
      employmentType: "",
      locationCity: "",
      locationCountry: "South Africa",
      workType: "",
      mustHaveSkills: [],
      niceToHaveSkills: [],
      salaryMin: undefined,
      salaryMax: undefined,
      salaryCurrency: "ZAR",
      knockouts: [],
      weights: {
        skills: 30,
        experience: 25,
        achievements: 15,
        education: 10,
        location_auth: 10,
        salary_availability: 10,
      },
      isActive: 1,
    },
  });

  const [knockoutsInput, setKnockoutsInput] = useState("");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="jobTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job Title *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., Senior React Developer" data-testid="input-job-title" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="jobDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job Description *</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={4}
                  placeholder="Describe the role, responsibilities, and requirements..."
                  data-testid="input-job-description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="seniority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seniority</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger data-testid="select-seniority">
                      <SelectValue placeholder="Select seniority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Entry Level">Entry Level</SelectItem>
                    <SelectItem value="Junior">Junior</SelectItem>
                    <SelectItem value="Mid">Mid</SelectItem>
                    <SelectItem value="Senior">Senior</SelectItem>
                    <SelectItem value="Lead">Lead</SelectItem>
                    <SelectItem value="Principal">Principal</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="employmentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employment Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger data-testid="select-employment-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Freelance">Freelance</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="locationCity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} placeholder="e.g., Cape Town" data-testid="input-city" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="locationCountry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} placeholder="e.g., South Africa" data-testid="input-country" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="workType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger data-testid="select-work-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="On-site">On-site</SelectItem>
                    <SelectItem value="Remote">Remote</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="mustHaveSkills"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Must-Have Skills *</FormLabel>
              <FormControl>
                <SkillsMultiSelect
                  value={field.value}
                  onChange={field.onChange}
                  maxSkills={10}
                  placeholder="Select must-have skills..."
                />
              </FormControl>
              <FormDescription>
                Select up to 10 essential skills required for this role
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="niceToHaveSkills"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nice-to-Have Skills</FormLabel>
              <FormControl>
                <SkillsMultiSelect
                  value={field.value}
                  onChange={field.onChange}
                  maxSkills={10}
                  placeholder="Select nice-to-have skills..."
                />
              </FormControl>
              <FormDescription>
                Select up to 10 additional skills that would be beneficial for this role
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="salaryMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min Salary</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g., 400000"
                    data-testid="input-salary-min"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="salaryMax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Salary</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g., 600000"
                    data-testid="input-salary-max"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="salaryCurrency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "ZAR"}>
                  <FormControl>
                    <SelectTrigger data-testid="select-currency">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ZAR">ZAR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="knockouts"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Knockout Criteria</FormLabel>
              <FormDescription>
                Define automatic disqualification criteria (e.g., "No work authorization", "Below minimum salary")
              </FormDescription>
              <FormControl>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={knockoutsInput}
                      onChange={(e) => setKnockoutsInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && knockoutsInput.trim()) {
                          e.preventDefault();
                          field.onChange([...field.value, knockoutsInput.trim()]);
                          setKnockoutsInput("");
                        }
                      }}
                      placeholder="Type a criterion and press Enter"
                      data-testid="input-knockouts"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (knockoutsInput.trim()) {
                          field.onChange([...field.value, knockoutsInput.trim()]);
                          setKnockoutsInput("");
                        }
                      }}
                      data-testid="button-add-knockout"
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {field.value.map((criterion, idx) => (
                      <Badge key={idx} variant="destructive" data-testid={`badge-knockout-${idx}`}>
                        {criterion}
                        <button
                          type="button"
                          className="ml-2 hover:text-destructive-foreground/70"
                          onClick={() => {
                            field.onChange(field.value.filter((_, i) => i !== idx));
                          }}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Scoring Weights</h3>
            <Badge 
              variant={
                Object.values(form.watch("weights") || {}).reduce((a, b) => a + b, 0) === 100 
                  ? "default" 
                  : "destructive"
              }
              data-testid="badge-weights-total"
            >
              Total: {Object.values(form.watch("weights") || {}).reduce((a, b) => a + b, 0)}%
            </Badge>
          </div>
          <div className="space-y-6">
            {(["skills", "experience", "achievements", "education", "location_auth", "salary_availability"] as const).map((key) => (
              <FormField
                key={key}
                control={form.control}
                name={`weights.${key}` as any}
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-2">
                      <FormLabel className="capitalize">{key.replace("_", " ")}</FormLabel>
                      <span className="text-sm font-medium" data-testid={`text-weight-${key}`}>
                        {field.value}%
                      </span>
                    </div>
                    <FormControl>
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[field.value]}
                        onValueChange={(values) => field.onChange(values[0])}
                        data-testid={`slider-weight-${key}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting} data-testid="button-submit-role">
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {initialData ? "Update Role" : "Create Role"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
