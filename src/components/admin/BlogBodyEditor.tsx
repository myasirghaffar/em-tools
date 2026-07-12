"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { $getSelection, $isRangeSelection, INDENT_CONTENT_COMMAND, OUTDENT_CONTENT_COMMAND } from "lexical";
import { $getSelectionStyleValueForProperty, $patchStyleText } from "@lexical/selection";
import {
  blockFormatExtension,
  boldExtension,
  codeExtension,
  commandPaletteExtension,
  contextMenuExtension,
  createEditorSystem,
  defaultLexKitTheme,
  draggableBlockExtension,
  historyExtension,
  horizontalRuleExtension,
  htmlEmbedExtension,
  htmlExtension,
  imageExtension,
  italicExtension,
  linkExtension,
  listExtension,
  markdownExtension,
  RichText,
  strikethroughExtension,
  tableExtension,
  underlineExtension,
} from "@lexkit/editor";
import {
  ALargeSmall,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Command,
  FileCode2,
  Image as ImageIcon,
  ImagePlus,
  Indent,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Moon,
  Outdent,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Sun,
  Table2,
  Terminal,
  Underline,
  Undo2,
} from "lucide-react";

const mdExt = markdownExtension;

/** Stable image src for the editor + saved HTML (blob: URLs break across reloads). */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

const configuredImageExtension = imageExtension.configure({
  resizable: true,
  /** Ensures paste / file flows can replace transient blob: URLs with uploaded or data URLs */
  forceUpload: true,
  uploadHandler: readFileAsDataUrl,
});

const configuredTableExtension = tableExtension.configure({
  markdownExtension: mdExt,
  contextMenuExtension,
  rows: 3,
  columns: 3,
  includeHeaders: true,
  enableContextMenu: true,
});

const configuredHtmlEmbedExtension = htmlEmbedExtension.configure({
  markdownExtension: mdExt,
});

const blogBodyExtensions = [
  boldExtension,
  italicExtension,
  underlineExtension,
  strikethroughExtension,
  codeExtension,
  listExtension,
  linkExtension,
  blockFormatExtension,
  historyExtension,
  horizontalRuleExtension,
  htmlExtension,
  mdExt,
  contextMenuExtension,
  configuredTableExtension,
  configuredImageExtension,
  configuredHtmlEmbedExtension,
  commandPaletteExtension,
  draggableBlockExtension.configure({
    showMoveButtons: true,
    buttonStackPosition: "left",
  }),
] as const;

const { Provider: BlogEditorProvider, useEditor: useBlogEditor } =
  createEditorSystem<typeof blogBodyExtensions>();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Legacy posts may be plain text; treat as HTML only when it looks marked up. */
function initialHtmlFromStoredBody(body: string): string {
  const t = body.trim();
  if (!t) return "<p></p>";
  if (/<[a-z][\s\S]*>/i.test(t)) return body;
  return `<p>${escapeHtml(body).split("\n").join("<br />")}</p>`;
}

type BlockSelectValue = "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "quote";

function blockTypeToSelect(v: string): BlockSelectValue {
  if (v === "quote") return "quote";
  if (v === "h1" || v === "h2" || v === "h3" || v === "h4" || v === "h5" || v === "h6") return v;
  return "p";
}

const BLOCK_OPTIONS: { value: BlockSelectValue; label: string }[] = [
  { value: "p", label: "Paragraph" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "h5", label: "Heading 5" },
  { value: "h6", label: "Heading 6" },
  { value: "quote", label: "Quote" },
];

const FONT_SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Default" },
  { value: "12px", label: "12px" },
  { value: "14px", label: "14px" },
  { value: "16px", label: "16px" },
  { value: "18px", label: "18px" },
  { value: "20px", label: "20px" },
  { value: "24px", label: "24px" },
  { value: "32px", label: "32px" },
];

