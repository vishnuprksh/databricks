"""Test non-expiring username/password credentials against Databricks Postgres."""
import os
import sys

import psycopg

PGUSER = os.getenv("PGUSER", "vishnuprksh")
PGPASSWORD = os.getenv("PGPASSWORD", "npg_voB7ELagRu8m")
HOST = "ep-quiet-wind-d8p01eiy.database.us-east-2.cloud.databricks.com"
DB = "databricks_postgres"

try:
    conn = psycopg.connect(
        host=HOST,
        dbname=DB,
        user=PGUSER,
        password=PGPASSWORD,
        sslmode="require",
        connect_timeout=15,
    )
    cur = conn.cursor()
    cur.execute("SELECT current_user, version()")
    print("Connected as:", cur.fetchone())
    cur.execute("SELECT count(*) FROM fpl.predictions")
    print("fpl.predictions rows:", cur.fetchone()[0])
    cur.execute("SELECT count(*) FROM fpl.players")
    print("fpl.players rows:", cur.fetchone()[0])
    conn.close()
    print("SUCCESS: credentials work and do not expire.")
except Exception as exc:
    print(f"FAILED: {exc}")
    sys.exit(1)
