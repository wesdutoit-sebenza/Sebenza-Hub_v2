import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Building2, Users, Briefcase, TrendingUp, Mail, Phone, MessageSquare, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ClientDialog } from "@/components/recruiter/ClientDialog";
import { ContactDialog } from "@/components/recruiter/ContactDialog";
import { EngagementDialog } from "@/components/recruiter/EngagementDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type CorporateClient = {
  id: string;
  agencyOrganizationId: string;
  name: string;
  registrationNumber: string | null;
  industry: string | null;
  province: string | null;
  city: string | null;
  status: string;
  tier: string | null;
  rating: number | null;
  defaultFeePercent: number | null;
  guaranteePeriodDays: number | null;
  paymentTerms: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ClientContact = {
  id: string;
  clientId: string;
  isPrimary: number;
  fullName: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  whatsappConsent: number;
  whatsappConsentDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ClientEngagement = {
  id: string;
  clientId: string;
  agreementType: string;
  startDate: Date;
  endDate: Date | null;
  feePercent: number | null;
  retainerAmount: number | null;
  termsDocument: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export default function CorporateClients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<CorporateClient | undefined>();
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContact | undefined>();
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [engagementDialogOpen, setEngagementDialogOpen] = useState(false);
  const [editingEngagement, setEditingEngagement] = useState<ClientEngagement | undefined>();
  const [deleteEngagementId, setDeleteEngagementId] = useState<string | null>(null);
  const [isSettingUpOrg, setIsSettingUpOrg] = useState(false);

  // Setup organization mutation for existing recruiters
  const setupOrgMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/profile/recruiter/setup-organization', {
        method: 'POST',
      });
      return res.json();
    },
    onSuccess: () => {
      setIsSettingUpOrg(false);
      // Refetch clients after organization is set up
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter/clients"] });
      toast({
        title: "Success",
        description: "Organization setup complete. You can now manage corporate clients.",
      });
    },
    onError: (error: any) => {
      setIsSettingUpOrg(false);
      console.error("Setup organization error:", error);
      toast({
        title: "Error",
        description: "Failed to set up organization. Please contact support.",
        variant: "destructive",
      });
    },
  });

  // Fetch all clients
  const { data: clients = [], isLoading, error } = useQuery<CorporateClient[]>({
    queryKey: ["/api/recruiter/clients"],
    retry: false,
    select: (data: any) => data.clients || [],
  });

  // Auto-setup organization if missing (in useEffect to avoid render side-effects)
  useEffect(() => {
    if (error && !isSettingUpOrg && !setupOrgMutation.isPending) {
      const errorMessage = (error as any)?.message || String(error);
      if (errorMessage.includes("No organization membership found") || errorMessage.includes("403")) {
        setIsSettingUpOrg(true);
        setupOrgMutation.mutate();
      }
    }
  }, [error, isSettingUpOrg, setupOrgMutation]);

  // Fetch selected client details (includes contacts, engagements, jobs)
  const { data: selectedClient } = useQuery<CorporateClient>({
    queryKey: ["/api/recruiter/clients", selectedClientId],
    enabled: !!selectedClientId,
    select: (data: any) => data.client,
  });

  // Extract contacts from selectedClient (no separate endpoint)
  const contacts = selectedClient?.contacts || [];

  // Extract engagements from selectedClient (no separate endpoint)
  const engagements = selectedClient?.engagements || [];

  // Fetch client jobs separately
  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/recruiter/clients", selectedClientId, "jobs"],
    enabled: !!selectedClientId,
    select: (data: any) => data.jobs || [],
  });

  // Fetch client stats separately
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/recruiter/clients", selectedClientId, "stats"],
    enabled: !!selectedClientId,
    select: (data: any) => data.stats,
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return await apiRequest(
        `/api/recruiter/clients/${selectedClientId}/contacts/${contactId}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      // Invalidate the main client query which includes contacts
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter/clients", selectedClientId] });
      toast({
        title: "Success",
        description: "Contact removed successfully!",
      });
      setDeleteContactId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove contact",
        variant: "destructive",
      });
    },
  });

  // Delete engagement mutation
  const deleteEngagementMutation = useMutation({
    mutationFn: async (engagementId: string) => {
      return await apiRequest(
        `/api/recruiter/clients/${selectedClientId}/engagements/${engagementId}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      // Invalidate the main client query which includes engagements
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter/clients", selectedClientId] });
      toast({
        title: "Success",
        description: "Agreement removed successfully!",
      });
      setDeleteEngagementId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove agreement",
        variant: "destructive",
      });
    },
  });

  // Filter clients
  const filteredClients = clients.filter((client) => {
    const matchesSearch = client.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Dialog handlers
  const handleAddClient = () => {
    setEditingClient(undefined);
    setClientDialogOpen(true);
  };

  const handleEditClient = (client: CorporateClient) => {
    setEditingClient(client);
    setClientDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading clients...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left Panel - Client List */}
      <div className="w-96 border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Corporate Clients</h1>
            <Button size="icon" onClick={handleAddClient} data-testid="button-add-client">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-clients"
            />
          </div>

          {/* Status Filters */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusFilter("all")}
              data-testid="button-filter-all"
            >
              All
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "active" ? "default" : "outline"}
              onClick={() => setStatusFilter("active")}
              data-testid="button-filter-active"
            >
              Active
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "inactive" ? "default" : "outline"}
              onClick={() => setStatusFilter("inactive")}
              data-testid="button-filter-inactive"
            >
              Inactive
            </Button>
          </div>
        </div>

        {/* Client List */}
        <div className="flex-1 overflow-y-auto">
          {filteredClients.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No clients found</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {filteredClients.map((client) => (
                <Card
                  key={client.id}
                  className={`cursor-pointer hover-elevate ${
                    selectedClientId === client.id
                      ? "ring-2 ring-primary"
                      : ""
                  }`}
                  onClick={() => setSelectedClientId(client.id)}
                  data-testid={`card-client-${client.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(client.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {client.name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {client.industry || "No industry specified"}
                        </p>
                        {(client.city || client.province) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {[client.city, client.province].filter(Boolean).join(", ")}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant={
                              client.status === "active"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {client.status}
                          </Badge>
                          {client.tier && (
                            <Badge variant="outline" className="capitalize">
                              {client.tier}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Client Details */}
      <div className="flex-1 overflow-y-auto">
        {!selectedClient ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Building2 className="w-16 h-16 mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">No client selected</h2>
            <p className="text-muted-foreground max-w-md">
              Select a client from the list to view their details, contacts,
              agreements, jobs, and analytics.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Client Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="text-lg">
                    {getInitials(selectedClient.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-3xl font-bold">
                    {selectedClient.name}
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    {selectedClient.industry || "No industry specified"}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge
                      variant={
                        selectedClient.status === "active"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {selectedClient.status}
                    </Badge>
                    {selectedClient.tier && (
                      <Badge variant="outline" className="capitalize">
                        {selectedClient.tier}
                      </Badge>
                    )}
                    {selectedClient.rating && (
                      <span className="text-sm text-muted-foreground">
                        Rating: {selectedClient.rating}/5
                      </span>
                    )}
                    {(selectedClient.city || selectedClient.province) && (
                      <span className="text-sm text-muted-foreground">
                        • {[selectedClient.city, selectedClient.province].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={() => handleEditClient(selectedClient)} 
                data-testid="button-edit-client"
              >
                Edit Client
              </Button>
            </div>

            <Separator />

            {/* Stats Overview */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Active Jobs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats?.activeJobs || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Total Placements
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats?.totalPlacements || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Revenue (YTD)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    R{(stats?.totalRevenue || 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Avg Days to Fill</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats?.avgDaysToFill || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" data-testid="tab-overview">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="contacts" data-testid="tab-contacts">
                  Contacts ({contacts.length})
                </TabsTrigger>
                <TabsTrigger value="agreements" data-testid="tab-agreements">
                  Agreements ({engagements.length})
                </TabsTrigger>
                <TabsTrigger value="jobs" data-testid="tab-jobs">
                  Jobs ({jobs.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Company Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedClient.registrationNumber && (
                      <div>
                        <h4 className="font-medium mb-2">Registration Number</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedClient.registrationNumber}
                        </p>
                      </div>
                    )}
                    {selectedClient.notes && (
                      <div>
                        <h4 className="font-medium mb-2">Internal Notes</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedClient.notes}
                        </p>
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium mb-2">Added</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(selectedClient.createdAt))}{" "}
                        ago
                      </p>
                    </div>
                  </CardContent>
                </Card>
                
                {(selectedClient.defaultFeePercent || selectedClient.guaranteePeriodDays || selectedClient.paymentTerms) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Default Commercial Terms</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedClient.defaultFeePercent && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Default Fee</span>
                          <span className="text-sm font-medium">{selectedClient.defaultFeePercent}%</span>
                        </div>
                      )}
                      {selectedClient.guaranteePeriodDays && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Guarantee Period</span>
                          <span className="text-sm font-medium">{selectedClient.guaranteePeriodDays} days</span>
                        </div>
                      )}
                      {selectedClient.paymentTerms && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Payment Terms</span>
                          <span className="text-sm font-medium">{selectedClient.paymentTerms}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="contacts" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
                  </p>
                  <Button 
                    size="sm" 
                    data-testid="button-add-contact"
                    onClick={() => {
                      setEditingContact(undefined);
                      setContactDialogOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
                  </Button>
                </div>

                {contacts.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No contacts added yet
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add contact persons for this corporate client
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {contacts.map((contact) => (
                      <Card key={contact.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <Avatar>
                                <AvatarFallback>
                                  {getInitials(contact.fullName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold">{contact.fullName}</h4>
                                  {contact.isPrimary === 1 && (
                                    <Badge variant="outline" className="text-xs">
                                      <Star className="w-3 h-3 mr-1" />
                                      Primary
                                    </Badge>
                                  )}
                                </div>
                                {contact.role && (
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {contact.role}
                                  </p>
                                )}
                                <div className="grid grid-cols-1 gap-1.5 mt-2">
                                  {contact.email && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span>{contact.email}</span>
                                    </div>
                                  )}
                                  {contact.phone && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span>{contact.phone}</span>
                                    </div>
                                  )}
                                  {contact.whatsappNumber && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span>{contact.whatsappNumber}</span>
                                      {contact.whatsappConsent === 1 && (
                                        <Badge variant="secondary" className="text-xs ml-2">
                                          POPIA Consent
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {contact.whatsappConsent === 1 && contact.whatsappConsentDate && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    WhatsApp consent given on{" "}
                                    {new Date(contact.whatsappConsentDate).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {contact.whatsappNumber && contact.whatsappConsent === 1 && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  data-testid={`button-whatsapp-contact-${contact.id}`}
                                  onClick={() => {
                                    const cleanNumber = contact.whatsappNumber!.replace(/\D/g, '');
                                    const whatsappUrl = `https://wa.me/${cleanNumber}`;
                                    window.open(whatsappUrl, '_blank');
                                  }}
                                >
                                  <MessageSquare className="w-4 h-4 mr-2" />
                                  WhatsApp
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-edit-contact-${contact.id}`}
                                onClick={() => {
                                  setEditingContact(contact);
                                  setContactDialogOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-delete-contact-${contact.id}`}
                                onClick={() => setDeleteContactId(contact.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="agreements" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {engagements.length} agreement
                    {engagements.length !== 1 ? "s" : ""}
                  </p>
                  <Button 
                    size="sm" 
                    data-testid="button-add-agreement"
                    onClick={() => {
                      setEditingEngagement(undefined);
                      setEngagementDialogOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Agreement
                  </Button>
                </div>

                {engagements.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No fee agreements added yet
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add commercial terms and fee agreements
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {engagements.map((engagement) => (
                      <Card key={engagement.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold capitalize">
                                  {engagement.agreementType}
                                </h4>
                                <Badge
                                  variant={
                                    engagement.status === "active" ? "default" : "secondary"
                                  }
                                >
                                  {engagement.status}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {engagement.feePercent && (
                                  <div>
                                    <span className="text-muted-foreground">
                                      Fee Percentage:
                                    </span>{" "}
                                    {engagement.feePercent}%
                                  </div>
                                )}
                                {engagement.retainerAmount && (
                                  <div>
                                    <span className="text-muted-foreground">
                                      Retainer:
                                    </span>{" "}
                                    R{(engagement.retainerAmount / 100).toLocaleString()}
                                  </div>
                                )}
                                <div>
                                  <span className="text-muted-foreground">
                                    Start Date:
                                  </span>{" "}
                                  {new Date(
                                    engagement.startDate
                                  ).toLocaleDateString()}
                                </div>
                                {engagement.endDate ? (
                                  <div>
                                    <span className="text-muted-foreground">
                                      End Date:
                                    </span>{" "}
                                    {new Date(
                                      engagement.endDate
                                    ).toLocaleDateString()}
                                  </div>
                                ) : (
                                  <div>
                                    <span className="text-muted-foreground">
                                      Duration:
                                    </span>{" "}
                                    Ongoing
                                  </div>
                                )}
                                {engagement.termsDocument && (
                                  <div className="col-span-2">
                                    <a
                                      href={engagement.termsDocument}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline"
                                    >
                                      View Agreement Document →
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-edit-agreement-${engagement.id}`}
                                onClick={() => {
                                  setEditingEngagement(engagement);
                                  setEngagementDialogOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-delete-agreement-${engagement.id}`}
                                onClick={() => setDeleteEngagementId(engagement.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="jobs" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {jobs.length} job{jobs.length !== 1 ? "s" : ""}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      window.location.href = "/dashboard/recruiter/job-posting";
                    }}
                    data-testid="button-post-job"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Post Job
                  </Button>
                </div>

                {jobs.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No jobs posted for this client yet
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {jobs.map((job: any) => (
                      <Card
                        key={job.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => {
                          window.location.href = `/dashboard/recruiter/job-posting?id=${job.id}`;
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold">{job.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {job.location}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge>{job.status}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {job.employmentType}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Client Dialog */}
      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        client={editingClient}
      />

      {/* Contact Dialog */}
      {selectedClientId && (
        <ContactDialog
          open={contactDialogOpen}
          onOpenChange={setContactDialogOpen}
          clientId={selectedClientId}
          contact={editingContact}
        />
      )}

      {/* Engagement Dialog */}
      {selectedClientId && (
        <EngagementDialog
          open={engagementDialogOpen}
          onOpenChange={setEngagementDialogOpen}
          clientId={selectedClientId}
          engagement={editingEngagement}
        />
      )}

      {/* Delete Contact Confirmation */}
      <AlertDialog open={!!deleteContactId} onOpenChange={(open) => !open && setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Contact?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-contact">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-contact"
              onClick={() => deleteContactId && deleteContactMutation.mutate(deleteContactId)}
              className="bg-destructive text-destructive-foreground hover-elevate"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Engagement Confirmation */}
      <AlertDialog open={!!deleteEngagementId} onOpenChange={(open) => !open && setDeleteEngagementId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Agreement?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this fee agreement? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-agreement">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-agreement"
              onClick={() => deleteEngagementId && deleteEngagementMutation.mutate(deleteEngagementId)}
              className="bg-destructive text-destructive-foreground hover-elevate"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
