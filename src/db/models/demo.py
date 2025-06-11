from sqlalchemy import Column, DateTime, Integer, String, func
from src.db.connect import db_conn_manager
from src.db.models.base import BaseModel, auto_increase_column


class DemoTable(db_conn_manager.Base, BaseModel):
    __tablename__ = "__ww_demo_table__"
    id = auto_increase_column(db_conn_manager)
    name = Column(String(256), comment="the name")
    age = Column(Integer, comment="the age")
    create_on = Column(DateTime(timezone=True), server_default=func.now())
    update_on = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.current_timestamp())

    def __str__(self):
        return self.__repr__()
