import os
import zipfile

MOD_SOURCES_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
CURSOR_SOURCE_DIRECTORY = os.path.join(MOD_SOURCES_DIRECTORY, "cursors")
MODS_OUTPUT_DIRECTORY = os.path.join(os.path.dirname(MOD_SOURCES_DIRECTORY), "mods")

MANIFEST_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<modification
	application="Heroes of Newerth Reborn"
	appversion="*"
	mmversion="*"
	name="{display_name}"
	version="1.0"
	date="05/07/2026"
	description="{description}"
	author="Doogle"
	category="Cursors"
	weblink=""
	updatecheckurl=""
	updatedownloadurl=""
>
	<copyfile name="core/cursors/arrow.tga" />
</modification>
"""

CHANGELOG_TEXT = "v1.0 (05 Jul 2026)\nRelease\n"

CURSOR_MODS = {
    "frost": {
        "output_file_name": "RebornCursorFrost.honmod",
        "display_name": "Custom Cursor Frost",
        "description": "Replaces the default pointer with a blue gradient arrow. Adjust the size in Options with the cursor size slider.",
    },
    "ember": {
        "output_file_name": "RebornCursorEmber.honmod",
        "display_name": "Custom Cursor Ember",
        "description": "Replaces the default pointer with a warm gradient arrow. Adjust the size in Options with the cursor size slider.",
    },
    "void": {
        "output_file_name": "RebornCursorVoid.honmod",
        "display_name": "Custom Cursor Void",
        "description": "Replaces the default pointer with a violet gradient arrow. Adjust the size in Options with the cursor size slider.",
    },
}


def build_all_cursor_honmods():
    os.makedirs(MODS_OUTPUT_DIRECTORY, exist_ok=True)
    for variant_name, mod_info in CURSOR_MODS.items():
        cursor_bytes = open(os.path.join(CURSOR_SOURCE_DIRECTORY, "arrow_" + variant_name + ".tga"), "rb").read()
        icon_bytes = open(os.path.join(CURSOR_SOURCE_DIRECTORY, variant_name + "_preview.png"), "rb").read()
        manifest_text = MANIFEST_TEMPLATE.format(
            display_name=mod_info["display_name"],
            description=mod_info["description"],
        )
        output_path = os.path.join(MODS_OUTPUT_DIRECTORY, mod_info["output_file_name"])
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as honmod_archive:
            honmod_archive.writestr("mod.xml", manifest_text)
            honmod_archive.writestr("icon.png", icon_bytes)
            honmod_archive.writestr("changelog.txt", CHANGELOG_TEXT)
            honmod_archive.writestr("core/cursors/arrow.tga", cursor_bytes)
        print("built", output_path)


if __name__ == "__main__":
    build_all_cursor_honmods()
