// static/app.js
document.addEventListener('DOMContentLoaded', fetchTasks);

let allTasks = [];

// Form submission handler
document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-desc').value;
    const priority = document.getElementById('task-priority').value;
    const due_date = document.getElementById('task-due').value;

    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/api/tasks/${id}` : '/api/tasks';

    try {
        const res = await fetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, priority, due_date })
        });
        
        if (res.ok) {
            toggleTaskForm(); // Hide form
            document.getElementById('task-form').reset();
            document.getElementById('task-id').value = '';
            fetchTasks(); // Refresh list
        } else if (res.status === 401) {
            window.location.href = '/login';
        } else {
            alert('Failed to save task');
        }
    } catch (err) {
        console.error('Error saving task', err);
    }
});

function toggleTaskForm(task = null) {
    const container = document.getElementById('task-form-container');
    container.classList.toggle('active');
    
    if (container.classList.contains('active')) {
        if (task) {
            document.getElementById('form-title').textContent = 'Edit Task';
            document.getElementById('task-id').value = task.id;
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-desc').value = task.description || '';
            document.getElementById('task-priority').value = task.priority;
            document.getElementById('task-due').value = task.due_date || '';
        } else {
            document.getElementById('form-title').textContent = 'Add New Task';
            document.getElementById('task-form').reset();
            document.getElementById('task-id').value = '';
        }
    }
}

async function fetchTasks() {
    try {
        const res = await fetch('/api/tasks');
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const tasks = await res.json();
        allTasks = tasks;
        renderTasks(tasks);
        updateProgress(tasks);
        checkUpcomingTasks(tasks);
    } catch (err) {
        console.error('Error fetching tasks', err);
        document.getElementById('task-list').innerHTML = '<p style="text-align:center; color:red;">Failed to load tasks.</p>';
    }
}

function renderTasks(tasks) {
    const list = document.getElementById('task-list');
    list.innerHTML = '';
    
    if (tasks.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:2rem;">No tasks yet. Create one above!</p>';
        return;
    }

    tasks.forEach(task => {
        const priorityClass = `priority-${task.priority.toLowerCase()}`;
        const completedClass = task.completed ? 'completed' : '';
        const checked = task.completed ? 'checked' : '';
        
        const formattedDate = task.due_date ? new Date(task.due_date).toLocaleString([], {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'No due date';

        const taskHTML = `
            <div class="task-item ${priorityClass} ${completedClass}">
                <input type="checkbox" class="task-checkbox" ${checked} onchange="toggleComplete(${task.id}, this.checked)">
                <div class="task-content">
                    <div class="task-title">${escapeHTML(task.title)}</div>
                    ${task.description ? `<div class="task-desc">${escapeHTML(task.description)}</div>` : ''}
                    <div class="task-meta">
                        <span class="priority-badge">${task.priority}</span>
                        <span>Due: ${formattedDate}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button onclick='editTask(${JSON.stringify(task).replace(/'/g, "&#39;")})'>Edit</button>
                    <button class="btn-delete" onclick="deleteTask(${task.id})">Delete</button>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', taskHTML);
    });
}

async function toggleComplete(id, completed) {
    try {
        await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: completed ? 1 : 0 })
        });
        fetchTasks();
    } catch (err) {
        console.error('Error updating task', err);
    }
}

async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        fetchTasks();
    } catch (err) {
        console.error('Error deleting task', err);
    }
}

function editTask(task) {
    toggleTaskForm(task);
    window.scrollTo(0, 0);
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (err) {
        console.error('Error logging out', err);
    }
}

function updateProgress(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    document.getElementById('progress-text').textContent = `${completed}/${total} Completed`;
    document.getElementById('progress-fill').style.width = `${percentage}%`;
}

function checkUpcomingTasks(tasks) {
    const now = new Date();
    // Look for uncompleted tasks due in the next 24 hours
    const upcoming = tasks.find(t => {
        if (t.completed || !t.due_date) return false;
        const dueDate = new Date(t.due_date);
        const timeDiff = dueDate - now;
        return timeDiff > 0 && timeDiff < 24 * 60 * 60 * 1000; // less than 24h
    });

    const notifArea = document.getElementById('notification-area');
    if (upcoming) {
        const timeStr = new Date(upcoming.due_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        document.getElementById('notification-text').textContent = `"${upcoming.title}" is due soon (at ${timeStr})`;
        notifArea.style.display = 'block';
    } else {
        notifArea.style.display = 'none';
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
