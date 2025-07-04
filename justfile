run:
  dotenv -f envs/env_local run bash run.sh

run-demo:
  dotenv -f envs/env_demo run bash run.sh

run-taiguo:
  dotenv -f envs/env_taiguo run bash run.sh

run-abu:
  dotenv -f envs/env_abu_local run bash run.sh

run-mex:
  dotenv -f envs/env_mex_local run bash run.sh

frontend:
  cd frontend && npm run dev -- --host 0.0.0.0 --port 2033
