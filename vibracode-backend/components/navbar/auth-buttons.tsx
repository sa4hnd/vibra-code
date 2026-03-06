"use client";

import { Lock } from "lucide-react";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

interface AuthButtonsProps {
  isSignedIn: boolean;
  mounted: boolean;
  isSession: boolean;
}

export function AuthButtons({ isSignedIn, mounted, isSession }: AuthButtonsProps) {
  if (!mounted) {
    return null;
  }

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <Button className="h-8">
          <Lock />
          Sign in with Github
        </Button>
      </SignInButton>
    );
  }

  return (
    <>
      <UserButton 
        appearance={{
          elements: {
            avatarBox: "h-6 w-6",
            userButtonPopoverCard: "bg-[#1a1a1a] border border-white/10",
            userButtonPopoverActionButton: "text-white hover:bg-white/10",
            userButtonPopoverActionButtonText: "text-white",
            userButtonPopoverFooter: "hidden"
          }
        }}
      />
      {isSession && <span className="text-muted-foreground/40">/</span>}
    </>
  );
}

