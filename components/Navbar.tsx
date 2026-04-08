"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

const navItems = [
  { label: "Reports", href: "#reports" },
  { label: "Guides", href: "#guides" },
  { label: "Emails", href: "#emails" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);

      // Track active section
      const sections = ["reports", "guides", "emails"];
      for (const id of sections.reverse()) {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 120) {
          setActiveSection(id);
          return;
        }
      }
      setActiveSection("");
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (href: string) => {
    setMenuOpen(false);
    const id = href.replace("#", "");
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  // Get initials from name or email
  const getInitials = () => {
    const name = session?.user?.name;
    const email = session?.user?.email;
    if (name) {
      const parts = name.trim().split(" ");
      return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0][0].toUpperCase();
    }
    if (email) return email[0].toUpperCase();
    return "?";
  };

  const displayName = session?.user?.name?.split(" ")[0] ?? session?.user?.email ?? "";

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "glass-nav" : "bg-transparent"
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-8 md:px-16 h-16 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-4 group"
          >
            <div className="flex items-center gap-3">
              {/* TEN logo */}
              <div className="relative h-6 w-auto">
                <Image
                  src="/ten-logo.png"
                  alt="TEN"
                  width={120}
                  height={52}
                  priority
                  style={{
                    mixBlendMode: "screen",
                    height: "22px",
                    width: "auto",
                    opacity: 0.9,
                  }}
                />
              </div>
              <div className="h-5 w-px bg-white/10" />
              <span className="text-[11px] tracking-[0.2em] uppercase text-white/40 group-hover:text-white/60 transition-colors font-medium hidden sm:block">
                Document Studio
              </span>
            </div>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => {
              const isActive = activeSection === item.href.replace("#", "");
              return (
                <button
                  key={item.href}
                  onClick={() => scrollTo(item.href)}
                  className={`relative text-[11px] tracking-[0.18em] uppercase font-medium transition-all duration-300 group ${
                    isActive ? "text-white" : "text-white/35 hover:text-white/70"
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute -bottom-1 left-0 h-px bg-accent transition-all duration-300 ${
                      isActive ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </button>
              );
            })}

            {/* Version tag */}
            <div className="ml-2 tag">v0.1</div>

            {/* User identity + sign out */}
            {session?.user && (
              <div className="flex items-center gap-3 ml-2 pl-4 border-l border-white/[0.08]">
                {/* Avatar */}
                <div className="relative w-7 h-7 flex-shrink-0">
                  {session.user.image ? (
                    <Image
                      src={session.user.image}
                      alt={displayName}
                      width={28}
                      height={28}
                      className="rounded-full object-cover"
                      style={{ opacity: 0.85 }}
                    />
                  ) : (
                    <div
                      className="w-7 h-7 flex items-center justify-center text-[10px] font-semibold tracking-wider"
                      style={{
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      {getInitials()}
                    </div>
                  )}
                </div>

                {/* First name */}
                <span className="text-[11px] tracking-[0.12em] text-white/40 hidden lg:block">
                  {displayName}
                </span>

                {/* Sign out */}
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="text-[10px] tracking-[0.16em] uppercase text-white/25 hover:text-white/55 transition-colors duration-200"
                  title="Sign out"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Toggle menu"
          >
            <span
              className={`block w-5 h-px bg-white/60 transition-all duration-300 ${
                menuOpen ? "rotate-45 translate-y-2" : ""
              }`}
            />
            <span
              className={`block w-5 h-px bg-white/60 transition-all duration-300 ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-5 h-px bg-white/60 transition-all duration-300 ${
                menuOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 left-0 right-0 z-40 glass-nav border-t border-white/[0.05] md:hidden"
          >
            <div className="px-8 py-6 flex flex-col gap-5">
              {navItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => scrollTo(item.href)}
                  className="text-left text-[12px] tracking-[0.18em] uppercase text-white/50 hover:text-white transition-colors"
                >
                  {item.label}
                </button>
              ))}

              {/* Mobile sign out */}
              {session?.user && (
                <div className="pt-3 mt-1 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[11px] text-white/30 tracking-wider">
                    {displayName}
                  </span>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="text-[10px] tracking-[0.16em] uppercase text-white/25 hover:text-white/55 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
