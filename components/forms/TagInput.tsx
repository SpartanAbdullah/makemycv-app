"use client";

import { KeyboardEvent, useState } from "react";

export const TagInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) => {
  const [input, setInput] = useState("");

  const addTag = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    onChange([...value, trimmed]);
    setInput("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(input);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-wrap gap-2">
        {value.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, tagIndex) => tagIndex !== index))}
              className="text-slate-500"
            >
              x
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-w-[160px] flex-1 bg-transparent text-sm outline-none"
        />
      </div>
    </div>
  );
};

