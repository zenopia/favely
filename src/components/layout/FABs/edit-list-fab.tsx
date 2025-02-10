"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface EditListFABProps {
  listId: string;
  username: string;
}

export function EditListFAB({ listId }: EditListFABProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');

  return (
    <Link 
      href={`/profile/lists/edit/${listId}?from=${encodeURIComponent(currentPath)}`}
      className="block mb-20 sm:mb-8"
    >
      <Button 
        size="lg"
        className="h-14 px-6 shadow-lg flex items-center gap-2 fab-button"
      >
        <Pencil className="h-5 w-5" />
        <span>Edit list</span>
      </Button>
    </Link>
  );
} 