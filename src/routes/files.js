const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const { isAuthenticated } = require('./auth'); // Import the auth middleware
const prisma = new PrismaClient();

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Make sure this directory exists
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Route to handle file upload
router.post('/upload', 
    isAuthenticated,
    upload.single('file'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            const file = await prisma.file.create({
                data: {
                    name: req.file.originalname,
                    size: req.file.size,
                    mimeType: req.file.mimetype,
                    path: req.file.path,
                    userId: req.user.id,
                    folderId: req.body.folderId || null
                }
            });

            res.json(file);
        } catch (error) {
            console.error('File upload error:', error);
            res.status(500).json({ message: 'Error uploading file' });
        }
    }
);

// Route to download a file
router.get('/:id/download', isAuthenticated, async (req, res) => {
    try {
        const file = await prisma.file.findUnique({
            where: { id: req.params.id }
        });

        if (!file || file.userId !== req.user.id) {
            return res.status(404).json({ message: 'File not found' });
        }

        res.download(file.path, file.name);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ message: 'Error downloading file' });
    }
});

// Route to delete a file
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const file = await prisma.file.findUnique({
            where: { id: req.params.id }
        });

        if (!file || file.userId !== req.user.id) {
            return res.status(404).json({ message: 'File not found' });
        }

        await prisma.file.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ message: 'Error deleting file' });
    }
});

// Route to get file details
router.get('/:id', isAuthenticated, async (req, res) => {
    try {
        const file = await prisma.file.findUnique({
            where: { id: req.params.id }
        });

        if (!file || file.userId !== req.user.id) {
            return res.status(404).json({ message: 'File not found' });
        }

        res.json(file);
    } catch (error) {
        console.error('File details error:', error);
        res.status(500).json({ message: 'Error getting file details' });
    }
});

module.exports = router;