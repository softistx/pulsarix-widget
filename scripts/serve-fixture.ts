/**
 * Serves the host-page fixture and the built bundles on a local port:
 *   /          the host page with the loader script tag
 *   /baseline  the same page without the widget (the reference for the leak test)
 *   /dist/*    the build output
 */
import { join } from "node:path";

const root = join(import.meta.dir, "..");

export function serveFixture(port = 0) {
  return Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/" || url.pathname === "/baseline") {
        const html = await Bun.file(join(root, "fixtures/host.html")).text();
        const loader =
          url.pathname === "/"
            ? '<script src="/dist/loader.js" async data-project-key="pk_test_fixture" data-launcher="true"></script>'
            : "";
        return new Response(html.replace("<!--LOADER-->", loader), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (url.pathname.startsWith("/dist/")) {
        const file = Bun.file(join(root, url.pathname));
        if (await file.exists()) return new Response(file);
      }
      return new Response("not found", { status: 404 });
    },
  });
}

if (import.meta.main) {
  const server = serveFixture(Number(process.env.PORT ?? 4177));
  console.log(`fixture on http://localhost:${server.port}`);
}
