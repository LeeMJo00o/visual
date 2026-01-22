# pp-visual


## 开发指南

项目前端在 `frontend` 目录

### 运行

编写自己的环境变量文件，比如 `~/env_local`：

```
DEBUG=true
pp_visual_RUN_PORT=8080
```

应用你的环境变量，运行 `run.sh`，比如在控制台中，你可以这样应用自己的环境变量：

env $(cat ~/env_local | xargs) ./run.sh

其他的工具、编辑器或 IDE 参考相应的文档。

### Docker Compose 运行

1. 使用 `.env` 配置运行参数（仓库已提供默认示例，可按需修改）。
2. 启动服务：

```
docker compose --env-file .env up -d
```

#### 常见问题

如果使用 `docker-compose`（v1）时遇到类似 `KeyError: 'ContainerConfig'` 的报错，通常是旧版 `docker-compose` 与新版本 Docker 引擎不兼容导致的。建议改用 Docker 官方的 `docker compose`（v2 插件）或升级 `docker-compose` 版本后重试。

### 测试

项目使用 pytest 测试。

首先安装测试所需要的依赖：

```
pip install -r requirements_dev.txt
```

运行 pytest：

```
python3 -m pytest
```

控制台中同样可以用下面的方式来应用你自己的环境变量：

```
env $(cat ~/env_local | xargs) python3 -m pytest
```

### 构建镜像

提供了脚本 `build_image.sh` 用来构建镜像，用法：

```
build_image.sh -t <tag> --no-push
```
其中 -t <tag> 为可选，用来指定构建镜像的 tag ，不使用 -t 时默认使用时间做 tag , 格式：`%Y-%m-%d-%H-%M-%S`（ "2024-10-28-14-38-32" )

--no-push 也是可选，不指定时运行 git push 推送至远程，指定时仅在本地构建。

**关于基础镜像**：为了加快构建速度，build_image.sh 使用了包含依赖的基础镜像，构建时仅复制代码即可。构建基础镜像使用 tools 下的 build_base.sh 脚本：

```
bash tools/build_base.sh -t <tag>
```

注意同样使用可选的 `-t` 指定基础镜像的 tag， 否则使用时间做 tag。

然后更新项目根目录的 `Dockerfile` 的 `FROM` 语句。

### 数据库迁移
chain-boot 已经生成了可用的 alembic 配置文件，如果你不管理迁移历史，直接使用 chain-boot 生成的脚本 "migrations.sh" ：

```
bash migrations.sh
```

这个脚本会重置迁移信息，根据当前模型和数据库生成全新的迁移，并应用。

如果正常管理了 alembic 迁移历史，使用常规的：

```
alembic stamp head
alembic revision --autogenerate
alembic upgrade head
```
即可。

### 提交

#### 代码格式

大体上，本项目使用 `PEP8` 风格，不过格式化脚本放宽了对单行最大长度的限制(最大允许 240)。

各种 IDE 及编辑器都具有自动格式化为 `PEP8` 的功能，所以大概率你并不需要额外做什么，如果你并没有在意过格式，也可以使用根目录下的格式化脚本 `format_code.sh` 来递归格式化所有代码：

```
bash format_code.sh --change=true
```
 
不过建议你首先运行
```
bash format_code.sh
```
