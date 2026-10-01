"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Video, Gift, MapPin, MessagesSquare } from "lucide-react";

const FEATURES = [
  {
    title: "Face-to-face, first",
    description:
      "Video-call before you commit to a coffee date. See who you're really talking to, right from the app.",
    icon: Video,
  },
  {
    title: "Nearby, on your terms",
    description:
      "Search by distance and who you're seeking. Widen the radius or narrow it — you're in control.",
    icon: MapPin,
  },
  {
    title: "Say it with a gift",
    description:
      "Send a rose, a coffee, or something bigger when words aren't quite enough.",
    icon: Gift,
  },
  {
    title: "Conversations that go somewhere",
    description:
      "Real-time messaging built for actually getting to know someone, not just matching and vanishing.",
    icon: MessagesSquare,
  },
];

// Every color below comes from the CSS variables that the Settings page
// controls (--accent-from / --accent-via / --accent-to / --accent-500 ...),
// so the whole page re-themes instantly when the accent changes.
const PRIMARY_BUTTON =
  "accent-gradient-bg border-0 px-10 py-6 text-lg text-white " +
  "[text-shadow:0_1px_2px_rgba(0,0,0,0.4)] " +
  "shadow-[0_0_30px_-8px_var(--accent-500)] hover:opacity-90 " +
  "hover:shadow-[0_0_40px_-6px_var(--accent-400)]";

export default function Home(): React.JSX.Element {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (isSignedIn) router.prefetch("/discover");
  }, [isSignedIn, router]);

  const float = (distance: number) =>
    reduceMotion ? undefined : { y: [0, distance, 0], scale: [1, 1.06, 1] };

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-white px-6 text-center dark:bg-[color-mix(in_oklab,var(--accent-500)_7%,#05070b)]">
      {/* Accent-colored glow blobs (light + dark) */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full opacity-[0.14] blur-3xl dark:opacity-[0.22]"
          style={{ background: "var(--accent-from)" }}
          animate={float(30)}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -right-40 h-[700px] w-[700px] rounded-full opacity-[0.12] blur-3xl dark:opacity-[0.2]"
          style={{ background: "var(--accent-to)" }}
          animate={float(-30)}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-[0.08] blur-3xl dark:opacity-[0.14]"
          style={{ background: "var(--accent-via)" }}
          animate={float(20)}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center pb-16 pt-24">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-serif text-6xl font-medium tracking-tight text-slate-900 dark:text-white md:text-7xl"
          style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
        >
          Meet someone{" "}
          <span
            className="accent-gradient-text"
            style={{ filter: "drop-shadow(0 0 22px var(--accent-500))" }}
          >
            real.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mt-5 max-w-md text-lg text-gray-600 dark:text-gray-300"
        >
          Spark connects you with people nearby through video, messages, and
          small gestures — before the first date ever happens.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-8 flex flex-wrap justify-center gap-4"
        >
          {isSignedIn ? (
            <Button
              size="lg"
              className={PRIMARY_BUTTON}
              onClick={() => router.push("/discover")}
            >
              Go to Discover
            </Button>
          ) : (
            <>
              <SignInButton mode="modal" forceRedirectUrl="/onboarding">
                <Button size="lg" className={PRIMARY_BUTTON}>
                  Join Spark
                </Button>
              </SignInButton>
              <Link href="/sign-in">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-rose-400 bg-transparent px-10 py-6 text-lg text-rose-600 hover:bg-rose-500/10 dark:border-rose-400/60 dark:text-rose-300 dark:hover:bg-rose-500/15"
                >
                  Sign in
                </Button>
              </Link>
            </>
          )}
        </motion.div>
      </div>

      <div className="relative z-10 grid w-full max-w-5xl gap-6 pb-24 sm:grid-cols-2">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: index * 0.08, duration: 0.5 }}
            className="accent-card rounded-2xl border bg-white/70 p-6 text-left shadow-sm backdrop-blur-sm dark:bg-white/5"
          >
            <span className="accent-gradient-bg mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-[0_0_18px_-4px_var(--accent-500)]">
              <feature.icon size={20} />
            </span>
            <h3 className="mb-1 font-semibold text-slate-900 dark:text-white">
              {feature.title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
