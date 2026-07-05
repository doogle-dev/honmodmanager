import os
import zipfile

MOD_SOURCES_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
MODS_OUTPUT_DIRECTORY = os.path.join(os.path.dirname(MOD_SOURCES_DIRECTORY), "mods")

TIMER_ROW_TEMPLATE = (
    '\t\t<frame texture="/ui/hd_ui/frames/inset.tga" bordercolor=".5 .5 .5 .8" color=".5 .5 .5 .8" borderthickness=".25h" width="12.5h" height="3.4h" align="center" valign="{row_valign}" noclick="1">\r\n'
    '\t\t\t<panel x="0.7h" width="82@" height="82%" valign="center" noclick="1">\r\n'
    '\t\t\t\t<image texture="/ui/hd_ui/icons/{boss_icon}.tga" y="2" color="0 0 0 1" noclick="1"/>\r\n'
    '\t\t\t\t<image texture="/ui/hd_ui/icons/{boss_icon}.tga" color=".9 .9 .9 1" noclick="1"/>\r\n'
    "\t\t\t</panel>\r\n"
    '\t\t\t<label font="dyn_bold_14" content="---" x="-0.7h" width="-134@" height="82%" align="right" valign="center" color=".9 .9 .9 1" style="textcenter" shadow="1" shadowoffset="3" noclick="1" watch="BossRespawnTimer" ontriggerlua="Game:GetBossRespawnTime(self, \'{boss_type}\', param0, param1)"/>\r\n'
    "\t\t</frame>"
)

OVERLAY_PANEL_XML = (
    '\t<panel name="boss_timers_on_screen" width="13.5h" height="7.4h" align="right" valign="bottom" x="-0.4h" y="-12.5h" noclick="1">\r\n'
    + TIMER_ROW_TEMPLATE.format(row_valign="top", boss_icon="kongor", boss_type="1")
    + "\r\n"
    + TIMER_ROW_TEMPLATE.format(row_valign="bottom", boss_icon="phoenix", boss_type="2")
    + "\r\n\t</panel>"
)

FIND_TEXT = "</interface>"
REPLACE_TEXT = OVERLAY_PANEL_XML + "\r\n</interface>"

MANIFEST_TEXT = """<?xml version="1.0" encoding="UTF-8"?>
<modification
	application="Heroes of Newerth Reborn"
	appversion="*"
	mmversion="*"
	name="Boss Timers On Screen"
	version="1.0"
	date="05/07/2026"
	description="Shows the Kongor and Phoenix respawn timers on the right side of the screen at all times so you do not need to hold the scoreboard key to see them."
	author="Doogle"
	category="Interface"
	weblink=""
	updatecheckurl=""
	updatedownloadurl=""
>
	<editfile name="ui/game_hd.interface">
		<find><![CDATA[{find_text}]]></find>
		<replace><![CDATA[{replace_text}]]></replace>
	</editfile>
</modification>
""".format(find_text=FIND_TEXT, replace_text=REPLACE_TEXT)

CHANGELOG_TEXT = "v1.0 (05 Jul 2026)\nRelease\n"


def build_boss_timers_on_screen_honmod():
    os.makedirs(MODS_OUTPUT_DIRECTORY, exist_ok=True)
    output_path = os.path.join(MODS_OUTPUT_DIRECTORY, "BossTimersOnScreen.honmod")
    icon_path = os.path.join(MOD_SOURCES_DIRECTORY, "boss_timers_on_screen", "boss_timers_on_screen_preview.png")
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as honmod_archive:
        honmod_archive.writestr("mod.xml", MANIFEST_TEXT)
        if os.path.exists(icon_path):
            honmod_archive.writestr("icon.png", open(icon_path, "rb").read())
        honmod_archive.writestr("changelog.txt", CHANGELOG_TEXT)
    print("built", output_path)


if __name__ == "__main__":
    build_boss_timers_on_screen_honmod()
