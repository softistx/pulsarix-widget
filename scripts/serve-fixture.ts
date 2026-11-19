/**
 * Serves the host-page fixture and the built bundles on a local port:
 *   /          the host page with the loader script tag
 *   /baseline  the same page without the widget (the reference for the leak test)
 *   /dist/*    the build output
 *   /strict    the same page under a strict CSP (no inline script, no `blob:` image source)
 *   /identified, /identified-empty, /identified-expired  the page with an identity token (six
 *              requests, none, a refused token); `myRequests` is stubbed beside the intake
 *   POST /public/graphql  a stub of the API's intake (tickets for declared files included)
 *   PUT /public/media/report-files/:slot  a stub of the upload by ticket (a file named
 *              "fail…" gets a 500, so that the retry and the partial failure can be seen, one
 *              named "slow…" is answered after 6 s, to see the progress)
 *   GET /__puts  what the stub received: [{ slot, name, bytes, type }]
 */
import { join } from "node:path";
import { answerMyRequests } from "./fixture-requests";

const root = join(import.meta.dir, "..");

/** Every connection the page may make is to its own origin: that is the whole policy a host needs. */
const STRICT_CSP =
  "default-src 'none'; script-src 'self'; style-src 'nonce-host'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'";

/** The pages that hand the loader an identity token. */
const IDENTITIES: Record<string, string> = {
  "/identified": "fixture.token",
  "/identified-empty": "empty.token",
  "/identified-expired": "expired.token",
};

export function serveFixture(port = 0) {
  /** slot -> the declared name, to answer the PUT with what the stub knows of it. */
  const slots = new Map<string, string>();
  const puts: { slot: string; name: string; bytes: number; type: string }[] =
    [];
  return Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/__puts") return Response.json(puts);
      if (
        url.pathname.startsWith("/public/media/report-files/") &&
        request.method === "PUT"
      ) {
        const slot = decodeURIComponent(url.pathname.split("/").pop() ?? "");
        const name = slots.get(slot);
        if (!name || !request.headers.get("x-pulsarix-ticket"))
          return Response.json(
            {
              errors: [
                { extensions: { code: "intake.errors.ticket-invalid" } },
              ],
            },
            { status: 403 },
          );
        const bytes = (await request.arrayBuffer()).byteLength;
        // A file named "slow…" is answered after a pause: the progress state, to look at.
        if (name.startsWith("slow")) await Bun.sleep(6_000);
        if (name.startsWith("fail"))
          return Response.json(
            { errors: [{ extensions: { code: "intake.errors.unavailable" } }] },
            { status: 500 },
          );
        puts.push({
          slot,
          name,
          bytes,
          type: request.headers.get("content-type") ?? "",
        });
        return Response.json({ ok: true });
      }
      // A stand-in for the pulsarix API's public intake (same origin as the loader, as in
      // production): it answers `submitClientReport` and records nothing.
      if (url.pathname === "/public/graphql" && request.method === "POST") {
        const body = (await request.json()) as {
          id?: string;
          variables?: {
            filter?: string;
            first?: number;
            after?: string;
            input?: {
              email?: string;
              title?: string;
              files?: { role: string; name: string }[];
            };
          };
        };
        if (body.id === "myRequests")
          return answerMyRequests(
            request.headers.get("x-pulsarix-identity"),
            body.variables ?? {},
          );
        if (body.id === "widgetConfig")
          return Response.json({
            data: {
              widgetConfig: {
                projectName: "Acme Store",
                locale: "en",
                enabled: true,
                attachments: true,
              },
            },
          });
        // A title that says "busy" gets the API's 503, to see the error state.
        if (body.variables?.input?.title?.includes("busy"))
          return Response.json(
            {
              errors: [
                {
                  message: "busy",
                  extensions: { code: "intake.errors.unavailable" },
                },
              ],
            },
            { status: 503 },
          );
        const files = (body.variables?.input?.files ?? []).map((file, i) => {
          const slot = `slot-${slots.size + 1}-${i}`;
          slots.set(slot, file.name);
          return { slot, role: file.role, ticket: `ticket-${slot}` };
        });
        return Response.json({
          data: {
            submitClientReport: {
              reportId: "fixture-report",
              tracking: !!body.variables?.input?.email,
              files,
            },
          },
        });
      }
      const identity = IDENTITIES[url.pathname];
      if (["/", "/baseline", "/strict"].includes(url.pathname) || identity) {
        const html = await Bun.file(join(root, "fixtures/host.html")).text();
        const loader =
          url.pathname !== "/baseline"
            ? `<script src="/dist/loader.js" async data-project-key="pk_test_fixture" data-launcher="true"${identity ? ` data-identity="${identity}"` : ""}></script>`
            : "";
        // The host's own `<style>` carries the nonce; any style the widget injected would not.
        const page =
          url.pathname === "/strict"
            ? html.replace("<style>", '<style nonce="host">')
            : html;
        return new Response(page.replace("<!--LOADER-->", loader), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            ...(url.pathname === "/strict"
              ? { "content-security-policy": STRICT_CSP }
              : {}),
          },
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
