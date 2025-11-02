"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Rocket } from "lucide-react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function LaunchCountdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const calculateTimeLeft = () => {
      const launchDate = new Date("2025-11-02T20:00:00Z").getTime();
      const now = new Date().getTime();
      const difference = launchDate - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!mounted) {
    return null;
  }

  const isLaunched =
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;

  return (
    <div className="w-full max-w-4xl mb-16">
      {!isLaunched ? (
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <Rocket className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="text-xl font-semibold text-foreground">Release</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Days", value: timeLeft.days },
              { label: "Hours", value: timeLeft.hours },
              { label: "Minutes", value: timeLeft.minutes },
              { label: "Seconds", value: timeLeft.seconds },
            ].map((item) => (
              <Card
                key={item.label}
                className="bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800"
              >
                <CardContent className="p-3 text-center aspect-square flex flex-col items-center justify-center">
                  <div className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400">
                    {String(item.value).padStart(2, "0")}
                  </div>
                  <div className="text-[10px] text-green-700 dark:text-green-300 mt-1 uppercase tracking-wide">
                    {item.label}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card className="bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800">
          <CardContent className="p-8 text-center">
            <div className="text-green-600 dark:text-green-400 mb-4 flex justify-center">
              <Rocket className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold text-green-700 dark:text-green-300 mb-2">
              We&apos;re Live!
            </h2>
            <p className="text-green-600 dark:text-green-400">
              democracyonline.io is now open for everyone!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
