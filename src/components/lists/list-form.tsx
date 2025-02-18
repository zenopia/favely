"use client";

import { List } from "@/types/list";
import { ListFormContent } from "./list-form-content";

interface ListFormProps {
  mode: 'create' | 'edit';
  defaultValues?: List;
  returnPath?: string;
}

export function ListForm({ mode, defaultValues, returnPath }: ListFormProps) {
  // Only pass the form-relevant fields to ListFormContent
  const formValues = defaultValues && {
    id: defaultValues.id,
    title: defaultValues.title,
    description: defaultValues.description,
    category: defaultValues.category,
    visibility: defaultValues.visibility,
    items: defaultValues.items || [],
    owner: defaultValues.owner
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <ListFormContent mode={mode} defaultValues={formValues} returnPath={returnPath} />
    </div>
  );
}

export default ListForm; 