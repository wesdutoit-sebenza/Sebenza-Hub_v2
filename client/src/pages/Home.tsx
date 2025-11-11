import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MessageCircle, MapPin, Zap, ArrowRight, UserCheck, FileText, ClipboardCheck, Calendar, ShieldAlert, GraduationCap, Briefcase, Brain, Video, CheckCircle } from "lucide-react";
import Section from "@/components/Section";
import Modal from "@/components/Modal";
import FAQAccordion from "@/components/FAQAccordion";
import TourSlides from "@/components/TourSlides";
import { testimonials, valueProps, aiAgents } from "@/data";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import contractSigningImg from "@assets/u3533279657_Happy_employee_signing_contract_desk_with_laptop__c9cd7681-7b1f-449e-9cd3-ed6854df1887_0_1761202295751.png";
import blueCollarImg from "@assets/u3533279657_Blue-collar_workers_at_morning_briefing_outdoor_i_ad47f0c2-e3cf-47ab-8976-d49ad110e3b8_0_1761202295752.png";
import hrTeamImg from "@assets/u3533279657_Modern_HR_team_reviewing_CVs_authentic_South_Afri_f2c1f635-e045-418a-acf5-01ef03bfc454_1_1761202295752.png";
import recruitmentMeetingImg from "@assets/u3533279657_Recruitment_meeting_with_notebook_and_pen_on_desk_4595fa8c-a7b0-45dc-9eeb-cb9f9f393194_3_1761202295752.png";
import handshakeImg from "@assets/u3533279657_Diverse_professionals_shaking_hands_after_intervi_1c642bbb-5603-4c43-aa74-a81f8f5fc995_1_1761202295752.png";
import jobSeekerImg from "@assets/u3533279657_Young_job_seeker_smiling_at_laptop_with_recruiter_3bd02d8d-0f33-42cf-b52a-f5c56e3b4b8c_0_1761202295752.png";
import teamCollabImg from "@assets/u3533279657_South_African_team_collaborating_in_open-plan_off_fdf3ace1-427a-4f16-aaa5-d6099fde55b6_1_1761202295752.png";
import logoVideo from "@assets/Sebenza Hub Logo Clip_1761211070614.mp4";

