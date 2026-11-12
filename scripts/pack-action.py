"""Package verified articulated RGBA renders without inventing missing frames.

Requires Pillow only for offline media preparation, never at runtime/build time.
No appearance retouching: fixed bounds, responsive resizing, atlas packing.
"""
from pathlib import Path
from PIL import Image
import argparse
import json
import math

MAX_PAGE_BYTES = 24 * 1024 * 1024


def validate_frames(paths):
    size = None
    for path in paths:
        if not path.is_file():
            raise ValueError(f"Missing real animation frame: {path.name}")
        with Image.open(path) as im:
            if im.mode != "RGBA":
                raise ValueError(f"RGBA source required: {path.name}")
            if size is None:
                size = im.size
            if im.size != size:
                raise ValueError(f"Changing frame dimensions: {path.name}")
            alpha = im.getchannel("A")
            if alpha.getextrema()[0] == 255:
                raise ValueError(f"Opaque source cannot be composited: {path.name}")
            box = alpha.point(lambda value: 255 if value > 2 else 0).getbbox()
            if not box:
                raise ValueError(f"Empty animation frame: {path.name}")
            if box[0] < 1 or box[1] < 1 or box[2] >= size[0] or box[3] >= size[1]:
                raise ValueError(f"Character touches frame edge: {path.name}")
    return size


def pack(source, output, frames=96, fps=24, first=1,
         pattern="frame-{frame:04d}.png", mobile_height=512, desktop_height=768):
    if not 2 <= frames <= 360 or not 12 <= fps <= 60:
        raise ValueError("Invalid action timing")
    paths = [Path(source) / pattern.format(frame=i) for i in range(first, first + frames)]
    size = validate_frames(paths)
    output = Path(output)
    if output.exists() and any(output.iterdir()):
        raise ValueError("Use a new versioned output directory; existing media is preserved")
    plans = []
    for name, target_height in [("mobile", mobile_height), ("desktop", desktop_height)]:
        height = min(target_height, size[1])
        width = max(1, round(size[0] * height / size[1]))
        if min(width, height) < 1 or width > 2048 or height > 2048:
            raise ValueError("Invalid responsive dimensions")
        if width * 3 > 4096 or height * 2 > 4096 or width * height * 6 * 4 > MAX_PAGE_BYTES:
            raise ValueError("Atlas exceeds decoded memory budget")
        plans.append((name, width, height))
    output.mkdir(parents=True, exist_ok=True)
    manifest = {"type": "rendered-action", "frames": frames, "fps": fps,
                "framesPerPage": 6, "sourceFrameSize": list(size), "tiers": {}}
    report = {"frames": frames, "durationSeconds": frames / fps, "tiers": {}}
    for name, width, height in plans:
        folder = output / name
        folder.mkdir()
        pages = []
        for start in range(0, frames, 6):
            sheet = Image.new("RGBA", (width * 3, height * 2))
            for local, path in enumerate(paths[start:start + 6]):
                with Image.open(path) as im:
                    tile = im.resize((width, height), Image.Resampling.LANCZOS)
                    sheet.paste(tile, ((local % 3) * width, (local // 3) * height))
            path = folder / f"page-{start // 6:02d}.webp"
            sheet.save(path, format="WEBP", quality=92, method=6, exact=True)
            pages.append({"url": f"{name}/{path.name}", "columns": 3, "rows": 2,
                          "bytes": path.stat().st_size})
        with Image.open(paths[0]) as im:
            im.resize((width, height), Image.Resampling.LANCZOS).save(
                folder / "poster.webp", format="WEBP", quality=94, method=6, exact=True)
        manifest["tiers"][name] = {"width": width, "height": height,
                                    "poster": f"{name}/poster.webp", "pages": pages}
        report["tiers"][name] = {"frameSize": [width, height],
                                  "pageCount": len(pages),
                                  "bytes": sum(p.stat().st_size for p in folder.iterdir()),
                                  "twoPageDecodedBytes": width * height * 6 * 4 * min(2, len(pages))}
    # The manifest is written last. Interrupted partial output is not publishable.
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--frames", type=int, default=96)
    parser.add_argument("--fps", type=float, default=24)
    parser.add_argument("--first", type=int, default=1)
    parser.add_argument("--pattern", default="frame-{frame:04d}.png")
    parser.add_argument("--mobile-height", type=int, default=512)
    parser.add_argument("--desktop-height", type=int, default=768)
    args = parser.parse_args()
    print(json.dumps(pack(**vars(args)), indent=2))
