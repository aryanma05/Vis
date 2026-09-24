import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// README-er fra GitHub inneholder ofte litt HTML (<img>, <p align="center">).
// rehype-raw tolker den, og rehype-sanitize fjerner alt som kan kjøre kode.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: [...(defaultSchema.attributes?.img ?? []), "width", "height", "align"],
    p: [...(defaultSchema.attributes?.p ?? []), "align"],
    div: [...(defaultSchema.attributes?.div ?? []), "align"],
  },
};

export default function Markdown({ children, size = "md" }: { children: string; size?: "sm" | "md" }) {
  return (
    <div className={`markdown ${size === "sm" ? "markdown-sm" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={{
          a: ({ href, children }) => {
            const internal = href?.startsWith("/") && !href.startsWith("//");
            return internal ? (
              <a href={href}>{children}</a>
            ) : (
              <a href={href} target="_blank" rel="noreferrer nofollow ugc">
                {children}
              </a>
            );
          },
          img: ({ src, alt, width, height }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} width={width} height={height} loading="lazy" decoding="async" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
