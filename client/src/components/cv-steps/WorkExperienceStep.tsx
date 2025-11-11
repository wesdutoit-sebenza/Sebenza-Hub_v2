import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { cvWorkExperienceSchema } from "@shared/schema";

const workExperienceFormSchema = z.object({
  workExperience: z.array(cvWorkExperienceSchema).min(1, "At least one work experience is required"),
});

type WorkExperienceForm = z.infer<typeof workExperienceFormSchema>;

interface Props {
  data: any;
  updateData: (section: string, data: any) => void;
  onNext: () => void;
}

export default function WorkExperienceStep({ data, updateData, onNext }: Props) {
  const form = useForm<WorkExperienceForm>({
    resolver: zodResolver(workExperienceFormSchema),
    defaultValues: {
      workExperience: data.workExperience && data.workExperience.length > 0
        ? data.workExperience
        : [{
            period: "",
            company: "",
            position: "",
            type: "",
            industry: "",
            clientele: "",
            responsibilities: [{ title: "", items: [""] }],
            references: [],
          }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "workExperience",
  });

  const onSubmit = (formData: WorkExperienceForm) => {
    const processedData = formData.workExperience.map(exp => ({
      ...exp,
      responsibilities: exp.responsibilities?.map(r => ({
        ...r,
        items: r.items.filter(item => item.trim()),
      })).filter(r => r.items.length > 0) || [],
      references: exp.references?.filter(r => r.name.trim()) || [],
    }));
    updateData("workExperience", processedData);
    onNext();
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4" data-testid="text-step-title">Work Experience</h3>
      <p className="text-muted-foreground mb-6">
        Add your work history, starting with your most recent position
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {fields.map((field, expIndex) => (
            <Card key={field.id} className="p-6" data-testid={`card-experience-${expIndex}`}>
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-semibold">Position {expIndex + 1}</h4>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => remove(expIndex)}
                    data-testid={`button-remove-exp-${expIndex}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={`workExperience.${expIndex}.period`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. 2001 - 2012 (12 Years)"
                          data-testid={`input-period-${expIndex}`}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`workExperience.${expIndex}.company`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. TechCorp SA"
                          data-testid={`input-company-${expIndex}`}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`workExperience.${expIndex}.position`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Director"
                          data-testid={`input-position-${expIndex}`}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`workExperience.${expIndex}.type`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Full Time Employment"
                          data-testid={`input-type-${expIndex}`}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`workExperience.${expIndex}.industry`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Information Technology"
                          data-testid={`input-industry-${expIndex}`}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`workExperience.${expIndex}.clientele`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clientele</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Audit Firms, Corporates"
                          data-testid={`input-clientele-${expIndex}`}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-4">
                <FormField
                  control={form.control}
                  name={`workExperience.${expIndex}.responsibilities.0.items`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsibilities</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="List your key responsibilities (one per line)"
                          className="min-h-32"
                          data-testid={`textarea-resp-${expIndex}-0`}
                          value={Array.isArray(field.value) ? field.value.join("\n") : ""}
                          onChange={(e) => field.onChange(e.target.value.split("\n"))}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter each responsibility on a new line
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => append({
              period: "",
              company: "",
              position: "",
              type: "",
              industry: "",
              clientele: "",
              responsibilities: [{ title: "", items: [""] }],
              references: [],
            })}
            className="w-full"
            data-testid="button-add-experience"
          >
            <Plus size={16} className="mr-2" />
            Add Another Position
          </Button>

          <Button type="submit" className="w-full" data-testid="button-continue">
            Continue to Skills
          </Button>
        </form>
      </Form>
    </div>
  );
}
