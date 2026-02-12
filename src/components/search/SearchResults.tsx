import { User, Handshake, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PartyLogo from "@/components/party-logo";

interface UserResult {
  id: number;
  username: string;
  bio: string | null;
  politicalLeaning: string | null;
  role: string | null;
  partyId: number | null;
  createdAt: Date | null;
  lastActivity: number | null;
}

interface PartyInfo {
  id: number;
  name: string;
  color: string | null;
  logo: string | null;
}

interface SearchResultsProps {
  users: Array<UserResult>;
  partyData: Record<number, PartyInfo>;
  searchQuery: string;
}

export function SearchResults({
  users,
  partyData,
  searchQuery,
}: SearchResultsProps) {
  if (users.length === 0 && searchQuery) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <User className="mx-auto h-16 w-16 text-muted-foreground/40 mb-4" />
          <p className="text-lg text-muted-foreground">
            No users found matching &quot;{searchQuery}&quot;
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground px-1">
        {users.length} result{users.length !== 1 ? "s" : ""}
      </p>
      <div className="space-y-3">
        {users.map((user) => {
          const party = user.partyId ? partyData[user.partyId] : null;

          return (
            <Card
              key={user.id}
              className="border-l-4 transition-all hover:shadow-lg hover:scale-[1.01] duration-200"
              style={{ borderLeftColor: party?.color || "#808080" }}
            >
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                  <div className="shrink-0">
                    {user.partyId ? (
                      <PartyLogo party_id={user.partyId} size={56} />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-linear-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-xl font-bold shadow-md">
                        I
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-xl font-semibold wrap-break-word">
                        {user.username}
                      </h3>
                      {user.lastActivity !== null && user.lastActivity > 14 && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <p className="text-muted-foreground flex items-center gap-1.5">
                        <Handshake className="w-4 h-4" />
                        <span className="font-medium text-foreground">
                          {user.role || "Citizen"}
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
                    <Link to="/profile/$id" params={{ id: user.id.toString() }}>
                      View Profile
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
