import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";

const aboutMeSchema = z.object({
  aboutMe: z.string().optional(),
});

type AboutMeForm = z.infer<typeof aboutMeSchema>;

interface Props {
  data: any;
  updateData: (section: string, data: any) => void;
  onNext: () => void;
}

export default function AboutMeStep({ data, updateData, onNext }: Props) {
  const form = useForm<AboutMeForm>({
    resolver: zodResolver(aboutMeSchema),
    defaultValues: {
      aboutMe: data.aboutMe || "",
    },
  });

  const onSubmit = (formData: AboutMeForm) => {
    updateData("aboutMe", formData.aboutMe);
    onNext();
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4" data-testid="text-step-title">About Me</h3>
      <p className="text-muted-foreground mb-6">
        Write a brief professional summary or personal statement
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="aboutMe"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Professional Summary</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe your professional background, goals, and what makes you unique..."
                    className="min-h-48"
                    data-testid="textarea-about-me"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <p className="text-sm text-muted-foreground">
            This section is optional but recommended. Share your career story, passions, and what drives you.
          </p>

          <Button type="submit" className="w-full" data-testid="button-continue">
            Continue to Preview
          </Button>
        </form>
      </Form>
    </div>
  );
}
