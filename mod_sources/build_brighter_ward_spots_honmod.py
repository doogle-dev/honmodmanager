import os
import zipfile

MOD_SOURCES_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
WARD_SPOT_ART_DIRECTORY = os.path.join(MOD_SOURCES_DIRECTORY, "brighter_ward_spots")
MODS_OUTPUT_DIRECTORY = os.path.join(os.path.dirname(MOD_SOURCES_DIRECTORY), "mods")

MANIFEST_TEXT = """<?xml version="1.0" encoding="UTF-8"?>
<modification
	application="Heroes of Newerth Reborn"
	appversion="*"
	mmversion="*"
	name="Brighter Ward Spots"
	version="1.0"
	date="05/07/2026"
	description="Recolors the ward spot markers painted on the map into a bright gold glow so they are much easier to see."
	author="Doogle"
	category="Visibility"
	weblink=""
	updatecheckurl=""
	updatedownloadurl=""
>
	<copyfile name="world/decals/wardspot_d.dds" source="wardspot_d.dds" />
	<copyfile name="world/decals/wardspot_d.tga" source="wardspot_d.tga" />
</modification>
"""

CHANGELOG_TEXT = "v1.0 (05 Jul 2026)\nRelease\n"


def build_brighter_ward_spots_honmod():
    os.makedirs(MODS_OUTPUT_DIRECTORY, exist_ok=True)
    output_path = os.path.join(MODS_OUTPUT_DIRECTORY, "BrighterWardSpots.honmod")
    icon_path = os.path.join(WARD_SPOT_ART_DIRECTORY, "brighter_ward_spots_preview.png")
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as honmod_archive:
        honmod_archive.writestr("mod.xml", MANIFEST_TEXT)
        if os.path.exists(icon_path):
            honmod_archive.writestr("icon.png", open(icon_path, "rb").read())
        honmod_archive.writestr("changelog.txt", CHANGELOG_TEXT)
        honmod_archive.writestr("wardspot_d.dds", open(os.path.join(WARD_SPOT_ART_DIRECTORY, "wardspot_d.dds"), "rb").read())
        honmod_archive.writestr("wardspot_d.tga", open(os.path.join(WARD_SPOT_ART_DIRECTORY, "wardspot_d.tga"), "rb").read())
    print("built", output_path)


if __name__ == "__main__":
    build_brighter_ward_spots_honmod()
