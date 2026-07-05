import os
import zipfile

MOD_SOURCES_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
MODS_OUTPUT_DIRECTORY = os.path.join(os.path.dirname(MOD_SOURCES_DIRECTORY), "mods")

PET_ALT_INFO_EDITS = [
    (
        '\t\t\t\t\t<label name="name_label{unit}" fitx="1" fity="1" style="centerall" font="dyn_bold_9" color=".8 .8 .8 1" shadow="1" />',
        '\t\t\t\t\t<label name="name_label{unit}" visible="0" fitx="1" fity="1" style="centerall" font="dyn_bold_9" color=".8 .8 .8 1" shadow="1" />',
    ),
    (
        '\t\t\t<panel width="100%" height="2.9h" noclick="1">',
        '\t\t\t<panel visible="0" width="100%" height="2.9h" noclick="1">',
    ),
    (
        '\t\t\t\t<instance name="alt_info_panel_textures" unit="{unit}" texture="altinfo-base-c_tall.tga" />',
        '\t\t\t\t<panel width="0" height="0" noclick="1" />',
    ),
]


def build_edit_pairs_xml(edit_pairs):
    return "\n".join(
        "\t\t<find><![CDATA[" + find_text + "]]></find>\n\t\t<replace><![CDATA[" + replace_text + "]]></replace>"
        for find_text, replace_text in edit_pairs
    )


MANIFEST_TEXT = """<?xml version="1.0" encoding="UTF-8"?>
<modification
	application="Heroes of Newerth Reborn"
	appversion="*"
	mmversion="*"
	name="Clean Summon Alt Info"
	version="1.1"
	date="06/07/2026"
	description="Hides the owner hero icon, the unit name and the dark background from the info panel that appears above summoned units when you hold Alt, like Slither toxin wards and Pharaoh mummies, so they are much less visually cluttered. Affects every summoned pet unit."
	author="Doogle"
	category="Interface"
	weblink=""
	updatecheckurl=""
	updatedownloadurl=""
>
	<editfile name="ui/alt_info_pet.interface">
{pet_alt_info_edit_pairs}
	</editfile>
</modification>
""".format(
    pet_alt_info_edit_pairs=build_edit_pairs_xml(PET_ALT_INFO_EDITS),
)

CHANGELOG_TEXT = "v1.1 (06 Jul 2026)\nAlso hides the unit name like Toxin Ward and Mummy Wall\n\nv1.0 (06 Jul 2026)\nRelease\nHides the owner hero icon and makes the Alt info panel background transparent for summoned units\n"


def build_clean_summon_alt_info_honmod():
    os.makedirs(MODS_OUTPUT_DIRECTORY, exist_ok=True)
    output_path = os.path.join(MODS_OUTPUT_DIRECTORY, "CleanSummonAltInfo.honmod")
    icon_path = os.path.join(MOD_SOURCES_DIRECTORY, "clean_summon_alt_info", "clean_summon_alt_info_preview.png")
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as honmod_archive:
        honmod_archive.writestr("mod.xml", MANIFEST_TEXT)
        if os.path.exists(icon_path):
            honmod_archive.writestr("icon.png", open(icon_path, "rb").read())
        honmod_archive.writestr("changelog.txt", CHANGELOG_TEXT)
    print("built", output_path)


if __name__ == "__main__":
    build_clean_summon_alt_info_honmod()
