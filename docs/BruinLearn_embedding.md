# Hosting and embedding the simulators in BruinLearn (Canvas)

*For the Digital Curriculum Program Coordinator.*

## What these are

Two self-contained HTML files, about 270 kB each. Everything — the physics model, the charts, the drawing — is inside the file. There are no external scripts, fonts, images or network calls, no cookies, no analytics, and nothing is sent anywhere: the simulation runs in the student's browser. They work on laptops and tablets; the layout is two-column and is best at 1024 px or wider.

## Why they cannot simply be pasted into a Canvas page

Canvas strips `<script>` tags from page content, so the apps cannot be pasted into a Page as HTML. They have to be **hosted somewhere that serves HTML as a web page**, and then shown in Canvas through an **iframe** (which Canvas allows). Uploading the `.html` files to Canvas *Files* does not work well either: Canvas serves uploaded HTML as a download or a sanitised preview rather than a running page.

## Option A — GitHub Pages (simplest; already set up by the author)

The repository (https://github.com/salmaancraig-star/building-climates-simulators) is published with GitHub Pages, so each app has a stable public URL:

```
https://salmaancraig-star.github.io/building-climates-simulators/
https://salmaancraig-star.github.io/building-climates-simulators/StreetCanyonSimulator.html
https://salmaancraig-star.github.io/building-climates-simulators/PassiveBuildingSimulator.html
```

To embed in a Canvas page: edit the page → switch the Rich Content Editor to the **HTML editor** (the `</>` icon) → paste:

```html
<iframe src="https://salmaancraig-star.github.io/building-climates-simulators/PassiveBuildingSimulator.html"
        width="100%" height="1400" style="border:0" title="Passive Building Simulator"
        allowfullscreen></iframe>
```

A height of 1400–1600 px shows the whole app without an inner scrollbar on most screens; a smaller height gives a scrollable frame. Alternatively add the URL as an **External URL** module item (opens full-page, in or out of a new tab), which avoids iframe sizing altogether and is the most robust choice on small screens.

GitHub Pages is public (anyone with the link can open the app). The apps contain no student data and no course content beyond the exercise itself, so this is usually acceptable; if the course requires UCLA-only access, use Option B.

## Option B — UCLA hosting

Any UCLA web space that serves static files over HTTPS (a departmental web server, UCLA Box with direct-link hosting, or the Canvas-adjacent static hosting the Digital Curriculum team uses) will work identically: upload the two `.html` files unchanged and embed or link as above. Requirements are only (1) HTTPS — Canvas blocks http iframes — and (2) that the host does not set `X-Frame-Options: DENY` or a `frame-ancestors` policy that excludes `bruinlearn.ucla.edu`.

## Option C — LTI / Canvas Studio

Not needed. The apps have no grades to pass back and no login; a plain iframe or external link is sufficient.

## Checking an embed

1. Open the Canvas page as a student (Student View).
2. Drag a slider or change a dropdown — the charts and numbers should update immediately.
3. On the building simulator, drag a divider on the glazing bar; on the canyon simulator, switch the Metric/Imperial toggle.
4. If the frame shows blank: check the URL opens on its own in a new tab (if it does, the host is refusing to be framed — see the `frame-ancestors` note above).

## Updating

The author may update the files during the term. With GitHub Pages the URL stays the same and the new version appears within a minute or two of the file being replaced in the repository; students may need to reload the page. The version is shown in the file's `<title>` and in the repository's commit history.

## Accessibility notes

Text and controls are native HTML (selects, range sliders, buttons) and work with keyboard and screen readers. The 3D view and the charts are visual; the headline numbers above them carry the same information as text. Colour is not the only carrier of meaning on the charts (lines are also distinguished by weight and dash).
