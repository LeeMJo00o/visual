#!/bin/bash

# 环境管理脚本
# 用法: ./env_manager.sh [环境名] [命令]

ENV_DIR="envs"
DEFAULT_ENV="env_demo"

# 显示帮助信息
show_help() {
    echo "环境管理脚本"
    echo ""
    echo "用法:"
    echo "  $0 [环境名] [命令]"
    echo "  $0 list                    # 列出所有可用环境"
    echo "  $0 show [环境名]           # 显示指定环境的配置"
    echo "  $0 run [环境名]            # 使用指定环境运行应用"
    echo "  $0 validate [环境名]       # 验证环境配置"
    echo ""
    echo "可用环境:"
    echo "  demo    - 演示环境 (本地Redis, fangzhen地图)"
    echo "  taiguo  - 泰国环境 (远程Redis, taiguo地图)"
    echo "  abu     - 阿布扎比本地环境 (本地Redis, Abuzhabi地图)"
    echo "  mex     - 墨西哥本地环境 (本地Redis, Mexico地图)"
    echo ""
    echo "示例:"
    echo "  $0 run demo"
    echo "  $0 show taiguo"
    echo "  $0 validate abu"
}

# 获取环境文件路径
get_env_file() {
    local env_name=$1
    case $env_name in
        "demo")
            echo "env_demo"
            ;;
        "taiguo")
            echo "env_taiguo"
            ;;
        "abu")
            echo "env_abu_local"
            ;;
        "mex")
            echo "env_mex_local"
            ;;
        *)
            echo ""
            ;;
    esac
}

# 列出所有环境
list_envs() {
    echo "可用的环境配置："
    echo "  demo    - 演示环境 (本地Redis, fangzhen地图)"
    echo "  taiguo  - 泰国环境 (远程Redis, taiguo地图)"
    echo "  abu     - 阿布扎比本地环境 (本地Redis, Abuzhabi地图)"
    echo "  mex     - 墨西哥本地环境 (本地Redis, Mexico地图)"
    echo ""
    echo "环境文件位置: $ENV_DIR/"
    ls -la $ENV_DIR/
}

# 显示环境配置
show_env() {
    local env_name=$1
    local env_file=$(get_env_file $env_name)
    
    if [ -z "$env_file" ]; then
        echo "错误: 未知环境 '$env_name'"
        echo "使用 '$0 list' 查看可用环境"
        exit 1
    fi
    
    local env_path="$ENV_DIR/$env_file"
    if [ ! -f "$env_path" ]; then
        echo "错误: 环境文件不存在 '$env_path'"
        exit 1
    fi
    
    echo "环境配置: $env_name"
    echo "文件: $env_path"
    echo "----------------------------------------"
    cat "$env_path"
    echo "----------------------------------------"
}

# 验证环境配置
validate_env() {
    local env_name=$1
    local env_file=$(get_env_file $env_name)
    
    if [ -z "$env_file" ]; then
        echo "错误: 未知环境 '$env_name'"
        exit 1
    fi
    
    local env_path="$ENV_DIR/$env_file"
    if [ ! -f "$env_path" ]; then
        echo "错误: 环境文件不存在 '$env_path'"
        exit 1
    fi
    
    echo "验证环境配置: $env_name"
    echo "检查必需的环境变量..."
    
    # 检查必需的环境变量
    local required_vars=("pp_visual_RUN_PORT" "pp_visual_REDIS_URL" "MAP_NAME" "DEMO_REDIS_URL" "pp_visual_RUN_WORKERS")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$env_path"; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -eq 0 ]; then
        echo "✓ 所有必需的环境变量都已配置"
    else
        echo "✗ 缺少以下环境变量:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    echo "✓ 环境配置验证通过"
}

# 运行应用
run_env() {
    local env_name=$1
    local env_file=$(get_env_file $env_name)
    
    if [ -z "$env_file" ]; then
        echo "错误: 未知环境 '$env_name'"
        echo "使用 '$0 list' 查看可用环境"
        exit 1
    fi
    
    local env_path="$ENV_DIR/$env_file"
    if [ ! -f "$env_path" ]; then
        echo "错误: 环境文件不存在 '$env_path'"
        exit 1
    fi
    
    echo "使用环境 '$env_name' 启动应用..."
    echo "环境文件: $env_path"
    echo "----------------------------------------"
    
    # 验证环境配置
    validate_env "$env_name"
    
    # 运行应用
    dotenv -f "$env_path" run bash run.sh
}

# 主逻辑
case $1 in
    "list")
        list_envs
        ;;
    "show")
        if [ -z "$2" ]; then
            echo "错误: 请指定环境名"
            echo "用法: $0 show [环境名]"
            exit 1
        fi
        show_env "$2"
        ;;
    "validate")
        if [ -z "$2" ]; then
            echo "错误: 请指定环境名"
            echo "用法: $0 validate [环境名]"
            exit 1
        fi
        validate_env "$2"
        ;;
    "run")
        if [ -z "$2" ]; then
            echo "错误: 请指定环境名"
            echo "用法: $0 run [环境名]"
            exit 1
        fi
        run_env "$2"
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        if [ -z "$1" ]; then
            echo "错误: 请指定命令"
            show_help
        else
            echo "错误: 未知命令 '$1'"
            show_help
        fi
        exit 1
        ;;
esac 