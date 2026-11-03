import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Ban, BookOpen, FileClock, Inbox, LayoutDashboard, LogOut, Menu, MessagesSquare, ShieldCheck, Users, UsersRound, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Badge, Button, cn } from "./ui";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/students", label: "Students", icon: Users },
  { to: "/groups", label: "Groups", icon: UsersRound },
  { to: "/requests", label: "Requests", icon: Inbox },
  { to: "/chats", label: "Chats", icon: MessagesSquare },
  { to: "/blocked-numbers", label: "Blocked numbers", icon: Ban },
  { to: "/audit", label: "Audit log", icon: FileClock },
  { to: "/admins", label: "Admins", icon: ShieldCheck },
  { to: "/api", label: "API & docs", icon: BookOpen },
];

export function Layout() {
  const { admin, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
            )
          }
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-60">
      {/* Sidebar: fixed on large screens, a drawer on small ones. */}
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-slate-900 transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-orange-400 text-xs font-bold text-slate-900">C</span>
            CapstoneConnect Admin
          </span>
          <button className="text-slate-400 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-slate-800 p-3 text-xs text-slate-400">
          <p className="truncate font-medium text-slate-200">{admin?.name}</p>
          <p className="truncate">{admin?.email}</p>
          <div className="mt-2 flex items-center justify-between">
            <Badge tone={admin?.role === "admin" ? "orange" : "gray"}>{admin?.role === "admin" ? "Admin" : "Read-only"}</Badge>
            <button onClick={() => void signOut()} className="flex items-center gap-1 text-slate-300 hover:text-white">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </aside>
      {open ? <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} /> : null}

      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-slate-200 bg-white px-4 lg:hidden">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <span className="ml-2 text-sm font-semibold">CapstoneConnect Admin</span>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
