import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_dir)

from models import Base, User, Audit, Recording, FeedbackForm, FeedbackQuestion, FeedbackAnswer, FeedbackQuestionAnswer, AIAnalysis, AuditAccessLog, QAAuditReview, SystemSetting

# SQLite Engine (source)
sqlite_path = os.path.join(backend_dir, 'dcm_audit.db')
if not os.path.exists(sqlite_path):
    print(f"Error: Source SQLite database not found at {sqlite_path}")
    sys.exit(1)

print(f"Connecting to source SQLite database at {sqlite_path}...")
sqlite_engine = create_engine(f"sqlite:///{sqlite_path}")
SqliteSession = sessionmaker(bind=sqlite_engine)
src_db = SqliteSession()

# PostgreSQL Engine (destination)
from dotenv import load_dotenv
load_dotenv()
pg_url = os.getenv('DATABASE_URL')
if not pg_url:
    print("Error: DATABASE_URL not found in environment/.env file")
    sys.exit(1)

if pg_url.startswith('postgresql://'):
    pg_url = pg_url.replace('postgresql://', 'postgresql+psycopg://', 1)

print(f"Connecting to target PostgreSQL database...")
pg_engine = create_engine(pg_url)
PgSession = sessionmaker(bind=pg_engine)
dest_db = PgSession()

# Make sure tables are created in PostgreSQL
print("Creating tables in PostgreSQL if not exist...")
Base.metadata.create_all(bind=pg_engine)

# List of models to copy in order of dependency
models_to_copy = [
    User,
    Audit,
    Recording,
    FeedbackForm,
    FeedbackQuestion,
    FeedbackAnswer,
    FeedbackQuestionAnswer,
    AIAnalysis,
    AuditAccessLog,
    QAAuditReview,
    SystemSetting
]

try:
    for model in models_to_copy:
        table_name = model.__tablename__
        print(f"Migrating table '{table_name}'...")
        
        # Clear existing data in target table
        dest_db.query(model).delete()
        dest_db.commit()
        
        # Fetch all from SQLite
        items = src_db.query(model).all()
        if not items:
            print(f"Table '{table_name}' is empty.")
            continue
            
        print(f"Found {len(items)} items in '{table_name}'. Copying...")
        
        # Add items to PG session
        for item in items:
            # Create a new instance with same attributes to avoid session attachment conflicts
            attrs = {c.name: getattr(item, c.name) for c in model.__table__.columns}
            new_item = model(**attrs)
            dest_db.add(new_item)
            
        dest_db.commit()
        print(f"Successfully migrated {len(items)} items to '{table_name}'.")

    print("\nMigration completed successfully!")

except Exception as e:
    dest_db.rollback()
    print(f"\nMigration failed: {e}")
    sys.exit(1)
finally:
    src_db.close()
    dest_db.close()
