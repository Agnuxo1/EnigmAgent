"""Run project tests in a temporary home with no inherited service credentials."""
from pathlib import Path
import os, subprocess, tempfile
root=Path(__file__).resolve().parent.parent
import sys
python=Path(os.environ.get('ENIGMAGENT_TEST_PYTHON', str(root/'.venv-integrations/Scripts/python.exe' if os.name == 'nt' and (root/'.venv-integrations/Scripts/python.exe').exists() else Path(sys.executable))))
with tempfile.TemporaryDirectory(prefix='enigmagent-test-home-') as home:
    roaming=Path(home)/'AppData'/'Roaming'; local=Path(home)/'AppData'/'Local'
    roaming.mkdir(parents=True); local.mkdir(parents=True)
    env={key:os.environ[key] for key in ('PATH','SystemRoot','WINDIR','COMSPEC','PATHEXT') if key in os.environ}
    env.update({'HOME':home,'USERPROFILE':home,'TEMP':home,'TMP':home,'APPDATA':str(roaming),'LOCALAPPDATA':str(local),
      'PYTHONPATH':str(root/'platforms/python-sdk'),'PYTEST_DISABLE_PLUGIN_AUTOLOAD':'1',
      'CREWAI_TELEMETRY_DISABLED':'true','CREWAI_TRACING_ENABLED':'false','OTEL_SDK_DISABLED':'true',
      'HAYSTACK_TELEMETRY_ENABLED':'False','DO_NOT_TRACK':'1','AGNO_TELEMETRY':'false',
      'HF_HUB_OFFLINE':'1','LANGCHAIN_TRACING_V2':'false','LANGSMITH_TRACING':'false',
      'PYTHONIOENCODING':'utf-8','ENIGMAGENT_TEST_EVIDENCE':str(root/'audit/integration-runtime-evidence.json')})
    import sys
    command=[str(python),'-m','pytest',*sys.argv[1:]]
    completed=subprocess.run(command,cwd=root/'platforms/python-sdk',env=env)
    raise SystemExit(completed.returncode)
