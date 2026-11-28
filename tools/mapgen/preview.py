#!/usr/bin/env python3
"""Draws a map file (content/maps/*.json) as a PNG, so maps can be checked without Unity.

Usage: python3 tools/mapgen/preview.py out.png   (see docs/araclar/harita-editoru.md)

Water, blocked tiles, spawn, points and seats come from the map file. Roads, the
plaza, the pier and the placed art are not in that file yet: they are read from
the client's C# sources with regexes.
"""
import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
MAP_FILE = ROOT / "content/maps/lake.json"
MAP_VIEW = ROOT / "client/Assets/Scripts/World/MapView.cs"
LAKE_MAP = ROOT / "client/Assets/Scripts/World/LakeMap.cs"
ART_DIR = ROOT / "client/Assets/Art/Custom"
REGIONS_FILE = Path(__file__).resolve().parent / "regions.json"

TILE_PX = 32  # art pixels per tile

GROUND = (150, 190, 105)
WATER = (62, 124, 196)
BLOCKED = (92, 70, 60)
ROAD = (214, 188, 138)
PIER = (170, 122, 70)
WATER_EDGE = (200, 230, 255)
SPAWN = (255, 222, 0)
POINT = (220, 30, 40)
SEAT = (255, 130, 0)
# Placed art, coloured by its folder under client/Assets/Art/Custom.
PIECE_COLORS = {
    "Buildings": (170, 40, 150),
    "Cafe": (170, 40, 150),
    "Plaza": (110, 60, 200),
    "Props": (60, 60, 60),
    "Nature": (20, 100, 40),
    "Water": (0, 90, 140),
}
LEGEND = [
    ("Yürünür", GROUND), ("Su", WATER), ("Engel", BLOCKED), ("Yol / meydan", ROAD), ("İskele", PIER),
    ("Spawn", SPAWN), ("Nokta", POINT), ("Oturma", SEAT),
    ("Bina", PIECE_COLORS["Buildings"]), ("Meydan parçası", PIECE_COLORS["Plaza"]),
    ("Süs", PIECE_COLORS["Props"]), ("Doğa", PIECE_COLORS["Nature"]), ("Su süsü", PIECE_COLORS["Water"]),
]

NUM = r"\s*(-?\d+(?:\.\d+)?)f?\s*"


