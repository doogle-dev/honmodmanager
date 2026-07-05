import os
import subprocess
import tempfile
from PIL import Image, ImageFilter

SEVEN_ZIP_PATH = os.path.join(os.environ.get("ProgramFiles", r"C:\Program Files"), "7-Zip", "7z.exe")
GAME_ARCHIVE_PATH = os.path.join(os.environ["LOCALAPPDATA"], "Juvio", "heroes of newerth", "resources0.jz")
MOD_SOURCES_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
WARD_SPOT_ART_DIRECTORY = os.path.join(MOD_SOURCES_DIRECTORY, "brighter_ward_spots")

GOLD_BRIGHT = (255, 224, 120)
GOLD_DEEP = (216, 148, 32)
ALPHA_BOOST = 2.1
GLOW_BLUR_RADIUS = 5
GLOW_STRENGTH = 0.85
PREVIEW_BACKGROUND = (32, 44, 30)


def extract_base_ward_spot_texture():
    with tempfile.TemporaryDirectory() as extraction_directory:
        subprocess.run(
            [SEVEN_ZIP_PATH, "e", "-y", "-o" + extraction_directory, GAME_ARCHIVE_PATH, "world/decals/wardspot_d.dds"],
            check=True,
            capture_output=True,
        )
        base_texture = Image.open(os.path.join(extraction_directory, "wardspot_d.dds")).convert("RGBA")
        base_texture.load()
        return base_texture


def build_bright_ward_spot_texture(base_texture):
    base_alpha = base_texture.getchannel("A")
    base_luminance = base_texture.convert("L")

    gold_channels = [
        base_luminance.point(
            lambda luminance_value, channel_index=channel_index: GOLD_DEEP[channel_index]
            + (GOLD_BRIGHT[channel_index] - GOLD_DEEP[channel_index]) * luminance_value // 255
        )
        for channel_index in range(3)
    ]
    boosted_alpha = base_alpha.point(lambda alpha_value: min(255, int(alpha_value * ALPHA_BOOST)))
    gold_shape = Image.merge("RGBA", gold_channels + [boosted_alpha])

    glow_alpha = base_alpha.filter(ImageFilter.GaussianBlur(GLOW_BLUR_RADIUS)).point(
        lambda alpha_value: min(255, int(alpha_value * ALPHA_BOOST * GLOW_STRENGTH))
    )
    glow_layer = Image.new("RGBA", base_texture.size, GOLD_DEEP + (0,))
    glow_layer.putalpha(glow_alpha)

    return Image.alpha_composite(glow_layer, gold_shape)


def build_preview_image(bright_texture):
    preview_image = Image.new("RGBA", bright_texture.size, PREVIEW_BACKGROUND + (255,))
    return Image.alpha_composite(preview_image, bright_texture).convert("RGB")


def generate_brighter_ward_spot_art():
    os.makedirs(WARD_SPOT_ART_DIRECTORY, exist_ok=True)
    base_texture = extract_base_ward_spot_texture()
    bright_texture = build_bright_ward_spot_texture(base_texture)
    bright_texture.save(os.path.join(WARD_SPOT_ART_DIRECTORY, "wardspot_d.tga"))
    bright_texture.save(os.path.join(WARD_SPOT_ART_DIRECTORY, "wardspot_d.dds"))
    build_preview_image(bright_texture).save(os.path.join(WARD_SPOT_ART_DIRECTORY, "brighter_ward_spots_preview.png"))
    print("generated ward spot art in", WARD_SPOT_ART_DIRECTORY)


if __name__ == "__main__":
    generate_brighter_ward_spot_art()
