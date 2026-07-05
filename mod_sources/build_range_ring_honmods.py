import os
import zipfile

MOD_SOURCES_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
RANGE_RING_SOURCE_DIRECTORY = os.path.join(MOD_SOURCES_DIRECTORY, "range_rings")
MODS_OUTPUT_DIRECTORY = os.path.join(os.path.dirname(MOD_SOURCES_DIRECTORY), "mods")

RING_MATERIAL = "/shared/materials/area_cast_indicator_simple_nogradient.material"

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
	category="Range Rings"
	abilitykey="{ability_key}"
	weblink=""
	updatecheckurl=""
	updatedownloadurl=""
>
{operations}
</modification>
"""

CHANGELOG_TEXT = "v1.0 (05 Jul 2026)\nRelease\n"


def ring_system_xml(ring_sizes):
    lines = ['\t\t<particlesystem name="range_ring_system" space="entity" scale="1">']
    for ring_size in ring_sizes:
        lines.append(
            '\t\t\t<groundsprite material="' + RING_MATERIAL + '" size="' + str(ring_size) + '" color="0 .75 1" alpha=".4" />'
        )
    lines.append("\t\t</particlesystem>")
    return "\n".join(lines)


def ring_injection_edit(effect_target, ring_sizes):
    return {
        "target": effect_target,
        "pairs": [
            ("</definitions>", ring_system_xml(ring_sizes) + "\n\t</definitions>"),
            ("<thread>", '<thread>\n\t\t<spawnparticlesystem instance="range_ring_instance" particlesystem="range_ring_system" />'),
        ],
    }


RANGE_RING_MODS = {
    "rhapsody_melody": {
        "output_file_name": "RebornRangeRingRhapsodyMelody.honmod",
        "display_name": "Rhapsody Melody Range Ring",
        "description": "Shows the Protective Melody radius around Rhapsody at all times using the games own cast indicator ring.",
        "ability_key": "R",
        "edits": [
            {
                "target": "heroes/rhapsody/base/hero.entity",
                "pairs": [('passiveeffect=""', 'passiveeffect="ability_04/effects/aura_range_ring.effect"')],
            }
        ],
        "copies": [
            {
                "target": "heroes/rhapsody/base/ability_04/effects/aura_range_ring.effect",
                "source": "rhapsody_melody_ring.effect",
            }
        ],
    },
    "riftwalker_wormhole": {
        "output_file_name": "RangeRingRiftwalkerWormhole.honmod",
        "display_name": "Riftwalker Wormhole Range Ring",
        "description": "Shows the Wormhole cast range around Riftwalker at all times using the games own cast indicator ring.",
        "ability_key": "R",
        "edits": [ring_injection_edit("heroes/riftwalker/base/effects/body.effect", [565])],
        "copies": [],
    },
    "pharaoh_mummies": {
        "output_file_name": "RangeRingPharaohWallOfMummies.honmod",
        "display_name": "Pharaoh Wall of Mummies Range Ring",
        "description": "Shows the Wall of Mummies ring around Pharaoh at all times using the games own cast indicator ring.",
        "ability_key": "W",
        "edits": [
            {
                "target": "heroes/pharaoh/base/hero.entity",
                "pairs": [('passiveeffect=""', 'passiveeffect="ability_02/effects/aura_range_ring.effect"')],
            }
        ],
        "copies": [
            {
                "target": "heroes/pharaoh/base/ability_02/effects/aura_range_ring.effect",
                "source": "pharaoh_mummies_ring.effect",
            }
        ],
    },
    "soul_reaper_judgement": {
        "output_file_name": "RangeRingSoulReaperJudgement.honmod",
        "display_name": "Soul Reaper Judgement Range Ring",
        "description": "Shows the Judgement radius around Soul Reaper at all times using the games own cast indicator ring.",
        "ability_key": "Q",
        "edits": [ring_injection_edit("heroes/soul_reaper/base/effects/body.effect", [611])],
        "copies": [],
    },
    "soulstealer_demon_hand": {
        "output_file_name": "RangeRingSoulstealerDemonHand.honmod",
        "display_name": "Soulstealer Demon Hand Range Rings",
        "description": "Shows the three Demon Hand ranges around Soulstealer at all times using the games own cast indicator ring.",
        "ability_key": "QWE",
        "edits": [ring_injection_edit("heroes/soulstealer/base/effects/body.effect", [90, 190, 290])],
        "copies": [],
    },
    "astrolabe_active": {
        "output_file_name": "RangeRingAstrolabe.honmod",
        "display_name": "Astrolabe Range Ring",
        "description": "Shows the Astrolabe heal radius around the carrier at all times while the item is held using the games own cast indicator ring.",
        "ability_key": "",
        "edits": [
            {
                "target": "items/recipes/astrolabe/item.entity",
                "pairs": [('cooldowntype="astrolabe"', 'cooldowntype="astrolabe" passiveeffect="active_range_ring.effect"')],
            }
        ],
        "copies": [
            {
                "target": "items/recipes/astrolabe/active_range_ring.effect",
                "source": "astrolabe_active_ring.effect",
            }
        ],
    },
    "tower_attack_range": {
        "output_file_name": "RangeRingTowers.honmod",
        "display_name": "Tower Range Rings",
        "description": "Shows the attack range around every tower at all times using the games own cast indicator ring.",
        "ability_key": "",
        "edits": [
            ring_injection_edit("buildings/legion/attack_tower/tower_1/effects/body.effect", [658]),
            ring_injection_edit("buildings/legion/attack_tower/tower_2/effects/body.effect", [658]),
            ring_injection_edit("buildings/legion/attack_tower/tower_3/effects/body.effect", [658]),
            ring_injection_edit("buildings/legion/attack_tower/tower_4/effects/body.effect", [603]),
            ring_injection_edit("buildings/hellbourne/attack_tower/tower_1/effects/body.effect", [804]),
            ring_injection_edit("buildings/hellbourne/attack_tower/tower_2/effects/body.effect", [762]),
            ring_injection_edit("buildings/hellbourne/attack_tower/tower_3/effects/body.effect", [762]),
            ring_injection_edit("buildings/hellbourne/attack_tower/tower_4_left/effects/body.effect", [804]),
        ],
        "copies": [],
    },
    "moon_queen_finale": {
        "output_file_name": "RangeRingMoonQueenMoonFinale.honmod",
        "display_name": "Moon Queen Moon Finale Range Ring",
        "description": "Shows the Moon Finale radius around Moon Queen at all times using the games own cast indicator ring.",
        "ability_key": "R",
        "edits": [
            ring_injection_edit("heroes/moon_queen/base/effects/body.effect", [409]),
            ring_injection_edit("heroes/moon_queen/base/effects/boost.effect", [409]),
        ],
        "copies": [],
    },
}


def operations_xml(mod_info):
    blocks = []
    for edit in mod_info["edits"]:
        lines = ['\t<editfile name="' + edit["target"] + '">']
        for find_text, replace_text in edit["pairs"]:
            lines.append("\t\t<find><![CDATA[" + find_text + "]]></find>")
            lines.append("\t\t<replace><![CDATA[" + replace_text + "]]></replace>")
        lines.append("\t</editfile>")
        blocks.append("\n".join(lines))
    for copy in mod_info["copies"]:
        blocks.append('\t<copyfile name="' + copy["target"] + '" />')
    return "\n".join(blocks)


def build_all_range_ring_honmods():
    os.makedirs(MODS_OUTPUT_DIRECTORY, exist_ok=True)
    for variant_name, mod_info in RANGE_RING_MODS.items():
        manifest_text = MANIFEST_TEMPLATE.format(
            display_name=mod_info["display_name"],
            description=mod_info["description"],
            ability_key=mod_info["ability_key"],
            operations=operations_xml(mod_info),
        )
        icon_path = os.path.join(RANGE_RING_SOURCE_DIRECTORY, variant_name + "_preview.png")
        output_path = os.path.join(MODS_OUTPUT_DIRECTORY, mod_info["output_file_name"])
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as honmod_archive:
            honmod_archive.writestr("mod.xml", manifest_text)
            if os.path.exists(icon_path):
                honmod_archive.writestr("icon.png", open(icon_path, "rb").read())
            honmod_archive.writestr("changelog.txt", CHANGELOG_TEXT)
            for copy in mod_info["copies"]:
                copy_bytes = open(os.path.join(RANGE_RING_SOURCE_DIRECTORY, copy["source"]), "rb").read()
                honmod_archive.writestr(copy["target"], copy_bytes)
        print("built", output_path)


if __name__ == "__main__":
    build_all_range_ring_honmods()
