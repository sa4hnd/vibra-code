"use server";

import { Octokit } from "@octokit/rest";
import { auth, clerkClient } from "@clerk/nextjs/server";

export interface Repo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  default_branch: string;
  updated_at: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
}

export async function listRepos(): Promise<Repo[]> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error(
      "No authentication found. Please sign in first."
    );
  }

  // Get GitHub OAuth access token from Clerk
  let githubToken;
  try {
    const client = await clerkClient();
    const oauthTokens = await client.users.getUserOauthAccessToken(userId, "github");
    githubToken = oauthTokens.data[0]?.token;
  } catch (error) {
    console.log("No GitHub OAuth token found, returning empty repository list");
    return [];
  }
  
  if (!githubToken) {
    console.log("No GitHub access token found, returning empty repository list");
    return [];
  }

  const octokit = new Octokit({
    auth: githubToken,
  });

  try {
    // Get user's own repositories and organizations in parallel
    const [{ data: userRepositories }, { data: organizations }] =
      await Promise.all([
        octokit.rest.repos.listForAuthenticatedUser({
          sort: "updated",
          per_page: 100,
          visibility: "all",
          affiliation: "owner,collaborator,organization_member",
        }),
        octokit.rest.orgs.listForAuthenticatedUser({
          per_page: 100,
        }),
      ]);

    // Get repositories from each organization
    const orgRepositoriesPromises = organizations.map(async (org) => {
      try {
        const { data: orgRepos } = await octokit.rest.repos.listForOrg({
          org: org.login,
          per_page: 100,
          sort: "updated",
        });
        return orgRepos;
      } catch (error) {
        // If we can't access org repos (permissions), just return empty array
        console.warn(`Could not fetch repos for org ${org.login}:`, error);
        return [];
      }
    });

    const orgRepositoriesArrays = await Promise.all(orgRepositoriesPromises);
    const orgRepositories = orgRepositoriesArrays.flat();

    // Combine and deduplicate repositories
    const allRepositories = [...userRepositories, ...orgRepositories];
    const uniqueRepositories = allRepositories.filter(
      (repo, index, array) => array.findIndex((r) => r.id === repo.id) === index
    );

    return uniqueRepositories.map(
      (repo): Repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        description: repo.description,
        html_url: repo.html_url,
        default_branch: repo.default_branch || "main",
        updated_at: repo.updated_at || null,
        language: repo.language || null,
        stargazers_count: repo.stargazers_count || 0,
        forks_count: repo.forks_count || 0,
      })
    );
  } catch (error) {
    console.error("GitHub API Error:", error);
    throw new Error(
      `Failed to fetch repositories: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function getBranches(owner: string, repo: string) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error(
      "No authentication found. Please sign in first."
    );
  }

  // Get GitHub OAuth access token from Clerk
  let githubToken;
  try {
    const client = await clerkClient();
    const oauthTokens = await client.users.getUserOauthAccessToken(userId, "github");
    githubToken = oauthTokens.data[0]?.token;
  } catch (error) {
    console.log("No GitHub OAuth token found, returning empty branches list");
    return [];
  }
  
  if (!githubToken) {
    console.log("No GitHub access token found, returning empty branches list");
    return [];
  }

  const octokit = new Octokit({
    auth: githubToken,
  });

  try {
    const { data } = await octokit.rest.repos.listBranches({
      owner,
      repo,
    });

    return data.map((branch) => ({
      name: branch.name,
      protected: branch.protected,
    }));
  } catch (error) {
    console.error("GitHub API Error:", error);
    throw new Error(
      `Failed to fetch branches: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function createRepo({
  repoName,
  token,
  isPrivate = true,
}: {
  repoName: string;
  token: string;
  isPrivate?: boolean;
}) {
  if (!token) {
    throw new Error(
      "No GitHub access token provided. Please authenticate first."
    );
  }

  const octokit = new Octokit({
    auth: token,
  });

  try {
    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      private: isPrivate,
    });

    return {
      full_name: data.full_name,
      private: data.private,
      description: data.description,
      html_url: data.html_url,
      default_branch: data.default_branch || "main",
      created_at: data.created_at || null,
      language: data.language || null,
      stargazers_count: data.stargazers_count || 0,
      forks_count: data.forks_count || 0,
    };
  } catch (error) {
    console.error("GitHub API Error:", error);
    throw new Error(
      `Failed to create repository: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
