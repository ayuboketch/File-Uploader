require('dotenv').config();
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { PrismaSessionStore } from 'connect-prisma-session';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { configurePassport } from './config/passport.js';
import authRoutes from './routes/auth.js';
import folderRoutes from './routes/folders.js';
import fileRoutes from './routes/files.js';
import shareRoutes from './routes/share.js';

const prisma = new PrismaClient();
const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), 'public')));

// Session setup
app.use(
  session({
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,  // 2 minutes
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// Passport configuration
configurePassport(passport);
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/', authRoutes);
app.use('/folders', folderRoutes);
app.use('/files', fileRoutes);
app.use('/share', shareRoutes);

// Home route
app.get('/', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }
  res.redirect('/folders');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});