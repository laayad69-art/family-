const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

// إنشاء التطبيق
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// تخزين الرسائل
let messages = [];
let notes = [];

// مسار ملف لحفظ البيانات
const DATA_FILE = 'data.json';

// تحميل البيانات المحفوظة
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            messages = data.messages || [];
            notes = data.notes || [];
            console.log('تم تحميل البيانات');
        }
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
    }
}

// حفظ البيانات
function saveData() {
    try {
        const data = {
            messages: messages,
            notes: notes,
            lastUpdate: new Date().toISOString()
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        console.log('تم حفظ البيانات');
    } catch (error) {
        console.error('خطأ في حفظ البيانات:', error);
    }
}

// تحميل البيانات عند بدء التشغيل
loadData();

// إعداد Express
app.use(express.static('public'));
app.use(express.json());

// API لاسترجاع البيانات
app.get('/api/messages', (req, res) => {
    res.json({
        success: true,
        messages: messages.slice(-50), // آخر 50 رسالة
        notes: notes.slice(-50) // آخر 50 يومية
    });
});

// API لإضافة رسالة
app.post('/api/messages', (req, res) => {
    const { text, author, type = 'message' } = req.body;
    
    if (!text || !author) {
        return res.status(400).json({ success: false, error: 'نص الرسالة والمؤلف مطلوبان' });
    }
    
    const newItem = {
        id: Date.now(),
        text: text,
        author: author,
        date: new Date().toLocaleString('ar-EG'),
        type: type,
        timestamp: Date.now()
    };
    
    if (type === 'message') {
        messages.push(newItem);
        // إرسال الرسالة الجديدة لجميع المستخدمين المتصلين
        io.emit('newMessage', newItem);
    } else if (type === 'note') {
        notes.push(newItem);
        // إرسال اليومية الجديدة لجميع المستخدمين المتصلين
        io.emit('newNote', newItem);
    }
    
    // حفظ البيانات
    saveData();
    
    res.json({ success: true, data: newItem });
});

// إعداد Socket.io
io.on('connection', (socket) => {
    console.log('👤 مستخدم جديد متصل:', socket.id);
    
    // إرسال البيانات الحالية للمستخدم الجديد
    socket.emit('initialData', {
        messages: messages.slice(-50),
        notes: notes.slice(-50)
    });
    
    // استقبال رسالة جديدة
    socket.on('sendMessage', (data) => {
        console.log('📨 رسالة جديدة من:', data.author);
        
        const newMessage = {
            id: Date.now(),
            text: data.text,
            author: data.author,
            date: new Date().toLocaleString('ar-EG'),
            type: 'message',
            timestamp: Date.now()
        };
        
        messages.push(newMessage);
        
        // إرسال الرسالة لجميع المستخدمين
        io.emit('newMessage', newMessage);
        
        // حفظ البيانات
        saveData();
    });
    
    // استقبال يومية جديدة
    socket.on('sendNote', (data) => {
        console.log('📝 يومية جديدة من:', data.author);
        
        const newNote = {
            id: Date.now(),
            text: data.text,
            author: data.author,
            date: new Date().toLocaleString('ar-EG'),
            type: 'note',
            timestamp: Date.now()
        };
        
        notes.push(newNote);
        
        // إرسال اليومية لجميع المستخدمين
        io.emit('newNote', newNote);
        
        // حفظ البيانات
        saveData();
    });
    
    // عند فصل الاتصال
    socket.on('disconnect', () => {
        console.log('❌ المستخدم انقطع:', socket.id);
    });
});

// تشغيل الخادم
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 الخادم يعمل على: http://localhost:${PORT}`);
    console.log('✨ تطبيق الأسرة جاهز للاستخدام!');
});