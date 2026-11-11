import type { AttachedFile } from "../data/types";
import { PaperclipIcon } from "./icons";

/** An assignment's files as a row of links. Renders nothing when there are none. */
export function AttachmentLinks({ files }: { files: AttachedFile[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="attachments" aria-label={files.length === 1 ? "Attached file" : `${files.length} attached files`}>
      {files.map((file) => (
        <li key={file.path}>
          {file.url ? (
            <a className="row__attachment" href={file.url} target="_blank" rel="noreferrer">
              <PaperclipIcon size={13} />
              {file.name}
            </a>
          ) : (
            <span className="row__attachment row__attachment--unavailable" title="This file couldn't be opened right now">
              <PaperclipIcon size={13} />
              {file.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