def load_map(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    width, height, rows = data["width"], data["height"], data["rows"]
    if len(rows) != height or any(len(r) != width for r in rows):
        raise ValueError(f"{path}: rows do not match {width} x {height}")
    unknown = set("".join(rows)) - set(".#~")
    if unknown:
        raise ValueError(f"{path}: unknown tile characters {sorted(unknown)}")
    return data


def strip_comments(source):
    return re.sub(r"//[^\n]*", "", source)


def block(source, name):
    """The { ... }; initialiser of the array called `name`, or None."""
    m = re.search(rf"\b{name}\s*=\s*\{{(.*?)\}};", source, re.S)
    return m.group(1) if m else None


def parse_rects(text):
    return [tuple(int(v) for v in m) for m in
            re.findall(r"new(?:\s+RectInt)?\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)", text)]


def parse_rect_field(source, name):
    """`name = new RectInt(x, y, w, h);` as a tuple, or None."""
    m = re.search(rf"\b{name}\s*=\s*(new\s+RectInt\s*\([^)]*\))", source)
    rects = parse_rects(m.group(1)) if m else []
    return rects[0] if rects else None


def parse_map_art(source):
    """MapView.MapArt as [(path, x, y)]. Raises if an entry cannot be read, so none goes missing."""
    body = block(strip_comments(source), "MapArt")
    if body is None:
        raise ValueError("MapArt not found in MapView.cs (use --no-code to draw the map file only)")
    found = re.findall(rf'\(\s*"([^"]+)"\s*,{NUM},{NUM}\)', body)
    if len(found) != len(re.findall(r'\(\s*"', body)):
        raise ValueError("MapArt has an entry this script cannot read (expected (\"path\", 1.5f, 2f))")
    return [(path, float(x), float(y)) for path, x, y in found]


def parse_vector(source, name):
    m = re.search(rf"\b{name}\s*=\s*new\s+Vector2\s*\({NUM},{NUM}\)", source)
    return (float(m.group(1)), float(m.group(2))) if m else None


def load_code_layers(map_view=MAP_VIEW, lake_map=LAKE_MAP):
    view = strip_comments(Path(map_view).read_text(encoding="utf-8"))
    lake = strip_comments(Path(lake_map).read_text(encoding="utf-8"))
    roads = []
    plaza = parse_rect_field(view, "Plaza")
    if plaza:
        roads.append(plaza)
    roads += parse_rects(block(view, "Roads") or "")
    if not roads:
        print("warning: no Plaza / Roads found in MapView.cs", file=sys.stderr)
    pieces = parse_map_art(view)
    # The two buildings MapView places outside the MapArt list.
    for name, path in (("CafeBase", "Cafe/kafe_gemini"), ("FishShopBase", "Buildings/balikci_gemini")):
        feet = parse_vector(view, name)
        if feet:
            pieces.append((path, feet[0], feet[1]))
        else:
            print(f"warning: {name} not found in MapView.cs", file=sys.stderr)
    return {"roads": roads, "pier": parse_rect_field(lake, "Pier"), "pieces": pieces}


def load_regions(path, data):
    """Region labels, only if they were made for a map of this id and size."""
    if not Path(path).exists():
        print(f"warning: no region file {path}", file=sys.stderr)
        return []
    regions = json.loads(Path(path).read_text(encoding="utf-8"))
    if any(regions.get(k) != data.get(k) for k in ("id", "width", "height")):
        print(f"warning: {path} is for another map id or size, region labels skipped", file=sys.stderr)
        return []
    return regions["regions"]


def font(size):
    # The labels are Turkish; Pillow's built-in font may lack some of the letters.
    for name in ("/System/Library/Fonts/Supplemental/Arial.ttf", "DejaVuSans.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size)


def piece_size(path, art_dir=ART_DIR):
    """Size of the piece's picture in tiles; 1 x 1 if the file is not there."""
    file = Path(art_dir) / (path + ".png")
    if not file.exists():
        print(f"warning: missing art {file}", file=sys.stderr)
        return 1.0, 1.0
    with Image.open(file) as im:
        return im.width / TILE_PX, im.height / TILE_PX


def render(data, code=None, regions=(), scale=12, art_dir=ART_DIR):
    """The map as an image, `scale` pixels per tile, with the legend below it."""
    width, height = data["width"], data["height"]
    map_w, map_h = width * scale, height * scale
    img = Image.new("RGB", (map_w, map_h), GROUND)
    d = ImageDraw.Draw(img)

    def tiles(x, y, w, h):
        return [round(x * scale), round(y * scale), round((x + w) * scale) - 1, round((y + h) * scale) - 1]

    def dot(x, y, r, fill):
        cx, cy = x * scale, y * scale
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill, outline=(0, 0, 0))

    def text(x, y, value, size, anchor="mm", fill=(255, 255, 255)):
        d.text((x, y), value, font=font(size), anchor=anchor, fill=fill, stroke_width=2, stroke_fill=(0, 0, 0))

    # Roads go under the collision tiles: whatever blocks a road must stay visible.
    if code:
        for rect in code["roads"]:
            d.rectangle(tiles(*rect), fill=ROAD)
    for y, row in enumerate(data["rows"]):
        for x, ch in enumerate(row):
            if ch != ".":
                d.rectangle(tiles(x, y, 1, 1), fill=WATER if ch == "~" else BLOCKED)
    if code and code["pier"]:
        px, py, pw, ph = code["pier"]
        for y in range(max(py, 0), min(py + ph, height)):
            for x in range(max(px, 0), min(px + pw, width)):
                if data["rows"][y][x] == ".":
                    d.rectangle(tiles(x, y, 1, 1), fill=PIER)

    # Coordinate grid every 16 tiles.
    for x in range(16, width, 16):
        d.line([x * scale, 0, x * scale, map_h], fill=(120, 150, 90))
        text(x * scale + 2, 2, str(x), 11, "la")
    for y in range(16, height, 16):
        d.line([0, y * scale, map_w, y * scale], fill=(120, 150, 90))
        text(2, y * scale + 2, str(y), 11, "la")

    for water in data.get("waters", []):
        box = tiles(water["x"], water["y"], water["w"], water["h"])
        d.rectangle(box, outline=WATER_EDGE)
        text(box[0] + 4, box[3] - 4, water["id"], 12, "ld", WATER_EDGE)

    # Placed art: the picture's outline (bottom-centre = feet), a dot at the feet and the file name.
    for path, x, y in code["pieces"] if code else []:
        color = PIECE_COLORS.get(path.split("/")[0], (0, 0, 0))
        w, h = piece_size(path, art_dir)
        d.rectangle(tiles(x - w / 2, y - h, w, h), outline=color, width=2)
        dot(x, y, max(2, scale // 4), color)
        d.text((x * scale, y * scale + 2), path.split("/")[-1], font=font(max(8, scale * 3 // 4)),
               anchor="ma", fill=color)

    for seat in data.get("seats", []):
        dot(seat["x"], seat["y"], max(2, scale // 3), SEAT)
    for point in data.get("points", []):
        dot(point["x"], point["y"], scale * 0.6, POINT)
        text(point["x"] * scale, point["y"] * scale - scale, point["id"], 13, "md", (255, 200, 200))
    spawn = data["spawn"]
    dot(spawn["x"], spawn["y"], scale * 0.6, SPAWN)
    text(spawn["x"] * scale, spawn["y"] * scale - scale, "spawn", 13, "md", SPAWN)

    for region in regions:
        text(region["x"] * scale, region["y"] * scale, region["name"], max(12, scale * 3 // 2))

    # Legend, wrapped to the image width, below the map so it covers nothing.
    entry_font = font(13)
    x, y, placed = 8, 8, []
    for label, color in LEGEND:
        entry_w = 20 + entry_font.getlength(label) + 18
        if x + entry_w > map_w and x > 8:
            x, y = 8, y + 24
        placed.append((x, y, label, color))
        x += entry_w
    out = Image.new("RGB", (map_w, map_h + y + 24), (30, 30, 34))
    out.paste(img, (0, 0))
    d = ImageDraw.Draw(out)
    for x, y, label, color in placed:
        d.rectangle([x, map_h + y, x + 14, map_h + y + 14], fill=color, outline=(255, 255, 255))
        d.text((x + 20, map_h + y + 7), label, font=entry_font, anchor="lm", fill=(255, 255, 255))
    return out


def main(argv=None):
    parser = argparse.ArgumentParser(description="Draw a map file as a PNG.")
    parser.add_argument("out", help="PNG to write")
    parser.add_argument("--map", default=MAP_FILE, help="map file (default: content/maps/lake.json)")
    parser.add_argument("--regions", default=REGIONS_FILE, help="region labels (default: tools/mapgen/regions.json)")
    parser.add_argument("--scale", type=int, default=12, help="pixels per tile (default: 12)")
    parser.add_argument("--no-code", action="store_true",
                        help="draw the map file only, without the roads, pier and art read from the C# sources")
    args = parser.parse_args(argv)
    if args.scale < 2:
        parser.error("--scale must be at least 2")
    try:
        data = load_map(args.map)
        code = None if args.no_code else load_code_layers()
    except (OSError, ValueError, KeyError) as error:
        sys.exit(f"error: {error}")
    image = render(data, code, load_regions(args.regions, data), args.scale)
    image.save(args.out, "PNG")
    pieces = len(code["pieces"]) if code else 0
    print(f"{args.out} {image.width}x{image.height} ({data['id']} {data['width']}x{data['height']}, {pieces} pieces)")


if __name__ == "__main__":
    main()
