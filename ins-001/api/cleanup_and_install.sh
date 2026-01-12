#!/bin/bash
# Clean up conflicting supabase packages and reinstall

echo "Cleaning up conflicting packages..."
pip uninstall -y supabase supabase-auth supabase-functions gotrue postgrest storage3 realtime supafunc

echo "Installing requirements..."
pip install -r requirements.txt

echo "Done! Try running: python3 scripts/embed_vocabulary.py"
