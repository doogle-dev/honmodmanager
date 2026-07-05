import os
import zipfile

MOD_SOURCES_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
TREE_STUMP_SOURCE_DIRECTORY = os.path.join(MOD_SOURCES_DIRECTORY, "tree_stumps")
MODS_OUTPUT_DIRECTORY = os.path.join(os.path.dirname(MOD_SOURCES_DIRECTORY), "mods")

TREE_TYPES = [
    "ashtree",
    "deadtree1",
    "deadtree2",
    "deepwoodpine",
    "deepwoodpine2",
    "deepwoodtree",
    "deepwoodtreeblue",
    "jungle1",
    "jungle2",
    "jungle3",
    "jungle4",
    "legion1",
    "legion2",
    "legion3",
    "legion4",
    "legion5",
    "swamp1",
    "swamp2",
    "swamp3",
    "wastelandtree",
]

COPYFILE_LINES_XML = "\n".join(
    '\t<copyfile name="world/rprops/trees/' + tree_type + '/model.mdf" source="stump_model.mdf" />'
    for tree_type in TREE_TYPES
)

MANIFEST_TEXT = """<?xml version="1.0" encoding="UTF-8"?>
<modification
	application="Heroes of Newerth Reborn"
	appversion="*"
	mmversion="*"
	name="Tree Stumps"
	version="1.0"
	date="05/07/2026"
	description="Replaces the map trees with small stumps for a clearer view of the battlefield."
	author="Doogle"
	category="Visibility"
	weblink=""
	updatecheckurl=""
	updatedownloadurl=""
>
{copyfile_lines}
</modification>
""".format(copyfile_lines=COPYFILE_LINES_XML)

CHANGELOG_TEXT = "v1.0 (05 Jul 2026)\nRelease\n"


def build_tree_stump_honmod():
    os.makedirs(MODS_OUTPUT_DIRECTORY, exist_ok=True)
    stump_mdf_bytes = open(os.path.join(TREE_STUMP_SOURCE_DIRECTORY, "stump_model.mdf"), "rb").read()
    icon_path = os.path.join(TREE_STUMP_SOURCE_DIRECTORY, "tree_stumps_preview.png")
    output_path = os.path.join(MODS_OUTPUT_DIRECTORY, "TreeStumps.honmod")
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as honmod_archive:
        honmod_archive.writestr("mod.xml", MANIFEST_TEXT)
        if os.path.exists(icon_path):
            honmod_archive.writestr("icon.png", open(icon_path, "rb").read())
        honmod_archive.writestr("changelog.txt", CHANGELOG_TEXT)
        honmod_archive.writestr("stump_model.mdf", stump_mdf_bytes)
    print("built", output_path)


if __name__ == "__main__":
    build_tree_stump_honmod()
