# Build Arena

A voxel building desk in the browser. A person places blocks by hand. An AI agent can use the **same live world** through [WebMCP](https://github.com/webmachinelearning/webmcp) tools (look, lock, then build).
**Live demo:** TODO (paste your Vercel URL)  
**Demo video:** TODO (paste your YouTube link)

## Why WebMCP

Block coordinates and circuit layout are exact. Clicking around is slow and easy to mess up. Tools let an agent read slices, place shapes, and undo, while you watch and take over.

Typical loop: lock → context → summary → query/slice → one write → re-read → unlock.

## Run locally

Needs Node.js 22+ (or 20+).

```bash
cd MINECRAFT_BUILD_ARENA
npm install
npm run dev
```

Open the URL Vite prints (usually [http://localhost:5173](http://localhost:5173)). Title in the tab is Build Arena.

```bash
npm run build    # output is dist/
npm test
```



## Try the agent tools

1. Open the live site (not only localhost) in ChatGPT's in-app browser, or Google Chrome 149+ with `chrome://flags/#enable-webmcp-testing` turned on, then restart Chrome.
2. Load Build Arena.
3. The agent should see tools such as `list_tools`, `get_arena_context`, and `set_blocks`.

The agent cannot if WebMCP is off .

## Tools


| Name                   | What it does                         |
| ---------------------- | ------------------------------------ |
| `list_tools`           | Start here. Short list.              |
| `describe_tools`       | Full args for 1–10 tools.            |
| `get_arena_context`    | Size, revision, block ids, lock.     |
| `get_build_summary`    | Totals, no coordinates.              |
| `query_blocks`         | Exact cells.                         |
| `get_build_slices`     | One 2D slice.                        |
| `set_manual_edit_lock` | Agent lock on/off.                   |
| `generate_shape`       | Floors, walls, boxes.                |
| `transform_region`     | Copy, move, rotate, mirror, replace. |
| `set_blocks`           | Up to 256 precise edits.             |
| `undo_build_change`    | Undo last agent/human write.         |
| `render_build_views`   | Moves the camera view.    |


Platform size and blueprint save stay human-only.

#### Warning: The docs and some md in this repo are old and were made during a premature state of the project.



## Credits

- First-person play space starts from [maoxin1234/redstone-world](https://github.com/maoxin1234/redstone-world) (MIT). Wiki/Mojang art is not included.
- UI font: Press Start 2P (SIL OFL 1.1), self-hosted.
- Music: ansimuz, "Going Up" (see `public/public-license.txt`).



## License

MIT. See `LICENSE.md` at the repo root.