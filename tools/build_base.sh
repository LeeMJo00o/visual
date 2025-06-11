#!/bin/bash

set -e

project=pp-interface-base

# 默认情况下推送镜像
push=1
tag=""

# 解析命令行选项
while getopts "t:-:" opt; do
  case "$opt" in
    t)
      tag=$OPTARG
      ;;
    -)
      case "${OPTARG}" in
        no-push)
          push=0
          ;;
        *)
          echo "Usage: $0 [-t tag] [--no-push]"
          exit 1
          ;;
      esac
      ;;
    *)
      echo "Usage: $0 [-t tag] [--no-push]"
      exit 1
      ;;
  esac
done

# 获取当前时间
now=`date -d today +"%Y-%m-%d-%H-%M-%S"`

# 如果没有指定 tag，使用时间戳作为默认值
if [ -z "$tag" ]; then
  tag=$now
fi

# 构建 Docker 镜像
img=uhub.service.ucloud.cn/westwell_devops/chain_boot/$project:$tag
docker build --network=host -f tools/Dockerfile-base -t $img .

# 根据 push 变量决定是否推送镜像
if [ $push -eq 0 ]; then
  echo -e "\e[32m--------- build and not push ----------\e[0m"
else
  echo -e "\e[32m--------- build and push ----------\e[0m"
  docker push $img
fi

# 打印并记录构建信息
rs="build image for $project ok: \n\e[32m$img\e[0m\n"
echo -e "$rs"
