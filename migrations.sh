#!/bin/bash

python3 -m src.db.alembic.reset_version

rm -rf ./src/db/alembic/versions/*

alembic stamp head
alembic revision --autogenerate
alembic upgrade head
