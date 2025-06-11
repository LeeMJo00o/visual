
import asyncio
from src.db.connect import db_conn_manager
from sqlalchemy.sql import text as sa_text
from asyncpg.exceptions import UndefinedTableError

import traceback


async def rm_alembic_version():
    async with db_conn_manager.sessionmaker() as session:
        try:
            await session.execute(sa_text('''TRUNCATE TABLE alembic_version'''))
            await session.commit()
        except Exception as ex:
            print(f"warning: del version info has error {ex}")

if __name__ == "__main__":
    asyncio.run(rm_alembic_version())
