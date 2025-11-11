import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { UpgradeProvider } from "./contexts/UpgradeContext";
import { useRouteGuard } from "@/hooks/use-route-guard";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import Recruiters from "@/pages/Recruiters";
import Individuals from "@/pages/Individuals";
import ContactUs from "@/pages/ContactUs";
import Pricing from "@/pages/Pricing";
import JobDetail from "@/pages/JobDetail";
import Screening from "@/pages/screening";
import Login from "@/pages/login";
import AdminSetup from "@/pages/admin-setup";
import Onboarding from "@/pages/onboarding";
import OnboardingIndividual from "@/pages/onboarding-individual";
import OnboardingBusiness from "@/pages/onboarding-business";
import OnboardingRecruiter from "@/pages/onboarding-recruiter";
import Candidates from "@/pages/candidates";
import CandidateProfile from "@/pages/candidate-profile";
import CandidateAdd from "@/pages/candidate-add";
import Roles from "@/pages/roles";
import RoleScreening from "@/pages/role-screening";
import RecruiterSettings from "@/pages/RecruiterSettings";
import BusinessSettings from "@/pages/BusinessSettings";
import IndividualSettings from "@/pages/IndividualSettings";
import IndividualProfile from "@/pages/IndividualProfile";
import IndividualProfileEdit from "@/pages/IndividualProfileEdit";
import TestCoach from "@/pages/TestCoach";
import TestAccess from "@/pages/TestAccess";
import TestTake from "@/pages/TestTake";
import TestResults from "@/pages/TestResults";
import NotFound from "@/pages/not-found";

// Admin pages
import { AdminLayout } from "@/components/admin/AdminLayout";
import AdminOverview from "@/pages/admin/Overview";
import AdminRecruiters from "@/pages/admin/Recruiters";
import AdminBusinesses from "@/pages/admin/Businesses";
import AdminIndividuals from "@/pages/admin/Individuals";
import AdminCandidates from "@/pages/admin/Candidates";
import AdminRoles from "@/pages/admin/Roles";
import AdminCVs from "@/pages/admin/CVs";
import AdminFraudDetection from "@/pages/admin/FraudDetection";
import AdminBilling from "@/pages/admin/Billing";
import AdminFeatures from "@/pages/admin/Features";
import AdminPlans from "@/pages/admin/Plans";

// Individuals Dashboard pages
import { IndividualsLayout } from "@/components/individuals/IndividualsLayout";
import IndividualDashboardProfile from "@/pages/individuals/Profile";
import IndividualDashboardCVs from "@/pages/individuals/CVs";
import IndividualDashboardAllJobs from "@/pages/individuals/AllJobs";
import IndividualDashboardAutoJobSearch from "@/pages/individuals/AutoJobSearch";
import IndividualDashboardManualJobSearch from "@/pages/individuals/ManualJobSearch";
import IndividualDashboardSavedJobSearches from "@/pages/individuals/SavedJobSearches";
import IndividualDashboardApplications from "@/pages/individuals/Applications";
import IndividualDashboardFavouriteJobs from "@/pages/individuals/FavouriteJobs";
import IndividualDashboardTests from "@/pages/individuals/Tests";
import IndividualDashboardCoaching from "@/pages/individuals/Coaching";
import IndividualDashboardBilling from "@/pages/individuals/Billing";
import IndividualDashboardSettings from "@/pages/individuals/Settings";

// Recruiters Dashboard pages
import { RecruitersLayout } from "@/components/recruiters/RecruitersLayout";
import RecruiterDashboardProfile from "@/pages/dashboard/recruiter/Profile";
import RecruiterDashboardJobs from "@/pages/dashboard/recruiter/JobPostings";
import RecruiterDashboardRoles from "@/pages/dashboard/recruiter/Roles";
import RecruiterDashboardCandidates from "@/pages/dashboard/recruiter/Candidates";
import RecruiterDashboardTests from "@/pages/dashboard/recruiter/Tests";
import RecruiterDashboardTestDetails from "@/pages/dashboard/recruiter/TestDetails";
import RecruiterDashboardScheduling from "@/pages/dashboard/recruiter/Scheduling";
import RecruiterDashboardBilling from "@/pages/dashboard/recruiter/Billing";
import RecruiterDashboardSettings from "@/pages/dashboard/recruiter/Settings";
import RecruiterDashboardClients from "@/pages/recruiter/CorporateClients";

