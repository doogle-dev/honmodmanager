import os
from PIL import Image, ImageDraw

MOD_SOURCES_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIRECTORY = os.path.join(MOD_SOURCES_DIRECTORY, "clean_summon_alt_info")
OUTPUT_PATH = os.path.join(OUTPUT_DIRECTORY, "clean_summon_alt_info_preview.png")

FINAL_SIZE = 256
SUPERSAMPLE = 4
CANVAS_SIZE = FINAL_SIZE * SUPERSAMPLE

CANVAS_BACKGROUND = (27, 28, 33, 255)
GHOST_OUTLINE = (150, 158, 178, 90)
STRIKE_COLOR = (214, 92, 92, 150)
BAR_TRACK = (0, 0, 0, 170)
BAR_FILL = (62, 190, 96, 255)
BAR_BORDER = (36, 130, 66, 255)
BAR_HIGHLIGHT = (255, 255, 255, 60)


def scaled(value):
    return int(round(value * SUPERSAMPLE))


def rounded(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(
        [scaled(box[0]), scaled(box[1]), scaled(box[2]), scaled(box[3])],
        radius=scaled(radius),
        fill=fill,
        outline=outline,
        width=scaled(width),
    )


def build_icon():
    image = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    rounded(draw, (0, 0, FINAL_SIZE, FINAL_SIZE), 30, fill=CANVAS_BACKGROUND)

    rounded(draw, (83, 52, 173, 74), 7, outline=GHOST_OUTLINE, width=3)

    rounded(draw, (105, 86, 151, 132), 9, outline=GHOST_OUTLINE, width=3)

    draw.line(
        [scaled(74), scaled(128), scaled(182), scaled(50)],
        fill=STRIKE_COLOR,
        width=scaled(5),
    )

    rounded(draw, (48, 156, 208, 196), 20, fill=BAR_TRACK, outline=BAR_BORDER, width=3)
    rounded(draw, (54, 162, 158, 190), 16, fill=BAR_FILL)
    rounded(draw, (54, 162, 158, 174), 16, fill=BAR_HIGHLIGHT)

    result = image.resize((FINAL_SIZE, FINAL_SIZE), Image.LANCZOS)
    return result


def main():
    os.makedirs(OUTPUT_DIRECTORY, exist_ok=True)
    icon = build_icon()
    icon.save(OUTPUT_PATH)
    print("wrote", OUTPUT_PATH)


if __name__ == "__main__":
    main()
