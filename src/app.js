import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import groupRouter from './routes/group.js';
import postRouter from './routes/post.js';
import commentRouter from './routes/comment.js';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });
const prisma = new PrismaClient();
const app = express();

app.use(express.json()); 

// 각 라우트에 Prisma 클라이언트를 전달
app.use((req, res, next) => {
  req.prisma = prisma; 
  next();
});

// 라우터 등록
app.use('/api', postRouter);
app.use('/api', commentRouter);
app.use('/api/groups', groupRouter);

// 이미지 URL 생성
app.post('/api/image', upload.single('image'), (req, res) => {
  const imageUrl = `/api/image/${req.file.filename}`;
  res.status(200).send({ imageUrl });
});

// 정적 파일 제공
app.use('/api/image', express.static('uploads/'));

app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
