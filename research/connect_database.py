"""Check connectivity to a PostgreSQL-compatible database."""

import argparse
import os
import sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg


def redact_url(database_url: str) -> str:
    """Return a connection URL with credentials and sensitive query values hidden."""
    parts = urlsplit(database_url)
    hostname = parts.hostname or ""
    host = hostname
    if parts.port:
        host = f"{hostname}:{parts.port}"
    if parts.username:
        host = f"{parts.username}:***@{host}"

    query = parse_qsl(parts.query, keep_blank_values=True)
    redacted_query = [
        (key, "***" if key.lower() in {"password", "passfile", "sslkey"} else value)
        for key, value in query
    ]
    return urlunsplit((parts.scheme, host, parts.path, urlencode(redacted_query), ""))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "database_url",
        nargs="?",
        default=os.getenv("DATABASE_URL"),
        help="PostgreSQL URL; defaults to DATABASE_URL",
    )
    parser.add_argument(
        "--schema",
        default=None,
        help="Only inspect this schema, such as fpl",
    )
    args = parser.parse_args()

    if not args.database_url:
        parser.error("provide a database URL or set DATABASE_URL")

    database_url = args.database_url
    if "sslmode=" not in database_url:
        separator = "&" if "?" in database_url else "?"
        database_url = f"{database_url}{separator}sslmode=require"

    try:
        with psycopg.connect(database_url, connect_timeout=15) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_user, current_database(), version()")
                current_user, database_name, version = cursor.fetchone()

                cursor.execute(
                    """
                    SELECT schema_name
                    FROM information_schema.schemata
                    WHERE schema_name NOT LIKE 'pg_%'
                      AND schema_name <> 'information_schema'
                    ORDER BY schema_name
                    """
                )
                schemas = [row[0] for row in cursor.fetchall()]

                table_query = """
                    SELECT table_schema, table_name, table_type
                    FROM information_schema.tables
                    WHERE table_schema NOT LIKE 'pg_%%'
                      AND table_schema <> 'information_schema'
                """
                table_params = []
                if args.schema:
                    table_query += " AND table_schema = %s"
                    table_params.append(args.schema)
                table_query += " ORDER BY table_schema, table_name LIMIT 50"
                cursor.execute(table_query, table_params)
                tables = cursor.fetchall()

        print(f"Connected successfully to {redact_url(database_url)}")
        print(f"User: {current_user}")
        print(f"Database: {database_name}")
        print(f"Server: {version.split(',')[0]}")
        print(f"Schemas ({len(schemas)}): {', '.join(schemas) or '(none visible)'}")
        if args.schema:
            visibility = "visible" if args.schema in schemas else "not visible"
            print(f"Schema '{args.schema}': {visibility}")
        print(f"Tables (showing up to 50, found {len(tables)}):")
        for schema_name, table_name, table_type in tables:
            print(f"  {schema_name}.{table_name} [{table_type.lower()}]")
        return 0
    except Exception as exc:
        print(
            f"Connection failed for {redact_url(database_url)}: "
            f"{type(exc).__name__}: {exc}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())