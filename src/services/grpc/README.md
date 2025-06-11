代码生成：

在项目根目录下执行：

```py

python3 -m grpc_tools.protoc -I . --python_out=. --grpc_python_out=. src/services/grpc/protos/*.proto

```
