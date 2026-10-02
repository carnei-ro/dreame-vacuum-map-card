#!/usr/bin/env python3
"""
Extract entity definitions from dreame-vacuum integration.
"""

import os
import re
import sys
from pathlib import Path

DEFAULT_INTEGRATION_PATH = os.path.expanduser("~/Projects/dreame-vacuum")
CUSTOM_COMPONENTS_PATH = "custom_components/dreame_vacuum"
OUTPUT_FILE = "src/generated/dreame-entities.ts"


def get_integration_version(integration_path: Path) -> str:
    init_file = integration_path / "dreame" / "__init__.py"
    if init_file.exists():
        content = init_file.read_text()
        match = re.search(r'VERSION\s*=\s*["\']([^"\']+)["\']', content)
        if match:
            return match.group(1)
    return "unknown"


def extract_entities_regex(file_path: Path, description_class: str) -> list[dict]:
    if not file_path.exists():
        return []

    content = file_path.read_text()
    entities = []

    # Find all entity description blocks
    pattern = rf"{description_class}\(\s*([^)]+(?:\([^)]*\)[^)]*)*)\)"

    for match in re.finditer(pattern, content, re.DOTALL):
        block = match.group(1)
        entity = {}

        # Extract property_key
        prop_match = re.search(r"property_key\s*=\s*(?:DreameVacuum\w+\.)?(\w+)", block)
        if prop_match:
            entity["property_key"] = prop_match.group(1)

        # Extract action_key
        action_match = re.search(
            r"action_key\s*=\s*(?:DreameVacuumAction\.)?(\w+)", block
        )
        if action_match:
            entity["action_key"] = action_match.group(1)

        # Extract key - static string
        key_match = re.search(r'(?<![_\w])key\s*=\s*["\']([^"\']+)["\']', block)
        if key_match:
            entity["key"] = key_match.group(1)

        # Extract key - dynamic from property enum (e.g., key=DreameVacuumProperty.WETNESS_LEVEL.name.lower())
        if not entity.get("key"):
            dyn_key_match = re.search(
                r"(?<![_\w])key\s*=\s*DreameVacuumProperty\.(\w+)\.name\.lower\s*\(",
                block,
            )
            if dyn_key_match:
                entity["key"] = dyn_key_match.group(1).lower()

        # Extract name
        name_match = re.search(r'(?<![_\w])name\s*=\s*["\']([^"\']+)["\']', block)
        if name_match:
            entity["name"] = name_match.group(1)

        # Extract static icon (not icon_fn)
        icon_match = re.search(r'(?<![_\w])icon\s*=\s*["\']([^"\']+)["\']', block)
        if icon_match:
            entity["icon"] = icon_match.group(1)

        # Extract entity_category
        category_match = re.search(
            r"entity_category\s*=\s*EntityCategory\.(\w+)", block
        )
        if category_match:
            entity["category"] = category_match.group(1).lower()

        if entity.get("property_key") or entity.get("key") or entity.get("action_key"):
            entities.append(entity)

    return entities


def extract_services(file_path: Path) -> list[dict]:
    if not file_path.exists():
        return []

    content = file_path.read_text()
    services = []

    for line in content.split("\n"):
        if (
            line
            and not line.startswith(" ")
            and not line.startswith("#")
            and ":" in line
        ):
            service_name = line.split(":")[0].strip()
            if service_name:
                services.append({"key": service_name})

    return services


def balanced_body(content: str, open_index: int) -> str:
    depth = 0
    for index in range(open_index, len(content)):
        char = content[index]
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return content[open_index + 1 : index]
    return ""


def assignment_tuple_body(content: str, name: str) -> str:
    match = re.search(rf"\b{name}\s*(?::[^=]+)?=\s*\(", content)
    if match is None:
        return ""
    return balanced_body(content, match.end() - 1)


def description_blocks(content: str, description_class: str) -> list[str]:
    needle = f"{description_class}("
    blocks: list[str] = []
    start = 0
    while True:
        index = content.find(needle, start)
        if index < 0:
            return blocks
        blocks.append(balanced_body(content, index + len(description_class)))
        start = index + len(needle)


def entity_from_block(block: str) -> dict:
    entity: dict = {}
    prop_match = re.search(r"property_key\s*=\s*(?:DreameVacuum\w+\.)?(\w+)", block)
    if prop_match:
        entity["property_key"] = prop_match.group(1)
    key_match = re.search(r'(?<![_\w])key\s*=\s*["\']([^"\']+)["\']', block)
    if key_match:
        entity["key"] = key_match.group(1)
    if "key" not in entity:
        dyn_key_match = re.search(
            r"(?<![_\w])key\s*=\s*DreameVacuumProperty\.(\w+)\.name\.lower\s*\(",
            block,
        )
        if dyn_key_match:
            entity["key"] = dyn_key_match.group(1).lower()
    return entity


def extract_segment_entities(
    content: str, tuple_name: str, description_class: str
) -> list[dict]:
    entities = []
    for block in description_blocks(
        assignment_tuple_body(content, tuple_name), description_class
    ):
        entity = entity_from_block(block)
        if entity.get("key") or entity.get("property_key"):
            entities.append(entity)
    return entities


def entity_to_key(entity: dict) -> str:
    if "key" in entity:
        return entity["key"].upper().replace(" ", "_").replace("-", "_")
    if "property_key" in entity:
        return entity["property_key"]
    if "action_key" in entity:
        return entity["action_key"]
    return "UNKNOWN"


