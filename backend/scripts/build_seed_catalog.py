"""Build backend/seed_catalog.py from fetched Shopify products.json files.

Demo-only catalog: women's wear from PK brand stores, images hotlinked from
their Shopify CDNs (same approach as the original seed).

Usage (from a scratch dir; OUT path is relative to that dir):
  curl -s "https://www.alkaramstudio.com/collections/ready-to-wear-eastern/products.json?limit=15" -o alk_rtw.json
  curl -s "https://www.alkaramstudio.com/collections/unstitched-summer-lawn/products.json?limit=15" -o alk_uns.json
  curl -s "https://www.gulahmedshop.com/collections/lawn-2026/products.json?limit=15" -o ga_lawn.json
  curl -s "https://www.gulahmedshop.com/collections/women-ideas-pret-everyday-edit-3-piece/products.json?limit=15" -o ga_pret.json
  curl -s "https://www.sanasafinaz.com/collections/ready-to-wear/products.json?limit=15" -o ss_rtw.json
  curl -s "https://www.sanasafinaz.com/collections/unstitched-summer-26/products.json?limit=15" -o ss_uns.json
  python ../backend/scripts/build_seed_catalog.py
"""

import json
import re

OUT = "../backend/seed_catalog.py"

COLOR_HEX = {
    "white": "#F2EDE2", "off white": "#F2EDE2", "ivory": "#EDE6D6",
    "black": "#23211E", "blue": "#5B7FA6", "sky blue": "#8FB3CF",
    "navy": "#2C3A5A", "green": "#1F6B53", "emerald": "#1F6B53",
    "olive": "#6B6B3A", "teal": "#2E6E6A", "pink": "#E8A0BF",
    "blush": "#E8A0BF", "peach": "#E8B7A0", "red": "#A93226",
    "maroon": "#7B2D3A", "rust": "#A4502F", "orange": "#D97B29",
    "yellow": "#D9B23C", "mustard": "#C9972B", "beige": "#C9BCA4",
    "brown": "#7A5230", "purple": "#6B4E71", "lilac": "#B7A4C9",
    "grey": "#8C8C88", "gray": "#8C8C88", "multi": "#B08968",
    "gold": "#C18F3C", "silver": "#B8B8B8", "aqua": "#7FB8B0",
    "coral": "#E2725B", "magenta": "#A23B72", "turquoise": "#46B1A1",
}
FABRICS = ["Lawn", "Cambric", "Khaddar", "Crepe", "Muzlin", "Viscose",
           "Raw Silk", "Silk", "Jacquard", "Khaddi Net", "Yarn Dyed", "Cotton", "Dobby"]


def detect_fabric(text: str) -> str:
    for f in FABRICS:
        if f.lower() in text.lower():
            return f
    return "Lawn"


def detect_color(p: dict) -> str:
    # 1) variant option named colour
    for opt in p.get("options", []):
        if opt.get("name", "").lower() in ("color", "colour") and opt.get("values"):
            return opt["values"][0].title()
    # 2) a tag that is a known colour word
    for tag in p.get("tags", []):
        if tag.lower() in COLOR_HEX:
            return tag.title()
    # 3) colour word inside title/handle
    blob = (p["title"] + " " + p["handle"]).lower()
    for word in COLOR_HEX:
        if word in blob:
            return word.title()
    return "Multi"


def hexfor(color: str) -> str:
    return COLOR_HEX.get(color.lower(), "#B08968")


def pieces_label(text: str, unstitched: bool) -> str:
    m = re.search(r"(\d)\s*[- ]?\s*(?:pc|piece)", text, re.I)
    n = m.group(1) if m else None
    if unstitched:
        return f"{n}-Piece (Unstitched)" if n else "Unstitched"
    return f"{n}-Piece (Stitched)" if n else "Ready to Wear"


