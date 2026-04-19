# PyPI Publication Guide — enigmagent

## Package name
`enigmagent`

## Pre-publish checklist

```bash
cd platforms/python-sdk

# 1. Install build tools
pip install build twine

# 2. Build distributions
python -m build
# → creates dist/enigmagent-1.0.0.tar.gz and dist/enigmagent-1.0.0-py3-none-any.whl

# 3. Check distributions
twine check dist/*

# 4. Test upload (TestPyPI first)
twine upload --repository testpypi dist/*
pip install --index-url https://test.pypi.org/simple/ enigmagent

# 5. Production upload
twine upload dist/*
```

## PyPI classifiers (already in pyproject.toml)
- Programming Language :: Python :: 3
- Topic :: Security
- Topic :: Scientific/Engineering :: Artificial Intelligence
- Development Status :: 5 - Production/Stable

## Post-publish
```bash
# Verify installation
pip install enigmagent
python -c "import enigmagent; print(enigmagent.__version__)"

# Verify extras
pip install enigmagent[langchain]
pip install enigmagent[crewai]
pip install enigmagent[all]
```

## PyPI README badge block
```markdown
[![PyPI](https://img.shields.io/pypi/v/enigmagent)](https://pypi.org/project/enigmagent/)
[![Python](https://img.shields.io/pypi/pyversions/enigmagent)](https://pypi.org/project/enigmagent/)
[![Downloads](https://img.shields.io/pypi/dm/enigmagent)](https://pypi.org/project/enigmagent/)
```
