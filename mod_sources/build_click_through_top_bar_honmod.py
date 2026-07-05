import os
import zipfile

MOD_SOURCES_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
MODS_OUTPUT_DIRECTORY = os.path.join(os.path.dirname(MOD_SOURCES_DIRECTORY), "mods")

HEROFRAME_TEMPLATE_EDITS = [
    (
        '<panel name="heroframe_top_element_{index}" width="-2" height="-1" align="center">',
        '<panel name="heroframe_top_element_{index}" norclick="1" width="-2" height="-1" align="center">',
    ),
    (
        '<frame style="log_shadow" color="0 0 0 .5" bordercolor="0 0 0 .5" />',
        '<frame style="log_shadow" norclick="1" color="0 0 0 .5" bordercolor="0 0 0 .5" />',
    ),
    (
        '<frame height="{height=0.33w}" width="{width=100%}" valign="{valign}" align="{align}" y="{y}" x="{x}"',
        '<frame norclick="1" height="{height=0.33w}" width="{width=100%}" valign="{valign}" align="{align}" y="{y}" x="{x}"',
    ),
    (
        '<panel name="heroframe_top_ability_pips_{index}" height="10%" valign="bottom" y="-16%" visible="1">',
        '<panel name="heroframe_top_ability_pips_{index}" norclick="1" height="10%" valign="bottom" y="-16%" visible="1">',
    ),
    (
        '<panel name="heroframe_top_ability_ult_indicator_{index}">',
        '<panel name="heroframe_top_ability_ult_indicator_{index}" norclick="1">',
    ),
    (
        '<image texture="/ui/hd_ui/icons/dead.tga" width="100@" height="100%" valign="center" />',
        '<image texture="/ui/hd_ui/icons/dead.tga" norclick="1" width="100@" height="100%" valign="center" />',
    ),
    (
        '<image texture="/ui/hd_ui/hero_frames/hero_lvl_frame.tga" />',
        '<image texture="/ui/hd_ui/hero_frames/hero_lvl_frame.tga" norclick="1" />',
    ),
    (
        '<panel name="heroframe_{type}_abilitydot_{index}_{slot}" color=".3 .3 .3"',
        '<panel norclick="1" name="heroframe_{type}_abilitydot_{index}_{slot}" color=".3 .3 .3"',
    ),
]

SCORE_CLOCK_EDITS = [
    (
        '<panel align="center" x="-16%" width="13%" height="44%" onclicklua="if (Input.IsAltDown()) then SendGamePing(\'alt_team_score\', 1) end">',
        '<panel norclick="1" align="center" x="-16%" width="13%" height="44%" onclicklua="if (Input.IsAltDown()) then SendGamePing(\'alt_team_score\', 1) end">',
    ),
    (
        '<panel align="center" x="16%" width="13%" height="44%" onclicklua="if (Input.IsAltDown()) then SendGamePing(\'alt_team_score\', 2) end">',
        '<panel norclick="1" align="center" x="16%" width="13%" height="44%" onclicklua="if (Input.IsAltDown()) then SendGamePing(\'alt_team_score\', 2) end">',
    ),
    (
        '<panel onclicklua="if (Input.IsAltDown()) then SendGamePing(\'alt_game_time\') end">',
        '<panel norclick="1" onclicklua="if (Input.IsAltDown()) then SendGamePing(\'alt_game_time\') end">',
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
	name="Click Through Top Bar"
	version="1.2"
	date="05/07/2026"
	description="Lets right clicks pass through the whole top bar, the hero portraits, the kda numbers, the clock and the creep score, so it stops blocking right click movement near the top of the screen. Left clicks and alt click pings still work like normal."
	author="Doogle"
	category="Interface"
	weblink=""
	updatecheckurl=""
	updatedownloadurl=""
>
	<editfile name="ui/hd_ui/templates/heroframe_templates.package">
{heroframe_edit_pairs}
	</editfile>
	<editfile name="ui/hd_ui/sections/heroes_score_clock.package">
{score_clock_edit_pairs}
	</editfile>
</modification>
""".format(
    heroframe_edit_pairs=build_edit_pairs_xml(HEROFRAME_TEMPLATE_EDITS),
    score_clock_edit_pairs=build_edit_pairs_xml(SCORE_CLOCK_EDITS),
)

CHANGELOG_TEXT = "v1.2 (05 Jul 2026)\nOnly right clicks pass through now, left clicks and alt click pings work like normal\n\nv1.1 (05 Jul 2026)\nAdds click through for the kda numbers, the clock and the creep score\n\nv1.0 (05 Jul 2026)\nClick through hero portraits release\n"


def build_click_through_top_bar_honmod():
    os.makedirs(MODS_OUTPUT_DIRECTORY, exist_ok=True)
    output_path = os.path.join(MODS_OUTPUT_DIRECTORY, "ClickThroughTopBar.honmod")
    icon_path = os.path.join(MOD_SOURCES_DIRECTORY, "click_through_top_bar", "click_through_top_bar_preview.png")
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as honmod_archive:
        honmod_archive.writestr("mod.xml", MANIFEST_TEXT)
        if os.path.exists(icon_path):
            honmod_archive.writestr("icon.png", open(icon_path, "rb").read())
        honmod_archive.writestr("changelog.txt", CHANGELOG_TEXT)
    print("built", output_path)


if __name__ == "__main__":
    build_click_through_top_bar_honmod()
