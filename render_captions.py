import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont


FONT_PATHS = [
    os.environ.get("SUBTITLE_FONT"),
    "/Users/joun/Library/Fonts/Pretendard-Bold.ttf",
    "/Library/Fonts/Pretendard-Bold.otf",
    "/Library/Fonts/Pretendard-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Pretendard.ttc",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def load_font(size):
    for font_path in FONT_PATHS:
        if not font_path or not os.path.exists(font_path):
            continue
        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def wrap_text(draw, text, font, max_width):
    lines = []
    for raw_line in text.splitlines() or [""]:
        current = ""
        for char in raw_line:
            candidate = current + char
            if draw.textbbox((0, 0), candidate, font=font, stroke_width=2)[2] <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = char
        if current:
            lines.append(current)
    return lines or [text]


def normalize_caption_style(style):
    style = style or {}
    return ("white", "black") if style.get("fill") == "white" else ("black", "white")


def render_caption(text, width, output_path, caption_style):
    font_size = max(26, round(width * 0.034))
    font = load_font(font_size)
    fill, stroke = normalize_caption_style(caption_style)
    pad_x = round(width * 0.04)
    max_text_width = width - pad_x * 2
    probe = Image.new("RGBA", (width, 10), (0, 0, 0, 0))
    draw = ImageDraw.Draw(probe)
    lines = wrap_text(draw, text, font, max_text_width)
    line_height = round(font_size * 1.35)
    height = max(round(width * 0.11), line_height * len(lines) + 24)

    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    y = (height - line_height * len(lines)) // 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font, stroke_width=3)
        x = (width - (bbox[2] - bbox[0])) // 2
        draw.text((x, y), line, font=font, fill=fill, stroke_width=4, stroke_fill=stroke)
        y += line_height
    image.save(output_path)


def main():
    payload_path, output_dir = sys.argv[1], sys.argv[2]
    with open(payload_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    width = int(payload["width"])
    caption_style = payload.get("captionStyle")
    results = []
    for index, entry in enumerate(payload["entries"]):
        output_path = os.path.join(output_dir, f"caption-{index + 1:03d}.png")
        render_caption(entry["text"], width, output_path, caption_style)
        results.append({
            "path": output_path,
            "start": entry["start"],
            "end": entry["end"]
        })
    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
