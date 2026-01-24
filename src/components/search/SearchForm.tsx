import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { SearchResults } from "./SearchResults";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchUsers } from "@/lib/server/users";
import { getPartiesByIds } from "@/lib/server/party";
import { Spinner } from "@/components/ui/spinner";

interface SearchFormProps {
  currentUserId?: number;
}

export function SearchForm({ currentUserId }: SearchFormProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data: searchResults,
    isLoading: isSearching,
    error: searchError,
  } = useQuery({
    queryKey: ["searchUsers", debouncedQuery, currentUserId],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return { users: [] };

      const result = await searchUsers({
        data: { q: debouncedQuery, excludeUserId: currentUserId },
      });

      return result;
    },
    enabled: debouncedQuery.trim().length > 0,
  });

  const { data: partyData } = useQuery({
    queryKey: [
      "parties-for-search",
      searchResults?.users?.map((u) => u.partyId).filter(Boolean),
    ],
    queryFn: async () => {
      const partyIds = Array.from(
        new Set(
          searchResults?.users
            ?.filter((u) => u.partyId !== null)
            .map((u) => u.partyId as number) ?? [],
        ),
      );

      if (partyIds.length === 0) return {};

      const result = await getPartiesByIds({
        data: { partyIds },
      });

      return result;
    },
    enabled: !!searchResults?.users && searchResults.users.length > 0,
  });

  return (
    <>
      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-14 text-lg"
          />
        </div>
      </div>

      <div>
        {isSearching && (
          <Card>
            <CardContent className="py-16 text-center">
              <Spinner className="mx-auto h-12 w-12" />
              <p className="mt-3 text-lg text-muted-foreground">Searching...</p>
            </CardContent>
          </Card>
        )}

        {searchError && (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-red-600 dark:text-red-400 text-lg">
                Error searching users. Please try again.
              </p>
            </CardContent>
          </Card>
        )}

        {searchResults && !isSearching && (
          <SearchResults
            users={searchResults.users}
            partyData={partyData || {}}
            searchQuery={debouncedQuery}
          />
        )}
      </div>
    </>
  );
}
