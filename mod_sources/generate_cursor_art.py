import os
import struct
from PIL import Image, ImageDraw, ImageFilter, ImageChops

CURSOR_OUTPUT_DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cursors")

SUPERSAMPLE = 4
CANVAS = 128 * SUPERSAMPLE
POINTER_UNITS = [(1, 1), (1, 19), (5.5, 14.5), (9, 22), (12, 20.5), (8, 13.5), (14, 13.5)]
SCALE = 5.4 * SUPERSAMPLE
OFFSET = 2 * SUPERSAMPLE
POINTER_POINTS = [(x * SCALE + OFFSET, y * SCALE + OFFSET) for (x, y) in POINTER_UNITS]

CURSOR_VARIANTS = {
    "frost": ((150, 224, 255), (21, 96, 192)),
    "ember": ((255, 202, 92), (200, 30, 46)),
    "void": ((205, 165, 255), (91, 33, 182)),
}


def diagonal_gradient(bright_color, dark_color):
    small_size = 64
    gradient = Image.new("RGB", (small_size, small_size))
    for y in range(small_size):
        for x in range(small_size):
            blend = (x + y) / (2 * small_size - 2)
            gradient.putpixel((x, y), tuple(
                int(bright_color[channel] * (1 - blend) + dark_color[channel] * blend) for channel in range(3)
            ))
    return gradient.resize((CANVAS, CANVAS), Image.BILINEAR).convert("RGBA")


def build_cursor_image(bright_color, dark_color):
    shape_mask = Image.new("L", (CANVAS, CANVAS), 0)
    ImageDraw.Draw(shape_mask).polygon(POINTER_POINTS, fill=255)

    composite = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))

    shadow_alpha = shape_mask.filter(ImageFilter.GaussianBlur(7 * SUPERSAMPLE)).point(lambda value: int(value * 0.55))
    shadow_layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    shadow_layer.putalpha(shadow_alpha)
    shadow_layer = shadow_layer.transform((CANVAS, CANVAS), Image.AFFINE, (1, 0, -5 * SUPERSAMPLE, 0, 1, -5 * SUPERSAMPLE))
    composite = Image.alpha_composite(composite, shadow_layer)

    glow_alpha = shape_mask.filter(ImageFilter.GaussianBlur(5 * SUPERSAMPLE)).point(lambda value: int(value * 0.45))
    glow_layer = Image.new("RGBA", (CANVAS, CANVAS), bright_color + (0,))
    glow_layer.putalpha(glow_alpha)
    composite = Image.alpha_composite(composite, glow_layer)

    outline_mask = shape_mask.filter(ImageFilter.MaxFilter(2 * SUPERSAMPLE + 1))
    outline_layer = Image.new("RGBA", (CANVAS, CANVAS), (9, 11, 16, 255))
    composite.paste(outline_layer, (0, 0), outline_mask)

    gradient_fill = diagonal_gradient(bright_color, dark_color)
    composite.paste(gradient_fill, (0, 0), shape_mask)

    shifted_mask = shape_mask.transform((CANVAS, CANVAS), Image.AFFINE, (1, 0, 3 * SUPERSAMPLE, 0, 1, 3 * SUPERSAMPLE))
    bevel_mask = ImageChops.subtract(shape_mask, shifted_mask).filter(ImageFilter.GaussianBlur(SUPERSAMPLE))
    bevel_layer = Image.new("RGBA", (CANVAS, CANVAS), (255, 255, 255, 210))
    composite.paste(bevel_layer, (0, 0), bevel_mask)

    return composite.resize((128, 128), Image.LANCZOS)


def save_targa(image, path):
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    body = bytearray()
    for y in range(height - 1, -1, -1):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            body += bytes((blue, green, red, alpha))
    header = struct.pack("<BBBHHBHHHHBB", 0, 0, 2, 0, 0, 0, 0, 0, width, height, 32, 0x08)
    footer = struct.pack("<II", 0, 0) + b"TRUEVISION-XFILE." + b"\x00"
    open(path, "wb").write(header + bytes(body) + footer)


def generate_all_cursor_art():
    os.makedirs(CURSOR_OUTPUT_DIRECTORY, exist_ok=True)
    for variant_name, (bright_color, dark_color) in CURSOR_VARIANTS.items():
        cursor_image = build_cursor_image(bright_color, dark_color)
        save_targa(cursor_image, os.path.join(CURSOR_OUTPUT_DIRECTORY, "arrow_" + variant_name + ".tga"))
        cursor_image.save(os.path.join(CURSOR_OUTPUT_DIRECTORY, variant_name + "_preview.png"))
        print("generated", variant_name)


if __name__ == "__main__":
    generate_all_cursor_art()
