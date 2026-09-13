"""Connect to Databricks Postgres and create a table."""

import os
import sys

import psycopg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD")

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS employees (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE,
    salary      NUMERIC(10, 2),
    hired_on    DATE DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
"""


def main() -> None:
    if not DATABASE_URL:
        sys.exit("DATABASE_URL not set in .env")
    if not DATABASE_PASSWORD:
        sys.exit("DATABASE_PASSWORD not set in .env")

    print("Connecting to Databricks Postgres...")
    with psycopg.connect(DATABASE_URL, password=DATABASE_PASSWORD) as conn:
        with conn.cursor() as cur:
            cur.execute(CREATE_TABLE_SQL)
            conn.commit()
            print("Table 'employees' created (or already exists).")

            # Verify
            cur.execute(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'employees';
                """
            )
            row = cur.fetchone()
            print(f"Verified: found table -> {row[0]}")


if __name__ == "__main__":
    main()
