import ReactMarkdown from "react-markdown";

export function NoteMarkdown({ body }: { body: string }) {
  return <ReactMarkdown skipHtml components={{
    img: ({ src, alt }) => {
      const label = alt || "Image";
      if (typeof src === "string" && /^https?:\/\//i.test(src)) {
        return <a href={src} target="_blank" rel="noreferrer">Open image: {label}</a>;
      }
      return <span>{label} (image unavailable)</span>;
    },
  }}>{body}</ReactMarkdown>;
}
