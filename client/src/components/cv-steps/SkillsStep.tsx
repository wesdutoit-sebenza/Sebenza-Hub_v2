import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { cvSkillsSchema } from "@shared/schema";
import { SkillsMultiSelect } from "@/components/SkillsMultiSelect";
import { migrateSkillsToNewFormat } from "@shared/skillsMigration";

const skillsFormSchema = z.object({
  skills: cvSkillsSchema,
});

type SkillsForm = z.infer<typeof skillsFormSchema>;

interface Props {
  data: any;
  updateData: (section: string, data: any) => void;
  onNext: () => void;
}

export default function SkillsStep({ data, updateData, onNext }: Props) {
  // Migrate old skills format to new format if needed
  const migratedSkills = data.skills ? migrateSkillsToNewFormat(data.skills) : [];
  
  const form = useForm<SkillsForm>({
    resolver: zodResolver(skillsFormSchema),
    defaultValues: {
      skills: migratedSkills,
    },
  });

  const onSubmit = (formData: SkillsForm) => {
    updateData("skills", formData.skills);
    onNext();
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4" data-testid="text-step-title">Skills</h3>
      <p className="text-muted-foreground mb-6">
        Select up to 10 skills from the list below
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="skills"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Skills</FormLabel>
                <FormControl>
                  <SkillsMultiSelect
                    value={field.value}
                    onChange={field.onChange}
                    maxSkills={10}
                    placeholder="Select your skills..."
                  />
                </FormControl>
                <FormDescription>
                  Choose skills that best represent your capabilities. You can select up to 10 skills.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" data-testid="button-continue">
            Continue to Education
          </Button>
        </form>
      </Form>
    </div>
  );
}
