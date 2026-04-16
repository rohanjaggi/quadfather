import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. "
        "Get it from Supabase → Settings → Database → Connection string (URI format). "
        "It looks like: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
    )

if DATABASE_URL.startswith("https://"):
    raise RuntimeError(
        "DATABASE_URL looks like a Supabase project URL (https://...), not a PostgreSQL connection string. "
        "Go to Supabase → Settings → Database → Connection string (URI format) to get the correct URL."
    )

# Supabase/Render provide postgres:// but SQLAlchemy 1.4+ requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
