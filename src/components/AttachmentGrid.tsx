import { FileText } from 'lucide-react'
import type { Attachment } from '../../shared/orders.ts'

/** Uploaded job files as a 3-column grid of thumbnails / file icons. Links are short-lived signed URLs. */
export function AttachmentGrid({ files }: { files: Attachment[] }) {
  if (files.length === 0) return null
  return (
    <ul className="grid grid-cols-3 gap-2" aria-label="Uploaded files">
      {files.map((f) => (
        <li key={f.id}>
          <a
            href={f.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-input border border-line bg-page text-ink hover:text-ink"
          >
            <div className="flex aspect-square items-center justify-center">
              {f.url && f.type.startsWith('image/') && f.type !== 'image/heic' ? (
                <img src={f.url} alt={f.name} className="size-full object-cover" loading="lazy" />
              ) : (
                <FileText className="size-8 text-ink-muted" strokeWidth={1.8} aria-hidden="true" />
              )}
            </div>
            <p className="truncate px-2 py-1 text-caption">{f.name}</p>
          </a>
        </li>
      ))}
    </ul>
  )
}
