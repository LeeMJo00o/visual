# 本地调试 - 默认使用demo环境
run:
  dotenv -f envs/env_demo run bash run.sh

# 运行不同环境的命令
run-demo:
  dotenv -f envs/env_demo run bash run.sh

run-taiguo:
  dotenv -f envs/env_taiguo run bash run.sh

run-abu:
  dotenv -f envs/env_abu_local run bash run.sh

run-mex:
  dotenv -f envs/env_mex_local run bash run.sh

# 列出所有可用环境
list-envs:
  @echo "可用的环境配置："
  @echo "  just run-demo    - 演示环境 (本地Redis, fangzhen地图)"
  @echo "  just run-taiguo  - 泰国环境 (远程Redis, taiguo地图)"
  @echo "  just run-abu     - 阿布扎比本地环境 (本地Redis, Abuzhabi地图)"
  @echo "  just run-mex     - 墨西哥本地环境 (本地Redis, Mexico地图)"

# 显示当前环境配置
show-env:
  @echo "当前环境配置："
  @cat envs/env_demo

# 这是一行注释
another-recipe:
  @echo 'This is another recipe.'
