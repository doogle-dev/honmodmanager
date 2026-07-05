import os
import json
import shutil
import hashlib
import zipfile
import xml.etree.ElementTree as ElementTree

SERVER_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SERVER_DIRECTORY)
SOURCE_MODS_DIRECTORY = os.path.join(PROJECT_ROOT, "mods")
CATALOG_DIRECTORY = os.path.join(SERVER_DIRECTORY, "catalog")
APP_PACKAGE_JSON = os.path.join(PROJECT_ROOT, "app", "package.json")


def read_manager_version():
    with open(APP_PACKAGE_JSON, "r", encoding="utf-8") as package_handle:
        return json.load(package_handle).get("version", "0.0.0")


def read_manifest_and_icon(honmod_path):
    with zipfile.ZipFile(honmod_path) as honmod_archive:
        manifest_bytes = honmod_archive.read("mod.xml")
        entry_names = honmod_archive.namelist()
        icon_bytes = honmod_archive.read("icon.png") if "icon.png" in entry_names else None
    manifest_root = ElementTree.fromstring(manifest_bytes)
    metadata = {
        "name": manifest_root.get("name", os.path.basename(honmod_path)),
        "version": manifest_root.get("version", ""),
        "author": manifest_root.get("author", ""),
        "description": manifest_root.get("description", ""),
        "category": manifest_root.get("category", "Other"),
        "abilitykey": manifest_root.get("abilitykey", ""),
    }
    return metadata, icon_bytes


def build_identifier(display_name):
    identifier_characters = [character.lower() if character.isalnum() else "-" for character in display_name]
    return "".join(identifier_characters).strip("-")


def build_catalog():
    mods_output_directory = os.path.join(CATALOG_DIRECTORY, "mods")
    icons_output_directory = os.path.join(CATALOG_DIRECTORY, "icons")
    if os.path.exists(CATALOG_DIRECTORY):
        shutil.rmtree(CATALOG_DIRECTORY)
    os.makedirs(mods_output_directory)
    os.makedirs(icons_output_directory)

    catalog_entries = []
    for file_name in sorted(os.listdir(SOURCE_MODS_DIRECTORY)):
        if not file_name.lower().endswith(".honmod"):
            continue
        source_path = os.path.join(SOURCE_MODS_DIRECTORY, file_name)
        metadata, icon_bytes = read_manifest_and_icon(source_path)
        honmod_bytes = open(source_path, "rb").read()
        checksum = hashlib.sha256(honmod_bytes).hexdigest()
        identifier = build_identifier(metadata["name"])

        open(os.path.join(mods_output_directory, file_name), "wb").write(honmod_bytes)
        icon_relative_path = ""
        if icon_bytes:
            icon_file_name = identifier + ".png"
            open(os.path.join(icons_output_directory, icon_file_name), "wb").write(icon_bytes)
            icon_relative_path = "icons/" + icon_file_name

        catalog_entries.append({
            "id": identifier,
            "fileName": file_name,
            "name": metadata["name"],
            "version": metadata["version"],
            "author": metadata["author"],
            "description": metadata["description"],
            "category": metadata["category"],
            "abilityKey": metadata["abilitykey"],
            "icon": icon_relative_path,
            "download": "mods/" + file_name,
            "sha256": checksum,
        })

    catalog = {
        "manager": {"version": read_manager_version()},
        "mods": catalog_entries,
    }
    catalog_path = os.path.join(CATALOG_DIRECTORY, "catalog.json")
    with open(catalog_path, "w", encoding="utf-8") as catalog_handle:
        json.dump(catalog, catalog_handle, indent=2)
    print("built catalog with", len(catalog_entries), "mod(s) at", catalog_path)


if __name__ == "__main__":
    build_catalog()
