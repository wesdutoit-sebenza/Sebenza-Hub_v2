import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import PageHeader from "@/components/PageHeader";
import Section from "@/components/Section";
import { Mail, MessageCircle, MapPin, Phone, Send, Briefcase, Users, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  inquiryType: z.string().min(1, "Please select an inquiry type"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(20, "Message must be at least 20 characters"),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function ContactUs() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Contact Us | Sebenza Hub - Get in Touch";
  }, []);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      inquiryType: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    console.log("Contact form submitted:", data);
    
    toast({
      title: "Message sent!",
      description: "We'll get back to you within 24 hours.",
    });
    
    form.reset();
    setIsSubmitting(false);
  };

  const inquiryTypes = [
    { value: "recruiter", label: "Recruiting Agency Inquiry" },
    { value: "corporate", label: "Corporate Hiring Inquiry" },
    { value: "individual", label: "Job Seeker Support" },
    { value: "partnership", label: "Partnership Opportunity" },
    { value: "support", label: "Technical Support" },
    { value: "other", label: "Other" },
  ];

  const contactMethods = [
    {
      icon: <Mail className="text-amber" size={24} />,
      title: "Email",
      value: "hello@sebenzahub.co.za",
      link: "mailto:hello@sebenzahub.co.za",
      description: "Send us an email anytime",
    },
    {
      icon: <MessageCircle className="text-green" size={24} />,
      title: "WhatsApp",
      value: "+27 82 123 4567",
      link: "https://wa.me/27821234567",
      description: "Chat with us on WhatsApp",
    },
    {
      icon: <Phone className="text-cyan" size={24} />,
      title: "Phone",
      value: "+27 11 234 5678",
      link: "tel:+27112345678",
      description: "Call during business hours",
    },
    {
      icon: <MapPin className="text-violet" size={24} />,
      title: "Location",
      value: "Johannesburg, South Africa",
      link: null,
      description: "Serving all of SA",
    },
  ];

  return (
    <div id="main-content">
      <PageHeader
        title="Contact Us"
        description="Get in touch with our team. We're here to help with your recruitment needs."
        breadcrumb="Contact Us"
        gradientVariant="cyan"
      />

      <Section>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <div>
              <h2 className="text-3xl font-serif font-semibold mb-4" data-testid="text-contact-heading">
                We'd love to hear from you
              </h2>
              <p className="text-foreground mb-8">
                Whether you're a recruiting agency looking to streamline your hiring, 
                a company seeking top talent, or a job seeker ready to find your next opportunity, 
                we're here to help. Reach out and let's start a conversation.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Briefcase size={20} className="text-amber" />
                    For Recruiting Agencies
                  </h3>
                  <p className="text-sm text-foreground">
                    Discover how our platform can help you reduce time-to-hire, 
                    improve candidate quality, and maintain POPIA compliance with ease.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Users size={20} className="text-green" />
                    For Corporate Companies
                  </h3>
                  <p className="text-sm text-foreground">
                    Learn how we can support your in-house recruitment with EE/AA tracking, 
                    department workflows, and transparent hiring processes.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <UserCircle size={20} className="text-cyan" />
                    For Job Seekers
                  </h3>
                  <p className="text-sm text-foreground">
                    Get support with your job search, CV optimization, competency tests, 
                    and access to opportunities with transparent salary ranges.
                  </p>
                </div>
              </div>
            </div>

            <Card className="p-8">
              <h3 className="text-2xl font-semibold mb-6" data-testid="text-form-heading">
                Send us a message
              </h3>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Your full name"
                            data-testid="input-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="your.email@example.com"
                            data-testid="input-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="+27 82 123 4567"
                            data-testid="input-phone"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="inquiryType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inquiry Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-inquiry-type">
                              <SelectValue placeholder="Select inquiry type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {inquiryTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Brief subject of your inquiry"
                            data-testid="input-subject"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell us more about your inquiry..."
                            className="min-h-32"
                            data-testid="textarea-message"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full bg-amber-gradient text-charcoal hover:opacity-90"
                    disabled={isSubmitting}
                    data-testid="button-submit"
                  >
                    {isSubmitting ? (
                      "Sending..."
                    ) : (
                      <>
                        <Send size={16} className="mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {contactMethods.map((method, idx) => (
              <Card
                key={idx}
                className="p-6 text-center hover-elevate"
                data-testid={`card-contact-${idx}`}
              >
                <div className="flex justify-center mb-4">{method.icon}</div>
                <h3 className="font-semibold mb-2" data-testid="text-contact-title">
                  {method.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {method.description}
                </p>
                {method.link ? (
                  <a
                    href={method.link}
                    className="text-sm font-medium text-amber hover:text-amber/80"
                    data-testid={`link-contact-${idx}`}
                  >
                    {method.value}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-slate" data-testid={`text-contact-value-${idx}`}>
                    {method.value}
                  </p>
                )}
              </Card>
            ))}
          </div>

          <Card className="p-8 bg-gradient-to-br from-amber/5 to-transparent">
            <div className="text-center max-w-2xl mx-auto">
              <h3 className="text-2xl font-serif font-semibold mb-4" data-testid="text-hours-heading">
                Business Hours
              </h3>
              <p className="text-foreground mb-6">
                Our support team is available Monday to Friday, 8:00 AM - 5:00 PM SAST. 
                We aim to respond to all inquiries within 24 hours during business days.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold">Weekdays</p>
                  <p className="text-foreground">8:00 AM - 5:00 PM SAST</p>
                </div>
                <div>
                  <p className="font-semibold">Weekends</p>
                  <p className="text-foreground">Emergency support only</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </Section>
    </div>
  );
}
