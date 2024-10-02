import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


const app = express();
app.use(express.json());



// 댓글 등록
app.post('/api/posts/:id/comments', asyncHandler(async (req, res) => {
  const postId = Number(req.params.id);
  const commentData = { ...req.body, postId };

  const newComment = await prisma.comment.create({
    data: commentData,
  });

  await prisma.post.update({
    where: { id: postId },
    data: { commentCount: { increment: 1 } },
  });

  const { password: pwd, ...commentWithoutPassword } = newComment;
  res.status(200).send(commentWithoutPassword);
}));



// 댓글 수정
app.put('/api/comments/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.password;
  const comment = await prisma.comment.findUnique({
    where: { id },
  });

  if (!comment) {
    return res.status(404).send({ message: '존재하지 않습니다' });
  }

  if (comment.password === password) {
    const updatedComment = await prisma.comment.update({
      where : { id },
      data: req.body,
    });

    const { password, ...commentWithoutPassword } = updatedComment;
    res.status(200).send(commentWithoutPassword);
  } else {
    res.status(403).send({ message: '비밀번호가 틀렸습니다' });
  } 

}));



// 댓글 삭제
app.delete('/api/comments/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.password;
  const comment = await prisma.comment.findUnique({
    where: { id },
  });

  if (!comment) {
    return res.status(404).send({ message: '존재하지 않습니다' });
  }

  if (comment.password === password) {
    await prisma.comment.delete({
      where: { id }, 
    });
    res.status(200).send({ message: '답글 삭제 성공' });
  } else {
    res.status(403).send({ message: '비밀번호가 틀렸습니다' });
  } 
}));
