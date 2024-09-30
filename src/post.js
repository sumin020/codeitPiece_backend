import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


const app = express();
app.use(express.json());




// 게시글 등록
app.post('/api/groups/:id/posts', async (req, res) => {
  const groupId = Number(req.params.id);
  const {
    nickname,
    title,
    content,
    postPassword,
    groupPassword,
    imageUrl,
    tags,
    location,
    moment,
    isPublic,
  } = req.body;

  const fields = [nickname, title, content, postPassword, groupPassword, imageUrl, tags, location, moment, isPublic]
  if (fields.some(field => !field)) {
    return res.status(400).send({ "message": "잘못된 요청입니다" });
  };

  const newPost = await prisma.post.create({
    data: {
      nickname,
      title,
      content,
      postPassword,
      groupPassword,
      imageUrl,
      tags,       
      location,
      moment,
      isPublic,
      groupId: groupId,
      likecount: 0,
      commentCount: 0,
    }
  });

  const { postPassword: ppwd, groupPassword: gpwd, ...postWithoutPasswords } = newPost;
  res.status(200).send(postWithoutPasswords);
});




// 게시글 목록 조회


// 게시글 상세 정보 조회
app.get('/api/posts/:id', async (req, res) => {
  const id = Number(req.params.id);
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      comments: true,
    },
  });

  if (req.query.like === 'true') {
    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        likecount: post.likecount + 1, 
      },
    });
    
    return; 
  }
  
  const { postPassword, groupPassword, ...postWithoutPasswords } = post;
  res.status(200).send(postWithoutPasswords);
});




// 게시글 수정


app.put('/api/posts/:id', async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.postPassword;
  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (post && post.postPassword === password) {
    const updatedData = {};
    Object.keys(req.body).forEach((key) => {
      if (key !== 'postPassword') {
        updatedData[key] = req.body[key];
      }
    });

    const updatedPost = await prisma.post.update({
      where : { id },
      data: updatedData,
    });

    const { postPassword, ...postWithoutPassword } = updatedPost;
    res.status(200).send(postWithoutPassword);
  } else if (post.postPassword !== password) {
    res.status(403).send({ message: '비밀번호가 틀렸습니다' });
  } else if (!post) {
    res.status(404).send({ message: '존재하지 않습니다' });
  } else {
    res.status(400).send({ message: '잘못된 요청입니다' });
  }
});




// 게시글 삭제


app.delete('/api/posts/:id', async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.postPassword;
  const post = await prisma.post.findUnique({
    where: { id },
  });

  if ( post && post.postPassword === password) {
    await prisma.post.delete({
      where: { id }, 
    });
    res.status(200).send({ message: '게시글 삭제 성공' });
  } else if (post.postPassword !== password) {
    res.status(403).send({ message: '비밀번호가 틀렸습니다' });
  } else if (!post) {
    res.status(404).send({ message: '존재하지 않습니다' });
  } else {
    res.status(400).send({ message: '잘못된 요청입니다' });
  }
});




// 게시글 조회 권한 확인

app.post('/api/posts/:id/verify-password', async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.postPassword;
  const post = await prisma.post.findUnique({
    where: { id },
  });
  if (post && post.postPassword === password) {
    res.status(200).send({ message: '비밀번호가 확인되었습니다' });
  } else {
    res.status(401).send({ message: '비밀번호가 틀렸습니다' });
  }
});




// 게시글 공감하기

app.post('/api/posts/:id/like', async (req, res) => {
  const id = Number(req.params.id);
  const post = await prisma.post.findUnique({
    where: { id },
  });
  if (post) {
    const updatedPost = await prisma.post.update({
      where: { id },
      data: { likeCount: post.likeCount + 1 }, 
    });
    res.status(200).send({ message: '게시글 공감하기 성공' });
  } else {
    res.status(404).send({ message: '존재하지 않습니다' });
  }
});




// 게시글 공개 여부

app.get('/api/posts/:id/is-public', async (req, res) => {
  const id = Number(req.params.id);
  const post = await prisma.post.findUnique({
    where: { id },
  });
  if (post) {
    res.status(200).send({ id: post.id, isPublic: post.isPublic });
  } else {
    res.status(404).send({ message: 'Cannot find given id. '});
  }
});

