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
import { Settings, Users, Workflow, MessageSquare, Shield, DollarSign, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { User } from "@shared/schema";

interface TeamMember {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  status: string;
}

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  isDefault: number;
}

interface InterviewSettings {
  calendarProvider?: string;
  videoProvider?: string;
  panelTemplates: string[];
  feedbackFormTemplate?: string;
}

interface ComplianceSettings {
  eeDataCapture: string;
  consentText: string;
  dataRetentionDays: number;
  popiaOfficer?: string;
  dataDeletionContact?: string;
}

interface IntegrationSettings {
  slackWebhook?: string;
  msTeamsWebhook?: string;
  atsProvider?: string;
  sourcingChannels: string[];
}

export default function RecruiterSettings() {
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
  
  // Team Management State
  const [newMember, setNewMember] = useState({ email: "", role: "recruiter", permissions: [] as string[] });
  
  // Pipeline Stages State
  const [newStage, setNewStage] = useState({ name: "", order: 1 });
  
  // Interview Settings State
  const [interviewSettings, setInterviewSettings] = useState<InterviewSettings>({
    calendarProvider: "none",
    videoProvider: "none",
    panelTemplates: [],
    feedbackFormTemplate: "",
  });
  
  // Compliance Settings State
  const [complianceSettings, setComplianceSettings] = useState<ComplianceSettings>({
    eeDataCapture: "optional",
    consentText: "By applying you consent to processing your personal data for recruitment purposes in compliance with POPIA.",
    dataRetentionDays: 365,
    popiaOfficer: "",
    dataDeletionContact: "",
  });
  
  // Integration Settings State
  const [integrationSettings, setIntegrationSettings] = useState<IntegrationSettings>({
    slackWebhook: "",
    msTeamsWebhook: "",
    atsProvider: "none",
    sourcingChannels: [],
  });

  useEffect(() => {
    document.title = "Organization Settings | Sebenza Hub";
  }, []);

  // Fetch Team Members
  const { data: teamMembers = [], isLoading: loadingMembers } = useQuery<TeamMember[]>({
    queryKey: [`/api/organizations/${orgId}/team-members`],
    enabled: !!orgId,
  });

  // Fetch Pipeline Stages
  const { data: pipelineStages = [], isLoading: loadingStages } = useQuery<PipelineStage[]>({
    queryKey: [`/api/organizations/${orgId}/pipeline-stages`],
    enabled: !!orgId,
  });

  // Fetch Interview Settings
  const { data: interviewData } = useQuery({
    queryKey: [`/api/organizations/${orgId}/interview-settings`],
    enabled: !!orgId,
  });

  useEffect(() => {
    if (interviewData) {
      const data = interviewData as any;
      setInterviewSettings({
        calendarProvider: data.calendar_provider || "none",
        videoProvider: data.video_provider || "none",
        panelTemplates: data.panel_templates || [],
        feedbackFormTemplate: data.feedback_form_template || "",
      });
    }
  }, [interviewData]);

  // Fetch Compliance Settings
  const { data: complianceData } = useQuery({
    queryKey: [`/api/organizations/${orgId}/compliance-settings`],
    enabled: !!orgId,
  });

  useEffect(() => {
    if (complianceData) {
      const data = complianceData as any;
      setComplianceSettings({
        eeDataCapture: data.ee_data_capture || "optional",
        consentText: data.consent_text || "",
        dataRetentionDays: data.data_retention_days || 365,
        popiaOfficer: data.popia_officer || "",
        dataDeletionContact: data.data_deletion_contact || "",
      });
    }
  }, [complianceData]);

  // Fetch Integration Settings
  const { data: integrationData } = useQuery({
    queryKey: [`/api/organizations/${orgId}/integrations`],
    enabled: !!orgId,
  });

  useEffect(() => {
    if (integrationData) {
      const data = integrationData as any;
      setIntegrationSettings({
        slackWebhook: data.slack_webhook || "",
        msTeamsWebhook: data.ms_teams_webhook || "",
        atsProvider: data.ats_provider || "none",
        sourcingChannels: data.sourcing_channels || [],
      });
    }
  }, [integrationData]);

  // Add Team Member Mutation
  const addMemberMutation = useMutation({
    mutationFn: async (member: typeof newMember) => {
      const response = await apiRequest("POST", `/api/organizations/${orgId}/team-members`, member);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/team-members`] });
      toast({ title: "Team member added successfully" });
      setNewMember({ email: "", role: "recruiter", permissions: [] });
    },
    onError: () => {
      toast({ title: "Failed to add team member", variant: "destructive" });
    },
  });

  // Delete Team Member Mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await apiRequest("DELETE", `/api/organizations/${orgId}/team-members/${memberId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/team-members`] });
      toast({ title: "Team member removed" });
    },
  });

  // Add Pipeline Stage Mutation
  const addStageMutation = useMutation({
    mutationFn: async (stage: typeof newStage) => {
      const response = await apiRequest("POST", `/api/organizations/${orgId}/pipeline-stages`, stage);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/pipeline-stages`] });
      toast({ title: "Pipeline stage added" });
      setNewStage({ name: "", order: (pipelineStages?.length || 0) + 1 });
    },
  });

  // Delete Pipeline Stage Mutation
  const deleteStageMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const response = await apiRequest("DELETE", `/api/organizations/${orgId}/pipeline-stages/${stageId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/pipeline-stages`] });
      toast({ title: "Pipeline stage removed" });
    },
  });

  // Save Interview Settings Mutation
  const saveInterviewMutation = useMutation({
    mutationFn: async (settings: InterviewSettings) => {
      const response = await apiRequest("PUT", `/api/organizations/${orgId}/interview-settings`, {
        calendarProvider: settings.calendarProvider,
        videoProvider: settings.videoProvider,
        panelTemplates: settings.panelTemplates,
        feedbackFormTemplate: settings.feedbackFormTemplate,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Interview settings saved" });
    },
  });

  // Save Compliance Settings Mutation
  const saveComplianceMutation = useMutation({
    mutationFn: async (settings: ComplianceSettings) => {
      const response = await apiRequest("PUT", `/api/organizations/${orgId}/compliance-settings`, {
        eeDataCapture: settings.eeDataCapture,
        consentText: settings.consentText,
        dataRetentionDays: settings.dataRetentionDays,
        popiaOfficer: settings.popiaOfficer,
        dataDeletionContact: settings.dataDeletionContact,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Compliance settings saved" });
    },
  });

  // Save Integration Settings Mutation
  const saveIntegrationMutation = useMutation({
    mutationFn: async (settings: IntegrationSettings) => {
      const response = await apiRequest("PUT", `/api/organizations/${orgId}/integrations`, {
        slackWebhook: settings.slackWebhook,
        msTeamsWebhook: settings.msTeamsWebhook,
        atsProvider: settings.atsProvider,
        sourcingChannels: settings.sourcingChannels,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Integration settings saved" });
    },
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl bg-charcoal min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-white-brand">Organization Settings</h1>
        <p className="text-slate">Configure your recruiting platform settings and preferences</p>
      </div>

      <Tabs defaultValue="team" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto" data-testid="tabs-settings">
          <TabsTrigger value="team" data-testid="tab-team">
            <Users className="h-4 w-4 mr-2" />
            Team
          </TabsTrigger>
          <TabsTrigger value="pipeline" data-testid="tab-pipeline">
            <Workflow className="h-4 w-4 mr-2" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="interview" data-testid="tab-interview">
            <MessageSquare className="h-4 w-4 mr-2" />
            Interview
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">
            <Shield className="h-4 w-4 mr-2" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">
            <Settings className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* Team Management Tab */}
        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle className="text-white-brand">Team Management</CardTitle>
              <CardDescription className="text-slate">Invite and manage team members for your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Team Member Form */}
              <div className="space-y-4 p-4 border rounded-md">
                <h3 className="font-semibold text-white-brand">Add Team Member</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="member-email">Email</Label>
                    <Input
                      id="member-email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={newMember.email}
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                      data-testid="input-member-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="member-role">Role</Label>
                    <Select
                      value={newMember.role}
                      onValueChange={(value) => setNewMember({ ...newMember, role: value })}
                    >
                      <SelectTrigger id="member-role" data-testid="select-member-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recruiter">Recruiter</SelectItem>
                        <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      className="bg-amber-gradient text-charcoal hover:opacity-90"
                      onClick={() => addMemberMutation.mutate(newMember)}
                      disabled={!newMember.email || addMemberMutation.isPending}
                      data-testid="button-add-member"
                    >
                      Add Member
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <ChipInput
                    value={newMember.permissions}
                    onChange={(permissions) => setNewMember({ ...newMember, permissions })}
                    placeholder="Add permission (e.g., create_job, view_candidates)"
                  />
                </div>
              </div>

              <Separator />

              {/* Team Members List */}
              <div className="space-y-4">
                <h3 className="font-semibold text-white-brand">Current Team Members</h3>
                {loadingMembers ? (
                  <p className="text-sm text-slate">Loading team members...</p>
                ) : teamMembers.length === 0 ? (
                  <p className="text-sm text-slate">No team members yet. Add your first member above.</p>
                ) : (
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                        data-testid={`team-member-${member.id}`}
                      >
                        <div className="flex-1">
                          <p className="font-medium">{member.email}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline">{member.role}</Badge>
                            <Badge variant={member.status === "active" ? "default" : "secondary"}>
                              {member.status}
                            </Badge>
                          </div>
                          {member.permissions.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {member.permissions.map((perm, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {perm}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMemberMutation.mutate(member.id)}
                          data-testid={`button-delete-member-${member.id}`}
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

        {/* Pipeline Stages Tab */}
        <TabsContent value="pipeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-white-brand">Hiring Pipeline Configuration</CardTitle>
              <CardDescription className="text-slate">Customize your hiring stages and workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Pipeline Stage Form */}
              <div className="space-y-4 p-4 border rounded-md">
                <h3 className="font-semibold text-white-brand">Add Pipeline Stage</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="stage-name">Stage Name</Label>
                    <Input
                      id="stage-name"
                      placeholder="e.g., Technical Interview"
                      value={newStage.name}
                      onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                      data-testid="input-stage-name"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      className="bg-amber-gradient text-charcoal hover:opacity-90"
                      onClick={() => addStageMutation.mutate(newStage)}
                      disabled={!newStage.name || addStageMutation.isPending}
                      data-testid="button-add-stage"
                    >
                      Add Stage
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Pipeline Stages List */}
              <div className="space-y-4">
                <h3 className="font-semibold text-white-brand">Current Pipeline Stages</h3>
                {loadingStages ? (
                  <p className="text-sm text-slate">Loading pipeline stages...</p>
                ) : pipelineStages.length === 0 ? (
                  <p className="text-sm text-slate">No pipeline stages configured yet.</p>
                ) : (
                  <div className="space-y-2">
                    {pipelineStages.map((stage) => (
                      <div
                        key={stage.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                        data-testid={`pipeline-stage-${stage.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{stage.order}</Badge>
                          <span className="font-medium">{stage.name}</span>
                          {stage.isDefault === 1 && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                        </div>
                        {stage.isDefault !== 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteStageMutation.mutate(stage.id)}
                            data-testid={`button-delete-stage-${stage.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interview Operations Tab */}
        <TabsContent value="interview">
          <Card>
            <CardHeader>
              <CardTitle className="text-white-brand">Interview Operations Settings</CardTitle>
              <CardDescription className="text-slate">Configure calendar, video platforms, and interview templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="calendar-provider">Calendar Provider</Label>
                  <Select
                    value={interviewSettings.calendarProvider}
                    onValueChange={(value) =>
                      setInterviewSettings({ ...interviewSettings, calendarProvider: value })
                    }
                  >
                    <SelectTrigger id="calendar-provider" data-testid="select-calendar-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="google">Google Calendar</SelectItem>
                      <SelectItem value="outlook">Outlook Calendar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="video-provider">Video Platform</Label>
                  <Select
                    value={interviewSettings.videoProvider}
                    onValueChange={(value) =>
                      setInterviewSettings({ ...interviewSettings, videoProvider: value })
                    }
                  >
                    <SelectTrigger id="video-provider" data-testid="select-video-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="zoom">Zoom</SelectItem>
                      <SelectItem value="meet">Google Meet</SelectItem>
                      <SelectItem value="teams">Microsoft Teams</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Panel Interview Templates</Label>
                <ChipInput
                  value={interviewSettings.panelTemplates}
                  onChange={(templates) =>
                    setInterviewSettings({ ...interviewSettings, panelTemplates: templates })
                  }
                  placeholder="Add template (e.g., Technical Panel, Executive Panel)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-template">Feedback Form Template</Label>
                <Textarea
                  id="feedback-template"
                  placeholder="Enter feedback form template or questions..."
                  value={interviewSettings.feedbackFormTemplate}
                  onChange={(e) =>
                    setInterviewSettings({ ...interviewSettings, feedbackFormTemplate: e.target.value })
                  }
                  rows={4}
                  data-testid="textarea-feedback-template"
                />
              </div>

              <Button
                className="bg-amber-gradient text-charcoal hover:opacity-90"
                onClick={() => saveInterviewMutation.mutate(interviewSettings)}
                disabled={saveInterviewMutation.isPending}
                data-testid="button-save-interview"
              >
                Save Interview Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle className="text-white-brand">Compliance & POPIA Settings</CardTitle>
              <CardDescription className="text-slate">Configure Employment Equity and data protection compliance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ee-data-capture">Employment Equity Data Capture</Label>
                  <Select
                    value={complianceSettings.eeDataCapture}
                    onValueChange={(value) =>
                      setComplianceSettings({ ...complianceSettings, eeDataCapture: value })
                    }
                  >
                    <SelectTrigger id="ee-data-capture" data-testid="select-ee-data-capture">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="optional">Optional</SelectItem>
                      <SelectItem value="required">Required</SelectItem>
                      <SelectItem value="off">Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retention-days">Data Retention (days)</Label>
                  <Input
                    id="retention-days"
                    type="number"
                    value={complianceSettings.dataRetentionDays}
                    onChange={(e) =>
                      setComplianceSettings({
                        ...complianceSettings,
                        dataRetentionDays: parseInt(e.target.value) || 365,
                      })
                    }
                    data-testid="input-retention-days"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="consent-text">POPIA Consent Text</Label>
                <Textarea
                  id="consent-text"
                  value={complianceSettings.consentText}
                  onChange={(e) =>
                    setComplianceSettings({ ...complianceSettings, consentText: e.target.value })
                  }
                  rows={3}
                  data-testid="textarea-consent-text"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="popia-officer">POPIA Officer</Label>
                  <Input
                    id="popia-officer"
                    placeholder="Name of POPIA officer"
                    value={complianceSettings.popiaOfficer}
                    onChange={(e) =>
                      setComplianceSettings({ ...complianceSettings, popiaOfficer: e.target.value })
                    }
                    data-testid="input-popia-officer"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deletion-contact">Data Deletion Contact</Label>
                  <Input
                    id="deletion-contact"
                    type="email"
                    placeholder="privacy@example.com"
                    value={complianceSettings.dataDeletionContact}
                    onChange={(e) =>
                      setComplianceSettings({ ...complianceSettings, dataDeletionContact: e.target.value })
                    }
                    data-testid="input-deletion-contact"
                  />
                </div>
              </div>

              <Button
                className="bg-amber-gradient text-charcoal hover:opacity-90"
                onClick={() => saveComplianceMutation.mutate(complianceSettings)}
                disabled={saveComplianceMutation.isPending}
                data-testid="button-save-compliance"
              >
                Save Compliance Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle className="text-white-brand">External Integrations</CardTitle>
              <CardDescription className="text-slate">Connect with Slack, Teams, and other platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
                <Input
                  id="slack-webhook"
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={integrationSettings.slackWebhook}
                  onChange={(e) =>
                    setIntegrationSettings({ ...integrationSettings, slackWebhook: e.target.value })
                  }
                  data-testid="input-slack-webhook"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="teams-webhook">Microsoft Teams Webhook URL</Label>
                <Input
                  id="teams-webhook"
                  type="url"
                  placeholder="https://..."
                  value={integrationSettings.msTeamsWebhook}
                  onChange={(e) =>
                    setIntegrationSettings({ ...integrationSettings, msTeamsWebhook: e.target.value })
                  }
                  data-testid="input-teams-webhook"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ats-provider">External ATS Provider</Label>
                <Select
                  value={integrationSettings.atsProvider}
                  onValueChange={(value) =>
                    setIntegrationSettings({ ...integrationSettings, atsProvider: value })
                  }
                >
                  <SelectTrigger id="ats-provider" data-testid="select-ats-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="workday">Workday</SelectItem>
                    <SelectItem value="greenhouse">Greenhouse</SelectItem>
                    <SelectItem value="lever">Lever</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sourcing Channels</Label>
                <ChipInput
                  value={integrationSettings.sourcingChannels}
                  onChange={(channels) =>
                    setIntegrationSettings({ ...integrationSettings, sourcingChannels: channels })
                  }
                  placeholder="Add channel (e.g., LinkedIn, Indeed, Referrals)"
                />
              </div>

              <Button
                className="bg-amber-gradient text-charcoal hover:opacity-90"
                onClick={() => saveIntegrationMutation.mutate(integrationSettings)}
                disabled={saveIntegrationMutation.isPending}
                data-testid="button-save-integrations"
              >
                Save Integration Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
