"use client";

import { useEffect, useState } from "react";
import { Plus, RotateCcw, Square, Trash2, AlertCircle } from "lucide-react";
import { NavSidebar } from "@/components/NavSidebar";
import { AgentList } from "@/components/AgentList";
import { fetchRemoteAgents, fetchRemoteAgent, startRemoteAgent, stopRemoteAgent, restartRemoteAgent, deleteRemoteAgent } from "@/lib/remote-client";
import { Agent, ConnectionStatus } from "@/lib/types";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [creating, setCreating] = useState(false);
  const [newAgentConfig, setNewAgentConfig] = useState({
    id: "",
    type: "node" as "python" | "node",
    command: "node",
    args: ["agents/node/template.js"],
  });

  const refresh = async () => {
    try {
      setConnectionStatus("connecting");
      const result = await fetchRemoteAgents();
      if (result.success) {
        setAgents(result.data || []);
        setConnectionStatus("connected");
      } else {
        setConnectionStatus("error");
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
      setConnectionStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await startRemoteAgent(newAgentConfig);
      if (result.success) {
        setNewAgentConfig({ id: "", type: "node", command: "node", args: ["agents/node/template.js"] });
        refresh();
      }
    } catch (error) {
      console.error("Failed to create agent:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleStop = async (id: string) => {
    const result = await stopRemoteAgent(id);
    if (result.success) refresh();
  };

  const handleRestart = async (id: string) => {
    const result = await restartRemoteAgent(id);
    if (result.success) refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete agent ${id}?`)) return;
    const result = await deleteRemoteAgent(id);
    if (result.success) refresh();
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <NavSidebar connectionStatus={connectionStatus} />

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Agents</h1>
              <p className="text-muted-foreground">Manage and monitor agent workers</p>
            </div>
            <button
              onClick={() => setNewAgentConfig({ ...newAgentConfig, id: `agent-${Date.now()}` })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </button>
          </div>

          {/* Create Agent Modal */}
          {creating && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-card rounded-xl p-6 w-full max-w-md shadow-xl">
                <h2 className="text-xl font-bold mb-4">Create New Agent</h2>
                <form onSubmit={handleCreateAgent} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Agent ID</label>
                    <input
                      type="text"
                      value={newAgentConfig.id}
                      onChange={(e) => setNewAgentConfig({ ...newAgentConfig, id: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                      value={newAgentConfig.type}
                      onChange={(e) => setNewAgentConfig({ ...newAgentConfig, type: e.target.value as "python" | "node" })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="node">Node.js</option>
                      <option value="python">Python</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Command</label>
                    <input
                      type="text"
                      value={newAgentConfig.command}
                      onChange={(e) => setNewAgentConfig({ ...newAgentConfig, command: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Arguments (space-separated)</label>
                    <input
                      type="text"
                      value={newAgentConfig.args.join(" ")}
                      onChange={(e) => setNewAgentConfig({ ...newAgentConfig, args: e.target.value.split(" ").filter(Boolean) })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                      Create
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <AgentList
            agents={agents}
            onStop={handleStop}
            onRestart={handleRestart}
            onDelete={handleDelete}
            loading={loading}
          />
        </div>
      </main>
    </div>
  );
}