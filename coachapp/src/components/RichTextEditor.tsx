"use client";

import { useEffect, useRef } from "react";

// Editor di testo semplice (grassetto, corsivo, sottolineato, titoli, liste, link)
// pensato per descrivere gli esercizi e poter incollare link a video, come in Word.
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && ref.current) {
      ref.current.innerHTML = value || "";
      initialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    handleInput();
  }

  function handleInput() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function handleLink() {
    const url = window.prompt("Incolla il link (es. video YouTube):");
    if (url) exec("createLink", url);
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex flex-wrap gap-1 bg-gray-50 border-b border-gray-200 p-1.5">
        <ToolbarButton label="H1" onClick={() => exec("formatBlock", "H1")} />
        <ToolbarButton label="H2" onClick={() => exec("formatBlock", "H2")} />
        <ToolbarButton label="B" strong onClick={() => exec("bold")} />
        <ToolbarButton label="I" em onClick={() => exec("italic")} />
        <ToolbarButton label="U" underline onClick={() => exec("underline")} />
        <ToolbarButton label="• Lista" onClick={() => exec("insertUnorderedList")} />
        <ToolbarButton label="1. Lista" onClick={() => exec("insertOrderedList")} />
        <ToolbarButton label="🔗 Link" onClick={handleLink} />
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        className="min-h-[110px] p-3 text-sm focus:outline-none [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300"
      />
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  strong,
  em,
  underline,
}: {
  label: string;
  onClick: () => void;
  strong?: boolean;
  em?: boolean;
  underline?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded hover:bg-gray-200 ${strong ? "font-bold" : ""} ${
        em ? "italic" : ""
      } ${underline ? "underline" : ""}`}
    >
      {label}
    </button>
  );
}
