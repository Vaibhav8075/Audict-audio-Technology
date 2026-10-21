"""
Create the first admin account on a fresh database.

Registration is admin-only, so a new deployment needs one admin to log in with.
Reads ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD from the environment (or backend/.env)
and does nothing if that email already exists.

    python create_admin.py
"""
import os
import sys
from database.connection import engine, Base, SessionLocal
from models import User, UserRole
from auth_utils import get_password_hash

def main():
    email = os.getenv('ADMIN_EMAIL')
    password = os.getenv('ADMIN_PASSWORD')
    name = os.getenv('ADMIN_NAME', 'Administrator')
    if not email or not password:
        print('Error: set ADMIN_EMAIL and ADMIN_PASSWORD')
        sys.exit(1)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == email).first():
            print(f'Admin {email} already exists, nothing to do')
            return
        db.add(User(email=email, full_name=name, hashed_password=get_password_hash(password), role=UserRole.admin, department='Administration'))
        db.commit()
        print(f'Created admin {email}')
    finally:
        db.close()

if __name__ == '__main__':
    main()
