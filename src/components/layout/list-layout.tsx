"use client";

import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/nav/sidebar";

interface ListLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function ListLayout({ children, className }: ListLayoutProps) {
  return (
    <div className={cn("flex flex-col min-h-screen bg-background", className)}>
      <div className="flex flex-1">
        <Sidebar className="hidden md:flex" />
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
} 