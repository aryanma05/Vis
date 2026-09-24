// Små ikoner som brukes flere steder. Streker arver tekstfargen.
type Props = { className?: string };

export const CommentIcon = ({ className = "h-4 w-4" }: Props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
    <path d="M3.5 5.5A2 2 0 0 1 5.5 3.5h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-3.5 3v-3h0a2 2 0 0 1-2-2v-6Z" strokeLinejoin="round" />
  </svg>
);

export const SearchIcon = ({ className = "h-4 w-4" }: Props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
    <circle cx="9" cy="9" r="5.5" />
    <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
  </svg>
);

export const BellIcon = ({ className = "h-5 w-5" }: Props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
    <path d="M5 8a5 5 0 0 1 10 0c0 4 1.5 5.5 1.5 5.5h-13S5 12 5 8Z" strokeLinejoin="round" />
    <path d="M8.5 16.5a1.6 1.6 0 0 0 3 0" strokeLinecap="round" />
  </svg>
);

export const ArrowIcon = ({ className = "h-4 w-4" }: Props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
    <path d="M4 10h12m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const DownloadIcon = ({ className = "h-4 w-4" }: Props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
    <path d="M10 3.5v9m-4-4 4 4 4-4M4 16.5h12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ExternalIcon = ({ className = "h-4 w-4" }: Props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
    <path d="M8 4.5H5.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V12M11 4h5v5M16 4l-7 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const GithubIcon = ({ className = "h-4 w-4" }: Props) => (
  <svg viewBox="0 0 16 16" className={`fill-current ${className}`} aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export const FolderIcon = ({ className = "h-5 w-5" }: Props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
    <path d="M2.5 6a1.5 1.5 0 0 1 1.5-1.5h3.6l1.6 1.8H16A1.5 1.5 0 0 1 17.5 7.8v6.7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5V6Z" strokeLinejoin="round" />
  </svg>
);

export const PencilIcon = ({ className = "h-5 w-5" }: Props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
    <path d="m12.5 4.5 3 3L7 16H4v-3l8.5-8.5Z" strokeLinejoin="round" />
  </svg>
);

export const ImageIcon = ({ className = "h-5 w-5" }: Props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
    <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
    <circle cx="7.5" cy="8" r="1.4" />
    <path d="m17.5 13-3.8-3.8L6.5 16.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
