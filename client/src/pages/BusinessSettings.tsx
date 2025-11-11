import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChipInput } from "@/components/ui/chip-input";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Building, FileText, Users2, DollarSign, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { User } from "@shared/schema";

interface JobTemplate {
  id: string;
  name: string;
  jobTitle?: string;
  jobDescription?: string;
  requirements: string[];
  interviewStructure: string[];
  approvalChain: string[];
}

interface SalaryBand {
  id: string;
  title: string;
  minSalary: number;
  maxSalary: number;
  currency: string;
}

interface Vendor {
  id: string;
  name: string;
  contactEmail?: string;
  rate?: string;
  ndaSigned: number;
  status: string;
}

export default function BusinessSettings() {
  const { toast } = useToast();
  
  // Get current user to fetch their organization
  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });
  
  // Fetch user's first organization membership
  const { data: membership } = useQuery<{ organizationId: string }>({
    queryKey: ['/api/my-membership'],
    enabled: !!user,
  });
  
  const orgId = membership?.organizationId;

  // Job Template State
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    jobTitle: "",
    jobDescription: "",
    requirements: [] as string[],
    interviewStructure: [] as string[],
    approvalChain: [] as string[],
  });

  // Salary Band State
  const [newBand, setNewBand] = useState({
    title: "",
    minSalary: 0,
    maxSalary: 0,
    currency: "ZAR",
  });

  // Vendor State
  const [newVendor, setNewVendor] = useState({
    name: "",
    contactEmail: "",
    rate: "",
    ndaSigned: 0,
    status: "active",
  });

  useEffect(() => {
    document.title = "Business Settings | Sebenza Hub";
  }, []);

  // Fetch Job Templates
  const { data: jobTemplates = [], isLoading: loadingTemplates } = useQuery<JobTemplate[]>({
    queryKey: [`/api/organizations/${orgId}/job-templates`],
    enabled: !!orgId,
  });

  // Fetch Salary Bands
  const { data: salaryBands = [], isLoading: loadingBands } = useQuery<SalaryBand[]>({
    queryKey: [`/api/organizations/${orgId}/salary-bands`],
    enabled: !!orgId,
  });

  // Fetch Vendors
  const { data: vendors = [], isLoading: loadingVendors } = useQuery<Vendor[]>({
    queryKey: [`/api/organizations/${orgId}/vendors`],
    enabled: !!orgId,
  });

  // Add Job Template Mutation
  const addTemplateMutation = useMutation({
    mutationFn: async (template: typeof newTemplate) => {
      const response = await apiRequest("POST", `/api/organizations/${orgId}/job-templates`, template);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/job-templates`] });
      toast({ title: "Job template added successfully" });
      setNewTemplate({
        name: "",
        jobTitle: "",
        jobDescription: "",
        requirements: [],
        interviewStructure: [],
        approvalChain: [],
      });
    },
    onError: () => {
      toast({ title: "Failed to add job template", variant: "destructive" });
    },
  });

  // Delete Job Template Mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest("DELETE", `/api/organizations/${orgId}/job-templates/${templateId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/job-templates`] });
      toast({ title: "Job template removed" });
    },
  });

  // Add Salary Band Mutation
  const addBandMutation = useMutation({
    mutationFn: async (band: typeof newBand) => {
      const response = await apiRequest("POST", `/api/organizations/${orgId}/salary-bands`, band);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/salary-bands`] });
      toast({ title: "Salary band added successfully" });
      setNewBand({ title: "", minSalary: 0, maxSalary: 0, currency: "ZAR" });
    },
    onError: () => {
      toast({ title: "Failed to add salary band", variant: "destructive" });
    },
  });

  // Delete Salary Band Mutation
  const deleteBandMutation = useMutation({
    mutationFn: async (bandId: string) => {
      const response = await apiRequest("DELETE", `/api/organizations/${orgId}/salary-bands/${bandId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/salary-bands`] });
      toast({ title: "Salary band removed" });
    },
  });

  // Add Vendor Mutation
  const addVendorMutation = useMutation({
    mutationFn: async (vendor: typeof newVendor) => {
      const response = await apiRequest("POST", `/api/organizations/${orgId}/vendors`, vendor);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/vendors`] });
      toast({ title: "Vendor added successfully" });
      setNewVendor({ name: "", contactEmail: "", rate: "", ndaSigned: 0, status: "active" });
    },
    onError: () => {
      toast({ title: "Failed to add vendor", variant: "destructive" });
    },
  });

  // Delete Vendor Mutation
  const deleteVendorMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      const response = await apiRequest("DELETE", `/api/organizations/${orgId}/vendors/${vendorId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/vendors`] });
      toast({ title: "Vendor removed" });
    },
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl bg-charcoal min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-white-brand">Business Settings</h1>
        <p className="text-slate">Configure job templates, salary bands, and vendor management</p>
      </div>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto" data-testid="tabs-business-settings">
          <TabsTrigger value="templates" data-testid="tab-templates">
            <FileText className="h-4 w-4 mr-2" />
            Job Templates
          </TabsTrigger>
          <TabsTrigger value="salary" data-testid="tab-salary">
            <DollarSign className="h-4 w-4 mr-2" />
            Salary Bands
          </TabsTrigger>
          <TabsTrigger value="vendors" data-testid="tab-vendors">
            <Users2 className="h-4 w-4 mr-2" />
            Vendors
          </TabsTrigger>
        </TabsList>

        {/* Job Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="text-white-brand">Job Templates</CardTitle>
              <CardDescription className="text-slate">Create reusable job posting templates with predefined structures</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Template Form */}
              <div className="space-y-4 p-4 border rounded-md">
                <h3 className="font-semibold text-white-brand">Create New Template</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      placeholder="e.g., Tech Role Template"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                      data-testid="input-template-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-job-title">Default Job Title</Label>
                    <Input
                      id="template-job-title"
                      placeholder="e.g., Senior Software Engineer"
                      value={newTemplate.jobTitle}
                      onChange={(e) => setNewTemplate({ ...newTemplate, jobTitle: e.target.value })}
                      data-testid="input-template-job-title"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-description">Job Description Template</Label>
                  <Textarea
                    id="template-description"
                    placeholder="Enter default job description..."
                    value={newTemplate.jobDescription}
                    onChange={(e) => setNewTemplate({ ...newTemplate, jobDescription: e.target.value })}
                    rows={3}
                    data-testid="textarea-template-description"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Requirements</Label>
                  <ChipInput
                    value={newTemplate.requirements}
                    onChange={(requirements) => setNewTemplate({ ...newTemplate, requirements })}
                    placeholder="Add requirement (e.g., 5+ years experience)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Interview Structure</Label>
                  <ChipInput
                    value={newTemplate.interviewStructure}
                    onChange={(interviewStructure) =>
                      setNewTemplate({ ...newTemplate, interviewStructure })
                    }
                    placeholder="Add stage (e.g., HR Screen, Panel Interview)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Approval Chain</Label>
                  <ChipInput
                    value={newTemplate.approvalChain}
                    onChange={(approvalChain) => setNewTemplate({ ...newTemplate, approvalChain })}
                    placeholder="Add approver (e.g., Hiring Manager, Finance)"
                  />
                </div>

                <Button
                  className="bg-amber-gradient text-charcoal hover:opacity-90"
                  onClick={() => addTemplateMutation.mutate(newTemplate)}
                  disabled={!newTemplate.name || addTemplateMutation.isPending}
                  data-testid="button-add-template"
                >
                  Create Template
                </Button>
              </div>

              <Separator />

              {/* Templates List */}
              <div className="space-y-4">
                <h3 className="font-semibold text-white-brand">Saved Templates</h3>
                {loadingTemplates ? (
                  <p className="text-sm text-slate">Loading templates...</p>
                ) : jobTemplates.length === 0 ? (
                  <p className="text-sm text-slate">No templates created yet.</p>
                ) : (
                  <div className="space-y-3">
                    {jobTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="p-4 border rounded-md space-y-2"
                        data-testid={`job-template-${template.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-white-brand">{template.name}</h4>
                            {template.jobTitle && (
                              <p className="text-sm text-slate mt-1">{template.jobTitle}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
                            data-testid={`button-delete-template-${template.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {template.requirements.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-slate mb-1">Requirements:</p>
                            <div className="flex gap-1 flex-wrap">
                              {template.requirements.map((req, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {req}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {template.interviewStructure.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-slate mb-1">Interview Structure:</p>
                            <div className="flex gap-1 flex-wrap">
                              {template.interviewStructure.map((stage, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {stage}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary Bands Tab */}
        <TabsContent value="salary">
          <Card>
            <CardHeader>
              <CardTitle className="text-white-brand">Salary Bands</CardTitle>
              <CardDescription className="text-slate">Define standard salary ranges for different roles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Salary Band Form */}
              <div className="space-y-4 p-4 border rounded-md">
                <h3 className="font-semibold text-white-brand">Add Salary Band</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="band-title">Role Title</Label>
                    <Input
                      id="band-title"
                      placeholder="e.g., Senior Training Manager"
                      value={newBand.title}
                      onChange={(e) => setNewBand({ ...newBand, title: e.target.value })}
                      data-testid="input-band-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="band-min">Min Salary</Label>
                    <Input
                      id="band-min"
                      type="number"
                      placeholder="900000"
                      value={newBand.minSalary || ""}
                      onChange={(e) => setNewBand({ ...newBand, minSalary: parseInt(e.target.value) || 0 })}
                      data-testid="input-band-min"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="band-max">Max Salary</Label>
                    <Input
                      id="band-max"
                      type="number"
                      placeholder="1200000"
                      value={newBand.maxSalary || ""}
                      onChange={(e) => setNewBand({ ...newBand, maxSalary: parseInt(e.target.value) || 0 })}
                      data-testid="input-band-max"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="band-currency">Currency</Label>
                    <Select
                      value={newBand.currency}
                      onValueChange={(value) => setNewBand({ ...newBand, currency: value })}
                    >
                      <SelectTrigger id="band-currency" data-testid="select-band-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ZAR">ZAR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end md:col-span-3">
                    <Button
                      className="bg-amber-gradient text-charcoal hover:opacity-90"
                      onClick={() => addBandMutation.mutate(newBand)}
                      disabled={!newBand.title || !newBand.minSalary || !newBand.maxSalary || addBandMutation.isPending}
                      data-testid="button-add-band"
                    >
                      Add Salary Band
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Salary Bands List */}
              <div className="space-y-4">
                <h3 className="font-semibold text-white-brand">Configured Salary Bands</h3>
                {loadingBands ? (
                  <p className="text-sm text-slate">Loading salary bands...</p>
                ) : salaryBands.length === 0 ? (
                  <p className="text-sm text-slate">No salary bands configured yet.</p>
                ) : (
                  <div className="space-y-2">
                    {salaryBands.map((band) => (
                      <div
                        key={band.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                        data-testid={`salary-band-${band.id}`}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-white-brand">{band.title}</p>
                          <p className="text-sm text-slate">
                            {band.currency} {band.minSalary.toLocaleString()} - {band.maxSalary.toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteBandMutation.mutate(band.id)}
                          data-testid={`button-delete-band-${band.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors">
          <Card>
            <CardHeader>
              <CardTitle className="text-white-brand">Approved Vendors</CardTitle>
              <CardDescription className="text-slate">Manage external recruiting agencies and vendors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Vendor Form */}
              <div className="space-y-4 p-4 border rounded-md">
                <h3 className="font-semibold text-white-brand">Add Vendor</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendor-name">Vendor Name</Label>
                    <Input
                      id="vendor-name"
                      placeholder="e.g., ABC Recruiting"
                      value={newVendor.name}
                      onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                      data-testid="input-vendor-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-email">Contact Email</Label>
                    <Input
                      id="vendor-email"
                      type="email"
                      placeholder="contact@vendor.com"
                      value={newVendor.contactEmail}
                      onChange={(e) => setNewVendor({ ...newVendor, contactEmail: e.target.value })}
                      data-testid="input-vendor-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-rate">Rate</Label>
                    <Input
                      id="vendor-rate"
                      placeholder="e.g., 18% perm"
                      value={newVendor.rate}
                      onChange={(e) => setNewVendor({ ...newVendor, rate: e.target.value })}
                      data-testid="input-vendor-rate"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendor-status">Status</Label>
                    <Select
                      value={newVendor.status}
                      onValueChange={(value) => setNewVendor({ ...newVendor, status: value })}
                    >
                      <SelectTrigger id="vendor-status" data-testid="select-vendor-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end md:col-span-2">
                    <Button
                      className="bg-amber-gradient text-charcoal hover:opacity-90"
                      onClick={() => addVendorMutation.mutate(newVendor)}
                      disabled={!newVendor.name || addVendorMutation.isPending}
                      data-testid="button-add-vendor"
                    >
                      Add Vendor
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Vendors List */}
              <div className="space-y-4">
                <h3 className="font-semibold text-white-brand">Approved Vendors</h3>
                {loadingVendors ? (
                  <p className="text-sm text-slate">Loading vendors...</p>
                ) : vendors.length === 0 ? (
                  <p className="text-sm text-slate">No vendors added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {vendors.map((vendor) => (
                      <div
                        key={vendor.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                        data-testid={`vendor-${vendor.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white-brand">{vendor.name}</p>
                            <Badge variant={vendor.status === "active" ? "default" : "secondary"}>
                              {vendor.status}
                            </Badge>
                            {vendor.ndaSigned === 1 && (
                              <Badge variant="outline" className="text-xs">
                                NDA Signed
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-3 mt-1 text-sm text-slate">
                            {vendor.contactEmail && <span>{vendor.contactEmail}</span>}
                            {vendor.rate && <span>• {vendor.rate}</span>}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteVendorMutation.mutate(vendor.id)}
                          data-testid={`button-delete-vendor-${vendor.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
