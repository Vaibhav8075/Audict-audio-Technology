import os
import sys
from sqlalchemy import create_engine, text

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_dir)

from dotenv import load_dotenv
load_dotenv()

pg_url = os.getenv('DATABASE_URL')
if not pg_url:
    print("Error: DATABASE_URL not found in environment/.env file")
    sys.exit(1)

if pg_url.startswith('postgresql://'):
    pg_url = pg_url.replace('postgresql://', 'postgresql+psycopg://', 1)

print("Connecting to PostgreSQL database...")
engine = create_engine(pg_url)

tables = [
    'users',
    'audits',
    'recordings',
    'feedback_forms',
    'feedback_questions',
    'feedback_answers',
    'feedback_question_answers',
    'ai_analysis',
    'audit_access_logs',
    'qa_audit_reviews',
    'system_settings'
]

print("Syncing auto-increment sequences in PostgreSQL...")

with engine.connect() as conn:
    for table in tables:
        try:
            # Find the max ID currently in the table
            res = conn.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {table}"))
            max_id = res.scalar()
            
            # Sequence name is typically '{table}_id_seq'
            seq_name = f"{table}_id_seq"
            
            # Check if sequence exists in postgres
            seq_exists = conn.execute(text(
                f"SELECT EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = '{seq_name}')"
            )).scalar()
            
            if seq_exists:
                if max_id > 0:
                    conn.execute(text(f"SELECT setval('{seq_name}', :max_id)"), {"max_id": max_id})
                else:
                    conn.execute(text(f"SELECT setval('{seq_name}', 1, false)"))
                print(f"Successfully reset sequence '{seq_name}' to {max_id or 1}")
            else:
                # Fallback to pg_get_serial_sequence
                conn.execute(text(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(MAX(id), 1)) FROM {table}"
                ))
                print(f"Successfully reset sequence for '{table}' using serial sequence lookup")
            
            conn.commit()
        except Exception as e:
            print(f"Could not reset sequence for table '{table}': {e}")

print("\nDatabase sequence syncing completed successfully!")
