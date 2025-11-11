import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cvReferenceSchema } from "@shared/schema";
import type { CVReference } from "@shared/schema";

const referencesFormSchema = z.object({
  references: z.array(cvReferenceSchema),
});

type ReferencesForm = z.infer<typeof referencesFormSchema>;

interface Props {
  data: any;
  updateData: (section: string, data: any) => void;
  onNext: () => void;
}

export default function ReferencesStep({ data, updateData, onNext }: Props) {
  const form = useForm<ReferencesForm>({
    resolver: zodResolver(referencesFormSchema),
    defaultValues: {
      references: data.references || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "references",
  });

  const onSubmit = (formData: ReferencesForm) => {
    updateData("references", formData.references);
    onNext();
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4" data-testid="text-step-title">Professional References</h3>
      <p className="text-muted-foreground mb-6">
        Add professional references who can vouch for your work
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {fields.map((field, index) => (
            <Card key={field.id} className="p-6" data-testid={`card-reference-${index}`}>
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-semibold">Reference {index + 1}</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => remove(index)}
                  data-testid={`button-remove-ref-${index}`}
                >
                  <Trash2 size={16} />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={`references.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. John Smith" data-testid={`input-ref-name-${index}`} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`references.${index}.title`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title/Position *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Senior Manager" data-testid={`input-ref-title-${index}`} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`references.${index}.phone`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 082 123 4567" data-testid={`input-ref-phone-${index}`} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`references.${index}.email`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. john@company.com" data-testid={`input-ref-email-${index}`} {...field} />
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
            onClick={() => append({ name: "", title: "", phone: "", email: "" })}
            className="w-full"
            data-testid="button-add-reference"
          >
            <Plus size={16} className="mr-2" />
            Add Reference
          </Button>

          <Button type="submit" className="w-full" data-testid="button-continue">
            Continue to About Me
          </Button>
        </form>
      </Form>
    </div>
  );
}
