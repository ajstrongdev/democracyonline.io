"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, User, Handshake, Users, UserCheck } from "lucide-react";
import Link from "next/link";
import PartyLogo from "@/components/parties/PartyLogo";
import withAuth from "@/lib/withAuth";
import GenericSkeleton from "@/components/common/genericskeleton";

interface UserResult {
  id: number;
  username: string;
  bio: string;
  political_leaning: string;
  role: string;
  party_id: number | null;
  created_at: string;
  last_activity: number;
}

interface PartyInfo {
  id: number;
  name: string;
  color: string;
  logo: string;
}

function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Fetch user stats
  const { data: userStats } = useQuery({
    queryKey: ["userStats"],
    queryFn: async () => {
      const response = await fetch("/api/user-stats");
      if (!response.ok) {
        throw new Error("Failed to fetch user stats");
      }
      return response.json();
    },
  });

  // Debounce search query
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(value);
    }, 300);
    return () => clearTimeout(timer);
  };

  // Fetch search results
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["searchUsers", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return { users: [] };
      const response = await fetch(
        `/api/search-users?q=${encodeURIComponent(debouncedQuery)}`
      );
      if (!response.ok) {
        throw new Error("Failed to search users");
      }
      return response.json();
    },
    enabled: debouncedQuery.trim().length > 0,
  });

  // Fetch party information for all users with parties
  const { data: partyData } = useQuery({
    queryKey: [
      "parties",
      searchResults?.users?.map((u: UserResult) => u.party_id),
    ],
    queryFn: async () => {
      const partyIds = Array.from(
        new Set(
          searchResults?.users
            ?.filter((u: UserResult) => u.party_id)
            .map((u: UserResult) => u.party_id)
        )
      );

      if (partyIds.length === 0) return {};

      const partyPromises = partyIds.map((id) =>
        fetch(`/api/get-party-by-id?partyId=${id}`).then((res) => res.json())
      );

      const parties = await Promise.all(partyPromises);
      const partyMap: Record<number, PartyInfo> = {};
      parties.forEach((party) => {
        if (party && party.id) {
          partyMap[party.id] = party;
        }
      });

      return partyMap;
    },
    enabled: !!searchResults?.users && searchResults.users.length > 0,
  });

  const users = searchResults?.users || [];

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-3">Find Users</h1>
        <p className="text-muted-foreground text-lg">
          Search for users by their username.
        </p>
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">
                  {userStats?.total ?? "..."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <UserCheck className="w-6 h-6 text-green-600 dark:text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">
                  {userStats?.active ?? "..."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-12 h-14 text-lg"
          />
        </div>
      </div>

      {isSearching && <GenericSkeleton />}

      {!isSearching && debouncedQuery && users.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <User className="mx-auto h-16 w-16 text-muted-foreground/40 mb-4" />
            <p className="text-lg text-muted-foreground">
              No users found matching &quot;{debouncedQuery}&quot;
            </p>
          </CardContent>
        </Card>
      )}

      {!isSearching && users.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground px-1">
            {users.length} result{users.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-3">
            {users.map((user: UserResult) => {
              const party = user.party_id ? partyData?.[user.party_id] : null;
              return (
                <Card
                  key={user.id}
                  className="border-l-4 transition-all hover:shadow-lg hover:scale-[1.01] duration-200"
                  style={{ borderLeftColor: party?.color || "#808080" }}
                >
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                      <div className="flex-shrink-0">
                        {user.party_id ? (
                          <PartyLogo party_id={user.party_id} size={56} />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-xl font-bold shadow-md">
                            I
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="text-xl font-semibold break-words">
                            {user.username}
                          </h3>
                          {user.last_activity > 7 && (
                            <Badge
                              variant="secondary"
                              className="text-xs shrink-0"
                            >
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                          <p className="text-muted-foreground flex items-center gap-1.5">
                            <Handshake className="w-4 h-4" />
                            <span className="font-medium text-foreground">
                              {user.role}
                            </span>
                          </p>
                          {party ? (
                            <p className="text-muted-foreground flex items-center gap-1.5">
                              <Users className="w-4 h-4" />
                              <span
                                className="font-medium"
                                style={{ color: party.color || "#808080" }}
                              >
                                {party.name}
                              </span>
                            </p>
                          ) : (
                            <p className="text-muted-foreground flex items-center gap-1.5">
                              <Users className="w-4 h-4" />
                              <span className="font-medium text-foreground">
                                Independent
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        asChild
                        size="default"
                        className="shrink-0 w-full sm:w-auto"
                      >
                        <Link href={`/profile/${user.id}`}>View Profile</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(SearchPage);
