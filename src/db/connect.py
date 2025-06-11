from chain_orm.connection import DBConnectionManager
from src.core.config import pp_visual_DB_URL


db_conn_manager = DBConnectionManager(pp_visual_DB_URL)
