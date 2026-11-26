import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Trash2, X } from 'lucide-react';
import type { GeneratedFile } from '../types/idea';
import { normalizeExtension } from '../lib/aiProtocol';

interface FilePreviewModalProps {
  file: GeneratedFile | null;
  onClose: () => void;
  onUpdateFile: (updated: GeneratedFile) => void;
  onDeleteFile: (fileId: string) => void;
}

export function triggerFileDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  onUpdateFile,
  onDeleteFile,
}) => {
  const [filename, setFilename] = useState('');
  const [content, setContent] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (file) {
      setFilename(file.filename);
      setContent(file.content);
      setCopied(false);
    }
  }, [file]);

  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, onClose]);

  if (!file) return null;

  const currentExt = normalizeExtension(filename || file.filename, file.extension);
  const lineCount = content ? content.split(/\r?\n/).length : 0;

  const commitChanges = (nextName: string, nextContent: string) => {
    const cleanName = nextName.trim() || file.filename;
    const nextExt = normalizeExtension(cleanName, file.extension);
    onUpdateFile({
      ...file,
      filename: cleanName,
      extension: nextExt,
      content: nextContent,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <dialog
        open
        aria-label={`View and edit ${filename}`}
        data-testid="file-preview-modal"
        className="relative mx-auto flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#2B3344] bg-[#10141C] text-[#E6E9EF] shadow-2xl"
      >
        {/* Header with editable filename & extension badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#212734] bg-[#141923] px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="rounded-md border border-[#E5A93C]/40 bg-[#E5A93C]/12 px-2 py-0.5 font-mono text-xs font-semibold text-[#F5C66D]">
              {currentExt}
            </span>
            <label htmlFor="preview-filename-input" className="sr-only">
              File name
            </label>
            <input
              id="preview-filename-input"
              type="text"
              value={filename}
              onChange={(e) => {
                setFilename(e.target.value);
                commitChanges(e.target.value, content);
              }}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-mono text-sm font-medium text-[#F3F5F8] hover:border-[#2A3140] focus:border-[#E5A93C] focus:bg-[#0B0D10] focus:outline-none"
            />
            <span className="hidden font-mono text-[11px] text-[#788296] tabular-nums sm:inline">
              {lineCount} lines
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-lg border border-[#262D3B] bg-[#12161E] px-2.5 py-1.5 text-xs text-[#C5CDDA] hover:text-[#F3F5F8]"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={() => triggerFileDownload(filename || file.filename, content)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E5A93C] px-3 py-1.5 text-xs font-semibold text-[#0B0D10] hover:bg-[#EEB955]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onDeleteFile(file.id);
                onClose();
              }}
              aria-label={`Delete ${filename}`}
              title="Remove file"
              className="rounded-lg border border-[#262D3B] p-1.5 text-[#8E98AB] hover:border-rose-500/40 hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close file viewer"
              className="rounded-lg p-1.5 text-[#8E98AB] hover:bg-[#1E2432] hover:text-[#F3F5F8]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Editable Code/Document Content Area */}
        <div className="flex-1 overflow-hidden bg-[#0B0D10] p-4">
          <label htmlFor="preview-file-content" className="sr-only">
            Edit file contents before downloading
          </label>
          <textarea
            id="preview-file-content"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              commitChanges(filename, e.target.value);
            }}
            spellCheck={false}
            className="h-[58vh] w-full resize-none rounded-xl border border-[#1E2430] bg-[#0B0D10] p-4 font-mono text-xs leading-relaxed text-[#DCE2EE] focus:border-[#E5A93C] focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between border-t border-[#212734] bg-[#11151D] px-4 py-2 text-[11px] text-[#788296]">
          <span>Edits save automatically in-app before you download.</span>
          <span className="font-mono tabular-nums">{content.length} chars</span>
        </div>
      </dialog>
    </div>
  );
};
