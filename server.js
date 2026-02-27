import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from the Vite build directory
app.use(express.static(path.join(__dirname, 'dist')));

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));

// Database Schema
const EngagementSchema = new mongoose.Schema({
    poemId: { type: String, required: true, unique: true },
    likes: { type: Number, default: 0 },
    comments: [{
        id: String,
        text: String,
        timestamp: String,
        replies: [{
            id: String,
            text: String,
            timestamp: String
        }],
        reactions: {
            type: Map,
            of: Number,
            default: {}
        }
    }]
});

const Engagement = mongoose.model('Engagement', EngagementSchema);

io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id);

    try {
        const allData = await Engagement.find({});
        const dataMap = {};
        allData.forEach(item => {
            dataMap[item.poemId] = { likes: item.likes, comments: item.comments };
        });
        socket.emit('initial_data', dataMap);
    } catch (err) {
        console.error('Error fetching initial data:', err);
    }

    socket.on('like_poem', async (poemId) => {
        try {
            let data = await Engagement.findOneAndUpdate(
                { poemId },
                { $inc: { likes: 1 } },
                { upsert: true, new: true }
            );
            io.emit('engagement_update', { poemId, data: { likes: data.likes, comments: data.comments } });
            socket.broadcast.emit('notification', `Someone loved poem #${poemId}!`);
        } catch (err) {
            console.error('Error liking poem:', err);
        }
    });

    socket.on('add_comment', async ({ poemId, text }) => {
        const comment = { id: Date.now().toString(), text, timestamp: new Date().toISOString(), replies: [], reactions: {} };
        try {
            let data = await Engagement.findOneAndUpdate({ poemId }, { $push: { comments: comment } }, { upsert: true, new: true });
            io.emit('engagement_update', { poemId, data: { likes: data.likes, comments: data.comments } });
            socket.broadcast.emit('notification', `New comment on poem #${poemId}`);
        } catch (err) {
            console.error('Error adding comment:', err);
        }
    });

    socket.on('add_reply', async ({ poemId, commentId, replyText }) => {
        const reply = { id: Date.now().toString(), text: replyText, timestamp: new Date().toISOString() };
        try {
            let data = await Engagement.findOneAndUpdate({ poemId, "comments.id": commentId }, { $push: { "comments.$.replies": reply } }, { new: true });
            if (data) io.emit('engagement_update', { poemId, data: { likes: data.likes, comments: data.comments } });
        } catch (err) {
            console.error('Error adding reply:', err);
        }
    });

    socket.on('add_reaction', async ({ poemId, commentId, emoji }) => {
        try {
            const data = await Engagement.findOneAndUpdate({ poemId, "comments.id": commentId }, { $inc: { [`comments.$.reactions.${emoji}`]: 1 } }, { new: true });
            if (data) io.emit('engagement_update', { poemId, data: { likes: data.likes, comments: data.comments } });
        } catch (err) {
            console.error('Error adding reaction:', err);
        }
    });

    socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// Catch-all route to serve the app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Production server running on port ${PORT}`);
});
