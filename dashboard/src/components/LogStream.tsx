"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, Filter, Download, RotateCcw, X, ChevronUp, ChevronDown } from "lucide-react";
import { LogEntry, LogLevel } from "@/lib/types";

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "text-muted-foreground",
  info: "text-foreground",
  warn: "text-warning",
  error: "text-destructive",
};

const LEVEL_BG: Record<LogLevel, string> = {
  debug: "bg-muted",
  info: "bg-transparent",
  warn: "bg-warning/10",
  error: "bg-destructive/10",
};

interface LogStreamProps {
  logs: LogEntry[];
  autoScroll?: boolean;
  maxLines?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

export function LogStream({ logs, autoScroll = true, maxLines = 500, onLoadMore, hasMore, loading }: LogStreamProps) {
  const [filterLevel, setFilterLevel] = useState<LogLevel[]>(["debug", "info", "warn", "error"]);
  const [searchTerm, setSearchTerm] = useState("");
  const [paused, setPaused] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!filterLevel.includes(log.level)) return false;
      if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [logs, filterLevel, searchTerm]);

  const scrollToBottom = useCallback(() => {
    if (logContainerRef.current && !paused) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [paused]);

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [filteredLogs.length, autoScroll, scrollToBottom]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && onLoadMore) {
          onLoadMore();
        }
      },
      { root: logContainerRef.current, rootMargin: "100px" }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, onLoadMore]);

  const handleScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setPaused(!isAtBottom);
  };

  const toggleLevel = (level: LogLevel) => {
    setFilterLevel((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]));
  };

  const clearFilters = () => {
    setFilterLevel(["debug", "info", "warn", "error"]);
    setSearchTerm("");
  };

  const exportLogs = () => {
    const content = filteredLogs.map((log) => `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] [${log.agentId}] ${log.message}`).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hermes-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-card border rounded-xl flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-3 border-b border-border flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          {(["debug", "info", "warn", "error"] as LogLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                filterLevel.includes(level)
                  ? `text-${LEVEL_COLORS[level]} bg-${LEVEL_BG[level].replace("bg-", "")}`
                  : "text-muted-foreground hover:bg-muted"
              }`}
              title={level}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
            disabled={filterLevel.length === 4 && !searchTerm}
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </button>
          <button
            onClick={exportLogs}
            className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
            disabled={filteredLogs.length === 0}
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Refresh
          </button>
        </div>
      </div>

      {/* Log Container */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-sm"
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No logs matching filters</p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`px-2 py-1 rounded border-l-4 transition-colors ${
                    log.raw ? "bg-muted/50" : ""
                  } ${LEVEL_BG[log.level]}`}
                  style={{ borderLeftColor: LEVEL_COLORS[log.level].replace("text-", "") }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground whitespace-nowrap shrink-0">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap shrink-0 ${LEVEL_COLORS[log.level]}`}
                    >
                      {log.level.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground whitespace-nowrap shrink-0">
                      {log.agentId}
                    </span>
                    <span className="text-foreground break-all flex-1 min-w-0">{log.message}</span>
                  </div>
                ))}
            </div>

            {/* Load more sentinel */}
            <div ref={sentinelRef} className="h-20 flex items-center justify-center">
              {loading && <div className="text-muted-foreground text-sm">Loading more...</div>}
              {hasMore && !loading && (
                <button
                  onClick={onLoadMore}
                  className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                >
                  Load More
                </button>
              )}
              {!hasMore && filteredLogs.length > 0 && (
                <span className="text-muted-foreground text-sm">End of logs</span>
              )}
            </div>
          </>
        )}

        {/* Auto-scroll indicator */}
        {paused && (
          <div className="absolute bottom-4 right-4 z-10">
            <button
              onClick={() => {
                setPaused(false);
                scrollToBottom();
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg shadow-lg text-sm hover:bg-primary/90 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
              Live
            </button>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-3 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {filteredLogs.length} of {logs.length} logs
        </span>
        <span className="flex items-center gap-4">
          {["debug", "info", "warn", "error"].map((level) => (
            <span
              key={level}
              className={`flex items-center gap-1 ${filterLevel.includes(level) ? "" : "opacity-40"}`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: LEVEL_COLORS[level as LogLevel].replace("text-", "") }}
              />
              {level}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}