from .protos.hello_pb2 import HelloRequest, HelloResponse
from .protos.hello_pb2_grpc import BridgeServiceServicer, add_BridgeServiceServicer_to_server


class HelloServicer(BridgeServiceServicer):
    async def sendRequest(self, request, context):
        print(f"get hello request: {request}")
        return HelloResponse(success=1, message="ok")
