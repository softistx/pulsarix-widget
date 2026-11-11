# @softistx/pulsarix-widget

An intake widget that lets your users report a problem to your pulsarix project:
a title, a description and an optional e-mail, with no account. It renders inside a
Shadow DOM, so your page's styles and the widget's never touch.

Planned usage (not available yet):

```html
<script src="https://<pulsarix-host>/widget/v1/loader.js" async
        data-project-key="pk_live_xxx"></script>
```

```ts
import { mount } from "@softistx/pulsarix-widget";

const widget = mount({ projectKey: "pk_live_xxx" });
widget.on("pulsarix:submit", ({ reportId }) => console.log(reportId));
```

Skeleton only: nothing is built or published yet. The contract (config, events,
Shadow DOM, CSP) is in [../docs/plan.md](../docs/plan.md) §10, and the slices are W0 and W1.