function AdminRouter() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin/overview" component={AdminOverview} />
        <Route path="/admin/recruiters" component={AdminRecruiters} />
        <Route path="/admin/businesses" component={AdminBusinesses} />
        <Route path="/admin/individuals" component={AdminIndividuals} />
        <Route path="/admin/candidates" component={AdminCandidates} />
        <Route path="/admin/roles" component={AdminRoles} />
        <Route path="/admin/cvs" component={AdminCVs} />
        <Route path="/admin/fraud" component={AdminFraudDetection} />
        <Route path="/admin/billing" component={AdminBilling} />
        <Route path="/admin/features" component={AdminFeatures} />
        <Route path="/admin/plans" component={AdminPlans} />
        <Route path="/admin" component={() => {
          const [, navigate] = useLocation();
          navigate("/admin/overview");
          return null;
        }} />
      </Switch>
    </AdminLayout>
  );
}

function IndividualsRouter() {
  return (
    <IndividualsLayout>
      <Switch>
        <Route path="/dashboard/individual/profile" component={IndividualDashboardProfile} />
        <Route path="/dashboard/individual/cvs" component={IndividualDashboardCVs} />
        <Route path="/dashboard/individual/jobs/all" component={IndividualDashboardAllJobs} />
        <Route path="/dashboard/individual/jobs/auto" component={IndividualDashboardAutoJobSearch} />
        <Route path="/dashboard/individual/jobs/manual" component={IndividualDashboardManualJobSearch} />
        <Route path="/dashboard/individual/jobs/saved" component={IndividualDashboardSavedJobSearches} />
        <Route path="/dashboard/individual/applications" component={IndividualDashboardApplications} />
        <Route path="/dashboard/individual/favourites" component={IndividualDashboardFavouriteJobs} />
        <Route path="/dashboard/individual/tests" component={IndividualDashboardTests} />
        <Route path="/dashboard/individual/coaching" component={IndividualDashboardCoaching} />
        <Route path="/dashboard/individual/billing" component={IndividualDashboardBilling} />
        <Route path="/dashboard/individual/settings" component={IndividualDashboardSettings} />
        <Route path="/dashboard/individual" component={() => {
          const [, navigate] = useLocation();
          navigate("/dashboard/individual/profile");
          return null;
        }} />
      </Switch>
    </IndividualsLayout>
  );
}

