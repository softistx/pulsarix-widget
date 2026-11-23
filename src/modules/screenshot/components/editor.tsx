import {
  adoptStyles,
  ImageMarkupEditor,
} from "@softistx/material/image-editor";
import { useLayoutEffect, useRef, useState } from "react";
import editorCss from "../../../generated/editor-css";
import { MAX_EXPORT_SIDE } from "../model/capture";

/**
 * The annotation editor, the one lazy chunk of the widget: pen, highlighter, arrow, box, ellipse, line,
 * text, "Redact" and Crop (a solid, opaque redaction only: pixelating a screenshot can be reversed).
 * It carries its own stylesheet, adopted into the shadow root the first time it mounts, so the form pays for none of it. The image is
 * decoded with `createImageBitmap` (the preset's default): no `blob:` image, no CSP change.
 */
export default function Editor({
  source,
  saveLabel,
  onSave,
  onCancel,
}: {
  source: Blob;
  saveLabel: string;
  onSave: (file: File) => void;
  onCancel: () => void;
}) {
  const mark = useRef<HTMLDivElement>(null);
  const [styled, setStyled] = useState(false);
  useLayoutEffect(() => {
    const root = mark.current?.getRootNode();
    const release =
      root instanceof ShadowRoot ? adoptStyles(root, editorCss) : undefined;
    setStyled(true);
    return release;
  }, []);
  return (
    // Temporary, until material#5620 (a scroll cue on the editor tool row at 360 px).
    <div ref={mark} className="min-h-0 w-full">
      {styled ? (
        <ImageMarkupEditor
          src={source}
          fileName="screenshot"
          maxExportSize={MAX_EXPORT_SIDE}
          defaultExportOptions={{ format: "image/png", scale: 1 }}
          crop
          toolbar="floating"
          redactModes={["solid"]}
          saveLabel={saveLabel}
          onSave={({ file }) => onSave(file)}
          onCancel={onCancel}
          className="h-[min(720px,calc(100dvh-170px))] w-full max-sm:h-[calc(100dvh-140px)]"
        />
      ) : null}
    </div>
  );
}
