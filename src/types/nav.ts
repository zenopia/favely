import { LucideIcon } from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  public?: boolean;
  indent?: boolean;
  id?: string;
} 