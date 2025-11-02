"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import releases from "./releases.json";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Release {
  version: string;
  date: string;
  title: string;
  description: string;
  features: string[];
  bugfixes: string[];
  improvements: string[];
  technical: string[];
}

interface VersionGroup {
  majorMinor: string;
  releases: Release[];
}

export default function ReleasesPage() {
  const [selectedVersion, setSelectedVersion] = useState<string>(
    releases[0]?.version || ""
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set([releases[0]?.version.split(".").slice(0, 2).join(".")])
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Group releases by major.minor version
  const versionGroups: VersionGroup[] = releases.reduce((groups, release) => {
    const majorMinor = release.version.split(".").slice(0, 2).join(".");
    const existingGroup = groups.find((g) => g.majorMinor === majorMinor);

    if (existingGroup) {
      existingGroup.releases.push(release);
    } else {
      groups.push({
        majorMinor,
        releases: [release],
      });
    }

    return groups;
  }, [] as VersionGroup[]);

  const toggleGroup = (majorMinor: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(majorMinor)) {
      newExpanded.delete(majorMinor);
    } else {
      newExpanded.add(majorMinor);
    }
    setExpandedGroups(newExpanded);
  };

  const selectedRelease = releases.find(
    (release) => release.version === selectedVersion
  ) as Release | undefined;

  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-muted rounded w-1/3"></div>
          <div className="h-6 bg-muted rounded w-2/3"></div>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 relative">
      {/* Sidebar - Mobile at top, Desktop fixed on right */}
      <aside className="mb-8 md:mb-0 md:w-72 md:fixed md:right-[max(1.5rem,calc((100vw-80rem)/2))] md:top-24">
        <div className="space-y-6">
          {/* Mobile toggle button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden flex items-center justify-between w-full px-4 py-3 rounded-md bg-accent hover:bg-accent/80 transition-colors"
          >
            <div className="text-left">
              <h3 className="text-lg font-semibold">Versions</h3>
              <p className="text-sm text-muted-foreground">
                {isSidebarOpen ? "Hide versions" : "Show all versions"}
              </p>
            </div>
            {isSidebarOpen ? (
              <ChevronDown className="h-5 w-5 shrink-0" />
            ) : (
              <ChevronRight className="h-5 w-5 shrink-0" />
            )}
          </button>

          {/* Desktop header (always visible) */}
          <div className="hidden md:block space-y-2">
            <h3 className="text-lg font-semibold">Versions</h3>
            <p className="text-sm text-muted-foreground">Select a release</p>
          </div>

          {/* Version list - collapsible on mobile, always visible on desktop */}
          <div
            className={`space-y-2 ${
              isSidebarOpen ? "block" : "hidden md:block"
            }`}
          >
            {versionGroups.map((group) => {
              const hasMultipleReleases = group.releases.length > 1;

              return (
                <div key={group.majorMinor} className="space-y-2">
                  {hasMultipleReleases ? (
                    <>
                      <button
                        onClick={() => toggleGroup(group.majorMinor)}
                        className="flex items-center gap-2 w-full px-4 py-3 rounded-md hover:bg-accent transition-colors text-left"
                      >
                        {expandedGroups.has(group.majorMinor) ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        <span className="font-medium">
                          v{group.majorMinor}.x
                        </span>
                      </button>
                      {expandedGroups.has(group.majorMinor) && (
                        <div className="ml-6 space-y-2">
                          {group.releases.map((release) => (
                            <Button
                              key={release.version}
                              variant={
                                selectedVersion === release.version
                                  ? "default"
                                  : "ghost"
                              }
                              className="w-full justify-start h-auto py-3 px-4"
                              onClick={() =>
                                setSelectedVersion(release.version)
                              }
                            >
                              <div className="text-left">
                                <div className="font-medium">
                                  v{release.version}
                                </div>
                                <div className="text-xs opacity-70">
                                  {release.date}
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Button
                      key={group.releases[0].version}
                      variant={
                        selectedVersion === group.releases[0].version
                          ? "default"
                          : "ghost"
                      }
                      className="w-full justify-start h-auto py-3 px-4"
                      onClick={() =>
                        setSelectedVersion(group.releases[0].version)
                      }
                    >
                      <div className="text-left">
                        <div className="font-medium">
                          v{group.releases[0].version}
                        </div>
                        <div className="text-xs opacity-70">
                          {group.releases[0].date}
                        </div>
                      </div>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="md:pr-[22rem]">
        {/* Main Content */}
        <main className="max-w-3xl">
          {selectedRelease ? (
            <div className="space-y-10">
              <div className="space-y-4">
                <h1 className="text-5xl font-bold">
                  Version {selectedRelease.version}
                </h1>
                <p className="text-2xl text-muted-foreground">
                  {selectedRelease.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  Released on{" "}
                  {new Date(selectedRelease.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-base leading-relaxed">
                  {selectedRelease.description}
                </p>
              </div>

              {selectedRelease.features.length > 0 && (
                <div className="space-y-5">
                  <h2 className="text-2xl font-semibold">✨ New Features</h2>
                  <ul className="space-y-4 pl-6">
                    {selectedRelease.features.map((feature, index) => (
                      <li
                        key={index}
                        className="list-disc text-base leading-relaxed"
                      >
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedRelease.improvements.length > 0 && (
                <div className="space-y-5">
                  <h2 className="text-2xl font-semibold">🚀 Improvements</h2>
                  <ul className="space-y-4 pl-6">
                    {selectedRelease.improvements.map((improvement, index) => (
                      <li
                        key={index}
                        className="list-disc text-base leading-relaxed"
                      >
                        {improvement}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedRelease.bugfixes.length > 0 && (
                <div className="space-y-5">
                  <h2 className="text-2xl font-semibold">🐛 Bug Fixes</h2>
                  <ul className="space-y-4 pl-6">
                    {selectedRelease.bugfixes.map((bugfix, index) => (
                      <li
                        key={index}
                        className="list-disc text-base leading-relaxed"
                      >
                        {bugfix}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedRelease.technical.length > 0 && (
                <div className="space-y-5">
                  <h2 className="text-2xl font-semibold">
                    ⚙️ Technical Changes
                  </h2>
                  <ul className="space-y-4 pl-6">
                    {selectedRelease.technical.map((techChange, index) => (
                      <li
                        key={index}
                        className="list-disc text-base leading-relaxed"
                      >
                        {techChange}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No release selected</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
