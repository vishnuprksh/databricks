import os, psycopg
from dotenv import load_dotenv
load_dotenv("/workspaces/databricks/.env")
conn = psycopg.connect(os.getenv("DATABASE_URL"), password=os.getenv("DATABASE_PASSWORD"))
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='fpl' ORDER BY 1")
tables = [r[0] for r in cur.fetchall()]
print("TABLES:", tables)
for t in tables:
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='fpl' AND table_name=%s ORDER BY ordinal_position", (t,))
    print(f"\n-- {t}")
    for c, d in cur.fetchall():
        print(f"   {c} {d}")
    cur.execute(f'SELECT * FROM fpl."{t}" LIMIT 2')
    cols = [d[0] for d in cur.description]
    print("   SAMPLE:", dict(zip(cols, cur.fetchone() or [])))
conn.close()
