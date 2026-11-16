import { useEffect, useRef } from "react";

/**
 * The kept screenshot, drawn on a canvas from a decoded bitmap: no `blob:` URL and no
 * `<img>`, so a host page whose CSP is `img-src 'self'` shows it all the same.
 */
export function Preview({ image, alt }: { image: Blob; alt: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (typeof createImageBitmap !== "function") return;
    let current = true;
    void createImageBitmap(image)
      .then((bitmap) => {
        const target = canvas.current;
        const context = target?.getContext("2d");
        if (current && target && context) {
          target.width = bitmap.width;
          target.height = bitmap.height;
          context.drawImage(bitmap, 0, 0);
        }
        bitmap.close();
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [image]);
  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={alt}
      data-testid="screenshot-preview"
      className="block h-auto w-full rounded-lg border border-border bg-muted"
    />
  );
}
