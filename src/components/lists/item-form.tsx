"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as z from "zod";
import { Loader2, Plus, Minus } from "lucide-react";

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
      tag?: string;
      value: string;
      isChildItem?: boolean;
      childItems?: Array<{
        title: string;
        tag?: string;
        value: string;
      }>;
    }>;
  };
}

const childItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  tag: z.string().optional(),
  value: z.string().min(1, "Value is required")
});

const propertySchema = z.object({
  tag: z.string().optional(),
  value: z.string().min(1, "Value is required"),
  isChildItem: z.boolean().optional(),
  childItems: z.array(childItemSchema).optional()
});

const formSchema = z.object({
  title: z.string()
    .min(1, "Title is required")
    .max(200, "Title cannot exceed 200 characters"),
  comment: z.string()
    .max(1000, "Comment cannot exceed 1000 characters")
    .optional(),
  properties: z.array(propertySchema)
});

type FormData = z.infer<typeof formSchema>;

export function ItemForm({ mode = 'create', listId, defaultValues }: ItemFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPropertyIndex, setSelectedPropertyIndex] = useState<number | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      comment: defaultValues?.comment || "",
      properties: defaultValues?.properties || []
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const properties = form.getValues('properties');
      const property = properties[index];
      
      if (e.shiftKey) {
        // Outdent: Remove child item status
        if (property.isChildItem) {
          const updatedProperties = [...properties];
          updatedProperties[index] = {
            ...property,
            isChildItem: false,
            childItems: []
          };
          form.setValue('properties', updatedProperties);
        }
      } else {
        // Indent: Make it a child item
        if (!property.isChildItem) {
          const updatedProperties = [...properties];
          updatedProperties[index] = {
            ...property,
            isChildItem: true,
            childItems: [{
              title: property.value,
              tag: property.tag,
              value: property.value
            }]
          };
          form.setValue('properties', updatedProperties);
        }
      }
    }
  };

  const addProperty = () => {
    const properties = form.getValues('properties');
    form.setValue('properties', [
      ...properties,
      { tag: '', value: '', isChildItem: false, childItems: [] }
    ]);
  };

  const removeProperty = (index: number) => {
    const properties = form.getValues('properties');
    form.setValue('properties', properties.filter((_, i) => i !== index));
  };

  const addChildItem = (propertyIndex: number) => {
    const properties = form.getValues('properties');
    const property = properties[propertyIndex];
    
    if (property.isChildItem) {
      const childItems = property.childItems || [];
      const updatedProperties = [...properties];
      updatedProperties[propertyIndex] = {
        ...property,
        childItems: [...childItems, { title: '', tag: '', value: '' }]
      };
      form.setValue('properties', updatedProperties);
    }
  };

  const removeChildItem = (propertyIndex: number, childIndex: number) => {
    const properties = form.getValues('properties');
    const property = properties[propertyIndex];
    
    if (property.isChildItem && property.childItems) {
      const updatedProperties = [...properties];
      updatedProperties[propertyIndex] = {
        ...property,
        childItems: property.childItems.filter((_, i) => i !== childIndex)
      };
      form.setValue('properties', updatedProperties);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      // Get the current list first
      const getResponse = await fetch(`/api/lists/${listId}`);
      if (!getResponse.ok) {
        throw new Error('Failed to get list');
      }
      const list = await getResponse.json();

      // Prepare the new/updated item
      const itemData = {
        id: mode === 'edit' ? defaultValues?.id : Date.now().toString(),
        title: data.title,
        comment: data.comment,
        properties: data.properties
      };

      // Update the list's items
      let updatedItems;
      if (mode === 'create') {
        updatedItems = [...(list.items || []), itemData];
      } else {
        updatedItems = list.items.map((item: any) => 
          item.id === itemData.id ? itemData : item
        );
      }

      // Update the list with the new items
      const response = await fetch(
        `/api/lists/${listId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: updatedItems
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

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Properties</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addProperty}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Property
            </Button>
          </div>

          {form.watch('properties').map((property, propertyIndex) => (
            <div
              key={propertyIndex}
              className={`space-y-4 p-4 border rounded-lg ${
                property.isChildItem ? 'ml-8' : ''
              }`}
              onKeyDown={(e) => handleKeyDown(e, propertyIndex)}
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={`properties.${propertyIndex}.tag`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tag</FormLabel>
                      <FormControl>
                        <Input placeholder="Tag" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`properties.${propertyIndex}.value`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value</FormLabel>
                      <FormControl>
                        <Input placeholder="Value" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {property.isChildItem && (
                <div className="mt-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium">Child Items</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addChildItem(propertyIndex)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Child Item
                    </Button>
                  </div>

                  {property.childItems?.map((_, childIndex) => (
                    <div key={childIndex} className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`properties.${propertyIndex}.childItems.${childIndex}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Title" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`properties.${propertyIndex}.childItems.${childIndex}.tag`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tag</FormLabel>
                            <FormControl>
                              <Input placeholder="Tag" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`properties.${propertyIndex}.childItems.${childIndex}.value`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Value</FormLabel>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input placeholder="Value" {...field} />
                              </FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => removeChildItem(propertyIndex, childIndex)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeProperty(propertyIndex)}
                className="mt-2"
              >
                <Minus className="h-4 w-4 mr-2" />
                Remove Property
              </Button>
            </div>
          ))}
        </div>

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