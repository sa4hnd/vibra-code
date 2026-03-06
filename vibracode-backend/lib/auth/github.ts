import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * Get GitHub access token from NextAuth session (server-side)
 */
export async function getGitHubToken(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    if (session?.accessToken && session?.provider === "github") {
      return session.accessToken;
    }
    return null;
  } catch (error) {
    console.error("Error getting GitHub token:", error);
    return null;
  }
}

/**
 * Check if user has GitHub connected (server-side)
 */
export async function hasGitHubConnection(): Promise<boolean> {
  const token = await getGitHubToken();
  return token !== null;
}

/**
 * Get GitHub user info using the token
 */
export async function getGitHubUser(token: string): Promise<{
  login: string;
  name: string | null;
  avatar_url: string;
} | null> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      console.error("GitHub API error:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching GitHub user:", error);
    return null;
  }
}
