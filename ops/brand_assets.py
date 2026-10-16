"""
Brand files for one client, written to sites/<site>/public/files/brand/ (nginx
serves them at /files/brand/ on the client's host):

  logo-white.png   sidebar / sign-in / mobile header (drawn on dark teal)
  favicon.png, apple-touch-icon.png, icon-192/512.png, maskable-192/512.png

With --logo the client's own logo is used; without it a wordmark of the brand
name is drawn (white on transparent) and the icons carry its first letter.
Prints the `tenant_brand` JSON for site_config.

  python brand_assets.py <site> <brand name> <theme #hex> [logo.png]
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SITES = "/home/frappeuser/frappe-dev/sites"
AR_FONT = "/usr/share/fonts/truetype/noto/NotoKufiArabic-Bold.ttf"  # the UI's own Arabic face
LATIN_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"  # Kufi has no Latin glyphs


def _is_ar(text):
	return any("\u0600" <= ch <= "\u06ff" for ch in text)


def _word(word, size=96):
	"""One word, shaped in the font that has its script."""
	ar = _is_ar(word)
	f = ImageFont.truetype(AR_FONT if ar else LATIN_FONT, size, layout_engine=ImageFont.Layout.RAQM)
	d = "rtl" if ar else "ltr"
	box = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox((0, 0), word, font=f, direction=d, anchor="ls")
	img = Image.new("RGBA", (box[2] - box[0], 220), (0, 0, 0, 0))
	ImageDraw.Draw(img).text((-box[0], 160), word, font=f, fill="white", direction=d, anchor="ls")
	return img


def wordmark(text):
	"""White name on transparent. Words are set one by one (Arabic in Kufi, Latin
	in DejaVu) on a shared baseline, right-to-left when the name starts Arabic."""
	words = [_word(w) for w in text.split()]
	first_strong = next((ch for ch in text if ch.isalpha()), "a")
	if _is_ar(first_strong):
		words.reverse()
	gap = 34
	img = Image.new("RGBA", (sum(w.width for w in words) + gap * (len(words) - 1), 220), (0, 0, 0, 0))
	x = 0
	for w in words:
		img.alpha_composite(w, (x, 0))
		x += w.width + gap
	return img.crop(img.getbbox())


def _fit(mark, box):
	"""Scale up or down to fit inside a box x box square."""
	r = min(box / mark.width, box / mark.height)
	return mark.resize((max(1, round(mark.width * r)), max(1, round(mark.height * r))), Image.LANCZOS)


def icon(size, theme, mark, pad):
	"""Square icon: theme colour field with the mark centred inside `pad` margin."""
	img = Image.new("RGBA", (size, size), theme)
	inner = int(size * (1 - 2 * pad))
	m = _fit(mark, inner)
	img.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
	return img.convert("RGB")


def main():
	site, name, theme = sys.argv[1], sys.argv[2], sys.argv[3]
	logo = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else ""
	out = os.path.join(SITES, site, "public", "files", "brand")
	os.makedirs(out, exist_ok=True)

	if logo:
		mark = Image.open(logo).convert("RGBA")
		mark = mark.crop(mark.getbbox() or (0, 0, mark.width, mark.height))
	else:
		mark = wordmark(name)
	lw = mark.copy()
	lw.thumbnail((900, 240), Image.LANCZOS)  # never upscaled: a small logo stays crisp
	lw.save(os.path.join(out, "logo-white.png"))

	# icons: the client logo as-is; without one, the brand's first letter
	glyph = mark if logo else wordmark(name.strip()[0])
	for fname, size, pad in [
		("icon-192.png", 192, 0.14), ("icon-512.png", 512, 0.14),
		("maskable-192.png", 192, 0.24), ("maskable-512.png", 512, 0.24),
		("apple-touch-icon.png", 180, 0.16), ("favicon.png", 64, 0.1),
	]:
		icon(size, theme, glyph, pad).save(os.path.join(out, fname))

	print(json.dumps({
		"name": name,
		"logoWhite": "/files/brand/logo-white.png",
		"favicon": "/files/brand/favicon.png",
		"appleIcon": "/files/brand/apple-touch-icon.png",
		"pwaIconBase": "/files/brand",
		"themeColor": theme,
	}, ensure_ascii=False))


if __name__ == "__main__":
	main()
