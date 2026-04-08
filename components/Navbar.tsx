"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";

const navItems = [
  { label: "Reports",   href: "#reports",   page: false },
  { label: "Analytics", href: "/analytics", page: true  },
  { label: "Settings",  href: "/settings",  page: true  },
];

export default function Navbar() {
  const [scrolled, setScrolled]    = useState(false);
  const [activeSection, setActive] = useState("");
  const [menuOpen, setMenuOpen]    = useState(false);
  const { data: session }          = useSession();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      const sections = ["reports", "guides", "analytics"];
      for (const id of [...sections].reverse()) {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 120) { setActive(id); return; }
      }
      setActive("");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNav = (item: typeof navItems[0]) => {
    setMenuOpen(false);
    if (item.page) {
      router.push(item.href);
    } else {
      document.getElementById(item.href.replace("#", ""))?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const getInitials = () => {
    const name = session?.user?.name;
    if (name) {
      const parts = name.trim().split(" ");
      return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0][0].toUpperCase();
    }
    return session?.user?.email?.[0]?.toUpperCase() ?? "?";
  };

  const displayName = session?.user?.name?.split(" ")[0] ?? session?.user?.email ?? "";

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "glass-nav" : "glass-nav"}`}
      >
        <div className="max-w-[1360px] mx-auto px-6 md:px-14 h-16 flex items-center justify-between">

          {/* Left — wordmark only, no logo image */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-3 group"
          >
            <span
              className="font-bebas text-[22px] tracking-[0.18em] leading-none select-none"
              style={{ color: "var(--text-1)" }}
            >
              TEN
            </span>
            <div className="h-4 w-px" style={{ background: "var(--border-mid)" }} />
            <span
              className="text-[10px] tracking-[0.22em] uppercase font-medium hidden sm:block"
              style={{ color: "var(--text-2)" }}
            >
              Document Studio
            </span>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-7">
            {navItems.map((item) => {
              const isActive = item.page
                ? pathname === item.href
                : activeSection === item.href.replace("#", "");
              return (
                <button
                  key={item.href}
                  onClick={() => handleNav(item)}
                  className="relative text-[11px] tracking-[0.18em] uppercase font-medium transition-colors duration-200"
                  style={{ color: isActive ? "var(--text-1)" : "var(--text-2)" }}
                >
                  {item.label}
                  <span
                    className="absolute -bottom-1 left-0 h-px transition-all duration-300"
                    style={{
                      background: "var(--champagne)",
                      width: isActive ? "100%" : "0%",
                    }}
                  />
                </button>
              );
            })}

            <span
              className="text-[9px] tracking-[0.18em] uppercase px-2 py-1 rounded-full border"
              style={{ color: "var(--text-2)", borderColor: "var(--border-mid)" }}
            >
              v0.1
            </span>

            {/* User */}
            {session?.user && (
              <div className="flex items-center gap-3 pl-4" style={{ borderLeft: "1px solid var(--border-mid)" }}>
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={displayName}
                    width={26}
                    height={26}
                    className="rounded-full object-cover"
                    style={{ opacity: 0.9 }}
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold"
                    style={{
                      background: "rgba(122,80,16,0.1)",
                      color: "var(--champagne)",
                      border: "1px solid rgba(122,80,16,0.25)",
                    }}
                  >
                    {getInitials()}
                  </div>
                )}
                <span className="text-[11px] tracking-[0.1em] hidden lg:block font-medium" style={{ color: "var(--text-1)" }}>
                  {displayName}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="text-[10px] tracking-[0.14em] uppercase font-medium transition-colors duration-200"
                  style={{ color: "var(--text-2)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--text-1)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-2)")}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Toggle menu"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block w-5 h-px transition-all duration-300"
                style={{
                  background: "var(--text-1)",
                  transform: menuOpen
                    ? i === 0 ? "rotate(45deg) translateY(8px)"
                    : i === 2 ? "rotate(-45deg) translateY(-8px)"
                    : "none"
                    : "none",
                  opacity: menuOpen && i === 1 ? 0 : 1,
                }}
              />
            ))}
          </button>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed top-16 left-0 right-0 z-40 glass-nav"
            style={{ borderTop: "1px solid var(--border-mid)" }}
          >
            <div className="px-6 py-5 flex flex-col gap-4">
              {navItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => handleNav(item)}
                  className="text-left text-[12px] tracking-[0.18em] uppercase font-medium"
                  style={{ color: "var(--text-1)" }}
                >
                  {item.label}
                </button>
              ))}
              {session?.user && (
                <div
                  className="pt-3 mt-1 flex items-center justify-between"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <span className="text-[11px] font-medium" style={{ color: "var(--text-1)" }}>
                    {displayName}
                  </span>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="text-[10px] tracking-[0.14em] uppercase font-medium"
                    style={{ color: "var(--text-2)" }}
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
