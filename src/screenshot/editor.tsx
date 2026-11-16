import {
  adoptStyles,
  ImageMarkupEditor,
} from "@softistx/material/image-editor";
import { useLayoutEffect, useRef, useState } from "react";
import editorCss from "../generated/editor-css";
import { MAX_EXPORT_SIDE } from "./capture";

/**
 * The annotation editor, the one lazy chunk of the widget: pen, highlighter, arrow, box,
 * text and "Hide" (a solid, opaque redaction). It carries its own stylesheet, adopted into
 * the shadow root the first time it mounts, so the form pays for none of it. The image is
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
    <div
      ref={mark}
      className="h-full min-h-0 w-full max-md:-mx-8 max-md:w-[calc(100%+64px)]"
    >
      {styled ? (
        <ImageMarkupEditor
          src={source}
          fileName="screenshot"
          maxExportSize={MAX_EXPORT_SIDE}
          defaultExportOptions={{ format: "image/png", scale: 1 }}
          saveLabel={saveLabel}
          onSave={({ file }) => onSave(file)}
          onCancel={onCancel}
          className="h-[520px] max-h-full w-full"
        />
      ) : null}
    </div>
  );
}
