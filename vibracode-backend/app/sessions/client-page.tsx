"use client";

import React, { useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Input } from '@/components/ui/input';
import { Search, Calendar, Code, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { FeatureCard } from '@/components/ui/grid-feature-cards';
import { CustomLoader } from '@/components/ui/custom-loader';

interface Session {
  id: string;
  name: string;
  createdAt: string;
  sessionId?: string;
}

export default function SessionsClientPage() {
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  
  const sessions = useQuery(
    api.sessions.list,
    isSignedIn && user?.id
      ? {
          createdBy: user.id,
        }
      : "skip"
  );

  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    
    return sessions.filter((session) => {
      const matchesSearch = session.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [sessions, searchQuery]);

  const handleSessionClick = (sessionId: string) => {
    router.push(`/session/${sessionId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      },
    },
  };

  if (!sessions) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <CustomLoader text="Loading" className="h-full" />
      </div>
    );
  }

  return (
    <section className="py-16 md:py-32 pt-20">
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4">
        <AnimatedContainer className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-wide text-balance md:text-4xl lg:text-5xl xl:font-extrabold">
            Your Sessions
          </h2>
          <p className="text-muted-foreground mt-4 text-sm tracking-wide text-balance md:text-base">
            Manage and access your development sessions
          </p>
        </AnimatedContainer>

        {/* Search */}
        <AnimatedContainer delay={0.2} className="max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </AnimatedContainer>

        <AnimatedContainer
          delay={0.4}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3"
        >
          {filteredSessions.map((session) => (
            <motion.div
              key={session.id}
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FeatureCard
                feature={{
                  title: session.name,
                  icon: Code,
                  description: `Created: ${formatDate(session._creationTime)}`
                }}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSessionClick(session.id)}
              />
            </motion.div>
          ))}
        </AnimatedContainer>

        {filteredSessions.length === 0 && (
          <AnimatedContainer delay={0.6} className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery 
                ? "No sessions found matching your search." 
                : "No sessions found. Create your first session to get started!"
              }
            </p>
          </AnimatedContainer>
        )}
      </div>
    </section>
  );
}

type ViewAnimationProps = {
  delay?: number;
  className?: React.ComponentProps<typeof motion.div>['className'];
  children: React.ReactNode;
};

function AnimatedContainer({ className, delay = 0.1, children }: ViewAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ filter: 'blur(4px)', translateY: -8, opacity: 0 }}
      whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.8 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
