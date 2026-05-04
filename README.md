# Priorix - Task Management

Priorix is a beautifully designed, priority-based To-Do web application built entirely from scratch. It features a modern, full-width split-screen login, a responsive flashcard-style task dashboard, and an elegant UI utilizing the 'Outfit' font and vibrant gradients.

![Priorix Logo](static/hero.png)

## Features

- **No External Frameworks**: The backend is built completely on Python's built-in `http.server`, proving you don't need heavy frameworks for a robust web app.
- **SQLite Database**: Lightweight and built-in persistence for Users, Sessions, and Tasks.
- **Authentication**: Custom session-cookie based user registration and login system.
- **Priority Flashcards**: Tasks are displayed dynamically as modern cards, automatically sorted by completion status, priority (High > Medium > Low), and due date.
- **Responsive Design**: Designed to work seamlessly across full laptop screens and mobile devices.
- **Dynamic Frontend**: Vanilla JavaScript handles API requests so you never have to reload the page to see your updates.

## Tech Stack

* **Backend:** Core Python 3
* **Database:** SQLite3
* **Frontend:** HTML5, CSS3, Vanilla JavaScript

## Local Setup

It takes less than a minute to get Priorix running locally.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vinuramyasree456-create/Priorix.git
   cd Priorix
   ```

2. **Run the server:**
   ```bash
   python server.py
   ```
   *(The SQLite database `todo.db` and necessary tables will be created automatically on the first run).*

3. **Open your browser:**
   Navigate to [http://localhost:8000](http://localhost:8000)

## Deployment

This app is deployment-ready for platforms like [Render.com](https://render.com). 

1. Create a new "Web Service" on Render.
2. Connect your GitHub repository.
3. Set the **Build Command** to: `pip install --upgrade pip`
4. Set the **Start Command** to: `python server.py`
5. Deploy! (The `PORT` environment variable is already handled in `server.py`).

## Author
Created by Vinuramyasree456.
