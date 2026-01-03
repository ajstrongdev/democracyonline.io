import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search } from 'lucide-react'
import { searchUsers } from '@/lib/server/users'
import { getPartiesByIds } from '@/lib/server/party'
import { SearchResults } from './SearchResults'
import { Spinner } from '@/components/ui/spinner'

interface SearchFormProps {
  currentUserId?: number
}

export function SearchForm({ currentUserId }: SearchFormProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const {
    data: searchResults,
    isLoading: isSearching,
    error: searchError,
  } = useQuery({
    queryKey: ['searchUsers', debouncedQuery, currentUserId],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return { users: [] }

      const result = await searchUsers({
        data: { q: debouncedQuery, excludeUserId: currentUserId },
      })

      return result
    },
    enabled: debouncedQuery.trim().length > 0,
  })

  const { data: partyData } = useQuery({
    queryKey: [
      'parties-for-search',
      searchResults?.users?.map((u) => u.partyId).filter(Boolean),
    ],
    queryFn: async () => {
      const partyIds = Array.from(
        new Set(
          searchResults?.users
            ?.filter((u) => u.partyId !== null)
            .map((u) => u.partyId as number) ?? [],
        ),
      )

      if (partyIds.length === 0) return {}

      const result = await getPartiesByIds({
        data: { partyIds },
      })

      return result
    },
    enabled: !!searchResults?.users && searchResults.users.length > 0,
  })

  return (
    <Card className="shadow-sm">
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="search" className="sr-only">
              Search for users
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              <Input
                id="search"
                type="text"
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoComplete="off"
                aria-label="Search for users"
              />
            </div>
          </div>
        </form>

        <div className="mt-6">
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
              <p className="mt-3 text-sm text-muted-foreground">Searching...</p>
            </div>
          )}

          {searchError && (
            <div className="text-center py-8">
              <p className="text-red-600 dark:text-red-400">
                Error searching users. Please try again.
              </p>
            </div>
          )}

          {searchResults && !isSearching && (
            <SearchResults
              users={searchResults.users}
              partyData={partyData || {}}
              searchQuery={debouncedQuery}
            />
          )}

          {!debouncedQuery && !isSearching && (
            <div className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                Enter a username to search
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
