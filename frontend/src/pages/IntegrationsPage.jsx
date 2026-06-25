import React from "react";
import { Cable } from "lucide-react";

const ITEMS = [
  { name: "Jira", desc: "Create defects from failed tests, sync status." },
  { name: "Jenkins", desc: "Trigger executions from CI pipeline." },
  { name: "GitHub Actions", desc: "Run tests on every PR via webhook." },
  { name: "GitLab CI", desc: "Pipeline-driven test runs." },
  { name: "Azure DevOps", desc: "Boards + Pipelines integration." },
  { name: "Slack", desc: "Realtime alerts to channels." },
  { name: "Microsoft Teams", desc: "Execution notifications." },
  { name: "Email", desc: "Scheduled reports + failure alerts." },
];

export default function IntegrationsPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Connect</div>
        <h1 className="font-display text-4xl tracking-tighter mt-1">Integrations</h1>
        <p className="text-sm text-zinc-500 mt-2">Connectors to your existing toolchain. Backend ready, UI wiring on the roadmap.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ITEMS.map((it) => (
          <div key={it.name} className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60" data-testid={`integration-${it.name.toLowerCase().replace(/\s+/g, "-")}`}>
            <div className="flex items-start justify-between">
              <Cable className="w-5 h-5 text-zinc-500" />
              <span className="pill border-zinc-800 text-zinc-500">Available</span>
            </div>
            <div className="font-display text-xl tracking-tight mt-3">{it.name}</div>
            <div className="text-xs text-zinc-500 mt-1 min-h-[2rem]">{it.desc}</div>
            <button disabled className="mt-3 text-xs border border-zinc-800 px-2 py-1 rounded-sm text-zinc-500">Configure (coming soon)</button>
          </div>
        ))}
      </div>
    </div>
  );
}
