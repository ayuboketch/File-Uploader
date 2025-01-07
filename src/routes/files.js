const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { isAuthenticated } = require('./auth');
const upload = require('../config/multer');
const supabase = require('../config/supabase');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

// Upload file
router.post('/upload', 
  isAuthenticated,
  upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file;
      const fileStream = fs.createReadStream(file.path);
      const fileName = `${Date.now()}-${file.originalname}`;
      const folderPath = req.body.folderId ? `folder-${req.body.folderId}` : 'general';
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('files')
        .upload(`${req.user.id}/${folderPath}/${fileName}`, fileStream, {
          contentType: file.mimetype,
          cacheControl: '3600'
        });

      if (error) {
        throw new Error(error.message);
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('files')
        .getPublicUrl(`${req.user.id}/${folderPath}/${fileName}`);

      // Create file record in database
      const fileRecord = await prisma.file.create({
        data: {
          name: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          url: publicUrl,
          userId: req.user.id,
          folderId: req.body.folderId || null
        }
      });

      // Clean up local file
      await fs.promises.unlink(file.path);
      
      res.json(fileRecord);
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ message: 'Error uploading file' });
    }
});

// Download file
router.get('/:id/download', isAuthenticated, async (req, res) => {
  try {
    const file = await prisma.file.findUnique({
      where: { id: req.params.id }
    });
    
    if (!file || file.userId !== req.user.id) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Redirect to Supabase storage URL
    res.redirect(file.url);
  } catch (err) {
    res.status(500).json({ message: 'Error downloading file' });
  }
});

// Delete file
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const file = await prisma.file.findUnique({
      where: { id: req.params.id }
    });
    
    if (!file || file.userId !== req.user.id) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Extract path from URL
    const urlPath = new URL(file.url).pathname;
    const storagePath = urlPath.split('/').slice(-3).join('/');

    // Delete from Supabase storage
    const { error } = await supabase.storage
      .from('files')
      .remove([storagePath]);

    if (error) {
      throw new Error(error.message);
    }

    // Delete from database
    await prisma.file.delete({
      where: { id: req.params.id }
    });
    
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ message: 'Error deleting file' });
  }
});