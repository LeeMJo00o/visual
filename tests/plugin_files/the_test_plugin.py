
def initialize(in_service):
    

    class TestService():
        def __init__(self):
            pass

        def func_add_give_str(self, arg1, arg2) -> str:
            return str(arg1 + arg2)

    return TestService()

