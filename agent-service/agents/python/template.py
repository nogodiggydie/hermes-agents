#!/usr/bin/env python3
"""
Hermes Agent Python Template
Implements the JSON-lines stdout protocol for communication with the agent service.
"""

import json
import os
import sys
import time
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional


class HermesAgent(ABC):
    def __init__(self, agent_id: Optional[str] = None):
        self.agent_id = agent_id or os.environ.get("HERMES_AGENT_ID", f"agent-{uuid.uuid4().hex[:8]}")
        self.running = True
        self.start_time = time.time()
        self.heartbeat_interval = 10.0
        self.last_heartbeat = 0.0

    def _send(self, message: dict) -> None:
        """Send a JSON message to stdout."""
        print(json.dumps(message), flush=True)

    def log(self, level: str, message: str) -> None:
        """Send a log message via stdout JSON protocol."""
        self._send({
            "type": "log",
            "level": level,
            "msg": message,
        })

    def heartbeat(self) -> None:
        """Send a heartbeat via stdout JSON protocol."""
        self._send({
            "type": "heartbeat",
            "ts": datetime.utcnow().isoformat() + "Z",
            "agent_id": self.agent_id,
        })

    def status(self, state: str, message: str = "") -> None:
        """Send a status update via stdout JSON protocol."""
        self._send({
            "type": "status",
            "state": state,
            "msg": message,
        })

    def cost(
        self,
        provider: str,
        model: str,
        tokens_in: int,
        tokens_out: int,
    ) -> None:
        """Report LLM API usage for cost tracking."""
        self._send({
            "type": "cost",
            "provider": provider,
            "model": model,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "agent_id": self.agent_id,
        })

    def run(self) -> None:
        """Main agent loop."""
        self.status("initializing", "Starting up")
        time.sleep(1)

        self.status("running", "Agent is running")
        self.log("info", f"Agent {self.agent_id} started")

        try:
            while self.running:
                now = time.time()

                if now - self.last_heartbeat >= self.heartbeat_interval:
                    self.heartbeat()
                    self.last_heartbeat = now

                self.do_work()

                time.sleep(1)

        except KeyboardInterrupt:
            self.log("info", "Received interrupt signal")
        except Exception as e:
            self.log("error", f"Agent error: {e}")
            self.status("error", str(e))
        finally:
            self.status("completed", "Agent stopped")
            self.log("info", f"Agent {self.agent_id} stopped")

    @abstractmethod
    def do_work(self) -> None:
        """Override this method with your agent's main work logic."""
        pass


# Example usage:
# class MyAgent(HermesAgent):
#     def do_work(self):
#         # Your work here
#         pass
#
# if __name__ == "__main__":
#     MyAgent().run()