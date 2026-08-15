"use client";
import { useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { CheckCircle2 } from "lucide-react";

export function SuccessHero() {
  useEffect(() => {
    const fire = (origin: { x: number; y: number }) =>
      confetti({
        particleCount: 80,
        spread: 80,
        startVelocity: 40,
        origin,
        colors: ["#E63946", "#F4D03F", "#F39C12", "#7CB342"],
      });
    fire({ x: 0.2, y: 0.4 });
    setTimeout(() => fire({ x: 0.8, y: 0.4 }), 250);
    setTimeout(() => fire({ x: 0.5, y: 0.35 }), 500);
  }, []);

  return (
    <motion.div
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", damping: 12, stiffness: 200 }}
      className="grid h-24 w-24 place-items-center rounded-full bg-vv-leaf text-white"
    >
      <CheckCircle2 className="h-12 w-12" />
    </motion.div>
  );
}
