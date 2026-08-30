# JSON blueprint

JSON blueprint lets a user inspect the current build as JSON, reject invalid text, and apply a valid blueprint so occupancy changes without clicking the canvas.

## Sub-features

- `json-open` opens the JSON editor from Activity.
- `json-invalid` shows an alert and does not apply.
- `json-apply` places a dirt block from a valid document.
- `json-back` returns to the sidebar without applying a discarded edit.

## How to get to it (user POV)

- Choose `Activity`, then `Edit` next to `JSON`.
- Choose `Validate and apply` or `Back`.

## Driving it with cursor-ide-browser

Preconditions:

- Workspace load is complete.
- Fresh arena: Activity JSON preview has `"blocks": []`.
- Manual editing is unlocked (no `Agent editing · Unlock` button).

- **Open editor.** Choose Activity, then Edit. Run `browser_click` on `Activity`, then `browser_click` on `Edit`. Heading `JSON editor` appears with textbox `Blueprint JSON` and buttons `Validate and apply` and `Back`.
- **Reject invalid JSON.** Replace the textbox with `{`. Run `browser_fill` on `Blueprint JSON` with `{`, then `browser_click` on `Validate and apply`. A `role=alert` error stays on the JSON editor. The heading does not return to Layers/Activity.
- **Restore a valid draft.** Choose Back, then Edit again so the textbox shows the current blueprint. Run `browser_click` on `Back`, `browser_click` on `Activity` if needed, then `browser_click` on `Edit`.
- **Apply one dirt.** In `Blueprint JSON`, change `"blocks": []` to `"blocks": [{"position":{"x":0,"y":1,"z":0},"block":"dirt"}]` leaving the rest of the document intact. Run `browser_fill` or type that replacement, then `browser_click` on `Validate and apply`. The JSON editor closes.
- **Confirm occupancy.** Choose Activity. Run `browser_click` on `Activity`. A row `json.apply` is `ok`, and the JSON preview contains `"block": "dirt"` and `"y": 1`.
- **Proof.** Save snapshot and screenshot under `artifacts/json-blueprint/` showing the Activity `json.apply` `ok` row and dirt in the JSON preview.

## Gotchas

- `y` must be `1` or higher. `y: 0` is the protected platform and apply fails.
- `blockSummary` counts do not need to match for apply; `blocks` is what changes occupancy.
- A successful apply leaves JSON mode. You must open Activity again to read the feed and preview.
- Layers can still say `No layers yet` because this dirt has no layer id. Do not use Layers as occupancy proof.
- Invalid JSON never applies. An alert without a later Activity `json.apply` `ok` is only a rejection proof.
- Canvas click-to-place is a different entry point and is out of scope for this feature.