function normalizeFontSizeCss(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  const allowed = FONT_SIZE_OPTIONS.map((o) => o.value).filter(Boolean);
  if (allowed.includes(t)) return t;
  const m = /^(\d+(?:\.\d+)?)px$/.exec(t);
  if (m) {
    const px = `${Math.round(Number.parseFloat(m[1]))}px`;
    return allowed.includes(px) ? px : "";
  }
  return "";
}

type BlogBodyEditorInnerProps = {
  initialHtml: string;
  onHtmlChange: (html: string) => void;
};

function tbBtn(
  active: boolean,
  dark: boolean,
): string {
  const base =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40";
  if (dark) {
    return `${base} ${
      active
        ? "border-orange-400/50 bg-orange-500/20 text-orange-100"
        : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
    }`;
  }
  return `${base} ${
    active
      ? "border-[#FF7A00]/40 bg-[#FF7A00]/12 text-[#0B2A4A]"
      : "border-transparent bg-white text-slate-700 hover:bg-slate-100"
  }`;
}

function ToolbarDivider({ dark }: { dark: boolean }) {
  return <span className={`mx-0.5 h-5 w-px shrink-0 ${dark ? "bg-slate-600" : "bg-gray-300"}`} aria-hidden />;
}

function Toolbar({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  const { commands, activeStates, listeners, editor } = useBlogEditor();
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [blockValue, setBlockValue] = useState<BlockSelectValue>("p");
  const [inCodeBlock, setInCodeBlock] = useState(false);
  const [imageSelected, setImageSelected] = useState(false);
  const [inlineCode, setInlineCode] = useState(false);
  const [fontSizeValue, setFontSizeValue] = useState("");

  function runWithEditorFocus(action: () => void) {
    if (!editor) {
      action();
      return;
    }
    editor.focus(action);
  }

  useEffect(() => {
    return listeners.registerUpdate(() => {
      try {
        setBlockValue(blockTypeToSelect(commands.getCurrentBlockType()));
      } catch {
        /* ignore */
      }
      {
        const icb = activeStates.isInCodeBlock as unknown;
        if (typeof icb === "function") void (icb as () => Promise<boolean>)().then(setInCodeBlock);
        else setInCodeBlock(Boolean(icb));
      }
      {
        const img = activeStates.imageSelected as unknown;
        if (typeof img === "function") void (img as () => Promise<boolean>)().then(setImageSelected);
        else setImageSelected(Boolean(img));
      }
      editor?.getEditorState().read(() => {
        const sel = $getSelection();
        if ($isRangeSelection(sel)) {
          setInlineCode(sel.hasFormat("code"));
          setFontSizeValue(normalizeFontSizeCss($getSelectionStyleValueForProperty(sel, "font-size", "")));
        }
      });
      tick();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- LexKit `activeStates` query fns are stable; avoid re-subscribing every render
  }, [listeners, commands, editor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        commands.showCommandPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commands]);

  function onLink() {
    const url = window.prompt("Link URL", "https://");
    if (url === null) return;
    const trimmed = url.trim();
    runWithEditorFocus(() => {
      if (trimmed) commands.insertLink(trimmed);
      else commands.insertLink();
    });
  }

  function onBlockSelect(next: BlockSelectValue) {
    setBlockValue(next);
    runWithEditorFocus(() => {
      if (next === "p") commands.toggleParagraph();
      else if (next === "quote") commands.toggleQuote();
      else commands.toggleHeading(next);
    });
  }

  function onInsertImageFromUrl() {
    const url = window.prompt("Image URL", "https://");
    if (url == null || !url.trim()) return;
    const alt = window.prompt("Alt text (optional)", "") ?? "";
    commands.insertImage({ src: url.trim(), alt: alt.trim() });
  }

  function onInsertImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    void (async () => {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const alt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim() || "Image";
        /* Pass a real `src` — empty src + `file` only produced a blob: URL that often failed to render in the decorator */
        runWithEditorFocus(() => commands.insertImage({ src: dataUrl, alt }));
      } catch {
        /* ignore */
      }
    })();
  }

  function onInsertTable() {
    const rows = window.prompt("Table rows", "3");
    const cols = window.prompt("Table columns", "3");
    const r = rows != null ? Number.parseInt(rows, 10) : 3;
    const c = cols != null ? Number.parseInt(cols, 10) : 3;
    const rowN = Number.isFinite(r) && r > 0 ? r : 3;
    const colN = Number.isFinite(c) && c > 0 ? c : 3;
    const headers =
      window.confirm("Include header row?") === true;
    runWithEditorFocus(() => commands.insertTable({ rows: rowN, columns: colN, includeHeaders: headers }));
  }

  function onInsertHtmlEmbed() {
    const snippet = window.prompt(
      "HTML embed (you can edit after insert)",
      '<div class="embed">Your HTML</div>',
    );
    if (snippet == null) return;
    runWithEditorFocus(() => commands.insertHTMLEmbed(snippet));
  }

  function applyFontSize(next: string) {
    if (!editor) return;
    editor.focus();
    editor.update(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return;
      if (!next) {
        $patchStyleText(sel, { "font-size": null });
      } else {
        $patchStyleText(sel, { "font-size": next });
      }
    });
  }

  const bar = dark ? "border-slate-600 bg-slate-900" : "border-gray-200 bg-slate-50/90";
  const labelCls = dark ? "text-slate-400" : "text-slate-600";
  const selectCls = dark
    ? "h-8 max-w-[200px] rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-slate-100"
    : "h-8 max-w-[200px] rounded-md border border-gray-200 bg-white px-2 text-xs text-slate-800";
  const fontSelectCls = dark
    ? "h-8 max-w-[120px] rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-slate-100"
    : "h-8 max-w-[120px] rounded-md border border-gray-200 bg-white px-2 text-xs text-slate-800";
  const keepEditorSelection = (e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault();

  return (
    <div className={`flex flex-col gap-1 border-b px-2 py-1.5 ${bar}`}>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          title="Bold"
          onMouseDown={keepEditorSelection}
          onClick={() => commands.toggleBold()}
          className={tbBtn(!!activeStates.bold, dark)}
        >
          <Bold className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          title="Italic"
          onMouseDown={keepEditorSelection}
          onClick={() => commands.toggleItalic()}
          className={tbBtn(!!activeStates.italic, dark)}
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Underline"
          onMouseDown={keepEditorSelection}
          onClick={() => commands.toggleUnderline()}
          className={tbBtn(!!activeStates.underline, dark)}
        >
          <Underline className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Strikethrough"
          onMouseDown={keepEditorSelection}
          onClick={() => commands.toggleStrikethrough()}
          className={tbBtn(!!activeStates.strikethrough, dark)}
        >
          <Strikethrough className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Inline code"
          onMouseDown={keepEditorSelection}
          onClick={() => runWithEditorFocus(() => commands.formatText("code"))}
          className={tbBtn(inlineCode, dark)}
        >
          <Code2 className="h-4 w-4" />
        </button>
        <button type="button" title="Link" onMouseDown={keepEditorSelection} onClick={onLink} className={tbBtn(false, dark)}>
          <Link2 className="h-4 w-4" />
        </button>

        <ToolbarDivider dark={dark} />

        <label className="sr-only" htmlFor="blog-font-size">
          Font size
        </label>
        <span className={`inline-flex items-center gap-0.5 ${labelCls}`} title="Font size">
          <ALargeSmall className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          <select
            id="blog-font-size"
            className={fontSelectCls}
            value={fontSizeValue}
            onChange={(e) => {
              const v = e.target.value;
              setFontSizeValue(v);
              applyFontSize(v);
            }}
          >
            {FONT_SIZE_OPTIONS.map((o) => (
              <option key={o.value || "default"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </span>

        <label className={`sr-only`} htmlFor="blog-block-type">
          Block type
        </label>
        <select
          id="blog-block-type"
          className={selectCls}
          value={blockValue}
          onChange={(e) => onBlockSelect(e.target.value as BlockSelectValue)}
        >
          {BLOCK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          title="Code block"
          onMouseDown={keepEditorSelection}
          onClick={() => runWithEditorFocus(() => commands.toggleCodeBlock())}
          className={tbBtn(inCodeBlock, dark)}
        >
          <Terminal className="h-4 w-4" />
        </button>

        <ToolbarDivider dark={dark} />

        <button
          type="button"
          title="Bullet list"
          onMouseDown={keepEditorSelection}
          onClick={() => runWithEditorFocus(() => commands.toggleUnorderedList())}
          className={tbBtn(!!activeStates.unorderedList, dark)}
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Numbered list"
          onMouseDown={keepEditorSelection}
          onClick={() => runWithEditorFocus(() => commands.toggleOrderedList())}
          className={tbBtn(!!activeStates.orderedList, dark)}
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Indent list"
          onMouseDown={keepEditorSelection}
          onClick={() => runWithEditorFocus(() => {
            if (editor) editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
            else commands.indentList();
          })}
          className={tbBtn(false, dark)}
        >
          <Indent className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Outdent list"
          onMouseDown={keepEditorSelection}
          onClick={() => runWithEditorFocus(() => {
            if (editor) editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
            else commands.outdentList();
          })}
          className={tbBtn(false, dark)}
        >
          <Outdent className="h-4 w-4" />
        </button>

        <ToolbarDivider dark={dark} />

        <button
          type="button"
          title="Horizontal rule"
          onMouseDown={keepEditorSelection}
          onClick={() => runWithEditorFocus(() => commands.insertHorizontalRule())}
          className={tbBtn(false, dark)}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" title="Insert table" onMouseDown={keepEditorSelection} onClick={onInsertTable} className={tbBtn(false, dark)}>
          <Table2 className="h-4 w-4" />
        </button>

        <ToolbarDivider dark={dark} />

        <input
          ref={imageFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onInsertImageFile}
        />
        <button
          type="button"
          title="Insert image from file"
          onMouseDown={keepEditorSelection}
          onClick={() => imageFileRef.current?.click()}
          className={tbBtn(false, dark)}
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        <button type="button" title="Insert image from URL" onMouseDown={keepEditorSelection} onClick={onInsertImageFromUrl} className={tbBtn(false, dark)}>
          <ImagePlus className="h-4 w-4" />
        </button>

        <button type="button" title="HTML embed" onMouseDown={keepEditorSelection} onClick={onInsertHtmlEmbed} className={tbBtn(false, dark)}>
          <FileCode2 className="h-4 w-4" />
        </button>

        <ToolbarDivider dark={dark} />

        <button
          type="button"
          title="Undo"
          disabled={!activeStates.canUndo}
          onMouseDown={keepEditorSelection}
          onClick={() => commands.undo()}
          className={tbBtn(false, dark)}
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Redo"
          disabled={!activeStates.canRedo}
          onMouseDown={keepEditorSelection}
          onClick={() => commands.redo()}
          className={tbBtn(false, dark)}
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <ToolbarDivider dark={dark} />

        <button
          type="button"
          title="Command palette (⌘K)"
          onMouseDown={keepEditorSelection}
          onClick={() => commands.showCommandPalette()}
          className={tbBtn(false, dark)}
        >
          <Command className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={dark ? "Light toolbar" : "Dark toolbar"}
          onMouseDown={keepEditorSelection}
          onClick={onToggleDark}
          className={tbBtn(false, dark)}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {imageSelected ? (
        <div
          className={`flex flex-wrap items-center gap-1 border-t border-dashed pt-1.5 mt-0.5 ${
            dark ? "border-slate-600/50" : "border-gray-300"
          }`}
        >
          <span className={`mr-1 text-[11px] font-medium uppercase tracking-wide ${labelCls}`}>Image</span>
          <button
            type="button"
            title="Align left"
            onMouseDown={keepEditorSelection}
            onClick={() => commands.setImageAlignment("left")}
            className={tbBtn(false, dark)}
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Align center"
            onMouseDown={keepEditorSelection}
            onClick={() => commands.setImageAlignment("center")}
            className={tbBtn(false, dark)}
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Align right"
            onMouseDown={keepEditorSelection}
            onClick={() => commands.setImageAlignment("right")}
            className={tbBtn(false, dark)}
          >
            <AlignRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Default alignment (inline)"
            onMouseDown={keepEditorSelection}
            onClick={() => commands.setImageAlignment("none")}
            className={tbBtn(false, dark)}
          >
            <RemoveFormatting className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className={`flex flex-wrap items-center gap-2 text-[11px] ${labelCls}`}>
        <span>
          Tip: Right-click tables for rows/columns. Drag blocks by the handle. Paste rich content or Markdown.
        </span>
      </div>
    </div>
  );
}

function BlogBodyEditorInner({ initialHtml, onHtmlChange }: BlogBodyEditorInnerProps) {
  const { listeners, export: exportDoc, import: importDoc } = useBlogEditor();
  const onHtmlChangeRef = useRef(onHtmlChange);
  onHtmlChangeRef.current = onHtmlChange;
  const [toolbarDark, setToolbarDark] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await importDoc.fromHTML(initialHtmlFromStoredBody(initialHtml));
      if (cancelled) return;
      const html = await exportDoc.toHTML();
      onHtmlChangeRef.current(html);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; `instanceKey` on the provider remounts when the post changes
  }, []);

  useEffect(() => {
    return listeners.registerUpdate(() => {
      void exportDoc.toHTML().then((html) => onHtmlChangeRef.current(html));
    });
  }, [listeners, exportDoc]);

  const surface = toolbarDark ? "border-slate-600 bg-slate-950" : "border-gray-200 bg-white";
  /* Avoid `prose` on the contenteditable root — Tailwind typography can fight Lexical layout.
     Keep LexKit class names so theme + placeholder positioning stay correct. */
  const editableBase =
    "min-h-[280px] px-3 py-2.5 text-sm leading-relaxed outline-none max-w-none focus:outline-none relative z-[1]";
  const editable = toolbarDark
    ? `lexkit-content-editable ${editableBase} text-slate-100`
    : `lexkit-content-editable ${editableBase} text-slate-900`;
  const placeholder = toolbarDark
    ? "lexkit-placeholder pointer-events-none select-none text-sm text-slate-500"
    : "lexkit-placeholder pointer-events-none select-none text-sm text-slate-400";

  return (
    <div className={`rounded-lg border overflow-hidden ${surface}`}>
      <Toolbar dark={toolbarDark} onToggleDark={() => setToolbarDark((d) => !d)} />
      <RichText
        placeholder="Write the full article…"
        classNames={{
          container: "lexkit-editor-container lexkit-editor-shell relative min-h-[280px]",
          contentEditable: editable,
          placeholder,
        }}
      />
    </div>
  );
}

export type BlogBodyEditorProps = {
  /** Stored article HTML (or legacy plain text). */
  value: string;
  onChange: (html: string) => void;
  /** Change when switching posts so the editor reloads content. */
  instanceKey: string;
};

export function BlogBodyEditor({ value, onChange, instanceKey }: BlogBodyEditorProps) {
  return (
    <BlogEditorProvider
      key={instanceKey}
      extensions={blogBodyExtensions}
      config={{
        theme: defaultLexKitTheme,
      }}
    >
      <BlogBodyEditorInner initialHtml={value} onHtmlChange={onChange} />
    </BlogEditorProvider>
  );
}
