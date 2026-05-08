// static/app.js
document.addEventListener('DOMContentLoaded', () => {
    fetchTasks();
    initCalendar();
});

let allTasks = [];
let calendarDate = new Date();
let countdownInterval;

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
        checkHighPriorityPending(tasks);
        suggestTask(tasks);
        generateCalendar();
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

    tasks.forEach((task, index) => {
        const priorityClass = `priority-${task.priority.toLowerCase()}`;
        const completedClass = task.completed ? 'completed' : '';
        const checked = task.completed ? 'checked' : '';
        const delay = index * 0.05; // Cascading animation delay
        
        const formattedDate = task.due_date ? new Date(task.due_date).toLocaleString([], {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'No due date';

        const taskHTML = `
            <div class="task-item animated-entry ${priorityClass} ${completedClass}" style="animation-delay: ${delay}s">
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

function checkHighPriorityPending(tasks) {
    const hasHighPending = tasks.some(t => t.priority === 'High' && !t.completed);
    document.getElementById('high-priority-warning').style.display = hasHighPending ? 'flex' : 'none';
}

function suggestTask(tasks) {
    const suggestionContent = document.getElementById('suggested-task-content');
    clearInterval(countdownInterval);

    // Filter pending tasks
    const pending = tasks.filter(t => !t.completed);
    if (pending.length === 0) {
        suggestionContent.innerHTML = '<p class="text-muted">All caught up! No tasks to suggest.</p>';
        return;
    }

    // Priority weights
    const weight = { 'High': 3, 'Medium': 2, 'Low': 1 };
    
    // Sort by priority first, then closest due date
    pending.sort((a, b) => {
        if (weight[a.priority] !== weight[b.priority]) {
            return weight[b.priority] - weight[a.priority];
        }
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
    });

    const suggested = pending[0];
    
    let html = `
        <div class="suggested-task-card">
            <strong>${escapeHTML(suggested.title)}</strong>
            <span class="priority-badge" style="margin-left: 0.5rem; font-size: 0.6rem;">${suggested.priority}</span>
            <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">
                ${suggested.description ? escapeHTML(suggested.description) : 'No description'}
            </div>
            <span class="time-left" id="time-left-display"></span>
            <button onclick="toggleComplete(${suggested.id}, true)" class="primary" style="margin-top: 1rem; padding: 0.4rem; font-size: 0.8rem;">Mark Complete</button>
        </div>
    `;
    suggestionContent.innerHTML = html;

    if (suggested.due_date) {
        updateCountdown(suggested.due_date);
        countdownInterval = setInterval(() => updateCountdown(suggested.due_date), 1000);
    } else {
        document.getElementById('time-left-display').textContent = 'No due date set.';
    }
}

function updateCountdown(dueDateStr) {
    const display = document.getElementById('time-left-display');
    if (!display) return;

    const now = new Date();
    const due = new Date(dueDateStr);
    const diff = due - now;

    if (diff <= 0) {
        display.textContent = 'Overdue!';
        display.style.color = 'var(--priority-high-text)';
        return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    display.textContent = `Time left: ${hours}h ${minutes}m ${seconds}s`;
}

function initCalendar() {
    document.getElementById('prev-month').addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        generateCalendar();
    });
    document.getElementById('next-month').addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        generateCalendar();
    });
}

function generateCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthYearDisplay = document.getElementById('calendar-month-year');
    
    if (!grid) return;
    grid.innerHTML = '';

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];
    
    monthYearDisplay.textContent = `${monthNames[month]} ${year}`;

    // Previous month empty slots
    for (let i = 0; i < startingDay; i++) {
        const emptySlot = document.createElement('div');
        emptySlot.className = 'calendar-day empty';
        grid.appendChild(emptySlot);
    }

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    for (let i = 1; i <= daysInMonth; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        if (isCurrentMonth && today.getDate() === i) {
            dayCell.classList.add('today');
        }

        const dateSpan = document.createElement('span');
        dateSpan.textContent = i;
        dayCell.appendChild(dateSpan);

        // Find tasks for this day
        const dayTasks = allTasks.filter(t => {
            if (!t.due_date) return false;
            const tDate = new Date(t.due_date);
            return tDate.getFullYear() === year && tDate.getMonth() === month && tDate.getDate() === i;
        });

        if (dayTasks.length > 0) {
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'calendar-dots';
            
            // max 3 dots to avoid overflowing the cell visually
            const maxDots = Math.min(dayTasks.length, 3);
            for (let j = 0; j < maxDots; j++) {
                const dot = document.createElement('div');
                dot.className = `task-dot ${dayTasks[j].priority.toLowerCase()}`;
                dotsContainer.appendChild(dot);
            }
            if(dayTasks.length > 3) {
                 const plus = document.createElement('span');
                 plus.style.fontSize = '8px';
                 plus.style.color = 'var(--text-muted)';
                 plus.textContent = '+';
                 dotsContainer.appendChild(plus);
            }

            dayCell.appendChild(dotsContainer);
            dayCell.title = dayTasks.map(t => t.title).join('\n');
        }

        grid.appendChild(dayCell);
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
