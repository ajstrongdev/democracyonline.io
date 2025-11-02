"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Handshake, ChartLine, BookOpen, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
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
    <div className="min-h-screen  my-8 flex flex-col items-center justify-center px-6">
      <div className="relative text-center max-w-3xl">
        <div className="absolute inset-0 opacity-30 dark:opacity-10 scale-300">
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
          className="text-5xl md:text-6xl font-bold tracking-tight relative"
        >
          <span className="text-green-400">democracy</span>
          <span className="text-blue-400">online</span>
          <span>.io</span>
        </motion.h1>

        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-lg text-left text-foreground">
            Join the fight for democracy and make your voice heard.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mt-8 z-10 relative"
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

      <div className="mt-32 grid md:grid-cols-3 gap-8 max-w-6xl w-full">
        {features.map((feature, i) => (
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

      <div className="mt-24 text-green-600 dark:text-green-400 text-sm opacity-60">
        &copy; {new Date().getFullYear()} democracyonline.io - All rights
        reserved.
      </div>
    </div>
  );
}
