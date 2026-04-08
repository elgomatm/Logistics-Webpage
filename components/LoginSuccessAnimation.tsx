"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";

export default function LoginSuccessAnimation() {
  const { data: session, status } = useSession();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    // Only fire once per login — use sessionStorage so refresh doesn't re-trigger
    const key = "ten_login_welcomed";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    setShow(true);
    const t = setTimeout(() => setShow(false), 3700);
    return () => clearTimeout(t);
  }, [status]);

  const firstName = session?.user?.name?.split(" ")[0] ?? session?.user?.email ?? "";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeOut" } }}
          className="fixed inset-0 z-[999] flex items-center justify-center pointer-events-none"
        >
          {/* Dark overlay — fades out */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0.55 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 2.2, delay: 0.8, ease: "easeOut" }}
            style={{ background: "#0a0a0a" }}
          />

          {/* Center content */}
          <div className="relative flex flex-col items-center gap-5 text-center">
            {/* Expanding ring */}
            <motion.div
              className="absolute"
              initial={{ scale: 0, opacity: 0.6 }}
              animate={{ scale: 3.5, opacity: 0 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                border: "1px solid rgba(201,169,110,0.5)",
              }}
            />
            <motion.div
              className="absolute"
              initial={{ scale: 0, opacity: 0.35 }}
              animate={{ scale: 5, opacity: 0 }}
              transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                border: "1px solid rgba(201,169,110,0.3)",
              }}
            />

            {/* TEN wordmark */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              className="font-bebas tracking-[0.3em] text-[64px] leading-none"
              style={{ color: "rgba(201,169,110,0.95)" }}
            >
              TEN
            </motion.div>

            {/* Welcome line */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.45 }}
              className="text-[11px] tracking-[0.35em] uppercase"
              style={{ color: "rgba(255,255,255,0.82)" }}
            >
              Welcome back{firstName ? `, ${firstName}` : ""}
            </motion.p>

            {/* Gold rule */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
              style={{
                height: 1,
                width: 80,
                background: "rgba(201,169,110,0.4)",
                transformOrigin: "center",
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
