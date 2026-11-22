# Integrating the widget

## The launcher: look, position and visibility

The floating button that opens the dialog. Three options shape it; each has a script-tag
attribute and a `mount()` option.

### Look: `launcher`

| Value              | Result                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `"auto"` (default) | The icon below 640 px of viewport width, the text pill from 640 px up. Live: it follows a resize or a rotation. |
| `"pill"`           | Always the text pill (the 0.3 look).                                                                            |
| `"icon"`           | Always a 48 px round button with a speech-bubble icon.                                                          |
| `false`            | No launcher; open the dialog with `open()`.                                                                     |

The icon button keeps the localized label as its accessible name (and as its `title`, so a
pointer hover shows it), carries the unread count in that name, and shows a visible focus ring.

```html
<script src="https://<pulsarix-host>/widget/v1/loader.js" async
        data-project-key="pk_live_xxx" data-launcher="icon"></script>
```

```ts
mount({ projectKey: "pk_live_xxx", launcher: "auto" });
```

### Offset: `offset` and the CSS custom properties

The launcher sits 16 px from the bottom and from its side, plus the device's safe area
(`env(safe-area-inset-bottom)`) at the bottom. Move it to clear a sticky action bar:

```ts
mount({ projectKey: "pk_live_xxx", offset: { bottom: 88, side: "1.5rem" } });
```

```html
<script ... data-offset-bottom="88" data-offset-side="1.5rem"></script>
```

A number is pixels; a string is any CSS length (`"2rem"`, `"calc(var(--bar-height) + 8px)"`,
`"env(...)"`). Anything that is not a length is ignored. The option sets two custom properties on the
`<pulsarix-widget>` element, which a host can also set in its own CSS (for example from a media query,
or following the height of its bar):

```css
pulsarix-widget {
  --pulsarix-launcher-bottom: 88px;
  --pulsarix-launcher-side: 24px;
}
```

`side` is the distance from the edge named by `position` (`bottom-right` by default).

### Visibility: `setLauncherVisible(visible)`

Hides or shows the launcher only, for a screen where the button is in the way:

```ts
const widget = mount({ projectKey: "pk_live_xxx" });
widget.setLauncherVisible(false); // on the checkout step
widget.setLauncherVisible(true);
```

An open dialog is never hidden or closed by it, and `open()` still works while the launcher is hidden.
With the script tag: `window.PulsarixWidget.setLauncherVisible(false)`. `launcher: false` still
removes the launcher for good.
