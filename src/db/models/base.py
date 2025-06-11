from sqlalchemy import Column, Sequence, Integer
from chain_orm.base_model import ChainBaseModel


def auto_increase_column(db_manager, primary_key=True):
    # oracle not support auto increase, so use Sequence
    if db_manager.engine.dialect.name == "oracle":
        id_seq = Sequence('id_seq')
        return Column(Integer, id_seq, server_default=id_seq.next_value(), primary_key=primary_key)
    else:
        return Column(Integer, primary_key=primary_key)


class BaseModel(ChainBaseModel):
    pass
