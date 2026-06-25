import React from "react";

function flatten(data, prefix, depth, max, rows) {
  if (rows.length > 80 || depth > max) return;
  if (data === null || data === undefined || typeof data !== "object") {
    rows.push({ path: prefix, value: data, depth });
    return;
  }
  const entries = Array.isArray(data)
    ? data.slice(0, 5).map((v, i) => [i, v])
    : Object.entries(data).slice(0, 20);
  rows.push({ path: prefix, value: data, depth, isContainer: true });
  for (const [k, v] of entries) {
    flatten(v, prefix + "." + k, depth + 1, max, rows);
  }
}

export default function ResponseTree({ data, onPick }) {
  const rows = [];
  flatten(data, "$", 0, 3, rows);
  return (
    <div className="space-y-0.5">
      {rows.map((r, i) => (
        <div key={i} style={{ paddingLeft: r.depth * 10 }} className="text-xs font-mono">
          <button onClick={() => onPick(r.path)} className="text-zinc-300 hover:text-amber-400">
            {r.path}
          </button>
          {!r.isContainer && (
            <span className="text-emerald-400 ml-2">{JSON.stringify(r.value)}</span>
          )}
          {r.isContainer && (
            <span className="text-zinc-600 ml-2">
              {Array.isArray(r.value) ? "[" + r.value.length + "]" : "{...}"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
