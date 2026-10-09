from pathlib import Path
import tarfile

root = Path(__file__).resolve().parents[1]
out = root / 'tmp' / 'sites-release-eb8717e-min.tar.gz'
files = [
    (root / '.openai' / 'hosting.json', '.openai/hosting.json'),
    (root / 'dist' / 'server' / 'index.js', 'dist/server/index.js'),
    (root / 'dist' / 'index.html', 'dist/index.html'),
    (root / 'dist' / '.openai' / 'hosting.json', 'dist/.openai/hosting.json'),
]
with tarfile.open(out, 'w:gz') as archive:
    for source, target in files:
        archive.add(source, arcname=target)
print(out)
print(out.stat().st_size)
