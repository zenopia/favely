"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ListCategory } from "@/types/list";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as z from "zod";
import { Loader2, Globe, Lock, EyeOff } from "lucide-react";
import { useAuth, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskListEditor } from '@/components/editor/task-list-editor'

interface SavedTaskItem {
  id: string;
  title: string;
  checked: boolean;
  tag?: string;
  childItems?: Array<{
    title: string;
    tag?: string;
  }>;
}

export interface ListFormProps {
  mode?: 'create' | 'edit';
  returnPath?: string;
  defaultValues?: {
    id: string;
    title: string;
    description?: string;
    category: ListCategory;
    visibility: 'public' | 'private' | 'unlisted';
    items: Array<{
      id: string;
      title: string;
      comment?: string;
      completed?: boolean;
      childItems?: Array<{
        title: string;
        tag?: string;
      }>;
    }>;
  };
}

const formSchema = z.object({
  title: z.string()
    .min(3, "Title must be at least 3 characters long")
    .max(100, "Title cannot exceed 100 characters"),
  category: z.enum([
    "movies",
    "tv-shows",
    "books",
    "restaurants",
    "recipes",
    "things-to-do",
    "other"
  ] as const),
  description: z.string()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),
  visibility: z.enum(["public", "unlisted", "private"] as const),
});

type FormData = z.infer<typeof formSchema>;

const FORM_CATEGORIES = [
  "movies",
  "tv-shows",
  "books",
  "restaurants",
  "recipes",
  "things-to-do",
  "other"
] as const;

export function ListFormContent({ defaultValues, mode = 'create', returnPath }: ListFormProps) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskItems, setTaskItems] = useState<SavedTaskItem[]>(() => {
    if (defaultValues?.items) {
      console.log('Initializing taskItems with:', JSON.stringify(defaultValues.items, null, 2));
      return defaultValues.items.map(item => ({
        id: item.id,
        title: item.title,
        checked: item.completed || false,
        childItems: item.childItems || []
      }));
    }
    return [];
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      category: (defaultValues?.category === 'all' ? 'movies' : defaultValues?.category) || "movies",
      description: defaultValues?.description || "",
      visibility: defaultValues?.visibility || "public",
    }
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({
        title: defaultValues.title,
        category: defaultValues.category === 'all' ? 'movies' : defaultValues.category,
        description: defaultValues.description || "",
        visibility: defaultValues.visibility,
      });
    }
  }, [form, defaultValues]);

  const handleTaskItemsChange = (items: SavedTaskItem[]) => {
    setTaskItems(items);
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!isSignedIn || !user?.username) {
      toast.error("Please sign in to create a list");
      return;
    }

    if (taskItems.length === 0) {
      toast.error("Please add at least one item to your list");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: data.title,
        category: data.category,
        description: data.description,
        visibility: data.visibility,
        listType: 'ordered',
        items: taskItems
      };

      console.log('Saving payload:', JSON.stringify(payload, null, 2));

      const endpoint = mode === 'create' 
        ? '/api/lists' 
        : `/api/lists/${defaultValues?.id}`;

      const response = await fetch(endpoint, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save list');
      }

      const result = await response.json();

      toast.success(mode === 'create' ? "List created successfully!" : "List updated successfully!");
      router.push(returnPath || `/lists/${result.list.id}`);
      router.refresh();
    } catch (error) {
      console.error('Error saving list:', error);
      toast.error("Failed to save list. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!defaultValues?.id) return;

    const confirmed = window.confirm("Are you sure you want to delete this list?");
    if (!confirmed) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/lists/${defaultValues.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete list');
      }

      toast.success("List deleted successfully!");
      router.push('/profile/lists');
      router.refresh();
    } catch (error) {
      console.error('Error deleting list:', error);
      toast.error("Failed to delete list. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-[calc(100vh-64px)]">
        <div className="flex-1 container max-w-4xl mx-auto px-4 py-4 space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input 
                    placeholder="List title" 
                    className="text-2xl font-bold h-14 bg-muted/50 focus-visible:bg-muted/80"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center gap-4">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FORM_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "h-3.5 w-3.5 rounded-full shrink-0",
                              {
                                'bg-[var(--category-movies)]': category === 'movies',
                                'bg-[var(--category-tv)]': category === 'tv-shows',
                                'bg-[var(--category-books)]': category === 'books',
                                'bg-[var(--category-restaurants)]': category === 'restaurants',
                                'bg-[var(--category-recipes)]': category === 'recipes',
                                'bg-[var(--category-activities)]': category === 'things-to-do',
                                'bg-[var(--category-other)]': category === 'other'
                              }
                            )} />
                            <span>
                              {category === 'tv-shows' ? 'TV Shows' : 
                               category === 'things-to-do' ? 'Things to do' :
                               category.charAt(0).toUpperCase() + category.slice(1)}
                            </span>
                          </div>
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
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Visibility" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="public">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          <span>Public</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="unlisted">
                        <div className="flex items-center gap-2">
                          <EyeOff className="h-4 w-4" />
                          <span>Unlisted</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="private">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          <span>Private</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea 
                    placeholder="Description (optional)" 
                    className="resize-none"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">List Items</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Type or paste your items below.
                  Press Enter to add new items.
                </p>
                <TaskListEditor
                  initialItems={taskItems}
                  onChange={handleTaskItemsChange}
                  className="mt-4"
                  category={form.watch('category')}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 z-20">
          <div className="container max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              {mode === 'edit' && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Delete List'
                  )}
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting} className="ml-auto">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Create List' : 'Update List'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
} 