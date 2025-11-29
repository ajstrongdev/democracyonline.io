"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Handshake,
  ArrowRight,
  Vote,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  Crown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    title: "Create Your Party",
    description:
      "Build your political movement from the ground up. Define your platform, recruit members, and shape the future.",
    icon: Handshake,
    gradient: "from-green-400 to-emerald-600",
  },
  {
    title: "Run for Office",
    description:
      "Campaign for the Senate or Presidency. Debate opponents, rally supporters, and win elections.",
    icon: Crown,
    gradient: "from-blue-400 to-cyan-600",
  },
  {
    title: "Vote on Bills",
    description:
      "Participate in the legislative process. Review bills, voice your stance, and influence policy.",
    icon: Vote,
    gradient: "from-purple-400 to-pink-600",
  },
];

const benefits = [
  "Shape legislation",
  "Form strategic alliances",
  "Engage in debate",
  "Build your party",
  "Rise to power",
  "Influence policy",
];

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="overflow-x-hidden -m-4">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center px-4 py-12 md:py-20">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-green-400/10 dark:bg-green-400/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-400/10 dark:bg-blue-400/5 rounded-full blur-3xl animate-pulse delay-700" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full text-center space-y-8">
          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight"
          >
            <span className="block bg-gradient-to-r from-green-600 via-primary to-blue-600 dark:from-green-400 dark:via-primary dark:to-blue-400 bg-clip-text text-transparent">
              Your Voice.
            </span>
            <span className="block mt-2 md:mt-3">Your Democracy.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl md:text-2xl text-muted-foreground leading-relaxed"
          >
            democracyonline.io is the ultimate political arena. Build parties,
            win elections, and pass legislation in a living democracy.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              className="text-base sm:text-lg font-semibold px-8 py-6 rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all group"
              onClick={() => router.push("/sign-in")}
            >
              Start Your Campaign
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 md:px-8 lg:px-12 py-12 md:py-20 bg-muted/30">
        <div className="w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 md:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground">
              Three simple steps to political influence
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full border-2 hover:border-primary/50 transition-all hover:shadow-xl group">
                  <CardContent className="p-6 md:p-8">
                    <div
                      className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
                    >
                      <feature.icon className="w-7 h-7 md:w-8 md:h-8 text-white" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold mb-3 text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-4 md:px-8 lg:px-12 py-12 md:py-20">
        <div className="w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 md:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Why Join democracyonline.io?
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-7xl mx-auto">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="flex items-center gap-3 p-4 md:p-5 rounded-xl bg-card border border-border hover:border-green-500 dark:hover:border-green-600 transition-colors"
              >
                <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400 shrink-0" />
                <span className="text-base md:text-lg font-medium text-foreground">
                  {benefit}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-4 md:px-8 lg:px-12 py-12 md:py-20 bg-gradient-to-br from-green-50 via-background to-blue-50 dark:from-green-950/20 dark:via-background dark:to-blue-950/20">
        <div className="w-full text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-6 md:space-y-8"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              Ready to Make History?
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground">
              Join an active community already shaping the future of our
              democracy. Your political journey starts now.
            </p>
            <Button
              size="lg"
              className="text-base sm:text-lg font-semibold px-10 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all group"
              onClick={() => router.push("/sign-in")}
            >
              Begin Your Journey
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-12 md:mt-16 pt-8 border-t border-border"
          >
            <p className="text-xs md:text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} democracyonline.io - All rights
              reserved.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
