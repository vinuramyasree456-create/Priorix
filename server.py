import http.server
import socketserver
import json
import sqlite3
import os
import urllib.parse
import uuid
from http import cookies

PORT = int(os.environ.get("PORT", 8000))
DB_NAME = "todo.db"

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

class TodoHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    
    def do_GET(self):
        # Serve static files
        if self.path.startswith('/static/'):
            return super().do_GET()
        
        # Handle API routes
        if self.path.startswith('/api/'):
            return self.handle_api_get()
        
        # Routing for HTML pages
        if self.path == '/login':
            self.path = '/static/login.html'
            return super().do_GET()
        elif self.path == '/' or self.path == '/index.html':
            # Check if logged in, if not redirect to login
            user_id = self.get_current_user_id()
            if not user_id:
                self.send_response(302)
                self.send_header('Location', '/login')
                self.end_headers()
                return
            self.path = '/static/index.html'
            return super().do_GET()
        
        # Default fallback
        self.send_error(404, "Not Found")

    def do_POST(self):
        if self.path.startswith('/api/'):
            return self.handle_api_post()
        self.send_error(404, "Not Found")

    def do_PUT(self):
        if self.path.startswith('/api/'):
            return self.handle_api_put()
        self.send_error(404, "Not Found")
        
    def do_DELETE(self):
        if self.path.startswith('/api/'):
            return self.handle_api_delete()
        self.send_error(404, "Not Found")

    # --- API Handlers ---
    
    def handle_api_get(self):
        if self.path == '/api/tasks':
            user_id = self.get_current_user_id()
            if not user_id:
                return self.send_json_error("Unauthorized", 401)
                
            conn = get_db()
            cursor = conn.cursor()
            # Sort by completed, then priority (High > Medium > Low), then due date
            cursor.execute("""
                SELECT * FROM tasks 
                WHERE user_id = ? 
                ORDER BY completed ASC, 
                         CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 END, 
                         due_date ASC
            """, (user_id,))
            tasks = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return self.send_json_response(tasks)
            
        self.send_error(404, "Not Found")

    def handle_api_post(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length > 0 else b""
        
        try:
            data = json.loads(body.decode('utf-8'))
        except json.JSONDecodeError:
            data = {}

        if self.path == '/api/register':
            username = data.get('username')
            password = data.get('password')
            if not username or not password:
                return self.send_json_error("Username and password required", 400)
                
            conn = get_db()
            cursor = conn.cursor()
            try:
                # In a real app, hash the password using bcrypt. 
                # For this simple project, we store as plain text or simple hash.
                import hashlib
                pw_hash = hashlib.sha256(password.encode()).hexdigest()
                cursor.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, pw_hash))
                conn.commit()
                return self.send_json_response({"message": "User registered successfully"})
            except sqlite3.IntegrityError:
                return self.send_json_error("Username already exists", 400)
            finally:
                conn.close()

        elif self.path == '/api/login':
            username = data.get('username')
            password = data.get('password')
            
            import hashlib
            pw_hash = hashlib.sha256(password.encode()).hexdigest()
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE username = ? AND password_hash = ?", (username, pw_hash))
            user = cursor.fetchone()
            
            if user:
                session_token = str(uuid.uuid4())
                cursor.execute("INSERT INTO sessions (session_token, user_id) VALUES (?, ?)", (session_token, user['id']))
                conn.commit()
                
                # Set cookie
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Set-Cookie', f'session_token={session_token}; HttpOnly; Path=/')
                self.end_headers()
                self.wfile.write(json.dumps({"message": "Login successful"}).encode('utf-8'))
            else:
                self.send_json_error("Invalid username or password", 401)
            conn.close()
            return
            
        elif self.path == '/api/logout':
            # Delete session from DB
            token = self.get_session_token()
            if token:
                conn = get_db()
                conn.execute("DELETE FROM sessions WHERE session_token = ?", (token,))
                conn.commit()
                conn.close()
                
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Set-Cookie', 'session_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/')
            self.end_headers()
            self.wfile.write(json.dumps({"message": "Logout successful"}).encode('utf-8'))
            return

        elif self.path == '/api/tasks':
            user_id = self.get_current_user_id()
            if not user_id:
                return self.send_json_error("Unauthorized", 401)
                
            title = data.get('title')
            description = data.get('description', '')
            priority = data.get('priority', 'Low')
            due_date = data.get('due_date', '')
            
            if not title:
                return self.send_json_error("Title is required", 400)
                
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO tasks (user_id, title, description, priority, due_date) VALUES (?, ?, ?, ?, ?)",
                (user_id, title, description, priority, due_date)
            )
            conn.commit()
            task_id = cursor.lastrowid
            conn.close()
            return self.send_json_response({"message": "Task created", "id": task_id})

        self.send_error(404, "Not Found")

    def handle_api_put(self):
        user_id = self.get_current_user_id()
        if not user_id:
            return self.send_json_error("Unauthorized", 401)

        if self.path.startswith('/api/tasks/'):
            try:
                task_id = int(self.path.split('/')[-1])
            except ValueError:
                return self.send_json_error("Invalid task ID", 400)

            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length) if length > 0 else b""
            data = json.loads(body.decode('utf-8'))

            conn = get_db()
            cursor = conn.cursor()
            
            # Check ownership
            cursor.execute("SELECT id FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
            if not cursor.fetchone():
                conn.close()
                return self.send_json_error("Task not found or unauthorized", 404)

            # Update fields
            fields = []
            values = []
            for key in ['title', 'description', 'priority', 'due_date', 'completed']:
                if key in data:
                    fields.append(f"{key} = ?")
                    values.append(data[key])
            
            if fields:
                values.append(task_id)
                cursor.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", values)
                conn.commit()
                
            conn.close()
            return self.send_json_response({"message": "Task updated"})

        self.send_error(404, "Not Found")

    def handle_api_delete(self):
        user_id = self.get_current_user_id()
        if not user_id:
            return self.send_json_error("Unauthorized", 401)

        if self.path.startswith('/api/tasks/'):
            try:
                task_id = int(self.path.split('/')[-1])
            except ValueError:
                return self.send_json_error("Invalid task ID", 400)

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
            changes = conn.total_changes
            conn.commit()
            conn.close()
            
            if changes > 0:
                return self.send_json_response({"message": "Task deleted"})
            else:
                return self.send_json_error("Task not found or unauthorized", 404)

        self.send_error(404, "Not Found")

    # --- Utility Methods ---

    def get_session_token(self):
        cookie_header = self.headers.get('Cookie')
        if not cookie_header:
            return None
            
        cookie = cookies.SimpleCookie(cookie_header)
        if 'session_token' in cookie:
            return cookie['session_token'].value
        return None

    def get_current_user_id(self):
        token = self.get_session_token()
        if not token:
            return None
            
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM sessions WHERE session_token = ?", (token,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return row['user_id']
        return None

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
        
    def send_json_error(self, message, status):
        self.send_json_response({"error": message}, status)


if __name__ == "__main__":
    if not os.path.exists(DB_NAME):
        import database
        database.init_db()
        
    with socketserver.TCPServer(("", PORT), TodoHTTPRequestHandler) as httpd:
        print(f"Server starting at port {PORT}")
        print(f"Visit http://localhost:{PORT}")
        httpd.serve_forever()
