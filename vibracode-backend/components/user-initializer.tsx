"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Component that ensures users are created in the database immediately when they sign in
 * This runs on every page load for signed-in users
 *
 * IMPORTANT: We wait for Clerk's user data to be fully loaded before creating the user.
 * This prevents creating users with null profile fields due to Clerk's progressive loading.
 */
export function UserInitializer() {
  const { user, isSignedIn, isLoaded } = useUser();
  const createUser = useMutation(api.usage.createUser);
  const updateUserProfile = useMutation(api.usage.updateUserProfile);
  const hasInitialized = useRef(false);
  const lastSyncedData = useRef<string>("");

  useEffect(() => {
    // Wait for Clerk to be fully loaded AND user to be signed in
    if (!isLoaded || !isSignedIn || !user?.id) {
      return;
    }

    // Create a hash of the current profile data to detect changes
    const profileDataHash = JSON.stringify({
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      email: user.primaryEmailAddress?.emailAddress,
      imageUrl: user.imageUrl,
    });

    // Skip if we've already synced this exact data
    if (lastSyncedData.current === profileDataHash && hasInitialized.current) {
      return;
    }

    const syncUser = async () => {
      try {
        // Always try to create/update user with the latest profile data
        await createUser({
          clerkId: user.id,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          fullName: user.fullName || undefined,
          email: user.primaryEmailAddress?.emailAddress || undefined,
          imageUrl: user.imageUrl || undefined,
        });

        // Mark as synced
        lastSyncedData.current = profileDataHash;
        hasInitialized.current = true;
        console.log("✅ User synced with Clerk profile data");
      } catch (error) {
        // If user already exists, try to update their profile instead
        const hasProfileData = user.firstName || user.lastName || user.fullName;
        if (hasProfileData) {
          try {
            await updateUserProfile({
              clerkId: user.id,
              firstName: user.firstName || undefined,
              lastName: user.lastName || undefined,
              fullName: user.fullName || undefined,
              email: user.primaryEmailAddress?.emailAddress || undefined,
              imageUrl: user.imageUrl || undefined,
            });
            lastSyncedData.current = profileDataHash;
            hasInitialized.current = true;
            console.log("✅ User profile updated from Clerk");
          } catch (updateError) {
            // Silently ignore - profile might already be up to date
          }
        }
      }
    };

    syncUser();
  }, [
    isLoaded,
    isSignedIn,
    user?.id,
    user?.firstName,
    user?.lastName,
    user?.fullName,
    user?.primaryEmailAddress?.emailAddress,
    user?.imageUrl,
    createUser,
    updateUserProfile,
  ]);

  // This component doesn't render anything
  return null;
}
