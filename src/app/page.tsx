"use client";

import { motion } from "framer-motion";
import { ArrowRight, BookOpen, ChartLine, Handshake } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    title: "Create your party",
    description: "Create your own political party, and mobilize support!",
    icon: <Handshake />,
  },
  {
    title: "Run in Elections",
    description:
      "Mark your political journey and run for office in the Senate or for the Presidency.",
    icon: <ChartLine />,
  },
  {
    title: "Vote on issues",
    description: "Vote on issues and pass policies that matter to you.",
    icon: <BookOpen />,
  },
];

export default function HomePage() {
  const router = useRouter();
  return (
    <div className="overflow-x-hidden">
      <div className="min-h-screen my-8 flex flex-col items-center justify-center px-4 md:px-6">
        <div className="relative text-center md:text-left max-w-3xl w-full mb-12 md:mb-0">
          <div
            className="hidden md:block absolute inset-0 opacity-30 dark:opacity-10 pointer-events-none"
            style={{ transform: "scale(3)" }}
          >
            <Image
              src="/us-outline.png"
              alt="US Map Outline"
              fill
              className="object-contain"
              priority
            />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight relative z-10"
          >
            <span className="text-green-400">democracy</span>
            <span className="text-blue-400">online</span>
            <span>.io</span>
          </motion.h1>

          <motion.div
            className="mt-6 md:mt-8 relative z-10"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-base md:text-lg text-foreground">
              Join the fight for democracy and make your voice heard.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mt-6 md:mt-8 relative z-10 flex justify-center md:justify-start"
          >
            <Button
              size="lg"
              className="text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2"
              onClick={() => router.push("/sign-in")}
            >
              Start Campaign
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>

        <div className="mt-4 md:mt-32 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl w-full">
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 backdrop-blur-sm hover:border-green-600 transition-all h-full">
                <CardContent className="p-6 text-center">
                  <div className="text-green-600 dark:text-green-400 mb-4 flex justify-center">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-green-700 dark:text-green-300 text-sm">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 md:mt-24 text-green-600 dark:text-green-400 text-xs md:text-sm opacity-60 text-center">
          &copy; {new Date().getFullYear()} democracyonline.io - All rights
          reserved.
        </div>
      </div>
    </div>
  );
}