function RecruitersRouter() {
  return (
    <RecruitersLayout>
      <Switch>
        <Route path="/dashboard/recruiter/tests/:id" component={RecruiterDashboardTestDetails} />
        <Route path="/dashboard/recruiter/profile" component={RecruiterDashboardProfile} />
        <Route path="/dashboard/recruiter/jobs" component={RecruiterDashboardJobs} />
        <Route path="/dashboard/recruiter/roles" component={RecruiterDashboardRoles} />
        <Route path="/dashboard/recruiter/candidates" component={RecruiterDashboardCandidates} />
        <Route path="/dashboard/recruiter/clients" component={RecruiterDashboardClients} />
        <Route path="/dashboard/recruiter/tests" component={RecruiterDashboardTests} />
        <Route path="/dashboard/recruiter/scheduling" component={RecruiterDashboardScheduling} />
        <Route path="/dashboard/recruiter/billing" component={RecruiterDashboardBilling} />
        <Route path="/dashboard/recruiter/settings" component={RecruiterDashboardSettings} />
        <Route path="/dashboard/recruiter" component={() => {
          const [, navigate] = useLocation();
          navigate("/dashboard/recruiter/profile");
          return null;
        }} />
      </Switch>
    </RecruitersLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/admin/setup" component={AdminSetup} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/onboarding/individual" component={OnboardingIndividual} />
      <Route path="/onboarding/business" component={OnboardingBusiness} />
      <Route path="/onboarding/recruiter" component={OnboardingRecruiter} />
      <Route path="/recruiters" component={Recruiters} />
      <Route path="/individuals" component={Individuals} />
      <Route path="/contact" component={ContactUs} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/jobs/:id" component={JobDetail} />
      <Route path="/individuals/job-searches" component={IndividualDashboardManualJobSearch} />
      <Route path="/screening" component={Screening} />
      <Route path="/candidates/new" component={CandidateAdd} />
      <Route path="/candidates/:id" component={CandidateProfile} />
      <Route path="/candidates" component={Candidates} />
      <Route path="/roles/:roleId/screen" component={RoleScreening} />
      <Route path="/roles" component={Roles} />
      <Route path="/settings/recruiter" component={RecruiterSettings} />
      <Route path="/settings/business" component={BusinessSettings} />
      <Route path="/test-coach" component={TestCoach} />
      <Route path="/test/:referenceNumber/results/:attemptId" component={TestResults} />
      <Route path="/test/:referenceNumber/take/:attemptId" component={TestTake} />
      <Route path="/test/:referenceNumber" component={TestAccess} />
      <Route path="/admin/overview" component={() => <AdminRouter />} />
      <Route path="/admin/recruiters" component={() => <AdminRouter />} />
      <Route path="/admin/businesses" component={() => <AdminRouter />} />
      <Route path="/admin/individuals" component={() => <AdminRouter />} />
      <Route path="/admin/candidates" component={() => <AdminRouter />} />
      <Route path="/admin/roles" component={() => <AdminRouter />} />
      <Route path="/admin/cvs" component={() => <AdminRouter />} />
      <Route path="/admin/fraud" component={() => <AdminRouter />} />
      <Route path="/admin/billing" component={() => <AdminRouter />} />
      <Route path="/admin/features" component={() => <AdminRouter />} />
      <Route path="/admin/plans" component={() => <AdminRouter />} />
      <Route path="/admin" component={() => <AdminRouter />} />
      <Route path="/dashboard/individual/profile" component={() => <IndividualsRouter />} />
      <Route path="/dashboard/individual/cvs" component={() => <IndividualsRouter />} />
      <Route path="/dashboard/individual/jobs/all" component={() => <IndividualsRouter />} />
      <Route path="/dashboard/individual/jobs/auto" component={() => <IndividualsRouter />} />
      <Route path="/dashboard/individual/jobs/manual" component={() => <IndividualsRouter />} />
      <Route path="/dashboard/individual/jobs/saved" component={() => <IndividualsRouter />} />
      <Route path="/dashboard/individual/applications" component={() => <IndividualsRouter />} />
      <Route path="/dashboard/individual/favourites" component={() => <IndividualsRouter />} />
      <Route path="/dashboard/individual/tests" component={() => <IndividualsRouter />} />
      <Route path="/dashboard/individual/coaching" component={() => <IndividualsRouter />} />
      <Route path="/dashboard/individual/billing" component={() => <IndividualsRouter />} />
      <Route path="/dashboard/individual/settings" component={() => <IndividualsRouter />} />
      <Route path="/dashboard/individual" component={() => <IndividualsRouter />} />
      <Route path="/dashboard/recruiter/tests/:id" component={() => <RecruitersRouter />} />
      <Route path="/dashboard/recruiter/profile" component={() => <RecruitersRouter />} />
      <Route path="/dashboard/recruiter/jobs" component={() => <RecruitersRouter />} />
      <Route path="/dashboard/recruiter/roles" component={() => <RecruitersRouter />} />
      <Route path="/dashboard/recruiter/candidates" component={() => <RecruitersRouter />} />
      <Route path="/dashboard/recruiter/clients" component={() => <RecruitersRouter />} />
      <Route path="/dashboard/recruiter/tests" component={() => <RecruitersRouter />} />
      <Route path="/dashboard/recruiter/scheduling" component={() => <RecruitersRouter />} />
      <Route path="/dashboard/recruiter/billing" component={() => <RecruitersRouter />} />
      <Route path="/dashboard/recruiter/settings" component={() => <RecruitersRouter />} />
      <Route path="/dashboard/recruiter" component={() => <RecruitersRouter />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  // Route guard runs once at top level to redirect users as needed
  useRouteGuard();

  return (
    <div className="min-h-screen flex flex-col bg-charcoal">
      <Header />
      <div className="flex-1">
        <Router />
      </div>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <UpgradeProvider>
            <AppContent />
            <Toaster />
          </UpgradeProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;