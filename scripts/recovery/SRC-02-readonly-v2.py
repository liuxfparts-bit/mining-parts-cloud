#!/usr/bin/env python3
"""SRC-02 read-only collection. No database connections or file writes."""
import os, stat, json, hashlib, subprocess
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path('/home/ubuntu/kpy-entry-home-20261029-085011')
TOP = {'src', 'public', 'prisma', 'scripts', '.github'}
SKIP = {'.git', '.next', 'node_modules', '__pycache__', 'uploads', 'upload',
        'data', 'logs', 'backups', '.ssh', '.aws', '.secrets', 'secrets'}
FILES = {'package.json', 'package-lock.json', 'Dockerfile', '.dockerignore',
         '.gitignore', 'docker-compose.yml', 'docker-compose.yaml',
         'docker-compose.staging.yml', 'compose.yml', 'compose.yaml',
         'next.config.js', 'next.config.mjs', 'next.config.ts', 'next-env.d.ts',
         'tsconfig.json', 'tailwind.config.js', 'tailwind.config.ts',
         'postcss.config.js', 'postcss.config.mjs', 'components.json'}
count = 0
skipped = 0

def emit(x):
    print(json.dumps(x, ensure_ascii=True, sort_keys=True), flush=True)

def secret(n):
    n = n.lower()
    return (n == '.env' or n.startswith('.env.') or n in {'.npmrc', '.pypirc'}
            or n.startswith(('id_rsa', 'id_ed25519'))
            or Path(n).suffix in {'.pem', '.key', '.p12', '.pfx', '.jks', '.keystore'})

def walk(path, rel=''):
    global count, skipped
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_NOATIME)
    try:
        names = sorted(os.listdir(fd))
    finally:
        os.close(fd)
    for name in names:
        p = path / name
        r = f'{rel}/{name}' if rel else name
        s = os.lstat(p)
        if stat.S_ISLNK(s.st_mode):
            emit({'type': 'SKIP', 'path': r, 'reason': 'SYMLINK'})
            skipped += 1
        elif stat.S_ISDIR(s.st_mode):
            if name.lower() in SKIP or (not rel and name not in TOP):
                skipped += 1
            else:
                walk(p, r)
        elif not stat.S_ISREG(s.st_mode) or secret(name) or (not rel and name not in FILES):
            skipped += 1
        else:
            fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_NOATIME)
            try:
                before = os.fstat(fd)
                if not stat.S_ISREG(before.st_mode):
                    raise RuntimeError('NOT_REGULAR_FILE')
                h = hashlib.sha256()
                while True:
                    b = os.read(fd, 1048576)
                    if not b:
                        break
                    h.update(b)
                after = os.fstat(fd)
                if (before.st_size, before.st_mtime_ns, before.st_ctime_ns) != (after.st_size, after.st_mtime_ns, after.st_ctime_ns):
                    raise RuntimeError('FILE_CHANGED_DURING_READ')
            finally:
                os.close(fd)
            emit({'type': 'FILE', 'path': r, 'size': before.st_size, 'sha256': h.hexdigest()})
            count += 1

def main():
    if not hasattr(os, 'O_NOATIME'):
        raise RuntimeError('NOATIME_UNAVAILABLE')
    if ROOT.resolve(strict=True) != ROOT or not ROOT.is_dir():
        raise RuntimeError('ROOT_INVALID_OR_SYMLINK')
    emit({'type': 'BEGIN', 'task': 'SRC-02', 'script_version': 'v2',
          'utc_time': datetime.now(timezone.utc).isoformat(), 'root': str(ROOT),
          'candidate_commit': 'b3fee86fab79eecf21ec1ac33ddba2f5247a263b',
          'scope': 'ALLOWLISTED_FILES_ONLY'})
    fmt = ('{"container_id":{{json .Id}},"name":{{json .Name}},'
           '"image_tag":{{json .Config.Image}},"image_id":{{json .Image}},'
           '"status":{{json .State.Status}},"workdir":{{json .Config.WorkingDir}}}')
    result = subprocess.run(['docker', 'inspect', '--type', 'container', '--format',
                             fmt, 'mining-parts-app'], capture_output=True,
                            text=True, timeout=15)
    if result.returncode:
        raise RuntimeError('CONTAINER_METADATA_FAILED')
    obj = json.loads(result.stdout)
    emit({'type': 'CONTAINER', **obj})
    if (obj.get('name') != '/mining-parts-app' or obj.get('status') != 'running'
        or obj.get('image_tag') != 'mining-parts-cloud:entry-home-20261029-085011'
        or obj.get('image_id') != 'sha256:0b4845c002fb381352657466dc3ee9d4ba4611f636aa8ad5beeb3302f9e6a8d6'):
        raise RuntimeError('PRODUCTION_IDENTITY_CHANGED')
    walk(ROOT)
    emit({'type': 'COMPLETE', 'task': 'SRC-02', 'files': count,
          'skipped_entries': skipped, 'scope': 'ALLOWLISTED_FILES_ONLY',
          'database_access': False, 'production_changes': False})

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        emit({'type': 'FAILED', 'task': 'SRC-02', 'error_type': type(e).__name__,
              'reason': str(e) if isinstance(e, RuntimeError) else 'READ_OR_METADATA_ERROR',
              'partial_output_not_complete': True})
        raise SystemExit(1)
