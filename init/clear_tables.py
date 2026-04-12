import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="../backend/.env")

conn = mysql.connector.connect(
    host=os.getenv("DB_HOST"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME")
)
cursor = conn.cursor()

# Disable FK checks so we can truncate in any order
cursor.execute("SET FOREIGN_KEY_CHECKS = 0")

tables = [
    "Schedule",
    "Section",
    "Faculty",
    "Courses_Planned",
    "Requirements",
    "Course",
    "Student",
]

for table in tables:
    try:
        cursor.execute(f"TRUNCATE TABLE `{table}`")
        print(f"Truncated: {table}")
    except Exception as e:
        print(f"Error truncating {table}: {e}")

cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
conn.commit()
cursor.close()
conn.close()
print("Done — all tables cleared.")
