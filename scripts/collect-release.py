"""Collect only release artifacts from successful CI jobs; never overwrite duplicates."""
from pathlib import Path
import hashlib, json, os, shutil

root=Path.cwd(); destination=root/'publish-ready'; destination.mkdir(exist_ok=True)
selected=[]
for source in sorted((root/'published').rglob('*')):
    if not source.is_file(): continue
    if source.suffix not in ('.tgz','.whl','.json') and not source.name.endswith('.tar.gz'): continue
    target=destination/source.name
    if target.exists(): raise RuntimeError('Duplicate release artifact name')
    shutil.copyfile(source,target)
    selected.append({'name':target.name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
required={'enigmagent-mcp-3.0.0.tgz','enigmagent-cli-3.0.0.tgz','enigmagent-core-3.0.0.tgz',
          'enigmagent-vault-3.0.0.tgz','enigmagent-3.0.0-py3-none-any.whl','enigmagent-3.0.0.tar.gz',
          'enigmagent-3.0.0-image.tar.gz','integration-runtime-evidence.json','container-runtime-evidence.json'}
if not required.issubset({item['name'] for item in selected}): raise RuntimeError('A required tested artifact is missing')
(destination/'SHA256SUMS.txt').write_text(''.join(f"{item['sha256']}  {item['name']}\n" for item in selected),encoding='utf-8')
(destination/'RELEASE_MANIFEST.json').write_text(json.dumps({'version':'3.0.0','source_commit':os.environ['GITHUB_SHA'],
 'tag':os.environ['GITHUB_REF_NAME'],'artifacts':selected,'registry_publication':False},indent=2)+'\n',encoding='utf-8')
print('Prepared',len(selected),'tested artifacts with checksums')
