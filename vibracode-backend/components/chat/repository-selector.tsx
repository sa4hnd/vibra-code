"use client";

import { useState, useEffect } from "react";
import { FolderGit2 } from "lucide-react";
import { Repo } from "@/app/actions/github";
import { listRepos } from "@/app/actions/github";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RepositorySelectorProps {
  onRepositoryChange: (repo: Repo | undefined) => void;
  disabled?: boolean;
}

export function RepositorySelector({ onRepositoryChange, disabled }: RepositorySelectorProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(false);
  const [selectedRepo, setSelectedRepo] = useState<Repo | undefined>();

  useEffect(() => {
    const fetchRepos = async () => {
      setIsLoadingRepos(true);
      try {
        const repos = await listRepos();
        setRepos(repos as Repo[]);
      } catch (error) {
        console.error("Failed to fetch repositories:", error);
      } finally {
        setIsLoadingRepos(false);
      }
    };
    fetchRepos();
  }, []);

  const handleRepositoryChange = (repoId: string) => {
    const repo = repos.find((r) => r.id.toString() === repoId);
    setSelectedRepo(repo);
    onRepositoryChange(repo);
  };

  // Group repositories by organization/owner
  const groupedRepos = repos.reduce(
    (acc, repo) => {
      const owner = repo.full_name.split("/")[0];
      if (!acc[owner]) {
        acc[owner] = [];
      }
      acc[owner].push(repo);
      return acc;
    },
    {} as Record<string, Repo[]>
  );

  // Sort organizations alphabetically
  const sortedOrgs = Object.keys(groupedRepos).sort();

  if (isLoadingRepos) {
    return <Skeleton className="w-[240px] h-9" />;
  }

  return (
    <Select
      onValueChange={handleRepositoryChange}
      value={selectedRepo?.id.toString() || ""}
      disabled={disabled}
    >
      <SelectTrigger className="w-[240px] bg-white/10 border-white/20 text-white">
        <SelectValue placeholder="Select repository (optional)" className="text-white/60" />
      </SelectTrigger>
      <SelectContent>
        {sortedOrgs.map((org) => (
          <SelectGroup key={org}>
            <SelectLabel>
              {org} ({groupedRepos[org].length})
            </SelectLabel>
            {groupedRepos[org].map((repo) => (
              <SelectItem key={repo.id} value={repo.id.toString()}>
                <div className="flex items-center gap-2">
                  <FolderGit2 />
                  <span className="font-medium">{repo.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

