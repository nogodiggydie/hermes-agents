"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Cpu,
  Activity,
  FileText,
  DollarSign,
  Server,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ConnectionStatus } from "@/lib/types";

interface NavSidebarProps {
  connectionStatus: ConnectionStatus;
  onToggle?: () => void;
  collapsed?: boolean;
}

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Server },
  { href: "/metrics", label: "Metrics", icon: Activity },
  { href: "/logs", label: "Logs", icon: FileText },
  { href: "/costs", label: "Costs", icon: DollarSign },
];

export function NavSidebar({ connectionStatus, collapsed = false, onToggle }: NavSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return "text-success";
      case "connecting":
        return "text-warning";
      case "disconnected":
        return "text-muted-foreground";
      case "error":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: ConnectionStatus) => {
    return status === "connected" ? Wifi : WifiOff;
  };

  const StatusIndicator = getStatusIcon(connectionStatus);
  const statusColor = getStatusColor(connectionStatus);

  const sidebarWidth = collapsed ? "w-16" : "w-64";

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed bottom-4 right-4 z-50 w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 text-white"
        aria-label="Toggle menu"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 ${sidebarWidth} bg-card border-r border-border p-4 flex flex-col transform transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <nav className="space-y-1 flex-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center gap-2 px-2 py-2">
              <StatusIndicator className={`w-4 h-4 ${statusColor}`} />
              {!collapsed && (
                <span className={`text-sm font-medium ${statusColor}`}>
                  {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex ${sidebarWidth} border-r border-border bg-card min-h-screen p-4 flex-col transition-all duration-300`}>
        <div className="flex flex-col h-full">
          <div className="mb-6">
            <h1 className={collapsed ? "hidden" : "text-lg font-semibold text-foreground"}>
              Hermes Dashboard
            </h1>
          </div>

          <nav className="space-y-1 flex-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center gap-2 px-2 py-2">
              <StatusIndicator className={`w-4 h-4 ${statusColor}`} />
              {!collapsed && (
                <span className={`text-sm font-medium ${statusColor}`}>
                  {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}