"use client";
import Image from "next/image";
import { LucideGithub } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function LoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[400px] p-0 overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/brand-assets/05F8029C-1DD1-40AD-97D8-29954B629E25.png"
            alt="Background"
            fill
            className="object-cover"
            priority
          />
          {/* Dark overlay for better text readability */}
          <div className="absolute inset-0 bg-black/60" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 p-6">
          <div className="mb-2 flex flex-col items-center gap-10">
            <Image
              src="/brand-assets/vibra-logo.png"
              alt="Vibra Logo"
              width={100}
              height={100}
              className="mt-6"
            />
            <DialogHeader>
              <DialogTitle className="sm:text-center text-white">
                Sign in to VibraCoder
              </DialogTitle>
              <DialogDescription className="sm:text-center text-white/80">
                Sign in to your account to continue.
              </DialogDescription>
            </DialogHeader>
          </div>
          <SignInButton mode="modal">
            <Button
              type="button"
              className="w-full bg-white text-black hover:bg-white/90"
            >
              <LucideGithub />
              Login with Github
            </Button>
          </SignInButton>
          <p className="text-center text-xs text-white/60 mt-2">
            This will open Github OAuth login page.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
