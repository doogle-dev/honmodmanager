import os
import zipfile

MOD_SOURCES_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
MODS_OUTPUT_DIRECTORY = os.path.join(os.path.dirname(MOD_SOURCES_DIRECTORY), "mods")

KILL_SCREEN_WATCHES = ["KillScreenTop", "KillScreenRight", "KillScreenLeft", "KillScreenFull"]

EDIT_PAIRS_XML = "\n".join(
    '\t\t<find><![CDATA[watch="' + watch_name + '"]]></find>\n\t\t<replace><![CDATA[watch=""]]></replace>'
    for watch_name in KILL_SCREEN_WATCHES
)

MANIFEST_TEXT = """<?xml version="1.0" encoding="UTF-8"?>
<modification
	application="Heroes of Newerth Reborn"
	appversion="*"
	mmversion="*"
	name="Remove Death Screen Effects"
	version="1.0"
	date="05/07/2026"
	description="Removes the fullscreen overlays shown while you are dead so your screen stays clear."
	author="Doogle"
	category="Interface"
	weblink=""
	updatecheckurl=""
	updatedownloadurl=""
>
	<editfile name="ui/hd_ui/sections/killscreen.package">
{edit_pairs}
	</editfile>
</modification>
""".format(edit_pairs=EDIT_PAIRS_XML)

CHANGELOG_TEXT = "v1.0 (05 Jul 2026)\nRelease\n"


def build_remove_death_screen_honmod():
    os.makedirs(MODS_OUTPUT_DIRECTORY, exist_ok=True)
    icon_path = os.path.join(MOD_SOURCES_DIRECTORY, "remove_death_screen", "remove_death_screen_preview.png")
    output_path = os.path.join(MODS_OUTPUT_DIRECTORY, "RemoveDeathScreenEffects.honmod")
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as honmod_archive:
        honmod_archive.writestr("mod.xml", MANIFEST_TEXT)
        if os.path.exists(icon_path):
            honmod_archive.writestr("icon.png", open(icon_path, "rb").read())
        honmod_archive.writestr("changelog.txt", CHANGELOG_TEXT)
    print("built", output_path)


if __name__ == "__main__":
    build_remove_death_screen_honmod()
