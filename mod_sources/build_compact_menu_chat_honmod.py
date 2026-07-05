import os
import zipfile

MOD_SOURCES_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
MODS_OUTPUT_DIRECTORY = os.path.join(os.path.dirname(MOD_SOURCES_DIRECTORY), "mods")

ROOT_PANEL_FIND = '<panel name="communicator_root" width="22.3w" height="-11h" align="right" valign="center" visible="1" onloadlua="Communicator:Init()" noclick="1">'
ROOT_PANEL_REPLACE = '<panel name="communicator_root" width="26w" height="30h" y="-6.5h" align="right" valign="bottom" visible="1" onloadlua="Communicator:Init()" noclick="1">'

TOGGLE_ONCLICK_LUA = "local rootWidget = Main:GetWidget('communicator_root') if rootWidget:IsVisible() then rootWidget:FadeOut(150) else rootWidget:FadeIn(150) end"

COMSHOWER_FIND = '<instance name="communicator_comshower" />'
COMSHOWER_REPLACE = (
    '<instance name="button_hd" button_name="communicator_visibility_toggle_btn" width="2.6h" height="2.6h"'
    + ' align="right" valign="bottom" x="-0.6h" y="-37h" style="btn_sm"'
    + ' show_icon="1" icon="/ui/hd_ui/icons/close.tga" icon_size="55%"'
    + ' onclicklua="' + TOGGLE_ONCLICK_LUA + '"'
    + ' />\n\t<instance name="communicator_comshower" />'
)

CHAT_SECTION_FIND = '<instance name="communicator_chat_section" width="62%" height="100%" />'
CHAT_SECTION_REPLACE = '<instance name="communicator_chat_section" width="72%" height="100%" />'

USERLIST_SECTION_FIND = '<instance name="communicator_userlist_section" width="38%" height="100%" align="right" />'
USERLIST_SECTION_REPLACE = '<instance name="communicator_userlist_section" width="28%" height="100%" align="right" />'

MANIFEST_TEXT = """<?xml version="1.0" encoding="UTF-8"?>
<modification
	application="Heroes of Newerth Reborn"
	appversion="*"
	mmversion="*"
	name="Compact Menu Chat"
	version="1.0"
	date="05/07/2026"
	description="Shrinks the main menu chat and user list into a compact box in the bottom right and adds a button above it that hides or shows the chat."
	author="Doogle"
	category="Interface"
	weblink=""
	updatecheckurl=""
	updatedownloadurl=""
>
	<editfile name="ui/fe3/sections/communicator.package">
		<find><![CDATA[{find_text}]]></find>
		<replace><![CDATA[{replace_text}]]></replace>
		<find><![CDATA[{comshower_find}]]></find>
		<replace><![CDATA[{comshower_replace}]]></replace>
		<find><![CDATA[{chat_section_find}]]></find>
		<replace><![CDATA[{chat_section_replace}]]></replace>
		<find><![CDATA[{userlist_section_find}]]></find>
		<replace><![CDATA[{userlist_section_replace}]]></replace>
	</editfile>
</modification>
""".format(
    find_text=ROOT_PANEL_FIND,
    replace_text=ROOT_PANEL_REPLACE,
    comshower_find=COMSHOWER_FIND,
    comshower_replace=COMSHOWER_REPLACE,
    chat_section_find=CHAT_SECTION_FIND,
    chat_section_replace=CHAT_SECTION_REPLACE,
    userlist_section_find=USERLIST_SECTION_FIND,
    userlist_section_replace=USERLIST_SECTION_REPLACE,
)

CHANGELOG_TEXT = "v1.0 (05 Jul 2026)\nRelease\n"


def build_compact_menu_chat_honmod():
    os.makedirs(MODS_OUTPUT_DIRECTORY, exist_ok=True)
    icon_path = os.path.join(MOD_SOURCES_DIRECTORY, "compact_menu_chat", "compact_menu_chat_preview.png")
    output_path = os.path.join(MODS_OUTPUT_DIRECTORY, "CompactMenuChat.honmod")
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as honmod_archive:
        honmod_archive.writestr("mod.xml", MANIFEST_TEXT)
        if os.path.exists(icon_path):
            honmod_archive.writestr("icon.png", open(icon_path, "rb").read())
        honmod_archive.writestr("changelog.txt", CHANGELOG_TEXT)
    print("built", output_path)


if __name__ == "__main__":
    build_compact_menu_chat_honmod()
