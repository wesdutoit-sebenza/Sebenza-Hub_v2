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
} from "@/components/ui/form";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { cvEducationSchema } from "@shared/schema";

const educationFormSchema = z.object({
  education: z.array(cvEducationSchema).min(1, "At least one education entry is required"),
});

type EducationForm = z.infer<typeof educationFormSchema>;

interface Props {
  data: any;
  updateData: (section: string, data: any) => void;
  onNext: () => void;
}

export default function EducationStep({ data, updateData, onNext }: Props) {
  const form = useForm<EducationForm>({
    resolver: zodResolver(educationFormSchema),
    defaultValues: {
      education: data.education && data.education.length > 0 
        ? data.education 
        : [{ level: "", institution: "", period: "", location: "", details: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "education",
  });

  const onSubmit = (formData: EducationForm) => {
    updateData("education", formData.education);
    onNext();
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4" data-testid="text-step-title">Education</h3>
      <p className="text-muted-foreground mb-6">
        Add your educational background, certifications, and qualifications
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {fields.map((field, index) => (
            <Card key={field.id} className="p-6" data-testid={`card-education-${index}`}>
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-semibold">Education {index + 1}</h4>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => remove(index)}
                    data-testid={`button-remove-edu-${index}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name={`education.${index}.level`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Level *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Tertiary Education, Secondary Education"
                          data-testid={`input-level-${index}`}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`education.${index}.institution`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Institution *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. University of Pretoria"
                          data-testid={`input-institution-${index}`}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`education.${index}.period`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Period *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. 1998 - 2000"
                            data-testid={`input-period-${index}`}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`education.${index}.location`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Pretoria, South Africa"
                            data-testid={`input-location-${index}`}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name={`education.${index}.details`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Details</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. B.Com - Human Resources Management (Undergraduate)"
                          className="min-h-20"
                          data-testid={`textarea-details-${index}`}
                          {...field}
                        />
                      </FormControl>
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
            onClick={() => append({ level: "", institution: "", period: "", location: "", details: "" })}
            className="w-full"
            data-testid="button-add-education"
          >
            <Plus size={16} className="mr-2" />
            Add Another Education Entry
          </Button>

          <Button type="submit" className="w-full" data-testid="button-continue">
            Continue to References
          </Button>
        </form>
      </Form>
    </div>
  );
}
