from typing import Any

from pydantic import ValidationError


def schema_checker(schema_model: Any, message: dict, *,
                   return_exceptions: bool = False) -> object | ValidationError | None:
    """自定义消息验证"""
    try:
        return schema_model(**message)
    except ValidationError as exc:
        if return_exceptions:
            raise exc.errors()
