"""Check the release allowlist and installer-safe entry types."""
import json
from pathlib import Path, PurePosixPath
import tarfile

manifest = json.loads(Path("plugin.json").read_text())
required = {
    "plugin.json", "package.json", "LICENSE", "CREDITS.md", "README.md",
    "THIRD-PARTY-NOTICES.txt", "mcp/dist/server.js", "ui/dist/index.html",
    "skills/vigilia/agendar/SKILL.md",
}
directories = {str(parent) for name in required for parent in PurePosixPath(name).parents} - {"."}
artifact = f"dist/{manifest['name']}-{manifest['version']}.tgz"
with tarfile.open(artifact, "r:gz") as archive:
    seen = set()
    for entry in archive:
        name = entry.name
        if name in seen or not ((entry.isfile() and name in required) or
                                (entry.isdir() and name in directories)):
            raise ValueError(f"Unexpected archive member: {name}")
        seen.add(name)
    if required - seen or archive.extractfile("plugin.json").read() != Path("plugin.json").read_bytes():
        raise ValueError("Incomplete release or mismatched manifest")
print(f"Archive: {len(required)} required files; no links, unsafe paths or extra files")