def short_code(handle: str) -> str:
    """Last alphanumeric design code chunk of a handle, e.g. cl-1234a → CL-1234A."""
    parts = [s for s in handle.split("-") if re.fullmatch(r"[a-z]*\d+[a-z]*", s)]
    return "-".join(parts[-2:]).upper() if parts else ""


def main() -> None:
    sources = [
        ("alk_rtw.json", "Alkaram Studio", "ALK", False, 5),
        ("alk_uns.json", "Alkaram Studio", "ALKU", True, 4),
        ("ga_lawn.json", "Gul Ahmed", "GA", True, 5),
        ("ga_pret.json", "Gul Ahmed", "GAP", False, 4),
        ("ss_rtw.json", "Sana Safinaz", "SS", False, 6),
        ("ss_uns.json", "Sana Safinaz", "SSU", True, 5),
    ]

    catalog = []
    seen_names: set[str] = set()
    seen_slugs: set[str] = set()
    seen_images: set[str] = set()

    for path, brand, prefix, unstitched, want in sources:
        products = json.load(open(path, encoding="utf-8"))["products"]
        taken = 0
        for p in products:
            if taken >= want:
                break
            if not p.get("images") or not p.get("variants"):
                continue
            img = p["images"][0]["src"]
            if img in seen_images:  # GA repeats the same shot across colourways
                continue

            title, handle = p["title"].strip(), p["handle"]
            ptype = (p.get("product_type") or "").strip()
            color = detect_color(p)
            blob = f"{title} {ptype} {handle}"
            fabric = detect_fabric(blob)

            # Display name per brand (Alkaram/GA raw titles are generic).
            if brand == "Alkaram Studio":
                base = ptype.title().replace("&", "&") or "Shalwar Kameez"
                name = f"Alkaram {'Unstitched ' if unstitched else ''}{base} — {color}"
            elif brand == "Gul Ahmed":
                code = short_code(handle)
                suffix = f" — {code}" if code else f" — {color}"
                name = f"Gul Ahmed {title.title()}{suffix}"
            else:
                name = f"Sana Safinaz {title}"
            if name in seen_names:
                continue

            slug = re.sub(r"[^a-z0-9]+", "-", f"{prefix}-{handle}".lower()).strip("-")[:120]
            if slug in seen_slugs:
                continue

            v = p["variants"][0]
            price = float(v["price"])
            cmp_at = float(v["compare_at_price"]) if v.get("compare_at_price") else None
            # Shopify lists the discounted figure as price; our model wants
            # base_price (original) + optional sale_price.
            base_price = cmp_at if cmp_at and cmp_at > price else price
            sale_price = price if cmp_at and cmp_at > price else None

            catalog.append({
                "name": name,
                "slug": slug,
                "category": "unstitched" if unstitched else ("lawn" if "lawn" in blob.lower() else "stitched"),
                "brand": brand,
                "fabric": fabric,
                "pieces": pieces_label(blob, unstitched),
                "base_price": f"{base_price:.2f}",
                "sale_price": f"{sale_price:.2f}" if sale_price else None,
                "image": img,
                "color": color,
                "color_hex": hexfor(color),
                "sku": f"{prefix}-{taken + 1:02d}",
                "kind": "unstitched" if unstitched else "stitched",
            })
            seen_names.add(name)
            seen_slugs.add(slug)
            seen_images.add(img)
            taken += 1

    counts: dict[str, int] = {}
    for c in catalog:
        counts[c["category"]] = counts.get(c["category"], 0) + 1
    header = (
        '"""Demo catalog data — generated from PK brand Shopify stores.\n\n'
        "Women's wear only; images hotlinked from brand CDNs for demo/portfolio\n"
        'use. Regenerate with .seed-tmp/build_catalog.py. Consumed by seed.py.\n"""\n\n'
    )
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(header)
        f.write("CATALOG = ")
        f.write(json.dumps(catalog, indent=2, ensure_ascii=False)
                .replace(": null", ": None"))
        f.write("\n")
    print(f"Wrote {len(catalog)} products -> {OUT}  {counts}")


if __name__ == "__main__":
    main()
