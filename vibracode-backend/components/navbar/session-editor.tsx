"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface SessionEditorProps {
  sessionId: string;
  sessionName: string;
}

export function SessionEditor({ sessionId, sessionName }: SessionEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const editRef = useRef<HTMLSpanElement>(null);
  const originalValue = useRef<string>("");
  const updateSession = useMutation(api.sessions.update);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(editRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    originalValue.current = sessionName;
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editRef.current) {
      const newValue = editRef.current.textContent?.trim() || "";
      if (newValue && newValue !== originalValue.current) {
        await updateSession({
          id: sessionId as Id<"sessions">,
          name: newValue,
        });
      } else if (!newValue) {
        // Restore original value if empty
        editRef.current.textContent = originalValue.current;
      }
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (editRef.current) {
        editRef.current.textContent = originalValue.current;
      }
      setIsEditing(false);
    }
  };

  return (
    <div className="flex items-center gap-x-2">
      <button
        onClick={handleStartEdit}
        className="flex items-center gap-x-1 px-1 py-1.5 rounded-md hover:bg-white/10 transition-colors group cursor-pointer"
      >
        <span
          ref={editRef}
          contentEditable={isEditing}
          suppressContentEditableWarning={true}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`text-sm font-medium text-white outline-none ${
            isEditing ? "bg-white/10 rounded" : ""
          }`}
        >
          {sessionName}
        </span>
      </button>
    </div>
  );
}

