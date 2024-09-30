import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


const app = express();
app.use(express.json());



// 댓글 등록
app.post('/api/posts/:id/comments', async (req, res) => {
  const postId = Number(req.params.id);
  const { nickname, content, password } = req.body;

  const fields = [nickname, content, password]
  if (fields.some(field => !field)) {
    return res.status(400).send({ "message": "잘못된 요청입니다" });
  };

  const newComment = await prisma.comment.create({
    data: {
      nickname,
      content,
      password,
      postId: postId,
    }
  });

  const { password: pwd, ...commentWithoutPassword } = newComment;
  res.status(200).send(commentWithoutPassword);
});


// 댓글 수정
app.put('/api/comments/:id', async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.password;
  const comment = await prisma.comment.findUnique({
    where: { id },
  });

  if (comment && comment.password === password) {
    const updatedData = {};
    Object.keys(req.body).forEach((key) => {
      if (key !== 'password') {
        updatedData[key] = req.body[key];
      }
    });

    const updatedComment = await prisma.comment.update({
      where : { id },
      data: updatedData,
    });

    const { password, ...commentWithoutPassword } = updatedComment;
    res.status(200).send(commentWithoutPassword);
  } else if (comment.password !== password) {
    res.status(403).send({ message: '비밀번호가 틀렸습니다' });
  } else if (!comment) {
    res.status(404).send({ message: '존재하지 않습니다' });
  } else {
    res.status(400).send({ message: '잘못된 요청입니다' });
  }
});




// 댓글 삭제
app.delete('/api/comments/:id', async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.password;
  const comment = await prisma.comment.findUnique({
    where: { id },
  });

  if ( comment && comment.password === password) {
    await prisma.comment.delete({
      where: { id }, 
    });
    res.status(200).send({ message: '답글 삭제 성공' });
  } else if (comment.password !== password) {
    res.status(403).send({ message: '비밀번호가 틀렸습니다' });
  } else if (!comment) {
    res.status(404).send({ message: '존재하지 않습니다' });
  } else {
    res.status(400).send({ message: '잘못된 요청입니다' });
  }
});