// pdf.js har ikke typer for worker-filen. Vi trenger bare å kunne laste den inn.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
