"use client";

// Vises bare hvis selve rotlayouten feiler. Må ha sin egen <html> og enkel stil.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="nb">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#071a52", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 440, padding: 24, textAlign: "center" }}>
          <p style={{ letterSpacing: "0.2em", fontSize: 12, textTransform: "uppercase", color: "#b8d8e3" }}>Vis</p>
          <h1 style={{ fontSize: 32, margin: "16px 0 8px" }}>Noe gikk galt</h1>
          <p style={{ color: "#b8d8e3", lineHeight: 1.6 }}>Prøv å laste siden på nytt.</p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#b8d8e3" }}>Feilkode: {error.digest}</p>}
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: 20, background: "#c7f9ff", color: "#071a52", border: 0, borderRadius: 12, padding: "12px 20px", fontWeight: 600, cursor: "pointer" }}
          >
            Prøv igjen
          </button>
        </div>
      </body>
    </html>
  );
}
