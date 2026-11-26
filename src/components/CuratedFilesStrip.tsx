import React from 'react';
import { Download, FileCode2 } from 'lucide-react';
import type { GeneratedFile } from '../types/idea';
import { triggerFileDownload } from './FilePreviewModal';

interface CuratedFilesStripProps {
  files: GeneratedFile[];
  onSelectFile: (file: GeneratedFile) => void;
}

const EXT_COLOR: Record<string, string> = {
  '.rs': 'text-orange-300 border-orange-400/35 bg-orange-500/10',
  '.py': 'text-sky-300 border-sky-400/35 bg-sky-500/10',
  '.md': 'text-emerald-300 border-emerald-400/35 bg-emerald-500/10',
  '.ts': 'text-blue-300 border-blue-400/35 bg-blue-500/10',
  '.tsx': 'text-blue-300 border-blue-400/35 bg-blue-500/10',
  '.json': 'text-[#E5A93C] border-[#E5A93C]/35 bg-[#E5A93C]/10',
};

export function splitFileBaseAndExt(file: GeneratedFile): {
  base: string;
  ext: string;
} {
  const idx = file.filename.lastIndexOf('.');
  if (idx > 0) {
    return {
      base: file.filename.slice(0, idx),
      ext: file.filename.slice(idx).toLowerCase(),
    };
  }
  return { base: file.filename, ext: file.extension || '.txt' };
}

export const CuratedFilesStrip: React.FC<CuratedFilesStripProps> = ({
  files,
  onSelectFile,
}) => {
  if (files.length === 0) return null;

  return (
    <section
      aria-label="Generated idea files"
      className="border-b border-[#1D222D] bg-[#0C0F14] px-4 py-2 sm:px-8"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#7D879B] shrink-0">
          <FileCode2 className="h-3.5 w-3.5 text-[#8E98AB]" aria-hidden="true" />
          <span>Files</span>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2">
          {files.map((file) => {
            const { base, ext } = splitFileBaseAndExt(file);
            const extStyle =
              EXT_COLOR[ext] ||
              'text-[#C5CDDA] border-[#2E3647] bg-[#181D27]';

            return (
              <div
                key={file.id}
                className="inline-flex items-center overflow-hidden rounded-lg border border-[#242B38] bg-[#12161F] transition-colors hover:border-[#E5A93C]/50"
              >
                <button
                  type="button"
                  onClick={() => onSelectFile(file)}
                  title={`View & edit ${file.filename}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#E6E9EF] hover:text-[#F5C66D]"
                >
                  <span className="max-w-[120px] truncate font-mono text-[11px]">
                    {base}
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.2 font-mono text-[10px] font-semibold ${extStyle}`}
                  >
                    {ext}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerFileDownload(file.filename, file.content)}
                  aria-label={`Download ${file.filename}`}
                  title={`Download ${file.filename}`}
                  className="border-l border-[#212734] px-2 py-1 text-[#7D879B] hover:bg-[#191E29] hover:text-[#E5A93C]"
                >
                  <Download className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
