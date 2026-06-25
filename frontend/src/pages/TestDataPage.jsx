import React from "react";
import { Database } from "lucide-react";

export default function TestDataPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Fixtures</div>
        <h1 className="font-display text-4xl tracking-tighter mt-1">Test Data</h1>
        <p className="text-sm text-zinc-500 mt-2">Manage global/local variables, CSV/JSON datasets, and secure values per environment.</p>
      </div>
      <div className="border border-dashed border-zinc-800 rounded-sm p-12 bg-zinc-950/60 text-center" data-testid="test-data-placeholder">
        <Database className="w-8 h-8 text-zinc-600 mx-auto" />
        <div className="font-display text-2xl tracking-tight mt-3">Coming next</div>
        <div className="text-sm text-zinc-500 mt-2 max-w-md mx-auto">
          The backend supports test data records (JSON, CSV, env vars, secure values). UI wiring is queued in the next iteration.
        </div>
      </div>
    </div>
  );
}
