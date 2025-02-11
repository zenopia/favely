"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ListCategory } from "@/types/list";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
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

export interface ListFormProps {
  mode?: 'create' | 'edit';
  returnPath?: string;
  defaultValues?: {
    id: string;
    title: string;
    description?: string;
    category: ListCategory;
    privacy: 'public' | 'private';
    listType: 'ordered' | 'bullet' | 'task';
    items: Array<{
      id: string;
      title: string;
      comment?: string;
      completed?: boolean;
      properties?: Array<{
        id: string;
        type?: 'text' | 'link';
        tag?: string;
        value: string;
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
  privacy: z.enum(["public", "unlisted", "private"] as const),
  listType: z.enum(["ordered", "bullet", "task"] as const),
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
  const [editorContent, setEditorContent] = useState(() => {
    if (defaultValues?.items) {
      // Convert existing items to HTML list with correct list type
      const listTag = defaultValues.listType === 'bullet' ? 'ul' : 'ol';
      const itemsHtml = defaultValues.items
        .map(item => {
          // Create child items HTML for the properties
          const childItemsHtml = item.properties?.length 
            ? `<${listTag}>${item.properties.map(prop => {
                const tagAttr = prop.tag ? ` data-tag="${prop.tag}"` : '';
                return `<li data-type="listItem"${tagAttr} data-category="${defaultValues.category}"><p>${prop.value}</p></li>`;
              }).join('')}</${listTag}>`
            : '';

          // Return parent item with its children nested inside
          return `<li data-type="listItem"><p>${item.title}</p>${childItemsHtml}</li>`;
        })
        .join('');

      return `<${listTag}>${itemsHtml}</${listTag}>`;
    }
    return '';
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      category: (defaultValues?.category === 'all' ? 'movies' : defaultValues?.category) || "movies",
      description: defaultValues?.description || "",
      privacy: defaultValues?.privacy || "public",
      listType: defaultValues?.listType || "ordered",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!isSignedIn || !user?.username) {
      toast.error("Please sign in to create a list");
      return;
    }

    // Parse the editor content to get list items
    const parser = new DOMParser();
    const doc = parser.parseFromString(editorContent, 'text/html');
    const listItems = Array.from(doc.querySelectorAll('li'));
    
    if (listItems.length === 0) {
      toast.error("Please add at least one item to your list");
      return;
    }

    setIsSubmitting(true);

    try {
      // Process list items to include tags for child items
      const processedItems = listItems.reduce((acc, item) => {
        const isChildItem = item.parentElement?.parentElement?.tagName.toLowerCase() === 'li';
        
        if (!isChildItem) {
          // This is a parent item
          const textContent = Array.from(item.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'P'))
            .map(node => node.textContent)
            .join('')
            .trim();

          // Get all child items (properties) for this parent
          const childList = item.querySelector('ul, ol');
          
          const properties = childList ? Array.from(childList.querySelectorAll(':scope > li')).map(childItem => {
            const tag = childItem.getAttribute('data-tag');
            const value = Array.from(childItem.childNodes)
              .filter(node => node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'P'))
              .map(node => node.textContent)
              .join('')
              .trim();

            return {
              tag: tag || undefined,
              value
            };
          }) : [];

          // Only add parent items to the list
          acc.push({
            title: textContent,
            completed: false,
            properties: properties
          });
        }
        
        return acc;
      }, [] as Array<{
        title: string;
        completed: boolean;
        properties: Array<{
          tag?: string;
          value: string;
        }>;
      }>);

      const payload = {
        title: data.title,
        category: data.category,
        description: data.description,
        privacy: data.privacy,
        listType: data.listType,
        items: processedItems
      };

      const response = await fetch(
        mode === 'create' 
          ? '/api/lists' 
          : `/api/lists/${defaultValues?.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to save list');
      }
      
      toast.success(
        mode === 'create' 
          ? "List created successfully!" 
          : "List updated successfully!"
      );

      if (returnPath) {
        router.push(returnPath);
      } else {
        const listPath = mode === 'create' 
          ? `/lists/${responseData.id}`
          : `/${user.username}/lists/${defaultValues?.id}`;
        router.push(listPath);
      }
      router.refresh();
    } catch (error) {
      console.error('Error saving list:', error);
      toast.error(
        error instanceof Error 
          ? error.message 
          : "Failed to save list"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!defaultValues?.id || !isSignedIn || !user?.username) return;
    
    if (!confirm('Are you sure you want to delete this list? This action cannot be undone.')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/lists/${defaultValues.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete list');
      }

      toast.success('List deleted successfully');
      router.push(`/${user.username}`);
      router.refresh();
    } catch (error) {
      console.error('Error deleting list:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete list');
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
              name="privacy"
              render={({ field }) => (
                <FormItem>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Privacy" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="unlisted">Unlisted</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
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
                <TiptapEditor
                  content={editorContent}
                  onChange={(content) => {
                    setEditorContent(content);
                  }}
                  defaultListType={form.getValues("listType")}
                  onListTypeChange={(type) => form.setValue("listType", type)}
                  category={form.getValues("category")}
                  placeholder="Start your list..."
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