const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const twilio = require('twilio');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const TWILIO_ACCOUNT_SID = 'AC206c0c31a4e784234a59786353e1bcfa';
const TWILIO_AUTH_TOKEN = '4d89cb41a97bf84ba8303e2bfef2c4bf';
const TWILIO_PHONE_NUMBER = '+16592187931';
// const TWILIO_VOICE_URL = 'your-twilio-voice-url';

// Sample secret key for JWT (replace it with a strong secret in production)
const JWT_SECRET = 'your-secret-key';

const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });


mongoose.connect('mongodb://localhost:27017/taskManager', { useNewUrlParser: true, useUnifiedTopology: true });

// MongoDB models
const Task = mongoose.model('Task', {
  title: String,
  description: String,
  due_date: Date,
  priority: Number,
  status: String,
  user_id: mongoose.Schema.Types.ObjectId,
  deleted_at: { type: Date, default: null },
});

const SubTask = mongoose.model('SubTask', {
  task_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  status: Number,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: null },
  deleted_at: { type: Date, default: null },
});

const User = mongoose.model('User', {
  phone_number: String,
  priority: Number,
});

// Sample user data
const users = [
  { id: 1, phone_number: '1234567890', priority: 0 },
  // Add more users as needed
];

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).send('Access denied.');

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send('Invalid token.');
    req.user = user;
    next();
  });
};

// Function to calculate priority based on due_date
const calculatePriority = (dueDate) => {
  // Your priority calculation logic here
  // This is just a placeholder, update it as per your requirements
  return 0;
};

// Function to calculate task status based on subtasks
const calculateTaskStatus = (subtasks) => {
  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter((subtask) => subtask.status === 1).length;

  if (completedSubtasks === 0) {
    return 'TODO';
  } else if (completedSubtasks < totalSubtasks) {
    return 'IN_PROGRESS';
  } else {
    return 'DONE';
  }
};

// API to create a task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  const { title, description, due_date } = req.body;
  const user_id = req.user.id;

  const priority = calculatePriority(due_date);

  try {
    const newTask = new Task({
      title,
      description,
      due_date,
      user_id,
      priority,
      status: 'TODO', // Initial status
    });

    await newTask.save();
    res.json(newTask);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API to create a subtask
app.post('/api/subtasks', authenticateToken, async (req, res) => {
  const { task_id } = req.body;

  try {
    const newSubtask = new SubTask({
      task_id,
      status: 0, // Initial status
    });

    await newSubtask.save();
    res.json(newSubtask);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API to get all user tasks
app.get('/api/tasks', authenticateToken, async (req, res) => {
  const { priority, due_date } = req.query;
  const user_id = req.user.id;

  try {
    const query = { user_id, deleted_at: null };

    if (priority) {
      query.priority = parseInt(priority);
    }

    if (due_date) {
      query.due_date = due_date;
    }

    const tasks = await Task.find(query);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API to get all user subtasks
app.get('/api/subtasks', authenticateToken, async (req, res) => {
  const { task_id } = req.query;

  try {
    const query = { deleted_at: null };

    if (task_id) {
      query.task_id = task_id;
    }

    const subtasks = await SubTask.find(query);
    res.json(subtasks);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API to update a task
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  const taskId = req.params.id;
  const { due_date, status } = req.body;

  try {
    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    task.due_date = due_date;
    task.status = status;
    task.priority = calculatePriority(due_date);

    await task.save();

    // Update corresponding subtasks (you need to implement this logic)
    // ...

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API to update a subtask
app.put('/api/subtasks/:id', authenticateToken, async (req, res) => {
  const subtaskId = req.params.id;
  const { status } = req.body;

  try {
    const subtask = await SubTask.findById(subtaskId);

    if (!subtask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    subtask.status = status;
    subtask.updated_at = new Date();

    await subtask.save();

    res.json(subtask);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API to delete a task (soft deletion)
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  const taskId = req.params.id;

  try {
    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    task.deleted_at = new Date();
    await task.save();

    // Soft delete corresponding subtasks (you need to implement this logic)
    // ...

    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API to delete a subtask (soft deletion)
app.delete('/api/subtasks/:id', authenticateToken, async (req, res) => {
  const subtaskId = req.params.id;

  try {
    const subtask = await SubTask.findById(subtaskId);

    if (!subtask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    subtask.deleted_at = new Date();
    await subtask.save();

    res.json({ message: 'Subtask deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Cron job for changing priority of task based on due_date of task
cron.schedule('0 0 * * *', async () => {
  try {
    const tasks = await Task.find({ deleted_at: null });

    tasks.forEach(async (task) => {
      task.priority = calculatePriority(task.due_date);
      await task.save();
    });
  } catch (error) {
    console.error('Cron Job Error:', error);
  }
});

// Cron job for voice calling using Twilio if a task passes its due_date
cron.schedule('0 0 * * *', async () => {
  try {
    const tasks = await Task.find({ deleted_at: null });

    // Sort tasks by priority and due_date
    const sortedTasks = tasks.sort((a, b) => {
      if (a.priority === b.priority) {
        return new Date(a.due_date) - new Date(b.due_date);
      }
      return a.priority - b.priority;
    });

    const twilioClient = new twilio('your-twilio-account-sid', 'your-twilio-auth-token');

    for (const task of sortedTasks) {
      if (new Date(task.due_date) < new Date() && task.status !== 'DONE') {
        const user = await User.findOne({ _id: task.user_id });

        if (user) {
          // Make Twilio call to user.phone_number
          // This is a placeholder, you need to implement Twilio calling logic
          console.log(`Calling ${user.phone_number} for task: ${task.title}`);
          // twilioClient.calls.create({
          //   to: user.phone_number,
          //   from: 'your-twilio-phone-number',
          //   url: 'your-twilio-voice-url',
          // });
        }
        break; // Break after the first call
      }
    }
  } catch (error) {
    console.error('Cron Job Error:', error);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
