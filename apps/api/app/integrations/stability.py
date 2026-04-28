"""Stability AI image generation + sophisticated PIL compositor.

For Together Photos:
  1. Generate a scene background via SD3.5 (text → image).
  2. Composite both background-removed subjects on the scene with:
     - alpha-edge feathering (gaussian on the alpha channel)
     - color-tone matching to the scene's palette (subtle LUT-style shift)
     - light shadow under each subject (soft drop shadow)
     - placement that respects subject size

This is the v1 "good enough" approach; a future v2 can swap in Stability's
ControlNet/img2img pipeline for end-to-end consistency.
"""

from __future__ import annotations

import io
from typing import Literal

import httpx
from PIL import Image, ImageEnhance, ImageFilter

from app.core.config import settings

STABILITY_ENDPOINT = "https://api.stability.ai/v2beta/stable-image/generate/sd3"


# -------------------- background generation --------------------


async def generate_scene(
    prompt: str,
    *,
    aspect: Literal["3:2", "1:1", "16:9"] = "3:2",
    negative_prompt: str = "deformed, extra limbs, watermark, text, blurry, low-res",
) -> bytes:
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            STABILITY_ENDPOINT,
            headers={
                "authorization": f"Bearer {settings.stability_api_key}",
                "accept": "image/*",
            },
            files={"none": ""},
            data={
                "prompt": prompt,
                "negative_prompt": negative_prompt,
                "output_format": "png",
                "aspect_ratio": aspect,
                "model": "sd3.5-large",
            },
        )
        resp.raise_for_status()
        return resp.content


# -------------------- compositor --------------------


def composite_subjects_on_scene(
    scene_png: bytes,
    subject_a_png: bytes,
    subject_b_png: bytes,
) -> bytes:
    """Place two subjects on the scene with feathering, tone match, and shadow."""
    scene = Image.open(io.BytesIO(scene_png)).convert("RGBA")
    a = Image.open(io.BytesIO(subject_a_png)).convert("RGBA")
    b = Image.open(io.BytesIO(subject_b_png)).convert("RGBA")

    # Sample scene tone from upper third (sky / ambient region tends to drive lighting).
    tone = _sample_scene_tone(scene)

    target_h = int(scene.height * 0.72)
    a = _prep_subject(a, target_h, tone)
    b = _prep_subject(b, target_h, tone)

    canvas = scene.copy()

    # Subject A (slightly left)
    a_x = int(scene.width * 0.32) - a.width // 2
    a_y = scene.height - a.height - int(scene.height * 0.04)
    _paste_with_shadow(canvas, a, a_x, a_y)

    # Subject B (slightly right)
    b_x = int(scene.width * 0.68) - b.width // 2
    b_y = scene.height - b.height - int(scene.height * 0.04)
    _paste_with_shadow(canvas, b, b_x, b_y)

    out = io.BytesIO()
    canvas.convert("RGB").save(out, format="PNG", optimize=True)
    return out.getvalue()


# -------------------- helpers --------------------


def _prep_subject(img: Image.Image, target_h: int, tone: tuple[int, int, int]) -> Image.Image:
    img = _scale_to_height(img, target_h)
    img = _feather_alpha(img, radius=2)
    img = _tone_match(img, tone, strength=0.18)
    return img


def _scale_to_height(img: Image.Image, target_h: int) -> Image.Image:
    ratio = target_h / img.height
    new_w = max(1, int(img.width * ratio))
    return img.resize((new_w, target_h), Image.LANCZOS)


def _feather_alpha(img: Image.Image, radius: int = 2) -> Image.Image:
    """Soften the alpha edge so cutouts blend instead of looking pasted."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    r, g, b, a = img.split()
    a = a.filter(ImageFilter.GaussianBlur(radius=radius))
    return Image.merge("RGBA", (r, g, b, a))


def _tone_match(
    img: Image.Image, tone: tuple[int, int, int], strength: float
) -> Image.Image:
    """Gently bias the subject's RGB toward the scene's ambient tone."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    r, g, b, a = img.split()
    tr, tg, tb = tone

    def _shift(channel: Image.Image, target_value: int) -> Image.Image:
        # Linear blend each pixel toward the target by `strength`.
        avg = sum(channel.getdata()) / max(1, channel.width * channel.height)
        delta = int((target_value - avg) * strength)
        return channel.point(lambda v: max(0, min(255, v + delta)))

    r = _shift(r, tr)
    g = _shift(g, tg)
    b = _shift(b, tb)
    out = Image.merge("RGBA", (r, g, b, a))

    # Slight saturation drop helps integration with most warm scenes.
    enh = ImageEnhance.Color(out)
    out = enh.enhance(0.92)
    return out


def _sample_scene_tone(scene: Image.Image) -> tuple[int, int, int]:
    """Avg color of the scene's lower-third (ground area where subjects stand)."""
    w, h = scene.size
    lower = scene.crop((0, int(h * 0.55), w, h)).convert("RGB").resize((16, 9))
    pixels = list(lower.getdata())
    n = len(pixels)
    r = sum(p[0] for p in pixels) // n
    g = sum(p[1] for p in pixels) // n
    b = sum(p[2] for p in pixels) // n
    return r, g, b


def _paste_with_shadow(canvas: Image.Image, subject: Image.Image, x: int, y: int) -> None:
    """Paste subject with a soft drop shadow underneath for grounding."""
    # Build shadow from the alpha channel.
    if subject.mode != "RGBA":
        subject = subject.convert("RGBA")
    _, _, _, alpha = subject.split()

    shadow = Image.new("RGBA", subject.size, (0, 0, 0, 0))
    shadow.putalpha(alpha.filter(ImageFilter.GaussianBlur(radius=10)))
    # Tint shadow black, half-strength.
    sr = Image.new("RGBA", subject.size, (0, 0, 0, 110))
    sr.putalpha(shadow.getchannel("A"))

    # Offset shadow down + slightly right to suggest overhead lighting.
    canvas.alpha_composite(sr, (x + 6, y + 14))
    canvas.alpha_composite(subject, (x, y))
