const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { isAuthenticated } = require('./auth');
const prisma = new PrismaClient();

// Create folder
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const folder = await prisma.folder.create({
      data: {
        name: req.body.name,
        userId: req.user.id
      }
    });
    
    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: 'Error creating folder' });
  }
});

// Get all folders for user
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: { userId: req.user.id },
      include: {
        files: true
      }
    });
    
    res.json(folders);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving folders' });
  }
});

// Get specific folder
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id },
      include: {
        files: true
      }
    });
    
    if (!folder || folder.userId !== req.user.id) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving folder' });
  }
});

// Update folder
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id }
    });
    
    if (!folder || folder.userId !== req.user.id) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const updatedFolder = await prisma.folder.update({
      where: { id: req.params.id },
      data: { name: req.body.name }
    });
    
    res.json(updatedFolder);
  } catch (err) {
    res.status(500).json({ message: 'Error updating folder' });
  }
});

// Delete folder
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id }
    });
    
    if (!folder || folder.userId !== req.user.id) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    await prisma.file.deleteMany({
      where: { folderId: req.params.id }
    });

    await prisma.folder.delete({
      where: { id: req.params.id }
    });
    
    res.json({ message: 'Folder deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting folder' });
  }
});

router.post('/:id/share', isAuthenticated, async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id }
    });
    
    if (!folder || folder.userId !== req.user.id) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Calculate expiration date
    const duration = req.body.duration || '1d'; // Default 1 day
    const days = parseInt(duration);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Create share record
    const share = await prisma.sharedFolder.create({
      data: {
        folderId: folder.id,
        expiresAt
      }
    });

    const shareUrl = `${process.env.APP_URL}/share/${share.id}`;
    res.json({ shareUrl, expiresAt });
  } catch (err) {
    res.status(500).json({ message: 'Error sharing folder' });
  }
});

// Access shared folder
router.get('/share/:shareId', async (req, res) => {
  try {
    const share = await prisma.sharedFolder.findUnique({
      where: { id: req.params.shareId },
      include: {
        folder: {
          include: {
            files: true
          }
        }
      }
    });
    
    if (!share || share.expiresAt < new Date()) {
      return res.status(404).json({ message: 'Shared folder not found or expired' });
    }

    res.json({
      folder: {
        name: share.folder.name,
        files: share.folder.files.map(file => ({
          name: file.name,
          size: file.size,
          url: file.url,
          createdAt: file.createdAt
        }))
      },
      expiresAt: share.expiresAt
    });
  } catch (err) {
    res.status(500).json({ message: 'Error accessing shared folder' });
  }
});

module.exports = router;