export default function Home() {
  const [showTourModal, setShowTourModal] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Sebenza Hub | SA recruiting platform—trust layer, WhatsApp-first, compliance";
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiRequest("POST", "/api/subscribe", { email });
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success!",
          description: data.message,
        });
        setEmail("");
      } else {
        toast({
          title: "Oops!",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const iconMap = {
    Sparkles,
    MessageCircle,
    MapPin,
    Zap,
    UserCheck,
    FileText,
    ClipboardCheck,
    Calendar,
    ShieldAlert,
    GraduationCap,
  };

  return (
    <main id="main-content">
      <section className="relative py-8 px-6 overflow-hidden text-[#1a2328] bg-[#1a2328]">
        <div className="max-w-5xl mx-auto">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline
            className="w-full rounded-lg"
            data-testid="video-logo"
          >
            <source src={logoVideo} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </section>
      <section className="relative min-h-[80vh] flex items-center justify-center px-6 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${teamCollabImg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/50" />
        <div className="max-w-6xl mx-auto text-center relative z-10 py-20">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-semibold mb-6 text-white" data-testid="text-hero-title">South Africa’s First AI-Powered Recruiting Platform</h1>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto text-gray-100" data-testid="text-hero-subtitle">Whether you’re hiring or job hunting, Sebenza Hub connects people, passion, and opportunity — faster and smarter than ever.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-amber-gradient text-charcoal hover:opacity-90"
              data-testid="button-hero-access"
              onClick={() => document.getElementById('cta')?.scrollIntoView({ behavior: 'smooth' })}
            >I’m a Recruiter</Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
              data-testid="button-hero-tour"
              onClick={() => setShowTourModal(true)}
            >I’m Looking for Work</Button>
          </div>
        </div>
      </section>
      <Section id="value-props">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {valueProps.map((prop, idx) => {
            const Icon = iconMap[prop.icon as keyof typeof iconMap];
            return (
              <Card key={idx} className="p-6 hover-elevate" data-testid={`card-value-${idx}`}>
                <Icon size={32} className="text-amber mb-4" />
                <h3 className="font-semibold text-lg mb-2 text-[#70787e]" data-testid="text-value-title">{prop.title}</h3>
                <p className="text-sm text-slate" data-testid="text-value-description">{prop.description}</p>
              </Card>
            );
          })}
        </div>
      </Section>
      <Section className="bg-graphite" id="how-it-works">
        <h2 className="text-3xl md:text-4xl font-serif font-semibold text-center mb-4 text-white-brand" data-testid="text-how-it-works-title">Hiring, Simplified. Powered by Sebenza Hub.</h2>
        <p className="text-center mb-12 max-w-2xl mx-auto text-[#ffffff]">From posting to placement, Sebenza Hub streamlines your entire recruitment journey — saving time and connecting you with the right talent, faster.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="p-6 hover-elevate" data-testid="card-process-post">
            <div className="relative mb-4 overflow-hidden rounded-lg">
              <img 
                src={recruitmentMeetingImg} 
                alt="Recruitment meeting and planning" 
                className="w-full aspect-[4/3] object-cover"
              />
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-24 w-24 mt-4 shrink-0 items-center justify-center rounded-full bg-amber/10">
                <Briefcase className="text-amber" size={48} />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-[#70787e]">Find the right talent—fast.</h3>
                <p className="text-slate">Publish your job instantly with transparent salaries, WhatsApp integration, and smart compliance checks—because great hiring starts with clarity.</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 hover-elevate" data-testid="card-process-screen">
            <div className="relative mb-4 overflow-hidden rounded-lg">
              <img 
                src={teamCollabImg} 
                alt="Team collaborating on candidate selection" 
                className="w-full aspect-[4/3] object-cover"
              />
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-24 w-24 mt-4 shrink-0 items-center justify-center rounded-full bg-amber/10">
                <Brain className="text-amber" size={48} />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-[#70787e]">Let our AI do the heavy lifting.</h3>
                <p className="text-slate">Sebenza Hub’s AI-powered engine scans every CV, matches top candidates to your role, and explains why they’re a great fit—saving you hours of manual screening.</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 hover-elevate" data-testid="card-process-interview">
            <div className="relative mb-4 overflow-hidden rounded-lg">
              <img 
                src={handshakeImg} 
                alt="Successful interview conclusion" 
                className="w-full aspect-[4/3] object-cover"
              />
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-24 w-24 mt-4 shrink-0 items-center justify-center rounded-full bg-amber/10">
                <Video className="text-amber" size={48} />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-[#70787e]">Interview smarter, not harder.</h3>
                <p className="text-slate">Chat, schedule, and interview directly via WhatsApp or Teams—all from your dashboard. Real-time collaboration keeps your team aligned and candidates engaged.</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 hover-elevate" data-testid="card-process-hire">
            <div className="relative mb-4 overflow-hidden rounded-lg">
              <img 
                src={contractSigningImg} 
                alt="Happy employee signing employment contract" 
                className="w-full aspect-[4/3] object-cover"
              />
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-24 w-24 mt-4 shrink-0 items-center justify-center rounded-full bg-amber/10">
                <CheckCircle className="text-amber" size={48} />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-[#70787e]">Make the offer in one click.</h3>
                <p className="text-slate">Send digital offers, manage acceptances, and onboard your new hire—all in one seamless flow. Sebenza Hub turns hiring into a human, hassle-free experience.</p>
              </div>
            </div>
          </Card>
        </div>
      </Section>
      <Section id="ai-agents">
        <h2 className="text-3xl md:text-4xl font-serif font-semibold text-center mb-4 text-white-brand" data-testid="text-ai-agents-title">
          Meet Your AI Agents
        </h2>
        <p className="text-center mb-12 max-w-2xl mx-auto text-slate" data-testid="text-ai-agents-subtitle">
          Your Digital Recruiting Team, Always On.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {aiAgents.map((agent, idx) => {
            const Icon = iconMap[agent.icon as keyof typeof iconMap];
            return (
              <Card key={idx} className="p-6 hover-elevate" data-testid={`card-agent-${idx}`}>
                <Icon size={40} className="text-amber mb-4" data-testid={`icon-agent-${idx}`} />
                <h3 className="font-semibold text-lg mb-2 text-[#70787e]" data-testid={`text-agent-title-${idx}`}>{agent.title}</h3>
                <p className="text-sm text-slate" data-testid={`text-agent-description-${idx}`}>{agent.description}</p>
              </Card>
            );
          })}
        </div>
      </Section>
      <Section id="for-who">
        <h2 className="text-3xl md:text-4xl font-serif font-semibold text-center mb-12 text-white-brand" data-testid="text-section-title">
          Built for everyone in SA hiring
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/recruiters">
            <Card className="p-8 hover-elevate h-full cursor-pointer group" data-testid="card-teaser-recruiters">
              <div className="relative mb-4 overflow-hidden rounded-lg">
                <img 
                  src={hrTeamImg} 
                  alt="HR team reviewing candidate CVs" 
                  className="w-full aspect-video object-cover"
                />
              </div>
              <h3 className="text-2xl font-serif font-semibold mb-2 text-[#70787e]" data-testid="text-teaser-title">For Recruiters</h3>
              <p className="text-slate mb-4">
                Less noise. Faster shortlists. Export to Pnet/CJ/Adzuna.
              </p>
              <div className="flex items-center gap-2 text-amber group-hover:gap-3 transition-all">
                <span className="text-sm font-medium">Learn more</span>
                <ArrowRight size={16} />
              </div>
            </Card>
          </Link>

          <Link href="/businesses">
            <Card className="p-8 hover-elevate h-full cursor-pointer group" data-testid="card-teaser-businesses">
              <div className="relative mb-4 overflow-hidden rounded-lg">
                <img 
                  src={blueCollarImg} 
                  alt="Blue-collar workers at morning briefing" 
                  className="w-full aspect-video object-cover"
                />
              </div>
              <h3 className="text-2xl font-serif font-semibold mb-2 text-[#70787e]" data-testid="text-teaser-title">For Businesses</h3>
              <p className="text-slate mb-4">
                SME-friendly hiring with POPIA/EE compliance built-in.
              </p>
              <div className="flex items-center gap-2 text-amber group-hover:gap-3 transition-all">
                <span className="text-sm font-medium">Learn more</span>
                <ArrowRight size={16} />
              </div>
            </Card>
          </Link>

          <Link href="/individuals">
            <Card className="p-8 hover-elevate h-full cursor-pointer group" data-testid="card-teaser-individuals">
              <div className="relative mb-4 overflow-hidden rounded-lg">
                <img 
                  src={jobSeekerImg} 
                  alt="Young job seeker collaborating with recruiter" 
                  className="w-full aspect-video object-cover"
                />
              </div>
              <h3 className="text-2xl font-serif font-semibold mb-2 text-[#70787e]" data-testid="text-teaser-title">For Individuals</h3>
              <p className="text-slate mb-4">
                One profile. Real salary ranges. Skills that matter.
              </p>
              <div className="flex items-center gap-2 text-amber group-hover:gap-3 transition-all">
                <span className="text-sm font-medium">Learn more</span>
                <ArrowRight size={16} />
              </div>
            </Card>
          </Link>
        </div>
      </Section>
      <Section className="bg-graphite" id="testimonials">
        <h2 className="text-3xl md:text-4xl font-serif font-semibold text-center mb-12 text-white-brand" data-testid="text-testimonials-title">
          Trusted by SA recruiters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, idx) => (
            <Card key={idx} className="p-6" data-testid={`card-testimonial-${idx}`}>
              <p className="text-slate mb-4 italic" data-testid="text-testimonial-quote">
                "{testimonial.quote}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber/10 flex items-center justify-center">
                  <span className="text-amber font-semibold">
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#70787e]" data-testid="text-testimonial-name">{testimonial.name}</p>
                  <p className="text-xs text-slate" data-testid="text-testimonial-role">
                    {testimonial.title}, {testimonial.company}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>
      <Section id="faq">
        <h2 className="text-3xl md:text-4xl font-serif font-semibold text-center mb-12 text-white-brand" data-testid="text-faq-title">
          Frequently asked questions
        </h2>
        <div className="max-w-3xl mx-auto">
          <FAQAccordion audience="all" />
        </div>
      </Section>
      <Section className="bg-graphite" id="cta">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-semibold mb-4 text-white-brand" data-testid="text-cta-title">
            Ready to transform your hiring?
          </h2>
          <p className="mb-8 text-[#ffffff]">
            Join the waitlist for early access. No credit card required.
          </p>
          <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.co.za"
              data-testid="input-email"
              className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
              disabled={isSubmitting}
            />
            <Button type="submit" data-testid="button-subscribe" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Get early access"}
            </Button>
          </form>
        </div>
      </Section>
      <Modal isOpen={showTourModal} onClose={() => setShowTourModal(false)} title="Product Tour">
        <TourSlides />
      </Modal>
    </main>
  );
}