def entity_to_snake_key(entity: dict) -> str:
    if "key" in entity:
        return entity["key"]
    if "property_key" in entity:
        return entity["property_key"].lower()
    if "action_key" in entity:
        return entity["action_key"].lower()
    return "unknown"


def generate_typescript(
    sensors: list[dict],
    switches: list[dict],
    selects: list[dict],
    buttons: list[dict],
    numbers: list[dict],
    times: list[dict],
    services: list[dict],
    segment_selects: list[dict],
    segment_numbers: list[dict],
    version: str,
) -> str:
    lines = [
        "/**",
        " * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY",
        f" * Source: dreame-vacuum integration {version}",
        " *",
        " * Translation keys the card references. Entity ids come from the",
        " * Home Assistant entity registry, not from this file.",
        " *",
        " * Run: python scripts/extract-dreame-entities.py",
        " */",
        "",
    ]

    def write_entity_object(name: str, entities: list[dict], platform: str) -> None:
        lines.append(f"export const {name} = {{")
        seen_keys = set()
        for entity in entities:
            key = entity_to_key(entity)
            if key in seen_keys or key == "UNKNOWN":
                continue
            seen_keys.add(key)

            snake_key = entity_to_snake_key(entity)
            icon = entity.get("icon", "")
            category = entity.get("category", "")
            name_str = entity.get("name", "")

            parts = [f"key: '{snake_key}'", f"platform: '{platform}'"]
            if icon:
                parts.append(f"icon: '{icon}'")
            if category:
                parts.append(f"category: '{category}'")
            if name_str:
                parts.append(f"name: '{name_str}'")

            lines.append(f"  {key}: {{ {', '.join(parts)} }},")
        lines.append("} as const;")
        lines.append("")

    def write_services_object(services_list: list[dict]) -> None:
        lines.append("export const DREAME_SERVICES = {")
        for service in services_list:
            key = service["key"].upper()
            snake_key = service["key"]
            domain = "dreame_vacuum" if snake_key.startswith("vacuum_") else "select"
            lines.append(f"  {key}: {{ key: '{snake_key}', domain: '{domain}' }},")
        lines.append("} as const;")
        lines.append("")

    write_entity_object("DREAME_SENSORS", sensors, "sensor")
    write_entity_object("DREAME_SWITCHES", switches, "switch")
    write_entity_object("DREAME_SELECTS", selects, "select")
    write_entity_object("DREAME_BUTTONS", buttons, "button")
    write_entity_object("DREAME_NUMBERS", numbers, "number")
    write_entity_object("DREAME_TIMES", times, "time")

    lines.append("// Per-room entity templates")
    write_entity_object("DREAME_SEGMENT_SELECTS", segment_selects, "select")
    write_entity_object("DREAME_SEGMENT_NUMBERS", segment_numbers, "number")

    write_services_object(services)

    return "\n".join(lines)


def main():
    integration_path = Path(
        sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INTEGRATION_PATH
    )
    integration_path = integration_path / CUSTOM_COMPONENTS_PATH

    if not integration_path.exists():
        print(f"Error: Integration path not found: {integration_path}")
        sys.exit(1)

    print(f"Extracting entities from: {integration_path}")

    version = get_integration_version(integration_path)
    print(f"Integration version: {version}")

    # Extract entities from each platform file
    sensors = extract_entities_regex(
        integration_path / "sensor.py", "DreameVacuumSensorEntityDescription"
    )
    switches = extract_entities_regex(
        integration_path / "switch.py", "DreameVacuumSwitchEntityDescription"
    )
    selects = extract_entities_regex(
        integration_path / "select.py", "DreameVacuumSelectEntityDescription"
    )
    buttons = extract_entities_regex(
        integration_path / "button.py", "DreameVacuumButtonEntityDescription"
    )
    numbers = extract_entities_regex(
        integration_path / "number.py", "DreameVacuumNumberEntityDescription"
    )
    times = extract_entities_regex(
        integration_path / "time.py", "DreameVacuumTimeEntityDescription"
    )
    select_source = (
        (integration_path / "select.py").read_text()
        if (integration_path / "select.py").exists()
        else ""
    )
    number_source = (
        (integration_path / "number.py").read_text()
        if (integration_path / "number.py").exists()
        else ""
    )
    segment_selects = extract_segment_entities(
        select_source, "SEGMENT_SELECTS", "DreameVacuumSelectEntityDescription"
    )
    segment_numbers = extract_segment_entities(
        number_source, "SEGMENT_NUMBERS", "DreameVacuumNumberEntityDescription"
    )

    services = extract_services(integration_path / "services.yaml")

    print(
        f"Found: {len(sensors)} sensors, {len(switches)} switches, {len(selects)} selects"
    )
    print(f"Found: {len(buttons)} buttons, {len(numbers)} numbers, {len(times)} times")
    print(
        f"Found: {len(segment_selects)} segment_selects, {len(segment_numbers)} segment_numbers"
    )
    print(f"Found: {len(services)} services")

    ts_content = generate_typescript(
        sensors=sensors,
        switches=switches,
        selects=selects,
        buttons=buttons,
        numbers=numbers,
        times=times,
        services=services,
        segment_selects=segment_selects,
        segment_numbers=segment_numbers,
        version=version,
    )

    # Write output
    output_path = Path(__file__).parent.parent / OUTPUT_FILE
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(ts_content)

    print(f"Generated: {output_path}")


if __name__ == "__main__":
    main()
