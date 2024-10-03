import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import postRouter from './routes/post.js';
import commentRouter from './routes/comment.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();

// 미들웨어
app.use(express.json()); 

// 라우터
app.use('/api', postRouter);
app.use('/api', commentRouter);

app.listen(3000, () => { console.log('Server Started'); });