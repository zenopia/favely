"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ItemDetails } from "@/types/list";

interface ItemDetailsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (details: ItemDetails) => void;
  initialDetails: ItemDetails;
}

interface ItemProperty {
  id?: string;
  type?: 'text' | 'link';
  tag?: string;
  value: string;
}

export function ItemDetailsOverlay({
  isOpen,
  onClose,
  onSave,
  initialDetails
}: ItemDetailsOverlayProps) {
  const [details, setDetails] = useState<ItemDetails>(initialDetails);

  const handlePropertyChange = (index: number, field: keyof ItemProperty, value: string) => {
    const updatedProperties = [...(details.properties || [])] as ItemProperty[];
    updatedProperties[index] = {
      ...updatedProperties[index],
      [field]: value
    };
    setDetails({ ...details, properties: updatedProperties });
  };

  const addProperty = () => {
    setDetails({
      ...details,
      properties: [
        ...(details.properties || []),
        { id: crypto.randomUUID(), type: 'text', tag: '', value: '' }
      ]
    });
  };

  const removeProperty = (index: number) => {
    const updatedProperties = [...(details.properties || [])];
    updatedProperties.splice(index, 1);
    setDetails({ ...details, properties: updatedProperties });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Item Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Input
              placeholder="Title"
              value={details.title}
              onChange={(e) => setDetails({ ...details, title: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Textarea
              placeholder="Comment (optional)"
              value={details.comment || ''}
              onChange={(e) => setDetails({ ...details, comment: e.target.value })}
            />
          </div>

          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Properties</h3>
              <Button type="button" variant="outline" size="sm" onClick={addProperty}>
                <Plus className="h-4 w-4 mr-1" />
                Add Property
              </Button>
            </div>

            {details.properties?.map((property, index) => (
              <div key={property.id} className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Select
                    value={property.type || 'text'}
                    onValueChange={(value) => handlePropertyChange(index, 'type', value)}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Tag"
                    value={property.tag}
                    onChange={(e) => handlePropertyChange(index, 'tag', e.target.value)}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProperty(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove property</span>
                  </Button>
                </div>

                <Input
                  placeholder="Value"
                  value={property.value}
                  onChange={(e) => handlePropertyChange(index, 'value', e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(details)}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
} 