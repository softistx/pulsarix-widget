/**
 * Serves the host-page fixture and the built bundles on a local port:
 *   /          the host page with the loader script tag
 *   /baseline  the same page without the widget (the reference for the leak test)
 *   /dist/*    the build output
 *   /dark, /dark-identified  the host page on a dark background (anonymous, identified)
 *   /strict    the same page under a strict CSP (no inline script, no `blob:` image source)
 *   /strict-identified  the strict page with an identity token
 *   /strict-limited  the same, its token gets a 429 on the e-mail choice and "Delete my data"
 *   /identified, /identified-empty, /identified-expired  the page with an identity token (six
 *              requests, none, a refused token); `myRequests` is stubbed beside the intake
 *   GET /public/live/requests  the live stream stub; GET /__live (open, opened, closed streams)
 *              and POST /__team-reply {id, body} (a team reply reaches the open streams)
 *   POST /public/graphql  a stub of the API's intake (tickets for declared files included)
 *   PUT /public/media/report-files/:slot  a stub of the upload by ticket (a file named
 *              "fail…" gets a 500, so that the retry and the partial failure can be seen, one
 *              named "slow…" is answered after 6 s, to see the progress)
 *   GET /__puts  what the stub received: [{ slot, name, bytes, type }]
 */
import { join } from "node:path";
import { apiMessage } from "./fixture-messages";
import { createRequestsStub } from "./fixture-requests";

const root = join(import.meta.dir, "..");

/** Every connection the page may make is to its own origin: that is the whole policy a host needs. */
const STRICT_CSP =
  "default-src 'none'; script-src 'self'; style-src 'nonce-host'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'";

/** The pages that hand the loader an identity token. */
const IDENTITIES: Record<string, string> = {
  "/identified": "fixture.token",
  "/identified-empty": "empty.token",
  "/identified-expired": "expired.token",
  "/strict-identified": "fixture.token",
  "/dark-identified": "fixture.token",
  "/strict-limited": "limited.token",
};

export function serveFixture(port = 0) {
  /** slot -> the declared name, to answer the PUT with what the stub knows of it. */
  const slots = new Map<string, string>();
  const requests = createRequestsStub();
  const puts: { slot: string; name: string; bytes: number; type: string }[] =
    [];
  return Bun.serve({
    port,
    // The live stream stays open between its pings.
    idleTimeout: 60,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/__puts") return Response.json(puts);
      // What the live stream did, and a way for a spec to make the team answer.
      if (url.pathname === "/__live")
        return Response.json({
          open: requests.streamCount(),
          ...requests.stats,
        });
      // What the privacy writes (the e-mail choice, erase) did, for the specs.
      if (url.pathname === "/__privacy") return Response.json(requests.calls);
      if (url.pathname === "/__team-reply" && request.method === "POST") {
        const { id, body } = (await request.json()) as {
          id: string;
          body: string;
        };
        return Response.json({ ok: requests.teamReplies(id, body) });
      }
      if (url.pathname === "/public/live/requests")
        return requests.live(
          request.headers.get("x-pulsarix-identity"),
          request.signal,
        );
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
                {
                  message: apiMessage(
                    "ticket-invalid",
                    request.headers.get("accept-language"),
                  ),
                  extensions: { code: "intake.errors.ticket-invalid" },
                },
              ],
            },
            { status: 403 },
          );
        const bytes = (await request.arrayBuffer()).byteLength;
        // A file named "slow…" is answered after a pause: the progress state, to look at.
        if (name.startsWith("slow")) await Bun.sleep(6_000);
        if (name.startsWith("fail"))
          return Response.json(
            {
              errors: [
                {
                  message: apiMessage(
                    "unavailable",
                    request.headers.get("accept-language"),
                  ),
                  extensions: { code: "intake.errors.unavailable" },
                },
              ],
            },
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
        const answered = requests.answer(
          body.id ?? "",
          request.headers.get("x-pulsarix-identity"),
          body.variables ?? {},
          (name) => {
            const slot = `slot-${slots.size + 1}`;
            slots.set(slot, name);
            return { slot, role: "file", ticket: `ticket-${slot}` };
          },
          request.headers.get("accept-language"),
        );
        if (answered) return answered;
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
        // A title that says "limited" gets the API's 429 with its wait in minutes.
        if (body.variables?.input?.title?.includes("limited"))
          return Response.json(
            {
              errors: [
                {
                  message: apiMessage(
                    "too-many-requests",
                    request.headers.get("accept-language"),
                    10,
                  ),
                  extensions: {
                    code: "intake.errors.too-many-requests",
                    minutes: 10,
                  },
                },
              ],
            },
            { status: 429 },
          );
        // A title that says "busy" gets the API's 503, to see the error state.
        if (body.variables?.input?.title?.includes("busy"))
          return Response.json(
            {
              errors: [
                {
                  message: apiMessage(
                    "unavailable",
                    request.headers.get("accept-language"),
                  ),
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
      if (
        ["/", "/baseline", "/strict", "/dark"].includes(url.pathname) ||
        identity
      ) {
        const html = await Bun.file(join(root, "fixtures/host.html")).text();
        const loader =
          url.pathname !== "/baseline"
            ? `<script src="/dist/loader.js" async data-project-key="pk_test_fixture" data-launcher="true"${identity ? ` data-identity="${identity}"` : ""}></script>`
            : "";
        // The host's own `<style>` carries the nonce; any style the widget injected would not.
        let page = url.pathname.startsWith("/strict")
          ? html.replace("<style>", '<style nonce="host">')
          : html;
        // A host page with a dark background, to see the tab on it (light and dark widget).
        if (url.pathname.startsWith("/dark"))
          page = page.replace(
            "</head>",
            "<style>html,body{background:#14161c !important;color:#e8eaf0 !important}</style></head>",
          );
        return new Response(page.replace("<!--LOADER-->", loader), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            ...(url.pathname.startsWith("/strict")
              ? { "content-security-policy": STRICT_CSP }
              : {}),
          },
        });
      }
      // The duotone icon sheet the host serves (pulsarix-ui's public/assets/icons/sprites). It is a
      // licensed file, so it is read from the sibling checkout (ICON_SPRITES_DIR) and never committed.
      if (url.pathname.startsWith("/assets/icons/sprites/")) {
        const file = Bun.file(
          join(
            process.env.ICON_SPRITES_DIR ??
              join(
                process.env.HOME ?? "",
                "workspace/dev/pulsarix/pulsarix-ui/public/assets/icons/sprites",
              ),
            url.pathname.split("/").pop() ?? "",
          ),
        );
        return (await file.exists())
          ? new Response(file, {
              headers: { "content-type": "image/svg+xml" },
            })
          : new Response("not found", { status: 404 });
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
