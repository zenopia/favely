"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams?.get("returnUrl");

  return (
    <div className="container flex items-center justify-center pt-12">
      <SignIn fallbackRedirectUrl={returnUrl || "/"} />
    </div>
  );
} 