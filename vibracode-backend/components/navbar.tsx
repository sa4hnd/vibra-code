"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useUser, UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { SignInPage, Testimonial } from "@/components/ui/sign-in";
import { MessageDisplay } from "@/components/navbar/message-display";
import { GitHubIntegration } from "@/components/session/github-integration";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

const AnimatedNavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const defaultTextColor = 'text-gray-300';
  const hoverTextColor = 'text-white';
  const textSizeClass = 'text-sm';

  return (
    <a href={href} className={`group relative inline-block overflow-hidden h-5 flex items-center ${textSizeClass}`}>
      <div className="flex flex-col transition-transform duration-400 ease-out transform group-hover:-translate-y-1/2">
        <span className={defaultTextColor}>{children}</span>
        <span className={hoverTextColor}>{children}</span>
      </div>
    </a>
  );
};

export default function Navbar() {
  const { isSignedIn, user } = useUser();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [headerShapeClass, setHeaderShapeClass] = useState('rounded-full');
  const [mounted, setMounted] = useState(false);
  const shapeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Session name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const updateSessionName = useMutation(api.sessions.updateName);

  // Detect if we're in a session page
  const isInSession = pathname?.startsWith('/session/');
  const sessionId = isInSession ? pathname?.split('/session/')[1] : null;
  const isValidSessionId = sessionId && /^[a-z0-9]{32}$/.test(sessionId);

  // Get user data for authenticated users
  const userData = useQuery(api.usage.getUserMessages,
    isSignedIn && user ? { clerkId: user.id } : "skip"
  );

  // Get billing mode for authenticated users
  const billingData = useQuery(api.usage.getUserBillingMode,
    isSignedIn && user ? { clerkId: user.id } : "skip"
  );

  // Get session data if we're in a session - requires createdBy for security
  const currentSession = useQuery(
    api.sessions.getById,
    isValidSessionId && user?.id ? { id: sessionId as Id<"sessions">, createdBy: user.id } : "skip"
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  // Set initial edited name when session changes
  useEffect(() => {
    if (currentSession?.name) {
      setEditedName(currentSession.name);
    }
  }, [currentSession?.name]);

  const handleStartEdit = () => {
    if (currentSession?.name) {
      setEditedName(currentSession.name);
      setIsEditingName(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    if (currentSession?.name) {
      setEditedName(currentSession.name);
    }
  };

  const handleSaveEdit = async () => {
    if (!currentSession?._id || !editedName.trim()) {
      handleCancelEdit();
      return;
    }

    const trimmedName = editedName.trim();
    if (trimmedName === currentSession.name) {
      setIsEditingName(false);
      return;
    }

    try {
      await updateSessionName({
        id: currentSession._id,
        name: trimmedName,
      });
      setIsEditingName(false);
      toast.success('Session name updated');
    } catch (error) {
      console.error('Failed to update session name:', error);
      toast.error('Failed to update session name');
      setEditedName(currentSession.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (shapeTimeoutRef.current) {
      clearTimeout(shapeTimeoutRef.current);
    }

    if (isOpen) {
      setHeaderShapeClass('rounded-xl');
    } else {
      shapeTimeoutRef.current = setTimeout(() => {
        setHeaderShapeClass('rounded-full');
      }, 300);
    }

    return () => {
      if (shapeTimeoutRef.current) {
        clearTimeout(shapeTimeoutRef.current);
      }
    };
  }, [isOpen]);

  const logoElement = (
    <a href="/" className="relative w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity">
      <img
        src="/brand-assets/vibra-logo.png"
        alt="Vibra Logo"
        className="w-full h-full object-contain"
      />
    </a>
  );

  const navLinksData = [
    { label: 'Home', href: '/' },
    { label: 'Sessions', href: '/sessions' },
    { label: 'Billing', href: '/billing' },
  ];

  const publicNavLinksData = [
    { label: 'Pricing', href: '/billing' },
    { label: 'Contact', href: '/contact' },
  ];

  const sampleTestimonials: Testimonial[] = [
    {
      avatarSrc: "https://randomuser.me/api/portraits/women/57.jpg",
      name: "Sarah Chen",
      handle: "@sarahdigital",
      text: "Amazing platform! The user experience is seamless and the features are exactly what I needed."
    },
    {
      avatarSrc: "https://randomuser.me/api/portraits/men/64.jpg",
      name: "Marcus Johnson",
      handle: "@marcustech",
      text: "This service has transformed how I work. Clean design, powerful features, and excellent support."
    },
    {
      avatarSrc: "https://randomuser.me/api/portraits/men/32.jpg",
      name: "David Martinez",
      handle: "@davidcreates",
      text: "I've tried many platforms, but this one stands out. Intuitive, reliable, and genuinely helpful for productivity."
    },
  ];

  const loginButtonElement = (
    <button
      onClick={() => setIsSignInOpen(true)}
      className="px-4 py-2 sm:px-3 text-xs sm:text-sm border border-[#333] bg-[rgba(31,31,31,0.62)] text-gray-300 rounded-full hover:border-white/50 hover:text-white transition-colors duration-200 w-full sm:w-auto"
    >
      LogIn
    </button>
  );

  const signupButtonElement = (
    <div className="relative group w-full sm:w-auto">
       <div className="absolute inset-0 -m-2 rounded-full
                     hidden sm:block
                     bg-gray-100
                     opacity-40 filter blur-lg pointer-events-none
                     transition-all duration-300 ease-out
                     group-hover:opacity-60 group-hover:blur-xl group-hover:-m-3"></div>
       <button
         onClick={() => setIsSignInOpen(true)}
         className="relative z-10 px-4 py-2 sm:px-3 text-xs sm:text-sm font-semibold text-black bg-gradient-to-br from-gray-100 to-gray-300 rounded-full hover:from-gray-200 hover:to-gray-400 transition-all duration-200 w-full sm:w-auto"
       >
         Signup
       </button>
    </div>
  );

  // Get billing mode values
  const billingMode = billingData?.billingMode || 'tokens';
  const creditsUSD = billingData?.creditsUSD || 0;
  const creditsUsed = billingData?.creditsUsed || 0;

  return (
    <>
      <header className={`fixed ${isInSession ? 'top-2' : 'top-6'} left-1/2 transform -translate-x-1/2 z-50
                         flex flex-col items-center
                         pl-6 pr-6 py-3 backdrop-blur-sm
                         ${isInSession ? 'rounded-lg' : headerShapeClass}
                         border border-[#333] bg-[#1f1f1f57]
                         ${isInSession ? 'w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)]' : 'w-[calc(100%-2rem)] sm:w-auto'}
                         transition-[border-radius] duration-0 ease-in-out`}>

      <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">
        <div className="flex items-center gap-3">
          {isSignedIn ? (
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
              {currentSession && (
                <div className="flex items-center gap-2 group">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="text-sm text-white font-medium bg-white/10 border border-white/20 rounded px-2 py-1 outline-none focus:border-white/40 min-w-[150px] max-w-[300px]"
                        maxLength={100}
                      />
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSaveEdit();
                        }}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        title="Save (Enter)"
                      >
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      </button>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleCancelEdit();
                        }}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        title="Cancel (Escape)"
                      >
                        <X className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-white font-medium max-w-[200px] truncate">
                        {currentSession.name}
                      </div>
                      <button
                        onClick={handleStartEdit}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded transition-all"
                        title="Edit session name"
                      >
                        <Pencil className="h-3 w-3 text-gray-400" />
                      </button>
                    </>
                  )}
                </div>
              )}
              {isInSession && (
                <a
          href="/"
                  className="text-sm text-gray-300 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
                >
                  ← Home
                </a>
              )}
            </>
          ) : (
            logoElement
          )}
          </div>

        {!isInSession && (
          <nav className="hidden sm:flex items-center space-x-4 sm:space-x-6 text-sm">
            {(isSignedIn ? navLinksData : publicNavLinksData).map((link) => (
              <AnimatedNavLink key={link.href} href={link.href}>
                {link.label}
              </AnimatedNavLink>
            ))}
          </nav>
        )}

        <div className="hidden sm:flex items-center gap-2 sm:gap-3">
          {isSignedIn ? (
            <div className="flex items-center gap-2">
              {isInSession && currentSession && (
                <GitHubIntegration session={currentSession} />
              )}
              {userData && (
                <MessageDisplay
                  remainingMessages={userData.messagesRemaining || 0}
                  usedMessages={userData.messagesUsed || 0}
                  totalMessages={(userData.messagesRemaining || 0) + (userData.messagesUsed || 0)}
                  canSendMessage={(userData.messagesRemaining || 0) > 0}
                  isPro={userData.subscriptionPlan === 'pro'}
                  isLoading={!userData}
                  billingMode={billingMode as 'tokens' | 'credits'}
                  creditsUSD={creditsUSD}
                  creditsUsed={creditsUsed}
                />
              )}
            </div>
          ) : (
            <>
              {loginButtonElement}
              {signupButtonElement}
            </>
          )}
        </div>

        <button className="sm:hidden flex items-center justify-center w-8 h-8 text-gray-300 focus:outline-none" onClick={toggleMenu} aria-label={isOpen ? 'Close Menu' : 'Open Menu'}>
          {isOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          )}
        </button>
      </div>

      <div className={`sm:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden
                       ${isOpen ? 'max-h-[1000px] opacity-100 pt-4' : 'max-h-0 opacity-0 pt-0 pointer-events-none'}`}>
        {!isInSession && (
          <nav className="flex flex-col items-center space-y-4 text-base w-full">
            {(isSignedIn ? navLinksData : publicNavLinksData).map((link) => (
              <a key={link.href} href={link.href} className="text-gray-300 hover:text-white transition-colors w-full text-center">
                {link.label}
              </a>
            ))}
          </nav>
        )}
        {isInSession && (
          <div className="flex flex-col items-center space-y-4 text-base w-full">
            <a href="/" className="text-gray-300 hover:text-white transition-colors w-full text-center px-4 py-2 rounded hover:bg-white/10">
              ← Back to Home
            </a>
            {currentSession && (
              <div className="w-full flex justify-center">
                <GitHubIntegration session={currentSession} />
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col items-center space-y-4 mt-4 w-full">
          {isSignedIn ? (
            <div className="flex flex-col items-center gap-2 w-full">
              {userData && (
                <MessageDisplay
                  remainingMessages={userData.messagesRemaining || 0}
                  usedMessages={userData.messagesUsed || 0}
                  totalMessages={(userData.messagesRemaining || 0) + (userData.messagesUsed || 0)}
                  canSendMessage={(userData.messagesRemaining || 0) > 0}
                  isPro={userData.subscriptionPlan === 'pro'}
                  isLoading={!userData}
                  billingMode={billingMode as 'tokens' | 'credits'}
                  creditsUSD={creditsUSD}
                  creditsUsed={creditsUsed}
                />
              )}
            </div>
          ) : (
            <>
              {loginButtonElement}
              {signupButtonElement}
            </>
          )}
        </div>
      </div>
      </header>

      <SignInPage
        testimonials={sampleTestimonials}
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
      />
    </>
  );
}
