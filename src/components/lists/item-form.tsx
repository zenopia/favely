"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as z from "zod";
import { Loader2 } from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ItemFormProps {
  mode?: 'create' | 'edit';
  listId: string;
  defaultValues?: {
    id: string;
    title: string;
    comment?: string;
    properties?: Array<{
      type?: 'text' | 'link';
      label: string;
      value: string;
    }>;
  };
}

const formSchema = z.object({
  title: z.string()
    .min(1, "Title is required")
    .max(200, "Title cannot exceed 200 characters"),
  comment: z.string()
    .max(1000, "Comment cannot exceed 1000 characters")
    .optional(),
});

type FormData = z.infer<typeof formSchema>;

export function ItemForm({ mode = 'create', listId, defaultValues }: ItemFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      comment: defaultValues?.comment || "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/lists/${listId}/items`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mode === 'create' ? data : {
            index: defaultValues?.id,
            ...data
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save item');
      }

      toast.success(
        mode === 'create'
          ? "Item added successfully!"
          : "Item updated successfully!"
      );

      router.push(`/lists/${listId}`);
      router.refresh();
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error(
        mode === 'create'
          ? "Failed to add item"
          : "Failed to update item"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Item title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Comment</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Add a comment about this item..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/lists/${listId}`)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {mode === 'create' ? 'Add Item' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
} 